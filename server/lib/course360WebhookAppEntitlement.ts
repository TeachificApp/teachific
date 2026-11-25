import { getOrgSubscriptionPeriodDates, stripeTimestamp } from "./orgSubscriptionTrialDates";

export type Course360AppTier = "none" | "web" | "desktop" | "bundle";

/** Subscription-only projection. Manual grants are separate independent sources. */
export function course360AppSubscriptionTier(subscription: {
  status?: string;
  trial_end?: number | null;
  current_period_end?: number | null;
  items?: { data?: Array<{ current_period_start?: number | null; current_period_end?: number | null }> };
  metadata?: Record<string, string>;
}, now = new Date()): Course360AppTier {
  const tier = subscription.metadata?.access_tier;
  if (tier !== "web" && tier !== "desktop" && tier !== "bundle") return "none";
  if (subscription.status === "trialing") {
    const trialEnd = stripeTimestamp(subscription.trial_end);
    return trialEnd && trialEnd > now ? tier : "none";
  }
  if (subscription.status !== "active") return "none";
  const paidThrough = getOrgSubscriptionPeriodDates(subscription).currentPeriodEnd;
  return paidThrough && paidThrough > now ? tier : "none";
}
