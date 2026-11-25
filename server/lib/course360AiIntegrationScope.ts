import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { organizations, orgMembers } from "../../drizzle/schema";
import { getOrgIdForUserWithFallback, requireOrgAdmin, isPlatformAdmin } from "../db";

/** Server-resolved school is authoritative, even for platform administrators. */
export async function requireCourse360AiIntegrationSchool(db: any, user: { id: number; role: string }): Promise<number> {
  const orgId = await getOrgIdForUserWithFallback(user.id, user.role);
  if (!orgId) throw new TRPCError({ code: "FORBIDDEN", message: "Choose an active organization." });
  if (user.role === "admin") throw new TRPCError({ code: "FORBIDDEN", message: "A current platform role or exact school administrator membership is required." });
  await requireOrgAdmin(user.id, user.role, orgId);
  if (!isPlatformAdmin(user.role)) {
    const [membership] = await db.select({ role: orgMembers.role }).from(orgMembers)
      .where(and(eq(orgMembers.userId, user.id), eq(orgMembers.orgId, orgId))).limit(1);
    if (!membership || !["org_admin", "org_super_admin"].includes(membership.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Organization administrator access is required." });
    }
  }
  const [organization] = await db.select({ isActive: organizations.isActive }).from(organizations)
    .where(eq(organizations.id, orgId)).limit(1);
  if (!organization?.isActive) throw new TRPCError({ code: "FORBIDDEN", message: "The active organization is unavailable." });
  return orgId;
}
