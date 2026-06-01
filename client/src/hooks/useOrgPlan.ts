import { trpc } from "@/lib/trpc";
import { getLimits, meetsRequirement, PLAN_LABELS, type PlanTier, type TierLimits } from "../../../shared/tierLimits";
import { useAuth } from "@/_core/hooks/useAuth";
import { getSubdomain } from "@/hooks/useSubdomain";

/** Unlimited limits — every feature enabled, every numeric cap is null (unlimited) */
const UNLIMITED_LIMITS: TierLimits = {
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
};

/**
 * Returns the current org's subscription plan and limits.
 *
 * Bypass rules:
 * - site_owner / site_admin: bypass plan gates for ANY org (platform-wide admins)
 * - org_super_admin: bypass plan gates ONLY for their own org (verified via myContext)
 * - All others: read plan from org_subscriptions table
 */
export function useOrgPlan(orgId: number | null | undefined) {
  const { user } = useAuth();

  // Platform admins bypass all plan gates for any org
  const isPlatformAdmin = user?.role === "site_owner" || user?.role === "site_admin";

  // org_super_admin only bypasses plan gates for their own org — fetch their org context to verify
  const currentSubdomain = getSubdomain() ?? undefined;
  const { data: myContext, isLoading: contextLoading } = trpc.orgs.myContext.useQuery(
    { subdomain: currentSubdomain },
    { enabled: !!user && user.role === "org_super_admin" && !!orgId }
  );
  const isOrgSuperAdminOfThisOrg =
    user?.role === "org_super_admin" &&
    !!orgId &&
    !contextLoading &&
    myContext?.org?.id === orgId;

  const bypassPlanGate = isPlatformAdmin || isOrgSuperAdminOfThisOrg;

  const { data: sub, isLoading: subLoading } = trpc.lms.subscription.get.useQuery(
    { orgId: orgId! },
    // Skip the subscription query entirely for those who bypass plan gates
    { enabled: !!orgId && !bypassPlanGate }
  );

  // Bypass: treat as unlimited enterprise
  if (bypassPlanGate) {
    return {
      plan: "enterprise" as PlanTier,
      planLabel: "Enterprise",
      limits: UNLIMITED_LIMITS,
      can: (_feature: keyof TierLimits) => true,
      meets: (_required: PlanTier) => true,
      isLoading: false,
      sub: null,
      isPlatformAdmin: true,
    };
  }

  // Still loading org context for org_super_admin (before we know if it's their org)
  if (user?.role === "org_super_admin" && contextLoading) {
    return {
      plan: "free" as PlanTier,
      planLabel: "Free",
      limits: getLimits("free"),
      can: (_feature: keyof TierLimits) => false,
      meets: (_required: PlanTier) => false,
      isLoading: true,
      sub: null,
      isPlatformAdmin: false,
    };
  }

  const plan = (sub?.plan ?? "free") as PlanTier;
  const limits: TierLimits = getLimits(plan);
  const planLabel = PLAN_LABELS[plan];

  const can = (feature: keyof TierLimits): boolean => {
    const val = limits[feature];
    if (typeof val === "boolean") return val;
    if (typeof val === "number") return val > 0;
    if (val === null) return true; // unlimited
    return false;
  };

  const meets = (required: PlanTier): boolean => meetsRequirement(plan, required);

  return { plan, planLabel, limits, can, meets, isLoading: subLoading, sub, isPlatformAdmin: false };
}
