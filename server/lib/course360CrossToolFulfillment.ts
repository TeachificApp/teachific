import { randomBytes, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type Stripe from "stripe";
import {
  organizations,
  orgMembers,
  orgSubscriptions,
  users,
  userActiveOrg,
  platformTrialSignupFulfillments,
} from "../../drizzle/schema";
import {
  COURSE360_CROSS_TOOL_OFFERS,
  type Course360CrossToolOfferKey,
  type Course360CrossToolInterval,
} from "../../shared/course360CrossToolOffers";
import {
  COURSE360_CROSS_TOOL_FAMILY,
  assertCourse360CrossToolPrice,
} from "./course360CrossToolCatalog";
import {
  course360PaymentCheckouts as checkouts,
  course360PaymentSlots as slots,
  course360PaymentAppSubscriptions as apps,
} from "./course360PaymentTables";
import {
  currentCourse360PaymentTransaction,
  getCourse360PaymentDb,
  getCourse360PaymentVerifiedIdentity,
  persistCourse360PaymentOwnerClaim,
  type Course360PaymentDb,
} from "./course360PaymentLedger";
import { confirmedPlatformBillingState } from "../course360BillingState";
import {
  invoiceSubscriptionId,
  stripeObjectId,
} from "./course360WebhookLifecycle";
import { course360AppSubscriptionTier } from "./course360WebhookAppEntitlement";
import { generateUniqueOrgSlug } from "../../shared/slugUtils";
import { sendEmail } from "../sendgrid";
import { accountSetupHtml, trialActivatedHtml } from "../emailTemplates";
import { getCourse360PlatformAppUrl } from "../../shared/brands";

type Reservation = typeof checkouts.$inferSelect;
function packageSpec(record: Reservation) {
  const spec = JSON.parse(record.spec);
  const offer = spec.metadata?.cross_tool_offer as Course360CrossToolOfferKey;
  const interval = record.interval as Course360CrossToolInterval;
  if (
    spec.metadata?.type !== COURSE360_CROSS_TOOL_FAMILY ||
    !COURSE360_CROSS_TOOL_OFFERS[offer] ||
    !["monthly", "annual"].includes(interval) ||
    COURSE360_CROSS_TOOL_OFFERS[offer].schoolPlan !== record.selection ||
    spec.metadata?.creator_mode !== "web"
  )
    throw new Error("Invalid immutable package reservation");
  return { spec, offer, interval };
}
/** No grants based on metadata alone: price, currency, amount, interval, quantity, mode, customer and immutable reservation must agree. */
export function assertCourse360CrossToolSubscription(
  record: Reservation,
  subscription: Stripe.Subscription
) {
  const { spec, offer, interval } = packageSpec(record);
  if (
    subscription.livemode !== record.livemode ||
    subscription.metadata?.payment_reservation_id !== record.id ||
    subscription.metadata?.type !== COURSE360_CROSS_TOOL_FAMILY ||
    subscription.metadata?.cross_tool_offer !== offer ||
    subscription.metadata?.interval !== interval ||
    subscription.metadata?.plan !== record.selection ||
    subscription.metadata?.creator_mode !== "web" ||
    subscription.items.data.length !== 1 ||
    subscription.items.data[0].quantity !== 1 ||
    !stripeObjectId(subscription.customer) ||
    (record.customerId &&
      stripeObjectId(subscription.customer) !== record.customerId) ||
    (record.subscriptionId && record.subscriptionId !== subscription.id) ||
    subscription.discounts?.length ||
    subscription.items.data[0].discounts?.length ||
    subscription.pending_update ||
    subscription.pause_collection
  )
    throw new Error("Package subscription immutable binding mismatch");
  if (
    record.orgId &&
    (subscription.metadata?.org_id !== String(record.orgId) ||
      subscription.metadata?.user_id !== String(record.userId))
  )
    throw new Error("Package school/user identity mismatch");
  if (
    record.product === "signup" &&
    subscription.metadata?.signup_email !== spec.metadata?.signup_email
  )
    throw new Error("Package signup email mismatch");
  assertCourse360CrossToolPrice(
    subscription.items.data[0].price,
    offer,
    interval,
    spec.line_items[0].price,
    record.livemode
  );
}
function assertSession(
  record: Reservation,
  session: Stripe.Checkout.Session,
  sub: Stripe.Subscription
) {
  const { spec } = packageSpec(record);
  if (
    record.state === "expired" ||
    (session.id !== record.sessionId && record.sessionId != null) ||
    session.mode !== "subscription" ||
    session.livemode !== record.livemode ||
    stripeObjectId(session.subscription) !== sub.id ||
    stripeObjectId(session.customer) !== stripeObjectId(sub.customer) ||
    session.metadata?.payment_reservation_id !== record.id ||
    session.metadata?.type !== COURSE360_CROSS_TOOL_FAMILY ||
    session.metadata?.cross_tool_offer !== spec.metadata.cross_tool_offer ||
    session.metadata?.interval !== record.interval ||
    session.metadata?.plan !== record.selection ||
    session.metadata?.creator_mode !== "web" ||
    session.currency !== "usd"
  )
    throw new Error("Package Checkout immutable identity mismatch");
  if (
    record.orgId &&
    (session.metadata?.org_id !== String(record.orgId) ||
      session.metadata?.user_id !== String(record.userId))
  )
    throw new Error("Package Checkout foreign school/user");
  if (
    record.product === "signup" &&
    (session.customer_details?.email ?? session.customer_email ?? "")
      .trim()
      .toLowerCase() !== spec.metadata.signup_email
  )
    throw new Error("Package Checkout signup email mismatch");
  // A Checkout trial completion may arrive after its first paid renewal. Its immutable
  // zero-dollar initial invoice still belongs to the reserved 14-day card trial.
  const trial = record.trial && session.amount_total === 0;
  const expected = trial ? 0 : sub.items.data[0].price.unit_amount;
  if (
    session.amount_total !== expected ||
    session.amount_subtotal !== expected ||
    (trial
      ? session.payment_status !== "no_payment_required"
      : session.payment_status !== "paid")
  )
    throw new Error("Package Checkout amount/payment status mismatch");
  if (
    trial &&
    (!sub.trial_start ||
      !sub.trial_end ||
      sub.trial_end - sub.trial_start !== 14 * 86400)
  )
    throw new Error("Package trial must be the approved 14 days");
  if (
    session.payment_method_collection !== "always" ||
    !session.payment_method_types?.includes("card") ||
    !sub.default_payment_method
  )
    throw new Error("Package Checkout requires a saved card");
}
async function newSchool(
  db: Course360PaymentDb,
  record: Reservation,
  session: Stripe.Checkout.Session,
  sub: Stripe.Subscription
) {
  const { spec } = packageSpec(record);
  const email: string = spec.metadata.signup_email;
  const [prior] = await db
    .select()
    .from(platformTrialSignupFulfillments)
    .where(
      eq(platformTrialSignupFulfillments.stripeCheckoutSessionId, session.id)
    )
    .limit(1);
  if (prior) {
    if (prior.stripeSubscriptionId !== sub.id || !prior.orgId || !prior.userId)
      throw new Error("Package signup fulfillment needs reconciliation");
    return { orgId: prior.orgId, userId: prior.userId, notify: null };
  }
  let [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  const existing = !!user;
  let setupToken: string | null = null;
  if (!user) {
    setupToken = randomBytes(32).toString("hex");
    await db
      .insert(users)
      .values({
        openId: `checkout_${randomUUID().replace(/-/g, "")}`,
        email,
        name: spec.metadata.signup_name || email.split("@")[0],
        role: "user",
        loginMethod: "email",
        emailVerified: false,
        resetToken: setupToken,
        resetTokenExpiry: new Date(Date.now() + 7 * 86400000),
      });
    [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
  }
  if (!user) throw new Error("Package school account unavailable");
  const name = `${user.name || spec.metadata.signup_name || email.split("@")[0]}'s School`;
  const slug = await generateUniqueOrgSlug(
    name,
    async candidate =>
      !!(
        await db
          .select({ id: organizations.id })
          .from(organizations)
          .where(eq(organizations.slug, candidate))
          .limit(1)
      )[0]
  );
  await db
    .insert(organizations)
    .values({ name, slug, ownerId: user.id, subdomainEnabled: true });
  const [school] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);
  if (!school) throw new Error("Package school persistence unavailable");
  if (existing)
    await persistCourse360PaymentOwnerClaim(db, {
      orgId: school.id,
      userId: user.id,
      email,
      sessionId: session.id,
      subscriptionId: sub.id,
    });
  else {
    await db
      .insert(orgMembers)
      .values({
        orgId: school.id,
        userId: user.id,
        role: "org_super_admin",
        memberSubRole: "basic_member",
      });
    await db
      .insert(userActiveOrg)
      .values({ userId: user.id, orgId: school.id });
    // New account only; existing same-email account/password/role/selection are never changed.
    await db
      .update(users)
      .set({ role: "org_super_admin" })
      .where(eq(users.id, user.id));
  }
  await db
    .insert(platformTrialSignupFulfillments)
    .values({
      stripeCheckoutSessionId: session.id,
      stripeSubscriptionId: sub.id,
      orgId: school.id,
      userId: user.id,
      status: "completed",
      errorMessage: existing
        ? "cross_tool_email_pending:existing"
        : "cross_tool_email_pending:new",
    });
  return {
    orgId: school.id,
    userId: user.id,
    notify: { email, name: user.name || spec.metadata.signup_name, setupToken },
  };
}
function appState(sub: Stripe.Subscription) {
  const state = confirmedPlatformBillingState(sub);
  return {
    rawStatus: sub.status,
    currentPeriodStart: state.currentPeriodStart,
    currentPeriodEnd: state.currentPeriodEnd,
    trialStart: state.trialStartedAt,
    trialEnd: state.trialEndsAt,
    cancelAtPeriodEnd: state.cancelAtPeriodEnd,
    updatedAt: new Date(),
  };
}
function schoolState(sub: Stripe.Subscription) {
  const state = confirmedPlatformBillingState(sub);
  const usable =
    course360AppSubscriptionTier({
      ...sub,
      metadata: { access_tier: "web" },
    }) !== "none";
  return {
    ...state,
    ...(!usable && ["active", "trialing"].includes(sub.status)
      ? { status: "unpaid" as const }
      : {}),
  };
}
async function project(
  db: Course360PaymentDb,
  record: Reservation,
  sub: Stripe.Subscription,
  source: typeof apps.$inferSelect
) {
  const [school] = await db
    .select()
    .from(orgSubscriptions)
    .where(eq(orgSubscriptions.orgId, source.orgId))
    .limit(1);
  if (
    !school ||
    school.stripeSubscriptionId !== sub.id ||
    source.reservationId !== record.id ||
    source.subscriptionId !== sub.id ||
    source.customerId !== stripeObjectId(sub.customer) ||
    source.product !== "creator" ||
    source.tier !== "web"
  )
    throw new Error("Package projection current-school identity mismatch");
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, source.orgId))
    .limit(1);
  const [member] = await db
    .select()
    .from(orgMembers)
    .where(
      and(
        eq(orgMembers.orgId, source.orgId),
        eq(orgMembers.userId, source.userId)
      )
    )
    .limit(1);
  if (
    !org ||
    (record.orgId
      ? record.orgId !== source.orgId || record.userId !== source.userId
      : org.ownerId !== source.userId) ||
    (record.orgId && !member)
  )
    throw new Error("Package projection school/user authority mismatch");
  await db.update(apps).set(appState(sub)).where(eq(apps.id, source.id));
  await db
    .update(orgSubscriptions)
    .set({ plan: record.selection as "builder" | "pro", ...schoolState(sub) })
    .where(
      and(
        eq(orgSubscriptions.id, school.id),
        eq(orgSubscriptions.stripeSubscriptionId, sub.id)
      )
    );
}
/** ONLY called from signature-verified durable Inbox work; requires its InnoDB transaction/lock context. */
export async function dispatchCourse360CrossToolVerifiedEvent(
  event: Stripe.Event,
  stripe: Stripe
): Promise<boolean> {
  const db = currentCourse360PaymentTransaction();
  // Non-package unrelated events retain all legacy behavior and do not require extra configuration.
  const object: any = event.data.object;
  const checkout = event.type.startsWith("checkout.session.");
  let subscriptionId = event.type.startsWith("customer.subscription.")
    ? stripeObjectId(object)
    : event.type.startsWith("invoice.")
      ? invoiceSubscriptionId(object)
      : null;
  if (!checkout && !subscriptionId) return false;
  if (!db) {
    if (object.metadata?.type === COURSE360_CROSS_TOOL_FAMILY)
      throw new Error("Package requires durable verified-event transaction");
    return false;
  }
  let source: typeof apps.$inferSelect | undefined;
  let record: Reservation | undefined;
  let session: Stripe.Checkout.Session | undefined;
  if (checkout) {
    // Checkout ID is queried first, including failure and delayed deliveries with misleading snapshot metadata.
    [record] = await db
      .select()
      .from(checkouts)
      .where(eq(checkouts.sessionId, object.id))
      .limit(1);
    if (!record && object.metadata?.type !== COURSE360_CROSS_TOOL_FAMILY)
      return false;
    if (
      record &&
      JSON.parse(record.spec).metadata?.type !== COURSE360_CROSS_TOOL_FAMILY
    )
      return false;
    session = await stripe.checkout.sessions.retrieve(object.id);
    if (!record)
      [record] = await db
        .select()
        .from(checkouts)
        .where(eq(checkouts.id, session.metadata?.payment_reservation_id ?? ""))
        .limit(1);
    if (!record)
      throw new Error("Package reservation unavailable; retry required");
    const [slot] = await db
      .select()
      .from(slots)
      .where(eq(slots.id, record.slotId))
      .limit(1);
    if (slot?.reservationId !== record.id)
      throw new Error("Package stale checkout slot");
    if (
      session.metadata?.type !== COURSE360_CROSS_TOOL_FAMILY ||
      session.metadata.payment_reservation_id !== record.id ||
      session.livemode !== record.livemode
    )
      throw new Error("Package current Checkout reservation mismatch");
    if (session.status === "expired") {
      if (record.state !== "completed")
        await db
          .update(checkouts)
          .set({ state: "expired" })
          .where(eq(checkouts.id, record.id));
      return true;
    }
    if (session.status !== "complete") return true; // Failed/pending payments cannot grant.
    subscriptionId = stripeObjectId(session.subscription);
    if (!subscriptionId)
      throw new Error("Package completed Checkout subscription missing");
  } else {
    [source] = await db
      .select()
      .from(apps)
      .where(eq(apps.subscriptionId, subscriptionId!))
      .limit(1);
    if (source)
      [record] = await db
        .select()
        .from(checkouts)
        .where(eq(checkouts.id, source.reservationId))
        .limit(1);
    if (
      !record ||
      JSON.parse(record.spec).metadata?.type !== COURSE360_CROSS_TOOL_FAMILY
    ) {
      // Subscription metadata can arrive before Checkout. Never provision from it; retain retryable Inbox failure.
      if (object.metadata?.type === COURSE360_CROSS_TOOL_FAMILY)
        throw new Error(
          "Package Checkout must complete before lifecycle reconciliation"
        );
      if (event.type.startsWith("invoice.")) {
        const current = await stripe.subscriptions.retrieve(subscriptionId!);
        if (current.metadata?.type === COURSE360_CROSS_TOOL_FAMILY)
          throw new Error(
            "Package Checkout must complete before invoice reconciliation"
          );
      }
      return false;
    }
  }
  const verifiedIdentity = getCourse360PaymentVerifiedIdentity();
  if (
    record.accountId !== verifiedIdentity.accountId ||
    record.livemode !== verifiedIdentity.livemode ||
    record.livemode !== event.livemode ||
    event.account
  )
    throw new Error("Package event account/mode mismatch");
  const sub = await stripe.subscriptions.retrieve(subscriptionId!);
  try {
    assertCourse360CrossToolSubscription(record, sub);
  } catch (error) {
    if (record.state !== "completed") throw error;
    if (!source)
      [source] = await db
        .select()
        .from(apps)
        .where(eq(apps.reservationId, record.id))
        .limit(1);
    // Do not move an invalid paid grant to another school/account. Suspend only
    // the immutable owned package source and exact current school projection.
    if (
      !source ||
      source.accountId !== record.accountId ||
      source.livemode !== record.livemode ||
      source.subscriptionId !== subscriptionId ||
      source.reservationId !== record.id ||
      source.product !== "creator" ||
      source.tier !== "web"
    )
      throw error;
    const [saved] = await db
      .select()
      .from(orgSubscriptions)
      .where(
        and(
          eq(orgSubscriptions.orgId, source.orgId),
          eq(orgSubscriptions.stripeSubscriptionId, source.subscriptionId)
        )
      )
      .limit(1);
    if (!saved) throw error;
    await db
      .update(apps)
      .set({ rawStatus: "unpaid", updatedAt: new Date() })
      .where(eq(apps.id, source.id));
    await db
      .update(orgSubscriptions)
      .set({ status: "unpaid", rawStripeStatus: "unpaid" })
      .where(eq(orgSubscriptions.id, saved.id));
    return true; // Durable denial; later verified current-state recovery may restore.
  }
  if (!checkout) {
    await project(db, record, sub, source!);
    return true;
  }
  if (record.state === "completed") {
    [source] = await db
      .select()
      .from(apps)
      .where(eq(apps.reservationId, record.id))
      .limit(1);
    if (!source) throw new Error("Package completed grant missing");
    await project(db, record, sub, source);
    return true;
  }
  assertSession(record, session!, sub);
  if (!["active", "trialing"].includes(sub.status))
    throw new Error(
      "Package subscription not usable; retry after payment recovery"
    );
  let identity: {
    orgId: number;
    userId: number;
    notify: {
      email: string;
      name: string | null;
      setupToken: string | null;
    } | null;
  };
  if (record.product === "signup")
    identity = await newSchool(db, record, session!, sub);
  else {
    if (!record.orgId || !record.userId)
      throw new Error("Package existing-school identity missing");
    const [member] = await db
      .select()
      .from(orgMembers)
      .where(
        and(
          eq(orgMembers.orgId, record.orgId),
          eq(orgMembers.userId, record.userId)
        )
      )
      .limit(1);
    const [org] = await db
      .select()
      .from(organizations)
      .where(
        and(
          eq(organizations.id, record.orgId),
          eq(organizations.isActive, true)
        )
      )
      .limit(1);
    if (
      !org ||
      !member ||
      !["org_super_admin", "org_admin"].includes(member.role)
    )
      throw new Error("Package billing authority changed before completion");
    identity = { orgId: record.orgId, userId: record.userId, notify: null };
  }
  const [saved] = await db
    .select()
    .from(orgSubscriptions)
    .where(eq(orgSubscriptions.orgId, identity.orgId))
    .limit(1);
  if (
    saved &&
    saved.stripeSubscriptionId !== record.previousSubscriptionId &&
    saved.stripeSubscriptionId !== sub.id
  )
    throw new Error("Package would overwrite an independent school plan");
  const state = {
    plan: record.selection as "builder" | "pro",
    ...schoolState(sub),
    starterTrialClaimed: true,
  };
  if (saved)
    await db
      .update(orgSubscriptions)
      .set(state)
      .where(eq(orgSubscriptions.id, saved.id));
  else
    await db
      .insert(orgSubscriptions)
      .values({ orgId: identity.orgId, ...state });
  await db
    .insert(apps)
    .values({
      id: randomUUID(),
      accountId: record.accountId,
      livemode: record.livemode,
      orgId: identity.orgId,
      userId: identity.userId,
      product: "creator",
      tier: "web",
      subscriptionId: sub.id,
      customerId: stripeObjectId(sub.customer)!,
      reservationId: record.id,
      sessionId: session!.id,
      ...appState(sub),
    });
  await db
    .update(checkouts)
    .set({
      sessionId: session!.id,
      subscriptionId: sub.id,
      customerId: stripeObjectId(sub.customer),
      state: "completed",
      completedAt: new Date(),
    })
    .where(eq(checkouts.id, record.id));
  return true;
}

/** Called AFTER verified Inbox commits, also on duplicate retries. Email failure never rolls back paid access. */
export async function deliverCourse360CrossToolOnboarding(
  event: Stripe.Event
): Promise<void> {
  const object: any = event.data.object;
  if (
    !event.type.startsWith("checkout.session.") ||
    object.metadata?.type !== COURSE360_CROSS_TOOL_FAMILY
  )
    return;
  const db = await getCourse360PaymentDb();
  const [marker] = await db
    .select()
    .from(platformTrialSignupFulfillments)
    .where(
      eq(platformTrialSignupFulfillments.stripeCheckoutSessionId, object.id)
    )
    .limit(1);
  if (
    !marker?.errorMessage?.startsWith("cross_tool_email_pending:") ||
    marker.status !== "completed"
  )
    return;
  const [record] = await db
    .select()
    .from(checkouts)
    .where(eq(checkouts.sessionId, object.id))
    .limit(1);
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, marker.userId!))
    .limit(1);
  if (!record || record.state !== "completed" || !user?.email)
    throw new Error("Package onboarding committed identity unavailable");
  const spec = packageSpec(record);
  if (
    user.email.trim().toLowerCase() !== spec.spec.metadata.signup_email ||
    marker.stripeSubscriptionId !== record.subscriptionId
  )
    throw new Error("Package onboarding identity mismatch");
  // Existing accounts only get login/claim instructions; their reset/password state is never exposed or changed.
  const setupToken =
    marker.errorMessage === "cross_tool_email_pending:new"
      ? user.resetToken
      : null;
  const url = setupToken
    ? `${getCourse360PlatformAppUrl()}/reset-password?token=${setupToken}`
    : `${getCourse360PlatformAppUrl()}/login`;
  const sent = await sendEmail({
    to: user.email,
    subject: setupToken
      ? "Set up your Course360™ account"
      : "Your Course360™ school is ready",
    html: setupToken
      ? accountSetupHtml(user.name ?? "", url, record.selection)
      : trialActivatedHtml(user.name ?? "", url, record.selection),
  });
  if (!sent)
    throw new Error(
      "Package onboarding delivery must retry; paid grant is safely committed"
    );
  await db
    .update(platformTrialSignupFulfillments)
    .set({ errorMessage: null })
    .where(eq(platformTrialSignupFulfillments.id, marker.id));
}

/** Used only after exact-school authenticated app recovery has resolved the durable source. */
export async function assertCourse360CrossToolRecovery(
  db: Course360PaymentDb,
  source: typeof apps.$inferSelect,
  sub: Stripe.Subscription
): Promise<boolean> {
  const [record] = await db
    .select()
    .from(checkouts)
    .where(eq(checkouts.id, source.reservationId))
    .limit(1);
  if (
    !record ||
    JSON.parse(record.spec).metadata?.type !== COURSE360_CROSS_TOOL_FAMILY
  )
    return false;
  assertCourse360CrossToolSubscription(record, sub);
  const verified = getCourse360PaymentVerifiedIdentity();
  if (
    record.accountId !== verified.accountId ||
    record.livemode !== verified.livemode ||
    source.accountId !== record.accountId ||
    source.livemode !== record.livemode ||
    record.state !== "completed"
  )
    throw new Error("Package recovery account/mode mismatch");
  if (
    source.orgId !== (record.orgId ?? source.orgId) ||
    source.userId !== (record.userId ?? source.userId) ||
    source.product !== "creator" ||
    source.tier !== "web" ||
    source.customerId !== stripeObjectId(sub.customer) ||
    source.subscriptionId !== sub.id
  )
    throw new Error("Package recovery source mismatch");
  const [school] = await db
    .select()
    .from(orgSubscriptions)
    .where(
      and(
        eq(orgSubscriptions.orgId, source.orgId),
        eq(orgSubscriptions.stripeSubscriptionId, sub.id)
      )
    )
    .limit(1);
  if (!school) throw new Error("Package recovery school mismatch");
  return true;
}

/** Recognize a genuinely bound package for billing recovery and plan-change guards; school-plan benefits remain unchanged. */
export async function isCourse360CrossToolSchoolSubscription(
  db: Course360PaymentDb,
  orgId: number,
  subscriptionId: string | null
): Promise<boolean> {
  if (!subscriptionId) return false;
  const [source] = await db
    .select()
    .from(apps)
    .where(and(eq(apps.orgId, orgId), eq(apps.subscriptionId, subscriptionId)))
    .limit(1);
  if (!source) return false;
  const [record] = await db
    .select()
    .from(checkouts)
    .where(eq(checkouts.id, source.reservationId))
    .limit(1);
  return (
    !!record &&
    JSON.parse(record.spec).metadata?.type === COURSE360_CROSS_TOOL_FAMILY
  );
}
