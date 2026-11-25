/**
 * Course360 Platform Subscription Plans
 * Defines plan limits and manages Stripe products/prices.
 */
import Stripe from "stripe";
import { COURSE360_PRICES, course360StripeCents } from "../shared/course360Pricing";
import { ENV } from "./_core/env";
import {
  getPaymentDeploymentReadiness,
  stripeCredentialMode,
} from "./lib/paymentDeploymentReadiness";

// ─── Teachific Pay feature flag ─────────────────────────────────────────────
// Set to true only when Teachific Pay has completed testing and is ready for
// public launch. While false, all orgs use their own Stripe gateway and no
// platform fee is applied. This flag gates UI visibility only — the server
// router and DB tables remain intact for internal testing.
export const TEACHIFIC_PAY_ENABLED = false;

// ─── Plan Limits ─────────────────────────────────────────────────────────────
export type PlanTier = "free" | "starter" | "builder" | "pro" | "enterprise";
// App access tiers: none = no access, web = web app only, desktop = desktop app only, bundle = web + desktop
export type AppAccessTier = "none" | "web" | "desktop" | "bundle";

export interface PlanLimits {
  name: string;
  tier: PlanTier;
  // Pricing (USD cents)
  monthlyPrice: number | null; // null = contact sales
  annualPrice: number | null;
  // Limits (-1 = unlimited, 0 = not available)
  maxAdmins: number;
  maxMembers: number;
  maxCourses: number;
  maxCommunities: number;
  maxInstructors: number;
  maxStorageBytes: number; // -1 = unlimited
  maxMembershipTiers: number;
  // Features (boolean)
  whiteLabel: boolean;
  emailMarketing: boolean;
  transactionFeePercent: number; // legacy — kept for reference
  teachificPayFeePercent: number; // platform fee on TeachificPay transactions
  customGateway: boolean; // can use own Stripe/payment gateway
  groupRegistrations: boolean;
  deepAnalytics: boolean;
  affiliatePlatform: boolean;
  sso: boolean;
  customCss: boolean;
  customDomain: boolean;
  communityAccess: boolean;
  revenueShare: boolean;
  onboardingTeam: boolean;
  blueprintAccess: "none" | "install" | "create" | "marketplace";
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    name: "Free",
    tier: "free",
    monthlyPrice: 0,
    annualPrice: 0,
    maxAdmins: 1,
    maxMembers: 10,
    maxCourses: 1,
    maxCommunities: 0,
    maxInstructors: 0, // admin is only instructor
    maxStorageBytes: 100 * 1024 * 1024 * 1024, // 100 GB
    maxMembershipTiers: 0,
    whiteLabel: false,
    emailMarketing: false,
    transactionFeePercent: 0,
    teachificPayFeePercent: 2, // 2% TeachificPay fee (internal test mode only)
    customGateway: true, // all plans use own Stripe gateway while TEACHIFIC_PAY_ENABLED=false
    groupRegistrations: false,
    deepAnalytics: false,
    affiliatePlatform: false,
    sso: false,
    customCss: false,
    customDomain: false,
    communityAccess: false,
    revenueShare: false,
    onboardingTeam: false,
    blueprintAccess: "none",
  },
  starter: {
    name: "Starter",
    tier: "starter",
    monthlyPrice: course360StripeCents(COURSE360_PRICES.starter.monthly),
    annualPrice: course360StripeCents(COURSE360_PRICES.starter.annual),
    maxAdmins: 1,
    maxMembers: 1000,
    maxCourses: 5,
    maxCommunities: 0,
    maxInstructors: 1,
    maxStorageBytes: 1024 * 1024 * 1024 * 1024, // 1 TB
    maxMembershipTiers: 1,
    whiteLabel: false,
    emailMarketing: false,
    transactionFeePercent: 3,
    teachificPayFeePercent: 1, // 1% TeachificPay fee (internal test mode only)
    customGateway: true, // all plans use own Stripe gateway while TEACHIFIC_PAY_ENABLED=false
    groupRegistrations: false,
    deepAnalytics: false,
    affiliatePlatform: false,
    sso: false,
    customCss: false,
    customDomain: false,
    communityAccess: false,
    revenueShare: false,
    onboardingTeam: false,
    blueprintAccess: "none",
  },
  builder: {
    name: "Builder",
    tier: "builder",
    monthlyPrice: course360StripeCents(COURSE360_PRICES.builder.monthly),
    annualPrice: course360StripeCents(COURSE360_PRICES.builder.annual),
    maxAdmins: 1,
    maxMembers: 5000,
    maxCourses: 20,
    maxCommunities: 1,
    maxInstructors: 3,
    maxStorageBytes: 2 * 1024 * 1024 * 1024 * 1024, // 2 TB
    maxMembershipTiers: 3,
    whiteLabel: false,
    emailMarketing: false,
    transactionFeePercent: 1,
    teachificPayFeePercent: 0.5, // 0.5% TeachificPay fee (internal test mode only)
    customGateway: true, // all plans use own Stripe gateway while TEACHIFIC_PAY_ENABLED=false
    groupRegistrations: false,
    deepAnalytics: false, // basic analytics only
    affiliatePlatform: false,
    sso: false,
    customCss: false,
    customDomain: true,
    communityAccess: true,
    revenueShare: false,
    onboardingTeam: false,
    blueprintAccess: "install",
  },
  pro: {
    name: "Pro",
    tier: "pro",
    monthlyPrice: course360StripeCents(COURSE360_PRICES.pro.monthly),
    annualPrice: course360StripeCents(COURSE360_PRICES.pro.annual),
    maxAdmins: 3,
    maxMembers: 15000,
    maxCourses: 50,
    maxCommunities: 3,
    maxInstructors: 10,
    maxStorageBytes: 5 * 1024 * 1024 * 1024 * 1024, // 5 TB
    maxMembershipTiers: 10,
    whiteLabel: true,
    emailMarketing: true,
    transactionFeePercent: 0,
    teachificPayFeePercent: 0, // 0% fee on Pro — revenue from subscription
    customGateway: true, // Pro can use own gateway or TeachificPay
    groupRegistrations: true,
    deepAnalytics: true,
    affiliatePlatform: true,
    sso: true,
    customCss: true,
    customDomain: true,
    communityAccess: true,
    revenueShare: true,
    onboardingTeam: false,
    blueprintAccess: "create",
  },
  enterprise: {
    name: "Enterprise",
    tier: "enterprise",
    monthlyPrice: null, // contact sales
    annualPrice: null,
    maxAdmins: -1,
    maxMembers: -1,
    maxCourses: -1,
    maxCommunities: -1,
    maxInstructors: -1,
    maxStorageBytes: -1, // Unlimited
    maxMembershipTiers: -1,
    whiteLabel: true,
    emailMarketing: true,
    transactionFeePercent: 0,
    teachificPayFeePercent: 0, // 0% fee on Enterprise — revenue from subscription
    customGateway: true, // Enterprise can use own gateway or TeachificPay
    groupRegistrations: true,
    deepAnalytics: true,
    affiliatePlatform: true,
    sso: true,
    customCss: true,
    customDomain: true,
    communityAccess: true,
    revenueShare: true,
    onboardingTeam: true,
    blueprintAccess: "marketplace",
  },
};

// ─── Stripe Client ────────────────────────────────────────────────────────────
let stripeClient: Stripe | null = null;
export function getPlatformStripeSecretKey() {
  return process.env.COURSE360_STRIPE_SECRET_KEY?.trim() || ENV.stripeSecretKey;
}
export function getPlatformStripePublishableKey() {
  return (
    process.env.VITE_COURSE360_STRIPE_PUBLISHABLE_KEY?.trim() ||
    ENV.stripePublishableKey
  );
}
export function getPlatformPaymentReadiness() {
  const configuredHost =
    process.env.APP_URL ||
    process.env.VITE_APP_URL ||
    process.env.RAILWAY_PUBLIC_DOMAIN ||
    "";
  const preview =
    /(?:^|[./])(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)|\.(?:manus\.computer|manus\.space)(?::\d+)?(?:\/|$)/.test(
      configuredHost
    );
  return getPaymentDeploymentReadiness({
    secretKey: getPlatformStripeSecretKey(),
    publishableKey: getPlatformStripePublishableKey(),
    webhookSecret:
      process.env.COURSE360_STRIPE_WEBHOOK_SECRET?.trim() ||
      ENV.stripeWebhookSecret,
    requireLive: ENV.isProduction && !preview,
  });
}
export function getStripe(): Stripe {
  const secretKey = getPlatformStripeSecretKey();
  if (!secretKey)
    throw new Error("Course360 Stripe payments are not configured");
  if (ENV.isProduction && !getPlatformPaymentReadiness().ready) {
    throw new Error(
      "Course360 payments are unavailable until deployment Stripe credentials and webhook signing configuration are ready"
    );
  }
  if (!stripeClient)
    stripeClient = new Stripe(secretKey, {
      apiVersion: "2025-03-31.basil" as NonNullable<
        ConstructorParameters<typeof Stripe>[1]
      >["apiVersion"],
    });
  return stripeClient;
}

// ─── Stripe Price IDs ─────────────────────────────────────────────────────────
// These are populated at server startup via ensureStripePlans()
export const STRIPE_PRICE_IDS: Record<string, string> = {};

async function syncStripeProductDisplay(
  stripe: Stripe,
  product: Stripe.Product,
  plan: { name: string; description: string },
  allowWrites = true
): Promise<Stripe.Product> {
  if (!allowWrites) return product;
  if (product.name === plan.name && product.description === plan.description) return product;
  return stripe.products.update(product.id, { name: plan.name, description: plan.description });
}

export function matchesCourse360CatalogPrice(
  price: Stripe.Price,
  amountCents: number,
  interval: "month" | "year",
  metadataKey: string,
  metadataValue: string
) {
  return (
    price.active &&
    price.currency === "usd" &&
    price.unit_amount === amountCents &&
    price.billing_scheme === "per_unit" &&
    price.recurring?.interval === interval &&
    price.recurring.interval_count === 1 &&
    price.recurring.usage_type === "licensed" &&
    price.metadata?.[metadataKey] === metadataValue
  );
}

async function listCatalogPages<T extends { id: string }>(
  list: (startingAfter?: string) => Promise<{ data: T[]; has_more: boolean }>
): Promise<T[]> {
  const rows: T[] = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await list(cursor);
    rows.push(...page.data);
    if (!page.has_more) return rows;
    const next = page.data.at(-1)?.id;
    if (!next || next === cursor)
      throw new Error("Stripe catalog pagination did not advance");
    cursor = next;
  }
}
function requireCatalogWrite(allowWrites: boolean, key: string) {
  if (!allowWrites)
    throw new Error(
      `Course360 catalog requires an approved exact USD price for ${key}; live/production reconciliation is read-only`
    );
}

/**
 * Idempotently create Stripe products and prices for all paid plans.
 * Stores price IDs in STRIPE_PRICE_IDS for use in checkout sessions.
 */
export async function ensureStripePlans(): Promise<void> {
  if (!getPlatformStripeSecretKey()) {
    console.log("[Stripe] No secret key configured, skipping plan setup");
    return;
  }
  if (ENV.isProduction && !getPlatformPaymentReadiness().ready) {
    for (const key of Object.keys(STRIPE_PRICE_IDS))
      delete STRIPE_PRICE_IDS[key];
    console.warn(
      "[Stripe] Payments disabled: deployment Stripe configuration is not ready"
    );
    return;
  }
  const allowWrites =
    !ENV.isProduction &&
    stripeCredentialMode(getPlatformStripeSecretKey(), "secret") === "test";
  const stripe = getStripe();
  const nextPriceIds: Record<string, string> = {};
  const productCatalog = await listCatalogPages(starting_after =>
    stripe.products.list({
      limit: 100,
      ...(starting_after ? { starting_after } : {}),
    })
  );
  const paidPlans: PlanTier[] = ["starter", "builder", "pro"];

  for (const tier of paidPlans) {
    const plan = PLAN_LIMITS[tier];
    if (!plan.monthlyPrice || !plan.annualPrice) continue;

    // Find or create product
    let product = productCatalog.find(
      p => p.active && p.metadata?.teachific_tier === tier
    );
    const productDisplay = {
      name: `Course360 ${plan.name}`,
      description: `Course360 ${plan.name} plan`,
    };
    if (!product) {
      requireCatalogWrite(allowWrites, plan.name);
      product = await stripe.products.create({
        ...productDisplay,
        metadata: { teachific_tier: tier },
      });
    } else {
      product = await syncStripeProductDisplay(
        stripe,
        product,
        productDisplay,
        allowWrites
      );
    }

    // Monthly price
    const monthlyKey = `${tier}_monthly`;
    const productId = product.id;
    const existingPrices = await listCatalogPages(starting_after =>
      stripe.prices.list({
        product: productId,
        limit: 100,
        ...(starting_after ? { starting_after } : {}),
      })
    );
    let monthlyPrice = existingPrices.find(p =>
      matchesCourse360CatalogPrice(
        p,
        plan.monthlyPrice!,
        "month",
        "teachific_tier",
        tier
      )
    );
    if (!monthlyPrice) {
      requireCatalogWrite(allowWrites, `${plan.name} monthly`);
      monthlyPrice = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.monthlyPrice,
        currency: "usd",
        recurring: { interval: "month" },
        metadata: { teachific_tier: tier, interval: "monthly" },
      });
    }
    nextPriceIds[monthlyKey] = monthlyPrice.id;

    // Annual price
    const annualKey = `${tier}_annual`;
    let annualPrice = existingPrices.find(p =>
      matchesCourse360CatalogPrice(
        p,
        plan.annualPrice!,
        "year",
        "teachific_tier",
        tier
      )
    );
    if (!annualPrice) {
      requireCatalogWrite(allowWrites, `${plan.name} annual`);
      annualPrice = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.annualPrice,
        currency: "usd",
        recurring: { interval: "year" },
        metadata: { teachific_tier: tier, interval: "annual" },
      });
    }
    nextPriceIds[annualKey] = annualPrice.id;
  }

  // ── Course360 Studio™ — Web + Desktop plans ────────────────────────────────────
  const studioAppPlans: Record<"web" | "desktop" | "bundle", { name: string; monthlyPrice: number; annualPrice: number; description: string }> = {
    web:     { name: "Course360 Studio™ Web",    monthlyPrice: course360StripeCents(COURSE360_PRICES.studio_web.monthly), annualPrice: course360StripeCents(COURSE360_PRICES.studio_web.annual), description: "Course360 Studio™ Web — browser-based editing, CC styling, transcript editing" },
    desktop: { name: "Course360 Studio™ Desktop", monthlyPrice: course360StripeCents(COURSE360_PRICES.studio_desktop.monthly), annualPrice: course360StripeCents(COURSE360_PRICES.studio_desktop.annual), description: "Course360 Studio™ Desktop — full desktop app, HD MP4 export, multi-track editing" },
    bundle:  { name: "Course360 Studio™ Bundle",  monthlyPrice: course360StripeCents(COURSE360_PRICES.studio_bundle.monthly), annualPrice: course360StripeCents(COURSE360_PRICES.studio_bundle.annual), description: "Course360 Studio™ Bundle — Web + Desktop apps" },
  };
  for (const [tier, plan] of Object.entries(studioAppPlans) as ["web"|"desktop"|"bundle", typeof studioAppPlans["web"]][]) {
    const productKey = `studio_${tier}`;
    let product = productCatalog.find(
      p => p.active && p.metadata?.product_key === productKey
    );
    if (!product) {
      requireCatalogWrite(allowWrites, plan.name);
      product = await stripe.products.create({
        name: plan.name, description: plan.description,
        metadata: { product_key: productKey, product_type: "studio", access_tier: tier },
      });
    } else {
      product = await syncStripeProductDisplay(
        stripe,
        product,
        plan,
        allowWrites
      );
    }
    const productId = product.id;
    const existingPrices = await listCatalogPages(starting_after =>
      stripe.prices.list({
        product: productId,
        limit: 100,
        ...(starting_after ? { starting_after } : {}),
      })
    );
    let monthlyPrice = existingPrices.find(p =>
      matchesCourse360CatalogPrice(
        p,
        plan.monthlyPrice,
        "month",
        "product_key",
        productKey
      )
    );
    if (!monthlyPrice) {
      requireCatalogWrite(allowWrites, `${plan.name} monthly`);
      monthlyPrice = await stripe.prices.create({
        product: product.id, unit_amount: plan.monthlyPrice, currency: "usd",
        recurring: { interval: "month" },
        metadata: { product_key: productKey, interval: "monthly", product_type: "studio", access_tier: tier },
      });
    }
    nextPriceIds[`studio_${tier}_monthly`] = monthlyPrice.id;
    let annualPrice = existingPrices.find(p =>
      matchesCourse360CatalogPrice(
        p,
        plan.annualPrice,
        "year",
        "product_key",
        productKey
      )
    );
    if (!annualPrice) {
      requireCatalogWrite(allowWrites, `${plan.name} annual`);
      annualPrice = await stripe.prices.create({
        product: product.id, unit_amount: plan.annualPrice, currency: "usd",
        recurring: { interval: "year" },
        metadata: { product_key: productKey, interval: "annual", product_type: "studio", access_tier: tier },
      });
    }
    nextPriceIds[`studio_${tier}_annual`] = annualPrice.id;
  }

  // ── Course360 Creator™ — Web + Desktop plans ─────────────────────────────────────
  const creatorAppPlans: Record<"web" | "desktop" | "bundle", { name: string; monthlyPrice: number; annualPrice: number; description: string }> = {
    web:     { name: "Course360 Creator™ Web",    monthlyPrice: course360StripeCents(COURSE360_PRICES.creator_web.monthly),  annualPrice: course360StripeCents(COURSE360_PRICES.creator_web.annual),  description: "Course360 Creator™ Web — browser-based SCORM authoring, branching scenarios, AI content generation" },
    desktop: { name: "Course360 Creator™ Desktop", monthlyPrice: course360StripeCents(COURSE360_PRICES.creator_desktop.monthly), annualPrice: course360StripeCents(COURSE360_PRICES.creator_desktop.annual),  description: "Course360 Creator™ Desktop — full desktop authoring suite" },
    bundle:  { name: "Course360 Creator™ Bundle",  monthlyPrice: course360StripeCents(COURSE360_PRICES.creator_bundle.monthly), annualPrice: course360StripeCents(COURSE360_PRICES.creator_bundle.annual), description: "Course360 Creator™ Bundle — Web + Desktop apps" },
  };
  for (const [tier, plan] of Object.entries(creatorAppPlans) as ["web"|"desktop"|"bundle", typeof creatorAppPlans["web"]][]) {
    const productKey = `creator_${tier}`;
    let product = productCatalog.find(
      p => p.active && p.metadata?.product_key === productKey
    );
    if (!product) {
      requireCatalogWrite(allowWrites, plan.name);
      product = await stripe.products.create({
        name: plan.name, description: plan.description,
        metadata: { product_key: productKey, product_type: "creator", access_tier: tier },
      });
    } else {
      product = await syncStripeProductDisplay(
        stripe,
        product,
        plan,
        allowWrites
      );
    }
    const productId = product.id;
    const existingPrices = await listCatalogPages(starting_after =>
      stripe.prices.list({
        product: productId,
        limit: 100,
        ...(starting_after ? { starting_after } : {}),
      })
    );
    let monthlyPrice = existingPrices.find(p =>
      matchesCourse360CatalogPrice(
        p,
        plan.monthlyPrice,
        "month",
        "product_key",
        productKey
      )
    );
    if (!monthlyPrice) {
      requireCatalogWrite(allowWrites, `${plan.name} monthly`);
      monthlyPrice = await stripe.prices.create({
        product: product.id, unit_amount: plan.monthlyPrice, currency: "usd",
        recurring: { interval: "month" },
        metadata: { product_key: productKey, interval: "monthly", product_type: "creator", access_tier: tier },
      });
    }
    nextPriceIds[`creator_${tier}_monthly`] = monthlyPrice.id;
    let annualPrice = existingPrices.find(p =>
      matchesCourse360CatalogPrice(
        p,
        plan.annualPrice,
        "year",
        "product_key",
        productKey
      )
    );
    if (!annualPrice) {
      requireCatalogWrite(allowWrites, `${plan.name} annual`);
      annualPrice = await stripe.prices.create({
        product: product.id, unit_amount: plan.annualPrice, currency: "usd",
        recurring: { interval: "year" },
        metadata: { product_key: productKey, interval: "annual", product_type: "creator", access_tier: tier },
      });
    }
    nextPriceIds[`creator_${tier}_annual`] = annualPrice.id;
  }

  // ── Course360 Quiz Creator™ — Web + Desktop plans ───────────────────────────────
  const quizCreatorAppPlans: Record<"web" | "desktop" | "bundle", { name: string; monthlyPrice: number; annualPrice: number; description: string }> = {
    web:     { name: "Course360 Quiz Creator™ Web",    monthlyPrice: course360StripeCents(COURSE360_PRICES.quiz_creator_web.monthly), annualPrice: course360StripeCents(COURSE360_PRICES.quiz_creator_web.annual), description: "Course360 Quiz Creator™ Web — browser-based quiz creation, 7 question types, LMS integration" },
    desktop: { name: "Course360 Quiz Creator™ Desktop", monthlyPrice: course360StripeCents(COURSE360_PRICES.quiz_creator_desktop.monthly), annualPrice: course360StripeCents(COURSE360_PRICES.quiz_creator_desktop.annual), description: "Course360 Quiz Creator™ Desktop — full desktop quiz authoring, AES-256 encrypted .quiz files" },
    bundle:  { name: "Course360 Quiz Creator™ Bundle",  monthlyPrice: course360StripeCents(COURSE360_PRICES.quiz_creator_bundle.monthly), annualPrice: course360StripeCents(COURSE360_PRICES.quiz_creator_bundle.annual), description: "Course360 Quiz Creator™ Bundle — Web + Desktop apps" },
  };
  for (const [tier, plan] of Object.entries(quizCreatorAppPlans) as ["web"|"desktop"|"bundle", typeof quizCreatorAppPlans["web"]][]) {
    const productKey = `quiz_creator_${tier}`;
    let product = productCatalog.find(
      p => p.active && p.metadata?.product_key === productKey
    );
    if (!product) {
      requireCatalogWrite(allowWrites, plan.name);
      product = await stripe.products.create({
        name: plan.name, description: plan.description,
        metadata: { product_key: productKey, product_type: "quiz_creator", access_tier: tier },
      });
    } else {
      product = await syncStripeProductDisplay(
        stripe,
        product,
        plan,
        allowWrites
      );
    }
    const productId = product.id;
    const existingPrices = await listCatalogPages(starting_after =>
      stripe.prices.list({
        product: productId,
        limit: 100,
        ...(starting_after ? { starting_after } : {}),
      })
    );
    let monthlyPrice = existingPrices.find(p =>
      matchesCourse360CatalogPrice(
        p,
        plan.monthlyPrice,
        "month",
        "product_key",
        productKey
      )
    );
    if (!monthlyPrice) {
      requireCatalogWrite(allowWrites, `${plan.name} monthly`);
      monthlyPrice = await stripe.prices.create({
        product: product.id, unit_amount: plan.monthlyPrice, currency: "usd",
        recurring: { interval: "month" },
        metadata: { product_key: productKey, interval: "monthly", product_type: "quiz_creator", access_tier: tier },
      });
    }
    nextPriceIds[`quiz_creator_${tier}_monthly`] = monthlyPrice.id;
    let annualPrice = existingPrices.find(p =>
      matchesCourse360CatalogPrice(
        p,
        plan.annualPrice,
        "year",
        "product_key",
        productKey
      )
    );
    if (!annualPrice) {
      requireCatalogWrite(allowWrites, `${plan.name} annual`);
      annualPrice = await stripe.prices.create({
        product: product.id, unit_amount: plan.annualPrice, currency: "usd",
        recurring: { interval: "year" },
        metadata: { product_key: productKey, interval: "annual", product_type: "quiz_creator", access_tier: tier },
      });
    }
    nextPriceIds[`quiz_creator_${tier}_annual`] = annualPrice.id;
  }

  Object.assign(STRIPE_PRICE_IDS, nextPriceIds);
    console.log("[Stripe] Plans initialized:", Object.keys(STRIPE_PRICE_IDS));
}
