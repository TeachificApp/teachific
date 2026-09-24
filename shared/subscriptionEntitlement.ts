import type { PlanTier } from "./tierLimits";

export const USABLE_SUBSCRIPTION_STATUSES = ["active", "trialing"] as const;

/** A paid organization retains plan entitlements only while Stripe reports it as active or trialing. */
export function hasUsableSubscriptionStatus(status: string | null | undefined): boolean {
  return (USABLE_SUBSCRIPTION_STATUSES as readonly string[]).includes(status ?? "");
}

/** Converts a persisted plan to the entitlement tier that feature gates may use. */
export function getEffectiveSubscriptionPlan(
  plan: string | null | undefined,
  status: string | null | undefined,
): PlanTier {
  if (!hasUsableSubscriptionStatus(status)) return "free";
  const candidate = plan as PlanTier | null | undefined;
  return candidate && ["free", "starter", "builder", "pro", "enterprise"].includes(candidate)
    ? candidate
    : "free";
}
