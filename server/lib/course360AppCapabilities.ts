import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { getDb, getOrgMember, getUserById } from "../db";
import { organizations, orgSubscriptions, userActiveOrg, userActivityLogs } from "../../drizzle/schema";
import { aggregateCourse360PaymentAppAccess, configureCourse360PaymentLedger, getCourse360PaymentDb, course360PaymentLedgerReady, type Course360PaymentLedgerConfiguration } from "./course360PaymentLedger";
import { course360PaymentAppSubscriptions, course360PaymentManualGrants } from "./course360PaymentTables";
import type { Course360AppTier } from "./course360WebhookAppEntitlement";

export type Course360CapabilityApp = "studio" | "creator" | "quiz_creator";
export type Course360CapabilityMode = "web" | "desktop";
let ledgerIdentity: Pick<Course360PaymentLedgerConfiguration, "accountId" | "livemode"> | undefined;
/** Parent bootstrap supplies the independently verified account once; never per request. */
export function configureCourse360AppCapabilityLedger(options: Course360PaymentLedgerConfiguration) {
  configureCourse360PaymentLedger(options);
  ledgerIdentity = { accountId: options.accountId, livemode: options.livemode };
}
const none = () => ({ tier: "none" as Course360AppTier, isActive: false, isPaid: false, isInTrial: false, hasManualGrant: false, trialEndsAt: null as Date | null });
function includesMode(tier: string, mode: Course360CapabilityMode) { return tier === mode || tier === "bundle"; }

/** Identity, explicit selection and author permission are independent of product payment. */
export async function requireCourse360AppOrganization(userId: number, requestedOrgId?: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "School access service is unavailable." });
  const [selected] = await db.select({ orgId: userActiveOrg.orgId }).from(userActiveOrg)
    .innerJoin(organizations, eq(userActiveOrg.orgId, organizations.id))
    .where(and(eq(userActiveOrg.userId, userId), eq(organizations.isActive, true))).limit(1);
  if (!selected?.orgId) throw new TRPCError({ code: "FORBIDDEN", message: "Select an active school before using this app." });
  if (requestedOrgId !== undefined && requestedOrgId !== selected.orgId) throw new TRPCError({ code: "FORBIDDEN", message: "Switch to the requested school before using this app." });
  const user = await getUserById(userId);
  if (!user) throw new TRPCError({ code: "FORBIDDEN", message: "Account access is unavailable." });
  const platformSupport = user.role === "site_owner" || user.role === "site_admin";
  const member = await getOrgMember(selected.orgId, userId);
  // Existing persisted school roles are the author permission contract. A browser
  // or global org_admin claim is not one; basic learners cannot buy author authority.
  if (!platformSupport && (!member || !(["org_super_admin", "org_admin", "sub_admin"].includes(member.role) || member.memberSubRole === "instructor"))) {
    throw new TRPCError({ code: "FORBIDDEN", message: "School author permission is required to use this app." });
  }
  return { orgId: selected.orgId, platformSupport, member };
}

async function modeAccess(orgId: number, userId: number, app: Course360CapabilityApp, mode: Course360CapabilityMode) {
  if (!ledgerIdentity || !course360PaymentLedgerReady()) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "App billing is not configured. Please contact support." });
  const db = await getCourse360PaymentDb();
  const records = await db.select().from(course360PaymentAppSubscriptions).where(and(
    eq(course360PaymentAppSubscriptions.orgId, orgId), eq(course360PaymentAppSubscriptions.userId, userId),
    eq(course360PaymentAppSubscriptions.product, app), eq(course360PaymentAppSubscriptions.accountId, ledgerIdentity.accountId),
    eq(course360PaymentAppSubscriptions.livemode, ledgerIdentity.livemode)));
  const grants = await db.select().from(course360PaymentManualGrants).where(and(
    eq(course360PaymentManualGrants.orgId, orgId), eq(course360PaymentManualGrants.userId, userId), eq(course360PaymentManualGrants.product, app)));
  // Use the canonical lifecycle/expiry/manual predicate on only applicable sources:
  // a paid Desktop source must not remove a Web trial's watermark, or vice versa.
  return aggregateCourse360PaymentAppAccess(records.filter(r => includesMode(r.tier, mode)), grants.filter(g => includesMode(g.tier, mode)));
}

async function studioSchoolInclusion(orgId: number, mode: Course360CapabilityMode) {
  if (mode !== "web") return none(); // Desktop Pro inclusion has no approved structured policy.
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "School billing service is unavailable." });
  const [school] = await db.select().from(orgSubscriptions).where(eq(orgSubscriptions.orgId, orgId)).limit(1);
  if (!school || !["builder", "pro", "enterprise"].includes(school.plan) || !["active", "trialing"].includes(school.status) || (school.rawStripeStatus && !["active", "trialing"].includes(school.rawStripeStatus))) return none();
  // Existing explicit administrator-assigned school plans are retained, not
  // rewritten into fabricated Stripe subscriptions or app manual grants.
  const reviewedManual = !!school.assignedByUserId && !school.stripeSubscriptionId && school.status === "active";
  const status = school.rawStripeStatus || school.status;
  const state = aggregateCourse360PaymentAppAccess(school.stripeSubscriptionId ? [{ tier: "web", rawStatus: status, currentPeriodEnd: school.currentPeriodEnd, trialEnd: school.trialEndsAt }] : [], reviewedManual ? [{ tier: "web", expiresAt: school.currentPeriodEnd, revokedAt: null }] : []);
  return state;
}

/** Status returns denied decisions; unavailable persistence/configuration still fails closed. */
export async function getCourse360AppCapabilityStatus(userId: number, app: Course360CapabilityApp, mode: Course360CapabilityMode) {
  let scope: Awaited<ReturnType<typeof requireCourse360AppOrganization>>;
  try { scope = await requireCourse360AppOrganization(userId); }
  catch (error) {
    if (error instanceof TRPCError && error.code === "FORBIDDEN") return { orgId: null, access: none(), isPaid: false, hasManualGrant: false, platformSupport: false, schoolIncluded: false, reason: error.message };
    throw error;
  }
  if (scope.platformSupport) {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Support audit service is unavailable." });
    // Required, awaited audit record; failure denies support access. No fake paid/manual state.
    await db.insert(userActivityLogs).values({ userId, eventType: "course360_app_support_bypass", description: "Persisted platform support used an explicitly selected school app", metadata: { orgId: scope.orgId, app, mode, permission: "persisted-platform-role" } });
    return { orgId: scope.orgId, access: { ...none(), tier: "bundle" as Course360AppTier, isActive: true }, isPaid: false, hasManualGrant: false, platformSupport: true, schoolIncluded: false, reason: null };
  }
  const standalone = await modeAccess(scope.orgId, userId, app, mode);
  const school = app === "studio" ? await studioSchoolInclusion(scope.orgId, mode) : none();
  // Prefer a paid/reviewed school source over a standalone trial for this mode.
  const useSchool = school.isActive && (!standalone.isActive || (!standalone.isPaid && !standalone.hasManualGrant && (school.isPaid || school.hasManualGrant)));
  const access = useSchool ? school : standalone;
  return { orgId: scope.orgId, access, isPaid: access.isPaid, hasManualGrant: access.hasManualGrant, platformSupport: false, schoolIncluded: useSchool, reason: access.isActive ? null : `Active ${mode === "web" ? "Web or Bundle" : "Desktop or Bundle"} access is required.` };
}
export async function requireCourse360AppCapability(userId: number, app: Course360CapabilityApp, mode: Course360CapabilityMode) {
  const result = await getCourse360AppCapabilityStatus(userId, app, mode);
  if (!result.orgId || !result.access.isActive) throw new TRPCError({ code: "FORBIDDEN", message: result.reason || "Active app access is required." });
  return { ...result, orgId: result.orgId };
}

/** Billing recovery remains reachable for expired/unpaid app subscriptions. */
export async function getCourse360AppBillingRecords(userId: number, app: Course360CapabilityApp) {
  const scope = await requireCourse360AppOrganization(userId);
  if (!ledgerIdentity || !course360PaymentLedgerReady()) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "App billing is not configured." });
  const db = await getCourse360PaymentDb();
  return db.select().from(course360PaymentAppSubscriptions).where(and(
    eq(course360PaymentAppSubscriptions.orgId, scope.orgId), eq(course360PaymentAppSubscriptions.userId, userId),
    eq(course360PaymentAppSubscriptions.product, app), eq(course360PaymentAppSubscriptions.accountId, ledgerIdentity.accountId),
    eq(course360PaymentAppSubscriptions.livemode, ledgerIdentity.livemode)));
}
export function course360DesktopArtifactUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try { const url = new URL(raw); return url.protocol === "https:" && !url.username && !url.password ? url.href : null; } catch { return null; }
}
