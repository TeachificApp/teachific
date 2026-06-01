/**
 * Teachific™ Subscription Tier Limits
 *
 * Tiers: free → starter → builder → pro → enterprise
 *
 * This file is the single source of truth for all feature gates.
 * Import on both server (enforcement) and client (UI hints).
 */

export type PlanTier = "free" | "starter" | "builder" | "pro" | "enterprise";

export interface TierLimits {
  /** Max courses per org (null = unlimited) */
  maxCourses: number | null;
  /** Max enrolled members per org (null = unlimited) */
  maxMembers: number | null;
  /** Max storage in GB (null = unlimited) */
  maxStorageGb: number | null;
  /** Max instructors per org (null = unlimited) */
  maxInstructors: number | null;
  /** Max course bundles (null = unlimited) */
  maxBundles: number | null;
  /** Max community hubs per org (null = unlimited) */
  maxCommunities: number | null;
  // ── Feature flags ──────────────────────────────────────────────────────────
  /** AI course / quiz / flashcard generation */
  aiGeneration: boolean;
  /** Drip scheduling for modules/lessons */
  dripScheduling: boolean;
  /** Completion certificates */
  certificates: boolean;
  /** Course bundles (group ≤3 courses) */
  courseBundles: boolean;
  /** Memberships (multi-product access) */
  memberships: boolean;
  /** Advanced analytics (video engagement, compliance) */
  advancedAnalytics: boolean;
  /** Zoom / Teams live session lessons */
  liveSessions: boolean;
  /** Hidden / Private course visibility */
  hiddenPrivateCourses: boolean;
  /** Custom CSS / page code injection */
  customCode: boolean;
  /** Zapier / webhook / API integrations */
  zapierIntegrations: boolean;
  /** Custom domain support */
  customDomain: boolean;
  /** White-label (remove Teachific branding) */
  whiteLabel: boolean;
  /** Upsell funnels / order bumps */
  upsellFunnels: boolean;
  /** Coupon codes */
  coupons: boolean;
  /** Affiliate program */
  affiliates: boolean;
  /** Priority support */
  prioritySupport: boolean;
}

export const TIER_LIMITS: Record<PlanTier, TierLimits> = {
  free: {
    maxCourses: 3,
    maxMembers: 50,
    maxStorageGb: 1,
    maxInstructors: 1,
    maxBundles: 0,
    maxCommunities: 0,
    aiGeneration: false,
    dripScheduling: false,
    certificates: false,
    courseBundles: false,
    memberships: false,
    advancedAnalytics: false,
    liveSessions: false,
    hiddenPrivateCourses: false,
    customCode: false,
    zapierIntegrations: false,
    customDomain: false,
    whiteLabel: false,
    upsellFunnels: false,
    coupons: false,
    affiliates: false,
    prioritySupport: false,
  },
  starter: {
    maxCourses: 10,
    maxMembers: 200,
    maxStorageGb: 10,
    maxInstructors: 3,
    maxBundles: 0,
    maxCommunities: 1,
    aiGeneration: true,
    dripScheduling: false,
    certificates: true,
    courseBundles: false,
    memberships: false,
    advancedAnalytics: false,
    liveSessions: false,
    hiddenPrivateCourses: false,
    customCode: false,
    zapierIntegrations: false,
    customDomain: false,
    whiteLabel: false,
    upsellFunnels: false,
    coupons: true,
    affiliates: false,
    prioritySupport: false,
  },
  builder: {
    maxCourses: 25,
    maxMembers: 1000,
    maxStorageGb: 50,
    maxInstructors: 10,
    maxBundles: 5,
    maxCommunities: 2,
    aiGeneration: true,
    dripScheduling: true,
    certificates: true,
    courseBundles: true,
    memberships: true,
    advancedAnalytics: false,
    liveSessions: false,
    hiddenPrivateCourses: false,
    customCode: false,
    zapierIntegrations: false,
    customDomain: false,
    whiteLabel: false,
    upsellFunnels: true,
    coupons: true,
    affiliates: false,
    prioritySupport: false,
  },
  pro: {
    maxCourses: null,
    maxMembers: 5000,
    maxStorageGb: 200,
    maxInstructors: null,
    maxBundles: null,
    maxCommunities: 5,
    aiGeneration: true,
    dripScheduling: true,
    certificates: true,
    courseBundles: true,
    memberships: true,
    advancedAnalytics: true,
    liveSessions: true,
    hiddenPrivateCourses: true,
    customCode: true,
    zapierIntegrations: true,
    customDomain: true,
    whiteLabel: false,
    upsellFunnels: true,
    coupons: true,
    affiliates: true,
    prioritySupport: true,
  },
  enterprise: {
    maxCourses: null,
    maxMembers: null,
    maxStorageGb: null,
    maxInstructors: null,
    maxBundles: null,
    maxCommunities: null,
    aiGeneration: true,
    dripScheduling: true,
    certificates: true,
    courseBundles: true,
    memberships: true,
    advancedAnalytics: true,
    liveSessions: true,
    hiddenPrivateCourses: true,
    customCode: true,
    zapierIntegrations: true,
    customDomain: true,
    whiteLabel: true,
    upsellFunnels: true,
    coupons: true,
    affiliates: true,
    prioritySupport: true,
  },
};

/** Canonical feature keys used in subscription_plan_limits and org_limit_overrides tables.
 * This is the single source of truth for which features appear in the Subscription Plans grid
 * and the Limit Overrides panel.
 */
export const CANONICAL_FEATURE_KEYS = [
  { key: "courses", label: "Courses" },
  { key: "lessons_per_course", label: "Lessons per Course" },
  { key: "members", label: "Members" },
  { key: "groups", label: "Groups" },
  { key: "storage_gb", label: "Storage (GB)" },
  { key: "forms", label: "Forms" },
  { key: "communities", label: "Communities" },
  { key: "webinars", label: "Webinars" },
  { key: "digital_products", label: "Digital Products" },
  { key: "email_campaigns", label: "Email Campaigns" },
  { key: "custom_pages", label: "Custom Pages" },
  { key: "bundles", label: "Bundles" },
  { key: "memberships", label: "Memberships" },
  { key: "affiliates", label: "Affiliates" },
  { key: "certificates", label: "Certificates" },
] as const;

export type CanonicalFeatureKey = typeof CANONICAL_FEATURE_KEYS[number]["key"];

/** Returns the limits for a given plan string (defaults to free if unknown) */
export function getLimits(plan?: string | null): TierLimits {
  const tier = (plan ?? "free") as PlanTier;
  return TIER_LIMITS[tier] ?? TIER_LIMITS.free;
}

/** Human-readable plan display names */
export const PLAN_LABELS: Record<PlanTier, string> = {
  free: "Free",
  starter: "Starter",
  builder: "Builder",
  pro: "Pro",
  enterprise: "Enterprise",
};

/** Ordered tier list for upgrade comparisons */
export const TIER_ORDER: PlanTier[] = ["free", "starter", "builder", "pro", "enterprise"];

/** Returns true if `current` is at least as high as `required` */
export function meetsRequirement(current: string | null | undefined, required: PlanTier): boolean {
  const currentIdx = TIER_ORDER.indexOf((current ?? "free") as PlanTier);
  const requiredIdx = TIER_ORDER.indexOf(required);
  return currentIdx >= requiredIdx;
}

/** Returns the minimum plan name required for a feature */
export function requiredPlanFor(feature: keyof TierLimits): PlanTier {
  for (const tier of TIER_ORDER) {
    const limits = TIER_LIMITS[tier];
    const val = limits[feature];
    if (typeof val === "boolean" && val) return tier;
    if (typeof val === "number" && val > 0) return tier;
    if (val === null) return tier; // null = unlimited = available
  }
  return "enterprise";
}
