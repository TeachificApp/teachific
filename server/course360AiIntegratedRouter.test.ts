import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { lmsCourses, lmsSections, lmsLessons, lmsQuizzes, lmsQuizQuestions, lmsLandingPages, orgMembers, orgSubscriptions, organizations, users, userActiveOrg } from "../drizzle/schema";
const m = vi.hoisted(() => ({ db: null as any, activeOrg: 17 as number | null, membership: "org_admin", plan: "pro", status: "active", courseOrg: 17, courseType: "course", organizationActive: true, failTable: null as any, committed: [] as any[], writes: [] as any[], txCount: 0, rolledBack: 0, provider: vi.fn(), context: vi.fn(), message: vi.fn(), image: vi.fn(), requireAdmin: vi.fn(), shared: vi.fn() }));
vi.mock("./db", () => ({ getDb: async () => m.db, getOrgIdForUserWithFallback: async () => m.activeOrg, requireOrgAdmin: m.requireAdmin, isPlatformAdmin: (role: string) => ["site_owner", "site_admin", "admin"].includes(role), getOrgIdForUser: vi.fn(), getOrCreateAccessToken: vi.fn() }));
vi.mock("./lib/course360AiSourceProvider", () => ({ invokeCourse360SourceLLM: m.provider }));
vi.mock("./lib/course360AiCourseSource", () => ({ buildCourseSourceContext: m.context }));
vi.mock("./lib/course360AiCourseSourceMessage", () => ({ buildCourse360SourceMessage: m.message }));
vi.mock("./_core/llm", () => ({ invokeLLM: m.shared }));
vi.mock("./_core/imageGeneration", () => ({ generateImage: m.image }));
vi.mock("./storage", () => ({ storagePut: vi.fn(() => { throw new Error("Unexpected storage write"); }) }));
vi.mock("./lib/certificateGenerator", () => ({ generateCertificatePdf: vi.fn() }));
vi.mock("./lib/certificateEmail", () => ({ sendCertificateEmail: vi.fn() }));
vi.mock("./lib/enrollmentEmail", () => ({ sendEnrollmentEmail: vi.fn() }));
vi.mock("./lib/emailListHelper", () => ({ addToAllContacts: vi.fn() }));
vi.mock("./_core/email", () => ({ sendEmail: vi.fn(), buildFreePreviewConfirmationEmail: vi.fn() }));
import { lmsEnrollmentAdminRouter } from "./routers/lmsEnrollmentAdminRouter";
import { lmsCourseBuilderRouter } from "./routers/lmsCourseBuilderRouter";
const dialect = new MySqlDialect();
const fullHtml = `<h2>Complete lesson</h2><p>${Array.from({ length: 1500 }, (_, i) => `word${i}`).join(" ")}</p>`;
const q = { question: "Which is correct?", options: ["A", "B", "C", "D"], correctAnswer: "A", explanation: "A is correct." };
const draft = () => ({ title: "Reviewed title", subtitle: "Reviewed subtitle", landingPage: { heroTitle: "Reviewed hero" }, sections: [{ title: "Module", lessons: [{ title: "Full lesson", content: fullHtml, takeaways: ["One", "Two", "Three"], reflectionQuestion: "Why?", practiceActivity: "Apply safely.", quiz: { questions: [q] } }] }], courseQuiz: { title: "Assessment", questions: [q] } });
const caller = (role = "org_admin") => lmsEnrollmentAdminRouter.createCaller({ user: { id: 8, role }, req: {}, res: {} } as any);
function fakeDb(staged?: any[]): any {
  const write = (table: any, data: any, kind: string) => {
    if (!staged) throw new Error("Write outside transaction");
    m.writes.push({ table, data, kind });
    if (m.failTable === table) throw new Error("Mock DB write failed");
    const row = { table, data, kind, id: staged.length + 100 };
    staged.push(row); return row;
  };
  return {
    select: (selection?: any) => ({ from: (table: any) => {
      let condition: any;
      const rows = () => {
        if (table === userActiveOrg) return m.activeOrg && m.organizationActive ? [{ orgId: m.activeOrg }] : [];
        if (table === organizations) return [{ isActive: m.organizationActive }];
        if (table === orgMembers) return [{ role: m.membership }];
        if (table === orgSubscriptions) return [{ plan: m.plan, status: m.status }];
        if (table === users) return [{ role: "user" }];
        if (table === lmsCourses) {
          const params = condition ? dialect.sqlToQuery(condition).params : [];
          if (params.length > 1 && params[1] !== m.courseOrg) return [];
          return [{ id: 10, orgId: m.courseOrg, title: "Saved title", type: m.courseType, primaryColor: "#abc" }];
        }
        if (table === lmsSections) return [{ lastPosition: 7 }];
        if (table === lmsLandingPages) return [{ id: 90 }];
        if (table === lmsLessons) return staged ? staged.filter(r => r.table === table).map(r => ({ id: r.id })) : [{ id: 45, title: "Owned lesson", contentBlocks: "[]" }];
        return [];
      };
      const chain: any = { innerJoin: () => chain, where: (c: any) => { condition = c; return chain; }, limit: () => chain, orderBy: () => chain, for: () => chain, then: (yes: any, no: any) => Promise.resolve(rows()).then(yes, no) };
      return chain;
    } }),
    insert: (table: any) => ({ values: (data: any) => {
      const row = write(table, data, "insert");
      return { $returningId: async () => [{ id: row.id }], then: (yes: any, no: any) => Promise.resolve(undefined).then(yes, no) };
    } }),
    update: (table: any) => ({ set: (data: any) => ({ where: async () => { write(table, data, "update"); } }) }),
    transaction: async (run: any) => {
      m.txCount++;
      const changes: any[] = [];
      try { const result = await run(fakeDb(changes)); m.committed.push(...changes); return result; }
      catch (error) { m.rolledBack++; throw error; }
    },
  };
}
beforeEach(() => {
  vi.clearAllMocks(); m.activeOrg = 17; m.membership = "org_admin"; m.plan = "pro"; m.status = "active"; m.courseOrg = 17; m.courseType = "course"; m.organizationActive = true; m.failTable = null; m.committed = []; m.writes = []; m.txCount = 0; m.rolledBack = 0;
  m.db = fakeDb(); m.requireAdmin.mockResolvedValue(17); m.context.mockResolvedValue(""); m.message.mockImplementation(async (prompt) => prompt); m.provider.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(draft()) }, finish_reason: "stop" }] }); m.image.mockResolvedValue({ url: "https://images.test/mocked" });
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected network call"); }));
});
afterEach(() => vi.unstubAllGlobals());
describe("Integrated quick preview and effective course ownership", () => {
  it("accepts exact one/one preview, keeps full lesson, controls and no writes", async () => {
    const result = await caller().aiGenerateCourse({ topics: "Subject", moduleCount: 1, lessonsPerModule: 1, generateQuizzes: false, generateCourseQuiz: true });
    expect(result.generated.sections[0].lessons[0].content).toBe(fullHtml);
    expect(m.message.mock.calls[0][0]).toContain("EXACTLY 1 modules");
    expect(m.message.mock.calls[0][0]).toContain('"title": "Course Assessment"');
    expect(m.writes).toHaveLength(0); expect(m.txCount).toBe(0); expect(m.image).not.toHaveBeenCalled();
  });
  it("retains quick 5/4 defaults and rejects wrong count", async () => { await expect(caller().aiGenerateCourse({ topics: "Subject" })).rejects.toThrow("requested 5 module"); });
  it("passes source-only PPTX and outline-only requests without losing key", async () => {
    const source = { url: "https://files.test/owned", name: "owned.pptx", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" as const, storageKey: "ai-generation-sources/17/8/owned.pptx" };
    await caller().aiGenerateCourse({ sourceFiles: [source], moduleCount: 1, lessonsPerModule: 1 });
    expect(m.context).toHaveBeenCalledWith([source], expect.objectContaining({ orgId: 17, userId: 8 }));
    await caller().aiGenerateCourse({ starterContent: "Author outline", moduleCount: 1, lessonsPerModule: 1 });
  });
  it.each(["starter", "builder"])("blocks planned/source generation for %s even as platform admin", async plan => { m.plan = plan; await expect(caller("site_admin").aiGenerateCourse({ topics: "Subject", structureMode: "ai" })).rejects.toThrow("Pro or Enterprise"); expect(m.provider).not.toHaveBeenCalled(); });
  it("allows AI planned unequal lesson counts", async () => { const generated = draft(); generated.sections.push({ ...generated.sections[0], lessons: [...generated.sections[0].lessons, generated.sections[0].lessons[0]] }); m.provider.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(generated) }, finish_reason: "stop" }] }); const result = await caller().aiGenerateCourse({ topics: "Subject", structureMode: "ai", moduleCount: 9 }); expect(result.generated.sections.map((s: any) => s.lessons.length)).toEqual([1, 2]); });
  it("rejects malformed quiz preview rather than allowing shell creation", async () => { m.provider.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ title: "Quiz", questions: [] }) }, finish_reason: "stop" }] }); await expect(caller().aiGenerateCourse({ topics: "Quiz", productType: "quiz" })).rejects.toThrow("invalid"); });
  it("denies other-school block reads for platform admin", async () => { m.courseOrg = 22; await expect(caller("site_admin").getLessonsWithBlocks({ courseId: 10 })).rejects.toThrow("active organization"); });
  it.each(["member", "user", "sub_admin", "org_admin_extra"])("denies non-exact membership %s for block reads", async membership => { m.membership = membership; await expect(caller().getLessonsWithBlocks({ courseId: 10 })).rejects.toThrow("administrator"); });
  it("allows an exact org_super_admin block read", async () => { m.membership = "org_super_admin"; await expect(caller().getLessonsWithBlocks({ courseId: 10 })).resolves.toHaveLength(1); });
  it("denies null/inactive school and guest", async () => { m.activeOrg = null; await expect(caller().getLessonsWithBlocks({ courseId: 10 })).rejects.toThrow("active organization"); m.activeOrg = 17; m.organizationActive = false; await expect(caller().aiGenerateCourse({ topics: "Subject" })).rejects.toThrow("unavailable"); const guest = lmsEnrollmentAdminRouter.createCaller({ user: null, req: {}, res: {} } as any); await expect(guest.aiGenerateCourse({ topics: "Subject" })).rejects.toThrow(); });
});
describe("Integrated existing outline review-only transport", () => {
  it("returns exact one/one outline and full body without paid images or writes", async () => { const builder = lmsCourseBuilderRouter.createCaller({ user: { id: 8, role: "org_admin" }, req: {}, res: {} } as any); const result = await builder.generateCourseOutline({ courseId: 10, prompt: "Subject notes", numSections: 1, numLessonsPerSection: 1, previewOnly: true }); expect(result.preview?.sections[0].lessons[0].content).toBe(fullHtml); expect(m.message.mock.calls[0][0]).toContain("EXACTLY 1 modules"); expect(m.image).not.toHaveBeenCalled(); expect(m.writes).toHaveLength(0); });
  it("rejects mismatched exact manual counts and accepts source-aware AI planning", async () => { const builder = lmsCourseBuilderRouter.createCaller({ user: { id: 8, role: "org_admin" }, req: {}, res: {} } as any); await expect(builder.generateCourseOutline({ courseId: 10, prompt: "Subject notes", previewOnly: true })).rejects.toThrow("requested 4 module"); const source = { url: "https://files.test/original", mimeType: "application/vnd.ms-powerpoint" as const, name: "original.ppt", storageKey: "ai-generation-sources/17/8/original.ppt" }; const result = await builder.generateCourseOutline({ courseId: 10, prompt: "Use supplied source documents", structureMode: "ai", sourceFiles: [source], previewOnly: true }); expect(result.preview?.sections).toHaveLength(1); expect(m.context).toHaveBeenCalledWith([source], { orgId: 17, userId: 8 }); expect(m.writes).toHaveLength(0); expect(m.image).not.toHaveBeenCalled(); });
});
describe("Complete reviewed draft validation and atomic writes", () => {
  it.each([null, {}, { sections: [] }, { landingPage: { heroTitle: "Should not write" }, sections: [{ title: "Module", lessons: [{ title: "Missing body" }] }] }])("rejects invalid curriculum before transaction or first write: %j", async generated => { await expect(caller().aiCommitCourse({ courseId: 10, productType: "course", generated })).rejects.toThrow(); expect(m.txCount).toBe(0); expect(m.writes).toHaveLength(0); expect(m.image).not.toHaveBeenCalled(); });
  it("validates every nested quiz and landing field before first write", async () => { const bad = draft(); bad.sections[0].lessons[0].quiz.questions[0] = { ...q, correctAnswer: "Unknown" }; await expect(caller().aiCommitCourse({ courseId: 10, productType: "course", generated: bad })).rejects.toThrow("invalid"); expect(m.writes).toHaveLength(0); });
  it("rejects cross-school commits including platform admins", async () => { m.courseOrg = 22; await expect(caller("site_admin").aiCommitCourse({ courseId: 10, productType: "course", generated: draft() })).rejects.toThrow("organization"); expect(m.txCount).toBe(0); });
  it("rejects nonstring landing fields and invalid durations before any writes", async () => { const badLanding = { ...draft(), landingPage: { heroTitle: { unsafe: true } } }; await expect(caller().aiCommitCourse({ courseId: 10, productType: "course", generated: badLanding })).rejects.toThrow("invalid"); const badDuration = draft(); (badDuration.sections[0].lessons[0] as any).durationMinutes = "not a number"; await expect(caller().aiCommitCourse({ courseId: 10, productType: "course", generated: badDuration })).rejects.toThrow("invalid"); expect(m.txCount).toBe(0); expect(m.writes).toHaveLength(0); });
  it("rejects unsupported legacy admin role rather than widening exact admin permissions", async () => { await expect(caller("admin").getLessonsWithBlocks({ courseId: 10 })).rejects.toThrow(); expect(m.writes).toHaveLength(0); });
  it("commits full HTML, lesson quizzes, course quiz and landing title inside one transaction", async () => { await caller().aiCommitCourse({ courseId: 10, productType: "course", generated: draft() }); expect(m.txCount).toBe(1); expect(m.committed.find(r => r.table === lmsLessons && r.data.type === "text").data.content).toBe(fullHtml); expect(m.committed.filter(r => r.table === lmsQuizQuestions)).toHaveLength(2); expect(m.committed.find(r => r.table === lmsSections).data.position).toBe(8); expect(m.committed.some(r => r.table === lmsLandingPages)).toBe(true); expect(m.committed.some(r => r.table === lmsCourses)).toBe(true); });
  it("rolls back landing, title, sections and quizzes if a later insert fails", async () => { m.failTable = lmsQuizQuestions; await expect(caller().aiCommitCourse({ courseId: 10, productType: "course", generated: draft() })).rejects.toThrow("Mock DB write failed"); expect(m.writes.length).toBeGreaterThan(3); expect(m.committed).toHaveLength(0); expect(m.rolledBack).toBe(1); });
  it("applies reviewed outline editable blocks but preserves saved course/landing and visual choices", async () => { await caller().aiCommitCourse({ courseId: 10, productType: "course", generated: draft(), reviewedOutline: true, includeAiImages: true, includeUnsplashImages: true }); const blocks = JSON.parse(m.committed.find(r => r.table === lmsLessons && r.data.type === "text").data.contentBlocks); expect(blocks.map((b: any) => b.type)).toEqual(["hero", "ai_image", "text", "image", "checklist", "faq"]); expect(blocks.find((b: any) => b.type === "text").data.html).toBe(fullHtml); expect(m.committed.some(r => r.table === lmsLandingPages || r.table === lmsCourses)).toBe(false); expect(m.image).toHaveBeenCalledTimes(1); });
  it("retains reviewed content when optional image fails; image opt-out makes no calls", async () => { m.image.mockRejectedValue(new Error("Mock unavailable")); await caller().aiCommitCourse({ courseId: 10, productType: "course", generated: draft(), reviewedOutline: true }); expect(m.committed.length).toBeGreaterThan(0); m.image.mockClear(); await caller().aiCommitCourse({ courseId: 10, productType: "course", generated: draft(), reviewedOutline: true, includeAiImages: false, includeUnsplashImages: false }); expect(m.image).not.toHaveBeenCalled(); });
  it("preserves standalone true/false quiz and rejects empty quiz", async () => { m.courseType = "quiz"; await caller().aiCommitCourse({ courseId: 10, productType: "quiz", generated: { title: "Quiz", questions: [{ question: "True?", type: "truefalse", options: ["True", "False"], correctAnswer: "True" }] } }); expect(m.committed.find(r => r.table === lmsQuizQuestions).data.type).toBe("truefalse"); m.writes = []; await expect(caller().aiCommitCourse({ courseId: 10, productType: "quiz", generated: { questions: [] } })).rejects.toThrow(); expect(m.writes).toHaveLength(0); });
  it("retains the existing 1500-word full lesson expansion and rejects short result", async () => { const builder = lmsCourseBuilderRouter.createCaller({ user: { id: 8, role: "org_admin" }, req: {}, res: {} } as any); m.shared.mockResolvedValueOnce({ choices: [{ message: { content: "<p>Short draft</p>" } }] }).mockResolvedValueOnce({ choices: [{ message: { content: fullHtml } }] }); const result = await builder.generateLessonContent({ prompt: "Full lesson topic", contentType: "lesson" }); expect(result.content).toBe(fullHtml); expect(result.minimumWordCount).toBe(1500); expect(m.shared).toHaveBeenCalledTimes(2); m.shared.mockResolvedValue({ choices: [{ message: { content: "<p>Still short</p>" } }] }); await expect(builder.generateLessonContent({ prompt: "Full lesson topic", contentType: "lesson" })).rejects.toThrow("1,500-word"); });
});
