// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { COURSE360_CROSS_TOOL_OFFERS } from "../shared/course360CrossToolOffers";
import { Course360CrossToolCheckout, isCourse360StripeCheckoutUrl } from "../client/src/components/Course360CrossToolCheckout";
import LandingPage from "../client/src/pages/LandingPage";

const boundary = vi.hoisted(() => ({
  query: {} as any,
  refetch: vi.fn(),
  mutateAsync: vi.fn(),
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  auth: { user: null as any, loading: false },
}));
vi.mock("@/lib/trpc", () => ({ trpc: { billing: {
  getCrossToolOffers: { useQuery: (...args: any[]) => {
    React.useState(null); boundary.useQuery(...args);
    return { ...boundary.query, refetch: boundary.refetch };
  } },
  createCrossToolCheckout: { useMutation: (...args: any[]) => {
    React.useRef(null); boundary.useMutation(...args);
    return { mutateAsync: boundary.mutateAsync, isPending: false };
  } },
} } }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => { React.useState(null); return boundary.auth; } }));

const catalog = (overrides = {}) => ({ offers: COURSE360_CROSS_TOOL_OFFERS, ready: true, catalogReady: true, provisioningReady: true, reason: null, ...overrides });
const readyQuery = () => ({ data: catalog(), isLoading: false, isFetching: false, error: null });
const stripeUrl = "https://checkout.stripe.com/c/pay/cs_test_offline_adapter";
const packageButton = (key: "builder" | "pro" = "builder") => screen.getByRole("button", { name: `Continue with Course360™ ${key === "pro" ? "Pro" : "Builder"} + Creator Web` }) as HTMLButtonElement;
const dialog = () => screen.getByRole("dialog", { name: "Review your new-school package" });
const submitButton = () => within(dialog()).getByRole("button", { name: /Continue to secure Stripe Checkout|Retry secure checkout|Opening secure checkout/ }) as HTMLButtonElement;
async function select(key: "builder" | "pro" = "builder", interval: "monthly" | "annual" = "monthly") {
  if (interval === "annual") fireEvent.click(screen.getByRole("button", { name: "Annual" }));
  const button = packageButton(key); button.focus(); fireEvent.click(button);
  await waitFor(() => expect(dialog()).toBeTruthy());
  await waitFor(() => expect(boundary.mutateAsync).not.toHaveBeenCalled());
}
function identity(name = "  Avery School Owner  ", email = "  avery@example.invalid  ") {
  fireEvent.change(within(dialog()).getByRole("textbox", { name: "Your name" }), { target: { value: name } });
  fireEvent.change(within(dialog()).getByRole("textbox", { name: "Email address" }), { target: { value: email } });
}
function consent() { fireEvent.click(within(dialog()).getByRole("checkbox")); }
function forceSubmit() { fireEvent.submit(within(dialog()).getByRole("textbox", { name: "Your name" }).closest("form")!); }

beforeEach(() => {
  vi.clearAllMocks(); boundary.auth.user = null; boundary.auth.loading = false;
  boundary.query = readyQuery();
  boundary.refetch.mockImplementation(async () => ({ data: boundary.query.data, error: boundary.query.error }));
  boundary.mutateAsync.mockResolvedValue({ url: stripeUrl });
  window.history.replaceState({}, "", "/");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network denied in checkout UI tests"); }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Course360 actual public checkout adapter catalog boundary", () => {
  it("uses the actual billing hooks with no input and disables loading checkout without calls", () => {
    boundary.query = { data: undefined, isLoading: true, isFetching: true, error: null };
    render(<Course360CrossToolCheckout />);
    expect(boundary.useQuery).toHaveBeenCalledWith(undefined, expect.objectContaining({ retry: false, staleTime: 0, refetchOnWindowFocus: true, refetchInterval: 60_000 }));
    expect(boundary.useMutation).toHaveBeenCalledWith();
    expect(screen.getByRole("status").textContent).toContain("has not yet been confirmed");
    for (const interval of ["Monthly", "Annual"]) {
      fireEvent.click(screen.getByRole("button", { name: interval }));
      for (const key of ["builder", "pro"] as const) { expect(packageButton(key).disabled).toBe(true); fireEvent.click(packageButton(key)); }
    }
    expect(boundary.mutateAsync).not.toHaveBeenCalled(); expect(boundary.refetch).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("fails closed for catalog errors even with stale ready data and offers retry", () => {
    boundary.query = { ...readyQuery(), error: new Error("Network offline") };
    render(<Course360CrossToolCheckout />);
    expect(screen.getByRole("alert").textContent).toContain("Unable to check package availability");
    expect(packageButton().disabled).toBe(true); expect(packageButton("pro").disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Retry package availability" }));
    expect(boundary.refetch).toHaveBeenCalledTimes(1); expect(boundary.mutateAsync).not.toHaveBeenCalled();
  });

  it.each([
    { ready: false, catalogReady: true, provisioningReady: true },
    { ready: true, catalogReady: false, provisioningReady: true },
    { ready: true, catalogReady: true, provisioningReady: false },
  ])("requires overall and both authoritative readiness flags for all four choices: %j", flags => {
    boundary.query = { ...readyQuery(), data: catalog({ ...flags, reason: "Durable package provisioning is unavailable." }) };
    render(<Course360CrossToolCheckout />);
    expect(screen.getByRole("alert").textContent).toContain("Durable package provisioning is unavailable");
    for (const interval of ["Monthly", "Annual"]) {
      fireEvent.click(screen.getByRole("button", { name: interval }));
      expect(packageButton().disabled).toBe(true); expect(packageButton("pro").disabled).toBe(true);
    }
    expect(boundary.mutateAsync).not.toHaveBeenCalled();
  });

  it("enables all four exact ready choices without starting a mutation on interval selection", () => {
    const { container } = render(<Course360CrossToolCheckout />);
    expect(container.textContent).toContain("$169.97"); expect(container.textContent).toContain("$249.97");
    for (const interval of ["Monthly", "Annual", "Monthly"]) {
      fireEvent.click(screen.getByRole("button", { name: interval }));
      expect(packageButton().disabled).toBe(false); expect(packageButton("pro").disabled).toBe(false);
      if (interval === "Annual") { expect(container.textContent).toContain("$1,599.97"); expect(container.textContent).toContain("$2,497.00"); }
    }
    expect(boundary.mutateAsync).not.toHaveBeenCalled(); expect(boundary.refetch).not.toHaveBeenCalled();
  });

  it("disables stale ready choices during a catalog refetch", () => {
    boundary.query = { ...readyQuery(), isFetching: true };
    render(<Course360CrossToolCheckout />);
    expect(packageButton().disabled).toBe(true); expect(packageButton("pro").disabled).toBe(true);
    expect(boundary.mutateAsync).not.toHaveBeenCalled();
  });

  it("blocks readiness drift in an open dialog and recovers only after retry", async () => {
    const view = render(<Course360CrossToolCheckout />);
    await select("pro", "annual"); identity(); consent(); expect(submitButton().disabled).toBe(false);
    boundary.query = { ...readyQuery(), data: catalog({ ready: false, reason: "Catalog expired" }) };
    view.rerender(<Course360CrossToolCheckout />);
    expect(submitButton().disabled).toBe(true);
    expect(within(dialog()).getByRole("alert").textContent).toContain("no longer confirmed ready");
    forceSubmit(); expect(boundary.mutateAsync).not.toHaveBeenCalled(); expect(boundary.refetch).not.toHaveBeenCalled();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Retry package availability" }));
    expect(boundary.refetch).toHaveBeenCalledTimes(1);
    boundary.query = readyQuery(); view.rerender(<Course360CrossToolCheckout />);
    expect(submitButton().disabled).toBe(false);
    expect(dialog().textContent).toContain("$2,497.00 USD each year, billed all at once");
  });

  it("fresh pre-submit readiness loss prevents mutation and preserves the selected annual offer", async () => {
    boundary.refetch.mockResolvedValue({ data: catalog({ ready: false }), error: null });
    const navigate = vi.fn(); render(<Course360CrossToolCheckout navigateToCheckout={navigate} />);
    await select("builder", "annual"); identity(); consent(); fireEvent.click(submitButton());
    await waitFor(() => expect(within(dialog()).getByRole("alert").textContent).toContain("Package availability changed"));
    expect(boundary.refetch).toHaveBeenCalledTimes(1); expect(boundary.mutateAsync).not.toHaveBeenCalled(); expect(navigate).not.toHaveBeenCalled();
    expect(dialog().textContent).toContain("$1,599.97 USD each year, billed all at once");
  });
});

describe("Course360 latest-result race boundary", () => {
  it("blocks a newer not-ready render even if an earlier awaited refetch resolves ready", async () => {
    let resolveCatalog!: (value: any) => void;
    boundary.refetch.mockImplementation(() => new Promise(resolve => { resolveCatalog = resolve; }));
    const navigate = vi.fn();
    const view = render(<Course360CrossToolCheckout navigateToCheckout={navigate} />);
    await select("pro", "annual"); identity(); consent(); forceSubmit();
    boundary.query = { ...readyQuery(), data: catalog({ ready: false }) };
    view.rerender(<Course360CrossToolCheckout navigateToCheckout={navigate} />);
    await act(async () => resolveCatalog({ data: catalog(), error: null }));
    expect(boundary.mutateAsync).not.toHaveBeenCalled(); expect(navigate).not.toHaveBeenCalled();
    expect(dialog().textContent).toContain("Package availability changed");
    expect(submitButton().disabled).toBe(true);
  });
});

describe("Course360 actual new-school identity and trial consent", () => {
  it("opens an accessible focus-managed review dialog with explicit identity and no account creation", async () => {
    render(<Course360CrossToolCheckout />); await select("pro", "annual");
    expect(document.activeElement).toBe(within(dialog()).getByRole("textbox", { name: "Your name" }));
    expect(dialog().textContent).toContain("Course360™ Pro + Creator Web · Annual billing");
    expect(dialog().textContent).toContain("separate new school and its own subscription");
    expect(dialog().textContent).toContain("does not change or upgrade an existing school");
    expect(dialog().textContent).toContain("A card is required at Stripe Checkout for the 14-day trial");
    expect(dialog().textContent).toContain("automatically renews");
    expect(dialog().textContent).toContain("$2,497.00 USD each year, billed all at once (not monthly installments)");
    expect(dialog().textContent).toContain("normal Pro school benefits remain included");
    expect(dialog().querySelector('input[type="password"]')).toBeNull();
    expect(within(dialog()).getAllByRole("textbox")).toHaveLength(2);
    expect(boundary.refetch).not.toHaveBeenCalled(); expect(boundary.mutateAsync).not.toHaveBeenCalled();
    expect(submitButton().disabled).toBe(true);
  });

  it("requires valid name, email, and affirmative selected trial terms even for direct form submits", async () => {
    render(<Course360CrossToolCheckout />); await select();
    forceSubmit(); expect(boundary.mutateAsync).not.toHaveBeenCalled();
    expect(within(dialog()).getByRole("alert").textContent).toContain("Enter your name and a valid email");
    identity("", "valid@example.invalid"); consent(); forceSubmit(); expect(submitButton().disabled).toBe(true);
    identity("Owner", "not-an-email"); forceSubmit(); expect(submitButton().disabled).toBe(true);
    identity(); consent(); // remove previously checked consent
    forceSubmit(); expect(submitButton().disabled).toBe(true);
    expect(boundary.refetch).not.toHaveBeenCalled(); expect(boundary.mutateAsync).not.toHaveBeenCalled();
    consent(); expect(submitButton().disabled).toBe(false);
  });

  it.each([
    ["builder", "monthly", "builder_creator_web", "$169.97 USD each month"],
    ["builder", "annual", "builder_creator_web", "$1,599.97 USD each year, billed all at once"],
    ["pro", "monthly", "pro_creator_web", "$249.97 USD each month"],
    ["pro", "annual", "pro_creator_web", "$2,497.00 USD each year, billed all at once"],
  ] as const)("delivers only exact new-school fields for %s %s after explicit confirmation", async (key, interval, offer, amount) => {
    const navigate = vi.fn(); render(<Course360CrossToolCheckout navigateToCheckout={navigate} />);
    await select(key, interval); identity(); consent();
    expect(dialog().textContent).toContain(amount); expect(boundary.mutateAsync).not.toHaveBeenCalled();
    fireEvent.click(submitButton());
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(stripeUrl));
    expect(boundary.refetch).toHaveBeenCalledTimes(1); expect(boundary.mutateAsync).toHaveBeenCalledTimes(1);
    expect(boundary.mutateAsync).toHaveBeenCalledWith({ target: "new_school", offer, interval, name: "Avery School Owner", email: "avery@example.invalid", origin: window.location.origin });
    expect(Object.keys(boundary.mutateAsync.mock.calls[0][0]).sort()).toEqual(["email", "interval", "name", "offer", "origin", "target"]);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it("cancel/back restores focus, makes no calls, and keeps annual selection for reopening", async () => {
    render(<Course360CrossToolCheckout />); await select("pro", "annual"); identity(); consent();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Cancel / back to packages" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(packageButton("pro"));
    expect(screen.getByRole("button", { name: "Annual" }).getAttribute("aria-pressed")).toBe("true");
    expect(boundary.refetch).not.toHaveBeenCalled(); expect(boundary.mutateAsync).not.toHaveBeenCalled();
    await select("pro"); expect(dialog().textContent).toContain("$2,497.00 USD each year");
    expect((within(dialog()).getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
    expect((within(dialog()).getByRole("textbox", { name: "Your name" }) as HTMLInputElement).value).toBe("");
  });

  it("accessible close and Escape cancel before checkout without calls", async () => {
    render(<Course360CrossToolCheckout />); await select();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await select(); fireEvent.keyDown(document.activeElement!, { key: "Escape", code: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(boundary.refetch).not.toHaveBeenCalled(); expect(boundary.mutateAsync).not.toHaveBeenCalled();
  });
});

describe("Course360 actual checkout delivery resilience", () => {
  it("synchronously locks rapid duplicate submits during fresh catalog and checkout pending", async () => {
    let resolveCatalog!: (value: any) => void, resolveCheckout!: (value: any) => void;
    boundary.refetch.mockImplementation(() => new Promise(resolve => { resolveCatalog = resolve; }));
    boundary.mutateAsync.mockImplementation(() => new Promise(resolve => { resolveCheckout = resolve; }));
    const navigate = vi.fn(); render(<Course360CrossToolCheckout navigateToCheckout={navigate} />);
    await select(); identity(); consent();
    forceSubmit(); forceSubmit(); forceSubmit();
    expect(boundary.refetch).toHaveBeenCalledTimes(1); expect(boundary.mutateAsync).not.toHaveBeenCalled();
    expect(submitButton().disabled).toBe(true);
    expect(within(dialog()).getByRole("status").textContent).toContain("opening secure Stripe Checkout");
    expect((within(dialog()).getByRole("button", { name: "Cancel / back to packages" }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(dialog()).queryByRole("button", { name: "Close" })).toBeNull();
    fireEvent.keyDown(document.activeElement!, { key: "Escape", code: "Escape" }); expect(dialog()).toBeTruthy();
    await act(async () => resolveCatalog({ data: catalog(), error: null }));
    expect(boundary.mutateAsync).toHaveBeenCalledTimes(1);
    forceSubmit(); expect(boundary.mutateAsync).toHaveBeenCalledTimes(1);
    await act(async () => resolveCheckout({ url: stripeUrl }));
    expect(navigate).toHaveBeenCalledTimes(1);
    forceSubmit(); expect(boundary.mutateAsync).toHaveBeenCalledTimes(1);
    expect(boundary.refetch).toHaveBeenCalledTimes(1); expect(submitButton().disabled).toBe(true);
  });

  it("renders checkout error, preserves consent/identity/annual selection and permits explicit retry", async () => {
    boundary.mutateAsync.mockRejectedValueOnce(new Error("Secure checkout delivery temporarily unavailable."));
    const navigate = vi.fn(); render(<Course360CrossToolCheckout navigateToCheckout={navigate} />);
    await select("pro", "annual"); identity(); consent(); fireEvent.click(submitButton());
    await waitFor(() => expect(within(dialog()).getByRole("alert").textContent).toContain("Secure checkout delivery temporarily unavailable"));
    expect(navigate).not.toHaveBeenCalled(); expect(submitButton().disabled).toBe(false);
    expect(dialog().textContent).toContain("$2,497.00 USD each year");
    expect((within(dialog()).getByRole("textbox", { name: "Your name" }) as HTMLInputElement).value).toBe("  Avery School Owner  ");
    expect((within(dialog()).getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
    fireEvent.click(within(dialog()).getByRole("button", { name: "Retry secure checkout" }));
    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
    expect(boundary.refetch).toHaveBeenCalledTimes(2); expect(boundary.mutateAsync).toHaveBeenCalledTimes(2);
    expect(boundary.mutateAsync.mock.calls[1][0]).toEqual(boundary.mutateAsync.mock.calls[0][0]);
  });

  it("refetch delivery errors prevent checkout and allow another explicit attempt", async () => {
    boundary.refetch.mockRejectedValueOnce(new Error("Package availability connection failed."));
    const navigate = vi.fn(); render(<Course360CrossToolCheckout navigateToCheckout={navigate} />);
    await select(); identity(); consent(); fireEvent.click(submitButton());
    await waitFor(() => expect(within(dialog()).getByRole("alert").textContent).toContain("Package availability connection failed"));
    expect(boundary.mutateAsync).not.toHaveBeenCalled(); expect(navigate).not.toHaveBeenCalled();
    fireEvent.click(submitButton()); await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
    expect(boundary.refetch).toHaveBeenCalledTimes(2); expect(boundary.mutateAsync).toHaveBeenCalledTimes(1);
  });

  it.each([
    "https://evil.invalid/c/pay", "http://checkout.stripe.com/c/pay", "javascript:alert(1)",
    "https://checkout.stripe.com.evil.invalid/c/pay", "https://checkout.stripe.com@evil.invalid/c/pay",
    "https://owner:secret@checkout.stripe.com/c/pay", "https://checkout.stripe.com:8443/c/pay",
    "/account-setup?success=true", "//checkout.stripe.com/c/pay", " https://checkout.stripe.com/c/pay",
    "https://checkout.stripe.com\\@evil.invalid/c/pay", "https://checkout.stripe.com/\nmalformed", "not-a-url",
  ])("rejects unsafe checkout delivery without navigation: %s", async url => {
    boundary.mutateAsync.mockResolvedValue({ url });
    const navigate = vi.fn(); render(<Course360CrossToolCheckout navigateToCheckout={navigate} />);
    await select(); identity(); consent(); fireEvent.click(submitButton());
    await waitFor(() => expect(within(dialog()).getByRole("alert").textContent).toContain("unsafe destination"));
    expect(boundary.mutateAsync).toHaveBeenCalledTimes(1); expect(navigate).not.toHaveBeenCalled();
    expect(submitButton().disabled).toBe(false); expect(screen.queryByText(/payment successful/i)).toBeNull();
  });

  it("navigation failure is visible and unlocks a retry without an access grant", async () => {
    const navigate = vi.fn(() => { throw new Error("Browser checkout navigation failed."); });
    render(<Course360CrossToolCheckout navigateToCheckout={navigate} />);
    await select(); identity(); consent(); fireEvent.click(submitButton());
    await waitFor(() => expect(within(dialog()).getByRole("alert").textContent).toContain("Browser checkout navigation failed"));
    expect(submitButton().disabled).toBe(false); expect(screen.queryByText(/payment successful/i)).toBeNull();
  });

  it("accepts only HTTPS Stripe Checkout without credentials or a nondefault port", () => {
    expect(isCourse360StripeCheckoutUrl(stripeUrl)).toBe(true);
    expect(isCourse360StripeCheckoutUrl("https://checkout.stripe.com:443/c/pay/offline")).toBe(true);
    for (const value of [undefined, null, {}, 42, "https://user@checkout.stripe.com/c/pay", "https://:password@checkout.stripe.com/c/pay", "https://checkout.stripe.com:80/c/pay"]) expect(isCourse360StripeCheckoutUrl(value)).toBe(false);
  });
});

describe("Course360 actual Landing mount and existing-school boundary", () => {
  it("mounts the adapter on the real landing without props and never infers org or grants from URL/user", async () => {
    boundary.auth.user = { id: 77, orgId: 999, name: "Existing Owner", email: "stored@example.invalid", role: "platform_admin" };
    boundary.mutateAsync.mockRejectedValueOnce(new Error("Checkout stopped at the offline delivery boundary."));
    window.history.replaceState({}, "", "/?success=true&paid=true&orgId=999&offer=pro_creator_web&interval=annual&session_id=unverified");
    const { container } = render(<LandingPage params={{ orgId: "999" }} />);
    expect(boundary.useQuery).toHaveBeenCalledWith(undefined, expect.any(Object));
    expect(container.textContent).not.toMatch(/payment successful|trial activated|access granted/i);
    expect(packageButton().disabled).toBe(false);
    fireEvent.click(packageButton()); await waitFor(() => expect(dialog()).toBeTruthy());
    expect(dialog().textContent).toContain("Course360™ Builder + Creator Web · Monthly billing");
    expect((within(dialog()).getByRole("textbox", { name: "Your name" }) as HTMLInputElement).value).toBe("");
    expect((within(dialog()).getByRole("textbox", { name: "Email address" }) as HTMLInputElement).value).toBe("");
    identity(); consent(); fireEvent.click(submitButton());
    await waitFor(() => expect(boundary.mutateAsync).toHaveBeenCalledTimes(1));
    expect(boundary.mutateAsync).toHaveBeenCalledWith({ target: "new_school", offer: "builder_creator_web", interval: "monthly", name: "Avery School Owner", email: "avery@example.invalid", origin: window.location.origin });
    await waitFor(() => expect(within(dialog()).getByRole("alert").textContent).toContain("offline delivery boundary"));
    expect(boundary.auth.user).toEqual({ id: 77, orgId: 999, name: "Existing Owner", email: "stored@example.invalid", role: "platform_admin" });
    expect(container.textContent).not.toMatch(/payment successful|trial activated|access granted/i);
  });

  it("links existing customers to verified /billing for a reviewed change, without a public existing-school mutation", () => {
    render(<Course360CrossToolCheckout />);
    const link = screen.getByRole("link", { name: "Manage your existing school's billing" });
    expect(link.getAttribute("href")).toBe("/billing");
    expect(link.closest("p")?.textContent).toContain("reviewed package change");
    expect(link.closest("p")?.textContent).toContain("does not upgrade an existing school");
    expect(boundary.mutateAsync).not.toHaveBeenCalled();
  });

  it("preserves the explicit pure-props path with no billing hooks and stays hook-safe when switching", async () => {
    const explicit = { catalogStatus: "loading" as const, onCheckout: vi.fn(async () => {}) };
    const view = render(<LandingPage crossToolOffers={explicit} />);
    expect(boundary.useQuery).not.toHaveBeenCalled(); expect(packageButton().disabled).toBe(true);
    view.rerender(<LandingPage />); expect(boundary.useQuery).toHaveBeenCalled(); expect(packageButton().disabled).toBe(false);
    view.rerender(<LandingPage crossToolOffers={explicit} />); expect(packageButton().disabled).toBe(true);
    boundary.auth.loading = true; view.rerender(<LandingPage />);
    boundary.auth.loading = false; view.rerender(<LandingPage />); expect(packageButton().disabled).toBe(false);
    expect(boundary.mutateAsync).not.toHaveBeenCalled(); expect(explicit.onCheckout).not.toHaveBeenCalled();
  });
});
