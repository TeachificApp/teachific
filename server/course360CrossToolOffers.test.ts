import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { COURSE360_CROSS_TOOL_OFFERS } from "../shared/course360CrossToolOffers";
import { course360StripeCents } from "../shared/course360Pricing";
import {
  organizations,
  orgSubscriptions,
  orgMembers,
  users,
  userActiveOrg,
} from "../drizzle/schema";
import {
  course360PaymentAppSubscriptions as apps,
  course360PaymentManualGrants as grants,
} from "./lib/course360PaymentTables";
import { crossToolMockDb } from "./course360CrossToolTestFixture";
import {
  configureCourse360PaymentLedger,
  createCourse360PaymentCheckout,
  processCourse360PaymentVerifiedEvent,
  getCourse360PaymentAppAccess,
  reserveCourse360PaymentCheckout,
} from "./lib/course360PaymentLedger";
import {
  COURSE360_CROSS_TOOL_FAMILY,
  assertCourse360CrossToolPrice,
} from "./lib/course360CrossToolCatalog";
import {
  dispatchCourse360CrossToolVerifiedEvent,
  deliverCourse360CrossToolOnboarding,
  assertCourse360CrossToolRecovery,
  isCourse360CrossToolSchoolSubscription,
} from "./lib/course360CrossToolFulfillment";
import { sendEmail } from "./sendgrid";
vi.mock("./sendgrid", () => ({ sendEmail: vi.fn().mockResolvedValue({}) }));
vi.mock("./stripePlans", () => ({
  getStripe: vi.fn(),
  getPlatformPaymentReadiness: () => ({ ready: false }),
}));
let db: ReturnType<typeof crossToolMockDb>;
let provider: any;
let session: any;
let sub: any;
function price(
  offer: keyof typeof COURSE360_CROSS_TOOL_OFFERS = "builder_creator_web",
  interval: "monthly" | "annual" = "monthly"
) {
  return {
    id: `price_${offer}_${interval}`,
    livemode: false,
    active: true,
    currency: "usd",
    unit_amount: course360StripeCents(
      COURSE360_CROSS_TOOL_OFFERS[offer][interval]
    ),
    type: "recurring",
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
  } as any;
}
function input(
  signup = false,
  offer: keyof typeof COURSE360_CROSS_TOOL_OFFERS = "builder_creator_web",
  interval: "monthly" | "annual" = "monthly"
) {
  const metadata = {
    type: COURSE360_CROSS_TOOL_FAMILY,
    cross_tool_offer: offer,
    plan: COURSE360_CROSS_TOOL_OFFERS[offer].schoolPlan,
    creator_mode: "web",
    interval,
    ...(signup
      ? { signup_email: "owner@example.test", signup_name: "Owner" }
      : { org_id: "7", user_id: "10" }),
  };
  return {
    orgId: signup ? null : 7,
    userId: signup ? null : 10,
    product: signup ? ("signup" as const) : ("platform" as const),
    selection: metadata.plan,
    interval,
    email: "owner@example.test",
    trialEligible: true,
    params: {
      mode: "subscription" as const,
      payment_method_types: ["card" as const],
      payment_method_collection: "always" as const,
      line_items: [{ price: price(offer, interval).id, quantity: 1 }],
      metadata,
      subscription_data: { metadata, trial_period_days: 14 },
      success_url: "https://course360.app/account-setup",
      cancel_url: "https://course360.app/register",
      allow_promotion_codes: false,
    },
  };
}
function evt(
  id = "evt_checkout",
  type = "checkout.session.completed",
  object: any = {
    id: "cs_one",
    metadata: { type: COURSE360_CROSS_TOOL_FAMILY },
  }
): any {
  return { id, type, livemode: false, created: 1700000000, data: { object } };
}
async function deliver(event = evt()) {
  return processCourse360PaymentVerifiedEvent(
    event,
    "platform-account",
    async () => {
      expect(
        await dispatchCourse360CrossToolVerifiedEvent(event, provider)
      ).toBe(true);
    }
  );
}
async function open(
  signup = false,
  offer: keyof typeof COURSE360_CROSS_TOOL_OFFERS = "builder_creator_web",
  interval: "monthly" | "annual" = "monthly"
) {
  await createCourse360PaymentCheckout(
    input(signup, offer, interval),
    provider
  );
  const now = Math.floor(Date.now() / 1000);
  sub = {
    id: "sub_one",
    customer: "cus_one",
    livemode: false,
    status: "trialing",
    trial_start: now,
    trial_end: now + 14 * 86400,
    default_payment_method: "pm_card",
    cancel_at_period_end: false,
    metadata: { ...session.metadata },
    items: {
      data: [
        {
          quantity: 1,
          price: price(offer, interval),
          current_period_start: now,
          current_period_end: now + 14 * 86400,
        },
      ],
    },
  };
  session = {
    ...session,
    status: "complete",
    mode: "subscription",
    subscription: sub.id,
    customer: sub.customer,
    currency: "usd",
    amount_total: 0,
    amount_subtotal: 0,
    payment_status: "no_payment_required",
    customer_email: "owner@example.test",
    payment_method_collection: "always",
    payment_method_types: ["card"],
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  db = crossToolMockDb();
  configureCourse360PaymentLedger({
    getDb: async () => db,
    accountId: "acct_fixture",
    livemode: false,
  });
  provider = {
    checkout: {
      sessions: {
        create: vi.fn(
          async (params: any) =>
            (session = {
              id: "cs_one",
              status: "open",
              url: "https://checkout.stripe.test/one",
              livemode: false,
              metadata: params.metadata,
            })
        ),
        retrieve: vi.fn(async () => session),
      },
    },
    subscriptions: { retrieve: vi.fn(async () => sub) },
  };
});
describe("approved exact package dollars and immutable price", () => {
  it("keeps approved catalog dollars exact and Pro annual at 249700 cents", () => {
    expect(COURSE360_CROSS_TOOL_OFFERS.builder_creator_web).toMatchObject({
      monthly: 169.97,
      annual: 1599.97,
      schoolPlan: "builder",
      creatorMode: "web",
    });
    expect(COURSE360_CROSS_TOOL_OFFERS.pro_creator_web).toMatchObject({
      monthly: 249.97,
      annual: 2497,
      schoolPlan: "pro",
      creatorMode: "web",
    });
    expect(
      course360StripeCents(COURSE360_CROSS_TOOL_OFFERS.pro_creator_web.annual)
    ).toBe(249700);
  });
  it.each(["builder_creator_web", "pro_creator_web"] as const)(
    "fulfills all approved %s intervals with one card-required subscription",
    async offer => {
      for (const interval of ["monthly", "annual"] as const) {
        db = crossToolMockDb();
        configureCourse360PaymentLedger({
          getDb: async () => db,
          accountId: "acct_fixture",
          livemode: false,
        });
        await open(false, offer, interval);
        const params = provider.checkout.sessions.create.mock.calls.at(-1)![0];
        expect(params.subscription_data.trial_period_days).toBe(14);
        expect(params.payment_method_collection).toBe("always");
        expect(params.allow_promotion_codes).toBe(false);
        expect(params.metadata.product_type).toBeUndefined();
        expect(params.line_items).toHaveLength(1);
        await deliver();
        expect(db.rows().org_subscriptions[0]).toMatchObject({
          plan: COURSE360_CROSS_TOOL_OFFERS[offer].schoolPlan,
          stripeSubscriptionId: "sub_one",
          rawStripeStatus: "trialing",
        });
        expect(db.rows().course360_payment_app_subscriptions).toEqual([
          expect.objectContaining({
            product: "creator",
            tier: "web",
            orgId: 7,
            userId: 10,
            reservationId: params.metadata.payment_reservation_id,
          }),
        ]);
        expect(
          await getCourse360PaymentAppAccess(7, 10, "creator")
        ).toMatchObject({ tier: "web", isInTrial: true, isPaid: false });
        expect(
          await getCourse360PaymentAppAccess(7, 10, "studio")
        ).toMatchObject({ tier: "none" });
        expect(
          await getCourse360PaymentAppAccess(7, 10, "quiz_creator")
        ).toMatchObject({ tier: "none" });
        expect(
          await isCourse360CrossToolSchoolSubscription(db, 7, "sub_one")
        ).toBe(true);
      }
    }
  );
  it.each([
    "unit_amount",
    "id",
    "currency",
    "interval",
    "interval_count",
    "mode",
    "metadata",
    "quantity",
  ])("rejects wrong %s and grants nothing", async kind => {
    await open();
    if (kind === "unit_amount") sub.items.data[0].price.unit_amount++;
    if (kind === "id") sub.items.data[0].price.id = "price_foreign";
    if (kind === "currency") sub.items.data[0].price.currency = "eur";
    if (kind === "interval")
      sub.items.data[0].price.recurring.interval = "year";
    if (kind === "interval_count")
      sub.items.data[0].price.recurring.interval_count = 2;
    if (kind === "mode") sub.livemode = true;
    if (kind === "metadata") sub.metadata.creator_mode = "bundle";
    if (kind === "quantity") sub.items.data[0].quantity = 2;
    await expect(deliver()).rejects.toThrow();
    expect(db.rows().org_subscriptions ?? []).toEqual([]);
    expect(db.rows().course360_payment_app_subscriptions ?? []).toEqual([]);
    expect(db.rows().course360_payment_inbox[0].state).toBe("failed");
  });
  it.each([
    "amount",
    "currency",
    "foreign_school",
    "saved_card",
    "trial_length",
  ])("rejects Checkout %s tampering", async kind => {
    await open();
    if (kind === "amount") session.amount_total = 1;
    if (kind === "currency") session.currency = "eur";
    if (kind === "foreign_school") session.metadata.org_id = "8";
    if (kind === "saved_card") sub.default_payment_method = null;
    if (kind === "trial_length") sub.trial_end++;
    await expect(deliver()).rejects.toThrow();
    expect(db.rows().org_subscriptions ?? []).toEqual([]);
  });
});
describe("durable package lifecycle and recovery", () => {
  it("invoice arriving before Checkout never completes an unbound paid package", async () => {
    await open();
    const event = evt("evt_invoice_first", "invoice.paid", {
      id: "in_first",
      subscription: "sub_one",
    });
    await expect(deliver(event)).rejects.toThrow("Checkout must complete");
    expect(db.rows().course360_payment_inbox[0].state).toBe("failed");
    await deliver();
    await deliver(event);
    expect(db.rows().course360_payment_app_subscriptions).toHaveLength(1);
  });
  it("invalid current package price suspends only owned sources and genuine later recovery restores", async () => {
    await open();
    await deliver();
    sub.items.data[0].price.unit_amount = 1;
    await deliver(
      evt("evt_price_drift", "customer.subscription.updated", { id: "sub_one" })
    );
    expect(await getCourse360PaymentAppAccess(7, 10, "creator")).toMatchObject({
      tier: "none",
    });
    expect(db.rows().org_subscriptions[0].status).toBe("unpaid");
    sub.items.data[0].price = price();
    sub.status = "active";
    await deliver(
      evt("evt_price_repaired", "invoice.paid", {
        id: "in_repaired",
        subscription: "sub_one",
      })
    );
    expect(await getCourse360PaymentAppAccess(7, 10, "creator")).toMatchObject({
      tier: "web",
      isPaid: true,
    });
  });
  it("delayed zero-dollar trial completion uses current paid renewal instead of rejecting history", async () => {
    await open();
    sub.status = "active";
    await deliver();
    expect(await getCourse360PaymentAppAccess(7, 10, "creator")).toMatchObject({
      tier: "web",
      isPaid: true,
      isInTrial: false,
    });
  });
  it("deduplicates and survives simulated bootstrap restart", async () => {
    await open();
    await deliver();
    configureCourse360PaymentLedger({
      getDb: async () => db,
      accountId: "acct_fixture",
      livemode: false,
    });
    expect(await deliver()).toBe("duplicate");
    expect(db.rows().course360_payment_app_subscriptions).toHaveLength(1);
  });
  it("failed grant transaction rolls back and retries durable inbox", async () => {
    await open();
    const insert = db.insert;
    let fail = true;
    db.insert = (table: any) => {
      if (table === apps && fail) throw new Error("required grant failed");
      return insert(table);
    };
    await expect(deliver()).rejects.toThrow("required grant failed");
    expect(db.rows().org_subscriptions ?? []).toEqual([]);
    fail = false;
    await deliver();
    expect(db.rows().course360_payment_inbox[0]).toMatchObject({
      state: "completed",
      attempts: 2,
    });
  });
  it("pending failed Checkout never grants and can later recover", async () => {
    await open();
    session.status = "open";
    await deliver(evt("evt_fail", "checkout.session.async_payment_failed"));
    expect(db.rows().course360_payment_app_subscriptions ?? []).toEqual([]);
    session.status = "complete";
    await deliver();
    expect(db.rows().course360_payment_app_subscriptions).toHaveLength(1);
  });
  it("lifecycle before Checkout fails retryably, never creates unbound grant", async () => {
    await open();
    const event = evt("evt_before", "customer.subscription.updated", {
      id: "sub_one",
      metadata: sub.metadata,
    });
    await expect(deliver(event)).rejects.toThrow("Checkout must complete");
    await deliver();
    await deliver(event);
    expect(db.rows().course360_payment_app_subscriptions).toHaveLength(1);
  });
  it("projects fresh failure/cancel/reactivation and does not trust delayed snapshot", async () => {
    await open();
    await deliver();
    sub.status = "active";
    sub.cancel_at_period_end = true;
    await deliver(
      evt("evt_cancel_pending", "customer.subscription.updated", {
        id: "sub_one",
        status: "canceled",
      })
    );
    expect(await getCourse360PaymentAppAccess(7, 10, "creator")).toMatchObject({
      tier: "web",
      isPaid: true,
    });
    sub.cancel_at_period_end = false;
    await deliver(
      evt("evt_reactivate", "customer.subscription.updated", { id: "sub_one" })
    );
    expect(db.rows().org_subscriptions[0].cancelAtPeriodEnd).toBe(false);
    sub.status = "past_due";
    await deliver(
      evt("evt_failed", "invoice.payment_failed", {
        id: "in_fail",
        parent: {
          type: "subscription_details",
          subscription_details: { subscription: "sub_one" },
        },
      })
    );
    expect(await getCourse360PaymentAppAccess(7, 10, "creator")).toMatchObject({
      tier: "none",
    });
    expect(db.rows().org_subscriptions[0].status).toBe("past_due");
    sub.status = "active";
    await deliver(
      evt("evt_paid", "invoice.paid", {
        id: "in_paid",
        subscription: "sub_one",
      })
    );
    expect(await getCourse360PaymentAppAccess(7, 10, "creator")).toMatchObject({
      tier: "web",
      isPaid: true,
    });
    sub.status = "canceled";
    await deliver(
      evt("evt_deleted", "customer.subscription.deleted", { id: "sub_one" })
    );
    expect(await getCourse360PaymentAppAccess(7, 10, "creator")).toMatchObject({
      tier: "none",
    });
    expect(db.rows().org_subscriptions[0].status).toBe("cancelled");
    sub.status = "active";
    sub.items.data[0].current_period_end = 1;
    await deliver(
      evt("evt_expiry", "customer.subscription.updated", { id: "sub_one" })
    );
    expect(await getCourse360PaymentAppAccess(7, 10, "creator")).toMatchObject({
      tier: "none",
    });
  });
  it("retains independent manual Desktop provenance when package canceled and exposes recovery", async () => {
    await open();
    await deliver();
    db.seed(grants, [
      {
        id: "manual",
        orgId: 7,
        userId: 10,
        product: "creator",
        tier: "desktop",
        expiresAt: null,
        revokedAt: null,
        source: "reviewed-support",
      },
    ]);
    sub.status = "unpaid";
    await deliver(
      evt("evt_unpaid", "customer.subscription.updated", { id: "sub_one" })
    );
    expect(await getCourse360PaymentAppAccess(7, 10, "creator")).toMatchObject({
      tier: "desktop",
      hasManualGrant: true,
      isPaid: false,
    });
    expect(db.rows().course360_payment_manual_grants[0].revokedAt).toBeNull();
    expect(
      await assertCourse360CrossToolRecovery(
        db,
        db.rows().course360_payment_app_subscriptions[0],
        sub
      )
    ).toBe(true);
    await expect(
      assertCourse360CrossToolRecovery(
        db,
        { ...db.rows().course360_payment_app_subscriptions[0], orgId: 8 },
        sub
      )
    ).rejects.toThrow();
  });
  it("old package cannot replace a newer school's subscription", async () => {
    await open();
    await deliver();
    db.rows().org_subscriptions[0].stripeSubscriptionId = "sub_newer";
    await expect(
      deliver(
        evt("evt_old", "customer.subscription.updated", { id: "sub_one" })
      )
    ).rejects.toThrow("current-school");
    expect(db.rows().org_subscriptions[0].stripeSubscriptionId).toBe(
      "sub_newer"
    );
  });
});
describe("same email, exact school separation and subscription overlap", () => {
  it("onboarding email failure retries after committed grants without recreating school or exposing existing reset token", async () => {
    await open(true);
    await deliver();
    vi.mocked(sendEmail)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    await expect(deliverCourse360CrossToolOnboarding(evt())).rejects.toThrow(
      "delivery must retry"
    );
    expect(db.rows().course360_payment_checkouts[0].state).toBe("completed");
    expect(db.rows().course360_payment_app_subscriptions).toHaveLength(1);
    expect(db.rows().platform_trial_signup_fulfillments[0].errorMessage).toBe(
      "cross_tool_email_pending:existing"
    );
    await deliverCourse360CrossToolOnboarding(evt());
    expect(db.rows().organizations).toHaveLength(3);
    expect(
      db.rows().platform_trial_signup_fulfillments[0].errorMessage
    ).toBeNull();
    expect(vi.mocked(sendEmail).mock.calls.at(-1)![0].html).not.toContain(
      "preserved"
    );
    expect(db.rows().users[0].resetToken).toBe("preserved");
  });
  it("same-email signup creates a distinct school and pending verified owner claim, never merges identity or selection", async () => {
    await open(true);
    const before = structuredClone(db.rows().users[0]);
    await deliver();
    expect(db.rows().organizations).toHaveLength(3);
    const created = db.rows().organizations[2];
    expect(created.id).not.toBe(7);
    expect(db.rows().course360_payment_owner_claims[0]).toMatchObject({
      orgId: created.id,
      userId: 10,
      state: "pending",
    });
    expect(db.rows().users[0]).toEqual(before);
    expect(db.rows().user_active_org[0].orgId).toBe(7);
    expect(
      db.rows().org_members.filter((m: any) => m.orgId === created.id)
    ).toEqual([]);
    expect(db.rows().course360_payment_app_subscriptions[0].orgId).toBe(
      created.id
    );
    expect(await getCourse360PaymentAppAccess(7, 10, "creator")).toMatchObject({
      tier: "none",
    });
    await deliver();
    expect(db.rows().organizations).toHaveLength(3);
  });
  it("does not provision from email alone into a foreign school", async () => {
    await open();
    sub.metadata.org_id = "8";
    await expect(deliver()).rejects.toThrow("school/user");
    expect(db.rows().org_subscriptions ?? []).toEqual([]);
  });
  it("blocks existing school paid-plan and Creator subscription overlaps", async () => {
    db.seed(orgSubscriptions, [
      {
        id: 1,
        orgId: 7,
        plan: "builder",
        status: "active",
        stripeSubscriptionId: "sub_existing",
      },
    ]);
    await expect(reserveCourse360PaymentCheckout(input())).rejects.toThrow(
      "overlaps"
    );
    db.seed(orgSubscriptions, []);
    db.seed(apps, [
      {
        id: "existing",
        orgId: 7,
        userId: 10,
        product: "creator",
        rawStatus: "past_due",
      },
    ]);
    await expect(reserveCourse360PaymentCheckout(input())).rejects.toThrow(
      "Creator subscription overlaps"
    );
    expect(provider.checkout.sessions.create).not.toHaveBeenCalled();
  });
  it("blocks standalone Creator pending race in both directions", async () => {
    const creator: any = input();
    creator.product = "creator";
    creator.selection = "web";
    creator.params.metadata = {
      org_id: "7",
      user_id: "10",
      product_type: "creator",
      access_tier: "web",
      interval: "monthly",
    };
    creator.params.subscription_data.metadata = creator.params.metadata;
    await reserveCourse360PaymentCheckout(creator);
    await expect(reserveCourse360PaymentCheckout(input())).rejects.toThrow(
      "Creator checkout already pending"
    );
    db = crossToolMockDb();
    configureCourse360PaymentLedger({
      getDb: async () => db,
      accountId: "acct_fixture",
      livemode: false,
    });
    await reserveCourse360PaymentCheckout(input());
    await expect(reserveCourse360PaymentCheckout(creator)).rejects.toThrow(
      "Package checkout already pending"
    );
  });
});
