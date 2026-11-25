// @vitest-environment jsdom
import React, { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { FunnelAiCreateDialog } from "../client/src/components/FunnelAiCreateDialog";
import { funnelAiDraftSchema, type FunnelAiDraft, type FunnelAiPage, type FunnelAiSection } from "../shared/funnelAi";

const api = vi.hoisted(() => ({
  generate: vi.fn(),
  create: vi.fn(),
  invalidate: vi.fn(),
  onClose: vi.fn(),
  onCreated: vi.fn(),
  navigate: vi.fn(),
  legacyCreate: vi.fn(),
  addPage: vi.fn(),
  update: vi.fn(),
  updatePage: vi.fn(),
  reorder: vi.fn(),
  preview: vi.fn(),
  funnelList: [],
  templates: [],
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ invalidate: api.invalidate }),
    funnelAi: {
      generateAiDraft: { useMutation: () => ({ mutateAsync: api.generate, isPending: false }) },
      createFromAiDraft: { useMutation: () => ({ mutateAsync: api.create, isPending: false }) },
      list: { useQuery: () => ({ data: api.funnelList, isLoading: false, refetch: vi.fn() }) },
      listTemplates: { useQuery: () => ({ data: api.templates }) },
      reorderFunnels: { useMutation: () => ({ mutate: api.reorder }) },
      create: { useMutation: () => ({ mutateAsync: api.legacyCreate, isPending: false }) },
      addPage: { useMutation: () => ({ mutateAsync: api.addPage }) },
      update: { useMutation: () => ({ mutateAsync: api.update }) },
      updatePage: { useMutation: () => ({ mutateAsync: api.updatePage }) },
    },
  },
}));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("wouter", () => ({
  useParams: () => ({}),
  useLocation: () => ["/admin/funnels", api.navigate],
  Link: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => createElement("a", { href, ...props }, children),
}));
// Real native PageBuilder rendering; external RPCs are mocked and network forbidden.
vi.mock("@/components/PageBuilder", async importOriginal => {
  const actual = await importOriginal<typeof import("../client/src/components/PageBuilder")>();
  return { ...actual, renderBlockPreview: (block: any) => {
    api.preview(block); return actual.renderBlockPreview(block);
  } };
});

function section(kind: FunnelAiSection["kind"], patch: Partial<FunnelAiSection> = {}): FunnelAiSection {
  return { kind, headline: `${kind} headline`, body: `${kind} copy`, items: [], questions: [], buttonText: "", ...patch };
}
function page(pageType: FunnelAiPage["pageType"], index: number): FunnelAiPage {
  return {
    pageType, title: `Page ${index + 1} ${pageType}`, seoTitle: `SEO ${index + 1}`, seoDescription: `Description ${index + 1}`, seoKeywords: "echo, education",
    sections: [
      section("hero", { headline: `Hero ${index + 1}`, buttonText: "Explore the offer" }),
      section("text", { body: "Plain educational offer copy" }),
      section("bullets", { items: ["First benefit", "Second benefit"] }),
      section("faq", { questions: [{ q: "Who is this for?", a: "Sonographers seeking further education." }] }),
      section("cta", { buttonText: "Continue to offer" }),
    ],
  };
}
function fixture(types: FunnelAiPage["pageType"][] = ["landing"], ctaUrl = "https://example.test/offer"): FunnelAiDraft {
  return funnelAiDraftSchema.parse({ mode: types.length === 1 ? "landing" : "funnel", name: "AI echo offer", description: "A new educational offer", ctaUrl, pages: types.map(page) });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
let root: Root;
let host: HTMLDivElement;
let forbiddenFetch: ReturnType<typeof vi.fn>;
let forbiddenXhr: MockInstance<typeof window.XMLHttpRequest.prototype.open>;
let forbiddenOpen: MockInstance<typeof window.open>;
let confirmation: MockInstance<typeof window.confirm>;
let uuid: MockInstance<typeof crypto.randomUUID>;
function button(text: string): HTMLButtonElement {
  const found = Array.from(document.body.querySelectorAll("button")).find(node => node.textContent?.trim() === text);
  if (!found) throw new Error(`Button missing: ${text}`);
  return found;
}
function field(label: string, index = 0): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement {
  const found = Array.from(document.body.querySelectorAll("label")).filter(node => node.textContent?.trim() === label)[index];
  const control = found?.htmlFor ? document.getElementById(found.htmlFor) : found?.querySelector("input");
  if (!control) throw new Error(`Control missing: ${label} (${index})`);
  return control as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
}
async function change(label: string, value: string, index = 0) {
  const control = field(label, index);
  const prototype = control.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : control.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(control, value);
    control.dispatchEvent(new Event("input", { bubbles: true }));
    control.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
async function click(text: string) { await act(async () => button(text).click()); }
async function review() {
  const checkbox = document.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
  await act(async () => checkbox.click());
}
async function mount() {
  await act(async () => root.render(createElement(FunnelAiCreateDialog, { onClose: api.onClose, onCreated: api.onCreated })));
}
async function fill() {
  await change("Name", "Echo educational offer");
  await change("Offer / topic / details", "Explain the educational offer and outcomes.");
  await change("Audience", "Working sonographers");
  await change("Goal", "Enroll in the echo course");
  await change("CTA URL (optional)", "https://example.test/offer");
}
async function generateDraft(draft = fixture()) {
  api.generate.mockResolvedValueOnce({ orgId: 7, draft });
  await fill();
  await click("Generate Draft");
}

beforeEach(async () => {
  vi.clearAllMocks();
  api.generate.mockReset();
  api.create.mockReset().mockResolvedValue({ id: 812, slug: "new-ai-offer", pageIds: [101] });
  api.invalidate.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  // Existing FunnelBuilder uses the repository's classic JSX test transform.
  vi.stubGlobal("React", React);
  forbiddenFetch = vi.fn(() => { throw new Error("Live network forbidden"); });
  vi.stubGlobal("fetch", forbiddenFetch);
  forbiddenXhr = vi.spyOn(window.XMLHttpRequest.prototype, "open").mockImplementation(() => { throw new Error("XHR forbidden"); });
  forbiddenOpen = vi.spyOn(window, "open").mockImplementation(() => { throw new Error("Navigation forbidden"); });
  confirmation = vi.spyOn(window, "confirm").mockReturnValue(true);
  let sequence = 0;
  uuid = vi.spyOn(crypto, "randomUUID").mockImplementation(() => `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`);
  window.history.replaceState({}, "", "/admin/funnels");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  expect(forbiddenFetch).not.toHaveBeenCalled();
  expect(forbiddenXhr).not.toHaveBeenCalled();
  expect(forbiddenOpen).not.toHaveBeenCalled();
  for (const mutation of [api.legacyCreate, api.addPage, api.update, api.updatePage, api.reorder]) expect(mutation).not.toHaveBeenCalled();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("actual AI create dialog: new drafts only", () => {
  it("requires valid generation details and never creates until explicit review and Create Draft", async () => {
    await mount();
    expect(button("Generate Draft").disabled).toBe(true);
    expect(button("Create Draft").disabled).toBe(true);
    await fill();
    await change("CTA URL (optional)", "javascript:alert(1)");
    expect(button("Generate Draft").disabled).toBe(true);
    expect(api.generate).not.toHaveBeenCalled();
    await change("CTA URL (optional)", "https://example.test/offer");
    const draft = fixture();
    api.generate.mockResolvedValueOnce({ orgId: 7, draft });
    await click("Generate Draft");
    expect(api.generate).toHaveBeenCalledTimes(1);
    expect(api.generate).toHaveBeenCalledWith({ mode: "landing", name: "Echo educational offer", prompt: "Explain the educational offer and outcomes.", audience: "Working sonographers", goal: "Enroll in the echo course", ctaUrl: "https://example.test/offer", pageTypes: ["landing"] });
    expect(api.create).not.toHaveBeenCalled();
    expect(api.invalidate).not.toHaveBeenCalled();
    expect(button("Create Draft").disabled).toBe(true);
    expect(document.querySelectorAll("article")).toHaveLength(1);
    expect(document.body.textContent).toContain("Education Library default off");
    expect(document.body.textContent).toContain("owning school");
    expect(document.body.textContent).toContain("Existing pages remain untouched");
    await review();
    await click("Create Draft");
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.create).toHaveBeenCalledWith({ requestId: "00000000-0000-4000-8000-000000000001", draft, expectedOrgId: 7 });
    expect(api.invalidate).toHaveBeenCalledOnce();
    expect(api.onCreated).toHaveBeenCalledTimes(1);
    expect(api.onCreated).toHaveBeenCalledWith(812);
    expect(button("Draft Created").disabled).toBe(true);
    await click("Draft Created");
    expect(api.create).toHaveBeenCalledOnce();
  });

  it("requests ordered funnel steps with native 2–5 count/type selects and landing is always one", async () => {
    await mount();
    await fill();
    await change("Type", "funnel");
    expect(field("Step count").value).toBe("3");
    expect(field("Step 2 page type").value).toBe("checkout");
    expect(field("Step 3 page type").value).toBe("thank_you");
    expect(Array.from((field("Step count") as HTMLSelectElement).options, item => item.value)).toEqual(["2", "3", "4", "5"]);
    await change("Step count", "5");
    await change("Step 3 page type", "upsell");
    await change("Step 4 page type", "downsell");
    const draft = fixture(["landing", "checkout", "upsell", "downsell", "thank_you"]);
    api.generate.mockResolvedValueOnce({ orgId: 7, draft });
    await click("Generate Draft");
    expect(api.generate.mock.calls[0][0].pageTypes).toEqual(["landing", "checkout", "upsell", "downsell", "thank_you"]);
    expect(document.querySelectorAll("article")).toHaveLength(5);
    expect(document.body.textContent).toContain("Pages will be linked in this order");
    expect(document.body.textContent).toContain("Checkout needs products attached");
    await review();
    await click("Create Draft");
    expect(api.create.mock.calls[0][0].draft).toEqual(draft);
  });

  it("switches back to landing without leaking retained funnel steps into generation", async () => {
    await mount();
    await fill();
    await change("Type", "funnel");
    await change("Step count", "2");
    await change("Step 2 page type", "custom");
    await change("Type", "landing");
    api.generate.mockResolvedValueOnce({ orgId: 7, draft: fixture() });
    await click("Generate Draft");
    expect(api.generate.mock.calls[0][0]).toMatchObject({ mode: "landing", pageTypes: ["landing"] });
  });

  it("saves edited name, metadata, plain copy, bullet and FAQ fields as a complete reviewed draft", async () => {
    const original = fixture();
    const snapshot = structuredClone(original);
    await mount();
    await generateDraft(original);
    await review();
    await change("Draft name", "Owner's edited draft");
    expect(button("Create Draft").disabled).toBe(true);
    await change("Draft description", "Edited description");
    await change("Draft CTA URL (optional)", "/safe-offer");
    await change("Page title", "Edited page title");
    await change("SEO title", "Edited SEO title");
    await change("SEO description", "Edited search description");
    await change("SEO keywords", "echo, revised");
    await change("Section headline", "Edited hero headline");
    await change("Section copy", "Edited hero copy");
    await change("Button text", "Explore edited offer");
    await change("Bullets (one per line)", "Edited first benefit\nEdited second benefit");
    await change("FAQ 1 question", "Edited FAQ question?");
    await change("FAQ 1 answer", "Edited FAQ answer.");
    expect(api.create).not.toHaveBeenCalled();
    await review();
    await click("Create Draft");
    const payload = api.create.mock.calls[0][0];
    expect(Object.keys(payload).sort()).toEqual(["draft", "expectedOrgId", "requestId"]);
    expect(payload.draft).toEqual({
      ...snapshot, name: "Owner's edited draft", description: "Edited description", ctaUrl: "/safe-offer",
      pages: [{ ...snapshot.pages[0], title: "Edited page title", seoTitle: "Edited SEO title", seoDescription: "Edited search description", seoKeywords: "echo, revised",
        sections: [
          { ...snapshot.pages[0].sections[0], headline: "Edited hero headline", body: "Edited hero copy", buttonText: "Explore edited offer" },
          snapshot.pages[0].sections[1],
          { ...snapshot.pages[0].sections[2], items: ["Edited first benefit", "Edited second benefit"] },
          { ...snapshot.pages[0].sections[3], questions: [{ q: "Edited FAQ question?", a: "Edited FAQ answer." }] },
          snapshot.pages[0].sections[4],
        ] }],
    });
    expect(funnelAiDraftSchema.safeParse(payload.draft).success).toBe(true);
    expect(original).toEqual(snapshot);
  });

  it("keeps previous edited draft on failed regeneration and confirms before any successful replacement", async () => {
    await mount();
    await generateDraft();
    await change("Page title", "Keep local edits");
    await review();
    confirmation.mockReturnValueOnce(false);
    await click("Generate New Draft");
    expect(api.generate).toHaveBeenCalledOnce();
    expect(field("Page title").value).toBe("Keep local edits");
    api.generate.mockRejectedValueOnce(new Error("Synthetic generation failure"));
    await click("Generate New Draft");
    expect(field("Page title").value).toBe("Keep local edits");
    expect(button("Create Draft").disabled).toBe(false);
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Synthetic generation failure");
    expect(api.invalidate).not.toHaveBeenCalled();
    expect(api.create).not.toHaveBeenCalled();
    const next = fixture();
    next.pages[0].title = "Explicit replacement";
    api.generate.mockResolvedValueOnce({ orgId: 7, draft: next });
    await click("Generate New Draft");
    expect(field("Page title").value).toBe("Explicit replacement");
    expect(button("Create Draft").disabled).toBe(true);
    expect(confirmation.mock.lastCall?.[0]).toContain("only if generation succeeds");
  });

  it.each(["incomplete", "wrong_steps"])("rejects %s generated drafts instead of saving or replacing prior edits", async kind => {
    await mount();
    await generateDraft();
    await change("Page title", "Preserved title");
    const bad = fixture();
    if (kind === "incomplete") bad.pages[0].sections[0].body = "";
    else bad.pages[0].pageType = "custom";
    api.generate.mockResolvedValueOnce({ orgId: 7, draft: bad });
    await click("Generate New Draft");
    expect(field("Page title").value).toBe("Preserved title");
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("incomplete draft");
    expect(api.create).not.toHaveBeenCalled();
  });

  it("preserves failed-save edits and review, reuses unchanged request ID, rotates ID after subsequent local edits", async () => {
    await mount();
    await generateDraft();
    await change("Page title", "Reviewed edited title");
    await review();
    api.create.mockRejectedValueOnce(new Error("Synthetic save failure"));
    api.create.mockRejectedValueOnce(new Error("Second save failure"));
    await click("Create Draft");
    const first = api.create.mock.calls[0][0];
    expect(field("Page title").value).toBe("Reviewed edited title");
    expect(button("Create Draft").disabled).toBe(false);
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Synthetic save failure");
    expect(api.invalidate).not.toHaveBeenCalled();
    expect(api.onCreated).not.toHaveBeenCalled();
    await click("Create Draft");
    expect(api.create.mock.calls[1][0]).toEqual(first);
    await change("Page title", "A newly edited version after failure");
    expect(button("Create Draft").disabled).toBe(true);
    await review();
    await click("Create Draft");
    const third = api.create.mock.calls[2][0];
    expect(third.requestId).not.toBe(first.requestId);
    expect(third.draft.pages[0].title).toBe("A newly edited version after failure");
    expect(api.invalidate).toHaveBeenCalledOnce();
    expect(api.onCreated).toHaveBeenCalledOnce();
  });

  it("tracks the actual generation/create promise and synchronously guards duplicate clicks and edits while pending", async () => {
    await mount();
    await fill();
    const generating = deferred<{ orgId: number; draft: FunnelAiDraft }>();
    api.generate.mockReturnValueOnce(generating.promise);
    const generateButton = button("Generate Draft");
    await act(async () => { generateButton.click(); generateButton.click(); });
    expect(api.generate).toHaveBeenCalledOnce();
    expect(button("Generating…").disabled).toBe(true);
    expect(field("Name").matches(":disabled")).toBe(true);
    expect(button("Create Draft").disabled).toBe(true);
    await act(async () => generating.resolve({ orgId: 7, draft: fixture() }));
    await review();
    const saving = deferred<{ id: number; slug: string; pageIds: number[] }>();
    api.create.mockReturnValueOnce(saving.promise);
    const createButton = button("Create Draft");
    await act(async () => { createButton.click(); createButton.click(); });
    expect(api.create).toHaveBeenCalledOnce();
    expect(button("Creating…").disabled).toBe(true);
    expect(field("Page title").matches(":disabled")).toBe(true);
    expect(button("Close").disabled).toBe(true);
    await click("Close");
    expect(api.onClose).not.toHaveBeenCalled();
    await act(async () => saving.resolve({ id: 19, slug: "new-only", pageIds: [20] }));
    expect(api.onCreated).toHaveBeenCalledTimes(1);
    expect(api.onCreated).toHaveBeenCalledWith(19);
  });

  it("disables creation for invalid local page/SEO/copy/URL fields until valid and reviewed again", async () => {
    await mount();
    await generateDraft();
    for (const [label, invalid, valid] of [
      ["Draft name", "", "Fixed draft name"],
      ["Page title", " ", "Fixed page title"],
      ["SEO description", "", "Valid SEO description"],
      ["Section copy", "", "Valid hero copy"],
      ["Bullets (one per line)", "", "Valid benefit"],
      ["FAQ 1 answer", "", "Valid answer"],
      ["Draft CTA URL (optional)", "javascript:alert(1)", "/safe-final"],
    ]) {
      await review();
      expect(button("Create Draft").disabled).toBe(false);
      await change(label, invalid);
      expect(button("Create Draft").disabled).toBe(true);
      expect(document.querySelector('input[type="checkbox"]')?.matches(":disabled")).toBe(true);
      await click("Create Draft");
      expect(api.create).not.toHaveBeenCalled();
      await change(label, valid);
      expect(button("Create Draft").disabled).toBe(true);
    }
  });

  it.each(["async", "sync"])("a %s cache invalidation failure never converts successful creation into a failed save", async mode => {
    await mount();
    await generateDraft();
    await review();
    if (mode === "async") api.invalidate.mockRejectedValueOnce(new Error("Cache unavailable"));
    else api.invalidate.mockImplementationOnce(() => { throw new Error("Cache unavailable"); });
    await click("Create Draft");
    expect(api.create).toHaveBeenCalledOnce();
    expect(api.onCreated).toHaveBeenCalledTimes(1);
    expect(api.onCreated).toHaveBeenCalledWith(812);
    expect(document.querySelector('[role="alert"]')).toBeNull();
    expect(button("Draft Created").disabled).toBe(true);
  });

  it("renders all native supported blocks in editor mode inside inert previews with no active links, media, checkout, or network", async () => {
    const draft = fixture(["landing", "checkout", "thank_you"]);
    draft.pages[0].sections[0].headline = '<img src="https://unsafe.test/pixel" onerror="alert(1)">';
    draft.pages[0].sections[1].body = '<script>alert(1)</script><a href="javascript:alert(1)">unsafe</a>';
    draft.pages[0].sections[3].questions[0].a = '<iframe src="https://unsafe.test/embed"></iframe>';
    await mount();
    await fill();
    await change("Type", "funnel");
    api.generate.mockResolvedValueOnce({ orgId: 7, draft });
    await click("Generate Draft");
    await click("Preview");
    const previews = document.querySelectorAll('[aria-label^="Inert preview"]');
    expect(previews).toHaveLength(3);
    expect(new Set(api.preview.mock.calls.map(([block]) => block.type))).toEqual(new Set(["banner", "bg_section", "checklist", "faq", "cta"]));
    for (const preview of previews) {
      expect(preview.hasAttribute("inert")).toBe(true);
      expect(preview.querySelectorAll("img, video, iframe, form, script")).toHaveLength(0);
      expect(preview.querySelector("details")).not.toBeNull();
      for (const node of preview.querySelectorAll("button")) {
        const event = new MouseEvent("click", { bubbles: true, cancelable: true });
        await act(async () => { node.dispatchEvent(event); });
        expect(event.defaultPrevented).toBe(true);
        const keyboard = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
        await act(async () => { node.dispatchEvent(keyboard); });
        expect(keyboard.defaultPrevented).toBe(true);
      }
    }
    expect(previews[0].textContent).toContain('<img src="https://unsafe.test/pixel"');
    expect(previews[0].textContent).toContain('<script>alert(1)</script>');
    expect(document.body.textContent).toContain("https://example.test/offer");
    expect(api.create).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/admin/funnels");
    await click("Copy");
    expect(field("Section headline").value).toBe(draft.pages[0].sections[0].headline);
  });

  it("warns that an empty final CTA must be configured before publishing and does not start checkout", async () => {
    await mount();
    await generateDraft(fixture(["landing"], ""));
    expect(document.body.textContent).toContain("Empty final CTA: configure a destination in the editor before publishing");
    await click("Preview");
    const finalCta = api.preview.mock.calls.map(([block]) => block).find(block => block.type === "cta");
    expect(finalCta.data).toMatchObject({ ctaText: "", ctaUrl: "" });
    const preview = document.querySelector('[aria-label^="Inert preview"]')!;
    for (const node of preview.querySelectorAll("button")) await act(async () => node.click());
    expect(api.create).not.toHaveBeenCalled();
  });

  it("confirms close for unsaved edits, preserves declined discards, and ignores late generation after closing", async () => {
    await mount();
    await generateDraft();
    await change("Page title", "Keep on declined close");
    confirmation.mockReturnValueOnce(false);
    await click("Close");
    expect(api.onClose).not.toHaveBeenCalled();
    expect(field("Page title").value).toBe("Keep on declined close");
    const pending = deferred<{ orgId: number; draft: FunnelAiDraft }>();
    api.generate.mockReturnValueOnce(pending.promise);
    await click("Generate New Draft");
    await click("Close");
    expect(api.onClose).toHaveBeenCalledOnce();
    const late = fixture();
    late.pages[0].title = "Late response must be ignored";
    await act(async () => pending.resolve({ orgId: 7, draft: late }));
    expect(field("Page title").value).toBe("Keep on declined close");
    expect(api.create).not.toHaveBeenCalled();
    expect(api.onCreated).not.toHaveBeenCalled();
  });

  it.each(["generate", "create"])("ignores stale %s callbacks on unmount", async mode => {
    await mount();
    const pending = deferred<any>();
    if (mode === "generate") {
      await fill();
      api.generate.mockReturnValueOnce(pending.promise);
      await click("Generate Draft");
    } else {
      await generateDraft();
      await review();
      api.create.mockReturnValueOnce(pending.promise);
      await click("Create Draft");
    }
    await act(async () => root.render(null));
    await act(async () => pending.resolve(mode === "generate" ? { orgId: 7, draft: fixture() } : { id: 999, slug: "late", pageIds: [1] }));
    expect(api.onClose).not.toHaveBeenCalled();
    expect(api.onCreated).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(uuid).toHaveBeenCalledTimes(mode === "generate" ? 0 : 1);
  });
});

