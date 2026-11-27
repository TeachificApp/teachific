// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getByRole, queryByRole } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import type { Root } from "react-dom/client";
import { isCourse360AccountSetupEntry } from "../client/src/lib/course360AccountSetupEntry";
import { isCourse360PlatformRoot } from "../client/src/lib/platformRoot";

const boundary = vi.hoisted(() => ({
  react: null as any,
  auth: { user: null, loading: false, isAuthenticated: false, error: null } as any,
  useClaimsQuery: vi.fn(), useClaimsMutation: vi.fn(), useCatalogQuery: vi.fn(),
  refetch: vi.fn(), cancel: vi.fn(), mutate: vi.fn(), checkout: vi.fn(),
  invalidateClaims: vi.fn(), invalidateOrgs: vi.fn(), invalidateAdminOrgs: vi.fn(),
  setAuth: vi.fn(), setActiveOrg: vi.fn(), heavyImports: vi.fn(),
}));

// Only identity and remote tRPC hook boundaries are replaced. Production pages,
// claims UI, wouter, React, QueryClientProvider and the real tRPC Provider remain.
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => {
  boundary.react.useState(null);
  return boundary.auth;
} }));
vi.mock("@/lib/trpc", async importOriginal => {
  const actual = await importOriginal<typeof import("../client/src/lib/trpc")>();
  const billing = {
    listPaidSchoolClaims: { useQuery: (...args: any[]) => {
      boundary.react.useState(null);
      boundary.useClaimsQuery(...args);
      return { data: [], isLoading: false, error: null, refetch: boundary.refetch };
    } },
    claimPaidSchool: { useMutation: () => {
      boundary.react.useState(null);
      boundary.useClaimsMutation();
      return { mutateAsync: boundary.mutate, isPending: false };
    } },
    getCrossToolOffers: { useQuery: (...args: any[]) => {
      boundary.react.useState(null);
      boundary.useCatalogQuery(...args);
      return { data: undefined, isLoading: true, isFetching: false, error: null, refetch: boundary.refetch };
    } },
    createCrossToolCheckout: { useMutation: () => {
      boundary.react.useState(null);
      return { mutateAsync: boundary.checkout, isPending: false };
    } },
  };
  return { trpc: new Proxy(actual.trpc, { get(target, key) {
    if (key === "billing") return billing;
    if (key === "useUtils") return () => {
      boundary.react.useRef(null);
      return {
        billing: { listPaidSchoolClaims: { cancel: boundary.cancel, invalidate: boundary.invalidateClaims } },
        orgs: {
          myOrgs: { invalidate: boundary.invalidateOrgs },
          myAdminOrgs: { invalidate: boundary.invalidateAdminOrgs },
          setActiveOrg: { mutate: boundary.setActiveOrg },
        },
        auth: { me: { setData: boundary.setAuth } },
      };
    };
    return Reflect.get(target, key);
  } }) };
});

const platformHosts = [
  "course360.app", "www.course360.app", "COURSE360.APP", "localhost", "127.0.0.1",
  "scormhost-fjxmsdmk.manus.space",
  "3000-ig54ylg35kkhegum4s5q7-c21f4b58.us5.manus.computer",
];
const tenantAndUnknownHosts = [
  "academy.course360.app", "www.academy.course360.app", "academy.example.org",
  "course360.example.org", "unknown.example.test", "course360.app.attacker.test",
  "localhost.attacker.test", "manus.space", "manus.computer", "", "[::1]",
];
const otherPaths = ["/", "/login", "/register", "/lms", "/account-setup/", "/Account-setup", "/ACCOUNT-SETUP", "/account-setup/claim", "/school/example/account-setup", "/%61ccount-setup", "/account-setup?paid=true"];

describe("actual account-setup entry selector", () => {
  it.each(platformHosts)("selects exact setup only on existing platform host %s", hostname => {
    expect(isCourse360PlatformRoot({ hostname, pathname: "/" })).toBe(true);
    expect(isCourse360AccountSetupEntry({ hostname, pathname: "/account-setup" })).toBe(true);
  });
  it.each(tenantAndUnknownHosts)("retains original App routing for tenant/custom/unknown host %s", hostname => {
    expect(isCourse360PlatformRoot({ hostname, pathname: "/" })).toBe(false);
    expect(isCourse360AccountSetupEntry({ hostname, pathname: "/account-setup" })).toBe(false);
  });
  it.each(otherPaths)("does not select a non-exact setup pathname %s", pathname => {
    for (const hostname of platformHosts) expect(isCourse360AccountSetupEntry({ hostname, pathname })).toBe(false);
  });
  it.each(["", "?checkout=platform_trial&session_id=cs_fixture", "?success=true&paid=true&role=site_owner&orgId=99&claimId=forged", "?returnTo=https%3A%2F%2Fevil.example.test#account-setup"])("ignores query/hash hints for entry selection: %s", suffix => {
    for (const hostname of ["course360.app", "localhost", "scormhost-fjxmsdmk.manus.space", "academy.course360.app", "academy.example.org"]) {
      const location = new URL(`https://${hostname}/account-setup${suffix}`);
      expect(isCourse360AccountSetupEntry(location)).toBe(isCourse360AccountSetupEntry({ hostname, pathname: "/account-setup" }));
    }
  });
  it("never reads search or hash and does not mutate the supplied location", () => {
    const location = Object.freeze({ hostname: "course360.app", pathname: "/account-setup",
      get search() { throw new Error("Query is not entry authority"); },
      get hash() { throw new Error("Hash is not entry authority"); },
    });
    expect(isCourse360AccountSetupEntry(location)).toBe(true);
  });
});

const syntheticClaim = { claimId: "d38cf9c5-6dfe-4624-9b08-2b475d532802", orgId: 41, createdAt: new Date("2026-11-20T12:00:00Z") };
let react: typeof import("react");
let root: Root;
let host: HTMLDivElement;
let renderErrors: unknown[];
let errorLog: MockInstance<typeof console.error>;
const originalUrl = window.location.href;
const setUrl = (url: string) => (globalThis as any).jsdom.reconfigure({ url });

// Every fresh lazy loader gets one coherent React/ReactDOM module graph. Never
// reset modules while keeping a previous renderer or mocked React singleton.
async function mountBootstrap(url: string) {
  setUrl(url);
  const { AppBootstrap } = await import("../client/src/AppBootstrap");
  await react.act(async () => {
    root.render(react.createElement(AppBootstrap));
    await vi.dynamicImportSettled();
  });
  await react.act(async () => { await vi.dynamicImportSettled(); });
  expect(renderErrors).toEqual([]);
}
function expectNoIdentityOrPaymentEffects() {
  for (const fn of [boundary.mutate, boundary.checkout, boundary.setAuth, boundary.setActiveOrg, fetch]) expect(fn).not.toHaveBeenCalled();
  expect(localStorage.getItem("activeOrgId")).toBe("23");
  expect(localStorage.getItem("teachific_auth_cache")).toBe("existing-auth-marker");
  expect(sessionStorage.getItem("existing-session-marker")).toBe("unchanged");
  expect(document.cookie).toContain("light_entry_fixture=unchanged");
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  react = await import("react");
  boundary.react = react;
  const { createRoot } = await import("react-dom/client");
  // A throw is stronger than a stub component: any request for the heavy module
  // hits the original catch path instead of silently rendering a substitute.
  vi.doMock("../client/src/App", () => {
    boundary.heavyImports();
    throw new Error("Heavy App import forbidden by lightweight-entry regression");
  });
  boundary.auth = { user: null, loading: false, isAuthenticated: false, error: null };
  boundary.cancel.mockResolvedValue(undefined);
  boundary.refetch.mockResolvedValue({ data: [], error: null });
  for (const fn of [boundary.invalidateClaims, boundary.invalidateOrgs, boundary.invalidateAdminOrgs]) fn.mockResolvedValue(undefined);
  boundary.mutate.mockRejectedValue(new Error("No live claim in loader tests"));
  boundary.checkout.mockRejectedValue(new Error("No live checkout in loader tests"));
  setUrl("https://course360.app/account-setup");
  localStorage.clear(); sessionStorage.clear();
  localStorage.setItem("activeOrgId", "23");
  localStorage.setItem("teachific_auth_cache", "existing-auth-marker");
  sessionStorage.setItem("existing-session-marker", "unchanged");
  document.cookie = "light_entry_fixture=unchanged; path=/";
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const deny = vi.fn(() => { throw new Error("Network forbidden in account-setup entry tests"); });
  vi.stubGlobal("fetch", deny);
  vi.stubGlobal("XMLHttpRequest", deny);
  vi.stubGlobal("WebSocket", deny);
  renderErrors = [];
  errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
  host = document.createElement("div"); document.body.append(host);
  root = createRoot(host, { onUncaughtError: error => renderErrors.push(error), onCaughtError: error => renderErrors.push(error) });
});
afterEach(async () => {
  await react.act(async () => root.unmount());
  expect(renderErrors).toEqual([]);
  // Expected loader failures are asserted explicitly; no duplicate-React,
  // invalid-hook or unwrapped-act errors are accepted by this new suite.
  expect(errorLog.mock.calls.filter(([message]) => message !== "[Course360™ App Load Error]")).toEqual([]);
  host.remove();
  vi.restoreAllMocks(); vi.unstubAllGlobals();
  vi.doUnmock("../client/src/App");
  setUrl(originalUrl);
});

describe("actual AppBootstrap with actual standalone setup, claims and providers", () => {
  it.each([
    "https://course360.app/account-setup",
    "https://www.course360.app/account-setup?checkout=platform_trial&session_id=cs_fixture",
    "http://localhost:3000/account-setup",
    "http://127.0.0.1:3000/account-setup",
    "https://scormhost-fjxmsdmk.manus.space/account-setup",
    "https://3000-ig54ylg35kkhegum4s5q7-c21f4b58.us5.manus.computer/account-setup",
  ])("renders real setup and guest claims without requesting heavy App: %s", async url => {
    // Seed existing markers on the same origin used by each rendered fixture.
    setUrl(url);
    localStorage.setItem("activeOrgId", "23"); localStorage.setItem("teachific_auth_cache", "existing-auth-marker");
    sessionStorage.setItem("existing-session-marker", "unchanged"); document.cookie = "light_entry_fixture=unchanged; path=/";
    const beforeUrl = window.location.href;
    await mountBootstrap(url);
    expect(getByRole(host, "heading", { level: 1 }).textContent).toBe("Finish setting up your school");
    expect(getByRole(host, "region", { name: "Claim separate paid schools" })).toBeTruthy();
    expect(host.textContent).toContain("This page does not confirm payment or sign you in.");
    expect(host.textContent).toContain("Sign in normally to check for pending school claims.");
    for (const [name, href] of [["Go to sign in", "/login"], ["Sign in and return to school claims", "/login?returnTo=/account-setup"], ["Open your dashboard", "/lms"], ["Recover your password", "/forgot-password"], ["Contact support", "/support"]]) {
      expect(getByRole(host, "link", { name }).getAttribute("href")).toBe(href);
    }
    expect(boundary.useClaimsQuery).toHaveBeenCalledWith(undefined, expect.objectContaining({ enabled: false, retry: false }));
    expect(boundary.refetch).not.toHaveBeenCalled();
    expect(boundary.heavyImports).not.toHaveBeenCalled();
    expect(boundary.useCatalogQuery).not.toHaveBeenCalled();
    expect(errorLog).not.toHaveBeenCalled();
    expect(window.location.href).toBe(beforeUrl);
    expectNoIdentityOrPaymentEffects();
  });
  it("retains authenticated server-listed claims and required consent without interpreting forged URL proof", async () => {
    boundary.auth = { user: { id: 7, email: "synthetic@example.test", emailVerified: true, role: "user" }, loading: false, isAuthenticated: true, error: null };
    boundary.refetch.mockResolvedValue({ data: [syntheticClaim], error: null });
    const url = "https://course360.app/account-setup?paid=true&success=true&role=site_owner&orgId=99&claimId=forged";
    await mountBootstrap(url);
    expect(getByRole(host, "heading", { name: "Paid school #41" })).toBeTruthy();
    expect(queryByRole(host, "heading", { name: "Paid school #99" })).toBeNull();
    expect((getByRole(host, "checkbox") as HTMLInputElement).checked).toBe(false);
    expect((getByRole(host, "button", { name: "Claim access to this separate school" }) as HTMLButtonElement).disabled).toBe(true);
    expect(boundary.useClaimsQuery).toHaveBeenCalledWith(undefined, expect.objectContaining({ enabled: true }));
    expect(boundary.refetch).toHaveBeenCalledTimes(1);
    expect(boundary.heavyImports).not.toHaveBeenCalled();
    expect(errorLog).not.toHaveBeenCalled();
    expect(window.location.href).toBe(url);
    expectNoIdentityOrPaymentEffects();
  });
  it("preserves actual root two-track marketing without requesting heavy App or setup claims", async () => {
    await mountBootstrap("https://course360.app/?paid=true&success=true");
    expect(getByRole(host, "heading", { level: 1 }).textContent).toBe("Run Your School.Create Content.");
    for (const id of ["run-your-school", "create-content", "pricing", "school-creator-packages"]) expect(host.querySelector(`#${id}`)).not.toBeNull();
    expect(queryByRole(host, "region", { name: "Claim separate paid schools" })).toBeNull();
    expect(boundary.useCatalogQuery).toHaveBeenCalled();
    expect(boundary.useClaimsQuery).not.toHaveBeenCalled();
    expect(boundary.heavyImports).not.toHaveBeenCalled();
    expect(errorLog).not.toHaveBeenCalled();
    expectNoIdentityOrPaymentEffects();
  });
  it.each([
    "https://course360.app/login", "https://course360.app/account-setup/",
    "https://academy.course360.app/account-setup", "https://academy.example.org/account-setup",
    "https://unknown.example.test/account-setup", "https://academy.course360.app/",
  ])("preserves original App import and original catch for nonmatching URL %s", async url => {
    await mountBootstrap(url);
    expect(boundary.heavyImports).toHaveBeenCalledTimes(1);
    expect(getByRole(host, "heading", { name: "We could not load this page." })).toBeTruthy();
    expect(getByRole(host, "button", { name: "Retry loading Course360™" })).toBeTruthy();
    expect(queryByRole(host, "region", { name: "Claim separate paid schools" })).toBeNull();
    expect(boundary.useClaimsQuery).not.toHaveBeenCalled();
    expect(boundary.useCatalogQuery).not.toHaveBeenCalled();
    // Vitest wraps factory throws; the intentional heavy-import failure is its cause.
    expect(errorLog).toHaveBeenCalledWith("[Course360™ App Load Error]", expect.objectContaining({
      cause: expect.objectContaining({ message: "Heavy App import forbidden by lightweight-entry regression" }),
    }));
    expect(boundary.mutate).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("keeps the existing ternary, catch, API fetch credentials and providers with only a preceding setup branch", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/AppBootstrap.tsx"), "utf8");
    const originalSelection = '    return isCourse360PlatformRoot(window.location)\n      ? await import("./pages/LandingPage")\n      : await import("./App");';
    expect(source).toContain(originalSelection);
    expect(source.indexOf('return await import("./pages/auth/AccountSetupPage");')).toBeLessThan(source.indexOf(originalSelection));
    for (const retained of ['return { default: AppLoadFailure };', 'url: "/api/trpc",', 'credentials: "include",', '<trpc.Provider client={trpcClient} queryClient={queryClient}>', '<QueryClientProvider client={queryClient}>', '<Suspense fallback={<AppLoadFallback />}>', '<DeferredApp />', 'redirectToLoginIfUnauthorized(error);']) expect(source).toContain(retained);
  });
});
