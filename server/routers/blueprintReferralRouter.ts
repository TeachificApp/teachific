import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { TRPCError } from "@trpc/server";
import { randomBytes } from "crypto";
import {
  blueprintReferralLinks,
  blueprintPendingInstalls,
  blueprintCommissions,
  blueprints,
} from "../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

function pendingInstallExpiry(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 30); // 30-day window to sign up and claim
  return d;
}

// ── Router ────────────────────────────────────────────────────────────────────

export const blueprintReferralRouter = router({
  // ── Creator: create a referral link for a blueprint they own ──────────────
  createLink: protectedProcedure
    .input(z.object({
      blueprintId: z.number().int(),
      slug: z.string().min(3).max(100).regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
      commissionRate: z.number().min(0).max(1).default(0.2),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [bp] = await db.select().from(blueprints).where(eq(blueprints.id, input.blueprintId));
      if (!bp) throw new TRPCError({ code: "NOT_FOUND", message: "Blueprint not found" });

      const orgId = ctx.user.currentOrgId;
      if (!orgId) throw new TRPCError({ code: "FORBIDDEN", message: "No active organization" });

      const isPlatformAdmin = ctx.user.role === "site_owner" || ctx.user.role === "site_admin";
      if (!isPlatformAdmin && bp.creatorOrgId !== orgId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only create referral links for your own blueprints" });
      }

      const [existing] = await db.select({ id: blueprintReferralLinks.id })
        .from(blueprintReferralLinks)
        .where(eq(blueprintReferralLinks.slug, input.slug));
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "This slug is already taken. Please choose another." });

      const [link] = await db.insert(blueprintReferralLinks).values({
        blueprintId: input.blueprintId,
        creatorOrgId: orgId,
        creatorUserId: ctx.user.id,
        slug: input.slug,
        commissionRate: String(input.commissionRate),
        isActive: true,
      }).$returningId();

      return { id: link.id, slug: input.slug, url: `https://${input.slug}.teachific.app?ref=1` };
    }),

  // ── Creator: list their referral links ────────────────────────────────────
  listLinks: protectedProcedure
    .input(z.object({ blueprintId: z.number().int().optional() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const orgId = ctx.user.currentOrgId;
      if (!orgId) return [];

      const rows = await db.select({
        id: blueprintReferralLinks.id,
        blueprintId: blueprintReferralLinks.blueprintId,
        slug: blueprintReferralLinks.slug,
        commissionRate: blueprintReferralLinks.commissionRate,
        totalClicks: blueprintReferralLinks.totalClicks,
        totalSignups: blueprintReferralLinks.totalSignups,
        totalConversions: blueprintReferralLinks.totalConversions,
        isActive: blueprintReferralLinks.isActive,
        createdAt: blueprintReferralLinks.createdAt,
        blueprintTitle: blueprints.title,
        blueprintSlug: blueprints.slug,
        blueprintThumbnail: blueprints.thumbnailUrl,
      })
        .from(blueprintReferralLinks)
        .leftJoin(blueprints, eq(blueprints.id, blueprintReferralLinks.blueprintId))
        .where(
          input.blueprintId
            ? and(
                eq(blueprintReferralLinks.creatorOrgId, orgId),
                eq(blueprintReferralLinks.blueprintId, input.blueprintId)
              )
            : eq(blueprintReferralLinks.creatorOrgId, orgId)
        );

      return rows.map((r) => ({
        ...r,
        url: `https://${r.slug}.teachific.app?ref=1`,
        commissionRate: Number(r.commissionRate),
      }));
    }),

  // ── Public: get blueprint landing page data by referral slug ──────────────
  getLandingPage: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [link] = await db.select({
        id: blueprintReferralLinks.id,
        blueprintId: blueprintReferralLinks.blueprintId,
        slug: blueprintReferralLinks.slug,
        isActive: blueprintReferralLinks.isActive,
      })
        .from(blueprintReferralLinks)
        .where(and(
          eq(blueprintReferralLinks.slug, input.slug),
          eq(blueprintReferralLinks.isActive, true),
        ));

      if (!link) throw new TRPCError({ code: "NOT_FOUND", message: "Blueprint not found" });

      const [bp] = await db.select().from(blueprints).where(eq(blueprints.id, link.blueprintId));
      if (!bp || bp.status !== "published") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Blueprint not available" });
      }

      return {
        referralLinkId: link.id,
        referralSlug: link.slug,
        blueprint: {
          id: bp.id,
          title: bp.title,
          slug: bp.slug,
          shortDescription: bp.shortDescription,
          fullDescription: bp.fullDescription,
          category: bp.category,
          thumbnailUrl: bp.thumbnailUrl,
          previewImageUrls: bp.previewImageUrls,
          pricingType: bp.pricingType,
          price: bp.price ? Number(bp.price) : null,
          currency: bp.currency,
          setupTimeEstimate: bp.setupTimeEstimate,
          difficultyLevel: bp.difficultyLevel,
          installCount: null as number | null,
          averageRating: null as number | null,
        },
      };
    }),

  // ── Public: track a click on a referral link ──────────────────────────────
  trackClick: publicProcedure
    .input(z.object({ slug: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { ok: false };
      await db.update(blueprintReferralLinks)
        .set({ totalClicks: sql`${blueprintReferralLinks.totalClicks} + 1` })
        .where(eq(blueprintReferralLinks.slug, input.slug));
      return { ok: true };
    }),

  // ── Public: create a pending install record (before signup) ───────────────
  createPendingInstall: publicProcedure
    .input(z.object({
      blueprintId: z.number().int(),
      referralLinkId: z.number().int().optional(),
      userEmail: z.string().email().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const sessionToken = generateSessionToken();
      const expiresAt = pendingInstallExpiry();

      await db.insert(blueprintPendingInstalls).values({
        blueprintId: input.blueprintId,
        referralLinkId: input.referralLinkId ?? null,
        sessionToken,
        userEmail: input.userEmail ?? null,
        status: "pending",
        expiresAt,
      });

      if (input.referralLinkId) {
        await db.update(blueprintReferralLinks)
          .set({ totalSignups: sql`${blueprintReferralLinks.totalSignups} + 1` })
          .where(eq(blueprintReferralLinks.id, input.referralLinkId));
      }

      return { sessionToken };
    }),

  // ── Protected: claim a pending install after signup ───────────────────────
  claimPendingInstall: protectedProcedure
    .input(z.object({ sessionToken: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const now = new Date();
      const [pending] = await db.select().from(blueprintPendingInstalls)
        .where(and(
          eq(blueprintPendingInstalls.sessionToken, input.sessionToken),
          eq(blueprintPendingInstalls.status, "pending"),
        ));

      if (!pending) throw new TRPCError({ code: "NOT_FOUND", message: "Install session not found or already claimed" });
      if (pending.expiresAt < now) {
        await db.update(blueprintPendingInstalls)
          .set({ status: "expired" })
          .where(eq(blueprintPendingInstalls.id, pending.id));
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This install link has expired" });
      }

      await db.update(blueprintPendingInstalls)
        .set({ status: "claimed", userId: ctx.user.id, claimedAt: now })
        .where(eq(blueprintPendingInstalls.id, pending.id));

      return { blueprintId: pending.blueprintId, pendingInstallId: pending.id };
    }),

  // ── Protected: mark a pending install as completed ────────────────────────
  completePendingInstall: protectedProcedure
    .input(z.object({ pendingInstallId: z.number().int(), orgId: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await db.update(blueprintPendingInstalls)
        .set({ status: "completed", orgId: input.orgId, installedAt: new Date() })
        .where(eq(blueprintPendingInstalls.id, input.pendingInstallId));
      return { ok: true };
    }),

  // ── Creator: get commission stats ─────────────────────────────────────────
  getStats: protectedProcedure
    .input(z.object({ blueprintId: z.number().int().optional() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { totalClicks: 0, totalSignups: 0, totalConversions: 0, pendingCommissionCents: 0, paidCommissionCents: 0 };

      const orgId = ctx.user.currentOrgId;
      if (!orgId) return { totalClicks: 0, totalSignups: 0, totalConversions: 0, pendingCommissionCents: 0, paidCommissionCents: 0 };

      const links = await db.select({
        id: blueprintReferralLinks.id,
        totalClicks: blueprintReferralLinks.totalClicks,
        totalSignups: blueprintReferralLinks.totalSignups,
        totalConversions: blueprintReferralLinks.totalConversions,
      })
        .from(blueprintReferralLinks)
        .where(
          input.blueprintId
            ? and(eq(blueprintReferralLinks.creatorOrgId, orgId), eq(blueprintReferralLinks.blueprintId, input.blueprintId))
            : eq(blueprintReferralLinks.creatorOrgId, orgId)
        );

      const totalClicks = links.reduce((s, l) => s + l.totalClicks, 0);
      const totalSignups = links.reduce((s, l) => s + l.totalSignups, 0);
      const totalConversions = links.reduce((s, l) => s + l.totalConversions, 0);

      let pendingCommissionCents = 0;
      let paidCommissionCents = 0;

      const commissions = await db.select({
        status: blueprintCommissions.status,
        amount: blueprintCommissions.commissionAmountCents,
      })
        .from(blueprintCommissions)
        .where(eq(blueprintCommissions.creatorOrgId, orgId));

      for (const c of commissions) {
        if (c.status === "pending" || c.status === "approved") pendingCommissionCents += c.amount;
        if (c.status === "paid") paidCommissionCents += c.amount;
      }

      return { totalClicks, totalSignups, totalConversions, pendingCommissionCents, paidCommissionCents };
    }),

  // ── Protected: deactivate a referral link ────────────────────────────────
  deactivateLink: protectedProcedure
    .input(z.object({ linkId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const orgId = ctx.user.currentOrgId;
      if (!orgId) throw new TRPCError({ code: "FORBIDDEN" });
      await db.update(blueprintReferralLinks)
        .set({ isActive: false })
        .where(and(
          eq(blueprintReferralLinks.id, input.linkId),
          eq(blueprintReferralLinks.creatorOrgId, orgId),
        ));
      return { ok: true };
    }),
});
