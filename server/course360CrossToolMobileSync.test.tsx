// @vitest-environment jsdom
/**
 * Real-shell mobile synchronization regression coverage. Only heavyweight block
 * children and external boundaries are replaced; no auth, DB, or tRPC transport
 * is imported. Run with envFile:false and the network-denial preload as well.
 */
import React, { useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";

const fixture = vi.hoisted(() => ({
  site: {} as any, funnel: {} as any, landing: {} as any,
  queries: [] as { path: string; input: any; options: any }[],
  calls: [] as { path: string; input: any }[],
  allowed: new Set<string>(),
  handlers: {} as Record<string, ReturnType<typeof vi.fn>>,
  unexpected: vi.fn(), navigate: vi.fn(), invalidateFunnel: vi.fn(),
  invalidateLanding: vi.fn(), markClean: vi.fn(), markDirty: vi.fn(),
  settingsMounts: vi.fn(), settingsUnmounts: vi.fn(),
}));

vi.mock("@/lib/trpc", async () => {
  const { useState: usePendingState } = await import("react");
  const empty: any[] = [];
  const queries: Record<string, () => any> = {
    "sitePages.admin.getPage": () => fixture.site,
    "funnel.getPageById": () => fixture.funnel,
    "lmsGroup.getPlatformSettings": () => ({ funnelPublishDomain: "preview.example.test" }),
    "lmsAdmin.getLandingPageBlocks": () => fixture.landing,
    "funnelAdmin.getFunnelsWithPages": () => empty,
    "lmsAdmin.getCoursesWithLandingBlocks": () => empty,
    "lmsAdmin.getDownloadsWithLandingBlocks": () => empty,
    "lmsAdmin.getProductsWithLandingBlocks": () => empty,
    "lmsAdmin.listPageTemplates": () => empty,
    "blockTemplates.list": () => empty,
    "funnel.listBranchRules": () => empty,
    "funnel.listAllProducts": () => empty,
    "funnel.list": () => empty,
    "orderBumpsAdmin.list": () => empty,
  };
  const mutations = new Set([
    "sitePages.admin.saveBlocks", "sitePages.admin.saveSeo", "sitePages.admin.updatePageMeta",
    "funnel.updatePage", "lmsAdmin.saveLandingPageBlocks", "lmsAdmin.saveLandingPageSeo",
    "pageScraper.scrapeUrl", "blockTemplates.save", "blockTemplates.delete",
    "lmsAdmin.savePageTemplate", "lmsAdmin.deletePageTemplate", "auth.uploadPageMedia",
    "funnel.upsertBranchRule", "funnel.deleteBranchRule", "lmsAdmin.generateImage",
  ]);
  const utils = {
    funnel: {
      getPageById: { invalidate: fixture.invalidateFunnel },
      listBranchRules: { invalidate: vi.fn() },
    },
    lmsAdmin: {
      getLandingPageBlocks: { invalidate: fixture.invalidateLanding },
      listPageTemplates: { invalidate: vi.fn() },
    },
    blockTemplates: { list: { invalidate: vi.fn() } },
  };
  const tree: Record<string, any> = { useUtils: () => utils };
  function register(path: string, value: any) {
    const parts = path.split(".");
    let branch = tree;
    for (const part of parts.slice(0, -1)) branch = branch[part] ??= {};
    branch[parts[parts.length - 1]] = value;
  }
  for (const [path, getData] of Object.entries(queries)) register(path, {
    useQuery: (input: any, options: any) => {
      fixture.queries.push({ path, input, options });
      return { data: getData(), isLoading: false, refetch: vi.fn() };
    },
  });
  for (const path of mutations) register(path, {
    useMutation: (options?: any) => {
      const [isPending, setPending] = usePendingState(false);
      const mutateAsync = async (input: any) => {
        if (!fixture.allowed.has(path)) return fixture.unexpected(path, input);
        fixture.calls.push({ path, input });
        setPending(true);
        try {
          const result = await fixture.handlers[path](input);
          await options?.onSuccess?.(result);
          return result;
        } catch (error) {
          options?.onError?.(error);
          throw error;
        } finally { setPending(false); }
      };
      return { isPending, mutateAsync, mutate: (input: any) => { void mutateAsync(input); } };
    },
  });
  // A new API or accidental auth/provider hook is a test failure, not an empty
  // catch-all query that silently conceals a changed API contract.
  function strict(branch: any, prefix = "trpc"): any {
    return new Proxy(branch, {
      get(target, key) {
        if (typeof key === "symbol") return target[key];
        if (!(key in target)) throw new Error(`Unexpected offline API access: ${prefix}.${key}`);
        const value = target[key];
        return value && typeof value === "object" ? strict(value, `${prefix}.${key}`) : value;
      },
    });
  }
  return { trpc: strict(tree) };
});
vi.mock("@/hooks/useOrgScope", () => ({ useOrgScope: () => ({ orgId: 11 }) }));
vi.mock("@/hooks/useSubdomain", () => ({ getSubdomain: () => null }));
vi.mock("wouter", () => ({
  useParams: () => ({ pageId: "41", funnelId: "9", courseId: "7" }),
  useLocation: () => ["/offline/editor", fixture.navigate],
}));
vi.mock("@/hooks/useAutoSave", () => ({ useAutoSave: () => ({
  isDirty: false, status: "saved", markDirty: fixture.markDirty, markClean: fixture.markClean,
}) }));
vi.mock("@/components/AutoSaveIndicator", () => ({ AutoSaveIndicator: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/BlockTemplateLibrary", () => ({
  BlockTemplateLibraryProvider: ({ children }: any) => <>{children}</>,
  OpenTemplateLibraryButton: () => <button type="button">Block Library</button>,
  SaveAsTemplateButton: () => null,
}));
vi.mock("@/components/BlockPreview", () => ({ BlockPreview: ({ block }: any) =>
  <div data-preview-id={block.id}>{block.data.html ?? block.type}</div>,
}));
vi.mock("@/components/RichTextEditor", () => ({ default: ({ value, onChange }: any) =>
  <textarea aria-label="Landing rich text" value={value} onChange={event => onChange(event.target.value)} />,
}));
vi.mock("@/components/AudioBlockEditor", () => ({ default: () => null }));
vi.mock("@/components/CarouselBlock", () => ({ default: () => null }));
vi.mock("@/components/LessonQuizBlockEditor", () => ({ default: () => null }));
vi.mock("@/components/LessonFlashcardBlockEditor", () => ({ default: () => null }));
vi.mock("@/components/FunnelBlocks", () => ({ FunnelWorkflowBlock: () => null, InlineOrderBumpBlock: () => null, ProductOfferStackBlock: () => null }));
vi.mock("@/components/UserParamTagsHelper", () => ({ default: () => null }));

// Site/admin Funnel consume mocked heavyweight children, not a fake shell.
// The admin default export is preserved, but currently cannot render because
// its existing toolbar references an undefined handleSave (out of scope here).
vi.mock("@/pages/admin/LandingPageBuilder", async importOriginal => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    uid: () => "offline-added-block",
    CATALOG_CATEGORIES: ["Content", "Layout"],
    BLOCK_CATALOG: [
      { type: "text", label: "Text", category: "Content", icon: null, defaultData: { html: "New offline text" } },
      { type: "column_layout", label: "Columns", category: "Layout", icon: null, defaultData: { leftBlocks: [], rightBlocks: [] } },
    ],
    BlockSettings: function OfflineBlockSettings({ block, onChange }: any) {
      const [localDraft, setLocalDraft] = useState("Original mounted settings draft");
      useEffect(() => {
        fixture.settingsMounts(block.id);
        return () => { fixture.settingsUnmounts(block.id); };
      }, []);
      return <div data-settings-block={block.id}>
        <input aria-label="Block content" value={block.data.html ?? ""} onChange={event => onChange({ ...block.data, html: event.target.value })} />
        <input aria-label="Settings local draft" value={localDraft} onChange={event => setLocalDraft(event.target.value)} />
      </div>;
    },
    SortableBlock: ({ block, isSelected, onSelect, onSelectChildBlock, onMoveUp, onMoveDown, onDuplicate, onDelete, onSaveAsTemplate }: any) =>
      <div data-block-id={block.id} data-selected={String(isSelected)}>
        <button type="button" onClick={onSelect}>Select {block.id}</button>
        <output data-rendered-content={block.id}>{block.data.html ?? block.type}</output>
        <button type="button" disabled={!onMoveUp} onClick={onMoveUp}>Move up {block.id}</button>
        <button type="button" disabled={!onMoveDown} onClick={onMoveDown}>Move down {block.id}</button>
        <button type="button" onClick={onDuplicate}>Duplicate {block.id}</button>
        <button type="button" onClick={onDelete}>Delete {block.id}</button>
        {onSaveAsTemplate && <button type="button" onClick={() => onSaveAsTemplate(block)}>Template {block.id}</button>}
        {[...(block.data.leftBlocks ?? []), ...(block.data.rightBlocks ?? [])].map((child: any) =>
          <button type="button" key={child.id} onClick={() => onSelectChildBlock?.(child.id)}>Select nested {child.id}</button>)}
      </div>,
  };
});

// The routed marketing Funnel imports the LMS named exports. Reuse the same
// heavyweight-child seam while preserving the real LMS landing default export
// and real TemplateLibrary. Its internal LMS block controls remain real.
vi.mock("@/pages/lms/LandingPageBuilder", async importOriginal => {
  const actual = await importOriginal<any>();
  const controls = await import("@/pages/admin/LandingPageBuilder");
  return { ...actual, uid: controls.uid, BLOCK_CATALOG: controls.BLOCK_CATALOG,
    CATALOG_CATEGORIES: controls.CATALOG_CATEGORIES,
    BlockSettings: controls.BlockSettings, SortableBlock: controls.SortableBlock };
});

import { COMPACT_EDITOR_QUERY, useCompactEditor } from "@/components/ResponsiveEditorPanel";
import SitePageBuilder from "@/pages/admin/SitePageBuilder";
import FunnelPageEditor from "@/pages/admin/FunnelPageEditor";
import RoutedFunnelPageEditor from "@/pages/marketing/FunnelPageEditor";
import LmsLandingPageBuilder from "@/pages/lms/LandingPageBuilder";

const viewports = [[375, "coarse"], [980, "coarse"], [1280, "coarse"], [1280, "fine"]] as const;
function installViewport(width = 375, pointer: "coarse" | "fine" = "coarse") {
  let currentWidth = width, currentPointer = pointer;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const matches = () => COMPACT_EDITOR_QUERY.split(",").some(clause => {
    const maximum = clause.match(/^\s*\(max-width:\s*(\d+)px\)\s*$/);
    if (maximum) return currentWidth <= Number(maximum[1]);
    if (/^\s*\(pointer:\s*coarse\)\s*$/.test(clause)) return currentPointer === "coarse";
    throw new Error(`Unsupported media query clause: ${clause}`);
  });
  const media = {
    media: COMPACT_EDITOR_QUERY, get matches() { return matches(); }, onchange: null,
    addEventListener: vi.fn((type: string, listener: any) => { if (type === "change") listeners.add(listener); }),
    removeEventListener: vi.fn((type: string, listener: any) => { if (type === "change") listeners.delete(listener); }),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  };
  vi.stubGlobal("matchMedia", vi.fn((query: string) => {
    if (query !== COMPACT_EDITOR_QUERY) throw new Error(`Unexpected media query: ${query}`);
    return media;
  }));
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
  return { listeners, change(nextWidth: number, nextPointer: "coarse" | "fine") {
    const previous = matches();
    currentWidth = nextWidth; currentPointer = nextPointer;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: nextWidth });
    act(() => {
      if (previous !== matches()) listeners.forEach(listener => listener({ matches: matches(), media: COMPACT_EDITOR_QUERY } as MediaQueryListEvent));
      window.dispatchEvent(new Event("resize"));
    });
  } };
}
function actualPanel(container: HTMLElement) {
  const aside = container.querySelector<HTMLElement>(".c360-responsive-editor-panel");
  expect(aside, "the real shell must use the existing responsive editor panel").not.toBeNull();
  return aside!;
}
function sourceBlocks() {
  return [
    { id: "root", type: "text", legacyBlockField: "preserve-top-level", data: { html: "Original root", retained: { legacy: true }, marginTop: 17 } },
    { id: "tail", type: "text", data: { html: "Original tail", retained: "tail" } },
    { id: "columns", type: "column_layout", data: { gap: 32, leftRatio: 45, retained: "columns",
      leftBlocks: [{ id: "left-child", type: "text", data: { html: "Original left", retained: { side: "left" } } }],
      rightBlocks: [{ id: "right-child", type: "text", data: { html: "Original right", retained: { side: "right" } } }],
    } },
  ];
}
function allow(...paths: string[]) { paths.forEach(path => fixture.allowed.add(path)); }
function savedBlocks(path: string) {
  const input = fixture.calls.find(call => call.path === path)!.input;
  return typeof input.blocks === "string" ? JSON.parse(input.blocks) : input.blocks;
}
function saveButton(view: ReturnType<typeof render>) {
  return view.getByRole("button", { name: /^(Save|Save Page)$/ });
}
function deferred() {
  let resolve!: (value: any) => void;
  const promise = new Promise<any>(done => { resolve = done; });
  return { promise, resolve };
}
const scrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
const scrollTo = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollTo");

beforeEach(() => {
  vi.clearAllMocks(); fixture.queries = []; fixture.calls = []; fixture.allowed.clear();
  fixture.unexpected.mockImplementation((path: string) => { throw new Error(`Unexpected API mutation: ${path}`); });
  fixture.handlers = Object.fromEntries([
    "sitePages.admin.saveBlocks", "sitePages.admin.saveSeo", "sitePages.admin.updatePageMeta",
    "funnel.updatePage", "lmsAdmin.saveLandingPageBlocks", "lmsAdmin.saveLandingPageSeo",
  ].map(path => [path, vi.fn().mockResolvedValue({ success: true })]));
  fixture.site = {
    id: 41, orgId: 11, title: "Offline site page", domain: "school.example.test", slug: "offline-site", status: "draft",
    blocks: JSON.stringify(sourceBlocks()), seoTitle: "Original SEO title", seoDescription: "Original SEO description", seoImage: "https://assets.example.test/original.png",
    showInHeaderNav: false, showInSidebarNav: true, showInProfileNav: false, isHiddenFromNav: true,
    legacyHtml: "<p>Legacy page HTML must not be rewritten</p>", templateId: 91, customCss: ".legacy { color: teal; }",
  };
  fixture.funnel = {
    page: { id: 41, funnelId: 9, title: "Offline funnel page", slug: "offline-funnel-page", pageType: "landing",
      blocks: JSON.stringify(sourceBlocks()), seoTitle: "Funnel SEO", seoDescription: "Keep funnel SEO", seoImage: null,
      isHidden: false, isStandaloneLanding: false, htmlContent: "Legacy funnel HTML", templateId: 92 },
    funnel: { id: 9, orgId: 11, name: "Offline funnel", slug: "offline-funnel", customDomain: null },
    allPages: [{ id: 41, title: "Offline funnel page", pageType: "landing", slug: "offline-funnel-page" },
      { id: 42, title: "Offline checkout page", pageType: "checkout", slug: "checkout" }],
  };
  fixture.landing = { courseTitle: "Offline fixture course", courseSlug: "offline-fixture", coursePrice: 20,
    seoTitle: "Landing SEO", blocks: [{ id: "landing-text", type: "text", data: { html: "Original landing", retained: { old: true } } }] };
  installViewport(); vi.stubGlobal("visualViewport", undefined);
  const denied = vi.fn(() => { throw new Error("Network denied in cross-tool mobile sync tests"); });
  vi.stubGlobal("fetch", denied); vi.stubGlobal("XMLHttpRequest", denied); vi.stubGlobal("WebSocket", denied);
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() });
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  expect(fixture.unexpected).not.toHaveBeenCalled();
  expect(window.fetch).not.toHaveBeenCalled();
  expect(window.XMLHttpRequest).not.toHaveBeenCalled();
  expect(window.WebSocket).not.toHaveBeenCalled();
  vi.restoreAllMocks(); vi.unstubAllGlobals();
  if (scrollIntoView) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", scrollIntoView);
  else delete (HTMLElement.prototype as any).scrollIntoView;
  if (scrollTo) Object.defineProperty(HTMLElement.prototype, "scrollTo", scrollTo);
  else delete (HTMLElement.prototype as any).scrollTo;
});

for (const [name, Shell, desktopWidth, savePath] of [
  ["Site", SitePageBuilder, 300, "sitePages.admin.saveBlocks"],
  ["Funnel", FunnelPageEditor, 288, "funnel.updatePage"],
  ["Routed marketing Funnel", RoutedFunnelPageEditor, 288, "funnel.updatePage"],
] as const) describe(`Actual ${name} shell mobile synchronization`, () => {
  it.each(viewports)("%ipx / %s retains real controls, local drafts, ordered blocks, and the original save contract", async (width, pointer) => {
    installViewport(width, pointer);
    const compact = width < 1024 || pointer === "coarse";
    const original = JSON.parse(name === "Site" ? fixture.site.blocks : fixture.funnel.page.blocks);
    const untouchedPage = JSON.stringify(name === "Site" ? fixture.site : fixture.funnel);
    allow(savePath);
    if (name === "Site") allow("sitePages.admin.saveSeo", "sitePages.admin.updatePageMeta");
    const view = render(<Shell />);
    await view.findByRole("button", { name: "Select root" });
    const aside = actualPanel(view.container);
    expect(aside.dataset.compact).toBe(String(compact)); expect(aside.hidden).toBe(compact);
    expect(aside.style.width).toBe(compact ? "100%" : `${desktopWidth}px`);
    const row = aside.parentElement!;
    expect(row.classList.contains("relative")).toBe(true);
    expect(row.classList.contains("min-h-0")).toBe(true);
    expect(row.classList.contains("min-w-0")).toBe(true);
    expect(row.classList.contains("flex-col")).toBe(compact);
    const catalog = row.firstElementChild as HTMLElement;
    expect(catalog.classList.contains("overflow-y-auto")).toBe(true);
    expect(catalog.style.width).toBe(compact ? "100%" : "");
    expect(catalog.classList.contains("w-52")).toBe(true);
    expect(catalog.style.maxHeight).toBe(compact ? "30%" : "");
    if (name === "Site") {
      expect(view.getByRole("button", { name: "Pages" })).toBeTruthy();
      expect(view.getByRole("button", { name: "Publish" })).toBeTruthy();
      expect(view.getByRole("link", { name: "Preview" }).getAttribute("href")).toBe("/offline-site");
      expect(within(catalog).getByRole("button", { name: "Layout" })).toBeTruthy();
      expect(within(catalog).getByRole("button", { name: "+ Columns" })).toBeTruthy();
    } else {
      expect(view.getByRole("button", { name: "Back to Funnel" })).toBeTruthy();
      expect(view.getByRole("button", { name: name === "Funnel" ? "Apply Template" : "Page Templates" })).toBeTruthy();
      expect(view.getByRole("button", { name: "Save as Template" })).toBeTruthy();
      expect(view.getByRole("link", { name: "Preview Page" }).getAttribute("href")).toBe(name === "Funnel" ? "https://preview.example.test/offline-funnel/offline-funnel-page" : "/offline-funnel/offline-funnel-page");
      expect(view.getByLabelText("Hidden from funnel")).toBeTruthy();
      expect(view.getByLabelText("Standalone page")).toBeTruthy();
      expect(within(catalog).getByRole("button", { name: "Link Preview" })).toBeTruthy();
      expect(within(catalog).getByRole("button", { name: "Branch Rules" })).toBeTruthy();
      expect(within(catalog).getByRole("button", { name: "Add Block" })).toBeTruthy();
      expect(view.queryByTitle("Drag to resize panel") !== null).toBe(!compact);
      expect(within(catalog).getByRole("button", { name: /Offline checkout page/ })).toBeTruthy();
    }
    fireEvent.click(view.getByRole("button", { name: "Select root" }));
    expect(aside.hidden).toBe(false);
    const content = view.getByLabelText("Block content") as HTMLInputElement;
    const local = view.getByLabelText("Settings local draft") as HTMLInputElement;
    fireEvent.change(content, { target: { value: "Edited unpublished root" } });
    fireEvent.change(local, { target: { value: "Local-only draft survives Back" } });
    if (compact) {
      fireEvent.click(view.getByRole("button", { name: "Back to canvas" }));
      expect(aside.hidden).toBe(true);
      expect(view.container.querySelector('[data-block-id="root"]')?.getAttribute("data-selected")).toBe("true");
      expect(fixture.calls).toEqual([]); expect(fixture.navigate).not.toHaveBeenCalled();
      const reopen = view.getByRole("button", { name: /^(Block|Page) settings$/ });
      expect(reopen.getAttribute("aria-controls")).toBe(aside.id);
      fireEvent.click(reopen);
      expect(aside.hidden).toBe(false);
      expect(view.getByLabelText("Block content")).toBe(content);
      expect(view.getByLabelText("Settings local draft")).toBe(local);
      expect(local.value).toBe("Local-only draft survives Back");
      fireEvent.click(view.getByRole("button", { name: "Back to canvas" }));
    }
    expect(fixture.settingsMounts).toHaveBeenCalledTimes(1);
    expect(fixture.settingsUnmounts).not.toHaveBeenCalled();
    fireEvent.click(view.getByRole("button", { name: "Move down root" }));
    const expected = [original[1], { ...original[0], data: { ...original[0].data, html: "Edited unpublished root" } }, original[2]];
    fireEvent.click(saveButton(view));
    await waitFor(() => expect(fixture.calls).toHaveLength(name === "Site" ? 3 : 1));
    expect(savedBlocks(savePath)).toEqual(expected);
    if (name === "Site") {
      expect(fixture.calls).toEqual([
        { path: savePath, input: { pageId: 41, blocks: JSON.stringify(expected) } },
        { path: "sitePages.admin.saveSeo", input: { pageId: 41, seoTitle: "Original SEO title", seoDescription: "Original SEO description", seoImage: "https://assets.example.test/original.png" } },
        { path: "sitePages.admin.updatePageMeta", input: { pageId: 41, showInHeaderNav: false, showInSidebarNav: true, showInProfileNav: false, isHiddenFromNav: true } },
      ]);
    } else {
      expect(fixture.calls).toEqual([{ path: savePath, input: { id: 41, blocks: JSON.stringify(expected) } }]);
      expect(fixture.invalidateFunnel).toHaveBeenCalledWith({ id: 41 });
      if (name === "Funnel") expect(fixture.markClean).toHaveBeenCalledTimes(1);
      else expect(fixture.markClean).not.toHaveBeenCalled();
    }
    expect(JSON.stringify(name === "Site" ? fixture.site : fixture.funnel)).toBe(untouchedPage);
    const query = fixture.queries.find(entry => entry.path === (name === "Site" ? "sitePages.admin.getPage" : "funnel.getPageById"))!;
    expect(query.input).toEqual(name === "Site" ? { pageId: 41 } : { id: 41 });
    expect(query.options.enabled).toBe(true);
  });

  it("desktop/touch transitions preserve the same mounted block editor and original desktop width", async () => {
    const viewport = installViewport(1280, "fine");
    const view = render(<Shell />);
    fireEvent.click(await view.findByRole("button", { name: "Select root" }));
    const aside = actualPanel(view.container), local = view.getByLabelText("Settings local draft") as HTMLInputElement;
    fireEvent.change(local, { target: { value: "Draft across responsive transitions" } });
    viewport.change(980, "coarse");
    expect(aside.style.width).toBe("100%"); expect(aside.hidden).toBe(false);
    fireEvent.click(view.getByRole("button", { name: "Back to canvas" }));
    viewport.change(1280, "fine");
    expect(aside.hidden).toBe(false); expect(aside.style.width).toBe(`${desktopWidth}px`);
    viewport.change(1280, "coarse");
    expect(aside.hidden).toBe(false); expect(aside.dataset.compact).toBe("true");
    expect(view.getByLabelText("Settings local draft")).toBe(local);
    expect(local.value).toBe("Draft across responsive transitions");
    expect(fixture.settingsMounts).toHaveBeenCalledTimes(1); expect(fixture.settingsUnmounts).not.toHaveBeenCalled();
    expect(fixture.calls).toEqual([]);
  });
});

describe("Site SEO/navigation settings and save sequencing remain native", () => {
  it("Page settings Back/reopen preserves exact SEO controls and edits; Save never publishes or rewrites legacy fields", async () => {
    allow("sitePages.admin.saveBlocks", "sitePages.admin.saveSeo", "sitePages.admin.updatePageMeta");
    const original = JSON.stringify(fixture.site), view = render(<SitePageBuilder />);
    const aside = actualPanel(view.container);
    fireEvent.click(view.getByRole("button", { name: "Page settings" }));
    const title = within(aside).getByDisplayValue("Original SEO title") as HTMLInputElement;
    const description = within(aside).getByDisplayValue("Original SEO description") as HTMLTextAreaElement;
    const image = within(aside).getByDisplayValue("https://assets.example.test/original.png") as HTMLInputElement;
    const switches = within(aside).getAllByRole("switch");
    expect(switches.map(control => control.getAttribute("aria-checked"))).toEqual(["false", "true", "false", "true"]);
    for (const text of ["Show in header nav", "Show in sidebar nav", "Show in profile nav", "Hidden from menus", "SEO", "Title", "Description", "Image URL"]) expect(within(aside).getByText(text)).toBeTruthy();
    fireEvent.change(title, { target: { value: "Unpublished SEO title" } });
    fireEvent.change(description, { target: { value: "Unpublished SEO description" } });
    fireEvent.change(image, { target: { value: "https://assets.example.test/draft.png" } });
    switches.forEach(control => fireEvent.click(control));
    fireEvent.click(view.getByRole("button", { name: "Back to canvas" }));
    expect(aside.hidden).toBe(true); expect(fixture.calls).toEqual([]);
    fireEvent.click(view.getByRole("button", { name: "Page settings" }));
    expect(within(aside).getByDisplayValue("Unpublished SEO title")).toBe(title);
    expect(within(aside).getByDisplayValue("Unpublished SEO description")).toBe(description);
    expect(within(aside).getByDisplayValue("https://assets.example.test/draft.png")).toBe(image);
    expect(switches.map(control => control.getAttribute("aria-checked"))).toEqual(["true", "false", "true", "false"]);
    fireEvent.click(saveButton(view));
    await waitFor(() => expect(fixture.calls).toHaveLength(3));
    expect(fixture.calls.map(call => call.path)).toEqual(["sitePages.admin.saveBlocks", "sitePages.admin.saveSeo", "sitePages.admin.updatePageMeta"]);
    expect(fixture.calls[1].input).toEqual({ pageId: 41, seoTitle: "Unpublished SEO title", seoDescription: "Unpublished SEO description", seoImage: "https://assets.example.test/draft.png" });
    expect(fixture.calls[2].input).toEqual({ pageId: 41, showInHeaderNav: true, showInSidebarNav: false, showInProfileNav: true, isHiddenFromNav: false });
    expect(savedBlocks("sitePages.admin.saveBlocks")).toEqual(sourceBlocks());
    expect(fixture.calls.some(call => "status" in call.input)).toBe(false);
    expect(JSON.stringify(fixture.site)).toBe(original);
  });

  it("defers SEO until the blocks mutation resolves, then defers metadata until SEO resolves", async () => {
    allow("sitePages.admin.saveBlocks", "sitePages.admin.saveSeo", "sitePages.admin.updatePageMeta");
    const blocksGate = deferred(), seoGate = deferred();
    fixture.handlers["sitePages.admin.saveBlocks"].mockReturnValue(blocksGate.promise);
    fixture.handlers["sitePages.admin.saveSeo"].mockReturnValue(seoGate.promise);
    const view = render(<SitePageBuilder />), save = saveButton(view) as HTMLButtonElement;
    fireEvent.click(save);
    await waitFor(() => expect(save.disabled).toBe(true));
    expect(fixture.calls.map(call => call.path)).toEqual(["sitePages.admin.saveBlocks"]);
    fireEvent.click(save);
    expect(fixture.calls).toHaveLength(1);
    await act(async () => { blocksGate.resolve({ success: true }); await blocksGate.promise; });
    expect(fixture.calls.map(call => call.path)).toEqual(["sitePages.admin.saveBlocks", "sitePages.admin.saveSeo"]);
    await act(async () => { seoGate.resolve({ success: true }); await seoGate.promise; });
    await waitFor(() => expect(fixture.calls.map(call => call.path)).toEqual(["sitePages.admin.saveBlocks", "sitePages.admin.saveSeo", "sitePages.admin.updatePageMeta"]));
    expect(fixture.calls.some(call => "status" in call.input)).toBe(false);
  });
});

const funnelVariants = [["admin", FunnelPageEditor], ["routed marketing", RoutedFunnelPageEditor]] as const;
for (const [variant, FunnelPageEditor] of funnelVariants) describe(`Funnel ${variant} native settings, resizer, templates, and pending save`, () => {
  it("native Close block settings clears selection unlike Back, but reopening keeps the edited block", async () => {
    const view = render(<FunnelPageEditor />);
    fireEvent.click(await view.findByRole("button", { name: "Select root" }));
    fireEvent.change(view.getByLabelText("Block content"), { target: { value: "Edited before native close" } });
    fireEvent.click(view.getByRole("button", { name: "Close block settings" }));
    expect(view.queryByLabelText("Block content")).toBeNull();
    expect(view.container.querySelector('[data-block-id="root"]')?.getAttribute("data-selected")).toBe("false");
    fireEvent.click(view.getByRole("button", { name: "Select root" }));
    expect((view.getByLabelText("Block content") as HTMLInputElement).value).toBe("Edited before native close");
    expect(actualPanel(view.container).hidden).toBe(false); expect(fixture.calls).toEqual([]);
  });

  it.each(["left", "right"])("existing %s nested selection reaches its native update callback without altering the other blocks", async side => {
    allow("funnel.updatePage");
    const expected = sourceBlocks(), view = render(<FunnelPageEditor />);
    fireEvent.click(await view.findByRole("button", { name: `Select nested ${side}-child` }));
    const input = await view.findByLabelText("Block content");
    expect(input.closest("[data-settings-block]")?.getAttribute("data-settings-block")).toBe(`${side}-child`);
    fireEvent.change(input, { target: { value: `Edited ${side} nested draft` } });
    fireEvent.click(view.getByRole("button", { name: "Back to canvas" }));
    expect(fixture.calls).toEqual([]);
    fireEvent.click(view.getByRole("button", { name: "Block settings" }));
    expect(view.getByLabelText("Block content")).toBe(input);
    (expected[2].data as any)[`${side}Blocks`][0].data.html = `Edited ${side} nested draft`;
    fireEvent.click(saveButton(view));
    await waitFor(() => expect(fixture.calls).toHaveLength(1));
    expect(fixture.calls[0].input).toEqual({ id: 41, blocks: JSON.stringify(expected) });
  });

  it("desktop drag resizing and its clamps survive mobile transitions without remounting settings", async () => {
    const viewport = installViewport(1280, "fine"), view = render(<FunnelPageEditor />);
    fireEvent.click(await view.findByRole("button", { name: "Select root" }));
    const aside = actualPanel(view.container), input = view.getByLabelText("Settings local draft") as HTMLInputElement;
    expect(aside.style.width).toBe("288px");
    fireEvent.change(input, { target: { value: "Resized funnel local draft" } });
    const drag = (start: number, end: number) => {
      fireEvent.mouseDown(view.getByTitle("Drag to resize panel"), { clientX: start });
      fireEvent.mouseMove(window, { clientX: end }); fireEvent.mouseUp(window);
    };
    drag(900, 820); expect(aside.style.width).toBe("368px");
    fireEvent.mouseMove(window, { clientX: 500 }); expect(aside.style.width).toBe("368px");
    drag(900, 50); expect(aside.style.width).toBe("700px");
    drag(900, 1600); expect(aside.style.width).toBe("240px");
    drag(900, 772); expect(aside.style.width).toBe("368px");
    viewport.change(375, "coarse");
    expect(aside.style.width).toBe("100%"); expect(view.queryByTitle("Drag to resize panel")).toBeNull();
    viewport.change(1280, "fine");
    expect(aside.style.width).toBe("368px"); expect(view.getByLabelText("Settings local draft")).toBe(input);
    expect(input.value).toBe("Resized funnel local draft"); expect(fixture.settingsMounts).toHaveBeenCalledTimes(1);
    expect(fixture.calls).toEqual([]);
  });

  it("retains template dialogs and catalog/copy/import tabs without causing save or publish mutations", async () => {
    const view = render(<FunnelPageEditor />);
    await view.findByRole("button", { name: "Select root" });
    if (variant === "admin") {
      fireEvent.click(view.getByRole("button", { name: "Apply Template" }));
      expect(view.getByRole("heading", { name: "Apply Page Template" })).toBeTruthy();
      expect(view.getByPlaceholderText("Search templates…")).toBeTruthy();
      // The native backdrop closes the template modal; no API mutation occurs.
      fireEvent.click(view.getByRole("heading", { name: "Apply Page Template" }).parentElement!.parentElement!.parentElement!);
    } else {
      fireEvent.click(view.getByRole("button", { name: "Page Templates" }));
      expect(view.getByRole("heading", { name: /Template Library/ })).toBeTruthy();
      const header = view.getByRole("heading", { name: /Template Library/ }).parentElement!;
      fireEvent.click(within(header).getByRole("button"));
    }
    fireEvent.click(view.getByRole("button", { name: "Save as Template" }));
    expect(view.getByRole("heading", { name: "Save Page as Template" })).toBeTruthy();
    expect((view.getByPlaceholderText("e.g. Webinar Registration Page") as HTMLInputElement).value).toBe("Offline funnel page Template");
    fireEvent.click(view.getByRole("button", { name: "Cancel" }));
    fireEvent.click(view.getAllByRole("button", { name: "Add Block" })[0]);
    const dialog = view.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Add Content Block" })).toBeTruthy();
    for (const text of ["New Block", "Templates", "Copy", "Import URL"]) expect(within(dialog).getAllByText(text).length).toBeGreaterThan(0);
    expect(fixture.calls).toEqual([]);
    for (const path of ["lmsAdmin.getCoursesWithLandingBlocks", "lmsAdmin.getDownloadsWithLandingBlocks", "lmsAdmin.getProductsWithLandingBlocks"]) {
      expect(fixture.queries.filter(query => query.path === path).every(query => JSON.stringify(query.input) === JSON.stringify({ orgId: 11 }))).toBe(true);
    }
  });

  it.each([[375, "coarse"], [1280, "fine"]] as const)("%ipx / %s visible Save/Save Page becomes Saving… and prevents a duplicate pending save", async (width, pointer) => {
    installViewport(width, pointer); allow("funnel.updatePage");
    const gate = deferred(); fixture.handlers["funnel.updatePage"].mockReturnValue(gate.promise);
    const view = render(<FunnelPageEditor />), save = saveButton(view) as HTMLButtonElement;
    expect(save.textContent?.trim()).toBe(pointer === "coarse" ? "Save" : "Save Page");
    fireEvent.click(save);
    await waitFor(() => expect(save.disabled).toBe(true));
    expect(save.textContent?.trim()).toBe("Saving…");
    fireEvent.click(save); expect(fixture.calls).toHaveLength(1); expect(fixture.markClean).not.toHaveBeenCalled();
    await act(async () => { gate.resolve({ success: true }); await gate.promise; });
    await waitFor(() => expect(save.disabled).toBe(false));
    expect(save.textContent?.trim()).toBe(pointer === "coarse" ? "Save" : "Save Page");
    if (variant === "admin") expect(fixture.markClean).toHaveBeenCalledTimes(1);
    else expect(fixture.markClean).not.toHaveBeenCalled();
    expect(fixture.invalidateFunnel).toHaveBeenCalledWith({ id: 41 });
  });
});

for (const [name, Shell] of [["LMS", LmsLandingPageBuilder]] as const) describe(`Actual ${name} landing builder visible save text and accessibility`, () => {
  it.each(viewports)("%ipx / %s shows compact Save vs desktop Save Page while retaining the original accessible name", async (width, pointer) => {
    installViewport(width, pointer);
    const view = render(<Shell />);
    await waitFor(() => expect(view.container.querySelector('[data-block-id="landing-text"]')).not.toBeNull());
    const compact = width < 1024 || pointer === "coarse";
    const save = view.getByRole("button", { name: "Save Page" }) as HTMLButtonElement;
    expect(save.textContent?.trim()).toBe(compact ? "Save" : "Save Page");
    expect(save.getAttribute("aria-label")).toBe("Save Page"); expect(save.disabled).toBe(false);
    expect(view.getByRole("button", { name: "Back to Course" })).toBeTruthy();
    expect(view.getByRole("button", { name: "Page Templates" })).toBeTruthy();
    expect(view.getByRole("button", { name: "Save as Template" })).toBeTruthy();
    expect(view.getByTitle("Undo (Ctrl+Z)")).toBeTruthy();
    expect(view.getByTitle("Redo (Ctrl+Shift+Z)")).toBeTruthy();
    expect(view.getByTitle("Desktop preview")).toBeTruthy(); expect(view.getByTitle("Mobile preview (390px)")).toBeTruthy();
    expect(view.getByRole("link", { name: "Preview" })).toBeTruthy();
    expect(actualPanel(view.container).dataset.compact).toBe(String(compact)); expect(fixture.calls).toEqual([]);
  });

  it("pending Save retains Saving page accessibility, gates double-clicks, and submits the unchanged courseId/block contract", async () => {
    allow("lmsAdmin.saveLandingPageBlocks");
    const gate = deferred(); fixture.handlers["lmsAdmin.saveLandingPageBlocks"].mockReturnValue(gate.promise);
    const view = render(<Shell />);
    await waitFor(() => expect(view.container.querySelector('[data-block-id="landing-text"]')).not.toBeNull());
    const save = view.getByRole("button", { name: "Save Page" }) as HTMLButtonElement;
    expect(save.textContent?.trim()).toBe("Save");
    fireEvent.click(save);
    const pending = view.getByRole("button", { name: "Saving page" });
    expect(pending).toBe(save); expect(save.disabled).toBe(true); expect(save.textContent?.trim()).toBe("Saving…");
    fireEvent.click(pending); expect(fixture.calls).toHaveLength(1);
    expect(fixture.calls[0]).toEqual({ path: "lmsAdmin.saveLandingPageBlocks", input: { courseId: 7, blocks: fixture.landing.blocks } });
    await act(async () => { gate.resolve({ success: true }); await gate.promise; });
    await waitFor(() => expect(save.disabled).toBe(false));
    expect(view.getByRole("button", { name: "Save Page" })).toBe(save); expect(save.textContent?.trim()).toBe("Save");
    expect(fixture.calls).toHaveLength(1);
  });
});

it("real LMS landing block editing still preserves the draft across Back/reopen and saves its legacy data", async () => {
  allow("lmsAdmin.saveLandingPageBlocks");
  const view = render(<LmsLandingPageBuilder />);
  await waitFor(() => expect(view.container.querySelector('[data-block-id="landing-text"]')).not.toBeNull());
  fireEvent.click(view.container.querySelector('[data-block-id="landing-text"]')!);
  const aside = actualPanel(view.container), input = view.getByLabelText("Landing rich text") as HTMLTextAreaElement;
  fireEvent.change(input, { target: { value: "Edited offline LMS landing draft" } });
  fireEvent.click(view.getByRole("button", { name: "Back to canvas" }));
  expect(aside.hidden).toBe(true); expect(fixture.calls).toEqual([]);
  fireEvent.click(view.getByRole("button", { name: "Block settings" }));
  expect(view.getByLabelText("Landing rich text")).toBe(input); expect(input.value).toBe("Edited offline LMS landing draft");
  fireEvent.click(view.getByRole("button", { name: "Save Page" }));
  await waitFor(() => expect(fixture.calls).toHaveLength(1));
  expect(fixture.calls[0]).toEqual({ path: "lmsAdmin.saveLandingPageBlocks", input: { courseId: 7, blocks: [
    { id: "landing-text", type: "text", data: { html: "Edited offline LMS landing draft", retained: { old: true } } },
  ] } });
});

/**
 * The admin builder has a pre-existing unbound handleSave reference, so its full
 * shell cannot render. Render only the EXACT toolbar JSX extracted from that
 * default function; do not synthesize its labels or pretend to verify its API.
 */
function extractedAdminSaveButton() {
  const path = resolve(process.cwd(), "client/src/pages/admin/LandingPageBuilder.tsx");
  const source = readFileSync(path, "utf8");
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const main = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.DefaultKeyword));
  expect(main, "extract from the actual admin default export, not a template modal").toBeDefined();
  const matches: ts.JsxElement[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === "Button") {
      const attributes = node.openingElement.attributes.properties;
      const label = attributes.find(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText(ast) === "aria-label");
      if (label?.getText(ast).includes('"Saving page"') && label.getText(ast).includes('"Save Page"')) matches.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(main!);
  expect(matches).toHaveLength(1);
  const element = matches[0];
  const attributes = element.openingElement.attributes.properties;
  expect(attributes.find(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText(ast) === "onClick")?.getText(ast)).toBe("onClick={handleSave}");
  expect(attributes.find(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText(ast) === "disabled")?.getText(ast)).toBe("disabled={isSaving}");
  const jsx = element.getText(ast);
  const javascript = ts.transpileModule(`const element = (${jsx});`, {
    compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return new Function("React", "Button", "Save", "compact", "isSaving", "handleSave", `${javascript}\nreturn element;`) as
    (react: typeof React, button: typeof Button, icon: typeof Save, compact: boolean, isSaving: boolean, handleSave: () => void) => React.ReactElement;
}
function AdminSourceSaveButton({ pending = false, onSave = () => undefined }: { pending?: boolean; onSave?: () => void }) {
  const compact = useCompactEditor();
  return extractedAdminSaveButton()(React, Button, Save, compact, pending, onSave);
}
describe("Actual admin landing save JSX standalone render (pre-existing whole-shell handleSave blocker)", () => {
  it.each(viewports)("%ipx / %s preserves exact visible and accessible save text", (width, pointer) => {
    installViewport(width, pointer);
    const onSave = vi.fn(), view = render(<AdminSourceSaveButton onSave={onSave} />);
    const save = view.getByRole("button", { name: "Save Page" }) as HTMLButtonElement;
    expect(save.textContent?.trim()).toBe(width < 1024 || pointer === "coarse" ? "Save" : "Save Page");
    expect(save.getAttribute("aria-label")).toBe("Save Page"); expect(save.disabled).toBe(false);
    fireEvent.click(save); expect(onSave).toHaveBeenCalledTimes(1); expect(fixture.calls).toEqual([]);
  });
  it("the exact pending JSX keeps Saving… and Saving page, and disables its existing callback", () => {
    const onSave = vi.fn(), view = render(<AdminSourceSaveButton pending onSave={onSave} />);
    const save = view.getByRole("button", { name: "Saving page" }) as HTMLButtonElement;
    expect(save.textContent?.trim()).toBe("Saving…"); expect(save.disabled).toBe(true);
    fireEvent.click(save); expect(onSave).not.toHaveBeenCalled(); expect(fixture.calls).toEqual([]);
  });
});
