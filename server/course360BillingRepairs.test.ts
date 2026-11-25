import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";

const state = vi.hoisted(() => ({
  activeOrgId: 42,
  role: "org_admin",
  orgActive: true,
  sub: null as any,
  live: null as any,
  updated: null as any,
  rows: [] as any[],
  queries: [] as any[],
  getSubscription: vi.fn(),
  upsert: vi.fn(),
  checkout: vi.fn(),
  portal: vi.fn(),
  retrieve: vi.fn(),
  update: vi.fn(),
  scheduleCreate: vi.fn(),
  scheduleUpdate: vi.fn(),
  scheduleRelease: vi.fn(),
  scheduleRetrieve: vi.fn(),
}));
vi.mock("./_core/env", () => ({
  ENV: { stripeSecretKey: "", isProduction: false },
}));
vi.mock("./db", () => ({
  getOrgIdForUserWithFallback: vi.fn(async () => state.activeOrgId),
  getDb: vi.fn(async () => ({
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: (condition: any) => ({
            limit: async () => {
              const query = new MySqlDialect().sqlToQuery(condition);
              state.queries.push(query);
              return state.orgActive
                ? state.rows
                    .filter(
                      row =>
                        query.params.includes(row.orgId) &&
                        row.orgId === state.activeOrgId
                    )
                    .map(row => ({ ...row, role: state.role }))
                : [];
            },
          }),
        }),
      }),
    }),
  })),
}));
vi.mock("./lmsDb", () => ({
  getOrgSubscription: state.getSubscription,
  upsertOrgSubscription: state.upsert,
}));
vi.mock("./stripePlans", () => ({
  getPlatformStripeSecretKey: () => "mock-configured",
  getPlatformStripePublishableKey: () => "",
  getPlatformPaymentReadiness: () => ({ ready: false, secretMode: "missing" }),
  PLAN_LIMITS: { free: {}, starter: {}, builder: {}, pro: {}, enterprise: {} },
  STRIPE_PRICE_IDS: Object.fromEntries(
    [
      "starter",
      "builder",
      "pro",
      "studio_web",
      "studio_desktop",
      "studio_bundle",
      "creator_web",
      "creator_desktop",
      "creator_bundle",
      "quiz_creator_web",
      "quiz_creator_desktop",
      "quiz_creator_bundle",
    ].flatMap(tier =>
      ["monthly", "annual"].map(interval => [
        `${tier}_${interval}`,
        `price_${tier}_${interval}`,
      ])
    )
  ),
  getStripe: () => ({
    checkout: { sessions: { create: state.checkout } },
    billingPortal: { sessions: { create: state.portal } },
    subscriptions: { retrieve: state.retrieve, update: state.update },
    subscriptionSchedules: {
      create: state.scheduleCreate,
      update: state.scheduleUpdate,
      release: state.scheduleRelease,
      retrieve: state.scheduleRetrieve,
    },
  }),
}));
import {
  stripeRouter,
  parseApprovedPlatformCheckoutOrigin,
  resolveProductCheckoutReturnOrigin,
} from "./stripeRouter";
import {
  canChangeCourse360Subscription,
  safeCourse360PostCheckoutPath,
} from "../client/src/lib/course360BillingRouting";
import {
  confirmedPlatformBillingState,
  reusePendingSchoolCheckout,
} from "./course360BillingState";
const caller = () =>
  stripeRouter.createCaller({
    user: {
      id: 7,
      role: "org_admin",
      email: "owner@example.test",
      name: "Owner",
    },
  } as any);
const origin = "https://course360.app";
const end = 2000000000;
const subscription = (status = "active", tier = "pro", interval = "month") => ({
  id: "sub_B",
  customer: "cus_B",
  status,
  cancel_at_period_end: false,
  trial_start: null,
  trial_end: null,
  metadata: { org_id: String(state.activeOrgId), plan: tier },
  schedule: null,
  items: {
    data: [
      {
        id: "si_B",
        quantity: 1,
        current_period_start: end - 2592000,
        current_period_end: end,
        price: {
          id: `price_${tier}_${interval === "year" ? "annual" : "monthly"}`,
          metadata: { teachific_tier: tier },
          recurring: { interval },
        },
      },
    ],
  },
});
beforeEach(() => {
  vi.clearAllMocks();
  state.activeOrgId = 42;
  state.role = "org_admin";
  state.orgActive = true;
  state.queries = [];
  state.rows = [
    {
      orgId: 1,
      role: "member",
      orgName: "A",
      orgSlug: "a",
      customDomain: "a.example.test",
      domainVerificationStatus: "verified",
    },
    {
      orgId: 42,
      role: "org_admin",
      orgName: "B",
      orgSlug: "b",
      customDomain: "b.example.test",
      domainVerificationStatus: "verified",
    },
  ];
  state.sub = {
    plan: "pro",
    status: "active",
    stripeSubscriptionId: "sub_B",
    stripeCustomerId: "cus_B",
    starterTrialClaimed: true,
  };
  state.live = subscription();
  state.updated = subscription();
  state.getSubscription.mockImplementation(async () => state.sub);
  state.retrieve.mockImplementation(async () => state.live);
  state.update.mockImplementation(async () => state.updated);
  state.checkout.mockResolvedValue({
    url: "https://checkout.example.test/session",
  });
  state.portal.mockResolvedValue({ url: "https://billing.example.test" });
  state.scheduleCreate.mockImplementation(async () => ({
    id: "sched_B",
    current_phase: { start_date: end - 2592000 },
    phases: [
      {
        start_date: end - 2592000,
        end_date: end,
        items: [
          {
            price: state.live.items.data[0].price.id,
            quantity: 1,
            discounts: [],
            tax_rates: [],
          },
        ],
        discounts: [],
        metadata: {},
        trial_end: null,
        add_invoice_items: [],
      },
    ],
  }));
  state.scheduleUpdate.mockResolvedValue({ id: "sched_B", status: "active" });
  state.scheduleRelease.mockResolvedValue({});
});
describe("Course360 billing repairs (isolated provider mocks)", () => {
  it.each([false, true])(
    "reads and mutates B despite membership ordering reversed=%s",
    async reverse => {
      if (reverse) state.rows.reverse();
      const result = await caller().getSubscription();
      expect(result?.orgId).toBe(42);
      await caller().createPortalSession({ origin });
      expect(state.portal).toHaveBeenCalledWith({
        customer: "cus_B",
        return_url: `${origin}/billing`,
      });
      await caller().changePlan({ plan: "builder", interval: "monthly" });
      await caller().cancelSubscription();
      await caller().reactivateSubscription();
      expect(
        state.getSubscription.mock.calls.every(args => args[0] === 42)
      ).toBe(true);
      expect(state.upsert.mock.calls.every(args => args[0] === 42)).toBe(true);
      expect(
        state.queries.every(
          q => q.params.includes(true) && q.sql.includes("isActive")
        )
      ).toBe(true);
    }
  );
  it.each(["member", "sub_admin", "instructor"])(
    "denies %s portal, checkout and lifecycle writes before provider calls",
    async role => {
      state.role = role;
      for (const call of [
        () => caller().createPortalSession({ origin }),
        () =>
          caller().createCheckoutSession({
            plan: "pro",
            interval: "annual",
            origin,
          }),
        () => caller().changePlan({ plan: "builder", interval: "monthly" }),
        () => caller().cancelSubscription(),
        () => caller().reactivateSubscription(),
      ])
        await expect(call()).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(state.portal).not.toHaveBeenCalled();
      expect(state.retrieve).not.toHaveBeenCalled();
      expect(state.checkout).not.toHaveBeenCalled();
      expect(state.update).not.toHaveBeenCalled();
    }
  );
  it("rejects inactive schools", async () => {
    state.orgActive = false;
    await expect(
      caller().createPortalSession({ origin })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.portal).not.toHaveBeenCalled();
  });
  it.each(["active", "trialing", "past_due", "unpaid", "incomplete", "paused"])(
    "blocks duplicate checkout for nonterminal %s",
    async status => {
      state.live.status = status;
      await expect(
        caller().createCheckoutSession({
          plan: "starter",
          interval: "monthly",
          origin,
        })
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(state.checkout).not.toHaveBeenCalled();
    }
  );
  it.each(["canceled", "incomplete_expired"])(
    "allows terminal %s replacement without repeat trial and never updates terminal ID",
    async status => {
      state.activeOrgId = status === "canceled" ? 501 : 502;
      state.rows[1].orgId = state.activeOrgId;
      state.live = subscription(status);
      state.sub.status = "cancelled";
      await caller().createCheckoutSession({
        plan: "starter",
        interval: "monthly",
        origin,
      });
      const input = state.checkout.mock.calls[0][0];
      expect(input.customer).toBe("cus_B");
      expect(input.subscription_data.trial_period_days).toBeUndefined();
      expect(state.sub.stripeSubscriptionId).toBe("sub_B");
      await expect(
        caller().changePlan({ plan: "builder", interval: "annual" })
      ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
      expect(state.update).not.toHaveBeenCalled();
    }
  );
  it.each(["starter", "builder", "pro"] as const)(
    "preserves 14-day first paid %s school trials and anonymous checkout-first",
    async plan => {
      state.activeOrgId = { starter: 601, builder: 602, pro: 603 }[plan];
      state.rows[1].orgId = state.activeOrgId;
      state.sub = null;
      await caller().createCheckoutSession({
        plan,
        interval: "annual",
        origin,
      });
      expect(
        state.checkout.mock.calls[0][0].subscription_data.trial_period_days
      ).toBe(14);
      await stripeRouter
        .createCaller({ user: null } as any)
        .createPlatformTrialCheckout({
          name: "New owner",
          email: "new@example.test",
          plan,
          interval: "monthly",
          origin,
        });
      expect(state.checkout.mock.calls[1][0]).toMatchObject({
        metadata: { type: "platform_trial_signup" },
        payment_method_collection: "always",
        subscription_data: { trial_period_days: 14 },
      });
      expect(state.upsert).not.toHaveBeenCalled();
    }
  );
  it("reuses pending initial school checkouts and rejects another pending selection", async () => {
    state.activeOrgId = 701;
    state.rows[1].orgId = 701;
    state.sub = null;
    const input = {
      plan: "starter" as const,
      interval: "monthly" as const,
      origin,
    };
    const billing = caller();
    await billing.createCheckoutSession(input);
    await billing.createCheckoutSession(input);
    expect(state.checkout).toHaveBeenCalledTimes(1);
    await expect(
      caller().createCheckoutSession({ ...input, plan: "pro" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it.each([
    ["pro", "builder", "month", "monthly"],
    ["pro", "pro", "month", "annual"],
    ["pro", "pro", "year", "monthly"],
    ["starter", "pro", "month", "annual"],
  ])(
    "defers %s -> %s %s -> %s using real schedule phases",
    async (from, to, oldInterval, nextInterval) => {
      state.live = subscription("active", from, oldInterval);
      state.sub.plan = from;
      const result = await caller().changePlan({
        plan: to as any,
        interval: nextInterval as any,
      });
      expect(result).toMatchObject({
        scheduled: true,
        effectiveAt: new Date(end * 1000),
      });
      expect(state.update).not.toHaveBeenCalled();
      expect(state.upsert).not.toHaveBeenCalled();
      expect(state.scheduleCreate).toHaveBeenCalledWith({
        from_subscription: "sub_B",
      });
      const phases = state.scheduleUpdate.mock.calls[0][1].phases;
      expect(phases[0].items[0].price).toBe(state.live.items.data[0].price.id);
      expect(phases[0].end_date).toBe(end);
      expect(phases[1].start_date).toBe(end);
      expect(phases[1].items[0].price).toBe(`price_${to}_${nextInterval}`);
    }
  );
  it("retains trial in current phase but does not restart it in next phase", async () => {
    state.live.status = "trialing";
    state.live.trial_end = end;
    await caller().changePlan({ plan: "builder", interval: "monthly" });
    const phases = state.scheduleUpdate.mock.calls[0][1].phases;
    expect(phases[0].trial).toBe(true);
    expect(phases[1].trial).toBe(false);
  });
  it("releases only newly adopted schedule on update failure and keeps local entitlement", async () => {
    state.scheduleUpdate.mockRejectedValueOnce(new Error("mock failure"));
    await expect(
      caller().changePlan({ plan: "builder", interval: "monthly" })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(state.scheduleRelease).toHaveBeenCalledWith("sched_B");
    expect(state.upsert).not.toHaveBeenCalled();
  });
  it("preserves independent schedules and pending cancellations", async () => {
    state.live.schedule = "sched_custom";
    await expect(
      caller().changePlan({ plan: "builder", interval: "monthly" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(state.scheduleCreate).not.toHaveBeenCalled();
    state.live.schedule = null;
    state.live.cancel_at_period_end = true;
    await expect(
      caller().changePlan({ plan: "builder", interval: "monthly" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it.each(["active", "trialing", "past_due"])(
    "persists exact returned upgrade status %s, dates and cancellation",
    async status => {
      state.live = subscription("active", "builder");
      state.sub.plan = "builder";
      state.updated = subscription(status, "pro");
      state.updated.cancel_at_period_end = true;
      state.updated.items.data[0].current_period_end = end + 123;
      state.updated.trial_start = end - 200;
      state.updated.trial_end = end + 200;
      const result = await caller().changePlan({
        plan: "pro",
        interval: "monthly",
      });
      expect(state.upsert.mock.calls[0][1]).toMatchObject({
        plan: "pro",
        status,
        rawStripeStatus: status,
        cancelAtPeriodEnd: true,
        currentPeriodEnd: new Date((end + 123) * 1000),
        trialEndsAt: new Date((end + 200) * 1000),
      });
      expect(result.success).toBe(status !== "past_due");
      expect(state.update.mock.calls[0][1]).toMatchObject({
        payment_behavior: "error_if_incomplete",
        proration_behavior: "always_invoice",
        billing_cycle_anchor: "unchanged",
      });
    }
  );
  it("does not persist or announce upgrade after Stripe payment/SCA error", async () => {
    state.live = subscription("active", "builder");
    state.update.mockRejectedValueOnce(
      new Error("Payment requires authentication")
    );
    await expect(
      caller().changePlan({ plan: "pro", interval: "monthly" })
    ).rejects.toThrow();
    expect(state.upsert).not.toHaveBeenCalled();
  });
  it("cancel/reactivate use returned period/status/cancel state rather than requested flags", async () => {
    state.updated = subscription("past_due");
    state.updated.cancel_at_period_end = false;
    state.updated.items.data[0].current_period_end = end + 9;
    const cancelled = await caller().cancelSubscription();
    expect(cancelled).toMatchObject({
      success: false,
      currentPeriodEnd: new Date((end + 9) * 1000),
    });
    expect(state.upsert.mock.calls[0][1]).toMatchObject({
      status: "past_due",
      cancelAtPeriodEnd: false,
    });
    state.updated.cancel_at_period_end = true;
    const reactivated = await caller().reactivateSubscription();
    expect(reactivated).toMatchObject({
      success: false,
      paymentActionRequired: true,
    });
    expect(state.upsert.mock.calls[1][1].cancelAtPeriodEnd).toBe(true);
  });
  it("preserves manual/legacy org plan with no Stripe ID", async () => {
    state.sub = {
      plan: "enterprise",
      status: "active",
      customPriceLabel: "Legacy",
    };
    const result = await caller().getSubscription();
    expect(result).toMatchObject({
      plan: "enterprise",
      customPriceLabel: "Legacy",
    });
    expect(state.retrieve).not.toHaveBeenCalled();
    expect(state.upsert).not.toHaveBeenCalled();
  });
  it("reads schedule date without replacing current plan", async () => {
    state.live.schedule = "sched_B";
    state.scheduleRetrieve.mockResolvedValue({
      status: "active",
      metadata: {
        type: "course360_school_plan_change",
        pending_plan: "builder",
        pending_interval: "annual",
        effective_at: String(end),
      },
    });
    const result = await caller().getSubscription();
    expect(result).toMatchObject({
      plan: "pro",
      pendingChange: {
        plan: "builder",
        interval: "annual",
        effectiveAt: new Date(end * 1000),
      },
    });
  });
  it("restricts school return origins and rejects legacy brand/foreign domains", async () => {
    for (const url of [
      "https://teachific.app",
      "https://iHeartEcho.app",
      "https://evil.test",
      "ftp://localhost",
      "https://course360.app:444",
      "https://attacker.course360.app",
    ])
      expect(
        parseApprovedPlatformCheckoutOrigin(url, "https://preview.example.test")
      ).toBeNull();
    expect(
      await resolveProductCheckoutReturnOrigin("https://b.example.test/path", 7)
    ).toBe("https://b.example.test");
    expect(
      await resolveProductCheckoutReturnOrigin("https://b.course360.app", 7)
    ).toBe("https://b.course360.app");
    await expect(
      resolveProductCheckoutReturnOrigin("https://a.example.test", 7)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("binds old/new app checkout session and subscription metadata to school and access tier", async () => {
    await caller().createStudioCheckout({
      tier: "bundle",
      interval: "monthly",
      origin,
    });
    await caller().createCreatorSingleCheckout({
      accessTier: "web",
      interval: "annual",
      origin,
    });
    await caller().createQuizCreatorCheckout({
      accessTier: "desktop",
      interval: "monthly",
      origin,
    });
    for (const [input] of state.checkout.mock.calls) {
      expect(input.metadata.org_id).toBe("42");
      expect(input.subscription_data.metadata).toMatchObject({
        org_id: "42",
        user_id: "7",
        access_tier: input.metadata.access_tier,
        product_type: input.metadata.product_type,
      });
    }
    await expect(
      caller().createStudioCheckout({
        tier: "web",
        interval: "monthly",
        origin: "https://evil.test",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(state.checkout).toHaveBeenCalledTimes(3);
  });
  it("routes terminal UI subscriptions to replacement and disallows protocol-relative post-checkout redirects", () => {
    expect(
      canChangeCourse360Subscription({
        stripeSubscriptionId: "old",
        status: "cancelled",
      })
    ).toBe(false);
    expect(
      canChangeCourse360Subscription({
        stripeSubscriptionId: "current",
        status: "active",
      })
    ).toBe(true);
    expect(safeCourse360PostCheckoutPath("//evil.test")).toBeNull();
    expect(safeCourse360PostCheckoutPath("/\\evil.test")).toBeNull();
    expect(safeCourse360PostCheckoutPath("/creator?course=1")).toBe(
      "/creator?course=1"
    );
  });
  it("maps unrepresentable Stripe statuses fail closed and retains raw status", () => {
    expect(confirmedPlatformBillingState(subscription("paused"))).toMatchObject(
      { status: "unpaid", rawStripeStatus: "paused" }
    );
    expect(
      confirmedPlatformBillingState(subscription("incomplete_expired"))
    ).toMatchObject({ status: "cancelled" });
  });
  it("serializes concurrent creations through the real school checkout cache", async () => {
    const create = vi.fn(async () => ({ url: "mock" }));
    const results = await Promise.all([
      reusePendingSchoolCheckout(9872, "a", create, 1),
      reusePendingSchoolCheckout(9872, "a", create, 1),
    ]);
    expect(results).toEqual([{ url: "mock" }, { url: "mock" }]);
    expect(create).toHaveBeenCalledTimes(1);
  });
  it("retries failed pending checkout and expires local cache", async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(new Error("failed"))
      .mockResolvedValue({ url: "mock" });
    await expect(
      reusePendingSchoolCheckout(9871, "a", create, 1)
    ).rejects.toThrow("failed");
    expect(await reusePendingSchoolCheckout(9871, "a", create, 1)).toEqual({
      url: "mock",
    });
    await reusePendingSchoolCheckout(9871, "b", create, 1800002);
    expect(create).toHaveBeenCalledTimes(3);
  });
});
