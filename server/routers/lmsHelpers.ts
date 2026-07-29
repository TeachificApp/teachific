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
import { getDb, getOrCreateAccessToken, getOrgIdForUser } from "../db";
import { invokeLLM } from "../_core/llm";
import { generateCertificatePdf } from "../lib/certificateGenerator";
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
} from "../../drizzle/schema";
import { sendEmail, buildFreePreviewConfirmationEmail } from "../_core/email";

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ─── Shared helpers (used by all LMS sub-routers) ────────────────────────────

const ADMIN_ROLES = ["admin", "site_owner", "site_admin", "org_super_admin", "org_admin"];
const ORG_ADMIN_MEMBER_ROLES = ["org_super_admin", "org_admin", "sub_admin"];
export async function assertAdmin(ctx: { user: { id: number; role: string } }) {
  // Fast path: users.role already indicates platform or org admin
  if (ADMIN_ROLES.includes(ctx.user.role)) return;
  // Slow path: check org_members table (users whose admin status lives only in org_members)
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  const [membership] = await db
    .select({ role: orgMembers.role })
    .from(orgMembers)
    .where(eq(orgMembers.userId, ctx.user.id))
    .limit(1);
  if (membership && ORG_ADMIN_MEMBER_ROLES.includes(membership.role)) return;
  throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
}

/**
 * Verify that a course belongs to the calling admin's org.
 * Platform admins (site_owner/site_admin/admin) bypass the check.
 */
export async function assertCourseOwnership(
  ctx: { user: { id: number; role: string } },
  courseId: number
): Promise<void> {
  const isPlatformAdmin = ["site_owner", "site_admin", "admin"].includes(ctx.user.role);
  if (isPlatformAdmin) return;
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  const orgId = await getOrgIdForUser(ctx.user.id);
  if (!orgId) throw new TRPCError({ code: "FORBIDDEN", message: "No organisation found" });
  const [course] = await db
    .select({ orgId: lmsCourses.orgId })
    .from(lmsCourses)
    .where(eq(lmsCourses.id, courseId))
    .limit(1);
  if (!course || course.orgId !== orgId)
    throw new TRPCError({ code: "FORBIDDEN", message: "You do not have access to this course" });
}

/**
 * Verify that a section belongs to the calling admin's org (via its course).
 */
export async function assertSectionOwnership(
  ctx: { user: { id: number; role: string } },
  sectionId: number
): Promise<void> {
  const isPlatformAdmin = ["site_owner", "site_admin", "admin"].includes(ctx.user.role);
  if (isPlatformAdmin) return;
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  const orgId = await getOrgIdForUser(ctx.user.id);
  if (!orgId) throw new TRPCError({ code: "FORBIDDEN", message: "No organisation found" });
  const [section] = await db
    .select({ courseId: lmsSections.courseId })
    .from(lmsSections)
    .where(eq(lmsSections.id, sectionId))
    .limit(1);
  if (!section) throw new TRPCError({ code: "NOT_FOUND", message: "Section not found" });
  const [course] = await db
    .select({ orgId: lmsCourses.orgId })
    .from(lmsCourses)
    .where(eq(lmsCourses.id, section.courseId))
    .limit(1);
  if (!course || course.orgId !== orgId)
    throw new TRPCError({ code: "FORBIDDEN", message: "You do not have access to this section" });
}

/**
 * Verify that a lesson belongs to the calling admin's org (via its section → course).
 */
export async function assertLessonOwnership(
  ctx: { user: { id: number; role: string } },
  lessonId: number
): Promise<void> {
  const isPlatformAdmin = ["site_owner", "site_admin", "admin"].includes(ctx.user.role);
  if (isPlatformAdmin) return;
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  const orgId = await getOrgIdForUser(ctx.user.id);
  if (!orgId) throw new TRPCError({ code: "FORBIDDEN", message: "No organisation found" });
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
  const [course] = await db
    .select({ orgId: lmsCourses.orgId })
    .from(lmsCourses)
    .where(eq(lmsCourses.id, courseId))
    .limit(1);
  if (!course || course.orgId !== orgId)
    throw new TRPCError({ code: "FORBIDDEN", message: "You do not have access to this lesson" });
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

  // Count lessons that count toward progress — exclude free-preview lessons hidden after purchase
  // (previewMode = 'preview_hide_after_purchase' are not visible to enrolled students so must not count)
  let totalCount = 0;
  const excludeHiddenPreview = sql`${lmsLessons.previewMode} != 'preview_hide_after_purchase' OR ${lmsLessons.previewMode} IS NULL`;
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
    progressPercent: pct,
    completedAt: pct >= 100 ? new Date() : null,
  }).where(eq(lmsEnrollments.id, enrollmentId));

  // Issue certificate if newly completed and course has hasCertificate enabled
  if (pct >= 100 && !wasCompleted) {
    void issueCertificateIfEnabled(db, enrollmentId, enrollRow.userId, courseId).catch(e =>
      console.error("[certificate] Failed to issue certificate:", e)
    );
  }
}

export async function issueCertificateIfEnabled(
  db: Awaited<ReturnType<typeof getDb>>,
  enrollmentId: number,
  userId: number,
  courseId: number
) {
  if (!db) return;
  // Check course has certificate enabled
  const [course] = await db.select({ hasCertificate: lmsCourses.hasCertificate, title: lmsCourses.title, certificateTemplateId: lmsCourses.certificateTemplateId, orgId: lmsCourses.orgId }).from(lmsCourses).where(eq(lmsCourses.id, courseId)).limit(1);
  if (!course?.hasCertificate) return;

  // Check if certificate already issued
  const [existing] = await db.select({ id: lmsCertificates.id }).from(lmsCertificates)
    .where(and(eq(lmsCertificates.userId, userId), eq(lmsCertificates.courseId, courseId))).limit(1);
  if (existing) return;

  // Get user info
  const [user] = await db.select({ name: users.name, email: users.email, displayName: users.displayName, credentials: users.credentials }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.email) return;

  const learnerName = user.displayName || user.name || "Learner";
  const issuedAt = new Date();

  // Fetch certificate template if assigned
  let template: any = null;
  if (course.certificateTemplateId) {
    const [tmpl] = await db.select().from(lmsCertificateTemplates).where(eq(lmsCertificateTemplates.id, course.certificateTemplateId)).limit(1);
    template = tmpl ?? null;
  }
  if (!template) {
    // Fall back to default template
    const [defaultTmpl] = await db.select().from(lmsCertificateTemplates).where(eq(lmsCertificateTemplates.isDefault, true)).limit(1);
    template = defaultTmpl ?? null;
  }

  // Generate PDF
  const pdfBuffer = await generateCertificatePdf({
    learnerName,
    courseTitle: course.title,
    issuedAt,
    credentials: user.credentials,
    template,
  });

  // Upload PDF to S3
  const suffix = randomBytes(6).toString("hex");
  const fileKey = `certificates/cert-${userId}-${courseId}-${suffix}.pdf`;
  const { url: certificateUrl } = await storagePut(fileKey, pdfBuffer, "application/pdf");

  // Save certificate record
  await db.insert(lmsCertificates).values({
    userId,
    courseId,
    enrollmentId,
    orgId: course.orgId ?? 0,
    certificateUrl,
    templateId: template?.id ?? null,
    issuedAt,
  });

  // Send email
  await sendCertificateEmail({
    to: { name: learnerName, email: user.email },
    courseTitle: course.title,
    certificateUrl,
    pdfBuffer,
    issuedAt,
  });

  console.log(`[certificate] Issued certificate for user ${userId}, course ${courseId}`);
}

// ─── Public Router ────────────────────────────────────────────────────────────
