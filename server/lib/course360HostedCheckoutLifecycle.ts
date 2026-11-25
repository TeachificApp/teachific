import { and, eq } from "drizzle-orm";
import { course360HostedCheckoutPurchases as purchases, hostedPurchaseMetadata, type HostedPurchase, type HostedGateway } from "./course360HostedCheckout";
import { course360RecurringBindings as bindings, course360EntitlementSources as sources, course360EntitlementTargets as targets } from "./course360HostedCheckoutTables";
import { projectHostedEntitlementTarget } from "./course360HostedCheckoutEntitlements";
import { getOrgSubscriptionPeriodDates, stripeTimestamp } from "./orgSubscriptionTrialDates";
import { stripeObjectId } from "./course360WebhookLifecycle";

export function course360RecurringState(subscription: any, now = Date.now()) {
  const period = getOrgSubscriptionPeriodDates(subscription).currentPeriodEnd;
  const trial = stripeTimestamp(subscription.trial_end);
  const candidate = subscription.status === "trialing" ? trial && (period ? new Date(Math.min(trial.getTime(), period.getTime())) : trial) : period;
  const end = candidate && candidate.getTime() <= Date.UTC(2038, 0, 19, 3, 14, 7) ? candidate : null;
  const active = ["active", "trialing"].includes(subscription.status) && !!end && end.getTime() > now;
  return { active, cutoff: end ?? null, rawStatus: String(subscription.status ?? "unknown").slice(0, 64), cancelAtPeriodEnd: Number(subscription.cancel_at_period_end === true) };
}
export function assertHostedSubscriptionIdentity(subscription: any, purchase: HostedPurchase, customerId: string, livemode: boolean) {
  if (!subscription?.id || subscription.id !== purchase.stripeSubscriptionId || stripeObjectId(subscription.customer) !== customerId || subscription.livemode !== livemode) throw new Error("Hosted recurring subscription/customer/mode identity mismatch");
  const metadata = hostedPurchaseMetadata(purchase);
  for (const [key, value] of Object.entries(metadata)) if (subscription.metadata?.[key] !== value) throw new Error("Hosted recurring immutable product identity mismatch");
}
export async function persistCourse360RecurringBinding(tx: any, purchase: HostedPurchase, subscription: any, customerId: string, livemode: boolean) {
  assertHostedSubscriptionIdentity(subscription, purchase, customerId, livemode);
  const state = course360RecurringState(subscription);
  if (!state.active) throw new Error("Hosted initial recurring grant requires a finite usable period");
  const [prior] = await tx.select().from(bindings).where(and(eq(bindings.accountId, purchase.accountId), eq(bindings.subscriptionId, subscription.id), eq(bindings.livemode, Number(livemode)))).for("update").limit(1);
  const row = { id: purchase.id, purchaseId: purchase.id, orgId: purchase.orgId, userId: purchase.userId, contentType: purchase.contentType, contentId: purchase.contentId, gateway: purchase.gateway, accountId: purchase.accountId, subscriptionId: subscription.id, customerId, livemode: Number(livemode), rawStatus: state.rawStatus, periodEnd: state.cutoff, cancelAtPeriodEnd: state.cancelAtPeriodEnd, updatedAt: new Date() };
  if (prior && ["purchaseId", "orgId", "userId", "contentType", "contentId", "gateway", "accountId", "subscriptionId", "customerId", "livemode"].some(key => prior[key] !== (row as any)[key])) throw new Error("Recurring binding already belongs to another purchase");
  if (!prior) await tx.insert(bindings).values(row);
}
/** Signature-authenticated routing context only. Retrieval occurs AFTER row lock to prevent stale concurrent projections. */
export async function reconcileCourse360HostedRecurring(input: { db: any; subscriptionId: string; verifiedAccountId: string; verifiedOrgId: number; livemode: boolean; gateway: HostedGateway }) {
  const { db, gateway } = input;
  if (gateway.accountId !== input.verifiedAccountId) throw new Error("Recurring verified account mismatch");
  if (!/^sub_/.test(input.subscriptionId ?? "")) throw new Error("Invalid recurring subscription reference");
  const matches = await db.select().from(bindings).where(and(eq(bindings.accountId, input.verifiedAccountId), eq(bindings.subscriptionId, input.subscriptionId), eq(bindings.livemode, Number(input.livemode))));
  if (!matches.length) {
    // Known hosted pending purchase must retry until Checkout establishes immutable customer/source linkage.
    const pending = await db.select().from(purchases).where(and(eq(purchases.accountId, input.verifiedAccountId), eq(purchases.stripeSubscriptionId, input.subscriptionId)));
    if (pending.length) throw new Error("Hosted recurring Checkout binding not completed; retry");
    const current = await gateway.stripe.subscriptions.retrieve(input.subscriptionId, {}, gateway.requestOptions);
    if (current.metadata?.type === "course360_hosted_checkout_v1" || current.metadata?.type === "membership" || current.metadata?.membership_plan_id) throw new Error("Recurring school purchase requires immutable Checkout reservation/binding; retry");
    return { handled: false };
  }
  if (matches.length !== 1) throw new Error("Ambiguous recurring account identity");
  return db.transaction(async (tx: any) => {
    const [binding] = await tx.select().from(bindings).where(eq(bindings.id, matches[0].id)).for("update").limit(1);
    if (!binding || binding.orgId !== input.verifiedOrgId || binding.gateway !== gateway.gateway) throw new Error("Recurring school/gateway binding mismatch");
    const [purchase] = await tx.select().from(purchases).where(and(eq(purchases.id, binding.purchaseId), eq(purchases.orgId, binding.orgId))).limit(1);
    if (!purchase || purchase.status !== "completed" || purchase.userId !== binding.userId || purchase.contentType !== binding.contentType || purchase.contentId !== binding.contentId || purchase.accountId !== binding.accountId || purchase.gateway !== binding.gateway || purchase.stripeSubscriptionId !== binding.subscriptionId) throw new Error("Recurring immutable ledger identity mismatch");
    const subscription = await gateway.stripe.subscriptions.retrieve(binding.subscriptionId, {}, gateway.requestOptions);
    assertHostedSubscriptionIdentity(subscription, purchase, binding.customerId, input.livemode);
    const state = course360RecurringState(subscription);
    await tx.update(bindings).set({ rawStatus: state.rawStatus, periodEnd: state.cutoff, cancelAtPeriodEnd: state.cancelAtPeriodEnd, updatedAt: new Date() }).where(eq(bindings.id, binding.id));
    const affected = await tx.select().from(sources).where(and(eq(sources.purchaseId, purchase.id), eq(sources.subscriptionId, binding.subscriptionId), eq(sources.orgId, binding.orgId), eq(sources.userId, binding.userId)));
    affected.sort((a: any, b: any) => a.targetId.localeCompare(b.targetId) || a.id.localeCompare(b.id));
    for (const source of affected) {
      const [target] = await tx.select().from(targets).where(eq(targets.id, source.targetId)).for("update").limit(1);
      if (!target || target.orgId !== binding.orgId || target.userId !== binding.userId || target.family !== source.family || target.resourceId !== source.resourceId) throw new Error("Recurring source target identity mismatch");
      await tx.update(sources).set({ status: state.active ? "active" : "expired", cutoff: state.cutoff, updatedAt: new Date() }).where(and(eq(sources.id, source.id), eq(sources.purchaseId, purchase.id), eq(sources.subscriptionId, binding.subscriptionId)));
      await projectHostedEntitlementTarget(tx, target);
    }
    return { handled: true, status: state.rawStatus, active: state.active, purchaseId: purchase.id };
  });
}
