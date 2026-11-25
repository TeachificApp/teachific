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
import { and, eq, desc, or, isNull, inArray } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb, getOrgIdForUserWithFallback, requireOrgAdmin } from "../db";
import { ENV } from "../_core/env";
import {
  lmsCourses,
  lmsPricingOptions,
  lmsEnrollments,
  lmsCheckoutPages,
  lmsCheckoutPageTemplates,
  platformSettings,
  organizations,
  digitalProducts,
  digitalProductPrices,
  webinars,
  memberships,
  membershipPlans,
  physicalProducts,
  physicalProductPricingOptions,
  orderBumps,
  workshops,
  workshopRegistrations,
  bundles,
  bundlePricingOptions,
  membershipMembers,
  membershipSubscriptions,
  bundleEnrollments,
  webinarRegistrations,
  coupons,
  orgPaymentSettings,
} from "../../drizzle/schema";
import { assertAdmin } from "./lmsHelpers";
import { couponIsRedeemableForCheckout } from "../lib/couponTargeting";
import { getOrgBaseUrl } from "../lib/orgUrl";
import {
  course360HostedCheckoutPurchases, createHostedPurchase, hostedPurchaseMetadata, assertCourse360HostedPersistenceReady,
  resolveCourse360HostedGateway, hostedEnrollmentHasCurrentFullAccess,
} from "../lib/course360HostedCheckout";
import {
  reconcileCourse360HostedSignedSession, fulfillCourse360HostedFreePurchase,
  assertHostedIncludedContentScope, resolveHostedOwnedContent, assertHostedPricingOption,
} from "../lib/course360HostedCheckoutReconciliation";

import { resolveProtectedCourse360PurchaseGateway } from "../lib/course360SchoolStripeGateway";
import { hasCourse360SourceEntitlement } from "../lib/course360HostedCheckoutEntitlements";
// ─── Shared Types ─────────────────────────────────────────────────────────────

export const CONTENT_TYPES = ["course", "download", "physical_product", "webinar", "membership", "membership_plan", "workshop", "bundle"] as const;
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
        enrollmentClosed: row.enrollmentClosed === true,
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
        pricingType: primaryPrice?.type ?? "free",
        price: primaryPrice?.amount ?? "0", currency: primaryPrice?.currency ?? "usd",
        isFree: !primaryPrice || Number(primaryPrice.amount) === 0,
        subscriptionInterval: null, trialDays: null,
        stripePriceId: primaryPrice?.stripePriceId ?? null,
        stripeProductId: primaryPrice?.stripeProductId ?? null,
        pricingOptions: prices.map(p => ({ ...p, pricingType: p.type })),
        isAvailable: row.visibility === "published",
        enrollmentClosed: row.enrollmentClosed === true,
      };
    }
    case "physical_product": {
      const [row] = await db.select().from(physicalProducts).where(eq(physicalProducts.slug, slug)).limit(1);
      if (!row) return null;
      const options = await db.select().from(physicalProductPricingOptions)
        .where(and(eq(physicalProductPricingOptions.productId, row.id), eq(physicalProductPricingOptions.isActive, true)));
      const primaryOpt = options[0];
      return {
        id: row.id, orgId: row.orgId, slug: row.slug, title: row.title,
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
        enrollmentClosed: row.enrollmentClosed === true,
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
        courseIds: row.courseIds,
        courseAccess: row.courseAccess,
        enrollmentClosed: row.enrollmentClosed === true,
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
        subscriptionInterval: row.billingInterval,
        trialDays: null,
        stripePriceId: row.stripePriceId ?? null,
        stripeProductId: row.stripeProductId ?? null,
        pricingOptions: [],
        isAvailable: true,
      };
    }
    case "workshop": {
      const [row] = await db.select().from(workshops).where(eq(workshops.slug, slug)).limit(1);
      if (!row) return null;
      return {
        id: row.id, orgId: row.orgId, slug: row.slug, title: row.title,
        subtitle: row.shortDescription ?? null, description: row.description,
        coverImageUrl: row.coverImageUrl ?? null,
        primaryColor: "#179ca3", accentColor: "#0d9488",
        pricingType: row.isFree ? "free" : "one_time",
        price: row.price ?? "0", currency: row.currency ?? "usd",
        isFree: row.isFree || Number(row.price) === 0,
        subscriptionInterval: null, trialDays: null,
        stripePriceId: row.stripePriceId ?? null,
        stripeProductId: row.stripeProductId ?? null,
        pricingOptions: [],
        isAvailable: row.status === "published",
        enrollmentClosed: row.enrollmentClosed === true,
        startDate: row.startDate,
        endDate: row.endDate,
        location: row.location,
        format: row.format,
        maxAttendees: row.maxAttendees,
      };
    }
    case "bundle": {
      // Bundles are looked up by numeric ID (no slug)
      const bundleId = parseInt(slug);
      if (isNaN(bundleId)) return null;
      const [row] = await db.select().from(bundles).where(eq(bundles.id, bundleId)).limit(1);
      if (!row) return null;
      const pricingOptions = await db.select().from(bundlePricingOptions).where(eq(bundlePricingOptions.bundleId, row.id)).orderBy(bundlePricingOptions.sortOrder);
      return {
        id: row.id, orgId: row.orgId, slug: String(row.id), title: row.name,
        subtitle: null, description: row.description ?? null,
        courseIds: row.courseIds,
        coverImageUrl: row.thumbnailUrl ?? null,
        primaryColor: "#179ca3", accentColor: "#0d9488",
        pricingType: "one_time",
        price: String(row.price ?? "0"), currency: "usd",
        isFree: Number(row.price) === 0,
        subscriptionInterval: null, trialDays: null,
        stripePriceId: null,
        stripeProductId: null,
        pricingOptions,
        isAvailable: row.isActive === true,
        enrollmentClosed: row.enrollmentClosed === true,
      };
    }
    default:
      return null;
  }
}

async function getCheckoutPageRow(db: any, contentType: ContentType, contentId: number, orgId?: number) {
  const [row] = await db.select().from(lmsCheckoutPages)
    .where(and(
      eq(lmsCheckoutPages.contentType, contentType),
      eq(lmsCheckoutPages.contentId, contentId),
      ...(orgId ? [eq(lmsCheckoutPages.orgId, orgId)] : []),
    )).limit(1);
  if (row) return row;
  // Fallback: legacy courseId lookup for courses
  if (contentType === "course") {
    const [legacy] = await db.select().from(lmsCheckoutPages)
      .where(and(eq(lmsCheckoutPages.courseId, contentId), ...(orgId ? [eq(lmsCheckoutPages.orgId, orgId)] : []))).limit(1);
    return legacy ?? null;
  }
  return null;
}

/**
 * Fetch active order bumps for a content item.
 * Returns bumps where pricingOptionId IS NULL (global) OR matches the given pricingOptionId.
 * The frontend filters further based on the selected tier.
 */
async function fetchOrderBumps(db: any, contentType: ContentType, contentId: number, orgId?: number) {
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
      ...(orgId ? [eq(orderBumps.orgId, orgId)] : []),
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
      // Org-level purchase terms (overrides platform default; course-level overrides this)
      const [orgPaySettings] = await db.select().from(orgPaymentSettings)
        .where(eq(orgPaymentSettings.orgId, content.orgId)).limit(1);
      // Content-level purchase terms (fetched for all content types that support overrides)
      let contentTermsRow: { purchaseTermsAgreement: string | null; purchaseTermsLink1Label: string | null; purchaseTermsLink1Url: string | null; purchaseTermsLink2Label: string | null; purchaseTermsLink2Url: string | null } | null = null;
      if (input.contentType === "course") {
        contentTermsRow = await db.select({ purchaseTermsAgreement: lmsCourses.purchaseTermsAgreement, purchaseTermsLink1Label: lmsCourses.purchaseTermsLink1Label, purchaseTermsLink1Url: lmsCourses.purchaseTermsLink1Url, purchaseTermsLink2Label: lmsCourses.purchaseTermsLink2Label, purchaseTermsLink2Url: lmsCourses.purchaseTermsLink2Url }).from(lmsCourses).where(eq(lmsCourses.id, content.id)).limit(1).then((r: any[]) => r[0] ?? null);
      } else if (input.contentType === "download") {
        contentTermsRow = await db.select({ purchaseTermsAgreement: digitalProducts.purchaseTermsAgreement, purchaseTermsLink1Label: digitalProducts.purchaseTermsLink1Label, purchaseTermsLink1Url: digitalProducts.purchaseTermsLink1Url, purchaseTermsLink2Label: digitalProducts.purchaseTermsLink2Label, purchaseTermsLink2Url: digitalProducts.purchaseTermsLink2Url }).from(digitalProducts).where(eq(digitalProducts.id, content.id)).limit(1).then((r: any[]) => r[0] ?? null);
      } else if (input.contentType === "webinar") {
        contentTermsRow = await db.select({ purchaseTermsAgreement: webinars.purchaseTermsAgreement, purchaseTermsLink1Label: webinars.purchaseTermsLink1Label, purchaseTermsLink1Url: webinars.purchaseTermsLink1Url, purchaseTermsLink2Label: webinars.purchaseTermsLink2Label, purchaseTermsLink2Url: webinars.purchaseTermsLink2Url }).from(webinars).where(eq(webinars.id, content.id)).limit(1).then((r: any[]) => r[0] ?? null);
      } else if (input.contentType === "workshop") {
        contentTermsRow = await db.select({ purchaseTermsAgreement: workshops.purchaseTermsAgreement, purchaseTermsLink1Label: workshops.purchaseTermsLink1Label, purchaseTermsLink1Url: workshops.purchaseTermsLink1Url, purchaseTermsLink2Label: workshops.purchaseTermsLink2Label, purchaseTermsLink2Url: workshops.purchaseTermsLink2Url }).from(workshops).where(eq(workshops.id, content.id)).limit(1).then((r: any[]) => r[0] ?? null);
      }
      // Resolve terms: content-level > org-level > platform (termsUrl/privacyUrl as fallback)
      const resolvedTermsAgreement = contentTermsRow?.purchaseTermsAgreement || orgPaySettings?.purchaseTermsAgreement || null;
      const resolvedTermsLink1Label = contentTermsRow?.purchaseTermsLink1Label || orgPaySettings?.purchaseTermsLink1Label || null;
      const resolvedTermsLink1Url = contentTermsRow?.purchaseTermsLink1Url || orgPaySettings?.purchaseTermsLink1Url || (settings as any)?.termsUrl || null;
      const resolvedTermsLink2Label = contentTermsRow?.purchaseTermsLink2Label || orgPaySettings?.purchaseTermsLink2Label || null;
      const resolvedTermsLink2Url = contentTermsRow?.purchaseTermsLink2Url || orgPaySettings?.purchaseTermsLink2Url || (settings as any)?.privacyUrl || null;

      // Checkout page config
      const checkoutPageRow = await getCheckoutPageRow(db, input.contentType, content.id, content.orgId);
      const checkoutConfig = parseConfig(checkoutPageRow ?? null);

      // Order bumps (placement: during_checkout)
      const bumps = await fetchOrderBumps(db, input.contentType, content.id, content.orgId);

      // Check if user already has access (only active/completed enrollments count — not suspended/cancelled)
      let hasAccess = false;
      if (ctx.user && input.contentType === "course") {
        hasAccess = await checkExistingAccess(db, input.contentType, content.id, ctx.user.id, content.orgId, ctx.user.email);
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
          enrollmentClosed: content.enrollmentClosed === true,
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
          // Resolved purchase terms (3-tier: course > org > platform)
          purchaseTermsAgreement: resolvedTermsAgreement,
          purchaseTermsLink1Label: resolvedTermsLink1Label,
          purchaseTermsLink1Url: resolvedTermsLink1Url,
          purchaseTermsLink2Label: resolvedTermsLink2Label,
          purchaseTermsLink2Url: resolvedTermsLink2Url,
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
      pricingOptionId: z.number().int().positive().optional(),
      origin: z.string(),
      promoCode: z.string().optional(),
      // Team / group purchase
      seatCount: z.number().int().min(1).max(500).optional(),
      // Order bump add-ons: array of bump IDs the user opted into
      selectedBumpIds: z.array(z.number().int().positive()).max(20).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const content = await resolveContentBySlug(db, input.contentType, input.slug);
      if (!content) throw new TRPCError({ code: "NOT_FOUND", message: "Content not found" });
      if (!content.isAvailable) throw new TRPCError({ code: "NOT_FOUND", message: "Content not available" });
      const activeOrgId = await getOrgIdForUserWithFallback(ctx.user.id, ctx.user.role);
      if (!activeOrgId || activeOrgId !== content.orgId) throw new TRPCError({ code: "FORBIDDEN", message: "This item is not in the active school." });
      await assertHostedIncludedContentScope(db, input.contentType, content);
      if (content.enrollmentClosed) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Enrollment is closed for this item." });
      }

      const [organization] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, content.orgId))
        .limit(1);
      if (!organization) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
      }
      const organizationBaseUrl = getOrgBaseUrl(
        organization.slug,
        organization.customDomain,
        organization.domainVerificationStatus,
      );

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

      const selectedOption = input.pricingOptionId !== undefined
        ? content.pricingOptions.find((o: any) => o.id === input.pricingOptionId && o.isActive !== false) as any
        : null;
      if (input.pricingOptionId !== undefined && !selectedOption) throw new TRPCError({ code: "BAD_REQUEST", message: "The selected price is not available for this item." });
      const selectedPricingOptionId = selectedOption?.id ?? null;
      await assertHostedPricingOption(db, { contentType: input.contentType, contentId: content.id, orgId: content.orgId, pricingOptionId: selectedPricingOptionId });
      if (selectedOption) {
        effectivePrice = Number(selectedOption.price ?? selectedOption.amount ?? 0);
        pricingType = selectedOption.pricingType ?? selectedOption.type;
        effectiveStripePriceId = selectedOption.stripePriceId ?? null;
        effectiveSubscriptionInterval = selectedOption.subscriptionInterval ?? selectedOption.billingInterval ?? null;
        effectiveTrialDays = selectedOption.trialDays ?? content.trialDays;
        isTeamPricing = selectedOption.isTeamPricing ?? false;
        minSeats = selectedOption.minSeats ?? 2;
        maxSeats = selectedOption.maxSeats ?? 100;
        perSeatPrice = selectedOption.perSeatPrice != null ? Number(selectedOption.perSeatPrice) : null;
        teamStripePriceId = selectedOption.teamStripePriceId ?? null;
      }
      if (pricingType === "payment_plan") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This finite installment plan needs a billing schedule before it can be purchased." });
      if (pricingType === "trial_then_subscription") pricingType = "subscription";
      if (!["free", "one_time", "subscription"].includes(pricingType)) throw new TRPCError({ code: "BAD_REQUEST", message: "Unsupported pricing type: " + pricingType });
      if (pricingType === "subscription" && !["course", "membership", "membership_plan", "bundle", "download", "webinar"].includes(input.contentType)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This recurring content family needs a finite entitlement adapter." });
      if (pricingType === "subscription" && !["monthly", "quarterly", "annual"].includes(effectiveSubscriptionInterval ?? "")) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid subscription interval" });
      if (isTeamPricing && (input.seatCount ?? minSeats) < minSeats || isTeamPricing && (input.seatCount ?? minSeats) > maxSeats) throw new TRPCError({ code: "BAD_REQUEST", message: "Seat count is outside this price's limits." });
      // Determine seat count for team pricing
      const seatCount = isTeamPricing ? Math.max(minSeats, Math.min(maxSeats, input.seatCount ?? minSeats)) : 1;
      // Per-seat price overrides base price for team tiers
      const unitPrice = isTeamPricing && perSeatPrice != null ? perSeatPrice : effectivePrice;
      if (!Number.isFinite(unitPrice) || unitPrice < 0 || (pricingType === "free" && unitPrice !== 0)) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid checkout price" });
      await assertCourse360HostedPersistenceReady(db, pricingType === "subscription");
      if (await checkExistingAccess(db, input.contentType, content.id, ctx.user.id, content.orgId, ctx.user.email)) throw new TRPCError({ code: "CONFLICT", message: "You already have current access to this item." });

      // A genuine free grant still records a school-bound durable claim. Paid bumps never disappear into this path.
      if (unitPrice === 0 && !input.selectedBumpIds?.length && !(effectiveTrialDays && effectiveTrialDays > 0)) {
        const purchase = await createHostedPurchase(db, {
          orgId: content.orgId, userId: ctx.user.id, contentType: input.contentType, contentId: content.id,
          contentSlug: content.slug, gateway: "free", accountId: `school:${content.orgId}`,
          pricingOptionId: selectedPricingOptionId, pricingType, unitPrice: "0.00", seats: seatCount,
          currency: content.currency.toLowerCase(), zeroPaymentEligible: 1, trialDays: 0,
        }, true);
        await fulfillCourse360HostedFreePurchase(db, purchase, content);
        return { type: "free" as const, slug: content.slug, contentType: input.contentType };
      }
      const gateway = await resolveCourse360HostedGateway(organization, ENV.stripeSecretKey, db);
      const { stripe, requestOptions } = gateway;
      const successUrl = `${organizationBaseUrl}/checkout/complete?session_id={CHECKOUT_SESSION_ID}&content_type=${input.contentType}&slug=${encodeURIComponent(content.slug)}`;
      const cancelUrl = `${organizationBaseUrl}/checkout/${input.contentType}/${encodeURIComponent(content.slug)}`;
      let commonMeta: Record<string, string> = {};
      // Coupon codes are organization-owned. Global Stripe promotion codes are
      // intentionally not accepted here because they bypass content targeting.
      let discounts: Array<{ coupon: string }> | undefined;
      if (input.promoCode) {
        const normalizedCode = input.promoCode.trim().toUpperCase();
        const [coupon] = await db.select().from(coupons)
          .where(and(eq(coupons.orgId, content.orgId), eq(coupons.code, normalizedCode)))
          .limit(1);
        if (!coupon || !couponIsRedeemableForCheckout(coupon, {
          orgId: content.orgId,
          contentType: input.contentType,
          productId: content.id,
        })) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "This discount code is not available for this item." });
        }
        try {
          const stripeCoupon = await stripe.coupons.create({
            ...(coupon.discountType === "percentage"
              ? { percent_off: Number(coupon.discountValue) }
              : { amount_off: Math.round(Number(coupon.discountValue) * 100), currency: content.currency }),
            duration: "once",
            name: `Course360 ${normalizedCode}`,
            metadata: {
              source_coupon_id: String(coupon.id),
              org_id: String(content.orgId),
              content_type: input.contentType,
              content_id: String(content.id),
            },
          }, requestOptions);
          discounts = [{ coupon: stripeCoupon.id }];
          commonMeta.internal_coupon_id = String(coupon.id);
          commonMeta.internal_coupon_code = normalizedCode;
        } catch (error) {
          console.error("[Checkout] Could not prepare organization coupon", error);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The discount code could not be applied. Please try again." });
        }
      }
      const promoOpts = discounts ? { discounts } : {};

      // ── Build line items ──────────────────────────────────────────────────
      const lineItems: any[] = [];

      if (pricingType === "one_time" || pricingType === "free") {
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
            metadata: { org_id: String(content.orgId), content_type: input.contentType, content_id: content.id.toString() },
          }, requestOptions);
          const stripePrice = await stripe.prices.create({
            product: stripeProduct.id,
            unit_amount: Math.round(unitPrice * 100),
            currency: content.currency,
            recurring: { interval: intervalMap[interval] ?? "month", interval_count: intervalCountMap[interval] ?? 1 },
          }, requestOptions);
          stripePriceId = stripePrice.id;
          await persistStripePriceId(db, input.contentType, content.id, selectedPricingOptionId, stripePriceId, isTeamPricing, content.orgId);
        }
        const verifiedPrice = await stripe.prices.retrieve(stripePriceId!, {}, requestOptions);
        const expectedInterval = effectiveSubscriptionInterval === "annual" ? "year" : "month";
        const expectedIntervalCount = effectiveSubscriptionInterval === "quarterly" ? 3 : 1;
        if (!verifiedPrice.active || verifiedPrice.currency !== content.currency.toLowerCase() || verifiedPrice.unit_amount !== Math.round(unitPrice * 100) || verifiedPrice.recurring?.interval !== expectedInterval || (verifiedPrice.recurring?.interval_count ?? 1) !== expectedIntervalCount) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The stored Stripe price does not match this school's current tier." });
        lineItems.push({ price: stripePriceId!, quantity: isTeamPricing ? seatCount : 1 });
      } else {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Unsupported pricing type: " + pricingType });
      }

      // Only school-owned, tier-eligible, actually charged bump IDs enter immutable metadata.
      const chargedBumpIds: number[] = [];
      if (input.selectedBumpIds?.length) {
        const allBumps = await fetchOrderBumps(db, input.contentType, content.id, content.orgId);
        for (const bumpId of [...new Set(input.selectedBumpIds)]) {
          const bump = allBumps.find((b: any) => b.id === bumpId && (b.pricingOptionId == null || b.pricingOptionId === selectedPricingOptionId));
          if (!bump || !["course", "download"].includes(bump.bumpProductType)) throw new TRPCError({ code: "BAD_REQUEST", message: "This order bump is not available for the selected item." });
          const product = await resolveHostedOwnedContent(db, bump.bumpProductType, bump.bumpProductId, content.orgId);
          const bumpPrice = bump.discountedPrice != null ? Number(bump.discountedPrice) : Number(product.price ?? 0) * (1 - (bump.discountPercent ?? 0) / 100);
          if (!Number.isFinite(bumpPrice) || bumpPrice <= 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid order bump price" });
          lineItems.push({ price_data: { currency: content.currency, product_data: { name: bump.headline ?? product.title ?? bump.name }, unit_amount: Math.round(bumpPrice * 100) }, quantity: 1 });
          chargedBumpIds.push(bumpId);
        }
      }
      const purchase = await createHostedPurchase(db, {
        orgId: content.orgId, userId: ctx.user.id, contentType: input.contentType, contentId: content.id,
        contentSlug: content.slug, gateway: gateway.gateway, accountId: gateway.accountId,
        pricingOptionId: selectedPricingOptionId, pricingType, unitPrice: unitPrice.toFixed(2), seats: seatCount,
        currency: content.currency.toLowerCase(), trialDays: effectiveTrialDays ?? 0,
        zeroPaymentEligible: unitPrice === 0 || !!discounts ? 1 : 0,
        selectedBumpIds: chargedBumpIds.length ? chargedBumpIds.join(",") : null,
      });
      commonMeta = { ...commonMeta, ...hostedPurchaseMetadata(purchase) };

      // ── Create Stripe session ─────────────────────────────────────────────
      let session: any;

      if (pricingType === "subscription") {
        // subscription_data.metadata is propagated to the Subscription object so webhooks
        // (invoice.paid, invoice.payment_failed, customer.subscription.deleted) can identify
        // which user/course the subscription belongs to and grant/revoke access accordingly.
        const subscriptionMeta = { ...commonMeta };
        const trialOpts = effectiveTrialDays && effectiveTrialDays > 0
          ? { subscription_data: { trial_period_days: effectiveTrialDays, metadata: subscriptionMeta } }
          : { subscription_data: { metadata: subscriptionMeta } };
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
        }, { ...requestOptions, idempotencyKey: `course360_hosted:${purchase.id}` });
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
        }, { ...requestOptions, idempotencyKey: `course360_hosted:${purchase.id}` });
      }

      if (session?.id) await db.update(course360HostedCheckoutPurchases).set({ stripeSessionId: session.id, stripeSubscriptionId: typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null }).where(and(eq(course360HostedCheckoutPurchases.id, purchase.id), eq(course360HostedCheckoutPurchases.orgId, content.orgId)));
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

      const content = await resolveContentBySlug(db, input.contentType, input.slug);
      if (!content) throw new TRPCError({ code: "NOT_FOUND" });
      const activeOrgId = await getOrgIdForUserWithFallback(ctx.user.id, ctx.user.role);
      if (!activeOrgId || activeOrgId !== content.orgId) throw new TRPCError({ code: "FORBIDDEN", message: "This item is not in the active school." });
      const [organization] = await db.select().from(organizations).where(eq(organizations.id, content.orgId)).limit(1);
      const savedPurchases = await db.select().from(course360HostedCheckoutPurchases).where(and(
        eq(course360HostedCheckoutPurchases.stripeSessionId, input.sessionId), eq(course360HostedCheckoutPurchases.orgId, activeOrgId),
        eq(course360HostedCheckoutPurchases.userId, ctx.user.id), eq(course360HostedCheckoutPurchases.contentType, input.contentType), eq(course360HostedCheckoutPurchases.contentId, content.id),
      ));
      if (savedPurchases.length !== 1) throw new TRPCError({ code: "FORBIDDEN", message: "Hosted session does not match the authenticated school purchase." });
      const gateway = await resolveProtectedCourse360PurchaseGateway(db, savedPurchases[0]) ?? await resolveCourse360HostedGateway(organization, ENV.stripeSecretKey, db);
      const session = await gateway.stripe.checkout.sessions.retrieve(input.sessionId, { expand: ["subscription", "payment_intent"] }, gateway.requestOptions);
      const result = await reconcileCourse360HostedSignedSession({
        db, signedSession: session, verifiedAccountId: gateway.accountId, gateway,
        expected: { userId: ctx.user.id, orgId: activeOrgId, contentType: input.contentType, contentId: content.id, slug: content.slug },
      });
      if (!result.handled) throw new TRPCError({ code: "BAD_REQUEST", message: "This session is not a Course360 hosted checkout." });
      return { success: result.success, alreadyGranted: result.alreadyGranted ?? false, status: result.status, slug: content.slug, contentType: input.contentType };
    }),
});

// ─── Access grant helpers ─────────────────────────────────────────────────────

async function checkExistingAccess(db: any, contentType: ContentType, contentId: number, userId: number, orgId: number, email?: string | null): Promise<boolean> {
  if (["course", "membership", "membership_plan", "bundle", "download", "webinar"].includes(contentType)) {
    return hasCourse360SourceEntitlement(db, { orgId, userId, family: contentType as any, resourceId: contentId });
  }
  if (contentType === "workshop") {
    const [row] = await db.select().from(workshopRegistrations).where(and(eq(workshopRegistrations.userId, userId), eq(workshopRegistrations.workshopId, contentId))).limit(1);
    return !!row && row.status === "registered";
  }
  return false;
}

async function persistStripePriceId(
  db: any,
  contentType: ContentType,
  contentId: number,
  pricingOptionId: number | null,
  stripePriceId: string,
  isTeamPricing: boolean,
  orgId: number,
) {
  switch (contentType) {
    case "course":
      if (pricingOptionId) {
        const field = isTeamPricing ? { teamStripePriceId: stripePriceId } : { stripePriceId };
        await db.update(lmsPricingOptions).set(field).where(and(eq(lmsPricingOptions.id, pricingOptionId), eq(lmsPricingOptions.courseId, contentId)));
      } else {
        await db.update(lmsCourses).set({ stripePriceId }).where(and(eq(lmsCourses.id, contentId), eq(lmsCourses.orgId, orgId)));
      }
      break;
    case "bundle":
      if (pricingOptionId) await db.update(bundlePricingOptions).set({ stripePriceId }).where(and(eq(bundlePricingOptions.id, pricingOptionId), eq(bundlePricingOptions.bundleId, contentId)));
      break;
    case "download":
      if (pricingOptionId) {
        await db.update(digitalProductPrices).set({ stripePriceId }).where(and(eq(digitalProductPrices.id, pricingOptionId), eq(digitalProductPrices.productId, contentId)));
      }
      break;
    case "webinar":
      await db.update(webinars).set({ stripePriceId }).where(and(eq(webinars.id, contentId), eq(webinars.orgId, orgId)));
      break;
    case "membership":
      await db.update(memberships).set({ stripePriceId }).where(and(eq(memberships.id, contentId), eq(memberships.orgId, orgId)));
      break;
    case "membership_plan":
      await db.update(membershipPlans).set({ stripePriceId }).where(and(eq(membershipPlans.id, contentId), eq(membershipPlans.orgId, orgId)));
      break;
    case "workshop":
      await db.update(workshops).set({ stripePriceId }).where(and(eq(workshops.id, contentId), eq(workshops.orgId, orgId)));
      break;
  }
}

// ─── Admin Router ─────────────────────────────────────────────────────────────

async function requireHostedAdminSchool(ctx: any, requestedOrgId?: number): Promise<number> {
  await assertAdmin(ctx);
  const orgId = await getOrgIdForUserWithFallback(ctx.user.id, ctx.user.role);
  if (!orgId || (requestedOrgId !== undefined && requestedOrgId !== orgId)) throw new TRPCError({ code: "FORBIDDEN", message: "Checkout settings belong to another active school." });
  await requireOrgAdmin(ctx.user.id, ctx.user.role, orgId);
  return orgId;
}

const contentTypeInput = z.object({
  contentType: z.enum(CONTENT_TYPES),
  contentId: z.number(),
});

export const lmsCheckoutAdminRouter = router({
  /** Get checkout page config for any content entity */
  getCheckoutPageConfig: protectedProcedure
    .input(contentTypeInput)
    .query(async ({ input, ctx }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const orgId = await requireHostedAdminSchool(ctx);
      await resolveHostedOwnedContent(db, input.contentType, input.contentId, orgId);
      const row = await getCheckoutPageRow(db, input.contentType, input.contentId, orgId);
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
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const orgId = await requireHostedAdminSchool(ctx, input.orgId);
      await resolveHostedOwnedContent(db, input.contentType, input.contentId, orgId);
      const values: any = {
        orgId,
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

      const existing = await getCheckoutPageRow(db, input.contentType, input.contentId, orgId);
      if (existing) {
        await db.update(lmsCheckoutPages).set(values).where(and(eq(lmsCheckoutPages.id, existing.id), eq(lmsCheckoutPages.orgId, orgId)));
      } else {
        await db.insert(lmsCheckoutPages).values(values);
      }
      return { success: true };
    }),

  /** List checkout page templates for the org */
  listCheckoutTemplates: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ input, ctx }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const orgId = await requireHostedAdminSchool(ctx, input.orgId);
      const rows = await db.select().from(lmsCheckoutPageTemplates)
        .where(eq(lmsCheckoutPageTemplates.orgId, orgId))
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
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const orgId = await requireHostedAdminSchool(ctx, input.orgId);
      const [result] = await db.insert(lmsCheckoutPageTemplates).values({
        orgId,
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
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const orgId = await requireHostedAdminSchool(ctx);
      await db.delete(lmsCheckoutPageTemplates).where(and(eq(lmsCheckoutPageTemplates.id, input.templateId), eq(lmsCheckoutPageTemplates.orgId, orgId)));
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
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const templateOrgId = await requireHostedAdminSchool(ctx, input.orgId);
      const [template] = await db.select().from(lmsCheckoutPageTemplates)
        .where(and(eq(lmsCheckoutPageTemplates.id, input.templateId), eq(lmsCheckoutPageTemplates.orgId, templateOrgId))).limit(1);
      if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });

      const orgId = await requireHostedAdminSchool(ctx, input.orgId);
      await resolveHostedOwnedContent(db, input.contentType, input.contentId, orgId);
      const values: any = {
        orgId,
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

      const existing = await getCheckoutPageRow(db, input.contentType, input.contentId, orgId);
      if (existing) {
        await db.update(lmsCheckoutPages).set(values).where(and(eq(lmsCheckoutPages.id, existing.id), eq(lmsCheckoutPages.orgId, orgId)));
      } else {
        await db.insert(lmsCheckoutPages).values(values);
      }

      return { success: true, config: parseConfig(template) };
    }),
});
