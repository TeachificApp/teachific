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
import { getDb, getOrCreateAccessToken, getOrgIdForUser, getOrgIdForUserWithFallback, requireOrgAdmin } from "../db";
import { invokeLLM } from "../_core/llm";
import { generateCertificatePdf } from "../lib/certificateGenerator";
import { overlayLearnerData } from "../lib/certificatePdfOverlay";
import { sendCertificateEmail } from "../lib/certificateEmail";
import { sendEnrollmentEmail } from "../lib/enrollmentEmail";
import { buildOrderBumpCheckoutLine } from "../lib/orderBumpCheckout";
import { extractJson, parseLandingBlocks } from "../lib/extractJson";
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
  orgMembers,
  organizations,
} from "../../drizzle/schema";
import { sendEmail, buildFreePreviewConfirmationEmail } from "../_core/email";

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ─── Shared helpers (used by all LMS sub-routers) ────────────────────────────

// Roles that have LMS admin access (matches the users table enum)
const ADMIN_ROLES = ["site_owner", "site_admin", "org_super_admin", "org_admin"] as const;

export async function assertAdmin(ctx: { user: { id: number; role: string } }) {
  if (!(ADMIN_ROLES as readonly string[]).includes(ctx.user.role)) {
    // Re-fetch from DB in case the session role is stale
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [u] = await db.select({ role: users.role }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
    if (!u || !(ADMIN_ROLES as readonly string[]).includes(u.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    }
  }
}

export function generateSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

export async function uniqueSlug(db: Awaited<ReturnType<typeof getDb>>, base: string): Promise<string> {
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  let slug = base;
  let attempt = 0;
  while (true) {
    const [existing] = await db.select({ id: lmsCourses.id }).from(lmsCourses).where(eq(lmsCourses.slug, slug)).limit(1);
    if (!existing) return slug;
    attempt++;
    slug = `${base}-${attempt}`;
  }
}

export async function recalcProgress(db: Awaited<ReturnType<typeof getDb>>, enrollmentId: number) {
  if (!db) return;
  const [enrollRow] = await db.select().from(lmsEnrollments).where(eq(lmsEnrollments.id, enrollmentId)).limit(1);
  if (!enrollRow) return;
  const courseId = enrollRow.courseId;

  // Get all section IDs for this course
  const courseSections = await db.select({ id: lmsSections.id }).from(lmsSections).where(eq(lmsSections.courseId, courseId));
  const sectionIds = courseSections.map(s => s.id);

  // Count lessons that count toward progress:
  // 1. Exclude free-preview lessons hidden after purchase (not visible to enrolled students)
  // 2. Exclude draft lessons (lessonStatus = 'draft' — hidden from learners)
  // 3. Exclude lessons explicitly marked as not counting toward completion
  let totalCount = 0;
  const excludeHiddenPreview = sql`(${lmsLessons.previewMode} != 'preview_hide_after_purchase' OR ${lmsLessons.previewMode} IS NULL) AND ${lmsLessons.lessonStatus} = 'published' AND ${lmsLessons.countTowardCompletion} = 1`;
  if (sectionIds.length > 0) {
    const [totalRows] = await db.select({ count: sql<number>`count(*)` }).from(lmsLessons).where(
      and(
        sql`(${lmsLessons.courseId} = ${courseId} OR ${lmsLessons.sectionId} IN (${sql.join(sectionIds.map(id => sql`${id}`), sql`, `)}))`,
        excludeHiddenPreview
      )
    );
    totalCount = Number(totalRows?.count ?? 0);
  } else {
    const [totalRows] = await db.select({ count: sql<number>`count(*)` }).from(lmsLessons).where(
      and(eq(lmsLessons.courseId, courseId), excludeHiddenPreview)
    );
    totalCount = Number(totalRows?.count ?? 0);
  }
  const total = totalCount;
  if (total === 0) return;

  // Guard: if this enrollment has NO lesson_progress records at all, it was likely synced
  // from Thinkific with a direct progress_pct value. Do not override it — only recalc
  // when the learner has actually interacted with lessons in this platform.
  const [{ anyProgress }] = await db.select({ anyProgress: sql<number>`count(*)` })
    .from(lmsLessonProgress)
    .where(eq(lmsLessonProgress.enrollmentId, enrollmentId));
  if (Number(anyProgress) === 0) return;

  // Count completed lessons — also exclude hidden preview lessons from the completed count
  // so that any stale progress records for those lessons don't inflate the percentage
  const countableIds = await db
    .select({ id: lmsLessons.id })
    .from(lmsLessons)
    .where(
      sectionIds.length > 0
        ? and(
            sql`(${lmsLessons.courseId} = ${courseId} OR ${lmsLessons.sectionId} IN (${sql.join(sectionIds.map(id => sql`${id}`), sql`, `)}))`,
            excludeHiddenPreview
          )
        : and(eq(lmsLessons.courseId, courseId), excludeHiddenPreview)
    );
  const countableIdSet = countableIds.map(r => r.id);
  const completedRows = countableIdSet.length > 0
    ? await db.select({ count: sql<number>`count(*)` }).from(lmsLessonProgress).where(
        and(
          eq(lmsLessonProgress.enrollmentId, enrollmentId),
          isNotNull(lmsLessonProgress.completedAt),
          inArray(lmsLessonProgress.lessonId, countableIdSet)
        )
      )
    : [{ count: 0 }];
  const completed = Number(completedRows[0]?.count ?? 0);
  const pct = Math.round((completed / total) * 100);
  const wasCompleted = !!enrollRow.completedAt;

  await db.update(lmsEnrollments).set({
    progressPct: pct,
    completedAt: pct >= 100 ? new Date() : null,
  }).where(eq(lmsEnrollments.id, enrollmentId));

  // Issue certificate if newly completed and course has hasCertificate enabled
  if (pct >= 100 && !wasCompleted) {
    void issueCertificateIfEnabled(db, enrollmentId, enrollRow.userId, courseId, enrollRow.enrollmentType).catch(e =>
      console.error("[certificate] Failed to issue certificate:", e)
    );
  }
}

export async function issueCertificateIfEnabled(
  db: Awaited<ReturnType<typeof getDb>>,
  enrollmentId: number,
  userId: number,
  courseId: number,
  enrollmentType?: string,
  forceReissue?: boolean
) {
  if (!db) return;
  // Check course has certificate enabled
  const [course] = await db.select({ orgId: lmsCourses.orgId, hasCertificate: lmsCourses.hasCertificate, title: lmsCourses.title, certificateTemplateId: lmsCourses.certificateTemplateId, creditHours: lmsCourses.creditHours, certificateTitleOverride: lmsCourses.certificateTitleOverride }).from(lmsCourses).where(eq(lmsCourses.id, courseId)).limit(1);
  if (!course?.hasCertificate) return;

  // Check if certificate already issued
  const [existing] = await db.select({ id: lmsCertificates.id }).from(lmsCertificates)
    .where(and(eq(lmsCertificates.userId, userId), eq(lmsCertificates.courseId, courseId))).limit(1);
  if (existing) {
    if (!forceReissue) return;
    // Force re-issue: delete the existing certificate so it regenerates with latest data
    await db.delete(lmsCertificates).where(and(eq(lmsCertificates.userId, userId), eq(lmsCertificates.courseId, courseId)));
  }

  // Get user info
  const [user] = await db.select({ name: users.name, email: users.email, displayName: users.displayName, credentials: users.credentials }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.email) return;

  const learnerName = user.displayName || user.name || "Learner";
  const issuedAt = new Date();
  const [organization] = await db.select({
    name: organizations.name,
    logoUrl: organizations.logoUrl,
    customSenderEmail: organizations.customSenderEmail,
    customSenderName: organizations.customSenderName,
    senderDomainVerified: organizations.senderDomainVerified,
  }).from(organizations).where(eq(organizations.id, course.orgId)).limit(1);

  // Fetch certificate template if assigned
  let template: any = null;
  if (course.certificateTemplateId) {
    const [tmpl] = await db.select().from(lmsCertificateTemplates).where(and(
      eq(lmsCertificateTemplates.id, course.certificateTemplateId),
      or(eq(lmsCertificateTemplates.orgId, course.orgId), isNull(lmsCertificateTemplates.orgId)),
    )).limit(1);
    template = tmpl ?? null;
  }
  if (!template) {
    // Prefer the owning organization’s default, then an intentional platform-global default.
    const [organizationDefault] = await db.select().from(lmsCertificateTemplates).where(and(
      eq(lmsCertificateTemplates.orgId, course.orgId),
      eq(lmsCertificateTemplates.isDefault, true),
    )).limit(1);
    if (organizationDefault) {
      template = organizationDefault;
    } else {
      const [platformDefault] = await db.select().from(lmsCertificateTemplates).where(and(
        isNull(lmsCertificateTemplates.orgId),
        eq(lmsCertificateTemplates.isDefault, true),
      )).limit(1);
      template = platformDefault ?? null;
    }
  }

  // Generate PDF — if the template has a custom uploaded PDF, fetch it and
  // overlay the real learner data (replacing {{LEARNER_NAME}} etc.);
  // otherwise generate one programmatically from the template settings.
  let pdfBuffer: Buffer;
  if (template?.pdfTemplateUrl) {
    // Fetch the pre-uploaded custom PDF from S3
    const res = await fetch(template.pdfTemplateUrl);
    if (!res.ok) throw new Error(`Failed to fetch custom PDF template: ${res.status}`);
    const rawBuffer = Buffer.from(await res.arrayBuffer());
    // Replace placeholder strings with real learner data
    const certTitle = (course.certificateTitleOverride && course.certificateTitleOverride.trim()) ? course.certificateTitleOverride.trim() : course.title;
    pdfBuffer = await overlayLearnerData(rawBuffer, {
      learnerName: learnerName,
      courseTitle: certTitle,
      issuedAt,
      creditHours: course.creditHours ?? null,
    });
  } else {
    const certTitle = (course.certificateTitleOverride && course.certificateTitleOverride.trim()) ? course.certificateTitleOverride.trim() : course.title;
    pdfBuffer = await generateCertificatePdf({
      learnerName,
      courseTitle: certTitle,
      issuedAt,
      credentials: user.credentials,
      creditHours: course.creditHours ?? null,
      template,
    });
  }

  // Upload PDF to S3
  const suffix = randomBytes(6).toString("hex");
  const fileKey = `certificates/cert-${userId}-${courseId}-${suffix}.pdf`;
  const { url: certificateUrl } = await storagePut(fileKey, pdfBuffer, "application/pdf");

  // Save certificate record
  await db.insert(lmsCertificates).values({
    orgId: course.orgId,
    userId,
    courseId,
    enrollmentId,
    certificateUrl,
    templateId: template?.id ?? null,
    issuedAt,
  });

  // Send email — skip for admin_preview enrollments (test runs should not send real emails)
  if (enrollmentType !== "admin_preview") {
    const certTitleForEmail = (course.certificateTitleOverride && course.certificateTitleOverride.trim()) ? course.certificateTitleOverride.trim() : course.title;
    await sendCertificateEmail({
      to: { name: learnerName, email: user.email },
      courseTitle: certTitleForEmail,
      certificateUrl,
      pdfBuffer,
      issuedAt,
      organizationName: organization?.name,
      organizationLogoUrl: organization?.logoUrl,
      senderEmail: organization?.senderDomainVerified ? organization.customSenderEmail : null,
      senderName: organization?.senderDomainVerified ? organization.customSenderName : null,
    });
  }

  console.log(`[certificate] Issued certificate for user ${userId}, course ${courseId}${enrollmentType === "admin_preview" ? " (admin preview — email suppressed)" : ""}`);
}


/**
 * Verify that a course belongs to the calling admin's org.
 * Platform admins (site_owner/site_admin/admin) bypass the check.
 */
export async function assertCourseOwnership(
  ctx: { user: { id: number; role: string } },
  courseId: number
): Promise<void> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  const [course] = await db
    .select({ orgId: lmsCourses.orgId })
    .from(lmsCourses)
    .where(eq(lmsCourses.id, courseId))
    .limit(1);
  if (!course) throw new TRPCError({ code: "NOT_FOUND", message: "Course not found" });
  const activeOrgId = await getOrgIdForUserWithFallback(ctx.user.id, ctx.user.role);
  if (!activeOrgId || activeOrgId !== course.orgId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "This course does not belong to the active organization" });
  }
  await requireOrgAdmin(ctx.user.id, ctx.user.role, course.orgId);
}

/**
 * Verify that a section belongs to the calling admin's org (via its course).
 */
export async function assertSectionOwnership(
  ctx: { user: { id: number; role: string } },
  sectionId: number
): Promise<void> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  const [section] = await db
    .select({ courseId: lmsSections.courseId })
    .from(lmsSections)
    .where(eq(lmsSections.id, sectionId))
    .limit(1);
  if (!section) throw new TRPCError({ code: "NOT_FOUND", message: "Section not found" });
  await assertCourseOwnership(ctx, section.courseId);
}

/**
 * Verify that a lesson belongs to the calling admin's org (via its section → course).
 */
export async function assertLessonOwnership(
  ctx: { user: { id: number; role: string } },
  lessonId: number
): Promise<void> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  const [lesson] = await db
    .select({ sectionId: lmsLessons.sectionId, courseId: lmsLessons.courseId })
    .from(lmsLessons)
    .where(eq(lmsLessons.id, lessonId))
    .limit(1);
  if (!lesson) throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found" });
  const courseId = lesson.courseId ?? (lesson.sectionId
    ? (await db.select({ courseId: lmsSections.courseId }).from(lmsSections).where(eq(lmsSections.id, lesson.sectionId)).limit(1))[0]?.courseId
    : undefined);
  if (!courseId) throw new TRPCError({ code: "NOT_FOUND", message: "Course not found for lesson" });
  await assertCourseOwnership(ctx, courseId);
}

// ─── Public Router ────────────────────────────────────────────────────────────
