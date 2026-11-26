// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { COURSE360_PRICES } from "../shared/course360Pricing";
import { COURSE360_CROSS_TOOL_OFFERS } from "../shared/course360CrossToolOffers";
import { COURSE360_HOME_BANNER_URL, COURSE360_HOME_BANNER_ALT, COURSE360_PLATFORM_LOGO_URL, COURSE360_PLATFORM_LOGO_ALT } from "../client/src/config/platformBrand";
import { Course360CrossToolOffers, type Course360CrossToolOffersProps } from "../client/src/components/Course360CrossToolOffers";
import { Course360ContentTrack } from "../client/src/components/Course360MarketingTracks";

const auth = vi.hoisted(() => ({ user: null as any, loading: false }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => auth }));
// New public checkout service boundary only; actual landing and offer UI remain rendered.
vi.mock("@/lib/trpc", () => ({ trpc: { billing: {
  getCrossToolOffers: { useQuery: () => ({ data: undefined, isLoading: true, isFetching: false, error: null, refetch: vi.fn() }) },
  createCrossToolCheckout: { useMutation: () => ({ mutateAsync: vi.fn(() => { throw new Error("Checkout forbidden in retained marketing fixture"); }), isPending: false }) },
} } }));
import LandingPage from "../client/src/pages/LandingPage";

const ready: NonNullable<Course360CrossToolOffersProps["readiness"]> = {
  builder_creator_web: { monthly: true, annual: true },
  pro_creator_web: { monthly: true, annual: true },
};
const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
beforeEach(() => {
  auth.user = null; auth.loading = false;
  window.history.replaceState({}, "", "/");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network forbidden in public marketing UI tests"); }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const QUOTES = [
  ["Course360™ replaced three separate tools I was paying for. The SCORM support alone saved me hours every week, and my students love the clean learning experience.", "Dr. Sarah Mitchell", "Medical Education Director"],
  ["I launched my first course in under an hour. The analytics dashboard showed me exactly which lessons students were dropping off, so I could fix them fast.", "James Okafor", "Corporate Trainer"],
  ["The branded school page looks incredibly professional. My students can't believe I built it myself — they think I hired a developer.", "Priya Sharma", "Yoga & Wellness Instructor"],
] as const;

describe("Course360 rendered public two-track marketing", () => {
  it("renders both focused tracks, keeps every original section, supplied artwork and exact testimonials", () => {
    const { container } = render(<LandingPage />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Run Your School.Create Content.");
    for (const id of ["run-your-school", "create-content", "features", "how-it-works", "pricing", "school-creator-packages"]) expect(container.querySelector(`#${id}`)).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Run Your School", level: 2 })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Create Content", level: 2 })).toBeTruthy();
    expect(container.textContent).toContain("LMS · Learning Delivery Platform");
    expect(container.textContent).toContain("Content Creator Platform");
    expect(container.querySelector(`img[src="${COURSE360_HOME_BANNER_URL}"]`)?.getAttribute("alt")).toBe(COURSE360_HOME_BANNER_ALT);
    expect(container.querySelector(`img[src="${COURSE360_PLATFORM_LOGO_URL}"]`)?.getAttribute("alt")).toBe(COURSE360_PLATFORM_LOGO_ALT);
    const quotes = container.querySelectorAll("blockquote");
    expect(quotes).toHaveLength(3);
    QUOTES.forEach(([quote, name, role], index) => {
      expect(quotes[index].textContent).toBe(`“${quote}”`);
      const article = quotes[index].closest("article")!;
      expect(article.textContent).toContain(name); expect(article.textContent).toContain(role);
      expect(article.querySelector('[aria-label="5 out of 5 stars"]')).not.toBeNull();
    });
    const pricing = container.querySelector("#pricing")!;
    for (const price of ["$39.97", "$99.97", "$199.97", "Custom"]) expect(pricing.textContent).toContain(price);
    for (const plan of ["starter", "builder", "pro"]) expect(pricing.querySelector(`a[href="/register?plan=${plan}"]`)).not.toBeNull();
    expect(pricing.querySelector("table")).not.toBeNull();
    expect(screen.getByText("Designed by SoundMedia, Inc.").closest("a")?.getAttribute("href")).toBe("https://www.soundmedianow.com");
    expect(container.textContent).not.toMatch(/no (credit )?card required|4k|AIstock|publish instantly/i);
    expect(container.textContent).toContain("A card is required at secure checkout first");
  });

  it("track CTAs navigate to working sections and existing standalone routes, without implying tool ownership changes", () => {
    const { container } = render(<LandingPage />);
    const hero = container.querySelector("#hero")!;
    expect(within(hero as HTMLElement).getByRole("link", { name: "Run Your School" }).getAttribute("href")).toBe("#run-your-school");
    expect(within(hero as HTMLElement).getByRole("link", { name: "Create Content" }).getAttribute("href")).toBe("#create-content");
    expect(screen.getByRole("link", { name: "Explore Creator" }).getAttribute("href")).toBe("/creator-pro");
    expect(screen.getByRole("link", { name: "Explore Studio" }).getAttribute("href")).toBe("/studio-pro");
    expect(screen.getByRole("link", { name: "Explore Quiz Creator" }).getAttribute("href")).toBe("/quiz-creator-pro");
    expect(container.textContent).toContain("Your school's main content library remains organization-owned");
    expect(container.textContent).toContain("not automatic access to every tool");
  });

  it("renders accurate standalone web prices and annual totals from the unchanged canonical prices", () => {
    const { container } = render(<Course360ContentTrack />);
    expect(container.textContent).toContain("$99.97"); expect(container.textContent).toContain("$39.97");
    fireEvent.click(screen.getByRole("button", { name: "Annual" }));
    expect(container.textContent).toContain("$899.97"); expect(container.textContent).toContain("$299.97");
    expect(container.textContent).toContain("Billed upfront annually — the full yearly amount is charged at once.");
    expect(container.textContent).not.toContain("/ month");
    fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
    expect(container.textContent).toContain("Billed monthly.");
  });
});

describe("Course360 rendered cross-tool offers", () => {
  it("uses the two exact owner-approved amounts, charges annual totals at once, and keeps annual Pro exactly $2,497.00", () => {
    expect(Object.keys(COURSE360_CROSS_TOOL_OFFERS)).toEqual(["builder_creator_web", "pro_creator_web"]);
    expect([COURSE360_CROSS_TOOL_OFFERS.builder_creator_web.monthly, COURSE360_CROSS_TOOL_OFFERS.builder_creator_web.annual]).toEqual([169.97, 1599.97]);
    expect([COURSE360_CROSS_TOOL_OFFERS.pro_creator_web.monthly, COURSE360_CROSS_TOOL_OFFERS.pro_creator_web.annual]).toEqual([249.97, 2497]);
    const { container } = render(<Course360CrossToolOffers />);
    expect(container.textContent).toContain("$169.97"); expect(container.textContent).toContain("$249.97");
    fireEvent.click(screen.getByRole("button", { name: "Annual" }));
    expect(container.textContent).toContain("$1,599.97"); expect(container.textContent).toContain("$2,497.00");
    expect(container.textContent).not.toContain("$2,497.97");
    expect(container.textContent).toContain("$2,497.00 charged at once each year; not billed monthly.");
    expect(container.textContent).not.toContain("/ month");
    expect(screen.getByRole("button", { name: "Annual" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("default public root package CTAs are disabled and do not infer payment from success URL parameters", () => {
    window.history.replaceState({}, "", "/?success=true&paid=true&checkout=success&session_id=unverified");
    const checkout = vi.fn(); render(<LandingPage crossToolOffers={{ onCheckout: checkout }} />);
    for (const name of ["Course360 Builder + Creator Web", "Course360 Pro + Creator Web"]) {
      const button = screen.getByRole("button", { name: `Continue with ${name}` }) as HTMLButtonElement;
      expect(button.disabled).toBe(true); fireEvent.click(button);
    }
    expect(checkout).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toContain("has not yet been confirmed");
    expect(screen.queryByText(/payment successful/i)).toBeNull();
  });

  it("needs both actual catalog readiness and callback; checks selected interval independently", () => {
    const callback = vi.fn(async () => {});
    const view = render(<Course360CrossToolOffers catalogStatus="ready" readiness={ready} />);
    expect((screen.getByRole("button", { name: /Continue with Course360 Builder/ }) as HTMLButtonElement).disabled).toBe(true);
    view.rerender(<Course360CrossToolOffers catalogStatus="ready" readiness={{ ...ready, builder_creator_web: { monthly: true, annual: false } }} onCheckout={callback} />);
    expect((screen.getByRole("button", { name: /Continue with Course360 Builder/ }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Annual" }));
    expect((screen.getByRole("button", { name: /Continue with Course360 Builder/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /Continue with Course360 Pro/ }) as HTMLButtonElement).disabled).toBe(false);
    expect(callback).not.toHaveBeenCalled();
  });

  it("submits the exact selected offer and annual interval only on click, locks repeat clicks, and renders progress/error", async () => {
    let reject!: (reason: Error) => void;
    const checkout = vi.fn(() => new Promise<void>((_resolve, rejectPromise) => { reject = rejectPromise; }));
    render(<Course360CrossToolOffers catalogStatus="ready" readiness={ready} onCheckout={checkout} />);
    fireEvent.click(screen.getByRole("button", { name: "Annual" }));
    expect(checkout).not.toHaveBeenCalled();
    const button = screen.getByRole("button", { name: /Continue with Course360 Pro/ });
    fireEvent.click(button); fireEvent.click(button);
    expect(checkout).toHaveBeenCalledTimes(1);
    expect(checkout).toHaveBeenCalledWith({ offerKey: "pro_creator_web", interval: "annual" });
    expect(screen.getByRole("status").textContent).toContain("Opening secure checkout for Course360 Pro + Creator Web");
    expect((screen.getByRole("button", { name: "Monthly" }) as HTMLButtonElement).disabled).toBe(true);
    reject(new Error("Selected package checkout is temporarily unavailable."));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Selected package checkout is temporarily unavailable."));
    expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByText(/payment successful/i)).toBeNull();
  });

  it("renders catalog error and retry without an enabled checkout even when stale readiness exists", () => {
    const checkout = vi.fn(), retry = vi.fn();
    render(<Course360CrossToolOffers catalogStatus="error" catalogError="Package availability service unavailable" readiness={ready} onCheckout={checkout} onRetryCatalog={retry} />);
    expect(screen.getByRole("alert").textContent).toContain("Package availability service unavailable");
    expect((screen.getByRole("button", { name: /Continue with Course360 Builder/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Retry package availability" }));
    expect(retry).toHaveBeenCalledTimes(1); expect(checkout).not.toHaveBeenCalled();
  });

  it("keeps white-label a Pro-only entitlement and does not bundle Desktop/Studio/Quiz by implication", () => {
    render(<Course360CrossToolOffers />);
    const builder = screen.getByRole("heading", { name: "Course360 Builder + Creator Web" }).closest("article")!;
    const pro = screen.getByRole("heading", { name: "Course360 Pro + Creator Web" }).closest("article")!;
    expect(builder.textContent).toContain("white-label branding requires Pro");
    expect(builder.textContent).not.toContain("Pro-only white-label branding");
    expect(pro.textContent).toContain("Pro-only white-label branding");
    expect(screen.getByText(/These packages include Creator Web/).textContent).toContain("not Creator Desktop");
  });
});

describe("Course360 marketing source preservation", () => {
  it("preserves testimonial source block byte-exact including approval comments, quotes, names, layout and ratings", () => {
    const landing = source("client/src/pages/LandingPage.tsx");
    const testimonials = landing.slice(landing.indexOf("// ─── Testimonials"), landing.indexOf("// ─── Pricing"));
    expect(sha256(testimonials)).toBe("33a2edd6b22eca677fac133cc70870df057cdf33279f381f6c4c53d35edc3b55");
  });

  it("keeps standalone prices, dashboard, route wiring, and supplied brand config byte-identical", () => {
    expect(sha256(source("shared/course360Pricing.ts"))).toBe("102f39c2995ee5bd5af45366e725e3df418fb8002d647809b62ed102202201dd");
    expect(sha256(source("client/src/pages/Home.tsx"))).toBe("04e090e98d0619c586121dd4891e78e1593084c185543de3bd480b732dd69337");
    expect(sha256(source("client/src/App.tsx"))).toBe("0e97ba9df72015f8084f006c419b5baf17ee2d0741ad24d1ef0803df834c6141");
    expect(sha256(source("client/src/config/platformBrand.ts"))).toBe("521a40a69f6b278ae7f18f91ddea89037704ee1312987db68bf22686383f1eda");
    const app = source("client/src/App.tsx");
    expect(app).toContain('<Route path="/" component={LandingPage} />');
    expect(app).toContain('<Route>{() => <OrgLandingPage subdomainOrg={schoolSubdomain} fallback={<SchoolPage subdomainOrg={schoolSubdomain} />} />}</Route>');
    expect(COURSE360_PRICES.builder.monthly).toBe(99.97);
  });

  it("keeps the original meaningful public assertions and comparison limits", () => {
    const landing = source("client/src/pages/LandingPage.tsx");
    for (const retained of ["Build Your Knowledge", "Course tools for online educators", "Organization workspaces", "Every paid plan begins with a 14-day card-backed trial", "hello@course360.app"]) expect(landing).toContain(retained);
    expect(landing).toContain('{ feature: "White-label branding", starter: false, builder: false, pro: true, enterprise: true }');
    expect(landing).not.toMatch(/No (credit )?card required|4K|AIstock|publish instantly/i);
  });
});
