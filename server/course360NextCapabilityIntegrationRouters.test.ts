import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
const state = vi.hoisted(() => ({ scope: vi.fn(), organization: vi.fn(), select: vi.fn(), getDb: vi.fn() }));
vi.mock("./db", async original => ({ ...(await original<any>()), getDb: state.getDb }));
vi.mock("./formsRouter", () => ({ requireActiveMediaOrganization: vi.fn(async (_user: number, expected: number) => expected) }));
vi.mock("./lib/course360AppCapabilities", async original => ({ ...(await original<any>()), requireCourse360AppCapability: state.scope, requireCourse360AppOrganization: state.organization }));
import { authoringRouter } from "./authoringRouter";
import { quizRouter } from "./routers/quizRouter";
import { creatorImageProcedures } from "./course360CreatorImageProcedures";
import { creatorSchoolPublishProcedures } from "./course360CreatorSchoolPublishProcedures";
import { course360NativeQuizReviewProcedures } from "./course360NativeQuizReviewProcedures";
const requestId = "00000000-0000-4000-8000-000000000000";
const operation = { attemptId: 9, expectedReviewRevision: 0, operationId: "review_operation_0001" };
const inputs: Record<string, any> = {
  creatorOwnedImageStatus: { expectedOrgId: 8 }, generateCreatorOwnedImage: { expectedOrgId: 8, requestId, prompt: "A diagram", consentToGenerate: true, consentToSaveToMainLibrary: true }, cancelCreatorOwnedImage: { expectedOrgId: 8, requestId },
  listSchoolPublishDestinations: { expectedOrgId: 8, projectId: 2 }, publishToSchoolCourse: { expectedOrgId: 8, projectId: 2, courseId: 3, sectionId: 4, requestId, lessonTitle: "New lesson", consentToPublish: true },
  listNativeQuizReviewAttempts: { orgId: 8 }, getNativeQuizReviewAttempt: { orgId: 8, attemptId: 9 }, gradeNativeQuizReviewQuestion: { ...operation, orgId: 8, questionId: "question-1", points: 0 }, releaseNativeQuizReviewAttempt: { ...operation, orgId: 8 },
};
const creatorNames = [...Object.keys(creatorImageProcedures), ...Object.keys(creatorSchoolPublishProcedures)], reviewNames = Object.keys(course360NativeQuizReviewProcedures);
function caller(native: boolean, authenticated = true) { return (native ? quizRouter : authoringRouter).createCaller({ user: authenticated ? { id: 3, role: "site_owner" } : null, req: { headers: { host: "course360.app" } }, res: {} } as any) as any; }
beforeEach(() => {
  vi.clearAllMocks();
  state.select.mockImplementation(() => { throw new Error("Unauthorized school must not be queried"); });
  state.getDb.mockResolvedValue({ select: state.select });
  state.scope.mockResolvedValue({ orgId: 7, isPaid: true, hasManualGrant: false, platformSupport: false, access: { isActive: true, isInTrial: false } });
  state.organization.mockImplementation(async (_user: number, expected?: number) => { if (expected !== undefined && expected !== 7) throw new TRPCError({ code: "FORBIDDEN", message: "Switch to the exact school first" }); return { orgId: 7, member: { role: "org_admin" } }; });
});
describe("actual mounted Creator and native Quiz review procedures", () => {
  it("exposes the exact new Creator procedure objects and retains existing authoring and reviewed AI/PPTX endpoints", () => {
    const record = (authoringRouter as any)._def.record;
    for (const [name, procedure] of Object.entries({ ...creatorImageProcedures, ...creatorSchoolPublishProcedures })) expect(record[name]).toBe(procedure);
    for (const name of ["listProjects", "getProject", "updateSlide", "exportPackage", "previewPackage", "generateAiDraft", "importPptxDraft", "previewExchangeDraft", "applyExchangeDraft", "exportPptx"]) expect(record[name]).toBeTruthy();
  });
  it("exposes exact review procedure objects alongside retained learner and native runtime endpoints", () => {
    const record = (quizRouter as any)._def.record;
    for (const [name, procedure] of Object.entries(course360NativeQuizReviewProcedures)) expect(record[name]).toBe(procedure);
    for (const name of ["getLearnerQuizInfo", "startLearnerAttempt", "completeLearnerAttempt", "getLearnerAttemptResult", "listQuizzes", "getQuiz"]) expect(record[name]).toBeTruthy();
  });
  it.each([...creatorNames.map(name => [false, name] as const), ...reviewNames.map(name => [true, name] as const)])("requires authentication on mounted procedure %s / %s", async (native, name) => {
    await expect(caller(native, false)[name](inputs[name])).rejects.toMatchObject({ code: "UNAUTHORIZED" }); expect(state.getDb).not.toHaveBeenCalled(); expect(state.scope).not.toHaveBeenCalled();
  });
  it.each([...creatorNames.map(name => [false, name] as const), ...reviewNames.map(name => [true, name] as const)])("a global owner cannot bypass mismatched school on mounted procedure %s / %s", async (native, name) => {
    try { await caller(native)[name](inputs[name]); throw new Error("Unexpected authorization success"); } catch (error) { expect(error).toBeInstanceOf(TRPCError); expect(["FORBIDDEN", "CONFLICT"]).toContain((error as TRPCError).code); }
    expect(state.select).not.toHaveBeenCalled();
  });
});
