/**
 * Order Bumps Router
 * Admin CRUD for order bump offers + public query for displaying bumps at checkout.
 *
 * Conditional order bumps:
 *   - triggerPricingOptionId (nullable) — when set, the bump is ONLY shown when the
 *     user is purchasing that specific pricing option.  null means "show for all
 *     pricing options of the trigger product".
 */
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { sql, eq, and, isNull, or } from "drizzle-orm";
import { orderBumps, orderBumpConversions, lmsPricingOptions, lmsCourses, digitalProducts } from "../../drizzle/schema";
import { requireOrgAdmin } from "../db";

// Helper to get DB
async function getDb() {
  const { drizzle } = await import("drizzle-orm/mysql2");
  return drizzle(process.env.DATABASE_URL!);
}

// ─── Admin Router ────────────────────────────────────────────────────────────
export const orderBumpsAdminRouter = router({
  /** List all order bumps */
  list: protectedProcedure.query(async ({ ctx }) => {
    const orgId = await requireOrgAdmin(ctx.user.id, ctx.user.role);
    const db = await getDb();
    const rows = await db.select().from(orderBumps).where(eq(orderBumps.orgId, orgId)).orderBy(orderBumps.createdAt);
    return rows;
  }),

  /** Get a single order bump by ID */
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const _orgId = await requireOrgAdmin(ctx.user.id, ctx.user.role);
      const db = await getDb();
      const [row] = await db.select().from(orderBumps).where(eq(orderBumps.id, input.id));
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      return row;
    }),

  /** Create a new order bump */
  create: protectedProcedure
    .input(z.object({
      orgId: z.number().optional(),
      name: z.string().min(1),
      triggerProductType: z.enum(["course", "quiz", "download"]),
      triggerProductId: z.number(),
      bumpProductType: z.enum(["course", "quiz", "download"]),
      bumpProductId: z.number(),
      placement: z.enum(["before_checkout", "during_checkout", "after_checkout"]).default("during_checkout"),
      headline: z.string().optional(),
      description: z.string().optional(),
      discountPercent: z.number().int().min(0).default(0),
      discountedPrice: z.string().optional(),
      landingPageJson: z.any().optional(),
      imageUrl: z.string().optional(),
      buttonText: z.string().default("Add to Order"),
      declineText: z.string().default("No thanks"),
      isActive: z.boolean().default(true),
      presentationMode: z.enum(["widget", "landing_page"]).default("widget"),
      pageBlocks: z.string().optional(), // JSON-serialized Block[]
      slug: z.string().optional(),
      bumpMode: z.enum(["addon", "upgrade"]).default("addon").optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = input.orgId ?? await requireOrgAdmin(ctx.user.id, ctx.user.role);
      await requireOrgAdmin(ctx.user.id, ctx.user.role, orgId);
      const db = await getDb();
      const [result] = await db.insert(orderBumps).values({
        orgId,
        name: input.name,
        triggerProductType: input.triggerProductType,
        triggerProductId: input.triggerProductId,
        bumpProductType: input.bumpProductType,
        bumpProductId: input.bumpProductId,
        placement: input.placement,
        headline: input.headline ?? null,
        description: input.description ?? null,
        discountPercent: input.discountPercent,
        discountedPrice: input.discountedPrice ?? null,
        landingPageJson: input.landingPageJson ?? null,
        imageUrl: input.imageUrl ?? null,
        buttonText: input.buttonText,
        declineText: input.declineText,
        isActive: input.isActive,
        bumpMode: input.bumpMode ?? "addon",
      });
      return { id: result.insertId };
    }),

  /** Update an existing order bump */
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      triggerProductType: z.enum(["course", "quiz", "download"]).optional(),
      triggerProductId: z.number().optional(),
      bumpProductType: z.enum(["course", "quiz", "download"]).optional(),
      bumpProductId: z.number().optional(),
      placement: z.enum(["before_checkout", "during_checkout", "after_checkout"]).optional(),
      headline: z.string().nullable().optional(),
      description: z.string().nullable().optional(),
      discountPercent: z.number().int().min(0).optional(),
      discountedPrice: z.string().nullable().optional(),
      landingPageJson: z.any().nullable().optional(),
      imageUrl: z.string().nullable().optional(),
      buttonText: z.string().optional(),
      declineText: z.string().optional(),
      isActive: z.boolean().optional(),
      bumpMode: z.enum(["addon", "upgrade"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgAdmin(ctx.user.id, ctx.user.role);
      const db = await getDb();
      const { id, ...data } = input;
      await db.update(orderBumps).set(data as any).where(and(eq(orderBumps.id, id), eq(orderBumps.orgId, orgId)));
      return { success: true };
    }),

  /** Delete an order bump */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgAdmin(ctx.user.id, ctx.user.role);
      const db = await getDb();
      await db.delete(orderBumps).where(and(eq(orderBumps.id, input.id), eq(orderBumps.orgId, orgId)));
      return { success: true };
    }),

  /** Get conversion stats for an order bump */
  stats: protectedProcedure
    .input(z.object({ bumpId: z.number() }))
    .query(async ({ ctx, input }) => {
      const orgId = await requireOrgAdmin(ctx.user.id, ctx.user.role);
      const db = await getDb();
      const [bump] = await db.select().from(orderBumps).where(and(eq(orderBumps.id, input.bumpId), eq(orderBumps.orgId, orgId)));
      if (!bump) throw new TRPCError({ code: "NOT_FOUND" });
      const conversions = await db.select().from(orderBumpConversions).where(eq(orderBumpConversions.bumpId, bump.id));
      const accepted = conversions.filter((conversion: { accepted: boolean }) => conversion.accepted).length;
      const amount = Number(bump.discountedPrice ?? 0);
      return {
        impressions: null,
        conversions: accepted,
        conversionRate: null,
        revenue: accepted * amount,
      };
    }),

  /** Duplicate an order bump (resets impressions/conversions, marks inactive) */
  duplicate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgAdmin(ctx.user.id, ctx.user.role);
      const db = await getDb();
      const [src] = await db.select().from(orderBumps).where(and(eq(orderBumps.id, input.id), eq(orderBumps.orgId, orgId))).limit(1);
      if (!src) throw new TRPCError({ code: "NOT_FOUND" });
      const { id: _id, createdAt: _ca, updatedAt: _ua, ...rest } = src;
      const [result] = await db.insert(orderBumps).values({
        ...rest,
        headline: rest.headline ? `${rest.headline} [Copy]` : null,
        isActive: false,
      });
      return { id: result.insertId };
    }),

  /** Get pricing options for a course (used in the admin form to pick a trigger pricing option) */
  getPricingOptionsForCourse: protectedProcedure
    .input(z.object({ courseId: z.number() }))
    .query(async ({ ctx, input }) => {
      const orgId = await requireOrgAdmin(ctx.user.id, ctx.user.role);
      const db = await getDb();
      const [course] = await db.select({ orgId: lmsCourses.orgId }).from(lmsCourses).where(eq(lmsCourses.id, input.courseId)).limit(1);
      if (!course || course.orgId !== orgId) throw new TRPCError({ code: "NOT_FOUND" });
      const rows = await db
        .select()
        .from(lmsPricingOptions)
        .where(and(eq(lmsPricingOptions.courseId, input.courseId), eq(lmsPricingOptions.isActive, true)))
        .orderBy(lmsPricingOptions.sortOrder);
      return rows;
    }),
});

// ─── Public Router (for checkout flow) ───────────────────────────────────────
export const orderBumpsPublicRouter = router({
  /**
   * Get active bumps for a given trigger product (used at checkout).
   *
   * Conditional filtering:
   *   - If triggerPricingOptionId is provided, returns bumps that either:
   *       a) have triggerPricingOptionId = null (applies to all pricing options), OR
   *       b) have triggerPricingOptionId = the provided value (specific to this option)
   *   - If triggerPricingOptionId is NOT provided, returns all active bumps for the product
   *     (backward-compatible behaviour).
   */
  getForProduct: publicProcedure
    .input(z.object({
      triggerType: z.enum(["course", "quiz", "download", "bundle", "physical", "cohort"]),
      triggerProductId: z.number(),
      triggerPricingOptionId: z.number().nullable().optional(),
      timing: z.enum(["before_checkout", "after_checkout"]).optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (input.triggerType !== "course" && input.triggerType !== "quiz" && input.triggerType !== "download") return [];
      const [triggerProduct] = input.triggerType === "download"
        ? await db.select({ orgId: digitalProducts.orgId }).from(digitalProducts).where(eq(digitalProducts.id, input.triggerProductId)).limit(1)
        : await db.select({ orgId: lmsCourses.orgId }).from(lmsCourses).where(eq(lmsCourses.id, input.triggerProductId)).limit(1);
      if (!triggerProduct) return [];
      const baseConditions = [
        eq(orderBumps.orgId, triggerProduct.orgId),
        eq(orderBumps.triggerProductType, input.triggerType),
        eq(orderBumps.triggerProductId, input.triggerProductId),
        eq(orderBumps.isActive, true),
      ];
      if (input.timing) {
        baseConditions.push(eq(orderBumps.placement, input.timing));
      }

      // Conditional pricing option filter:
      // Show bumps that apply to ALL pricing options (null) OR to this specific one
      if (input.triggerPricingOptionId != null) {
        const pricingOptionFilter = or(
          isNull(orderBumps.pricingOptionId),
          eq(orderBumps.pricingOptionId, input.triggerPricingOptionId),
        );
        const rows = await db
          .select()
          .from(orderBumps)
          .where(and(...baseConditions, pricingOptionFilter));
        return rows;
      }

      // No pricing option specified — return all bumps for this product
      const rows = await db.select().from(orderBumps).where(and(...baseConditions));
      return rows;
    }),

  /** Record an impression (bump was shown to user) */
  recordImpression: publicProcedure
    .input(z.object({ bumpId: z.number() }))
    .mutation(async ({ input }) => {
      return { success: true, recorded: false };
    }),

  /** Accept a bump offer — creates a conversion record */
  acceptBump: protectedProcedure
    .input(z.object({
      bumpId: z.number(),
      triggerOrderType: z.enum(["course", "download", "bundle"]),
      triggerOrderId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      // Get the bump details
      const [bump] = await db.select().from(orderBumps).where(eq(orderBumps.id, input.bumpId));
      if (!bump) throw new TRPCError({ code: "NOT_FOUND", message: "Order bump not found" });

      // Record an organization-owned acceptance event. Payment completion remains
      // the source of truth for fulfillment in the checkout webhook.
      await db.insert(orderBumpConversions).values({
        bumpId: input.bumpId,
        orgId: bump.orgId,
        triggerOrderId: input.triggerOrderId ?? null,
        accepted: true,
      });

      return { 
        success: true, 
        bumpId: bump.id,
        bumpPrice: bump.discountedPrice,
        bumpType: bump.bumpProductType,
        bumpProductId: bump.bumpProductId,
        headline: bump.headline,
      };
    }),
});
