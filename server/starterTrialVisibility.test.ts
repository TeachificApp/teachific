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

import { parseApprovedPlatformSignupOrigin, stripeRouter } from "./stripeRouter";

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
const stripeWebhookSource = readFileSync(new URL("./stripeWebhookRoutes.ts", import.meta.url), "utf8");

const originalStripeSecret = ENV.stripeSecretKey;

describe("Course360 paid-plan trials and checkout-first school signup", () => {
  beforeEach(() => {
    checkoutCalls.splice(0);
    subscriptionUpserts.splice(0);
    subscription = null;
    (ENV as any).stripeSecretKey = "sk_test_platform_trial";
    vi.clearAllMocks();
  });

  it("hides the Free offer while presenting every paid plan as a card-backed 14-day trial", () => {
    expect(landingSource).not.toContain('name: "Free"');
    expect(landingSource).not.toContain('>Free</th>');
    expect(landingSource).not.toContain("Sign up free");
    expect(landingSource).toContain("Every paid plan begins with a 14-day card-backed trial");
    expect(landingSource).toContain('`/register?plan=${tier.name.toLowerCase()}`');
    expect(registerSource).toContain("14-day trial on every paid plan");
    expect(registerSource).toContain("createPlatformTrialCheckout");
    expect(registerSource).toContain("A card is required now");
    expect(registerSource).not.toContain("Create account & start trial");
    expect(registerSource).toContain("COURSE360_PLATFORM_LOGO_URL");
    expect(loginSource).not.toContain("Start for free");
    expect(loginSource).toContain("Start 14-day trial");
    expect(billingSource).toContain('const plans: PlanTier[] = ["starter", "builder", "pro", "enterprise"];');
    expect(billingSource).toContain('currentPlan === "free" ? "Legacy Access"');
    expect(billingSource).not.toContain("Always Free");
    expect(creatorLandingSource).not.toContain("Start Building for Free");
    expect(creatorLandingSource).toContain("Start 14-Day Trial");
    expect(studioDashboardSource).not.toContain("Start free — no credit card required");
    expect(pageBuilderSource).not.toContain("Create your free account");
    expect(wysiwygPageBuilderSource).not.toContain("Create your free account");
    expect(customAuthSource).toContain("Start a new Course360 school by choosing a paid plan and completing secure checkout first.");
    expect(customAuthSource).toContain("resolvePublicOrganizationScope(");
    expect(customAuthSource).toContain("ctx.req,");
    expect(subscriptionSchemaSource).toContain('starterTrialClaimed: boolean("starterTrialClaimed").default(false).notNull()');
    expect(subscriptionSchemaSource).toContain('platformTrialSignupFulfillments');
  });

  it("starts checkout-first signup with card collection and a 14-day trial for the selected paid plan", async () => {
    const caller = stripeRouter.createCaller({ user: null } as any);

    await caller.createPlatformTrialCheckout({
      name: "New School Owner",
      email: "owner@example.test",
      plan: "pro",
      interval: "annual",
      origin: "https://course360.app",
      blueprintInstallToken: "a".repeat(64),
    });

    expect(checkoutCalls).toHaveLength(1);
    expect(checkoutCalls[0]).toMatchObject({
      mode: "subscription",
      payment_method_types: ["card"],
      payment_method_collection: "always",
      customer_email: "owner@example.test",
      success_url: "https://course360.app/account-setup?checkout=platform_trial&session_id={CHECKOUT_SESSION_ID}",
      metadata: {
        type: "platform_trial_signup",
        signup_name: "New School Owner",
        signup_email: "owner@example.test",
        plan: "pro",
        interval: "annual",
        blueprint_install_token: "a".repeat(64),
      },
      subscription_data: {
        trial_period_days: 14,
        metadata: { type: "platform_trial_signup", plan: "pro", interval: "annual" },
      },
    });
  });

  it("does not permit public school-owner signup to return through a tenant domain", () => {
    expect(parseApprovedPlatformSignupOrigin("https://course360.app")).toBe("https://course360.app");
    expect(parseApprovedPlatformSignupOrigin("https://northwind.course360.app")).toBeNull();
  });

  it("applies a first paid-plan trial to Starter, Builder, and Pro, but never repeats it", async () => {
    const caller = stripeRouter.createCaller(context);

    for (const plan of ["starter", "builder", "pro"] as const) {
      subscription = null;
      await caller.createCheckoutSession({ plan, interval: "monthly", origin: "https://course360.app" });
      const checkout = checkoutCalls.at(-1)!;
      expect(checkout).toMatchObject({
        success_url: `https://course360.app/billing?success=1&plan=${plan}&trial=1`,
        subscription_data: {
          trial_period_days: 14,
          metadata: { org_id: "41", plan },
        },
      });
    }

    subscription = { stripeSubscriptionId: "sub_existing", starterTrialClaimed: true };
    await caller.createCheckoutSession({ plan: "pro", interval: "annual", origin: "https://course360.app" });
    const repeatCheckout = checkoutCalls.at(-1)!;
    expect(repeatCheckout).toMatchObject({
      success_url: "https://course360.app/billing?success=1&plan=pro",
      subscription_data: { metadata: { org_id: "41", plan: "pro" } },
    });
    expect((repeatCheckout.subscription_data as Record<string, unknown>).trial_period_days).toBeUndefined();
    expect(subscriptionUpserts).toEqual([]);
  });

  it("fulfills platform signup only from the completed Stripe webhook and marks every first paid plan as claimed", () => {
    const completedSessionHandler = stripeWebhookSource.slice(
      stripeWebhookSource.indexOf('case "checkout.session.completed"'),
      stripeWebhookSource.indexOf("// ── Native physical-product purchase"),
    );
    expect(completedSessionHandler).toContain('session.metadata?.type === "platform_trial_signup"');
    expect(completedSessionHandler).toContain("await fulfillPlatformTrialSignup(session)");
    expect(stripeWebhookSource).toContain("platformTrialSignupFulfillments");
    expect(stripeWebhookSource).toContain("stripeCheckoutSessionId");
    expect(stripeWebhookSource).toContain("starterTrialClaimed: true");
    expect(stripeWebhookSource).toContain("accountSetupHtml");
    expect(stripeWebhookSource).toContain("trialActivatedHtml");
    expect(stripeWebhookSource).toContain("Failed to attach platform trial subscription metadata");
    expect(stripeWebhookSource).toContain("org_id: String(result.orgId)");
    expect(stripeWebhookSource).toContain("async function resolveSubscriptionOrgId");
    expect(stripeWebhookSource).toContain("eq(orgSubscriptions.stripeSubscriptionId, subscription.id)");
    expect(stripeWebhookSource).not.toContain('...(plan === "starter" ? { starterTrialClaimed: true } : {})');
  });
});

afterAll(() => {
  (ENV as any).stripeSecretKey = originalStripeSecret;
});
