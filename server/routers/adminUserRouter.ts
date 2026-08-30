/**
 * adminUserRouter.ts
 * Teachific™ — Admin: User Detail Management
 *
 * Provides all procedures consumed by AdminUserDetailPage.tsx:
 * - getUserDetail, getUserAppRoles, grantAppRole, revokeAppRole
 * - updateUserRole, updateUserProfile, sendPasswordReset, setPassword
 * - grantMembershipAccess, revokeMembershipAccess
 * - listAllCourses, enrollInCourse, unenrollFromCourse
 * - updateEnrollmentExpiry, resendEnrollmentEmail, resendMembershipConfirmation
 * - cancelLmsEnrollmentSubscription, cancelLmsOrderSubscription
 * - cancelStripeSubscription, syncStripeSubscription
 * - cancelNativeMembership, revokeNativeMembership
 * - refundPayment
 * - listCohortGroups, assignCohortGroup
 * - listWorkshopInstances, assignWorkshopInstance
 * - issueCertificate, removeCertificate
 * - getUserEmailHistory, resendEmailFromLog
 * - getUserCourseProgress
 * - getUserActivityLog, getUserLoginHistory
 * - listEmailAliases, addEmailAlias, removeEmailAlias
 * - searchUsersForMerge, mergeUsers
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc, asc, or, like, sql, gte, lte } from "drizzle-orm";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb, requireOrgAdmin, getOrgIdForUserWithFallback } from "../db";
import {
  users,
  orgMembers,
  organizations,
  lmsCourses,
  lmsEnrollments,
  lmsLessonProgress,
  lmsLessons,
  lmsSections,
  lmsCertificates,
  lmsCertificateTemplates,
  lmsOrders,
  lmsCohortGroups,
  lmsCohortGroupEnrollments,
  workshopInstances,
  workshopEnrollments,
  membershipMembers,
  membershipPlans,
  membershipSubscriptions,
  memberships,
  emailSendLog,
  userLoginEvents,
  memberActivityEvents,
  userEmailAliases,
  bundleEnrollments,
  bundles,
  workshops,
} from "../../drizzle/schema";
import { sendEmail, buildPasswordResetEmail } from "../_core/email";
import { sendEnrollmentEmail } from "../lib/enrollmentEmail";
import { getOrgBaseUrl } from "../lib/orgUrl";

const BCRYPT_ROUNDS = 12;

/** Verify the caller is a platform admin or org admin */
async function assertAdmin(ctx: { user: { id: number; role: string } }) {
  await requireOrgAdmin(ctx.user.id, ctx.user.role);
}

/** Ensure an organization administrator can only manage users in the active organization. */
async function requireActiveOrgUserMembership(ctx: { user: { id: number; role: string } }, userId: number) {
  const orgId = await getOrgIdForUserWithFallback(ctx.user.id, ctx.user.role);
  if (!orgId) throw new TRPCError({ code: "BAD_REQUEST", message: "No active organization context." });
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  const [membership] = await db
    .select({ id: orgMembers.id })
    .from(orgMembers)
    .where(and(eq(orgMembers.userId, userId), eq(orgMembers.orgId, orgId)))
    .limit(1);
  if (!membership) {
    throw new TRPCError({ code: "FORBIDDEN", message: "This user is not a member of the active organization." });
  }
  return { db, orgId };
}

/** Verify the caller is a platform admin (site_owner or site_admin) */
function assertPlatformAdmin(role: string) {
  if (role !== "site_owner" && role !== "site_admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin access required" });
  }
}

export const adminUserRouter = router({
  // ─── Core user detail ─────────────────────────────────────────────────────

  /**
   * Main data loader for the user detail page.
   * Returns user profile, enrollments, memberships, certificates, workshop enrollments, etc.
   */
  getUserDetail: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const { db, orgId } = await requireActiveOrgUserMembership(ctx, input.userId);

      // User record
      const [user] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

      // Org membership
      const orgMemberRows = await db
        .select({ orgId: orgMembers.orgId, role: orgMembers.role })
        .from(orgMembers)
        .where(
          orgId
            ? and(eq(orgMembers.userId, input.userId), eq(orgMembers.orgId, orgId))
            : eq(orgMembers.userId, input.userId)
        );

      // LMS enrollments with course info
      const enrollmentRows = await db
        .select({
          id: lmsEnrollments.id,
          courseId: lmsEnrollments.courseId,
          status: lmsEnrollments.status,
          enrolledAt: lmsEnrollments.enrolledAt,
          completedAt: lmsEnrollments.completedAt,
          expiresAt: lmsEnrollments.expiresAt,
          progressPercent: lmsEnrollments.progressPercent,
          lastAccessedAt: lmsEnrollments.lastAccessedAt,
          enrollmentType: lmsEnrollments.enrollmentType,
          source: lmsEnrollments.source,
          stripeSubscriptionId: lmsEnrollments.stripeSubscriptionId,
          accessExpiresAt: lmsEnrollments.accessExpiresAt,
          groupId: lmsEnrollments.groupId,
          orderId: lmsEnrollments.orderId,
          courseTitle: lmsCourses.title,
          courseSlug: lmsCourses.slug,
          courseType: lmsCourses.type,
          courseStatus: lmsCourses.status,
          courseThumbnail: lmsCourses.thumbnailUrl,
          hasCertificate: lmsCourses.hasCertificate,
          pricingType: lmsCourses.pricingType,
        })
        .from(lmsEnrollments)
        .leftJoin(lmsCourses, eq(lmsEnrollments.courseId, lmsCourses.id))
        .where(
          orgId
            ? and(eq(lmsEnrollments.userId, input.userId), eq(lmsEnrollments.orgId, orgId))
            : eq(lmsEnrollments.userId, input.userId)
        )
        .orderBy(desc(lmsEnrollments.enrolledAt));

      // Certificates
      const certRows = await db
        .select({
          id: lmsCertificates.id,
          courseId: lmsCertificates.courseId,
          enrollmentId: lmsCertificates.enrollmentId,
          certificateUrl: lmsCertificates.certificateUrl,
          certificateNumber: lmsCertificates.certificateNumber,
          issuedAt: lmsCertificates.issuedAt,
          courseTitle: lmsCourses.title,
        })
        .from(lmsCertificates)
        .leftJoin(lmsCourses, eq(lmsCertificates.courseId, lmsCourses.id))
        .where(
          orgId
            ? and(eq(lmsCertificates.userId, input.userId), eq(lmsCertificates.orgId, orgId))
            : eq(lmsCertificates.userId, input.userId)
        )
        .orderBy(desc(lmsCertificates.issuedAt));

      // LMS orders
      const orderRows = await db
        .select()
        .from(lmsOrders)
        .where(
          orgId
            ? and(eq(lmsOrders.userId, input.userId), eq(lmsOrders.orgId, orgId))
            : eq(lmsOrders.userId, input.userId)
        )
        .orderBy(desc(lmsOrders.createdAt));

      // Workshop enrollments
      const workshopEnrollRows = await db
        .select({
          id: workshopEnrollments.id,
          workshopId: workshopEnrollments.workshopId,
          instanceId: workshopEnrollments.instanceId,
          status: workshopEnrollments.status,
          amountPaid: workshopEnrollments.amountPaid,
          currency: workshopEnrollments.currency,
          accessGrantedAt: workshopEnrollments.accessGrantedAt,
          attended: workshopEnrollments.attended,
          instanceTitle: workshopInstances.title,
          instanceStartDate: workshopInstances.startDate,
        })
        .from(workshopEnrollments)
        .leftJoin(workshopInstances, eq(workshopEnrollments.instanceId, workshopInstances.id))
        .leftJoin(workshops, eq(workshopEnrollments.workshopId, workshops.id))
        .where(
          orgId
            ? and(eq(workshopEnrollments.userId, input.userId), eq(workshops.orgId, orgId))
            : eq(workshopEnrollments.userId, input.userId)
        )
        .orderBy(desc(workshopEnrollments.createdAt));

      // Membership members (native memberships)
      const nativeMembershipRows = await db
        .select({
          id: membershipMembers.id,
          membershipId: membershipMembers.membershipId,
          status: membershipMembers.status,
          joinedAt: membershipMembers.joinedAt,
          expiresAt: membershipMembers.expiresAt,
          cancelledAt: membershipMembers.cancelledAt,
          stripeSubscriptionId: membershipMembers.stripeSubscriptionId,
        })
        .from(membershipMembers)
        .leftJoin(memberships, eq(membershipMembers.membershipId, memberships.id))
        .where(
          orgId
            ? and(eq(membershipMembers.userId, input.userId), eq(memberships.orgId, orgId))
            : eq(membershipMembers.userId, input.userId)
        )
        .orderBy(desc(membershipMembers.joinedAt));

      // Membership plan subscriptions
      const membershipSubRows = await db
        .select({
          id: membershipSubscriptions.id,
          planId: membershipSubscriptions.planId,
          status: membershipSubscriptions.status,
          startDate: membershipSubscriptions.startDate,
          endDate: membershipSubscriptions.endDate,
          planName: membershipPlans.name,
          planPrice: membershipPlans.price,
          billingInterval: membershipPlans.billingInterval,
        })
        .from(membershipSubscriptions)
        .leftJoin(membershipPlans, eq(membershipSubscriptions.planId, membershipPlans.id))
        .where(
          orgId
            ? and(eq(membershipSubscriptions.userId, input.userId), eq(membershipSubscriptions.orgId, orgId))
            : eq(membershipSubscriptions.userId, input.userId)
        )
        .orderBy(desc(membershipSubscriptions.startDate));

      // Bundle enrollments
      const bundleEnrollRows = await db
        .select()
        .from(bundleEnrollments)
        .leftJoin(bundles, eq(bundleEnrollments.bundleId, bundles.id))
        .where(
          orgId
            ? and(eq(bundleEnrollments.userId, input.userId), eq(bundles.orgId, orgId))
            : eq(bundleEnrollments.userId, input.userId)
        )
        .orderBy(desc(bundleEnrollments.enrolledAt));

      // Email aliases
      const emailAliasRows = await db
        .select()
        .from(userEmailAliases)
        .where(eq(userEmailAliases.userId, input.userId));

      // Org branding info for org-scoped invoices
      let orgBranding: {
        name: string;
        logoUrl: string | null;
        website: string | null;
        supportEmail: string | null;
        supportName: string | null;
      } = {
        name: "Teachific™",
        logoUrl: null,
        website: "teachific.app",
        supportEmail: "support@teachific.app",
        supportName: null,
      };
      if (orgId) {
        const [org] = await db
          .select({
            name: organizations.name,
            logoUrl: organizations.logoUrl,
            customDomain: organizations.customDomain,
            customSubdomain: organizations.customSubdomain,
            customSenderEmail: organizations.customSenderEmail,
            customSenderName: organizations.customSenderName,
          })
          .from(organizations)
          .where(eq(organizations.id, orgId))
          .limit(1);
        if (org) {
          const website = org.customDomain
            ? org.customDomain
            : org.customSubdomain
            ? `${org.customSubdomain}.teachific.app`
            : `teachific.app`;
          orgBranding = {
            name: org.name,
            logoUrl: org.logoUrl ?? null,
            website,
            supportEmail: org.customSenderEmail ?? "support@teachific.app",
            supportName: org.customSenderName ?? null,
          };
        }
      }

      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          displayName: user.displayName,
          firstName: user.firstName,
          lastName: user.lastName,
          avatarUrl: user.avatarUrl,
          bio: user.bio,
          specialty: user.specialty,
          credentials: user.credentials,
          location: user.location,
          website: user.website,
          timezone: user.timezone,
          role: user.role,
          emailVerified: user.emailVerified,
          createdAt: user.createdAt,
          lastSignedIn: user.lastSignedIn,
          isPremium: user.isPremium,
          loginMethod: user.loginMethod,
        },
        orgMemberships: orgMemberRows,
        enrollments: enrollmentRows.map(e => ({
          ...e,
          isQuiz: e.courseType === "quiz",
          isDownload: e.courseType === "download",
        })),
        certificates: certRows,
        lmsCourseOrders: orderRows,
        workshopEnrollments: workshopEnrollRows,
        nativeMemberships: nativeMembershipRows,
        memberships: membershipSubRows.map(m => ({
          ...m,
          brand: null, // membership access records are org-specific
        })),
        communityMemberships: [],
        webinarRegistrations: [],
        physicalOrders: [],
        digitalPurchases: [],
        bundleEnrollments: bundleEnrollRows,
        emailAliases: emailAliasRows,
        orgBranding,
      };
    }),

  // ─── App Roles ────────────────────────────────────────────────────────────

  getUserAppRoles: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      assertPlatformAdmin(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [user] = await db
        .select({ id: users.id, role: users.role, isPremium: users.isPremium })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      // Return roles as an array of role strings
      const roles: string[] = [user.role];
      if (user.isPremium) roles.push("premium_user");
      return { roles };
    }),

  grantAppRole: protectedProcedure
    .input(z.object({ userId: z.number(), role: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      assertPlatformAdmin(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Handle special additive roles
      if (input.role === "premium_user") {
        await db.update(users).set({ isPremium: true }).where(eq(users.id, input.userId));
        return { success: true };
      }
      // Validate role is a valid enum value
      const validRoles = ["site_owner", "site_admin", "org_super_admin", "org_admin", "instructor", "affiliate", "member", "user"];
      if (!validRoles.includes(input.role)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid role" });
      }
      await db.update(users).set({ role: input.role as any }).where(eq(users.id, input.userId));
      return { success: true };
    }),

  revokeAppRole: protectedProcedure
    .input(z.object({ userId: z.number(), role: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      assertPlatformAdmin(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (input.role === "premium_user") {
        await db.update(users).set({ isPremium: false }).where(eq(users.id, input.userId));
        return { success: true };
      }
      // Revert to base member role
      await db.update(users).set({ role: "member" }).where(eq(users.id, input.userId));
      return { success: true };
    }),

  // ─── Profile management ───────────────────────────────────────────────────

  updateUserRole: protectedProcedure
    .input(z.object({ userId: z.number(), role: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      assertPlatformAdmin(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const validRoles = ["site_owner", "site_admin", "org_super_admin", "org_admin", "instructor", "affiliate", "member", "user"];
      if (!validRoles.includes(input.role)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid role" });
      }
      await db.update(users).set({ role: input.role as any }).where(eq(users.id, input.userId));
      return { success: true };
    }),

  updateUserProfile: protectedProcedure
    .input(z.object({
      userId: z.number(),
      displayName: z.string().optional(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      email: z.string().email().optional(),
      bio: z.string().optional(),
      specialty: z.string().optional(),
      credentials: z.string().optional(),
      location: z.string().optional(),
      website: z.string().optional(),
      timezone: z.string().optional(),
      avatarUrl: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const { userId, ...fields } = input;
      const { db } = await requireActiveOrgUserMembership(ctx, userId);
      const updateData: Record<string, any> = {};
      if (fields.displayName !== undefined) updateData.displayName = fields.displayName;
      if (fields.firstName !== undefined) updateData.firstName = fields.firstName;
      if (fields.lastName !== undefined) updateData.lastName = fields.lastName;
      if (fields.email !== undefined) updateData.email = fields.email;
      if (fields.bio !== undefined) updateData.bio = fields.bio;
      if (fields.specialty !== undefined) updateData.specialty = fields.specialty;
      if (fields.credentials !== undefined) updateData.credentials = fields.credentials;
      if (fields.location !== undefined) updateData.location = fields.location;
      if (fields.website !== undefined) updateData.website = fields.website;
      if (fields.timezone !== undefined) updateData.timezone = fields.timezone;
      if (fields.avatarUrl !== undefined) updateData.avatarUrl = fields.avatarUrl;
      await db.update(users).set(updateData).where(eq(users.id, userId));
      return { success: true };
    }),

  sendPasswordReset: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const { db, orgId } = await requireActiveOrgUserMembership(ctx, input.userId);
      const [user] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      if (!user.email) throw new TRPCError({ code: "BAD_REQUEST", message: "User has no email address" });
      const resetToken = randomBytes(32).toString("hex");
      const resetExpiry = new Date(Date.now() + 3600_000); // 1 hour
      await db.update(users).set({ resetToken, resetTokenExpiry: resetExpiry }).where(eq(users.id, user.id));
      const [organization] = await db
        .select({
          slug: organizations.slug,
          customDomain: organizations.customDomain,
          domainVerificationStatus: organizations.domainVerificationStatus,
        })
        .from(organizations)
        .where(eq(organizations.id, orgId))
        .limit(1);
      if (!organization) throw new TRPCError({ code: "NOT_FOUND", message: "Active organization not found" });
      const resetUrl = `${getOrgBaseUrl(
        organization.slug,
        organization.customDomain,
        organization.domainVerificationStatus,
      )}/reset-password?token=${resetToken}`;
      const { subject, htmlBody } = buildPasswordResetEmail({
        firstName: user.firstName || user.name || "there",
        resetUrl,
      });
      await sendEmail({ to: { name: user.firstName || user.name || "User", email: user.email }, subject, htmlBody });
      return { success: true, email: user.email };
    }),

  setPassword: protectedProcedure
    .input(z.object({ userId: z.number(), newPassword: z.string().min(8) }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const { db } = await requireActiveOrgUserMembership(ctx, input.userId);
      const [user] = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.id, input.userId)).limit(1);
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      const passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);
      await db.update(users).set({ passwordHash, emailVerified: true, resetToken: null, resetTokenExpiry: null }).where(eq(users.id, input.userId));
      return { success: true, email: user.email };
    }),

  // ─── Membership Access ────────────────────────────────────────────────────

  grantBrandMembership: protectedProcedure
    .input(z.object({
      userId: z.number(),
      brand: z.string(),
      tier: z.string().optional(),
      expiresAt: z.string().optional(),
      sendNotification: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      assertPlatformAdmin(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Grant premium access within the org context
      await db.update(users).set({ isPremium: true }).where(eq(users.id, input.userId));
      return { success: true };
    }),

  revokeBrandMembership: protectedProcedure
    .input(z.object({ userId: z.number(), brand: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      assertPlatformAdmin(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(users).set({ isPremium: false }).where(eq(users.id, input.userId));
      return { success: true };
    }),

  // ─── Course Enrollment Management ────────────────────────────────────────

  listAllCourses: protectedProcedure
    .query(async ({ ctx }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const orgId = await getOrgIdForUserWithFallback(ctx.user.id, ctx.user.role);
      const rows = await db
        .select({ id: lmsCourses.id, title: lmsCourses.title, type: lmsCourses.type, status: lmsCourses.status, thumbnailUrl: lmsCourses.thumbnailUrl })
        .from(lmsCourses)
        .where(orgId ? eq(lmsCourses.orgId, orgId) : undefined)
        .orderBy(asc(lmsCourses.title));
      return rows;
    }),

  enrollInCourse: protectedProcedure
    .input(z.object({
      userId: z.number(),
      courseId: z.number(),
      source: z.string().optional(),
      expiresAt: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const { db, orgId } = await requireActiveOrgUserMembership(ctx, input.userId);
      // Check if already enrolled
      const [existing] = await db
        .select({ id: lmsEnrollments.id, status: lmsEnrollments.status })
        .from(lmsEnrollments)
        .where(and(eq(lmsEnrollments.userId, input.userId), eq(lmsEnrollments.courseId, input.courseId), eq(lmsEnrollments.orgId, orgId)))
        .limit(1);
      if (existing) {
        if (existing.status === "active" || existing.status === "completed") {
          throw new TRPCError({ code: "CONFLICT", message: "User is already enrolled in this course" });
        }
        // Re-activate
        await db.update(lmsEnrollments).set({ status: "active" }).where(eq(lmsEnrollments.id, existing.id));
        return { success: true, enrollmentId: existing.id };
      }
      const [course] = await db.select({ id: lmsCourses.id, title: lmsCourses.title, orgId: lmsCourses.orgId }).from(lmsCourses).where(eq(lmsCourses.id, input.courseId)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND", message: "Course not found" });
      if (course.orgId !== orgId) throw new TRPCError({ code: "FORBIDDEN", message: "Course does not belong to the active organization." });
      const [inserted] = await db.insert(lmsEnrollments).values({
        orgId,
        userId: input.userId,
        courseId: input.courseId,
        status: "active",
        source: input.source ?? "manual",
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      }).$returningId();
      return { success: true, enrollmentId: inserted.id };
    }),

  unenrollFromCourse: protectedProcedure
    .input(z.object({ userId: z.number(), enrollmentId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const { db, orgId } = await requireActiveOrgUserMembership(ctx, input.userId);
      const [enrollment] = await db.select({ userId: lmsEnrollments.userId, orgId: lmsEnrollments.orgId }).from(lmsEnrollments).where(eq(lmsEnrollments.id, input.enrollmentId)).limit(1);
      if (!enrollment || enrollment.userId !== input.userId || enrollment.orgId !== orgId) throw new TRPCError({ code: "FORBIDDEN", message: "Enrollment does not belong to the active organization and user." });
      await db.update(lmsEnrollments).set({ status: "cancelled" }).where(eq(lmsEnrollments.id, input.enrollmentId));
      return { success: true };
    }),

  updateEnrollmentExpiry: protectedProcedure
    .input(z.object({ enrollmentId: z.number(), expiresAt: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [enrollment] = await db.select({ orgId: lmsEnrollments.orgId }).from(lmsEnrollments).where(eq(lmsEnrollments.id, input.enrollmentId)).limit(1);
      const orgId = await getOrgIdForUserWithFallback(ctx.user.id, ctx.user.role);
      if (!enrollment || !orgId || enrollment.orgId !== orgId) throw new TRPCError({ code: "FORBIDDEN", message: "Enrollment does not belong to the active organization." });
      await db.update(lmsEnrollments).set({
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        accessExpiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      }).where(eq(lmsEnrollments.id, input.enrollmentId));
      return { success: true };
    }),

  resendEnrollmentEmail: protectedProcedure
    .input(z.object({ userId: z.number(), courseId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const { db, orgId } = await requireActiveOrgUserMembership(ctx, input.userId);
      const [user] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
      const [course] = await db.select().from(lmsCourses).where(eq(lmsCourses.id, input.courseId)).limit(1);
      if (!user || !course) throw new TRPCError({ code: "NOT_FOUND" });
      if (course.orgId !== orgId) throw new TRPCError({ code: "FORBIDDEN", message: "Course does not belong to the active organization." });
      if (user.email) {
        await sendEnrollmentEmail({
          to: { name: user.displayName || user.name || user.email, email: user.email },
          courseTitle: course.title,
          courseSlug: course.slug,
          orgId: course.orgId,
        });
      }
      return { success: true };
    }),

  resendMembershipConfirmation: protectedProcedure
    .input(z.object({ userId: z.number(), brand: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const { db } = await requireActiveOrgUserMembership(ctx, input.userId);
      const [user] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
      if (!user || !user.email) throw new TRPCError({ code: "NOT_FOUND" });
      await sendEmail({
        to: { name: user.firstName || user.name || "Member", email: user.email },
        subject: "Your Teachific membership is active",
        htmlBody: `<p>Hi ${user.firstName || user.name || "there"},</p><p>Your membership is active. You can access your content by logging in.</p>`,
      });
      return { success: true };
    }),

  // ─── Subscription Management ──────────────────────────────────────────────

  cancelLmsEnrollmentSubscription: protectedProcedure
    .input(z.object({ enrollmentId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [enrollment] = await db.select().from(lmsEnrollments).where(eq(lmsEnrollments.id, input.enrollmentId)).limit(1);
      if (!enrollment) throw new TRPCError({ code: "NOT_FOUND" });
      const orgId = await getOrgIdForUserWithFallback(ctx.user.id, ctx.user.role);
      if (!orgId || enrollment.orgId !== orgId) throw new TRPCError({ code: "FORBIDDEN", message: "Enrollment does not belong to the active organization." });
      if (enrollment.stripeSubscriptionId) {
        try {
          const { getStripe } = await import("../stripePlans");
          const stripe = getStripe();
          await stripe.subscriptions.cancel(enrollment.stripeSubscriptionId);
        } catch (e) {
          console.error("[adminUser] Failed to cancel Stripe subscription:", e);
        }
      }
      await db.update(lmsEnrollments).set({ status: "cancelled" }).where(eq(lmsEnrollments.id, input.enrollmentId));
      return { success: true };
    }),

  cancelLmsOrderSubscription: protectedProcedure
    .input(z.object({ orderId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [order] = await db.select().from(lmsOrders).where(eq(lmsOrders.id, input.orderId)).limit(1);
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      const orgId = await getOrgIdForUserWithFallback(ctx.user.id, ctx.user.role);
      if (!orgId || order.orgId !== orgId) throw new TRPCError({ code: "FORBIDDEN", message: "Order does not belong to the active organization." });
      if (order.stripeSubscriptionId) {
        try {
          const { getStripe } = await import("../stripePlans");
          const stripe = getStripe();
          await stripe.subscriptions.cancel(order.stripeSubscriptionId);
        } catch (e) {
          console.error("[adminUser] Failed to cancel Stripe subscription:", e);
        }
      }
      await db.update(lmsOrders).set({ status: "refunded" }).where(eq(lmsOrders.id, input.orderId));
      return { success: true };
    }),

  cancelStripeSubscription: protectedProcedure
    .input(z.object({ subscriptionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      assertPlatformAdmin(ctx.user.role);
      try {
        const { getStripe } = await import("../stripePlans");
        const stripe = getStripe();
        await stripe.subscriptions.cancel(input.subscriptionId);
        return { success: true };
      } catch (e: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: e.message });
      }
    }),

  syncStripeSubscription: protectedProcedure
    .input(z.object({ subscriptionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      assertPlatformAdmin(ctx.user.role);
      try {
        const { getStripe } = await import("../stripePlans");
        const stripe = getStripe();
        const sub = await stripe.subscriptions.retrieve(input.subscriptionId);
        return {
          success: true,
          status: sub.status,
          currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
        };
      } catch (e: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: e.message });
      }
    }),

  cancelNativeMembership: protectedProcedure
    .input(z.object({ membershipMemberId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [mm] = await db
        .select({ id: membershipMembers.id, orgId: memberships.orgId })
        .from(membershipMembers)
        .leftJoin(memberships, eq(membershipMembers.membershipId, memberships.id))
        .where(eq(membershipMembers.id, input.membershipMemberId))
        .limit(1);
      if (!mm) throw new TRPCError({ code: "NOT_FOUND" });
      const orgId = await getOrgIdForUserWithFallback(ctx.user.id, ctx.user.role);
      if (!orgId || mm.orgId !== orgId) throw new TRPCError({ code: "FORBIDDEN", message: "Membership does not belong to the active organization." });
      if (mm.stripeSubscriptionId) {
        try {
          const { getStripe } = await import("../stripePlans");
          const stripe = getStripe();
          await stripe.subscriptions.cancel(mm.stripeSubscriptionId);
        } catch (e) {
          console.error("[adminUser] Failed to cancel Stripe membership subscription:", e);
        }
      }
      await db.update(membershipMembers).set({ status: "cancelled", cancelledAt: new Date() }).where(eq(membershipMembers.id, input.membershipMemberId));
      return { success: true };
    }),

  revokeNativeMembership: protectedProcedure
    .input(z.object({ membershipMemberId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [membership] = await db
        .select({ orgId: memberships.orgId })
        .from(membershipMembers)
        .leftJoin(memberships, eq(membershipMembers.membershipId, memberships.id))
        .where(eq(membershipMembers.id, input.membershipMemberId))
        .limit(1);
      if (!membership) throw new TRPCError({ code: "NOT_FOUND" });
      const orgId = await getOrgIdForUserWithFallback(ctx.user.id, ctx.user.role);
      if (!orgId || membership.orgId !== orgId) throw new TRPCError({ code: "FORBIDDEN", message: "Membership does not belong to the active organization." });
      await db.update(membershipMembers).set({ status: "cancelled", cancelledAt: new Date() }).where(eq(membershipMembers.id, input.membershipMemberId));
      return { success: true };
    }),

  // ─── Refunds ──────────────────────────────────────────────────────────────

  refundPayment: protectedProcedure
    .input(z.object({
      paymentIntentId: z.string(),
      reason: z.enum(["duplicate", "fraudulent", "requested_by_customer"]).optional(),
      amount: z.number().optional(), // cents, partial refund
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      assertPlatformAdmin(ctx.user.role);
      try {
        const { getStripe } = await import("../stripePlans");
        const stripe = getStripe();
        const refundParams: any = { payment_intent: input.paymentIntentId };
        if (input.reason) refundParams.reason = input.reason;
        if (input.amount) refundParams.amount = input.amount;
        const refund = await stripe.refunds.create(refundParams);
        return { success: true, refundId: refund.id, status: refund.status };
      } catch (e: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: e.message });
      }
    }),

  // ─── Cohort Groups ────────────────────────────────────────────────────────

  listCohortGroups: protectedProcedure
    .input(z.object({ courseId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const orgId = await getOrgIdForUserWithFallback(ctx.user.id, ctx.user.role);
      const [course] = await db.select({ orgId: lmsCourses.orgId }).from(lmsCourses).where(eq(lmsCourses.id, input.courseId)).limit(1);
      if (!course || !orgId || course.orgId !== orgId) throw new TRPCError({ code: "FORBIDDEN", message: "Course does not belong to the active organization." });
      const rows = await db
        .select({ id: lmsCohortGroups.id, name: lmsCohortGroups.name, status: lmsCohortGroups.status, startDate: lmsCohortGroups.startDate, endDate: lmsCohortGroups.endDate, maxStudents: lmsCohortGroups.maxStudents })
        .from(lmsCohortGroups)
        .where(
          and(
            eq(lmsCohortGroups.courseId, input.courseId),
            orgId ? eq(lmsCohortGroups.orgId, orgId) : undefined
          )
        )
        .orderBy(asc(lmsCohortGroups.name));
      return rows;
    }),

  assignCohortGroup: protectedProcedure
    .input(z.object({ userId: z.number(), courseId: z.number(), cohortGroupId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const { db, orgId } = await requireActiveOrgUserMembership(ctx, input.userId);
      const [group] = await db
        .select({ name: lmsCohortGroups.name, orgId: lmsCohortGroups.orgId, courseId: lmsCohortGroups.courseId })
        .from(lmsCohortGroups)
        .where(eq(lmsCohortGroups.id, input.cohortGroupId))
        .limit(1);
      if (!group || group.orgId !== orgId || group.courseId !== input.courseId) throw new TRPCError({ code: "FORBIDDEN", message: "Cohort group does not belong to the active organization and course." });
      // Check if already assigned
      const [existing] = await db
        .select({ id: lmsCohortGroupEnrollments.id })
        .from(lmsCohortGroupEnrollments)
        .where(and(eq(lmsCohortGroupEnrollments.userId, input.userId), eq(lmsCohortGroupEnrollments.cohortGroupId, input.cohortGroupId)))
        .limit(1);
      if (!existing) {
        await db.insert(lmsCohortGroupEnrollments).values({
          orgId,
          cohortGroupId: input.cohortGroupId,
          userId: input.userId,
          courseId: input.courseId,
          enrolledAt: new Date(),
        });
      }
      return { success: true, groupName: group?.name ?? "Group" };
    }),

  // ─── Workshop Instances ───────────────────────────────────────────────────

  listWorkshopInstances: protectedProcedure
    .input(z.object({ workshopId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const orgId = await getOrgIdForUserWithFallback(ctx.user.id, ctx.user.role);
      const [workshop] = await db.select({ orgId: workshops.orgId }).from(workshops).where(eq(workshops.id, input.workshopId)).limit(1);
      if (!workshop || (orgId && workshop.orgId !== orgId)) throw new TRPCError({ code: "FORBIDDEN", message: "Workshop does not belong to the active organization." });
      const rows = await db
        .select({ id: workshopInstances.id, title: workshopInstances.title, startDate: workshopInstances.startDate, status: workshopInstances.status, enrolledCount: workshopInstances.enrolledCount, capacity: workshopInstances.capacity })
        .from(workshopInstances)
        .where(eq(workshopInstances.workshopId, input.workshopId))
        .orderBy(asc(workshopInstances.startDate));
      return rows;
    }),

  assignWorkshopInstance: protectedProcedure
    .input(z.object({ userId: z.number(), workshopId: z.number(), instanceId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const { db, orgId } = await requireActiveOrgUserMembership(ctx, input.userId);
      const [workshop] = await db.select({ orgId: workshops.orgId }).from(workshops).where(eq(workshops.id, input.workshopId)).limit(1);
      if (!workshop || workshop.orgId !== orgId) throw new TRPCError({ code: "FORBIDDEN", message: "Workshop does not belong to the active organization." });
      const [instance] = await db.select({ id: workshopInstances.id, title: workshopInstances.title }).from(workshopInstances).where(and(eq(workshopInstances.id, input.instanceId), eq(workshopInstances.workshopId, input.workshopId))).limit(1);
      if (!instance) throw new TRPCError({ code: "FORBIDDEN", message: "Workshop instance does not belong to the selected workshop." });
      // Check if already enrolled
      const [existing] = await db
        .select({ id: workshopEnrollments.id })
        .from(workshopEnrollments)
        .where(and(eq(workshopEnrollments.userId, input.userId), eq(workshopEnrollments.instanceId, input.instanceId)))
        .limit(1);
      if (!existing) {
        await db.insert(workshopEnrollments).values({
          workshopId: input.workshopId,
          instanceId: input.instanceId,
          userId: input.userId,
          amountPaid: 0,
          currency: "usd",
          status: "active",
        });
      }
      return { success: true, instanceTitle: instance?.title ?? "Instance" };
    }),

  // ─── Certificates ─────────────────────────────────────────────────────────

  issueCertificate: protectedProcedure
    .input(z.object({ userId: z.number(), courseId: z.number(), enrollmentId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { orgId } = await requireActiveOrgUserMembership(ctx, input.userId);
      const [enrollment] = await db
        .select({ orgId: lmsEnrollments.orgId, courseId: lmsEnrollments.courseId })
        .from(lmsEnrollments)
        .where(and(eq(lmsEnrollments.id, input.enrollmentId), eq(lmsEnrollments.userId, input.userId)))
        .limit(1);
      if (!enrollment || enrollment.orgId !== orgId || enrollment.courseId !== input.courseId) throw new TRPCError({ code: "FORBIDDEN", message: "Enrollment does not belong to the active organization and course." });
      // Check if cert already exists
      const [existing] = await db
        .select({ id: lmsCertificates.id })
        .from(lmsCertificates)
        .where(and(eq(lmsCertificates.userId, input.userId), eq(lmsCertificates.courseId, input.courseId)))
        .limit(1);
      if (existing) return { success: true, certificateId: existing.id, alreadyExists: true };
      const certNumber = `CERT-${Date.now()}-${input.userId}`;
      const [inserted] = await db.insert(lmsCertificates).values({
        orgId,
        enrollmentId: input.enrollmentId,
        userId: input.userId,
        courseId: input.courseId,
        certificateNumber: certNumber,
        issuedAt: new Date(),
      }).$returningId();
      return { success: true, certificateId: inserted.id, alreadyExists: false };
    }),

  removeCertificate: protectedProcedure
    .input(z.object({ certificateId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [certificate] = await db.select({ orgId: lmsCertificates.orgId }).from(lmsCertificates).where(eq(lmsCertificates.id, input.certificateId)).limit(1);
      if (!certificate) throw new TRPCError({ code: "NOT_FOUND" });
      const orgId = await getOrgIdForUserWithFallback(ctx.user.id, ctx.user.role);
      if (!orgId || certificate.orgId !== orgId) throw new TRPCError({ code: "FORBIDDEN", message: "Certificate does not belong to the active organization." });
      await db.delete(lmsCertificates).where(eq(lmsCertificates.id, input.certificateId));
      return { success: true };
    }),

  // ─── Email History ────────────────────────────────────────────────────────

  getUserEmailHistory: protectedProcedure
    .input(z.object({ userId: z.number(), page: z.number().default(1), pageSize: z.number().default(25) }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      assertPlatformAdmin(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const offset = (input.page - 1) * input.pageSize;
      const rows = await db
        .select()
        .from(emailSendLog)
        .where(eq(emailSendLog.userId, input.userId))
        .orderBy(desc(emailSendLog.sentAt))
        .limit(input.pageSize)
        .offset(offset);
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(emailSendLog)
        .where(eq(emailSendLog.userId, input.userId));
      return { emails: rows, total: Number(count) };
    }),

  resendEmailFromLog: protectedProcedure
    .input(z.object({ emailLogId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      assertPlatformAdmin(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [log] = await db.select().from(emailSendLog).where(eq(emailSendLog.id, input.emailLogId)).limit(1);
      if (!log) throw new TRPCError({ code: "NOT_FOUND" });
      // Re-send the email using the stored metadata
      if (log.recipientEmail) {
        await sendEmail({
          to: { name: log.recipientName || "User", email: log.recipientEmail },
          subject: `[Resent] ${log.subject}`,
          htmlBody: `<p>This is a resent copy of a previous email.</p><hr/><p>Original subject: ${log.subject}</p>`,
        });
      }
      return { success: true };
    }),

  // ─── Course Progress ──────────────────────────────────────────────────────

  getUserCourseProgress: protectedProcedure
    .input(z.object({ userId: z.number(), enrollmentId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const { db, orgId } = await requireActiveOrgUserMembership(ctx, input.userId);
      const [enrollment] = await db
        .select({ id: lmsEnrollments.id, courseId: lmsEnrollments.courseId, progressPercent: lmsEnrollments.progressPercent, completedAt: lmsEnrollments.completedAt, enrolledAt: lmsEnrollments.enrolledAt, lastAccessedAt: lmsEnrollments.lastAccessedAt })
        .from(lmsEnrollments)
        .where(and(eq(lmsEnrollments.id, input.enrollmentId), eq(lmsEnrollments.userId, input.userId), eq(lmsEnrollments.orgId, orgId)))
        .limit(1);
      if (!enrollment) throw new TRPCError({ code: "NOT_FOUND" });
      // Get all lessons for this course
      const lessons = await db
        .select({ id: lmsLessons.id, title: lmsLessons.title, sectionId: lmsLessons.sectionId, position: lmsLessons.position, type: lmsLessons.type, countTowardCompletion: lmsLessons.countTowardCompletion })
        .from(lmsLessons)
        .where(eq(lmsLessons.courseId, enrollment.courseId))
        .orderBy(asc(lmsLessons.position));
      // Get progress for each lesson
      const progressRows = await db
        .select()
        .from(lmsLessonProgress)
        .where(eq(lmsLessonProgress.enrollmentId, input.enrollmentId));
      const progressMap = new Map(progressRows.map(p => [p.lessonId, p]));
      const totalLessons = lessons.filter(l => l.countTowardCompletion).length;
      const completedLessons = lessons.filter(l => l.countTowardCompletion && progressMap.get(l.id)?.status === "completed").length;
      return {
        enrollment,
        lessons: lessons.map(l => ({
          ...l,
          progress: progressMap.get(l.id) ?? null,
        })),
        totalLessons,
        completedLessons,
        progressPct: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
      };
    }),

  // ─── Activity Log ─────────────────────────────────────────────────────────

  getUserActivityLog: protectedProcedure
    .input(z.object({ userId: z.number(), page: z.number().default(1), pageSize: z.number().default(50) }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const { db } = await requireActiveOrgUserMembership(ctx, input.userId);
      const offset = (input.page - 1) * input.pageSize;
      const rows = await db
        .select()
        .from(memberActivityEvents)
        .where(eq(memberActivityEvents.userId, input.userId))
        .orderBy(desc(memberActivityEvents.createdAt))
        .limit(input.pageSize)
        .offset(offset);
      return { events: rows, total: rows.length };
    }),

  // ─── Login History ────────────────────────────────────────────────────────

  getUserLoginHistory: protectedProcedure
    .input(z.object({ userId: z.number(), page: z.number().default(1), pageSize: z.number().default(50) }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const { db } = await requireActiveOrgUserMembership(ctx, input.userId);
      const offset = (input.page - 1) * input.pageSize;
      const rows = await db
        .select()
        .from(userLoginEvents)
        .where(eq(userLoginEvents.userId, input.userId))
        .orderBy(desc(userLoginEvents.createdAt))
        .limit(input.pageSize)
        .offset(offset);
      return { logins: rows, total: rows.length };
    }),

  // ─── Email Aliases ────────────────────────────────────────────────────────

  listEmailAliases: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const { db } = await requireActiveOrgUserMembership(ctx, input.userId);
      return db.select().from(userEmailAliases).where(eq(userEmailAliases.userId, input.userId));
    }),

  addEmailAlias: protectedProcedure
    .input(z.object({ userId: z.number(), email: z.string().email(), label: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const { db } = await requireActiveOrgUserMembership(ctx, input.userId);
      await db.insert(userEmailAliases).values({
        userId: input.userId,
        email: input.email,
        label: input.label,
        source: "admin_added",
      });
      return { success: true };
    }),

  removeEmailAlias: protectedProcedure
    .input(z.object({ aliasId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [alias] = await db.select({ userId: userEmailAliases.userId }).from(userEmailAliases).where(eq(userEmailAliases.id, input.aliasId)).limit(1);
      if (!alias) throw new TRPCError({ code: "NOT_FOUND", message: "Email alias not found." });
      await requireActiveOrgUserMembership(ctx, alias.userId);
      await db.delete(userEmailAliases).where(eq(userEmailAliases.id, input.aliasId));
      return { success: true };
    }),

  // ─── User Merge ───────────────────────────────────────────────────────────

  searchUsersForMerge: protectedProcedure
    .input(z.object({ query: z.string().min(2) }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      assertPlatformAdmin(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db
        .select({ id: users.id, name: users.name, email: users.email, displayName: users.displayName, avatarUrl: users.avatarUrl, role: users.role, createdAt: users.createdAt })
        .from(users)
        .where(
          or(
            like(users.email, `%${input.query}%`),
            like(users.name, `%${input.query}%`),
            like(users.displayName, `%${input.query}%`)
          )
        )
        .limit(20);
      return rows;
    }),

  mergeUsers: protectedProcedure
    .input(z.object({
      primaryUserId: z.number(),
      secondaryUserId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertPlatformAdmin(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (input.primaryUserId === input.secondaryUserId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot merge a user with themselves" });
      }
      // Transfer enrollments from secondary to primary
      await db.update(lmsEnrollments).set({ userId: input.primaryUserId }).where(eq(lmsEnrollments.userId, input.secondaryUserId));
      // Transfer certificates
      await db.update(lmsCertificates).set({ userId: input.primaryUserId }).where(eq(lmsCertificates.userId, input.secondaryUserId));
      // Transfer org memberships (skip duplicates)
      const primaryOrgs = await db.select({ orgId: orgMembers.orgId }).from(orgMembers).where(eq(orgMembers.userId, input.primaryUserId));
      const primaryOrgIds = new Set(primaryOrgs.map(o => o.orgId));
      const secondaryOrgs = await db.select().from(orgMembers).where(eq(orgMembers.userId, input.secondaryUserId));
      for (const om of secondaryOrgs) {
        if (!primaryOrgIds.has(om.orgId)) {
          await db.update(orgMembers).set({ userId: input.primaryUserId }).where(eq(orgMembers.id, om.id));
        } else {
          await db.delete(orgMembers).where(eq(orgMembers.id, om.id));
        }
      }
      // Add secondary email as alias
      const [secondary] = await db.select({ email: users.email }).from(users).where(eq(users.id, input.secondaryUserId)).limit(1);
      if (secondary?.email) {
        const [existingAlias] = await db.select({ id: userEmailAliases.id }).from(userEmailAliases)
          .where(and(eq(userEmailAliases.userId, input.primaryUserId), eq(userEmailAliases.email, secondary.email)))
          .limit(1);
        if (!existingAlias) {
          await db.insert(userEmailAliases).values({
            userId: input.primaryUserId,
            email: secondary.email,
            source: "account_merge",
          });
        }
      }
      // Soft-delete secondary user by clearing sensitive fields
      await db.update(users).set({
        email: `merged-${input.secondaryUserId}@deleted.invalid`,
        name: `[Merged into ${input.primaryUserId}]`,
        passwordHash: null,
        resetToken: null,
      } as any).where(eq(users.id, input.secondaryUserId));
      return { success: true };
    }),

  // ─── Coupon / Promo Code Management ─────────────────────────────────────────
  createCoupon: protectedProcedure
    .input(z.object({
      name: z.string(),
      discountType: z.enum(["percent", "fixed"]),
      discountValue: z.number().positive(),
      promoCode: z.string().optional(),
      maxRedemptions: z.number().optional(),
      redeemBy: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireOrgAdmin(ctx.user.id, ctx.user.role);
      assertPlatformAdmin(ctx.user.role);
      const { getStripe } = await import("../stripePlans");
      const stripe = getStripe();
      // Create Stripe coupon
      const coupon = await stripe.coupons.create({
        name: input.name,
        ...(input.discountType === "percent"
          ? { percent_off: input.discountValue }
          : { amount_off: Math.round(input.discountValue * 100), currency: "usd" }),
        ...(input.maxRedemptions ? { max_redemptions: input.maxRedemptions } : {}),
        ...(input.redeemBy ? { redeem_by: Math.floor(new Date(input.redeemBy).getTime() / 1000) } : {}),
      });
      let promoCode: any = null;
      if (input.promoCode) {
        promoCode = await stripe.promotionCodes.create({
          coupon: coupon.id,
          code: input.promoCode,
          ...(input.maxRedemptions ? { max_redemptions: input.maxRedemptions } : {}),
        });
      }
      return { coupon, promoCode };
    }),

  deactivateCoupon: protectedProcedure
    .input(z.object({ couponId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requireOrgAdmin(ctx.user.id, ctx.user.role);
      assertPlatformAdmin(ctx.user.role);
      const { getStripe } = await import("../stripePlans");
      const stripe = getStripe();
      await stripe.coupons.del(input.couponId);
      return { success: true };
    }),

  deactivatePromoCode: protectedProcedure
    .input(z.object({ promoCodeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requireOrgAdmin(ctx.user.id, ctx.user.role);
      assertPlatformAdmin(ctx.user.role);
      const { getStripe } = await import("../stripePlans");
      const stripe = getStripe();
      await stripe.promotionCodes.update(input.promoCodeId, { active: false });
      return { success: true };
    }),

  listCoupons: protectedProcedure
    .input(z.object({ limit: z.number().default(50) }))
    .query(async ({ ctx, input }) => {
      await requireOrgAdmin(ctx.user.id, ctx.user.role);
      assertPlatformAdmin(ctx.user.role);
      const { getStripe } = await import("../stripePlans");
      const stripe = getStripe();
      const coupons = await stripe.coupons.list({ limit: input.limit });
      // Fetch promo codes for each coupon
      const promoCodesByCoupon: Record<string, any[]> = {};
      for (const coupon of coupons.data) {
        const promos = await stripe.promotionCodes.list({ coupon: coupon.id, limit: 20 });
        promoCodesByCoupon[coupon.id] = promos.data;
      }
      return { coupons: coupons.data, promoCodesByCoupon };
    }),

  // ─── Sales Dashboard ─────────────────────────────────────────────────────────
  getSalesAnalytics: protectedProcedure
    .input(z.object({
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const orgId = await requireOrgAdmin(ctx.user.id, ctx.user.role);
      const db = await getDb();
      if (!db) return { summary: { totalRevenue: 0, totalSales: 0, avgOrderValue: 0 }, dailySeries: [], byType: [], byProduct: [] };
      const { funnelPurchases, lmsOrders, lmsCourses } = await import("../../drizzle/schema");
      const { eq, and, gte, lte, sql, desc } = await import("drizzle-orm");
      const dateFromTs = input.dateFrom ? new Date(input.dateFrom) : null;
      const dateToTs = input.dateTo ? new Date(input.dateTo + "T23:59:59") : null;
      // Build conditions for funnel purchases
      const fpConditions: any[] = [eq(funnelPurchases.orgId, orgId), eq(funnelPurchases.status, "paid")];
      if (dateFromTs) fpConditions.push(gte(funnelPurchases.createdAt, dateFromTs));
      if (dateToTs) fpConditions.push(lte(funnelPurchases.createdAt, dateToTs));
      // Build conditions for lms orders
      const loConditions: any[] = [eq(lmsOrders.orgId, orgId), eq(lmsOrders.status, "completed")];
      if (dateFromTs) loConditions.push(gte(lmsOrders.createdAt, dateFromTs));
      if (dateToTs) loConditions.push(lte(lmsOrders.createdAt, dateToTs));
      // Fetch all paid funnel purchases
      const fpRows = await db.select({
        amount: funnelPurchases.amount,
        currency: funnelPurchases.currency,
        productType: funnelPurchases.productType,
        productName: funnelPurchases.productName,
        productId: funnelPurchases.productId,
        createdAt: funnelPurchases.createdAt,
      }).from(funnelPurchases).where(and(...fpConditions));
      // Fetch all completed lms orders
      const loRows = await db.select({
        amount: lmsOrders.amount,
        currency: lmsOrders.currency,
        courseTitle: lmsCourses.title,
        courseId: lmsOrders.courseId,
        createdAt: lmsOrders.createdAt,
      }).from(lmsOrders).leftJoin(lmsCourses, eq(lmsOrders.courseId, lmsCourses.id)).where(and(...loConditions));
      // Combine all sales
      const allSales = [
        ...fpRows.map(r => ({ amount: Number(r.amount), productType: r.productType, productName: r.productName, productId: r.productId, createdAt: r.createdAt })),
        ...loRows.map(r => ({ amount: Number(r.amount), productType: 'course', productName: r.courseTitle ?? 'Course', productId: r.courseId, createdAt: r.createdAt })),
      ];
      const totalRevenue = allSales.reduce((s, r) => s + r.amount, 0);
      const totalSales = allSales.length;
      const avgOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;
      // Daily series
      const dailyMap: Record<string, number> = {};
      for (const s of allSales) {
        const day = new Date(s.createdAt).toISOString().slice(0, 10);
        dailyMap[day] = (dailyMap[day] ?? 0) + s.amount;
      }
      const dailySeries = Object.entries(dailyMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, revenue]) => ({ date, revenue }));
      // By type
      const byTypeMap: Record<string, number> = {};
      for (const s of allSales) {
        byTypeMap[s.productType] = (byTypeMap[s.productType] ?? 0) + s.amount;
      }
      const byType = Object.entries(byTypeMap).map(([productType, revenue]) => ({ productType, revenue })).sort((a, b) => b.revenue - a.revenue);
      // By product
      const byProductMap: Record<string, { productName: string; productType: string; revenue: number; sales: number; avgPrice: number }> = {};
      for (const s of allSales) {
        const key = `${s.productType}-${s.productId ?? s.productName}`;
        if (!byProductMap[key]) byProductMap[key] = { productName: s.productName, productType: s.productType, revenue: 0, sales: 0, avgPrice: 0 };
        byProductMap[key].revenue += s.amount;
        byProductMap[key].sales += 1;
      }
      const byProduct = Object.values(byProductMap).map(p => ({ ...p, avgPrice: p.sales > 0 ? p.revenue / p.sales : 0 })).sort((a, b) => b.revenue - a.revenue);
      return { summary: { totalRevenue, totalSales, avgOrderValue }, dailySeries, byType, byProduct };
    }),

  listAllSales: protectedProcedure
    .input(z.object({
      page: z.number().default(1),
      pageSize: z.number().default(25),
      status: z.string().optional(),
      search: z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const orgId = await requireOrgAdmin(ctx.user.id, ctx.user.role);
      const db = await getDb();
      if (!db) return { sales: [], total: 0, totalPages: 0 };
      const { funnelPurchases, lmsOrders, lmsCourses, users: usersTable } = await import("../../drizzle/schema");
      const { eq, and, gte, lte, like, or } = await import("drizzle-orm");
      const dateFromTs = input.dateFrom ? new Date(input.dateFrom) : null;
      const dateToTs = input.dateTo ? new Date(input.dateTo + "T23:59:59") : null;
      // Funnel purchases
      const fpConditions: any[] = [eq(funnelPurchases.orgId, orgId)];
      if (input.status) fpConditions.push(eq(funnelPurchases.status, input.status as any));
      if (dateFromTs) fpConditions.push(gte(funnelPurchases.createdAt, dateFromTs));
      if (dateToTs) fpConditions.push(lte(funnelPurchases.createdAt, dateToTs));
      if (input.search) fpConditions.push(or(like(funnelPurchases.email, `%${input.search}%`), like(funnelPurchases.name, `%${input.search}%`), like(funnelPurchases.productName, `%${input.search}%`)) as any);
      const fpRows = await db.select({
        id: funnelPurchases.id,
        email: funnelPurchases.email,
        name: funnelPurchases.name,
        userId: funnelPurchases.userId,
        productName: funnelPurchases.productName,
        productType: funnelPurchases.productType,
        amountPaid: funnelPurchases.amount,
        currency: funnelPurchases.currency,
        status: funnelPurchases.status,
        stripePaymentIntentId: funnelPurchases.stripePaymentIntentId,
        sourceType: funnelPurchases.sourceType,
        orderBumps: funnelPurchases.orderBumps,
        purchasedAt: funnelPurchases.createdAt,
      }).from(funnelPurchases).where(and(...fpConditions));
      // LMS orders
      const loConditions: any[] = [eq(lmsOrders.orgId, orgId)];
      if (input.status) loConditions.push(eq(lmsOrders.status, input.status as any));
      if (dateFromTs) loConditions.push(gte(lmsOrders.createdAt, dateFromTs));
      if (dateToTs) loConditions.push(lte(lmsOrders.createdAt, dateToTs));
      const loRows = await db.select({
        id: lmsOrders.id,
        userId: lmsOrders.userId,
        courseTitle: lmsCourses.title,
        amount: lmsOrders.amount,
        currency: lmsOrders.currency,
        status: lmsOrders.status,
        stripePaymentIntentId: lmsOrders.stripePaymentIntentId,
        stripeSubscriptionId: lmsOrders.stripeSubscriptionId,
        createdAt: lmsOrders.createdAt,
        userEmail: usersTable.email,
        userName: usersTable.name,
      }).from(lmsOrders)
        .leftJoin(lmsCourses, eq(lmsOrders.courseId, lmsCourses.id))
        .leftJoin(usersTable, eq(lmsOrders.userId, usersTable.id))
        .where(and(...loConditions));
      // Merge
      const allSales: any[] = [
        ...fpRows.map(r => ({ ...r, amountPaid: Number(r.amountPaid) })),
        ...loRows.map(r => ({ id: r.id, email: r.userEmail ?? '', name: r.userName ?? null, userId: r.userId, productName: r.courseTitle ?? 'Course', productType: 'course', amountPaid: Number(r.amount), currency: r.currency, status: r.status, stripePaymentIntentId: r.stripePaymentIntentId, sourceType: 'lms', orderBumps: null, purchasedAt: r.createdAt })),
      ].sort((a, b) => new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime());
      // Filter by search for LMS orders
      const filtered = input.search
        ? allSales.filter(s => s.email?.includes(input.search!) || s.name?.includes(input.search!) || s.productName?.includes(input.search!))
        : allSales;
      const total = filtered.length;
      const totalPages = Math.ceil(total / input.pageSize);
      const offset = (input.page - 1) * input.pageSize;
      const sales = filtered.slice(offset, offset + input.pageSize);
      return { sales, total, totalPages };
    }),

  resendAccessEmail: protectedProcedure
    .input(z.object({ purchaseId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await getOrgIdForUserWithFallback(ctx.user.id, ctx.user.role);
      if (!orgId) throw new TRPCError({ code: "BAD_REQUEST", message: "No active organization context." });
      await requireOrgAdmin(ctx.user.id, ctx.user.role, orgId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { funnelPurchases } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const [purchase] = await db.select().from(funnelPurchases).where(eq(funnelPurchases.id, input.purchaseId)).limit(1);
      if (!purchase) throw new TRPCError({ code: "NOT_FOUND", message: "Purchase not found" });
      if (purchase.orgId !== orgId) throw new TRPCError({ code: "FORBIDDEN", message: "Purchase does not belong to the active organization." });
      const { sendEmail } = await import("../sendgrid");
      await sendEmail({
        to: [{ email: purchase.email, name: purchase.name ?? undefined }],
        subject: `Your access to ${purchase.productName}`,
        htmlBody: `<p>Hi ${purchase.name ?? 'there'},</p><p>Here is your access to <strong>${purchase.productName}</strong>. Please log in to your account to access your purchase.</p>`,
      });
      return { success: true };
    }),
});
