// @vitest-environment jsdom
import React, { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { Funnel360PageEditorDialog } from "../client/src/components/Funnel360PageEditorDialog";
import FunnelsPage from "../client/src/pages/marketing/FunnelsPage";
const api = vi.hoisted(() => ({ save: vi.fn(), close: vi.fn(), invalidate: vi.fn(), navigate: vi.fn(), data: {} as any }));
vi.mock("@/hooks/useOrgScope", () => ({ useOrgScope: () => ({ orgId: 7, ready: true }) }));
vi.mock("wouter", () => ({ useLocation: () => ["/marketing/funnels", api.navigate] }));
vi.mock("@/lib/trpc", () => ({ trpc: {
  useUtils: () => ({ invalidate: api.invalidate, funnel360: { list: { invalidate: api.invalidate } } }),
  funnel360: { list: { useQuery: () => ({ data: [], isLoading: false }) }, create: { useMutation: () => ({ isPending: false }) }, delete: { useMutation: () => ({}) },
    getStepPage: { useQuery: () => ({ data: api.data }) }, updateStepPage: { useMutation: () => ({ mutateAsync: api.save, isPending: false }) } },
  funnelAi: { generateAiDraft: { useMutation: () => ({}) }, createFromAiDraft: { useMutation: () => ({}) } },
} }));
let root: Root; let host: HTMLDivElement;
const blocks = [{ id: "one", type: "banner", visible: true, data: { headline: "Original", subtext: "Copy", backgroundColor: "#abcdef", ctaUrl: "https://school.course360.app/offer", unknownField: { preserved: true } } }, { id: "advanced", type: "embed_html", visible: false, data: { embedCode: "<iframe src='https://example.test'></iframe>", other: "keep" } }];
function button(text: string) { return [...document.querySelectorAll("button")].find(b => b.textContent?.trim() === text)!; }
async function click(text: string) { await act(async () => button(text).click()); }
async function change(labelText: string, value: string) {
  const label = [...document.querySelectorAll("label")].find(label => label.childNodes[0]?.textContent === labelText)!;
  const input = label.querySelector<HTMLInputElement | HTMLTextAreaElement>("input,textarea")!;
  const prototype = input.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => { Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
}
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal("React", React); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network forbidden"); }));
  api.data = { orgId: 7, page: { title: "Authored", metaTitle: "SEO", metaDescription: "Summary", blocksJson: JSON.stringify(blocks), isPublished: false } };
  api.save.mockResolvedValue({ success: true }); api.invalidate.mockResolvedValue(undefined);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); expect(fetch).not.toHaveBeenCalled(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe("Course360 native page editor", () => {
  it("saves only explicit fields, preserving every original layout/unknown block and never changes slug", async () => {
    await act(async () => root.render(createElement(Funnel360PageEditorDialog, { stepId: 10, onClose: api.close })));
    await change("headline", "Edited headline"); await click("Save page");
    const payload = api.save.mock.calls[0][0]; expect(payload.expectedOrgId).toBe(7); expect(payload.slug).toBeUndefined();
    const saved = JSON.parse(payload.blocksJson); expect(saved[0]).toEqual({ ...blocks[0], data: { ...blocks[0].data, headline: "Edited headline" } });
    expect(saved[1]).toEqual(blocks[1]); expect(payload.isPublished).toBe(false); expect(api.close).toHaveBeenCalledOnce();
  });
  it("retains failed local edits and does not run advanced embeds during inert preview", async () => {
    await act(async () => root.render(createElement(Funnel360PageEditorDialog, { stepId: 10, onClose: api.close })));
    await change("headline", "Keep edited"); api.save.mockRejectedValueOnce(new Error("Save failed")); await click("Save page");
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Save failed");
    await click("Inert preview"); expect(document.querySelectorAll("iframe,script")).toHaveLength(0); expect(document.body.textContent).toContain("Keep edited");
    await click("Save page"); expect(api.save.mock.calls[1][0]).toEqual(api.save.mock.calls[0][0]);
  });
});
describe("Course360 routed New Funnel preservation", () => {
  it("preserves the New Funnel name dialog and adds an independent AI Generate entry", async () => {
    await act(async () => root.render(createElement(FunnelsPage)));
    expect(button("New Funnel")).toBeDefined(); expect(button("AI Generate")).toBeDefined();
    await click("New Funnel"); expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Funnel Name");
    expect(document.body.textContent).not.toContain("AI Landing Page");
    await click("Cancel"); await click("AI Generate");
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("AI Landing Page");
    expect(api.navigate).not.toHaveBeenCalled();
  });
});
