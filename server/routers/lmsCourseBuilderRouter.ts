/**
 * lmsCourseBuilderRouter.ts
 * Teachific™ LMS — Course/Section/Lesson CRUD (admin)
 * Auto-extracted from lmsRouter.ts to reduce file size and fix TypeScript OOM.
 */

/**
 * lmsRouter.ts
 * Teachific™ LMS — LMS Management
 *
 * Sub-routers:
 *   lmsPublic   — public course catalog, landing pages, instructor profiles
 *   lmsLearner  — enrollment, progress, quiz submission (protected)
 *   lmsAdmin    — full course/quiz/section/lesson CRUD, enrollment mgmt (admin only)
 *   lmsGroup    — group manager seat assignment (group_manager role)
 *   lmsAffiliate — affiliate tracking
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, desc, eq, isNull, sql, asc, isNotNull, max, inArray, or } from "drizzle-orm";
import { randomBytes } from "crypto";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { storagePut } from "../storage";
import { getDb, getOrCreateAccessToken, getOrgIdForUser, getOrgIdForUserWithFallback } from "../db";
import { invokeLLM } from "../_core/llm";
import { generateImage } from "../_core/imageGeneration";
import { generateCertificatePdf } from "../lib/certificateGenerator";
import { sendCertificateEmail } from "../lib/certificateEmail";
import { sendEnrollmentEmail } from "../lib/enrollmentEmail";
import { buildOrderBumpCheckoutLine } from "../lib/orderBumpCheckout";
import { extractJson, parseLandingBlocks } from "../lib/extractJson";
import { buildAiSourceMessage } from "../lib/aiSourceFile";
import {
  buildFullLessonExpansionPrompt,
  cleanGeneratedLessonContent,
  countGeneratedContentWords,
  fullLessonLengthRequirement,
  requiresFullLessonMinimum,
} from "../lib/aiLessonContent";
import {
  lmsCourses,
  lmsSections,
  lmsLessons,
  lmsQuizzes,
  lmsQuizQuestions,
  lmsEnrollments,
  lmsLessonProgress,
  lmsGroups,
  lmsGroupSeats,
  lmsInstructors,
  lmsCourseInstructors,
  lmsAffiliates,
  lmsAffiliateConversions,
  lmsLandingPages,
  lmsPageTemplates,
  lmsOrders,
  lmsCertificates,
  lmsLessonNotes,
  lmsLessonBookmarks,
  lmsCollections,
  lmsCollectionCourses,
  users,
  mediaAssets,
  mediaVersions,
  lmsPricingOptions,
  platformSettings,
  digitalProducts,
  lmsThinkificImports,
  lmsArchive,
  sonoQuizzes,
  physicalProducts,
  lmsCertificateTemplates,
  orderBumps,
  freePreviewEnrollments,
  lmsSectionTemplates,
  lessonTemplates,
  lmsCohortSessions,
  lmsCohortAssignments,
  lmsCohortRecordings,
  lmsCohortSubmissions,
  mediaUploadFolders,
  mediaUploadResponses,
  lmsCheckoutTemplates,
  curriculumEmbedVisibility,
  organizations,
  quizzes,
} from "../../drizzle/schema";
import { sendEmail, buildFreePreviewConfirmationEmail } from "../_core/email";
import { syncLessonQuizBlocksToQuestionBank } from "../lib/lessonQuizQuestionBankSync";

// ─── Helpers ──────────────────────────────────────────────────────────────────
import { assertAdmin, assertCourseOwnership, assertSectionOwnership, assertLessonOwnership, generateSlug, uniqueSlug, recalcProgress, issueCertificateIfEnabled } from "./lmsHelpers";

async function assertStandaloneQuizForCourse(db: any, courseId: number, standaloneQuizId?: number | null) {
  if (!standaloneQuizId) return;
  const [course] = await db.select({ orgId: lmsCourses.orgId }).from(lmsCourses).where(eq(lmsCourses.id, courseId)).limit(1);
  const [quiz] = course?.orgId
    ? await db.select({ id: quizzes.id }).from(quizzes).where(and(eq(quizzes.id, standaloneQuizId), eq(quizzes.orgId, course.orgId))).limit(1)
    : [];
  if (!quiz) throw new TRPCError({ code: "FORBIDDEN", message: "The selected quiz belongs to another organisation." });
}

export const lmsCourseBuilderRouter = router({
  // ── Lesson fetch for editor ──
  getLessonAdmin: protectedProcedure
    .input(z.object({ lessonId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [lesson] = await db.select().from(lmsLessons).where(eq(lmsLessons.id, input.lessonId)).limit(1);
      if (!lesson) throw new TRPCError({ code: "NOT_FOUND" });
      return lesson;
    }),
  // ── Courses ──
  listCourses: protectedProcedure
    .input(z.object({
      status: z.enum(["draft", "public", "hidden", "private", "archived", "all"]).default("all"),
      type: z.enum(["course", "quiz", "download", "cohort", "all"]).default("all"),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(500).default(20),
    }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Always scope to the user's own org — platform admins fall back to the primary org
      const orgId = await getOrgIdForUserWithFallback(ctx.user.id, ctx.user.role);
      // Safety: if no org found, return empty to prevent data leak
      if (orgId === null) return { courses: [], total: 0 };
      const conditions: any[] = [];
      // Always filter by orgId
      conditions.push(eq(lmsCourses.orgId, orgId));
      if (input.status !== "all") conditions.push(eq(lmsCourses.status, input.status as "draft" | "public" | "hidden" | "private"));
      if (input.type !== "all") conditions.push(eq(lmsCourses.type, input.type as "course" | "quiz" | "download" | "cohort"));
      const offset = (input.page - 1) * input.pageSize;
      const courses = await db.select().from(lmsCourses).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(lmsCourses.updatedAt)).limit(input.pageSize).offset(offset);
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(lmsCourses).where(conditions.length ? and(...conditions) : undefined);
      return { courses, total: Number(count) };
    }),

  createCourse: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(255),
      subtitle: z.string().max(500).optional(),
      type: z.enum(["course", "quiz", "download", "cohort"]).default("course"),
      brand: z.enum(["teachific"]).default("teachific"),
      pricingType: z.enum(["free", "one_time", "subscription", "payment_plan", "trial_then_subscription"]).default("one_time"),
      price: z.number().min(0).default(0),
      isFree: z.boolean().default(false),
      subscriptionInterval: z.enum(["monthly", "quarterly", "annual"]).optional(),
      trialDays: z.number().int().min(0).nullable().optional(),
      accessDurationDays: z.number().int().min(1).nullable().optional(),
      downPayment: z.number().min(0).optional(),
      installmentCount: z.number().int().min(0).optional(),
      installmentAmount: z.number().min(0).optional(),
      installmentIntervalDays: z.number().int().min(1).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Resolve the org this course belongs to (with primary org fallback for platform admins)
      const courseOrgId = await getOrgIdForUserWithFallback(ctx.user.id, ctx.user.role);
      if (!courseOrgId) throw new TRPCError({ code: "BAD_REQUEST", message: "No organisation found for user" });
      const base = generateSlug(input.title);
      const slug = await uniqueSlug(db, base);
      const isFree = input.pricingType === "free" || input.isFree;
      const [result] = await db.insert(lmsCourses).values({
        orgId: courseOrgId,
        slug, title: input.title, subtitle: input.subtitle ?? null,
        type: input.type, brand: input.brand, price: input.price,
        isFree, pricingType: input.pricingType,
        subscriptionInterval: input.subscriptionInterval ?? null,
        trialDays: input.trialDays ?? null,
        accessDurationDays: input.accessDurationDays ?? null,
        downPayment: input.downPayment ?? null,
        installmentCount: input.installmentCount ?? null,
        installmentAmount: input.installmentAmount ?? null,
        installmentIntervalDays: input.installmentIntervalDays ?? null,
        createdByUserId: ctx.user.id,
      }).$returningId();
      // Auto-create landing page stub
      await db.insert(lmsLandingPages).values({ courseId: result.id, heroTitle: input.title, ctaText: "Enroll Now" });
      return { id: result.id, slug };
    }),

  updateCourse: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().min(1).max(255).optional(),
      subtitle: z.string().max(500).optional(),
      description: z.string().optional(),
      coverImageUrl: z.string().optional(),
      status: z.enum(["draft", "public", "hidden", "private", "archived"]).optional(),
      type: z.enum(["course", "quiz", "download", "cohort"]).optional(),
      enrollmentCloseDate: z.string().nullable().optional(), // ISO date string or null
      brand: z.enum(["teachific"]).optional(),
      price: z.number().min(0).optional(),
      isFree: z.boolean().optional(),
      pricingType: z.enum(["free", "one_time", "subscription", "payment_plan", "trial_then_subscription"]).optional(),
      subscriptionInterval: z.enum(["monthly", "quarterly", "annual"]).nullable().optional(),
      trialDays: z.number().int().min(0).nullable().optional(),
      accessDurationDays: z.number().int().min(1).nullable().optional(),
      downPayment: z.number().min(0).nullable().optional(),
      installmentCount: z.number().int().min(0).nullable().optional(),
      installmentAmount: z.number().min(0).nullable().optional(),
      installmentIntervalDays: z.number().int().min(1).nullable().optional(),
      hasCertificate: z.boolean().optional(),
      certificateTemplateId: z.number().int().positive().nullable().optional(),
      // CME/CE credit hours shown on certificate (e.g. "1.5")
      creditHours: z.string().max(16).nullable().optional(),
      // Optional override for the course title printed on the certificate
      certificateTitleOverride: z.string().max(512).nullable().optional(),
      isFeatured: z.boolean().optional(),
      isDrip: z.boolean().optional(),
      showInstructor: z.boolean().optional(),
      hideProgress: z.boolean().optional(),
      courseOverviewBlocks: z.string().nullable().optional(), // JSON array of Block objects
      courseOverviewTopBlocks: z.string().nullable().optional(), // JSON array — above progress bar
      courseOverviewBottomBlocks: z.string().nullable().optional(), // JSON array — below curriculum
      metaTitle: z.string().optional(),
      metaDescription: z.string().optional(),
      // Course color scheme
      primaryColor: z.string().max(20).nullable().optional(),
      accentColor: z.string().max(20).nullable().optional(),
      gradientFrom: z.string().max(20).nullable().optional(),
      gradientTo: z.string().max(20).nullable().optional(),
      gradientDirection: z.string().max(30).nullable().optional(),
      thumbnailUrl: z.string().nullable().optional(),
      showInLibrary: z.boolean().optional(),
      sendEnrollmentEmail: z.boolean().optional(),
      // Custom text labels — JSON string of { lesson, section, markComplete, nextLesson, prevLesson, submitQuiz, courseModules, completed }
      customLabels: z.string().nullable().optional(),
      // Course-level default for Mark Complete button: true = show (default), false = hide
      defaultMarkComplete: z.boolean().optional(),
      // Course player theme: 'light' or 'dark'
      playerTheme: z.enum(["light", "dark"]).optional(),
      // Multi-cohort mode: when true, sessions/assignments/recordings are scoped per cohort group
      multiCohortMode: z.boolean().optional(),
      // Purchase Terms Override
      purchaseTermsAgreement: z.string().max(1024).nullable().optional(),
      purchaseTermsLink1Label: z.string().max(255).nullable().optional(),
      purchaseTermsLink1Url: z.string().max(1024).nullable().optional(),
      purchaseTermsLink2Label: z.string().max(255).nullable().optional(),
      purchaseTermsLink2Url: z.string().max(1024).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, pricingType, defaultMarkComplete: dmc, enrollmentCloseDate, ...updates } = input;
      // Handle enrollmentCloseDate: convert ISO string to Date or null
      if (enrollmentCloseDate !== undefined) {
        (updates as any).enrollmentCloseDate = enrollmentCloseDate ? new Date(enrollmentCloseDate) : null;
      }
      if (dmc !== undefined) (updates as any).defaultMarkComplete = dmc ? 1 : 0;
      // Sync isFree with pricingType
      const extra: Record<string, any> = {};
      if (pricingType !== undefined) {
        extra.pricingType = pricingType;
        extra.isFree = pricingType === "free";
      }
            const filtered = { ...Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined)), ...extra };
      // Keep coverImageUrl and thumbnailUrl in sync
      if (filtered.coverImageUrl && !filtered.thumbnailUrl) filtered.thumbnailUrl = filtered.coverImageUrl;
      if (filtered.thumbnailUrl && !filtered.coverImageUrl) filtered.coverImageUrl = filtered.thumbnailUrl;
      if (Object.keys(filtered).length > 0) {
        await db.update(lmsCourses).set(filtered).where(eq(lmsCourses.id, id));
      }
      // Auto-reissue certificates when cert-related fields change
      const certFieldsChanged = ['certificateTitleOverride', 'creditHours', 'certificateTemplateId'].some(f => filtered[f] !== undefined);
      if (certFieldsChanged) {
        const enrollmentsWithCerts = await db
          .select({ enrollmentId: lmsCertificates.enrollmentId, userId: lmsCertificates.userId })
          .from(lmsCertificates)
          .where(eq(lmsCertificates.courseId, id));
        // Re-issue each certificate with forceReissue=true (fire-and-forget)
        void Promise.allSettled(enrollmentsWithCerts.map(e =>
          issueCertificateIfEnabled(db, e.enrollmentId, e.userId, id, undefined, true)
        )).catch(err => console.error('[updateCourse] cert reissue failed:', err));
      }
      return { success: true };
    }),
  deleteCourse: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [course] = await db.select().from(lmsCourses).where(eq(lmsCourses.id, input.id)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      const purgeAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await db.insert(lmsArchive).values({
        itemType: "course",
        originalId: course.id,
        title: course.title,
        snapshot: JSON.stringify(course),
        deletedByUserId: ctx.user.id,
        purgeAt,
      });
      await db.delete(lmsCourses).where(eq(lmsCourses.id, input.id));
      return { success: true };
    }),

  reorderCourses: protectedProcedure
    .input(z.object({ courses: z.array(z.object({ id: z.number(), libraryOrder: z.number() })) }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await Promise.all(input.courses.map(c =>
        db.update(lmsCourses).set({ libraryOrder: c.libraryOrder }).where(eq(lmsCourses.id, c.id))
      ));
      return { success: true };
    }),

  uploadCourseCoverImage: protectedProcedure
    .input(z.object({
      courseId: z.number(),
      dataUri: z.string().min(1).max(10_000_000), // ~7.5 MB image
      mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Fetch the course title for the media asset name
      const [course] = await db.select({ title: lmsCourses.title }).from(lmsCourses).where(eq(lmsCourses.id, input.courseId)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });

      const b64Marker = ";base64,";
      const b64Idx = input.dataUri.indexOf(b64Marker);
      const base64Data = b64Idx >= 0 ? input.dataUri.slice(b64Idx + b64Marker.length) : input.dataUri;
      const buffer = Buffer.from(base64Data, "base64");
      const ext = input.mimeType.split("/")[1];
      const suffix = randomBytes(4).toString("hex");
      const slug = `lms-cover-${input.courseId}-${suffix}`;
      const fileName = `cover-${suffix}.${ext}`;
      const fileKey = `media-repo/${slug}/${fileName}`;

      // Upload to S3
      const { url } = await storagePut(fileKey, buffer, input.mimeType);

      // Create Media Repository asset record
      const [assetResult] = await db.insert(mediaAssets).values({
        slug,
        title: `${course.title} — Cover Image`,
        description: `Course card cover image for "${course.title}"`,
        mediaType: "image",
        mimeType: input.mimeType,
        access: "public",
        tags: "lms,cover,course",
        folder: "Course Covers",
        thumbnailUrl: url,
        createdByUserId: ctx.user.id,
      });
      const assetId = (assetResult as any).insertId as number;

      // Create version record
      await db.insert(mediaVersions).values({
        assetId,
        versionNumber: 1,
        s3Key: fileKey,
        s3Url: url,
        fileName,
        fileSize: buffer.byteLength,
        mimeType: input.mimeType,
        notes: "Auto-uploaded from LMS course settings",
        uploadedByUserId: ctx.user.id,
      });

            // Update the course coverImageUrl and thumbnailUrl (keep both in sync)
      await db.update(lmsCourses).set({ coverImageUrl: url, thumbnailUrl: url }).where(eq(lmsCourses.id, input.courseId));
      return { url, assetId };
    }),
  uploadLandingPageHeroImage: protectedProcedure
    .input(z.object({
      courseId: z.number(),
      dataUri: z.string().min(1).max(10_000_000),
      mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [course] = await db.select({ title: lmsCourses.title }).from(lmsCourses).where(eq(lmsCourses.id, input.courseId)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });

      const b64Marker2 = ";base64,";
      const b64Idx2 = input.dataUri.indexOf(b64Marker2);
      const base64Data = b64Idx2 >= 0 ? input.dataUri.slice(b64Idx2 + b64Marker2.length) : input.dataUri;
      const buffer = Buffer.from(base64Data, "base64");
      const ext = input.mimeType.split("/")[1];
      const suffix = randomBytes(4).toString("hex");
      const slug = `lms-hero-${input.courseId}-${suffix}`;
      const fileName = `hero-${suffix}.${ext}`;
      const fileKey = `media-repo/${slug}/${fileName}`;

      const { url } = await storagePut(fileKey, buffer, input.mimeType);

      // Create Media Repository asset record
      const [assetResult] = await db.insert(mediaAssets).values({
        slug,
        title: `${course.title} — Hero Banner`,
        description: `Landing page hero banner for "${course.title}"`,
        mediaType: "image",
        mimeType: input.mimeType,
        access: "public",
        tags: "lms,hero,landing-page",
        folder: "Course Covers",
        thumbnailUrl: url,
        createdByUserId: ctx.user.id,
      });
      const assetId = (assetResult as any).insertId as number;

      await db.insert(mediaVersions).values({
        assetId,
        versionNumber: 1,
        s3Key: fileKey,
        s3Url: url,
        fileName,
        fileSize: buffer.byteLength,
        mimeType: input.mimeType,
        notes: "Auto-uploaded from LMS landing page editor",
        uploadedByUserId: ctx.user.id,
      });

      // Upsert the landing page heroImageUrl
      const [existing] = await db.select({ id: lmsLandingPages.id }).from(lmsLandingPages).where(eq(lmsLandingPages.courseId, input.courseId)).limit(1);
      if (existing) {
        await db.update(lmsLandingPages).set({ heroImageUrl: url }).where(eq(lmsLandingPages.courseId, input.courseId));
      } else {
        await db.insert(lmsLandingPages).values({ courseId: input.courseId, heroImageUrl: url, isCustom: true });
      }
      return { url, assetId };
    }),

  getCourse: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [course] = await db.select().from(lmsCourses).where(eq(lmsCourses.id, input.id)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      // Fetch org slug/domain for building org-scoped URLs (preview links, etc.)
      const [org] = await db.select({
        slug: organizations.slug,
        customDomain: organizations.customDomain,
        domainVerificationStatus: organizations.domainVerificationStatus,
      }).from(organizations).where(eq(organizations.id, course.orgId)).limit(1);
      // Batch fetch sections + all lessons in 2 parallel queries (avoids N+1)
      // Strip heavy content columns (contentBlocks, content, videoContent) from the list —
      // they are fetched on-demand by getLessonsWithBlocks when the editor opens a lesson.
      const [sections, allLessons, landingPage, cis] = await Promise.all([
        db.select().from(lmsSections).where(eq(lmsSections.courseId, course.id)).orderBy(asc(lmsSections.position)),
        db.select({
          id: lmsLessons.id,
          courseId: lmsLessons.courseId,
          sectionId: lmsLessons.sectionId,
          title: lmsLessons.title,
          type: lmsLessons.type,
          position: lmsLessons.position,
          isPreview: lmsLessons.isPreview,
          previewMode: lmsLessons.previewMode,
          dripDays: lmsLessons.dripDays,
          durationMinutes: lmsLessons.durationMinutes,
          requireVideoCompletion: lmsLessons.requireVideoCompletion,
          requireManualComplete: lmsLessons.requireManualComplete,
          prerequisiteLessonId: lmsLessons.prerequisiteLessonId,
          isPrerequisite: lmsLessons.isPrerequisite,
          showInstructor: lmsLessons.showInstructor,
          effectEnabled: lmsLessons.effectEnabled,
          effectTrigger: lmsLessons.effectTrigger,
          effectBannerText: lmsLessons.effectBannerText,
          effectBannerBgColor: lmsLessons.effectBannerBgColor,
          effectBannerTextColor: lmsLessons.effectBannerTextColor,
          effectBannerDuration: lmsLessons.effectBannerDuration,
          effectSound: lmsLessons.effectSound,
          effectSoundUrl: lmsLessons.effectSoundUrl,
          effectConfetti: lmsLessons.effectConfetti,
          effectConfettiColors: lmsLessons.effectConfettiColors,
          effectConfettiMode: lmsLessons.effectConfettiMode,
          createdAt: lmsLessons.createdAt,
          updatedAt: lmsLessons.updatedAt,
        }).from(lmsLessons).where(eq(lmsLessons.courseId, course.id)).orderBy(asc(lmsLessons.position)),
        db.select().from(lmsLandingPages).where(eq(lmsLandingPages.courseId, course.id)).limit(1),
        db.select().from(lmsCourseInstructors).where(eq(lmsCourseInstructors.courseId, course.id)),
      ]);
      // Group lessons by sectionId in JS
      const lessonsBySectionId = new Map<number, typeof allLessons>();
      const topLevelLessons: typeof allLessons = [];
      for (const lesson of allLessons) {
        if (lesson.sectionId) {
          if (!lessonsBySectionId.has(lesson.sectionId)) lessonsBySectionId.set(lesson.sectionId, []);
          lessonsBySectionId.get(lesson.sectionId)!.push(lesson);
        } else {
          topLevelLessons.push(lesson);
        }
      }
      const sectionsWithLessons = sections.map(s => ({ ...s, lessons: lessonsBySectionId.get(s.id) ?? [] }));
      return { ...course, sections: sectionsWithLessons, topLevelLessons, landingPage: landingPage[0] ?? null, courseInstructors: cis, orgSlug: org?.slug ?? null, orgCustomDomain: org?.customDomain ?? null, orgDomainVerificationStatus: org?.domainVerificationStatus ?? null };
    }),

  // ── Sections ──
  createSection: protectedProcedure
    .input(z.object({ courseId: z.number(), title: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      await assertCourseOwnership(ctx, input.courseId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Auto-append at end
      const posResult = await db
        .select({ maxPos: max(lmsSections.position) })
        .from(lmsSections)
        .where(eq(lmsSections.courseId, input.courseId));
      const nextPosition = (posResult[0]?.maxPos ?? -1) + 1;
      const [result] = await db.insert(lmsSections).values({ courseId: input.courseId, title: input.title, position: nextPosition }).$returningId();
      return { id: result.id };
    }),

  updateSection: protectedProcedure
    .input(z.object({ id: z.number(), title: z.string().min(1).optional(), position: z.number().int().optional(), isPreview: z.boolean().optional(), dripDays: z.number().int().min(0).nullable().optional() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      await assertSectionOwnership(ctx, input.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...updates } = input;
      // Build a typed update object — dripDays is notNull() in the schema so null must be coerced to 0
      const sectionUpdate: {
        title?: string;
        position?: number;
        isPreview?: boolean;
        dripDays?: number;
      } = {};
      if (updates.title !== undefined) sectionUpdate.title = updates.title;
      if (updates.position !== undefined) sectionUpdate.position = updates.position;
      if (updates.isPreview !== undefined) sectionUpdate.isPreview = updates.isPreview;
      if (updates.dripDays !== undefined) sectionUpdate.dripDays = updates.dripDays ?? 0;
      await db.update(lmsSections).set(sectionUpdate).where(eq(lmsSections.id, id));
      return { success: true };
    }),

  deleteSection: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      await assertSectionOwnership(ctx, input.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(lmsLessons).where(eq(lmsLessons.sectionId, input.id));
      await db.delete(lmsSections).where(eq(lmsSections.id, input.id));
      return { success: true };
    }),

  reorderSections: protectedProcedure
    .input(z.object({ sections: z.array(z.object({ id: z.number(), position: z.number() })) }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await Promise.all(input.sections.map(s => db.update(lmsSections).set({ position: s.position }).where(eq(lmsSections.id, s.id))));
      return { success: true };
    }),

  // ── Section Templates ──

  /** Save a section (with all its lessons) as a reusable template */
  saveSectionTemplate: protectedProcedure
    .input(z.object({
      sectionId: z.number(),
      name: z.string().min(1).max(255),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [section] = await db.select().from(lmsSections).where(eq(lmsSections.id, input.sectionId)).limit(1);
      if (!section) throw new TRPCError({ code: "NOT_FOUND", message: "Section not found" });
      const lessons = await db.select({
        title: lmsLessons.title,
        type: lmsLessons.type,
        content: lmsLessons.content,
        videoContent: lmsLessons.videoContent,
        embedUrl: lmsLessons.embedUrl,
        dripDays: lmsLessons.dripDays,
        durationMinutes: lmsLessons.durationMinutes,
        requireVideoCompletion: lmsLessons.requireVideoCompletion,
        requireManualComplete: lmsLessons.requireManualComplete,
        contentBlocks: lmsLessons.contentBlocks,
        learningObjectives: lmsLessons.learningObjectives,
        position: lmsLessons.position,
      }).from(lmsLessons)
        .where(eq(lmsLessons.sectionId, input.sectionId))
        .orderBy(asc(lmsLessons.position));
      const [result] = await db.insert(lmsSectionTemplates).values({
        name: input.name,
        description: input.description ?? null,
        sectionTitle: section.title,
        lessonsJson: JSON.stringify(lessons),
        lessonCount: lessons.length,
        createdByUserId: ctx.user.id,
      }).$returningId();
      return { id: result.id };
    }),

  /** List all saved section templates */
  listSectionTemplates: protectedProcedure
    .query(async ({ ctx }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const templates = await db.select({
        id: lmsSectionTemplates.id,
        name: lmsSectionTemplates.name,
        description: lmsSectionTemplates.description,
        sectionTitle: lmsSectionTemplates.sectionTitle,
        lessonCount: lmsSectionTemplates.lessonCount,
        createdAt: lmsSectionTemplates.createdAt,
      }).from(lmsSectionTemplates).orderBy(desc(lmsSectionTemplates.createdAt));
      return templates;
    }),

  /** Delete a section template */
  deleteSectionTemplate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(lmsSectionTemplates).where(eq(lmsSectionTemplates.id, input.id));
      return { success: true };
    }),

  /** Import a section template into a course (creates section + lessons) */
  importSectionTemplate: protectedProcedure
    .input(z.object({
      courseId: z.number(),
      templateId: z.number(),
      sectionTitle: z.string().optional(), // override the template's default section title
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [template] = await db.select().from(lmsSectionTemplates).where(eq(lmsSectionTemplates.id, input.templateId)).limit(1);
      if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      // Get next section position
      const posResult = await db.select({ maxPos: max(lmsSections.position) }).from(lmsSections).where(eq(lmsSections.courseId, input.courseId));
      const nextPosition = (posResult[0]?.maxPos ?? -1) + 1;
      const title = input.sectionTitle?.trim() || template.sectionTitle;
      const [sectionResult] = await db.insert(lmsSections).values({ courseId: input.courseId, title, position: nextPosition }).$returningId();
      const sectionId = sectionResult.id;
      // Insert lessons from template snapshot
      let lessons: any[] = [];
      try { lessons = JSON.parse(template.lessonsJson); } catch { lessons = []; }
      for (let i = 0; i < lessons.length; i++) {
        const l = lessons[i];
        await db.insert(lmsLessons).values({
          courseId: input.courseId,
          sectionId,
          title: l.title,
          type: l.type ?? "text",
          position: i,
          content: l.content ?? null,
          videoContent: l.videoContent ?? null,
          embedUrl: l.embedUrl ?? null,
          dripDays: l.dripDays ?? 0,
          durationMinutes: l.durationMinutes ?? null,
          requireVideoCompletion: l.requireVideoCompletion ?? 0,
          requireManualComplete: l.requireManualComplete ?? null,
          contentBlocks: l.contentBlocks ?? null,
          learningObjectives: l.learningObjectives ?? null,
        });
      }
      return { sectionId, title, lessonCount: lessons.length };
    }),

  // ── Lesson Templates ──
  /** Save a single lesson (with all its content blocks) as a reusable template */
  saveLessonTemplate: protectedProcedure
    .input(z.object({
      lessonId: z.number(),
      title: z.string().min(1).max(255),
      tags: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [lesson] = await db.select().from(lmsLessons).where(eq(lmsLessons.id, input.lessonId)).limit(1);
      if (!lesson) throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found" });
      const [result] = await db.insert(lessonTemplates).values({
        title: input.title,
        lessonType: lesson.type ?? "video",
        blocks: lesson.contentBlocks ?? "[]",
        coverImage: lesson.coverImageUrl ?? null,
        tags: input.tags ?? null,
        createdByAdminId: ctx.user.id,
      }).$returningId();
      return { id: result.id, success: true };
    }),
  listLessonTemplates: protectedProcedure
    .query(async ({ ctx }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) return [];
      return db.select().from(lessonTemplates).orderBy(desc(lessonTemplates.createdAt));
    }),
  deleteLessonTemplate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(lessonTemplates).where(eq(lessonTemplates.id, input.id));
      return { success: true };
    }),
  /** Apply a lesson template to an existing lesson (replaces its content blocks) */
  applyLessonTemplate: protectedProcedure
    .input(z.object({ lessonId: z.number(), templateId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [template] = await db.select().from(lessonTemplates).where(eq(lessonTemplates.id, input.templateId)).limit(1);
      if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      await db.update(lmsLessons).set({ contentBlocks: template.blocks }).where(eq(lmsLessons.id, input.lessonId));
      return { success: true };
    }),

  /** Copy a section from another course into this course */
  copySectionFromCourse: protectedProcedure
    .input(z.object({
      targetCourseId: z.number(),
      sourceSectionId: z.number(),
      sectionTitle: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [sourceSection] = await db.select().from(lmsSections).where(eq(lmsSections.id, input.sourceSectionId)).limit(1);
      if (!sourceSection) throw new TRPCError({ code: "NOT_FOUND", message: "Source section not found" });
      const sourceLessons = await db.select().from(lmsLessons)
        .where(eq(lmsLessons.sectionId, input.sourceSectionId))
        .orderBy(asc(lmsLessons.position));
      // Get next section position in target course
      const posResult = await db.select({ maxPos: max(lmsSections.position) }).from(lmsSections).where(eq(lmsSections.courseId, input.targetCourseId));
      const nextPosition = (posResult[0]?.maxPos ?? -1) + 1;
      const title = input.sectionTitle?.trim() || sourceSection.title;
      const [sectionResult] = await db.insert(lmsSections).values({ courseId: input.targetCourseId, title, position: nextPosition }).$returningId();
      const sectionId = sectionResult.id;
      for (let i = 0; i < sourceLessons.length; i++) {
        const l = sourceLessons[i];
        await db.insert(lmsLessons).values({
          courseId: input.targetCourseId,
          sectionId,
          title: l.title,
          type: l.type,
          position: i,
          content: l.content ?? null,
          videoContent: l.videoContent ?? null,
          embedUrl: l.embedUrl ?? null,
          dripDays: l.dripDays ?? 0,
          durationMinutes: l.durationMinutes ?? null,
          requireVideoCompletion: l.requireVideoCompletion ?? 0,
          requireManualComplete: l.requireManualComplete ?? null,
          contentBlocks: l.contentBlocks ?? null,
          learningObjectives: l.learningObjectives ?? null,
        });
      }
      return { sectionId, title, lessonCount: sourceLessons.length };
    }),

  /** List all courses with their sections (for copy-from-course picker) */
  listCoursesWithSections: protectedProcedure
    .query(async ({ ctx }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const orgId = await getOrgIdForUserWithFallback(ctx.user.id, ctx.user.role);
      const courses = await db.select({ id: lmsCourses.id, title: lmsCourses.title, slug: lmsCourses.slug })
        .from(lmsCourses)
        .where(orgId !== null ? eq(lmsCourses.orgId, orgId) : undefined)
        .orderBy(asc(lmsCourses.title));
      const sections = await db.select({ id: lmsSections.id, courseId: lmsSections.courseId, title: lmsSections.title, position: lmsSections.position })
        .from(lmsSections).orderBy(asc(lmsSections.courseId), asc(lmsSections.position));
      const sectionsByCourse = new Map<number, typeof sections>();
      for (const s of sections) {
        if (!sectionsByCourse.has(s.courseId)) sectionsByCourse.set(s.courseId, []);
        sectionsByCourse.get(s.courseId)!.push(s);
      }
      return courses.map(c => ({ ...c, sections: sectionsByCourse.get(c.id) ?? [] }));
    }),

  // ── Lessons ──
  createLesson: protectedProcedure
    .input(z.object({
      courseId: z.number(),
      sectionId: z.number().optional(), // optional — top-level lessons have no section
      title: z.string().min(1),
      type: z.enum(["video", "text", "quiz", "download", "embed", "video_text"]).default("text"),
      position: z.number().int().default(0),
      content: z.string().optional(),
      videoContent: z.string().optional(),
      embedUrl: z.string().max(500).optional(),
      standaloneQuizId: z.number().int().positive().optional(),
      mediaAssetId: z.number().optional(),
      isPreview: z.boolean().default(false),
      dripDays: z.number().int().default(0),
      durationMinutes: z.number().int().optional(),
      requireVideoCompletion: z.boolean().default(false),
      requireManualComplete: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      await assertCourseOwnership(ctx, input.courseId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await assertStandaloneQuizForCourse(db, input.courseId, input.standaloneQuizId);
      // Auto-calculate position: append at end of section (or course top-level)
      const posResult = await db
        .select({ maxPos: max(lmsLessons.position) })
        .from(lmsLessons)
        .where(
          input.sectionId
            ? eq(lmsLessons.sectionId, input.sectionId)
            : and(eq(lmsLessons.courseId, input.courseId), isNull(lmsLessons.sectionId))
        );
      const nextPosition = (posResult[0]?.maxPos ?? -1) + 1;
      // Build default Hero banner block pre-filled with the lesson title
      // hideButtons: true ensures the CTA button is always hidden on auto-generated lesson banners
      // Must use { id, type, data } wrapper format as expected by BlockPreview
      const defaultHeroBlock = JSON.stringify([{
        id: `hero-auto-${Date.now()}`,
        type: "hero",
        data: {
          headline: input.title,
          headline2: "",
          subheadline: "",
          hideButtons: true,
          buttons: [],
          bgType: "color",
          bgColor: "#149096",
          textColor: "#ffffff",
          align: "left",
          heroMinHeight: 150,
        },
      }]);
      const [result] = await db.insert(lmsLessons).values({
        courseId: input.courseId,
        sectionId: input.sectionId ?? null,
        title: input.title,
        type: input.type,
        position: nextPosition,
        content: input.content ?? null,
        videoContent: input.videoContent ?? null,
        embedUrl: input.embedUrl ?? null,
        standaloneQuizId: input.standaloneQuizId ?? null,
        mediaAssetId: input.mediaAssetId ?? null,
        isPreview: input.isPreview,
        dripDays: input.dripDays,
        durationMinutes: input.durationMinutes ?? null,
        requireVideoCompletion: input.requireVideoCompletion ? 1 : 0,
        requireManualComplete: input.requireManualComplete ? 1 : 0,
        contentBlocks: defaultHeroBlock,
      }).$returningId();
      // Auto-create a legacy lesson quiz only when no standalone QuizMaker quiz was selected.
      if (input.type === "quiz" && !input.standaloneQuizId) {
        await db.insert(lmsQuizzes).values({ lessonId: result.id, title: input.title });
      }
      return { id: result.id };
    }),

  updateLesson: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().min(1).optional(),
      type: z.enum(["video", "text", "quiz", "download", "embed", "video_text"]).optional(),
      content: z.string().nullable().optional(),
      videoContent: z.string().nullable().optional(),
      embedUrl: z.string().max(500).nullable().optional(),
      standaloneQuizId: z.number().int().positive().nullable().optional(),
      mediaAssetId: z.number().nullable().optional(),
      position: z.number().int().optional(),
      isPreview: z.boolean().optional(),
      previewMode: z.enum(["none", "preview", "preview_hide_after_purchase"]).optional(),
      dripDays: z.number().int().nullable().optional(),
      durationMinutes: z.number().int().nullable().optional(),
      requireVideoCompletion: z.boolean().optional(),
      // null = inherit from course default, true = always show, false = always hide
      requireManualComplete: z.boolean().nullable().optional(),
      contentBlocks: z.string().nullable().optional(), // JSON array of Block objects
      learningObjectives: z.string().nullable().optional(), // JSON array of strings
      showInstructor: z.enum(["inherit", "show", "hide"]).optional(),
      prerequisiteLessonId: z.number().int().nullable().optional(),
      isPrerequisite: z.boolean().optional(),
      commentsEnabled: z.boolean().optional(),
      // Whether this lesson counts toward the course completion percentage (default: true)
      countTowardCompletion: z.boolean().optional(),
      meetingLink: z.string().max(1024).nullable().optional(),
      liveStartAt: z.number().int().nullable().optional(),
      liveEndAt: z.number().int().nullable().optional(),
      lessonStatus: z.enum(["published", "draft"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      await assertLessonOwnership(ctx, input.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (input.standaloneQuizId !== undefined && input.standaloneQuizId !== null) {
        const [lesson] = await db.select({ courseId: lmsLessons.courseId }).from(lmsLessons).where(eq(lmsLessons.id, input.id)).limit(1);
        if (!lesson?.courseId) throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found" });
        await assertStandaloneQuizForCourse(db, lesson.courseId, input.standaloneQuizId);
      }
      const { id, requireVideoCompletion, requireManualComplete, isPrerequisite, commentsEnabled, countTowardCompletion, ...rest } = input;
      const updates: Record<string, unknown> = Object.fromEntries(
        Object.entries(rest).filter(([, v]) => v !== undefined)
      );
      if (requireVideoCompletion !== undefined) updates.requireVideoCompletion = requireVideoCompletion ? 1 : 0;
      // null = inherit from course default, true = show (1), false = hide (0)
      if (requireManualComplete !== undefined) updates.requireManualComplete = requireManualComplete === null ? null : (requireManualComplete ? 1 : 0);
      if (isPrerequisite !== undefined) updates.isPrerequisite = isPrerequisite;
      if (commentsEnabled !== undefined) updates.commentsEnabled = commentsEnabled ? 1 : 0;
      if (countTowardCompletion !== undefined) updates.countTowardCompletion = countTowardCompletion;
      // Convert null dripDays to 0 (no drip)
      if (updates.dripDays === null) updates.dripDays = 0;
      // Keep isPreview in sync with previewMode for backward compat
      if (updates.previewMode !== undefined) {
        updates.isPreview = updates.previewMode !== "none";
      } else if (updates.isPreview !== undefined) {
        updates.previewMode = updates.isPreview ? "preview" : "none";
      }
      if (Object.keys(updates).length > 0) await db.update(lmsLessons).set(updates as any).where(eq(lmsLessons.id, id));
      if (input.contentBlocks !== undefined) {
        await syncLessonQuizBlocksToQuestionBank(db, id, input.contentBlocks, ctx.user.id);
      }
      // When countTowardCompletion changes, recalculate progress for all enrollments in this course
      if (countTowardCompletion !== undefined) {
        const [lesson] = await db.select({ courseId: lmsLessons.courseId }).from(lmsLessons).where(eq(lmsLessons.id, id)).limit(1);
        if (lesson?.courseId) {
          const enrollments = await db.select({ id: lmsEnrollments.id }).from(lmsEnrollments).where(eq(lmsEnrollments.courseId, lesson.courseId));
          void Promise.all(enrollments.map(e => recalcProgress(db, e.id))).catch(err =>
            console.error('[updateLesson] recalcProgress after countTowardCompletion change failed:', err)
          );
        }
      }
      return { success: true };
    }),

  /** Backfill page-builder lesson quiz blocks into this course's org-scoped Question Bank folders. */
  backfillLessonQuizBlocksToQuestionBank: protectedProcedure
    .input(z.object({ courseId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      await assertCourseOwnership(ctx, input.courseId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const lessons = await db.select({ id: lmsLessons.id, contentBlocks: lmsLessons.contentBlocks })
        .from(lmsLessons)
        .where(eq(lmsLessons.courseId, input.courseId));
      let created = 0;
      let updated = 0;
      for (const lesson of lessons) {
        const result = await syncLessonQuizBlocksToQuestionBank(db, lesson.id, lesson.contentBlocks, ctx.user.id);
        created += result.created;
        updated += result.updated;
      }
      return { success: true, created, updated, lessonsScanned: lessons.length };
    }),

  deleteLesson: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      await assertLessonOwnership(ctx, input.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(lmsLessonProgress).where(eq(lmsLessonProgress.lessonId, input.id));
      await db.delete(lmsLessons).where(eq(lmsLessons.id, input.id));
      return { success: true };
    }),

  reorderLessons: protectedProcedure
    .input(z.object({ lessons: z.array(z.object({ id: z.number(), position: z.number() })) }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await Promise.all(input.lessons.map(l => db.update(lmsLessons).set({ position: l.position }).where(eq(lmsLessons.id, l.id))));
      return { success: true };
    }),

  /** Bulk-set lessonStatus for all lessons in a course (used by publish-course dialog) */
  bulkSetLessonStatus: protectedProcedure
    .input(z.object({
      courseId: z.number(),
      lessonStatus: z.enum(["published", "draft"]),
      /** When true, only update lessons that are currently 'draft' → 'published'. When false, set ALL lessons. */
      onlyDrafts: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const condition = input.onlyDrafts
        ? and(eq(lmsLessons.courseId, input.courseId), eq(lmsLessons.lessonStatus, "draft"))
        : eq(lmsLessons.courseId, input.courseId);
      await db.update(lmsLessons).set({ lessonStatus: input.lessonStatus }).where(condition);
      return { success: true };
    }),

  // ── Move / Copy ──
  moveLesson: protectedProcedure
    .input(z.object({
      lessonId: z.number(),
      targetSectionId: z.number().nullable(), // null = top-level
      courseId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Get next position in target section
      const posResult = await db
        .select({ maxPos: max(lmsLessons.position) })
        .from(lmsLessons)
        .where(
          input.targetSectionId
            ? eq(lmsLessons.sectionId, input.targetSectionId)
            : and(eq(lmsLessons.courseId, input.courseId), isNull(lmsLessons.sectionId))
        );
      const nextPosition = (posResult[0]?.maxPos ?? -1) + 1;
      await db.update(lmsLessons)
        .set({ sectionId: input.targetSectionId, position: nextPosition })
        .where(eq(lmsLessons.id, input.lessonId));
      return { success: true };
    }),

  copyLesson: protectedProcedure
    .input(z.object({
      lessonId: z.number(),
      targetCourseId: z.number(),
      targetSectionId: z.number().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [src] = await db.select().from(lmsLessons).where(eq(lmsLessons.id, input.lessonId)).limit(1);
      if (!src) throw new TRPCError({ code: "NOT_FOUND" });
      const posResult = await db
        .select({ maxPos: max(lmsLessons.position) })
        .from(lmsLessons)
        .where(
          input.targetSectionId
            ? eq(lmsLessons.sectionId, input.targetSectionId)
            : and(eq(lmsLessons.courseId, input.targetCourseId), isNull(lmsLessons.sectionId))
        );
      const nextPosition = (posResult[0]?.maxPos ?? -1) + 1;
      const { id: _id, courseId: _c, sectionId: _s, position: _p, ...rest } = src;
      const [result] = await db.insert(lmsLessons).values({
        ...rest,
        courseId: input.targetCourseId,
        sectionId: input.targetSectionId,
        position: nextPosition,
      }).$returningId();
      // Copy quiz if present
      const [quiz] = await db.select().from(lmsQuizzes).where(eq(lmsQuizzes.lessonId, input.lessonId)).limit(1);
      if (quiz) {
        const { id: _qid, lessonId: _ql, ...quizRest } = quiz;
        const [newQuiz] = await db.insert(lmsQuizzes).values({ ...quizRest, lessonId: result.id }).$returningId();
        const questions = await db.select().from(lmsQuizQuestions).where(eq(lmsQuizQuestions.quizId, quiz.id));
        if (questions.length > 0) {
          await db.insert(lmsQuizQuestions).values(questions.map(q => { const { id: _qi, quizId: _qqi, ...qr } = q; return { ...qr, quizId: newQuiz.id }; }));
        }
      }
      return { id: result.id };
    }),

  copyModule: protectedProcedure
    .input(z.object({
      sectionId: z.number(),
      targetCourseId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [srcSection] = await db.select().from(lmsSections).where(eq(lmsSections.id, input.sectionId)).limit(1);
      if (!srcSection) throw new TRPCError({ code: "NOT_FOUND" });
      // Get next section position in target course
      const secPosResult = await db.select({ maxPos: max(lmsSections.position) }).from(lmsSections).where(eq(lmsSections.courseId, input.targetCourseId));
      const nextSecPos = (secPosResult[0]?.maxPos ?? -1) + 1;
      const [newSection] = await db.insert(lmsSections).values({
        courseId: input.targetCourseId,
        title: srcSection.title,
        position: nextSecPos,
        dripDays: srcSection.dripDays,
      }).$returningId();
      // Copy all lessons in the section
      const lessons = await db.select().from(lmsLessons).where(eq(lmsLessons.sectionId, input.sectionId)).orderBy(asc(lmsLessons.position));
      for (const lesson of lessons) {
        const { id: _id, courseId: _c, sectionId: _s, ...rest } = lesson;
        const [newLesson] = await db.insert(lmsLessons).values({
          ...rest,
          courseId: input.targetCourseId,
          sectionId: newSection.id,
        }).$returningId();
        // Copy quiz if present
        const [quiz] = await db.select().from(lmsQuizzes).where(eq(lmsQuizzes.lessonId, lesson.id)).limit(1);
        if (quiz) {
          const { id: _qid, lessonId: _ql, ...quizRest } = quiz;
          const [newQuiz] = await db.insert(lmsQuizzes).values({ ...quizRest, lessonId: newLesson.id }).$returningId();
          const questions = await db.select().from(lmsQuizQuestions).where(eq(lmsQuizQuestions.quizId, quiz.id));
          if (questions.length > 0) {
            await db.insert(lmsQuizQuestions).values(questions.map(q => { const { id: _qi, quizId: _qqi, ...qr } = q; return { ...qr, quizId: newQuiz.id }; }));
          }
        }
      }
      return { id: newSection.id };
    }),

  // ── Lesson Effects ──
  updateLessonEffect: protectedProcedure
    .input(z.object({
      id: z.number(),
      effectEnabled: z.boolean(),
      effectTrigger: z.enum(["lesson_start", "lesson_complete"]),
      effectBannerText: z.string().max(500).optional(),
      effectBannerBgColor: z.string().max(20).optional(),
      effectBannerTextColor: z.string().max(20).optional(),
      effectBannerDuration: z.number().int().min(1).max(60).optional(),
      effectSound: z.string().max(50).optional(),
      effectSoundUrl: z.string().max(500).optional(),
      effectConfetti: z.boolean(),
      effectConfettiColors: z.string().max(500).optional(),
      effectConfettiMode: z.enum(["fall", "cannon"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(lmsLessons).set({
        effectEnabled: input.effectEnabled,
        effectTrigger: input.effectTrigger,
        effectBannerText: input.effectBannerText ?? null,
        effectBannerBgColor: input.effectBannerBgColor ?? null,
        effectBannerTextColor: input.effectBannerTextColor ?? null,
        effectBannerDuration: input.effectBannerDuration ?? 5,
        effectSound: input.effectSound ?? null,
        effectSoundUrl: input.effectSoundUrl ?? null,
        effectConfetti: input.effectConfetti,
        effectConfettiColors: input.effectConfettiColors ?? null,
        effectConfettiMode: input.effectConfettiMode ?? "fall",
      }).where(eq(lmsLessons.id, input.id));
      return { success: true };
    }),

  // ===== getAfterPurchase =====
  getAfterPurchase: protectedProcedure
    .input(z.object({ courseId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      await assertCourseOwnership(ctx, input.courseId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [course] = await db
        .select({
          id: lmsCourses.id,
          title: lmsCourses.title,
          customThankYouEnabled: lmsCourses.customThankYouEnabled,
          customThankYouBlocks: lmsCourses.customThankYouBlocks,
          postPurchaseRedirectUrl: lmsCourses.postPurchaseRedirectUrl,
          welcomeEmailEnabled: lmsCourses.welcomeEmailEnabled,
          welcomeEmailSubject: lmsCourses.welcomeEmailSubject,
          welcomeEmailBody: lmsCourses.welcomeEmailBody,
          upsellEnabled: lmsCourses.upsellEnabled,
          upsellCourseId: lmsCourses.upsellCourseId,
          upsellProductType: lmsCourses.upsellProductType,
          upsellProductId: lmsCourses.upsellProductId,
          upsellHeadline: lmsCourses.upsellHeadline,
          upsellDescription: lmsCourses.upsellDescription,
          hidePricingOptions: lmsCourses.hidePricingOptions,
          completionRedirectUrl: lmsCourses.completionRedirectUrl,
          completionEmailEnabled: lmsCourses.completionEmailEnabled,
          completionEmailSubject: lmsCourses.completionEmailSubject,
          completionEmailBody: lmsCourses.completionEmailBody,
        })
        .from(lmsCourses)
        .where(eq(lmsCourses.id, input.courseId))
        .limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      return course;
    }),

  // ===== updateAfterPurchase =====
  updateAfterPurchase: protectedProcedure
    .input(z.object({
      courseId: z.number(),
      customThankYouEnabled: z.boolean().optional(),
      customThankYouBlocks: z.string().nullable().optional(),
      postPurchaseRedirectUrl: z.string().max(1024).nullable().optional(),
      welcomeEmailEnabled: z.boolean().optional(),
      welcomeEmailSubject: z.string().max(500).nullable().optional(),
      welcomeEmailBody: z.string().nullable().optional(),
      upsellEnabled: z.boolean().optional(),
      upsellCourseId: z.number().nullable().optional(),
      upsellProductType: z.enum(["course", "quiz", "webinar", "download", "membership"]).nullable().optional(),
      upsellProductId: z.number().nullable().optional(),
      upsellHeadline: z.string().max(500).nullable().optional(),
      upsellDescription: z.string().nullable().optional(),
      hidePricingOptions: z.boolean().optional(),
      completionRedirectUrl: z.string().max(1024).nullable().optional(),
      completionEmailEnabled: z.boolean().optional(),
      completionEmailSubject: z.string().max(500).nullable().optional(),
      completionEmailBody: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { courseId, ...updates } = input;
      await assertCourseOwnership(ctx, courseId);
      const filtered = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
      if (Object.keys(filtered).length > 0) {
        await db.update(lmsCourses).set(filtered).where(eq(lmsCourses.id, courseId));
      }
      return { success: true };
    }),

  // ===== Course waitlist settings =====
  getCourseWaitlistSettings: protectedProcedure
    .input(z.object({ courseId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      await assertCourseOwnership(ctx, input.courseId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [course] = await db
        .select({
          waitlistEnabled: lmsCourses.waitlistEnabled,
          waitlistHeading: lmsCourses.waitlistHeading,
          waitlistBody: lmsCourses.waitlistBody,
          waitlistCtaLabel: lmsCourses.waitlistCtaLabel,
          waitlistCtaUrl: lmsCourses.waitlistCtaUrl,
          waitlistRedirectUrl: lmsCourses.waitlistRedirectUrl,
          waitlistSuccessMessage: lmsCourses.waitlistSuccessMessage,
        })
        .from(lmsCourses)
        .where(eq(lmsCourses.id, input.courseId))
        .limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND", message: "Course not found" });
      return course;
    }),

  updateCourseWaitlistSettings: protectedProcedure
    .input(z.object({
      courseId: z.number(),
      waitlistEnabled: z.boolean(),
      waitlistHeading: z.string().max(512).nullable().optional(),
      waitlistBody: z.string().nullable().optional(),
      waitlistCtaLabel: z.string().max(255).nullable().optional(),
      waitlistCtaUrl: z.string().max(1024).nullable().optional(),
      waitlistRedirectUrl: z.string().max(1024).nullable().optional(),
      waitlistSuccessMessage: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      await assertCourseOwnership(ctx, input.courseId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { courseId, ...updates } = input;
      await db.update(lmsCourses).set(updates).where(eq(lmsCourses.id, courseId));
      return { success: true };
    }),

  // ===== getCheckoutPageConfig =====
  getCheckoutPageConfig: protectedProcedure
    .input(z.object({ courseId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      await assertCourseOwnership(ctx, input.courseId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [course] = await db
        .select({ checkoutPageConfig: lmsCourses.checkoutPageConfig })
        .from(lmsCourses)
        .where(eq(lmsCourses.id, input.courseId))
        .limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      return { config: course.checkoutPageConfig ?? null };
    }),

  // ===== saveCheckoutPageConfig =====
  saveCheckoutPageConfig: protectedProcedure
    .input(z.object({
      courseId: z.number(),
      config: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      await assertCourseOwnership(ctx, input.courseId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      try { JSON.parse(input.config); } catch {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid JSON config" });
      }
      await db.update(lmsCourses).set({ checkoutPageConfig: input.config }).where(eq(lmsCourses.id, input.courseId));
      return { success: true };
    }),

  // ===== getPublicCheckoutPageConfig =====
  getPublicCheckoutPageConfig: publicProcedure
    .input(z.object({ courseId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [course] = await db
        .select({ checkoutPageConfig: lmsCourses.checkoutPageConfig })
        .from(lmsCourses)
        .where(eq(lmsCourses.id, input.courseId))
        .limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      return { config: course.checkoutPageConfig ?? null };
    }),

  // ===== listCheckoutTemplates =====
  listCheckoutTemplates: protectedProcedure
    .query(async ({ ctx }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const templates = await db.select({
          id: lmsCheckoutTemplates.id,
          name: lmsCheckoutTemplates.name,
          description: lmsCheckoutTemplates.description,
          config: lmsCheckoutTemplates.config,
          createdAt: lmsCheckoutTemplates.createdAt,
        })
        .from(lmsCheckoutTemplates)
        .orderBy(desc(lmsCheckoutTemplates.createdAt));
      return templates;
    }),

  // ===== saveCheckoutTemplate =====
  saveCheckoutTemplate: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      description: z.string().max(1000).optional(),
      config: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      try { JSON.parse(input.config); } catch {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid JSON config" });
      }
      const [result] = await db.insert(lmsCheckoutTemplates).values({
        name: input.name,
        description: input.description ?? null,
        config: input.config,
        createdByUserId: ctx.user.id,
      });
      return { id: (result as any).insertId as number, success: true };
    }),

  // ===== deleteCheckoutTemplate =====
  deleteCheckoutTemplate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(lmsCheckoutTemplates).where(eq(lmsCheckoutTemplates.id, input.id));
      return { success: true };
    }),

  // ===== listCoursesWithLessons =====
  listCoursesWithLessons: protectedProcedure
    .query(async ({ ctx }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const orgId = await getOrgIdForUserWithFallback(ctx.user.id, ctx.user.role);
      const courses = await db.select({ id: lmsCourses.id, title: lmsCourses.title, slug: lmsCourses.slug, type: lmsCourses.type })
        .from(lmsCourses)
        .where(orgId !== null ? eq(lmsCourses.orgId, orgId) : undefined)
        .orderBy(asc(lmsCourses.title));
      const sections = await db.select({ id: lmsSections.id, courseId: lmsSections.courseId, title: lmsSections.title, position: lmsSections.position })
        .from(lmsSections).orderBy(asc(lmsSections.courseId), asc(lmsSections.position));
      const lessons = await db.select({ id: lmsLessons.id, courseId: lmsLessons.courseId, sectionId: lmsLessons.sectionId, title: lmsLessons.title, type: lmsLessons.type, position: lmsLessons.position })
        .from(lmsLessons).orderBy(asc(lmsLessons.courseId), asc(lmsLessons.position));
      // Build tree
      const result = courses.map(c => ({
        ...c,
        sections: sections
          .filter(s => s.courseId === c.id)
          .map(s => ({
            ...s,
            lessons: lessons.filter(l => l.sectionId === s.id),
          })),
        topLevelLessons: lessons.filter(l => l.courseId === c.id && !l.sectionId),
      }));
      return result;
    }),

  // ─── Curriculum Embed Visibility ───────────────────────────────────────────────────
  getCurriculumEmbedVisibility: protectedProcedure
    .input(z.object({ courseId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db
        .select()
        .from(curriculumEmbedVisibility)
        .where(eq(curriculumEmbedVisibility.courseId, input.courseId));
      const hiddenMap: Record<string, boolean> = {};
      for (const row of rows) {
        if (row.hidden) hiddenMap[`${row.itemType}_${row.itemId}`] = true;
      }
      return { hiddenMap, rows };
    }),

  setCurriculumEmbedVisibility: protectedProcedure
    .input(z.object({
      courseId: z.number(),
      items: z.array(z.object({
        itemType: z.enum(["section", "lesson"]),
        itemId: z.number(),
        hidden: z.boolean(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      for (const item of input.items) {
        await db
          .insert(curriculumEmbedVisibility)
          .values({
            courseId: input.courseId,
            itemType: item.itemType,
            itemId: item.itemId,
            hidden: item.hidden,
          })
          .onDuplicateKeyUpdate({ set: { hidden: item.hidden } });
      }
      return { success: true, updated: input.items.length };
    }),

  // ─── AI: Generate Course Outline ─────────────────────────────────────────────
  generateCourseOutline: protectedProcedure
    .input(z.object({
      courseId: z.number(),
      prompt: z.string().min(5).max(2000),
      numSections: z.number().int().min(1).max(20).default(4),
      numLessonsPerSection: z.number().int().min(1).max(15).default(3),
      sourceFiles: z.array(z.object({ url: z.string().url(), mimeType: z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp"]), name: z.string().min(1).max(255) })).min(1).max(3).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      await assertCourseOwnership(ctx, input.courseId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [course] = await db.select({ orgId: lmsCourses.orgId }).from(lmsCourses).where(eq(lmsCourses.id, input.courseId)).limit(1);
      const sourceFiles = input.sourceFiles ?? [];
      if (sourceFiles.some(source => !source.url.includes(`/ai-generation-sources/${course?.orgId}/${ctx.user.id}/`))) throw new TRPCError({ code: "FORBIDDEN", message: "Source files must belong to your active organization." });

      const systemPrompt = `You are an expert instructional designer and course creator. You produce well-structured, educationally sound course outlines in United States English. Always respond with valid JSON matching the requested schema exactly.`;

      const userPrompt = `Create a complete course outline based on this description:
"${input.prompt}"

Requirements:
- Exactly ${input.numSections} sections (modules)
- Exactly ${input.numLessonsPerSection} lessons per section
- Each lesson must have a clear title and 2-4 paragraphs of instructional HTML content using <h2>, <p>, <ul>, <li>, <strong> tags
- Content should be educational, detailed, and ready to use as lesson material
- Use United States English spelling throughout

Return JSON with this exact shape:
{
  "courseTitle": "string",
  "sections": [
    {
      "title": "string",
      "lessons": [
        { "title": "string", "content": "string (HTML)" }
      ]
    }
  ]
}`;

      let outline: { courseTitle: string; sections: Array<{ title: string; lessons: Array<{ title: string; content: string }> }> };
      try {
        const response = await invokeLLM({
          model: sourceFiles.length ? "gemini-3-flash-preview" : undefined,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: buildAiSourceMessage(userPrompt, sourceFiles) as any },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "course_outline",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  courseTitle: { type: "string" },
                  sections: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        lessons: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              title: { type: "string" },
                              content: { type: "string" },
                            },
                            required: ["title", "content"],
                            additionalProperties: false,
                          },
                        },
                      },
                      required: ["title", "lessons"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["courseTitle", "sections"],
                additionalProperties: false,
              },
            },
          },
        });
        const raw = response.choices?.[0]?.message?.content ?? "{}";
        outline = typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch (e: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `AI generation failed: ${e?.message ?? "unknown error"}` });
      }

      if (!outline?.sections?.length) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI returned an empty outline. Please try again with a more detailed prompt." });
      }

      const posResult = await db
        .select({ maxPos: max(lmsSections.position) })
        .from(lmsSections)
        .where(eq(lmsSections.courseId, input.courseId));
      let sectionPosition = (posResult[0]?.maxPos ?? -1) + 1;

      const createdSections: Array<{ id: number; title: string; lessons: Array<{ id: number; title: string }> }> = [];

      for (const sectionData of outline.sections) {
        const [sectionResult] = await db
          .insert(lmsSections)
          .values({ courseId: input.courseId, title: sectionData.title, position: sectionPosition++ })
          .$returningId();
        const sectionId = sectionResult.id;
        const createdLessons: Array<{ id: number; title: string }> = [];
        let lessonPosition = 0;

        for (const lessonData of sectionData.lessons) {
          const heroBlock = JSON.stringify([{
            id: `hero-auto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            type: "hero",
            data: { headline: lessonData.title, headline2: "", subheadline: "", hideButtons: true, buttons: [], bgType: "color", bgColor: "#149096", textColor: "#ffffff", align: "left", heroMinHeight: 150 },
          }, {
            id: `text-auto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            type: "text",
            data: { html: lessonData.content, align: "left", bgColor: "#ffffff", textColor: "#1a1a1a" },
          }]);

          const [lessonResult] = await db
            .insert(lmsLessons)
            .values({ courseId: input.courseId, sectionId, title: lessonData.title, type: "text", position: lessonPosition++, content: lessonData.content, contentBlocks: heroBlock })
            .$returningId();
          createdLessons.push({ id: lessonResult.id, title: lessonData.title });
        }
        createdSections.push({ id: sectionId, title: sectionData.title, lessons: createdLessons });
      }

      return { success: true, courseTitle: outline.courseTitle, sections: createdSections };
    }),

  // ─── AI: Generate Lesson Content ─────────────────────────────────────────────
  generateLessonContent: protectedProcedure
    .input(z.object({
      prompt: z.string().min(5).max(2000),
      existingContent: z.string().optional(),
      contentType: z.enum(["lesson", "section", "outline", "summary", "explanation", "exercise"]).default("lesson"),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);

      const systemPrompt = `You are an expert instructional designer and content writer. You write clear, engaging educational content in United States English. Always return well-formatted HTML content using tags like <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <blockquote>. Do not include <html>, <head>, or <body> tags — return only the inner content HTML.`;

      const existingNote = input.existingContent
        ? `\n\nExisting content to expand or improve upon:\n${input.existingContent.replace(/<[^>]+>/g, "").slice(0, 500)}`
        : "";

      const typeInstructions: Record<string, string> = {
        lesson: `Write a complete lesson with an introduction, main content sections, key takeaways, and a summary. ${fullLessonLengthRequirement()}`,
        section: "Write a module overview that introduces the topic and outlines what learners will cover.",
        outline: "Write a structured outline with headings and brief descriptions for each point.",
        summary: "Write a concise summary of the key concepts.",
        explanation: "Write a clear, detailed explanation suitable for learners new to the topic.",
        exercise: "Write a practical exercise or activity with clear instructions and expected outcomes.",
      };

      const userPrompt = `${typeInstructions[input.contentType] ?? typeInstructions.lesson}\n\nTopic / instructions: ${input.prompt}${existingNote}\n\nReturn only the HTML content (no markdown code fences, no outer HTML tags).`;

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        });
        const initialContent = response.choices?.[0]?.message?.content;
        let cleaned = cleanGeneratedLessonContent(typeof initialContent === "string" ? initialContent : "");
        let wordCount = countGeneratedContentWords(cleaned);
        const isFullLesson = requiresFullLessonMinimum(input.contentType);

        if (isFullLesson && wordCount < 1500) {
          const expanded = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: buildFullLessonExpansionPrompt({ content: cleaned, wordCount }) },
            ],
          });
          const expandedContent = expanded.choices?.[0]?.message?.content;
          cleaned = cleanGeneratedLessonContent(typeof expandedContent === "string" ? expandedContent : "");
          wordCount = countGeneratedContentWords(cleaned);
        }

        if (isFullLesson && wordCount < 1500) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `AI could not complete the required 1,500-word full lesson. It returned ${wordCount} words; please try again.`,
          });
        }

        return { success: true, content: cleaned, wordCount, minimumWordCount: isFullLesson ? 1500 : null };
      } catch (e: any) {
        if (e instanceof TRPCError) throw e;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `AI generation failed: ${e?.message ?? "unknown error"}` });
      }
    }),

  /**
   * generateImage — generate an image from a text prompt using the built-in image service.
   * Returns a public S3 URL for the generated image.
   */
  generateImage: protectedProcedure
    .input(z.object({
      prompt: z.string().min(1).max(1000),
      orgId: z.number().int().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const isPlatformAdmin = ["site_owner", "site_admin"].includes(ctx.user.role);
      if (!isPlatformAdmin) {
        const activeOrgId = await getOrgIdForUserWithFallback(ctx.user.id, ctx.user.role);
        if (activeOrgId !== input.orgId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Select the active organization before generating an image" });
        }
      }
      try {
        const { url } = await generateImage({ prompt: input.prompt });
        return { success: true, url: url ?? "" };
      } catch (e: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Image generation failed: ${e?.message ?? "unknown error"}` });
      }
    }),
});
