/**
 * lmsRouter — unified LMS tRPC router
 * Exposes all trpc.lms.* procedures consumed by the frontend.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getOrgIdForUser, getOrgBySlug, getOrgIdForUserWithFallback, createManualUser, addOrgMember, requireOrgAdmin, getOrgMembers, getUserById, getOrgById } from "./db";
import { sendEmail, sendOrgEmail, resolveMergeTags, buildUnsubscribeToken } from "./sendgrid";
import { invokeLLM } from "./_core/llm";
import { storagePut, storagePresignedPut, storagePutStream } from "./storage";
import { scrapeVideoFromUrl, cleanupScrapedVideo } from "./videoScraper";
import { nanoid } from "nanoid";
import {
  getCoursesByOrg,
  getCourseById,
  getCourseBySlug,
  createCourse,
  updateCourse,
  deleteCourse,
  reorderCourses,
  getSectionsByCourse,
  getCourseIdBySectionId,
  createSection,
  updateSection,
  deleteSection,
  reorderSections,
  getLessonById,
  createLesson,
  updateLesson,
  deleteLesson,
  reorderLessons,
  getFullCurriculum,
  getPricingByCourse,
  getCourseIdByPricingId,
  createPricing,
  updatePricing,
  deletePricing,
  getEnrollment,
  createEnrollment,
  updateEnrollmentProgress,
  getAllLessonProgress,
  upsertLessonProgress,
  getOrgTheme,
  upsertOrgTheme,
  getOrgSubscription,
  getPagesByOrg,
  getPageById,
  getPageByCourse,
  createPage,
  updatePage,
  deletePage,
  duplicatePage,
  getPublishedPageBySlug,
  getInstructorsByOrg,
  upsertInstructor,
  updateInstructorById,
  deleteInstructorById,
  getAffiliatesByOrg,
  createAffiliate,
  updateAffiliate,
  deleteAffiliate,
  getCertificatesByUser,
  createCertificate,
  getWebinarsByOrg,
  getWebinarById,
  getWebinarBySlug,
  createWebinar,
  updateWebinar,
  deleteWebinar,
  getWebinarRegistrations,
  createWebinarRegistration,
  updateWebinarRegistration,
  createWebinarSession,
  getWebinarSessionByToken,
  updateWebinarSession,
  getWebinarFunnelSteps,
  upsertWebinarFunnelSteps,
  getWebinarStats,
  getMembersWithEnrollments,
  listEmailCampaigns,
  getEmailCampaignById,
  createEmailCampaign,
  updateEmailCampaign,
  deleteEmailCampaign,
  getEmailCampaignStats,
  getCategoriesByOrg,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  getGroupsByOrg,
  getGroupById,
  createGroup,
  updateGroup,
  deleteGroup,
  getGroupMembers,
  addGroupMember,
  removeGroupMember,
  getDiscussionsByOrg,
  getDiscussionById,
  createDiscussion,
  updateDiscussion,
  deleteDiscussion,
  getRepliesByDiscussion,
  createDiscussionReply,
  deleteDiscussionReply,
  getAssignmentsByOrg,
  getAssignmentById,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  getSubmissionsByAssignment,
  getCertificateTemplatesByOrg,
  getCertificateTemplateById,
  createCertificateTemplate,
  updateCertificateTemplate,
  deleteCertificateTemplate,
  getLmsCertificateTemplatesByOrg,
  getLmsCertificateTemplateById,
  createLmsCertificateTemplate,
  updateLmsCertificateTemplate,
  deleteLmsCertificateTemplate,
  listIssuedCertificates,
  getRevenuePartnersByOrg,
  getRevenuePartnerById,
  createRevenuePartner,
  updateRevenuePartner,
  deleteRevenuePartner,
  getCouponsByOrg,
  createCoupon,
  updateCoupon,
  getCourseOrdersByOrg,
  getCourseOrderById,
  createCourseOrder,
  updateCourseOrder,
  getCourseOrderStats,
  getMembershipsByOrg,
  getMembershipById,
  createMembership,
  updateMembership,
  deleteMembership,
  getMembershipMembers,
  addMembershipMember,
  updateMembershipMember,
  getMembershipIdByMemberRecordId,
  removeMembershipMember,
  getMembershipContentItems,
  addMembershipContent,
  getMembershipIdByContentRecordId,
  removeMembershipContent,
  getMembershipRules,
  addMembershipRule,
  updateMembershipRule,
  getMembershipIdByRuleRecordId,
  removeMembershipRule,
  getBundlesByOrg,
  getBundleById,
  createBundle,
  updateBundle,
  deleteBundle,
  getFlashcardDecksByOrg,
  getFlashcardDeckById,
  createFlashcardDeck,
  updateFlashcardDeck,
  deleteFlashcardDeck,
  getCardsByDeck,
  bulkUpsertCards,
  getNotesByLesson,
  getNotesByCourse,
  createNote,
  updateNote,
  deleteNote,
  getBookmarksByCourse,
  getBookmark,
  createBookmark,
  deleteBookmark,
  getDashboardMetrics,
  getRevenueChartData,
  getRecentActivity,
  getRecentlyEditedCourses,
  getEnrolledCoursesForUser,
  getLmsAnalyticsByOrg,
  getOrgAnalyticsByGroup,
  getOrgCourseAnalytics,
  insertActivityEvents,
  getActivityEventsByOrg,
  getOrgNotificationSettings,
  updateOrgNotificationSettings,
  getWorkshopsByOrg,
  getWorkshopById,
  getWorkshopBySlug,
  createWorkshop,
  updateWorkshop,
  deleteWorkshop,
  getWorkshopRegistrations,
  getWorkshopRegistrationById,
  createWorkshopRegistration,
  updateWorkshopRegistration,
} from "./lmsDb";
import { downloadsAdminRouter } from "./routers/downloadsRouter";
import { orderBumpsAdminRouter } from "./routers/orderBumpsRouter";
import { emailCampaignsRouter } from "./emailCampaignsRouter";
import { funnelRouter } from "./routers/funnelRouter";

// ─── Helper ──────────────────────────────────────────────────────────────────
async function requireOrgId(userId: number): Promise<number> {
  const orgId = await getOrgIdForUser(userId);
  if (!orgId) throw new TRPCError({ code: "FORBIDDEN", message: "No org found for user" });
  return orgId;
}

async function requireWebinarAccess(ctx: { user: { id: number; role: string } }, webinarId: number) {
  const webinar = await getWebinarById(webinarId);
  if (!webinar) throw new TRPCError({ code: "NOT_FOUND", message: "Webinar not found" });
  await requireOrgAdmin(ctx.user.id, ctx.user.role, webinar.orgId);
  return webinar;
}

async function requireLegacyMembershipAccess(ctx: { user: { id: number; role: string } }, membershipId: number) {
  const membership = await getMembershipById(membershipId);
  if (!membership) throw new TRPCError({ code: "NOT_FOUND", message: "Membership not found" });
  await requireOrgAdmin(ctx.user.id, ctx.user.role, membership.orgId);
  return membership;
}

async function requireLegacyBundleAccess(ctx: { user: { id: number; role: string } }, bundleId: number) {
  const bundle = await getBundleById(bundleId);
  if (!bundle) throw new TRPCError({ code: "NOT_FOUND", message: "Bundle not found" });
  await requireOrgAdmin(ctx.user.id, ctx.user.role, bundle.orgId);
  return bundle;
}

async function requireLegacyFlashcardDeckAccess(ctx: { user: { id: number; role: string } }, deckId: number) {
  const deck = await getFlashcardDeckById(deckId);
  if (!deck) throw new TRPCError({ code: "NOT_FOUND", message: "Flashcard deck not found" });
  await requireOrgAdmin(ctx.user.id, ctx.user.role, deck.orgId);
  return deck;
}

async function requireLegacyCourseAccess(ctx: { user: { id: number; role: string } }, courseId: number) {
  const course = await getCourseById(courseId);
  if (!course) throw new TRPCError({ code: "NOT_FOUND", message: "Course not found" });
  await requireOrgAdmin(ctx.user.id, ctx.user.role, course.orgId);
  return course;
}

async function requireLegacyWorkshopAccess(ctx: { user: { id: number; role: string } }, workshopId: number) {
  const workshop = await getWorkshopById(workshopId);
  if (!workshop) throw new TRPCError({ code: "NOT_FOUND", message: "Workshop not found" });
  await requireOrgAdmin(ctx.user.id, ctx.user.role, workshop.orgId);
  return workshop;
}

async function requireLegacySectionAccess(ctx: { user: { id: number; role: string } }, sectionId: number) {
  const courseId = await getCourseIdBySectionId(sectionId);
  if (!courseId) throw new TRPCError({ code: "NOT_FOUND", message: "Course section not found" });
  return requireLegacyCourseAccess(ctx, courseId);
}

async function requireLegacyLessonAccess(ctx: { user: { id: number; role: string } }, lessonId: number) {
  const lesson = await getLessonById(lessonId);
  if (!lesson) throw new TRPCError({ code: "NOT_FOUND", message: "Course lesson not found" });
  return requireLegacyCourseAccess(ctx, lesson.courseId);
}

async function requireLegacyPricingAccess(ctx: { user: { id: number; role: string } }, pricingId: number) {
  const courseId = await getCourseIdByPricingId(pricingId);
  if (!courseId) throw new TRPCError({ code: "NOT_FOUND", message: "Course pricing option not found" });
  return requireLegacyCourseAccess(ctx, courseId);
}

async function getTeachificOrgId(): Promise<number | null> {
  const teachOrg = await getOrgBySlug("teach");
  return teachOrg?.id ?? null;
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const lmsRouter = router({

  // ── Courses ────────────────────────────────────────────────────────────────
  courses: router({
    list: protectedProcedure
      .input(z.object({ orgId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const orgId = input?.orgId ?? await requireOrgId(ctx.user.id);
        await requireOrgAdmin(ctx.user.id, ctx.user.role, orgId);
        return getCoursesByOrg(orgId);
      }),
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        return requireLegacyCourseAccess(ctx, input.id);
      }),
    create: protectedProcedure
      .input(z.object({
        orgId: z.number().optional(),
        title: z.string().min(1),
        description: z.string().optional(),
        thumbnailUrl: z.string().optional(),
        status: z.enum(["draft", "published", "hidden", "private", "archived"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const orgId = input.orgId ?? await requireOrgId(ctx.user.id);
        await requireOrgAdmin(ctx.user.id, ctx.user.role, orgId);
        const slug = input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + nanoid(6);
        return createCourse({ ...input, orgId, slug });
      }),
    update: protectedProcedure
      .input(z.object({ id: z.number() }).passthrough())
      .mutation(async ({ ctx, input }) => {
        await requireLegacyCourseAccess(ctx, input.id);
        const { id, ...data } = input;
        return updateCourse(id, data as any);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await requireLegacyCourseAccess(ctx, input.id);
        await deleteCourse(input.id);
        return { ok: true };
      }),
    reorder: protectedProcedure
      .input(z.object({ courseIds: z.array(z.number()) }))
      .mutation(async ({ ctx, input }) => {
        await Promise.all(input.courseIds.map((courseId) => requireLegacyCourseAccess(ctx, courseId)));
        await reorderCourses(input.courseIds);
        return { ok: true };
      }),
    getThankYouPage: protectedProcedure
      .input(z.object({ courseId: z.number().optional(), id: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        const id = input.id ?? input.courseId;
        if (!id) throw new TRPCError({ code: "BAD_REQUEST" });
        const course = await requireLegacyCourseAccess(ctx, id);
        return { blocks: (course as any)?.thankYouPageBlocks ?? null };
      }),
  }),

  // ── Curriculum ─────────────────────────────────────────────────────────────
  curriculum: router({
    get: protectedProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ ctx, input }) => {
        await requireLegacyCourseAccess(ctx, input.courseId);
        return getFullCurriculum(input.courseId);
      }),
    getLesson: protectedProcedure
      .input(z.object({ id: z.number().optional(), lessonId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        const id = input.id ?? input.lessonId;
        if (!id) throw new TRPCError({ code: "BAD_REQUEST" });
        await requireLegacyLessonAccess(ctx, id);
        const lesson = await getLessonById(id);
        if (!lesson) throw new TRPCError({ code: "NOT_FOUND" });
        return lesson;
      }),
    createSection: protectedProcedure
      .input(z.object({ courseId: z.number(), title: z.string().min(1), sortOrder: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        await requireLegacyCourseAccess(ctx, input.courseId);
        return createSection({ courseId: input.courseId, title: input.title, sortOrder: input.sortOrder ?? 0 });
      }),
    updateSection: protectedProcedure
      .input(z.object({ id: z.number() }).passthrough())
      .mutation(async ({ ctx, input }) => {
        await requireLegacySectionAccess(ctx, input.id);
        const { id, ...data } = input;
        return updateSection(id, data as any);
      }),
    deleteSection: protectedProcedure
      .input(z.object({ id: z.number().optional(), sectionId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const id = input.id ?? input.sectionId;
        if (!id) throw new TRPCError({ code: "BAD_REQUEST" });
        await requireLegacySectionAccess(ctx, id);
        await deleteSection(id);
        return { ok: true };
      }),
    createLesson: protectedProcedure
      .input(z.object({
        courseId: z.number(),
        sectionId: z.number(),
        title: z.string().min(1),
        type: z.string().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await requireLegacyCourseAccess(ctx, input.courseId);
        await requireLegacySectionAccess(ctx, input.sectionId);
        return createLesson({
          courseId: input.courseId,
          sectionId: input.sectionId,
          title: input.title,
          lessonType: (input.type ?? "text") as any,
          sortOrder: input.sortOrder ?? 0,
        });
      }),
    updateLesson: protectedProcedure
      .input(z.object({ id: z.number() }).passthrough())
      .mutation(async ({ ctx, input }) => {
        await requireLegacyLessonAccess(ctx, input.id);
        const { id, ...data } = input;
        return updateLesson(id, data as any);
      }),
    deleteLesson: protectedProcedure
      .input(z.object({ id: z.number().optional(), lessonId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const id = input.id ?? input.lessonId;
        if (!id) throw new TRPCError({ code: "BAD_REQUEST" });
        await requireLegacyLessonAccess(ctx, id);
        await deleteLesson(id);
        return { ok: true };
      }),
    reorderLessons: protectedProcedure
      .input(z.object({ lessonIds: z.array(z.number()) }))
      .mutation(async ({ ctx, input }) => {
        await Promise.all(input.lessonIds.map((lessonId) => requireLegacyLessonAccess(ctx, lessonId)));
        await reorderLessons(input.lessonIds);
        return { ok: true };
      }),
  }),

  // ── Pricing ────────────────────────────────────────────────────────────────
  pricing: router({
    list: protectedProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ ctx, input }) => {
        await requireLegacyCourseAccess(ctx, input.courseId);
        return getPricingByCourse(input.courseId);
      }),
    create: protectedProcedure
      .input(z.object({ courseId: z.number(), orgId: z.number().optional() }).passthrough())
      .mutation(async ({ ctx, input }) => {
        await requireLegacyCourseAccess(ctx, input.courseId);
        return createPricing(input as any);
      }),
    update: protectedProcedure
      .input(z.object({ id: z.number() }).passthrough())
      .mutation(async ({ ctx, input }) => {
        await requireLegacyPricingAccess(ctx, input.id);
        const { id, ...data } = input;
        return updatePricing(id, data as any);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number().optional(), pricingId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const id = input.id ?? input.pricingId;
        if (!id) throw new TRPCError({ code: "BAD_REQUEST" });
        await requireLegacyPricingAccess(ctx, id);
        await deletePricing(id);
        return { ok: true };
      }),
  }),

  // ── Enrollments ────────────────────────────────────────────────────────────
  enrollments: router({
    myEnrollments: protectedProcedure
      .query(async ({ ctx }) => {
        return getEnrolledCoursesForUser(ctx.user.id);
      }),
    enroll: protectedProcedure
      .input(z.object({ courseId: z.number(), orgId: z.number().optional(), amountPaid: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const existing = await getEnrollment(input.courseId, ctx.user.id);
        if (existing) return existing;
        // Resolve the course owner server-side so callers cannot enroll under another org.
        const { getDb } = await import("./db");
        const { contentAvailability, lmsCourses } = await import("../drizzle/schema");
        const { and, eq } = await import("drizzle-orm");
        const db = await getDb();
        if (db) {
          const [course] = await db.select({ enrollmentClosed: lmsCourses.enrollmentClosed, orgId: lmsCourses.orgId }).from(lmsCourses).where(eq(lmsCourses.id, input.courseId)).limit(1);
          if (course?.enrollmentClosed) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Enrollment is closed for this course." });
          }
          if (course) {
            const [availability] = await db.select({ status: contentAvailability.status }).from(contentAvailability).where(and(
              eq(contentAvailability.orgId, course.orgId),
              eq(contentAvailability.productType, "course"),
              eq(contentAvailability.productId, input.courseId),
            )).limit(1);
            if (availability?.status === "waitlist") {
              throw new TRPCError({ code: "FORBIDDEN", message: "This course is currently accepting waitlist registrations only." });
            }
            if (availability?.status === "enrollment_closed") {
              throw new TRPCError({ code: "FORBIDDEN", message: "Enrollment is closed for this course." });
            }
            return createEnrollment({
              courseId: input.courseId,
              userId: ctx.user.id,
              orgId: course.orgId,
              amountPaid: input.amountPaid ?? 0,
              isActive: true,
            });
          }
        }
        const orgId = input.orgId ?? await requireOrgId(ctx.user.id);
        return createEnrollment({
          courseId: input.courseId,
          userId: ctx.user.id,
          orgId,
          amountPaid: input.amountPaid ?? 0,
          isActive: true,
        });
      }),
    progress: protectedProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ ctx, input }) => {
        const enrollment = await getEnrollment(input.courseId, ctx.user.id);
        if (!enrollment) return null;
        const lessonProgress = await getAllLessonProgress(enrollment.id);
        return { enrollment, lessonProgress };
      }),
    updateLessonProgress: protectedProcedure
      .input(z.object({
        courseId: z.number(),
        lessonId: z.number(),
        completed: z.boolean().optional(),
        progressPct: z.number().optional(),
        watchedSeconds: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const enrollment = await getEnrollment(input.courseId, ctx.user.id);
        if (!enrollment) throw new TRPCError({ code: "NOT_FOUND", message: "Not enrolled" });
        const lp = await upsertLessonProgress({
          enrollmentId: enrollment.id,
          lessonId: input.lessonId,
          courseId: input.courseId,
          userId: ctx.user.id,
          status: input.completed ? "completed" : "in_progress",
          timeSpentSeconds: input.watchedSeconds,
        });
        const allProgress = await getAllLessonProgress(enrollment.id);
        const completedCount = allProgress.filter((p: any) => p.completed).length;
        const totalLessons = allProgress.length || 1;
        const pct = Math.round((completedCount / totalLessons) * 100);
        await updateEnrollmentProgress(enrollment.id, pct, input.lessonId);
        return lp;
      }),
  }),

  // ── Themes ─────────────────────────────────────────────────────────────────
  themes: router({
    get: protectedProcedure
      .input(z.object({ orgId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const orgId = input?.orgId ?? await requireOrgId(ctx.user.id);
        return getOrgTheme(orgId);
      }),
    update: protectedProcedure
      .input(z.object({ orgId: z.number().optional(), data: z.record(z.string(), z.unknown()) }))
      .mutation(async ({ ctx, input }) => {
        const orgId = input.orgId ?? await requireOrgId(ctx.user.id);
        return upsertOrgTheme(orgId, input.data as any);
      }),
  }),

  // ── Subscription ───────────────────────────────────────────────────────────
  subscription: router({
    get: protectedProcedure
      .input(z.object({ orgId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const orgId = input?.orgId ?? await requireOrgId(ctx.user.id);
        return getOrgSubscription(orgId);
      }),
  }),

  // ── Pages ──────────────────────────────────────────────────────────────────
  pages: router({
    list: protectedProcedure
      .input(z.object({ orgId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const orgId = input?.orgId ?? await requireOrgId(ctx.user.id);
        return getPagesByOrg(orgId);
      }),
    get: protectedProcedure
      .input(z.object({ pageId: z.number() }))
      .query(async ({ input }) => {
        const page = await getPageById(input.pageId);
        if (!page) throw new TRPCError({ code: "NOT_FOUND" });
        return page;
      }),
    getByCourse: protectedProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ input }) => {
        return getPageByCourse(input.courseId);
      }),
    getBySlug: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => {
        return getPublishedPageBySlug(input.slug);
      }),
    create: protectedProcedure
      .input(z.object({
        orgId: z.number().optional(),
        title: z.string().min(1),
        slug: z.string().optional(),
        courseId: z.number().optional(),
        pageType: z.string().optional(),
        blocks: z.any().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const orgId = input.orgId ?? await requireOrgId(ctx.user.id);
        const slug = input.slug ?? input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + nanoid(6);
        return createPage({
          orgId,
          title: input.title,
          slug,
          courseId: input.courseId ?? null,
          pageType: (input.pageType ?? "landing") as any,
          blocksJson: input.blocks ? JSON.stringify(input.blocks) : "[]",
          isPublished: false,
        });
      }),
    update: protectedProcedure
      .input(z.object({ pageId: z.number(), data: z.record(z.string(), z.unknown()) }))
      .mutation(async ({ input }) => {
        return updatePage(input.pageId, input.data as any);
      }),
    delete: protectedProcedure
      .input(z.object({ pageId: z.number() }))
      .mutation(async ({ input }) => {
        await deletePage(input.pageId);
        return { ok: true };
      }),
    duplicate: protectedProcedure
      .input(z.object({ pageId: z.number() }))
      .mutation(async ({ input }) => {
        return duplicatePage(input.pageId);
      }),
    aiGenerate: protectedProcedure
      .input(z.object({ prompt: z.string(), context: z.string().optional() }))
      .mutation(async ({ input }) => {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "You are an expert landing page copywriter. Generate page builder blocks as a JSON array. Return only valid JSON." },
            { role: "user", content: `Create a landing page for: ${input.prompt}. Context: ${input.context ?? ""}` },
          ],
        });
        const content = (response.choices[0]?.message?.content ?? "[]") as string;
        try { return { blocks: JSON.parse(content) }; }
        catch { return { blocks: [] }; }
      }),
  }),

  // ── Instructors ────────────────────────────────────────────────────────────
  instructors: router({
    list: protectedProcedure
      .input(z.object({ orgId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const orgId = input?.orgId ?? await requireOrgId(ctx.user.id);
        return getInstructorsByOrg(orgId);
      }),
    upsert: protectedProcedure
      .input(z.object({ orgId: z.number().optional(), userId: z.number(), displayName: z.string().optional(), title: z.string().optional(), bio: z.string().optional(), avatarUrl: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const orgId = input.orgId ?? await requireOrgId(ctx.user.id);
        return upsertInstructor({ orgId, userId: input.userId, displayName: input.displayName ?? null, title: input.title ?? null, bio: input.bio ?? null, avatarUrl: input.avatarUrl ?? null });
      }),
    update: protectedProcedure
      .input(z.object({ instructorId: z.number(), data: z.record(z.string(), z.unknown()) }))
      .mutation(async ({ input }) => {
        return updateInstructorById(input.instructorId, input.data as any);
      }),
    delete: protectedProcedure
      .input(z.object({ instructorId: z.number() }))
      .mutation(async ({ input }) => {
        return deleteInstructorById(input.instructorId);
      }),
  }),

  // ── Affiliates ─────────────────────────────────────────────────────────────
  affiliates: router({
    list: protectedProcedure
      .input(z.object({ orgId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const orgId = input?.orgId ?? await requireOrgId(ctx.user.id);
        return getAffiliatesByOrg(orgId);
      }),
    create: protectedProcedure
      .input(z.object({ orgId: z.number().optional(), userId: z.number().optional(), name: z.string(), email: z.string(), code: z.string().optional(), commissionValue: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const orgId = input.orgId ?? await requireOrgId(ctx.user.id);
        const code = input.code ?? nanoid(8).toUpperCase();
        return createAffiliate({ orgId, userId: input.userId ?? null, name: input.name, email: input.email, code, commissionValue: input.commissionValue ?? 20 });
      }),
    update: protectedProcedure
      .input(z.object({ affiliateId: z.number(), data: z.record(z.string(), z.unknown()) }))
      .mutation(async ({ input }) => {
        return updateAffiliate(input.affiliateId, input.data as any);
      }),
    delete: protectedProcedure
      .input(z.object({ affiliateId: z.number() }))
      .mutation(async ({ input }) => {
        await deleteAffiliate(input.affiliateId);
        return { ok: true };
      }),
  }),

  // ── Certificates ───────────────────────────────────────────────────────────
  certificates: router({
    getCertificatesByOrg: protectedProcedure
      .input(z.object({ orgId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        const orgId = input.orgId ?? await requireOrgId(ctx.user.id);
        return getCertificatesByUser(orgId);
      }),
    myList: protectedProcedure
      .query(async ({ ctx }) => {
        return getCertificatesByUser(ctx.user.id);
      }),
    create: protectedProcedure
      .input(z.object({ userId: z.number(), courseId: z.number(), enrollmentId: z.number(), orgId: z.number().optional(), certUrl: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const orgId = input.orgId ?? await requireOrgId(ctx.user.id);
        return createCertificate({ userId: input.userId, courseId: input.courseId, enrollmentId: input.enrollmentId, orgId, certUrl: input.certUrl ?? null });
      }),
  }),

  // ── Certificate Templates ──────────────────────────────────────────────────
  certificateTemplates: router({
    list: protectedProcedure
      .input(z.object({ orgId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const orgId = input?.orgId ?? await requireOrgId(ctx.user.id);
        return getLmsCertificateTemplatesByOrg(orgId);
      }),
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return getLmsCertificateTemplateById(input.id);
      }),
    create: protectedProcedure
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
        const orgId = input.orgId ?? await requireOrgId(ctx.user.id);
        const { orgId: _orgId, ...rest } = input;
        return createLmsCertificateTemplate({ orgId, ...rest } as any);
      }),
    update: protectedProcedure
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
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteLmsCertificateTemplate(input.id);
        return { ok: true };
      }),
    listIssued: protectedProcedure
      .input(z.object({ orgId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const orgId = input?.orgId ?? await requireOrgId(ctx.user.id);
        return listIssuedCertificates(orgId);
      }),
    preview: protectedProcedure
      .input(z.object({ templateId: z.number().optional(), orgId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const { generateCertificatePdf } = await import("./lib/certificateGenerator");
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
    uploadAsset: protectedProcedure
      .input(z.object({ filename: z.string(), contentType: z.string() }))
      .mutation(async ({ input }) => {
        const key = `certificate-assets/${Date.now()}-${input.filename}`;
        const { url: uploadUrl } = await storagePresignedPut(key, input.contentType);
        const publicUrl = uploadUrl.split("?")[0];
        return { uploadUrl, publicUrl, key };
      }),
  }),

  // ── Webinars ───────────────────────────────────────────────────────────────
  webinars: router({
    list: protectedProcedure
      .input(z.object({ orgId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const orgId = input?.orgId ?? await requireOrgId(ctx.user.id);
        return getWebinarsByOrg(orgId);
      }),
    get: protectedProcedure
      .input(z.object({ webinarId: z.number() }))
      .query(async ({ ctx, input }) => {
        return requireWebinarAccess(ctx, input.webinarId);
      }),
    getBySlug: publicProcedure
      .input(z.object({ orgId: z.number(), slug: z.string() }))
      .query(async ({ input }) => {
        return getWebinarBySlug(input.orgId, input.slug);
      }),
    create: protectedProcedure
      .input(z.object({ orgId: z.number().optional(), title: z.string(), slug: z.string().optional(), scheduledAt: z.date().optional() }))
      .mutation(async ({ ctx, input }) => {
        const orgId = input.orgId ?? await requireOrgId(ctx.user.id);
        const slug = input.slug ?? input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + nanoid(6);
        return createWebinar({ orgId, title: input.title, slug, scheduledAt: input.scheduledAt ?? null });
      }),
    update: protectedProcedure
      .input(z.object({ webinarId: z.number(), data: z.record(z.string(), z.unknown()) }))
      .mutation(async ({ ctx, input }) => {
        const webinar = await requireWebinarAccess(ctx, input.webinarId);
        const linkedCourseId = input.data.linkedCourseId;
        if (typeof linkedCourseId === "number") {
          const course = await getCourseById(linkedCourseId);
          if (!course || course.orgId !== webinar.orgId) {
            throw new TRPCError({ code: "FORBIDDEN", message: "The linked course must belong to the webinar organization." });
          }
        }
        return updateWebinar(input.webinarId, input.data as any);
      }),
    delete: protectedProcedure
      .input(z.object({ webinarId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await requireWebinarAccess(ctx, input.webinarId);
        await deleteWebinar(input.webinarId);
        return { ok: true };
      }),
    register: publicProcedure
      .input(z.object({ webinarId: z.number(), orgId: z.number(), firstName: z.string().optional(), lastName: z.string().optional(), email: z.string().email(), userId: z.number().optional() }))
      .mutation(async ({ input }) => {
        return createWebinarRegistration({ webinarId: input.webinarId, orgId: input.orgId, firstName: input.firstName ?? null, lastName: input.lastName ?? null, email: input.email, userId: input.userId ?? null } as any);
      }),
    getRegistrations: protectedProcedure
      .input(z.object({ webinarId: z.number() }))
      .query(async ({ input }) => {
        return getWebinarRegistrations(input.webinarId);
      }),
    startSession: protectedProcedure
      .input(z.object({ webinarId: z.number() }))
      .mutation(async ({ input }) => {
        const token = nanoid(32);
        return createWebinarSession({ webinarId: input.webinarId, sessionToken: token, startedAt: new Date() });
      }),
    heartbeat: publicProcedure
      .input(z.object({ token: z.string(), watchedSeconds: z.number().optional() }))
      .mutation(async ({ input }) => {
        const session = await getWebinarSessionByToken(input.token);
        if (!session) throw new TRPCError({ code: "NOT_FOUND" });
        await updateWebinarSession(session.id, { watchedSeconds: input.watchedSeconds ?? 0 });
        return { ok: true };
      }),
    getFunnelSteps: protectedProcedure
      .input(z.object({ webinarId: z.number() }))
      .query(async ({ input }) => {
        return getWebinarFunnelSteps(input.webinarId);
      }),
    saveFunnelSteps: protectedProcedure
      .input(z.object({ webinarId: z.number(), steps: z.array(z.any()) }))
      .mutation(async ({ input }) => {
        await upsertWebinarFunnelSteps(input.webinarId, input.steps);
        return { ok: true };
      }),
    getStats: protectedProcedure
      .input(z.object({ webinarId: z.number() }))
      .query(async ({ input }) => {
        return getWebinarStats(input.webinarId);
      }),
  }),

  // ── Members ────────────────────────────────────────────────────────────────
  members: router({
    listWithEnrollments: protectedProcedure
      .input(z.object({ orgId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const orgId = input?.orgId ?? await requireOrgId(ctx.user.id);
        return getMembersWithEnrollments(orgId);
      }),
    manualEnroll: protectedProcedure
      .input(z.object({ userId: z.number(), courseId: z.number(), orgId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const orgId = input.orgId ?? await requireOrgId(ctx.user.id);
        const existing = await getEnrollment(input.courseId, input.userId);
        if (existing) return existing;
        return createEnrollment({ courseId: input.courseId, userId: input.userId, orgId, amountPaid: 0, isActive: true });
      }),
    createAndAdd: protectedProcedure
      .input(z.object({
        orgId: z.number().optional(),
        name: z.string(),
        email: z.string().email(),
        role: z.enum(["member", "user"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const orgId = input.orgId ?? await requireOrgId(ctx.user.id);
        const openId = `manual-${nanoid(16)}`;
        await createManualUser({
          openId,
          name: input.name,
          email: input.email,
          passwordHash: "",
          role: input.role ?? "member",
          loginMethod: "manual",
        });
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { users } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const [newUser] = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
        if (!newUser) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await addOrgMember(orgId, newUser.id, input.role ?? "member");
        return newUser;
      }),
    bulkImport: protectedProcedure
      .input(z.object({
        orgId: z.number().optional(),
        members: z.array(z.object({ name: z.string(), email: z.string().email() })),
      }))
      .mutation(async ({ ctx, input }) => {
        const orgId = input.orgId ?? await requireOrgId(ctx.user.id);
        const results = [];
        for (const m of input.members) {
          try {
            const openId = `manual-${nanoid(16)}`;
            await createManualUser({ openId, name: m.name, email: m.email, passwordHash: "", role: "member", loginMethod: "manual" });
            const { getDb } = await import("./db");
            const db = await getDb();
            if (!db) continue;
            const { users } = await import("../drizzle/schema");
            const { eq } = await import("drizzle-orm");
            const [newUser] = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
            if (newUser) {
              await addOrgMember(orgId, newUser.id, "member");
              results.push({ email: m.email, status: "created" });
            }
          } catch {
            results.push({ email: m.email, status: "error" });
          }
        }
        return results;
      }),
  }),

  // ── Email Marketing ────────────────────────────────────────────────────────
  emailMarketing: router({
    list: protectedProcedure
      .input(z.object({ orgId: z.number() }))
      .query(async ({ input, ctx }) => {
        await requireOrgAdmin(ctx.user.id, ctx.user.role, input.orgId);
        return listEmailCampaigns(input.orgId);
      }),
    stats: protectedProcedure
      .input(z.object({ orgId: z.number() }))
      .query(async ({ input, ctx }) => {
        await requireOrgAdmin(ctx.user.id, ctx.user.role, input.orgId);
        return getEmailCampaignStats(input.orgId);
      }),
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const c = await getEmailCampaignById(input.id);
        if (!c) throw new TRPCError({ code: "NOT_FOUND" });
        await requireOrgAdmin(ctx.user.id, ctx.user.role, c.orgId!);
        return c;
      }),
    create: protectedProcedure
      .input(z.object({
        orgId: z.number(),
        name: z.string().min(1),
        subject: z.string().min(1),
        htmlBody: z.string().default(""),
        textBody: z.string().optional(),
        status: z.enum(["draft", "scheduled", "sending", "sent", "failed"]).optional(),
        scheduledAt: z.date().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await requireOrgAdmin(ctx.user.id, ctx.user.role, input.orgId);
        return createEmailCampaign({ ...input, createdBy: ctx.user.id });
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        subject: z.string().optional(),
        htmlBody: z.string().optional(),
        textBody: z.string().optional(),
        status: z.enum(["draft", "scheduled", "sending", "sent", "failed"]).optional(),
        scheduledAt: z.date().optional().nullable(),
      }))
      .mutation(async ({ input, ctx }) => {
        const c = await getEmailCampaignById(input.id);
        if (!c) throw new TRPCError({ code: "NOT_FOUND" });
        await requireOrgAdmin(ctx.user.id, ctx.user.role, c.orgId!);
        const { id, ...data } = input;
        return updateEmailCampaign(id, data);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const c = await getEmailCampaignById(input.id);
        if (!c) throw new TRPCError({ code: "NOT_FOUND" });
        await requireOrgAdmin(ctx.user.id, ctx.user.role, c.orgId!);
        await deleteEmailCampaign(input.id);
        return { ok: true };
      }),
    send: protectedProcedure
      .input(z.object({
        id: z.number(),
        audience: z.enum(["all_members", "enrolled_students", "custom"]).default("all_members"),
        courseId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const c = await getEmailCampaignById(input.id);
        if (!c) throw new TRPCError({ code: "NOT_FOUND" });
        await requireOrgAdmin(ctx.user.id, ctx.user.role, c.orgId!);
        if (c.status === "sent") throw new TRPCError({ code: "BAD_REQUEST", message: "Campaign already sent" });
        // Mark as sending
        await updateEmailCampaign(input.id, { status: "sending" });
        // Gather recipients
        const members = await getOrgMembers(c.orgId!);
        const recipientUserIds = members.map((m: any) => m.userId).filter(Boolean) as number[];
        // Load org config for per-org SendGrid key + custom sender
        const orgConfig = await getOrgById(c.orgId!);
        // ── Two-tier email model: campaigns require org's own SendGrid key ──────
        if (!orgConfig?.ownSendGridKeyEncrypted) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "sendgrid_key_required",
          });
        }
        // Clear previous recipient rows (idempotent re-send)
        const { getDb } = await import("./db");
        const db = await getDb();
        const { emailCampaignRecipients } = await import("../drizzle/schema");
        const { eq: eqDrizzle } = await import("drizzle-orm");
        if (db) {
          await db.delete(emailCampaignRecipients).where(eqDrizzle(emailCampaignRecipients.campaignId, input.id));
        }
        let sentCount = 0;
        let failedCount = 0;
        for (const userId of recipientUserIds) {
          const user = await getUserById(userId);
          if (!user?.email) { failedCount++; continue; }
          const unsubToken = buildUnsubscribeToken(c.orgId!, userId);
          const html = resolveMergeTags(c.htmlBody, {
            user_name: user.name ?? user.email,
            org_name: orgConfig?.name ?? String(c.orgId),
            course_title: "",
            unsubscribe_url: `${process.env.VITE_OAUTH_PORTAL_URL ?? ""}/unsubscribe?token=${unsubToken}`,
            site_url: process.env.VITE_OAUTH_PORTAL_URL ?? "",
            year: String(new Date().getFullYear()),
          });
          const ok = await sendOrgEmail(
            { to: user.email, subject: c.subject, html },
            {
              ownSendGridKeyEncrypted: orgConfig?.ownSendGridKeyEncrypted,
              customSenderName: orgConfig?.customSenderName,
              customSenderEmail: orgConfig?.customSenderEmail,
            },
          );
          if (ok) sentCount++; else failedCount++;
          // Write per-recipient tracking row
          if (db) {
            await db.insert(emailCampaignRecipients).values({
              campaignId: input.id,
              userId,
              email: user.email,
              status: ok ? "sent" : "failed",
              sentAt: ok ? new Date() : null,
              errorMessage: ok ? null : "Send failed",
            });
          }
        }
        await updateEmailCampaign(input.id, {
          status: "sent",
          sentAt: new Date(),
          sentCount,
          failedCount,
          recipientCount: recipientUserIds.length,
        });
        return { sentCount, failedCount, total: recipientUserIds.length };
      }),
    analytics: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const c = await getEmailCampaignById(input.id);
        if (!c) throw new TRPCError({ code: "NOT_FOUND" });
        await requireOrgAdmin(ctx.user.id, ctx.user.role, c.orgId!);
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { emailCampaignRecipients } = await import("../drizzle/schema");
        const { eq: eqDrizzle, desc: descDrizzle } = await import("drizzle-orm");
        const recipientRows = await db
          .select()
          .from(emailCampaignRecipients)
          .where(eqDrizzle(emailCampaignRecipients.campaignId, input.id))
          .orderBy(descDrizzle(emailCampaignRecipients.sentAt));
        const totalSent = recipientRows.filter((r: any) => r.status === "sent").length;
        const totalFailed = recipientRows.filter((r: any) => r.status === "failed").length;
        const totalOpened = recipientRows.filter((r: any) => r.openedAt != null).length;
        const totalClicked = recipientRows.filter((r: any) => r.clickedAt != null).length;
        const totalBounced = recipientRows.filter((r: any) => r.status === "bounced").length;
        return {
          campaign: c,
          summary: {
            totalRecipients: c.recipientCount ?? 0,
            totalSent,
            totalFailed,
            totalBounced,
            totalOpened,
            totalClicked,
            openRate: totalSent > 0 ? Math.round((totalOpened / totalSent) * 1000) / 10 : 0,
            clickRate: totalSent > 0 ? Math.round((totalClicked / totalSent) * 1000) / 10 : 0,
            clickToOpenRate: totalOpened > 0 ? Math.round((totalClicked / totalOpened) * 1000) / 10 : 0,
          },
          recipients: recipientRows,
        };
      }),
    duplicate: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const c = await getEmailCampaignById(input.id);
        if (!c) throw new TRPCError({ code: "NOT_FOUND" });
        await requireOrgAdmin(ctx.user.id, ctx.user.role, c.orgId!);
        return createEmailCampaign({
          orgId: c.orgId,
          name: `${c.name} (Copy)`,
          templateId: c.templateId ?? undefined,
          subject: c.subject,
          htmlBody: c.htmlBody,
          textBody: c.textBody ?? undefined,
          status: "draft",
          createdBy: ctx.user.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }),
  }),

  // ── Categories ─────────────────────────────────────────────────────────────
  categories: router({
    list: protectedProcedure
      .input(z.object({ orgId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const orgId = input?.orgId ?? await requireOrgId(ctx.user.id);
        return getCategoriesByOrg(orgId);
      }),
    create: protectedProcedure
      .input(z.object({ orgId: z.number().optional(), name: z.string(), slug: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const orgId = input.orgId ?? await requireOrgId(ctx.user.id);
        const slug = input.slug ?? input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        return createCategory({ orgId, name: input.name, slug });
      }),
    update: protectedProcedure
      .input(z.object({ id: z.number(), data: z.record(z.string(), z.unknown()) }))
      .mutation(async ({ input }) => {
        return updateCategory(input.id, input.data as any);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteCategory(input.id);
        return { ok: true };
      }),
  }),

  // ── Groups ─────────────────────────────────────────────────────────────────
  groups: router({
    list: protectedProcedure
      .input(z.object({ orgId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const orgId = input?.orgId ?? await requireOrgId(ctx.user.id);
        return getGroupsByOrg(orgId);
      }),
    listManaged: protectedProcedure
      .query(async ({ ctx }) => {
        const orgId = await requireOrgId(ctx.user.id);
        return getGroupsByOrg(orgId);
      }),
    create: protectedProcedure
      .input(z.object({ orgId: z.number().optional(), name: z.string(), seats: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const orgId = input.orgId ?? await requireOrgId(ctx.user.id);
        return createGroup({ orgId, name: input.name, seats: input.seats ?? 10 });
      }),
    update: protectedProcedure
      .input(z.object({ groupId: z.number(), data: z.record(z.string(), z.unknown()) }))
      .mutation(async ({ input }) => {
        return updateGroup(input.groupId, input.data as any);
      }),
    delete: protectedProcedure
      .input(z.object({ groupId: z.number() }))
      .mutation(async ({ input }) => {
        await deleteGroup(input.groupId);
        return { ok: true };
      }),
    addMember: protectedProcedure
      .input(z.object({ groupId: z.number(), email: z.string().email(), name: z.string().optional(), userId: z.number().optional() }))
      .mutation(async ({ input }) => {
        return addGroupMember({ groupId: input.groupId, email: input.email, name: input.name ?? null, userId: input.userId ?? null });
      }),
    removeMember: protectedProcedure
      .input(z.object({ memberId: z.number() }))
      .mutation(async ({ input }) => {
        await removeGroupMember(input.memberId);
        return { ok: true };
      }),
    assignSeat: protectedProcedure
      .input(z.object({ groupId: z.number(), userId: z.number(), orgId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const orgId = input.orgId ?? await requireOrgId(ctx.user.id);
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { lmsGroupSeats } = await import("../drizzle/schema");
        await db.insert(lmsGroupSeats).values({ groupId: input.groupId, userId: input.userId, orgId });
        return { ok: true };
      }),
    revokeSeat: protectedProcedure
      .input(z.object({ seatId: z.number() }))
      .mutation(async ({ input }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { lmsGroupSeats } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        await db.delete(lmsGroupSeats).where(eq(lmsGroupSeats.id, input.seatId));
        return { ok: true };
      }),
    bulkEnroll: protectedProcedure
      .input(z.object({ groupId: z.number(), courseId: z.number(), orgId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const orgId = input.orgId ?? await requireOrgId(ctx.user.id);
        const members = await getGroupMembers(input.groupId);
        const results = [];
        for (const m of members) {
          if (!m.userId) continue;
          const existing = await getEnrollment(input.courseId, m.userId);
          if (!existing) {
            await createEnrollment({ courseId: input.courseId, userId: m.userId, orgId, amountPaid: 0, isActive: true });
            results.push(m.userId);
          }
        }
        return { enrolled: results.length };
      }),
    generateInviteLink: protectedProcedure
      .input(z.object({ groupId: z.number() }))
      .mutation(async ({ input }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { lmsGroups } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const crypto = await import("crypto");
        const token = crypto.randomBytes(24).toString("hex");
        await db.update(lmsGroups).set({ inviteToken: token } as any).where(eq(lmsGroups.id, input.groupId));
        return { token };
      }),
    joinByInvite: publicProcedure
      .input(z.object({ token: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { lmsGroups, lmsGroupSeats } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const [group] = await db.select().from(lmsGroups).where(eq((lmsGroups as any).inviteToken, input.token)).limit(1);
        if (!group) throw new TRPCError({ code: "NOT_FOUND", message: "Invalid invite link" });
        const userId = (ctx as any).user?.id;
        if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });
        const existing = await db.select().from(lmsGroupSeats).where(eq(lmsGroupSeats.groupId, group.id)).then((rows: any[]) => rows.find((r: any) => r.userId === userId));
        if (existing) return { ok: true, groupId: group.id, alreadyMember: true };
        const usedSeats = await db.select().from(lmsGroupSeats).where(eq(lmsGroupSeats.groupId, group.id)).then((r: any[]) => r.length);
        if (group.seats && usedSeats >= group.seats) throw new TRPCError({ code: "FORBIDDEN", message: "This group is full" });
        await db.insert(lmsGroupSeats).values({ groupId: group.id, userId, email: null, name: null, role: "member" } as any);
        return { ok: true, groupId: group.id, alreadyMember: false };
      }),
    bulkImportCSV: protectedProcedure
      .input(z.object({
        groupId: z.number(),
        rows: z.array(z.object({ email: z.string().email(), name: z.string().optional() })),
      }))
      .mutation(async ({ input }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { lmsGroupSeats, users } = await import("../drizzle/schema");
        const { eq, inArray } = await import("drizzle-orm");
        const emails = input.rows.map((r: any) => r.email.toLowerCase());
        const existingUsers = await db.select({ id: users.id, email: users.email }).from(users).where(inArray(users.email, emails));
        const userByEmail = Object.fromEntries(existingUsers.map((u: any) => [u.email.toLowerCase(), u.id]));
        const existing = await db.select({ email: lmsGroupSeats.email }).from(lmsGroupSeats).where(eq(lmsGroupSeats.groupId, input.groupId));
        const existingEmails = new Set(existing.map((r: any) => r.email?.toLowerCase()).filter(Boolean));
        let added = 0; let skipped = 0;
        for (const row of input.rows) {
          const email = row.email.toLowerCase();
          if (existingEmails.has(email)) { skipped++; continue; }
          const userId = (userByEmail as any)[email] ?? null;
          await db.insert(lmsGroupSeats).values({ groupId: input.groupId, userId, email: row.email, name: row.name ?? null, role: "member" } as any);
          added++;
        }
        return { added, skipped };
      }),
  }),

  // ── Discussions ────────────────────────────────────────────────────────────
  discussions: router({
    list: protectedProcedure
      .input(z.object({ orgId: z.number().optional(), courseId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const orgId = input?.orgId ?? await requireOrgId(ctx.user.id);
        return getDiscussionsByOrg(orgId, input?.courseId);
      }),
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const d = await getDiscussionById(input.id);
        if (!d) throw new TRPCError({ code: "NOT_FOUND" });
        const replies = await getRepliesByDiscussion(input.id);
        return { ...d, replies };
      }),
    create: protectedProcedure
      .input(z.object({ orgId: z.number().optional(), courseId: z.number().optional(), title: z.string(), body: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const orgId = input.orgId ?? await requireOrgId(ctx.user.id);
        return createDiscussion({ orgId, courseId: input.courseId ?? null, title: input.title, body: input.body ?? null, authorId: ctx.user.id });
      }),
    update: protectedProcedure
      .input(z.object({ id: z.number(), data: z.record(z.string(), z.unknown()) }))
      .mutation(async ({ input }) => {
        return updateDiscussion(input.id, input.data as any);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteDiscussion(input.id);
        return { ok: true };
      }),
    reply: protectedProcedure
      .input(z.object({ discussionId: z.number(), body: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return createDiscussionReply({ discussionId: input.discussionId, body: input.body, authorId: ctx.user.id });
      }),
  }),

  // ── Assignments ────────────────────────────────────────────────────────────
  assignments: router({
    list: protectedProcedure
      .input(z.object({ orgId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const orgId = input?.orgId ?? await requireOrgId(ctx.user.id);
        return getAssignmentsByOrg(orgId);
      }),
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const a = await getAssignmentById(input.id);
        if (!a) throw new TRPCError({ code: "NOT_FOUND" });
        return a;
      }),
    create: protectedProcedure
      .input(z.object({ orgId: z.number().optional(), courseId: z.number().optional(), title: z.string(), description: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const orgId = input.orgId ?? await requireOrgId(ctx.user.id);
        return createAssignment({ orgId, courseId: input.courseId ?? null, title: input.title, description: input.description ?? null });
      }),
    update: protectedProcedure
      .input(z.object({ id: z.number(), data: z.record(z.string(), z.unknown()) }))
      .mutation(async ({ input }) => {
        return updateAssignment(input.id, input.data as any);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteAssignment(input.id);
        return { ok: true };
      }),
    submissions: protectedProcedure
      .input(z.object({ assignmentId: z.number() }))
      .query(async ({ input }) => {
        return getSubmissionsByAssignment(input.assignmentId);
      }),
  }),

  // ── Notes ──────────────────────────────────────────────────────────────────
  notes: router({
    byLesson: protectedProcedure
      .input(z.object({ lessonId: z.number() }))
      .query(async ({ ctx, input }) => {
        return getNotesByLesson(ctx.user.id, input.lessonId);
      }),
    byCourse: protectedProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ ctx, input }) => {
        return getNotesByCourse(ctx.user.id, input.courseId);
      }),
    create: protectedProcedure
      .input(z.object({ lessonId: z.number(), courseId: z.number(), enrollmentId: z.number(), content: z.string(), videoTimestamp: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        return createNote({ userId: ctx.user.id, lessonId: input.lessonId, courseId: input.courseId, enrollmentId: input.enrollmentId, content: input.content, videoTimestamp: input.videoTimestamp });
      }),
    update: protectedProcedure
      .input(z.object({ id: z.number(), content: z.string() }))
      .mutation(async ({ input }) => {
        return updateNote(input.id, input.content);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteNote(input.id);
        return { ok: true };
      }),
  }),

  // ── Bookmarks ──────────────────────────────────────────────────────────────
  bookmarks: router({
    byCourse: protectedProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ ctx, input }) => {
        return getBookmarksByCourse(ctx.user.id, input.courseId);
      }),
    create: protectedProcedure
      .input(z.object({ lessonId: z.number(), courseId: z.number(), enrollmentId: z.number(), label: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const existing = await getBookmark(ctx.user.id, input.lessonId);
        if (existing) return existing;
        return createBookmark({ userId: ctx.user.id, lessonId: input.lessonId, courseId: input.courseId, enrollmentId: input.enrollmentId, label: input.label });
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteBookmark(input.id);
        return { ok: true };
      }),
  }),

  // ── Dashboard ──────────────────────────────────────────────────────────────
  dashboard: router({
    metrics: protectedProcedure
      .input(z.object({ orgId: z.number().optional(), days: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const orgId = input?.orgId ?? await requireOrgId(ctx.user.id);
        return getDashboardMetrics(orgId, input?.days ?? 30);
      }),
    chartData: protectedProcedure
      .input(z.object({ orgId: z.number().optional(), days: z.number().optional(), groupBy: z.enum(["day", "week", "month"]).optional() }).optional())
      .query(async ({ ctx, input }) => {
        const orgId = input?.orgId ?? await requireOrgId(ctx.user.id);
        return getRevenueChartData(orgId, input?.days ?? 30, input?.groupBy ?? "day");
      }),
    recentActivity: protectedProcedure
      .input(z.object({ orgId: z.number().optional(), limit: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const orgId = input?.orgId ?? await requireOrgId(ctx.user.id);
        return getRecentActivity(orgId, input?.limit ?? 20);
      }),
    recentCourses: protectedProcedure
      .input(z.object({ orgId: z.number().optional(), limit: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const orgId = input?.orgId ?? await requireOrgId(ctx.user.id);
        return getRecentlyEditedCourses(orgId, input?.limit ?? 6);
      }),
    enrolledCourses: protectedProcedure
      .query(async ({ ctx }) => {
        return getEnrolledCoursesForUser(ctx.user.id);
      }),
  }),

  // ── Analytics ──────────────────────────────────────────────────────────────
  analytics: router({
    overview: protectedProcedure
      .input(z.object({ orgId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const orgId = input?.orgId ?? await requireOrgId(ctx.user.id);
        return getLmsAnalyticsByOrg(orgId);
      }),
    byGroup: protectedProcedure
      .input(z.object({ orgId: z.number().optional(), groupId: z.number().optional(), dateFrom: z.date().optional(), dateTo: z.date().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const orgId = input?.orgId ?? await requireOrgId(ctx.user.id);
        return getOrgAnalyticsByGroup(orgId, { groupId: input?.groupId, dateFrom: input?.dateFrom, dateTo: input?.dateTo });
      }),
    courses: protectedProcedure
      .input(z.object({ orgId: z.number().optional(), dateFrom: z.date().optional(), dateTo: z.date().optional(), groupBy: z.enum(["day", "week", "month"]).optional() }).optional())
      .query(async ({ ctx, input }) => {
        const orgId = input?.orgId ?? await requireOrgId(ctx.user.id);
        return getOrgCourseAnalytics(orgId, { dateFrom: input?.dateFrom, dateTo: input?.dateTo, groupBy: input?.groupBy });
      }),
  }),

  // ── Activity ───────────────────────────────────────────────────────────────
  activity: router({
    log: protectedProcedure
      .input(z.object({
        orgId: z.number().optional(),
        events: z.array(z.object({
          eventType: z.string(),
          courseId: z.number().optional(),
          lessonId: z.number().optional(),
          durationMs: z.number().optional(),
          metadata: z.record(z.string(), z.unknown()).optional(),
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        const orgId = input.orgId ?? await requireOrgId(ctx.user.id);
        await insertActivityEvents(input.events.map(e => ({
          orgId,
          userId: ctx.user.id,
          eventType: e.eventType as any,
          courseId: e.courseId ?? null,
          lessonId: e.lessonId ?? null,
          durationMs: e.durationMs ?? null,
          metadata: e.metadata ? JSON.stringify(e.metadata) : null,
        })));
        return { ok: true };
      }),
    list: protectedProcedure
      .input(z.object({ orgId: z.number().optional(), userId: z.number().optional(), courseId: z.number().optional(), limit: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const orgId = input?.orgId ?? await requireOrgId(ctx.user.id);
        return getActivityEventsByOrg(orgId, { userId: input?.userId, courseId: input?.courseId, limit: input?.limit });
      }),
  }),

  // ── Coupons ────────────────────────────────────────────────────────────────
  coupons: router({
    list: protectedProcedure
      .input(z.object({ orgId: z.number().optional(), includeInactive: z.boolean().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const orgId = input?.orgId ?? await requireOrgId(ctx.user.id);
        return getCouponsByOrg(orgId, input?.includeInactive ?? false);
      }),
    create: protectedProcedure
      .input(z.object({
        orgId: z.number().optional(),
        code: z.string().min(1).max(64),
        discountType: z.enum(["percentage", "fixed"]),
        discountValue: z.number().positive(),
        maxUses: z.number().int().positive().nullable().optional(),
        expiresAt: z.date().nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const orgId = input.orgId ?? await requireOrgId(ctx.user.id);
        await requireOrgAdmin(ctx.user.id, ctx.user.role, orgId);
        return createCoupon({
          orgId,
          code: input.code.trim().toUpperCase(),
          discountType: input.discountType,
          discountValue: input.discountValue,
          maxUses: input.maxUses ?? null,
          expiresAt: input.expiresAt ?? null,
          isActive: true,
        });
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        orgId: z.number().optional(),
        code: z.string().min(1).max(64).optional(),
        discountType: z.enum(["percentage", "fixed"]).optional(),
        discountValue: z.number().positive().optional(),
        maxUses: z.number().int().positive().nullable().optional(),
        expiresAt: z.date().nullable().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const orgId = input.orgId ?? await requireOrgId(ctx.user.id);
        await requireOrgAdmin(ctx.user.id, ctx.user.role, orgId);
        const { id, orgId: _orgId, ...data } = input;
        const updateData = {
          ...data,
          code: data.code ? data.code.trim().toUpperCase() : undefined,
        };
        return updateCoupon(id, updateData);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number(), orgId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const orgId = input.orgId ?? await requireOrgId(ctx.user.id);
        await requireOrgAdmin(ctx.user.id, ctx.user.role, orgId);
        await updateCoupon(input.id, { isActive: false });
        return { success: true };
      }),
  }),

  // ── Notifications ──────────────────────────────────────────────────────────
  notifications: router({
    getOrgSettings: protectedProcedure
      .input(z.object({ orgId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const orgId = input?.orgId ?? await requireOrgId(ctx.user.id);
        return getOrgNotificationSettings(orgId);
      }),
    updateOrgSettings: protectedProcedure
      .input(z.object({
        orgId: z.number().optional(),
        settings: z.object({
          enrollment: z.boolean().optional(),
          completion: z.boolean().optional(),
          quizResult: z.boolean().optional(),
          reminder: z.boolean().optional(),
          announcement: z.boolean().optional(),
          weeklyDigest: z.boolean().optional(),
        }),
      }))
      .mutation(async ({ ctx, input }) => {
        const orgId = input.orgId ?? await requireOrgId(ctx.user.id);
        return updateOrgNotificationSettings(orgId, input.settings);
      }),
  }),

  // ── Revenue Partners ───────────────────────────────────────────────────────
  revenuePartners: router({
    list: protectedProcedure
      .input(z.object({ orgId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const orgId = input?.orgId ?? await requireOrgId(ctx.user.id);
        return getRevenuePartnersByOrg(orgId);
      }),
    create: protectedProcedure
      .input(z.object({ orgId: z.number().optional(), name: z.string(), email: z.string(), shareValue: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const orgId = input.orgId ?? await requireOrgId(ctx.user.id);
        return createRevenuePartner({ orgId, name: input.name, email: input.email, shareValue: input.shareValue ?? 10 });
      }),
    update: protectedProcedure
      .input(z.object({ id: z.number(), data: z.record(z.string(), z.unknown()) }))
      .mutation(async ({ input }) => {
        return updateRevenuePartner(input.id, input.data as any);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteRevenuePartner(input.id);
        return { ok: true };
      }),
  }),

  // ── Course Orders ──────────────────────────────────────────────────────────
  courseOrders: router({
    list: protectedProcedure
      .input(z.object({ orgId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const orgId = input?.orgId ?? await requireOrgId(ctx.user.id);
        return getCourseOrdersByOrg(orgId);
      }),
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return getCourseOrderById(input.id);
      }),
    create: protectedProcedure
      .input(z.object({ orgId: z.number().optional(), userId: z.number().optional(), courseId: z.number().optional(), customerEmail: z.string(), amount: z.number().optional(), status: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const orgId = input.orgId ?? await requireOrgId(ctx.user.id);
        return createCourseOrder({ orgId, userId: input.userId ?? null, courseId: input.courseId ?? null, customerEmail: input.customerEmail, amount: input.amount ?? 0, status: (input.status ?? "pending") as any });
      }),
    update: protectedProcedure
      .input(z.object({ id: z.number(), data: z.record(z.string(), z.unknown()) }))
      .mutation(async ({ input }) => {
        return updateCourseOrder(input.id, input.data as any);
      }),
    stats: protectedProcedure
      .input(z.object({ orgId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const orgId = input?.orgId ?? await requireOrgId(ctx.user.id);
        return getCourseOrderStats(orgId);
      }),
  }),

  // ── Memberships ────────────────────────────────────────────────────────────
  memberships: router({
    list: protectedProcedure
      .input(z.object({ orgId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const orgId = input?.orgId ?? await requireOrgId(ctx.user.id);
        await requireOrgAdmin(ctx.user.id, ctx.user.role, orgId);
        return getMembershipsByOrg(orgId);
      }),
    create: protectedProcedure
      .input(z.object({ orgId: z.number().optional(), name: z.string(), price: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const orgId = input.orgId ?? await requireOrgId(ctx.user.id);
        await requireOrgAdmin(ctx.user.id, ctx.user.role, orgId);
        return createMembership({ orgId, name: input.name, price: input.price ?? 0, courseIds: "[]" });
      }),
    update: protectedProcedure
      .input(z.object({ id: z.number(), data: z.record(z.string(), z.unknown()) }))
      .mutation(async ({ ctx, input }) => {
        await requireLegacyMembershipAccess(ctx, input.id);
        return updateMembership(input.id, input.data as any);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await requireLegacyMembershipAccess(ctx, input.id);
        await deleteMembership(input.id);
        return { ok: true };
      }),
    getMembers: protectedProcedure
      .input(z.object({ membershipId: z.number() }))
      .query(async ({ ctx, input }) => {
        await requireLegacyMembershipAccess(ctx, input.membershipId);
        return getMembershipMembers(input.membershipId);
      }),
    addMember: protectedProcedure
      .input(z.object({ membershipId: z.number(), userId: z.number(), status: z.enum(["active", "paused", "cancelled", "expired"]).optional() }))
      .mutation(async ({ ctx, input }) => {
        await requireLegacyMembershipAccess(ctx, input.membershipId);
        return addMembershipMember({ membershipId: input.membershipId, userId: input.userId, status: input.status ?? "active" });
      }),
    updateMember: protectedProcedure
      .input(z.object({ id: z.number(), data: z.record(z.string(), z.unknown()) }))
      .mutation(async ({ ctx, input }) => {
        const membershipId = await getMembershipIdByMemberRecordId(input.id);
        if (!membershipId) throw new TRPCError({ code: "NOT_FOUND", message: "Membership member not found" });
        await requireLegacyMembershipAccess(ctx, membershipId);
        await updateMembershipMember(input.id, input.data as any);
        return { ok: true };
      }),
    removeMember: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const membershipId = await getMembershipIdByMemberRecordId(input.id);
        if (!membershipId) throw new TRPCError({ code: "NOT_FOUND", message: "Membership member not found" });
        await requireLegacyMembershipAccess(ctx, membershipId);
        await removeMembershipMember(input.id);
        return { ok: true };
      }),
    getContent: protectedProcedure
      .input(z.object({ membershipId: z.number() }))
      .query(async ({ ctx, input }) => {
        await requireLegacyMembershipAccess(ctx, input.membershipId);
        return getMembershipContentItems(input.membershipId);
      }),
    addContent: protectedProcedure
      .input(z.object({ membershipId: z.number(), contentType: z.enum(["course", "digital_product", "community", "webinar"]), contentId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await requireLegacyMembershipAccess(ctx, input.membershipId);
        return addMembershipContent(input);
      }),
    removeContent: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const membershipId = await getMembershipIdByContentRecordId(input.id);
        if (!membershipId) throw new TRPCError({ code: "NOT_FOUND", message: "Membership content item not found" });
        await requireLegacyMembershipAccess(ctx, membershipId);
        await removeMembershipContent(input.id);
        return { ok: true };
      }),
    getRules: protectedProcedure
      .input(z.object({ membershipId: z.number() }))
      .query(async ({ ctx, input }) => {
        await requireLegacyMembershipAccess(ctx, input.membershipId);
        return getMembershipRules(input.membershipId);
      }),
    addRule: protectedProcedure
      .input(z.object({ membershipId: z.number(), triggerType: z.string(), triggerEntityId: z.number().optional(), triggerTag: z.string().optional(), action: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        await requireLegacyMembershipAccess(ctx, input.membershipId);
        return addMembershipRule(input as any);
      }),
    updateRule: protectedProcedure
      .input(z.object({ id: z.number(), data: z.record(z.string(), z.unknown()) }))
      .mutation(async ({ ctx, input }) => {
        const membershipId = await getMembershipIdByRuleRecordId(input.id);
        if (!membershipId) throw new TRPCError({ code: "NOT_FOUND", message: "Membership rule not found" });
        await requireLegacyMembershipAccess(ctx, membershipId);
        await updateMembershipRule(input.id, input.data as any);
        return { ok: true };
      }),
    removeRule: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const membershipId = await getMembershipIdByRuleRecordId(input.id);
        if (!membershipId) throw new TRPCError({ code: "NOT_FOUND", message: "Membership rule not found" });
        await requireLegacyMembershipAccess(ctx, membershipId);
        await removeMembershipRule(input.id);
        return { ok: true };
      }),
  }),

  // ── Bundles ────────────────────────────────────────────────────────────────
  bundles: router({
    list: protectedProcedure
      .input(z.object({ orgId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const orgId = input?.orgId ?? await requireOrgId(ctx.user.id);
        await requireOrgAdmin(ctx.user.id, ctx.user.role, orgId);
        return getBundlesByOrg(orgId);
      }),
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        await requireLegacyBundleAccess(ctx, input.id);
        return getBundleById(input.id);
      }),
    create: protectedProcedure
      .input(z.object({ orgId: z.number().optional(), name: z.string(), description: z.string().optional(), price: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const orgId = input.orgId ?? await requireOrgId(ctx.user.id);
        await requireOrgAdmin(ctx.user.id, ctx.user.role, orgId);
        return createBundle({ orgId, name: input.name, description: input.description ?? null, price: input.price ?? 0, courseIds: "[]" });
      }),
    update: protectedProcedure
      .input(z.object({ id: z.number(), data: z.record(z.string(), z.unknown()) }))
      .mutation(async ({ ctx, input }) => {
        await requireLegacyBundleAccess(ctx, input.id);
        return updateBundle(input.id, input.data as any);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await requireLegacyBundleAccess(ctx, input.id);
        await deleteBundle(input.id);
        return { ok: true };
      }),
  }),

  // ── Flashcards ─────────────────────────────────────────────────────────────
  flashcards: router({
    listDecks: protectedProcedure
      .input(z.object({ orgId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const orgId = input?.orgId ?? await requireOrgId(ctx.user.id);
        await requireOrgAdmin(ctx.user.id, ctx.user.role, orgId);
        return getFlashcardDecksByOrg(orgId);
      }),
    createDeck: protectedProcedure
      .input(z.object({ orgId: z.number().optional(), title: z.string(), description: z.string().optional(), category: z.string().optional(), isPublic: z.boolean().optional() }))
      .mutation(async ({ ctx, input }) => {
        const orgId = input.orgId ?? await requireOrgId(ctx.user.id);
        await requireOrgAdmin(ctx.user.id, ctx.user.role, orgId);
        return createFlashcardDeck({ orgId, title: input.title, description: input.description, category: input.category, isPublic: input.isPublic, createdBy: ctx.user.id });
      }),
    deleteDeck: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await requireLegacyFlashcardDeckAccess(ctx, input.id);
        await deleteFlashcardDeck(input.id);
        return { ok: true };
      }),
    getCards: protectedProcedure
      .input(z.object({ deckId: z.number() }))
      .query(async ({ ctx, input }) => {
        await requireLegacyFlashcardDeckAccess(ctx, input.deckId);
        return getCardsByDeck(input.deckId);
      }),
    saveCards: protectedProcedure
      .input(z.object({ deckId: z.number(), cards: z.array(z.object({ front: z.string(), back: z.string(), frontImageUrl: z.string().optional(), backImageUrl: z.string().optional(), sortOrder: z.number() })) }))
      .mutation(async ({ ctx, input }) => {
        await requireLegacyFlashcardDeckAccess(ctx, input.deckId);
        await bulkUpsertCards(input.deckId, input.cards);
        return { ok: true };
      }),
    generateAI: protectedProcedure
      .input(z.object({ topic: z.string(), count: z.number().optional() }))
      .mutation(async ({ input }) => {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "Generate flashcards as a JSON array of {front, back} objects. Return only valid JSON." },
            { role: "user", content: `Create ${input.count ?? 10} flashcards about: ${input.topic}` },
          ],
        });
        const content = (response.choices[0]?.message?.content ?? "[]") as string;
        try { return { cards: JSON.parse(content) }; }
        catch { return { cards: [] }; }
      }),
  }),

  // ── Media ──────────────────────────────────────────────────────────────────
  media: router({
    getUploadUrl: protectedProcedure
      .input(z.object({ orgId: z.number().optional(), fileName: z.string(), mimeType: z.string().optional(), contentType: z.string().optional(), folder: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const orgId = input.orgId ?? await requireOrgId(ctx.user.id);
        await requireOrgAdmin(ctx.user.id, ctx.user.role, orgId);
        const mimeType = input.mimeType ?? input.contentType ?? "application/octet-stream";
        const folder = input.folder ?? "media";
        const ext = input.fileName.split(".").pop() ?? "bin";
        const key = `org-${orgId}/${folder}/${nanoid(12)}.${ext}`;
        const result = await storagePresignedPut(key, mimeType);
        return { ...result, fileUrl: result.fileUrl || result.uploadUrl, orgId, folder };
      }),
    listOrgMedia: protectedProcedure
      .input(z.object({ orgId: z.number().optional(), folderId: z.number().optional(), mimeType: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const orgId = input?.orgId ?? await requireOrgId(ctx.user.id);
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) return [];
        const { orgMediaLibrary } = await import("../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        const conditions: any[] = [eq(orgMediaLibrary.orgId, orgId)];
        if (input?.folderId !== undefined) conditions.push(eq(orgMediaLibrary.folderId, input.folderId));
        return db.select().from(orgMediaLibrary).where(and(...conditions));
      }),
    saveMediaItem: protectedProcedure
      .input(z.object({
        orgId: z.number().optional(),
        // Accept both casing variants from different callers
        filename: z.string().optional(),
        fileName: z.string().optional(),
        mimeType: z.string(),
        fileSize: z.number(),
        fileKey: z.string(),
        url: z.string(),
        folderId: z.number().optional(),
        altText: z.string().optional(),
        source: z.enum(["form", "course", "direct", "other"]).optional(),
        durationSeconds: z.number().optional(),
        tags: z.array(z.string()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const orgId = input.orgId ?? await requireOrgId(ctx.user.id);
        await requireOrgAdmin(ctx.user.id, ctx.user.role, orgId);
        const resolvedFilename = input.filename ?? input.fileName ?? "untitled";
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { orgMediaLibrary } = await import("../drizzle/schema");
        const [result] = await db.insert(orgMediaLibrary).values({
          orgId,
          uploadedBy: ctx.user.id,
          filename: resolvedFilename,
          mimeType: input.mimeType,
          fileSize: input.fileSize,
          fileKey: input.fileKey,
          url: input.url,
          folderId: input.folderId ?? null,
          altText: input.altText ?? null,
          source: input.source ?? "direct",
          durationSeconds: input.durationSeconds ?? null,
          tags: input.tags ? JSON.stringify(input.tags) : null,
        }).$returningId();
        return { ok: true, id: result.id };
      }),
    // Import a video from an external URL (YouTube, Facebook, LinkedIn, direct .mp4)
    importFromUrl: protectedProcedure
      .input(z.object({
        orgId: z.number(),
        url: z.string().url(),
        folderId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await requireOrgAdmin(ctx.user.id, ctx.user.role, input.orgId);
        const db = await (await import("./db")).getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

        console.log(`[importFromUrl] User ${ctx.user.id} importing from: ${input.url}`);
        let scraped;
        try {
          scraped = await scrapeVideoFromUrl(input.url);
        } catch (err: any) {
          console.error(`[importFromUrl] Scrape failed:`, err.message);
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: err.message || "Failed to extract video from URL",
          });
        }

        try {
          const suffix = `${Date.now()}-${nanoid(6)}`;
          const safeFileName = scraped.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
          const fileKey = `lms-media/${input.orgId}/${suffix}-${safeFileName}`;

          const { url: s3Url } = await storagePutStream(fileKey, scraped.filePath, scraped.mimeType);

          const { orgMediaLibrary } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          const [result] = await db.insert(orgMediaLibrary).values({
            orgId: input.orgId,
            uploadedBy: ctx.user.id,
            filename: scraped.title || scraped.fileName,
            mimeType: scraped.mimeType,
            fileSize: scraped.fileSize,
            fileKey,
            url: s3Url,
            durationSeconds: scraped.durationSeconds ?? null,
            source: "direct",
            tags: JSON.stringify(["import", "url-import"]),
            folderId: input.folderId ?? null,
          });

          const id = (result as any).insertId as number;
          const rows = await db.select().from(orgMediaLibrary).where(eq(orgMediaLibrary.id, id)).limit(1);
          console.log(`[importFromUrl] Success — mediaId=${id}, size=${(scraped.fileSize / 1024 / 1024).toFixed(1)}MB`);
          return rows[0];
        } finally {
          await cleanupScrapedVideo(scraped.filePath);
        }
      }),
    deleteOrgMedia: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { orgMediaLibrary } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const [mediaItem] = await db.select().from(orgMediaLibrary).where(eq(orgMediaLibrary.id, input.id)).limit(1);
        if (!mediaItem) throw new TRPCError({ code: "NOT_FOUND", message: "Media item not found" });
        await requireOrgAdmin(ctx.user.id, ctx.user.role, mediaItem.orgId);
        await db.delete(orgMediaLibrary).where(eq(orgMediaLibrary.id, input.id));
        return { ok: true };
      }),
    renameOrgMedia: protectedProcedure
      .input(z.object({ id: z.number(), filename: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { orgMediaLibrary } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const [mediaItem] = await db.select().from(orgMediaLibrary).where(eq(orgMediaLibrary.id, input.id)).limit(1);
        if (!mediaItem) throw new TRPCError({ code: "NOT_FOUND", message: "Media item not found" });
        await requireOrgAdmin(ctx.user.id, ctx.user.role, mediaItem.orgId);
        await db.update(orgMediaLibrary).set({ filename: input.filename }).where(eq(orgMediaLibrary.id, input.id));
        return { ok: true };
      }),
    bulkDelete: protectedProcedure
      .input(z.object({ ids: z.array(z.number()) }))
      .mutation(async ({ input, ctx }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { orgMediaLibrary } = await import("../drizzle/schema");
        const { inArray } = await import("drizzle-orm");
        const mediaItems = await db.select().from(orgMediaLibrary).where(inArray(orgMediaLibrary.id, input.ids));
        if (mediaItems.length !== input.ids.length) throw new TRPCError({ code: "NOT_FOUND", message: "One or more media items were not found" });
        await Promise.all([...new Set(mediaItems.map((item) => item.orgId))].map((orgId) => requireOrgAdmin(ctx.user.id, ctx.user.role, orgId)));
        await db.delete(orgMediaLibrary).where(inArray(orgMediaLibrary.id, input.ids));
        return { ok: true };
      }),
    bulkMoveToFolder: protectedProcedure
      .input(z.object({ ids: z.array(z.number()), folderId: z.number().nullable() }))
      .mutation(async ({ input, ctx }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { orgMediaLibrary } = await import("../drizzle/schema");
        const { inArray } = await import("drizzle-orm");
        const mediaItems = await db.select().from(orgMediaLibrary).where(inArray(orgMediaLibrary.id, input.ids));
        if (mediaItems.length !== input.ids.length) throw new TRPCError({ code: "NOT_FOUND", message: "One or more media items were not found" });
        await Promise.all([...new Set(mediaItems.map((item) => item.orgId))].map((orgId) => requireOrgAdmin(ctx.user.id, ctx.user.role, orgId)));
        await db.update(orgMediaLibrary).set({ folderId: input.folderId }).where(inArray(orgMediaLibrary.id, input.ids));
        return { ok: true };
      }),
    listFolders: protectedProcedure
      .input(z.object({ orgId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const orgId = input?.orgId ?? await requireOrgId(ctx.user.id);
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) return [];
        const { mediaFolders } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        return db.select().from(mediaFolders).where(eq(mediaFolders.orgId, orgId));
      }),
    createFolder: protectedProcedure
      .input(z.object({ orgId: z.number().optional(), name: z.string(), parentFolderId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const orgId = input.orgId ?? await requireOrgId(ctx.user.id);
        await requireOrgAdmin(ctx.user.id, ctx.user.role, orgId);
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { mediaFolders } = await import("../drizzle/schema");
        await db.insert(mediaFolders).values({ orgId, name: input.name, parentFolderId: input.parentFolderId ?? null });
        return { ok: true };
      }),
    deleteFolder: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { mediaFolders } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const [folder] = await db.select().from(mediaFolders).where(eq(mediaFolders.id, input.id)).limit(1);
        if (!folder) throw new TRPCError({ code: "NOT_FOUND", message: "Media folder not found" });
        await requireOrgAdmin(ctx.user.id, ctx.user.role, folder.orgId);
        await db.delete(mediaFolders).where(eq(mediaFolders.id, input.id));
        return { ok: true };
      }),
    renameFolder: protectedProcedure
      .input(z.object({ id: z.number(), name: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { mediaFolders } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const [folder] = await db.select().from(mediaFolders).where(eq(mediaFolders.id, input.id)).limit(1);
        if (!folder) throw new TRPCError({ code: "NOT_FOUND", message: "Media folder not found" });
        await requireOrgAdmin(ctx.user.id, ctx.user.role, folder.orgId);
        await db.update(mediaFolders).set({ name: input.name }).where(eq(mediaFolders.id, input.id));
        return { ok: true };
      }),
    listClips: protectedProcedure
      .input(z.object({ mediaItemId: z.number(), orgId: z.number().optional() }))
      .query(async ({ input, ctx }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) return [];
        const { videoClips, orgMediaLibrary } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const [mediaItem] = await db.select().from(orgMediaLibrary).where(eq(orgMediaLibrary.id, input.mediaItemId)).limit(1);
        if (!mediaItem) throw new TRPCError({ code: "NOT_FOUND", message: "Media item not found" });
        await requireOrgAdmin(ctx.user.id, ctx.user.role, mediaItem.orgId);
        return db.select().from(videoClips).where(eq(videoClips.mediaItemId, input.mediaItemId));
      }),
    saveClip: protectedProcedure
      .input(z.object({
        mediaItemId: z.number(),
        orgId: z.number().optional(),
        label: z.string(),
        // Accept both naming conventions from frontend
        startSec: z.number().optional(),
        endSec: z.number().optional(),
        startSeconds: z.number().optional(),
        endSeconds: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const startSec = input.startSec ?? input.startSeconds ?? 0;
        const endSec = input.endSec ?? input.endSeconds ?? 0;
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { videoClips, orgMediaLibrary } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const [mediaItem] = await db.select().from(orgMediaLibrary).where(eq(orgMediaLibrary.id, input.mediaItemId)).limit(1);
        if (!mediaItem) throw new TRPCError({ code: "NOT_FOUND", message: "Media item not found" });
        await requireOrgAdmin(ctx.user.id, ctx.user.role, mediaItem.orgId);
        const [result] = await db.insert(videoClips).values({
          mediaItemId: input.mediaItemId,
          label: input.label,
          startSec,
          endSec,
          orgId: mediaItem.orgId,
          createdBy: ctx.user.id,
        }).$returningId();
        return { ok: true, id: result.id };
      }),
    extractClip: protectedProcedure
      .input(z.object({
        mediaItemId: z.number(),
        orgId: z.number().optional(),
        clipId: z.number().optional(),
        label: z.string().optional(),
        startSec: z.number().optional(),
        endSec: z.number().optional(),
        startSeconds: z.number().optional(),
        endSeconds: z.number().optional(),
        sourceUrl: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Server-side clip extraction is not supported (requires ffmpeg).
        // Return the source URL so the frontend can download the full video.
        // The frontend will handle trimming client-side or the user can download.
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { orgMediaLibrary } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const [mediaItem] = await db.select().from(orgMediaLibrary).where(eq(orgMediaLibrary.id, input.mediaItemId)).limit(1);
        if (!mediaItem) throw new TRPCError({ code: "NOT_FOUND", message: "Media item not found" });
        await requireOrgAdmin(ctx.user.id, ctx.user.role, mediaItem.orgId);
        const sourceUrl = input.sourceUrl ?? "";
        if (!sourceUrl) throw new TRPCError({ code: "BAD_REQUEST", message: "No source URL provided for clip extraction" });
        return { ok: true, url: sourceUrl };
      }),
    deleteClip: protectedProcedure
      .input(z.object({ id: z.number(), orgId: z.number().optional() }))
      .mutation(async ({ input, ctx }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { videoClips } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const [clip] = await db.select().from(videoClips).where(eq(videoClips.id, input.id)).limit(1);
        if (!clip) throw new TRPCError({ code: "NOT_FOUND", message: "Video clip not found" });
        await requireOrgAdmin(ctx.user.id, ctx.user.role, clip.orgId);
        await db.delete(videoClips).where(eq(videoClips.id, input.id));
        return { ok: true };
      }),
    generateCaptions: protectedProcedure
      .input(z.object({ mediaItemId: z.number(), orgId: z.number().optional(), fileUrl: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { orgMediaLibrary } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const [mediaItem] = await db.select().from(orgMediaLibrary).where(eq(orgMediaLibrary.id, input.mediaItemId)).limit(1);
        if (!mediaItem) throw new TRPCError({ code: "NOT_FOUND", message: "Media item not found" });
        await requireOrgAdmin(ctx.user.id, ctx.user.role, mediaItem.orgId);
        const audioUrl = input.fileUrl ?? mediaItem.url;
        if (!audioUrl) throw new TRPCError({ code: "BAD_REQUEST", message: "No audio URL available" });
        // Transcribe with word-level timestamps
        const { transcribeAudio } = await import("./_core/voiceTranscription");
        const result = await transcribeAudio({ audioUrl, wordTimestamps: true, prompt: "Transcribe accurately with proper punctuation" });
        if ("error" in result) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error, cause: result.details });
        }
        // Build word-level transcript JSON
        const words = (result.words ?? []).map((w, i) => ({ id: i, word: w.word.trim(), start: w.start, end: w.end }));
        // Build segment-level transcript from Whisper segments
        const segments = result.segments.map((s) => ({ id: s.id, start: s.start, end: s.end, text: s.text.trim() }));
        // Generate VTT from segments
        const vttLines = ["WEBVTT", ""];
        const fmtVtt = (sec: number) => {
          const h = Math.floor(sec / 3600);
          const m = Math.floor((sec % 3600) / 60);
          const s = sec % 60;
          return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${s.toFixed(3).padStart(6, "0")}`;
        };
        for (const seg of segments) {
          vttLines.push(`${fmtVtt(seg.start)} --> ${fmtVtt(seg.end)}`);
          vttLines.push(seg.text);
          vttLines.push("");
        }
        const vttContent = vttLines.join("\n");
        const key = `captions/${input.mediaItemId}-${nanoid(8)}.vtt`;
        const { url: captionsUrl } = await storagePut(key, Buffer.from(vttContent), "text/vtt");
        // Store transcript JSON and captions URL on the media item
        const transcriptJson = JSON.stringify({ words, segments, language: result.language, duration: result.duration });
        await db.update(orgMediaLibrary).set({ captionsUrl, transcriptJson }).where(eq(orgMediaLibrary.id, input.mediaItemId));
        return { ok: true, captionsUrl, segments, words, language: result.language, duration: result.duration };
      }),
    updateCaptions: protectedProcedure
      .input(z.object({
        mediaItemId: z.number(),
        orgId: z.number().optional(),
        captionsVtt: z.string().optional(),
        segments: z.array(z.object({ id: z.number(), start: z.number(), end: z.number(), text: z.string() })).optional(),
        words: z.array(z.object({ id: z.number(), word: z.string(), start: z.number(), end: z.number(), deleted: z.boolean().optional() })).optional(),
        language: z.string().optional(),
        duration: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { orgMediaLibrary } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const [mediaItem] = await db.select().from(orgMediaLibrary).where(eq(orgMediaLibrary.id, input.mediaItemId)).limit(1);
        if (!mediaItem) throw new TRPCError({ code: "NOT_FOUND", message: "Media item not found" });
        await requireOrgAdmin(ctx.user.id, ctx.user.role, mediaItem.orgId);
        const fmtVtt = (sec: number) => {
          const h = Math.floor(sec / 3600);
          const m = Math.floor((sec % 3600) / 60);
          const s = sec % 60;
          return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${s.toFixed(3).padStart(6, "0")}`;
        };
        let vttContent = input.captionsVtt;
        // If segments provided, generate VTT from them (only non-deleted words)
        if (!vttContent && input.segments) {
          const vttLines = ["WEBVTT", ""];
          for (const seg of input.segments) {
            if (!seg.text.trim()) continue;
            vttLines.push(`${fmtVtt(seg.start)} --> ${fmtVtt(seg.end)}`);
            vttLines.push(seg.text);
            vttLines.push("");
          }
          vttContent = vttLines.join("\n");
        }
        if (!vttContent) throw new TRPCError({ code: "BAD_REQUEST", message: "No captions content provided" });
        const key = `captions/${input.mediaItemId}-${nanoid(8)}.vtt`;
        const { url } = await storagePut(key, Buffer.from(vttContent), "text/vtt");
        // Also store transcriptJson if words/segments provided
        const updateData: any = { captionsUrl: url };
        if (input.words || input.segments) {
          updateData.transcriptJson = JSON.stringify({
            words: input.words ?? [],
            segments: input.segments ?? [],
            language: input.language ?? "en",
            duration: input.duration ?? 0,
          });
        }
        await db.update(orgMediaLibrary).set(updateData).where(eq(orgMediaLibrary.id, input.mediaItemId));
        return { ok: true, captionsUrl: url };
      }),
    transcribe: protectedProcedure
      .input(z.object({
        mediaItemId: z.number().optional(),
        orgId: z.number().optional(),
        fileUrl: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Delegate to generateCaptions which handles transcription + VTT generation
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { orgMediaLibrary } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const fallbackOrgId = input.orgId ?? await requireOrgId(ctx.user.id);
        await requireOrgAdmin(ctx.user.id, ctx.user.role, fallbackOrgId);
        let audioUrl = input.fileUrl ?? null;
        if (!audioUrl && input.mediaItemId) {
          const [item] = await db.select().from(orgMediaLibrary).where(eq(orgMediaLibrary.id, input.mediaItemId)).limit(1);
          if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Media item not found" });
          await requireOrgAdmin(ctx.user.id, ctx.user.role, item.orgId);
          audioUrl = item.url;
        }
        if (!audioUrl) throw new TRPCError({ code: "BAD_REQUEST", message: "No audio URL or media item ID provided" });
        const { transcribeAudio } = await import("./_core/voiceTranscription");
        const result = await transcribeAudio({ audioUrl, wordTimestamps: true });
        if ("error" in result) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error });
        const transcript = result.segments?.map((s) => ({ start: s.start, end: s.end, text: s.text.trim() })) ?? [];
        // Build a plain text version for callers that use result.text
        const text = transcript.map((s) => s.text).join(" ");
        return { ok: true, transcript, text };
      }),
    generateSpeech: protectedProcedure
      .input(z.object({
        orgId: z.number().optional(),
        text: z.string().min(1).max(4096),
        voice: z.enum(["alloy", "echo", "fable", "onyx", "nova", "shimmer"]).optional(),
        speed: z.number().min(0.25).max(4.0).optional(),
        fileName: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const orgId = input.orgId ?? await requireOrgId(ctx.user.id);
        await requireOrgAdmin(ctx.user.id, ctx.user.role, orgId);
        const { generateSpeech: tts } = await import("./_core/textToSpeech");
        const { buffer, mimeType } = await tts({
          text: input.text,
          voice: input.voice ?? "nova",
          speed: input.speed ?? 1.0,
        });
        // Upload to S3
        const baseName = (input.fileName ?? `tts-${input.voice ?? "nova"}-${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g, "-");
        const fileName = baseName.endsWith(".mp3") ? baseName : `${baseName}.mp3`;
        const fileKey = `org-${orgId}/tts/${nanoid(12)}-${fileName}`;
        const { url } = await storagePut(fileKey, buffer, mimeType);
        // Save to media library
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { orgMediaLibrary } = await import("../drizzle/schema");
        const [result] = await db.insert(orgMediaLibrary).values({
          orgId,
          uploadedBy: ctx.user.id,
          filename: fileName,
          mimeType,
          fileSize: buffer.byteLength,
          fileKey,
          url,
          source: "direct",
          tags: JSON.stringify(["tts", "audio"]),
        }).$returningId();
        return { ok: true, url, id: result.id, filename: fileName, fileSize: buffer.byteLength };
      }),
    saveRecording: protectedProcedure
      .input(z.object({ orgId: z.number().optional(), url: z.string(), filename: z.string(), mimeType: z.string().optional(), fileSize: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const orgId = input.orgId ?? await requireOrgId(ctx.user.id);
        await requireOrgAdmin(ctx.user.id, ctx.user.role, orgId);
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { orgMediaLibrary } = await import("../drizzle/schema");
        await db.insert(orgMediaLibrary).values({ orgId, uploadedBy: ctx.user.id, filename: input.filename, mimeType: input.mimeType ?? "video/webm", fileSize: input.fileSize ?? 0, fileKey: `recordings/${nanoid(16)}`, url: input.url, source: "direct" });
        return { ok: true };
      }),
  }),

  // ── AI Generation ──────────────────────────────────────────────────────────
  ai: router({
    generateCourseOutline: protectedProcedure
      .input(z.object({ orgId: z.number().optional(), topic: z.string(), targetAudience: z.string().optional(), numSections: z.number().optional() }))
      .mutation(async ({ input, ctx }) => {
        const orgId = input.orgId ?? await requireOrgId(ctx.user.id);
        await requireOrgAdmin(ctx.user.id, ctx.user.role, orgId);
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "You are a curriculum designer. Generate a course outline as JSON with sections and lessons. Return only valid JSON." },
            { role: "user", content: `Create a course outline for: ${input.topic}. Target audience: ${input.targetAudience ?? "general"}. Number of sections: ${input.numSections ?? 5}` },
          ],
        });
        const content = (response.choices[0]?.message?.content ?? "{}") as string;
        try { return JSON.parse(content); }
        catch { return { sections: [] }; }
      }),
    generateLessonContent: protectedProcedure
      .input(z.object({ orgId: z.number().optional(), lessonTitle: z.string(), courseTitle: z.string().optional(), format: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        const orgId = input.orgId ?? await requireOrgId(ctx.user.id);
        await requireOrgAdmin(ctx.user.id, ctx.user.role, orgId);
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "You are an expert educator. Generate lesson content in markdown format." },
            { role: "user", content: `Write lesson content for: "${input.lessonTitle}" in course "${input.courseTitle ?? ""}". Format: ${input.format ?? "text"}` },
          ],
        });
        return { content: (response.choices[0]?.message?.content ?? "") as string };
      }),
  }),

  // ── Copy Course ────────────────────────────────────────────────────────────
  copy: router({
    course: protectedProcedure
      .input(z.object({ courseId: z.number(), orgId: z.number().optional(), newTitle: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const orgId = input.orgId ?? await requireOrgId(ctx.user.id);
        await requireOrgAdmin(ctx.user.id, ctx.user.role, orgId);
        const original = await getCourseById(input.courseId);
        if (!original) throw new TRPCError({ code: "NOT_FOUND" });
        await requireOrgAdmin(ctx.user.id, ctx.user.role, original.orgId!);
        const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = original as any;
        const newTitle = input.newTitle ?? `${original.title} (Copy)`;
        const newSlug = (original as any).slug + "-copy-" + nanoid(6);
        const newCourse = await createCourse({ ...rest, orgId, title: newTitle, slug: newSlug, status: "draft" });
        if (!newCourse) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const sections = await getSectionsByCourse(input.courseId);
        for (const section of sections) {
          const { id: _sid, ...sRest } = section as any;
          const newSection = await createSection({ ...sRest, courseId: newCourse.id });
          if (!newSection) continue;
          const { getDb } = await import("./db");
          const db = await getDb();
          if (!db) continue;
          const { courseLessons } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          const sectionLessons = await db.select().from(courseLessons).where(eq(courseLessons.sectionId, section.id));
          for (const lesson of sectionLessons) {
            const { id: _lid, ...lRest } = lesson as any;
            await createLesson({ ...lRest, courseId: newCourse.id, sectionId: newSection.id });
          }
        }
        return newCourse;
      }),
  }),

  // ── Public School ──────────────────────────────────────────────────────────
  publicSchool: router({
    themeBySlug: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => {
        const org = await getOrgBySlug(input.slug);
        if (!org) throw new TRPCError({ code: "NOT_FOUND" });
        const theme = await getOrgTheme(org.id);
        return {
          ...theme,
          orgName: org.name,
          seoTitle: (org as any).seoTitle ?? null,
          seoDescription: (org as any).seoDescription ?? null,
          seoKeywords: (org as any).seoKeywords ?? null,
          seoOgImage: (org as any).seoOgImage ?? null,
          customCss: (org as any).customCss ?? null,
        };
      }),
    homePageBySlug: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => {
        const org = await getOrgBySlug(input.slug);
        if (!org) throw new TRPCError({ code: "NOT_FOUND" });
        const pages = await getPagesByOrg(org.id);
        const homePage = (pages as any[]).find((p: any) => p.pageType === "home" || p.slug === "home") ?? (pages as any[])[0] ?? null;
        return homePage;
      }),
    coursesBySlug: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => {
        const org = await getOrgBySlug(input.slug);
        if (!org) throw new TRPCError({ code: "NOT_FOUND" });
        const allCourses = await getCoursesByOrg(org.id);
        return (allCourses as any[]).filter((c: any) => c.status === "published");
      }),
  }),

  // ── Register Free Preview ──────────────────────────────────────────────────
  registerFreePreview: protectedProcedure
    .input(z.object({ courseId: z.number(), orgId: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = input.orgId ?? await requireOrgId(ctx.user.id);
      const existing = await getEnrollment(input.courseId, ctx.user.id);
      if (existing) return existing;
      return createEnrollment({ courseId: input.courseId, userId: ctx.user.id, orgId, amountPaid: 0, isActive: true });
    }),

  // ── Upgrade Prompt Checkout ────────────────────────────────────────────────
  upgradePromptCheckout: protectedProcedure
    .input(z.object({ plan: z.string(), orgId: z.number().optional() }))
    .mutation(async () => {
      return { checkoutUrl: null, message: "Please upgrade via the billing page." };
    }),

  // ── Top-level convenience procedures (legacy compat) ────────────────────
  getCourse: publicProcedure
    .input(z.object({ slug: z.string(), orgId: z.number().optional(), preview: z.boolean().optional() }))
    .query(async ({ input }) => {
      if (!input.orgId) {
        const teachOrgId = await getTeachificOrgId();
        if (!teachOrgId) return null;
        return getCourseBySlug(teachOrgId, input.slug);
      }
      return getCourseBySlug(input.orgId, input.slug);
    }),
  listCourses: protectedProcedure
    .input(z.object({ orgId: z.number().optional(), pageSize: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      // Always scope to the user's own org; platform admins fall back to the primary org
      const orgId = input?.orgId ?? await getOrgIdForUserWithFallback(ctx.user.id, ctx.user.role);
      if (!orgId) return { courses: [], total: 0 };
      const all = await getCoursesByOrg(orgId);
      return { courses: all, total: (all as any[]).length };
    }),
  listInstructors: protectedProcedure
    .input(z.object({ orgId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const orgId = input?.orgId ?? await requireOrgId(ctx.user.id);
      return getInstructorsByOrg(orgId);
    }),
  // ── Workshops ─────────────────────────────────────────────────────────────
  workshops: router({
    list: protectedProcedure
      .input(z.object({ orgId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const orgId = input?.orgId ?? await requireOrgId(ctx.user.id);
        await requireOrgAdmin(ctx.user.id, ctx.user.role, orgId);
        return getWorkshopsByOrg(orgId);
      }),
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        return requireLegacyWorkshopAccess(ctx, input.id);
      }),
    create: protectedProcedure
      .input(z.object({
        orgId: z.number().optional(),
        title: z.string().min(1),
        description: z.string().optional(),
        shortDescription: z.string().optional(),
        format: z.enum(["in_person", "virtual", "hybrid"]).optional(),
        location: z.string().optional(),
        virtualUrl: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        timezone: z.string().optional(),
        maxAttendees: z.number().optional(),
        price: z.string().optional(),
        isFree: z.boolean().optional(),
        instructorName: z.string().optional(),
        instructorBio: z.string().optional(),
        instructorImageUrl: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const orgId = input.orgId ?? await requireOrgId(ctx.user.id);
        await requireOrgAdmin(ctx.user.id, ctx.user.role, orgId);
        const slug = input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + nanoid(6);
        return createWorkshop({
          orgId,
          title: input.title,
          slug,
          description: input.description,
          shortDescription: input.shortDescription,
          format: (input.format ?? "in_person") as any,
          location: input.location,
          virtualUrl: input.virtualUrl,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
          timezone: input.timezone ?? "UTC",
          maxAttendees: input.maxAttendees,
          price: input.price ?? "0.00",
          isFree: input.isFree ?? false,
          instructorName: input.instructorName,
          instructorBio: input.instructorBio,
          instructorImageUrl: input.instructorImageUrl,
          status: "draft",
        });
      }),
    update: protectedProcedure
      .input(z.object({ id: z.number() }).passthrough())
      .mutation(async ({ input, ctx }) => {
        await requireLegacyWorkshopAccess(ctx, input.id);
        const { id, ...data } = input;
        const payload: any = { ...data };
        if (payload.startDate) payload.startDate = new Date(payload.startDate);
        if (payload.endDate) payload.endDate = new Date(payload.endDate);
        return updateWorkshop(id, payload);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await requireLegacyWorkshopAccess(ctx, input.id);
        await deleteWorkshop(input.id);
        return { ok: true };
      }),
    getRegistrations: protectedProcedure
      .input(z.object({ workshopId: z.number() }))
      .query(async ({ input, ctx }) => {
        await requireLegacyWorkshopAccess(ctx, input.workshopId);
        return getWorkshopRegistrations(input.workshopId);
      }),
    updateRegistration: protectedProcedure
      .input(z.object({ id: z.number() }).passthrough())
      .mutation(async ({ input, ctx }) => {
        const registration = await getWorkshopRegistrationById(input.id);
        if (!registration) throw new TRPCError({ code: "NOT_FOUND", message: "Workshop registration not found" });
        await requireLegacyWorkshopAccess(ctx, registration.workshopId);
        const { id, ...data } = input;
        await updateWorkshopRegistration(id, data as any);
        return { ok: true };
      }),
    getBySlug: publicProcedure
      .input(z.object({ orgId: z.number(), slug: z.string() }))
      .query(async ({ input }) => {
        return getWorkshopBySlug(input.orgId, input.slug);
      }),
  }),

  // ── Course Announcements ────────────────────────────────────────────────────
  announcements: router({
    list: publicProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ input }) => {
        const { getAnnouncementsByCourse } = await import("./lmsDb");
        return getAnnouncementsByCourse(input.courseId);
      }),
    create: protectedProcedure
      .input(z.object({ orgId: z.number(), courseId: z.number(), title: z.string(), body: z.string().optional(), isPinned: z.boolean().optional(), sendEmail: z.boolean().optional() }))
      .mutation(async ({ input, ctx }) => {
        const { createAnnouncement } = await import("./lmsDb");
        const course = await requireLegacyCourseAccess(ctx, input.courseId);
        if (course.orgId !== input.orgId) throw new TRPCError({ code: "FORBIDDEN", message: "Course does not belong to the requested organization" });
        return createAnnouncement({ ...input, authorId: ctx.user.id });
      }),
    update: protectedProcedure
      .input(z.object({ id: z.number(), title: z.string().optional(), body: z.string().optional(), isPinned: z.boolean().optional() }))
      .mutation(async ({ input, ctx }) => {
        const { getAnnouncementById, updateAnnouncement } = await import("./lmsDb");
        const announcement = await getAnnouncementById(input.id);
        if (!announcement) throw new TRPCError({ code: "NOT_FOUND", message: "Course announcement not found" });
        await requireLegacyCourseAccess(ctx, announcement.courseId);
        const { id, ...data } = input;
        return updateAnnouncement(id, data);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const { getAnnouncementById, deleteAnnouncement } = await import("./lmsDb");
        const announcement = await getAnnouncementById(input.id);
        if (!announcement) throw new TRPCError({ code: "NOT_FOUND", message: "Course announcement not found" });
        await requireLegacyCourseAccess(ctx, announcement.courseId);
        await deleteAnnouncement(input.id);
        return { ok: true };
      }),
  }),

  // ── Course Resources ────────────────────────────────────────────────────────
  resources: router({
    list: publicProcedure
      .input(z.object({ courseId: z.number(), lessonId: z.number().optional() }))
      .query(async ({ input }) => {
        const { getResourcesByCourse } = await import("./lmsDb");
        return getResourcesByCourse(input.courseId, input.lessonId);
      }),
    create: protectedProcedure
      .input(z.object({ orgId: z.number(), courseId: z.number(), lessonId: z.number().optional(), title: z.string(), description: z.string().optional(), fileUrl: z.string().optional(), fileKey: z.string().optional(), fileName: z.string().optional(), fileSize: z.number().optional(), mimeType: z.string().optional(), externalUrl: z.string().optional(), resourceType: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        const { createResource } = await import("./lmsDb");
        const course = await requireLegacyCourseAccess(ctx, input.courseId);
        if (course.orgId !== input.orgId) throw new TRPCError({ code: "FORBIDDEN", message: "Course does not belong to the requested organization" });
        return createResource(input as any);
      }),
    update: protectedProcedure
      .input(z.object({ id: z.number() }).passthrough())
      .mutation(async ({ input, ctx }) => {
        const { getResourceById, updateResource } = await import("./lmsDb");
        const resource = await getResourceById(input.id);
        if (!resource) throw new TRPCError({ code: "NOT_FOUND", message: "Course resource not found" });
        await requireLegacyCourseAccess(ctx, resource.courseId);
        const { id, ...data } = input;
        return updateResource(id, data as any);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const { getResourceById, deleteResource } = await import("./lmsDb");
        const resource = await getResourceById(input.id);
        if (!resource) throw new TRPCError({ code: "NOT_FOUND", message: "Course resource not found" });
        await requireLegacyCourseAccess(ctx, resource.courseId);
        await deleteResource(input.id);
        return { ok: true };
      }),
  }),

  // ── Aliased sub-routers ────────────────────────────────────────────────────
  funnels: funnelRouter,
  downloads: downloadsAdminRouter,
  orderBumps: orderBumpsAdminRouter,
  emailCampaigns: emailCampaignsRouter,
});
