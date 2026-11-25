import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { lmsCourses, organizations, orgMembers, users } from "../../drizzle/schema";
import { buildFunnelPurchaseConfirmationEmail, buildOrgAdminNewPurchaseEmail, sendEmailViaOrg } from "../_core/email";
import { getOrgBaseUrl } from "./orgUrl";
import { readEmbeddedManifest } from "./embeddedCheckoutSelection";

/** Nonessential email failures must not roll back a settled entitlement transaction. */
export async function notifyEmbeddedPurchase(purchase: any) {
  try {
    const db = await getDb();
    if (!db) return;
    const manifest = readEmbeddedManifest(purchase.snapshotManifest);
    const [org] = await db.select().from(organizations).where(eq(organizations.id, purchase.orgId)).limit(1);
    if (!org?.slug) return;
    const base = getOrgBaseUrl(org.slug, org.customDomain, org.domainVerificationStatus);
    let loginUrl = `${base}/my-courses`;
    if (purchase.productType === "download" || purchase.productType === "bundle") loginUrl = `${base}/my-downloads`;
    if (purchase.fulfillmentCourseId) {
      const [course] = await db.select({ slug: lmsCourses.slug }).from(lmsCourses).where(and(eq(lmsCourses.id, purchase.fulfillmentCourseId), eq(lmsCourses.orgId, purchase.orgId))).limit(1);
      if (course?.slug) loginUrl = `${base}/courses/${course.slug}`;
    }
    const buyer = buildFunnelPurchaseConfirmationEmail({ firstName: (purchase.name ?? purchase.email).split(/[\s@]/)[0] || "there", productName: purchase.productName, amountPaid: Number(purchase.amount), orderBumps: manifest.bumps, loginUrl });
    await sendEmailViaOrg({ to: { name: purchase.name ?? purchase.email, email: purchase.email }, subject: buyer.subject, htmlBody: buyer.htmlBody, previewText: buyer.previewText }, purchase.orgId).catch(() => {});
    const admins = await db.select({ email: users.email, name: users.name }).from(orgMembers).innerJoin(users, eq(orgMembers.userId, users.id)).where(and(eq(orgMembers.orgId, purchase.orgId), inArray(orgMembers.role, ["org_super_admin", "org_admin"])));
    const notification = buildOrgAdminNewPurchaseEmail({ orgName: org.name, buyerName: purchase.name ?? purchase.email, buyerEmail: purchase.email, productName: purchase.productName, amountPaid: Number(purchase.amount), productType: purchase.productType, adminDashboardUrl: `${base}/admin?tab=enrollments` });
    for (const admin of admins) if (admin.email) await sendEmailViaOrg({ to: { name: admin.name ?? admin.email, email: admin.email }, subject: notification.subject, htmlBody: notification.htmlBody, previewText: notification.previewText }, purchase.orgId).catch(() => {});
  } catch (error) { console.error("[Embedded checkout] Notification failed", error); }
}
