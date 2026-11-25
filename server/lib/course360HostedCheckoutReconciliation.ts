import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  organizations, users, lmsCourses, lmsOrders, lmsEnrollments, lmsPricingOptions,
  memberships, membershipMembers, membershipContent, membershipPlans, membershipSubscriptions,
  membershipPlanAccess, webinars, webinarRegistrations, bundles, bundleItems, bundleEnrollments,
  bundlePricingOptions, digitalProducts, digitalProductPrices, digitalOrders, digitalPurchases,
  physicalProducts, physicalProductOrders, physicalProductPricingOptions, workshops, workshopRegistrations, orderBumps, orderBumpConversions,
} from "../../drizzle/schema";
import { ENV } from "../_core/env";
import {
  COURSE360_HOSTED_CHECKOUT_FAMILY, course360HostedCheckoutPurchases as purchases,
  validateHostedSession, resolveCourse360HostedGateway, settledHostedDollars,
  hostedEnrollmentHasCurrentFullAccess,
  type HostedPurchase, type HostedGateway, type HostedContentType,
} from "./course360HostedCheckout";

import { course360RecurringBindings } from "./course360HostedCheckoutTables";
import { resolveProtectedCourse360PurchaseGateway } from "./course360SchoolStripeGateway";
import { recordHostedEntitlement } from "./course360HostedCheckoutEntitlements";
import { assertHostedSubscriptionIdentity, course360RecurringState, persistCourse360RecurringBinding } from "./course360HostedCheckoutLifecycle";

const tables = { course: lmsCourses, download: digitalProducts, physical_product: physicalProducts, webinar: webinars, membership: memberships, membership_plan: membershipPlans, workshop: workshops, bundle: bundles };

export async function resolveHostedOwnedContent(db: any, type: HostedContentType, id: number, orgId: number) {
  const table = tables[type];
  if (!table) throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown hosted content family" });
  const [content] = await db.select().from(table).where(and(eq(table.id, id), eq(table.orgId, orgId))).limit(1);
  if (!content || content.orgId !== orgId) throw new TRPCError({ code: "FORBIDDEN", message: "Checkout item is not in this school." });
  return content;
}

/** Server-owned content must be resolved before this price check; parent relation is never client-selected. */
export async function assertHostedPricingOption(db: any, purchase: Pick<HostedPurchase, "contentType" | "contentId" | "orgId" | "pricingOptionId">) {
  if (!purchase.pricingOptionId) return;
  const table = purchase.contentType === "course" ? lmsPricingOptions : purchase.contentType === "download" ? digitalProductPrices : purchase.contentType === "bundle" ? bundlePricingOptions : purchase.contentType === "physical_product" ? physicalProductPricingOptions : null;
  if (!table) throw new TRPCError({ code: "BAD_REQUEST", message: "This item does not have selectable pricing tiers." });
  const parent = purchase.contentType === "course" ? lmsPricingOptions.courseId : purchase.contentType === "download" ? digitalProductPrices.productId : purchase.contentType === "bundle" ? bundlePricingOptions.bundleId : physicalProductPricingOptions.productId;
  const [option] = await db.select().from(table).where(and(eq(table.id, purchase.pricingOptionId), eq(parent, purchase.contentId))).limit(1);
  if (!option || option.isActive === false) throw new TRPCError({ code: "BAD_REQUEST", message: "The selected price is not available for this item." });
}

async function buyer(db: any, purchase: HostedPurchase) {
  const [user] = await db.select().from(users).where(eq(users.id, purchase.userId)).limit(1);
  if (!user?.email) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "A buyer email is required to grant access." });
  return user;
}

async function grantCourse(db: any, purchase: HostedPurchase, courseId: number, orderId: number | null, accessExpiresAt: Date | null, source: string) {
  await resolveHostedOwnedContent(db, "course", courseId, purchase.orgId);
  await recordHostedEntitlement(db, purchase, "course", courseId, accessExpiresAt, { orderId, source });
}
async function grantDownload(db: any, purchase: HostedPurchase, productId: number, periodEnd: Date | null = null, recurring = true) {
  await resolveHostedOwnedContent(db, "download", productId, purchase.orgId);
  await recordHostedEntitlement(db, recurring ? purchase : { ...purchase, stripeSubscriptionId: null }, "download", productId, periodEnd);
}
async function grantWebinar(db: any, purchase: HostedPurchase, webinarId: number, user: any, periodEnd: Date | null = null) {
  await resolveHostedOwnedContent(db, "webinar", webinarId, purchase.orgId);
  await recordHostedEntitlement(db, purchase, "webinar", webinarId, periodEnd);
}

/** Validate entitlement links before recording a paid grant. Canonical memberships retain their own access rules. */
export async function assertHostedIncludedContentScope(db: any, type: HostedContentType, content: any) {
  if (type === "bundle") {
    const ids = parseCourseIds(content.courseIds);
    for (const id of ids) await resolveHostedOwnedContent(db, "course", id, content.orgId);
    const items = await db.select().from(bundleItems).where(eq(bundleItems.bundleId, content.id));
    for (const item of items) {
      const family = item.itemType === "download" ? "download" : item.itemType === "product" ? "physical_product" : item.itemType;
      if (!["course", "download", "physical_product", "webinar"].includes(family)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This bundle item needs a school-bound entitlement adapter." });
      await resolveHostedOwnedContent(db, family, item.itemId, content.orgId);
      if (family === "physical_product") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Bundle physical item fulfillment needs a shipping/order adapter." });
    }
  } else if (type === "membership") {
    for (const id of parseCourseIds(content.courseIds)) await resolveHostedOwnedContent(db, "course", id, content.orgId);
    const items = await db.select().from(membershipContent).where(eq(membershipContent.membershipId, content.id));
    for (const item of items) {
      const family = item.contentType === "digital_product" ? "download" : item.contentType;
      if (!["course", "download", "webinar"].includes(family)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This membership item needs a school-bound entitlement adapter." });
      await resolveHostedOwnedContent(db, family, item.contentId, content.orgId);
    }
  } else if (type === "membership_plan") {
    const items = await db.select().from(membershipPlanAccess).where(and(eq(membershipPlanAccess.planId, content.id), eq(membershipPlanAccess.orgId, content.orgId)));
    for (const item of items) {
      const family = item.resourceType === "digital_product" ? "download" : item.resourceType;
      if (!["course", "download", "webinar"].includes(family)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This plan item needs a school-bound entitlement adapter." });
      await resolveHostedOwnedContent(db, family, item.resourceId, content.orgId);
    }
  }
}

function parseCourseIds(value: any): number[] {
  if (!value) return [];
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!Array.isArray(parsed) || parsed.some(id => !Number.isSafeInteger(id) || id <= 0)) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid included course configuration" });
  return [...new Set(parsed)] as number[];
}

async function grantCanonicalHostedAccess(db: any, purchase: HostedPurchase, content: any, periodEnd: Date | null) {
  const user = await buyer(db, purchase);
  const amount = purchase.amount ?? "0.00";
  switch (purchase.contentType) {
    case "course": {
      const [order] = await db.insert(lmsOrders).values({ orgId: purchase.orgId, userId: purchase.userId, courseId: purchase.contentId, amount, currency: purchase.currency, status: "completed", stripeSessionId: purchase.stripeSessionId, stripeSubscriptionId: purchase.stripeSubscriptionId, stripePaymentIntentId: purchase.stripePaymentIntentId, seats: purchase.seats, pricingOptionId: purchase.pricingOptionId, completedAt: new Date() }).$returningId();
      await grantCourse(db, purchase, purchase.contentId, order.id, periodEnd, "course360_hosted_course");
      break;
    }
    case "membership": {
      await recordHostedEntitlement(db, purchase, "membership", purchase.contentId, periodEnd);
      const courseIds = content.courseAccess === "all"
        ? (await db.select().from(lmsCourses).where(eq(lmsCourses.orgId, purchase.orgId))).filter((row: any) => row.status === "published").map((row: any) => row.id)
        : parseCourseIds(content.courseIds);
      for (const courseId of courseIds) await grantCourse(db, purchase, courseId, null, periodEnd, `course360_hosted_membership:${purchase.contentId}`);
      const items = await db.select().from(membershipContent).where(eq(membershipContent.membershipId, purchase.contentId));
      for (const item of items) {
        if (item.contentType === "course" && !courseIds.includes(item.contentId)) await grantCourse(db, purchase, item.contentId, null, periodEnd, `course360_hosted_membership:${purchase.contentId}`);
        else if (item.contentType === "digital_product") await grantDownload(db, purchase, item.contentId, periodEnd);
        else if (item.contentType === "webinar") await grantWebinar(db, purchase, item.contentId, user, periodEnd);
      }
      break;
    }
    case "membership_plan": {
      await recordHostedEntitlement(db, purchase, "membership_plan", purchase.contentId, periodEnd);
      const items = await db.select().from(membershipPlanAccess).where(and(eq(membershipPlanAccess.planId, purchase.contentId), eq(membershipPlanAccess.orgId, purchase.orgId)));
      for (const item of items) {
        if (item.resourceType === "course") await grantCourse(db, purchase, item.resourceId, null, periodEnd, `course360_hosted_membership_plan:${purchase.contentId}`);
        else if (["download", "digital_product"].includes(item.resourceType)) await grantDownload(db, purchase, item.resourceId, periodEnd);
        else if (item.resourceType === "webinar") await grantWebinar(db, purchase, item.resourceId, user, periodEnd);
      }
      break;
    }
    case "bundle": {
      await recordHostedEntitlement(db, purchase, "bundle", purchase.contentId, periodEnd, { pricingOptionId: purchase.pricingOptionId ? String(purchase.pricingOptionId) : null, stripePaymentIntentId: purchase.stripePaymentIntentId });
      const ids = new Set(parseCourseIds(content.courseIds));
      const items = await db.select().from(bundleItems).where(eq(bundleItems.bundleId, purchase.contentId));
      for (const item of items) {
        if (item.itemType === "course") ids.add(item.itemId);
        else if (item.itemType === "download") await grantDownload(db, purchase, item.itemId, periodEnd);
        else if (item.itemType === "webinar") await grantWebinar(db, purchase, item.itemId, user, periodEnd);
      }
      for (const id of ids) await grantCourse(db, purchase, id, null, periodEnd, `course360_hosted_bundle:${purchase.contentId}`);
      break;
    }
    case "webinar": await grantWebinar(db, purchase, purchase.contentId, user, periodEnd); break;
    case "download": {
      await db.insert(digitalOrders).values({ productId: purchase.contentId, priceId: purchase.pricingOptionId ?? content.primaryPriceId ?? 0, orgId: purchase.orgId, buyerEmail: user.email, buyerName: user.name, amount, currency: purchase.currency, status: "paid", paymentRef: purchase.stripePaymentIntentId ?? purchase.stripeSessionId ?? purchase.id, downloadToken: randomBytes(24).toString("hex"), paidAt: new Date() });
      await grantDownload(db, purchase, purchase.contentId, periodEnd);
      break;
    }
    case "physical_product": await db.insert(physicalProductOrders).values({ userId: purchase.userId, productId: purchase.contentId, pricingOptionId: purchase.pricingOptionId, amountPaid: amount, currency: purchase.currency, stripeCheckoutSessionId: purchase.stripeSessionId, stripePaymentIntentId: purchase.stripePaymentIntentId, fulfillmentStatus: "pending", orderedAt: new Date() }); break;
    case "workshop": {
      const [existing] = await db.select().from(workshopRegistrations).where(and(eq(workshopRegistrations.workshopId, purchase.contentId), eq(workshopRegistrations.userId, purchase.userId))).limit(1);
      const values = { workshopId: purchase.contentId, userId: purchase.userId, email: user.email, status: "registered", amountPaid: amount, currency: purchase.currency, stripeSessionId: purchase.stripeSessionId, stripePaymentIntentId: purchase.stripePaymentIntentId };
      if (existing) await db.update(workshopRegistrations).set(values).where(and(eq(workshopRegistrations.id, existing.id), eq(workshopRegistrations.workshopId, purchase.contentId)));
      else await db.insert(workshopRegistrations).values(values);
      break;
    }
  }
  // Bump IDs are the immutable set actually charged, not unvalidated client selections.
  for (const id of (purchase.selectedBumpIds ?? "").split(",").filter(Boolean).map(Number)) {
    const [bump] = await db.select().from(orderBumps).where(and(eq(orderBumps.id, id), eq(orderBumps.orgId, purchase.orgId))).limit(1);
    if (!bump || bump.triggerProductId !== purchase.contentId || bump.triggerProductType !== purchase.contentType) throw new Error("Hosted bump ownership mismatch");
    if (bump.bumpProductType === "course") await grantCourse(db, { ...purchase, stripeSubscriptionId: null }, bump.bumpProductId, null, null, `course360_hosted_bump:${id}`);
    else if (bump.bumpProductType === "download") await grantDownload(db, purchase, bump.bumpProductId, null, false);
    else throw new Error("Hosted bump entitlement adapter missing");
    await db.insert(orderBumpConversions).values({ bumpId: id, orgId: purchase.orgId, accepted: true, sessionId: purchase.stripeSessionId ?? purchase.id });
  }
}

function providerId(value: any): string | null { return typeof value === "string" ? value : value?.id ?? null; }

export type Course360HostedReconciliationResult = { handled: boolean; success: boolean; alreadyGranted?: boolean; status?: string; purchaseId?: string; orgId?: number; userId?: number; contentType?: string; slug?: string };
export type Course360HostedSignedSessionInput = {
  db: any;
  /** Stripe-verified event.data.object, never an HTTP JSON body before signature verification. */
  signedSession: any;
  /** Verified event.account for Connect; verified endpoint account ID for an own-gateway endpoint. Never metadata. */
  verifiedAccountId: string;
  /** Internal return-confirmation may reuse the already server-resolved gateway and authenticated target. */
  gateway?: HostedGateway;
  /** Explicit test/live mode from protected signature context. */
  verifiedLivemode?: boolean;
  expected?: { userId: number; orgId: number; contentType: string; contentId: number; slug: string };
};

/** Stable parent webhook contract. Core DB errors deliberately throw to keep delivery retryable. */
export async function reconcileCourse360HostedSignedSession(input: Course360HostedSignedSessionInput): Promise<Course360HostedReconciliationResult> {
  const { db, signedSession } = input;
  if (signedSession.metadata?.type !== COURSE360_HOSTED_CHECKOUT_FAMILY) return { handled: false, success: false };
  const id = signedSession.metadata?.hosted_purchase_id;
  const [purchase] = await db.select().from(purchases).where(eq(purchases.id, id)).limit(1);
  if (!purchase) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Hosted purchase is missing; reconciliation must retry." });
  const [org] = await db.select().from(organizations).where(eq(organizations.id, purchase.orgId)).limit(1);
  const gateway = input.gateway ?? await resolveProtectedCourse360PurchaseGateway(db, purchase) ?? await resolveCourse360HostedGateway(org, ENV.stripeSecretKey, db);
  if (!input.verifiedAccountId || input.verifiedAccountId !== gateway.accountId) throw new TRPCError({ code: "FORBIDDEN", message: "Verified event account mismatch." });
  // Fresh authoritative retrieval also recovers asynchronous payments; all calls use the stored school's account.
  const session = await gateway.stripe.checkout.sessions.retrieve(signedSession.id, { expand: ["subscription", "payment_intent"] }, gateway.requestOptions);
  if (input.verifiedLivemode != null && (signedSession.livemode !== input.verifiedLivemode || session.livemode !== input.verifiedLivemode)) throw new Error("Hosted verified event mode mismatch");
  validateHostedSession(signedSession, purchase, gateway, input.expected);
  if (!validateHostedSession(session, purchase, gateway, input.expected)) return { handled: true, success: false, status: session.payment_status ?? "unpaid" };
  let periodEnd: Date | null = null;
  let currentSubscription: any = null;
  const subscriptionId = providerId(session.subscription);
  if (session.mode === "subscription") {
    if (!subscriptionId) throw new Error("Hosted subscription is missing");
    const subscription = await gateway.stripe.subscriptions.retrieve(subscriptionId, {}, gateway.requestOptions);
    currentSubscription = subscription;
    if (!["active", "trialing"].includes(subscription.status) || (session.payment_status === "no_payment_required" && subscription.status !== "trialing" && purchase.zeroPaymentEligible !== 1)) return { handled: true, success: false, status: subscription.status };
    const state = course360RecurringState(subscription);
    if (!state.active) throw new Error("Hosted subscription period is missing or expired");
    periodEnd = state.cutoff;

  }
  if (providerId(signedSession.subscription) !== subscriptionId || providerId(signedSession.customer) !== providerId(session.customer)) throw new Error("Signed/fresh hosted customer or subscription mismatch");
  const content = await resolveHostedOwnedContent(db, purchase.contentType as HostedContentType, purchase.contentId, purchase.orgId);
  const amount = settledHostedDollars(session.amount_total!);
  const settled = { ...purchase, stripeSessionId: session.id, stripeSubscriptionId: subscriptionId, stripePaymentIntentId: providerId(session.payment_intent), amount };
  if (purchase.stripeSubscriptionId && purchase.stripeSubscriptionId !== subscriptionId) throw new Error("Hosted subscription replacement mismatch");
  const customerId = providerId(session.customer);
  if (currentSubscription && (!customerId || providerId(currentSubscription.customer) !== customerId || currentSubscription.livemode !== session.livemode)) throw new Error("Hosted checkout subscription/customer/mode mismatch");
  return commitHostedGrant(db, settled, content, periodEnd, currentSubscription ? { subscription: currentSubscription, customerId: customerId!, livemode: session.livemode, gateway, requireTrial: session.payment_status === "no_payment_required" && purchase.zeroPaymentEligible !== 1 } : undefined);
}

export async function commitHostedGrant(db: any, purchase: HostedPurchase, content: any, periodEnd: Date | null, recurring?: { subscription: any; customerId: string; livemode: boolean; gateway: HostedGateway; requireTrial?: boolean }): Promise<Course360HostedReconciliationResult> {
  if (typeof db.transaction !== "function") throw new Error("Hosted fulfillment requires a transactional database");
  return db.transaction(async (tx: any) => {
    const [locked] = await tx.select().from(purchases).where(and(eq(purchases.id, purchase.id), eq(purchases.orgId, purchase.orgId))).for("update").limit(1);
    if (!locked) throw new Error("Hosted purchase disappeared");
    if (locked.status === "completed" && recurring) {
      const [bound] = await tx.select().from(course360RecurringBindings).where(and(eq(course360RecurringBindings.purchaseId, locked.id), eq(course360RecurringBindings.accountId, locked.accountId), eq(course360RecurringBindings.subscriptionId, purchase.stripeSubscriptionId!))).limit(1);
      if (!bound) throw new Error("Historic completed recurring purchase requires reviewed source linkage; no inferred ownership");
    }
    if (locked.status === "completed") return { handled: true, success: true, alreadyGranted: true, purchaseId: purchase.id, orgId: purchase.orgId, userId: purchase.userId, contentType: purchase.contentType, slug: purchase.contentSlug };
    const currentContent = await resolveHostedOwnedContent(tx, purchase.contentType as HostedContentType, purchase.contentId, purchase.orgId);
    await assertHostedIncludedContentScope(tx, purchase.contentType as HostedContentType, currentContent);
    if (recurring) {
      if (!["course", "membership", "membership_plan", "bundle", "download", "webinar"].includes(purchase.contentType)) throw new Error("Recurring hosted family needs a finite source adapter");
      // Fetch under the purchase lock: a preceding delayed confirmation cannot grant stale active state after cancellation.
      const currentSubscription = await recurring.gateway.stripe.subscriptions.retrieve(purchase.stripeSubscriptionId!, {}, recurring.gateway.requestOptions);
      assertHostedSubscriptionIdentity(currentSubscription, purchase, recurring.customerId, recurring.livemode);
      const currentState = course360RecurringState(currentSubscription);
      if (recurring.requireTrial && currentSubscription.status !== "trialing") throw new Error("Hosted zero-payment trial is no longer trialing");
      if (!currentState.active) throw new Error("Hosted recurring state is no longer usable; retry current-state reconciliation");
      periodEnd = currentState.cutoff;
      await persistCourse360RecurringBinding(tx, purchase, currentSubscription, recurring.customerId, recurring.livemode);
    }
    await grantCanonicalHostedAccess(tx, purchase, currentContent, periodEnd);
    await tx.update(purchases).set({ amount: purchase.amount, stripeSessionId: purchase.stripeSessionId, stripeSubscriptionId: purchase.stripeSubscriptionId, stripePaymentIntentId: purchase.stripePaymentIntentId, status: "completed", completedAt: new Date() }).where(and(eq(purchases.id, purchase.id), eq(purchases.orgId, purchase.orgId)));
    return { handled: true, success: true, alreadyGranted: false, purchaseId: purchase.id, orgId: purchase.orgId, userId: purchase.userId, contentType: purchase.contentType, slug: purchase.contentSlug };
  });
}

export async function fulfillCourse360HostedFreePurchase(db: any, purchase: HostedPurchase, content: any) {
  if (purchase.unitPrice !== "0.00" || purchase.zeroPaymentEligible !== 1 || purchase.gateway !== "free" || purchase.pricingType === "payment_plan" || purchase.selectedBumpIds) throw new Error("Ineligible free purchase");
  return commitHostedGrant(db, { ...purchase, amount: "0.00" }, content, null);
}
