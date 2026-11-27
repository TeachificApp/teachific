// @vitest-environment jsdom
/** Offline rendered coverage: no providers, database, auth, or network clients. */
import React, { createRef, useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";

const fixture = vi.hoisted(() => ({
  lessonMutation: vi.fn(), pageMutation: vi.fn(), unexpectedMutation: vi.fn(),
  markDirty: vi.fn(), markClean: vi.fn(), settingsMounts: vi.fn(), settingsUnmounts: vi.fn(),
  landing: {} as any,
}));

vi.mock("@/lib/trpc", () => {
  const query = (getData: () => any = () => []) => ({ useQuery: () => ({ data: getData(), isLoading: false, refetch: vi.fn() }) });
  const mutation = (fn = fixture.unexpectedMutation) => ({ useMutation: (options?: any) => ({
    isPending: false,
    mutateAsync: async (input: any) => { const result = await fn(input); options?.onSuccess?.(result); return result; },
    mutate: (input: any) => { fn(input); },
  }) });
  const invalidation = { invalidate: vi.fn() };
  return { trpc: {
    useUtils: () => ({ blockTemplates: { list: invalidation }, lmsAdmin: { getLandingPageBlocks: invalidation, listPageTemplates: invalidation } }),
    pageScraper: { scrapeUrl: mutation() },
    lmsAdmin: {
      updateLesson: mutation(fixture.lessonMutation), saveLessonTemplate: mutation(),
      listCourses: query(() => ({ courses: [] })), getLessonsWithBlocks: query(), listLessonTemplates: query(), applyLessonTemplate: mutation(),
      getLandingPageBlocks: query(() => fixture.landing), saveLandingPageBlocks: mutation(fixture.pageMutation), saveLandingPageSeo: mutation(),
      getCoursesWithLandingBlocks: query(), listPageTemplates: query(), savePageTemplate: mutation(), deletePageTemplate: mutation(),
    },
    blockTemplates: { list: query(), save: mutation(), delete: mutation() },
    funnelAdmin: { getFunnelsWithPages: query() },
    auth: { uploadPageMedia: mutation() },
    funnel: { listAllProducts: query(), list: query() },
    orderBumpsAdmin: { list: query() },
  } };
});
vi.mock("@/hooks/useOrgScope", () => ({ useOrgScope: () => ({ orgId: 11 }) }));
vi.mock("@/hooks/useSubdomain", () => ({ getSubdomain: () => null }));
vi.mock("@/hooks/useAutoSave", () => ({ useAutoSave: () => ({ isDirty: false, status: "saved", markDirty: fixture.markDirty, markClean: fixture.markClean }) }));
vi.mock("@/components/AutoSaveIndicator", () => ({ AutoSaveIndicator: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("wouter", () => ({ useParams: () => ({ courseId: "7", productId: "7" }), useLocation: () => ["/lms/courses/7/landing-builder", vi.fn()] }));
vi.mock("@/components/BlockTemplateLibrary", () => ({
  BlockTemplateLibraryProvider: ({ children }: any) => <>{children}</>,
  OpenTemplateLibraryButton: () => null, SaveAsTemplateButton: () => null,
}));
vi.mock("@/components/BlockPreview", () => ({ BlockPreview: ({ block }: any) => <div data-preview-id={block.id}>{block.data.html ?? block.type}</div> }));
vi.mock("@/components/RichTextEditor", () => ({ default: ({ value, onChange }: any) => <textarea aria-label="Landing rich text" value={value} onChange={event => onChange(event.target.value)} /> }));
vi.mock("@/components/AudioBlockEditor", () => ({ default: () => null }));
vi.mock("@/components/CarouselBlock", () => ({ default: () => null }));
vi.mock("@/components/LessonQuizBlockEditor", () => ({ default: () => null }));
vi.mock("@/components/LessonFlashcardBlockEditor", () => ({ default: () => null }));
vi.mock("@/components/FunnelBlocks", () => ({ FunnelWorkflowBlock: () => null, InlineOrderBumpBlock: () => null, ProductOfferStackBlock: () => null }));
vi.mock("@/components/UserParamTagsHelper", () => ({ default: () => null }));
// Keep the LessonBlockEditor itself real; replace only its shared heavy block controls.
vi.mock("@/pages/admin/LandingPageBuilder", () => ({
  uid: () => "offline-new-block",
  CATALOG_CATEGORIES: ["Content", "Layout"],
  BLOCK_CATALOG: [
    { type: "text", label: "Text", category: "Content", icon: null, defaultData: { html: "New text" } },
    { type: "column_layout", label: "Columns", category: "Layout", icon: null, defaultData: { leftBlocks: [], rightBlocks: [] } },
  ],
  BlockSettings: function OfflineBlockSettings({ block, onChange }: any) {
    const [localDraft, setLocalDraft] = useState("Local unsaved settings draft");
    useEffect(() => { fixture.settingsMounts(block.id); return () => { fixture.settingsUnmounts(block.id); }; }, []);
    return <div data-settings-block={block.id}>
      <input aria-label="Lesson block content" value={block.data.html ?? ""} onChange={event => onChange({ ...block.data, html: event.target.value })} />
      <input aria-label="Settings local draft" value={localDraft} onChange={event => setLocalDraft(event.target.value)} />
    </div>;
  },
  SortableBlock: ({ block, isSelected, onSelect, onSelectChild, onSelectChildBlock }: any) => <div data-block-id={block.id} data-selected={String(isSelected)}>
    <button type="button" onClick={onSelect}>Select {block.id}</button>
    {([...(block.data.leftBlocks ?? []), ...(block.data.rightBlocks ?? [])]).map((child: any) =>
      <button type="button" key={child.id} onClick={() => (onSelectChildBlock ?? onSelectChild)?.(child.id)}>Select nested {child.id}</button>)}
  </div>,
}));

import ResponsiveEditorPanel, { COMPACT_EDITOR_QUERY, useCompactEditor } from "@/components/ResponsiveEditorPanel";
import LessonBlockEditor, { type LessonBlockEditorHandle } from "@/components/LessonBlockEditor";
import LmsLandingPageBuilder from "@/pages/lms/LandingPageBuilder";

/** Faithful matchMedia evaluator for the public width OR coarse-pointer query. */
function installViewport(width = 375, pointer: "coarse" | "fine" = "coarse") {
  let currentWidth = width;
  let currentPointer = pointer;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const matches = () => COMPACT_EDITOR_QUERY.split(",").some(condition => {
    const maximum = condition.match(/^\s*\(max-width:\s*(\d+)px\)\s*$/);
    if (maximum) return currentWidth <= Number(maximum[1]);
    if (/^\s*\(pointer:\s*coarse\)\s*$/.test(condition)) return currentPointer === "coarse";
    throw new Error(`Unimplemented media-query clause: ${condition}`);
  });
  const media = {
    media: COMPACT_EDITOR_QUERY,
    get matches() { return matches(); }, onchange: null,
    addEventListener: vi.fn((type: string, listener: any) => { if (type === "change") listeners.add(listener); }),
    removeEventListener: vi.fn((type: string, listener: any) => { if (type === "change") listeners.delete(listener); }),
    dispatchEvent: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(),
  };
  vi.stubGlobal("matchMedia", vi.fn((query: string) => {
    if (query !== COMPACT_EDITOR_QUERY) throw new Error(`Unexpected media query: ${query}`);
    return media;
  }));
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
  const change = (nextWidth: number, nextPointer: "coarse" | "fine") => {
    const previousMatches = matches();
    currentWidth = nextWidth; currentPointer = nextPointer;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: nextWidth });
    act(() => {
      if (previousMatches !== matches()) listeners.forEach(listener => listener({ matches: matches(), media: COMPACT_EDITOR_QUERY } as MediaQueryListEvent));
      window.dispatchEvent(new Event("resize"));
    });
  };
  return { media, listeners, change };
}
function installVisualViewport(height = 700, offsetTop = 0) {
  const target = new EventTarget();
  const viewport = Object.assign(target, { height, offsetTop,
    addEventListener: vi.fn(target.addEventListener.bind(target)),
    removeEventListener: vi.fn(target.removeEventListener.bind(target)),
  });
  vi.stubGlobal("visualViewport", viewport);
  return viewport;
}
function panel(container: HTMLElement) {
  const result = container.querySelector<HTMLElement>(".c360-responsive-editor-panel");
  expect(result, "actual responsive aside must render").not.toBeNull();
  return result!;
}
function StatefulChild({ mounts, unmounts }: { mounts: () => void; unmounts: () => void }) {
  const [draft, setDraft] = useState("Original mounted draft");
  useEffect(() => { mounts(); return unmounts; }, []);
  return <input aria-label="Mounted child draft" value={draft} onChange={event => setDraft(event.target.value)} />;
}
function HookProbe() { return <output data-testid="compact-hook">{String(useCompactEditor())}</output>; }
const initialLessonBlocks = () => [
  { id: "root", type: "text" as const, data: { html: "Original lesson", retained: { legacy: true } } },
  { id: "columns", type: "column_layout" as const, data: {
    leftBlocks: [{ id: "left-child", type: "text", data: { html: "Left draft", retained: "left" } }],
    rightBlocks: [{ id: "right-child", type: "text", data: { html: "Right draft", retained: "right" } }], gap: 32,
  } },
];

const originalScrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
const originalScrollTo = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollTo");
beforeEach(() => {
  vi.clearAllMocks();
  fixture.lessonMutation.mockResolvedValue({ success: true });
  fixture.pageMutation.mockResolvedValue({ success: true });
  fixture.unexpectedMutation.mockImplementation(() => { throw new Error("Unexpected API mutation in offline mobile-editor tests"); });
  fixture.landing = { courseTitle: "Offline fixture course", courseSlug: "offline-fixture", coursePrice: 20,
    seoTitle: "Offline page title", blocks: [{ id: "landing-text", type: "text", data: { html: "Original landing", retained: { old: true } } }] };
  installViewport();
  vi.stubGlobal("visualViewport", undefined);
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network denied in mobile editor tests"); }));
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() });
  sessionStorage.clear();
});
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals();
  if (originalScrollIntoView) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", originalScrollIntoView);
  else delete (HTMLElement.prototype as any).scrollIntoView;
  if (originalScrollTo) Object.defineProperty(HTMLElement.prototype, "scrollTo", originalScrollTo);
  else delete (HTMLElement.prototype as any).scrollTo;
});

describe("ResponsiveEditorPanel rendered compact policy", () => {
  it.each([
    [375, "coarse", true], [768, "coarse", true], [980, "coarse", true],
    [980, "fine", true], [1280, "coarse", true], [1280, "fine", false],
    [1023, "fine", true], [1024, "fine", false],
  ] as const)("classifies %ipx / %s (including phone Desktop site) as compact=%s", (width, pointer, compact) => {
    installViewport(width, pointer);
    const view = render(<><HookProbe /><ResponsiveEditorPanel title="Block settings" selectionKey="block-a" desktopWidth={320}><input aria-label="Settings field" /></ResponsiveEditorPanel></>);
    expect(view.getByTestId("compact-hook").textContent).toBe(String(compact));
    expect(window.matchMedia).toHaveBeenCalledWith(COMPACT_EDITOR_QUERY);
    expect(panel(view.container).dataset.compact).toBe(String(compact));
    expect(panel(view.container).hidden).toBe(false);
    expect(panel(view.container).style.width).toBe(compact ? "100%" : "320px");
    expect(view.queryByRole("button", { name: "Back to canvas" }) !== null).toBe(compact);
  });

  it("selection opens an initially hidden overlay; Back and reopen preserve the exact mounted child draft", () => {
    const mounts = vi.fn(), unmounts = vi.fn();
    const child = <StatefulChild mounts={mounts} unmounts={unmounts} />;
    const view = render(<ResponsiveEditorPanel title="Block settings" selectionKey={null} desktopWidth={320}>{child}</ResponsiveEditorPanel>);
    const aside = panel(view.container);
    const input = view.getByLabelText("Mounted child draft") as HTMLInputElement;
    expect(aside.hidden).toBe(true);
    expect(mounts).toHaveBeenCalledTimes(1);
    view.rerender(<ResponsiveEditorPanel title="Block settings" selectionKey="block-a" desktopWidth={320}>{child}</ResponsiveEditorPanel>);
    expect(aside.hidden).toBe(false);
    fireEvent.change(input, { target: { value: "Do not lose this unsaved draft" } });
    fireEvent.click(view.getByRole("button", { name: "Back to canvas" }));
    expect(aside.hidden).toBe(true);
    const reopen = view.getByRole("button", { name: "Block settings" });
    expect(reopen.getAttribute("aria-controls")).toBe(aside.id);
    expect(reopen.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(reopen);
    expect(aside.hidden).toBe(false);
    expect(view.getByLabelText("Mounted child draft")).toBe(input);
    expect(input.value).toBe("Do not lose this unsaved draft");
    expect(mounts).toHaveBeenCalledTimes(1);
    expect(unmounts).not.toHaveBeenCalled();
    view.unmount();
    expect(unmounts).toHaveBeenCalledTimes(1);
  });

  it("focuses Back while open, returns focus to reopen, and restores each canvas sibling's prior inert state", () => {
    const viewport = installViewport();
    const shell = (selectionKey: string | null) => <>
      <button type="button" data-testid="page-toolbar">Save outside canvas row</button>
      <div>
        <div data-testid="already-inert"><button type="button">Disabled canvas region</button></div>
        <div data-testid="canvas"><button type="button">Canvas block</button></div>
        <ResponsiveEditorPanel title="Block settings" selectionKey={selectionKey} desktopWidth={320}><input aria-label="Focus field" /></ResponsiveEditorPanel>
      </div>
    </>;
    const view = render(shell(null));
    const canvas = view.getByTestId("canvas"), alreadyInert = view.getByTestId("already-inert");
    const toolbar = view.getByTestId("page-toolbar");
    (canvas as any).inert = false; (alreadyInert as any).inert = true; (toolbar as any).inert = false;
    view.rerender(shell("a"));
    expect(document.activeElement).toBe(view.getByRole("button", { name: "Back to canvas" }));
    expect((canvas as any).inert).toBe(true); expect((alreadyInert as any).inert).toBe(true); expect((toolbar as any).inert).toBe(false);
    fireEvent.click(view.getByRole("button", { name: "Back to canvas" }));
    expect(document.activeElement).toBe(view.getByRole("button", { name: "Block settings" }));
    expect((canvas as any).inert).toBe(false); expect((alreadyInert as any).inert).toBe(true);
    fireEvent.click(view.getByRole("button", { name: "Block settings" }));
    expect(document.activeElement).toBe(view.getByRole("button", { name: "Back to canvas" }));
    viewport.change(1280, "fine");
    expect((canvas as any).inert).toBe(false); expect((alreadyInert as any).inert).toBe(true);
    viewport.change(375, "coarse");
    expect((canvas as any).inert).toBe(true);
    view.unmount();
    expect((canvas as any).inert).toBe(false); expect((alreadyInert as any).inert).toBe(true);
  });

  it("a different selection auto-opens after Back without reopening on ordinary draft rerenders", () => {
    const view = render(<ResponsiveEditorPanel title="Block settings" selectionKey="a" desktopWidth={320}><span>Draft A</span></ResponsiveEditorPanel>);
    const aside = panel(view.container);
    fireEvent.click(view.getByRole("button", { name: "Back to canvas" }));
    view.rerender(<ResponsiveEditorPanel title="Block settings" selectionKey="a" desktopWidth={320}><span>Edited draft A</span></ResponsiveEditorPanel>);
    expect(aside.hidden).toBe(true);
    view.rerender(<ResponsiveEditorPanel title="Block settings" selectionKey="b" desktopWidth={320}><span>Draft B</span></ResponsiveEditorPanel>);
    expect(aside.hidden).toBe(false);
    expect(aside.textContent).toContain("Draft B");
  });

  it("media changes preserve the same child state and desktop widths through compact/desktop transitions", () => {
    const viewport = installViewport(375, "coarse");
    const mounts = vi.fn(), unmounts = vi.fn();
    const view = render(<ResponsiveEditorPanel title="Block settings" selectionKey="a" desktopWidth={430}><StatefulChild mounts={mounts} unmounts={unmounts} /></ResponsiveEditorPanel>);
    const aside = panel(view.container), input = view.getByLabelText("Mounted child draft") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Retained across rotation" } });
    fireEvent.click(view.getByRole("button", { name: "Back to canvas" }));
    viewport.change(1280, "fine");
    expect(aside.dataset.compact).toBe("false"); expect(aside.hidden).toBe(false); expect(aside.style.width).toBe("430px");
    viewport.change(1280, "coarse");
    expect(aside.dataset.compact).toBe("true"); expect(aside.hidden).toBe(false); expect(aside.style.width).toBe("100%");
    viewport.change(768, "coarse");
    expect(view.getByLabelText("Mounted child draft")).toBe(input); expect(input.value).toBe("Retained across rotation");
    expect(mounts).toHaveBeenCalledTimes(1); expect(unmounts).not.toHaveBeenCalled();
    expect(viewport.listeners.size).toBe(1);
    view.unmount(); expect(viewport.listeners.size).toBe(0);
  });

  it.each([288, 320, 430, 700])("retains the supplied %ipx desktop width and does not hide on Escape", desktopWidth => {
    installViewport(1280, "fine");
    const view = render(<ResponsiveEditorPanel title="Page settings" selectionKey={null} desktopWidth={desktopWidth}><input aria-label="Desktop field" /></ResponsiveEditorPanel>);
    expect(panel(view.container).style.width).toBe(`${desktopWidth}px`);
    fireEvent.keyDown(view.getByLabelText("Desktop field"), { key: "Escape" });
    expect(panel(view.container).hidden).toBe(false);
    expect(view.queryByRole("button", { name: "Page settings" })).toBeNull();
  });

  it.each(["dialog", "listbox", "menu"])("Escape within a nested %s leaves the settings overlay open", role => {
    const outerEscape = vi.fn();
    const view = render(<div onKeyDown={outerEscape}><ResponsiveEditorPanel title="Block settings" selectionKey="a" desktopWidth={320}><div role={role}><input aria-label="Nested widget field" /></div><input aria-label="Ordinary field" /></ResponsiveEditorPanel></div>);
    fireEvent.keyDown(view.getByLabelText("Nested widget field"), { key: "Escape" });
    expect(panel(view.container).hidden).toBe(false);
    outerEscape.mockClear();
    fireEvent.keyDown(view.getByLabelText("Ordinary field"), { key: "Escape" });
    expect(panel(view.container).hidden).toBe(true);
    expect(outerEscape).not.toHaveBeenCalled();
  });

  it("respects defaultPrevented Escape and ignores non-Escape keys", () => {
    const view = render(<ResponsiveEditorPanel title="Block settings" selectionKey="a" desktopWidth={320}><input aria-label="Prevented field" onKeyDown={event => event.preventDefault()} /><input aria-label="Ordinary field" /></ResponsiveEditorPanel>);
    fireEvent.keyDown(view.getByLabelText("Prevented field"), { key: "Escape" });
    fireEvent.keyDown(view.getByLabelText("Ordinary field"), { key: "Enter" });
    expect(panel(view.container).hidden).toBe(false);
    fireEvent.keyDown(view.getByLabelText("Ordinary field"), { key: "Escape" });
    expect(panel(view.container).hidden).toBe(true);
  });

  it("visualViewport resize/scroll update keyboard-safe height and remove every callback on unmount", () => {
    const viewport = installVisualViewport();
    const added = vi.spyOn(window, "addEventListener"), removed = vi.spyOn(window, "removeEventListener");
    const view = render(<div data-testid="canvas-row"><ResponsiveEditorPanel title="Block settings" selectionKey="a" desktopWidth={320}><input aria-label="Keyboard field" /></ResponsiveEditorPanel></div>);
    const aside = panel(view.container);
    vi.spyOn(view.getByTestId("canvas-row"), "getBoundingClientRect").mockReturnValue({ top: 120 } as DOMRect);
    act(() => viewport.dispatchEvent(new Event("resize")));
    expect(aside.style.getPropertyValue("--editor-visible-height")).toBe("580px");
    viewport.height = 320;
    act(() => viewport.dispatchEvent(new Event("resize")));
    expect(aside.style.getPropertyValue("--editor-visible-height")).toBe("200px");
    viewport.offsetTop = 200;
    act(() => viewport.dispatchEvent(new Event("scroll")));
    expect(aside.style.getPropertyValue("--editor-visible-height")).toBe("320px");
    viewport.offsetTop = 0; viewport.height = 80;
    act(() => window.dispatchEvent(new Event("resize")));
    expect(aside.style.getPropertyValue("--editor-visible-height")).toBe("0px");
    // Closing/reopening reinstalls the effect; all previous and current listeners must be paired.
    fireEvent.click(view.getByRole("button", { name: "Back to canvas" }));
    fireEvent.click(view.getByRole("button", { name: "Block settings" }));
    view.unmount();
    for (const [type, listener] of viewport.addEventListener.mock.calls) expect(viewport.removeEventListener).toHaveBeenCalledWith(type, listener);
    for (const [type, listener] of added.mock.calls.filter(([type]) => type === "resize")) expect(removed).toHaveBeenCalledWith(type, listener);
    const finalHeight = aside.style.getPropertyValue("--editor-visible-height");
    viewport.height = 600; viewport.dispatchEvent(new Event("resize"));
    expect(aside.style.getPropertyValue("--editor-visible-height")).toBe(finalHeight);
  });

  it("expands the same mounted settings instance when keyboard or landscape leaves less than 260px, then returns to the canvas row", () => {
    const viewport = installVisualViewport(700);
    const mounts = vi.fn(), unmounts = vi.fn();
    const view = render(<div data-testid="canvas-row"><ResponsiveEditorPanel title="Block settings" selectionKey="a" desktopWidth={320}><StatefulChild mounts={mounts} unmounts={unmounts} /></ResponsiveEditorPanel></div>);
    const aside = panel(view.container);
    const input = view.getByLabelText("Mounted child draft");
    fireEvent.change(input, { target: { value: "Draft survives keyboard expansion" } });
    vi.spyOn(view.getByTestId("canvas-row"), "getBoundingClientRect").mockReturnValue({ top: 120 } as DOMRect);
    act(() => viewport.dispatchEvent(new Event("resize")));
    expect(aside.dataset.expandedViewport).toBe("false");
    viewport.height = 320;
    act(() => viewport.dispatchEvent(new Event("resize")));
    expect(aside.dataset.expandedViewport).toBe("true");
    expect(aside.style.getPropertyValue("--editor-viewport-height")).toBe("320px");
    viewport.offsetTop = 100;
    act(() => viewport.dispatchEvent(new Event("scroll")));
    expect(aside.style.getPropertyValue("--editor-viewport-top")).toBe("100px");
    viewport.offsetTop = 0; viewport.height = 700;
    act(() => viewport.dispatchEvent(new Event("resize")));
    expect(aside.dataset.expandedViewport).toBe("false");
    expect(view.getByLabelText("Mounted child draft")).toBe(input);
    expect((input as HTMLInputElement).value).toBe("Draft survives keyboard expansion");
    expect(mounts).toHaveBeenCalledTimes(1); expect(unmounts).not.toHaveBeenCalled();
  });

  it("wraps keyboard focus within the full-viewport panel but does not override a child editor's prevented Tab", () => {
    installVisualViewport(200);
    const view = render(<ResponsiveEditorPanel title="Block settings" selectionKey="a" desktopWidth={320}><input aria-label="Normal last field" /><input aria-label="Editor tab" onKeyDown={event => event.preventDefault()} /></ResponsiveEditorPanel>);
    const back = view.getByRole("button", { name: "Back to canvas" });
    const last = view.getByLabelText("Editor tab");
    for (const element of [back, view.getByLabelText("Normal last field"), last]) vi.spyOn(element, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
    expect(panel(view.container).dataset.expandedViewport).toBe("true");
    act(() => back.focus());
    fireEvent.keyDown(back, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(last);
    // A normal last control must wrap to Back instead of a covered page toolbar.
    last.removeAttribute("tabindex");
    vi.spyOn(last, "getClientRects").mockReturnValue([] as unknown as DOMRectList);
    const normal = view.getByLabelText("Normal last field");
    act(() => normal.focus());
    fireEvent.keyDown(normal, { key: "Tab" });
    expect(document.activeElement).toBe(back);
  });

  it("never expands the docked desktop panel even when the visible viewport is short", () => {
    installViewport(1280, "fine"); installVisualViewport(150);
    const view = render(<ResponsiveEditorPanel title="Block settings" selectionKey="a" desktopWidth={430}><input aria-label="Desktop short viewport" /></ResponsiveEditorPanel>);
    expect(panel(view.container).dataset.expandedViewport).toBe("false");
    expect(panel(view.container).style.width).toBe("430px");
  });

  it("falls back to window height and removes the media listener", () => {
    const viewport = installViewport();
    const view = render(<div data-testid="canvas-row"><ResponsiveEditorPanel title="Page settings" desktopWidth={288}><span>SEO draft</span></ResponsiveEditorPanel></div>);
    vi.spyOn(view.getByTestId("canvas-row"), "getBoundingClientRect").mockReturnValue({ top: 150 } as DOMRect);
    act(() => window.dispatchEvent(new Event("resize")));
    expect(panel(view.container).style.getPropertyValue("--editor-visible-height")).toBe("650px");
    view.unmount(); expect(viewport.listeners.size).toBe(0);
    const [type, callback] = viewport.media.addEventListener.mock.calls[0];
    expect(viewport.media.removeEventListener).toHaveBeenCalledWith(type, callback);
  });

  it("uses the resize fallback when matchMedia is unavailable and cleans it up", () => {
    vi.stubGlobal("matchMedia", undefined);
    const added = vi.spyOn(window, "addEventListener"), removed = vi.spyOn(window, "removeEventListener");
    const view = render(<HookProbe />);
    expect(view.getByTestId("compact-hook").textContent).toBe("true");
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
    act(() => window.dispatchEvent(new Event("resize")));
    expect(view.getByTestId("compact-hook").textContent).toBe("false");
    const callback = added.mock.calls.find(([type]) => type === "resize")![1];
    view.unmount(); expect(removed).toHaveBeenCalledWith("resize", callback);
  });
});

describe("Actual shared LessonBlockEditor mobile integration", () => {
  it("root selection opens settings; Back/reopen retain selection, mounted local draft, edited blocks, and controlled save snapshot", async () => {
    const ref = createRef<LessonBlockEditorHandle>();
    const saved = vi.fn(), closeEditor = vi.fn();
    const view = render(<LessonBlockEditor ref={ref} initialBlocks={initialLessonBlocks()} onBlocksChange={saved} onClose={closeEditor} />);
    fireEvent.click(view.getByRole("button", { name: "Select root" }));
    const aside = panel(view.container), input = view.getByLabelText("Lesson block content");
    expect(aside.dataset.compact).toBe("true"); expect(aside.hidden).toBe(false);
    fireEvent.change(input, { target: { value: "Edited lesson draft" } });
    const local = view.getByLabelText("Settings local draft") as HTMLInputElement;
    fireEvent.change(local, { target: { value: "Mounted local-only draft" } });
    const snapshot = ref.current!.getBlocks();
    expect(snapshot[0].data.html).toBe("Edited lesson draft"); expect(snapshot[0].data.retained).toEqual({ legacy: true });
    fireEvent.click(view.getByRole("button", { name: "Back to canvas" }));
    expect(aside.hidden).toBe(true); expect(closeEditor).not.toHaveBeenCalled(); expect(saved).not.toHaveBeenCalled();
    expect(view.container.querySelector('[data-block-id="root"]')?.getAttribute("data-selected")).toBe("true");
    fireEvent.click(view.getByRole("button", { name: /block settings/i }));
    expect(aside.hidden).toBe(false); expect(view.getByLabelText("Settings local draft")).toBe(local); expect(local.value).toBe("Mounted local-only draft");
    expect(fixture.settingsMounts).toHaveBeenCalledTimes(1); expect(fixture.settingsUnmounts).not.toHaveBeenCalled();
    await act(async () => { await ref.current!.save(); });
    expect(saved).toHaveBeenCalledWith(snapshot); expect(saved.mock.calls[0][0]).toBe(ref.current!.getBlocks());
    expect(fixture.lessonMutation).not.toHaveBeenCalled(); expect(fixture.unexpectedMutation).not.toHaveBeenCalled();
    expect(fixture.markClean).toHaveBeenCalled();
  });

  it("the existing close control clears selection instead of behaving like Back", () => {
    const saved = vi.fn();
    const view = render(<LessonBlockEditor initialBlocks={initialLessonBlocks()} onBlocksChange={saved} />);
    fireEvent.click(view.getByRole("button", { name: "Select root" }));
    fireEvent.change(view.getByLabelText("Lesson block content"), { target: { value: "Saved in editor state" } });
    fireEvent.click(view.getByRole("button", { name: "Close block settings" }));
    expect(view.queryByLabelText("Lesson block content")).toBeNull();
    expect(view.container.querySelector('[data-block-id="root"]')?.getAttribute("data-selected")).toBe("false");
    fireEvent.click(view.getByRole("button", { name: "Select root" }));
    expect((view.getByLabelText("Lesson block content") as HTMLInputElement).value).toBe("Saved in editor state");
    expect(panel(view.container).hidden).toBe(false); expect(saved).not.toHaveBeenCalled();
  });

  it.each(["left", "right"])("existing %s column child selection opens its own settings and controlled save keeps nested draft", async side => {
    const ref = createRef<LessonBlockEditorHandle>(), saved = vi.fn();
    const view = render(<LessonBlockEditor ref={ref} initialBlocks={initialLessonBlocks()} onBlocksChange={saved} />);
    fireEvent.click(view.getByRole("button", { name: `Select nested ${side}-child` }));
    const input = await view.findByLabelText("Lesson block content");
    expect(input.closest("[data-settings-block]")?.getAttribute("data-settings-block")).toBe(`${side}-child`);
    expect(panel(view.container).hidden).toBe(false);
    fireEvent.change(input, { target: { value: `Edited ${side} child draft` } });
    fireEvent.click(view.getByRole("button", { name: "Back to canvas" }));
    fireEvent.click(view.getByRole("button", { name: /block settings/i }));
    expect(view.getByLabelText("Lesson block content")).toBe(input);
    const snapshot = ref.current!.getBlocks();
    const nested = snapshot[1].data[`${side}Blocks`][0];
    expect(nested.data.html).toBe(`Edited ${side} child draft`); expect(nested.data.retained).toBe(side);
    expect(snapshot[0].data.html).toBe("Original lesson");
    await act(async () => { await ref.current!.save(); });
    expect(saved.mock.calls[0][0]).toBe(snapshot); expect(ref.current!.getBlocks()).toBe(snapshot);
    expect(fixture.lessonMutation).not.toHaveBeenCalled();
  });

  it("a new root selection opens after Back and rotation preserves the edited blocks", () => {
    const viewport = installViewport(980, "coarse"), ref = createRef<LessonBlockEditorHandle>();
    const view = render(<LessonBlockEditor ref={ref} initialBlocks={initialLessonBlocks()} onBlocksChange={vi.fn()} />);
    fireEvent.click(view.getByRole("button", { name: "Select root" }));
    fireEvent.change(view.getByLabelText("Lesson block content"), { target: { value: "Desktop-site phone draft" } });
    fireEvent.click(view.getByRole("button", { name: "Back to canvas" }));
    fireEvent.click(view.getByRole("button", { name: "Select columns" }));
    expect(panel(view.container).hidden).toBe(false);
    viewport.change(1280, "fine");
    expect(panel(view.container).dataset.compact).toBe("false");
    expect(ref.current!.getBlocks()[0].data.html).toBe("Desktop-site phone draft");
    viewport.change(375, "coarse");
    expect(panel(view.container).dataset.compact).toBe("true"); expect(panel(view.container).hidden).toBe(false);
  });

  it("desktop drag resizing still works and its chosen width survives compact viewport transitions", () => {
    const viewport = installViewport(1280, "fine");
    const view = render(<LessonBlockEditor initialBlocks={initialLessonBlocks()} onBlocksChange={vi.fn()} />);
    fireEvent.click(view.getByRole("button", { name: "Select root" }));
    const aside = panel(view.container), input = view.getByLabelText("Lesson block content");
    expect(aside.style.width).toBe("320px");
    const handle = view.container.querySelector<HTMLElement>(".cursor-col-resize");
    expect(handle).not.toBeNull();
    fireEvent.mouseDown(handle!, { clientX: 900 });
    fireEvent.mouseMove(document, { clientX: 820 });
    fireEvent.mouseUp(document);
    expect(aside.style.width).toBe("400px");
    expect(document.body.style.cursor).toBe("");
    expect(document.body.style.userSelect).toBe("");
    fireEvent.change(input, { target: { value: "Resized desktop draft" } });
    viewport.change(375, "coarse");
    expect(aside.style.width).toBe("100%");
    expect(view.container.querySelector(".cursor-col-resize")).toBeNull();
    expect(view.getByLabelText("Lesson block content")).toBe(input);
    viewport.change(1280, "fine");
    expect(aside.style.width).toBe("400px");
    expect((input as HTMLInputElement).value).toBe("Resized desktop draft");
    expect(fixture.settingsMounts).toHaveBeenCalledTimes(1);
  });
});

describe("Actual LMS landing shell mobile integration (heavy block children mocked)", () => {
  it.each([[375, "coarse"], [980, "coarse"], [1280, "coarse"], [1280, "fine"]] as const)("renders %ipx / %s, selects and edits blocks, and saves the same draft", async (width, pointer) => {
    installViewport(width, pointer);
    const compact = width <= 1023 || pointer === "coarse";
    const view = render(<LmsLandingPageBuilder />);
    await waitFor(() => expect(view.container.querySelector('[data-block-id="landing-text"]')).not.toBeNull());
    const aside = panel(view.container);
    expect(aside.dataset.compact).toBe(String(compact)); expect(aside.hidden).toBe(compact);
    expect(aside.style.width).toBe(compact ? "100%" : "288px");
    expect(view.queryByTitle("Drag to resize panel") !== null).toBe(!compact);
    fireEvent.click(view.container.querySelector('[data-block-id="landing-text"]')!);
    const input = view.getByLabelText("Landing rich text") as HTMLTextAreaElement;
    expect(aside.hidden).toBe(false);
    fireEvent.change(input, { target: { value: "Edited offline landing draft" } });
    if (compact) {
      fireEvent.click(view.getByRole("button", { name: "Back to canvas" }));
      expect(aside.hidden).toBe(true); expect(fixture.pageMutation).not.toHaveBeenCalled();
      fireEvent.click(view.getByRole("button", { name: /block settings/i }));
      expect(view.getByLabelText("Landing rich text")).toBe(input); expect(input.value).toBe("Edited offline landing draft");
    }
    fireEvent.click(view.getByRole("button", { name: "Save Page" }));
    await waitFor(() => expect(fixture.pageMutation).toHaveBeenCalledTimes(1));
    const saved = fixture.pageMutation.mock.calls[0][0];
    expect(saved.courseId).toBe(7); expect(saved.blocks[0].data.html).toBe("Edited offline landing draft");
    expect(saved.blocks[0].data.retained).toEqual({ old: true }); expect(fixture.unexpectedMutation).not.toHaveBeenCalled();
  });

  it("opens Page settings without block selection and keeps its SEO draft across Back/reopen", async () => {
    const view = render(<LmsLandingPageBuilder />);
    await waitFor(() => expect(view.container.querySelector('[data-block-id="landing-text"]')).not.toBeNull());
    const aside = panel(view.container);
    fireEvent.click(view.getByRole("button", { name: "Page settings" }));
    const input = within(aside).getByPlaceholderText("Offline fixture course") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Unpublished SEO draft" } });
    fireEvent.click(view.getByRole("button", { name: "Back to canvas" }));
    expect(aside.hidden).toBe(true);
    fireEvent.click(view.getByRole("button", { name: "Page settings" }));
    expect(within(aside).getByPlaceholderText("Offline fixture course")).toBe(input); expect(input.value).toBe("Unpublished SEO draft");
    expect(fixture.pageMutation).not.toHaveBeenCalled(); expect(fixture.unexpectedMutation).not.toHaveBeenCalled();
  });
});
