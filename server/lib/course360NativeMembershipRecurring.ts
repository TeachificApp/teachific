import { and, eq } from "drizzle-orm";
import { membershipPlans, membershipSubscriptions } from "../../drizzle/schema";
import { course360RecurringBindings as bindings, course360EntitlementTargets as targets, course360EntitlementSources as sources } from "./course360HostedCheckoutTables";
import { createHostedPurchase, hostedPurchaseMetadata, course360HostedCheckoutPurchases as purchases, assertCourse360HostedPersistenceReady, type HostedGateway } from "./course360HostedCheckout";
import { assertHostedIncludedContentScope } from "./course360HostedCheckoutReconciliation";

/** Native membership creation adapter. Caller MUST resolve authenticated user and active school first.
 * Reserve before creating Checkout; use returned metadata on BOTH Checkout and subscription_data.
 * Existing sessions lacking this new reservation cannot be safely adopted from email or metadata.
 * Common school signed ingress handles completion, failure, renewal and recovery without platform-plan fallthrough.
 */
export async function reserveCourse360NativeMembershipRecurring(db: any, input: { orgId: number; userId: number; planId: number; gateway: HostedGateway; currency?: string; trialDays?: number }) {
  for (const id of [input.orgId, input.userId, input.planId]) if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Native membership requires authenticated school/user/plan identity");
  const [plan] = await db.select().from(membershipPlans).where(and(eq(membershipPlans.id, input.planId), eq(membershipPlans.orgId, input.orgId))).limit(1);
  if (!plan || plan.isActive === false || !["monthly", "quarterly", "annual"].includes(plan.billingInterval) || !Number.isFinite(Number(plan.price)) || Number(plan.price) <= 0) throw new Error("Native recurring plan configuration is unavailable");
  await assertHostedIncludedContentScope(db, "membership_plan", plan);
  await assertCourse360HostedPersistenceReady(db, true);
  const trialDays = input.trialDays ?? 0;
  if (!Number.isSafeInteger(trialDays) || trialDays < 0 || trialDays > 730) throw new Error("Invalid native trial configuration");
  const purchase = await createHostedPurchase(db, { orgId: input.orgId, userId: input.userId, contentType: "membership_plan", contentId: input.planId, contentSlug: String(input.planId), gateway: input.gateway.gateway, accountId: input.gateway.accountId, pricingType: "subscription", unitPrice: Number(plan.price).toFixed(2), seats: 1, currency: (input.currency ?? "usd").toLowerCase(), trialDays, zeroPaymentEligible: 0 });
  return { purchase, metadata: hostedPurchaseMetadata(purchase), clientReferenceId: String(input.userId), idempotencyKey: `course360_hosted:${purchase.id}` };
}

/** Saved-plan billing linkage read: no absent schema columns, historical inference or provider calls.
 * Caller must authenticate requested user/school. Multiple real bindings are returned, never silently selected.
 */
export async function getCourse360SavedMembershipBindings(db: any, input: { orgId: number; userId: number; membershipSubscriptionId: number }) {
  const [saved] = await db.select().from(membershipSubscriptions).where(and(eq(membershipSubscriptions.id, input.membershipSubscriptionId), eq(membershipSubscriptions.orgId, input.orgId), eq(membershipSubscriptions.userId, input.userId))).limit(1);
  if (!saved) throw new Error("Saved membership is outside the authenticated school/user");
  const managed = await db.select().from(targets).where(and(eq(targets.orgId, input.orgId), eq(targets.userId, input.userId), eq(targets.family, "membership_plan"), eq(targets.resourceId, saved.planId), eq(targets.canonicalId, saved.id)));
  if (!managed.length) return { saved, verifiedLinkage: false, bindings: [] };
  const linkedSources = await db.select().from(sources).where(and(eq(sources.targetId, managed[0].id), eq(sources.orgId, input.orgId), eq(sources.userId, input.userId)));
  const all = await db.select().from(bindings).where(and(eq(bindings.orgId, input.orgId), eq(bindings.userId, input.userId), eq(bindings.contentType, "membership_plan"), eq(bindings.contentId, saved.planId)));
  const linked = all.filter((binding: any) => linkedSources.some((source: any) => source.purchaseId === binding.purchaseId && source.subscriptionId === binding.subscriptionId));
  return { saved, verifiedLinkage: linked.length > 0, bindings: linked };
}

/** Attach the provider-created native session to the server-owned reservation; no caller metadata adoption. */
export async function attachCourse360NativeMembershipSession(db: any, input: { purchaseId: string; orgId: number; userId: number; gateway: HostedGateway; session: any }) {
  await db.transaction(async (tx: any) => {
    const [purchase] = await tx.select().from(purchases).where(and(eq(purchases.id, input.purchaseId), eq(purchases.orgId, input.orgId), eq(purchases.userId, input.userId))).for("update").limit(1);
    if (!purchase || purchase.contentType !== "membership_plan" || purchase.status !== "pending" || purchase.gateway !== input.gateway.gateway || purchase.accountId !== input.gateway.accountId || input.session?.mode !== "subscription" || !/^cs_/.test(input.session?.id ?? "") || input.session.client_reference_id !== String(purchase.userId)) throw new Error("Native session does not match its trusted purchase reservation");
    for (const [key, value] of Object.entries(hostedPurchaseMetadata(purchase))) if (input.session.metadata?.[key] !== value) throw new Error("Native session metadata does not match immutable reservation");
    if (purchase.stripeSessionId && purchase.stripeSessionId !== input.session.id) throw new Error("Native purchase already has another session");
    const subscriptionId = typeof input.session.subscription === "string" ? input.session.subscription : input.session.subscription?.id ?? null;
    await tx.update(purchases).set({ stripeSessionId: input.session.id, stripeSubscriptionId: subscriptionId }).where(and(eq(purchases.id, purchase.id), eq(purchases.orgId, input.orgId), eq(purchases.userId, input.userId)));
  });
}
