import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { getDb, getOrgIdForUserWithFallback, requireOrgAdmin } from "../db";
import { organizations, orgSubscriptions } from "../../drizzle/schema";
import { getEffectiveSubscriptionPlan } from "../../shared/subscriptionEntitlement";
import { funnelAiUrlSchema } from "../../shared/funnelAi";

export async function requireFunnel360School(ctx: { user: { id: number; role: string } }, advanced = false) {
  const orgId = await getOrgIdForUserWithFallback(ctx.user.id, ctx.user.role);
  if (!orgId) throw new TRPCError({ code: "FORBIDDEN", message: "Select an active school first." });
  await requireOrgAdmin(ctx.user.id, ctx.user.role, orgId);
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
  const [org] = await db.select().from(organizations).where(and(eq(organizations.id, orgId), eq(organizations.isActive, true))).limit(1);
  if (!org) throw new TRPCError({ code: "FORBIDDEN", message: "School unavailable." });
  if (advanced) {
    const [subscription] = await db.select().from(orgSubscriptions).where(eq(orgSubscriptions.orgId, orgId)).limit(1);
    if (!["pro", "enterprise"].includes(getEffectiveSubscriptionPlan(subscription?.plan, subscription?.status)))
      throw new TRPCError({ code: "FORBIDDEN", message: "This advanced funnel feature requires an active Pro or Enterprise school plan." });
  }
  return { db, orgId, org, baseUrl: funnel360SchoolOrigin(org) };
}
export function funnel360SchoolOrigin(org: {
  slug: string; customSubdomain?: string | null; customDomain?: string | null; domainVerificationStatus?: string | null;
}) {
  // Match the existing Course360 public resolver, which maps organization.slug.
  const subdomain = org.slug;
  if (!/^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/.test(subdomain) || ["www", "app", "api", "admin", "learn"].includes(subdomain))
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Configure a valid school publishing domain." });
  if (org.customDomain && org.domainVerificationStatus === "verified") {
    try {
      const url = new URL(org.customDomain.includes("://") ? org.customDomain : `https://${org.customDomain}`);
      if (url.protocol === "https:" && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash)
        return url.origin;
    } catch { /* Invalid saved custom domain must not be used. */ }
  }
  return `https://${subdomain}.course360.app`;
}
export function assertFunnel360Destination(value: string, baseUrl: string) {
  const safe = funnelAiUrlSchema.parse(value);
  if (!safe) return "";
  const destination = new URL(safe, baseUrl);
  if (destination.origin !== new URL(baseUrl).origin)
    throw new TRPCError({ code: "BAD_REQUEST", message: "CTA destinations must belong to the owning school's publishing domain." });
  return destination.href;
}
