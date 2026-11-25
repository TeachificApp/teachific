// @vitest-environment jsdom
import React, { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import * as icons from "lucide-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Execute complete actual production declarations, not copies of their behavior.
 * Only unrelated UI wrappers/services are substituted; all remote hooks consume
 * real React hooks so conditional hook regressions remain observable. No API or
 * image resource is loaded by these local jsdom tests. */
function load(path: string, names: string[], context: Record<string, any>, inputs = false) {
  const source = readFileSync(resolve(process.cwd(), path), "utf8");
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = names.map(name => {
    const node = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name);
    if (!node) throw new Error(`Missing actual declaration ${name}`);
    return node.getText(ast).replace(/^export\s+default\s+/, "").replace(/^export\s+/, "");
  });
  if (inputs) {
    const inputAst = ts.createSourceFile("inputs.tsx", readFileSync(resolve(process.cwd(), "client/src/components/DebouncedInput.tsx"), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    for (const name of ["DebouncedInput", "DebouncedTextarea"]) {
      const node = inputAst.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name);
      if (!node) throw new Error(`Missing ${name}`);
      declarations.push(node.getText(inputAst).replace(/^export\s+/, ""));
    }
  }
  const js = ts.transpileModule(declarations.join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None, jsx: ts.JsxEmit.React } }).outputText;
  return new Function(...Object.keys(context), `${js}\nreturn ${names[0]};`)(...Object.values(context)) as React.ComponentType<any>;
}
let authUser: any = { id: 11, name: "Synthetic Admin" };
let availabilityQuery: any = { data: { status: "open" }, isLoading: false };
let courseQuery: any = { data: undefined, isLoading: true };
let pageQuery: any = { data: undefined, isLoading: true, error: null };
const mutation = vi.fn();
function endpoint(path: string[] = []): any {
  return new Proxy({}, { get(_target, key: string) {
    if (key === "useQuery") return function useMockQuery() {
      React.useState(null);
      const name = path.join(".");
      if (name === "lms.pages.getBySlug") return pageQuery;
      if (name === "lmsPublic.getCourse") return courseQuery;
      if (name === "contentAvailability.getAvailability") return availabilityQuery;
      if (name === "orgs.publicSchoolBySlug") return { data: { id: 9, name: "Actual Organization" }, isLoading: false };
      if (name === "lms.publicSchool.themeBySlug") return { data: { primaryColor: "#123456" }, isLoading: false };
      return { data: [], isLoading: false };
    };
    if (key === "useUtils") return function useMockUtils() { React.useRef(null); return { auth: { me: { invalidate: vi.fn() } } }; };
    if (key === "useMutation") return function useMockMutation() {
      React.useState(false); React.useRef(null);
      return { isPending: false, mutate: mutation, mutateAsync: mutation };
    };
    return endpoint([...path, key]);
  } });
}
const pass = ({ children }: any) => children;
const context: Record<string, any> = {
  React, ...Object.fromEntries(Object.entries(icons).filter(([name]) => name !== "default")), useState: React.useState, useEffect: React.useEffect, useRef: React.useRef,
  useCallback: React.useCallback, useMemo: React.useMemo,
  trpc: endpoint(), getSubdomain: () => "synthetic-school", toast: { error: vi.fn(), success: vi.fn() },
  Input: (props: any) => createElement("input", props), Textarea: (props: any) => createElement("textarea", props),
  ButtonSubtext: () => null, DndContext: pass, SortableContext: pass,
  PointerSensor: {}, closestCenter: () => undefined, restrictToVerticalAxis: () => undefined,
  restrictToFirstScrollableAncestor: () => undefined, verticalListSortingStrategy: {},
  useSensor: (...args: any[]) => React.useMemo(() => args, []),
  useSensors: (...args: any[]) => React.useMemo(() => args, []),
  useSortable: () => { React.useRef(null); return { attributes: {}, listeners: {}, setNodeRef: () => {}, transform: null, transition: undefined }; },
  CSS: { Transform: { toString: () => undefined } },
  arrayMove: (items: any[], from: number, to: number) => { const next = [...items]; next.splice(to, 0, next.splice(from, 1)[0]); return next; },
};
const BlockSettings = load("client/src/pages/lms/LandingPageBuilder.tsx", ["BlockSettings", "BSTextField", "BSColorField", "SortableReviewItem"], context, true);
const RenderBlock = load("client/src/pages/lms/CourseLanding.tsx", ["RenderBlock", "resolveBtnAction", "handleCtaBtnClick"], context);
const CourseLanding = load("client/src/pages/lms/CourseLanding.tsx", ["CourseLanding", "RenderBlock", "resolveBtnAction", "handleCtaBtnClick", "formatPrice", "formatPricingOption", "accessLabel"], {
  ...context, TYPE_ICONS: {},
  useParams: () => { React.useState(null); return { slug: "synthetic-course" }; },
  useLocation: () => { React.useState(null); return ["/courses/synthetic-course", vi.fn()]; },
  useAuth: () => { React.useState(null); return { user: authUser }; },
  getStoredAffiliateCode: () => null, getLoginUrl: () => "/login",
  OrderBumpOffer: () => null, PromoCodeInput: () => null,
  Button: ({ children, size, variant, ...props }: any) => createElement("button", props, children),
  Link: ({ children, href }: any) => createElement("a", { href }, children),
  Badge: pass, Skeleton: () => createElement("div", null, "Loading"),
  Dialog: ({ children, open }: any) => open ? children : null,
  DialogContent: pass, DialogHeader: pass, DialogTitle: pass, DialogDescription: pass, Label: pass,
  Accordion: pass, AccordionContent: pass, AccordionItem: pass, AccordionTrigger: pass,
});
const PublicPagePage = load("client/src/pages/PublicPagePage.tsx", ["PublicPagePage"], {
  ...context, useRoute: (path: string) => { React.useState(null); return [true, path.startsWith("/school") ? { orgSlug: "synthetic-school", slug: "synthetic-page" } : undefined]; },
  sanitizeCss: (css: string) => css,
  renderBlockPreview: (block: any) => createElement("p", null, block.data?.text ?? "Saved content"),
});
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;
let errors: unknown[];
beforeEach(() => {
  errors = []; mutation.mockClear();
  courseQuery = { data: undefined, isLoading: true };
  authUser = { id: 11, name: "Synthetic Admin" };
  availabilityQuery = { data: { status: "open" }, isLoading: false };
  window.history.replaceState({}, "", "/courses/synthetic-course");
  pageQuery = { data: undefined, isLoading: true, error: null };
  host = document.createElement("div"); document.body.append(host);
  root = createRoot(host, { onUncaughtError: error => errors.push(error) });
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });
async function render(component: React.ComponentType<any>, props = {}) {
  await act(async () => root.render(createElement(component, props)));
  expect(errors.map(String)).toEqual([]);
}
const block = (type: string, data: any = {}, id = type) => ({ id, type, data });
async function edit(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => input.dispatchEvent(new FocusEvent("focusout", { bubbles: true })));
}

describe("Course360 actual landing editor hook and avatar regressions", () => {
  it.each(["testimonial", "reviews"])("repeatedly switches same-mounted settings to/from %s without more/fewer hooks", async type => {
    const onChange = vi.fn();
    const data = type === "testimonial" ? { quote: "Original quote", author: "Owner author", avatarUrl: "https://assets.invalid/avatar.png", rating: 4 } : { reviews: [{ name: "Owner reviewer", text: "Original review", rating: 4, avatarUrl: "https://assets.invalid/avatar.png" }] };
    for (const selected of [block("spacer"), block(type, data), block("divider"), block(type, data), block("spacer")]) await render(BlockSettings, { block: selected, onChange });
    expect(onChange).not.toHaveBeenCalled(); expect(mutation).not.toHaveBeenCalled();
  });
  it("edits only the newly selected review avatar while preserving quote, rating and opaque saved data", async () => {
    const previous = vi.fn(), current = vi.fn();
    await render(BlockSettings, { block: block("testimonial", { quote: "Old" }), onChange: previous });
    const data = { bgColor: "#123456", custom: "preserved", reviews: [{ name: "Actual saved name", text: "Keep exact quote", rating: 5, avatarUrl: "https://assets.invalid/saved.png", opaque: "metadata" }] };
    await render(BlockSettings, { block: block("reviews", data), onChange: current });
    expect(host.querySelector('img[alt="Avatar"]')?.getAttribute("src")).toBe(data.reviews[0].avatarUrl);
    await edit(host.querySelector('input[placeholder="Avatar URL (optional)"]')!, "https://assets.invalid/new.png");
    expect(current).toHaveBeenLastCalledWith({ ...data, reviews: [{ ...data.reviews[0], avatarUrl: "https://assets.invalid/new.png" }] });
    expect(previous).not.toHaveBeenCalled(); expect(mutation).not.toHaveBeenCalled();
  });
  it("removes a testimonial avatar locally without clearing the saved testimonial", async () => {
    const onChange = vi.fn(); const data = { quote: "Saved quote", author: "Saved author", rating: 4, avatarUrl: "https://assets.invalid/original.png", accentColor: "#123456" };
    await render(BlockSettings, { block: block("testimonial", data), onChange });
    await act(async () => (host.querySelector('button[title="Remove avatar"]') as HTMLButtonElement).click());
    expect(onChange).toHaveBeenLastCalledWith({ ...data, avatarUrl: "" });
  });
});

describe("Course360 actual public block behavior", () => {
  function props(selected: any, extra = {}) { return { block: selected, course: {}, onEnroll: vi.fn(), onEnrollWithOption: vi.fn(), enrolling: false, ctaText: "Enroll Now", price: "$49.97", ...extra }; }
  it("rich text checkout delegates to its real onEnroll prop instead of an out-of-scope callback", async () => {
    const data = props(block("text", { html: '<button data-cta-btn="true" data-action="direct_checkout">Saved checkout</button>' }));
    await render(RenderBlock, data);
    await act(async () => (host.querySelector("button") as HTMLButtonElement).click());
    expect(data.onEnroll).toHaveBeenCalledTimes(1); expect(mutation).not.toHaveBeenCalled();
  });
  it("rich text pricing option preserves the selected option", async () => {
    const data = props(block("text", { html: '<button data-cta-btn="true" data-action="pricing_option" data-pricing-option="123">Select</button>' }));
    await render(RenderBlock, data); await act(async () => (host.querySelector("button") as HTMLButtonElement).click());
    expect(data.onEnrollWithOption).toHaveBeenCalledTimes(1); expect(data.onEnrollWithOption).toHaveBeenCalledWith(123); expect(data.onEnroll).not.toHaveBeenCalled();
  });
  it.each(["pricing_cta", "cta_standalone"])("draft %s invokes optional notification exactly once and never enrollment", async type => {
    const onDraftNotify = vi.fn(); const data = props(block(type, { ctaText: "Preserve saved copy", ctaBehavior: "direct_checkout" }), { isDraft: true, onDraftNotify });
    await render(RenderBlock, data); expect(host.textContent).toContain("Enrollment Closed");
    await act(async () => (host.querySelector("button") as HTMLButtonElement).click());
    expect(onDraftNotify).toHaveBeenCalledTimes(1); expect(data.onEnroll).not.toHaveBeenCalled(); expect(data.onEnrollWithOption).not.toHaveBeenCalled();
  });
  it.each(["pricing_cta", "cta_standalone"])("draft %s without callback safely disables its CTA", async type => {
    const data = props(block(type), { isDraft: true }); await render(RenderBlock, data);
    expect((host.querySelector("button") as HTMLButtonElement).disabled).toBe(true);
  });
  it.each(["pricing_cta", "cta_standalone"])("published %s keeps existing pricing-option action and saved copy", async type => {
    const data = props(block(type, { ctaText: "Exact saved copy", ctaBehavior: "pricing_option", ctaPricingOptionId: 123 }));
    await render(RenderBlock, data); expect(host.textContent).toContain("Exact saved copy");
    await act(async () => (host.querySelector("button") as HTMLButtonElement).click());
    expect(data.onEnrollWithOption).toHaveBeenCalledTimes(1); expect(data.onEnrollWithOption).toHaveBeenCalledWith(123);
  });
  it("propagates optional draft callback into nested columns", async () => {
    const onDraftNotify = vi.fn(); const data = props(block("column_layout", { leftBlocks: [block("pricing_cta")], rightBlocks: [] }), { isDraft: true, onDraftNotify });
    await render(RenderBlock, data); await act(async () => (host.querySelector("button") as HTMLButtonElement).click());
    expect(onDraftNotify).toHaveBeenCalledTimes(1); expect(data.onEnroll).not.toHaveBeenCalled();
  });
  it("renders saved reviewer avatar, exact copy and custom card color without API calls", async () => {
    await render(RenderBlock, props(block("reviews", { cardBgColor: "#123456", reviews: [{ name: "Saved author", text: "Saved quote", rating: 5, avatarUrl: "https://assets.invalid/original.png" }] })));
    expect(host.textContent).toContain("Saved quote"); expect(host.textContent).toContain("Saved author");
    expect(host.querySelector("img")?.getAttribute("src")).toBe("https://assets.invalid/original.png");
    expect((host.querySelector(".shadow-sm") as HTMLElement).style.backgroundColor).toBe("rgb(18, 52, 86)");
    expect(mutation).not.toHaveBeenCalled();
  });
});

describe("Course360 actual school standalone CMS page lifecycle", () => {
  it("keeps the same mounted page hook-safe through loading, ready, blank SEO and error, restoring title on exit", async () => {
    document.title = "Course360 organization title";
    await render(PublicPagePage);
    pageQuery = { data: { metaTitle: "Actual school page", blocksJson: JSON.stringify([{ id: "content", visible: true, data: { text: "Exact original content" } }, { id: "hidden", visible: false, data: { text: "Do not show hidden" } }]), customCss: "" }, isLoading: false, error: null };
    await render(PublicPagePage); expect(document.title).toBe("Actual school page");
    expect(host.textContent).toContain("Exact original content"); expect(host.textContent).not.toContain("Do not show hidden");
    pageQuery = { ...pageQuery, data: { ...pageQuery.data, metaTitle: "" } };
    await render(PublicPagePage); expect(document.title).toBe("Course360 organization title");
    pageQuery = { data: null, isLoading: false, error: new Error("Not found") };
    await render(PublicPagePage); expect(host.textContent).toContain("404");
    expect(document.title).toBe("Course360 organization title"); expect(mutation).not.toHaveBeenCalled();
  });
});

const syntheticCourse = (status = "public", blocks: any = null) => ({ id: 42, title: "Exact course title", slug: "synthetic-course", status, type: "course", price: "49.97", pricingType: "one_time", sections: [], pricingOptions: [], instructors: [], landingPage: { blocks } });
describe("Course360 actual CourseLanding full lifecycle", () => {
  it("keeps one mounted course page hook-safe from loading to fallback to saved blocks and back", async () => {
    await render(CourseLanding);
    courseQuery = { data: syntheticCourse(), isLoading: false };
    await render(CourseLanding);
    expect(host.textContent).toContain("Exact course title");
    expect(document.title).toBe("Exact course title | Actual Organization");
    courseQuery = { data: syntheticCourse("public", [block("text", { html: "<p>Saved layout copy</p>" })]), isLoading: false };
    await render(CourseLanding);
    expect(host.textContent).toContain("Saved layout copy");
    courseQuery = { data: undefined, isLoading: true };
    await render(CourseLanding);
    expect(mutation).not.toHaveBeenCalled();
  });
  it.each(["draft", "private", "archived"])("never starts checkout or free-preview enrollment for server-returned %s content", async status => {
    window.history.replaceState({}, "", "/courses/synthetic-course?preview=admin&checkout=1&free_preview=1");
    courseQuery = { data: syntheticCourse(status, [block("pricing_cta", { ctaText: "Original buy copy" })]), isLoading: false };
    await render(CourseLanding);
    expect(host.textContent).toContain("Enrollment Closed");
    expect((host.querySelector("button") as HTMLButtonElement).disabled).toBe(true);
    expect(mutation).not.toHaveBeenCalled();
  });
});

describe("Course360 preserved actual public/hidden checkout boundary", () => {
  it.each(["public", "hidden"])("retains direct checkout and URL pricing option for %s courses", async status => {
    window.history.replaceState({}, "", "/courses/synthetic-course?checkout=1&pricingOptionId=123");
    courseQuery = { data: syntheticCourse(status, [block("pricing_cta", { ctaText: "Owner CTA" })]), isLoading: false };
    await render(CourseLanding);
    expect(mutation).toHaveBeenCalledTimes(1);
    expect(mutation).toHaveBeenCalledWith(expect.objectContaining({ courseSlug: "synthetic-course", pricingOptionId: 123, seats: 1 }));
    expect(host.textContent).toContain("Owner CTA");
  });
});

describe("Course360 custom-block enrollment dialogs", () => {
  it("shows the existing guest checkout dialog when a custom page CTA is clicked", async () => {
    authUser = null;
    courseQuery = { data: syntheticCourse("public", [block("pricing_cta", { ctaText: "Owner checkout", ctaBehavior: "direct_checkout" })]), isLoading: false };
    await render(CourseLanding);
    await act(async () => (host.querySelector("button") as HTMLButtonElement).click());
    expect(host.textContent).toContain("Almost there!");
    expect(host.querySelector("#gc-name")).toBeTruthy();
    expect(host.querySelector("#gc-email")).toBeTruthy();
    expect(mutation).not.toHaveBeenCalled();
  });
  it("shows the existing school waitlist dialog when a custom page CTA is clicked", async () => {
    availabilityQuery = { data: { status: "waitlist", productTitle: "Actual school course" }, isLoading: false };
    courseQuery = { data: syntheticCourse("public", [block("pricing_cta", { ctaText: "Owner CTA" })]), isLoading: false };
    await render(CourseLanding);
    await act(async () => (host.querySelector("button") as HTMLButtonElement).click());
    expect(host.querySelector("#course-waitlist-name")).toBeTruthy();
    expect(host.querySelector("#course-waitlist-email")).toBeTruthy();
    expect(host.textContent).toContain("This request stays with this school only.");
    expect(mutation).not.toHaveBeenCalled();
  });
});

describe("Course360 preserved actual enrollment dialog submissions", () => {
  it("retains guest identity and URL pricing option in a mocked checkout request", async () => {
    authUser = null;
    window.history.replaceState({}, "", "/courses/synthetic-course?pricingOptionId=123");
    courseQuery = { data: syntheticCourse("public", [block("pricing_cta", { ctaText: "Owner checkout" })]), isLoading: false };
    await render(CourseLanding);
    await act(async () => (host.querySelector("button") as HTMLButtonElement).click());
    await edit(host.querySelector("#gc-name")!, "Synthetic Guest");
    await edit(host.querySelector("#gc-email")!, "synthetic-guest@example.invalid");
    await act(async () => host.querySelector("#gc-name")!.closest("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(mutation).toHaveBeenCalledTimes(1);
    expect(mutation).toHaveBeenCalledWith(expect.objectContaining({ courseSlug: "synthetic-course", name: "Synthetic Guest", email: "synthetic-guest@example.invalid", pricingOptionId: 123 }));
  });
  it("uses the exact loaded course ID for a mocked school waitlist request", async () => {
    availabilityQuery = { data: { status: "waitlist" }, isLoading: false };
    courseQuery = { data: syntheticCourse("public", [block("pricing_cta")]), isLoading: false };
    await render(CourseLanding);
    await act(async () => (host.querySelector("button") as HTMLButtonElement).click());
    await edit(host.querySelector("#course-waitlist-email")!, "synthetic-waitlist@example.invalid");
    await act(async () => host.querySelector("#course-waitlist-name")!.closest("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(mutation).toHaveBeenCalledTimes(1);
    expect(mutation).toHaveBeenCalledWith({ productType: "course", productId: 42, name: "Synthetic Admin", email: "synthetic-waitlist@example.invalid", userId: 11 });
  });
});
