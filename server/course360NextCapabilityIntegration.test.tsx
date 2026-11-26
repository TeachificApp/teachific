// @vitest-environment jsdom
import React, { useEffect } from "react";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { appendCreatorOwnedImage, type CreatorImageInsertionScope } from "../client/src/lib/course360CreatorOwnedImageInsertion";
import type { CreatorDocument, CreatorBlock } from "../shared/course360CreatorModel";
const state = vi.hoisted(() => ({ role: {} as any, panelSchools: [] as number[], panelUnmounts: [] as number[], user: { id: 3, role: "user" } as any, status: vi.fn(), generate: vi.fn(), cancel: vi.fn() }));
vi.mock("@/lib/trpc", () => ({ trpc: {
  quizCreator: { getMyRole: { useQuery: () => ({ data: state.role, isLoading: false, error: null, refetch: vi.fn() }) } },
  auth: { logout: { useMutation: () => ({ mutate: vi.fn() }) } },
  authoring: Object.fromEntries([["creatorOwnedImageStatus", state.status], ["generateCreatorOwnedImage", state.generate], ["cancelCreatorOwnedImage", state.cancel]].map(([name, fn]) => [name, { useMutation: () => ({ mutateAsync: fn, isPending: false }) }])),
} }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: state.user, loading: false }) }));
vi.mock("@/components/ProductSwitcher", () => ({ ProductSwitcher: () => null }));
vi.mock("../client/src/pages/QuizCreatorPage", () => ({ default: () => <div>Retained full quiz editor</div> }));
vi.mock("@/components/Course360AppBillingRecovery", () => ({ Course360AppBillingRecovery: () => <div>Existing billing recovery boundary</div> }));
vi.mock("@/components/quiz-creator/Course360NativeQuizReviewPanel", () => ({ Course360NativeQuizReviewPanel: ({ orgId }: { orgId: number }) => { useEffect(() => { state.panelSchools.push(orgId); return () => { state.panelUnmounts.push(orgId); }; }, []); return <button>Review for school {orgId}</button>; } }));
import QuizCreatorDashboard from "../client/src/pages/QuizCreatorDashboard";
import { CreatorOwnedImageControls } from "../client/src/components/creator/CreatorOwnedImageControls";
const key = "org-7/media/creator-images/00000000-0000-4000-8000-000000000000.png";
const image = { orgId: 7, mediaId: 22, url: `/manus-storage/${key}`, key, mimeType: "image/png" as const, fileSize: 100, width: 800, height: 600, alt: "Actual saved image" };
const scope: CreatorImageInsertionScope = { orgId: 7, projectId: 11, slideId: 19, loadedProjectOrgId: 7 };
const document = (): CreatorDocument => ({ legacy: { preserve: true }, blocks: [{ id: "old", type: "text", x: 0, y: 0, width: 10, height: 10, content: "Retained", style: {} }] } as CreatorDocument);
const factory = (): CreatorBlock => ({ id: "new-image", type: "image", x: 0, y: 0, width: 1, height: 1, src: "", style: {} });
function mountSource(name: string): string {
  const path = "client/src/pages/CreatorEditorPage.tsx", text = readFileSync(path, "utf8"), tree = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  function visit(node: ts.Node) { if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(tree) === name) found.push(node.getText(tree)); ts.forEachChild(node, visit); }
  visit(tree); expect(found).toHaveLength(1); return found[0];
}
function editorMount(name: string, current = { ...scope }) {
  const setSlideContent = vi.fn(), save = vi.fn().mockResolvedValue(undefined), latest = { current }, dirty = { current: false };
  const output = ts.transpileModule(`const mount=(${mountSource(name)});`, { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React }, fileName: "actual-editor-mount.tsx" }).outputText;
  const props = new Function("React", name, "orgId", "projectId", "activeSlideId", "imageInsertionScope", "latestImageInsertionScope", "slideContent", "newBlock", "appendCreatorOwnedImage", "setSlideContent", "dirtyRef", "CANVAS_W", "CANVAS_H", "saveCurrentSlide", `${output}\nreturn mount.props;`)(React, () => null, 7, 11, 19, scope, latest, document(), factory, appendCreatorOwnedImage, setSlideContent, dirty, 1000, 563, save);
  return { props, setSlideContent, save, latest, dirty };
}
beforeEach(() => { vi.clearAllMocks(); state.role = { orgId: 7, role: "web", isActive: true, isPaid: true }; state.user = { id: 3, role: "user" }; state.panelSchools = []; state.panelUnmounts = []; state.generate.mockResolvedValue(image); state.status.mockResolvedValue({ orgId: 7, available: true, reason: "Configured, not live certified" }); });
afterEach(cleanup);
describe("scope-safe generated image document insertion", () => {
  it("retains original extension fields/block objects and only appends a fresh owned image", () => {
    const previous = document(); const next = appendCreatorOwnedImage(previous, image, scope, scope, factory, { width: 1000, height: 563 });
    expect(next).not.toBe(previous); expect(next.legacy).toBe(previous.legacy); expect(next.blocks[0]).toBe(previous.blocks[0]); expect(previous.blocks).toHaveLength(1); expect(next.blocks[1]).toMatchObject({ id: "new-image", mediaId: 22, src: image.url, alt: image.alt });
    expect(next.blocks[1].width / next.blocks[1].height).toBeCloseTo(800 / 600); expect(next.blocks[1].y).toBeGreaterThanOrEqual(0);
  });
  it.each([{ orgId: 8 }, { projectId: 12 }, { slideId: 20 }, { loadedProjectOrgId: 8 }])("rejects changed source scope %j without altering old content", delta => {
    const previous = document(); expect(() => appendCreatorOwnedImage(previous, image, scope, { ...scope, ...delta }, factory, { width: 1000, height: 563 })).toThrow(/changed/); expect(previous.blocks).toHaveLength(1);
  });
  it("rejects foreign media and a replacement block identifier", () => {
    expect(() => appendCreatorOwnedImage(document(), { ...image, orgId: 8 }, scope, scope, factory, { width: 1000, height: 563 })).toThrow();
    expect(() => appendCreatorOwnedImage(document(), image, scope, scope, () => ({ ...factory(), id: "old" }), { width: 1000, height: 563 })).toThrow(/fresh/);
  });
});
describe("actual Creator editor mount callbacks", () => {
  it("binds exact school/project/slide and appends against latest draft rather than replacing it", () => {
    const view = editorMount("CreatorOwnedImageControls"); expect(view.props).toMatchObject({ orgId: 7, projectId: 11, scopeKey: 19 }); view.props.onGenerated(image);
    const previous = document(); previous.blocks.push({ ...previous.blocks[0], id: "concurrent-old" });
    const next = view.setSlideContent.mock.calls[0][0](previous); expect(next.blocks.map((b: CreatorBlock) => b.id)).toEqual(["old", "concurrent-old", "new-image"]); expect(view.dirty.current).toBe(true);
  });
  it("rejects a stale callback before scheduling any insertion", () => { const view = editorMount("CreatorOwnedImageControls", { ...scope, orgId: 8 }); expect(() => view.props.onGenerated(image)).toThrow(); expect(view.setSlideContent).not.toHaveBeenCalled(); });
  it("retains previous state if the slide changes before React applies the updater", () => { const view = editorMount("CreatorOwnedImageControls"); view.props.onGenerated(image); view.latest.current = { ...scope, slideId: 20 }; const previous = document(); expect(view.setSlideContent.mock.calls[0][0](previous)).toBe(previous); });
  it("publishing uses the existing actual current-save callback with exact slide", async () => { const view = editorMount("CreatorSchoolPublishControls"); expect(view.props).toMatchObject({ projectId: 11, expectedOrgId: 7 }); await view.props.beforePublish(); expect(view.save).toHaveBeenCalledWith(19, false); });
  it("publishing cannot proceed while the existing current save is still pending", async () => {
    const view = editorMount("CreatorSchoolPublishControls"); let finish!: () => void; let completed = false;
    view.save.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
    const pending = view.props.beforePublish().then(() => { completed = true; });
    await Promise.resolve(); expect(view.save).toHaveBeenCalledWith(19, false); expect(completed).toBe(false);
    finish(); await pending; expect(completed).toBe(true);
  });
  it("publishing refuses a stale loaded project or slide before any save", async () => { const view = editorMount("CreatorSchoolPublishControls", { ...scope, loadedProjectOrgId: 8 }); await expect(view.props.beforePublish()).rejects.toThrow(/changed/); expect(view.save).not.toHaveBeenCalled(); });
  it("a rejected existing save prevents the publishing precondition from succeeding", async () => { const view = editorMount("CreatorSchoolPublishControls"); view.save.mockRejectedValue(new Error("save conflict")); await expect(view.props.beforePublish()).rejects.toThrow("save conflict"); });
});
describe("actual Quiz Creator dashboard review integration", () => {
  it("retains the full editor and passes only the server-resolved active school to review", () => { const view = render(<QuizCreatorDashboard />); expect(view.getByText("Retained full quiz editor")).toBeTruthy(); expect(state.panelSchools).toEqual([7]); });
  it("remounts review state on exact server school change", () => { const view = render(<QuizCreatorDashboard />); state.role = { ...state.role, orgId: 8 }; view.rerender(<QuizCreatorDashboard />); expect(state.panelUnmounts).toContain(7); expect(state.panelSchools).toEqual([7, 8]); });
  it.each([{ isActive: false }, { role: "desktop" }, { orgId: null }, { orgId: 0 }, { orgId: -1 }, { orgId: "7" }, { orgId: 1.5 }])("does not expose review for missing current web scope %j", delta => { state.user.role = "site_owner"; state.role = { ...state.role, ...delta }; render(<QuizCreatorDashboard />); expect(state.panelSchools).toEqual([]); });
});
describe("real Creator dashboard library-only image control", () => {
  it("makes no requests on mount and saves only a new library image without an invented block destination", async () => {
    const view = render(<CreatorOwnedImageControls orgId={7} />); expect(state.generate).not.toHaveBeenCalled(); expect(state.status).not.toHaveBeenCalled();
    fireEvent.click(view.getByRole("button", { name: "Generate owned image" })); fireEvent.change(view.getByLabelText("Creator image prompt"), { target: { value: "A diagram" } }); fireEvent.click(view.getByLabelText("Consent to Creator image generation")); fireEvent.click(view.getByLabelText("Consent to new main-library image save")); fireEvent.click(view.getByRole("button", { name: "Generate & save NEW image" }));
    await waitFor(() => expect(view.getByAltText(image.alt)).toBeTruthy()); expect(view.queryByRole("button", { name: "Insert NEW image block" })).toBeNull(); expect(view.getByRole("button", { name: "Keep in library without inserting" })).toBeTruthy();
    expect(state.generate.mock.calls[0][0]).toMatchObject({ expectedOrgId: 7, consentToGenerate: true, consentToSaveToMainLibrary: true });
  });
});
