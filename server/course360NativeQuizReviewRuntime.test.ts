import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableColumns, getTableName } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import * as schema from "../drizzle/schema";
import { course360PaymentAppSubscriptions, course360PaymentManualGrants } from "./lib/course360PaymentTables";
const state = vi.hoisted(() => ({ rows: new Map<any, any[]>(), writes: [] as any[], sql: [] as any[], locks: 0, nextId: 100, txTail: Promise.resolve() as Promise<any>, auditFail: false, selectedReads: 0, switchAfterRead: 0, updateMiss: false }));
vi.mock("./db", () => ({ getDb: async () => db, getUserById: async (id: number) => state.rows.get(schema.users)?.find(u => u.id === id), getOrgMember: async (orgId: number, userId: number) => state.rows.get(schema.orgMembers)?.find(m => m.orgId === orgId && m.userId === userId), getOrgIdForUserWithFallback: () => { throw new Error("Fallback forbidden"); } }));
import { router } from "./_core/trpc";
import { course360NativeQuizReviewProcedures } from "./course360NativeQuizReviewProcedures";
import { course360NativeCourseQuizProcedures, assertCourse360NativeLessonCompletion } from "./lib/course360NativeCourseQuizRuntime";
import { assertCourse360NativeCourseCompletion } from "./lib/course360NativeCompletionGate";
import { configureCourse360AppCapabilityLedger } from "./lib/course360AppCapabilities";
import { nativeQuizSaveFields } from "./lib/quizNativeConfigRuntime";
const dialect = new MySqlDialect();
function column(table: any, sqlName: string) { return Object.entries(getTableColumns(table)).find(([, value]: any) => value.name === sqlName)?.[0]; }
function contexts(table: any, joins: any[], condition: any) {
  const query = condition ? dialect.sqlToQuery(condition) : { sql: "", params: [] as any[] }; state.sql.push({ table: getTableName(table), ...query });
  let rows = (state.rows.get(table) ?? []).map(row => ({ [getTableName(table)]: row }));
  for (const join of joins) rows = rows.flatMap(ctx => (state.rows.get(join.table) ?? []).map(row => ({ ...ctx, [getTableName(join.table)]: row })));
  const matches = (ctx: any, sql: string, params: any[]) => {
    const tables = [table, ...joins.map(j => j.table)];
    const read = (name: string, col: string) => { const source = tables.find(t => getTableName(t) === name); return source && ctx[name]?.[column(source, col)!]; };
    for (const m of sql.matchAll(/`([^`]+)`\.`([^`]+)` = `([^`]+)`\.`([^`]+)`/g)) if (read(m[1], m[2]) !== read(m[3], m[4])) return false;
    let index = 0;
    for (const m of sql.matchAll(/`([^`]+)`\.`([^`]+)` (=|>) \?/g)) { const value = read(m[1], m[2]), expected = params[index++]; if (m[3] === "=" ? value !== expected : !(value > expected)) return false; }
    return true;
  };
  return rows.filter(ctx => joins.every(j => { const q = dialect.sqlToQuery(j.condition); return matches(ctx, q.sql, q.params); }) && matches(ctx, query.sql, query.params));
}
function query(projection: any) {
  let table: any, condition: any, limit = Infinity; const joins: any[] = [];
  const apply = () => {
    if (table === schema.userActiveOrg && ++state.selectedReads === state.switchAfterRead) state.rows.get(schema.userActiveOrg)![0].orgId = 10;
    return contexts(table, joins, condition).slice(0, limit).map(ctx => projection ? Object.fromEntries(Object.entries(projection).map(([name, value]: any) => {
      if ([table, ...joins.map(j => j.table)].includes(value)) return [name, ctx[getTableName(value)]];
      const source = [table, ...joins.map(j => j.table)].find(t => Object.values(getTableColumns(t)).includes(value));
      return [name, ctx[getTableName(source)][column(source, value.name)!]];
    })) : ctx[getTableName(table)]);
  };
  const chain: any = { from: (t: any) => { table = t; return chain; }, innerJoin: (t: any, c: any) => { joins.push({ table: t, condition: c }); return chain; }, where: (c: any) => { condition = c; return chain; }, orderBy: () => chain, limit: (n: number) => { limit = n; return Promise.resolve().then(apply); }, for: () => { state.locks++; return Promise.resolve().then(apply); }, then: (ok: any, fail: any) => Promise.resolve().then(apply).then(ok, fail) };
  return chain;
}
function fields(table: any, values: any) { for (const key of Object.keys(values)) if (!getTableColumns(table)[key]) throw new Error(`Unknown schema column: ${key}`); }
const db: any = {
  select: (projection: any) => query(projection),
  insert: (table: any) => ({ values: async (values: any) => { fields(table, values); if (table === schema.userActivityLogs && state.auditFail) throw new Error("Audit unavailable"); const id = state.nextId++; const row = { id, ...values }; (state.rows.get(table) ?? state.rows.set(table, []).get(table))!.push(row); state.writes.push({ table, values }); return [{ insertId: id }]; } }),
  update: (table: any) => ({ set: (values: any) => { fields(table, values); return { where: async (condition: any) => { const rows = state.updateMiss ? [] : contexts(table, [], condition); rows.forEach(ctx => Object.assign(ctx[getTableName(table)], values)); state.writes.push({ table, values }); return [{ affectedRows: rows.length }]; } }; } }),
  transaction: (fn: any) => { const task = state.txTail.then(() => fn(db)); state.txTail = task.catch(() => {}); return task; },
};
const merged = router({ ...course360NativeQuizReviewProcedures, ...course360NativeCourseQuizProcedures });
const caller = (id = 7, host = "course360.app", role = "user") => merged.createCaller({ user: { id, role }, req: { hostname: host, headers: {} } } as any);
const scope = { orgId: 9, quizId: 44 }, learnerContext = { quizId: 44, courseSlug: "course-a", sourceLessonId: 31 };
const questions = [
  { id: "auto", type: "mcq", stem: "Automatic", points: .25, data: { choices: [{ id: "correct", text: "Correct", correct: true }] }, future: { retained: true } },
  { id: "essay", type: "essay", stem: "Explain the image", points: .5, data: { rubric: "Frozen rubric", sampleAnswer: "Frozen model" } },
  { id: "short", type: "short_answer", stem: "Short explanation", points: .75, data: { autoGrade: false } },
];
const answers = { auto: ["correct"], essay: "Learner private answer", short: "Learner short" };
const attempt = () => state.rows.get(schema.quizAttempts)![0];
const quiz = () => state.rows.get(schema.quizzes)![0];
const member = () => state.rows.get(schema.orgMembers)!.find(m => m.userId === 7)!;
const subscription = () => state.rows.get(course360PaymentAppSubscriptions)![0];
const selected = () => state.rows.get(schema.userActiveOrg)!.find(s => s.userId === 7)!;
async function pending(rawAnswers = answers) { const started = await caller(5, "school-a.course360.app").startNativeCourseAttempt(learnerContext); await caller(5, "school-a.course360.app").submitNativeCourseAttempt({ ...learnerContext, attemptId: started.attemptId, expectedAnswerRevision: 0, answers: rawAnswers }); return started.attemptId; }
const grading = (attemptId: number, questionId = "essay", points = .5, expectedReviewRevision = 0, operationId = "review_op_0000001") => ({ ...scope, attemptId, questionId, points, expectedReviewRevision, operationId, feedback: "Instructor feedback" });
async function ready(attemptId: number) { await caller().gradeNativeQuizReviewQuestion(grading(attemptId)); return caller().gradeNativeQuizReviewQuestion(grading(attemptId, "short", .75, 1, "review_op_0000002")); }
beforeEach(() => {
  state.rows.clear(); state.writes.length = 0; state.sql.length = 0; state.locks = 0; state.nextId = 100; state.txTail = Promise.resolve(); state.auditFail = false; state.selectedReads = 0; state.switchAfterRead = 0; state.updateMiss = false;
  state.rows.set(schema.organizations, [{ id: 9, slug: "school-a", isActive: true, isPrimary: false }, { id: 10, slug: "school-b", isActive: true, isPrimary: true }]);
  state.rows.set(schema.users, [{ id: 7, role: "user", quizCreatorAccess: "bundle", email: "same@example.test" }, { id: 5, role: "user" }, { id: 8, role: "user", email: "same@example.test" }]);
  state.rows.set(schema.userActiveOrg, [{ userId: 7, orgId: 9 }, { userId: 5, orgId: 9 }, { userId: 8, orgId: 9 }]);
  state.rows.set(schema.orgMembers, [{ id: 70, orgId: 9, userId: 7, role: "member", memberSubRole: "instructor" }, { id: 50, orgId: 9, userId: 5, role: "member", memberSubRole: "basic_member" }, { id: 80, orgId: 10, userId: 8, role: "org_admin" }]);
  state.rows.set(course360PaymentAppSubscriptions, [{ orgId: 9, userId: 7, product: "quiz_creator", tier: "web", accountId: "acct_reviewfixture", livemode: false, rawStatus: "active", currentPeriodEnd: new Date(Date.now() + 3600000) }]); state.rows.set(course360PaymentManualGrants, []);
  state.rows.set(schema.quizzes, [{ id: 44, orgId: 9, title: "Native Quiz", isPublished: true, visibility: "published", ...nativeQuizSaveFields({ title: "Native Quiz", questionsJson: JSON.stringify(questions), settingsJson: JSON.stringify({ id: "frozen-uuid", passingScore: 85.125, maxAttempts: 2, futurePolicy: "Keep" }) }) }]);
  state.rows.set(schema.lmsCourses, [{ id: 20, orgId: 9, slug: "course-a", title: "Course A", status: "public" }]);
  state.rows.set(schema.lmsLessons, [{ id: 31, orgId: 9, courseId: 20, type: "quiz", standaloneQuizId: 44, previewMode: "none", lessonStatus: "published", countTowardCompletion: true }]);
  state.rows.set(schema.lmsEnrollments, [{ id: 60, orgId: 9, courseId: 20, userId: 5, status: "active", enrollmentType: "full" }]);
  state.rows.set(schema.quizAttempts, []); state.rows.set(schema.userActivityLogs, []);
  configureCourse360AppCapabilityLedger({ getDb: async () => db, accountId: "acct_reviewfixture", livemode: false });
});
describe("actual native review author permission and exact web capability", () => {
  it("reads org-owned pending summary without answers/config/PII, then frozen detail", async () => {
    const id = await pending(), queue = await caller().listNativeQuizReviewAttempts(scope);
    expect(queue).toMatchObject({ orgId: 9, items: [{ attemptId: id, learnerId: 5, manualQuestionCount: 2, reviewedQuestionCount: 0, readyToRelease: false }] });
    for (const secret of ["Learner private answer", "nativeConfig", "Frozen rubric", "same@example"]) expect(JSON.stringify(queue)).not.toContain(secret);
    const detail = await caller().getNativeQuizReviewAttempt({ ...scope, attemptId: id });
    expect(detail.questions[0]).toMatchObject({ id: "essay", answer: answers.essay, rubric: "Frozen rubric", maxPoints: .5 }); expect(detail.questions).toHaveLength(2);
    expect(state.sql.some(q => q.sql.includes(`\`${getTableName(schema.quizzes)}\`.\`${getTableColumns(schema.quizzes).orgId.name}\` = ?`) && q.params.includes(9))).toBe(true);
  });
  it.each(["no-selection", "inactive", "wrong-hint", "no-permission", "session-role", "same-email", "desktop", "studio", "creator", "foreign-user", "foreign-school", "expired", "cancelled", "missing-paid-through"])("denies %s without learner disclosure", async mode => {
    const id = await pending();
    if (mode === "no-selection") state.rows.set(schema.userActiveOrg, []);
    if (mode === "inactive") state.rows.get(schema.organizations)![0].isActive = false;
    if (["no-permission", "session-role"].includes(mode)) member().memberSubRole = "basic_member";
    if (mode === "desktop") subscription().tier = "desktop";
    if (mode === "studio" || mode === "creator") subscription().product = mode;
    if (mode === "foreign-user") subscription().userId = 8;
    if (mode === "foreign-school") subscription().orgId = 10;
    if (mode === "expired") subscription().currentPeriodEnd = new Date(0);
    if (mode === "cancelled") subscription().rawStatus = "canceled";
    if (mode === "missing-paid-through") subscription().currentPeriodEnd = null;
    await expect(caller(mode === "same-email" ? 8 : 7, "course360.app", mode === "session-role" ? "site_owner" : "user").getNativeQuizReviewAttempt({ ...scope, orgId: mode === "wrong-hint" ? 10 : 9, attemptId: id })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("supports exact Web trial and retained manual access without labeling paid", async () => {
    const id = await pending(); subscription().rawStatus = "trialing"; subscription().trialEnd = new Date(Date.now() + 3600000);
    let value = await caller().gradeNativeQuizReviewQuestion(grading(id)); expect(value.audit[0].reviewer.capability).toMatchObject({ isPaid: false, isInTrial: true, app: "quiz_creator", mode: "web" });
    state.rows.set(course360PaymentAppSubscriptions, []); state.rows.set(course360PaymentManualGrants, [{ orgId: 9, userId: 7, product: "quiz_creator", tier: "web", expiresAt: null, revokedAt: null }]);
    value = await caller().gradeNativeQuizReviewQuestion(grading(id, "short", .75, 1, "manual_grant_op_0001")); expect(value.audit[1].reviewer.capability).toMatchObject({ isPaid: false, hasManualGrant: true });
  });
  it("persisted support is awaited/audited and never fabricated as paid", async () => {
    const id = await pending(); state.rows.get(schema.users)![0].role = "site_admin"; state.rows.set(schema.orgMembers, []); state.rows.set(course360PaymentAppSubscriptions, []);
    const value = await caller().gradeNativeQuizReviewQuestion(grading(id)); expect(value.audit[0].reviewer).toMatchObject({ permissionSource: "persisted_platform_support", capability: { platformSupport: true, isPaid: false, hasManualGrant: false } });
    expect(state.rows.get(schema.userActivityLogs)!.every(log => log.metadata.orgId === 9 && log.metadata.app === "quiz_creator" && log.metadata.mode === "web")).toBe(true);
    state.auditFail = true; const old = JSON.stringify(attempt()); await expect(caller().releaseNativeQuizReviewAttempt({ ...scope, attemptId: id, expectedReviewRevision: 1, operationId: "support_release_001" })).rejects.toThrow("Audit unavailable"); expect(JSON.stringify(attempt())).toBe(old);
  });
  it.each(["school-b.course360.app", "foreign.example.test"])("rejects foreign request host %s", async host => { const id = await pending(); await expect(caller(7, host).listNativeQuizReviewAttempts(scope)).rejects.toMatchObject({ code: "NOT_FOUND" }); await expect(caller(7, host).getNativeQuizReviewAttempt({ ...scope, attemptId: id })).rejects.toMatchObject({ code: "NOT_FOUND" }); });
  it("rejects a persisted selected-school switch after row lock", async () => { const id = await pending(); state.selectedReads = 0; state.switchAfterRead = 3; await expect(caller().gradeNativeQuizReviewQuestion(grading(id))).rejects.toThrow(); expect(attempt().questionSnapshot.manualReview).toBeUndefined(); });
});
describe("exact frozen enrolled bindings and queue isolation", () => {
  it.each(["uuid", "snapshot-uuid", "course", "lesson", "learner", "enrollment", "school", "cloud", "source-type", "preview"])("denies altered %s binding", async mode => {
    const id = await pending(), s = attempt().questionSnapshot;
    if (mode === "uuid") quiz().themeConfig.course360QuizNativeV1.config.meta.id = "replaced";
    if (mode === "snapshot-uuid") s.nativeConfig.meta.id = "replaced";
    if (mode === "course") s.source.courseId = 21;
    if (mode === "lesson") s.source.sourceLessonId = 32;
    if (mode === "learner") s.source.userId = 8;
    if (mode === "enrollment") s.source.enrollmentId = 61;
    if (mode === "school") s.source.orgId = 10;
    if (mode === "cloud") s.source.cloudQuizId = 45;
    if (mode === "source-type") attempt().sourceType = "standalone";
    if (mode === "preview") s.source.mode = "author_preview";
    await expect(caller().getNativeQuizReviewAttempt({ ...scope, attemptId: id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller().gradeNativeQuizReviewQuestion(grading(id))).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await caller().listNativeQuizReviewAttempts(scope)).items).toEqual([]);
  });
  it("foreign school's quiz/attempt never enters selected school SQL results or detail", async () => {
    const id = await pending(), foreign = structuredClone(attempt()); foreign.id = id + 1; foreign.quizId = 45; foreign.questionSnapshot.source.orgId = 10; foreign.questionSnapshot.source.cloudQuizId = 45;
    state.rows.get(schema.quizAttempts)!.push(foreign); state.rows.get(schema.quizzes)!.push({ ...quiz(), id: 45, orgId: 10 });
    expect((await caller().listNativeQuizReviewAttempts({ orgId: 9 })).items.map(i => i.attemptId)).toEqual([id]);
    await expect(caller().getNativeQuizReviewAttempt({ orgId: 9, attemptId: foreign.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("queue pagination scans non-native/open rows without exposing them", async () => {
    const id = await pending(); state.rows.get(schema.quizAttempts)!.push({ ...attempt(), id: id + 1, questionSnapshot: [] });
    const page = await caller().listNativeQuizReviewAttempts({ ...scope, limit: 1 }); expect(page.nextCursor).toBe(id); expect(page.items).toHaveLength(1);
    const next = await caller().listNativeQuizReviewAttempts({ ...scope, limit: 1, cursor: id }); expect(next.items).toEqual([]); expect(next.nextCursor).toBe(id + 1);
  });
  it("author edits cannot change frozen rubric/max/passing policy or automatic grades", async () => {
    const id = await pending(), original = structuredClone(attempt().questionSnapshot);
    quiz().themeConfig.course360QuizNativeV1.config.questions = []; quiz().themeConfig.course360QuizNativeV1.config.meta.passingScore = 0;
    const detail = await caller().getNativeQuizReviewAttempt({ ...scope, attemptId: id }); expect(detail.questions[0].rubric).toBe("Frozen rubric");
    await ready(id); expect(attempt().questionSnapshot.nativeConfig).toEqual(original.nativeConfig); expect(attempt().questionSnapshot.scoring).toEqual(original.scoring); expect(attempt().questionSnapshot.answers).toEqual(original.answers);
    expect(attempt().questionSnapshot.manualReview.draftScoring.grades.auto).toEqual(original.scoring.grades.auto);
  });
});
describe("manual grading row-lock revision-CAS and explicit release", () => {
  it.each([-1, .50001, Infinity, NaN])("rejects invalid points %s without writes", async points => { const id = await pending(), old = JSON.stringify(attempt()); await expect(caller().gradeNativeQuizReviewQuestion(grading(id, "essay", points))).rejects.toMatchObject({ code: "BAD_REQUEST" }); expect(JSON.stringify(attempt())).toBe(old); });
  it.each(["auto", "foreign"])("cannot grade %s nonmanual/unknown question", async questionId => { const id = await pending(); await expect(caller().gradeNativeQuizReviewQuestion(grading(id, questionId, .1))).rejects.toMatchObject({ code: "BAD_REQUEST" }); });
  it("rejects client totals/pass, unbounded feedback and invalid operation ID", async () => { const id = await pending(); for (const extra of [{ passed: true }, { earnedPoints: 99 }, { feedback: "x".repeat(4001) }, { operationId: "bad" }]) await expect(caller().gradeNativeQuizReviewQuestion({ ...grading(id), ...extra } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" }); });
  it("partial reviews retain pending state and no recomputed total; all reviewed still require release", async () => {
    const id = await pending(), original = structuredClone(attempt());
    const partial = await caller().gradeNativeQuizReviewQuestion(grading(id)); expect(partial).toMatchObject({ reviewRevision: 1, readyToRelease: false, draftResult: null, releasedAt: null });
    expect(attempt()).toMatchObject({ status: "in_progress", passed: false, completedAt: null, legacyIsCompleted: false });
    await expect(caller().releaseNativeQuizReviewAttempt({ ...scope, attemptId: id, expectedReviewRevision: 1, operationId: "release_before_all_01" })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    const all = await caller().gradeNativeQuizReviewQuestion(grading(id, "short", .75, 1, "all_reviewed_op_001")); expect(all).toMatchObject({ readyToRelease: true, draftResult: { earnedPoints: 1.5, totalPoints: 1.5, passed: true }, gradingStatus: "pending_manual", releasedAt: null });
    expect(attempt().questionSnapshot.scoring).toEqual(original.questionSnapshot.scoring);
    await expect(assertCourse360NativeLessonCompletion(db, 5, 20, 31, 60)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" }); await expect(assertCourse360NativeCourseCompletion(db, 5, 20, 60, [31])).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
  it("exact release updates JSON final result only, preserves originals/legacy scores and allows later trusted learner completion", async () => {
    const id = await pending(), original = structuredClone(attempt()); await ready(id);
    const released = await caller().releaseNativeQuizReviewAttempt({ ...scope, attemptId: id, expectedReviewRevision: 2, operationId: "release_final_op_001" });
    expect(released).toMatchObject({ reviewRevision: 3, gradingStatus: "graded", releasedResult: { earnedPoints: 1.5, totalPoints: 1.5, passed: true }, readyToRelease: false });
    expect(attempt()).toMatchObject({ status: "completed", passed: true, legacyIsCompleted: true }); expect(attempt().completedAt).toBeInstanceOf(Date);
    for (const key of ["earnedPoints", "totalPoints", "scorePercent", "legacyScoreRaw", "legacyScorePct", "legacyTotalPoints", "legacySubmittedAt", "timeSpentSeconds"]) expect(attempt()[key]).toEqual(original[key]);
    expect(attempt().questionSnapshot.manualReview.originalScoring).toEqual(original.questionSnapshot.scoring);
    expect(attempt().questionSnapshot.scoring.grades.auto).toEqual(original.questionSnapshot.scoring.grades.auto);
    expect(attempt().questionSnapshot.answers).toEqual(original.questionSnapshot.answers);
    expect(released.audit.map((a: any) => a.action)).toEqual(["grade", "grade", "release"]); expect(released.audit[2].reviewer).toMatchObject({ userId: 7, orgId: 9, permissionSource: "persisted_school_member", memberSubRole: "instructor", capability: { app: "quiz_creator", mode: "web" } });
    const learner = await caller(5, "school-a.course360.app").getNativeCourseAttempt({ ...learnerContext, attemptId: id }); expect(learner.result).toMatchObject({ earnedPoints: 1.5, totalPoints: 1.5, passed: true, gradingStatus: "graded", canCompleteLesson: true });
    expect(JSON.stringify(learner)).not.toContain("Frozen rubric"); expect(JSON.stringify(learner)).not.toContain("manualReview");
    await expect(assertCourse360NativeLessonCompletion(db, 5, 20, 31, 60)).resolves.toBeUndefined(); await expect(assertCourse360NativeCourseCompletion(db, 5, 20, 60, [31])).resolves.toBeUndefined();
    expect(state.writes.every(w => [schema.quizAttempts, schema.userActivityLogs].includes(w.table))).toBe(true);
  });
  it("unrounded frozen passing threshold governs fractional manual result, not browser/display percent", async () => {
    const id = await pending(); attempt().questionSnapshot.nativeConfig.meta.passingScore = 33.334;
    await caller().gradeNativeQuizReviewQuestion(grading(id, "essay", .25)); await caller().gradeNativeQuizReviewQuestion(grading(id, "short", 0, 1, "fractional_review_002"));
    const result = await caller().releaseNativeQuizReviewAttempt({ ...scope, attemptId: id, expectedReviewRevision: 2, operationId: "fractional_release_001" }); expect(result.releasedResult).toMatchObject({ earnedPoints: .5, totalPoints: 1.5, scorePercent: 33.33, passed: false });
    await expect(assertCourse360NativeLessonCompletion(db, 5, 20, 31, 60)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" }); expect((await caller(5, "school-a.course360.app").getNativeCourseAttempt({ ...learnerContext, attemptId: id })).result?.canCompleteLesson).toBe(false);
  });
  it("idempotent grade and release retries retain original provenance and reject operation ID reuse", async () => {
    const id = await pending(), payload = grading(id); await caller().gradeNativeQuizReviewQuestion(payload); const writes = state.writes.length;
    expect((await caller().gradeNativeQuizReviewQuestion(payload)).replayed).toBe(true); expect(state.writes).toHaveLength(writes);
    await expect(caller().gradeNativeQuizReviewQuestion({ ...payload, points: .25 })).rejects.toMatchObject({ code: "CONFLICT" });
    await caller().gradeNativeQuizReviewQuestion(grading(id, "short", .75, 1, "replay_grade_op_002")); const release = { ...scope, attemptId: id, expectedReviewRevision: 2, operationId: "replay_release_001" };
    const first = await caller().releaseNativeQuizReviewAttempt(release), completedAt = attempt().completedAt;
    const retry = await caller().releaseNativeQuizReviewAttempt(release); expect(retry.replayed).toBe(true); expect(retry.releasedAt).toBe(first.releasedAt); expect(attempt().completedAt).toBe(completedAt); expect(attempt().questionSnapshot.manualReview.audit).toHaveLength(3);
    await expect(caller().gradeNativeQuizReviewQuestion(grading(id, "essay", .25, 3, "after_release_op001"))).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect((await caller().listNativeQuizReviewAttempts(scope)).items).toEqual([]);
  });
  it("stale reviewer revisions and concurrent first grades permit one winner with no overwritten audit", async () => {
    const id = await pending(); const values = await Promise.allSettled([caller().gradeNativeQuizReviewQuestion(grading(id)), caller().gradeNativeQuizReviewQuestion(grading(id, "short", .75, 0, "concurrent_review002"))]);
    expect(values.filter(v => v.status === "fulfilled")).toHaveLength(1); expect(values.find(v => v.status === "rejected")).toMatchObject({ reason: { code: "CONFLICT" } }); expect(attempt().questionSnapshot.manualReview.audit).toHaveLength(1); expect(state.locks).toBeGreaterThan(0);
    await expect(caller().releaseNativeQuizReviewAttempt({ ...scope, attemptId: id, expectedReviewRevision: 0, operationId: "stale_release_op001" })).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("student resubmit retries cannot overwrite reviewed or released results", async () => {
    const id = await pending(); await ready(id); let result = await caller(5, "school-a.course360.app").submitNativeCourseAttempt({ ...learnerContext, attemptId: id, answers: { essay: "Replacement" }, expectedAnswerRevision: 0 }); expect(result).toMatchObject({ gradingStatus: "pending_manual", passed: false, canCompleteLesson: false });
    await caller().releaseNativeQuizReviewAttempt({ ...scope, attemptId: id, expectedReviewRevision: 2, operationId: "learner_replay_release" }); result = await caller(5, "school-a.course360.app").submitNativeCourseAttempt({ ...learnerContext, attemptId: id, answers: {}, expectedAnswerRevision: 0 }); expect(result).toMatchObject({ gradingStatus: "graded", passed: true, canCompleteLesson: true }); expect(attempt().questionSnapshot.answers).toEqual(answers);
  });
  it("rejects an unsuccessful locked-row update without pretending persistence succeeded", async () => { const id = await pending(), old = JSON.stringify(attempt()); state.updateMiss = true; await expect(caller().gradeNativeQuizReviewQuestion(grading(id))).rejects.toMatchObject({ code: "CONFLICT" }); expect(JSON.stringify(attempt())).toBe(old); });
  it("zero-point manual questions still require review and release", async () => {
    quiz().themeConfig.course360QuizNativeV1.config.questions = [{ id: "essay", type: "essay", stem: "Unweighted", points: 0, data: {} }]; const id = await pending({ essay: "Answer" } as any); await caller().gradeNativeQuizReviewQuestion(grading(id, "essay", 0)); const result = await caller().releaseNativeQuizReviewAttempt({ ...scope, attemptId: id, expectedReviewRevision: 1, operationId: "zero_points_release1" }); expect(result.releasedResult).toMatchObject({ totalPoints: 0, passed: false });
  });
});
