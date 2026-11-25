import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName, getTableColumns } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { TRPCError } from "@trpc/server";
import * as tables from "../drizzle/schema";
import { seedCreatorTemplate } from "../shared/course360CreatorLayouts";
const m = vi.hoisted(() => ({ db: null as any, orgId: 7, allowed: true, paid: true, manual: false, provider: vi.fn(), storage: vi.fn(), storageGet: vi.fn(), mediaGuard: vi.fn(), quota: vi.fn(), fail: false, failAfter: 0 }));
vi.mock("./db", () => ({ getDb: async () => m.db, getOrgStorageUsage: m.quota, getUserById: vi.fn(), getOrgMember: vi.fn() }));
vi.mock("./storage", () => ({ storagePut: m.storage, storageGet: m.storageGet }));
vi.mock("./course360CreatorAiProviderBounded", () => ({ invokeCreatorAiConfigured: m.provider }));
vi.mock("./formsRouter", () => ({ requireActiveMediaOrganization: m.mediaGuard }));
vi.mock("./lib/course360AppCapabilities", () => ({ requireCourse360AppCapability: async (user: number, app: string, mode: string) => { expect(app).toBe("creator"); expect(mode).toBe("web"); if (!m.allowed) throw new TRPCError({ code: "FORBIDDEN" }); return { orgId: m.orgId, isPaid: m.paid, hasManualGrant: m.manual }; }, requireCourse360AppOrganization: vi.fn() }));
vi.mock("./lib/course360PaymentLedger", () => ({ getCourse360PaymentAppAccess: vi.fn(), setCourse360PaymentManualRole: vi.fn() }));
const { authoringRouter } = await import("./authoringRouter");
const dialect = new MySqlDialect();
class Db {
  data = new Map<string, any[]>(); writes: any[] = []; next = 100;
  rows(t: any) { return this.data.get(getTableName(t)) || []; }
  seed(t: any, rows: any[]) { this.data.set(getTableName(t), structuredClone(rows)); }
  matches(t: any, row: any, condition: any) { if (!condition) throw new Error("Unscoped query denied"); const q = dialect.sqlToQuery(condition); const columns = Object.fromEntries(Object.entries(getTableColumns(t)).map(([k, v]: any) => [v.name, k])); const terms = [...q.sql.matchAll(/`[^`]+`\.`([^`]+)`\s*=\s*\?/g)]; if (terms.length !== q.params.length) throw new Error("Unknown query"); return terms.every((v, i) => row[columns[v[1]]] === q.params[i]); }
  select() { let t: any, condition: any, limit = Infinity; const c: any = { from: (v: any) => { t = v; return c; }, where: (v: any) => { condition = v; return c; }, orderBy: () => c, limit: (v: number) => { limit = v; return c; }, then: (resolve: any, reject: any) => Promise.resolve().then(() => structuredClone(this.rows(t).filter(r => this.matches(t, r, condition)).slice(0, limit))).then(resolve, reject) }; return c; }
  insert(t: any) { return { values: async (v: any) => { if (m.fail || (m.failAfter && this.writes.length >= m.failAfter)) throw new Error("Injected write failure"); const id = this.next++; this.data.set(getTableName(t), [...this.rows(t), { id, ...structuredClone(v) }]); this.writes.push({ kind: "insert", table: getTableName(t), id, value: v }); return [{ insertId: id }]; } }; }
  update(t: any) { return { set: (v: any) => ({ where: async (condition: any) => { let affectedRows = 0; for (const r of this.rows(t)) if (this.matches(t, r, condition)) { Object.assign(r, v); affectedRows++; this.writes.push({ kind: "update", table: getTableName(t), id: r.id }); } return [{ affectedRows }]; } }) }; }
  async transaction(fn: any) { const saved = structuredClone(this.data), writes = [...this.writes]; try { return await fn(this); } catch (e) { this.data = saved; this.writes = writes; throw e; } }
}
let db: Db;
const caller = () => authoringRouter.createCaller({ user: { id: 3, role: "org_admin" }, req: {}, res: {} } as any);
async function applyReviewed(input: any) { const c = caller(); const preview = await c.previewExchangeDraft({ expectedOrgId: input.expectedOrgId, draft: input.draft }); return c.applyExchangeDraft({ ...input, reviewToken: preview.reviewToken }); }
const request = () => ({ expectedOrgId: 7, topic: "Safety onboarding", details: "Use exact project context", mode: "slides" as const, slideCount: 2, consentToGenerate: true as const });
const response = () => ({ title: "New generated draft", description: "Draft only", fullLessonText: "", slides: [{ title: "Safety first", body: "A concrete introduction to safety.", notes: "Review the key steps", imagePrompt: "Safety diagram", questions: [] }, { title: "Practice", body: "Practice checking the workspace.", notes: "Discuss what happened", imagePrompt: "", questions: [] }] });
const draft = () => ({ version: 1 as const, source: "ai" as const, title: "New draft", description: "Keep", settingsJson: JSON.stringify({ width: 1000, height: 563, legacySetting: "keep" }), slides: [{ id: 1, title: "New slide", background: "#12324a", contentJson: JSON.stringify({ arbitraryField: "keep", blocks: [{ id: "new-text", type: "text", x: 10, y: 10, width: 800, height: 200, content: "New text" }] }), notes: "Keep notes" }], assets: [], warnings: [] });
beforeEach(() => { vi.clearAllMocks(); m.orgId = 7; m.allowed = true; m.paid = true; m.manual = false; m.fail = false; m.failAfter = 0; db = new Db(); m.db = db;
  db.seed(tables.authoringProjects, [{ id: 5, orgId: 7, userId: 3, title: "Existing project", description: "Existing description", status: "published", lastPublishedFormat: "scorm12", settingsJson: JSON.stringify({ width: 1000, height: 563, existingFlag: "keep" }) }, { id: 6, orgId: 8, userId: 3 }, { id: 7, orgId: 7, userId: 4 }]);
  db.seed(tables.authoringSlides, seedCreatorTemplate("training").map((s, i) => ({ ...s, id: i + 20, projectId: 5, slideIndex: i }))); db.seed(tables.orgMediaLibrary, []); m.provider.mockResolvedValue(JSON.stringify(response())); m.mediaGuard.mockResolvedValue(7); m.quota.mockResolvedValue({ usedBytes: 0, maxBytes: 100000000 }); m.storage.mockResolvedValue({ url: "https://owned.invalid/new.png" }); m.storageGet.mockResolvedValue({ url: "https://storage.invalid/picture" });
});
describe("Actual scoped Creator AI/PPTX authoring router", () => {
  it("generates editable real AI drafts using strict JSON bounds, no writes or storage and missing honest images", async () => {
    const result = await caller().generateAiDraft(request()); expect(result.orgId).toBe(7); expect(result.draft.slides).toHaveLength(2); expect(db.writes).toHaveLength(0); expect(m.storage).not.toHaveBeenCalled();
    const doc = JSON.parse(result.draft.slides[0].contentJson); expect(doc.blocks[1].content).toBe(response().slides[0].body); expect(doc.blocks[2]).toMatchObject({ type: "image", src: "", missingMedia: true });
    const [params, signal] = m.provider.mock.calls[0]; expect(params.maxTokens).toBe(4096); expect(params.schema.additionalProperties).toBe(false); expect(signal).toBeInstanceOf(AbortSignal); expect(params.messages[0].content).toContain("at least 1500 words total");
  });
  it("uses existing title/description only by scoped project selection and rejects wrong school/author", async () => {
    await caller().generateAiDraft({ ...request(), topic: "", details: "", projectId: 5 }); expect(JSON.parse(m.provider.mock.calls[0][0].messages[1].content)).toMatchObject({ topic: "Existing project", details: "Existing description" });
    for (const id of [6, 7]) await expect(caller().generateAiDraft({ ...request(), projectId: id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("fails paid Creator Web scope and explicit consent before provider or database writes", async () => {
    await expect(caller().generateAiDraft({ ...request(), consentToGenerate: false } as any)).rejects.toThrow(); m.paid = false;
    for (const op of [() => caller().generateAiDraft(request()), () => caller().previewExchangeDraft({ expectedOrgId: 7, draft: draft() }), () => caller().exportPptx({ expectedOrgId: 7, projectId: 5 }), () => applyReviewed({ expectedOrgId: 7, draft: draft(), target: "new_project", consentToApply: true })]) await expect(op()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(m.provider).not.toHaveBeenCalled(); expect(db.writes).toHaveLength(0); m.manual = true; await caller().generateAiDraft(request()); expect(m.provider).toHaveBeenCalledOnce();
  });
  it("rejects stale selected school even if the user owns both schools", async () => { m.orgId = 8; await expect(caller().generateAiDraft(request())).rejects.toMatchObject({ code: "CONFLICT" }); await expect(applyReviewed({ expectedOrgId: 7, draft: draft(), target: "new_project", consentToApply: true })).rejects.toMatchObject({ code: "CONFLICT" }); expect(db.writes).toHaveLength(0); });
  it("AI invalid JSON/count/provider failure leaves all existing templates untouched", async () => {
    const before = structuredClone(db.data); for (const raw of ["<html>failure</html>", JSON.stringify({ ...response(), slides: [] }), JSON.stringify({ ...response(), slides: [response().slides[0]] })]) { m.provider.mockResolvedValueOnce(raw); await expect(caller().generateAiDraft(request())).rejects.toThrow(); }
    m.provider.mockRejectedValueOnce(new Error("Provider timeout")); await expect(caller().generateAiDraft(request())).rejects.toThrow("Provider timeout"); expect(db.data).toEqual(before); expect(db.writes).toHaveLength(0);
  });
  it("enforces full lesson 1500 words total only for that label and saves complete lesson in draft notes", async () => {
    m.provider.mockResolvedValueOnce(JSON.stringify(response())); await expect(caller().generateAiDraft({ ...request(), mode: "full_lesson" })).rejects.toThrow("1,500");
    const complete = "lesson ".repeat(1500).trim(); m.provider.mockResolvedValueOnce(JSON.stringify({ ...response(), fullLessonText: complete })); const result = await caller().generateAiDraft({ ...request(), mode: "full_lesson" }); expect(result.draft.fullLessonText).toBe(complete); expect(result.draft.slides[0].notes).toContain(complete); expect(db.writes).toHaveLength(0);
  });
  it("validates preview using shared actual runtime and applies only explicit NEW slides while preserving training project/default exports", async () => {
    const original = structuredClone(db.data); const preview = await caller().previewExchangeDraft({ expectedOrgId: 7, draft: draft() }); expect(preview.html).toContain("mountCreatorCourse"); expect(db.writes).toHaveLength(0);
    const result = await applyReviewed({ expectedOrgId: 7, draft: draft(), target: "append_slides", projectId: 5, consentToApply: true }); expect(result.id).toBe(5); expect(result.slideIds).toHaveLength(1); expect(db.rows(tables.authoringSlides).slice(0, 5)).toEqual(original.get(getTableName(tables.authoringSlides))); expect(db.rows(tables.authoringProjects)).toEqual(original.get(getTableName(tables.authoringProjects))); const added = db.rows(tables.authoringSlides)[5]; expect(added.slideIndex).toBe(5); expect(JSON.parse(added.contentJson).arbitraryField).toBe("keep"); expect(db.writes.filter(w => w.kind === "update").every(w => result.slideIds.includes(w.id))).toBe(true);
  });
  it("creates new draft project with preserved settings and remaps only draft-local branch IDs", async () => {
    const d = draft(); const doc = JSON.parse(d.slides[0].contentJson); doc.blocks.push({ id: "branch", type: "button", x: 10, y: 300, width: 100, height: 40, action: { kind: "slide", targetSlideId: 2 } }); d.slides[0].contentJson = JSON.stringify(doc); d.slides.push({ ...d.slides[0], id: 2, contentJson: JSON.stringify({ blocks: [] }) });
    const result = await applyReviewed({ expectedOrgId: 7, draft: d, target: "new_project", consentToApply: true }); const created = db.rows(tables.authoringProjects).find(p => p.id === result.id); expect(created.status).toBe("draft"); expect(JSON.parse(created.settingsJson).legacySetting).toBe("keep"); const first = db.rows(tables.authoringSlides).find(s => s.id === result.slideIds[0]); expect(JSON.parse(first.contentJson).blocks[1].action.targetSlideId).toBe(result.slideIds[1]);
  });
  it("invalid consent/URL/branch/geometry and write failure cause no original overwrite or partial DB result", async () => {
    const original = structuredClone(db.data); await expect(applyReviewed({ expectedOrgId: 7, draft: draft(), target: "append_slides", projectId: 6, consentToApply: true })).rejects.toThrow(); const d = draft(); d.settingsJson = '{"width":800,"height":563}'; await expect(applyReviewed({ expectedOrgId: 7, draft: d, target: "append_slides", projectId: 5, consentToApply: true })).rejects.toThrow("geometry");
    m.failAfter = 1; await expect(applyReviewed({ expectedOrgId: 7, draft: draft(), target: "new_project", consentToApply: true })).rejects.toThrow("Injected"); expect(db.data).toEqual(original); expect(db.writes).toHaveLength(0);
  });
  it("actual PPTX export is valid, downloads bytes without storage/published metadata and imports only a draft", async () => {
    const before = structuredClone(db.data), exported = await caller().exportPptx({ expectedOrgId: 7, projectId: 5 }); expect(exported.filename).toMatch(/\.pptx$/); const imported = await caller().importPptxDraft({ expectedOrgId: 7, filename: exported.filename, base64: exported.base64, consentToImport: true }); expect(imported.draft.slides).toHaveLength(5); expect(imported.draft.nativeProject?.lastPublishedFormat).toBe("scorm12"); expect(db.data).toEqual(before); expect(m.storage).not.toHaveBeenCalled();
  });
  it("imported media needs explicit library consent, quota and exact school; never uses caller URLs", async () => {
    const d: any = draft(); d.source = "pptx"; const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aMfoAAAAASUVORK5CYII="; d.assets = [{ id: "pptx-asset-1", filename: "new.png", mimeType: "image/png", base64: png }]; d.slides[0].contentJson = JSON.stringify({ blocks: [{ id: "image", type: "image", x: 0, y: 0, width: 100, height: 100, importedAssetId: "pptx-asset-1", src: "" }] });
    const input = { expectedOrgId: 7, draft: d, target: "new_project" as const, consentToApply: true as const };
    await expect(applyReviewed(input)).rejects.toThrow("explicit consent"); expect(m.storage).not.toHaveBeenCalled(); m.quota.mockResolvedValueOnce({ usedBytes: 100, maxBytes: 100 }); await expect(applyReviewed({ ...input, saveImportedMedia: true })).rejects.toThrow("allowance"); expect(db.writes).toHaveLength(0);
    const result = await applyReviewed({ ...input, saveImportedMedia: true }); expect(m.storage.mock.calls[0][0]).toMatch(/^org-7\/media\/creator-imports\//); expect(m.storage.mock.calls[0][1]).toEqual(Buffer.from(png, "base64")); expect(db.rows(tables.orgMediaLibrary)[0].orgId).toBe(7); const block = JSON.parse(db.rows(tables.authoringSlides).find(s => s.id === result.slideIds[0]).contentJson).blocks[0]; expect(block.mediaId).toBe(db.rows(tables.orgMediaLibrary)[0].id); expect(block.src).toBe("https://owned.invalid/new.png");
  });
  it("rejects foreign media IDs and unsafe source URL before fetching bytes or any new records", async () => {
    db.seed(tables.orgMediaLibrary, [{ id: 88, orgId: 8, mimeType: "image/png", fileKey: "other", url: "https://other.invalid/p.png", fileSize: 10 }]); const d = draft(); d.slides[0].contentJson = JSON.stringify({ blocks: [{ id: "image", type: "image", x: 0, y: 0, width: 100, height: 100, mediaId: 88, src: "https://caller.invalid/not-authority" }] }); await expect(applyReviewed({ expectedOrgId: 7, draft: d, target: "new_project", consentToApply: true })).rejects.toMatchObject({ code: "FORBIDDEN" }); expect(m.storageGet).not.toHaveBeenCalled(); expect(db.writes).toHaveLength(0);
  });
  it("rechecks school after generation and prevents stale response acceptance", async () => { m.provider.mockImplementationOnce(async () => { m.orgId = 8; return JSON.stringify(response()); }); await expect(caller().generateAiDraft(request())).rejects.toMatchObject({ code: "CONFLICT" }); expect(db.writes).toHaveLength(0); });
});

describe("Exact server preview-before-apply acceptance", () => {
  it("rejects absent/unissued preview ticket and edited payload even with apply consent, with no writes", async () => {
    const input = { expectedOrgId: 7, draft: draft(), target: "new_project" as const, consentToApply: true as const };
    await expect(caller().applyExchangeDraft(input as any)).rejects.toThrow();
    await expect(caller().applyExchangeDraft({ ...input, reviewToken: "00000000-0000-4000-8000-000000000001" })).rejects.toMatchObject({ code: "CONFLICT" });
    const preview = await caller().previewExchangeDraft({ expectedOrgId: 7, draft: input.draft });
    await expect(caller().applyExchangeDraft({ ...input, draft: { ...input.draft, title: "Edited after preview" }, reviewToken: preview.reviewToken })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(db.writes).toHaveLength(0);
  });
  it("single-use review prevents double apply while failed transaction keeps exact review retryable", async () => {
    const input = { expectedOrgId: 7, draft: draft(), target: "new_project" as const, consentToApply: true as const };
    const preview = await caller().previewExchangeDraft({ expectedOrgId: 7, draft: input.draft });
    m.failAfter = 1; await expect(caller().applyExchangeDraft({ ...input, reviewToken: preview.reviewToken })).rejects.toThrow("Injected"); expect(db.writes).toHaveLength(0);
    m.failAfter = 0; const result = await caller().applyExchangeDraft({ ...input, reviewToken: preview.reviewToken }); expect(result.status).toBe("draft");
    const writes = db.writes.length; await expect(caller().applyExchangeDraft({ ...input, reviewToken: preview.reviewToken })).rejects.toMatchObject({ code: "CONFLICT" }); expect(db.writes.length).toBe(writes);
  });
});
