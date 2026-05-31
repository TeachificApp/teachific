// membershipRouter.ts
// Handles Membership plans, tiers, bundle items, coupons, member portal, and sales pages.
// Wired into lmsRouter as `lms.memberships.*` and also exported as `memberships` top-level.

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc, inArray } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  memberships,
  membershipTiers,
  membershipBundleItems,
  membershipTierItems,
  membershipCoupons,
  membershipMembers,
  membershipContent,
  membershipRules,
  coupons,
  users,
} from "../../drizzle/schema";

// ─── Input Schemas ────────────────────────────────────────────────────────────

const membershipUpsertSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  thumbnailUrl: z.string().optional().nullable(),
  features: z.array(z.string()).optional().nullable(),
  highlights: z.array(z.string()).optional().nullable(),
  price: z.number().min(0).optional(),
  billingInterval: z.enum(["monthly", "yearly", "one_time"]).optional(),
  trialDays: z.number().min(0).optional(),
  courseAccess: z.enum(["all", "specific"]).optional(),
  courseIds: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  stripeProductId: z.string().optional().nullable(),
  stripePriceId: z.string().optional().nullable(),
  salesPageSlug: z.string().optional().nullable(),
  landingBlocks: z.string().optional().nullable(),
  seoTitle: z.string().optional().nullable(),
  seoDescription: z.string().optional().nullable(),
  seoImage: z.string().optional().nullable(),
  sortOrder: z.number().optional(),
});

const tierUpsertSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  price: z.string().optional(),
  billingInterval: z.enum(["monthly", "quarterly", "yearly", "one_time"]).optional(),
  trialDays: z.number().min(0).optional(),
  features: z.array(z.string()).optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().optional(),
  stripeProductId: z.string().optional().nullable(),
  stripePriceId: z.string().optional().nullable(),
});

const bundleItemSchema = z.object({
  resourceType: z.enum(["course", "quiz", "download", "community", "webinar", "product"]),
  resourceId: z.number().int().positive(),
  accessType: z.enum(["full", "preview", "timed"]).optional(),
  accessDays: z.number().int().positive().optional().nullable(),
  sortOrder: z.number().optional(),
});

// ─── Router ───────────────────────────────────────────────────────────────────

export const membershipRouter = router({
  // ── List memberships for an org ──────────────────────────────────────────────
  list: protectedProcedure
    .input(z.object({ orgId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db
        .select()
        .from(memberships)
        .where(eq(memberships.orgId, input.orgId))
        .orderBy(memberships.sortOrder, desc(memberships.createdAt));
    }),

  // ── Get single membership ────────────────────────────────────────────────────
  get: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db.select().from(memberships).where(eq(memberships.id, input.id)).limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      return row;
    }),

  // ── Create membership ────────────────────────────────────────────────────────
  create: protectedProcedure
    .input(z.object({ orgId: z.number().int().positive() }).merge(membershipUpsertSchema))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { orgId, features, highlights, ...rest } = input;
      const result = await db.insert(memberships).values({
        orgId,
        ...rest,
        features: features ? JSON.stringify(features) : null,
        highlights: highlights ? JSON.stringify(highlights) : null,
      });
      return { id: (result as any).insertId as number };
    }),

  // ── Update membership ────────────────────────────────────────────────────────
  update: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }).merge(membershipUpsertSchema.partial()))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, features, highlights, ...rest } = input;
      const updateData: Record<string, any> = { ...rest };
      if (features !== undefined) updateData.features = features ? JSON.stringify(features) : null;
      if (highlights !== undefined) updateData.highlights = highlights ? JSON.stringify(highlights) : null;
      await db.update(memberships).set(updateData).where(eq(memberships.id, id));
      return { success: true };
    }),

  // ── Delete membership ────────────────────────────────────────────────────────
  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(membershipMembers).where(eq(membershipMembers.membershipId, input.id));
      await db.delete(membershipContent).where(eq(membershipContent.membershipId, input.id));
      await db.delete(membershipRules).where(eq(membershipRules.membershipId, input.id));
      await db.delete(membershipBundleItems).where(eq(membershipBundleItems.membershipId, input.id));
      await db.delete(membershipTierItems).where(
        inArray(
          membershipTierItems.tierId,
          db.select({ id: membershipTiers.id }).from(membershipTiers).where(eq(membershipTiers.membershipId, input.id)) as any
        )
      );
      await db.delete(membershipTiers).where(eq(membershipTiers.membershipId, input.id));
      await db.delete(membershipCoupons).where(eq(membershipCoupons.membershipId, input.id));
      await db.delete(memberships).where(eq(memberships.id, input.id));
      return { success: true };
    }),

  // ── Save landing page blocks ──────────────────────────────────────────────────
  saveLandingBlocks: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), blocks: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(memberships).set({ landingBlocks: input.blocks }).where(eq(memberships.id, input.id));
      return { success: true };
    }),

  // ── Get landing page blocks (public) ─────────────────────────────────────────
  getLandingBlocks: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db
        .select({ landingBlocks: memberships.landingBlocks, name: memberships.name, description: memberships.description })
        .from(memberships)
        .where(eq(memberships.id, input.id))
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      return row;
    }),

  // ── Get landing page by slug (public) ────────────────────────────────────────
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db
        .select()
        .from(memberships)
        .where(and(eq(memberships.salesPageSlug, input.slug), eq(memberships.isActive, true)))
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      return row;
    }),

  // ── Content (legacy: what's included in a membership) ────────────────────────
  getContent: protectedProcedure
    .input(z.object({ membershipId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db.select().from(membershipContent).where(eq(membershipContent.membershipId, input.membershipId));
    }),

  addContent: protectedProcedure
    .input(z.object({
      membershipId: z.number().int().positive(),
      contentType: z.enum(["course", "digital_product", "community", "webinar"]),
      contentId: z.number().int().positive(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.insert(membershipContent).values(input);
      return { success: true };
    }),

  removeContent: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(membershipContent).where(eq(membershipContent.id, input.id));
      return { success: true };
    }),

  // ── Bundle Items (new: rich resource bundles per membership) ──────────────────
  getBundleItems: protectedProcedure
    .input(z.object({ membershipId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db
        .select()
        .from(membershipBundleItems)
        .where(eq(membershipBundleItems.membershipId, input.membershipId))
        .orderBy(membershipBundleItems.sortOrder);
    }),

  addBundleItem: protectedProcedure
    .input(z.object({ orgId: z.number().int().positive(), membershipId: z.number().int().positive() }).merge(bundleItemSchema))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const result = await db.insert(membershipBundleItems).values(input);
      return { id: (result as any).insertId as number };
    }),

  removeBundleItem: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(membershipBundleItems).where(eq(membershipBundleItems.id, input.id));
      return { success: true };
    }),

  // ── Tiers ─────────────────────────────────────────────────────────────────────
  getTiers: protectedProcedure
    .input(z.object({ membershipId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db
        .select()
        .from(membershipTiers)
        .where(eq(membershipTiers.membershipId, input.membershipId))
        .orderBy(membershipTiers.sortOrder);
    }),

  createTier: protectedProcedure
    .input(z.object({ orgId: z.number().int().positive(), membershipId: z.number().int().positive() }).merge(tierUpsertSchema))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { features, ...rest } = input;
      const result = await db.insert(membershipTiers).values({
        ...rest,
        features: features ? JSON.stringify(features) : null,
      });
      return { id: (result as any).insertId as number };
    }),

  updateTier: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }).merge(tierUpsertSchema.partial()))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, features, ...rest } = input;
      const updateData: Record<string, any> = { ...rest };
      if (features !== undefined) updateData.features = features ? JSON.stringify(features) : null;
      await db.update(membershipTiers).set(updateData).where(eq(membershipTiers.id, id));
      return { success: true };
    }),

  deleteTier: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(membershipTierItems).where(eq(membershipTierItems.tierId, input.id));
      await db.delete(membershipTiers).where(eq(membershipTiers.id, input.id));
      return { success: true };
    }),

  // ── Tier Items ────────────────────────────────────────────────────────────────
  getTierItems: protectedProcedure
    .input(z.object({ tierId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db
        .select()
        .from(membershipTierItems)
        .where(eq(membershipTierItems.tierId, input.tierId))
        .orderBy(membershipTierItems.sortOrder);
    }),

  addTierItem: protectedProcedure
    .input(z.object({ orgId: z.number().int().positive(), tierId: z.number().int().positive() }).merge(bundleItemSchema))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const result = await db.insert(membershipTierItems).values(input);
      return { id: (result as any).insertId as number };
    }),

  removeTierItem: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(membershipTierItems).where(eq(membershipTierItems.id, input.id));
      return { success: true };
    }),

  // ── Coupons (membership-specific discount codes) ──────────────────────────────
  getCoupons: protectedProcedure
    .input(z.object({ membershipId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const links = await db
        .select()
        .from(membershipCoupons)
        .where(eq(membershipCoupons.membershipId, input.membershipId));
      if (!links.length) return [];
      const couponIds = links.map((l) => l.couponId);
      return db.select().from(coupons).where(inArray(coupons.id, couponIds));
    }),

  linkCoupon: protectedProcedure
    .input(z.object({ orgId: z.number().int().positive(), membershipId: z.number().int().positive(), couponId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Upsert — ignore duplicate
      const [existing] = await db
        .select()
        .from(membershipCoupons)
        .where(and(eq(membershipCoupons.membershipId, input.membershipId), eq(membershipCoupons.couponId, input.couponId)))
        .limit(1);
      if (!existing) {
        await db.insert(membershipCoupons).values({ orgId: input.orgId, membershipId: input.membershipId, couponId: input.couponId });
      }
      return { success: true };
    }),

  unlinkCoupon: protectedProcedure
    .input(z.object({ membershipId: z.number().int().positive(), couponId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(membershipCoupons).where(
        and(eq(membershipCoupons.membershipId, input.membershipId), eq(membershipCoupons.couponId, input.couponId))
      );
      return { success: true };
    }),

  // ── Members ───────────────────────────────────────────────────────────────────
  getMembers: protectedProcedure
    .input(z.object({ membershipId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db
        .select({
          id: membershipMembers.id,
          membershipId: membershipMembers.membershipId,
          userId: membershipMembers.userId,
          status: membershipMembers.status,
          joinedAt: membershipMembers.joinedAt,
          expiresAt: membershipMembers.expiresAt,
          cancelledAt: membershipMembers.cancelledAt,
          stripeSubscriptionId: membershipMembers.stripeSubscriptionId,
          userName: users.name,
          userEmail: users.email,
        })
        .from(membershipMembers)
        .leftJoin(users, eq(users.id, membershipMembers.userId))
        .where(eq(membershipMembers.membershipId, input.membershipId))
        .orderBy(desc(membershipMembers.joinedAt));
      return rows;
    }),

  addMember: protectedProcedure
    .input(z.object({
      membershipId: z.number().int().positive(),
      userId: z.number().int().positive(),
      status: z.enum(["active", "paused", "cancelled", "expired"]).optional(),
      expiresAt: z.date().optional().nullable(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [existing] = await db
        .select()
        .from(membershipMembers)
        .where(and(eq(membershipMembers.membershipId, input.membershipId), eq(membershipMembers.userId, input.userId)))
        .limit(1);
      if (existing) {
        await db.update(membershipMembers).set({ status: input.status ?? "active" }).where(eq(membershipMembers.id, existing.id));
        return { id: existing.id };
      }
      const result = await db.insert(membershipMembers).values({
        membershipId: input.membershipId,
        userId: input.userId,
        status: input.status ?? "active",
        expiresAt: input.expiresAt ?? null,
      });
      return { id: (result as any).insertId as number };
    }),

  updateMember: protectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      status: z.enum(["active", "paused", "cancelled", "expired"]).optional(),
      expiresAt: z.date().optional().nullable(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...rest } = input;
      await db.update(membershipMembers).set(rest).where(eq(membershipMembers.id, id));
      return { success: true };
    }),

  removeMember: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(membershipMembers).where(eq(membershipMembers.id, input.id));
      return { success: true };
    }),

  // ── Auto-Enrollment Rules ─────────────────────────────────────────────────────
  getRules: protectedProcedure
    .input(z.object({ membershipId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db.select().from(membershipRules).where(eq(membershipRules.membershipId, input.membershipId));
    }),

  addRule: protectedProcedure
    .input(z.object({
      membershipId: z.number().int().positive(),
      triggerType: z.enum(["course_purchase", "product_purchase", "webinar_registration", "tag_added", "manual"]),
      triggerEntityId: z.number().int().positive().optional().nullable(),
      triggerTag: z.string().optional().nullable(),
      action: z.enum(["add_to_membership", "remove_from_membership"]).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const result = await db.insert(membershipRules).values(input);
      return { id: (result as any).insertId as number };
    }),

  updateRule: protectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      isActive: z.boolean().optional(),
      action: z.enum(["add_to_membership", "remove_from_membership"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...rest } = input;
      await db.update(membershipRules).set(rest).where(eq(membershipRules.id, id));
      return { success: true };
    }),

  removeRule: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(membershipRules).where(eq(membershipRules.id, input.id));
      return { success: true };
    }),

  // ── My Memberships (learner portal) ──────────────────────────────────────────
  myMemberships: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const rows = await db
      .select({
        id: membershipMembers.id,
        membershipId: membershipMembers.membershipId,
        status: membershipMembers.status,
        joinedAt: membershipMembers.joinedAt,
        expiresAt: membershipMembers.expiresAt,
        name: memberships.name,
        description: memberships.description,
        thumbnailUrl: memberships.thumbnailUrl,
        features: memberships.features,
        highlights: memberships.highlights,
        price: memberships.price,
        billingInterval: memberships.billingInterval,
        orgId: memberships.orgId,
      })
      .from(membershipMembers)
      .innerJoin(memberships, eq(memberships.id, membershipMembers.membershipId))
      .where(and(eq(membershipMembers.userId, ctx.user.id), eq(membershipMembers.status, "active")));
    return rows.map((r) => ({
      ...r,
      features: r.features ? (() => { try { return JSON.parse(r.features!); } catch { return []; } })() : [],
      highlights: r.highlights ? (() => { try { return JSON.parse(r.highlights!); } catch { return []; } })() : [],
    }));
  }),

  // ── My Membership Bundle Items (what a user has access to via their memberships) ─
  myBundleItems: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    // Get user's active memberships
    const activeMemberships = await db
      .select({ membershipId: membershipMembers.membershipId })
      .from(membershipMembers)
      .where(and(eq(membershipMembers.userId, ctx.user.id), eq(membershipMembers.status, "active")));
    if (!activeMemberships.length) return [];
    const membershipIds = activeMemberships.map((m) => m.membershipId);
    return db
      .select()
      .from(membershipBundleItems)
      .where(inArray(membershipBundleItems.membershipId, membershipIds))
      .orderBy(membershipBundleItems.sortOrder);
  }),
});
