import { TRPCError } from "@trpc/server";
import { and, asc, eq, gt } from "drizzle-orm";
import { createHash } from "node:crypto";
import { quizzes, quizAttempts, organizations, lmsCourses, lmsLessons, lmsEnrollments } from "../../drizzle/schema";
import { getDb } from "../db";
import { requireCourse360AppCapability, requireCourse360AppOrganization } from "./course360AppCapabilities";
import { assertPublicQuizDeliveryHost } from "./publicQuizDeliveryScope";
import { getPublicRequestHostname } from "./publicOrgRequestScope";
import { nativeCourseSnapshot } from "./course360NativeCourseQuizRuntime";
import { readNativeQuizConfig } from "./quizNativeConfigRuntime";
import { gradeQuizQuestion, type PublicQuizAttemptScore } from "../../shared/quizScoring";

export type NativeQuizReviewContext = { user: { id: number }; req?: any };
export type NativeQuizReviewScopeInput = { orgId?: number; quizId?: number };
export type NativeQuizReviewAttemptInput = NativeQuizReviewScopeInput & { attemptId: number };
export type NativeQuizReviewMutationInput = NativeQuizReviewAttemptInput & { expectedReviewRevision: number; operationId: string };
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const denied = (): never => { throw new TRPCError({ code: "NOT_FOUND", message: "Native enrolled review attempt is not available in this school." }); };
const conflict = (message = "Review changed in another session. Reload before grading or releasing."): never => { throw new TRPCError({ code: "CONFLICT", message }); };
export async function nativeQuizReviewConnection() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Native quiz review storage is unavailable." });
  return db;
}
/** Persisted selection/permission and the exact Quiz Web capability, never browser roles or primary-school lookup. */
export async function resolveNativeQuizReviewAuthority(ctx: NativeQuizReviewContext, input: NativeQuizReviewScopeInput, db: any) {
  const author = await requireCourse360AppOrganization(ctx.user.id, input.orgId);
  const capability = await requireCourse360AppCapability(ctx.user.id, "quiz_creator", "web");
  if (capability.orgId !== author.orgId) conflict("Selected school changed. Reload the review queue.");
  const [school] = await db.select().from(organizations).where(eq(organizations.id, author.orgId)).limit(1);
  if (!school?.isActive || school.id !== author.orgId) denied();
  // Main/managed-preview author hosts are permitted by the existing validator; foreign school/custom hosts are not.
  assertPublicQuizDeliveryHost(ctx.req, school);
  return { orgId: author.orgId, reviewer: {
    userId: ctx.user.id, orgId: author.orgId,
    permissionSource: author.platformSupport ? "persisted_platform_support" : "persisted_school_member",
    memberRole: author.member?.role ?? null, memberSubRole: author.member?.memberSubRole ?? null,
    capability: { app: "quiz_creator", mode: "web", platformSupport: capability.platformSupport, isPaid: capability.isPaid, hasManualGrant: capability.hasManualGrant, isInTrial: capability.access.isInTrial },
    requestHost: getPublicRequestHostname(ctx.req),
  } };
}
/** All bindings are checked before returning any learner answer, including current UUID and exact frozen enrollment. */
async function boundAttempt(db: any, scope: { orgId: number }, pair: any, input: NativeQuizReviewScopeInput) {
  const attempt = pair?.attempt, quiz = pair?.quiz, snapshot = nativeCourseSnapshot(attempt?.questionSnapshot), source = snapshot?.source;
  if (!attempt || !quiz || quiz.orgId !== scope.orgId || input.quizId !== undefined && quiz.id !== input.quizId || attempt.quizId !== quiz.id || attempt.sourceType !== "lesson" || !source || source.orgId !== scope.orgId || source.cloudQuizId !== quiz.id || source.userId !== attempt.userId || !Number.isInteger(source.userId) || source.userId <= 0 || source.sourceLessonId !== attempt.sourceLessonId || source.mode !== "enrolled" || !Number.isInteger(source.enrollmentId) || source.enrollmentId <= 0 || !snapshot.submittedAt || source.nativeQuizId !== snapshot.nativeConfig?.meta?.id || source.nativeQuizId !== readNativeQuizConfig(quiz).meta.id) denied();
  const [course] = await db.select().from(lmsCourses).where(and(eq(lmsCourses.id, source.courseId), eq(lmsCourses.orgId, scope.orgId))).limit(1);
  const [lesson] = await db.select().from(lmsLessons).where(and(eq(lmsLessons.id, source.sourceLessonId), eq(lmsLessons.courseId, source.courseId), eq(lmsLessons.standaloneQuizId, quiz.id))).limit(1);
  const [enrollment] = await db.select().from(lmsEnrollments).where(and(eq(lmsEnrollments.id, source.enrollmentId), eq(lmsEnrollments.orgId, scope.orgId), eq(lmsEnrollments.userId, source.userId), eq(lmsEnrollments.courseId, source.courseId))).limit(1);
  if (!course || course.id !== source.courseId || course.orgId !== scope.orgId || !lesson || lesson.id !== source.sourceLessonId || lesson.courseId !== course.id || lesson.standaloneQuizId !== quiz.id || lesson.orgId != null && lesson.orgId !== scope.orgId || !["quiz", "exam"].includes(lesson.type) || !enrollment || enrollment.id !== source.enrollmentId || enrollment.userId !== source.userId || enrollment.orgId !== scope.orgId || enrollment.courseId !== course.id || ["free_preview", "admin_preview"].includes(enrollment.enrollmentType)) denied();
  const original = snapshot.manualReview?.originalScoring ?? snapshot.scoring;
  if (!original?.pendingManual || !original.grades || !Array.isArray(snapshot.nativeConfig.questions)) denied();
  const manual = Object.entries(original.grades).filter(([, grade]: any) => grade.status === "pending_manual").map(([id, grade]: any) => {
    const question = snapshot.nativeConfig.questions.find((q: any) => q.id === id);
    if (!question || gradeQuizQuestion(question, snapshot.answers?.[id]).status !== "pending_manual" || !Number.isFinite(grade.totalPoints) || grade.totalPoints < 0 || grade.totalPoints !== gradeQuizQuestion(question, snapshot.answers?.[id]).totalPoints) denied();
    return { id, question, maxPoints: grade.totalPoints };
  });
  if (!manual.length || !["pending_manual", "graded"].includes(snapshot.gradingStatus) || snapshot.gradingStatus === "graded" && !snapshot.manualReview?.releasedAt) denied();
  return { attempt, quiz, snapshot, original, manual, course };
}
function detail(bound: Awaited<ReturnType<typeof boundAttempt>>) {
  const { attempt, quiz, snapshot, manual, course } = bound;
  const review = snapshot.manualReview;
  return {
    attemptId: attempt.id, quizId: quiz.id, quizTitle: quiz.title, courseTitle: course.title ?? course.slug,
    source: copy(snapshot.source), submittedAt: snapshot.submittedAt,
    reviewRevision: review?.revision ?? 0, releasedAt: review?.releasedAt ?? null,
    gradingStatus: snapshot.gradingStatus, readyToRelease: !review?.releasedAt && manual.every(q => !!review?.grades?.[q.id]),
    questions: manual.map(({ id, question, maxPoints }) => ({ id, type: question.type, stem: question.stem ?? "", maxPoints, rubric: question.data?.rubric ?? null, sampleAnswer: question.data?.sampleAnswer ?? null, answer: copy(snapshot.answers?.[id] ?? null), review: copy(review?.grades?.[id] ?? null) })),
    draftResult: copy(review?.draftScoring ? { earnedPoints: review.draftScoring.earnedPoints, totalPoints: review.draftScoring.totalPoints, scorePercent: review.draftScoring.scorePercent, passed: review.draftPassed } : null),
    releasedResult: review?.releasedAt ? { earnedPoints: snapshot.scoring.earnedPoints, totalPoints: snapshot.scoring.totalPoints, scorePercent: snapshot.scoring.scorePercent, passed: attempt.passed === true } : null,
    audit: copy(review?.audit ?? []),
  };
}
function attemptQuery(db: any, orgId: number, attemptId: number, quizId?: number) {
  return db.select({ attempt: quizAttempts, quiz: quizzes }).from(quizAttempts).innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id)).where(and(eq(quizAttempts.id, attemptId), eq(quizzes.orgId, orgId), ...(quizId === undefined ? [] : [eq(quizzes.id, quizId)])));
}
export async function getNativeQuizReviewAttempt(ctx: NativeQuizReviewContext, input: NativeQuizReviewAttemptInput) {
  const db = await nativeQuizReviewConnection(), scope = await resolveNativeQuizReviewAuthority(ctx, input, db);
  const [pair] = await attemptQuery(db, scope.orgId, input.attemptId, input.quizId).limit(1);
  return detail(await boundAttempt(db, scope, pair, input));
}
export async function listNativeQuizReviewAttempts(ctx: NativeQuizReviewContext, input: NativeQuizReviewScopeInput & { cursor?: number; limit: number }) {
  const db = await nativeQuizReviewConnection(), scope = await resolveNativeQuizReviewAuthority(ctx, input, db);
  // Paginate scanned org-owned in-progress lesson rows, not all schools or learner user records.
  const rows = await db.select({ attempt: quizAttempts, quiz: quizzes }).from(quizAttempts).innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id)).where(and(eq(quizzes.orgId, scope.orgId), eq(quizAttempts.sourceType, "lesson"), eq(quizAttempts.status, "in_progress"), gt(quizAttempts.id, input.cursor ?? 0), ...(input.quizId === undefined ? [] : [eq(quizzes.id, input.quizId)]))).orderBy(asc(quizAttempts.id)).limit(input.limit);
  const items = [];
  for (const pair of rows) {
    if (nativeCourseSnapshot(pair.attempt.questionSnapshot)?.gradingStatus !== "pending_manual") continue;
    try {
      const bound = await boundAttempt(db, scope, pair, input), value = detail(bound);
      items.push({ attemptId: value.attemptId, quizId: value.quizId, quizTitle: value.quizTitle, courseTitle: value.courseTitle, learnerId: value.source.userId, sourceLessonId: value.source.sourceLessonId, submittedAt: value.submittedAt, reviewRevision: value.reviewRevision, manualQuestionCount: value.questions.length, reviewedQuestionCount: value.questions.filter(q => q.review !== null).length, readyToRelease: value.readyToRelease });
    } catch (error) { if (!(error instanceof TRPCError) || error.code !== "NOT_FOUND") throw error; }
  }
  return { orgId: scope.orgId, items, nextCursor: rows.length === input.limit ? rows[rows.length - 1].attempt.id : null };
}
function finalDraft(bound: Awaited<ReturnType<typeof boundAttempt>>, reviews: Record<string, any>): PublicQuizAttemptScore | null {
  if (!bound.manual.every(q => !!reviews[q.id])) return null;
  const grades = copy(bound.original.grades);
  for (const { id, maxPoints } of bound.manual) {
    const points = reviews[id].points;
    if (!Number.isFinite(points) || points < 0 || points > maxPoints) denied();
    grades[id] = { ...grades[id], earnedPoints: points, status: "graded", correct: maxPoints > 0 && points === maxPoints, partial: points > 0 && points < maxPoints, feedback: reviews[id].feedback };
  }
  const values = Object.values(grades) as any[], totalPoints = values.reduce((n, g) => n + g.totalPoints, 0), earnedPoints = values.reduce((n, g) => n + g.earnedPoints, 0);
  if (!Number.isFinite(totalPoints) || !Number.isFinite(earnedPoints)) denied();
  return { ...bound.original, grades, totalPoints, earnedPoints, scorePercent: totalPoints > 0 ? Math.round(earnedPoints / totalPoints * 10000) / 100 : 0, pendingManual: false };
}
/** Transaction + row lock + JSON revision CAS. Only explicit release changes the trusted native result. */
export async function mutateNativeQuizReview(ctx: NativeQuizReviewContext, input: NativeQuizReviewMutationInput & { questionId?: string; points?: number; feedback?: string }, action: "grade" | "release") {
  const db = await nativeQuizReviewConnection(), initial = await resolveNativeQuizReviewAuthority(ctx, input, db);
  return db.transaction(async tx => {
    const [pair] = await attemptQuery(tx, initial.orgId, input.attemptId, input.quizId).for("update");
    const scope = await resolveNativeQuizReviewAuthority(ctx, input, tx);
    if (scope.orgId !== initial.orgId) conflict("Selected school changed. Reload the review queue.");
    const bound = await boundAttempt(tx, scope, pair, input), { attempt, snapshot, manual } = bound;
    const review = copy(snapshot.manualReview ?? { kind: "course360_native_manual_review_v1", revision: 0, originalScoring: copy(bound.original), originalScoreColumns: { earnedPoints: attempt.earnedPoints ?? null, totalPoints: attempt.totalPoints ?? null, scorePercent: attempt.scorePercent ?? null, legacyScoreRaw: attempt.legacyScoreRaw ?? null, legacyScorePct: attempt.legacyScorePct ?? null, legacyTotalPoints: attempt.legacyTotalPoints ?? null }, grades: {}, audit: [], releasedAt: null });
    const fingerprint = createHash("sha256").update(JSON.stringify({ action, attemptId: input.attemptId, expectedReviewRevision: input.expectedReviewRevision, questionId: input.questionId ?? null, points: input.points ?? null, feedback: input.feedback ?? "", reviewerUserId: ctx.user.id, orgId: scope.orgId })).digest("hex");
    const replay = review.audit.find((entry: any) => entry.operationId === input.operationId);
    if (replay) {
      if (replay.fingerprint !== fingerprint || replay.reviewer.userId !== ctx.user.id) conflict("Review operation ID was already used for a different request.");
      return { ...detail(bound), replayed: true };
    }
    if (review.revision !== input.expectedReviewRevision) conflict();
    if (review.releasedAt || attempt.status !== "in_progress" || snapshot.gradingStatus !== "pending_manual" || attempt.passed === true || attempt.completedAt != null) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This review has already been released or is not pending." });
    const now = Date.now();
    if (action === "grade") {
      const question = manual.find(q => q.id === input.questionId);
      if (!question || !Number.isFinite(input.points) || input.points! < 0 || input.points! > question.maxPoints) throw new TRPCError({ code: "BAD_REQUEST", message: "Grade only a frozen manual question with points from zero to its exact maximum." });
      review.grades[question.id] = { points: input.points, feedback: input.feedback ?? "", reviewer: scope.reviewer, reviewedAt: now, revision: review.revision + 1 };
    }
    const draft = finalDraft(bound, review.grades);
    const threshold = snapshot.nativeConfig.meta.passingScore;
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) denied();
    review.draftScoring = draft;
    review.draftPassed = draft ? draft.totalPoints > 0 && draft.earnedPoints / draft.totalPoints * 100 >= threshold : null;
    if (action === "release" && !draft) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Review every required frozen manual question before releasing this result." });
    review.revision++;
    review.audit.push({ operationId: input.operationId, fingerprint, action, questionId: action === "grade" ? input.questionId : null, points: action === "grade" ? input.points : null, feedback: action === "grade" ? input.feedback ?? "" : null, expectedRevision: input.expectedReviewRevision, revision: review.revision, reviewer: scope.reviewer, at: now });
    if (action === "release") { review.releasedAt = now; review.releasedBy = scope.reviewer; }
    const next = { ...snapshot, manualReview: review, ...(action === "release" ? { scoring: draft, gradingStatus: "graded" } : {}) };
    // Preserve every legacy numeric score column and original submission/answers/policy/automatic grades.
    const values = action === "release" ? { questionSnapshot: next, status: "completed" as const, passed: review.draftPassed === true, completedAt: new Date(now), legacyIsPassed: review.draftPassed === true, legacyIsCompleted: true } : { questionSnapshot: next, status: "in_progress" as const, passed: false, completedAt: null, legacyIsPassed: false, legacyIsCompleted: false };
    const write = await tx.update(quizAttempts).set(values).where(and(eq(quizAttempts.id, attempt.id), eq(quizAttempts.status, "in_progress")));
    if (write?.[0]?.affectedRows !== 1) conflict("Review could not be persisted. Reload before retrying.");
    // No progress, course completion, certificate, provider, email or payment side effects.
    return { ...detail({ ...bound, attempt: { ...attempt, ...values }, snapshot: next }), replayed: false };
  });
}
