import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import { appVersions, organizations } from "../drizzle/schema";
const m = vi.hoisted(() => ({
  scope: { orgId: 7, platformSupport: false }, school: [] as any[],
  status: { orgId: 7, access: { tier: "web", isActive: true, isPaid: true, hasManualGrant: false, isInTrial: false, trialEndsAt: null }, platformSupport: false, schoolIncluded: false, reason: null },
  require: vi.fn(), billing: [] as any[], versions: [] as any[], create: vi.fn(), retrieve: vi.fn(), portal: vi.fn(), queries: [] as any[],
}));
vi.mock("./lib/course360AppCapabilities", async original => {
  const real: any = await original();
  return { ...real, requireCourse360AppOrganization: async () => m.scope, requireCourse360AppCapability: (...args: any[]) => m.require(...args), getCourse360AppCapabilityStatus: async () => m.status, getCourse360AppBillingRecords: async () => m.billing };
});
vi.mock("./lib/course360PaymentLedger", () => ({ createCourse360PaymentCheckout: (...args: any[]) => m.create(...args), getCourse360PaymentAppAccess: vi.fn(), course360PaymentLedgerReady: () => true, course360PaymentAppTrialEligible: async () => true, setCourse360PaymentManualRole: vi.fn(), claimCourse360PaymentSchoolOwner: vi.fn(), listCourse360PaymentOwnerClaims: vi.fn() }));
vi.mock("./stripePlans", () => ({ getStripe: () => ({ subscriptions: { retrieve: m.retrieve }, billingPortal: { sessions: { create: m.portal } } }), getPlatformStripeSecretKey: () => "", getPlatformStripePublishableKey: () => "", getPlatformPaymentReadiness: () => ({ ready: false }), STRIPE_PRICE_IDS: Object.fromEntries(["studio", "creator", "quiz_creator"].flatMap(app => ["web", "desktop", "bundle"].flatMap(tier => ["monthly", "annual"].map(interval => [`${app}_${tier}_${interval}`, `price_${app}_${tier}_${interval}`])))), PLAN_LIMITS: {} }));
vi.mock("./lmsDb", () => ({ getOrgSubscription: vi.fn(), upsertOrgSubscription: vi.fn() }));
vi.mock("./db", () => ({ getDb: async () => ({ select: () => { let table: any; const chain: any = { from(t: any) { table = t; return chain; }, where(condition: any) { m.queries.push({ table: getTableName(table), condition }); return chain; }, limit: async () => table === appVersions ? m.versions : table === organizations ? m.school : [] }; return chain; } }), getOrgMember: vi.fn(), getUserById: vi.fn() }));
import { stripeRouter } from "./stripeRouter";
const caller = () => stripeRouter.createCaller({ user: { id: 10, role: "user", email: "user@example.test", name: "User" }, req: {}, res: {} } as any);
beforeEach(() => { vi.clearAllMocks(); m.versions = []; m.school = [{ id: 7, isActive: true, slug: "selected", customDomain: "selected.example.test", domainVerificationStatus: "verified" }]; m.queries = []; m.require.mockResolvedValue({ orgId: 7, isPaid: true, hasManualGrant: false, access: m.status.access }); m.create.mockResolvedValue({ url: "https://checkout.example.test/session" }); m.portal.mockResolvedValue({ url: "https://billing.example.test/portal" }); m.billing = [{ orgId: 7, userId: 10, product: "studio", accountId: "acct_fixture", livemode: false, subscriptionId: "sub_app", customerId: "cus_app", tier: "desktop", rawStatus: "unpaid", cancelAtPeriodEnd: false }]; m.retrieve.mockResolvedValue({ id: "sub_app", customer: "cus_app", livemode: false, metadata: { product_type: "studio", org_id: "7", user_id: "10" } }); });

describe("actual app checkout selection contract", () => {
  it.each(["studio", "creator", "quiz_creator"] as const)("preserves every %s SKU and interval in existing durable checkout contract", async app => {
    for (const accessTier of ["web", "desktop", "bundle"] as const) for (const interval of ["monthly", "annual"] as const) {
      const input = { accessTier, interval, origin: "https://course360.app" };
      const result = app === "studio" ? await caller().createStudioSingleCheckout(input) : app === "creator" ? await caller().createCreatorSingleCheckout(input) : await caller().createQuizCreatorCheckout(input);
      expect(result.checkoutUrl).toBe("https://checkout.example.test/session");
      const [checkout] = m.create.mock.calls.at(-1)!;
      expect(checkout).toMatchObject({ orgId: 7, userId: 10, product: app, selection: accessTier, interval, trialEligible: true });
      expect(checkout.params.line_items).toEqual([{ price: `price_${app}_${accessTier}_${interval}`, quantity: 1 }]);
      expect(checkout.params.payment_method_types).toEqual(["card"]);
      expect(checkout.params.metadata).toMatchObject({ org_id: "7", user_id: "10", access_tier: accessTier, interval, product_type: app });
      expect(checkout.params.subscription_data.metadata).toMatchObject({ org_id: "7", user_id: "10", access_tier: accessTier, interval, product_type: app });
      expect(checkout.params.subscription_data.trial_period_days).toBe(14);
    }
  });
  it("accepts only exact selected-school subdomain or verified custom domain", async () => {
    for (const origin of ["https://selected.course360.app", "https://selected.example.test"]) {
      await caller().createStudioSingleCheckout({ accessTier: "bundle", interval: "annual", origin });
      expect(m.create.mock.calls.at(-1)?.[0].params.success_url).toBe(`${origin}/studio?upgraded=1`);
    }
    for (const origin of ["https://other.course360.app", "https://other.example.test", "http://selected.example.test", "https://user:pass@selected.example.test"]) await expect(caller().createStudioSingleCheckout({ accessTier: "web", interval: "monthly", origin })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    m.school[0].domainVerificationStatus = "pending";
    await expect(caller().createStudioSingleCheckout({ accessTier: "web", interval: "monthly", origin: "https://selected.example.test" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("rejects an unknown SKU and unauthenticated checkout before provider reservation", async () => {
    await expect(caller().createStudioSingleCheckout({ accessTier: "fake", interval: "monthly", origin: "https://course360.app" } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(stripeRouter.createCaller({ user: null } as any).createStudioSingleCheckout({ accessTier: "web", interval: "monthly", origin: "https://course360.app" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(m.create).not.toHaveBeenCalled();
  });
});
describe("actual app portal and recovery", () => {
  it("keeps unpaid/expired app recovery reachable and never uses school customer", async () => {
    const result = await caller().getAppBillingRecovery({ product: "studio" });
    expect(result.subscriptions).toEqual([expect.objectContaining({ subscriptionId: "sub_app", status: "unpaid" })]);
    await caller().createAppPortalSession({ product: "studio", subscriptionId: "sub_app", returnUrl: "https://course360.app" });
    expect(m.retrieve).toHaveBeenCalledWith("sub_app");
    expect(m.portal).toHaveBeenCalledWith(expect.objectContaining({ customer: "cus_app" }));
    expect(m.require).not.toHaveBeenCalled();
  });
  it("requires explicit selection when multiple app subscriptions exist", async () => {
    m.billing.push({ ...m.billing[0], subscriptionId: "sub_second", customerId: "cus_second" });
    await expect(caller().createAppPortalSession({ product: "studio", returnUrl: "https://course360.app" })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(m.portal).not.toHaveBeenCalled();
  });
  it.each(["customer", "livemode", "org", "user", "product"])("rejects live %s mismatch before portal", async kind => {
    const live: any = { id: "sub_app", customer: "cus_app", livemode: false, metadata: { product_type: "studio", org_id: "7", user_id: "10" } };
    if (kind === "customer") live.customer = "cus_school";
    if (kind === "livemode") live.livemode = true;
    if (kind === "org") live.metadata.org_id = "8";
    if (kind === "user") live.metadata.user_id = "11";
    if (kind === "product") live.metadata.product_type = "creator";
    m.retrieve.mockResolvedValue(live);
    await expect(caller().createAppPortalSession({ product: "studio", subscriptionId: "sub_app", returnUrl: "https://course360.app" })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(m.portal).not.toHaveBeenCalled();
  });
});
describe("actual desktop metadata contract", () => {
  it("requires Desktop capability and does not fabricate v1 readiness when no release exists", async () => {
    const result = await caller().getDesktopDownloads({ app: "studio" });
    expect(m.require).toHaveBeenCalledWith(10, "studio", "desktop");
    expect(result).toMatchObject({ version: null, windows: null, mac: null, readiness: "not_configured", artifactVerified: false });
  });
  it("validates URLs and labels existing metadata rather than signing/installation verified", async () => {
    m.versions = [{ version: "2.4.1", windowsUrl: "https://example.test/app.zip", macUrl: "javascript:alert(1)", releaseNotes: "Existing notes" }];
    expect(await caller().getDesktopDownloads({ app: "quizCreator" })).toMatchObject({ version: "2.4.1", windows: "https://example.test/app.zip", mac: null, readiness: "metadata_available", artifactVerified: false });
    expect(m.require).toHaveBeenCalledWith(10, "quiz_creator", "desktop");
  });
  it("denies before artifact query when desktop access is unavailable", async () => {
    m.require.mockRejectedValue(new Error("desktop denied"));
    await expect(caller().getDesktopDownloads({ app: "creator" })).rejects.toThrow("desktop denied");
    expect(m.queries).toEqual([]);
  });
});
