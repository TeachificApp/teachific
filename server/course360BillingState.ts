import type Stripe from "stripe";
import { getOrgSubscriptionTrialDates } from "./lib/orgSubscriptionTrialDates";

export function isTerminalPlatformSubscription(
  status: string | null | undefined
): boolean {
  return (
    status === "canceled" ||
    status === "cancelled" ||
    status === "incomplete_expired"
  );
}

/** Keep raw Stripe status; the existing persistence enum cannot represent all Stripe states. */
export function platformBillingStatus(
  status: string
): "active" | "trialing" | "past_due" | "cancelled" | "unpaid" {
  if (status === "active" || status === "trialing" || status === "past_due")
    return status;
  return isTerminalPlatformSubscription(status) ? "cancelled" : "unpaid";
}

function dateFromSeconds(value: number | null | undefined): Date | null {
  return value != null && Number.isFinite(value) && value > 0
    ? new Date(value * 1000)
    : null;
}

export function confirmedPlatformBillingState(
  subscription: Stripe.Subscription
) {
  const item = subscription.items.data[0];
  const legacy = subscription as Stripe.Subscription & {
    current_period_start?: number;
    current_period_end?: number;
  };
  return {
    status: platformBillingStatus(subscription.status),
    ...getOrgSubscriptionTrialDates(subscription),
    stripeSubscriptionId: subscription.id,
    stripeCustomerId:
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id,
    currentPeriodStart: dateFromSeconds(
      item?.current_period_start ?? legacy.current_period_start
    ),
    currentPeriodEnd: dateFromSeconds(
      item?.current_period_end ?? legacy.current_period_end
    ),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  };
}

/** Local serialization/reuse is defense in depth, not a distributed checkout ledger. */
const pendingSchoolCheckouts = new Map<
  number,
  {
    fingerprint: string;
    expiresAt: number;
    promise: Promise<{ url: string | null }>;
  }
>();
export async function reusePendingSchoolCheckout(
  orgId: number,
  fingerprint: string,
  create: () => Promise<{ url: string | null }>,
  now = Date.now()
): Promise<{ url: string | null }> {
  const pending = pendingSchoolCheckouts.get(orgId);
  if (pending && pending.expiresAt > now) {
    if (pending.fingerprint !== fingerprint)
      throw new Error(
        "A checkout for this school is already pending. Complete it or wait 30 minutes before changing the selection."
      );
    return pending.promise;
  }
  const promise = Promise.resolve().then(create);
  const entry = { fingerprint, expiresAt: now + 30 * 60 * 1000, promise };
  pendingSchoolCheckouts.set(orgId, entry);
  try {
    return await promise;
  } catch (error) {
    if (pendingSchoolCheckouts.get(orgId) === entry)
      pendingSchoolCheckouts.delete(orgId);
    throw error;
  }
}

/** Preserve phase-level discounts and item tax/discount configuration from Stripe's adopted schedule. */
export function preservedSchoolSchedulePhase(
  phase: Stripe.SubscriptionSchedule.Phase
): Stripe.SubscriptionScheduleUpdateParams.Phase {
  if (
    phase.add_invoice_items?.length ||
    phase.billing_thresholds ||
    phase.transfer_data ||
    phase.on_behalf_of ||
    phase.application_fee_percent != null ||
    phase.automatic_tax?.liability ||
    phase.invoice_settings?.issuer ||
    phase.items.some(item => item.billing_thresholds)
  ) {
    throw new Error(
      "This subscription has custom billing configuration. Please manage its schedule in the billing portal."
    );
  }
  const id = (value: unknown): string => {
    if (typeof value === "string") return value;
    if (
      value &&
      typeof value === "object" &&
      "id" in value &&
      typeof value.id === "string"
    )
      return value.id;
    throw new Error("Stripe returned an unavailable billing reference");
  };
  const discount = (value: {
    discount?: unknown;
    coupon?: unknown;
    promotion_code?: unknown;
  }) =>
    value.discount
      ? { discount: id(value.discount) }
      : value.coupon
        ? { coupon: id(value.coupon) }
        : { promotion_code: id(value.promotion_code) };
  return {
    start_date: phase.start_date,
    end_date: phase.end_date,
    items: phase.items.map(item => ({
      price: id(item.price),
      quantity: item.quantity ?? 1,
      ...(item.tax_rates?.length ? { tax_rates: item.tax_rates.map(id) } : {}),
      ...(item.metadata ? { metadata: item.metadata } : {}),
      ...(item.discounts?.length
        ? { discounts: item.discounts.map(discount) }
        : {}),
    })),
    ...(phase.discounts?.length
      ? { discounts: phase.discounts.map(discount) }
      : {}),
    ...(phase.default_tax_rates?.length
      ? { default_tax_rates: phase.default_tax_rates.map(id) }
      : {}),
    ...(phase.collection_method
      ? { collection_method: phase.collection_method }
      : {}),
    ...(phase.default_payment_method
      ? { default_payment_method: id(phase.default_payment_method) }
      : {}),
    ...(phase.metadata ? { metadata: phase.metadata } : {}),
    ...(phase.description != null ? { description: phase.description } : {}),
    ...(phase.automatic_tax
      ? { automatic_tax: { enabled: phase.automatic_tax.enabled } }
      : {}),
    ...(phase.billing_cycle_anchor
      ? { billing_cycle_anchor: phase.billing_cycle_anchor }
      : {}),
    ...(phase.invoice_settings
      ? {
          invoice_settings: {
            ...(phase.invoice_settings.days_until_due != null
              ? { days_until_due: phase.invoice_settings.days_until_due }
              : {}),
            ...(phase.invoice_settings.account_tax_ids?.length
              ? {
                  account_tax_ids:
                    phase.invoice_settings.account_tax_ids.map(id),
                }
              : {}),
          },
        }
      : {}),
    ...(phase.trial_end ? { trial_end: phase.trial_end } : {}),
    proration_behavior: "none",
  };
}

/** One target billing period; use explicit end_date rather than SDK-version-specific duration fields. */
export function nextSchoolBillingPeriodEnd(
  startSeconds: number,
  interval: "monthly" | "annual"
): number {
  const date = new Date(startSeconds * 1000);
  const targetMonth = date.getUTCMonth() + (interval === "annual" ? 12 : 1);
  const year = date.getUTCFullYear() + Math.floor(targetMonth / 12);
  const month = targetMonth % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Math.floor(
    Date.UTC(
      year,
      month,
      Math.min(date.getUTCDate(), lastDay),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds()
    ) / 1000
  );
}
