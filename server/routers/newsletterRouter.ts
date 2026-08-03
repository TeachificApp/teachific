/**
 * newsletterRouter.ts
 * Handles newsletter subscription management, org-scoped.
 * Each org has its own subscriber list. orgId=null = platform-level.
 * Unsubscribe tokens are for marketing emails only — transactional emails are unaffected.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { randomBytes } from "crypto";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { newsletterSubscribers, organizations } from "../../drizzle/schema";
import { notifyOwner } from "../_core/notification";
import {
  upsertSendGridContacts,
  getOrCreateSendGridList,
  removeSendGridContactFromList,
} from "../lib/sendgridContacts";

/** Generate a URL-safe 32-byte random token */
function generateToken(): string {
  return randomBytes(32).toString("hex");
}

/** Resolve orgId from slug or explicit orgId */
async function resolveOrgId(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  orgSlug?: string,
  orgId?: number,
): Promise<number | null> {
  if (orgId) return orgId;
  if (orgSlug) {
    const rows = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, orgSlug))
      .limit(1);
    return rows[0]?.id ?? null;
  }
  return null;
}

export const newsletterRouter = router({
  // ── Public: subscribe ──────────────────────────────────────────────────────
  subscribe: publicProcedure
    .input(z.object({
      email: z.string().email().max(255),
      firstName: z.string().max(128).optional(),
      lastName: z.string().max(128).optional(),
      profession: z.string().max(128).optional(),
      interests: z.array(z.string()).optional(),
      source: z.string().max(64).optional(),
      orgSlug: z.string().max(100).optional(), // org subdomain/slug
      orgId: z.number().int().positive().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const now = Date.now();
      const email = input.email.toLowerCase().trim();
      const resolvedOrgId = await resolveOrgId(db, input.orgSlug, input.orgId);

      // Fetch org name for SendGrid list naming
      let orgName = "Newsletter";
      if (resolvedOrgId) {
        const orgRows = await db
          .select({ name: organizations.name })
          .from(organizations)
          .where(eq(organizations.id, resolvedOrgId))
          .limit(1);
        orgName = orgRows[0]?.name ?? "Newsletter";
      }

      // Check if already subscribed (scoped to org)
      const whereClause = resolvedOrgId
        ? and(eq(newsletterSubscribers.email, email), eq(newsletterSubscribers.orgId, resolvedOrgId))
        : eq(newsletterSubscribers.email, email);

      const existing = await db
        .select({
          id: newsletterSubscribers.id,
          isActive: newsletterSubscribers.isActive,
          unsubscribeToken: newsletterSubscribers.unsubscribeToken,
        })
        .from(newsletterSubscribers)
        .where(whereClause)
        .limit(1);

      if (existing.length > 0) {
        const row = existing[0];
        if (row.isActive) {
          return { success: true, alreadySubscribed: true, unsubscribeToken: row.unsubscribeToken };
        }
        // Re-subscribe: reactivate and generate a fresh token
        const token = generateToken();
        await db
          .update(newsletterSubscribers)
          .set({
            isActive: 1,
            subscribedAt: now,
            unsubscribedAt: null as any,
            unsubscribeToken: token,
            updatedAt: new Date(),
          })
          .where(eq(newsletterSubscribers.id, row.id));
        return { success: true, alreadySubscribed: false, unsubscribeToken: token };
      }

      // New subscriber — generate token
      const token = generateToken();
      await db.insert(newsletterSubscribers).values({
        orgId: resolvedOrgId,
        email,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        profession: input.profession ?? null,
        interests: input.interests ? JSON.stringify(input.interests) : null,
        source: input.source ?? "subscribe_page",
        subscribedAt: now,
        isActive: 1,
        unsubscribeToken: token,
      });

      // Sync to SendGrid Marketing Contacts (fire-and-forget)
      const name = [input.firstName, input.lastName].filter(Boolean).join(" ") || email;
      const listName = `${orgName} Subscribers`;
      (async () => {
        try {
          const listId = await getOrCreateSendGridList(listName);
          await upsertSendGridContacts(
            [{
              email,
              first_name: input.firstName,
              last_name: input.lastName,
              list_ids: listId ? [listId] : undefined,
            }],
            listId ? [listId] : undefined,
          );
        } catch (err) {
          console.error("[newsletter] SendGrid sync error:", err);
        }
      })();

      // Notify owner of new subscriber
      await notifyOwner({
        title: "New Newsletter Subscriber",
        content: `${name} (${email}) subscribed to ${orgName}${input.profession ? ` — ${input.profession}` : ""}.`,
      }).catch(() => {/* non-blocking */});

      return { success: true, alreadySubscribed: false, unsubscribeToken: token };
    }),

  // ── Public: unsubscribe via signed token ───────────────────────────────────
  unsubscribeByToken: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db
        .select({
          id: newsletterSubscribers.id,
          email: newsletterSubscribers.email,
          orgId: newsletterSubscribers.orgId,
          isActive: newsletterSubscribers.isActive,
        })
        .from(newsletterSubscribers)
        .where(eq(newsletterSubscribers.unsubscribeToken, input.token))
        .limit(1);
      if (rows.length === 0) {
        return { success: true, alreadyUnsubscribed: true };
      }
      const row = rows[0];
      if (!row.isActive) {
        return { success: true, alreadyUnsubscribed: true };
      }
      await db
        .update(newsletterSubscribers)
        .set({ isActive: 0, unsubscribedAt: Date.now(), updatedAt: new Date() })
        .where(eq(newsletterSubscribers.id, row.id));

      // Remove from SendGrid list (fire-and-forget)
      (async () => {
        try {
          // Fetch org name for list naming
          let orgName = "Newsletter";
          if (row.orgId) {
            const orgRows = await db
              .select({ name: organizations.name })
              .from(organizations)
              .where(eq(organizations.id, row.orgId))
              .limit(1);
            orgName = orgRows[0]?.name ?? "Newsletter";
          }
          const listId = await getOrCreateSendGridList(`${orgName} Subscribers`);
          if (listId) {
            await removeSendGridContactFromList(row.email, listId);
          }
        } catch (err) {
          console.error("[newsletter] SendGrid unsubscribe error:", err);
        }
      })();
      return { success: true, alreadyUnsubscribed: false };
    }),

  // ── Public: unsubscribe via email (legacy / direct) ───────────────────────
  unsubscribe: publicProcedure
    .input(z.object({
      email: z.string().email(),
      orgId: z.number().int().positive().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const email = input.email.toLowerCase().trim();
      const whereClause = input.orgId
        ? and(eq(newsletterSubscribers.email, email), eq(newsletterSubscribers.orgId, input.orgId))
        : eq(newsletterSubscribers.email, email);
      await db
        .update(newsletterSubscribers)
        .set({ isActive: 0, unsubscribedAt: Date.now(), updatedAt: new Date() })
        .where(whereClause);
      return { success: true };
    }),

  // ── Admin: list subscribers for an org ────────────────────────────────────
  listSubscribers: protectedProcedure
    .input(z.object({
      orgId: z.number().int().positive().optional(),
      limit: z.number().int().min(1).max(500).default(200),
      offset: z.number().int().min(0).default(0),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const isSiteLevel = ctx.user.role === "site_owner" || ctx.user.role === "site_admin";
      if (!isSiteLevel) throw new TRPCError({ code: "FORBIDDEN" });

      const limit = input?.limit ?? 200;
      const offset = input?.offset ?? 0;
      const orgId = input?.orgId;

      const whereClause = orgId
        ? eq(newsletterSubscribers.orgId, orgId)
        : undefined;

      const rows = await db
        .select()
        .from(newsletterSubscribers)
        .where(whereClause)
        .orderBy(desc(newsletterSubscribers.createdAt))
        .limit(limit)
        .offset(offset);
      return rows;
    }),

  // ── Admin: update subscriber (activate/deactivate) ────────────────────────
  updateSubscriber: protectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      isActive: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const isSiteLevel = ctx.user.role === "site_owner" || ctx.user.role === "site_admin";
      if (!isSiteLevel) throw new TRPCError({ code: "FORBIDDEN" });
      await db
        .update(newsletterSubscribers)
        .set({
          isActive: input.isActive ? 1 : 0,
          updatedAt: new Date(),
          ...(input.isActive ? {} : { unsubscribedAt: Date.now() }),
        })
        .where(eq(newsletterSubscribers.id, input.id));
      return { success: true };
    }),

  // ── Admin: delete subscriber ───────────────────────────────────────────────
  deleteSubscriber: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const isSiteLevel = ctx.user.role === "site_owner" || ctx.user.role === "site_admin";
      if (!isSiteLevel) throw new TRPCError({ code: "FORBIDDEN" });
      await db
        .delete(newsletterSubscribers)
        .where(eq(newsletterSubscribers.id, input.id));
      return { success: true };
    }),

  // ── Public: get org info for subscribe page ───────────────────────────────
  getOrgInfo: publicProcedure
    .input(z.object({
      orgSlug: z.string().max(100).optional(),
      orgId: z.number().int().positive().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const resolvedOrgId = await resolveOrgId(db, input.orgSlug, input.orgId);
      if (!resolvedOrgId) return null;
      const rows = await db
        .select({
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
          logoUrl: organizations.logoUrl,
          description: organizations.description,
        })
        .from(organizations)
        .where(eq(organizations.id, resolvedOrgId))
        .limit(1);
      return rows[0] ?? null;
    }),
});
