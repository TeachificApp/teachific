import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import * as schema from "../drizzle/schema";
import { nativeQuizSaveFields } from "./lib/quizNativeConfigRuntime";
import { scoreNativeQuizAttempt } from "../shared/quizScoring";
const fixture = vi.hoisted(() => ({ selected: 9, author: false, rows: new Map<any, any[]>(), writes: [] as any[], sql: [] as any[], locks: 0, nextId: 100, txTail: Promise.resolve() as Promise<any> }));
vi.mock("./lib/quizLearnerSelectedSchoolRuntime", () => ({ requireSelectedQuizLearnerSchool: vi.fn(async () => { if (!fixture.selected) throw new Error("No selected school"); return fixture.selected; }) }));
vi.mock("./lib/course360AppCapabilities", () => ({ requireCourse360AppOrganization: vi.fn(async () => { if (!fixture.author || !fixture.selected) throw new Error("Persisted author permission required"); return { orgId: fixture.selected }; }) }));
vi.mock("./db", () => ({ getDb: async () => mockDb, getOrgIdForUserWithFallback: vi.fn(() => { throw new Error("Fallback forbidden"); }), requireOrgAdmin: vi.fn(() => { throw new Error("Legacy admin forbidden"); }) }));
const dialect = new MySqlDialect();
function checkFields(table: any, values: any) { const columns = getTableColumns(table); for (const key of Object.keys(values)) if (!columns[key]) throw new Error(`Unknown column ${key}`); }
function filter(table: any, condition: any) {
  const query = dialect.sqlToQuery(condition); fixture.sql.push(query);
  const columns = getTableColumns(table), rows = fixture.rows.get(table) ?? [];
  const constraints = [...query.sql.matchAll(/`[^`]+`\.`([^`]+)` = \?/g)];
  return rows.filter(row => constraints.every((match, index) => { const property = Object.entries(columns).find(([, c]: any) => c.name === match[1])?.[0]; return property && row[property] === query.params[index]; }));
}
function readChain(table: any, selection: any) {
  let condition: any;
  const rows = () => { const found = condition ? filter(table, condition) : fixture.rows.get(table) ?? []; return selection?.count ? [{ count: found.length }] : found; };
  const chain: any = { where: (value: any) => { condition = value; return chain; }, orderBy: () => chain, limit: (n: number) => Promise.resolve(rows().slice(0, n)), for: () => { fixture.locks++; return Promise.resolve(rows()); }, then: (resolve: any, reject: any) => Promise.resolve(rows()).then(resolve, reject) };
  return chain;
}
const mockDb: any = {
  select: (selection: any) => ({ from: (table: any) => readChain(table, selection) }),
  insert: (table: any) => ({ values: async (values: any) => { checkFields(table, values); const id = fixture.nextId++; const row = { id, ...values }; const rows = fixture.rows.get(table) ?? []; rows.push(row); fixture.rows.set(table, rows); fixture.writes.push({ table, values }); return [{ insertId: id }]; } }),
  update: (table: any) => ({ set: (values: any) => { checkFields(table, values); return { where: async (condition: any) => { const rows = filter(table, condition); for (const row of rows) Object.assign(row, values); fixture.writes.push({ table, values }); return [{ affectedRows: rows.length }]; } }; } }),
  transaction: (fn: any) => { const task = fixture.txTail.then(() => fn(mockDb)); fixture.txTail = task.catch(() => {}); return task; },
};
import { quizRouter } from "./routers/quizRouter";
import { assertCourse360NativeLessonCompletion } from "./lib/course360NativeCourseQuizRuntime";
import { requireCourse360AppOrganization } from "./lib/course360AppCapabilities";
export const nativeSeven = [
  { id: "mc", type: "mcq", stem: "Select", points: .25, data: { multiSelect: false, choices: [{ id: "a", text: "A", correct: true }, { id: "b", text: "B", correct: false }] } },
  { id: "tf", type: "tf", stem: "True?", points: .5, data: { correct: false, falseFeedback: "Secret explanation" } },
  { id: "hot", type: "hotspot", stem: "Region", points: 1.25, data: { imageUrl: "data:image/png;base64,aA==", imageAlt: "Image", multiSelect: false, regions: [{ id: "region", shape: "rect", x: 50, y: 50, width: 20, height: 20, correct: true, label: "Center", feedback: "Private zone feedback" }] } },
  { id: "match", type: "matching", stem: "Match", points: .75, data: { pairs: [{ id: "p1", premise: "Term", response: "Definition" }, { id: "p2", premise: "Other", response: "Other definition" }] } },
  { id: "blank", type: "fill_blank", stem: "Blank", points: 1.5, data: { template: "A {{blank}}", blanks: [{ id: "blank", acceptedAnswers: ["test"], caseSensitive: false }] } },
  { id: "short", type: "short_answer", stem: "Explain", points: .5, data: { autoGrade: true, keywords: ["pressure"], sampleAnswer: "Model answer" } },
  { id: "image", type: "image_choice", stem: "Image choice", points: .25, explanation: "Secret solution", data: { multiSelect: false, choices: [{ id: "img", label: "Pick", imageUrl: "data:image/png;base64,aA==", correct: true }] } },
];
const canonical = { mc: ["a"], tf: false, hot: [{ x: 50, y: 50 }], match: { p1: "p1", p2: "p2" }, blank: { blank: "TEST" }, short: "Pressure is important", image: ["img"] };
const contextInput = { quizId: 44, courseSlug: "course-a", sourceLessonId: 31, authorPreview: false };
const caller = (userId = 5, hostname = "school-a.course360.app", role = "user") => quizRouter.createCaller({ user: { id: userId, role }, req: { headers: {}, hostname } } as any);
const row = () => fixture.rows.get(schema.quizzes)![0];
const enrollment = () => fixture.rows.get(schema.lmsEnrollments)![0];
const attempts = () => fixture.rows.get(schema.quizAttempts)!;
const makeRow = (questions = nativeSeven, meta: any = {}) => ({ id: 44, orgId: 9, title: "Native title", isPublished: true, visibility: "published", showExplanations: true, showCorrectAnswers: true, ...nativeQuizSaveFields({ title: "Native title", questionsJson: JSON.stringify(questions), settingsJson: JSON.stringify({ id: "native-uuid", passingScore: 85.125, timeLimit: 2.5, maxAttempts: 2, allowRetry: true, futureMeta: { retained: true }, ...meta }) }) });
function rawFor(publicQuestions: any[]) { const match = publicQuestions.find(q => q.id === "match"); return { ...canonical, match: { p1: match.data.responses.find((r: any) => r.text === "Definition").id, p2: match.data.responses.find((r: any) => r.text === "Other definition").id } }; }
beforeEach(() => {
  fixture.rows.clear(); fixture.writes.length = 0; fixture.sql.length = 0; fixture.locks = 0; fixture.selected = 9; fixture.author = false; fixture.nextId = 100; fixture.txTail = Promise.resolve(); vi.clearAllMocks();
  fixture.rows.set(schema.organizations, [{ id: 9, slug: "school-a", isActive: true }, { id: 10, slug: "school-b", isActive: true }]);
  fixture.rows.set(schema.quizzes, [makeRow()]);
  fixture.rows.set(schema.lmsCourses, [{ id: 20, orgId: 9, slug: "course-a", status: "public" }, { id: 21, orgId: 10, slug: "course-b", status: "public" }]);
  fixture.rows.set(schema.lmsLessons, [{ id: 31, orgId: 9, courseId: 20, type: "quiz", standaloneQuizId: 44, previewMode: "none" }, { id: 32, orgId: 10, courseId: 21, type: "quiz", standaloneQuizId: 44, previewMode: "none" }, { id: 33, orgId: 9, courseId: 20, type: "quiz", standaloneQuizId: 44, previewMode: "none" }]);
  fixture.rows.set(schema.lmsEnrollments, [{ id: 60, orgId: 9, userId: 5, courseId: 20, status: "active", enrollmentType: "full", accessExpiresAt: new Date(Date.now() + 3600000) }]);
  fixture.rows.set(schema.quizAttempts, []); fixture.rows.set(schema.quizAttemptResponses, []);
});
describe("real native course quiz router scope", () => {
  it("selected A learner opens exact A parent without author entitlement", async () => { const info = await caller().getLearnerQuizInfo(contextInput); expect(info).toMatchObject({ kind: "native", questionCount: 7, timeLimitMinutes: 2.5, passingScore: 85.125 }); expect(requireCourse360AppOrganization).not.toHaveBeenCalled(); });
  it.each(["selected-B", "host-B", "foreign-lesson", "foreign-course", "foreign-user"])("rejects %s before attempts or writes", async mode => { if (mode === "selected-B") fixture.selected = 10; const input = { ...contextInput, ...(mode === "foreign-lesson" ? { sourceLessonId: 32 } : {}), ...(mode === "foreign-course" ? { courseSlug: "course-b" } : {}) }; await expect(caller(mode === "foreign-user" ? 6 : 5, mode === "host-B" ? "school-b.course360.app" : "school-a.course360.app").startNativeCourseAttempt(input)).rejects.toThrow(); expect(fixture.writes).toHaveLength(0); });
  it.each(["cancelled", "suspended", "expired"])("rejects %s enrollment", async status => { enrollment().status = status; await expect(caller().startNativeCourseAttempt(contextInput)).rejects.toThrow("Active course enrollment"); });
  it.each(["accessExpiresAt", "expiresAt"])("rejects passed-through %s", async field => { enrollment()[field] = new Date(Date.now() - 1); await expect(caller().startNativeCourseAttempt(contextInput)).rejects.toThrow(); });
  it("rejects draft course and private unpublished quiz", async () => { fixture.rows.get(schema.lmsCourses)![0].status = "draft"; await expect(caller().startNativeCourseAttempt(contextInput)).rejects.toMatchObject({ code: "NOT_FOUND" }); fixture.rows.get(schema.lmsCourses)![0].status = "public"; row().isPublished = false; row().visibility = "private"; await expect(caller().startNativeCourseAttempt(contextInput)).rejects.toMatchObject({ code: "NOT_FOUND" }); });
  it("explicit persisted-author preview is separate; browser/global roles cannot auto-preview", async () => { fixture.rows.set(schema.lmsEnrollments, []); row().isPublished = false; row().visibility = "private"; await expect(caller(5, "school-a.course360.app", "site_owner").startNativeCourseAttempt(contextInput)).rejects.toThrow(); await expect(caller().startNativeCourseAttempt({ ...contextInput, authorPreview: true })).rejects.toThrow("Persisted author"); fixture.author = true; const started = await caller().startNativeCourseAttempt({ ...contextInput, authorPreview: true }); const result = await caller().submitNativeCourseAttempt({ ...contextInput, authorPreview: true, attemptId: started.attemptId, answers: rawFor(started.questions), expectedAnswerRevision: 0 }); expect(result.passed).toBe(true); expect(result.canCompleteLesson).toBe(false); });
  it("retains explicit published lesson preview but never course completion", async () => { fixture.rows.set(schema.lmsEnrollments, []); fixture.rows.get(schema.lmsLessons)![0].previewMode = "preview"; const started = await caller().startNativeCourseAttempt(contextInput); const result = await caller().submitNativeCourseAttempt({ ...contextInput, attemptId: started.attemptId, answers: rawFor(started.questions), expectedAnswerRevision: 0 }); expect(result.passed).toBe(true); expect(result.canCompleteLesson).toBe(false); });
});
describe("native course attempt snapshot, grading and lifecycle", () => {
  it("freezes full canonical config privately; initial and resumed payloads omit keys/models/rubrics/grades", async () => { const started = await caller().startNativeCourseAttempt(contextInput); const serial = JSON.stringify(started); for (const secret of ["nativeConfig", "matchingMap", "Secret solution", "Model answer", "acceptedAnswers", '"correct"', "rubric", "grades", "pressure"]) expect(serial).not.toContain(secret); const snapshot = attempts()[0].questionSnapshot; expect(snapshot.nativeConfig.meta.futureMeta).toEqual({ retained: true }); expect(snapshot.source).toMatchObject({ orgId: 9, courseId: 20, sourceLessonId: 31, enrollmentId: 60, userId: 5, nativeQuizId: "native-uuid", cloudQuizId: 44 }); expect(snapshot.matchingMap.match).toBeDefined(); expect(started.questions.map((q: any) => q.id)).toEqual(nativeSeven.map(q => q.id)); const resumed = await caller().startNativeCourseAttempt(contextInput); expect(resumed).toEqual(started); expect(attempts()).toHaveLength(1); expect(fixture.locks).toBeGreaterThan(0); });
  it("all seven native types grade precisely against saved answers, not later author edits", async () => { const started = await caller().startNativeCourseAttempt(contextInput); const raw = rawFor(started.questions); row().instructions = "[]"; row().themeConfig.course360QuizNativeV1.config.questions = []; const result = await caller().submitNativeCourseAttempt({ ...contextInput, attemptId: started.attemptId, answers: raw, expectedAnswerRevision: 0 }); const expected = scoreNativeQuizAttempt(nativeSeven, canonical); expect(result).toMatchObject({ earnedPoints: expected.earnedPoints, totalPoints: expected.totalPoints, score: 100, passed: true, canCompleteLesson: true, gradingStatus: "graded", correctAnswers: 7 }); expect(result.totalPoints).toBe(5); expect(attempts()[0].questionSnapshot.nativeConfig.questions).toEqual(nativeSeven); });
  it("fractional scoring uses JSON+legacy floats with no INT truncation and exact unrounded mastery", async () => { fixture.rows.set(schema.quizzes, [makeRow([{ id: "partial", type: "mcq", stem: "Partial", points: .75, scoring: { partialCredit: true }, data: { multiSelect: true, choices: [{ id: "a", correct: true }, { id: "b", correct: true }, { id: "c", correct: true }] } }] as any, { passingScore: 33.334 })]); const started = await caller().startNativeCourseAttempt(contextInput); const result = await caller().submitNativeCourseAttempt({ ...contextInput, attemptId: started.attemptId, answers: { partial: ["a"] }, expectedAnswerRevision: 0 }); expect(result).toMatchObject({ earnedPoints: .25, totalPoints: .75, score: 33.33, passed: false }); expect(attempts()[0]).toMatchObject({ earnedPoints: 0, totalPoints: 0, legacyScoreRaw: .25, legacyTotalPoints: .75 }); expect(attempts()[0].questionSnapshot.scoring.earnedPoints).toBe(.25); });
  it("manual pending is immutable and cannot pass/complete through any legacy attempt method", async () => { fixture.rows.set(schema.quizzes, [makeRow([{ id: "essay", type: "essay", stem: "Write", points: .5, data: { rubric: "Private rubric" } }] as any)]); const started = await caller().startNativeCourseAttempt(contextInput); const result = await caller().submitNativeCourseAttempt({ ...contextInput, attemptId: started.attemptId, answers: { essay: "My answer" }, expectedAnswerRevision: 0 }); expect(result).toMatchObject({ gradingStatus: "pending_manual", passed: false, canCompleteLesson: false }); expect(attempts()[0]).toMatchObject({ status: "in_progress", completedAt: null, legacyIsCompleted: false, passed: false }); const retried = await caller().submitNativeCourseAttempt({ ...contextInput, attemptId: started.attemptId, answers: { essay: "replacement" }, expectedAnswerRevision: 0 }); expect(retried).toEqual(result); expect(attempts()[0].questionSnapshot.answers.essay).toBe("My answer"); for (const op of [() => caller().completeAttempt({ attemptId: started.attemptId }), () => caller().submitResponse({ attemptId: started.attemptId, questionId: 1, questionType: "mc", selectedChoiceIds: [1] }), () => caller().getAttemptResult({ attemptId: started.attemptId })]) await expect(op()).rejects.toThrow("assigned course lesson"); expect(await caller().listAttempts({ quizId: 44 })).toEqual([]); await expect(caller().startNativeCourseAttempt(contextInput)).rejects.toThrow("Awaiting instructor"); });
  it.each(["user", "lesson", "enrollment"])("rejects foreign attempt %s source", async kind => { const started = await caller().startNativeCourseAttempt(contextInput); if (kind === "enrollment") enrollment().id = 61; const input = { ...contextInput, sourceLessonId: kind === "lesson" ? 33 : 31, attemptId: started.attemptId }; await expect(caller(kind === "user" ? 6 : 5).getNativeCourseAttempt(input)).rejects.toThrow(); await expect(caller(kind === "user" ? 6 : 5).submitNativeCourseAttempt({ ...input, answers: {}, expectedAnswerRevision: 0 })).rejects.toThrow(); });
  it("content-bound opaque matching mapping refuses canonical IDs, foreign response IDs and unknown questions", async () => { const started = await caller().startNativeCourseAttempt(contextInput); for (const answers of [{ match: { p1: "p1" } }, { match: { foreign: started.questions.find((q: any) => q.id === "match").data.responses[0].id } }, { foreign: true }]) await expect(caller().saveNativeCourseAnswers({ ...contextInput, attemptId: started.attemptId, answers, expectedAnswerRevision: 0 })).rejects.toMatchObject({ code: "BAD_REQUEST" }); expect(attempts()[0].questionSnapshot.answerRevision).toBe(0); });
  it("answer payloads are bounded", async () => { const started = await caller().startNativeCourseAttempt(contextInput); await expect(caller().saveNativeCourseAnswers({ ...contextInput, attemptId: started.attemptId, answers: { short: "x".repeat(20001) }, expectedAnswerRevision: 0 })).rejects.toMatchObject({ code: "BAD_REQUEST" }); });
  it("save revision prevents cross-tab overwrites; deadline uses frozen server time and accepts only saved answers", async () => { const started = await caller().startNativeCourseAttempt(contextInput); const saved = await caller().saveNativeCourseAnswers({ ...contextInput, attemptId: started.attemptId, answers: rawFor(started.questions), expectedAnswerRevision: 0 }); expect(saved.answerRevision).toBe(1); await expect(caller().saveNativeCourseAnswers({ ...contextInput, attemptId: started.attemptId, answers: {}, expectedAnswerRevision: 0 })).rejects.toMatchObject({ code: "CONFLICT" }); attempts()[0].questionSnapshot.deadlineAt = Date.now() - 1; await expect(caller().saveNativeCourseAnswers({ ...contextInput, attemptId: started.attemptId, answers: {}, expectedAnswerRevision: 1 })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" }); await expect(caller().submitNativeCourseAttempt({ ...contextInput, attemptId: started.attemptId, answers: {}, expectedAnswerRevision: 1 })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" }); const result = await caller().submitNativeCourseAttempt({ ...contextInput, attemptId: started.attemptId, answers: {}, expectedAnswerRevision: 1, submitSavedOnly: true }); expect(result.passed).toBe(true); });
  it("start retries and concurrent submits are idempotent; max counts all source attempts", async () => { const [a, b] = await Promise.all([caller().startNativeCourseAttempt(contextInput), caller().startNativeCourseAttempt(contextInput)]); expect(a.attemptId).toBe(b.attemptId); const payload = { ...contextInput, attemptId: a.attemptId, answers: rawFor(a.questions), expectedAnswerRevision: 0 }; const [first, retry] = await Promise.all([caller().submitNativeCourseAttempt(payload), caller().submitNativeCourseAttempt({ ...payload, answers: {} })]); expect(retry).toEqual(first); const second = await caller().startNativeCourseAttempt(contextInput); await caller().submitNativeCourseAttempt({ ...contextInput, attemptId: second.attemptId, answers: {}, expectedAnswerRevision: 0 }); await expect(caller().startNativeCourseAttempt(contextInput)).rejects.toThrow("Maximum attempts"); expect(attempts()).toHaveLength(2); });
  it("unsupported draw/branching fail explicitly instead of all-question bank compatibility", async () => { fixture.rows.set(schema.quizzes, [makeRow(nativeSeven, { branchingEnabled: true })]); await expect(caller().startNativeCourseAttempt(contextInput)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" }); expect(fixture.writes).toHaveLength(0); });
  it("legacy numeric bank get/start/check/complete contracts still work", async () => { fixture.rows.set(schema.quizzes, [{ id: 44, orgId: 9, title: "Bank quiz", isPublished: true, visibility: "published", maxAttempts: 2, passScorePercent: 70, randomizeAnswers: false, showCorrectAnswers: true, showExplanations: true, quizType: "quiz" }]); fixture.rows.set(schema.quizQuestionPools, [{ quizId: 44, bankId: 70, drawCount: 1 }]); fixture.rows.set(schema.quizQuestionOverrides, []); fixture.rows.set(schema.quizBankQuestions, [{ id: 71, bankId: 70, isArchived: false, questionType: "mc", questionText: "Bank question", points: 1 }]); fixture.rows.set(schema.quizAnswerChoices, [{ id: 72, questionId: 71, choiceText: "Right", isCorrect: true, sortOrder: 0 }]); const info = await caller().getLearnerQuizInfo(contextInput); expect(info).toMatchObject({ kind: "bank", questionCount: 1 }); const started = await caller().startLearnerAttempt(contextInput); expect(started.questions[0]).toMatchObject({ id: 71, questionBankId: 71 }); await caller().checkLearnerResponse({ ...contextInput, attemptId: started.attemptId, questionId: 71, selectedChoiceIds: [72] }); const result = await caller().completeLearnerAttempt({ ...contextInput, attemptId: started.attemptId }); expect(result).toMatchObject({ score: 100, passed: true }); expect(Array.isArray(attempts()[0].questionSnapshot)).toBe(true); });
});

describe("native completion integration guard and final source regressions", () => {
  it("completion hook denies absent/native pending/preview/foreign enrollment and permits only frozen final pass", async () => {
    await expect(assertCourse360NativeLessonCompletion(mockDb, 5, 20, 31, 60)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    const started = await caller().startNativeCourseAttempt(contextInput);
    await caller().submitNativeCourseAttempt({ ...contextInput, attemptId: started.attemptId, answers: rawFor(started.questions), expectedAnswerRevision: 0 });
    await expect(assertCourse360NativeLessonCompletion(mockDb, 5, 20, 31, 60)).resolves.toBeUndefined();
    await expect(assertCourse360NativeLessonCompletion(mockDb, 5, 20, 31, 61)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    attempts()[0].questionSnapshot.gradingStatus = "pending_manual";
    await expect(assertCourse360NativeLessonCompletion(mockDb, 5, 20, 31, 60)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    attempts()[0].questionSnapshot.gradingStatus = "graded"; attempts()[0].questionSnapshot.source.mode = "author_preview";
    await expect(assertCourse360NativeLessonCompletion(mockDb, 5, 20, 31, 60)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
  it("completion hook is additive and leaves non-native bank lessons untouched", async () => {
    fixture.rows.set(schema.quizzes, [{ id: 44, orgId: 9, instructions: "[]" }]);
    await expect(assertCourse360NativeLessonCompletion(mockDb, 5, 20, 31, 60)).resolves.toBeUndefined();
  });
  it("same cloud row with replaced native UUID cannot read an old signed source", async () => {
    const started = await caller().startNativeCourseAttempt(contextInput);
    row().themeConfig.course360QuizNativeV1.config.meta.id = "replacement-uuid";
    await expect(caller().getNativeCourseAttempt({ ...contextInput, attemptId: started.attemptId })).rejects.toThrow("Attempt is not available");
  });
  it("main-platform author preview requires persisted selection and authority without fallback school", async () => {
    fixture.author = true; row().isPublished = false; row().visibility = "private";
    const started = await caller(5, "course360.app").startNativeCourseAttempt({ ...contextInput, authorPreview: true });
    expect(started.kind).toBe("native"); fixture.selected = 0;
    await expect(caller(5, "course360.app", "site_owner").startNativeCourseAttempt({ ...contextInput, authorPreview: true })).rejects.toThrow("Persisted author");
  });
  it("unknown private config/question/choice keys survive snapshot but never initial learner transport", async () => {
    row().themeConfig.course360QuizNativeV1.config.questions[0].privateModel = "Hidden forward model";
    row().themeConfig.course360QuizNativeV1.config.questions[0].data.choices[0].futureAnswerKey = "Hidden forward choice key";
    row().themeConfig.course360QuizNativeV1.config.meta.branding = { model: "Hidden branding key" };
    const started = await caller().startNativeCourseAttempt(contextInput);
    expect(JSON.stringify(started)).not.toContain("Hidden forward"); expect(JSON.stringify(started)).not.toContain("Hidden branding");
    expect(attempts()[0].questionSnapshot.nativeConfig.questions[0].privateModel).toBe("Hidden forward model");
  });
  it("final native history overlays exact points without exposing snapshots; pending status remains explicit", async () => {
    fixture.rows.set(schema.quizzes, [makeRow([{ id: "essay", type: "essay", stem: "Write", points: .5, data: {} }] as any)]);
    const started = await caller().startNativeCourseAttempt(contextInput);
    await caller().submitNativeCourseAttempt({ ...contextInput, attemptId: started.attemptId, answers: { essay: "text" }, expectedAnswerRevision: 0 });
    const history = await caller().listLearnerAttempts(contextInput);
    expect(history).toHaveLength(1); expect(history[0]).toMatchObject({ id: started.attemptId, gradingStatus: "pending_manual", totalPoints: .5, completedAt: null });
    expect(JSON.stringify(history)).not.toContain("nativeConfig");
    expect(await caller().getLearnerQuizInfo(contextInput)).toMatchObject({ awaitingReview: true, canAttempt: false, latestAttemptId: started.attemptId });
  });
  it("submitted attempt refuses new saves and never regrades on repeat submission", async () => {
    const started = await caller().startNativeCourseAttempt(contextInput);
    const payload = { ...contextInput, attemptId: started.attemptId, answers: rawFor(started.questions), expectedAnswerRevision: 0 };
    const graded = await caller().submitNativeCourseAttempt(payload);
    await expect(caller().saveNativeCourseAnswers({ ...payload, answers: {}, expectedAnswerRevision: 1 })).rejects.toThrow("already been submitted");
    expect(await caller().submitNativeCourseAttempt({ ...payload, answers: {} })).toEqual(graded);
  });
});

describe("context-aware native completion parent contract", () => {
 it("requires selected learner school and request host when parent supplies context", async () => {
   const started = await caller().startNativeCourseAttempt(contextInput);
   await caller().submitNativeCourseAttempt({ ...contextInput, attemptId: started.attemptId, answers: rawFor(started.questions), expectedAnswerRevision: 0 });
   const context = { user: { id: 5 }, req: { hostname: "school-a.course360.app", headers: {} }, courseSlug: "course-a" };
   await expect(assertCourse360NativeLessonCompletion(mockDb, 5, 20, 31, 60, context)).resolves.toBeUndefined();
   await expect(assertCourse360NativeLessonCompletion(mockDb, 5, 20, 31, 60, { ...context, req: { hostname: "school-b.course360.app", headers: {} } })).rejects.toThrow();
   fixture.selected = 10;
   await expect(assertCourse360NativeLessonCompletion(mockDb, 5, 20, 31, 60, context)).rejects.toThrow();
   fixture.selected = 9; enrollment().status = "cancelled";
   await expect(assertCourse360NativeLessonCompletion(mockDb, 5, 20, 31, 60, context)).rejects.toThrow("Active course enrollment");
 });
 it("optional context remains additive for non-native lessons", async () => {
   fixture.rows.set(schema.quizzes, [{ id: 44, orgId: 9, instructions: "[]" }]);
   await expect(assertCourse360NativeLessonCompletion(mockDb, 5, 20, 31, 60, { user: { id: 99 }, req: {}, courseSlug: "wrong" })).resolves.toBeUndefined();
 });
});
