import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { lmsEnrollments, membershipMembers, membershipSubscriptions, bundleEnrollments, digitalPurchases, webinarRegistrations, users, lmsCourses, memberships, membershipPlans, bundles, digitalProducts, webinars } from "../../drizzle/schema";
import { course360EntitlementTargets as targets, course360EntitlementSources as sources } from "./course360HostedCheckoutTables";
import type { HostedPurchase } from "./course360HostedCheckout";

export type HostedEntitlementFamily = "course" | "membership" | "membership_plan" | "bundle" | "download" | "webinar";
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const tableFor = (family: HostedEntitlementFamily): any => ({ course: lmsEnrollments, membership: membershipMembers, membership_plan: membershipSubscriptions, bundle: bundleEnrollments, download: digitalPurchases, webinar: webinarRegistrations })[family];
const fields: Record<HostedEntitlementFamily, string[]> = {
  course: ["id", "orgId", "userId", "courseId", "status", "enrollmentType", "orderId", "source", "stripeSubscriptionId", "accessExpiresAt", "expiresAt"],
  membership: ["id", "membershipId", "userId", "status", "stripeSubscriptionId", "expiresAt", "cancelledAt"],
  membership_plan: ["id", "orgId", "userId", "planId", "status", "endDate"],
  bundle: ["id", "bundleId", "userId", "pricingOptionId", "stripePaymentIntentId", "accessExpiresAt"],
  download: ["id", "userId", "productId", "stripeCheckoutSessionId", "stripePaymentIntentId"],
  webinar: ["id", "orgId", "webinarId", "email"],
};
export function hostedCanonicalFingerprint(family: HostedEntitlementFamily, row: any): string {
  return JSON.stringify(fields[family].map(key => family === "course" && key === "status" && row?.status === "completed" ? "active" : row?.[key] ?? null));
}
export function hostedCanonicalAccess(family: HostedEntitlementFamily, row: any, now = Date.now()): boolean {
  if (!row) return false;
  if (family === "course" && (row.enrollmentType !== "full" || !["active", "completed"].includes(row.status))) return false;
  if (["membership", "membership_plan"].includes(family) && row.status !== "active") return false;
  const cutoffs = [row.accessExpiresAt, row.expiresAt, row.endDate].filter(v => v != null).map(v => new Date(v).getTime());
  return cutoffs.every(v => Number.isFinite(v) && v > now);
}
export function hostedSourceAccess(source: any, now = Date.now()): boolean {
  return source.status === "active" && (source.cutoff == null ? !source.subscriptionId : Number.isFinite(new Date(source.cutoff).getTime()) && new Date(source.cutoff).getTime() > now);
}
async function canonicalRows(db: any, target: any, lock = false) {
  const table = tableFor(target.family);
  const parent = ({ course: table.courseId, membership: table.membershipId, membership_plan: table.planId, bundle: table.bundleId, download: table.productId, webinar: table.webinarId } as any)[target.family];
  const clauses = [eq(parent, target.resourceId)];
  if (table.orgId) clauses.push(eq(table.orgId, target.orgId));
  if (table.userId) clauses.push(eq(table.userId, target.userId));
  else {
    const [user] = await db.select().from(users).where(eq(users.id, target.userId)).limit(1);
    if (!user?.email) throw new Error("Entitlement buyer email unavailable");
    clauses.push(eq(table.email, user.email));
  }
  const query = db.select().from(table).where(and(...clauses));
  return lock ? query.for("update") : query;
}
function valuesFor(target: any, source: any, cutoff: Date | null, active: boolean): any {
  const common = { userId: target.userId };
  switch (target.family) {
    case "course": return { ...common, orgId: target.orgId, courseId: target.resourceId, status: active ? "active" : "expired", enrollmentType: "full", source: source.source, stripeSubscriptionId: source.subscriptionId, accessExpiresAt: cutoff, expiresAt: null };
    case "membership": return { ...common, membershipId: target.resourceId, status: active ? "active" : "expired", stripeSubscriptionId: source.subscriptionId, expiresAt: cutoff, cancelledAt: null };
    case "membership_plan": return { ...common, orgId: target.orgId, planId: target.resourceId, status: active ? "active" : "cancelled", endDate: cutoff };
    case "bundle": return { ...common, bundleId: target.resourceId, accessExpiresAt: cutoff };
    case "download": return { ...common, productId: target.resourceId, stripeCheckoutSessionId: source.sessionId ?? null };
    default: throw new Error("Webinar insert requires server buyer identity");
  }
}
/** Called only inside a purchase/binding transaction. Target locks serialize overlapping sources across instances. */
export async function recordHostedEntitlement(db: any, purchase: HostedPurchase, family: HostedEntitlementFamily, resourceId: number, cutoff: Date | null, extra: any = {}) {
  const targetId = hash([purchase.orgId, purchase.userId, family, resourceId]);
  await db.insert(targets).values({ id: targetId, orgId: purchase.orgId, userId: purchase.userId, family, resourceId }).onDuplicateKeyUpdate({ set: { id: targetId } });
  const [target] = await db.select().from(targets).where(eq(targets.id, targetId)).for("update").limit(1);
  if (!target) throw new Error("Entitlement target missing");
  const sourceName = extra.source ?? `course360_hosted:${purchase.id}`;
  const sourceId = hash([purchase.id, targetId, sourceName, purchase.stripeSubscriptionId]);
  const source = { id: sourceId, targetId, purchaseId: purchase.id, orgId: purchase.orgId, userId: purchase.userId, family, resourceId, subscriptionId: purchase.stripeSubscriptionId, canonicalValues: JSON.stringify({ ...extra, sessionId: purchase.stripeSessionId }), source: sourceName, status: "active", cutoff, updatedAt: new Date() };
  await db.insert(sources).values(source).onDuplicateKeyUpdate({ set: { id: sourceId } });
  const rows = await canonicalRows(db, target, true);
  if (rows.length > 1) throw new Error("Ambiguous canonical entitlement requires reviewed reconciliation");
  const row = rows[0];
  // A valid independent/manual row is never reclassified as a payment source.
  if (!target.projection && hostedCanonicalAccess(family, row)) return;
  await projectHostedEntitlementTarget(db, target, { ...extra, sessionId: purchase.stripeSessionId });
}

export async function projectHostedEntitlementTarget(db: any, target: any, extra: any = {}) {
  const table = tableFor(target.family);
  const rows = await canonicalRows(db, target, true);
  if (rows.length > 1) throw new Error("Ambiguous canonical entitlement");
  const row = rows[0];
  if (target.projection && (!row || row.id !== target.canonicalId || hostedCanonicalFingerprint(target.family, row) !== target.projection)) return;
  if (!target.projection && hostedCanonicalAccess(target.family, row)) return;
  const all = await db.select().from(sources).where(eq(sources.targetId, target.id)).for("update");
  const eligible = all.filter((s: any) => hostedSourceAccess(s));
  // Unlimited one-time source wins; otherwise choose the longest eligible paid-through boundary.
  eligible.sort((a: any, b: any) => (b.cutoff == null ? Infinity : new Date(b.cutoff).getTime()) - (a.cutoff == null ? Infinity : new Date(a.cutoff).getTime()) || a.id.localeCompare(b.id));
  const selected = eligible[0] ?? all[0];
  if (!selected) throw new Error("Entitlement target has no source");
  const cutoff = eligible.length ? (selected.cutoff ? new Date(selected.cutoff) : null) : new Date(1000);
  if (!row && !eligible.length) return;
  let values: any;
  if (target.family === "webinar") {
    const [user] = await db.select().from(users).where(eq(users.id, target.userId)).limit(1);
    if (!user?.email) throw new Error("Webinar buyer unavailable");
    values = { orgId: target.orgId, webinarId: target.resourceId, email: user.email, firstName: user.name ?? null };
  } else {
    const savedValues = selected.canonicalValues ? JSON.parse(selected.canonicalValues) : {};
    values = { ...valuesFor(target, { ...selected, sessionId: savedValues.sessionId }, cutoff, !!eligible.length), ...savedValues };
  }
  delete values.sessionId;
  // Downloads/webinars remain immutable registration/history records; access MUST consume the adapter below.
  if (row && !["download", "webinar"].includes(target.family)) {
    const clauses = [eq(table.id, row.id)];
    if (table.orgId) clauses.push(eq(table.orgId, target.orgId));
    if (table.userId) clauses.push(eq(table.userId, target.userId));
    await db.update(table).set(values).where(and(...clauses));
  } else if (!row) await db.insert(table).values(values);
  const [saved] = await canonicalRows(db, target);
  if (!saved) throw new Error("Canonical entitlement persistence failed");
  await db.update(targets).set({ canonicalId: saved.id, projection: hostedCanonicalFingerprint(target.family, saved) }).where(eq(targets.id, target.id));
}

/** Protected access adapter: caller must resolve resource ownership and authenticated user/school before calling. */
export async function hasCourse360SourceEntitlement(db: any, input: { orgId: number; userId: number; family: HostedEntitlementFamily; resourceId: number }, now = Date.now()): Promise<boolean> {
  for (const value of [input.orgId, input.userId, input.resourceId]) if (!Number.isSafeInteger(value) || value <= 0) throw new Error("Entitlement access requires school/user/resource identity");
  const resource: any = ({ course: lmsCourses, membership: memberships, membership_plan: membershipPlans, bundle: bundles, download: digitalProducts, webinar: webinars })[input.family];
  if (!resource) throw new Error("Unsupported entitlement access family");
  const [owned] = await db.select().from(resource).where(and(eq(resource.id, input.resourceId), eq(resource.orgId, input.orgId))).limit(1);
  if (!owned) return false;
  const id = hash([input.orgId, input.userId, input.family, input.resourceId]);
  const [target] = await db.select().from(targets).where(eq(targets.id, id)).limit(1);
  const rows = await canonicalRows(db, { ...input, family: input.family });
  if (!target) return rows.some((row: any) => hostedCanonicalAccess(input.family, row, now));
  const independent = rows.some((row: any) => (!target.projection || row.id !== target.canonicalId || hostedCanonicalFingerprint(input.family, row) !== target.projection) && hostedCanonicalAccess(input.family, row, now));
  if (independent) return true;
  const all = await db.select().from(sources).where(and(eq(sources.targetId, id), eq(sources.orgId, input.orgId), eq(sources.userId, input.userId)));
  return all.some((source: any) => hostedSourceAccess(source, now));
}
