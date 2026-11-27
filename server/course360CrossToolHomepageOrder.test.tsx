// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { COURSE360_CROSS_TOOL_OFFERS } from "../shared/course360CrossToolOffers";
import {
  COURSE360_HOME_BANNER_URL, COURSE360_HOME_BANNER_ALT,
  COURSE360_PLATFORM_LOGO_URL, COURSE360_PLATFORM_LOGO_ALT,
} from "../client/src/config/platformBrand";
import type { Course360CrossToolOffersProps } from "../client/src/components/Course360CrossToolOffers";
import LandingPage from "../client/src/pages/LandingPage";

// Only authentication and tRPC are mocked. LandingPage, both tracks, pricing,
// the comparison chart, pure offers and the default checkout adapter render for real.
const boundary = vi.hoisted(() => ({
  auth: { user: null as any, loading: false },
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  refetch: vi.fn(),
  mutateAsync: vi.fn(),
  deniedFetch: vi.fn(() => { throw new Error("Network forbidden in homepage order tests"); }),
}));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => {
  React.useState(null);
  return boundary.auth;
} }));
vi.mock("@/lib/trpc", () => ({ trpc: { billing: {
  getCrossToolOffers: { useQuery: (...args: any[]) => {
    React.useState(null);
    boundary.useQuery(...args);
    return {
      data: { offers: COURSE360_CROSS_TOOL_OFFERS, ready: true, catalogReady: true, provisioningReady: true, reason: null },
      isLoading: false, isFetching: false, error: null, refetch: boundary.refetch,
    };
  } },
  createCrossToolCheckout: { useMutation: (...args: any[]) => {
    React.useRef(null);
    boundary.useMutation(...args);
    return { mutateAsync: boundary.mutateAsync, isPending: false };
  } },
} } }));

const ready: NonNullable<Course360CrossToolOffersProps["readiness"]> = {
  builder_creator_web: { monthly: true, annual: true },
  pro_creator_web: { monthly: true, annual: true },
};
const pureOffers: Course360CrossToolOffersProps = { catalogStatus: "ready", readiness: ready };

beforeEach(() => {
  vi.clearAllMocks();
  boundary.auth.user = null;
  boundary.auth.loading = false;
  boundary.refetch.mockImplementation(() => { throw new Error("Catalog refetch forbidden in homepage composition tests"); });
  boundary.mutateAsync.mockImplementation(() => { throw new Error("Checkout submission forbidden in homepage composition tests"); });
  window.history.replaceState({}, "", "/");
  // Browser fetch is denied explicitly; the approved runner's NODE_OPTIONS
  // guard additionally denies HTTP, DNS, TCP and TLS for the entire process.
  vi.stubGlobal("fetch", boundary.deniedFetch);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  expect(boundary.deniedFetch).not.toHaveBeenCalled();
  expect(boundary.refetch).not.toHaveBeenCalled();
  expect(boundary.mutateAsync).not.toHaveBeenCalled();
});

function uniqueElement(container: HTMLElement, selector: string): HTMLElement {
  const matches = container.querySelectorAll<HTMLElement>(selector);
  expect(matches, `Exactly one rendered ${selector}`).toHaveLength(1);
  return matches[0];
}
function sections(container: HTMLElement) {
  return {
    hero: uniqueElement(container, "section#hero"),
    school: uniqueElement(container, "section#run-your-school"),
    pricing: uniqueElement(container, "section#pricing"),
    content: uniqueElement(container, "section#create-content"),
    features: uniqueElement(container, "section#features"),
    howItWorks: uniqueElement(container, "section#how-it-works"),
    testimonials: uniqueElement(container, 'section[aria-labelledby="testimonials-heading"]'),
    packages: uniqueElement(container, "section#school-creator-packages"),
    cta: screen.getByRole("heading", { level: 2, name: /Grow what’s next\./ }).closest("section")!,
  };
}
function packageButton(packages: HTMLElement, plan: "Builder" | "Pro") {
  return within(packages).getByRole("button", { name: `Continue with Course360™ ${plan} + Creator Web` }) as HTMLButtonElement;
}

// Two branch cases plus six focused interaction/preservation cases: eight tests.
describe("Course360 rendered homepage composition order", () => {
  it.each(["default real checkout adapter", "injected pure offers"] as const)(
    "renders every original section once in the requested order through %s",
    branch => {
      const injected = branch === "injected pure offers";
      const { container } = render(injected ? <LandingPage crossToolOffers={pureOffers} /> : <LandingPage />);
      const s = sections(container);
      expect(Array.from(container.querySelectorAll("section"))).toEqual([
        s.hero, s.school, s.pricing, s.content, s.features,
        s.howItWorks, s.testimonials, s.packages, s.cta,
      ]);
      // Sibling assertions prevent any unrelated section or wrapper from
      // interrupting the school narrative or delaying the shared workflow.
      expect(s.hero.nextElementSibling).toBe(s.school);
      expect(s.school.nextElementSibling).toBe(s.pricing);
      expect(s.pricing.nextElementSibling).toBe(s.content);
      expect(s.content.nextElementSibling).toBe(s.features);
      expect(s.features.nextElementSibling).toBe(s.howItWorks);
      expect(s.howItWorks.nextElementSibling).toBe(s.testimonials);
      expect(s.testimonials.nextElementSibling).toBe(s.packages);
      expect(within(s.features).getByRole("heading", { level: 2, name: "Your school. Your content. A connected workflow." })).toBeTruthy();
      expect(within(s.howItWorks).getByRole("heading", { level: 2, name: "Create the content. Run the school." })).toBeTruthy();
      const root = s.hero.parentElement!;
      const nav = uniqueElement(root, ":scope > nav");
      const footer = uniqueElement(root, ":scope > footer");
      expect(root.firstElementChild).toBe(nav);
      expect(s.hero.previousElementSibling).toBe(nav);
      expect(s.cta.nextElementSibling).toBe(footer);
      expect(root.lastElementChild).toBe(footer);
      expect(within(s.cta).getByRole("link", { name: "Create Your Account" }).getAttribute("href")).toBe("/register");
      expect(within(footer).getByRole("link", { name: "Designed by SoundMedia, Inc." }).getAttribute("href")).toBe("https://www.soundmedianow.com");
      if (injected) {
        expect(s.packages.nextElementSibling).toBe(s.cta);
        expect(boundary.useQuery).not.toHaveBeenCalled();
        expect(boundary.useMutation).not.toHaveBeenCalled();
        expect(packageButton(s.packages, "Builder").disabled).toBe(true);
      } else {
        // The real adapter retains its existing-school billing note between
        // packages and the final CTA; it must not be replaced by a pure fixture.
        const billing = screen.getByRole("link", { name: "Manage your existing school's billing" });
        expect(billing.getAttribute("href")).toBe("/billing");
        expect(s.packages.nextElementSibling?.contains(billing)).toBe(true);
        expect(s.packages.nextElementSibling?.nextElementSibling).toBe(s.cta);
        expect(boundary.useQuery).toHaveBeenCalledWith(undefined, expect.objectContaining({ retry: false, staleTime: 0 }));
        expect(boundary.useMutation).toHaveBeenCalledWith();
        expect(packageButton(s.packages, "Builder").disabled).toBe(false);
      }
    },
  );

  it("keeps all twenty comparison rows and four LMS plan columns inside pricing before content starts", () => {
    const { container } = render(<LandingPage />);
    const s = sections(container);
    expect(within(s.pricing).getByRole("heading", { level: 2, name: "Run Your School: LMS plans" })).toBeTruthy();
    const comparisonHeading = within(s.pricing).getByRole("heading", { level: 3, name: "Full Feature Comparison" });
    const table = within(s.pricing).getByRole("table");
    expect(screen.getAllByRole("table")).toHaveLength(1);
    expect(within(table).getAllByRole("columnheader").map(cell => cell.textContent?.trim())).toEqual(["Feature", "Starter", "Builder", "Pro", "Enterprise"]);
    const rows = Array.from(table.querySelectorAll("tbody tr"));
    expect(rows.map(row => row.querySelector("td")?.textContent)).toEqual([
      "Courses", "Students", "Storage", "Video lessons", "Quiz builder", "Public school page", "SCORM support",
      "Course360™ Studio™", "Membership tiers", "Community", "Custom domain", "White-label branding",
      "Email campaigns", "Deep analytics", "Affiliate platform", "SSO / SAML", "Platform transaction fee",
      "Stripe payment gateway", "Group registrations", "Dedicated support",
    ]);
    for (const row of rows) expect(within(row as HTMLElement).getAllByRole("cell")).toHaveLength(5);
    expect(rows[0].textContent).toBe("Courses52050Unlimited");
    expect(rows[1].textContent).toBe("Students1,0005,00015,000Unlimited");
    expect(rows[2].textContent).toBe("Storage1 TB2 TB5 TBUnlimited");
    expect(rows[8].textContent).toBe("Membership tiers1310Unlimited");
    expect(rows[16].textContent).toBe("Platform transaction fee0%0%0%0%");
    expect(comparisonHeading.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(rows.at(-1)!.compareDocumentPosition(s.content) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(s.school.nextElementSibling).toBe(s.pricing);
    expect(s.pricing.nextElementSibling).toBe(s.content);
  });

  it("explains both hero tracks and resolves both hero buttons and the school comparison anchor to unique rendered sections", () => {
    const { container } = render(<LandingPage />);
    const s = sections(container);
    expect(within(s.hero).getByRole("heading", { level: 1 }).textContent).toBe("Run Your School.Create Content.");
    expect(s.hero.textContent).toContain("LMS Learning Delivery Platform: deliver, manage, enroll, sell, and report.");
    expect(s.hero.textContent).toContain("Content Creator Platform: interactive authoring, capture and editing, and assessments.");
    for (const [name, target] of [["Run Your School", s.school], ["Create Content", s.content]] as const) {
      const link = within(s.hero).getByRole("link", { name });
      expect(link.getAttribute("href")).toBe(`#${target.id}`);
      expect(container.querySelectorAll(link.getAttribute("href")!)).toHaveLength(1);
      expect(container.querySelector(link.getAttribute("href")!)).toBe(target);
      expect(within(target).getByRole("heading", { level: 2, name })).toBeTruthy();
    }
    const compare = within(s.school).getByRole("link", { name: "Compare school plans" });
    expect(compare.getAttribute("href")).toBe("#pricing");
    expect(container.querySelector(compare.getAttribute("href")!)).toBe(s.pricing);
  });

  it("preserves standalone monthly/annual prices and routes without changing LMS or package billing", () => {
    const { container } = render(<LandingPage />);
    const s = sections(container);
    const tools = [
      ["Course360™ Creator", "$99.97", "$899.97", "Explore Creator", "/creator-pro"],
      ["Course360™ Studio", "$39.97", "$299.97", "Explore Studio", "/studio-pro"],
      ["Course360™ Quiz Creator", "$39.97", "$299.97", "Explore Quiz Creator", "/quiz-creator-pro"],
    ] as const;
    const assertContentPrices = (annual: boolean) => {
      for (const [name, monthly, yearly, cta, href] of tools) {
        const card = within(s.content).getByRole("heading", { level: 3, name }).closest("article")!;
        expect(card.textContent).toContain(`${annual ? yearly : monthly} / ${annual ? "year" : "month"}`);
        expect(card.textContent).toContain(annual ? "Billed upfront annually — the full yearly amount is charged at once." : "Billed monthly.");
        expect(within(card).getByRole("link", { name: cta }).getAttribute("href")).toBe(href);
      }
    };
    assertContentPrices(false);
    fireEvent.click(within(s.content).getByRole("button", { name: "Annual" }));
    expect(within(s.content).getByRole("button", { name: "Annual" }).getAttribute("aria-pressed")).toBe("true");
    assertContentPrices(true);
    expect(within(s.packages).getByRole("button", { name: "Monthly" }).getAttribute("aria-pressed")).toBe("true");
    expect(s.packages.textContent).toContain("$169.97 / month");
    expect(s.packages.textContent).toContain("$249.97 / month");
    for (const [plan, price] of [["Starter", "$39.97"], ["Builder", "$99.97"], ["Pro", "$199.97"], ["Enterprise", "Custom"]] as const) {
      expect(within(s.pricing).getByRole("heading", { level: 3, name: plan }).parentElement?.textContent).toContain(price);
      const href = plan === "Enterprise" ? "mailto:hello@course360.app" : `/register?plan=${plan.toLowerCase()}`;
      expect(s.pricing.querySelectorAll(`a[href="${href}"]`)).toHaveLength(1);
    }
    fireEvent.click(within(s.content).getByRole("button", { name: "Monthly" }));
    expect(within(s.content).getByRole("button", { name: "Monthly" }).getAttribute("aria-pressed")).toBe("true");
    assertContentPrices(false);
  });

  it("retains the injected pure callback's exact selected monthly and annual intervals independently of content pricing", async () => {
    // This callback is an in-memory spy, never a checkout or payment provider.
    const onCheckout = vi.fn(async () => {});
    const { container } = render(<LandingPage crossToolOffers={{ ...pureOffers, onCheckout }} />);
    const s = sections(container);
    fireEvent.click(within(s.content).getByRole("button", { name: "Annual" }));
    expect(onCheckout).not.toHaveBeenCalled();
    expect(within(s.packages).getByRole("button", { name: "Monthly" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(packageButton(s.packages, "Builder"));
    await waitFor(() => expect(packageButton(s.packages, "Builder").disabled).toBe(false));
    expect(onCheckout).toHaveBeenNthCalledWith(1, { offerKey: "builder_creator_web", interval: "monthly" });
    fireEvent.click(within(s.packages).getByRole("button", { name: "Annual" }));
    expect(s.packages.textContent).toContain("$1,599.97 / year");
    expect(s.packages.textContent).toContain("$2,497.00 / year");
    expect(s.packages.textContent).toContain("$2,497.00 charged at once each year; not billed monthly.");
    expect(s.packages.textContent).not.toContain("$2,497.97");
    expect(onCheckout).toHaveBeenCalledTimes(1);
    fireEvent.click(packageButton(s.packages, "Pro"));
    await waitFor(() => expect(packageButton(s.packages, "Pro").disabled).toBe(false));
    expect(onCheckout).toHaveBeenNthCalledWith(2, { offerKey: "pro_creator_web", interval: "annual" });
    expect(onCheckout).toHaveBeenCalledTimes(2);
    expect(within(s.content).getByRole("button", { name: "Annual" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(boundary.useQuery).not.toHaveBeenCalled();
    expect(boundary.useMutation).not.toHaveBeenCalled();
  });

  it("keeps the default real adapter's selected annual package in its local review without submitting checkout", async () => {
    const { container } = render(<LandingPage />);
    const s = sections(container);
    fireEvent.click(within(s.packages).getByRole("button", { name: "Annual" }));
    expect(within(s.content).getByRole("button", { name: "Monthly" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(packageButton(s.packages, "Pro"));
    const review = await screen.findByRole("dialog", { name: "Review your new-school package" });
    expect(review.textContent).toContain("Course360™ Pro + Creator Web · Annual billing");
    expect(review.textContent).toContain("$2,497.00 USD each year, billed all at once (not monthly installments)");
    expect((within(review).getByRole("textbox", { name: "Your name" }) as HTMLInputElement).value).toBe("");
    expect((within(review).getByRole("textbox", { name: "Email address" }) as HTMLInputElement).value).toBe("");
    expect((within(review).getByRole("button", { name: "Continue to secure Stripe Checkout" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(review).getByRole("button", { name: "Cancel / back to packages" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(within(s.packages).getByRole("button", { name: "Annual" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("retains supplied artwork and all three approved testimonials after the composition move", () => {
    const { container } = render(<LandingPage />);
    const s = sections(container);
    const banner = screen.getByRole("img", { name: COURSE360_HOME_BANNER_ALT });
    const logo = screen.getByRole("img", { name: COURSE360_PLATFORM_LOGO_ALT });
    expect(banner.getAttribute("src")).toBe(COURSE360_HOME_BANNER_URL);
    expect(logo.getAttribute("src")).toBe(COURSE360_PLATFORM_LOGO_URL);
    expect(s.hero.contains(banner)).toBe(true);
    expect(logo.closest("nav")).not.toBeNull();
    const approved = [
      ["Course360™ replaced three separate tools I was paying for. The SCORM support alone saved me hours every week, and my students love the clean learning experience.", "Dr. Sarah Mitchell", "Medical Education Director"],
      ["I launched my first course in under an hour. The analytics dashboard showed me exactly which lessons students were dropping off, so I could fix them fast.", "James Okafor", "Corporate Trainer"],
      ["The branded school page looks incredibly professional. My students can't believe I built it myself — they think I hired a developer.", "Priya Sharma", "Yoga & Wellness Instructor"],
    ] as const;
    const quotes = s.testimonials.querySelectorAll("blockquote");
    expect(container.querySelectorAll("blockquote")).toHaveLength(3);
    approved.forEach(([quote, name, role], index) => {
      expect(quotes[index].textContent).toBe(`“${quote}”`);
      const card = quotes[index].closest("article")!;
      expect(card.textContent).toContain(name);
      expect(card.textContent).toContain(role);
      expect(card.querySelectorAll('[aria-label="5 out of 5 stars"]')).toHaveLength(1);
    });
    expect(s.testimonials.previousElementSibling).toBe(s.howItWorks);
    expect(s.testimonials.nextElementSibling).toBe(s.packages);
  });
});
