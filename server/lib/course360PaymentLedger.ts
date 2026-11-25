import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import type Stripe from "stripe";
import { orgMembers, organizations, orgSubscriptions, users } from "../../drizzle/schema";
import * as tables from "./course360PaymentTables";
import { configureCourse360AppSubscriptionProjector, stripeObjectId, type Course360AppProjection, type Course360AppProduct } from "./course360WebhookLifecycle";
import { course360AppSubscriptionTier, type Course360AppTier } from "./course360WebhookAppEntitlement";
import { getOrgSubscriptionPeriodDates, getOrgSubscriptionTrialDates } from "./orgSubscriptionTrialDates";

export type Course360PaymentDb = MySql2Database<any>;
type Scope = { db: Course360PaymentDb; transactional: boolean };
const scope = new AsyncLocalStorage<Scope>();
export type Course360PaymentLedgerConfiguration = { getDb: () => Promise<Course360PaymentDb | null>; accountId: string; livemode: boolean };
let configuration: Course360PaymentLedgerConfiguration | undefined;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export function course360PaymentLedgerReady(): boolean { return !!configuration; }
export function configureCourse360PaymentLedger(options: Course360PaymentLedgerConfiguration): void {
  if (!/^acct_[A-Za-z0-9]+$/.test(options.accountId) || typeof options.livemode !== "boolean") throw new Error("Verified server-configured platform account/mode required");
  configuration = options;
  configureCourse360AppSubscriptionProjector(projectCourse360PaymentAppSubscription);
}
function configured(): Course360PaymentLedgerConfiguration {
  if (!configuration) throw new Error("Course360 payment ledger not configured; retry after bootstrap/migration");
  return configuration;
}
export function currentCourse360PaymentTransaction(): Course360PaymentDb | undefined { return scope.getStore()?.db; }
export async function getCourse360PaymentDb(): Promise<Course360PaymentDb> {
  const context = scope.getStore();
  if (context) return context.db;
  const db = await configured().getDb();
  if (!db) throw new Error("Course360 payment database unavailable");
  return db;
}
async function transaction<T>(work: (db: Course360PaymentDb) => Promise<T>): Promise<T> {
  const context = scope.getStore();
  if (context?.transactional) return work(context.db);
  const db = await getCourse360PaymentDb();
  return db.transaction(tx => scope.run({ db: tx as unknown as Course360PaymentDb, transactional: true }, () => work(tx as unknown as Course360PaymentDb)));
}
function affected(result: any): number { return Number(result?.[0]?.affectedRows ?? result?.affectedRows ?? 0); }
async function lock(db: Course360PaymentDb, key: string): Promise<void> {
  const id = hash(`${configured().accountId}:${configured().livemode}:${key}`);
  await db.insert(tables.course360PaymentLocks).values({ id }).onDuplicateKeyUpdate({ set: { id } });
  // SQL UPDATE holds the InnoDB exclusive row lock until the enclosing transaction ends.
  await db.update(tables.course360PaymentLocks).set({ revision: sql`${tables.course360PaymentLocks.revision} + 1` }).where(eq(tables.course360PaymentLocks.id, id));
}
async function membership(db: Course360PaymentDb, orgId: number, userId: number): Promise<void> {
  const [row] = await db.select({ id: orgMembers.id }).from(orgMembers).innerJoin(organizations, eq(organizations.id, orgMembers.orgId))
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId), eq(organizations.isActive, true))).limit(1);
  if (!row) throw new Error("Payment identity requires exact active-school membership");
}
export type Course360PaymentCheckoutInput = {
  orgId: number | null; userId: number | null; product: "platform" | "signup" | Course360AppProduct;
  selection: string; interval: "monthly" | "annual"; previousSubscriptionId?: string | null;
  customerId?: string | null; trialEligible: boolean; email?: string;
  params: NonNullable<Parameters<Stripe["checkout"]["sessions"]["create"]>[0]>;
};
type Checkout = typeof tables.course360PaymentCheckouts.$inferSelect;
function checkoutSlot(input: Course360PaymentCheckoutInput): string {
  if (input.product === "signup") {
    if (!input.email) throw new Error("Signup email required");
    return hash(`signup:${input.email.trim().toLowerCase()}`);
  }
  if (!Number.isSafeInteger(input.orgId) || !input.orgId || !Number.isSafeInteger(input.userId) || !input.userId) throw new Error("School/user checkout identity required");
  return hash(input.product === "platform" ? `school:${input.orgId}` : `app:${input.orgId}:${input.userId}:${input.product}`);
}
function identity() { const config = configured(); return { accountId: config.accountId, livemode: config.livemode }; }
export async function reserveCourse360PaymentCheckout(input: Course360PaymentCheckoutInput): Promise<Checkout> {
  const slotId = hash(`${configured().accountId}:${configured().livemode}:${checkoutSlot(input)}`);
  const fingerprint = hash(JSON.stringify({ orgId: input.orgId, userId: input.userId, product: input.product, selection: input.selection, interval: input.interval, previous: input.previousSubscriptionId ?? null, customer: input.customerId ?? null, params: input.params }));
  return transaction(async db => {
    if (input.orgId && input.userId) await membership(db, input.orgId, input.userId);
    await db.insert(tables.course360PaymentSlots).values({ id: slotId }).onDuplicateKeyUpdate({ set: { id: slotId } });
    await db.update(tables.course360PaymentSlots).set({ revision: sql`${tables.course360PaymentSlots.revision} + 1` }).where(eq(tables.course360PaymentSlots.id, slotId));
    const [slot] = await db.select().from(tables.course360PaymentSlots).where(eq(tables.course360PaymentSlots.id, slotId)).limit(1);
    if (slot.reservationId) {
      const [prior] = await db.select().from(tables.course360PaymentCheckouts).where(eq(tables.course360PaymentCheckouts.id, slot.reservationId)).limit(1);
      if (!prior) throw new Error("Pending checkout reference missing; reconciliation required");
      if (["reserved", "open", "completing"].includes(prior.state)) {
        if (prior.fingerprint !== fingerprint) throw new Error("A checkout for this school/product is already pending; finish or expire it first");
        return prior;
      }
      if (prior.state === "completed" && input.product === "signup") throw new Error("School checkout already provisioned; authenticate normally");
      if (prior.state === "completed" && input.product === "platform" && input.previousSubscriptionId !== prior.subscriptionId) throw new Error("New checkout must reference the latest completed subscription");
    }
    if (input.product !== "platform" && input.product !== "signup") {
      const existing = await db.select().from(tables.course360PaymentAppSubscriptions).where(and(eq(tables.course360PaymentAppSubscriptions.orgId, input.orgId!), eq(tables.course360PaymentAppSubscriptions.userId, input.userId!), eq(tables.course360PaymentAppSubscriptions.product, input.product), eq(tables.course360PaymentAppSubscriptions.accountId, configured().accountId), eq(tables.course360PaymentAppSubscriptions.livemode, configured().livemode)));
      if (existing.some(s => !["canceled", "incomplete_expired"].includes(s.rawStatus))) throw new Error("App subscription already exists; reconcile/cancel it before new checkout");
    }
    const id = randomUUID();
    const trialId = checkoutSlot(input); // Never reset by expiration/cancellation or account-mode changes.
    const [history] = await db.select().from(tables.course360PaymentTrialHistory).where(eq(tables.course360PaymentTrialHistory.id, trialId)).limit(1);
    const trial = input.trialEligible && !history;
    if (trial) await db.insert(tables.course360PaymentTrialHistory).values({ id: trialId, orgId: input.orgId, userId: input.userId, product: input.product, reservationId: id });
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const metadata = { ...input.params.metadata, payment_reservation_id: id };
    const subscriptionData = { ...input.params.subscription_data, metadata: { ...input.params.subscription_data?.metadata, payment_reservation_id: id } };
    if (trial) subscriptionData.trial_period_days = 14;
    else delete subscriptionData.trial_period_days;
    const params = { ...input.params, payment_method_collection: "always", metadata, subscription_data: subscriptionData, expires_at: Math.floor(expiresAt.getTime() / 1000) };
    const record = { id, slotId, ...identity(), orgId: input.orgId, userId: input.userId, product: input.product, selection: input.selection, interval: input.interval,
      previousSubscriptionId: input.previousSubscriptionId ?? null, customerId: input.customerId ?? null, fingerprint, spec: JSON.stringify(params), trial, expiresAt, state: "reserved" };
    await db.insert(tables.course360PaymentCheckouts).values(record);
    const changed = await db.update(tables.course360PaymentSlots).set({ reservationId: id }).where(and(eq(tables.course360PaymentSlots.id, slotId), eq(tables.course360PaymentSlots.revision, slot.revision)));
    if (affected(changed) !== 1) throw new Error("Checkout reservation CAS lost");
    return { ...record, sessionId: null, subscriptionId: null, sessionUrl: null, completedAt: null, createdAt: new Date() };
  });
}
export async function createCourse360PaymentCheckout(input: Course360PaymentCheckoutInput, stripe: Stripe): Promise<Stripe.Checkout.Session> {
  const record = await reserveCourse360PaymentCheckout(input);
  if (!record.sessionId && record.expiresAt.getTime() <= Date.now()) throw new Error("Unresolved provider checkout reservation expired; authenticated reconciliation required (do not create a duplicate)");
  const session = record.sessionId
    ? await stripe.checkout.sessions.retrieve(record.sessionId)
    : await stripe.checkout.sessions.create(JSON.parse(record.spec), { idempotencyKey: `course360-checkout:${record.id}` });
  await transaction(async db => {
    await db.update(tables.course360PaymentSlots).set({ revision: sql`${tables.course360PaymentSlots.revision} + 1` }).where(eq(tables.course360PaymentSlots.id, record.slotId));
    const [fresh] = await db.select().from(tables.course360PaymentCheckouts).where(eq(tables.course360PaymentCheckouts.id, record.id)).limit(1);
    if (!fresh || (fresh.sessionId && fresh.sessionId !== session.id) || session.metadata?.payment_reservation_id !== record.id || session.livemode !== configured().livemode) throw new Error("Provider checkout/session binding mismatch");
    if (session.status === "expired") {
      await db.update(tables.course360PaymentCheckouts).set({ state: "expired" }).where(eq(tables.course360PaymentCheckouts.id, record.id));
      return;
    }
    await db.update(tables.course360PaymentCheckouts).set({ sessionId: session.id, sessionUrl: session.url, state: fresh.state === "completed" ? "completed" : "open" }).where(eq(tables.course360PaymentCheckouts.id, record.id));
  });
  if (session.status !== "open" || !session.url) throw new Error("Checkout is no longer open; completion/expiration reconciliation required");
  return session;
}
async function validateCompletion(db: Course360PaymentDb, session: Stripe.Checkout.Session, subscription: Stripe.Subscription): Promise<Checkout> {
  const id = session.metadata?.payment_reservation_id;
  if (!id) throw new Error("Checkout lacks durable reservation; authenticated historical reconciliation required");
  const [record] = await db.select().from(tables.course360PaymentCheckouts).where(eq(tables.course360PaymentCheckouts.id, id)).limit(1);
  if (!record) throw new Error("Checkout reservation missing");
  await db.update(tables.course360PaymentSlots).set({ revision: sql`${tables.course360PaymentSlots.revision} + 1` }).where(eq(tables.course360PaymentSlots.id, record.slotId));
  const [slot] = await db.select().from(tables.course360PaymentSlots).where(eq(tables.course360PaymentSlots.id, record.slotId)).limit(1);
  const customerId = stripeObjectId(subscription.customer);
  if (slot?.reservationId !== id || record.accountId !== configured().accountId || record.livemode !== configured().livemode
    || record.state === "expired" || (record.sessionId && record.sessionId !== session.id)
    || (record.subscriptionId && record.subscriptionId !== subscription.id)
    || session.status !== "complete" || session.mode !== "subscription" || session.livemode !== record.livemode || subscription.livemode !== record.livemode
    || stripeObjectId(session.subscription) !== subscription.id || !customerId || stripeObjectId(session.customer) !== customerId
    || (record.customerId && record.customerId !== customerId) || subscription.metadata?.payment_reservation_id !== id
    || session.metadata?.interval !== record.interval || subscription.metadata?.interval !== record.interval
    || (record.orgId && (Number(session.metadata?.org_id) !== record.orgId || Number(subscription.metadata?.org_id) !== record.orgId))
    || (record.userId && (Number(session.metadata?.user_id) !== record.userId || Number(subscription.metadata?.user_id) !== record.userId))) throw new Error("Checkout completion immutable reference mismatch");
  const spec = JSON.parse(record.spec);
  if (record.product === "signup") {
    const expectedEmail = String(spec.metadata?.signup_email ?? "").trim().toLowerCase();
    const email = (session.customer_details?.email ?? session.customer_email ?? session.metadata?.signup_email ?? "").trim().toLowerCase();
    if (!expectedEmail || email !== expectedEmail || subscription.metadata?.signup_email !== expectedEmail) throw new Error("Signup checkout email binding mismatch");
  }
  if (subscription.items.data.length !== 1 || subscription.items.data[0]?.price?.id !== spec.line_items?.[0]?.price || subscription.items.data[0]?.quantity !== 1) throw new Error("Checkout approved catalog price mismatch");
  const app = !["platform", "signup"].includes(record.product);
  if (app ? (subscription.metadata?.product_type !== record.product || session.metadata?.product_type !== record.product || subscription.metadata?.access_tier !== record.selection || session.metadata?.access_tier !== record.selection)
    : (session.metadata?.plan !== record.selection || subscription.metadata?.plan !== record.selection)) throw new Error("Checkout product/selection mismatch");
  await db.update(tables.course360PaymentCheckouts).set({ sessionId: session.id, subscriptionId: subscription.id, customerId, state: "completing" }).where(eq(tables.course360PaymentCheckouts.id, id));
  return record;
}
async function markCompleted(db: Course360PaymentDb, id: string): Promise<void> {
  await db.update(tables.course360PaymentCheckouts).set({ state: "completed", completedAt: new Date() }).where(eq(tables.course360PaymentCheckouts.id, id));
}
export async function completeCourse360PaymentSchoolCheckout(session: Stripe.Checkout.Session, subscription: Stripe.Subscription): Promise<void> {
  await transaction(async db => {
    const record = await validateCompletion(db, session, subscription);
    if (record.product !== "platform" || !record.orgId || !record.userId) throw new Error("School platform checkout binding required");
    await membership(db, record.orgId, record.userId);
    const [saved] = await db.select().from(orgSubscriptions).where(eq(orgSubscriptions.orgId, record.orgId)).limit(1);
    if ((saved?.stripeSubscriptionId ?? null) !== record.previousSubscriptionId && saved?.stripeSubscriptionId !== subscription.id) throw new Error("School subscription was replaced by a newer checkout");
    const state = { plan: record.selection as "starter" | "builder" | "pro", stripeCustomerId: stripeObjectId(subscription.customer)!, stripeSubscriptionId: subscription.id,
      status: subscription.status === "canceled" ? "cancelled" as const : ["active", "trialing", "past_due", "unpaid"].includes(subscription.status) ? subscription.status as "active" | "trialing" | "past_due" | "unpaid" : "unpaid" as const,
      ...getOrgSubscriptionPeriodDates(subscription), ...getOrgSubscriptionTrialDates(subscription), cancelAtPeriodEnd: subscription.cancel_at_period_end, starterTrialClaimed: true };
    if (saved) await db.update(orgSubscriptions).set(state).where(and(eq(orgSubscriptions.id, saved.id), eq(orgSubscriptions.orgId, record.orgId)));
    else await db.insert(orgSubscriptions).values({ orgId: record.orgId, ...state });
    await markCompleted(db, record.id);
  });
}
export async function withCourse360PaymentSignupCompletion<T>(session: Stripe.Checkout.Session, subscription: Stripe.Subscription, work: () => Promise<T>): Promise<T> {
  return transaction(async db => {
    const record = await validateCompletion(db, session, subscription);
    if (record.product !== "signup") throw new Error("Signup reservation required");
    const result = await work();
    await markCompleted(db, record.id);
    return result;
  });
}
export async function projectCourse360PaymentAppSubscription(projection: Course360AppProjection): Promise<void> {
  await transaction(async db => {
    const { subscription, orgId, userId, product, tier } = projection;
    const customerId = stripeObjectId(subscription.customer);
    if (!customerId || subscription.livemode !== configured().livemode) throw new Error("App subscription customer/mode required");
    await lock(db, `subscription:${subscription.id}`);
    const [existing] = await db.select().from(tables.course360PaymentAppSubscriptions).where(and(eq(tables.course360PaymentAppSubscriptions.accountId, configured().accountId), eq(tables.course360PaymentAppSubscriptions.livemode, configured().livemode), eq(tables.course360PaymentAppSubscriptions.subscriptionId, subscription.id))).limit(1);
    if (!existing) {
      // A lifecycle event preceding Checkout delivery must retry, not create an unbound paid grant.
      if (!projection.checkoutSessionId) throw new Error("App Checkout completion required before lifecycle projection");
      const session = pendingProjectionSession.getStore();
      if (!session || session.id !== projection.checkoutSessionId) throw new Error("Verified current App Checkout context required");
      const record = await validateCompletion(db, session, subscription);
      if (record.orgId !== orgId || record.userId !== userId || record.product !== product || record.selection !== tier) throw new Error("App checkout ledger identity mismatch");
      await membership(db, orgId, userId);
      await db.insert(tables.course360PaymentAppSubscriptions).values({ id: randomUUID(), ...identity(), orgId, userId, product, tier, subscriptionId: subscription.id, customerId,
        reservationId: record.id, sessionId: projection.checkoutSessionId, ...appState(subscription) });
      await markCompleted(db, record.id);
    } else {
      if (existing.orgId !== orgId || existing.userId !== userId || existing.product !== product || existing.customerId !== customerId || existing.reservationId !== subscription.metadata?.payment_reservation_id || (projection.checkoutSessionId && projection.checkoutSessionId !== existing.sessionId)) throw new Error("Immutable app subscription identity mismatch");
      await db.update(tables.course360PaymentAppSubscriptions).set({ tier, ...appState(subscription) }).where(eq(tables.course360PaymentAppSubscriptions.id, existing.id));
    }
    // Deliberately never project to global users.*Access or mutate manual grants.
  });
}
function appState(subscription: Stripe.Subscription) { return { rawStatus: subscription.status, ...getOrgSubscriptionPeriodDates(subscription), trialStart: getOrgSubscriptionTrialDates(subscription).trialStartedAt, trialEnd: getOrgSubscriptionTrialDates(subscription).trialEndsAt, cancelAtPeriodEnd: subscription.cancel_at_period_end, updatedAt: new Date() }; }
const pendingProjectionSession = new AsyncLocalStorage<Stripe.Checkout.Session>();
export async function withCourse360PaymentAppCheckout<T>(session: Stripe.Checkout.Session, work: () => Promise<T>): Promise<T> { return pendingProjectionSession.run(session, work); }
export function aggregateCourse360PaymentAppAccess(records: Array<{ tier: string; rawStatus: string; currentPeriodEnd: Date | null; trialEnd: Date | null }>, grants: Array<{ tier: string; expiresAt: Date | null; revokedAt: Date | null }>, now = new Date()) {
  const paid = records.filter(r => course360AppSubscriptionTier({ status: r.rawStatus, current_period_end: r.currentPeriodEnd ? r.currentPeriodEnd.getTime() / 1000 : null, trial_end: r.trialEnd ? r.trialEnd.getTime() / 1000 : null, metadata: { access_tier: r.tier } }, now) !== "none");
  const manual = grants.filter(g => !g.revokedAt && (!g.expiresAt || g.expiresAt > now));
  const tiers = [...paid.map(r => r.tier), ...manual.map(g => g.tier)];
  const web = tiers.includes("web") || tiers.includes("bundle");
  const desktop = tiers.includes("desktop") || tiers.includes("bundle");
  const tier: Course360AppTier = web && desktop ? "bundle" : web ? "web" : desktop ? "desktop" : "none";
  const isPaid = paid.some(r => r.rawStatus === "active");
  const isInTrial = !isPaid && paid.some(r => r.rawStatus === "trialing");
  return { tier, isActive: tier !== "none", isPaid, isInTrial, hasManualGrant: manual.length > 0, trialEndsAt: isInTrial ? new Date(Math.max(...paid.filter(r => r.rawStatus === "trialing").map(r => r.trialEnd!.getTime()))) : null };
}
export async function getCourse360PaymentAppAccess(orgId: number, userId: number, product: Course360AppProduct) {
  const db = await getCourse360PaymentDb();
  await membership(db, orgId, userId);
  const records = await db.select().from(tables.course360PaymentAppSubscriptions).where(and(eq(tables.course360PaymentAppSubscriptions.orgId, orgId), eq(tables.course360PaymentAppSubscriptions.userId, userId), eq(tables.course360PaymentAppSubscriptions.product, product), eq(tables.course360PaymentAppSubscriptions.accountId, configured().accountId), eq(tables.course360PaymentAppSubscriptions.livemode, configured().livemode)));
  const grants = await db.select().from(tables.course360PaymentManualGrants).where(and(eq(tables.course360PaymentManualGrants.orgId, orgId), eq(tables.course360PaymentManualGrants.userId, userId), eq(tables.course360PaymentManualGrants.product, product)));
  return aggregateCourse360PaymentAppAccess(records, grants);
}
export async function grantCourse360PaymentManualAccess(input: { orgId: number; userId: number; product: Course360AppProduct; tier: "web" | "desktop" | "bundle"; actorId: number; source: string; reason: string; expiresAt?: Date | null }): Promise<string> {
  return transaction(async db => {
    await membership(db, input.orgId, input.userId);
    const [actor] = await db.select().from(users).where(eq(users.id, input.actorId)).limit(1);
    if (!actor || !["site_owner", "site_admin"].includes(actor.role)) throw new Error("Manual grant requires an authenticated platform administrator");
    if (!input.source.trim() || !input.reason.trim() || !input.actorId) throw new Error("Manual grant actor/source/reason required");
    const id = randomUUID();
    await db.insert(tables.course360PaymentManualGrants).values({ id, ...input });
    return id;
  });
}
export async function revokeCourse360PaymentManualAccess(input: { id: string; orgId: number; userId: number; product: Course360AppProduct; actorId: number }): Promise<void> {
  const db = await getCourse360PaymentDb();
  const [actor] = await db.select().from(users).where(eq(users.id, input.actorId)).limit(1);
  if (!actor || !["site_owner", "site_admin"].includes(actor.role)) throw new Error("Manual revocation requires authenticated platform administrator");
  await db.update(tables.course360PaymentManualGrants).set({ revokedAt: new Date() }).where(and(eq(tables.course360PaymentManualGrants.id, input.id), eq(tables.course360PaymentManualGrants.orgId, input.orgId), eq(tables.course360PaymentManualGrants.userId, input.userId), eq(tables.course360PaymentManualGrants.product, input.product)));
}
export async function setCourse360PaymentManualRole(input: { orgId: number; userId: number; product: Course360AppProduct; tier: Course360AppTier; actorId: number; source: string; reason: string; expiresAt?: Date | null }): Promise<void> {
  await transaction(async db => {
    await membership(db, input.orgId, input.userId);
    await lock(db, `manual:${input.orgId}:${input.userId}:${input.product}:${input.source}`);
    const [actor] = await db.select().from(users).where(eq(users.id, input.actorId)).limit(1);
    if (!actor || !["site_owner", "site_admin"].includes(actor.role)) throw new Error("Manual role requires authenticated platform administrator");
    const grants = await db.select().from(tables.course360PaymentManualGrants).where(and(eq(tables.course360PaymentManualGrants.orgId, input.orgId), eq(tables.course360PaymentManualGrants.userId, input.userId), eq(tables.course360PaymentManualGrants.product, input.product), eq(tables.course360PaymentManualGrants.source, input.source)));
    for (const grant of grants.filter(g => !g.revokedAt)) await revokeCourse360PaymentManualAccess({ id: grant.id, orgId: input.orgId, userId: input.userId, product: input.product, actorId: input.actorId });
    if (input.tier !== "none") await grantCourse360PaymentManualAccess({ ...input, tier: input.tier });
    // Does not revoke unrelated sources or historical global fields.
  });
}
export async function course360PaymentAppTrialEligible(userId: number, product: Course360AppProduct): Promise<boolean> {
  const db = await getCourse360PaymentDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error("Authenticated app purchaser missing");
  const legacy = product === "studio" ? [user.studioAccess, user.studioTrialEndsAt] : product === "creator" ? [user.creatorAccess, user.creatorTrialEndsAt] : [user.quizCreatorAccess, user.quizCreatorTrialEndsAt];
  // Unknown legacy history is not paid or school-bound; conservatively avoid a second intro trial.
  return (!legacy[0] || legacy[0] === "none") && !legacy[1];
}
export async function upsertCourse360PaymentPlatformState(orgId: number, subscription: Stripe.Subscription, plan?: "free" | "starter" | "builder" | "pro" | "enterprise"): Promise<void> {
  await transaction(async db => {
    const [stored] = await db.select().from(orgSubscriptions).where(eq(orgSubscriptions.orgId, orgId)).limit(1);
    if (!stored || stored.stripeSubscriptionId !== subscription.id) return;
    const status = subscription.status === "canceled" ? "cancelled" as const : ["active", "trialing", "past_due", "unpaid"].includes(subscription.status) ? subscription.status as "active" | "trialing" | "past_due" | "unpaid" : "unpaid" as const;
    await db.update(orgSubscriptions).set({ ...(plan ? { plan } : {}), status, ...getOrgSubscriptionPeriodDates(subscription), ...getOrgSubscriptionTrialDates(subscription), cancelAtPeriodEnd: subscription.cancel_at_period_end }).where(and(eq(orgSubscriptions.id, stored.id), eq(orgSubscriptions.orgId, orgId), eq(orgSubscriptions.stripeSubscriptionId, subscription.id)));
  });
}
export async function persistCourse360PaymentOwnerClaim(db: Course360PaymentDb, input: { orgId: number; userId: number; email: string; sessionId: string; subscriptionId: string }): Promise<void> {
  await db.insert(tables.course360PaymentOwnerClaims).values({ id: randomUUID(), ...input }).onDuplicateKeyUpdate({ set: { sessionId: input.sessionId } });
}
export async function listCourse360PaymentOwnerClaims(authenticatedUserId: number) {
  const db = await getCourse360PaymentDb();
  const claims = await db.select().from(tables.course360PaymentOwnerClaims).where(and(eq(tables.course360PaymentOwnerClaims.userId, authenticatedUserId), eq(tables.course360PaymentOwnerClaims.state, "pending")));
  return claims.map(c => ({ claimId: c.id, orgId: c.orgId, createdAt: c.createdAt }));
}
export async function claimCourse360PaymentSchoolOwner(input: { claimId: string; authenticatedUserId: number }): Promise<number> {
  return transaction(async db => {
    await lock(db, `claim:${input.claimId}`);
    const [claim] = await db.select().from(tables.course360PaymentOwnerClaims).where(and(eq(tables.course360PaymentOwnerClaims.id, input.claimId), eq(tables.course360PaymentOwnerClaims.userId, input.authenticatedUserId))).limit(1);
    const [user] = await db.select().from(users).where(eq(users.id, input.authenticatedUserId)).limit(1);
    if (!claim || !user?.emailVerified || user.email?.trim().toLowerCase() !== claim.email) throw new Error("Normal authenticated, verified account ownership required");
    const [school] = await db.select().from(organizations).where(and(eq(organizations.id, claim.orgId), eq(organizations.ownerId, user.id))).limit(1);
    if (!school) throw new Error("Pending claim school ownership mismatch");
    await db.insert(orgMembers).values({ orgId: claim.orgId, userId: user.id, role: "org_super_admin", memberSubRole: "basic_member" }).onDuplicateKeyUpdate({ set: { role: "org_super_admin" } });
    await db.update(tables.course360PaymentOwnerClaims).set({ state: "claimed", claimedAt: new Date() }).where(eq(tables.course360PaymentOwnerClaims.id, claim.id));
    return claim.orgId; // No cookie, password reset, global role, or active-school mutation.
  });
}

type HostedDispatcher = (context: { event: Stripe.Event; db: Course360PaymentDb; verifiedAccountId: string; livemode: boolean }) => Promise<boolean>;
let hostedDispatcher: HostedDispatcher | undefined;
export function configureCourse360PaymentHostedPlatformDispatcher(dispatcher: HostedDispatcher): void { hostedDispatcher = dispatcher; }
export async function dispatchCourse360PaymentHostedPlatformEvent(event: Stripe.Event): Promise<boolean> {
  const config = configured();
  if (event.account || event.livemode !== config.livemode) throw new Error("Verified platform account/mode context required");
  if (!hostedDispatcher) return false;
  return hostedDispatcher({ event, db: await getCourse360PaymentDb(), verifiedAccountId: config.accountId, livemode: config.livemode });
}
/** Must be invoked ONLY after signature + envelope/account/mode verification. No event-ID special cases. */
export async function processCourse360PaymentVerifiedEvent(event: Stripe.Event, resourceKey: string, work: () => Promise<void>): Promise<"completed" | "duplicate"> {
  const db = await getCourse360PaymentDb();
  const binding = identity();
  if (event.account || event.livemode !== binding.livemode) throw new Error("Platform authenticated event account/mode mismatch");
  const endpoint = "course360-platform-v1";
  const id = hash(`${endpoint}:${binding.accountId}:${binding.livemode}:${event.id}`);
  const payload = JSON.stringify(event); const payloadHash = hash(payload);
  const token = randomUUID();
  const claimed = await transaction(async tx => {
    await tx.insert(tables.course360PaymentInbox).values({ id, ...binding, endpoint, eventId: event.id, eventType: event.type,
      objectId: stripeObjectId(event.data.object), orgId: Number.isSafeInteger(Number((event.data.object as any).metadata?.org_id)) && Number((event.data.object as any).metadata?.org_id) > 0 ? Number((event.data.object as any).metadata.org_id) : null, payload, payloadHash }).onDuplicateKeyUpdate({ set: { id } });
    const [row] = await tx.select().from(tables.course360PaymentInbox).where(eq(tables.course360PaymentInbox.id, id)).limit(1);
    if (row.payloadHash !== payloadHash) throw new Error("Authenticated event ID payload changed");
    if (row.state === "completed") return false;
    if (row.state === "processing" && row.leaseUntil && row.leaseUntil > new Date()) throw new Error("Webhook work already claimed; retry required");
    const result = await tx.update(tables.course360PaymentInbox).set({ state: "processing", claimToken: token, leaseUntil: new Date(Date.now() + 5 * 60 * 1000), attempts: sql`${tables.course360PaymentInbox.attempts} + 1`, lastError: null }).where(and(eq(tables.course360PaymentInbox.id, id), eq(tables.course360PaymentInbox.state, row.state), eq(tables.course360PaymentInbox.attempts, row.attempts)));
    if (affected(result) !== 1) throw new Error("Webhook inbox CAS lost; retry required");
    return true;
  });
  if (!claimed) return "duplicate";
  try {
    await transaction(async tx => {
      // The DB row lock survives lease expiry. A competing delivery waits, then rechecks its token.
      await lock(tx, `event-resource:${resourceKey}`);
      await tx.update(tables.course360PaymentInbox).set({ leaseUntil: new Date(Date.now() + 5 * 60 * 1000) }).where(eq(tables.course360PaymentInbox.id, id));
      const [row] = await tx.select().from(tables.course360PaymentInbox).where(eq(tables.course360PaymentInbox.id, id)).limit(1);
      if (row.state !== "processing" || row.claimToken !== token) throw new Error("Webhook claim superseded before execution");
      await work(); // All current-state provider reads happen after resource serialization.
      const result = await tx.update(tables.course360PaymentInbox).set({ state: "completed", completedAt: new Date(), claimToken: null, leaseUntil: null }).where(and(eq(tables.course360PaymentInbox.id, id), eq(tables.course360PaymentInbox.claimToken, token)));
      if (affected(result) !== 1) throw new Error("Webhook completion CAS lost");
    });
    return "completed";
  } catch (error) {
    await db.update(tables.course360PaymentInbox).set({ state: "failed", claimToken: null, leaseUntil: null, lastError: error instanceof Error ? error.message.slice(0, 2000) : "Required processing failed" }).where(and(eq(tables.course360PaymentInbox.id, id), eq(tables.course360PaymentInbox.claimToken, token)));
    throw error;
  }
}
