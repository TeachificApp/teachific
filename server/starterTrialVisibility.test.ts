import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { ENV } from "./_core/env";

const checkoutCalls: Array<Record<string, unknown>> = [];
const subscriptionUpserts: Array<Record<string, unknown>> = [];
let subscription: { stripeSubscriptionId: string | null; starterTrialClaimed?: boolean } | null = null;

const db = {
  select: vi.fn(() => ({
    from: () => ({
      innerJoin: () => ({
        where: () => ({
          limit: async () => [{ orgId: 41, role: "org_admin", orgName: "Starter School", orgSlug: "starter-school" }],
        }),
      }),
    }),
  })),
};

vi.mock("./db", () => ({
  getDb: vi.fn(async () => db),
}));

vi.mock("./lmsDb", () => ({
  getOrgSubscription: vi.fn(async () => subscription),
  upsertOrgSubscription: vi.fn(async (_orgId: number, data: Record<string, unknown>) => {
    subscriptionUpserts.push(data);
  }),
}));

vi.mock("./stripePlans", () => ({
  getStripe: () => ({
    checkout: {
      sessions: {
        create: vi.fn(async (input: Record<string, unknown>) => {
          checkoutCalls.push(input);
          return { url: "https://checkout.stripe.example/session" };
        }),
      },
    },
  }),
  STRIPE_PRICE_IDS: {
    starter_monthly: "price_starter_monthly",
    starter_annual: "price_starter_annual",
    builder_monthly: "price_builder_monthly",
    builder_annual: "price_builder_annual",
    pro_monthly: "price_pro_monthly",
    pro_annual: "price_pro_annual",
  },
  PLAN_LIMITS: { enterprise: {} },
}));

import { stripeRouter } from "./stripeRouter";

const context = {
  user: { id: 71, role: "org_admin", email: "owner@example.test", name: "School Owner" },
} as any;

const landingSource = readFileSync(new URL("../client/src/pages/LandingPage.tsx", import.meta.url), "utf8");
const registerSource = readFileSync(new URL("../client/src/pages/auth/RegisterPage.tsx", import.meta.url), "utf8");
const loginSource = readFileSync(new URL("../client/src/pages/auth/LoginPage.tsx", import.meta.url), "utf8");
const billingSource = readFileSync(new URL("../client/src/pages/profile/BillingPage.tsx", import.meta.url), "utf8");
const creatorLandingSource = readFileSync(new URL("../client/src/pages/CreatorLandingPage.tsx", import.meta.url), "utf8");
const studioDashboardSource = readFileSync(new URL("../client/src/pages/StudioDashboard.tsx", import.meta.url), "utf8");
const pageBuilderSource = readFileSync(new URL("../client/src/components/PageBuilder.tsx", import.meta.url), "utf8");
const wysiwygPageBuilderSource = readFileSync(new URL("../client/src/components/WysiwygPageBuilder.tsx", import.meta.url), "utf8");
const customAuthSource = readFileSync(new URL("./customAuthRouter.ts", import.meta.url), "utf8");
const subscriptionSchemaSource = readFileSync(new URL("../drizzle/schema.ts", import.meta.url), "utf8");
const trialMigrationSource = readFileSync(new URL("../drizzle/0005_chemical_shape.sql", import.meta.url), "utf8");
const stripeWebhookSource = readFileSync(new URL("./stripeWebhookRoutes.ts", import.meta.url), "utf8");

const originalStripeSecret = ENV.stripeSecretKey;

describe("Starter trial and legacy Free tier presentation", () => {
  beforeEach(() => {
    checkoutCalls.splice(0);
    subscriptionUpserts.splice(0);
    subscription = null;
    (ENV as any).stripeSecretKey = "sk_test_starter_trial";
    vi.clearAllMocks();
  });

  it("hides the Free offer from public pricing, registration, login, and selectable billing plans", () => {
    expect(landingSource).not.toContain('name: "Free"');
    expect(landingSource).not.toContain('>Free</th>');
    expect(landingSource).not.toContain("Sign up free");
    expect(landingSource).toContain("Start 14-Day Trial");
    expect(registerSource).not.toContain("Create free account");
    expect(registerSource).not.toContain("Free forever");
    expect(registerSource).not.toContain(">teach</span>");
    expect(registerSource).not.toContain("/policies/teachific");
    expect(registerSource).toContain("Start a 14-day Starter trial");
    expect(registerSource).toContain("COURSE360_PLATFORM_LOGO_URL");
    expect(loginSource).not.toContain("Start for free");
    expect(loginSource).toContain("Start 14-day trial");
    expect(billingSource).toContain('const plans: PlanTier[] = ["starter", "builder", "pro", "enterprise"];');
    expect(billingSource).toContain('currentPlan === "free" ? "Legacy Access"');
    expect(billingSource).not.toContain("Always Free");
    expect(creatorLandingSource).not.toContain("Start Building for Free");
    expect(creatorLandingSource).not.toContain("14-day free trial");
    expect(creatorLandingSource).toContain("Start 14-Day Trial");
    expect(studioDashboardSource).not.toContain("Start free — no credit card required");
    expect(studioDashboardSource).not.toContain("Teachific Studio subscription");
    expect(studioDashboardSource).toContain("Choose a paid Studio plan to continue.");
    expect(pageBuilderSource).not.toContain("Create your free account");
    expect(wysiwygPageBuilderSource).not.toContain("Create your free account");
    expect(customAuthSource).toContain("Magic links are sign-in only");
    expect(customAuthSource).not.toContain("Auto-register new user via magic link");
    expect(subscriptionSchemaSource).toContain('starterTrialClaimed: boolean("starterTrialClaimed").default(false).notNull()');
    expect(trialMigrationSource).toContain("ADD `starterTrialClaimed` boolean DEFAULT false NOT NULL");
  });

  it("creates a 14-day, payment-method-backed trial only for a first Starter subscription", async () => {
    const caller = stripeRouter.createCaller(context);

    await caller.createCheckoutSession({
      plan: "starter",
      interval: "monthly",
      origin: "https://course360.app",
    });

    expect(checkoutCalls).toHaveLength(1);
    expect(checkoutCalls[0]).toMatchObject({
      mode: "subscription",
      payment_method_types: ["card"],
      payment_method_collection: "always",
      success_url: "https://course360.app/billing?success=1&plan=starter&trial=1",
      subscription_data: {
        trial_period_days: 14,
        metadata: { org_id: "41", plan: "starter" },
      },
    });
    expect(subscriptionUpserts).toEqual([]);
    expect(stripeWebhookSource).toContain('...(plan === "starter" ? { starterTrialClaimed: true } : {})');
  });

  it("does not grant repeat trials or apply the Starter trial to higher paid plans", async () => {
    const caller = stripeRouter.createCaller(context);

    subscription = { stripeSubscriptionId: "sub_existing", starterTrialClaimed: true };
    await caller.createCheckoutSession({
      plan: "starter",
      interval: "annual",
      origin: "https://course360.app",
    });
    expect(checkoutCalls[0]).toMatchObject({
      success_url: "https://course360.app/billing?success=1&plan=starter",
      subscription_data: { metadata: { org_id: "41", plan: "starter" } },
    });
    expect((checkoutCalls[0].subscription_data as Record<string, unknown>).trial_period_days).toBeUndefined();

    subscription = { stripeSubscriptionId: null, starterTrialClaimed: true };
    await caller.createCheckoutSession({
      plan: "starter",
      interval: "monthly",
      origin: "https://course360.app",
    });
    expect((checkoutCalls[1].subscription_data as Record<string, unknown>).trial_period_days).toBeUndefined();

    subscription = null;
    await caller.createCheckoutSession({
      plan: "builder",
      interval: "monthly",
      origin: "https://course360.app",
    });
    expect(checkoutCalls[2]).toMatchObject({
      success_url: "https://course360.app/billing?success=1&plan=builder",
      subscription_data: { metadata: { org_id: "41", plan: "builder" } },
    });
    expect((checkoutCalls[2].subscription_data as Record<string, unknown>).trial_period_days).toBeUndefined();
  });
});

afterAll(() => {
  (ENV as any).stripeSecretKey = originalStripeSecret;
});
