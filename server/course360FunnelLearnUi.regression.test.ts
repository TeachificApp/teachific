// @vitest-environment jsdom
import React, { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Funnel360LearnSettings } from "../client/src/components/Funnel360LearnSettings";
import PublicFunnelPage from "../client/src/pages/PublicFunnelPage";
const api = vi.hoisted(() => ({ save: vi.fn(), invalidate: vi.fn(), close: vi.fn(), settings: {} as any, publicPage: {} as any }));
vi.mock("@/lib/trpc", () => ({ trpc: {
  useUtils: () => ({ invalidate: api.invalidate }),
  funnelAi: { getPageLearnSettings: { useQuery: () => ({ data: api.settings }) }, updatePageLearnSettings: { useMutation: () => ({ mutateAsync: api.save, isPending: false }) } },
  funnel360Public: { getPage: { useQuery: () => api.publicPage } },
} }));
vi.mock("wouter", () => ({ useParams: () => ({ funnelSlug: "offer", pageSlug: "first" }) }));
let root: Root; let host: HTMLDivElement;
function button(name: string) { return [...document.querySelectorAll("button")].find(b => b.textContent?.trim() === name)!; }
async function click(name: string) { await act(async () => button(name).click()); }
async function changeName(value: string) {
  const input = document.querySelector<HTMLInputElement>('input:not([type="checkbox"])')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
}
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal("React", React); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network forbidden"); }));
  api.settings = { orgId: 7, pageId: 44, title: "Authored title", displayName: null, showInLibrary: false };
  api.save.mockResolvedValue({ success: true }); api.invalidate.mockResolvedValue(undefined);
  api.publicPage = { data: { schoolName: "Actual School", logoUrl: null, canonical: "https://school.course360.app/funnel/offer/first", seoKeywords: "learning", page: { title: "Authored title", metaTitle: "SEO title", metaDescription: "Summary", showHeader: true, showFooter: true, blocksJson: JSON.stringify([{ id: "one", type: "bg_section", visible: true, data: { headline: "Plain content", body: "Factual offer" } }]) } }, isLoading: false, error: null };
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); expect(fetch).not.toHaveBeenCalled(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe("Course360 shared Learn settings actual UI", () => {
  it("sends only displayName when visibility was not edited and preserves source title", async () => {
    await act(async () => root.render(createElement(Funnel360LearnSettings, { pageId: 44, onClose: api.close })));
    expect(document.querySelector('input:not([type="checkbox"])')?.getAttribute("placeholder")).toBe("Authored title");
    await changeName("Shared card name"); await click("Save Learn settings");
    expect(api.save).toHaveBeenCalledWith({ pageId: 44, expectedOrgId: 7, displayName: "Shared card name" });
    expect(api.settings.title).toBe("Authored title"); expect(api.close).toHaveBeenCalledOnce();
  });
  it("sends visibility-only patches and retains failed local edits after query refresh", async () => {
    await act(async () => root.render(createElement(Funnel360LearnSettings, { pageId: 44, onClose: api.close })));
    await act(async () => document.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
    api.save.mockRejectedValueOnce(new Error("Save unavailable")); await click("Save Learn settings");
    api.settings = { ...api.settings, displayName: "Server refresh", showInLibrary: false };
    await act(async () => root.render(createElement(Funnel360LearnSettings, { pageId: 44, onClose: api.close })));
    expect(document.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(true);
    await click("Save Learn settings");
    expect(api.save.mock.calls[1][0]).toEqual({ pageId: 44, expectedOrgId: 7, showInLibrary: true });
  });
  it("does not turn successful setting saves into failure when cache refresh fails", async () => {
    await act(async () => root.render(createElement(Funnel360LearnSettings, { pageId: 44, onClose: api.close })));
    await changeName("New name"); api.invalidate.mockRejectedValueOnce(new Error("Cache unavailable"));
    await click("Save Learn settings"); expect(api.close).toHaveBeenCalledOnce(); expect(document.querySelector('[role="alert"]')).toBeNull();
  });
});
describe("Course360 native public page actual renderer", () => {
  it("renders actual school branding and page-specific scoped SEO with cleanup", async () => {
    document.title = "Previous title";
    await act(async () => root.render(createElement(PublicFunnelPage)));
    expect(document.body.textContent).toContain("Actual School"); expect(document.body.textContent).toContain("Plain content");
    expect(document.title).toBe("SEO title");
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe("https://school.course360.app/funnel/offer/first");
    expect(document.querySelector('meta[name="keywords"]')?.getAttribute("content")).toBe("learning");
    await act(async () => root.render(null)); expect(document.title).toBe("Previous title");
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
  });
  it("never renders prior page content when server reports page unavailable", async () => {
    api.publicPage = { error: new Error("Not found"), data: null, isLoading: false };
    await act(async () => root.render(createElement(PublicFunnelPage)));
    expect(document.body.textContent).toContain("not available"); expect(document.body.textContent).not.toContain("Plain content");
  });
});
