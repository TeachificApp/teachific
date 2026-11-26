import Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { crossToolMockDb } from "./course360CrossToolTestFixture";
const m = vi.hoisted(() => ({
  db: null as any,
  session: null as any,
  sub: null as any,
  create: vi.fn(),
  retrieveSession: vi.fn(),
  retrieveSub: vi.fn(),
}));
vi.mock("./_core/env", () => ({
  ENV: {
    stripeSecretKey: "sk_test_fixture",
    stripeWebhookSecret: "whsec_signature_fixture",
    isProduction: false,
  },
}));
vi.mock("./db", () => ({
  getDb: async () => m.db,
  getUserByEmail: vi.fn(),
  getOrCreateUserByEmail: vi.fn(),
}));
vi.mock("./stripePlans", () => ({
  getStripe: () => ({
    webhooks: {
      constructEvent: (body: any, signature: string, secret: string) =>
        signing.webhooks.constructEvent(body, signature, secret),
    },
    checkout: { sessions: { create: m.create, retrieve: m.retrieveSession } },
    subscriptions: { retrieve: m.retrieveSub },
  }),
  PLAN_LIMITS: {},
  getPlatformPaymentReadiness: () => ({ ready: false }),
}));
vi.mock("./lmsDb", () => ({
  upsertOrgSubscription: vi.fn(),
  createEnrollment: vi.fn(),
  getEnrollment: vi.fn(),
  getCourseById: vi.fn(),
}));
vi.mock("./sendgrid", () => ({ sendEmail: vi.fn().mockResolvedValue({}) }));
vi.mock("./_core/email", () => ({
  buildOrgAdminNewPurchaseEmail: vi.fn(),
  sendEmailViaOrg: vi.fn(),
  buildFunnelPurchaseConfirmationEmail: vi.fn(),
}));
vi.mock("./_core/notification", () => ({ notifyOwner: vi.fn() }));
vi.mock("./lib/orderBumpCheckout", () => ({
  fulfillOrderBumpPurchase: vi.fn(),
}));
vi.mock("./routers/downloadsRouter", () => ({
  sendPurchaseConfirmationEmail: vi.fn(),
}));
vi.mock("./lib/fulfillBookvaultOrder", () => ({
  fulfillBookvaultOrder: vi.fn(),
}));
vi.mock("./lib/fulfillPrintfulOrder", () => ({
  fulfillPrintfulOrder: vi.fn(),
}));
vi.mock("./lib/fulfillPrintifyOrder", () => ({
  fulfillPrintifyOrder: vi.fn(),
}));
vi.mock("./lib/emailWorkflowEngine", () => ({
  emitEmailWorkflowEvent: vi.fn(),
}));
import router from "./stripeWebhookRoutes";
import {
  configureCourse360PaymentLedger,
  createCourse360PaymentCheckout,
  getCourse360PaymentAppAccess,
} from "./lib/course360PaymentLedger";
import { COURSE360_CROSS_TOOL_FAMILY } from "./lib/course360CrossToolCatalog";
const signing = new Stripe("sk_test_signature_only");
const callback = (router as any).stack
  .find((l: any) => l.route?.path === "/webhook")
  .route.stack.at(-1).handle;
function event(
  id = "evt_package",
  type = "checkout.session.completed",
  object: any = {
    id: "cs_package",
    metadata: { type: COURSE360_CROSS_TOOL_FAMILY },
  }
): any {
  return { id, type, livemode: false, created: 1700000000, data: { object } };
}
async function dispatch(payload: any, valid = true) {
  const body = Buffer.from(JSON.stringify(payload));
  const signature = valid
    ? signing.webhooks.generateTestHeaderString({
        payload: body.toString(),
        secret: "whsec_signature_fixture",
      })
    : "invalid";
  const res: any = {
    statusCode: 200,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      return this;
    },
  };
  await callback({ body, headers: { "stripe-signature": signature } }, res);
  return res;
}
beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubEnv("COURSE360_STRIPE_SECRET_KEY", "");
  vi.stubEnv("COURSE360_STRIPE_WEBHOOK_SECRET", "");
  m.db = crossToolMockDb();
  configureCourse360PaymentLedger({
    getDb: async () => m.db,
    accountId: "acct_fixture",
    livemode: false,
  });
  m.create.mockImplementation(
    async (params: any) =>
      (m.session = {
        id: "cs_package",
        status: "open",
        url: "https://checkout.stripe.test/package",
        livemode: false,
        metadata: params.metadata,
      })
  );
  m.retrieveSession.mockImplementation(async () => m.session);
  m.retrieveSub.mockImplementation(async () => m.sub);
  const metadata = {
    type: COURSE360_CROSS_TOOL_FAMILY,
    cross_tool_offer: "pro_creator_web",
    plan: "pro",
    creator_mode: "web",
    interval: "annual",
    org_id: "7",
    user_id: "10",
  };
  await createCourse360PaymentCheckout(
    {
      orgId: 7,
      userId: 10,
      product: "platform",
      selection: "pro",
      interval: "annual",
      trialEligible: true,
      params: {
        mode: "subscription",
        payment_method_types: ["card"],
        payment_method_collection: "always",
        line_items: [{ price: "price_pro_package", quantity: 1 }],
        metadata,
        subscription_data: { metadata, trial_period_days: 14 },
        success_url: "https://course360.app/billing",
        cancel_url: "https://course360.app/billing",
      },
    },
    {
      checkout: { sessions: { create: m.create, retrieve: m.retrieveSession } },
    } as any
  );
  const now = Math.floor(Date.now() / 1000);
  m.sub = {
    id: "sub_package",
    customer: "cus_package",
    livemode: false,
    status: "trialing",
    trial_start: now,
    trial_end: now + 14 * 86400,
    default_payment_method: "pm_card",
    cancel_at_period_end: false,
    metadata: { ...m.session.metadata },
    items: {
      data: [
        {
          quantity: 1,
          current_period_start: now,
          current_period_end: now + 14 * 86400,
          price: {
            id: "price_pro_package",
            active: true,
            livemode: false,
            currency: "usd",
            unit_amount: 249700,
            type: "recurring",
            billing_scheme: "per_unit",
            recurring: {
              interval: "year",
              interval_count: 1,
              usage_type: "licensed",
            },
            metadata: {
              course360_family: COURSE360_CROSS_TOOL_FAMILY,
              cross_tool_offer: "pro_creator_web",
              school_plan: "pro",
              creator_mode: "web",
            },
          },
        },
      ],
    },
  };
  m.session = {
    ...m.session,
    status: "complete",
    mode: "subscription",
    subscription: "sub_package",
    customer: "cus_package",
    currency: "usd",
    amount_total: 0,
    amount_subtotal: 0,
    payment_status: "no_payment_required",
    payment_method_collection: "always",
    payment_method_types: ["card"],
  };
});
describe("actual verified platform webhook -> durable package fulfillment", () => {
  it("rejects invalid signature before durable inbox or provider retrieval", async () => {
    expect((await dispatch(event(), false)).statusCode).toBe(400);
    expect(m.db.rows().course360_payment_inbox ?? []).toEqual([]);
    expect(m.retrieveSub).not.toHaveBeenCalled();
  });
  it("rejects wrong mode or connected account before durable inbox", async () => {
    for (const payload of [
      { ...event(), livemode: true },
      { ...event(), account: "acct_foreign" },
    ])
      expect((await dispatch(payload)).statusCode).toBe(400);
    expect(m.db.rows().course360_payment_inbox ?? []).toEqual([]);
  });
  it("signed completion grants exact Pro + Creator Web once, never Studio/Quiz/Desktop", async () => {
    expect((await dispatch(event())).statusCode).toBe(200);
    expect(m.db.rows().org_subscriptions[0]).toMatchObject({
      orgId: 7,
      plan: "pro",
      stripeSubscriptionId: "sub_package",
    });
    expect(await getCourse360PaymentAppAccess(7, 10, "creator")).toMatchObject({
      tier: "web",
      isPaid: false,
      isInTrial: true,
    });
    expect(await getCourse360PaymentAppAccess(7, 10, "studio")).toMatchObject({
      tier: "none",
    });
    expect(
      await getCourse360PaymentAppAccess(7, 10, "quiz_creator")
    ).toMatchObject({ tier: "none" });
    expect((await dispatch(event())).statusCode).toBe(200);
    expect(m.db.rows().course360_payment_app_subscriptions).toHaveLength(1);
    expect(m.retrieveSession).toHaveBeenCalledTimes(1);
  });
  it("wrong exact Pro annual amount is durable failed retry, then corrected current price fulfills", async () => {
    m.sub.items.data[0].price.unit_amount = 249797;
    expect((await dispatch(event())).statusCode).toBe(500);
    expect(m.db.rows().course360_payment_inbox[0].state).toBe("failed");
    expect(m.db.rows().org_subscriptions ?? []).toEqual([]);
    m.sub.items.data[0].price.unit_amount = 249700;
    expect((await dispatch(event())).statusCode).toBe(200);
    expect(m.db.rows().course360_payment_inbox[0]).toMatchObject({
      state: "completed",
      attempts: 2,
    });
  });
  it("retrieves fresh failure then paid recovery despite misleading signed snapshots", async () => {
    await dispatch(event());
    m.sub.status = "past_due";
    expect(
      (
        await dispatch(
          event("evt_fail", "invoice.payment_failed", {
            id: "in_one",
            subscription: "sub_package",
            status: "paid",
          })
        )
      ).statusCode
    ).toBe(200);
    expect(await getCourse360PaymentAppAccess(7, 10, "creator")).toMatchObject({
      tier: "none",
    });
    m.sub.status = "active";
    expect(
      (
        await dispatch(
          event("evt_paid", "invoice.paid", {
            id: "in_two",
            subscription: "sub_package",
          })
        )
      ).statusCode
    ).toBe(200);
    expect(await getCourse360PaymentAppAccess(7, 10, "creator")).toMatchObject({
      tier: "web",
      isPaid: true,
    });
  });
  it("current foreign-school metadata suspends owned package instead of transferring paid access", async () => {
    await dispatch(event());
    m.sub.metadata.org_id = "8";
    expect(
      (
        await dispatch(
          event("evt_foreign", "customer.subscription.updated", {
            id: "sub_package",
          })
        )
      ).statusCode
    ).toBe(200);
    expect(m.db.rows().course360_payment_app_subscriptions[0]).toMatchObject({
      orgId: 7,
      rawStatus: "unpaid",
    });
    expect(await getCourse360PaymentAppAccess(7, 10, "creator")).toMatchObject({
      tier: "none",
    });
    expect(m.db.rows().org_subscriptions).toHaveLength(1);
  });
});
