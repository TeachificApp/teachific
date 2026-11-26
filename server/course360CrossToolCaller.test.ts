import { beforeEach, describe, expect, it, vi } from "vitest";
import { COURSE360_CROSS_TOOL_OFFERS } from "../shared/course360CrossToolOffers";
import { course360StripeCents } from "../shared/course360Pricing";
import { crossToolMockDb } from "./course360CrossToolTestFixture";
import { orgMembers, orgSubscriptions } from "../drizzle/schema";
const m = vi.hoisted(() => ({
  db: null as any,
  bootstrap: "ready",
  paymentReady: true,
  secret: "sk_live_fixture",
  create: vi.fn(),
  prices: vi.fn(),
  products: vi.fn(),
  retrieve: vi.fn(),
  portal: vi.fn(),
}));
vi.mock("./db", () => ({
  getDb: async () => m.db,
  getUserById: async (id: number) =>
    m.db.rows().users.find((r: any) => r.id === id),
  getOrgMember: async (orgId: number, userId: number) =>
    m.db
      .rows()
      .org_members.find((r: any) => r.orgId === orgId && r.userId === userId),
}));
vi.mock("./lmsDb", () => ({
  getOrgSubscription: async (id: number) =>
    m.db.rows().org_subscriptions?.find((r: any) => r.orgId === id),
  upsertOrgSubscription: vi.fn(),
}));
vi.mock("./stripePlans", () => ({
  getStripe: () => ({
    prices: { retrieve: m.prices },
    products: { retrieve: m.products },
    subscriptions: { retrieve: m.retrieve },
    billingPortal: { sessions: { create: m.portal } },
  }),
  getPlatformPaymentReadiness: () => ({ ready: m.paymentReady }),
  getPlatformStripeSecretKey: () => m.secret,
  getPlatformStripePublishableKey: () => "pk_live_fixture",
  STRIPE_PRICE_IDS: {},
  PLAN_LIMITS: { builder: {}, pro: {} },
}));
vi.mock("./lib/course360PaymentBootstrap", () => ({
  getCourse360PaymentBootstrapStatus: () => ({ state: m.bootstrap }),
}));
vi.mock("./lib/course360PaymentLedger", async original => {
  const real: any = await original();
  return {
    ...real,
    createCourse360PaymentCheckout: (...args: any[]) => m.create(...args),
  };
});
vi.mock("./sendgrid", () => ({ sendEmail: vi.fn().mockResolvedValue({}) }));
import { configureCourse360AppCapabilityLedger } from "./lib/course360AppCapabilities";
import { stripeRouter } from "./stripeRouter";
import { COURSE360_CROSS_TOOL_FAMILY } from "./lib/course360CrossToolCatalog";
const guest = () =>
  stripeRouter.createCaller({ user: null, req: {}, res: {} } as any);
const user = () =>
  stripeRouter.createCaller({
    user: {
      id: 10,
      email: "owner@example.test",
      name: "Owner",
      role: "org_super_admin",
    },
    req: {},
    res: {},
  } as any);
const target = () => ({
  target: "existing_school" as const,
  offer: "builder_creator_web" as const,
  interval: "monthly" as const,
  origin: "https://course360.app",
});
let run = 0;
beforeEach(() => {
  vi.clearAllMocks();
  run++;
  m.db = crossToolMockDb();
  m.bootstrap = "ready";
  m.paymentReady = true;
  configureCourse360AppCapabilityLedger({
    getDb: async () => m.db,
    accountId: "acct_fixture",
    livemode: true,
  });
  for (const offer of Object.keys(COURSE360_CROSS_TOOL_OFFERS) as Array<
    keyof typeof COURSE360_CROSS_TOOL_OFFERS
  >)
    for (const interval of ["monthly", "annual"] as const)
      vi.stubEnv(
        `COURSE360_CROSS_TOOL_${offer.toUpperCase()}_${interval.toUpperCase()}_PRICE_ID`,
        `price_${offer}_${interval}_${run}`
      );
  m.prices.mockImplementation(async (id: string) => {
    const offer = id.includes("builder")
        ? "builder_creator_web"
        : "pro_creator_web",
      interval = id.includes("annual") ? "annual" : "monthly";
    return {
      id,
      livemode: true,
      active: true,
      type: "recurring",
      product: "prod_package",
      currency: "usd",
      unit_amount: course360StripeCents(
        COURSE360_CROSS_TOOL_OFFERS[offer][interval]
      ),
      billing_scheme: "per_unit",
      recurring: {
        interval: interval === "annual" ? "year" : "month",
        interval_count: 1,
        usage_type: "licensed",
      },
      metadata: {
        course360_family: COURSE360_CROSS_TOOL_FAMILY,
        cross_tool_offer: offer,
        school_plan: COURSE360_CROSS_TOOL_OFFERS[offer].schoolPlan,
        creator_mode: "web",
      },
    };
  });
  m.products.mockResolvedValue({ id: "prod_package", active: true });
  m.create.mockResolvedValue({ url: "https://checkout.stripe.test/mock" });
});
describe("mounted billing public package contract", () => {
  it("returns two exact dollar offers and verified readiness through actual mounted procedure", async () => {
    expect(await guest().getCrossToolOffers()).toEqual({
      offers: COURSE360_CROSS_TOOL_OFFERS,
      ready: true,
      catalogReady: true,
      provisioningReady: true,
      reason: null,
    });
    expect(m.prices).toHaveBeenCalledTimes(4);
  });
  it.each([
    "bootstrap",
    "credentials",
    "missing_catalog",
    "wrong_amount",
    "product_archived",
  ])("honestly gates %s before checkout", async kind => {
    if (kind === "bootstrap") m.bootstrap = "blocked";
    if (kind === "credentials") m.paymentReady = false;
    if (kind === "missing_catalog")
      vi.stubEnv("COURSE360_CROSS_TOOL_PRO_CREATOR_WEB_ANNUAL_PRICE_ID", "");
    if (kind === "wrong_amount")
      m.prices.mockResolvedValue({ id: "price_wrong", unit_amount: 249797 });
    if (kind === "product_archived")
      m.products.mockResolvedValue({ active: false });
    expect((await guest().getCrossToolOffers()).ready).toBe(false);
    await expect(
      guest().createCrossToolCheckout({
        target: "new_school",
        offer: "pro_creator_web",
        interval: "annual",
        name: "New",
        email: "new@example.test",
        origin: "https://course360.app",
      })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(m.create).not.toHaveBeenCalled();
  });
  it("guest new school remains checkout-first and uses EXACT Pro annual price without app spoofing", async () => {
    expect(
      await guest().createCrossToolCheckout({
        target: "new_school",
        offer: "pro_creator_web",
        interval: "annual",
        name: " New ",
        email: "OWNER@example.test",
        origin: "https://course360.app",
      })
    ).toEqual({ url: "https://checkout.stripe.test/mock" });
    const checkout = m.create.mock.calls[0][0];
    expect(checkout).toMatchObject({
      orgId: null,
      userId: null,
      product: "signup",
      selection: "pro",
      interval: "annual",
      email: "owner@example.test",
      trialEligible: true,
    });
    expect(checkout.params.metadata).toMatchObject({
      type: COURSE360_CROSS_TOOL_FAMILY,
      cross_tool_offer: "pro_creator_web",
      creator_mode: "web",
      signup_email: "owner@example.test",
    });
    expect(checkout.params.metadata.product_type).toBeUndefined();
    expect(checkout.params.line_items).toEqual([
      { price: `price_pro_creator_web_annual_${run}`, quantity: 1 },
    ]);
    expect(checkout.params.payment_method_collection).toBe("always");
    expect(m.db.rows().organizations).toHaveLength(2);
  });
  it("authenticated existing school takes authority from persisted selection and membership", async () => {
    await user().createCrossToolCheckout({ ...target(), orgId: 7 });
    const checkout = m.create.mock.calls[0][0];
    expect(checkout).toMatchObject({
      orgId: 7,
      userId: 10,
      product: "platform",
      selection: "builder",
    });
    expect(checkout.params.metadata.org_id).toBe("7");
  });
  it("rejects stale/foreign org hint without charging even same email", async () => {
    await expect(
      user().createCrossToolCheckout({ ...target(), orgId: 8 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(m.create).not.toHaveBeenCalled();
  });
  it("rejects guest existing-school attempt, learner membership, and forged platform-support role", async () => {
    await expect(
      guest().createCrossToolCheckout(target())
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    m.db.rows().org_members[0].role = "member";
    await expect(
      user().createCrossToolCheckout(target())
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    m.db.rows().users[0].role = "site_owner";
    m.db.seed(orgMembers, []);
    await expect(
      user().createCrossToolCheckout(target())
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(m.create).not.toHaveBeenCalled();
  });
  it.each(["new_org", "new_price", "new_entitlement", "existing_email"])(
    "strict input rejects browser %s authority",
    async kind => {
      const input: any =
        kind === "existing_email"
          ? { ...target(), email: "foreign@example.test" }
          : {
              target: "new_school",
              offer: "builder_creator_web",
              interval: "monthly",
              name: "Owner",
              email: "owner@example.test",
              origin: "https://course360.app",
            };
      if (kind === "new_org") input.orgId = 8;
      if (kind === "new_price") input.priceId = "price_cheaper";
      if (kind === "new_entitlement") input.creatorMode = "bundle";
      await expect(
        guest().createCrossToolCheckout(input)
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(m.create).not.toHaveBeenCalled();
    }
  );
  it("rejects existing school paid plan before catalog/provider and preserves it", async () => {
    m.db.seed(orgSubscriptions, [
      {
        id: 1,
        orgId: 7,
        plan: "builder",
        status: "active",
        stripeSubscriptionId: "sub_current",
      },
    ]);
    await expect(
      user().createCrossToolCheckout(target())
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(m.prices).not.toHaveBeenCalled();
    expect(m.create).not.toHaveBeenCalled();
    expect(m.db.rows().org_subscriptions[0].stripeSubscriptionId).toBe(
      "sub_current"
    );
  });
  it("local terminal subscription still checks current provider overlap before replacement", async () => {
    m.db.seed(orgSubscriptions, [
      {
        id: 1,
        orgId: 7,
        plan: "builder",
        status: "cancelled",
        rawStripeStatus: "canceled",
        stripeSubscriptionId: "sub_old",
      },
    ]);
    m.retrieve.mockResolvedValue({
      id: "sub_old",
      metadata: { org_id: "7" },
      status: "active",
    });
    await expect(
      user().createCrossToolCheckout(target())
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(m.create).not.toHaveBeenCalled();
  });
  it("new-school same-email intent never selects existing active school", async () => {
    await user().createCrossToolCheckout({
      target: "new_school",
      offer: "builder_creator_web",
      interval: "monthly",
      name: "Owner",
      email: "owner@example.test",
      origin: "https://course360.app",
    });
    expect(m.create.mock.calls[0][0]).toMatchObject({
      orgId: null,
      userId: null,
      product: "signup",
    });
    expect(m.db.rows().user_active_org[0].orgId).toBe(7);
  });
  it("foreign signup return origin is denied before catalog or checkout", async () => {
    await expect(
      guest().createCrossToolCheckout({
        target: "new_school",
        offer: "builder_creator_web",
        interval: "monthly",
        name: "Owner",
        email: "owner@example.test",
        origin: "https://foreign.course360.app",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(m.create).not.toHaveBeenCalled();
  });
});


// Additive, explicit configuration boundary for actual mounted package callers.
vi.mock("./lib/course360CrossToolOnboardingReadiness", () => ({
  isCourse360CrossToolOnboardingConfigured: () => onboarding.configured,
}));
const onboarding = vi.hoisted(() => ({ configured: true }));
beforeEach(() => { onboarding.configured = true; });
describe("package onboarding transport readiness", () => {
  it("fails closed before Stripe checkout when account-setup email is unconfigured", async () => {
    onboarding.configured = false;
    expect(await guest().getCrossToolOffers()).toMatchObject({ ready: false, catalogReady: false, reason: "Package account setup email is not configured." });
    await expect(guest().createCrossToolCheckout({ target: "new_school", offer: "pro_creator_web", interval: "annual", name: "New", email: "new@example.test", origin: "https://course360.app" })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(m.create).not.toHaveBeenCalled();
    expect(m.prices).not.toHaveBeenCalled();
  });
});
