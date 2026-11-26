// @vitest-environment jsdom
import React from "react";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { COURSE360_PRICES } from "../shared/course360Pricing";

const state = vi.hoisted(() => ({
  branding: null as any,
  registerOptions: null as any,
  checkoutPending: false,
  registerPending: false,
  claimPending: false,
  checkout: vi.fn(),
  register: vi.fn(),
  claim: vi.fn(),
  setAuth: vi.fn(),
  useUtils: vi.fn(),
  useRegister: vi.fn(),
  useCheckout: vi.fn(),
  useClaim: vi.fn(),
}));
vi.mock("@/hooks/useOrgAuthBranding", () => ({
  useOrgAuthBranding: () => ({
    branding: state.branding,
    primary: "#185a69",
    buttonText: "#ffffff",
    displayName: state.branding?.name ?? "Course360",
  }),
}));
vi.mock("@/lib/trpc", () => ({ trpc: {
  useUtils: (...args: unknown[]) => {
    state.useUtils(...args);
    return { auth: { me: { setData: state.setAuth } } };
  },
  customAuth: { register: { useMutation: (options: unknown) => {
    state.useRegister(options);
    state.registerOptions = options;
    return { mutate: state.register, isPending: state.registerPending };
  } } },
  billing: { createPlatformTrialCheckout: { useMutation: () => {
    state.useCheckout();
    return { mutateAsync: state.checkout, isPending: state.checkoutPending };
  } } },
  blueprintReferrals: { claimPendingInstall: { useMutation: () => {
    state.useClaim();
    return { mutateAsync: state.claim, isPending: state.claimPending };
  } } },
} }));
// The additive claim panel has its own rendered hook-boundary suite. Preserve
// these original guidance/registration assertions and their no-RPC boundary.
vi.mock("@/components/Course360PaidSchoolClaims", () => ({ default: () => null }));
import RegisterPage from "../client/src/pages/auth/RegisterPage";
import AccountSetupPage from "../client/src/pages/auth/AccountSetupPage";

beforeEach(() => {
  vi.clearAllMocks();
  state.branding = null;
  state.registerOptions = null;
  state.checkoutPending = false;
  state.registerPending = false;
  state.claimPending = false;
  // Stop before browser navigation: this is a real rendered UI test, not a provider call.
  state.checkout.mockRejectedValue(new Error("Isolated checkout unavailable"));
  window.history.replaceState({}, "", "/register");
  localStorage.clear();
  sessionStorage.clear();
  const deny = vi.fn(() => { throw new Error("Network forbidden in account setup UI tests"); });
  vi.stubGlobal("fetch", deny);
  vi.stubGlobal("XMLHttpRequest", deny);
  vi.stubGlobal("WebSocket", deny);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const planSelect = () => screen.getByRole("combobox", { name: "Choose your plan" }) as HTMLSelectElement;
const intervalSelect = () => screen.getByRole("combobox", { name: "Billing schedule" }) as HTMLSelectElement;
const optionLabels = () => within(planSelect()).getAllByRole("option").map(option => option.textContent);
const fillOwner = (email = "owner@example.test") => {
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "School Owner" } });
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: email } });
};
const expectNoAccountEffects = () => {
  expect(state.register).not.toHaveBeenCalled();
  expect(state.claim).not.toHaveBeenCalled();
  expect(state.setAuth).not.toHaveBeenCalled();
  expect(localStorage.getItem("teachific_auth_cache")).toBeNull();
};

describe("rendered root registration exact dollar pricing and checkout-first boundary", () => {
  it("renders all three exact monthly shared dollar prices, with no rounded or free public option", () => {
    render(<RegisterPage />);
    expect(optionLabels()).toEqual(["Starter — $39.97/month", "Builder — $99.97/month", "Pro — $199.97/month"]);
    for (const [index, plan] of (["starter", "builder", "pro"] as const).entries()) {
      expect(optionLabels()[index]).toContain(`$${COURSE360_PRICES[plan].monthly.toFixed(2)}`);
    }
    expect(planSelect().value).toBe("starter");
    expect(intervalSelect().value).toBe("monthly");
    expect(screen.queryByLabelText("Password")).toBeNull();
    expect(screen.queryByRole("option", { name: /free|\$39\/|\$99\/|\$199\//i })).toBeNull();
    expect(state.checkout).not.toHaveBeenCalled();
    expectNoAccountEffects();
  });

  it("updates rendered labels to exact full annual totals and back without changing the selected plan", () => {
    render(<RegisterPage />);
    fireEvent.change(planSelect(), { target: { value: "pro" } });
    fireEvent.change(intervalSelect(), { target: { value: "annual" } });
    expect(optionLabels()).toEqual(["Starter — $399.97/year", "Builder — $999.97/year", "Pro — $1999.97/year"]);
    for (const [index, plan] of (["starter", "builder", "pro"] as const).entries()) {
      expect(optionLabels()[index]).toContain(`$${COURSE360_PRICES[plan].annual.toFixed(2)}`);
    }
    expect(planSelect().value).toBe("pro");
    expect(screen.getByText("Annual billing charges the full yearly amount at once, not monthly.")).toBeTruthy();
    expect(optionLabels().some(label => label?.includes("/month"))).toBe(false);
    fireEvent.change(intervalSelect(), { target: { value: "monthly" } });
    expect(optionLabels()).toEqual(["Starter — $39.97/month", "Builder — $99.97/month", "Pro — $199.97/month"]);
    expect(planSelect().value).toBe("pro");
    expect(state.checkout).not.toHaveBeenCalled();
    expectNoAccountEffects();
  });

  it.each([
    ["starter", "monthly"], ["starter", "annual"],
    ["builder", "monthly"], ["builder", "annual"],
    ["pro", "monthly"], ["pro", "annual"],
  ] as const)("submits only selected %s %s checkout, with no pre-checkout identity or entitlement effect", async (plan, interval) => {
    render(<RegisterPage />);
    fillOwner();
    fireEvent.change(planSelect(), { target: { value: plan } });
    fireEvent.change(intervalSelect(), { target: { value: interval } });
    expect(state.checkout).not.toHaveBeenCalled();
    expect(screen.getByText("A card is required now. Your plan begins charging automatically after the 14-day trial unless cancelled.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continue to secure checkout" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Isolated checkout unavailable"));
    expect(state.checkout).toHaveBeenCalledTimes(1);
    expect(state.checkout).toHaveBeenCalledWith({ name: "School Owner", email: "owner@example.test", plan, interval, origin: window.location.origin });
    expect(state.checkout.mock.calls[0][0]).not.toHaveProperty("password");
    expect(state.checkout.mock.calls[0][0]).not.toHaveProperty("amount");
    expect(screen.queryByText("Check your inbox")).toBeNull();
    expectNoAccountEffects();
  });

  it.each(["free", "attacker-plan"])("ignores unsupported plan hint %s and still offers only paid plans", plan => {
    window.history.replaceState({}, "", `/register?plan=${plan}&success=true&paid=true`);
    render(<RegisterPage />);
    expect(planSelect().value).toBe("starter");
    expect(optionLabels()).toHaveLength(3);
    expect(state.checkout).not.toHaveBeenCalled();
    expectNoAccountEffects();
  });

  it("retains an approved plan hint but never uses success, role, token or school hints to authorize", () => {
    window.history.replaceState({}, "", "/register?plan=builder&success=true&checkout=success&session_id=cs_forged&paid=true&role=site_owner&orgId=99&token=forged");
    const { container } = render(<RegisterPage />);
    expect(planSelect().value).toBe("builder");
    expect(screen.getByRole("heading", { name: "Start your school checkout" })).toBeTruthy();
    expect(container.textContent).toContain("account and school setup happens only after checkout is verified");
    expect(container.textContent).toContain("New accounts receive a password-setup email; existing accounts sign in normally and verify the new-school claim separately.");
    expect(container.textContent).toContain("Schools purchased with the same email remain separate.");
    expect(container.textContent).toContain("does not automatically merge schools, sign you in, or switch your active school");
    expect(state.checkout).not.toHaveBeenCalled();
    expectNoAccountEffects();
  });

  it("preserves pending checkout progress and the original disabled submit control", () => {
    state.checkoutPending = true;
    render(<RegisterPage />);
    const button = screen.getByRole("button", { name: "Opening secure checkout..." }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(state.checkout).not.toHaveBeenCalled();
    expectNoAccountEffects();
  });
});

describe("rendered organization-domain student registration preservation", () => {
  it("retains school branding, password controls and direct student registration without paid checkout", async () => {
    state.branding = { name: "Example School", logoUrl: "https://school.example.test/logo.png" };
    render(<RegisterPage />);
    expect(screen.getByRole("heading", { name: "Join Example School" })).toBeTruthy();
    expect(screen.getByText("Create your student account")).toBeTruthy();
    expect(screen.getByAltText("Example School").getAttribute("src")).toBe(state.branding.logoUrl);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByText(/New accounts receive a password-setup email/)).toBeNull();
    fillOwner("student@example.test");
    const password = screen.getByLabelText("Password") as HTMLInputElement;
    expect(password.type).toBe("password");
    expect(password.minLength).toBe(8);
    expect(password.required).toBe(true);
    expect(password.autocomplete).toBe("new-password");
    fireEvent.change(password, { target: { value: "short" } });
    expect(screen.getByText("Password must be at least 8 characters")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "" }));
    expect(password.type).toBe("text");
    fireEvent.change(password, { target: { value: "student-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(state.register).toHaveBeenCalledWith({ name: "School Owner", email: "student@example.test", password: "student-password" });
    expect(state.checkout).not.toHaveBeenCalled();
    const user = { id: 7, email: "student@example.test", role: "member" };
    await state.registerOptions.onSuccess({ autoSignedIn: true, user, orgSlug: null });
    expect(state.setAuth).toHaveBeenCalledWith(undefined, user);
    expect(JSON.parse(localStorage.getItem("teachific_auth_cache")!)).toEqual(user);
    expect(window.location.pathname).toBe("/lms");
  });

  it("retains the original student email verification screen and sign-in link", async () => {
    state.branding = { name: "Example School" };
    render(<RegisterPage />);
    fillOwner("student@example.test");
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "student-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await state.registerOptions.onSuccess({ autoSignedIn: false });
    await waitFor(() => expect(screen.getByRole("heading", { name: "Check your inbox" })).toBeTruthy());
    expect(screen.getByText("student@example.test")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to Sign In" }).getAttribute("href")).toBe("/login");
    expect(state.checkout).not.toHaveBeenCalled();
  });
});

describe("rendered neutral post-checkout account setup guidance", () => {
  it("explains verification-first processing, new and existing identities, trial policy and separate schools truthfully", () => {
    const { container } = render(<AccountSetupPage />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Finish setting up your school");
    expect(container.textContent).toContain("After verified checkout, school setup may take a few moments.");
    expect(container.textContent).toContain("This page does not confirm payment or sign you in.");
    expect(container.textContent).toContain("New account? After checkout is verified, we will send a secure password-setup link");
    expect(container.textContent).toContain("Sign in normally with your existing account, verify your email if needed, and claim your new school separately.");
    expect(container.textContent).toContain("Checkout does not reset your password or automatically sign you in.");
    expect(container.textContent).toContain("A card is required at secure Stripe checkout.");
    expect(container.textContent).toContain("14-day trial unless you cancel before it ends");
    expect(container.textContent).toContain("Schools purchased with the same email remain separate.");
    expect(container.textContent).toContain("There is no automatic school merging or active-school switching");
    expect(container.textContent).not.toMatch(/Your trial checkout is complete|Your card was securely collected|payment successful|you are signed in/i);
    expect(state.useUtils).not.toHaveBeenCalled();
    expect(state.useCheckout).not.toHaveBeenCalled();
    expect(state.useRegister).not.toHaveBeenCalled();
    expect(state.useClaim).not.toHaveBeenCalled();
    expect(state.checkout).not.toHaveBeenCalled();
    expectNoAccountEffects();
  });

  it("retains sign-in and offers explicit dashboard, password and support recovery on existing App routes", () => {
    render(<AccountSetupPage />);
    const links = [
      ["Go to sign in", "/login"],
      ["Open your dashboard", "/lms"],
      ["Recover your password", "/forgot-password"],
      ["Contact support", "/support"],
    ] as const;
    const app = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
    for (const [name, href] of links) {
      expect(screen.getByRole("link", { name }).getAttribute("href")).toBe(href);
      expect(app).toContain(`<Route path="${href}"`);
    }
    expect(screen.getByRole("link", { name: "Contact support" }).closest("p")?.textContent).toContain("before starting another checkout");
    expect(window.location.pathname).toBe("/register");
    expectNoAccountEffects();
  });

  it.each([
    "?success=true&paid=true&checkout=success",
    "?checkout=platform_trial&session_id=cs_forged",
    "?token=forged&authToken=forged&role=site_owner&email=attacker@example.test",
    "?orgId=99&org=attacker&school=attacker&claimId=forged&autoSignedIn=true",
    "?redirect=https%3A%2F%2Fevil.example.test&returnTo=%2F%2Fevil.example.test",
    "?success=true&entitled=true&subscription_status=active&plan=pro&interval=annual",
  ])("renders exactly the same unprivileged guidance for hostile URL %s", query => {
    window.history.replaceState({}, "", "/account-setup");
    const baseline = render(<AccountSetupPage />);
    const originalMarkup = baseline.container.innerHTML;
    baseline.unmount();
    window.history.replaceState({}, "", `/account-setup${query}`);
    const authCache = JSON.stringify({ id: 3, role: "user", orgId: 7 });
    localStorage.setItem("teachific_auth_cache", authCache);
    localStorage.setItem("activeOrgId", "7");
    sessionStorage.setItem("existing-session-marker", "unchanged");
    const cookieBefore = document.cookie;
    const urlBefore = window.location.href;
    const { container } = render(<AccountSetupPage />);
    expect(container.innerHTML).toBe(originalMarkup);
    expect(window.location.href).toBe(urlBefore);
    expect(document.cookie).toBe(cookieBefore);
    expect(localStorage.getItem("teachific_auth_cache")).toBe(authCache);
    expect(localStorage.getItem("activeOrgId")).toBe("7");
    expect(sessionStorage.getItem("existing-session-marker")).toBe("unchanged");
    expect(state.useUtils).not.toHaveBeenCalled();
    expect(state.useCheckout).not.toHaveBeenCalled();
    expect(state.useRegister).not.toHaveBeenCalled();
    expect(state.useClaim).not.toHaveBeenCalled();
    for (const fn of [state.checkout, state.register, state.claim, state.setAuth, fetch]) expect(fn).not.toHaveBeenCalled();
    expect(container.querySelector("form")).toBeNull();
  });
});

describe("byte-exact student branch source preservation supplements rendered behavior", () => {
  const source = () => readFileSync(resolve(process.cwd(), "client/src/pages/auth/RegisterPage.tsx"), "utf8");
  const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
  it.each([
    ["checkout/student handlers", "  const beginPlatformTrial = async () => {", "  if (success) {", "ee740853268defd8b3a626c8285f1ccc3da213a2e9482ace56e7f537bab3c930"],
    ["student password UI", "            {isOrgSubdomain && <div", "            {!isOrgSubdomain && <>", "4fec6693d961371b7b4ab583594f71e339ed769a73a95e997731b8955beeafbb"],
    ["student submit controls", "            <Button\n              type=\"submit\"", "          </form>", "15e083b99ab2282fd5ae7b1afdd7df45f2f27d68e26b231ae18a789ad2d5d9b0"],
  ])("keeps the approved original %s byte-for-byte", (_name, start, end, hash) => {
    const text = source();
    const startAt = text.indexOf(start);
    const endAt = text.indexOf(end, startAt);
    expect(startAt).toBeGreaterThanOrEqual(0);
    expect(endAt).toBeGreaterThan(startAt);
    expect(sha256(text.slice(startAt, endAt))).toBe(hash);
  });
});
