/**
 * lmsCheckoutRouter.ts
 * Platform-hosted checkout page backend — fully polymorphic across:
 *   course | download | physical_product | webinar | membership | membership_plan
 *
 * Routers:
 *   lmsCheckoutPublicRouter  — getCheckoutPageDetails (includes order bumps + team pricing)
 *   lmsCheckoutLearnerRouter — createHostedCheckoutSession (seat count + bump line items),
 *                              confirmHostedCheckout
 *   lmsCheckoutAdminRouter   — getCheckoutPageConfig, saveCheckoutPageConfig,
 *                              listCheckoutTemplates, saveCheckoutTemplate,
 *                              deleteCheckoutTemplate, importCheckoutTemplate
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, eq, desc, or, isNull } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { ENV } from "../_core/env";
import {
  lmsCourses,
  lmsPricingOptions,
  lmsEnrollments,
  lmsOrders,
  lmsCheckoutPages,
  lmsCheckoutPageTemplates,
  platformSettings,
  organizations,
  digitalProducts,
  digitalProductPrices,
  digitalOrders,
  webinars,
  memberships,
  membershipPlans,
  physicalProducts,
  physicalProductPricingOptions,
  physicalProductOrders,
  orderBumps,
} from "../../drizzle/schema";
import { assertAdmin } from "./lmsHelpers";

// ─── Shared Types ─────────────────────────────────────────────────────────────

export const CONTENT_TYPES = ["course", "download", "physical_product", "webinar", "membership", "membership_plan"] as const;
export type ContentType = typeof CONTENT_TYPES[number];

export interface TrustBadge {
  id: string;
  icon: "shield" | "lock" | "star" | "check" | "award" | "refresh" | "zap";
  label: string;
  enabled: boolean;
}

export interface CheckoutSectionConfig {
  enabled: boolean;
  [key: string]: unknown;
}

export interface CheckoutPageConfig {
  header: CheckoutSectionConfig & {
    headline?: string;
    subheadline?: string;
    bgColor?: string;
    bgImageUrl?: string;
  };
  contentInfo: CheckoutSectionConfig & {
    showCoverImage?: boolean;
    showDescription?: boolean;
    showInstructor?: boolean;
    showLessonCount?: boolean;
    showSubtitle?: boolean;
  };
  trustBadges: CheckoutSectionConfig & {
    badges: TrustBadge[];
  };
  paymentForm: CheckoutSectionConfig & {
    submitButtonText?: string;
    showPromoCode?: boolean;
  };
  footer: CheckoutSectionConfig & {
    text?: string;
    links?: Array<{ label: string; url: string }>;
  };
  sectionsOrder: string[];
  primaryColor?: string;
  accentColor?: string;
  bgColor?: string;
}

const DEFAULT_TRUST_BADGES: TrustBadge[] = [
  { id: "secure",    icon: "lock",    label: "Secure Checkout",  enabled: true },
  { id: "guarantee", icon: "shield",  label: "30-Day Guarantee", enabled: true },
  { id: "instant",   icon: "zap",     label: "Instant Access",   enabled: true },
];

const DEFAULT_CONFIG: CheckoutPageConfig = {
  header: { enabled: true },
  contentInfo: {
    enabled: true,
    showCoverImage: true,
    showDescription: true,
    showInstructor: true,
    showLessonCount: true,
    showSubtitle: true,
  },
  trustBadges: { enabled: true, badges: DEFAULT_TRUST_BADGES },
  paymentForm: { enabled: true, submitButtonText: "Buy Now", showPromoCode: true },
  footer: { enabled: true, text: "" },
  sectionsOrder: ["header", "contentInfo", "trustBadges", "paymentForm", "footer"],
};

function parseConfig(row: any): CheckoutPageConfig {
  const base = JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as CheckoutPageConfig;
  if (row?.headerConfig)      try { base.header      = { ...base.header,      ...JSON.parse(row.headerConfig) }; }      catch {}
  if (row?.courseInfoConfig)  try { base.contentInfo  = { ...base.contentInfo, ...JSON.parse(row.courseInfoConfig) }; }  catch {}
  if (row?.trustBadgesConfig) try { base.trustBadges  = { ...base.trustBadges, ...JSON.parse(row.trustBadgesConfig) }; } catch {}
  if (row?.paymentFormConfig) try { base.paymentForm  = { ...base.paymentForm, ...JSON.parse(row.paymentFormConfig) }; } catch {}
  if (row?.footerConfig)      try { base.footer       = { ...base.footer,      ...JSON.parse(row.footerConfig) }; }      catch {}
  if (row?.sectionsOrder)     try { base.sectionsOrder = JSON.parse(row.sectionsOrder); }                                 catch {}
  if (row?.primaryColor) base.primaryColor = row.primaryColor;
  if (row?.accentColor)  base.accentColor  = row.accentColor;
  if (row?.bgColor)      base.bgColor      = row.bgColor;
  return base;
}

// ─── Content resolver helpers ─────────────────────────────────────────────────

async function resolveContentBySlug(db: any, contentType: ContentType, slug: string) {
  switch (contentType) {
    case "course": {
      const [row] = await db.select().from(lmsCourses).where(eq(lmsCourses.slug, slug)).limit(1);
      if (!row) return null;
      const pricingOptions = await db.select().from(lmsPricingOptions)
        .where(and(eq(lmsPricingOptions.courseId, row.id), eq(lmsPricingOptions.isActive, true)))
        .orderBy(lmsPricingOptions.sortOrder);
      return {
        id: row.id, orgId: row.orgId, slug: row.slug, title: row.title,
        subtitle: row.subtitle, description: row.description,
        coverImageUrl: row.coverImageUrl ?? row.thumbnailUrl,
        primaryColor: row.primaryColor ?? "#179ca3",
        accentColor: row.accentColor ?? "#0d9488",
        pricingType: row.pricingType,
        price: row.price, currency: row.currency ?? "usd",
        isFree: row.isFree, subscriptionInterval: row.subscriptionInterval,
        trialDays: row.trialDays, stripePriceId: row.stripePriceId,
        stripeProductId: row.stripeProductId,
        pricingOptions,
        isAvailable: row.status !== "draft" && row.status !== "archived",
      };
    }
    case "download": {
      const [row] = await db.select().from(digitalProducts).where(eq(digitalProducts.slug, slug)).limit(1);
      if (!row) return null;
      const prices = await db.select().from(digitalProductPrices)
        .where(and(eq(digitalProductPrices.productId, row.id), eq(digitalProductPrices.isActive, true)));
      const primaryPrice = prices[0];
      return {
        id: row.id, orgId: row.orgId, slug: row.slug, title: row.title,
        subtitle: null, description: row.description,
        coverImageUrl: row.thumbnailUrl,
        primaryColor: "#179ca3", accentColor: "#0d9488",
        pricingType: primaryPrice?.type === "one_time" ? "one_time" : "one_time",
        price: primaryPrice?.amount ?? "0", currency: primaryPrice?.currency ?? "usd",
        isFree: !primaryPrice || Number(primaryPrice.amount) === 0,
        subscriptionInterval: null, trialDays: null,
        stripePriceId: primaryPrice?.stripePriceId ?? null,
        stripeProductId: primaryPrice?.stripeProductId ?? null,
        pricingOptions: prices.map(p => ({ ...p, pricingType: p.type })),
        isAvailable: row.visibility === "published",
      };
    }
    case "physical_product": {
      const [row] = await db.select().from(physicalProducts).where(eq(physicalProducts.slug, slug)).limit(1);
      if (!row) return null;
      const options = await db.select().from(physicalProductPricingOptions)
        .where(and(eq(physicalProductPricingOptions.productId, row.id), eq(physicalProductPricingOptions.isActive, true)));
      const primaryOpt = options[0];
      return {
        id: row.id, orgId: row.orgId ?? 1, slug: row.slug, title: row.title,
        subtitle: null, description: row.description,
        coverImageUrl: row.coverImageUrl ?? row.thumbnailUrl,
        primaryColor: "#179ca3", accentColor: "#0d9488",
        pricingType: "one_time",
        price: primaryOpt?.price ?? "0", currency: "usd",
        isFree: !primaryOpt || Number(primaryOpt.price) === 0,
        subscriptionInterval: null, trialDays: null,
        stripePriceId: primaryOpt?.stripePriceId ?? null,
        stripeProductId: null,
        pricingOptions: options.map(o => ({ ...o, pricingType: o.pricingType })),
        isAvailable: row.status === "published",
      };
    }
    case "webinar": {
      const [row] = await db.select().from(webinars).where(eq(webinars.slug, slug)).limit(1);
      if (!row) return null;
      return {
        id: row.id, orgId: row.orgId, slug: row.slug, title: row.title,
        subtitle: null, description: row.description,
        coverImageUrl: row.thumbnailUrl,
        primaryColor: "#179ca3", accentColor: "#0d9488",
        pricingType: row.pricingType ?? "one_time",
        price: row.price ?? "0", currency: row.currency ?? "usd",
        isFree: row.pricingType === "free" || Number(row.price) === 0,
        subscriptionInterval: null, trialDays: null,
        stripePriceId: row.stripePriceId ?? null,
        stripeProductId: row.stripeProductId ?? null,
        pricingOptions: [],
        isAvailable: row.isPublished === true,
      };
    }
    case "membership": {
      const [row] = await db.select().from(memberships).where(eq(memberships.id, parseInt(slug))).limit(1);
      if (!row) return null;
      return {
        id: row.id, orgId: row.orgId, slug: String(row.id), title: row.name,
        subtitle: null, description: row.description,
        coverImageUrl: null,
        primaryColor: "#179ca3", accentColor: "#0d9488",
        pricingType: row.billingInterval === "one_time" ? "one_time" : "subscription",
        price: String(row.price), currency: "usd",
        isFree: Number(row.price) === 0,
        subscriptionInterval: row.billingInterval === "yearly" ? "annual" : "monthly",
        trialDays: row.trialDays ?? null,
        stripePriceId: row.stripePriceId ?? null,
        stripeProductId: row.stripeProductId ?? null,
        pricingOptions: [],
        isAvailable: row.isActive === true,
      };
    }
    case "membership_plan": {
      const [row] = await db.select().from(membershipPlans).where(eq(membershipPlans.id, parseInt(slug))).limit(1);
      if (!row) return null;
      return {
        id: row.id, orgId: row.orgId, slug: String(row.id), title: row.name,
        subtitle: null, description: row.description,
        coverImageUrl: null,
        primaryColor: "#179ca3", accentColor: "#0d9488",
        pricingType: "subscription",
        price: String(row.price), currency: "usd",
        isFree: Number(row.price) === 0,
        subscriptionInterval: row.billingInterval === "annual" ? "annual" : "monthly",
        trialDays: null,
        stripePriceId: row.stripePriceId ?? null,
        stripeProductId: row.stripeProductId ?? null,
        pricingOptions: [],
        isAvailable: true,
      };
    }
    default:
      return null;
  }
}

async function getCheckoutPageRow(db: any, contentType: ContentType, contentId: number) {
  const [row] = await db.select().from(lmsCheckoutPages)
    .where(and(
      eq(lmsCheckoutPages.contentType, contentType),
      eq(lmsCheckoutPages.contentId, contentId),
    )).limit(1);
  if (row) return row;
  // Fallback: legacy courseId lookup for courses
  if (contentType === "course") {
    const [legacy] = await db.select().from(lmsCheckoutPages)
      .where(eq(lmsCheckoutPages.courseId, contentId)).limit(1);
    return legacy ?? null;
  }
  return null;
}

/**
 * Fetch active order bumps for a content item.
 * Returns bumps where pricingOptionId IS NULL (global) OR matches the given pricingOptionId.
 * The frontend filters further based on the selected tier.
 */
async function fetchOrderBumps(db: any, contentType: ContentType, contentId: number) {
  // Map content type to orderBumps triggerProductType enum values
  const triggerType = contentType === "course" ? "course"
    : contentType === "download" ? "download"
    : null; // physical_product, webinar, membership, membership_plan not yet in enum
  if (!triggerType) return [];

  const bumps = await db.select().from(orderBumps)
    .where(and(
      eq(orderBumps.triggerProductType, triggerType as any),
      eq(orderBumps.triggerProductId, contentId),
      eq(orderBumps.isActive, true),
    ))
    .orderBy(orderBumps.sortOrder);

  return bumps.map((b: any) => ({
    id: b.id,
    name: b.name,
    headline: b.headline ?? null,
    description: b.description ?? null,
    imageUrl: b.imageUrl ?? null,
    bumpProductType: b.bumpProductType,
    bumpProductId: b.bumpProductId,
    placement: b.placement,
    discountPercent: b.discountPercent ?? 0,
    discountedPrice: b.discountedPrice ?? null,
    buttonText: b.buttonText ?? "Add to Order",
    declineText: b.declineText ?? "No thanks",
    // Per-tier targeting: null = show for all tiers
    pricingOptionId: b.pricingOptionId ?? null,
  }));
}

// ─── Public Router ────────────────────────────────────────────────────────────

export const lmsCheckoutPublicRouter = router({
  /** Returns all data needed to render the hosted checkout page for any content type.
   *  Includes: pricing tiers (with team pricing fields), order bumps (with per-tier targeting),
   *  checkout page config, and org info.
   */
  getCheckoutPageDetails: publicProcedure
    .input(z.object({
      contentType: z.enum(CONTENT_TYPES),
      slug: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const content = await resolveContentBySlug(db, input.contentType, input.slug);
      if (!content) throw new TRPCError({ code: "NOT_FOUND", message: "Content not found" });
      if (!content.isAvailable) throw new TRPCError({ code: "NOT_FOUND", message: "Content not available" });

      // Fetch org
      const [org] = await db.select().from(organizations)
        .where(eq(organizations.id, content.orgId)).limit(1);

      // Platform settings for terms/privacy fallback
      const [settings] = await db.select().from(platformSettings).limit(1);

      // Checkout page config
      const checkoutPageRow = await getCheckoutPageRow(db, input.contentType, content.id);
      const checkoutConfig = parseConfig(checkoutPageRow ?? null);

      // Order bumps (placement: during_checkout)
      const bumps = await fetchOrderBumps(db, input.contentType, content.id);

      // Check if user already has access
      let hasAccess = false;
      if (ctx.user && input.contentType === "course") {
        const [existing] = await db.select({ id: lmsEnrollments.id })
          .from(lmsEnrollments)
          .where(and(eq(lmsEnrollments.userId, ctx.user.id), eq(lmsEnrollments.courseId, content.id)))
          .limit(1);
        hasAccess = !!existing;
      }

      // Enrich pricing options with team pricing fields (already in DB columns)
      const enrichedPricingOptions = (content.pricingOptions as any[]).map((opt: any) => ({
        ...opt,
        isTeamPricing: opt.isTeamPricing ?? false,
        minSeats: opt.minSeats ?? 2,
        maxSeats: opt.maxSeats ?? 100,
        perSeatPrice: opt.perSeatPrice ?? null,
        teamStripePriceId: opt.teamStripePriceId ?? null,
      }));

      return {
        content: {
          id: content.id,
          slug: content.slug,
          title: content.title,
          subtitle: content.subtitle ?? null,
          description: content.description ?? null,
          coverImageUrl: content.coverImageUrl ?? null,
          primaryColor: content.primaryColor,
          accentColor: content.accentColor,
          pricingType: content.pricingType,
          price: content.price,
          currency: content.currency,
          isFree: content.isFree,
          subscriptionInterval: content.subscriptionInterval ?? null,
          trialDays: content.trialDays ?? null,
          orgId: content.orgId,
        },
        pricingOptions: enrichedPricingOptions,
        orderBumps: bumps,
        org: org ? {
          id: org.id,
          name: org.name,
          logoUrl: org.logoUrl ?? null,
          termsUrl: (settings as any)?.termsUrl ?? null,
          privacyUrl: (settings as any)?.privacyUrl ?? null,
          termsOfService: org.termsOfService ?? (settings as any)?.termsOfService ?? null,
          privacyPolicy: org.privacyPolicy ?? (settings as any)?.privacyPolicy ?? null,
        } : null,
        checkoutConfig,
        hasAccess,
        contentType: input.contentType,
      };
    }),
});

// ─── Learner Router ───────────────────────────────────────────────────────────

export const lmsCheckoutLearnerRouter = router({
  /** Create a Stripe Checkout Session for any content type.
   *  Supports: seat count (team pricing), order bump add-ons (multi-line-item).
   */
  createHostedCheckoutSession: protectedProcedure
    .input(z.object({
      contentType: z.enum(CONTENT_TYPES),
      slug: z.string(),
      pricingOptionId: z.number().optional(),
      origin: z.string(),
      promoCode: z.string().optional(),
      // Team / group purchase
      seatCount: z.number().min(1).max(500).optional(),
      // Order bump add-ons: array of bump IDs the user opted into
      selectedBumpIds: z.array(z.number()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const content = await resolveContentBySlug(db, input.contentType, input.slug);
      if (!content) throw new TRPCError({ code: "NOT_FOUND", message: "Content not found" });

      // Resolve effective pricing
      let effectivePrice = Number(content.price);
      let pricingType = content.pricingType;
      let effectiveStripePriceId = content.stripePriceId;
      let effectiveSubscriptionInterval = content.subscriptionInterval;
      let effectiveTrialDays = content.trialDays;
      let isTeamPricing = false;
      let minSeats = 2;
      let maxSeats = 100;
      let perSeatPrice: number | null = null;
      let teamStripePriceId: string | null = null;

      if (input.pricingOptionId && content.pricingOptions.length > 0) {
        const opt = content.pricingOptions.find((o: any) => o.id === input.pricingOptionId) as any;
        if (opt) {
          effectivePrice = Number(opt.price ?? opt.amount ?? 0);
          pricingType = (opt.pricingType ?? opt.type) as string;
          effectiveStripePriceId = opt.stripePriceId ?? null;
          effectiveSubscriptionInterval = opt.subscriptionInterval ?? opt.billingInterval ?? null;
          isTeamPricing = opt.isTeamPricing ?? false;
          minSeats = opt.minSeats ?? 2;
          maxSeats = opt.maxSeats ?? 100;
          perSeatPrice = opt.perSeatPrice ? Number(opt.perSeatPrice) : null;
          teamStripePriceId = opt.teamStripePriceId ?? null;
        }
      }

      // Determine seat count for team pricing
      const seatCount = isTeamPricing ? Math.max(minSeats, Math.min(maxSeats, input.seatCount ?? minSeats)) : 1;
      // Per-seat price overrides base price for team tiers
      const unitPrice = isTeamPricing && perSeatPrice ? perSeatPrice : effectivePrice;

      // Free path
      if (pricingType === "free" || (unitPrice === 0 && !isTeamPricing)) {
        await grantAccess(db, input.contentType, content, ctx.user.id, null, seatCount);
        return { type: "free" as const, slug: content.slug, contentType: input.contentType };
      }

      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(ENV.stripeSecretKey, { apiVersion: "2024-06-20" as any });

      const successUrl = `${input.origin}/checkout/complete?session_id={CHECKOUT_SESSION_ID}&content_type=${input.contentType}&slug=${content.slug}`;
      const cancelUrl  = `${input.origin}/checkout/${input.contentType}/${content.slug}`;

      const commonMeta: Record<string, string> = {
        user_id:      ctx.user.id.toString(),
        content_type: input.contentType,
        content_id:   content.id.toString(),
        content_slug: content.slug,
        pricing_type: pricingType,
        seat_count:   seatCount.toString(),
        trigger_order_type: "lms_hosted_checkout",
        ...(input.pricingOptionId ? { pricing_option_id: input.pricingOptionId.toString() } : {}),
        ...(input.selectedBumpIds?.length ? { selected_bump_ids: input.selectedBumpIds.join(",") } : {}),
      };

      // Promo code
      let discounts: Array<{ promotion_code: string }> | undefined;
      if (input.promoCode) {
        try {
          const codes = await stripe.promotionCodes.list({ code: input.promoCode.toUpperCase(), active: true, limit: 1 });
          if (codes.data[0]) discounts = [{ promotion_code: codes.data[0].id }];
        } catch {}
      }
      const promoOpts = discounts ? { discounts } : { allow_promotion_codes: true };

      // ── Build line items ──────────────────────────────────────────────────
      const lineItems: any[] = [];

      if (pricingType === "one_time" || pricingType === "payment_plan") {
        lineItems.push({
          price_data: {
            currency: content.currency,
            product_data: {
              name: isTeamPricing
                ? `${content.title} — Team License (${seatCount} seats)`
                : content.title,
              description: content.subtitle ?? undefined,
            },
            unit_amount: Math.round(unitPrice * 100),
          },
          quantity: isTeamPricing ? seatCount : 1,
        });
      } else if (pricingType === "subscription") {
        // For team subscriptions we bill per-seat as quantity
        let stripePriceId = isTeamPricing ? (teamStripePriceId ?? effectiveStripePriceId) : effectiveStripePriceId;
        if (!stripePriceId) {
          const intervalMap: Record<string, "month" | "year"> = { monthly: "month", quarterly: "month", annual: "year" };
          const intervalCountMap: Record<string, number> = { monthly: 1, quarterly: 3, annual: 1 };
          const interval = effectiveSubscriptionInterval ?? "monthly";
          const stripeProduct = await stripe.products.create({
            name: content.title,
            metadata: { content_type: input.contentType, content_id: content.id.toString() },
          });
          const stripePrice = await stripe.prices.create({
            product: stripeProduct.id,
            unit_amount: Math.round(unitPrice * 100),
            currency: content.currency,
            recurring: { interval: intervalMap[interval] ?? "month", interval_count: intervalCountMap[interval] ?? 1 },
          });
          stripePriceId = stripePrice.id;
          await persistStripePriceId(db, input.contentType, content.id, input.pricingOptionId ?? null, stripePriceId, isTeamPricing);
        }
        lineItems.push({ price: stripePriceId!, quantity: isTeamPricing ? seatCount : 1 });
      } else {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Unsupported pricing type: " + pricingType });
      }

      // ── Order bump add-ons ────────────────────────────────────────────────
      if (input.selectedBumpIds?.length) {
        const allBumps = await fetchOrderBumps(db, input.contentType, content.id);
        for (const bumpId of input.selectedBumpIds) {
          const bump = allBumps.find((b: any) => b.id === bumpId);
          if (!bump) continue;

          // Resolve bump product title + price
          let bumpTitle = bump.headline ?? bump.name;
          let bumpPrice = bump.discountedPrice ? Number(bump.discountedPrice) : 0;

          // Fetch bump product info for a better name
          try {
            if (bump.bumpProductType === "course") {
              const [bumpCourse] = await db.select({ title: lmsCourses.title, price: lmsCourses.price })
                .from(lmsCourses).where(eq(lmsCourses.id, bump.bumpProductId)).limit(1);
              if (bumpCourse) {
                bumpTitle = bumpTitle || bumpCourse.title;
                if (!bumpPrice) bumpPrice = Number(bumpCourse.price ?? 0);
              }
            } else if (bump.bumpProductType === "download") {
              const [bumpDl] = await db.select({ title: digitalProducts.title })
                .from(digitalProducts).where(eq(digitalProducts.id, bump.bumpProductId)).limit(1);
              if (bumpDl) bumpTitle = bumpTitle || bumpDl.title;
            }
          } catch {}

          if (bumpPrice > 0) {
            lineItems.push({
              price_data: {
                currency: content.currency,
                product_data: { name: bumpTitle },
                unit_amount: Math.round(bumpPrice * 100),
              },
              quantity: 1,
            });
          }
        }
      }

      // ── Create Stripe session ─────────────────────────────────────────────
      let session: any;

      if (pricingType === "subscription") {
        const trialOpts = effectiveTrialDays && effectiveTrialDays > 0
          ? { subscription_data: { trial_period_days: effectiveTrialDays } }
          : {};
        session = await stripe.checkout.sessions.create({
          mode: "subscription",
          customer_email: ctx.user.email ?? undefined,
          ...promoOpts,
          ...trialOpts,
          line_items: lineItems,
          success_url: successUrl,
          cancel_url: cancelUrl,
          client_reference_id: ctx.user.id.toString(),
          metadata: commonMeta,
        });
      } else {
        session = await stripe.checkout.sessions.create({
          mode: "payment",
          customer_email: ctx.user.email ?? undefined,
          ...promoOpts,
          line_items: lineItems,
          success_url: successUrl,
          cancel_url: cancelUrl,
          client_reference_id: ctx.user.id.toString(),
          metadata: commonMeta,
        });
      }

      if (!session) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create checkout session" });

      return { type: "redirect" as const, checkoutUrl: session.url!, sessionId: session.id };
    }),

  /** Confirm a hosted checkout session and grant access */
  confirmHostedCheckout: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
      contentType: z.enum(CONTENT_TYPES),
      slug: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(ENV.stripeSecretKey, { apiVersion: "2024-06-20" as any });

      const session = await stripe.checkout.sessions.retrieve(input.sessionId, {
        expand: ["subscription", "payment_intent"],
      });

      const isPaid = session.payment_status === "paid" || session.status === "complete";
      if (!isPaid) {
        return { success: false, status: session.payment_status ?? "unpaid" };
      }

      const contentType = (session.metadata?.content_type ?? input.contentType) as ContentType;
      const contentId   = parseInt(session.metadata?.content_id ?? "0");
      const seatCount   = parseInt(session.metadata?.seat_count ?? "1") || 1;

      if (!contentId) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid session metadata" });

      const content = await resolveContentBySlug(db, contentType, input.slug);
      if (!content) throw new TRPCError({ code: "NOT_FOUND" });

      // Check if already has access (idempotent)
      const alreadyGranted = await checkExistingAccess(db, contentType, content.id, ctx.user.id);
      if (alreadyGranted) {
        return { success: true, alreadyGranted: true, slug: content.slug, contentType };
      }

      // Grant access (with seat count for team purchases)
      await grantAccess(db, contentType, content, ctx.user.id, session, seatCount);

      return { success: true, alreadyGranted: false, slug: content.slug, contentType };
    }),
});

// ─── Access grant helpers ─────────────────────────────────────────────────────

async function checkExistingAccess(db: any, contentType: ContentType, contentId: number, userId: number): Promise<boolean> {
  if (contentType === "course") {
    const [e] = await db.select({ id: lmsEnrollments.id })
      .from(lmsEnrollments)
      .where(and(eq(lmsEnrollments.userId, userId), eq(lmsEnrollments.courseId, contentId)))
      .limit(1);
    return !!e;
  }
  return false;
}

async function grantAccess(db: any, contentType: ContentType, content: any, userId: number, session: any, seatCount = 1) {
  const stripeSubscriptionId = session && typeof session.subscription === "object"
    ? (session.subscription as any)?.id
    : session?.subscription ?? null;
  const stripePaymentIntentId = session && typeof session.payment_intent === "object"
    ? (session.payment_intent as any)?.id
    : session?.payment_intent ?? null;

  switch (contentType) {
    case "course": {
      const [orderResult] = await db.insert(lmsOrders).values({
        orgId: content.orgId,
        userId,
        courseId: content.id,
        amount: String(content.price),
        currency: content.currency,
        status: "completed",
        stripeSessionId: session?.id ?? null,
        stripeSubscriptionId: stripeSubscriptionId ?? null,
        stripePaymentIntentId: stripePaymentIntentId ?? null,
        seats: seatCount,
        completedAt: new Date(),
      }).$returningId();
      // Enroll the purchasing user
      await db.insert(lmsEnrollments).values({
        orgId: content.orgId,
        userId,
        courseId: content.id,
        status: "active",
        enrollmentType: "full",
        orderId: orderResult.id,
      });
      break;
    }
    case "download": {
      await db.insert(digitalOrders).values({
        productId: content.id,
        priceId: 0,
        orgId: content.orgId,
        buyerEmail: "",
        amount: String(content.price),
        currency: content.currency ?? "usd",
        status: "paid",
        paymentRef: stripePaymentIntentId ?? session?.id ?? null,
        downloadToken: Math.random().toString(36).slice(2) + Date.now().toString(36),
        paidAt: new Date(),
      });
      break;
    }
    case "physical_product": {
      await db.insert(physicalProductOrders).values({
        userId,
        productId: content.id,
        amountPaid: String(content.price),
        currency: "usd",
        stripeCheckoutSessionId: session?.id ?? null,
        stripePaymentIntentId: stripePaymentIntentId ?? null,
        fulfillmentStatus: "pending",
        orderedAt: new Date(),
      });
      break;
    }
    case "webinar":
    case "membership":
    case "membership_plan": {
      await db.insert(lmsOrders).values({
        orgId: content.orgId,
        userId,
        courseId: null,
        amount: String(content.price),
        currency: content.currency ?? "usd",
        status: "completed",
        stripeSessionId: session?.id ?? null,
        stripeSubscriptionId: stripeSubscriptionId ?? null,
        stripePaymentIntentId: stripePaymentIntentId ?? null,
        seats: seatCount,
        completedAt: new Date(),
      });
      break;
    }
  }
}

async function persistStripePriceId(
  db: any,
  contentType: ContentType,
  contentId: number,
  pricingOptionId: number | null,
  stripePriceId: string,
  isTeamPricing = false,
) {
  switch (contentType) {
    case "course":
      if (pricingOptionId) {
        const field = isTeamPricing ? { teamStripePriceId: stripePriceId } : { stripePriceId };
        await db.update(lmsPricingOptions).set(field).where(eq(lmsPricingOptions.id, pricingOptionId));
      } else {
        await db.update(lmsCourses).set({ stripePriceId }).where(eq(lmsCourses.id, contentId));
      }
      break;
    case "download":
      if (pricingOptionId) {
        await db.update(digitalProductPrices).set({ stripePriceId }).where(eq(digitalProductPrices.id, pricingOptionId));
      }
      break;
    case "webinar":
      await db.update(webinars).set({ stripePriceId }).where(eq(webinars.id, contentId));
      break;
    case "membership":
      await db.update(memberships).set({ stripePriceId }).where(eq(memberships.id, contentId));
      break;
    case "membership_plan":
      await db.update(membershipPlans).set({ stripePriceId }).where(eq(membershipPlans.id, contentId));
      break;
  }
}

// ─── Admin Router ─────────────────────────────────────────────────────────────

const contentTypeInput = z.object({
  contentType: z.enum(CONTENT_TYPES),
  contentId: z.number(),
});

export const lmsCheckoutAdminRouter = router({
  /** Get checkout page config for any content entity */
  getCheckoutPageConfig: protectedProcedure
    .input(contentTypeInput)
    .query(async ({ input, ctx }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const row = await getCheckoutPageRow(db, input.contentType, input.contentId);
      return parseConfig(row ?? null);
    }),

  /** Save checkout page config for any content entity */
  saveCheckoutPageConfig: protectedProcedure
    .input(z.object({
      contentType: z.enum(CONTENT_TYPES),
      contentId: z.number(),
      orgId: z.number(),
      header: z.record(z.unknown()).optional(),
      contentInfo: z.record(z.unknown()).optional(),
      trustBadges: z.record(z.unknown()).optional(),
      paymentForm: z.record(z.unknown()).optional(),
      footer: z.record(z.unknown()).optional(),
      sectionsOrder: z.array(z.string()).optional(),
      primaryColor: z.string().optional(),
      accentColor: z.string().optional(),
      bgColor: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const values: any = {
        orgId: input.orgId,
        contentType: input.contentType,
        contentId: input.contentId,
        courseId: input.contentType === "course" ? input.contentId : null,
        headerConfig:      input.header      ? JSON.stringify(input.header)      : null,
        courseInfoConfig:  input.contentInfo  ? JSON.stringify(input.contentInfo) : null,
        trustBadgesConfig: input.trustBadges  ? JSON.stringify(input.trustBadges) : null,
        paymentFormConfig: input.paymentForm  ? JSON.stringify(input.paymentForm) : null,
        footerConfig:      input.footer       ? JSON.stringify(input.footer)      : null,
        sectionsOrder:     input.sectionsOrder ? JSON.stringify(input.sectionsOrder) : null,
        primaryColor: input.primaryColor ?? null,
        accentColor:  input.accentColor  ?? null,
        bgColor:      input.bgColor      ?? null,
      };

      const existing = await getCheckoutPageRow(db, input.contentType, input.contentId);
      if (existing) {
        await db.update(lmsCheckoutPages).set(values).where(eq(lmsCheckoutPages.id, existing.id));
      } else {
        await db.insert(lmsCheckoutPages).values(values);
      }
      return { success: true };
    }),

  /** List checkout page templates for the org */
  listCheckoutTemplates: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ input, ctx }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db.select().from(lmsCheckoutPageTemplates)
        .where(eq(lmsCheckoutPageTemplates.orgId, input.orgId))
        .orderBy(desc(lmsCheckoutPageTemplates.createdAt));
      return rows.map(r => ({ id: r.id, name: r.name, config: parseConfig(r), createdAt: r.createdAt }));
    }),

  /** Save current config as a named template */
  saveCheckoutTemplate: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      orgId: z.number(),
      header: z.record(z.unknown()).optional(),
      contentInfo: z.record(z.unknown()).optional(),
      trustBadges: z.record(z.unknown()).optional(),
      paymentForm: z.record(z.unknown()).optional(),
      footer: z.record(z.unknown()).optional(),
      sectionsOrder: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [result] = await db.insert(lmsCheckoutPageTemplates).values({
        orgId: input.orgId,
        name: input.name,
        headerConfig:      input.header      ? JSON.stringify(input.header)      : null,
        courseInfoConfig:  input.contentInfo  ? JSON.stringify(input.contentInfo) : null,
        trustBadgesConfig: input.trustBadges  ? JSON.stringify(input.trustBadges) : null,
        paymentFormConfig: input.paymentForm  ? JSON.stringify(input.paymentForm) : null,
        footerConfig:      input.footer       ? JSON.stringify(input.footer)      : null,
        sectionsOrder:     input.sectionsOrder ? JSON.stringify(input.sectionsOrder) : null,
      }).$returningId();
      return { id: result.id, success: true };
    }),

  /** Delete a checkout page template */
  deleteCheckoutTemplate: protectedProcedure
    .input(z.object({ templateId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(lmsCheckoutPageTemplates).where(eq(lmsCheckoutPageTemplates.id, input.templateId));
      return { success: true };
    }),

  /** Import a template's config into a content entity's checkout page */
  importCheckoutTemplate: protectedProcedure
    .input(z.object({
      contentType: z.enum(CONTENT_TYPES),
      contentId: z.number(),
      orgId: z.number(),
      templateId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [template] = await db.select().from(lmsCheckoutPageTemplates)
        .where(eq(lmsCheckoutPageTemplates.id, input.templateId)).limit(1);
      if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });

      const values: any = {
        orgId: input.orgId,
        contentType: input.contentType,
        contentId: input.contentId,
        courseId: input.contentType === "course" ? input.contentId : null,
        headerConfig:      template.headerConfig,
        courseInfoConfig:  template.courseInfoConfig,
        trustBadgesConfig: template.trustBadgesConfig,
        paymentFormConfig: template.paymentFormConfig,
        footerConfig:      template.footerConfig,
        sectionsOrder:     template.sectionsOrder,
      };

      const existing = await getCheckoutPageRow(db, input.contentType, input.contentId);
      if (existing) {
        await db.update(lmsCheckoutPages).set(values).where(eq(lmsCheckoutPages.id, existing.id));
      } else {
        await db.insert(lmsCheckoutPages).values(values);
      }

      return { success: true, config: parseConfig(template) };
    }),
});
