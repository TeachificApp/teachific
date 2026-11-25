// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act, useCallback, useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { fireEvent } from "@testing-library/react";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { Course360AiStructureControls } from "../client/src/components/Course360AiStructureControls";
import { Course360IntegratedSources, Course360IntegratedDraftReview, useCourse360IntegratedSources, course360IntegratedSourceInput, requireCourse360IntegratedReview } from "../client/src/components/Course360AiIntegratedReview";
import { requireLandingDraftBlocks, landingAiErrorMessage } from "../client/src/lib/landingAiDraft";
const { toast } = vi.hoisted(() => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("sonner", () => ({ toast }));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
let captured: Record<string, any>;
let mutations: Record<string, any>;
let orgId = 17;
let fetchMock: any;
const paths = ["client/src/pages/lms/CourseBuilderPage.tsx", "client/src/pages/admin/LMSAdmin.tsx"];
const fullHtml = `<p>${Array.from({ length: 1500 }, (_, i) => `word${i}`).join(" ")}</p>`;
const draft = () => ({ title: "Reviewed course", sections: [{ title: "Module", lessons: [{ title: "Lesson", content: fullHtml, quiz: null }] }], courseQuiz: null });
function native(tag: string) { return ({ children, onValueChange, onOpenChange, ...props }: any) => React.createElement(tag, { ...props, ...(onValueChange ? { onChange: (e: any) => onValueChange(e.target.value) } : {}) }, children); }
function component(path: string, name: string) {
  const source = readFileSync(path, "utf8");
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf("\nfunction ", start + 10);
  const code = ts.transpileModule(source.slice(start, end === -1 ? undefined : end), { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: "owned-dialog.tsx" }).outputText;
  const deps: any = { React, useState, useEffect, useRef, useCallback, toast, useOrgScope: () => ({ orgId }), trpc: { lmsAdmin: new Proxy({}, { get: (_, key: string) => ({ useMutation: (options: any) => { captured[key] = options; return mutations[key]; } }) }) }, Course360AiStructureControls, Course360IntegratedSources, Course360IntegratedDraftReview, useCourse360IntegratedSources, course360IntegratedSourceInput, requireCourse360IntegratedReview };
  for (const name of ["Dialog", "DialogContent", "DialogHeader", "DialogFooter", "DialogTitle", "DialogDescription", "SelectContent", "SelectTrigger", "SelectValue", "Badge"]) deps[name] = native("div");
  deps.Button = native("button"); deps.Input = native("input"); deps.Textarea = native("textarea"); deps.Label = native("label"); deps.Select = native("div"); deps.SelectItem = native("span");
  for (const name of ["Sparkles", "Loader2", "Eye", "CheckCircle", "ImageIcon"]) deps[name] = () => null;
  return new Function(...Object.keys(deps), `${code}\nreturn ${name};`)(...Object.values(deps));
}
function render(Component: any, props: any) {
  const container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  act(() => root!.render(React.createElement(Component, props))); return container;
}
function button(container: HTMLElement, text: string) { const result = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(b => b.textContent?.includes(text)); if (!result) throw new Error(`Button not found: ${text}`); return result; }
async function flush(run?: () => void) { await act(async () => { run?.(); await Promise.resolve(); await Promise.resolve(); }); }
beforeEach(() => {
  vi.clearAllMocks(); orgId = 17; captured = {}; mutations = {};
  for (const name of ["createCourse", "aiGenerateCourse", "aiCommitCourse", "generateCourseOutline"]) mutations[name] = { isPending: false, mutate: vi.fn(), mutateAsync: vi.fn(async () => ({ id: 10 })) };
  fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ sourceFile: { url: "https://files.test/source", name: "original.pptx", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" }, fileKey: "ai-generation-sources/17/8/original.pptx" }) }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { act(() => root?.unmount()); root = undefined; document.body.innerHTML = ""; vi.unstubAllGlobals(); });
describe.each(paths)("Owned quick draft dialog %s", path => {
  it("supports exact min-one/manual defaults, AI planning and source-only generation while preserving source keys", async () => {
    const c = render(component(path, "CreateCourseDialog"), { open: true, onClose: vi.fn(), onCreated: vi.fn() });
    act(() => button(c, path.includes("CourseBuilder") ? "Quick AI Draft" : "AI Generate").click());
    expect(mutations.createCourse.mutateAsync).not.toHaveBeenCalled();
    const ranges = c.querySelectorAll<HTMLInputElement>('input[type="range"]'); expect(ranges[0].min).toBe("1"); expect(ranges[0].value).toBe("5"); expect(ranges[1].value).toBe("4");
    act(() => c.querySelectorAll<HTMLInputElement>('input[type="radio"]')[1].click());
    const fileInput = c.querySelector<HTMLInputElement>('input[type="file"]')!; expect(fileInput.accept).toContain(".ppt,.pptx");
    await flush(() => fireEvent.change(fileInput, { target: { files: [new File(["mocked bytes"], "original.pptx", { type: "application/octet-stream" })] } }));
    expect(fetchMock).toHaveBeenCalledTimes(1); const form = fetchMock.mock.calls[0][1].body as FormData; expect(form.get("purpose")).toBe("course"); expect(form.get("orgId")).toBe("17");
    const generateButton = Array.from(c.querySelectorAll<HTMLButtonElement>("button")).find(b => b.textContent?.includes("Draft Preview") || b.textContent?.includes("Generate Preview"))!;
    expect(generateButton.disabled).toBe(false); act(() => generateButton.click());
    const input = mutations.aiGenerateCourse.mutate.mock.calls[0][0]; expect(input.topics).toBe(""); expect(input.structureMode).toBe("ai"); expect(input.moduleCount).toBe(5); expect(input.sourceFiles[0].storageKey).toBe("ai-generation-sources/17/8/original.pptx"); expect(input.generateQuizzes).toBe(true); expect(mutations.createCourse.mutateAsync).not.toHaveBeenCalled();
  });
  it("reviews full lesson content before creation, edits before commit, and retries the same shell after failure", async () => {
    const created = vi.fn(); const c = render(component(path, "CreateCourseDialog"), { open: true, onClose: vi.fn(), onCreated: created });
    act(() => button(c, path.includes("CourseBuilder") ? "Quick AI Draft" : "AI Generate").click());
    act(() => captured.aiGenerateCourse.onSuccess({ generated: draft() }));
    expect(mutations.createCourse.mutateAsync).not.toHaveBeenCalled();
    const html = c.querySelector<HTMLTextAreaElement>('textarea[aria-label="Module 1 lesson 1 full HTML"]')!; expect(html.value).toBe(fullHtml);
    const edited = fullHtml + "<p>Author edited content.</p>"; act(() => fireEvent.change(html, { target: { value: edited } }));
    mutations.aiCommitCourse.mutateAsync.mockRejectedValueOnce(new Error("Mock rollback")).mockResolvedValueOnce({ success: true });
    const label = path.includes("CourseBuilder") ? "Create Quick AI Draft" : "Create with AI Content";
    const applyButton = Array.from(c.querySelectorAll<HTMLButtonElement>("button")).find(b => b.textContent?.includes("Create") && b.textContent?.includes("AI"))!;
    await flush(() => applyButton.click()); expect(created).not.toHaveBeenCalled();
    await flush(() => applyButton.click()); expect(mutations.createCourse.mutateAsync).toHaveBeenCalledTimes(1); expect(mutations.aiCommitCourse.mutateAsync).toHaveBeenCalledTimes(2); expect(mutations.aiCommitCourse.mutateAsync.mock.calls[1][0].generated.sections[0].lessons[0].content).toBe(edited); expect(created).toHaveBeenCalledWith(10);
  });
});
describe("Owned curriculum preview/apply workflow", () => {
  it("retains 4/3 outline defaults and visual toggles but writes only the explicitly reviewed full draft", async () => {
    const c = render(component(paths[0], "AICourseGeneratorDialog"), { courseId: 10, courseTitle: "Saved course", initialCourseDescription: "Saved description", onClose: vi.fn(), onGenerated: vi.fn() });
    const ranges = c.querySelectorAll<HTMLInputElement>('input[type="range"]'); expect(ranges[0].min).toBe("1"); expect(ranges[0].max).toBe("6"); expect(ranges[0].value).toBe("4"); expect(ranges[1].value).toBe("3");
    act(() => c.querySelectorAll<HTMLInputElement>('input[type="radio"]')[1].click());
    act(() => button(c, "Generate Draft Preview").click());
    expect(mutations.generateCourseOutline.mutate).toHaveBeenCalledWith(expect.objectContaining({ courseId: 10, previewOnly: true, structureMode: "ai", includeAiImages: true, includeUnsplashImages: true })); expect(mutations.aiCommitCourse.mutate).not.toHaveBeenCalled();
    const preview = { courseTitle: "Reviewed course", sections: draft().sections };
    act(() => captured.generateCourseOutline.onSuccess({ preview }));
    const html = c.querySelector<HTMLTextAreaElement>('textarea[aria-label="Module 1 lesson 1 full HTML"]')!; expect(html.value).toBe(fullHtml); act(() => fireEvent.change(html, { target: { value: fullHtml + "<p>Reviewed.</p>" } }));
    act(() => button(c, "Apply Reviewed Curriculum").click());
    const input = mutations.aiCommitCourse.mutate.mock.calls[0][0]; expect(input.reviewedOutline).toBe(true); expect(input.generated.sections[0].lessons[0].content).toBe(fullHtml + "<p>Reviewed.</p>"); expect(input.includeAiImages).toBe(true);
  });
  it("keeps partial uploads, rejects over-limit bytes/count before network, and retains removal", async () => {
    let sources: ReturnType<typeof useCourse360IntegratedSources>;
    function Harness() { sources = useCourse360IntegratedSources(17); return React.createElement(Course360IntegratedSources, { sources }); }
    const c = render(Harness, {});
    await flush(() => { void sources!.upload([{ name: "oversize.pdf", size: 50 * 1024 * 1024 + 1 } as File]); });
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockRejectedValueOnce(new Error("Mock upload failed"));
    await flush(() => { void sources!.upload([new File(["x"], "a.pdf"), new File(["x"], "b.pptx")]); });
    expect(sources!.sourceFiles).toHaveLength(1); expect(c.textContent).toContain("original.pptx");
    await flush(() => { void sources!.upload([new File(["x"], "a.pdf"), new File(["x"], "b.pdf"), new File(["x"], "c.pdf")]); }); expect(fetchMock).toHaveBeenCalledTimes(2);
    act(() => c.querySelector<HTMLButtonElement>('button[aria-label="Remove original.pptx"]')!.click()); expect(sources!.sourceFiles).toHaveLength(0);
  });
  it("invalid JSON cannot apply stale content, and correcting JSON restores apply", () => {
    let value: any = draft(); function Harness() { const [d, set] = useState(value); value = d; return React.createElement(Course360IntegratedDraftReview, { draft: d, onChange: set }); }
    const c = render(Harness, {}); const field = c.querySelector<HTMLTextAreaElement>('textarea[aria-label="Complete AI draft JSON"]')!;
    act(() => { fireEvent.change(field, { target: { value: "{invalid" } }); fireEvent.blur(field); });
    expect(() => requireCourse360IntegratedReview(value, "course")).toThrow(); expect(value.sections[0].lessons[0].content).toBe(fullHtml);
    act(() => { fireEvent.change(field, { target: { value: JSON.stringify(draft()) } }); fireEvent.blur(field); });
    expect(() => requireCourse360IntegratedReview(value, "course")).not.toThrow();
  });
});
describe.each(paths)("Landing draft producer safe validation %s", path => {
  it("rejects invalid AI results without touching an existing local draft; valid results remain review-only", () => {
    const source = readFileSync(path, "utf8"); const a = source.indexOf("  const aiGenerateLandingPage ="); const b = source.indexOf("\n  });", a) + 6;
    let options: any; const navigate = vi.fn(); const timeout = vi.fn(); const localStorageMock = { setItem: vi.fn() };
    new Function("trpc", "courseId", "requireLandingDraftBlocks", "landingAiErrorMessage", "sessionStorage", "toast", "navigate", "setTimeout", source.slice(a, b))({ lmsAdmin: { aiGenerateLandingPage: { useMutation: (o: any) => { options = o; } } } }, 10, requireLandingDraftBlocks, landingAiErrorMessage, localStorageMock, toast, navigate, timeout);
    options.onSuccess({ blocks: [] }); expect(localStorageMock.setItem).not.toHaveBeenCalled(); expect(timeout).not.toHaveBeenCalled();
    const blocks = [{ id: "new-draft", type: "text", data: { html: "Author review" } }]; options.onSuccess({ blocks }); expect(localStorageMock.setItem).toHaveBeenCalledWith("landing-page-ai-draft:10", JSON.stringify(blocks)); expect(timeout).toHaveBeenCalledOnce();
    options.onError(new Error("<html>Bearer private</html>")); expect(toast.error.mock.lastCall?.[0]).not.toContain("private");
  });
});
