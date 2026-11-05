function stripeTimestamp(value: number | null | undefined): Date | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  const date = new Date(value * 1000);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function getOrgSubscriptionTrialDates(subscription: {
  trial_start?: number | null;
  trial_end?: number | null;
  status?: string;
}) {
  return {
    trialStartedAt: stripeTimestamp(subscription.trial_start),
    trialEndsAt: stripeTimestamp(subscription.trial_end),
    ...(subscription.status ? { rawStripeStatus: subscription.status.slice(0, 64) } : {}),
  };
}

export function isOrgPlatformSubscription(subscription: {
  id: string;
  metadata?: Record<string, string> | null;
}, savedSubscriptionId: string | null | undefined): boolean {
  if (!savedSubscriptionId || savedSubscriptionId !== subscription.id) return false;
  const metadata = subscription.metadata;
  return !metadata?.content_type && !metadata?.content_id && !metadata?.product_type && !metadata?.product_id;
}
