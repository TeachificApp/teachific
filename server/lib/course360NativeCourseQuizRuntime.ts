import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { quizzes, quizAttempts, lmsCourses, lmsLessons, lmsEnrollments } from "../../drizzle/schema";
import { requireSelectedQuizLearnerSchool } from "./quizLearnerSelectedSchoolRuntime";
import { requireCourse360AppOrganization } from "./course360AppCapabilities";
import { resolvePublicOrganizationScope } from "./publicOrgRequestScope";
import { assertPublicQuizDeliveryHost } from "./publicQuizDeliveryScope";
import { organizations } from "../../drizzle/schema";
import { readNativeQuizConfig, nativeQuizPlayerSettings, redactNativeQuizQuestions } from "./quizNativeConfigRuntime";
import { scoreNativeQuizAttempt } from "../../shared/quizScoring";

const fail = (message: string): never => { throw new TRPCError({ code: "FORBIDDEN", message }); };
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
export const nativeCourseContextInput = z.object({ quizId: z.number().int().positive(), courseSlug: z.string().min(1).max(255), sourceLessonId: z.number().int().positive(), authorPreview: z.boolean().default(false) });
type ContextInput = z.infer<typeof nativeCourseContextInput>;
type Context = { user: { id: number }; req?: any };
async function connection() { const db = await getDb(); if (!db) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "School access unavailable." }); return db; }
export function isCourse360NativeQuiz(row: any) { const config = readNativeQuizConfig(row); return config.meta.nativeRevision > 0 || config.questions.some(q => typeof q?.id === "string" && typeof q?.type === "string"); }
export function nativeCourseSnapshot(value: any): any | null { return value?.kind === "course360_native_course_quiz_v1" ? value : null; }
export function rejectNativeCourseLegacyAccess(attempt: any) { if (nativeCourseSnapshot(attempt?.questionSnapshot)) fail("Open this native quiz attempt from its assigned course lesson."); }

/** Shared learner authority: explicit saved school + host + exact assigned parent, never email/global-role fallback. */
export async function resolveCourse360QuizLessonAccess(ctx: Context, input: { quizId: number; courseSlug?: string; sourceLessonId?: number; authorPreview?: boolean }, db = undefined as any) {
  db ??= await connection();
  const orgId = input.authorPreview ? (await requireCourse360AppOrganization(ctx.user.id)).orgId : await requireSelectedQuizLearnerSchool(ctx.user.id);
  const [school] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
  if (!school?.isActive) fail("Select the active quiz school.");
  assertPublicQuizDeliveryHost(ctx.req, school);
  const hostScope = await resolvePublicOrganizationScope(db, ctx.req);
  if (hostScope && ["custom_domain", "course360_subdomain"].includes(hostScope.source) && hostScope.id !== orgId) fail("Switch to the school serving this course.");
  const [quiz] = await db.select().from(quizzes).where(and(eq(quizzes.id, input.quizId), eq(quizzes.orgId, orgId))).limit(1);
  if (!quiz || quiz.orgId !== orgId) fail("Quiz is not available in the selected school.");
  // Retained legacy author-side block preview, but native course attempts always require their exact course+lesson source.
  if (input.authorPreview && !input.courseSlug && !input.sourceLessonId && !isCourse360NativeQuiz(quiz)) return { quiz, course: null, lesson: null, enrollment: null, orgId, isStaffPreview: true, mode: "author_preview" };
  if (!input.courseSlug || !input.sourceLessonId) fail("Open this quiz from its assigned course lesson.");
  const [lesson] = await db.select().from(lmsLessons).where(and(eq(lmsLessons.id, input.sourceLessonId!), eq(lmsLessons.standaloneQuizId, quiz.id))).limit(1);
  if (!lesson || lesson.standaloneQuizId !== quiz.id || !["quiz", "exam"].includes(lesson.type) || !lesson.courseId || lesson.orgId != null && lesson.orgId !== orgId) fail("Quiz is not assigned to this course lesson.");
  const [course] = await db.select().from(lmsCourses).where(and(eq(lmsCourses.id, lesson.courseId), eq(lmsCourses.slug, input.courseSlug!), eq(lmsCourses.orgId, orgId))).limit(1);
  if (!course || course.orgId !== orgId || course.slug !== input.courseSlug || course.id !== lesson.courseId) fail("Quiz is not available in this course.");
  if (input.authorPreview) return { quiz, course, lesson, enrollment: null, orgId, isStaffPreview: true, mode: "author_preview" };
  if (!["public", "hidden", "private"].includes(course.status) || !(quiz.isPublished || quiz.visibility === "published")) throw new TRPCError({ code: "NOT_FOUND", message: "Course quiz is not published." });
  const [enrollment] = await db.select().from(lmsEnrollments).where(and(eq(lmsEnrollments.orgId, orgId), eq(lmsEnrollments.userId, ctx.user.id), eq(lmsEnrollments.courseId, course.id))).limit(1);
  const previewMode = lesson.previewMode ?? (lesson.isPreview ? "preview" : "none");
  const previewLesson = ["preview", "preview_hide_after_purchase"].includes(previewMode);
  // A retained explicit lesson preview can exist without enrollment. An invalid persisted enrollment does not turn into a preview bypass.
  if (enrollment && (enrollment.orgId !== orgId || enrollment.userId !== ctx.user.id || enrollment.courseId !== course.id || !["active", "completed"].includes(enrollment.status) || [enrollment.accessExpiresAt, enrollment.expiresAt].some(d => d && new Date(d).getTime() <= Date.now()))) fail("Active course enrollment is required.");
  if (!enrollment && !previewLesson || enrollment?.enrollmentType === "free_preview" && !previewLesson) fail("Active course enrollment is required.");
  return { quiz, course, lesson, enrollment: enrollment ?? null, orgId, isStaffPreview: false, mode: !enrollment || enrollment.enrollmentType === "free_preview" ? "lesson_preview" : "enrolled" };
}
type Access = Awaited<ReturnType<typeof resolveCourse360QuizLessonAccess>>;
function source(access: Access, ctx: Context) { return { orgId: access.orgId, courseId: access.course!.id, sourceLessonId: access.lesson!.id, enrollmentId: access.enrollment?.id ?? null, userId: ctx.user.id, nativeQuizId: readNativeQuizConfig(access.quiz).meta.id, cloudQuizId: access.quiz.id, mode: access.mode }; }
function sourceMatches(snapshot: any, access: Access, ctx: Context) { const expected = source(access, ctx); return Object.entries(expected).every(([key, value]) => snapshot.source?.[key] === value); }
function requireAttempt(attempt: any, access: Access, ctx: Context, input: ContextInput) {
  const snapshot = nativeCourseSnapshot(attempt?.questionSnapshot);
  if (!snapshot || attempt.userId !== ctx.user.id || attempt.quizId !== input.quizId || attempt.sourceType !== "lesson" || attempt.sourceLessonId !== input.sourceLessonId || !sourceMatches(snapshot, access, ctx)) fail("Attempt is not available in this course lesson and enrollment.");
  if (snapshot.source.nativeQuizId !== snapshot.nativeConfig.meta.id || snapshot.source.cloudQuizId !== attempt.quizId) fail("Native quiz snapshot identity is invalid.");
  return snapshot;
}
function checkOpen(attempt: any, snapshot: any) {
  if (attempt.status !== "in_progress" || snapshot.submittedAt || snapshot.gradingStatus !== "in_progress") fail("This attempt has already been submitted.");
  if (snapshot.deadlineAt != null && Date.now() >= snapshot.deadlineAt) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Quiz deadline has expired. Saved answers can still be submitted." });
}
const pick = (value: any, keys: string[]) => Object.fromEntries(keys.filter(k => value?.[k] !== undefined).map(k => [k, clone(value[k])]));
/** Unknown author JSON remains in the private snapshot, never in initial learner transport. */
function courseLearnerQuestion(q: any) {
  const d = q.data ?? {};
  const dataKeys: Record<string, string[]> = {
    mcq: ["multiSelect"], image_choice: ["multiSelect"], tf: [], hotspot: ["imageUrl", "imageAlt", "multiSelect"], matching: [],
    fill_blank: ["template"], short_answer: ["autoGrade"], ordering: [], numeric: ["unit"], dropdown: ["template"], drag_words: ["template", "wordOptions"],
    drag_drop: ["backgroundImageUrl"], image_labeling: ["imageUrl"], likert: ["scaleLabels", "scaleSize"], essay: ["minWords", "maxWords", "placeholder"], image_comparison: ["comparisonImageA", "comparisonImageB", "comparisonLabelA", "comparisonLabelB"], info_slide: [],
  };
  const data = pick(d, dataKeys[q.type] ?? []);
  const itemKeys: Record<string, string[]> = { choices: ["id", "text", "label", "imageUrl"], regions: ["id", "label", "shape", "x", "y", "width", "height", "radius", "points"], pairs: ["id", "premise", "premiseImageUrl"], blanks: ["id", "options"], items: ["id", "text", "imageUrl"], targets: ["id", "label", "x", "y", "width", "height"], labels: ["id", "text"], statements: ["id", "text"] };
  for (const [key, keys] of Object.entries(itemKeys)) if (Array.isArray(d[key])) data[key] = d[key].map((item: any) => pick(item, keys));
  const safe = pick(q, ["id", "type", "stem", "stemHtml", "points", "required", "order", "showWhen", "lockAnswerOrder"]);
  if (q.image) safe.image = pick(q.image, ["url", "alt"]);
  return { ...safe, data };
}
function makeSnapshot(access: Access, ctx: Context) {
  const nativeConfig = clone(readNativeQuizConfig(access.quiz));
  const ids = nativeConfig.questions.map(q => q.id);
  if (!ids.length || ids.length > 500 || ids.some(id => typeof id !== "string" || !id || id.length > 255 || ["__proto__", "constructor", "prototype"].includes(id)) || new Set(ids).size !== ids.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Native quiz question identifiers are invalid." });
  // Do not silently flatten authored branching/draw into an all-question bank quiz.
  if (nativeConfig.meta.branchingEnabled || nativeConfig.meta.drawConfig?.enabled) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Native course branching and question draws are not supported yet. Disable them for this lesson quiz." });
  const matchingMap: Record<string, Record<string, string>> = {};
  const learnerQuestions = redactNativeQuizQuestions(nativeConfig.questions).map(courseLearnerQuestion);
  for (const q of learnerQuestions) {
    if (q.type === "matching") {
      const canonical = nativeConfig.questions.find(item => item.id === q.id)!;
      const map: Record<string, string> = {};
      q.data.responses = canonical.data.pairs.map((pair: any) => { const id = randomBytes(18).toString("base64url"); map[id] = pair.id; return { id, text: pair.response, imageUrl: pair.responseImageUrl }; }).sort((a: any, b: any) => a.id.localeCompare(b.id));
      matchingMap[q.id] = map;
    }
  }
  if (nativeConfig.meta.shuffleQuestions) learnerQuestions.sort(() => Math.random() - 0.5);
  if (nativeConfig.meta.shuffleAnswers) for (const q of learnerQuestions) if (!q.lockAnswerOrder && Array.isArray(q.data?.choices)) q.data.choices.sort(() => Math.random() - 0.5);
  const startedAt = Date.now();
  const authoredSettings = nativeQuizPlayerSettings(access.quiz);
  const settings = pick(authoredSettings, ["passingScore", "timeLimit", "maxAttempts", "allowRetry", "allowBackNavigation", "showFeedback"]);
  return { kind: "course360_native_course_quiz_v1", version: 1, source: source(access, ctx), nativeConfig, matchingMap, learnerQuestions, settings, startedAt, deadlineAt: settings.timeLimit == null ? null : startedAt + settings.timeLimit * 1000, answers: {}, answerRevision: 0, gradingStatus: "in_progress", submittedAt: null };
}
function publicState(attempt: any, snapshot: any) {
  return { kind: "native" as const, attemptId: attempt.id, questions: clone(snapshot.learnerQuestions), settings: clone(snapshot.settings), deadlineAt: snapshot.deadlineAt, answerRevision: snapshot.answerRevision, answers: clone(snapshot.answers), gradingStatus: snapshot.gradingStatus, result: snapshot.submittedAt ? resultState(attempt, snapshot) : null };
}
function resultState(attempt: any, snapshot: any) {
  const grade = snapshot.scoring;
  return { kind: "native" as const, attemptId: attempt.id, score: grade.scorePercent, earnedPoints: grade.earnedPoints, totalPoints: grade.totalPoints, passed: !grade.pendingManual && attempt.passed === true, gradingStatus: snapshot.gradingStatus, correctAnswers: Object.values(grade.grades).filter((g: any) => g.correct).length, totalQuestions: Object.keys(grade.grades).length, timeSpentSeconds: attempt.timeSpentSeconds ?? 0, canCompleteLesson: snapshot.source.mode === "enrolled" && !grade.pendingManual && attempt.passed === true, breakdown: null };
}
const answerValue = z.union([z.string().max(20000), z.number().finite(), z.boolean(), z.array(z.union([z.string().max(255), z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) })])).max(500), z.record(z.string().min(1).max(255), z.string().max(20000))]);
const answersSchema = z.record(z.string().min(1).max(255), answerValue).superRefine((value, ctx) => { if (Object.keys(value).length > 500 || JSON.stringify(value).length > 250000) ctx.addIssue({ code: "custom", message: "Answer payload exceeds limits." }); });
const attemptInput = nativeCourseContextInput.extend({ attemptId: z.number().int().positive() });
const saveInput = attemptInput.extend({ answers: answersSchema, expectedAnswerRevision: z.number().int().min(0) });
function canonicalAnswers(snapshot: any, answers: Record<string, unknown>) {
  const ids = new Set(snapshot.nativeConfig.questions.map((q: any) => q.id));
  for (const id of Object.keys(answers)) if (!ids.has(id)) throw new TRPCError({ code: "BAD_REQUEST", message: "Answer references a foreign question." });
  const canonical = clone(answers);
  for (const q of snapshot.nativeConfig.questions) if (q.type === "matching" && canonical[q.id] != null) {
    const raw = canonical[q.id];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new TRPCError({ code: "BAD_REQUEST", message: "Matching answer is invalid." });
    const pairIds = new Set(q.data.pairs.map((p: any) => p.id));
    const map = snapshot.matchingMap[q.id];
    for (const [premise, response] of Object.entries(raw)) {
      if (!pairIds.has(premise) || typeof response !== "string" || !Object.hasOwn(map, response)) throw new TRPCError({ code: "BAD_REQUEST", message: "Matching response is not part of this attempt." });
      (canonical[q.id] as any)[premise] = map[response];
    }
  }
  return canonical;
}
async function attemptsFor(db: any, access: Access, ctx: Context) {
  const rows = await db.select().from(quizAttempts).where(and(eq(quizAttempts.quizId, access.quiz.id), eq(quizAttempts.userId, ctx.user.id), eq(quizAttempts.sourceLessonId, access.lesson!.id), eq(quizAttempts.sourceType, "lesson"))).orderBy(desc(quizAttempts.startedAt));
  return rows.filter((a: any) => { const s = nativeCourseSnapshot(a.questionSnapshot); return s && sourceMatches(s, access, ctx); });
}
export async function nativeCourseInfo(access: Access, ctx: Context, db: any) {
  const rows = await attemptsFor(db, access, ctx);
  const config = readNativeQuizConfig(access.quiz), max = config.meta.maxAttempts ?? 0;
  const resumable = rows.find((a: any) => a.status === "in_progress" && !a.questionSnapshot.submittedAt);
  const awaitingReview = rows.some((a: any) => a.questionSnapshot.gradingStatus === "pending_manual");
  return { kind: "native" as const, awaitingReview, latestAttemptId: rows.find((a: any) => a.questionSnapshot.submittedAt)?.id ?? null, title: access.quiz.title, description: access.quiz.description, questionCount: config.questions.length, timeLimitMinutes: config.meta.timeLimit, passingScore: config.meta.passingScore, type: config.meta.mockExamEnabled ? "mock_exam" : "quiz", showExplanations: access.quiz.showExplanations, attemptCount: rows.length, maxAttempts: max || null, allowRetakes: !awaitingReview && config.meta.allowRetry !== false && (!max || rows.length < max), canAttempt: !awaitingReview && (!!resumable || !rows.length || config.meta.allowRetry !== false && (!max || rows.length < max)), isStaffPreview: access.isStaffPreview };
}
export const course360NativeCourseQuizProcedures = {
  getNativeCourseAttempt: protectedProcedure.input(attemptInput).query(async ({ ctx, input }) => { const access = await resolveCourse360QuizLessonAccess(ctx, input); const db = await connection(); const [attempt] = await db.select().from(quizAttempts).where(and(eq(quizAttempts.id, input.attemptId), eq(quizAttempts.userId, ctx.user.id))).limit(1); return publicState(attempt, requireAttempt(attempt, access, ctx, input)); }),
  startNativeCourseAttempt: protectedProcedure.input(nativeCourseContextInput).mutation(async ({ ctx, input }) => {
    let access = await resolveCourse360QuizLessonAccess(ctx, input); if (!isCourse360NativeQuiz(access.quiz)) throw new TRPCError({ code: "BAD_REQUEST", message: "Use the existing bank quiz player." });
    const db = await connection();
    return db.transaction(async tx => {
      // Parent row lock serializes starts including first attempt, across processes and retries; no new DDL.
      if (access.enrollment) await tx.select({ id: lmsEnrollments.id }).from(lmsEnrollments).where(eq(lmsEnrollments.id, access.enrollment.id)).for("update");
      else await tx.select({ id: quizzes.id }).from(quizzes).where(eq(quizzes.id, access.quiz.id)).for("update");
      access = await resolveCourse360QuizLessonAccess(ctx, input, tx);
      const rows = await attemptsFor(tx, access, ctx);
      const open = rows.find((a: any) => a.status === "in_progress" && !a.questionSnapshot.submittedAt);
      if (open) return publicState(open, requireAttempt(open, access, ctx, input));
      const config = readNativeQuizConfig(access.quiz), max = config.meta.maxAttempts ?? 0;
      if (max && rows.length >= max || config.meta.allowRetry === false && rows.length) fail("Maximum attempts reached.");
      if (rows.some((a: any) => a.questionSnapshot.gradingStatus === "pending_manual")) fail("Awaiting instructor review before another attempt.");
      const snapshot = makeSnapshot(access, ctx);
      const total = scoreNativeQuizAttempt(snapshot.nativeConfig.questions, {}).totalPoints;
      const [insert] = await tx.insert(quizAttempts).values({ quizId: access.quiz.id, userId: ctx.user.id, sourceType: "lesson", sourceLessonId: input.sourceLessonId, attemptNumber: rows.length + 1, status: "in_progress", questionSnapshot: snapshot, totalPoints: Number.isInteger(total) ? total : 0, legacyTotalPoints: total, passed: false, legacyIsPassed: false, legacyIsCompleted: false, startedAt: new Date(snapshot.startedAt) });
      return publicState({ id: insert.insertId }, snapshot);
    });
  }),
  saveNativeCourseAnswers: protectedProcedure.input(saveInput).mutation(async ({ ctx, input }) => {
    let access = await resolveCourse360QuizLessonAccess(ctx, input); const db = await connection();
    return db.transaction(async tx => {
      const [attempt] = await tx.select().from(quizAttempts).where(and(eq(quizAttempts.id, input.attemptId), eq(quizAttempts.userId, ctx.user.id))).for("update");
      access = await resolveCourse360QuizLessonAccess(ctx, input, tx);
      const snapshot = requireAttempt(attempt, access, ctx, input); checkOpen(attempt, snapshot); canonicalAnswers(snapshot, input.answers);
      if (snapshot.answerRevision !== input.expectedAnswerRevision) throw new TRPCError({ code: "CONFLICT", message: "Answers changed in another session. Resume the saved attempt." });
      const next = { ...snapshot, answers: clone(input.answers), answerRevision: snapshot.answerRevision + 1 };
      await tx.update(quizAttempts).set({ questionSnapshot: next }).where(and(eq(quizAttempts.id, attempt.id), eq(quizAttempts.status, "in_progress")));
      return { answerRevision: next.answerRevision };
    });
  }),
  submitNativeCourseAttempt: protectedProcedure.input(saveInput.extend({ submitSavedOnly: z.boolean().default(false) })).mutation(async ({ ctx, input }) => {
    let access = await resolveCourse360QuizLessonAccess(ctx, input); const db = await connection();
    return db.transaction(async tx => {
      const [attempt] = await tx.select().from(quizAttempts).where(and(eq(quizAttempts.id, input.attemptId), eq(quizAttempts.userId, ctx.user.id))).for("update");
      access = await resolveCourse360QuizLessonAccess(ctx, input, tx);
      const snapshot = requireAttempt(attempt, access, ctx, input);
      if (snapshot.submittedAt) return resultState(attempt, snapshot); // Idempotent even pending-manual: never overwrite/regrade.
      if (attempt.status !== "in_progress") fail("Attempt is no longer in progress.");
      const expired = snapshot.deadlineAt != null && Date.now() >= snapshot.deadlineAt;
      if (snapshot.answerRevision !== input.expectedAnswerRevision) throw new TRPCError({ code: "CONFLICT", message: "Answers changed in another session. Resume the saved attempt." });
      if (expired && !input.submitSavedOnly) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Quiz deadline has expired. Submit saved answers only." });
      const raw = expired || input.submitSavedOnly ? snapshot.answers : input.answers;
      const scoring = scoreNativeQuizAttempt(snapshot.nativeConfig.questions, canonicalAnswers(snapshot, raw));
      const passed = !scoring.pendingManual && scoring.totalPoints > 0 && scoring.earnedPoints / scoring.totalPoints * 100 >= snapshot.nativeConfig.meta.passingScore;
      const now = new Date(), next = { ...snapshot, answers: clone(raw), scoring, gradingStatus: scoring.pendingManual ? "pending_manual" : "graded", submittedAt: now.getTime(), answerRevision: snapshot.answerRevision + 1 };
      const values = { questionSnapshot: next, status: scoring.pendingManual ? "in_progress" as const : "completed" as const, completedAt: scoring.pendingManual ? null : now, passed, earnedPoints: Number.isInteger(scoring.earnedPoints) ? scoring.earnedPoints : 0, totalPoints: Number.isInteger(scoring.totalPoints) ? scoring.totalPoints : 0, scorePercent: scoring.scorePercent.toFixed(2), legacyScoreRaw: scoring.earnedPoints, legacyTotalPoints: scoring.totalPoints, legacyScorePct: scoring.scorePercent, legacyIsPassed: passed, legacyIsCompleted: !scoring.pendingManual, legacySubmittedAt: now, timeSpentSeconds: Math.floor((Math.min(now.getTime(), snapshot.deadlineAt ?? now.getTime()) - snapshot.startedAt) / 1000) };
      await tx.update(quizAttempts).set(values).where(and(eq(quizAttempts.id, attempt.id), eq(quizAttempts.status, "in_progress")));
      return resultState({ ...attempt, ...values }, next);
    });
  }),
};

/** Parent-owned markLessonComplete/certificate release must invoke this before writing progress. */
export async function assertCourse360NativeLessonCompletion(db: any, userId: number, courseId: number, lessonId: number, enrollmentId: number, context?: { user: { id: number }; req?: any; courseSlug: string }) {
  const [lesson] = await db.select().from(lmsLessons).where(eq(lmsLessons.id, lessonId)).limit(1);
  if (!lesson?.standaloneQuizId) return;
  const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, lesson.standaloneQuizId)).limit(1);
  if (!quiz || !isCourse360NativeQuiz(quiz)) return;
  if (context) {
    if (context.user.id !== userId) fail("Completion user does not match the authenticated learner.");
    const access = await resolveCourse360QuizLessonAccess(context, { quizId: quiz.id, courseSlug: context.courseSlug, sourceLessonId: lessonId, authorPreview: false }, db);
    if (access.mode !== "enrolled" || access.course?.id !== courseId || access.enrollment?.id !== enrollmentId) fail("Completion requires the exact active enrolled course lesson.");
  }
  const [course] = await db.select().from(lmsCourses).where(eq(lmsCourses.id, courseId)).limit(1);
  const rows = await db.select().from(quizAttempts).where(and(eq(quizAttempts.quizId, quiz.id), eq(quizAttempts.userId, userId), eq(quizAttempts.sourceLessonId, lessonId), eq(quizAttempts.status, "completed")));
  const permitted = rows.some((attempt: any) => {
    const snapshot = nativeCourseSnapshot(attempt.questionSnapshot), source = snapshot?.source, scoring = snapshot?.scoring;
    return snapshot?.gradingStatus === "graded" && !!snapshot.submittedAt && source?.mode === "enrolled" && source.userId === userId && source.orgId === quiz.orgId && source.orgId === course?.orgId && source.courseId === courseId && source.sourceLessonId === lessonId && source.enrollmentId === enrollmentId && source.cloudQuizId === quiz.id && source.nativeQuizId === readNativeQuizConfig(quiz).meta.id && source.nativeQuizId === snapshot.nativeConfig.meta.id && !scoring?.pendingManual && scoring?.totalPoints > 0 && scoring.earnedPoints / scoring.totalPoints * 100 >= snapshot.nativeConfig.meta.passingScore && attempt.passed === true;
  });
  if (!permitted) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Pass the assigned native quiz and await any instructor review before completing this lesson." });
}
export async function nativeCourseAttemptHistory(access: Access, ctx: Context, db: any) {
  if (access.isStaffPreview) return [];
  return (await attemptsFor(db, access, ctx)).filter((a: any) => a.questionSnapshot.submittedAt).map((a: any) => ({ id: a.id, attemptNumber: a.attemptNumber, scorePercent: String(a.questionSnapshot.scoring.scorePercent), passed: a.passed, completedAt: a.completedAt, gradingStatus: a.questionSnapshot.gradingStatus, earnedPoints: a.questionSnapshot.scoring.earnedPoints, totalPoints: a.questionSnapshot.scoring.totalPoints }));
}
