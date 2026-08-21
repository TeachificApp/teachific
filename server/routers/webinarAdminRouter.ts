/**
 * webinarAdminRouter.ts
 * Admin procedures for webinar management — org-scoped.
 * Wraps lms.webinars.* and adds checkout page config, after-purchase workflow,
 * hide-pricing-options, CME status join, and enrollment-closed support.
 */
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb, requireOrgAdmin } from "../db";
import {
  webinars,
  cmeActivityForms,
  webinarRegistrations,
} from "../../drizzle/schema";
import { createWebinar, getWebinarById, updateWebinar, deleteWebinar, getWebinarRegistrations, getWebinarStats } from "../lmsDb";
import { nanoid } from "nanoid";

async function requireActiveWebinarAdmin(userId: number, role: string, webinarId: number) {
  const webinar = await getWebinarById(webinarId);
  if (!webinar) throw new TRPCError({ code: "NOT_FOUND" });
  await requireOrgAdmin(userId, role, webinar.orgId);
  return webinar;
}

export const webinarAdminRouter = router({
  /** List all webinars for the current org, with CME status joined */
  list: protectedProcedure
    .input(z.object({ orgId: z.number().optional(), pageSize: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const orgId = await requireOrgAdmin(ctx.user.id, ctx.user.role, input?.orgId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db
        .select({
          ...webinars,
          cmeStatus: cmeActivityForms.cmeStatus,
        })
        .from(webinars)
        .leftJoin(
          cmeActivityForms,
          and(
            eq(cmeActivityForms.courseId, webinars.id),
            eq(cmeActivityForms.orgId, webinars.orgId),
            eq(cmeActivityForms.productType, "webinar"),
          )
        )
        .where(eq(webinars.orgId, orgId))
        .orderBy(desc(webinars.createdAt))
        .limit(input?.pageSize ?? 500);
      return rows;
    }),

  /** Get a single webinar by ID */
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      return requireActiveWebinarAdmin(ctx.user.id, ctx.user.role, input.id);
    }),

  /** Create a new webinar */
  create: protectedProcedure
    .input(z.object({
      orgId: z.number().optional(),
      title: z.string().min(1),
      slug: z.string().optional(),
      scheduledAt: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgAdmin(ctx.user.id, ctx.user.role, input.orgId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const slug = input.slug ?? input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + nanoid(6);
      return createWebinar({ orgId, title: input.title, slug, scheduledAt: input.scheduledAt ?? null });
    }),

  /** Update a webinar (accepts any key/value pairs) */
  update: protectedProcedure
    .input(z.object({
      webinarId: z.number(),
      data: z.record(z.string(), z.unknown()),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireActiveWebinarAdmin(ctx.user.id, ctx.user.role, input.webinarId);
      return updateWebinar(input.webinarId, input.data as any);
    }),

  /** Delete a webinar */
  delete: protectedProcedure
    .input(z.object({ webinarId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireActiveWebinarAdmin(ctx.user.id, ctx.user.role, input.webinarId);
      await deleteWebinar(input.webinarId);
      return { ok: true };
    }),

  /** Get registrations for a webinar */
  getRegistrations: protectedProcedure
    .input(z.object({ webinarId: z.number(), page: z.number().optional(), pageSize: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      await requireActiveWebinarAdmin(ctx.user.id, ctx.user.role, input.webinarId);
      return getWebinarRegistrations(input.webinarId);
    }),

  /** Get stats for a webinar */
  getStats: protectedProcedure
    .input(z.object({ webinarId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireActiveWebinarAdmin(ctx.user.id, ctx.user.role, input.webinarId);
      return getWebinarStats(input.webinarId);
    }),

  /** Get after-purchase workflow for a webinar (stored as postWebinarAction/postWebinarUrl) */
  getAfterPurchaseWorkflow: protectedProcedure
    .input(z.object({ webinarId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireOrgAdmin(ctx.user.id, ctx.user.role);
      const w = await getWebinarById(input.webinarId);
      if (!w) throw new TRPCError({ code: "NOT_FOUND" });
      return { workflow: [] }; // Webinars use postWebinarAction/postWebinarUrl instead
    }),

  /** Update after-purchase workflow (no-op for webinars — use update instead) */
  updateAfterPurchaseWorkflow: protectedProcedure
    .input(z.object({ webinarId: z.number(), workflow: z.array(z.any()) }))
    .mutation(async ({ ctx, input }) => {
      await requireActiveWebinarAdmin(ctx.user.id, ctx.user.role, input.webinarId);
      return { ok: true };
    }),

  /** Get hide-pricing-options setting (webinars don't have this — always false) */
  getHidePricingOptions: protectedProcedure
    .input(z.object({ webinarId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireActiveWebinarAdmin(ctx.user.id, ctx.user.role, input.webinarId);
      return { hidePricingOptions: false };
    }),

  /** Update hide-pricing-options setting (no-op for webinars) */
  updateHidePricingOptions: protectedProcedure
    .input(z.object({ webinarId: z.number(), hidePricingOptions: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await requireActiveWebinarAdmin(ctx.user.id, ctx.user.role, input.webinarId);
      return { ok: true };
    }),

  /** Get checkout page config for a webinar (uses salesPageBlocksJson) */
  getCheckoutPageConfig: protectedProcedure
    .input(z.object({ webinarId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireActiveWebinarAdmin(ctx.user.id, ctx.user.role, input.webinarId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db.select({ salesPageBlocksJson: webinars.salesPageBlocksJson }).from(webinars).where(eq(webinars.id, input.webinarId)).limit(1);
      return { blocks: row?.salesPageBlocksJson ?? null };
    }),

  /** Save checkout page config for a webinar */
  saveCheckoutPageConfig: protectedProcedure
    .input(z.object({ webinarId: z.number(), blocks: z.any() }))
    .mutation(async ({ ctx, input }) => {
      await requireActiveWebinarAdmin(ctx.user.id, ctx.user.role, input.webinarId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(webinars).set({ salesPageBlocksJson: input.blocks } as any).where(eq(webinars.id, input.webinarId));
      return { ok: true };
    }),

  /** Toggle enrollment closed for a webinar */
  setEnrollmentClosed: protectedProcedure
    .input(z.object({ webinarId: z.number(), enrollmentClosed: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await requireActiveWebinarAdmin(ctx.user.id, ctx.user.role, input.webinarId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(webinars).set({ enrollmentClosed: input.enrollmentClosed } as any).where(eq(webinars.id, input.webinarId));
      return { ok: true };
    }),
});
