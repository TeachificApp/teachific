import { z } from "zod";
import { eq, asc, like, and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb, getOrgIdForUser, getOrgIdForUserWithFallback, requireOrgAdmin } from "../db";
import { lmsCourseBuilderRouter } from "./lmsCourseBuilderRouter";
import { lmsEnrollmentAdminRouter } from "./lmsEnrollmentAdminRouter";
import { lmsCohortAdminRouter } from "./lmsCohortAdminRouter";
import { assertCourseOwnership } from "./lmsHelpers";
import {
  getLmsCertificateTemplatesByOrg,
  getLmsCertificateTemplateById,
  createLmsCertificateTemplate,
  updateLmsCertificateTemplate,
  deleteLmsCertificateTemplate,
  listIssuedCertificates,
} from "../lmsDb";
import { storagePut, storagePresignedPut } from "../storage";
import {
  lmsCourses,
  lmsLandingPages,
  digitalProducts,
  physicalProducts,
  lmsPageTemplates,
  blockTemplates,
  courseLessons,
  cmeActivityForms,
} from "../../drizzle/schema";

async function assertAdmin(ctx: { user: { id: number; role: string } }) {
  await requireOrgAdmin(ctx.user.id, ctx.user.role);
}

const _lmsAdminBaseRouter = router({
  /** Get all courses with their landing page blocks for the block picker */
  getCoursesWithLandingBlocks: protectedProcedure
    .query(async ({ ctx }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const orgId = await getOrgIdForUserWithFallback(ctx.user.id, ctx.user.role);
      if (orgId === null) return [];
      const courses = await db
        .select({ id: lmsCourses.id, title: lmsCourses.title, type: lmsCourses.type })
        .from(lmsCourses)
        .where(eq(lmsCourses.orgId, orgId))
        .orderBy(asc(lmsCourses.title));
      const result = [];
      for (const course of courses) {
        const [lp] = await db
          .select({ id: lmsLandingPages.id, blocks: lmsLandingPages.blocks })
          .from(lmsLandingPages)
          .where(eq(lmsLandingPages.courseId, course.id))
          .limit(1);
        if (lp?.blocks && lp.blocks.length > 2) {
          result.push({ ...course, blocks: lp.blocks });
        }
      }
      return result;
    }),

  /** Get all digital download products with their landing page blocks */
  getDownloadsWithLandingBlocks: protectedProcedure
    .query(async ({ ctx }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const orgId = await getOrgIdForUserWithFallback(ctx.user.id, ctx.user.role);
      if (orgId === null) return [];
      const products = await db
        .select({ id: digitalProducts.id, title: digitalProducts.title, landingBlocks: digitalProducts.salesPageBlocksJson })
        .from(digitalProducts)
        .where(eq(digitalProducts.orgId, orgId))
        .orderBy(asc(digitalProducts.title));
      return products.filter(p => {
        const blocks = p.landingBlocks;
        return blocks && (typeof blocks === "string" ? blocks.length > 2 : Array.isArray(blocks) && blocks.length > 0);
      }).map(p => ({ ...p, landingBlocks: typeof p.landingBlocks === "string" ? p.landingBlocks : JSON.stringify(p.landingBlocks) }));
    }),

  /** Get all physical products with their landing page blocks */
  getProductsWithLandingBlocks: protectedProcedure
    .query(async ({ ctx }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const orgId = await getOrgIdForUserWithFallback(ctx.user.id, ctx.user.role);
      if (orgId === null) return [];
      const products = await db
        .select({ id: physicalProducts.id, title: physicalProducts.title, landingBlocks: physicalProducts.landingBlocks })
        .from(physicalProducts)
        .where(eq(physicalProducts.orgId, orgId))
        .orderBy(asc(physicalProducts.title));
      return products.filter(p => p.landingBlocks && p.landingBlocks.length > 2);
    }),

  /** Save a page template (create or update) */
  savePageTemplate: protectedProcedure
    .input(z.object({
      id: z.number().optional(),
      name: z.string().min(1).max(255),
      description: z.string().optional(),
      templateType: z.enum(["page", "block"]).default("page"),
      blockType: z.string().optional(),
      blocks: z.array(z.any()),
      thumbnailUrl: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const now = Date.now();
      const blocksJson = JSON.stringify(input.blocks);
      if (input.id) {
        await db.update(lmsPageTemplates)
          .set({
            name: input.name,
            description: input.description ?? null,
            templateType: input.templateType,
            blockType: input.blockType ?? null,
            blocks: blocksJson,
            thumbnailUrl: input.thumbnailUrl ?? null,
            updatedAt: now,
          })
          .where(eq(lmsPageTemplates.id, input.id));
        return { id: input.id };
      } else {
        const [result] = await db.insert(lmsPageTemplates).values({
          name: input.name,
          description: input.description ?? null,
          templateType: input.templateType,
          blockType: input.blockType ?? null,
          blocks: blocksJson,
          thumbnailUrl: input.thumbnailUrl ?? null,
          createdBy: ctx.user.id,
          createdAt: now,
          updatedAt: now,
        });
        return { id: (result as any).insertId };
      }
    }),

  /** Delete a page template */
  deletePageTemplate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(lmsPageTemplates).where(eq(lmsPageTemplates.id, input.id));
      return { success: true };
    }),

  /** List all page templates */
  listPageTemplates: protectedProcedure
    .input(z.object({
      templateType: z.enum(["page", "block"]).optional(),
      blockType: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db.select().from(lmsPageTemplates).orderBy(asc(lmsPageTemplates.name));
      return rows.filter(r => {
        if (input?.templateType && r.templateType !== input.templateType) return false;
        if (input?.blockType && r.blockType !== input.blockType) return false;
        return true;
      });
    }),

  /** Get landing page blocks for a course */
  getCourseLandingPage: protectedProcedure
    .input(z.object({ courseId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [lp] = await db
        .select()
        .from(lmsLandingPages)
        .where(eq(lmsLandingPages.courseId, input.courseId))
        .limit(1);
      return lp ?? null;
    }),

  /** Save landing page blocks for a course */
  saveCourseLandingPage: protectedProcedure
    .input(z.object({
      courseId: z.number(),
      blocks: z.string(), // JSON string
      heroTitle: z.string().optional(),
      heroSubtitle: z.string().optional(),
      heroImageUrl: z.string().optional(),
      ctaText: z.string().optional(),
      seoTitle: z.string().optional(),
      seoDescription: z.string().optional(),
      seoImage: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      await assertCourseOwnership(ctx, input.courseId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const existing = await db
        .select({ id: lmsLandingPages.id })
        .from(lmsLandingPages)
        .where(eq(lmsLandingPages.courseId, input.courseId))
        .limit(1);
      const data = {
        blocks: input.blocks,
        heroTitle: input.heroTitle ?? null,
        heroSubtitle: input.heroSubtitle ?? null,
        heroImageUrl: input.heroImageUrl ?? null,
        ctaText: input.ctaText ?? "Enroll Now",
        seoTitle: input.seoTitle ?? null,
        seoDescription: input.seoDescription ?? null,
        seoImage: input.seoImage ?? null,
        isCustom: true,
      };
      if (existing.length > 0) {
        await db.update(lmsLandingPages).set(data).where(eq(lmsLandingPages.courseId, input.courseId));
      } else {
        await db.insert(lmsLandingPages).values({ courseId: input.courseId, ...data });
      }
      return { success: true };
    }),

  /** Update a lesson's content blocks */
  updateLesson: protectedProcedure
    .input(z.object({
      id: z.number(),
      contentBlocks: z.string().optional(),
      title: z.string().optional(),
      description: z.string().optional(),
      videoUrl: z.string().optional(),
      duration: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...data } = input;
      await db.update(courseLessons).set(data as any).where(eq(courseLessons.id, id));
      const [updated] = await db.select().from(courseLessons).where(eq(courseLessons.id, id)).limit(1);
      return updated;
    }),

  /** Save current lesson blocks as a reusable template */
  saveLessonTemplate: protectedProcedure
    .input(z.object({
      name: z.string(),
      tags: z.string().optional(),
      blocks: z.string(), // JSON string of blocks
      thumbnailUrl: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [inserted] = await db.insert(blockTemplates).values({
        name: input.name,
        tags: input.tags ?? null,
        blocks: input.blocks,
        thumbnailUrl: input.thumbnailUrl ?? null,
        templateType: "lesson",
        createdByUserId: ctx.user.id,
      });
      return { id: (inserted as any).insertId, success: true };
    }),

  /** List all courses for the course picker in lesson/page editors */
  listCourses: protectedProcedure
    .input(z.object({
      status: z.enum(["all", "draft", "public", "archived"]).default("all"),
      type: z.enum(["all", "course", "quiz", "download", "cohort"]).default("all"),
      search: z.string().optional(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(200).default(100),
    }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Always scope to the user's own org — platform admins fall back to the primary org
      const orgId = await getOrgIdForUserWithFallback(ctx.user.id, ctx.user.role);
      if (orgId === null) return { courses: [], total: 0 };
      const conditions: any[] = [];
      conditions.push(eq(lmsCourses.orgId, orgId));
      if (input.status !== "all") conditions.push(eq(lmsCourses.status, input.status as any));
      if (input.type !== "all") conditions.push(eq(lmsCourses.type, input.type as any));
      if (input.search) conditions.push(like(lmsCourses.title, `%${input.search}%`));
      const offset = (input.page - 1) * input.pageSize;
      const rows = await db.select({
        ...lmsCourses,
        cmeStatus: cmeActivityForms.cmeStatus,
      })
        .from(lmsCourses)
        .leftJoin(cmeActivityForms, and(
          eq(cmeActivityForms.courseId, lmsCourses.id),
          eq(cmeActivityForms.orgId, lmsCourses.orgId),
        ))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(lmsCourses.createdAt))
        .limit(input.pageSize)
        .offset(offset);
      return { courses: rows, total: rows.length };
    }),

  /** Get all lessons for a course with their content blocks (for block copying) */
  getLessonsWithBlocks: protectedProcedure
    .input(z.object({ courseId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db.select()
        .from(courseLessons)
        .where(eq(courseLessons.courseId, input.courseId))
        .orderBy(asc(courseLessons.sortOrder));
      return rows;
    }),
});

// ─── Certificate Templates sub-router ────────────────────────────────────────
const _lmsCertificateTemplatesRouter = router({
  listCertificateTemplates: protectedProcedure
    .input(z.object({ orgId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const orgId = input?.orgId ?? await getOrgIdForUser(ctx.user.id);
      if (!orgId) throw new TRPCError({ code: "FORBIDDEN", message: "No org found" });
      return getLmsCertificateTemplatesByOrg(orgId);
    }),
  getCertificateTemplate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return getLmsCertificateTemplateById(input.id);
    }),
  createCertificateTemplate: protectedProcedure
    .input(z.object({
      orgId: z.number().optional(),
      name: z.string().min(1),
      description: z.string().optional(),
      logoUrl: z.string().optional(),
      backgroundImageUrl: z.string().optional(),
      backgroundColorHex: z.string().optional(),
      titleText: z.string().optional(),
      subtitleText: z.string().optional(),
      bodyText: z.string().optional(),
      signatureText: z.string().optional(),
      signatureTitleText: z.string().optional(),
      footerText: z.string().optional(),
      fontFamily: z.string().optional(),
      primaryColorHex: z.string().optional(),
      accentColorHex: z.string().optional(),
      textColorHex: z.string().optional(),
      showBorder: z.boolean().optional(),
      borderColorHex: z.string().optional(),
      borderWidth: z.number().int().optional(),
      layout: z.enum(["classic", "modern", "minimal"]).optional(),
      isDefault: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = input.orgId ?? await getOrgIdForUser(ctx.user.id);
      if (!orgId) throw new TRPCError({ code: "FORBIDDEN", message: "No org found" });
      const { orgId: _orgId, ...rest } = input;
      return createLmsCertificateTemplate({ orgId, ...rest } as any);
    }),
  updateCertificateTemplate: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      description: z.string().optional(),
      logoUrl: z.string().nullable().optional(),
      backgroundImageUrl: z.string().nullable().optional(),
      backgroundColorHex: z.string().optional(),
      titleText: z.string().optional(),
      subtitleText: z.string().nullable().optional(),
      bodyText: z.string().nullable().optional(),
      signatureText: z.string().nullable().optional(),
      signatureTitleText: z.string().nullable().optional(),
      footerText: z.string().nullable().optional(),
      fontFamily: z.string().optional(),
      primaryColorHex: z.string().optional(),
      accentColorHex: z.string().optional(),
      textColorHex: z.string().optional(),
      showBorder: z.boolean().optional(),
      borderColorHex: z.string().optional(),
      borderWidth: z.number().int().optional(),
      layout: z.enum(["classic", "modern", "minimal"]).optional(),
      isDefault: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return updateLmsCertificateTemplate(id, data as any);
    }),
  deleteCertificateTemplate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteLmsCertificateTemplate(input.id);
      return { ok: true };
    }),
  listIssuedCertificates: protectedProcedure
    .input(z.object({ orgId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const orgId = input?.orgId ?? await getOrgIdForUser(ctx.user.id);
      if (!orgId) throw new TRPCError({ code: "FORBIDDEN", message: "No org found" });
      return listIssuedCertificates(orgId);
    }),
  previewCertificateTemplate: protectedProcedure
    .input(z.object({ templateId: z.number().optional() }))
    .mutation(async ({ input }) => {
      const { generateCertificatePdf } = await import("../lib/certificateGenerator");
      let template = null;
      if (input.templateId) {
        template = await getLmsCertificateTemplateById(input.templateId);
      }
      const pdfBuffer = await generateCertificatePdf({
        learnerName: "Jane Smith",
        courseTitle: "Sample Course Title",
        issuedAt: new Date(),
        credentials: "RVT, RDMS",
        template: template ? {
          primaryColor: template.primaryColorHex,
          accentColor: template.accentColorHex,
          textColor: template.textColorHex,
          fontFamily: template.fontFamily,
          signatureName: template.signatureText,
          signatureTitle: template.signatureTitleText,
          backgroundImageUrl: template.backgroundImageUrl,
          logoUrl: template.logoUrl,
          footerText: template.footerText,
          layout: template.layout as any,
        } : null,
      });
      const key = `certificate-previews/preview-${Date.now()}.pdf`;
      const { url } = await storagePut(key, pdfBuffer, "application/pdf");
      return { url };
    }),
  uploadCertificateAsset: protectedProcedure
    .input(z.object({ filename: z.string(), contentType: z.string() }))
    .mutation(async ({ input }) => {
      const key = `certificate-assets/${Date.now()}-${input.filename}`;
      const { url: uploadUrl } = await storagePresignedPut(key, input.contentType);
      const publicUrl = uploadUrl.split("?")[0];
      return { uploadUrl, publicUrl, key };
    }),
});

// Merge all sub-routers into lmsAdminRouter (matching ultrasound-app structure)
export const lmsAdminRouter = router({
  ..._lmsAdminBaseRouter._def.procedures,
  ...lmsCourseBuilderRouter._def.procedures,
  ...lmsEnrollmentAdminRouter._def.procedures,
  ...lmsCohortAdminRouter._def.procedures,
  ..._lmsCertificateTemplatesRouter._def.procedures,
});
