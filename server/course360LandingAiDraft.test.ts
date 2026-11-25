import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { consumeLandingAiDraft, landingAiErrorMessage, requireLandingDraftBlocks } from "../client/src/lib/landingAiDraft";

const draft = () => [{ id: "synthetic-hero", type: "hero", data: { headline: "Preserve exact copy", imageUrl: "https://assets.invalid/original.png", price: 49.97, orgColor: "#123456" } }];
describe("Course360 landing AI draft validation", () => {
  it("returns the original valid draft without changing content, settings, prices or image URLs", () => {
    const blocks = draft();
    expect(requireLandingDraftBlocks(blocks)).toBe(blocks);
    expect(blocks[0].data.price).toBe(49.97);
  });
  it.each([null, {}, [], "<!DOCTYPE html><html>Gateway error</html>", [{ id: "x", type: "text" }], [{ id: "x", type: "text", data: null }], [{ id: "x", type: "text", data: [] }], [{ id: "", type: "text", data: {} }], [{ id: "x", type: "", data: {} }]])("rejects unusable output instead of replacing the saved page (%j)", value => {
    expect(() => requireLandingDraftBlocks(value)).toThrow(/saved page has not changed/);
  });
  it("rejects duplicate identifiers across nested columns", () => {
    expect(() => requireLandingDraftBlocks([{ id: "column", type: "column_layout", data: { leftBlocks: draft(), rightBlocks: draft() } }])).toThrow();
  });
  it("validates every nested child, not just the top-level array", () => {
    expect(() => requireLandingDraftBlocks([{ id: "column", type: "column_layout", data: { leftBlocks: draft(), rightBlocks: [{ id: "broken" }] } }])).toThrow();
    expect(() => requireLandingDraftBlocks([{ id: "column", type: "column_layout", data: { leftBlocks: "not an array" } }])).toThrow();
  });
  it("retains valid HTML content and unknown future block types", () => {
    const blocks = [{ id: "future", type: "future_block", data: { html: "<p>Exact <strong>HTML</strong></p>" } }];
    expect(requireLandingDraftBlocks(blocks)).toBe(blocks);
  });
  it("bounds oversized and excessively nested output", () => {
    expect(() => requireLandingDraftBlocks(Array.from({ length: 501 }, (_, i) => ({ id: String(i), type: "text", data: {} })))).toThrow();
    let child: any = draft();
    for (let i = 0; i < 22; i++) child = [{ id: `c-${i}`, type: "column_layout", data: { leftBlocks: child } }];
    expect(() => requireLandingDraftBlocks(child)).toThrow();
  });
  it("consumes only the selected course's valid local draft and removes it once", () => {
    const storage = { getItem: vi.fn(() => JSON.stringify(draft())), removeItem: vi.fn() };
    expect(consumeLandingAiDraft(storage, 42)).toEqual(draft());
    expect(storage.getItem).toHaveBeenCalledWith("landing-page-ai-draft:42");
    expect(storage.removeItem).toHaveBeenCalledTimes(1); expect(storage.removeItem).toHaveBeenCalledWith("landing-page-ai-draft:42");
  });
  it.each(["<!DOCTYPE html><html>private gateway details</html>", JSON.stringify([{ id: "bad" }]), "[]"])("discards invalid local output safely (%s)", raw => {
    const storage = { getItem: vi.fn(() => raw), removeItem: vi.fn() };
    expect(() => consumeLandingAiDraft(storage, 42)).toThrow(/saved page has not changed/);
    expect(storage.removeItem).toHaveBeenCalledTimes(1); expect(storage.removeItem).toHaveBeenCalledWith("landing-page-ai-draft:42");
  });
  it("does not touch storage when no generated draft exists", () => {
    const storage = { getItem: vi.fn(() => null), removeItem: vi.fn() };
    expect(consumeLandingAiDraft(storage, 42)).toBeNull();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });
  it.each([new Error("Unexpected token '<', '<!DOCTYPE' is not valid JSON"), { message: "<html>Proxy trace secret</html>" }, "<div>Gateway trace</div>", "Bearer synthetic-secret", "sk-synthetic-secret", undefined, "x".repeat(350)])("does not leak unreadable provider bodies or credentials (%j)", error => {
    const message = landingAiErrorMessage(error);
    expect(message).toContain("saved page has not changed");
    expect(message).not.toMatch(/Proxy trace|synthetic-secret|<!DOCTYPE|Unexpected token/);
  });
  it("preserves useful safe backend errors", () => {
    expect(landingAiErrorMessage(new Error("This course does not belong to the active organization"))).toBe("This course does not belong to the active organization");
  });
});

function actualDraftInitializer(context: Record<string, unknown>) {
  const source = readFileSync(new URL("../client/src/pages/lms/LandingPageBuilder.tsx", import.meta.url), "utf8");
  const ast = ts.createSourceFile("LandingPageBuilder.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let callback: ts.Node | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === "useEffect" && node.arguments[0]?.getText(ast).includes("setCourseInfo")) callback = node.arguments[0];
    ts.forEachChild(node, visit);
  };
  visit(ast);
  if (!callback) throw new Error("Actual draft initialization effect not found");
  const code = ts.transpileModule(`return (${callback.getText(ast)});`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  return new Function(...Object.keys(context), code)(...Object.values(context)) as () => void;
}
describe("Course360 actual landing draft initialization", () => {
  it.each(["<!DOCTYPE html><html>bad response</html>", JSON.stringify([{ id: "partial" }])])("keeps exact saved blocks when a local AI draft is unreadable (%s)", raw => {
    const saved = [{ id: "saved", type: "text", data: { html: "<p>Owner copy</p>", price: 49.97, custom: "keep" } }];
    const setBlocks = vi.fn(), setAiDraftLoaded = vi.fn(), toast = { error: vi.fn() };
    const storage = { getItem: vi.fn(() => raw), removeItem: vi.fn() };
    actualDraftInitializer({ lpData: { courseTitle: "Saved course", courseSlug: "saved", blocks: saved }, hasLoaded: false,
      setHasLoaded: vi.fn(), setCourseInfo: vi.fn(), seoInitialized: { current: false }, setSeoTitle: vi.fn(), setSeoDescription: vi.fn(), setSeoImage: vi.fn(),
      consumeLandingAiDraft, landingAiErrorMessage, sessionStorage: storage, numericCourseId: 42, toast, setBlocks, setAiDraftLoaded })();
    expect(setBlocks).toHaveBeenCalledTimes(1); expect(setBlocks).toHaveBeenCalledWith(saved);
    expect(setBlocks.mock.calls[0][0]).toBe(saved);
    expect(setAiDraftLoaded).not.toHaveBeenCalled(); expect(toast.error).toHaveBeenCalledTimes(1);
  });
  it("loads complete validated output only as a local review draft, without calling any save API", () => {
    const setBlocks = vi.fn(), setAiDraftLoaded = vi.fn(), toast = { error: vi.fn() };
    actualDraftInitializer({ lpData: { courseTitle: "Saved course", courseSlug: "saved", blocks: [] }, hasLoaded: false,
      setHasLoaded: vi.fn(), setCourseInfo: vi.fn(), seoInitialized: { current: false }, setSeoTitle: vi.fn(), setSeoDescription: vi.fn(), setSeoImage: vi.fn(),
      consumeLandingAiDraft, landingAiErrorMessage, sessionStorage: { getItem: () => JSON.stringify(draft()), removeItem: vi.fn() }, numericCourseId: 42, toast, setBlocks, setAiDraftLoaded })();
    expect(setBlocks).toHaveBeenCalledWith(draft()); expect(setAiDraftLoaded).toHaveBeenCalledWith(true); expect(toast.error).not.toHaveBeenCalled();
  });
});
