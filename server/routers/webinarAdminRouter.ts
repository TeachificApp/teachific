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
import { getDb, getOrgIdForUserWithFallback, requireOrgAdmin } from "../db";
import {
  digitalProducts,
  webinars,
  cmeActivityForms,
  webinarRegistrations,
} from "../../drizzle/schema";
import { createWebinar, getCourseById, getWebinarById, updateWebinar, deleteWebinar, getWebinarRegistrations, getWebinarStats } from "../lmsDb";
import { nanoid } from "nanoid";

async function requireActiveWebinarAdmin(userId: number, role: string, webinarId: number) {
  const activeOrgId = await getOrgIdForUserWithFallback(userId, role);
  if (!activeOrgId) throw new TRPCError({ code: "FORBIDDEN", message: "Select an active organization before managing webinars." });
  await requireOrgAdmin(userId, role, activeOrgId);
  const webinar = await getWebinarById(webinarId);
  if (!webinar) throw new TRPCError({ code: "NOT_FOUND" });
  if (webinar.orgId !== activeOrgId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "This webinar belongs to another organization." });
  }
  return { webinar, orgId: activeOrgId };
}

async function requireActiveWebinarOrg(userId: number, role: string, requestedOrgId?: number) {
  const activeOrgId = await getOrgIdForUserWithFallback(userId, role);
  if (!activeOrgId) throw new TRPCError({ code: "FORBIDDEN", message: "Select an active organization before managing webinars." });
  if (requestedOrgId !== undefined && requestedOrgId !== activeOrgId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Switch to the webinar's organization before managing webinars." });
  }
  await requireOrgAdmin(userId, role, activeOrgId);
  return activeOrgId;
}

const webinarAdminUpdateDataSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  slug: z.string().trim().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  type: z.enum(["live", "evergreen", "prerecorded"]).optional(),
  status: z.enum(["draft", "published", "ended"]).optional(),
  accessType: z.enum(["free", "paid", "restricted"]).optional(),
  videoSource: z.enum(["upload", "youtube", "vimeo", "zoom", "teams", "embed"]).nullable().optional(),
  videoUrl: z.string().max(4096).nullable().optional(),
  videoFileUrl: z.string().max(4096).nullable().optional(),
  videoFileKey: z.string().max(1024).nullable().optional(),
  meetingUrl: z.string().max(4096).nullable().optional(),
  meetingId: z.string().max(128).nullable().optional(),
  scheduledAt: z.union([z.date(), z.string().datetime(), z.number().int().nonnegative()]).nullable().optional(),
  durationMinutes: z.number().int().min(0).max(100_000).optional(),
  timezone: z.string().max(64).nullable().optional(),
  replayUrl: z.string().max(4096).nullable().optional(),
  replayEnabled: z.boolean().optional(),
  replayDelayMinutes: z.number().int().min(0).max(86_400).optional(),
  hostName: z.string().max(255).nullable().optional(),
  hostTitle: z.string().max(255).nullable().optional(),
  maxAttendees: z.number().int().min(0).max(1_000_000).nullable().optional(),
  requireRegistration: z.boolean().optional(),
  registrationFormFields: z.unknown().nullable().optional(),
  salesPageBlocksJson: z.unknown().optional(),
  thumbnailUrl: z.string().max(4096).nullable().optional(),
  coverImage: z.string().max(4096).nullable().optional(),
  subtitle: z.string().max(255).nullable().optional(),
  metaTitle: z.string().max(255).nullable().optional(),
  metaDescription: z.string().max(1024).nullable().optional(),
  publishDomain: z.string().max(255).nullable().optional(),
  aiViewersEnabled: z.boolean().optional(),
  aiViewersMin: z.number().int().min(0).max(1_000_000).optional(),
  aiViewersMax: z.number().int().min(0).max(1_000_000).optional(),
  aiViewersPeakAt: z.number().int().min(0).max(86_400).optional(),
  postWebinarAction: z.enum(["product", "url", "thankyou", "none"]).optional(),
  postWebinarProductId: z.number().int().positive().nullable().optional(),
  postWebinarUrl: z.string().max(4096).nullable().optional(),
  postWebinarMessage: z.string().nullable().optional(),
  postWebinarDelaySeconds: z.number().int().min(0).max(86_400).optional(),
  linkedCourseId: z.number().int().positive().nullable().optional(),
  price: z.number().finite().min(0).max(10_000_000).optional(),
  currency: z.string().trim().min(3).max(8).optional(),
  pricingType: z.enum(["free", "one_time", "subscription"]).optional(),
  stripePriceId: z.string().max(255).nullable().optional(),
  stripeProductId: z.string().max(255).nullable().optional(),
  stripePaymentLinkUrl: z.string().max(2048).nullable().optional(),
  isPublished: z.boolean().optional(),
  enrollmentClosed: z.boolean().optional(),
  purchaseTermsAgreement: z.string().max(2048).nullable().optional(),
  purchaseTermsLink1Label: z.string().max(255).nullable().optional(),
  purchaseTermsLink1Url: z.string().max(1024).nullable().optional(),
  purchaseTermsLink2Label: z.string().max(255).nullable().optional(),
  purchaseTermsLink2Url: z.string().max(1024).nullable().optional(),
}).strict();

const webinarAdminUpdateInputSchema = z.union([
  z.object({ webinarId: z.number().int().positive(), data: webinarAdminUpdateDataSchema }).strict(),
  webinarAdminUpdateDataSchema.extend({ id: z.number().int().positive() }).strict(),
]).transform((input) => "data" in input
  ? { webinarId: input.webinarId, data: input.data }
  : (() => {
    const { id, ...data } = input;
    return { webinarId: id, data };
  })());

async function assertWebinarAdminReferencesBelongToOrg(
  orgId: number,
  data: z.infer<typeof webinarAdminUpdateDataSchema>,
) {
  if (data.linkedCourseId !== undefined && data.linkedCourseId !== null) {
    const course = await getCourseById(data.linkedCourseId);
    if (!course || course.orgId !== orgId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "The linked course must belong to the active organization." });
    }
  }
  if (data.postWebinarProductId !== undefined && data.postWebinarProductId !== null) {
    const course = await getCourseById(data.postWebinarProductId);
    if (course?.orgId === orgId) return;
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [product] = await db.select({ id: digitalProducts.id }).from(digitalProducts).where(and(
      eq(digitalProducts.id, data.postWebinarProductId),
      eq(digitalProducts.orgId, orgId),
    )).limit(1);
    if (!product) {
      throw new TRPCError({ code: "FORBIDDEN", message: "The post-webinar product must belong to the active organization." });
    }
  }
}

export const webinarAdminRouter = router({
  /** List all webinars for the current org, with CME status joined */
  list: protectedProcedure
    .input(z.object({ orgId: z.number().optional(), pageSize: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const orgId = await requireActiveWebinarOrg(ctx.user.id, ctx.user.role, input?.orgId);
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
      return { webinars: rows, total: rows.length };
    }),

  /** Get a single webinar by ID */
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      return (await requireActiveWebinarAdmin(ctx.user.id, ctx.user.role, input.id)).webinar;
    }),

  /** Create a new webinar */
  create: protectedProcedure
    .input(z.object({
      orgId: z.number().optional(),
      title: z.string().min(1),
      slug: z.string().optional(),
      scheduledAt: z.date().optional(),
      type: z.enum(["live", "evergreen"]).optional(),
    }).strict())
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireActiveWebinarOrg(ctx.user.id, ctx.user.role, input.orgId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const slug = input.slug ?? input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + nanoid(6);
      return createWebinar({ orgId, title: input.title, slug, type: input.type ?? "evergreen", scheduledAt: input.scheduledAt ?? null });
    }),

  /** Update a Webinar through the explicit editor allowlist. */
  update: protectedProcedure
    .input(webinarAdminUpdateInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { orgId } = await requireActiveWebinarAdmin(ctx.user.id, ctx.user.role, input.webinarId);
      await assertWebinarAdminReferencesBelongToOrg(orgId, input.data);
      const data = {
        ...input.data,
        type: input.data.type === "prerecorded" ? "evergreen" : input.data.type,
        scheduledAt: input.data.scheduledAt instanceof Date || input.data.scheduledAt === null || input.data.scheduledAt === undefined
          ? input.data.scheduledAt
          : new Date(input.data.scheduledAt),
      };
      return updateWebinar(input.webinarId, orgId, data as any);
    }),

  /** Delete a webinar */
  delete: protectedProcedure
    .input(z.object({ webinarId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { orgId } = await requireActiveWebinarAdmin(ctx.user.id, ctx.user.role, input.webinarId);
      await deleteWebinar(input.webinarId, orgId);
      return { ok: true };
    }),

  /** Get registrations for a webinar */
  getRegistrations: protectedProcedure
    .input(z.object({ webinarId: z.number(), page: z.number().optional(), pageSize: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const { orgId } = await requireActiveWebinarAdmin(ctx.user.id, ctx.user.role, input.webinarId);
      return getWebinarRegistrations(input.webinarId, orgId);
    }),

  /** Get stats for a webinar */
  getStats: protectedProcedure
    .input(z.object({ webinarId: z.number() }))
    .query(async ({ ctx, input }) => {
      const { orgId } = await requireActiveWebinarAdmin(ctx.user.id, ctx.user.role, input.webinarId);
      return getWebinarStats(input.webinarId, orgId);
    }),

  /** Get after-purchase workflow for a webinar (stored as postWebinarAction/postWebinarUrl) */
  getAfterPurchaseWorkflow: protectedProcedure
    .input(z.object({ webinarId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireActiveWebinarAdmin(ctx.user.id, ctx.user.role, input.webinarId);
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
      const { orgId } = await requireActiveWebinarAdmin(ctx.user.id, ctx.user.role, input.webinarId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db.select({ salesPageBlocksJson: webinars.salesPageBlocksJson }).from(webinars).where(and(
        eq(webinars.id, input.webinarId),
        eq(webinars.orgId, orgId),
      )).limit(1);
      return { blocks: row?.salesPageBlocksJson ?? null };
    }),

  /** Save checkout page config for a webinar */
  saveCheckoutPageConfig: protectedProcedure
    .input(z.object({ webinarId: z.number(), blocks: z.unknown() }).strict())
    .mutation(async ({ ctx, input }) => {
      const { orgId } = await requireActiveWebinarAdmin(ctx.user.id, ctx.user.role, input.webinarId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(webinars).set({ salesPageBlocksJson: input.blocks } as any).where(and(
        eq(webinars.id, input.webinarId),
        eq(webinars.orgId, orgId),
      ));
      return { ok: true };
    }),

  /** Toggle enrollment closed for a webinar */
  setEnrollmentClosed: protectedProcedure
    .input(z.object({ webinarId: z.number(), enrollmentClosed: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const { orgId } = await requireActiveWebinarAdmin(ctx.user.id, ctx.user.role, input.webinarId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(webinars).set({ enrollmentClosed: input.enrollmentClosed } as any).where(and(
        eq(webinars.id, input.webinarId),
        eq(webinars.orgId, orgId),
      ));
      return { ok: true };
    }),
});
