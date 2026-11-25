import { and, desc, eq } from "drizzle-orm";
import { lmsCourses, lmsEnrollments, membershipMembers, memberships, membershipPlans, membershipSubscriptions, orgPaymentSettings } from "../../drizzle/schema";
import { loadCustomerBillingSnapshots, resolveCustomerSchool } from "./customerSubscriptionBilling";

/** The authenticated user and server-resolved school are the only identity inputs. */
export async function getCustomerAccountSubscriptions(user: { id: number; role: string }, req?: Parameters<typeof resolveCustomerSchool>[1]) {
  const { db, orgId } = await resolveCustomerSchool(user, req);
  const [settings] = await db.select({ currency: orgPaymentSettings.currency }).from(orgPaymentSettings)
    .where(eq(orgPaymentSettings.orgId, orgId)).limit(1);
  const currency = settings?.currency ?? "USD";
  const native = await db.select({ id: membershipMembers.id, title: memberships.name, status: membershipMembers.status,
    price: memberships.price, billingInterval: memberships.billingInterval, accessExpiresAt: membershipMembers.expiresAt,
    stripeSubscriptionId: membershipMembers.stripeSubscriptionId }).from(membershipMembers)
    .innerJoin(memberships, eq(membershipMembers.membershipId, memberships.id))
    .where(and(eq(membershipMembers.userId, user.id), eq(memberships.orgId, orgId))).orderBy(desc(membershipMembers.joinedAt));
  const plans = await db.select({ id: membershipSubscriptions.id, title: membershipPlans.name, status: membershipSubscriptions.status,
    price: membershipPlans.price, billingInterval: membershipPlans.billingInterval, accessExpiresAt: membershipSubscriptions.endDate })
    .from(membershipSubscriptions).innerJoin(membershipPlans, eq(membershipSubscriptions.planId, membershipPlans.id))
    .where(and(eq(membershipSubscriptions.userId, user.id), eq(membershipSubscriptions.orgId, orgId), eq(membershipPlans.orgId, orgId)))
    .orderBy(desc(membershipSubscriptions.startDate));
  const content = await db.select({ id: lmsEnrollments.id, title: lmsCourses.title, status: lmsEnrollments.status,
    accessExpiresAt: lmsEnrollments.accessExpiresAt, stripeSubscriptionId: lmsEnrollments.stripeSubscriptionId })
    .from(lmsEnrollments).innerJoin(lmsCourses, eq(lmsEnrollments.courseId, lmsCourses.id))
    .where(and(eq(lmsEnrollments.userId, user.id), eq(lmsEnrollments.orgId, orgId), eq(lmsCourses.orgId, orgId)))
    .orderBy(desc(lmsEnrollments.enrolledAt));
  const billable = [...native, ...content].filter(row => Boolean(row.stripeSubscriptionId));
  const snapshots = await loadCustomerBillingSnapshots(orgId, billable.map(row => ({ orgId, userId: user.id, subscriptionId: row.stripeSubscriptionId! })));
  const withBilling = <T extends { stripeSubscriptionId: string | null }>(row: T) => ({ ...row,
    subscriptionBilling: row.stripeSubscriptionId ? snapshots.get(row.stripeSubscriptionId) ?? null : null });
  return { orgId, currency, memberships: native.map(withBilling), savedPlans: plans,
    content: content.filter(row => Boolean(row.stripeSubscriptionId)).map(withBilling) };
}
