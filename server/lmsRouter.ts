/**
 * lmsRouter — unified LMS tRPC router
 * Exposes all trpc.lms.* procedures consumed by the frontend.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getOrgIdForUser, getOrgBySlug, createManualUser, addOrgMember } from "./db";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
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
  getRevenuePartnersByOrg,
  getRevenuePartnerById,
  createRevenuePartner,
  updateRevenuePartner,
  deleteRevenuePartner,
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
  removeMembershipMember,
  getMembershipContentItems,
  addMembershipContent,
  removeMembershipContent,
  getMembershipRules,
  addMembershipRule,
  updateMembershipRule,
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

// ─── Router ───────────────────────────────────────────────────────────────────
export const lmsRouter = router({

  // ── Courses ────────────────────────────────────────────────────────────────
  courses: router({
    list: protectedProcedure
      .input(z.object({ orgId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const orgId = input?.orgId ?? await requireOrgId(ctx.user.id);
        return getCoursesByOrg(orgId);
      }),
    get: protectedProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ input }) => {
        const course = await getCourseById(input.courseId);
        if (!course) throw new TRPCError({ code: "NOT_FOUND" });
        return course;
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
        const slug = input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + nanoid(6);
        return createCourse({ ...input, orgId, slug });
      }),
    update: protectedProcedure
      .input(z.object({ courseId: z.number(), data: z.record(z.string(), z.unknown()) }))
      .mutation(async ({ input }) => {
        return updateCourse(input.courseId, input.data as any);
      }),
    delete: protectedProcedure
      .input(z.object({ courseId: z.number() }))
      .mutation(async ({ input }) => {
        await deleteCourse(input.courseId);
        return { ok: true };
      }),
    reorder: protectedProcedure
      .input(z.object({ courseIds: z.array(z.number()) }))
      .mutation(async ({ input }) => {
        await reorderCourses(input.courseIds);
        return { ok: true };
      }),
    getThankYouPage: protectedProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ input }) => {
        const course = await getCourseById(input.courseId);
        return { blocks: (course as any)?.thankYouPageBlocks ?? null };
      }),
  }),

  // ── Curriculum ─────────────────────────────────────────────────────────────
  curriculum: router({
    get: protectedProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ input }) => {
        return getFullCurriculum(input.courseId);
      }),
    getLesson: protectedProcedure
      .input(z.object({ lessonId: z.number() }))
      .query(async ({ input }) => {
        const lesson = await getLessonById(input.lessonId);
        if (!lesson) throw new TRPCError({ code: "NOT_FOUND" });
        return lesson;
      }),
    createSection: protectedProcedure
      .input(z.object({ courseId: z.number(), title: z.string().min(1), sortOrder: z.number().optional() }))
      .mutation(async ({ input }) => {
        return createSection({ courseId: input.courseId, title: input.title, sortOrder: input.sortOrder ?? 0 });
      }),
    updateSection: protectedProcedure
      .input(z.object({ sectionId: z.number(), data: z.record(z.string(), z.unknown()) }))
      .mutation(async ({ input }) => {
        return updateSection(input.sectionId, input.data as any);
      }),
    deleteSection: protectedProcedure
      .input(z.object({ sectionId: z.number() }))
      .mutation(async ({ input }) => {
        await deleteSection(input.sectionId);
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
      .mutation(async ({ input }) => {
        return createLesson({
          courseId: input.courseId,
          sectionId: input.sectionId,
          title: input.title,
          lessonType: (input.type ?? "text") as any,
          sortOrder: input.sortOrder ?? 0,
        });
      }),
    updateLesson: protectedProcedure
      .input(z.object({ lessonId: z.number(), data: z.record(z.string(), z.unknown()) }))
      .mutation(async ({ input }) => {
        return updateLesson(input.lessonId, input.data as any);
      }),
    deleteLesson: protectedProcedure
      .input(z.object({ lessonId: z.number() }))
      .mutation(async ({ input }) => {
        await deleteLesson(input.lessonId);
        return { ok: true };
      }),
    reorderLessons: protectedProcedure
      .input(z.object({ lessonIds: z.array(z.number()) }))
      .mutation(async ({ input }) => {
        await reorderLessons(input.lessonIds);
        return { ok: true };
      }),
  }),

  // ── Pricing ────────────────────────────────────────────────────────────────
  pricing: router({
    list: protectedProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ input }) => {
        return getPricingByCourse(input.courseId);
      }),
    create: protectedProcedure
      .input(z.object({ courseId: z.number(), data: z.record(z.string(), z.unknown()) }))
      .mutation(async ({ input }) => {
        return createPricing({ courseId: input.courseId, ...(input.data as any) });
      }),
    update: protectedProcedure
      .input(z.object({ pricingId: z.number(), data: z.record(z.string(), z.unknown()) }))
      .mutation(async ({ input }) => {
        return updatePricing(input.pricingId, input.data as any);
      }),
    delete: protectedProcedure
      .input(z.object({ pricingId: z.number() }))
      .mutation(async ({ input }) => {
        await deletePricing(input.pricingId);
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
        const orgId = input.orgId ?? await requireOrgId(ctx.user.id);
        const existing = await getEnrollment(input.courseId, ctx.user.id);
        if (existing) return existing;
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
        return getCertificateTemplatesByOrg(orgId);
      }),
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return getCertificateTemplateById(input.id);
      }),
    create: protectedProcedure
      .input(z.object({ orgId: z.number().optional(), name: z.string(), htmlTemplate: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const orgId = input.orgId ?? await requireOrgId(ctx.user.id);
        return createCertificateTemplate({ orgId, name: input.name, htmlTemplate: input.htmlTemplate ?? null });
      }),
    update: protectedProcedure
      .input(z.object({ id: z.number(), data: z.record(z.string(), z.unknown()) }))
      .mutation(async ({ input }) => {
        return updateCertificateTemplate(input.id, input.data as any);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteCertificateTemplate(input.id);
        return { ok: true };
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
      .query(async ({ input }) => {
        const w = await getWebinarById(input.webinarId);
        if (!w) throw new TRPCError({ code: "NOT_FOUND" });
        return w;
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
      .mutation(async ({ input }) => {
        return updateWebinar(input.webinarId, input.data as any);
      }),
    delete: protectedProcedure
      .input(z.object({ webinarId: z.number() }))
      .mutation(async ({ input }) => {
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
      .input(z.object({ orgId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const orgId = input?.orgId ?? await requireOrgId(ctx.user.id);
        return listEmailCampaigns(orgId);
      }),
    create: protectedProcedure
      .input(z.object({ orgId: z.number().optional(), name: z.string(), subject: z.string(), htmlBody: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const orgId = input.orgId ?? await requireOrgId(ctx.user.id);
        return createEmailCampaign({ orgId, name: input.name, subject: input.subject, htmlBody: input.htmlBody ?? "", createdBy: ctx.user.id });
      }),
    update: protectedProcedure
      .input(z.object({ id: z.number(), data: z.record(z.string(), z.unknown()) }))
      .mutation(async ({ input }) => {
        return updateEmailCampaign(input.id, input.data as any);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteEmailCampaign(input.id);
        return { ok: true };
      }),
    send: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await updateEmailCampaign(input.id, { status: "sent", sentAt: new Date() });
        return { ok: true };
      }),
    stats: protectedProcedure
      .input(z.object({ orgId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const orgId = input?.orgId ?? await requireOrgId(ctx.user.id);
        return getEmailCampaignStats(orgId);
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
        return getMembershipsByOrg(orgId);
      }),
    create: protectedProcedure
      .input(z.object({ orgId: z.number().optional(), name: z.string(), price: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const orgId = input.orgId ?? await requireOrgId(ctx.user.id);
        return createMembership({ orgId, name: input.name, price: input.price ?? 0, courseIds: "[]" });
      }),
    update: protectedProcedure
      .input(z.object({ id: z.number(), data: z.record(z.string(), z.unknown()) }))
      .mutation(async ({ input }) => {
        return updateMembership(input.id, input.data as any);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteMembership(input.id);
        return { ok: true };
      }),
    getMembers: protectedProcedure
      .input(z.object({ membershipId: z.number() }))
      .query(async ({ input }) => {
        return getMembershipMembers(input.membershipId);
      }),
    addMember: protectedProcedure
      .input(z.object({ membershipId: z.number(), userId: z.number(), status: z.enum(["active", "paused", "cancelled", "expired"]).optional() }))
      .mutation(async ({ input }) => {
        return addMembershipMember({ membershipId: input.membershipId, userId: input.userId, status: input.status ?? "active" });
      }),
    updateMember: protectedProcedure
      .input(z.object({ id: z.number(), data: z.record(z.string(), z.unknown()) }))
      .mutation(async ({ input }) => {
        await updateMembershipMember(input.id, input.data as any);
        return { ok: true };
      }),
    removeMember: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await removeMembershipMember(input.id);
        return { ok: true };
      }),
    getContent: protectedProcedure
      .input(z.object({ membershipId: z.number() }))
      .query(async ({ input }) => {
        return getMembershipContentItems(input.membershipId);
      }),
    addContent: protectedProcedure
      .input(z.object({ membershipId: z.number(), contentType: z.enum(["course", "digital_product", "community", "webinar"]), contentId: z.number() }))
      .mutation(async ({ input }) => {
        return addMembershipContent(input);
      }),
    removeContent: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await removeMembershipContent(input.id);
        return { ok: true };
      }),
    getRules: protectedProcedure
      .input(z.object({ membershipId: z.number() }))
      .query(async ({ input }) => {
        return getMembershipRules(input.membershipId);
      }),
    addRule: protectedProcedure
      .input(z.object({ membershipId: z.number(), triggerType: z.string(), triggerEntityId: z.number().optional(), triggerTag: z.string().optional(), action: z.string().optional() }))
      .mutation(async ({ input }) => {
        return addMembershipRule(input as any);
      }),
    updateRule: protectedProcedure
      .input(z.object({ id: z.number(), data: z.record(z.string(), z.unknown()) }))
      .mutation(async ({ input }) => {
        await updateMembershipRule(input.id, input.data as any);
        return { ok: true };
      }),
    removeRule: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
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
        return getBundlesByOrg(orgId);
      }),
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return getBundleById(input.id);
      }),
    create: protectedProcedure
      .input(z.object({ orgId: z.number().optional(), name: z.string(), description: z.string().optional(), price: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const orgId = input.orgId ?? await requireOrgId(ctx.user.id);
        return createBundle({ orgId, name: input.name, description: input.description ?? null, price: input.price ?? 0, courseIds: "[]" });
      }),
    update: protectedProcedure
      .input(z.object({ id: z.number(), data: z.record(z.string(), z.unknown()) }))
      .mutation(async ({ input }) => {
        return updateBundle(input.id, input.data as any);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
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
        return getFlashcardDecksByOrg(orgId);
      }),
    createDeck: protectedProcedure
      .input(z.object({ orgId: z.number().optional(), title: z.string(), description: z.string().optional(), category: z.string().optional(), isPublic: z.boolean().optional() }))
      .mutation(async ({ ctx, input }) => {
        const orgId = input.orgId ?? await requireOrgId(ctx.user.id);
        return createFlashcardDeck({ orgId, title: input.title, description: input.description, category: input.category, isPublic: input.isPublic, createdBy: ctx.user.id });
      }),
    deleteDeck: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteFlashcardDeck(input.id);
        return { ok: true };
      }),
    getCards: protectedProcedure
      .input(z.object({ deckId: z.number() }))
      .query(async ({ input }) => {
        return getCardsByDeck(input.deckId);
      }),
    saveCards: protectedProcedure
      .input(z.object({ deckId: z.number(), cards: z.array(z.object({ front: z.string(), back: z.string(), frontImageUrl: z.string().optional(), backImageUrl: z.string().optional(), sortOrder: z.number() })) }))
      .mutation(async ({ input }) => {
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
      .input(z.object({ orgId: z.number().optional(), fileName: z.string(), mimeType: z.string(), folder: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const orgId = input.orgId ?? await requireOrgId(ctx.user.id);
        return { uploadUrl: `/api/media-upload`, orgId, folder: input.folder ?? "media" };
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
      .input(z.object({ orgId: z.number().optional(), filename: z.string(), mimeType: z.string(), fileSize: z.number(), fileKey: z.string(), url: z.string(), folderId: z.number().optional(), altText: z.string().optional(), source: z.enum(["form", "course", "direct", "other"]).optional() }))
      .mutation(async ({ ctx, input }) => {
        const orgId = input.orgId ?? await requireOrgId(ctx.user.id);
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { orgMediaLibrary } = await import("../drizzle/schema");
        await db.insert(orgMediaLibrary).values({ orgId, uploadedBy: ctx.user.id, filename: input.filename, mimeType: input.mimeType, fileSize: input.fileSize, fileKey: input.fileKey, url: input.url, folderId: input.folderId ?? null, altText: input.altText ?? null, source: input.source ?? "direct" });
        return { ok: true };
      }),
    deleteOrgMedia: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { orgMediaLibrary } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        await db.delete(orgMediaLibrary).where(eq(orgMediaLibrary.id, input.id));
        return { ok: true };
      }),
    renameOrgMedia: protectedProcedure
      .input(z.object({ id: z.number(), filename: z.string() }))
      .mutation(async ({ input }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { orgMediaLibrary } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        await db.update(orgMediaLibrary).set({ filename: input.filename }).where(eq(orgMediaLibrary.id, input.id));
        return { ok: true };
      }),
    bulkDelete: protectedProcedure
      .input(z.object({ ids: z.array(z.number()) }))
      .mutation(async ({ input }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { orgMediaLibrary } = await import("../drizzle/schema");
        const { inArray } = await import("drizzle-orm");
        await db.delete(orgMediaLibrary).where(inArray(orgMediaLibrary.id, input.ids));
        return { ok: true };
      }),
    bulkMoveToFolder: protectedProcedure
      .input(z.object({ ids: z.array(z.number()), folderId: z.number().nullable() }))
      .mutation(async ({ input }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { orgMediaLibrary } = await import("../drizzle/schema");
        const { inArray } = await import("drizzle-orm");
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
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { mediaFolders } = await import("../drizzle/schema");
        await db.insert(mediaFolders).values({ orgId, name: input.name, parentFolderId: input.parentFolderId ?? null });
        return { ok: true };
      }),
    deleteFolder: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { mediaFolders } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        await db.delete(mediaFolders).where(eq(mediaFolders.id, input.id));
        return { ok: true };
      }),
    renameFolder: protectedProcedure
      .input(z.object({ id: z.number(), name: z.string() }))
      .mutation(async ({ input }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { mediaFolders } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        await db.update(mediaFolders).set({ name: input.name }).where(eq(mediaFolders.id, input.id));
        return { ok: true };
      }),
    listClips: protectedProcedure
      .input(z.object({ mediaItemId: z.number() }))
      .query(async () => []),
    saveClip: protectedProcedure
      .input(z.object({ mediaItemId: z.number(), label: z.string(), startSeconds: z.number(), endSeconds: z.number() }))
      .mutation(async () => ({ ok: true })),
    extractClip: protectedProcedure
      .input(z.object({ mediaItemId: z.number(), startSeconds: z.number(), endSeconds: z.number() }))
      .mutation(async () => ({ ok: true })),
    deleteClip: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async () => ({ ok: true })),
    generateCaptions: protectedProcedure
      .input(z.object({ mediaItemId: z.number() }))
      .mutation(async () => ({ ok: true, captionsUrl: null })),
    updateCaptions: protectedProcedure
      .input(z.object({ mediaItemId: z.number(), captionsVtt: z.string() }))
      .mutation(async ({ input }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { orgMediaLibrary } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const key = `captions/${input.mediaItemId}-${nanoid(8)}.vtt`;
        const { url } = await storagePut(key, Buffer.from(input.captionsVtt), "text/vtt");
        await db.update(orgMediaLibrary).set({ captionsUrl: url }).where(eq(orgMediaLibrary.id, input.mediaItemId));
        return { ok: true, captionsUrl: url };
      }),
    transcribe: protectedProcedure
      .input(z.object({ mediaItemId: z.number() }))
      .mutation(async () => ({ ok: true, transcript: null })),
    generateSpeech: protectedProcedure
      .input(z.object({ text: z.string(), voice: z.string().optional() }))
      .mutation(async () => ({ ok: true, url: null })),
    saveRecording: protectedProcedure
      .input(z.object({ orgId: z.number().optional(), url: z.string(), filename: z.string(), mimeType: z.string().optional(), fileSize: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const orgId = input.orgId ?? await requireOrgId(ctx.user.id);
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
      .input(z.object({ topic: z.string(), targetAudience: z.string().optional(), numSections: z.number().optional() }))
      .mutation(async ({ input }) => {
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
      .input(z.object({ lessonTitle: z.string(), courseTitle: z.string().optional(), format: z.string().optional() }))
      .mutation(async ({ input }) => {
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
        const original = await getCourseById(input.courseId);
        if (!original) throw new TRPCError({ code: "NOT_FOUND" });
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
        return getOrgTheme(org.id);
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
        // Try to find by slug across all orgs
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) return null;
        const { courses } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const rows = await db.select().from(courses).where(eq(courses.slug, input.slug)).limit(1);
        return rows[0] ?? null;
      }
      return getCourseBySlug(input.orgId, input.slug);
    }),
  listCourses: protectedProcedure
    .input(z.object({ orgId: z.number().optional(), pageSize: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const orgId = input?.orgId ?? await requireOrgId(ctx.user.id);
      const all = await getCoursesByOrg(orgId);
      return { courses: all, total: (all as any[]).length };
    }),
  listInstructors: protectedProcedure
    .input(z.object({ orgId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const orgId = input?.orgId ?? await requireOrgId(ctx.user.id);
      return getInstructorsByOrg(orgId);
    }),
  // ── Aliased sub-routers ────────────────────────────────────────────────────
  funnels: funnelRouter,
  downloads: downloadsAdminRouter,
  orderBumps: orderBumpsAdminRouter,
  emailCampaigns: emailCampaignsRouter,
});
