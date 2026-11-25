import { beforeEach, describe, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ scope: vi.fn() }));
vi.mock("./lib/funnel360Scope", () => ({ requireFunnel360School: api.scope }));
import { funnel360NativeRouter } from "./routers/funnel360NativeRouter";
const ctx: any = { user: { id: 9, role: "org_admin" }, req: {}, res: {} };
function dbFor(rows: any[][]) {
  const queue = [...rows];
  const insert = vi.fn().mockResolvedValue([{ insertId: 84 }]);
  const update = vi.fn().mockResolvedValue(undefined);
  const locked = vi.fn();
  const db: any = {
    select: vi.fn(() => ({ from: () => {
      const chain: any = { where: () => chain, limit: () => chain, for: (kind: string) => { locked(kind); return chain; }, then: (ok: any, fail: any) => Promise.resolve(queue.shift() || []).then(ok, fail) };
      return chain;
    } })),
    insert: vi.fn(() => ({ values: insert })), update: vi.fn(() => ({ set: (patch: any) => ({ where: () => update(patch) }) })),
    transaction: vi.fn((work: any) => work(db)),
  };
  return { db, insert, update, locked };
}
const step = { id: 11, funnelId: 5, name: "Offer", slug: "offer", stepType: "landing", pageId: null };
const funnel = { id: 5, orgId: 7, name: "Saved funnel", slug: "funnel" };
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("fetch", () => { throw new Error("Network forbidden"); }); });
function setup(rows: any[][]) {
  const mocks = dbFor(rows);
  api.scope.mockResolvedValue({ db: mocks.db, orgId: 7, baseUrl: "https://school.course360.app" });
  return mocks;
}
describe("native funnel full visual editor integration", () => {
  it("creates and atomically links only an unpublished page for a verified school step", async () => {
    const mocks = setup([[step], [funnel], [step], [funnel]]);
    expect(await funnel360NativeRouter.createCaller(ctx).ensureStepPage({ stepId: 11 })).toEqual({ pageId: 84, funnelId: 5, orgId: 7 });
    expect(mocks.locked).toHaveBeenCalledWith("update");
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ orgId: 7, title: "Offer", blocksJson: "[]", isPublished: false }));
    expect(mocks.update).toHaveBeenCalledWith({ pageId: 84 });
  });
  it("preserves an existing saved page and its link rather than creating a replacement", async () => {
    const linked = { ...step, pageId: 23 };
    const mocks = setup([[linked], [funnel], [linked], [funnel], [{ id: 23 }]]);
    expect(await funnel360NativeRouter.createCaller(ctx).ensureStepPage({ stepId: 11 })).toEqual({ pageId: 23, funnelId: 5, orgId: 7 });
    expect(mocks.insert).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("does not relink or overwrite an unavailable or foreign linked page", async () => {
    const linked = { ...step, pageId: 23 };
    const mocks = setup([[linked], [funnel], [linked], [funnel], []]);
    await expect(funnel360NativeRouter.createCaller(ctx).ensureStepPage({ stepId: 11 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.insert).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("rejects a foreign funnel before a page read, insert, or transaction", async () => {
    const mocks = setup([[step], []]);
    await expect(funnel360NativeRouter.createCaller(ctx).ensureStepPage({ stepId: 11 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.db.transaction).not.toHaveBeenCalled(); expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("rejects an active-school change between the initial and advanced gate", async () => {
    const mocks = setup([]);
    api.scope.mockResolvedValueOnce({ db: mocks.db, orgId: 7 }).mockResolvedValueOnce({ db: mocks.db, orgId: 8 });
    await expect(funnel360NativeRouter.createCaller(ctx).ensureStepPage({ stepId: 11 })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mocks.db.select).not.toHaveBeenCalled();
  });
  it("returns verified step/funnel/school origin together with preserved saved blocks", async () => {
    const page = { id: 23, orgId: 7, blocksJson: '[{"id":"saved","type":"text_block","visible":true,"data":{"text":"Preserved"}}]' };
    setup([[{ ...step, pageId: 23 }], [funnel], [page], [funnel]]);
    const result = await funnel360NativeRouter.createCaller(ctx).getStepPage({ stepId: 11 });
    expect(result).toMatchObject({ page, orgId: 7, funnel, baseUrl: "https://school.course360.app" });
  });
});
