import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { generateFunnelAiDraft } from "./lib/funnelAiGeneration";
import { buildFunnelAiBlocks, funnelAiDraftSchema, funnelAiGenerateInputSchema } from "../shared/funnelAi";
const ai = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("./_core/llm", () => ({ invokeLLM: ai.invoke }));
function copy(title = "School offer") { return { title, seoTitle: title, seoDescription: "Factual summary", seoKeywords: "learning", sections: [
  { kind: "hero", headline: "Explore", body: "Learn at your pace", items: [], questions: [], buttonText: "Explore" },
  { kind: "bullets", headline: "Topics", body: "", items: ["Foundations"], questions: [], buttonText: "" },
  { kind: "faq", headline: "Questions", body: "", items: [], questions: [{ q: "Who is it for?", a: "Interested learners" }], buttonText: "" },
  { kind: "cta", headline: "Next steps", body: "Review the offer", items: [], questions: [], buttonText: "Continue" },
] }; }
const input = (types: any[] = ["landing"]) => funnelAiGenerateInputSchema.parse({ mode: types.length === 1 ? "landing" : "funnel", name: "School offer", prompt: "Describe the learning offer", ctaUrl: "/courses", pageTypes: types });
const response = (value: any, finish_reason = "stop") => ({ choices: [{ finish_reason, message: { content: typeof value === "string" ? value : JSON.stringify(value) } }] });
beforeEach(() => { ai.invoke.mockReset(); vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network forbidden"); })); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe("Course360 funnel AI complete-copy contract", () => {
  it("generates requested ordered steps with one bounded call each and no model-controlled destinations", async () => {
    ai.invoke.mockImplementation(async ({ messages }: any) => response(copy(messages[0].content.includes("Step 1") ? "First" : "Later")));
    const draft = await generateFunnelAiDraft(input(["landing", "checkout", "thank_you"]));
    expect(draft.pages.map(p => p.pageType)).toEqual(["landing", "checkout", "thank_you"]);
    expect(ai.invoke).toHaveBeenCalledTimes(3);
    for (const [params] of ai.invoke.mock.calls) { expect(params.maxTokens).toBe(3500); expect(JSON.parse(params.messages[1].content).source.ctaUrl).toBeUndefined(); }
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it.each(["length", "content_filter", "tool_calls"])("rejects %s completions without partial drafts", async reason => {
    ai.invoke.mockResolvedValue(response(copy(), reason)); await expect(generateFunnelAiDraft(input())).rejects.toThrow();
  });
  it.each(["", "not json", "```json\n{}\n```", "{}"])("rejects empty or malformed response %s", async text => {
    ai.invoke.mockResolvedValue(response(text)); await expect(generateFunnelAiDraft(input())).rejects.toThrow();
  });
  it("rejects model HTML and unexpected executable properties", async () => {
    ai.invoke.mockResolvedValueOnce(response({ ...copy(), title: "<script>alert(1)</script>" }));
    await expect(generateFunnelAiDraft(input())).rejects.toThrow("invalid or incomplete");
    ai.invoke.mockResolvedValueOnce(response({ ...copy(), productId: 77 }));
    await expect(generateFunnelAiDraft(input())).rejects.toThrow();
  });
  it("maps plain edited copy into real native blocks, never HTML or checkout widgets", () => {
    const page = { ...copy("<b>Literal title</b>"), pageType: "landing" as const };
    const blocks = buildFunnelAiBlocks(page as any, "safe", "/courses");
    expect(blocks.map(b => b.type)).toEqual(["banner", "checklist", "faq", "cta"]);
    expect(blocks[1].data.items[0].text).toBe("Foundations");
    expect(blocks[2].data.items[0].question).toBe("Who is it for?");
    expect(blocks[0].data.ctaUrl).toBe("/courses");
    expect(JSON.stringify(blocks)).not.toMatch(/productId|price|embedCode|html/);
  });
  it("bounds modes and ordered step count", () => {
    expect(() => input(["landing", "custom", "custom", "custom", "custom", "custom"])).toThrow();
    expect(() => input(["checkout", "thank_you"])).toThrow();
    expect(funnelAiDraftSchema.safeParse({ mode: "landing", name: "x", description: "", ctaUrl: "javascript:alert(1)", pages: [{ ...copy(), pageType: "landing" }] }).success).toBe(false);
  });
  it("uses global concurrency two across simultaneous generation requests", async () => {
    let active = 0, peak = 0;
    ai.invoke.mockImplementation(async () => { active++; peak = Math.max(peak, active); await new Promise(resolve => setTimeout(resolve, 5)); active--; return response(copy()); });
    await Promise.all([generateFunnelAiDraft(input(["landing", "custom", "thank_you"])), generateFunnelAiDraft(input(["landing", "custom"]))]);
    expect(peak).toBe(2);
  });
  it("returns on the application deadline while discarding late provider responses", async () => {
    vi.useFakeTimers(); let finish!: (value: any) => void;
    ai.invoke.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const work = generateFunnelAiDraft(input());
    const assertion = expect(work).rejects.toThrow("deadline");
    await vi.advanceTimersByTimeAsync(120001); await assertion;
    finish(response(copy())); await Promise.resolve();
  });
});
