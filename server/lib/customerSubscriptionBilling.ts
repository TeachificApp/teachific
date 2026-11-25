import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { getDb, getOrgIdForUserWithFallback, requireOrgAdmin } from "../db";
import { lmsEnrollments, lmsOrders, membershipMembers, memberships, organizations, orgMembers, orgPaymentSettings, userActiveOrg } from "../../drizzle/schema";
import { stripePeriodEnd, type CustomerSubscriptionBillingSnapshot } from "../../shared/customerSubscriptionBilling";
import { resolvePublicOrganizationScope, getPublicRequestHostname } from "./publicOrgRequestScope";

export type BillingOwner = { orgId: number; userId: number; subscriptionId: string };
type Subscription = Parameters<typeof stripePeriodEnd>[0] & {
  id: string; status: string; cancel_at_period_end: boolean;
  metadata?: Record<string, string>; customer?: string | { id: string };
};
export type CustomerStripeClient = { subscriptions: {
  retrieve(id: string, params?: object, options?: object): Promise<Subscription>;
  update(id: string, params: { cancel_at_period_end: boolean }, options?: object): Promise<Subscription>;
} };

export async function requireCustomerAdminScope(user: { id: number; role: string }) {
  const orgId = await getOrgIdForUserWithFallback(user.id, user.role);
  if (!orgId) throw new TRPCError({ code: "BAD_REQUEST", message: "No active organization context." });
  await requireOrgAdmin(user.id, user.role, orgId);
  return orgId;
}

/** No client school ID and no email matching. Ambiguous learner context fails closed. */
export async function resolveCustomerSchool(user: { id: number; role: string }, req?: Parameters<typeof resolvePublicOrganizationScope>[1]) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  const rows = await db.select({ orgId: orgMembers.orgId }).from(orgMembers).where(eq(orgMembers.userId, user.id));
  if (req && getPublicRequestHostname(req)) {
    const requestScope = await resolvePublicOrganizationScope(db, req);
    if (!requestScope) throw new TRPCError({ code: "FORBIDDEN", message: "This school's account context could not be verified." });
    if (requestScope.source !== "platform") {
      if (!rows.some(row => row.orgId === requestScope.id)) throw new TRPCError({ code: "FORBIDDEN", message: "You are not a member of this school." });
      return { db, orgId: requestScope.id };
    }
  }
  const [active] = await db.select({ orgId: userActiveOrg.orgId }).from(userActiveOrg).where(eq(userActiveOrg.userId, user.id)).limit(1);
  if (active && rows.some(row => row.orgId === active.orgId)) return { db, orgId: active.orgId };
  if (rows.length === 1) return { db, orgId: rows[0].orgId };
  throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Select a school before viewing subscriptions." });
}

/** Match checkout's account selection. Never fall back when an organization's own key fails. */
export async function getCustomerStripe(orgId: number): Promise<{ stripe: CustomerStripeClient; ownGateway: boolean; requestOptions: Record<string, string> }> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  const [settings] = await db.select({ stripeSecretKey: orgPaymentSettings.stripeSecretKey }).from(orgPaymentSettings)
    .where(eq(orgPaymentSettings.orgId, orgId)).limit(1);
  const [org] = await db.select({ paymentGateway: organizations.paymentGateway,
    ownStripeSecretKeyEncrypted: organizations.ownStripeSecretKeyEncrypted,
    stripeConnectAccountId: organizations.stripeConnectAccountId, stripeConnectStatus: organizations.stripeConnectStatus })
    .from(organizations).where(eq(organizations.id, orgId)).limit(1);
  const ownKey = settings?.stripeSecretKey ?? (org?.paymentGateway === "own_gateway" ? org.ownStripeSecretKeyEncrypted : null);
  if (ownKey) {
    if (!/^(sk|rk)_(test|live)_/.test(ownKey)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "School billing key format is unavailable." });
    const Stripe = (await import("stripe")).default;
    return { stripe: new Stripe(ownKey, { apiVersion: "2025-02-24.acacia" as any }) as unknown as CustomerStripeClient, ownGateway: true, requestOptions: {} };
  }
  if (org?.paymentGateway === "own_gateway") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "School billing is not configured." });
  const { getStripe } = await import("../stripePlans");
  const requestOptions: Record<string, string> = org?.stripeConnectStatus === "active" && org.stripeConnectAccountId?.startsWith("acct_")
    ? { stripeAccount: org.stripeConnectAccountId } : {};
  return { stripe: getStripe() as unknown as CustomerStripeClient, ownGateway: false, requestOptions };
}

export function assertCustomerBillingOwner(subscription: Subscription, owner: BillingOwner, ownGateway: boolean) {
  const org = subscription.metadata?.orgId ?? subscription.metadata?.org_id;
  const user = subscription.metadata?.userId ?? subscription.metadata?.user_id;
  if (subscription.id !== owner.subscriptionId || (org && org !== String(owner.orgId)) ||
      (user && user !== String(owner.userId)) || (!ownGateway && org !== String(owner.orgId))) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Subscription billing ownership could not be verified." });
  }
}

/** Resolve supplied Stripe IDs through local school-bound resources before any provider operation. */
export async function findCustomerSubscriptionOwner(orgId: number, subscriptionId: string): Promise<BillingOwner> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  const enrollments = await db.select({ userId: lmsEnrollments.userId }).from(lmsEnrollments)
    .where(and(eq(lmsEnrollments.orgId, orgId), eq(lmsEnrollments.stripeSubscriptionId, subscriptionId)));
  const orders = await db.select({ userId: lmsOrders.userId }).from(lmsOrders)
    .where(and(eq(lmsOrders.orgId, orgId), eq(lmsOrders.stripeSubscriptionId, subscriptionId)));
  const members = await db.select({ userId: membershipMembers.userId }).from(membershipMembers)
    .innerJoin(memberships, eq(membershipMembers.membershipId, memberships.id))
    .where(and(eq(memberships.orgId, orgId), eq(membershipMembers.stripeSubscriptionId, subscriptionId)));
  const ids = new Set([...enrollments, ...orders, ...members].map(row => row.userId));
  if (ids.size !== 1) throw new TRPCError({ code: "FORBIDDEN", message: "Subscription does not uniquely belong to this school's customer." });
  return { orgId, subscriptionId, userId: [...ids][0] };
}

export async function scheduleCustomerCancellation(owner: BillingOwner) {
  try {
    const { stripe, ownGateway, requestOptions } = await getCustomerStripe(owner.orgId);
    const live = await stripe.subscriptions.retrieve(owner.subscriptionId, {}, requestOptions);
    assertCustomerBillingOwner(live, owner, ownGateway);
    const ended = ["canceled", "cancelled", "incomplete_expired"].includes(live.status);
    if (ended) return { outcome: "already_ended" as const, periodEnd: stripePeriodEnd(live), status: live.status };
    // Never shorten access when the billing boundary is unavailable; do not mutate Stripe either.
    const periodEnd = stripePeriodEnd(live);
    if (!periodEnd) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Billing period end is unavailable; cancellation is not confirmed." });
    if (live.cancel_at_period_end === true) return { outcome: "already_scheduled" as const, periodEnd, status: live.status };
    const updated = await stripe.subscriptions.update(owner.subscriptionId, { cancel_at_period_end: true }, requestOptions);
    assertCustomerBillingOwner(updated, owner, ownGateway);
    if (updated.cancel_at_period_end !== true) throw new Error("Cancellation not confirmed");
    return { outcome: "scheduled" as const, periodEnd: stripePeriodEnd(updated) ?? periodEnd, status: updated.status };
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to confirm subscription cancellation. Access and payment records have not been changed." });
  }
}

/** Supplemental read-only snapshots: bounded workers and provider timeouts, never local flag inference. */
export async function loadCustomerBillingSnapshots(orgId: number, owners: readonly BillingOwner[]) {
  const checkedAt = new Date();
  const unique = [...new Map(owners.map(owner => [owner.subscriptionId, owner])).values()];
  const snapshots = new Map<string, CustomerSubscriptionBillingSnapshot>(unique.map(owner => [owner.subscriptionId, {
    subscriptionId: owner.subscriptionId, verified: false, status: null, cancelAtPeriodEnd: null, currentPeriodEnd: null, checkedAt,
  }]));
  if (!unique.length) return snapshots;
  let account: Awaited<ReturnType<typeof getCustomerStripe>>;
  try { account = await getCustomerStripe(orgId); } catch { return snapshots; }
  let next = 0;
  const deadline = Date.now() + 3000;
  async function worker() {
    while (next < unique.length && Date.now() < deadline) {
      const owner = unique[next++];
      if (owner.orgId !== orgId) continue;
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const timeout = Math.min(1250, deadline - Date.now());
        const live = await Promise.race([
          account.stripe.subscriptions.retrieve(owner.subscriptionId, {}, { ...account.requestOptions, timeout, maxNetworkRetries: 0 }),
          new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), timeout); }),
        ]);
        if (!live || Date.now() >= deadline) return;
        assertCustomerBillingOwner(live, owner, account.ownGateway);
        if (typeof live.status !== "string" || typeof live.cancel_at_period_end !== "boolean") continue;
        snapshots.set(owner.subscriptionId, { subscriptionId: owner.subscriptionId, verified: true, status: live.status,
          cancelAtPeriodEnd: live.cancel_at_period_end, currentPeriodEnd: stripePeriodEnd(live), checkedAt });
      } catch { /* Missing, wrong-account or unavailable provider results stay unverified. */ }
      finally { if (timer !== undefined) clearTimeout(timer); }
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, unique.length) }, worker));
  return snapshots;
}
