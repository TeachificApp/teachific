// @vitest-environment jsdom
import React from "react";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const boundary = vi.hoisted(() => ({
  auth: { user: null, loading: false, isAuthenticated: false, error: null } as any,
  cachedClaims: [] as any[],
  queryLoading: false,
  queryError: null as any,
  mutationPending: false,
  useQuery: vi.fn(), useMutation: vi.fn(), useUtils: vi.fn(),
  refetch: vi.fn(), cancel: vi.fn(), mutate: vi.fn(),
  invalidateClaims: vi.fn(), invalidateOrgs: vi.fn(), invalidateAdminOrgs: vi.fn(),
  setActiveOrg: vi.fn(), setAuth: vi.fn(),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => boundary.auth }));
vi.mock("@/lib/trpc", () => ({ trpc: {
  billing: {
    listPaidSchoolClaims: { useQuery: (...args: any[]) => {
      React.useState(null); // Exercise hook order across guest/auth transitions.
      boundary.useQuery(...args);
      return { data: boundary.cachedClaims, isLoading: boundary.queryLoading, error: boundary.queryError, refetch: boundary.refetch };
    } },
    claimPaidSchool: { useMutation: (...args: any[]) => {
      React.useState(null);
      boundary.useMutation(...args);
      return { mutateAsync: boundary.mutate, isPending: boundary.mutationPending };
    } },
  },
  useUtils: () => {
    boundary.useUtils();
    return {
      billing: { listPaidSchoolClaims: { cancel: boundary.cancel, invalidate: boundary.invalidateClaims } },
      orgs: { myOrgs: { invalidate: boundary.invalidateOrgs }, myAdminOrgs: { invalidate: boundary.invalidateAdminOrgs }, setActiveOrg: { mutate: boundary.setActiveOrg } },
      auth: { me: { setData: boundary.setAuth } },
    };
  },
} }));
import Course360PaidSchoolClaims from "../client/src/components/Course360PaidSchoolClaims";
import AccountSetupPage from "../client/src/pages/auth/AccountSetupPage";

const first = { claimId: "d38cf9c5-6dfe-4624-9b08-2b475d532802", orgId: 41, createdAt: new Date("2026-11-20T12:00:00Z") };
const second = { claimId: "37e134c2-cb34-4ce6-9239-bb5e7461d9c8", orgId: 92, createdAt: new Date("2026-11-21T12:00:00Z") };
const successCopy = "Access claimed. Use your dashboard school switcher to select it.";
const authenticated = (id = 7, verified = true) => {
  boundary.auth = { user: { id, email: `owner${id}@example.test`, emailVerified: verified, role: "user" }, loading: false, isAuthenticated: true, error: null };
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const schoolRow = (id: number) => screen.getByRole("heading", { name: `Paid school #${id}` }).closest("li")!;
const consentFor = (id: number) => within(schoolRow(id)).getByRole("checkbox") as HTMLInputElement;
const claimButton = (id: number) => within(schoolRow(id)).getByRole("button") as HTMLButtonElement;
const showList = async (claims = [first, second]) => {
  authenticated();
  boundary.refetch.mockResolvedValue({ data: claims, error: null });
  const result = render(<Course360PaidSchoolClaims />);
  await screen.findByRole("heading", { name: `Paid school #${claims[0].orgId}` });
  return result;
};
const noIdentitySideEffects = () => {
  expect(boundary.setActiveOrg).not.toHaveBeenCalled();
  expect(boundary.setAuth).not.toHaveBeenCalled();
  expect(localStorage.getItem("activeOrgId")).toBe("23");
  expect(localStorage.getItem("teachific_auth_cache")).toBe("existing-auth-marker");
  expect(sessionStorage.getItem("existing-session-marker")).toBe("unchanged");
  expect(document.cookie).toContain("claims_fixture=unchanged");
  expect(fetch).not.toHaveBeenCalled();
};

beforeEach(() => {
  vi.resetAllMocks();
  boundary.auth = { user: null, loading: false, isAuthenticated: false, error: null };
  boundary.cachedClaims = [];
  boundary.queryLoading = false;
  boundary.queryError = null;
  boundary.mutationPending = false;
  boundary.cancel.mockResolvedValue(undefined);
  for (const fn of [boundary.invalidateClaims, boundary.invalidateOrgs, boundary.invalidateAdminOrgs]) fn.mockResolvedValue(undefined);
  boundary.refetch.mockResolvedValue({ data: [], error: null });
  boundary.mutate.mockResolvedValue({ orgId: first.orgId });
  window.history.replaceState({}, "", "/account-setup");
  localStorage.clear(); sessionStorage.clear();
  localStorage.setItem("activeOrgId", "23");
  localStorage.setItem("teachific_auth_cache", "existing-auth-marker");
  sessionStorage.setItem("existing-session-marker", "unchanged");
  document.cookie = "claims_fixture=unchanged; path=/";
  const deny = vi.fn(() => { throw new Error("Network forbidden in paid school claims UI tests"); });
  vi.stubGlobal("fetch", deny);
  vi.stubGlobal("XMLHttpRequest", deny);
  vi.stubGlobal("WebSocket", deny);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("real rendered paid school claims: identity and loading boundaries", () => {
  it("calls hooks unconditionally but never requests protected claims for a guest, even with a cached list", () => {
    boundary.cachedClaims = [first];
    render(<Course360PaidSchoolClaims />);
    expect(boundary.useQuery).toHaveBeenCalledWith(undefined, expect.objectContaining({ enabled: false, retry: false }));
    expect(boundary.useMutation).toHaveBeenCalled();
    expect(boundary.useUtils).toHaveBeenCalled();
    expect(boundary.refetch).not.toHaveBeenCalled();
    expect(boundary.mutate).not.toHaveBeenCalled();
    expect(screen.queryByText("Paid school #41")).toBeNull();
    expect(screen.getByText(/Sign in normally to check for pending school claims/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sign in and return to school claims" }).getAttribute("href")).toBe("/login?returnTo=/account-setup");
    noIdentitySideEffects();
  });

  it.each(["loading", "not-authenticated", "auth-error"])("does not enable claims for %s auth state", kind => {
    authenticated();
    if (kind === "loading") boundary.auth.loading = true;
    if (kind === "not-authenticated") boundary.auth.isAuthenticated = false;
    if (kind === "auth-error") boundary.auth.error = new Error("Session unavailable");
    render(<Course360PaidSchoolClaims />);
    expect(boundary.useQuery).toHaveBeenLastCalledWith(undefined, expect.objectContaining({ enabled: false }));
    expect(boundary.refetch).not.toHaveBeenCalled();
    if (kind === "loading") expect(screen.getByRole("status").textContent).toBe("Checking your sign-in status…");
    expect(boundary.mutate).not.toHaveBeenCalled();
  });

  it("keeps global no-input cached claims hidden until a fresh authenticated refetch completes", async () => {
    authenticated();
    boundary.cachedClaims = [first];
    const request = deferred<any>();
    boundary.refetch.mockReturnValue(request.promise);
    render(<Course360PaidSchoolClaims />);
    await waitFor(() => expect(boundary.refetch).toHaveBeenCalledTimes(1));
    expect(boundary.useQuery).toHaveBeenLastCalledWith(undefined, expect.objectContaining({ enabled: true, gcTime: 0, refetchOnWindowFocus: false }));
    expect(boundary.cancel).toHaveBeenCalled();
    expect(screen.getByText("Loading pending school claims…")).toBeTruthy();
    expect(screen.queryByText("Paid school #41")).toBeNull();
    await act(async () => request.resolve({ data: [second], error: null }));
    expect(screen.getByText("Paid school #92")).toBeTruthy();
    expect(screen.queryByText("Paid school #41")).toBeNull();
    expect(boundary.mutate).not.toHaveBeenCalled();
  });

  it.each(["result-error", "rejection"])("renders readable list %s and performs an explicit retry", async kind => {
    authenticated();
    if (kind === "result-error") boundary.refetch.mockResolvedValueOnce({ data: [first], error: new Error("Forbidden") });
    else boundary.refetch.mockRejectedValueOnce(new Error("Unavailable"));
    render(<Course360PaidSchoolClaims />);
    expect((await screen.findByRole("alert")).textContent).toContain("We couldn't load pending school claims.");
    expect(screen.getByRole("alert").textContent).toContain("Sign in normally with the account used at checkout and verify your email, then retry.");
    expect(screen.queryByText("Paid school #41")).toBeNull();
    boundary.refetch.mockResolvedValueOnce({ data: [first], error: null });
    fireEvent.click(screen.getByRole("button", { name: "Retry loading claims" }));
    await screen.findByText("Paid school #41");
    expect(boundary.refetch).toHaveBeenCalledTimes(2);
    expect(boundary.mutate).not.toHaveBeenCalled();
  });

  it("accurately distinguishes an empty pending list from payment or school entitlement confirmation", async () => {
    authenticated();
    render(<Course360PaidSchoolClaims />);
    expect(await screen.findByText(/No pending paid-school claims are listed for this account/)).toBeTruthy();
    expect(screen.getByText(/Verified checkout may still be processing; this does not confirm payment or existing school access/)).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(boundary.mutate).not.toHaveBeenCalled();
  });

  it("uses only server org IDs and creation dates, without invented names or prices, and instructs unverified users", async () => {
    authenticated(7, false);
    boundary.refetch.mockResolvedValue({ data: [first, second], error: null });
    const { container } = render(<Course360PaidSchoolClaims />);
    await screen.findByText("Paid school #41");
    expect(screen.getByText(/Verify your email before claiming access/)).toBeTruthy();
    const dates = container.querySelectorAll("time");
    expect(Array.from(dates).map(date => date.getAttribute("dateTime"))).toEqual([first.createdAt.toISOString(), second.createdAt.toISOString()]);
    expect(dates[0].textContent).toBe(first.createdAt.toLocaleDateString());
    expect(container.textContent).not.toMatch(/\$|Starter|Builder|Pro school/);
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    expect(boundary.mutate).not.toHaveBeenCalled();
  });
});

describe("real rendered paid school claims: explicit consent, errors and refresh", () => {
  it("requires per-claim acknowledgement and sends exactly the selected server-listed UUID", async () => {
    await showList();
    const request = deferred<any>();
    boundary.mutate.mockReturnValue(request.promise);
    expect(claimButton(first.orgId).disabled).toBe(true);
    expect(claimButton(second.orgId).disabled).toBe(true);
    fireEvent.click(claimButton(first.orgId));
    expect(boundary.mutate).not.toHaveBeenCalled();
    fireEvent.click(consentFor(second.orgId));
    expect(claimButton(first.orgId).disabled).toBe(true);
    expect(claimButton(second.orgId).disabled).toBe(false);
    fireEvent.click(claimButton(second.orgId));
    expect(boundary.mutate).toHaveBeenCalledTimes(1);
    expect(boundary.mutate).toHaveBeenCalledWith({ claimId: second.claimId });
    expect(Object.keys(boundary.mutate.mock.calls[0][0])).toEqual(["claimId"]);
    noIdentitySideEffects();
    await act(async () => request.reject(new Error("Isolated rejection")));
  });

  it("revokes consent when unchecked without mutating", async () => {
    await showList([first]);
    fireEvent.click(consentFor(first.orgId));
    expect(claimButton(first.orgId).disabled).toBe(false);
    fireEvent.click(consentFor(first.orgId));
    expect(claimButton(first.orgId).disabled).toBe(true);
    fireEvent.click(claimButton(first.orgId));
    expect(boundary.mutate).not.toHaveBeenCalled();
  });

  it("locks rapid duplicate and other-school clicks while a claim is pending", async () => {
    await showList();
    const request = deferred<any>();
    boundary.mutate.mockReturnValue(request.promise);
    fireEvent.click(consentFor(first.orgId));
    fireEvent.click(consentFor(second.orgId));
    const button = claimButton(first.orgId);
    act(() => { button.click(); button.click(); });
    expect(boundary.mutate).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Claiming access…" }).hasAttribute("disabled")).toBe(true);
    expect(claimButton(second.orgId).disabled).toBe(true);
    expect(consentFor(second.orgId).disabled).toBe(true);
    fireEvent.click(claimButton(second.orgId));
    expect(boundary.mutate).toHaveBeenCalledTimes(1);
    await act(async () => request.reject(new Error("Server unavailable")));
  });

  it("respects the real mutation hook pending state as well as the local lock", async () => {
    await showList([first]);
    boundary.mutationPending = true;
    // A fresh render under the same authoritative hook state.
    cleanup();
    render(<Course360PaidSchoolClaims />);
    await screen.findByText("Paid school #41");
    expect(consentFor(first.orgId).disabled).toBe(true);
    expect(claimButton(first.orgId).disabled).toBe(true);
    expect(boundary.mutate).not.toHaveBeenCalled();
  });

  it("shows server failures without leaking raw details and requires renewed consent before retry", async () => {
    await showList([first]);
    boundary.mutate.mockRejectedValueOnce(new Error("Normal authenticated, verified account ownership required; private@example.test"));
    fireEvent.click(consentFor(first.orgId));
    fireEvent.click(claimButton(first.orgId));
    expect((await screen.findByRole("alert")).textContent).toContain("Unable to claim access.");
    expect(screen.getByRole("alert").textContent).toContain("verify your email, then retry.");
    expect(screen.getByRole("alert").textContent).not.toContain("private@example.test");
    expect(consentFor(first.orgId).checked).toBe(false);
    expect(claimButton(first.orgId).disabled).toBe(true);
    expect(boundary.invalidateClaims).not.toHaveBeenCalled();
    const retry = deferred<any>();
    boundary.mutate.mockReturnValueOnce(retry.promise);
    fireEvent.click(consentFor(first.orgId));
    fireEvent.click(claimButton(first.orgId));
    expect(boundary.mutate).toHaveBeenCalledTimes(2);
    expect(boundary.mutate).toHaveBeenLastCalledWith({ claimId: first.claimId });
    await act(async () => retry.reject(new Error("Retry unavailable")));
    noIdentitySideEffects();
  });

  it("lets a no-longer-pending failure recover through explicit list refresh, not automatic grant", async () => {
    await showList([first]);
    boundary.mutate.mockRejectedValueOnce(new Error("Paid-school ownership claim is no longer pending"));
    fireEvent.click(consentFor(first.orgId));
    fireEvent.click(claimButton(first.orgId));
    await screen.findByRole("alert");
    boundary.refetch.mockResolvedValueOnce({ data: [], error: null });
    fireEvent.click(screen.getByRole("button", { name: "Refresh claim list" }));
    await screen.findByText(/No pending paid-school claims are listed/);
    expect(screen.queryByText(successCopy)).toBeNull();
    expect(boundary.mutate).toHaveBeenCalledTimes(1);
    noIdentitySideEffects();
  });

  it("refreshes claims and only known membership list caches on success, without switching or navigating", async () => {
    await showList([first]);
    boundary.refetch.mockResolvedValueOnce({ data: [], error: null });
    const url = window.location.href;
    const cookie = document.cookie;
    fireEvent.click(consentFor(first.orgId));
    fireEvent.click(claimButton(first.orgId));
    await screen.findByText(successCopy);
    await screen.findByText(/No pending paid-school claims are listed/);
    for (const fn of [boundary.invalidateClaims, boundary.invalidateOrgs, boundary.invalidateAdminOrgs]) {
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith(undefined, { refetchType: "none" });
    }
    expect(boundary.refetch).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("link", { name: "Go to your dashboard" }).getAttribute("href")).toBe("/lms");
    expect(window.location.href).toBe(url);
    expect(document.cookie).toBe(cookie);
    noIdentitySideEffects();
  });

  it("keeps truthful confirmed claim success when subsequent claim-list refresh fails", async () => {
    await showList([first]);
    boundary.refetch.mockResolvedValueOnce({ data: undefined, error: new Error("List unavailable") });
    fireEvent.click(consentFor(first.orgId));
    fireEvent.click(claimButton(first.orgId));
    await screen.findByText(successCopy);
    expect((await screen.findByRole("alert")).textContent).toContain("We couldn't load pending school claims.");
    expect(screen.getByRole("button", { name: "Retry loading claims" })).toBeTruthy();
    noIdentitySideEffects();
  });

  it("does not falsely reject a successful server claim when a membership-cache invalidation fails", async () => {
    await showList([first]);
    boundary.invalidateOrgs.mockRejectedValueOnce(new Error("Cache refresh unavailable"));
    boundary.refetch.mockResolvedValueOnce({ data: [], error: null });
    fireEvent.click(consentFor(first.orgId));
    fireEvent.click(claimButton(first.orgId));
    await screen.findByText(successCopy);
    await screen.findByText(/No pending paid-school claims/);
    expect(screen.queryByText(/Unable to claim access/)).toBeNull();
  });

  it("unlocks a remaining separate school after successful refresh and requires its own new consent", async () => {
    await showList();
    fireEvent.click(consentFor(first.orgId));
    fireEvent.click(consentFor(second.orgId));
    boundary.refetch.mockResolvedValueOnce({ data: [second], error: null });
    fireEvent.click(claimButton(first.orgId));
    await screen.findByText(successCopy);
    await waitFor(() => expect(consentFor(second.orgId).disabled).toBe(false));
    expect(screen.queryByText("Paid school #41")).toBeNull();
    expect(consentFor(second.orgId).checked).toBe(false);
    expect(claimButton(second.orgId).disabled).toBe(true);
    const next = deferred<any>();
    boundary.mutate.mockReturnValueOnce(next.promise);
    fireEvent.click(consentFor(second.orgId));
    fireEvent.click(claimButton(second.orgId));
    expect(boundary.mutate).toHaveBeenCalledTimes(2);
    expect(boundary.mutate).toHaveBeenLastCalledWith({ claimId: second.claimId });
    await act(async () => next.reject(new Error("Isolated second school")));
    noIdentitySideEffects();
  });
});

describe("real rendered paid school claims: stale identity and stale claim safety", () => {
  it("hides the previous user's list immediately and only accepts a fresh new-identity response", async () => {
    const result = await showList([first]);
    fireEvent.click(consentFor(first.orgId));
    const request = deferred<any>();
    boundary.cachedClaims = [first];
    boundary.refetch.mockReturnValueOnce(request.promise);
    authenticated(8);
    result.rerender(<Course360PaidSchoolClaims />);
    expect(screen.queryByText("Paid school #41")).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    await waitFor(() => expect(boundary.refetch).toHaveBeenCalledTimes(2));
    await act(async () => request.resolve({ data: [second], error: null }));
    expect(screen.getByText("Paid school #92")).toBeTruthy();
    expect(consentFor(second.orgId).checked).toBe(false);
    expect(boundary.mutate).not.toHaveBeenCalled();
  });

  it.each(["success", "error"])("ignores an old-identity mutation %s and never invalidates new-user caches", async kind => {
    const result = await showList([first]);
    const request = deferred<any>();
    boundary.mutate.mockReturnValueOnce(request.promise);
    fireEvent.click(consentFor(first.orgId));
    fireEvent.click(claimButton(first.orgId));
    authenticated(8);
    boundary.refetch.mockResolvedValueOnce({ data: [second], error: null });
    result.rerender(<Course360PaidSchoolClaims />);
    await screen.findByText("Paid school #92");
    if (kind === "success") await act(async () => request.resolve({ orgId: first.orgId }));
    else await act(async () => request.reject(new Error("Old user denied")));
    expect(consentFor(second.orgId).disabled).toBe(false);
    fireEvent.click(consentFor(second.orgId));
    expect(claimButton(second.orgId).disabled).toBe(false);
    expect(screen.queryByText(successCopy)).toBeNull();
    expect(screen.queryByText(/Unable to claim access/)).toBeNull();
    for (const fn of [boundary.invalidateClaims, boundary.invalidateOrgs, boundary.invalidateAdminOrgs]) expect(fn).not.toHaveBeenCalled();
    expect(boundary.refetch).toHaveBeenCalledTimes(2);
    noIdentitySideEffects();
  });

  it("ignores a late old-user list response, including after the same user signs out and back in", async () => {
    authenticated();
    const oldRequest = deferred<any>();
    boundary.refetch.mockReturnValueOnce(oldRequest.promise);
    const result = render(<Course360PaidSchoolClaims />);
    await waitFor(() => expect(boundary.refetch).toHaveBeenCalledTimes(1));
    boundary.auth = { user: null, loading: false, isAuthenticated: false, error: null };
    result.rerender(<Course360PaidSchoolClaims />);
    authenticated();
    boundary.refetch.mockResolvedValueOnce({ data: [second], error: null });
    result.rerender(<Course360PaidSchoolClaims />);
    await screen.findByText("Paid school #92");
    await act(async () => oldRequest.resolve({ data: [first], error: null }));
    expect(screen.queryByText("Paid school #41")).toBeNull();
    expect(screen.getByText("Paid school #92")).toBeTruthy();
    expect(boundary.refetch).toHaveBeenCalledTimes(2);
  });

  it("does not accept a mutation result across sign-out and same-user sign-in", async () => {
    const result = await showList([first]);
    const request = deferred<any>();
    boundary.mutate.mockReturnValueOnce(request.promise);
    fireEvent.click(consentFor(first.orgId));
    fireEvent.click(claimButton(first.orgId));
    boundary.auth = { user: null, loading: false, isAuthenticated: false, error: null };
    result.rerender(<Course360PaidSchoolClaims />);
    expect(screen.queryByText("Paid school #41")).toBeNull();
    authenticated();
    boundary.refetch.mockResolvedValueOnce({ data: [second], error: null });
    result.rerender(<Course360PaidSchoolClaims />);
    await screen.findByText("Paid school #92");
    await act(async () => request.resolve({ orgId: first.orgId }));
    expect(screen.queryByText(successCopy)).toBeNull();
    expect(boundary.invalidateClaims).not.toHaveBeenCalled();
  });

  it("ignores a result after unmount without refetching or changing cache", async () => {
    const result = await showList([first]);
    const request = deferred<any>();
    boundary.mutate.mockReturnValueOnce(request.promise);
    fireEvent.click(consentFor(first.orgId));
    fireEvent.click(claimButton(first.orgId));
    result.unmount();
    await act(async () => request.resolve({ orgId: first.orgId }));
    expect(boundary.invalidateClaims).not.toHaveBeenCalled();
    expect(boundary.refetch).toHaveBeenCalledTimes(1);
    noIdentitySideEffects();
  });

  it("rejects a mismatched returned school instead of showing success or changing the active school", async () => {
    await showList([first]);
    boundary.mutate.mockResolvedValueOnce({ orgId: second.orgId });
    boundary.refetch.mockResolvedValueOnce({ data: [second], error: null });
    fireEvent.click(consentFor(first.orgId));
    fireEvent.click(claimButton(first.orgId));
    await screen.findByText(/The claim list changed or the response did not match this school/);
    await screen.findByText("Paid school #92");
    expect(screen.queryByText(successCopy)).toBeNull();
    expect(boundary.invalidateOrgs).not.toHaveBeenCalled();
    expect(consentFor(second.orgId).disabled).toBe(false);
    fireEvent.click(consentFor(second.orgId));
    expect(claimButton(second.orgId).disabled).toBe(false);
    noIdentitySideEffects();
  });

  it("does not show a stale-claim success after an explicit refresh removed that claim while pending", async () => {
    await showList([first]);
    const request = deferred<any>();
    boundary.mutate.mockReturnValueOnce(request.promise);
    fireEvent.click(consentFor(first.orgId));
    fireEvent.click(claimButton(first.orgId));
    boundary.refetch.mockResolvedValue({ data: [], error: null });
    fireEvent.click(screen.getByRole("button", { name: "Refresh claim list" }));
    await screen.findByText(/No pending paid-school claims/);
    await act(async () => request.resolve({ orgId: first.orgId }));
    await screen.findByText(/The claim list changed or the response did not match this school/);
    expect(screen.queryByText(successCopy)).toBeNull();
    expect(boundary.invalidateClaims).not.toHaveBeenCalled();
    expect(boundary.mutate).toHaveBeenCalledTimes(1);
    noIdentitySideEffects();
  });

  it("prevents a removed list row or its previously consented DOM button from submitting", async () => {
    await showList([first]);
    fireEvent.click(consentFor(first.orgId));
    const oldButton = claimButton(first.orgId);
    boundary.refetch.mockResolvedValueOnce({ data: [second], error: null });
    fireEvent.click(screen.getByRole("button", { name: "Refresh claim list" }));
    await screen.findByText("Paid school #92");
    fireEvent.click(oldButton);
    expect(boundary.mutate).not.toHaveBeenCalled();
    expect(claimButton(second.orgId).disabled).toBe(true);
  });

  it("ignores out-of-order manual list refresh results", async () => {
    await showList([first]);
    const oldRequest = deferred<any>();
    boundary.refetch.mockReturnValueOnce(oldRequest.promise);
    fireEvent.click(screen.getByRole("button", { name: "Refresh claim list" }));
    await waitFor(() => expect(boundary.refetch).toHaveBeenCalledTimes(2));
    // Identity changes force a later request; the old manual refresh cannot win.
    authenticated(8);
    boundary.refetch.mockResolvedValueOnce({ data: [second], error: null });
    cleanup();
    render(<Course360PaidSchoolClaims />);
    await screen.findByText("Paid school #92");
    await act(async () => oldRequest.resolve({ data: [first], error: null }));
    expect(screen.queryByText("Paid school #41")).toBeNull();
  });

  it("cancels StrictMode setup replay and displays only the newest fresh response", async () => {
    authenticated();
    boundary.cachedClaims = [first];
    boundary.refetch.mockResolvedValue({ data: [second], error: null });
    render(<React.StrictMode><Course360PaidSchoolClaims /></React.StrictMode>);
    await screen.findByText("Paid school #92");
    expect(screen.queryByText("Paid school #41")).toBeNull();
    expect(boundary.cancel).toHaveBeenCalled();
    expect(boundary.mutate).not.toHaveBeenCalled();
  });
});

describe("mounted account setup: preserved recovery page and no URL authorization", () => {
  it("mounts the real panel additively and retains every prior setup node and existing sign-in link", () => {
    const { container } = render(<AccountSetupPage />);
    expect(screen.getByRole("region", { name: "Claim separate paid schools" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Go to sign in" }).getAttribute("href")).toBe("/login");
    expect(screen.getByRole("link", { name: "Sign in and return to school claims" }).getAttribute("href")).toBe("/login?returnTo=/account-setup");
    for (const [label, href] of [["Open your dashboard", "/lms"], ["Recover your password", "/forgot-password"], ["Contact support", "/support"]]) {
      expect(screen.getByRole("link", { name: label }).getAttribute("href")).toBe(href);
    }
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Finish setting up your school");
    expect(container.textContent).toContain("Opening this page or changing its URL does not grant access.");
    const page = readFileSync(resolve(process.cwd(), "client/src/pages/auth/AccountSetupPage.tsx"), "utf8");
    const preserved = page.replace('import Course360PaidSchoolClaims from "@/components/Course360PaidSchoolClaims";\n', "").replace("          <Course360PaidSchoolClaims />\n\n", "");
    expect(createHash("sha256").update(preserved).digest("hex")).toBe("32d796ce80e3415997ddb08acf29b0faa9b33b405b994e65f8af345164548b83");
    noIdentitySideEffects();
  });

  it.each([
    "?success=true&paid=true&checkout=success&session_id=cs_forged",
    "?claimId=d38cf9c5-6dfe-4624-9b08-2b475d532802&orgId=41&email=owner7@example.test",
    "?token=forged&role=org_super_admin&autoSignedIn=true&entitled=true&subscription_status=active",
    "?returnTo=https%3A%2F%2Fevil.example.test&redirect=%2F%2Fevil.example.test&school=attacker",
  ])("does not use guest URL flags as authentication, payment proof or claim authorization: %s", query => {
    const baseline = render(<AccountSetupPage />);
    const markup = baseline.container.innerHTML;
    baseline.unmount();
    window.history.replaceState({}, "", `/account-setup${query}`);
    const url = window.location.href;
    const { container } = render(<AccountSetupPage />);
    expect(container.innerHTML).toBe(markup);
    expect(boundary.useQuery.mock.calls.every(([, options]) => options.enabled === false)).toBe(true);
    expect(boundary.refetch).not.toHaveBeenCalled();
    expect(boundary.mutate).not.toHaveBeenCalled();
    expect(window.location.href).toBe(url);
    noIdentitySideEffects();
  });

  it("lists only authenticated server claims under a forged URL and never automatically submits the URL claim", async () => {
    authenticated();
    window.history.replaceState({}, "", `/account-setup?success=true&paid=true&claimId=${first.claimId}&orgId=41&email=owner7@example.test&role=site_owner`);
    boundary.refetch.mockResolvedValueOnce({ data: [second], error: null });
    const url = window.location.href;
    render(<AccountSetupPage />);
    await screen.findByText("Paid school #92");
    expect(screen.queryByText("Paid school #41")).toBeNull();
    expect(boundary.useQuery).toHaveBeenLastCalledWith(undefined, expect.objectContaining({ enabled: true }));
    expect(boundary.mutate).not.toHaveBeenCalled();
    fireEvent.click(consentFor(second.orgId));
    boundary.mutate.mockRejectedValueOnce(new Error("Isolated boundary"));
    fireEvent.click(claimButton(second.orgId));
    await screen.findByRole("alert");
    expect(boundary.mutate).toHaveBeenCalledTimes(1);
    expect(boundary.mutate).toHaveBeenCalledWith({ claimId: second.claimId });
    expect(window.location.href).toBe(url);
    noIdentitySideEffects();
  });
});
