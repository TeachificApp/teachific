import { getEffectiveSubscriptionPlan, hasUsableSubscriptionStatus } from "../../shared/subscriptionEntitlement";
import { getLimits } from "../../shared/tierLimits";

/**
 * Hidden and private course visibility is an active Pro-or-Enterprise
 * organization capability. Existing restricted courses are retained on
 * downgrade; this helper governs new or changed restricted visibility.
 */
export function canUseHiddenPrivateCourseVisibility(
  plan: string | null | undefined,
  status: string | null | undefined,
): boolean {
  if (!hasUsableSubscriptionStatus(status)) return false;
  return getLimits(getEffectiveSubscriptionPlan(plan, status)).hiddenPrivateCourses;
}
