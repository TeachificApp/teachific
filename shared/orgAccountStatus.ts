export const ORG_ACCOUNT_STATUS_LABELS = {
  trialing: "Free trial",
  trial_ended: "Trial ended · awaiting billing update",
  active: "Active subscription",
  manual: "Active · admin-assigned access",
  legacy_free: "Legacy free access",
  past_due: "Past due",
  unpaid: "Unpaid",
  cancelled: "Cancelled",
  suspended: "Organization disabled",
  no_subscription: "No subscription recorded",
  unverified: "Billing status needs review",
} as const;
export type OrgAccountStatus = keyof typeof ORG_ACCOUNT_STATUS_LABELS;

type DateValue = Date | string | number | null | undefined;
export interface OrgAccountRecord {
  orgId: number;
  orgName: string;
  orgSlug: string;
  orgIsActive: boolean;
  ownerName: string | null;
  ownerEmail: string | null;
  joinedAt: DateValue;
  subscriptionId: number | null;
  plan: string | null;
  subscriptionStatus: string | null;
  rawStripeStatus?: string | null;
  stripeSubscriptionId: string | null;
  trialStartedAt: DateValue;
  trialEndsAt: DateValue;
  currentPeriodStart: DateValue;
  currentPeriodEnd: DateValue;
  cancelAtPeriodEnd: boolean | null;
  updatedAt: DateValue;
}
const DAY_MS = 24 * 60 * 60 * 1000;
function timestamp(value: DateValue): number | null {
  if (value == null) return null;
  const result = new Date(value).getTime();
  return Number.isFinite(result) ? result : null;
}

export function describeOrgAccount(record: OrgAccountRecord, now: number) {
  const recordedTrialStart = timestamp(record.trialStartedAt);
  const recordedTrialEnd = timestamp(record.trialEndsAt);
  const billingStatus = record.rawStripeStatus === "canceled" ? "cancelled" : record.rawStripeStatus ?? record.subscriptionStatus;
  // Older trials only saved their current billing period. Label that fallback
  // explicitly; never invent trial dates from account creation or a fixed 14 days.
  const start = recordedTrialStart ?? (billingStatus === "trialing" ? timestamp(record.currentPeriodStart) : null);
  const end = recordedTrialEnd ?? (billingStatus === "trialing" ? timestamp(record.currentPeriodEnd) : null);
  const validWindow = start != null && end != null && end > start;
  const isStripeLinked = Boolean(record.stripeSubscriptionId?.trim());
  let status: OrgAccountStatus;
  if (!record.orgIsActive) status = "suspended";
  else if (!record.subscriptionId) status = "no_subscription";
  else if (billingStatus === "trialing") status = !isStripeLinked ? "unverified" : end != null && end <= now ? "trial_ended" : "trialing";
  else if (billingStatus === "past_due" || billingStatus === "unpaid" || billingStatus === "cancelled") status = billingStatus;
  else if (billingStatus === "active") status = record.plan === "free" ? "legacy_free" : isStripeLinked ? "active" : "manual";
  else status = "unverified";
  const remainingMs = end == null ? null : Math.max(0, end - now);
  return {
    orgId: record.orgId,
    orgName: record.orgName,
    orgSlug: record.orgSlug,
    orgIsActive: record.orgIsActive,
    ownerName: record.ownerName,
    ownerEmail: record.ownerEmail,
    joinedAt: timestamp(record.joinedAt),
    plan: record.plan,
    status,
    statusLabel: ORG_ACCOUNT_STATUS_LABELS[status],
    billingStatus,
    isStripeLinked,
    trialStartedAt: start,
    trialEndsAt: end,
    trialDateSource: recordedTrialEnd != null ? "stripe_trial" as const : end != null ? "recorded_billing_period" as const : "unavailable" as const,
    trialDay: validWindow && now >= start! ? Math.min(Math.ceil((end! - start!) / DAY_MS), Math.floor((now - start!) / DAY_MS) + 1) : null,
    trialLengthDays: validWindow ? Math.ceil((end! - start!) / DAY_MS) : null,
    daysRemaining: remainingMs == null ? null : Math.ceil(remainingMs / DAY_MS),
    hoursRemaining: remainingMs == null ? null : Math.ceil(remainingMs / (60 * 60 * 1000)),
    trialProgressPercent: validWindow ? Math.round(Math.min(1, Math.max(0, (now - start!) / (end! - start!))) * 100) : null,
    currentPeriodEnd: timestamp(record.currentPeriodEnd),
    cancelAtPeriodEnd: Boolean(record.cancelAtPeriodEnd),
    updatedAt: timestamp(record.updatedAt),
  };
}
export type OrgAccountSummary = ReturnType<typeof describeOrgAccount>;
