import { beforeEach, describe, expect, it, vi } from "vitest";
import { funnelAiRouter } from "./routers/funnelAiRouter";
import { funnel360NativeRouter } from "./routers/funnel360NativeRouter";
import { funnel360PublicRouter } from "./routers/funnel360PublicRouter";
import { requireFunnel360School, funnel360SchoolOrigin, assertFunnel360Destination } from "./lib/funnel360Scope";
const api = vi.hoisted(() => ({ resolve: vi.fn(), admin: vi.fn(), db: vi.fn(), generate: vi.fn(), save: vi.fn(), publicScope: vi.fn() }));
vi.mock("./db", () => ({ getDb: api.db, getOrgIdForUserWithFallback: api.resolve, requireOrgAdmin: api.admin }));
vi.mock("./lib/funnelAiGeneration", () => ({ generateFunnelAiDraft: api.generate }));
vi.mock("./lib/funnelAiDraftStore", () => ({ createReviewedFunnelAiDraft: api.save, funnel360InsertedId: (rows: any) => rows[0].insertId }));
vi.mock("./lib/publicOrgRequestScope", () => ({ resolvePublicOrganizationScope: api.publicScope }));
const ctx: any = { user: { id: 9, role: "org_admin" }, req: { headers: {}, hostname: "school.course360.app" }, res: {} };
const generateInput = { mode: "landing" as const, name: "Offer", prompt: "Describe the offer", pageTypes: ["landing" as const], ctaUrl: "/courses" };
function makeDb(rows: any[][]) {
  const queue = [...rows];
  return {
    select: vi.fn(() => ({ from: vi.fn(() => {
      const chain: any = { where: vi.fn(() => chain), limit: vi.fn(async () => queue.shift() || []), orderBy: vi.fn(async () => queue.shift() || []) };
      chain.then = (resolve: any, reject: any) => Promise.resolve(queue.shift() || []).then(resolve, reject);
      return chain;
    }) })), insert: vi.fn(() => ({ values: vi.fn(() => ({ onDuplicateKeyUpdate: vi.fn(async () => undefined) })) })),
    delete: vi.fn(), update: vi.fn(), transaction: vi.fn(),
  };
}
beforeEach(() => {
  vi.clearAllMocks(); api.resolve.mockResolvedValue(7); api.admin.mockResolvedValue(7);
  api.db.mockResolvedValue(makeDb([[{ id: 7, slug: "school", name: "School", isActive: true }], [{ plan: "pro", status: "active" }]]));
  api.generate.mockResolvedValue({ ...generateInput, pages: [] });
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network forbidden"); }));
});
describe("Course360 funnel scope enforcement", () => {
  it("resolves active school server-side and validates membership of that school", async () => {
    const scope = await requireFunnel360School(ctx, true);
    expect(scope.orgId).toBe(7); expect(scope.baseUrl).toBe("https://school.course360.app");
    expect(api.resolve).toHaveBeenCalledWith(9, "org_admin"); expect(api.admin).toHaveBeenCalledWith(9, "org_admin", 7);
  });
  it.each([["builder", "active"], ["pro", "past_due"], ["enterprise", "cancelled"]])("rejects advanced generation for %s/%s before AI", async (plan, status) => {
    api.db.mockResolvedValue(makeDb([[{ id: 7, slug: "school" }], [{ plan, status }]]));
    await expect(funnelAiRouter.createCaller(ctx).generateAiDraft(generateInput)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(api.generate).not.toHaveBeenCalled();
  });
  it("does not permit platform roles to bypass school Pro entitlement", async () => {
    api.db.mockResolvedValue(makeDb([[{ id: 7, slug: "school" }], [{ plan: "free", status: "active" }]]));
    await expect(funnelAiRouter.createCaller({ ...ctx, user: { ...ctx.user, role: "site_owner" } }).generateAiDraft(generateInput)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("rejects absent school or non-admin membership", async () => {
    api.resolve.mockResolvedValueOnce(null);
    await expect(requireFunnel360School(ctx)).rejects.toMatchObject({ code: "FORBIDDEN" });
    api.admin.mockRejectedValueOnce(new Error("No membership"));
    await expect(requireFunnel360School(ctx)).rejects.toThrow("No membership");
  });
  it("rejects unauthenticated AI requests and injected client school IDs", async () => {
    await expect(funnelAiRouter.createCaller({ ...ctx, user: null }).generateAiDraft(generateInput)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(funnelAiRouter.createCaller(ctx).generateAiDraft({ ...generateInput, orgId: 8 } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(api.generate).not.toHaveBeenCalled();
  });
  it("blocks save when browser draft belongs to previously active school", async () => {
    const draft = { mode: "landing", name: "Offer", description: "", ctaUrl: "", pages: [{ pageType: "landing", title: "Title", seoTitle: "Title", seoDescription: "Summary", seoKeywords: "", sections: ["hero", "text", "cta"].map(kind => ({ kind, headline: "Heading", body: "Copy", items: [], questions: [], buttonText: "Continue" })) }] };
    await expect(funnelAiRouter.createCaller(ctx).createFromAiDraft({ requestId: "00000000-0000-4000-8000-000000000001", draft: draft as any, expectedOrgId: 8 })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(api.save).not.toHaveBeenCalled();
  });
  it("blocks cross-school CTA destination before AI", async () => {
    await expect(funnelAiRouter.createCaller(ctx).generateAiDraft({ ...generateInput, ctaUrl: "https://other.course360.app/offer" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(api.generate).not.toHaveBeenCalled();
  });
  it("rejects simultaneous duplicate generation and returns school binding", async () => {
    let finish!: (draft: any) => void;
    api.generate.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    api.db.mockImplementation(async () => makeDb([[{ id: 7, slug: "school" }], [{ plan: "pro", status: "active" }]]));
    const first = funnelAiRouter.createCaller(ctx).generateAiDraft(generateInput);
    await vi.waitFor(() => expect(api.generate).toHaveBeenCalledOnce());
    await expect(funnelAiRouter.createCaller(ctx).generateAiDraft(generateInput)).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    finish({ pages: [] }); expect((await first).orgId).toBe(7);
  });
  it("binds existing native CRUD IDs to the active school before mutation", async () => {
    const db = makeDb([[{ id: 7, slug: "school" }], []]); api.db.mockResolvedValue(db);
    await expect(funnel360NativeRouter.createCaller(ctx).delete({ id: 88 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.delete).not.toHaveBeenCalled(); expect(db.transaction).not.toHaveBeenCalled();
  });
  it("rejects public global-primary fallback and never exposes unpublished content", async () => {
    api.publicScope.mockResolvedValueOnce({ id: 7, source: "platform" });
    await expect(funnel360PublicRouter.createCaller(ctx).getPage({ funnelSlug: "offer", pageSlug: "first" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    api.publicScope.mockResolvedValueOnce({ id: 7, source: "course360_subdomain" });
    api.db.mockResolvedValueOnce(makeDb([[{ id: 7, slug: "school" }], []]));
    await expect(funnel360PublicRouter.createCaller(ctx).getPage({ funnelSlug: "unpublished", pageSlug: "first" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("uses verified safe school custom domains only and never global platform origins", () => {
    expect(funnel360SchoolOrigin({ slug: "school", customDomain: "https://learn.school.test", domainVerificationStatus: "verified" })).toBe("https://learn.school.test");
    expect(funnel360SchoolOrigin({ slug: "school", customDomain: "other.test", domainVerificationStatus: "pending" })).toBe("https://school.course360.app");
    expect(funnel360SchoolOrigin({ slug: "school", customDomain: "https://learn.school.test/path", domainVerificationStatus: "verified" })).toBe("https://school.course360.app");
    expect(() => funnel360SchoolOrigin({ slug: "app" })).toThrow();
    expect(() => assertFunnel360Destination("//other.test", "https://school.course360.app")).toThrow();
  });
});
