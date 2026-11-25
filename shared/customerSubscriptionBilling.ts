export type CustomerSubscriptionBillingSnapshot = {
  subscriptionId: string;
  verified: boolean;
  status: string | null;
  cancelAtPeriodEnd: boolean | null;
  currentPeriodEnd: Date | null;
  checkedAt: Date;
};

/** Stripe alone uses seconds. All returned/stored/displayed dates use Date/UTC milliseconds. */
export function stripePeriodEnd(subscription: {
  current_period_end?: number | null;
  trial_end?: number | null;
  items?: { data?: Array<{ current_period_end?: number | null }> } | null;
}): Date | null {
  const fromSeconds = (value: unknown): Date | null => {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
    const date = new Date(value * 1000);
    return Number.isFinite(date.getTime()) ? date : null;
  };
  const legacy = fromSeconds(subscription.current_period_end);
  if (legacy) return legacy;
  const ends = (subscription.items?.data ?? []).map(item => fromSeconds(item.current_period_end))
    .filter((date): date is Date => date !== null);
  // Mixed-interval subscriptions cancel at the earliest item billing boundary.
  return ends.length ? new Date(Math.min(...ends.map(date => date.getTime()))) : fromSeconds(subscription.trial_end);
}

/** Expiry and cached cancellation flags are deliberately not evidence of Stripe cancellation. */
export function subscriptionCancellationState(subscriptionId?: string | null, snapshot?: CustomerSubscriptionBillingSnapshot | null) {
  if (!subscriptionId || snapshot?.subscriptionId !== subscriptionId || !snapshot.verified || !snapshot.status ||
      !["active", "trialing", "past_due", "unpaid", "paused", "incomplete", "incomplete_expired", "canceled", "cancelled"].includes(snapshot.status)) {
    return { kind: "unverified", label: "Subscription status unavailable — not verified" } as const;
  }
  if (["canceled", "cancelled"].includes(snapshot.status)) {
    return { kind: "cancelled", label: "Subscription cancelled — will not renew" } as const;
  }
  if (snapshot.status === "incomplete_expired") {
    return { kind: "ended", label: "Subscription ended — will not renew" } as const;
  }
  if (typeof snapshot.cancelAtPeriodEnd !== "boolean") {
    return { kind: "unverified", label: "Subscription status unavailable — not verified" } as const;
  }
  return snapshot.cancelAtPeriodEnd
    ? { kind: "cancelled", label: "Subscription cancelled — will not renew" } as const
    : { kind: "not-cancelled", label: "Subscription not cancelled" } as const;
}

export function isConfirmedSubscriptionCancellation(subscriptionId?: string | null, snapshot?: CustomerSubscriptionBillingSnapshot | null): boolean {
  const kind = subscriptionCancellationState(subscriptionId, snapshot).kind;
  return kind === "cancelled" || kind === "ended";
}

/** Database amounts are dollars; convert to cents only when invoking Stripe. */
export function formatStoredDollars(amount: number | string, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(Number(amount));
}
