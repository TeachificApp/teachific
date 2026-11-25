// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { COURSE360_PRICES, course360AnnualSavings } from "../shared/course360Pricing";
import { formatCourse360Dollars } from "../shared/course360PriceDisplay";

const state = vi.hoisted(() => ({
  subscription: {
    plan: "free", status: "active", canManageBilling: true,
    stripeSubscriptionId: null, stripeCustomerId: null,
    billingInterval: null, introductoryTrialAvailable: true,
  } as any,
  checkout: vi.fn(),
}));

// UI tests never import real database/provider paths or make remote requests.
vi.mock("./db", () => ({ getDb: vi.fn(() => { throw new Error("DB access forbidden in UI tests"); }) }));
vi.mock("./lib/stripeClient", () => ({ getStripe: vi.fn(() => { throw new Error("Provider access forbidden in UI tests"); }) }));
vi.mock("@/lib/trpc", () => {
  const endpoint = (data?: unknown) => ({
    useQuery: () => ({ data, isLoading: false, error: null }),
    useMutation: () => ({ mutate: state.checkout, isPending: false }),
  });
  const exchange = () => ({ useMutation: () => ({ mutateAsync: vi.fn(async () => { throw new Error("Unexpected AI/PPTX operation in approved-price tests"); }), isPending: false }) });
  const invalidation = new Proxy({}, { get: () => ({ invalidate: vi.fn() }) });
  return { trpc: {
    billing: new Proxy({}, { get: (_target, key) => key === "getSubscription"
      ? { useQuery: () => ({ data: state.subscription, isLoading: false, error: null }) }
      : endpoint() }),
    authoring: {
      listProjects: endpoint([]), getMyCreatorRole: endpoint({ isPaid: false, isInTrial: false }),
      createProject: endpoint(), deleteProject: endpoint(), duplicateProject: endpoint(),
      generateAiDraft: exchange(), importPptxDraft: exchange(), previewExchangeDraft: exchange(), applyExchangeDraft: exchange(), exportPptx: exchange(),
    },
    useUtils: () => ({ billing: invalidation, authoring: invalidation }),
  } };
});
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock("@/hooks/useOrgScope", () => ({ useOrgScope: () => ({ orgId: 1 }) }));
vi.mock("@/hooks/useSubscriptions", () => ({ useSubscriptions: () => ({ subs: null, isLoading: false }) }));
vi.mock("@/components/ProductSwitcher", () => ({ ProductSwitcher: () => null }));
vi.mock("sonner", () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock("@/components/ui/dialog", () => {
  const passthrough = ({ children }: any) => React.createElement("div", null, children);
  return {
    Dialog: ({ children, open }: any) => open ? React.createElement("div", { role: "dialog" }, children) : null,
    DialogContent: passthrough, DialogHeader: passthrough, DialogTitle: passthrough,
    DialogDescription: passthrough, DialogFooter: passthrough,
    useDialogComposition: () => ({ justEndedComposing: () => false, setComposing: vi.fn(), markCompositionEnd: vi.fn() }),
  };
});

import LandingPage from "../client/src/pages/LandingPage";
import BillingPage from "../client/src/pages/profile/BillingPage";
import StudioLandingPage from "../client/src/pages/StudioLandingPage";
import CreatorLandingPage from "../client/src/pages/CreatorLandingPage";
import QuizCreatorLandingPage from "../client/src/pages/QuizCreatorLandingPage";
import CreatorDashboardPage from "../client/src/pages/CreatorDashboardPage";

beforeEach(() => {
  state.checkout.mockClear();
  window.history.replaceState({}, "", "/");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network forbidden in UI tests"); }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function priceSection(container: HTMLElement) {
  const section = container.querySelector<HTMLElement>("#pricing");
  expect(section).not.toBeNull();
  return section!;
}

// Literal owner-approved values prevent a wrong canonical amount from making UI tests self-fulfilling.
const approved = {
  starter: [39.97, 399.97], builder: [99.97, 999.97], pro: [199.97, 1999.97],
  studio_web: [39.97, 299.97], studio_desktop: [49.97, 399.97], studio_bundle: [69.97, 599.97],
  creator_web: [99.97, 899.97], creator_desktop: [119.97, 999.97], creator_bundle: [149.97, 1299.97],
  quiz_creator_web: [39.97, 299.97], quiz_creator_desktop: [49.97, 399.97], quiz_creator_bundle: [69.97, 599.97],
} as const;

describe("Approved Course360 price UI repair", () => {
  it.each(Object.entries(approved))("formats canonical %s dollar amounts without another /100 conversion", (key, pair) => {
    const price = COURSE360_PRICES[key as keyof typeof COURSE360_PRICES];
    expect([price.monthly, price.annual]).toEqual(pair);
    expect(formatCourse360Dollars(price.monthly)).toBe(`$${pair[0].toFixed(2)}`);
    expect(formatCourse360Dollars(price.annual)).toBe(`$${pair[1].toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  });

  it("renders approved school prices and retains home artwork, testimonials, and enterprise card", () => {
    const view = render(React.createElement(LandingPage));
    const section = priceSection(view.container);
    for (const value of ["$39.97", "$99.97", "$199.97", "Custom"]) expect(section.textContent).toContain(value);
    expect(section.textContent).not.toMatch(/\$(39|99|199)(?![\d.])/);
    expect(view.container.querySelectorAll("img").length).toBeGreaterThan(0);
    expect(view.container.querySelectorAll("blockquote").length).toBeGreaterThan(0);
    expect(section.querySelector('a[href="/register?plan=starter"]')).not.toBeNull();
  });

  it("renders monthly and upfront annual school prices while retaining legacy access", () => {
    const view = render(React.createElement(BillingPage));
    for (const value of ["$39.97", "$99.97", "$199.97", "Legacy Access"]) expect(view.container.textContent).toContain(value);
    fireEvent.click(view.getByRole("switch"));
    for (const value of ["$399.97", "$999.97", "$1,999.97", "Billed upfront"]) expect(view.container.textContent).toContain(value);
    expect(view.container.textContent).not.toMatch(/Save ~15%|2 months free/i);
    expect(view.container.querySelectorAll("button").length).toBeGreaterThan(0);
  });

  it.each([
    ["Studio", StudioLandingPage, "$49.97", "$399.97", "$199.67"],
    ["Creator", CreatorLandingPage, "$119.97", "$999.97", "$439.67"],
    ["Quiz Creator", QuizCreatorLandingPage, "$49.97", "$399.97", "$199.67"],
  ] as const)("renders %s existing Desktop offer with exact annual total and savings", (_name, Page, monthly, annual, saving) => {
    const view = render(React.createElement(Page));
    const section = priceSection(view.container);
    expect(section.textContent).toContain(monthly);
    fireEvent.click(within(section).getByRole("button", { name: /Annual/ }));
    expect(section.textContent).toContain(annual);
    expect(section.textContent).toContain("/yr");
    expect(section.textContent).toContain("Billed upfront annually");
    expect(section.textContent).toContain(`save ${saving} vs. 12 monthly payments`);
    expect(section.textContent).not.toMatch(/Save 29%|Save 20%|2 months free/i);
    expect(section.textContent).toContain("Enterprise");
    fireEvent.click(within(section).getByRole("button", { name: "Monthly" }));
    expect(section.textContent).toContain(monthly);
  });

  it("renders Creator dashboard upgrade prices and exact savings in its actual dialog", () => {
    const view = render(React.createElement(CreatorDashboardPage));
    fireEvent.click(view.getByRole("button", { name: /Upgrade to remove/ }));
    const dialog = view.getByRole("dialog");
    expect(dialog.textContent).toContain("$119.97");
    fireEvent.click(within(dialog).getByRole("button", { name: /Annual/ }));
    expect(dialog.textContent).toContain("$999.97");
    expect(dialog.textContent).toContain("/yr");
    expect(dialog.textContent).toContain("Billed upfront annually");
    expect(dialog.textContent).toContain("Save $439.67 vs. 12 monthly payments");
    expect(course360AnnualSavings("creator_desktop").amount).toBe(439.67);
    expect(state.checkout).not.toHaveBeenCalled();
  });
});
