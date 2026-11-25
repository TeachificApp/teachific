import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { organizations, userActiveOrg } from "../../drizzle/schema";
import { getDb, getOrgMember, getUserById } from "../db";
/** Credentialed learners need persisted selected-school membership, not author product permission. */
export async function requireSelectedQuizLearnerSchool(userId: number) {
 const db = await getDb();
 if (!db) throw new TRPCError({ code:"PRECONDITION_FAILED",message:"School access unavailable." });
 const [selected] = await db.select({ orgId:userActiveOrg.orgId }).from(userActiveOrg).innerJoin(organizations,eq(userActiveOrg.orgId,organizations.id)).where(and(eq(userActiveOrg.userId,userId),eq(organizations.isActive,true))).limit(1);
 if (!selected?.orgId) throw new TRPCError({code:"FORBIDDEN",message:"Select the quiz school before opening this widget."});
 const user = await getUserById(userId);
 if (!user) throw new TRPCError({code:"FORBIDDEN",message:"Account unavailable."});
 if (user.role !== "site_owner" && user.role !== "site_admin" && !await getOrgMember(selected.orgId,userId)) throw new TRPCError({code:"FORBIDDEN",message:"Membership in the explicitly selected quiz school is required."});
 return selected.orgId;
}
