import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { createReviewedFunnelAiDraft } from "./lib/funnelAiDraftStore";
import { funnelAiDraftSchema } from "../shared/funnelAi";
vi.mock("./db", () => ({ getDb: vi.fn(), getOrgIdForUserWithFallback: vi.fn(), requireOrgAdmin: vi.fn() }));
const dialect = new MySqlDialect();
function matches(condition: any, row: any) {
  if (!condition) return true;
  const { sql, params } = dialect.sqlToQuery(condition);
  const columns = [...sql.matchAll(/`[^`]+`\.`([^`]+)` = \?/g)].map(m => m[1]);
  return columns.every((column, i) => row[column] === params[i]);
}
function mockDb() {
  let data: Record<string, any[]> = {};
  let counter = 100;
  let failAt = -1;
  let calls = 0;
  const writes: { table: string; value: any }[] = [];
  const db: any = {
    select: () => ({ from: (table: any) => {
      const name = getTableName(table); let condition: any;
      const chain: any = { where: (where: any) => { condition = where; return chain; }, limit: () => chain,
        then: (resolve: any, reject: any) => Promise.resolve((data[name] || []).filter(row => matches(condition, row))).then(resolve, reject) };
      return chain;
    } }),
    insert: (table: any) => ({ values: async (value: any) => {
      calls++; if (calls === failAt) return [{ insertId: 0 }];
      const name = getTableName(table); const id = ++counter;
      if (name === "funnel360_draft_requests" && (data[name] || []).some(row => row.orgId === value.orgId && row.requestId === value.requestId)) throw { code: "ER_DUP_ENTRY" };
      const row = { id, ...value }; (data[name] ||= []).push(row); writes.push({ table: name, value });
      return [{ insertId: id }];
    } }),
    update: (table: any) => ({ set: (patch: any) => ({ where: async (condition: any) => {
      for (const row of data[getTableName(table)] || []) if (matches(condition, row)) Object.assign(row, patch);
    } }) }),
    transaction: async (task: any) => { const snapshot = structuredClone(data); try { return await task(db); } catch (error) { data = snapshot; throw error; } },
  };
  return { db, writes, rows: (name: string) => data[name] || [], fail: (call: number) => { failAt = call; } };
}
const requestId = "00000000-0000-4000-8000-000000000001";
function draft(types: string[] = ["landing", "checkout", "thank_you"]) {
  return funnelAiDraftSchema.parse({ mode: types.length === 1 ? "landing" : "funnel", name: "My offer", description: "New draft", ctaUrl: "/courses", pages: types.map(pageType => ({
    pageType, title: `New ${pageType}`, seoTitle: "Page SEO", seoDescription: "Summary", seoKeywords: "learning",
    sections: ["hero", "text", "cta"].map(kind => ({ kind, headline: "Heading", body: "Plain copy", items: [], questions: [], buttonText: "Continue" })),
  })) });
}
beforeEach(() => vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network forbidden"); })));
describe("Course360 native funnel draft transactions", () => {
  it("atomically creates school-bound unpublished pages, ordered connections and neutral checkout copy", async () => {
    const mock = mockDb(); const result = await createReviewedFunnelAiDraft(mock.db, 7, 9, requestId, draft(), "https://school.course360.app");
    expect(result.pageIds).toHaveLength(3);
    expect(mock.rows("funnels")[0]).toMatchObject({ orgId: 7, isActive: false });
    const pages = mock.rows("page_builder_pages");
    expect(pages.every(p => p.orgId === 7 && p.isPublished === false && p.pageType === "custom")).toBe(true);
    expect(mock.rows("funnel_steps").map(s => [s.sortOrder, s.stepType, s.pageId])).toEqual([[0, "landing", result.pageIds[0]], [1, "order", result.pageIds[1]], [2, "thank_you", result.pageIds[2]]]);
    const firstBlocks = JSON.parse(pages[0].blocksJson);
    expect(firstBlocks[0].data.ctaUrl).toBe(`https://school.course360.app/funnel/${result.slug}/${pages[1].slug}`);
    expect(JSON.stringify(pages)).not.toMatch(/allaboutultrasound|teachific|productId|customPrice/);
    expect(mock.rows("funnel360_page_learn_settings")[0]).toMatchObject({ orgId: 7, seoKeywords: "learning" });
    expect(mock.rows("funnel360_page_learn_settings")[0].showInLibrary).toBeUndefined();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it("replays the same persisted request without any extra inserts", async () => {
    const mock = mockDb(); const first = await createReviewedFunnelAiDraft(mock.db, 7, 9, requestId, draft(), "https://school.course360.app");
    const count = mock.writes.length;
    expect(await createReviewedFunnelAiDraft(mock.db, 7, 9, requestId, draft(), "https://school.course360.app")).toEqual(first);
    expect(mock.writes.length).toBe(count);
  });
  it("rejects changed content or another actor using the same request identity", async () => {
    const mock = mockDb(); await createReviewedFunnelAiDraft(mock.db, 7, 9, requestId, draft(), "https://school.course360.app");
    await expect(createReviewedFunnelAiDraft(mock.db, 7, 9, requestId, { ...draft(), name: "Changed" }, "https://school.course360.app")).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(createReviewedFunnelAiDraft(mock.db, 7, 8, requestId, draft(), "https://school.course360.app")).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("isolates identical request IDs across schools", async () => {
    const mock = mockDb(); const a = await createReviewedFunnelAiDraft(mock.db, 7, 9, requestId, draft(), "https://a.course360.app");
    const b = await createReviewedFunnelAiDraft(mock.db, 8, 9, requestId, draft(), "https://b.course360.app");
    expect(a.id).not.toBe(b.id); expect(a.slug).not.toBe(b.slug);
    expect(mock.rows("funnel360_draft_requests").map(row => row.orgId)).toEqual([7, 8]);
  });
  it.each([2, 3, 5, 6, 8, 9, 11])("rolls all content back when insert %s has an invalid ID", async at => {
    const mock = mockDb(); mock.fail(at);
    await expect(createReviewedFunnelAiDraft(mock.db, 7, 9, requestId, draft(), "https://school.course360.app")).rejects.toThrow();
    expect(mock.rows("funnels")).toHaveLength(0); expect(mock.rows("page_builder_pages")).toHaveLength(0); expect(mock.rows("funnel360_draft_requests")).toHaveLength(0);
  });
  it("blocks CTA destinations belonging to other schools before writes", async () => {
    const mock = mockDb(); await expect(createReviewedFunnelAiDraft(mock.db, 7, 9, requestId, { ...draft(), ctaUrl: "https://other.course360.app/courses" }, "https://school.course360.app")).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mock.writes).toHaveLength(0);
  });
});
