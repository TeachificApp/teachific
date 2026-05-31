/**
 * Instructor Dashboard Router
 *
 * Provides tRPC procedures for:
 *  - Instructor profile management (self-service)
 *  - Viewing courses they instruct
 *  - Payment/payout setup (PayPal, ACH/bank transfer)
 *  - Analytics scoped to their courses (respecting admin-set permissions)
 *  - Admin procedures for managing instructors and analytics permissions
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  lmsInstructors,
  lmsCourseInstructors,
  instructorPayoutConfig,
  instructorAnalyticsPermissions,
  instructorCoursePermissions,
  instructorPublishRequests,
  instructorLessonSubmissions,
  lmsCourses,
  lmsSections,
  lmsLessons,
  lmsEnrollments,
  lmsOrders,
  lmsLessonProgress,
  users,
  orgMembers,
} from "../../drizzle/schema";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getInstructorByUserId(db: any, userId: number, orgId: number) {
  const rows = await db
    .select()
    .from(lmsInstructors)
    .where(and(eq(lmsInstructors.userId, userId), eq(lmsInstructors.orgId, orgId)))
    .limit(1);
  return rows[0] ?? null;
}

async function requireOrgAdmin(ctx: any, orgId: number) {
  const role = ctx.user?.role;
  if (role === "site_owner" || role === "site_admin") return; // platform admins pass
  if (role === "org_super_admin" || role === "org_admin") return; // org admins pass
  throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
}

async function getOrgIdForUser(db: any, userId: number): Promise<number | null> {
  const rows = await db
    .select({ orgId: orgMembers.orgId })
    .from(orgMembers)
    .where(eq(orgMembers.userId, userId))
    .limit(1);
  return rows[0]?.orgId ?? null;
}

// ── Router ────────────────────────────────────────────────────────────────────

export const instructorDashboardRouter = router({

  // ── My Instructor Profile ─────────────────────────────────────────────────

  /** Get the current user's instructor profile (or null if not an instructor) */
  getMyProfile: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return null;
      const profile = await getInstructorByUserId(db, ctx.user.id, input.orgId);
      if (!profile) return null;
      // Attach user info
      const [userRow] = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
      return { ...profile, userName: userRow?.name, userEmail: userRow?.email };
    }),

  /** Create or update the current user's instructor profile */
  upsertMyProfile: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      displayName: z.string().max(255).optional(),
      title: z.string().max(255).optional(),
      bio: z.string().optional(),
      profileImageUrl: z.string().url().optional().nullable(),
      socialLinks: z.object({
        website: z.string().url().optional().nullable(),
        twitter: z.string().optional().nullable(),
        linkedin: z.string().optional().nullable(),
        youtube: z.string().optional().nullable(),
      }).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const existing = await getInstructorByUserId(db, ctx.user.id, input.orgId);
      const socialLinksJson = input.socialLinks ? JSON.stringify(input.socialLinks) : undefined;
      if (existing) {
        await db.update(lmsInstructors)
          .set({
            displayName: input.displayName ?? existing.displayName,
            title: input.title ?? existing.title,
            bio: input.bio ?? existing.bio,
            profileImageUrl: input.profileImageUrl !== undefined ? input.profileImageUrl : existing.profileImageUrl,
            socialLinks: socialLinksJson ?? existing.socialLinks,
          })
          .where(eq(lmsInstructors.id, existing.id));
        return { success: true, id: existing.id };
      } else {
        const result = await db.insert(lmsInstructors).values({
          orgId: input.orgId,
          userId: ctx.user.id,
          displayName: input.displayName ?? null,
          title: input.title ?? null,
          bio: input.bio ?? null,
          profileImageUrl: input.profileImageUrl ?? null,
          socialLinks: socialLinksJson ?? null,
          isActive: true,
        });
        return { success: true, id: (result as any).insertId };
      }
    }),

  // ── My Courses ────────────────────────────────────────────────────────────

  /** List courses the current user instructs */
  getMyCourses: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const instructor = await getInstructorByUserId(db, ctx.user.id, input.orgId);
      if (!instructor) return [];
      // Get course IDs from lms_course_instructors
      const assignments = await db
        .select({ courseId: lmsCourseInstructors.courseId })
        .from(lmsCourseInstructors)
        .where(and(
          eq(lmsCourseInstructors.instructorId, instructor.id),
          eq(lmsCourseInstructors.orgId, input.orgId),
        ));
      if (assignments.length === 0) return [];
      const courseIds = assignments.map((a: any) => a.courseId);
      const courses = await db
        .select()
        .from(lmsCourses)
        .where(and(
          eq(lmsCourses.orgId, input.orgId),
          inArray(lmsCourses.id, courseIds),
        ))
        .orderBy(desc(lmsCourses.createdAt));
      return courses;
    }),

  // ── Analytics (permission-gated) ─────────────────────────────────────────

  /** Get analytics for courses the instructor teaches, filtered by admin permissions */
  getCourseAnalytics: protectedProcedure
    .input(z.object({ orgId: z.number(), courseId: z.number().optional() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return null;
      const instructor = await getInstructorByUserId(db, ctx.user.id, input.orgId);
      if (!instructor) throw new TRPCError({ code: "FORBIDDEN", message: "Not an instructor in this org" });

      // Load permissions
      const [perms] = await db
        .select()
        .from(instructorAnalyticsPermissions)
        .where(and(
          eq(instructorAnalyticsPermissions.orgId, input.orgId),
          eq(instructorAnalyticsPermissions.instructorId, instructor.id),
        ))
        .limit(1);

      // Default permissions if none set
      const permissions = perms ?? {
        canSeeRevenue: false,
        canSeeStudentNames: false,
        canSeeEnrollmentCount: true,
        canSeeCompletionRate: true,
        canSeeQuizScores: true,
        canSeeLessonProgress: false,
        canSeeRevenueBreakdown: false,
        canSeeStudentEmails: false,
      };

      // Get course IDs this instructor teaches
      const assignments = await db
        .select({ courseId: lmsCourseInstructors.courseId })
        .from(lmsCourseInstructors)
        .where(and(
          eq(lmsCourseInstructors.instructorId, instructor.id),
          eq(lmsCourseInstructors.orgId, input.orgId),
        ));
      const allCourseIds = assignments.map((a: any) => a.courseId);
      const courseIds = input.courseId ? [input.courseId].filter(id => allCourseIds.includes(id)) : allCourseIds;
      if (courseIds.length === 0) return { permissions, courses: [], totals: { enrollments: 0, completions: 0, revenue: 0 } };

      // Enrollment counts
      const enrollmentRows = await db
        .select({
          courseId: lmsEnrollments.courseId,
          total: sql<number>`COUNT(*)`,
          completed: sql<number>`SUM(CASE WHEN ${lmsEnrollments.status} = 'completed' THEN 1 ELSE 0 END)`,
        })
        .from(lmsEnrollments)
        .where(and(
          eq(lmsEnrollments.orgId, input.orgId),
          inArray(lmsEnrollments.courseId, courseIds),
        ))
        .groupBy(lmsEnrollments.courseId);

      // Revenue (only if permitted)
      let revenueRows: any[] = [];
      if (permissions.canSeeRevenue) {
        revenueRows = await db
          .select({
            courseId: lmsOrders.courseId,
            total: sql<number>`SUM(${lmsOrders.amount})`,
          })
          .from(lmsOrders)
          .where(and(
            eq(lmsOrders.orgId, input.orgId),
            inArray(lmsOrders.courseId, courseIds),
            eq(lmsOrders.status, "completed"),
          ))
          .groupBy(lmsOrders.courseId);
      }

      // Student list (only if permitted)
      let studentRows: any[] = [];
      if (permissions.canSeeStudentNames || permissions.canSeeStudentEmails) {
        const enrollments = await db
          .select({
            courseId: lmsEnrollments.courseId,
            userId: lmsEnrollments.userId,
            status: lmsEnrollments.status,
            progressPercent: lmsEnrollments.progressPercent,
            enrolledAt: lmsEnrollments.enrolledAt,
          })
          .from(lmsEnrollments)
          .where(and(
            eq(lmsEnrollments.orgId, input.orgId),
            inArray(lmsEnrollments.courseId, courseIds),
          ))
          .orderBy(desc(lmsEnrollments.enrolledAt))
          .limit(200);

        if (enrollments.length > 0) {
          const userIds = [...new Set(enrollments.map((e: any) => e.userId))];
          const userRows = await db
            .select({
              id: users.id,
              name: permissions.canSeeStudentNames ? users.name : sql<string>`'Student'`,
              email: permissions.canSeeStudentEmails ? users.email : sql<string>`NULL`,
            })
            .from(users)
            .where(inArray(users.id, userIds));
          const userMap = new Map(userRows.map((u: any) => [u.id, u]));
          studentRows = enrollments.map((e: any) => ({
            ...e,
            userName: (userMap.get(e.userId) as any)?.name ?? "Student",
            userEmail: permissions.canSeeStudentEmails ? (userMap.get(e.userId) as any)?.email : null,
          }));
        }
      }

      // Build per-course stats
      const enrollmentMap = new Map(enrollmentRows.map((r: any) => [r.courseId, r]));
      const revenueMap = new Map(revenueRows.map((r: any) => [r.courseId, r]));

      const courses = await db
        .select({ id: lmsCourses.id, title: lmsCourses.title, status: lmsCourses.status, coverImageUrl: lmsCourses.coverImageUrl })
        .from(lmsCourses)
        .where(inArray(lmsCourses.id, courseIds));

      const courseStats = courses.map((c: any) => {
        const enr = enrollmentMap.get(c.id) as any;
        const rev = revenueMap.get(c.id) as any;
        return {
          courseId: c.id,
          title: c.title,
          status: c.status,
          coverImageUrl: c.coverImageUrl,
          enrollments: permissions.canSeeEnrollmentCount ? (enr?.total ?? 0) : null,
          completions: permissions.canSeeCompletionRate ? (enr?.completed ?? 0) : null,
          completionRate: permissions.canSeeCompletionRate && enr?.total > 0
            ? Math.round(((enr?.completed ?? 0) / enr.total) * 100)
            : null,
          revenue: permissions.canSeeRevenue ? parseFloat(rev?.total ?? "0") : null,
        };
      });

      const totals = {
        enrollments: permissions.canSeeEnrollmentCount
          ? courseStats.reduce((s: number, c: any) => s + (c.enrollments ?? 0), 0)
          : null,
        completions: permissions.canSeeCompletionRate
          ? courseStats.reduce((s: number, c: any) => s + (c.completions ?? 0), 0)
          : null,
        revenue: permissions.canSeeRevenue
          ? courseStats.reduce((s: number, c: any) => s + (c.revenue ?? 0), 0)
          : null,
      };

      return { permissions, courses: courseStats, totals, students: studentRows };
    }),

  // ── Payout Configuration ──────────────────────────────────────────────────

  /** Get the instructor's current payout config */
  getPayoutConfig: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return null;
      const instructor = await getInstructorByUserId(db, ctx.user.id, input.orgId);
      if (!instructor) return null;
      const [config] = await db
        .select()
        .from(instructorPayoutConfig)
        .where(and(
          eq(instructorPayoutConfig.orgId, input.orgId),
          eq(instructorPayoutConfig.instructorId, instructor.id),
        ))
        .limit(1);
      if (!config) return null;
      // Parse payout details but mask sensitive fields
      let details: any = {};
      try { details = JSON.parse(config.payoutDetails ?? "{}"); } catch {}
      if (config.payoutMethod === "bank_transfer" && details.accountNumber) {
        details.accountNumberMasked = "****" + String(details.accountNumber).slice(-4);
        delete details.accountNumber;
        delete details.routingNumber;
      }
      return { ...config, payoutDetails: details };
    }),

  /** Save or update the instructor's payout configuration */
  savePayoutConfig: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      payoutMethod: z.enum(["paypal", "bank_transfer", "stripe"]),
      // PayPal
      paypalEmail: z.string().email().optional(),
      // Bank ACH
      bankAccountHolderName: z.string().optional(),
      bankAccountNumber: z.string().optional(),
      bankRoutingNumber: z.string().optional(),
      bankAccountType: z.enum(["checking", "savings"]).optional(),
      bankName: z.string().optional(),
      // Stripe Connect
      stripeAccountId: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const instructor = await getInstructorByUserId(db, ctx.user.id, input.orgId);
      if (!instructor) throw new TRPCError({ code: "NOT_FOUND", message: "Instructor profile not found. Please set up your profile first." });

      let payoutDetails: Record<string, any> = {};
      if (input.payoutMethod === "paypal") {
        if (!input.paypalEmail) throw new TRPCError({ code: "BAD_REQUEST", message: "PayPal email is required" });
        payoutDetails = { paypalEmail: input.paypalEmail };
      } else if (input.payoutMethod === "bank_transfer") {
        if (!input.bankAccountNumber || !input.bankRoutingNumber) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Account number and routing number are required" });
        }
        payoutDetails = {
          accountHolderName: input.bankAccountHolderName,
          accountNumber: input.bankAccountNumber,
          routingNumber: input.bankRoutingNumber,
          accountType: input.bankAccountType ?? "checking",
          bankName: input.bankName,
        };
      } else if (input.payoutMethod === "stripe") {
        payoutDetails = { stripeAccountId: input.stripeAccountId };
      }

      const [existing] = await db
        .select({ id: instructorPayoutConfig.id })
        .from(instructorPayoutConfig)
        .where(and(
          eq(instructorPayoutConfig.orgId, input.orgId),
          eq(instructorPayoutConfig.instructorId, instructor.id),
        ))
        .limit(1);

      if (existing) {
        await db.update(instructorPayoutConfig)
          .set({
            payoutMethod: input.payoutMethod,
            payoutDetails: JSON.stringify(payoutDetails),
          })
          .where(eq(instructorPayoutConfig.id, existing.id));
      } else {
        await db.insert(instructorPayoutConfig).values({
          orgId: input.orgId,
          instructorId: instructor.id,
          payoutMethod: input.payoutMethod,
          payoutDetails: JSON.stringify(payoutDetails),
          commissionPercentage: "0.00",
          totalEarned: "0.00",
          totalPaid: "0.00",
        });
      }
      return { success: true };
    }),

  /** Get payout earnings summary */
  getEarnings: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return null;
      const instructor = await getInstructorByUserId(db, ctx.user.id, input.orgId);
      if (!instructor) return null;
      const [config] = await db
        .select({
          commissionPercentage: instructorPayoutConfig.commissionPercentage,
          totalEarned: instructorPayoutConfig.totalEarned,
          totalPaid: instructorPayoutConfig.totalPaid,
          payoutMethod: instructorPayoutConfig.payoutMethod,
        })
        .from(instructorPayoutConfig)
        .where(and(
          eq(instructorPayoutConfig.orgId, input.orgId),
          eq(instructorPayoutConfig.instructorId, instructor.id),
        ))
        .limit(1);
      if (!config) return { commissionPercentage: 0, totalEarned: 0, totalPaid: 0, pendingPayout: 0, payoutMethod: null };
      const earned = parseFloat(config.totalEarned as any ?? "0");
      const paid = parseFloat(config.totalPaid as any ?? "0");
      return {
        commissionPercentage: parseFloat(config.commissionPercentage as any ?? "0"),
        totalEarned: earned,
        totalPaid: paid,
        pendingPayout: Math.max(0, earned - paid),
        payoutMethod: config.payoutMethod,
      };
    }),

  // ── Admin: Manage Instructors ─────────────────────────────────────────────

  /** Admin: list all instructors in an org with their user info */
  adminListInstructors: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ input, ctx }) => {
      await requireOrgAdmin(ctx, input.orgId);
      const db = await getDb();
      if (!db) return [];
      const instructors = await db
        .select()
        .from(lmsInstructors)
        .where(eq(lmsInstructors.orgId, input.orgId))
        .orderBy(desc(lmsInstructors.createdAt));
      if (instructors.length === 0) return [];
      const userIds = instructors.map((i: any) => i.userId);
      const userRows = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(inArray(users.id, userIds));
      const userMap = new Map(userRows.map((u: any) => [u.id, u]));
      // Load analytics permissions
      const permsRows = await db
        .select()
        .from(instructorAnalyticsPermissions)
        .where(eq(instructorAnalyticsPermissions.orgId, input.orgId));
      const permsMap = new Map(permsRows.map((p: any) => [p.instructorId, p]));
      // Load payout config
      const payoutRows = await db
        .select()
        .from(instructorPayoutConfig)
        .where(eq(instructorPayoutConfig.orgId, input.orgId));
      const payoutMap = new Map(payoutRows.map((p: any) => [p.instructorId, p]));
      // Load course assignments
      const assignments = await db
        .select({ instructorId: lmsCourseInstructors.instructorId, courseId: lmsCourseInstructors.courseId })
        .from(lmsCourseInstructors)
        .where(eq(lmsCourseInstructors.orgId, input.orgId));
      const courseCountMap = new Map<number, number>();
      for (const a of assignments) {
        courseCountMap.set(a.instructorId, (courseCountMap.get(a.instructorId) ?? 0) + 1);
      }
      return instructors.map((i: any) => ({
        ...i,
        userName: (userMap.get(i.userId) as any)?.name ?? null,
        userEmail: (userMap.get(i.userId) as any)?.email ?? null,
        analyticsPermissions: permsMap.get(i.id) ?? null,
        payoutConfig: payoutMap.get(i.id) ?? null,
        courseCount: courseCountMap.get(i.id) ?? 0,
      }));
    }),

  /** Admin: add a user as an instructor in an org */
  adminAddInstructor: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      userId: z.number(),
      displayName: z.string().optional(),
      title: z.string().optional(),
      bio: z.string().optional(),
      commissionPercentage: z.number().min(0).max(100).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await requireOrgAdmin(ctx, input.orgId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const existing = await getInstructorByUserId(db, input.userId, input.orgId);
      if (existing) return { success: true, id: existing.id, alreadyExists: true };
      const result = await db.insert(lmsInstructors).values({
        orgId: input.orgId,
        userId: input.userId,
        displayName: input.displayName ?? null,
        title: input.title ?? null,
        bio: input.bio ?? null,
        isActive: true,
      });
      const instructorId = (result as any).insertId;
      // Create default analytics permissions
      await db.insert(instructorAnalyticsPermissions).values({
        orgId: input.orgId,
        instructorId,
        canSeeRevenue: false,
        canSeeStudentNames: false,
        canSeeEnrollmentCount: true,
        canSeeCompletionRate: true,
        canSeeQuizScores: true,
        canSeeLessonProgress: false,
        canSeeRevenueBreakdown: false,
        canSeeStudentEmails: false,
      }).onDuplicateKeyUpdate({ set: { orgId: input.orgId } });
      // Create payout config if commission specified
      if (input.commissionPercentage !== undefined) {
        await db.insert(instructorPayoutConfig).values({
          orgId: input.orgId,
          instructorId,
          payoutMethod: "paypal",
          payoutDetails: null,
          commissionPercentage: String(input.commissionPercentage),
          totalEarned: "0.00",
          totalPaid: "0.00",
        });
      }
      return { success: true, id: instructorId, alreadyExists: false };
    }),

  /** Admin: assign a course to an instructor */
  adminAssignCourse: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      instructorId: z.number(),
      courseId: z.number(),
      role: z.enum(["primary", "secondary"]).default("primary"),
    }))
    .mutation(async ({ input, ctx }) => {
      await requireOrgAdmin(ctx, input.orgId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Check if already assigned
      const [existing] = await db
        .select({ id: lmsCourseInstructors.id })
        .from(lmsCourseInstructors)
        .where(and(
          eq(lmsCourseInstructors.orgId, input.orgId),
          eq(lmsCourseInstructors.instructorId, input.instructorId),
          eq(lmsCourseInstructors.courseId, input.courseId),
        ))
        .limit(1);
      if (existing) return { success: true, alreadyAssigned: true };
      await db.insert(lmsCourseInstructors).values({
        orgId: input.orgId,
        instructorId: input.instructorId,
        courseId: input.courseId,
        role: input.role,
      });
      return { success: true, alreadyAssigned: false };
    }),

  /** Admin: remove a course assignment from an instructor */
  adminUnassignCourse: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      instructorId: z.number(),
      courseId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      await requireOrgAdmin(ctx, input.orgId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(lmsCourseInstructors)
        .where(and(
          eq(lmsCourseInstructors.orgId, input.orgId),
          eq(lmsCourseInstructors.instructorId, input.instructorId),
          eq(lmsCourseInstructors.courseId, input.courseId),
        ));
      return { success: true };
    }),

  /** Admin: update analytics permissions for an instructor */
  adminUpdateAnalyticsPermissions: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      instructorId: z.number(),
      canSeeRevenue: z.boolean().optional(),
      canSeeStudentNames: z.boolean().optional(),
      canSeeEnrollmentCount: z.boolean().optional(),
      canSeeCompletionRate: z.boolean().optional(),
      canSeeQuizScores: z.boolean().optional(),
      canSeeLessonProgress: z.boolean().optional(),
      canSeeRevenueBreakdown: z.boolean().optional(),
      canSeeStudentEmails: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await requireOrgAdmin(ctx, input.orgId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { orgId, instructorId, ...perms } = input;
      // Filter out undefined values
      const updates: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(perms)) {
        if (v !== undefined) updates[k] = v as boolean;
      }
      const [existing] = await db
        .select({ id: instructorAnalyticsPermissions.id })
        .from(instructorAnalyticsPermissions)
        .where(and(
          eq(instructorAnalyticsPermissions.orgId, orgId),
          eq(instructorAnalyticsPermissions.instructorId, instructorId),
        ))
        .limit(1);
      if (existing) {
        await db.update(instructorAnalyticsPermissions)
          .set(updates)
          .where(eq(instructorAnalyticsPermissions.id, existing.id));
      } else {
        await db.insert(instructorAnalyticsPermissions).values({
          orgId,
          instructorId,
          canSeeRevenue: perms.canSeeRevenue ?? false,
          canSeeStudentNames: perms.canSeeStudentNames ?? false,
          canSeeEnrollmentCount: perms.canSeeEnrollmentCount ?? true,
          canSeeCompletionRate: perms.canSeeCompletionRate ?? true,
          canSeeQuizScores: perms.canSeeQuizScores ?? true,
          canSeeLessonProgress: perms.canSeeLessonProgress ?? false,
          canSeeRevenueBreakdown: perms.canSeeRevenueBreakdown ?? false,
          canSeeStudentEmails: perms.canSeeStudentEmails ?? false,
        });
      }
      return { success: true };
    }),

  /** Admin: update instructor commission rate */
  adminUpdateCommission: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      instructorId: z.number(),
      commissionPercentage: z.number().min(0).max(100),
    }))
    .mutation(async ({ input, ctx }) => {
      await requireOrgAdmin(ctx, input.orgId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [existing] = await db
        .select({ id: instructorPayoutConfig.id })
        .from(instructorPayoutConfig)
        .where(and(
          eq(instructorPayoutConfig.orgId, input.orgId),
          eq(instructorPayoutConfig.instructorId, input.instructorId),
        ))
        .limit(1);
      if (existing) {
        await db.update(instructorPayoutConfig)
          .set({ commissionPercentage: String(input.commissionPercentage) })
          .where(eq(instructorPayoutConfig.id, existing.id));
      } else {
        await db.insert(instructorPayoutConfig).values({
          orgId: input.orgId,
          instructorId: input.instructorId,
          payoutMethod: "paypal",
          payoutDetails: null,
          commissionPercentage: String(input.commissionPercentage),
          totalEarned: "0.00",
          totalPaid: "0.00",
        });
      }
      return { success: true };
    }),

  /** Admin: deactivate/reactivate an instructor */
  adminToggleInstructorStatus: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      instructorId: z.number(),
      isActive: z.boolean(),
    }))
    .mutation(async ({ input, ctx }) => {
      await requireOrgAdmin(ctx, input.orgId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(lmsInstructors)
        .set({ isActive: input.isActive })
        .where(and(
          eq(lmsInstructors.id, input.instructorId),
          eq(lmsInstructors.orgId, input.orgId),
        ));
      return { success: true };
    }),

  /** Admin: search users to add as instructors */
  adminSearchUsers: protectedProcedure
    .input(z.object({ orgId: z.number(), query: z.string().min(2) }))
    .query(async ({ input, ctx }) => {
      await requireOrgAdmin(ctx, input.orgId);
      const db = await getDb();
      if (!db) return [];
      const q = `%${input.query}%`;
      const rows = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(sql`(${users.name} LIKE ${q} OR ${users.email} LIKE ${q})`)
        .limit(20);
      return rows;
    }),

  /** Admin: get courses in org for assignment */
  adminListCourses: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ input, ctx }) => {
      await requireOrgAdmin(ctx, input.orgId);
      const db = await getDb();
      if (!db) return [];
      return db
        .select({ id: lmsCourses.id, title: lmsCourses.title, status: lmsCourses.status, coverImageUrl: lmsCourses.coverImageUrl })
        .from(lmsCourses)
        .where(eq(lmsCourses.orgId, input.orgId))
        .orderBy(desc(lmsCourses.createdAt));
    }),

  /** Admin: get course assignments for a specific instructor */
  adminGetInstructorCourses: protectedProcedure
    .input(z.object({ orgId: z.number(), instructorId: z.number() }))
    .query(async ({ input, ctx }) => {
      await requireOrgAdmin(ctx, input.orgId);
      const db = await getDb();
      if (!db) return [];
      const assignments = await db
        .select({ courseId: lmsCourseInstructors.courseId, role: lmsCourseInstructors.role })
        .from(lmsCourseInstructors)
        .where(and(
          eq(lmsCourseInstructors.orgId, input.orgId),
          eq(lmsCourseInstructors.instructorId, input.instructorId),
        ));
      if (assignments.length === 0) return [];
      const courseIds = assignments.map((a: any) => a.courseId);
      const courses = await db
        .select({ id: lmsCourses.id, title: lmsCourses.title, status: lmsCourses.status })
        .from(lmsCourses)
        .where(inArray(lmsCourses.id, courseIds));
      const roleMap = new Map(assignments.map((a: any) => [a.courseId, a.role]));
      return courses.map((c: any) => ({ ...c, assignmentRole: roleMap.get(c.id) }));
    }),

  // ── Course Management (Instructor Self-Service) ──────────────────────────

  /** Instructor: get courses they are assigned to with publish permissions */
  getMyInstructorCourses: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      // Find instructor profiles linked to this user account (by linkedUserId or userId)
      const instructorRows = await db
        .select({ id: lmsInstructors.id, orgId: lmsInstructors.orgId })
        .from(lmsInstructors)
        .where(sql`(${lmsInstructors.linkedUserId} = ${ctx.user.id} OR ${lmsInstructors.userId} = ${ctx.user.id})`);
      if (instructorRows.length === 0) return [];
      const instructorIds = instructorRows.map((r: any) => r.id);
      const instructorOrgMap = Object.fromEntries(instructorRows.map((r: any) => [r.id, r.orgId]));
      const assignments = await db
        .select({
          instructorId: lmsCourseInstructors.instructorId,
          courseId: lmsCourseInstructors.courseId,
          role: lmsCourseInstructors.role,
          courseTitle: lmsCourses.title,
          courseStatus: lmsCourses.status,
          courseSlug: lmsCourses.slug,
          courseThumbnail: lmsCourses.coverImageUrl,
        })
        .from(lmsCourseInstructors)
        .leftJoin(lmsCourses, eq(lmsCourses.id, lmsCourseInstructors.courseId))
        .where(inArray(lmsCourseInstructors.instructorId, instructorIds));
      const enriched = await Promise.all(assignments.map(async (a: any) => {
        const [perm] = await db.select()
          .from(instructorCoursePermissions)
          .where(and(
            eq(instructorCoursePermissions.instructorId, a.instructorId),
            eq(instructorCoursePermissions.courseId, a.courseId),
          ))
          .limit(1);
        const [latestReq] = await db.select()
          .from(instructorPublishRequests)
          .where(and(
            eq(instructorPublishRequests.courseId, a.courseId),
            eq(instructorPublishRequests.instructorId, a.instructorId),
          ))
          .orderBy(desc(instructorPublishRequests.requestedAt))
          .limit(1);
        return {
          ...a,
          orgId: instructorOrgMap[a.instructorId] ?? null,
          canSelfPublish: perm?.canSelfPublish ?? false,
          requiresLessonApproval: perm?.requiresLessonApproval ?? true,
          latestPublishRequest: latestReq ?? null,
        };
      }));
      return enriched;
    }),

  /** Instructor: get sections and lessons for a course they instruct */
  getCourseSections: protectedProcedure
    .input(z.object({ courseId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const sections = await db.select().from(lmsSections)
        .where(eq(lmsSections.courseId, input.courseId))
        .orderBy(lmsSections.position);
      const lessons = await db.select().from(lmsLessons)
        .where(eq(lmsLessons.courseId, input.courseId))
        .orderBy(lmsLessons.position);
      return sections.map((s: any) => ({
        ...s,
        lessons: lessons.filter((l: any) => l.sectionId === s.id),
      }));
    }),

  /** Instructor: get a single lesson for editing */
  getLesson: protectedProcedure
    .input(z.object({ lessonId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [lesson] = await db.select().from(lmsLessons)
        .where(eq(lmsLessons.id, input.lessonId)).limit(1);
      if (!lesson) throw new TRPCError({ code: "NOT_FOUND" });
      return lesson;
    }),

  /** Instructor: update lesson content */
  updateLesson: protectedProcedure
    .input(z.object({
      lessonId: z.number(),
      title: z.string().min(1).max(255).optional(),
      content: z.string().optional(),
      embedUrl: z.string().url().optional().nullable(),
      durationMinutes: z.number().int().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { lessonId, ...updates } = input;
      const setData: any = {};
      if (updates.title !== undefined) setData.title = updates.title;
      if (updates.content !== undefined) setData.content = updates.content;
      if (updates.embedUrl !== undefined) setData.embedUrl = updates.embedUrl;
      if (updates.durationMinutes !== undefined) setData.durationMinutes = updates.durationMinutes;
      await db.update(lmsLessons).set(setData).where(eq(lmsLessons.id, lessonId));
      return { ok: true };
    }),

  /** Instructor: submit a lesson for admin review (or self-publish if permitted) */
  submitLessonForReview: protectedProcedure
    .input(z.object({
      lessonId: z.number(),
      courseId: z.number(),
      instructorId: z.number(),
      note: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [perm] = await db.select().from(instructorCoursePermissions)
        .where(and(
          eq(instructorCoursePermissions.instructorId, input.instructorId),
          eq(instructorCoursePermissions.courseId, input.courseId),
        )).limit(1);
      if (perm?.canSelfPublish || perm?.requiresLessonApproval === false) {
        await db.update(lmsLessons)
          .set({ lessonStatus: "published" })
          .where(eq(lmsLessons.id, input.lessonId));
        return { ok: true, selfPublished: true };
      }
      await db.update(lmsLessons)
        .set({ lessonStatus: "draft" })
        .where(eq(lmsLessons.id, input.lessonId));
      const [existing] = await db.select().from(instructorLessonSubmissions)
        .where(and(
          eq(instructorLessonSubmissions.lessonId, input.lessonId),
          eq(instructorLessonSubmissions.status, "pending_review"),
        )).limit(1);
      if (!existing) {
        await db.insert(instructorLessonSubmissions).values({
          lessonId: input.lessonId,
          courseId: input.courseId,
          instructorId: input.instructorId,
          note: input.note ?? null,
        });
      }
      return { ok: true, selfPublished: false };
    }),

  /** Instructor: get my lesson submission history */
  getMyLessonSubmissions: protectedProcedure
    .input(z.object({ courseId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const instructorRows = await db
        .select({ id: lmsInstructors.id })
        .from(lmsInstructors)
        .where(eq(lmsInstructors.linkedUserId, ctx.user.id));
      if (instructorRows.length === 0) return [];
      const instructorIds = instructorRows.map((r: any) => r.id);
      const conditions: any[] = [inArray(instructorLessonSubmissions.instructorId, instructorIds)];
      if (input.courseId) conditions.push(eq(instructorLessonSubmissions.courseId, input.courseId));
      const rows = await db
        .select({
          id: instructorLessonSubmissions.id,
          lessonId: instructorLessonSubmissions.lessonId,
          courseId: instructorLessonSubmissions.courseId,
          status: instructorLessonSubmissions.status,
          note: instructorLessonSubmissions.note,
          reviewNote: instructorLessonSubmissions.reviewNote,
          submittedAt: instructorLessonSubmissions.submittedAt,
          reviewedAt: instructorLessonSubmissions.reviewedAt,
          lessonTitle: lmsLessons.title,
          courseTitle: lmsCourses.title,
        })
        .from(instructorLessonSubmissions)
        .leftJoin(lmsLessons, eq(lmsLessons.id, instructorLessonSubmissions.lessonId))
        .leftJoin(lmsCourses, eq(lmsCourses.id, instructorLessonSubmissions.courseId))
        .where(and(...conditions))
        .orderBy(desc(instructorLessonSubmissions.submittedAt));
      return rows;
    }),

  /** Instructor: request course publish (when canSelfPublish is false) */
  requestCoursePublish: protectedProcedure
    .input(z.object({ courseId: z.number(), instructorId: z.number(), note: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [existing] = await db.select().from(instructorPublishRequests)
        .where(and(
          eq(instructorPublishRequests.courseId, input.courseId),
          eq(instructorPublishRequests.instructorId, input.instructorId),
          eq(instructorPublishRequests.status, "pending"),
        )).limit(1);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "A publish request is already pending" });
      await db.insert(instructorPublishRequests).values({
        courseId: input.courseId,
        instructorId: input.instructorId,
        note: input.note ?? null,
      });
      return { ok: true };
    }),

  // ── Admin: Lesson Approval ────────────────────────────────────────────────

  /** Admin: list pending lesson submissions */
  adminListPendingLessons: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      status: z.enum(["pending_review", "approved", "rejected"]).optional(),
    }))
    .query(async ({ ctx, input }) => {
      await requireOrgAdmin(ctx, input.orgId);
      const db = await getDb();
      if (!db) return [];
      const statusFilter = input.status ?? "pending_review";
      const rows = await db
        .select({
          id: instructorLessonSubmissions.id,
          lessonId: instructorLessonSubmissions.lessonId,
          courseId: instructorLessonSubmissions.courseId,
          instructorId: instructorLessonSubmissions.instructorId,
          status: instructorLessonSubmissions.status,
          note: instructorLessonSubmissions.note,
          reviewNote: instructorLessonSubmissions.reviewNote,
          submittedAt: instructorLessonSubmissions.submittedAt,
          reviewedAt: instructorLessonSubmissions.reviewedAt,
          lessonTitle: lmsLessons.title,
          courseTitle: lmsCourses.title,
          instructorName: lmsInstructors.displayName,
        })
        .from(instructorLessonSubmissions)
        .leftJoin(lmsLessons, eq(lmsLessons.id, instructorLessonSubmissions.lessonId))
        .leftJoin(lmsCourses, eq(lmsCourses.id, instructorLessonSubmissions.courseId))
        .leftJoin(lmsInstructors, eq(lmsInstructors.id, instructorLessonSubmissions.instructorId))
        .where(eq(instructorLessonSubmissions.status, statusFilter))
        .orderBy(desc(instructorLessonSubmissions.submittedAt));
      return rows;
    }),

  /** Admin: approve or reject a lesson submission */
  adminReviewLesson: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      submissionId: z.number(),
      decision: z.enum(["approved", "rejected"]),
      reviewNote: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireOrgAdmin(ctx, input.orgId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [submission] = await db.select().from(instructorLessonSubmissions)
        .where(eq(instructorLessonSubmissions.id, input.submissionId)).limit(1);
      if (!submission) throw new TRPCError({ code: "NOT_FOUND" });
      await db.update(instructorLessonSubmissions)
        .set({
          status: input.decision,
          reviewNote: input.reviewNote ?? null,
          reviewedByAdminId: ctx.user.id,
          reviewedAt: new Date(),
        })
        .where(eq(instructorLessonSubmissions.id, input.submissionId));
      if (input.decision === "approved") {
        await db.update(lmsLessons)
          .set({ lessonStatus: "published" })
          .where(eq(lmsLessons.id, submission.lessonId));
      }
      return { ok: true };
    }),

  /** Admin: list all publish requests */
  adminListPublishRequests: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      status: z.enum(["pending", "approved", "rejected"]).optional(),
    }))
    .query(async ({ ctx, input }) => {
      await requireOrgAdmin(ctx, input.orgId);
      const db = await getDb();
      if (!db) return [];
      const statusFilter = input.status ?? "pending";
      const rows = await db
        .select({
          id: instructorPublishRequests.id,
          courseId: instructorPublishRequests.courseId,
          instructorId: instructorPublishRequests.instructorId,
          status: instructorPublishRequests.status,
          note: instructorPublishRequests.note,
          reviewNote: instructorPublishRequests.reviewNote,
          requestedAt: instructorPublishRequests.requestedAt,
          reviewedAt: instructorPublishRequests.reviewedAt,
          courseTitle: lmsCourses.title,
          instructorName: lmsInstructors.displayName,
        })
        .from(instructorPublishRequests)
        .leftJoin(lmsCourses, eq(lmsCourses.id, instructorPublishRequests.courseId))
        .leftJoin(lmsInstructors, eq(lmsInstructors.id, instructorPublishRequests.instructorId))
        .where(eq(instructorPublishRequests.status, statusFilter))
        .orderBy(desc(instructorPublishRequests.requestedAt));
      return rows;
    }),

  /** Admin: approve or reject a publish request */
  adminReviewPublishRequest: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      requestId: z.number(),
      decision: z.enum(["approved", "rejected"]),
      reviewNote: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireOrgAdmin(ctx, input.orgId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [req] = await db.select().from(instructorPublishRequests)
        .where(eq(instructorPublishRequests.id, input.requestId)).limit(1);
      if (!req) throw new TRPCError({ code: "NOT_FOUND" });
      await db.update(instructorPublishRequests)
        .set({
          status: input.decision,
          reviewNote: input.reviewNote ?? null,
          reviewedByAdminId: ctx.user.id,
          reviewedAt: new Date(),
        })
        .where(eq(instructorPublishRequests.id, input.requestId));
      if (input.decision === "approved") {
        await db.update(lmsCourses)
          .set({ status: "public" })
          .where(eq(lmsCourses.id, req.courseId));
      }
      return { ok: true };
    }),

  /** Admin: set per-course permissions for an instructor */
  adminSetCoursePermission: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      instructorId: z.number(),
      courseId: z.number(),
      canSelfPublish: z.boolean(),
      requiresLessonApproval: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireOrgAdmin(ctx, input.orgId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [existing] = await db.select().from(instructorCoursePermissions)
        .where(and(
          eq(instructorCoursePermissions.instructorId, input.instructorId),
          eq(instructorCoursePermissions.courseId, input.courseId),
        )).limit(1);
      if (existing) {
        await db.update(instructorCoursePermissions)
          .set({
            canSelfPublish: input.canSelfPublish,
            requiresLessonApproval: input.requiresLessonApproval,
            grantedByAdminId: ctx.user.id,
          })
          .where(eq(instructorCoursePermissions.id, existing.id));
      } else {
        await db.insert(instructorCoursePermissions).values({
          instructorId: input.instructorId,
          courseId: input.courseId,
          canSelfPublish: input.canSelfPublish,
          requiresLessonApproval: input.requiresLessonApproval,
          grantedByAdminId: ctx.user.id,
        });
      }
      return { ok: true };
    }),

  /** Admin: set global requiresLessonApproval default on instructor record */
  adminSetInstructorApproval: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      instructorId: z.number(),
      requiresLessonApproval: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireOrgAdmin(ctx, input.orgId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(lmsInstructors)
        .set({ requiresLessonApproval: input.requiresLessonApproval })
        .where(and(
          eq(lmsInstructors.id, input.instructorId),
          eq(lmsInstructors.orgId, input.orgId),
        ));
      return { ok: true };
    }),

  /** Admin: link a user account to an instructor profile */
  adminLinkUserToInstructor: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      instructorId: z.number(),
      userId: z.number().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireOrgAdmin(ctx, input.orgId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(lmsInstructors)
        .set({ linkedUserId: input.userId })
        .where(and(
          eq(lmsInstructors.id, input.instructorId),
          eq(lmsInstructors.orgId, input.orgId),
        ));
      return { ok: true };
    }),
});
