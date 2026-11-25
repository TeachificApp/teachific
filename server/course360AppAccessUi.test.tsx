// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { course360AppPurchasePrice, course360AppPurchasePath, course360AppPurchaseLoginPath, readCourse360AppPurchaseIntent } from "../shared/course360AppPurchaseIntent";
import { COURSE360_PRICES } from "../shared/course360Pricing";
import { course360DesktopDownloadUrl } from "../client/src/lib/course360DesktopReadiness";
const m = vi.hoisted(() => ({ user: { id: 10, role: "user", name: "Author" } as any, role: {} as any, studio: {} as any, subs: null as any, download: {} as any, checkout: vi.fn(), portal: vi.fn(), queryError: null as any, refetch: vi.fn() }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: m.user, loading: false }) }));
vi.mock("@/lib/trpc", () => {
  const query = (get: () => any) => ({ useQuery: () => ({ data: get(), isLoading: false, error: m.queryError, refetch: m.refetch }) });
  const checkout = { useMutation: () => ({ mutateAsync: m.checkout, isPending: false }) };
  return { trpc: { billing: { getStudioSubscription: query(() => m.studio), getAllSubscriptions: query(() => m.subs), getDesktopDownloads: query(() => m.download), getAppBillingRecovery: query(() => ({ subscriptions: [] })), createAppPortalSession: { useMutation: () => ({ mutate: m.portal, isPending: false }) }, createStudioSingleCheckout: checkout, createCreatorSingleCheckout: checkout, createQuizCreatorCheckout: checkout }, quizCreator: { getMyRole: query(() => m.role) }, auth: { logout: { useMutation: () => ({ mutate: vi.fn() }) } } } };
});
vi.mock("../client/src/pages/QuizCreatorPage", () => ({ default: () => <div>Actual gate accepted quiz editor</div> }));
vi.mock("../client/src/pages/RecordEditPage", () => ({ default: () => <div>Recorder child</div> }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
import QuizCreatorGate from "../client/src/pages/QuizCreatorGate";
import QuizCreatorDashboard from "../client/src/pages/QuizCreatorDashboard";
import StudioDashboard from "../client/src/pages/StudioDashboard";
import DesktopDownloadPage from "../client/src/pages/DesktopDownloadPage";
import { ProductSwitcher } from "../client/src/components/ProductSwitcher";
import { Course360AppSkuSelector } from "../client/src/components/Course360AppSkuSelector";
const active = (tier = "web") => ({ tier, role: tier, isActive: true, isPaid: true, isInTrial: false, hasManualGrant: false, trialEndsAt: null, platformSupport: false, orgId: 7 });
beforeEach(() => { vi.clearAllMocks(); window.history.replaceState({}, "", "/"); m.user = { id: 10, role: "user", name: "Author" }; m.role = active(); m.studio = active(); m.subs = { lms: { isActive: false }, studio: { isActive: false, tier: "none" }, creator: { isActive: false, tier: "none" }, quizCreator: { isActive: false, tier: "none" } }; m.download = { hasAccess: true, version: null, windows: null, mac: null, readiness: "not_configured", artifactVerified: false }; m.queryError = null; m.checkout.mockResolvedValue({ checkoutUrl: null }); });
afterEach(cleanup);

describe("actual gate/dashboard decisions", () => {
  it.each(["web", "bundle"])("accepts server-active %s in both quiz gates", tier => { m.role = active(tier); const a = render(<QuizCreatorGate />); expect(screen.getByText("Actual gate accepted quiz editor")).toBeTruthy(); a.unmount(); render(<QuizCreatorDashboard />); expect(screen.getByText("Actual gate accepted quiz editor")).toBeTruthy(); });
  it("denies desktop-only and stale privileged/global org admin claims", () => {
    for (const userRole of ["site_owner", "site_admin", "org_super_admin", "org_admin"]) {
      m.user.role = userRole; m.role = { ...active("desktop"), isActive: false };
      const view = render(<QuizCreatorGate />);
      expect(screen.queryByText("Actual gate accepted quiz editor")).toBeNull(); view.unmount();
    }
    m.role = active("desktop"); render(<QuizCreatorDashboard />); expect(screen.queryByText("Actual gate accepted quiz editor")).toBeNull();
  });
  it("does not treat expired access as paid or expose editor after server denial", () => {
    m.role = { ...active(), isActive: false, isPaid: false, trialEndsAt: new Date(0) };
    render(<QuizCreatorDashboard />); expect(screen.queryByText("Actual gate accepted quiz editor")).toBeNull(); expect(screen.getByText("No Active Subscription")).toBeTruthy();
  });
  it("keeps scoped manual and platform-support access distinct from watermark paid status", () => {
    m.role = { ...active(), isPaid: false, hasManualGrant: true };
    const a = render(<QuizCreatorDashboard />); expect(screen.queryByText(/Your quiz exports include/)).toBeNull(); a.unmount();
    m.role = { ...active("bundle"), isPaid: false, platformSupport: true }; render(<QuizCreatorDashboard />); expect(screen.getByText("Actual gate accepted quiz editor")).toBeTruthy(); expect(screen.queryByText(/Your quiz exports include/)).toBeNull();
  });
  it("Studio trusts server-selected decision instead of session owner shortcut", () => {
    m.user.role = "site_owner"; m.studio = { ...active(), isActive: false, reason: "Select an active school" };
    render(<StudioDashboard />); expect(screen.getByText("Activate Your Studio")).toBeTruthy(); expect(screen.getByText("Select an active school")).toBeTruthy(); expect(screen.queryByText("Studio Dashboard")).toBeNull();
  });
  it("Studio scoped manual grant suppresses incorrect paid watermark banner", () => {
    m.studio = { ...active(), isPaid: false, hasManualGrant: true }; render(<StudioDashboard />);
    expect(screen.queryByText(/Your exports include/)).toBeNull(); expect(screen.getByText("Studio Dashboard")).toBeTruthy();
  });
  it("shows service failure and retry, not false upgrade denial", () => {
    m.queryError = new Error("Ledger service unavailable"); render(<QuizCreatorGate />); expect(screen.getByText("Ledger service unavailable")).toBeTruthy(); expect(screen.queryByText("Actual gate accepted quiz editor")).toBeNull(); fireEvent.click(screen.getByText("Retry access check")); expect(m.refetch).toHaveBeenCalled();
  });
});

describe("actual product switcher", () => {
  it("Creator alone never implies Studio and Creator now has its own navigation", () => {
    m.subs.creator = active(); render(<ProductSwitcher current="lms" />);
    expect(screen.getByText("Creator").closest("a")?.getAttribute("href")).toBe("/creator"); expect(screen.queryByText("Studio")).toBeNull();
  });
  it("does not route desktop-only sources into browser products", () => {
    m.subs.creator = active("desktop"); m.subs.studio = active("desktop"); m.subs.quizCreator = active("desktop");
    const { container } = render(<ProductSwitcher current="lms" />); expect(container.querySelectorAll("a")).toHaveLength(0);
  });
});

describe("actual desktop handler readiness", () => {
  it("no release row means no fake version, no ready assertion and disabled empty URLs", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<DesktopDownloadPage app="studio" />);
    expect(screen.queryByText(/v1\.0\.0/)).toBeNull(); expect(screen.getByText("Desktop release unavailable")).toBeTruthy();
    const button = screen.getByText("Download for Windows").closest("button")!;
    expect(button.disabled).toBe(true); fireEvent.click(button); expect(open).not.toHaveBeenCalled(); open.mockRestore();
  });
  it("opens only valid present metadata URL with opener protection", () => {
    m.download = { ...m.download, version: "2.4.1", windows: "https://example.test/app.zip", readiness: "metadata_available" };
    const open = vi.spyOn(window, "open").mockImplementation(() => null); render(<DesktopDownloadPage app="creator" />);
    fireEvent.click(screen.getByText("Download for Windows")); expect(open).toHaveBeenCalledWith("https://example.test/app.zip", "_blank", "noopener,noreferrer");
    expect(screen.getByText(/Release metadata is not signing/)).toBeTruthy(); open.mockRestore();
  });
  it("recovery uses app billing path, not school customer portal", () => {
    m.queryError = { message: "Desktop access required", data: { code: "FORBIDDEN" } }; m.download = null;
    render(<DesktopDownloadPage app="quizCreator" />);
    expect(screen.getByText("Upgrade Plan").closest("a")?.getAttribute("href")).toBe("/quiz-creator-app/billing");
    expect(screen.getByText("Buy Standalone App").closest("a")?.getAttribute("href")).toBe("/quiz-creator-pro");
  });
});

describe("actual purchase intent and selector", () => {
  it.each(["studio", "creator", "quiz_creator"] as const)("uses unchanged approved %s prices and exact SKU login roundtrip", app => {
    for (const tier of ["web", "desktop", "bundle"] as const) for (const interval of ["monthly", "annual"] as const) {
      const intent = { app, tier, interval };
      expect(course360AppPurchasePrice(intent)).toBe(COURSE360_PRICES[`${app}_${tier}`][interval]);
      const path = course360AppPurchasePath(intent); const login = new URL(course360AppPurchaseLoginPath(intent), "https://course360.app");
      expect(login.searchParams.get("returnPath")).toBe(path); expect(readCourse360AppPurchaseIntent(app, new URL(path, "https://course360.app").search)).toEqual(intent);
    }
  });
  it("rejects malformed/cross-app purchase hints rather than restoring invented SKU", () => {
    expect(readCourse360AppPurchaseIntent("studio", "?purchaseApp=creator&accessTier=bundle&interval=annual")).toBeNull(); expect(readCourse360AppPurchaseIntent("studio", "?purchaseApp=studio&accessTier=unlimited&interval=weekly")).toBeNull();
  });
  it("real selector restores Bundle/annual and submits them explicitly only on review click", async () => {
    window.history.replaceState({}, "", course360AppPurchasePath({ app: "quiz_creator", tier: "bundle", interval: "annual" }));
    render(<Course360AppSkuSelector app="quiz_creator" />);
    expect((screen.getByLabelText("App access") as HTMLSelectElement).value).toBe("bundle"); expect((screen.getByLabelText("Billing interval") as HTMLSelectElement).value).toBe("annual");
    expect(m.checkout).not.toHaveBeenCalled(); fireEvent.click(screen.getByText("Continue with selected app access"));
    await waitFor(() => expect(m.checkout).toHaveBeenCalledWith({ accessTier: "bundle", interval: "annual", origin: window.location.origin }));
  });
  it.each([null, "", "javascript:alert(1)", "http://example.test/app.zip"])("client readiness rejects %s", value => expect(course360DesktopDownloadUrl(value)).toBeNull());
});
