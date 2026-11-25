import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import * as schema from "../drizzle/schema";
import { nativeQuizSaveFields } from "./lib/quizNativeConfigRuntime";
const state = vi.hoisted(() => ({ rows: new Map<any, any[]>(), writes: [] as any[], selected: 9, db: null as any, pdf: vi.fn(), storage: vi.fn(), email: vi.fn(), workflow: vi.fn(async () => undefined) }));
vi.mock("./db", async original => ({ ...(await original<any>()), getDb: vi.fn(async () => state.db), getOrgIdForUserWithFallback: vi.fn(async () => 9) }));
vi.mock("./lib/quizLearnerSelectedSchoolRuntime", () => ({ requireSelectedQuizLearnerSchool: vi.fn(async () => state.selected) }));
vi.mock("./lib/certificateGenerator", () => ({ generateCertificatePdf: state.pdf }));
vi.mock("./lib/certificateEmail", () => ({ sendCertificateEmail: state.email }));
vi.mock("./storage", () => ({ storagePut: state.storage }));
vi.mock("./lib/emailWorkflowEngine", () => ({ emitEmailWorkflowEvent: state.workflow }));
import { lmsLearnerRouter } from "./routers/lmsRouter";
import { recalcProgress, issueCertificateIfEnabled } from "./routers/lmsHelpers";
const dialect = new MySqlDialect();
function rowsFor(table: any, condition: any) {
  if (!condition) return state.rows.get(table) ?? [];
  const query = dialect.sqlToQuery(condition), columns = getTableColumns(table);
  const equals = [...query.sql.matchAll(/`[^`]+`\.`([^`]+)` = \?/g)];
  return (state.rows.get(table) ?? []).filter(row => equals.every(match => {
    const property = Object.entries(columns).find(([, column]: any) => column.name === match[1])?.[0];
    const index = (query.sql.slice(0, match.index).match(/\?/g) ?? []).length;
    return property && row[property] === query.params[index];
  }));
}
function database() {
  return {
    select: (selection: any) => ({ from: (table: any) => {
      let condition: any;
      const result = () => { const rows = rowsFor(table, condition); return selection?.count ? [{ count: rows.length }] : selection?.anyProgress ? [{ anyProgress: rows.length }] : rows; };
      const chain: any = { where: (value: any) => { condition = value; return chain; }, orderBy: () => chain, limit: async (count: number) => result().slice(0, count), then: (resolve: any, reject: any) => Promise.resolve(result()).then(resolve, reject) };
      return chain;
    } }),
    insert: (table: any) => ({ values: (values: any) => {
      const apply = () => { state.writes.push({ kind: "insert", table, values }); const rows = state.rows.get(table) ?? []; rows.push({ id: 100 + state.writes.length, ...values }); state.rows.set(table, rows); return undefined; };
      const promise: any = { onDuplicateKeyUpdate: async () => apply(), then: (resolve: any, reject: any) => Promise.resolve(apply()).then(resolve, reject), catch: (reject: any) => Promise.resolve(apply()).catch(reject) };
      return promise;
    } }),
    update: (table: any) => ({ set: (values: any) => ({ where: async (condition: any) => { state.writes.push({ kind: "update", table, values }); for (const row of rowsFor(table, condition)) Object.assign(row, values); return [{ affectedRows: rowsFor(table, condition).length }]; } }) }),
    delete: (table: any) => ({ where: async () => { state.writes.push({ kind: "delete", table }); } }),
  };
}
const row = (table: any) => state.rows.get(table)![0];
function nativeAttempt() {
  const config = row(schema.quizzes).themeConfig.course360QuizNativeV1.config;
  return { id: 80, quizId: 44, userId: 5, sourceLessonId: 31, sourceType: "lesson", status: "completed", passed: true, completedAt: new Date(), questionSnapshot: {
    kind: "course360_native_course_quiz_v1", version: 1, nativeConfig: config, submittedAt: Date.now(), gradingStatus: "graded", scoring: { earnedPoints: .75, totalPoints: .75, pendingManual: false },
    source: { orgId: 9, courseId: 20, sourceLessonId: 31, enrollmentId: 60, userId: 5, nativeQuizId: "native-uuid", cloudQuizId: 44, mode: "enrolled" },
  } };
}
const complete = (hostname = "school-a.course360.app") => lmsLearnerRouter.createCaller({ user: { id: 5, role: "user", email: "learner@example.test", name: "Learner" }, req: { hostname, headers: {} }, res: {} } as any).markLessonComplete({ courseSlug: "course-a", lessonId: 31 });
beforeEach(() => {
  vi.clearAllMocks(); state.rows.clear(); state.writes = []; state.selected = 9; state.db = database();
  state.rows.set(schema.organizations, [{ id: 9, slug: "school-a", isActive: true, cmeEnabled: false }, { id: 10, slug: "school-b", isActive: true }]);
  state.rows.set(schema.lmsCourses, [{ id: 20, orgId: 9, slug: "course-a", status: "public", title: "Retained course", hasCertificate: false }]);
  state.rows.set(schema.lmsLessons, [{ id: 31, orgId: 9, courseId: 20, sectionId: null, type: "quiz", title: "Retained lesson", standaloneQuizId: 44, lessonStatus: "published", countTowardCompletion: true, previewMode: "none", contentBlocks: "[]" }]);
  state.rows.set(schema.quizzes, [{ id: 44, orgId: 9, isPublished: true, visibility: "published", ...nativeQuizSaveFields({ title: "Native quiz", questionsJson: JSON.stringify([{ id: "tf", type: "tf", stem: "True?", points: .75, data: { correct: true } }]), settingsJson: JSON.stringify({ id: "native-uuid", passingScore: 85.125 }) }) }]);
  state.rows.set(schema.lmsEnrollments, [{ id: 60, orgId: 9, courseId: 20, userId: 5, status: "active", enrollmentType: "full", accessExpiresAt: new Date(Date.now() + 3600000), progressPct: 0, completedAt: null }]);
  state.rows.set(schema.lmsSections, []); state.rows.set(schema.lmsLessonProgress, []); state.rows.set(schema.quizAttempts, []); state.rows.set(schema.lmsCertificates, []);
});
function expectNoEffects() { expect(state.writes).toEqual([]); expect(state.pdf).not.toHaveBeenCalled(); expect(state.storage).not.toHaveBeenCalled(); expect(state.email).not.toHaveBeenCalled(); expect(state.workflow).not.toHaveBeenCalled(); }
describe("Actual native lesson completion route", () => {
  it("denies a direct completion bypass with no assigned native attempt before any progress/effects", async () => { await expect(complete()).rejects.toMatchObject({ code: "PRECONDITION_FAILED" }); expectNoEffects(); });
  it.each(["pending", "preview", "foreign-enrollment", "foreign-school", "foreign-user", "replaced-uuid", "below-mastery"])("denies %s even when the attempt has a passed flag", async kind => {
    const attempt = nativeAttempt(), snapshot = attempt.questionSnapshot;
    if (kind === "pending") snapshot.gradingStatus = "pending_manual";
    if (kind === "preview") snapshot.source.mode = "author_preview";
    if (kind === "foreign-enrollment") snapshot.source.enrollmentId = 61;
    if (kind === "foreign-school") snapshot.source.orgId = 10;
    if (kind === "foreign-user") snapshot.source.userId = 6;
    if (kind === "replaced-uuid") snapshot.source.nativeQuizId = "replaced-uuid";
    if (kind === "below-mastery") snapshot.scoring.earnedPoints = .5;
    state.rows.set(schema.quizAttempts, [attempt]);
    await expect(complete()).rejects.toMatchObject({ code: "PRECONDITION_FAILED" }); expectNoEffects();
  });
  it("rejects a persisted school switch even if the old fallback still returns school A", async () => { state.rows.set(schema.quizAttempts, [nativeAttempt()]); state.selected = 10; await expect(complete()).rejects.toThrow(); expectNoEffects(); });
  it("rejects a foreign school request host before lesson progress", async () => { state.rows.set(schema.quizAttempts, [nativeAttempt()]); await expect(complete("school-b.course360.app")).rejects.toThrow(); expectNoEffects(); });
  it("permits only the exact final enrolled pass and retains course, lesson, and quiz content", async () => {
    state.rows.set(schema.quizAttempts, [nativeAttempt()]); const original = [schema.lmsCourses, schema.lmsLessons, schema.quizzes].map(table => structuredClone(state.rows.get(table)));
    await expect(complete()).resolves.toEqual({ success: true });
    expect(row(schema.lmsLessonProgress)).toMatchObject({ orgId: 9, enrollmentId: 60, lessonId: 31, status: "completed" });
    expect(row(schema.lmsEnrollments).progressPct).toBe(100); expect(row(schema.lmsEnrollments).completedAt).toBeInstanceOf(Date);
    expect([schema.lmsCourses, schema.lmsLessons, schema.quizzes].map(table => state.rows.get(table))).toEqual(original);
    expect(state.pdf).not.toHaveBeenCalled(); expect(state.storage).not.toHaveBeenCalled(); expect(state.email).not.toHaveBeenCalled();
  });
  it("preserves non-native lesson completion without introducing Quiz author entitlement", async () => { row(schema.lmsLessons).standaloneQuizId = null; await expect(complete()).resolves.toEqual({ success: true }); expect(row(schema.lmsEnrollments).progressPct).toBe(100); });
});
describe("Independent course completion and certificate gates", () => {
  it("does not release a course merely because historical lesson progress says completed", async () => { state.rows.set(schema.lmsLessonProgress, [{ id: 90, enrollmentId: 60, lessonId: 31, completedAt: new Date() }]); const original = structuredClone(row(schema.lmsEnrollments)); await expect(recalcProgress(state.db, 60)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" }); expect(row(schema.lmsEnrollments)).toEqual(original); expectNoEffects(); });
  it("prevents native pending results from issuing a new certificate", async () => { row(schema.lmsCourses).hasCertificate = true; await expect(issueCertificateIfEnabled(state.db, 60, 5, 20, "full")).rejects.toMatchObject({ code: "PRECONDITION_FAILED" }); expectNoEffects(); });
  it("preserves an already issued certificate without deleting, invalidating, or regenerating it", async () => { row(schema.lmsCourses).hasCertificate = true; state.rows.set(schema.lmsCertificates, [{ id: 95, userId: 5, courseId: 20, enrollmentId: 60, certificateUrl: "https://retained.example.test/certificate.pdf" }]); const original = structuredClone(state.rows.get(schema.lmsCertificates)); await expect(issueCertificateIfEnabled(state.db, 60, 5, 20, "full")).resolves.toBeUndefined(); expect(state.rows.get(schema.lmsCertificates)).toEqual(original); expectNoEffects(); });
  it("denies forced reissue before the existing certificate deletion or provider effects", async () => { row(schema.lmsCourses).hasCertificate = true; state.rows.set(schema.lmsCertificates, [{ id: 95, userId: 5, courseId: 20 }]); await expect(issueCertificateIfEnabled(state.db, 60, 5, 20, "full", true)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" }); expect(state.rows.get(schema.lmsCertificates)).toEqual([{ id: 95, userId: 5, courseId: 20 }]); expectNoEffects(); });
  it.each(["free_preview", "admin_preview", "suspended", "expired"])("does not grant course completion to %s enrollment", async kind => { state.rows.set(schema.quizAttempts, [nativeAttempt()]); state.rows.set(schema.lmsLessonProgress, [{ id: 90, enrollmentId: 60, lessonId: 31, completedAt: new Date() }]); if (kind === "suspended") row(schema.lmsEnrollments).status = kind; else if (kind === "expired") row(schema.lmsEnrollments).accessExpiresAt = new Date(Date.now() - 1); else row(schema.lmsEnrollments).enrollmentType = kind; await expect(recalcProgress(state.db, 60)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" }); expectNoEffects(); });
});
