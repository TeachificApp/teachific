import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { adminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { organizations, orgSubscriptions, users } from "../../drizzle/schema";
import { describeOrgAccount, type OrgAccountStatus } from "../../shared/orgAccountStatus";

// Deliberate platform oversight, not an operational tenant endpoint. School
// admins and learners cannot query other organizations' account/billing data.
export const orgAccountsRouter = router({
  list: adminProcedure.input(z.object({
    search: z.string().trim().max(200).default(""),
    status: z.enum(["all", "trialing", "active", "attention", "other"]).default("all"),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(25),
  }).strict()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Organization account data is temporarily unavailable." });
    const rows = await db.select({
      orgId: organizations.id,
      orgName: organizations.name,
      orgSlug: organizations.slug,
      orgIsActive: organizations.isActive,
      ownerName: users.name,
      ownerEmail: users.email,
      joinedAt: organizations.createdAt,
      subscriptionId: orgSubscriptions.id,
      plan: orgSubscriptions.plan,
      subscriptionStatus: orgSubscriptions.status,
      rawStripeStatus: orgSubscriptions.rawStripeStatus,
      stripeSubscriptionId: orgSubscriptions.stripeSubscriptionId,
      trialStartedAt: orgSubscriptions.trialStartedAt,
      trialEndsAt: orgSubscriptions.trialEndsAt,
      currentPeriodStart: orgSubscriptions.currentPeriodStart,
      currentPeriodEnd: orgSubscriptions.currentPeriodEnd,
      cancelAtPeriodEnd: orgSubscriptions.cancelAtPeriodEnd,
      updatedAt: orgSubscriptions.updatedAt,
    }).from(organizations)
      .leftJoin(orgSubscriptions, eq(orgSubscriptions.orgId, organizations.id))
      .leftJoin(users, eq(users.id, organizations.ownerId))
      .orderBy(desc(organizations.createdAt), desc(organizations.id));
    const asOf = Date.now();
    const accounts = rows.map(row => describeOrgAccount(row, asOf));
    const attention: OrgAccountStatus[] = ["trial_ended", "past_due", "unpaid", "unverified"];
    const active: OrgAccountStatus[] = ["active", "manual", "legacy_free"];
    const summary = {
      total: accounts.length,
      trialing: accounts.filter(a => a.status === "trialing").length,
      endingSoon: accounts.filter(a => a.status === "trialing" && a.hoursRemaining != null && a.hoursRemaining <= 72).length,
      active: accounts.filter(a => active.includes(a.status)).length,
      activeSubscriptions: accounts.filter(a => a.status === "active").length,
      attention: accounts.filter(a => attention.includes(a.status)).length,
    };
    const search = input.search.toLowerCase();
    const filtered = accounts.filter(account => {
      if (search && ![account.orgName, account.orgSlug, account.ownerName, account.ownerEmail].some(value => value?.toLowerCase().includes(search))) return false;
      if (input.status === "trialing") return account.status === "trialing";
      if (input.status === "active") return active.includes(account.status);
      if (input.status === "attention") return attention.includes(account.status);
      if (input.status === "other") return !["trialing", ...active, ...attention].includes(account.status);
      return true;
    });
    // Trials approaching renewal appear first within the trial-only view.
    if (input.status === "trialing") filtered.sort((a, b) => (a.trialEndsAt ?? Infinity) - (b.trialEndsAt ?? Infinity));
    const pageCount = Math.max(1, Math.ceil(filtered.length / input.pageSize));
    const page = Math.min(input.page, pageCount);
    return {
      scope: "platform_organizations" as const,
      asOf,
      summary,
      total: filtered.length,
      page,
      pageCount,
      accounts: filtered.slice((page - 1) * input.pageSize, page * input.pageSize),
    };
  }),
});
