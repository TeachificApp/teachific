/**
 * cmeActivityFormRouter.ts
 * CME Activity Planning Form — org-scoped tRPC procedures
 *
 * All procedures are scoped to an org. Platform admins can access any org.
 * Org admins can only access their own org.
 *
 * Procedures:
 *   listCmeActivityForms(orgId?)         — list CME-eligible products with form status
 *   getCmeActivityForm(orgId?, courseId, productType)  — get or create defaults
 *   generateCmeFormContent(...)          — AI-generate green text fields
 *   saveCmeActivityForm(...)             — upsert the form
 *   downloadCmeActivityForm(...)         — generate DOCX, upload to S3, return URL
 *   downloadCmeActivityFormPdf(...)      — generate PDF, upload to S3, return URL
 * sendCmeForm(...)                     — email PDF to CME provider
 * updateCmeStatus(...)                 — update approval status
 *   getCmeSendHistory(...)               — get send history for a product
 *   // Platform admin
 *   listOrgsWithCmeStatus()              — list all orgs with CME enabled status
 *   toggleOrgCme(orgId, enabled)         — enable/disable CME for an org
 *   updateOrgCmeConfig(...)              — update CME contact email / org name
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb, requireOrgAdmin, getOrgIdForUserWithFallback } from "../db";
import {
  cmeActivityForms,
  cmeSendHistory,
  lmsCourses,
  organizations,
} from "../../drizzle/schema";
import { storagePut } from "../storage";
import { uploadCmePdfToDrive } from "../lib/googleDriveCme";
import { invokeLLM } from "../_core/llm";
import { sendEmail } from "../_core/email";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Resolve orgId for the calling user — platform admins can pass an explicit orgId */
async function resolveOrgId(
  userId: number,
  platformRole: string,
  orgIdInput?: number | null
): Promise<number> {
  const isPlatformAdmin = platformRole === "site_owner" || platformRole === "site_admin";
  if (isPlatformAdmin) {
    if (orgIdInput) return requireOrgAdmin(userId, platformRole, orgIdInput);
    return requireOrgAdmin(userId, platformRole);
  }

  const activeOrgId = await getOrgIdForUserWithFallback(userId, platformRole);
  if (!activeOrgId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "No active organization context." });
  }
  if (orgIdInput && orgIdInput !== activeOrgId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "CME activity forms must be managed from the active organization." });
  }
  return requireOrgAdmin(userId, platformRole, activeOrgId);
}

/** Assert the org has CME enabled (platform admins bypass) */
async function assertCmeEnabled(orgId: number, platformRole: string): Promise<void> {
  if (platformRole === "site_owner" || platformRole === "site_admin") return;
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  const [org] = await db
    .select({ cmeEnabled: organizations.cmeEnabled })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  if (!org?.cmeEnabled) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "CME processing is not enabled for this organisation. Contact your platform administrator.",
    });
  }
}

// ─── Zod schema for the form data ────────────────────────────────────────────
const cmeFormDataSchema = z.object({
  activityTitle: z.string().max(512).optional().nullable(),
  activityType: z.string().max(64).optional().nullable(),
  proposedDate: z.string().max(128).optional().nullable(),
  activityLengthHours: z.string().max(32).optional().nullable(),
  cmeCreditsRequested: z.string().max(32).optional().nullable(),
  offerMocCredit: z.string().max(32).optional().nullable(),
  offeredMoreThanOnce: z.string().max(32).optional().nullable(),
  activityStructure: z.string().max(64).optional().nullable(),
  targetAudience: z.string().max(64).optional().nullable(),
  estimatedLearners: z.string().max(64).optional().nullable(),
  practiceGapDescription: z.string().optional().nullable(),
  practiceGapReasons: z.string().optional().nullable(),
  improvementTypes: z.string().optional().nullable(),
  improvementKnowledgeText: z.string().optional().nullable(),
  improvementCompetenceText: z.string().optional().nullable(),
  improvementPerformanceText: z.string().optional().nullable(),
  learnerOutcomes: z.string().optional().nullable(),
  learningObjectives: z.string().optional().nullable(),
  deliveryDescription: z.string().optional().nullable(),
  activityIncludes: z.string().optional().nullable(),
  assessmentMethods: z.string().optional().nullable(),
  facultyJson: z.string().optional().nullable(),
  contentStatus: z.string().max(64).optional().nullable(),
  contentAvailableDate: z.string().max(128).optional().nullable(),
  marketingChannels: z.string().optional().nullable(),
  marketingMentionsCme: z.string().max(32).optional().nullable(),
  registrationFee: z.string().max(32).optional().nullable(),
  originalReleaseDate: z.string().max(64).optional().nullable(),
  mostRecentReviewDate: z.string().max(64).optional().nullable(),
  expirationDate: z.string().max(64).optional().nullable(),
  attestationName: z.string().max(256).optional().nullable(),
  attestationDate: z.string().max(64).optional().nullable(),
  attestationTitle: z.string().max(256).optional().nullable(),
  signatureDataUrl: z.string().optional().nullable(),
});

// ─── AI generation helper ─────────────────────────────────────────────────────
async function aiGenerateCmeContent(
  courseTitle: string,
  creditHours: string | null,
  orgName: string
): Promise<{
  practiceGapDescription: string;
  practiceGapReasons: string;
  improvementKnowledgeText: string;
  improvementCompetenceText: string;
  improvementPerformanceText: string;
  learnerOutcomes: string;
  learningObjectives: string;
}> {
  const credits = creditHours ? `${creditHours} CME credit hours` : "CME credit";
  const prompt = `You are an expert CME (Continuing Medical Education) curriculum developer for ${orgName}, a professional education platform. Generate content for an Activity Planning and Proposal Form for the following CME course:

Course Title: "${courseTitle}"
CME Credits: ${credits}

Generate the following sections in valid JSON format. Be specific, clinically accurate, and professional.

{
  "practiceGapDescription": "2-3 sentences describing the specific practice-based problem or challenge this course addresses.",
  "practiceGapReasons": "2-3 sentences describing the primary reasons contributing to this practice gap.",
  "improvementKnowledgeText": "1-2 sentences starting with 'Knowledge (understanding updated information)—' describing what knowledge participants will gain.",
  "improvementCompetenceText": "1-2 sentences starting with 'Competence (improving ability to apply information correctly)—' describing what competence participants will improve.",
  "improvementPerformanceText": "1-2 sentences starting with 'Performance (improving practice, behavior, or workflow)—' describing how participants' clinical performance will improve.",
  "learnerOutcomes": "After completing this activity, learners should be able to:\\n• [4-5 specific, measurable outcomes as bullet points starting with action verbs]",
  "learningObjectives": "• [4 specific, measurable learning objectives as bullet points starting with action verbs]"
}

Return ONLY the JSON object, no additional text.`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: "You are an expert CME curriculum developer. Return only valid JSON." },
      { role: "user", content: prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "cme_content",
        strict: true,
        schema: {
          type: "object",
          properties: {
            practiceGapDescription: { type: "string" },
            practiceGapReasons: { type: "string" },
            improvementKnowledgeText: { type: "string" },
            improvementCompetenceText: { type: "string" },
            improvementPerformanceText: { type: "string" },
            learnerOutcomes: { type: "string" },
            learningObjectives: { type: "string" },
          },
          required: [
            "practiceGapDescription", "practiceGapReasons",
            "improvementKnowledgeText", "improvementCompetenceText", "improvementPerformanceText",
            "learnerOutcomes", "learningObjectives",
          ],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM returned empty response");
  return JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
}

// ─── Simple PDF/DOCX generation (text-based, no external libraries) ───────────
async function generateCmePdfBuffer(formData: Record<string, unknown>, orgName: string): Promise<Buffer> {
  // Build a simple HTML-based PDF using the built-in PDF generation
  const title = (formData.activityTitle as string) ?? "CME Activity";
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #1e293b; margin: 40px; line-height: 1.5; }
  h1 { font-size: 16pt; color: #0f172a; border-bottom: 2px solid #0ea5e9; padding-bottom: 8px; }
  h2 { font-size: 12pt; color: #0369a1; margin-top: 20px; }
  .field { margin-bottom: 10px; }
  .label { font-weight: bold; color: #475569; font-size: 10pt; }
  .value { margin-top: 2px; }
  .header { background: #0ea5e9; color: white; padding: 16px 24px; margin: -40px -40px 30px -40px; }
  .header h1 { color: white; border-bottom: none; margin: 0; }
  .header p { margin: 4px 0 0; opacity: 0.9; font-size: 10pt; }
  .section { background: #f8fafc; border-left: 3px solid #0ea5e9; padding: 12px 16px; margin: 16px 0; }
  .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 9pt; color: #94a3b8; }
</style>
</head>
<body>
<div class="header">
  <h1>CME Activity Planning Form</h1>
  <p>${orgName} · CME Processing</p>
</div>

<div class="section">
  <h2>Section 1: Activity Overview</h2>
  <div class="field"><div class="label">Activity Title</div><div class="value">${formData.activityTitle ?? ""}</div></div>
  <div class="field"><div class="label">Activity Type</div><div class="value">${formData.activityType ?? ""}</div></div>
  <div class="field"><div class="label">Proposed Date(s)</div><div class="value">${formData.proposedDate ?? ""}</div></div>
  <div class="field"><div class="label">Activity Length (hours)</div><div class="value">${formData.activityLengthHours ?? ""}</div></div>
  <div class="field"><div class="label">CME Credits Requested</div><div class="value">${formData.cmeCreditsRequested ?? ""}</div></div>
  <div class="field"><div class="label">MOC Credit Interest</div><div class="value">${formData.offerMocCredit ?? ""}</div></div>
  <div class="field"><div class="label">Activity Structure</div><div class="value">${formData.activityStructure ?? ""}</div></div>
  <div class="field"><div class="label">Target Audience</div><div class="value">${formData.targetAudience ?? ""}</div></div>
  <div class="field"><div class="label">Estimated Learners</div><div class="value">${formData.estimatedLearners ?? ""}</div></div>
</div>

<div class="section">
  <h2>Section 2: Professional Practice Gap</h2>
  <div class="field"><div class="label">Practice Gap Description</div><div class="value">${(formData.practiceGapDescription as string ?? "").replace(/\n/g, "<br/>")}</div></div>
  <div class="field"><div class="label">Contributing Reasons</div><div class="value">${(formData.practiceGapReasons as string ?? "").replace(/\n/g, "<br/>")}</div></div>
</div>

<div class="section">
  <h2>Section 3: Educational Needs</h2>
  <div class="field"><div class="label">Knowledge</div><div class="value">${(formData.improvementKnowledgeText as string ?? "").replace(/\n/g, "<br/>")}</div></div>
  <div class="field"><div class="label">Competence</div><div class="value">${(formData.improvementCompetenceText as string ?? "").replace(/\n/g, "<br/>")}</div></div>
  <div class="field"><div class="label">Performance</div><div class="value">${(formData.improvementPerformanceText as string ?? "").replace(/\n/g, "<br/>")}</div></div>
  <div class="field"><div class="label">Learner Outcomes</div><div class="value">${(formData.learnerOutcomes as string ?? "").replace(/\n/g, "<br/>")}</div></div>
</div>

<div class="section">
  <h2>Section 4: Learning Objectives</h2>
  <div class="value">${(formData.learningObjectives as string ?? "").replace(/\n/g, "<br/>")}</div>
</div>

<div class="section">
  <h2>Section 5: Educational Format</h2>
  <div class="field"><div class="label">Delivery Description</div><div class="value">${(formData.deliveryDescription as string ?? "").replace(/\n/g, "<br/>")}</div></div>
  <div class="field"><div class="label">Activity Includes</div><div class="value">${formData.activityIncludes ?? ""}</div></div>
  <div class="field"><div class="label">Assessment Methods</div><div class="value">${formData.assessmentMethods ?? ""}</div></div>
</div>

<div class="section">
  <h2>Section 6: Faculty</h2>
  <div class="value">${formData.facultyJson ?? ""}</div>
</div>

<div class="section">
  <h2>Section 7: Content Readiness</h2>
  <div class="field"><div class="label">Content Status</div><div class="value">${formData.contentStatus ?? ""}</div></div>
  <div class="field"><div class="label">Draft Available</div><div class="value">${formData.contentAvailableDate ?? ""}</div></div>
</div>

<div class="section">
  <h2>Section 8: Marketing</h2>
  <div class="field"><div class="label">Marketing Channels</div><div class="value">${formData.marketingChannels ?? ""}</div></div>
  <div class="field"><div class="label">Marketing Mentions CME</div><div class="value">${formData.marketingMentionsCme ?? ""}</div></div>
</div>

<div class="section">
  <h2>Section 9: Financial</h2>
  <div class="field"><div class="label">Registration Fee</div><div class="value">${formData.registrationFee ?? ""}</div></div>
</div>

<div class="section">
  <h2>Section 10: Attestation</h2>
  <div class="field"><div class="label">Name</div><div class="value">${formData.attestationName ?? ""}</div></div>
  <div class="field"><div class="label">Title/Credentials</div><div class="value">${formData.attestationTitle ?? ""}</div></div>
  <div class="field"><div class="label">Date</div><div class="value">${formData.attestationDate ?? ""}</div></div>
</div>

<div class="footer">
  Generated by ${orgName} · CME Processing · ${new Date().toLocaleDateString()}
</div>
</body>
</html>`;

  // Use a simple approach: return the HTML as a buffer (will be served as HTML for now)
  // In production, this would use a headless browser or PDF library
  return Buffer.from(html, "utf-8");
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const cmeActivityFormRouter = router({

  // ── Platform Admin: List all orgs with CME status ────────────────────────
  listOrgsWithCmeStatus: protectedProcedure
    .query(async ({ ctx }) => {
      if (ctx.user.role !== "site_owner" && ctx.user.role !== "site_admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const orgs = await db
        .select({
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
          logoUrl: organizations.logoUrl,
          isActive: organizations.isActive,
          cmeEnabled: organizations.cmeEnabled,
          cmeContactEmail: organizations.cmeContactEmail,
          cmeOrgName: organizations.cmeOrgName,
          createdAt: organizations.createdAt,
        })
        .from(organizations)
        .orderBy(organizations.name);
      return orgs;
    }),

  // ── Platform Admin: Toggle CME for an org ────────────────────────────────
  toggleOrgCme: protectedProcedure
    .input(z.object({
      orgId: z.number().int().positive(),
      enabled: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "site_owner" && ctx.user.role !== "site_admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .update(organizations)
        .set({ cmeEnabled: input.enabled } as any)
        .where(eq(organizations.id, input.orgId));
      return { success: true };
    }),

  // ── Platform Admin: Update org CME config ────────────────────────────────
  updateOrgCmeConfig: protectedProcedure
    .input(z.object({
      orgId: z.number().int().positive(),
      cmeContactEmail: z.string().email().optional().nullable(),
      cmeOrgName: z.string().max(255).optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "site_owner" && ctx.user.role !== "site_admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .update(organizations)
        .set({
          cmeContactEmail: input.cmeContactEmail ?? null,
          cmeOrgName: input.cmeOrgName ?? null,
        } as any)
        .where(eq(organizations.id, input.orgId));
      return { success: true };
    }),

  // ── List CME-eligible courses with form status ────────────────────────────
  listCmeActivityForms: protectedProcedure
    .input(z.object({ orgId: z.number().int().positive().optional() }))
    .query(async ({ ctx, input }) => {
      const orgId = await resolveOrgId(ctx.user.id, ctx.user.role, input.orgId);
      await assertCmeEnabled(orgId, ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Get all courses that have a certificate (CME-eligible) for this org
      const courses = await db
        .select({
          id: lmsCourses.id,
          title: lmsCourses.title,
          slug: lmsCourses.slug,
          status: lmsCourses.status,
          creditHours: lmsCourses.creditHours,
          hasCertificate: lmsCourses.hasCertificate,
        })
        .from(lmsCourses)
        .where(and(
          eq(lmsCourses.orgId, orgId),
          eq(lmsCourses.hasCertificate, true)
        ))
        .orderBy(lmsCourses.title);

      if (courses.length === 0) return [];

      // Get all existing CME forms for this org
      const forms = await db
        .select({
          courseId: cmeActivityForms.courseId,
          activityTitle: cmeActivityForms.activityTitle,
          proposedDate: cmeActivityForms.proposedDate,
          practiceGapDescription: cmeActivityForms.practiceGapDescription,
          learningObjectives: cmeActivityForms.learningObjectives,
          attestationDate: cmeActivityForms.attestationDate,
          updatedAt: cmeActivityForms.updatedAt,
          lastSentAt: cmeActivityForms.lastSentAt,
          cmeStatus: cmeActivityForms.cmeStatus,
          approvedAt: cmeActivityForms.approvedAt,
        })
        .from(cmeActivityForms)
        .where(eq(cmeActivityForms.orgId, orgId));

      const formsByCourseId = new Map(forms.map(f => [f.courseId, f]));
      const now = Date.now();
      const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;

      return courses.map(course => {
        const form = formsByCourseId.get(course.id);
        const isComplete = !!(form &&
          form.practiceGapDescription?.trim() &&
          form.learningObjectives?.trim() &&
          form.attestationDate?.trim());
        const isStarted = !!form;
        let cmeStatus = form?.cmeStatus ?? "draft";
        if (cmeStatus === "approved" && form?.approvedAt && (now - form.approvedAt) > TWO_YEARS_MS) {
          cmeStatus = "expired";
        }
        return {
          ...course,
          formStatus: isComplete ? "complete" : isStarted ? "in_progress" : "pending",
          formUpdatedAt: form?.updatedAt ?? null,
          formProposedDate: form?.proposedDate ?? null,
          lastSentAt: form?.lastSentAt ?? null,
          cmeStatus,
          approvedAt: form?.approvedAt ?? null,
        };
      });
    }),

  // ── Get form (existing or defaults) ──────────────────────────────────────
  getCmeActivityForm: protectedProcedure
    .input(z.object({
      orgId: z.number().int().positive().optional(),
      courseId: z.number().int().positive(),
      productType: z.string().default("lms_course"),
    }))
    .query(async ({ ctx, input }) => {
      const orgId = await resolveOrgId(ctx.user.id, ctx.user.role, input.orgId);
      await assertCmeEnabled(orgId, ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Get org info for defaults
      const [org] = await db
        .select({ name: organizations.name, cmeOrgName: organizations.cmeOrgName })
        .from(organizations)
        .where(eq(organizations.id, orgId))
        .limit(1);

      const [course] = await db
        .select({ id: lmsCourses.id, title: lmsCourses.title, slug: lmsCourses.slug, creditHours: lmsCourses.creditHours, hasCertificate: lmsCourses.hasCertificate })
        .from(lmsCourses)
        .where(and(eq(lmsCourses.id, input.courseId), eq(lmsCourses.orgId, orgId)))
        .limit(1);

      if (!course) throw new TRPCError({ code: "NOT_FOUND", message: "Course not found" });

      const [existing] = await db
        .select()
        .from(cmeActivityForms)
        .where(and(
          eq(cmeActivityForms.orgId, orgId),
          eq(cmeActivityForms.courseId, input.courseId)
        ))
        .limit(1);

      if (existing) return { form: existing, course, org, isNew: false };

      const titleCreditMatch = course.title?.match(/(\d+(?:\.\d+)?)\s*(?:CME|CE|credit)/i);
      const derivedCredits = course.creditHours ?? (titleCreditMatch ? titleCreditMatch[1] : "");
      const orgDisplayName = org?.cmeOrgName ?? org?.name ?? "Our Organization";

      const defaults = {
        id: null,
        orgId,
        courseId: input.courseId,
        productType: input.productType,
        activityTitle: course.title ?? "",
        activityType: "enduring",
        proposedDate: "",
        activityLengthHours: derivedCredits,
        cmeCreditsRequested: derivedCredits,
        offerMocCredit: "no",
        offeredMoreThanOnce: "not_yet_determined",
        activityStructure: "ongoing",
        targetAudience: "mixed_audience",
        estimatedLearners: "",
        practiceGapDescription: "",
        practiceGapReasons: "",
        improvementTypes: JSON.stringify(["knowledge", "competence", "performance"]),
        improvementKnowledgeText: "",
        improvementCompetenceText: "",
        improvementPerformanceText: "",
        learnerOutcomes: "",
        learningObjectives: "",
        deliveryDescription: "Recorded video presentation with written content and assessment module.",
        activityIncludes: JSON.stringify(["knowledge_check"]),
        assessmentMethods: JSON.stringify(["post_test", "learner_evaluation"]),
        facultyJson: JSON.stringify([{ name: "", credentials: "", role: "Planner, Presenter" }]),
        contentStatus: "fully_developed",
        contentAvailableDate: "Available now",
        marketingChannels: JSON.stringify(["email", "website", "social_media"]),
        marketingMentionsCme: "yes",
        registrationFee: "yes",
        attestationName: "",
        attestationDate: "",
        attestationTitle: "",
        signatureDataUrl: null,
        createdAt: null,
        updatedAt: null,
        lastSentAt: null,
        cmeStatus: "draft",
        approvedAt: null,
      };

      return { form: defaults, course, org, isNew: true };
    }),

  // ── AI-generate green text fields ─────────────────────────────────────────
  generateCmeFormContent: protectedProcedure
    .input(z.object({
      orgId: z.number().int().positive().optional(),
      courseId: z.number().int().positive(),
      courseTitle: z.string().min(1).max(512),
      creditHours: z.string().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await resolveOrgId(ctx.user.id, ctx.user.role, input.orgId);
      await assertCmeEnabled(orgId, ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [org] = await db
        .select({ name: organizations.name, cmeOrgName: organizations.cmeOrgName })
        .from(organizations)
        .where(eq(organizations.id, orgId))
        .limit(1);
      const orgName = org?.cmeOrgName ?? org?.name ?? "Our Organization";
      const generated = await aiGenerateCmeContent(input.courseTitle, input.creditHours ?? null, orgName);
      return generated;
    }),

  // ── Save (upsert) form ────────────────────────────────────────────────────
  saveCmeActivityForm: protectedProcedure
    .input(z.object({
      orgId: z.number().int().positive().optional(),
      courseId: z.number().int().positive(),
      productType: z.string().default("lms_course"),
      data: cmeFormDataSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await resolveOrgId(ctx.user.id, ctx.user.role, input.orgId);
      await assertCmeEnabled(orgId, ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [existing] = await db
        .select({ id: cmeActivityForms.id })
        .from(cmeActivityForms)
        .where(and(
          eq(cmeActivityForms.orgId, orgId),
          eq(cmeActivityForms.courseId, input.courseId)
        ))
        .limit(1);

      if (existing) {
        await db
          .update(cmeActivityForms)
          .set(input.data as any)
          .where(and(
            eq(cmeActivityForms.orgId, orgId),
            eq(cmeActivityForms.courseId, input.courseId)
          ));
      } else {
        await db
          .insert(cmeActivityForms)
          .values({ orgId, courseId: input.courseId, productType: input.productType, ...input.data } as any);
      }

      return { success: true };
    }),

  // ── Download as PDF ───────────────────────────────────────────────────────
  downloadCmeActivityFormPdf: protectedProcedure
    .input(z.object({
      orgId: z.number().int().positive().optional(),
      courseId: z.number().int().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await resolveOrgId(ctx.user.id, ctx.user.role, input.orgId);
      await assertCmeEnabled(orgId, ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [org] = await db
        .select({ name: organizations.name, cmeOrgName: organizations.cmeOrgName })
        .from(organizations)
        .where(eq(organizations.id, orgId))
        .limit(1);

      const [course] = await db
        .select({ title: lmsCourses.title, creditHours: lmsCourses.creditHours })
        .from(lmsCourses)
        .where(and(eq(lmsCourses.id, input.courseId), eq(lmsCourses.orgId, orgId)))
        .limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND", message: "Course not found" });

      const [existing] = await db
        .select()
        .from(cmeActivityForms)
        .where(and(
          eq(cmeActivityForms.orgId, orgId),
          eq(cmeActivityForms.courseId, input.courseId)
        ))
        .limit(1);

      const orgName = org?.cmeOrgName ?? org?.name ?? "Organization";
      const formData = existing ?? { activityTitle: course.title };
      const htmlBuffer = await generateCmePdfBuffer(formData as any, orgName);

      const safeTitle = (course.title ?? "cme-form").replace(/[^a-z0-9]/gi, "-").toLowerCase().slice(0, 60);
      const key = `cme-forms/${orgId}/${safeTitle}-${Date.now()}.html`;
      const { url } = await storagePut(key, htmlBuffer, "text/html");

      return { url };
    }),

  // ── Send form PDF to CME provider via email ─────────────────────────────────
  sendCmeForm: protectedProcedure
        .input(z.object({
      orgId: z.number().int().positive().optional(),
      courseId: z.number().int().positive(),
      productType: z.string().optional(),
      // subject+body used by CmeManagementPage; toEmails/recipientEmail+formData used by CmeFormTab/CmeActivityFormDialog
      subject: z.string().min(1).max(512).optional(),
      body: z.string().min(1).optional(),
      // toEmails: full editable recipient list (from multi-email chip UI)
      toEmails: z.array(z.string().email()).optional(),
      // recipientEmail: legacy single-recipient fallback
      recipientEmail: z.string().email().optional(),
      formData: z.record(z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await resolveOrgId(ctx.user.id, ctx.user.role, input.orgId);
      await assertCmeEnabled(orgId, ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [org] = await db
        .select({
          name: organizations.name,
          cmeOrgName: organizations.cmeOrgName,
          cmeContactEmail: organizations.cmeContactEmail,
          customSenderEmail: organizations.customSenderEmail,
          customSenderName: organizations.customSenderName,
        })
        .from(organizations)
        .where(eq(organizations.id, orgId))
        .limit(1);
      const [course] = await db
        .select({ id: lmsCourses.id, title: lmsCourses.title, creditHours: lmsCourses.creditHours })
        .from(lmsCourses)
        .where(and(eq(lmsCourses.id, input.courseId), eq(lmsCourses.orgId, orgId)))
        .limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND", message: "Course not found" });
      const [form] = await db
        .select()
        .from(cmeActivityForms)
        .where(and(
          eq(cmeActivityForms.orgId, orgId),
          eq(cmeActivityForms.courseId, input.courseId)
        ))
        .limit(1);
      const orgName = org?.cmeOrgName ?? org?.name ?? "Organization";
      // Use provided formData (from CmeFormTab) or fall back to DB form
      const formData = (input.formData as any) ?? form ?? { activityTitle: course.title };
      const htmlBuffer = await generateCmePdfBuffer(formData as any, orgName);

      const senderEmail = org?.customSenderEmail ?? process.env.SENDGRID_FROM_EMAIL ?? "admin@teachific.app";
      const senderName = org?.customSenderName ?? orgName;

      // Build TO and CC lists
      // If toEmails is provided (from the multi-email chip UI), use it as the full recipient list
      // Otherwise fall back to legacy single recipientEmail or default Cardioserv address
      let toList: Array<{ name: string; email: string }>;
      let ccList: Array<{ name: string; email: string }> = [];

      if (input.toEmails && input.toEmails.length > 0) {
        // Multi-email mode: all emails in toEmails go to TO
        toList = input.toEmails.map(email => ({ name: email, email }));
      } else if (input.recipientEmail) {
        // Legacy single-recipient mode
        toList = [{ name: input.recipientEmail, email: input.recipientEmail }];
        // Keep Cardioserv as CC in legacy mode
        ccList = [{ name: "Judith Buckland", email: "j.buckland@cardioserv.net" }];
        if (org?.cmeContactEmail) {
          ccList.push({ name: senderName, email: org.cmeContactEmail });
        }
      } else {
        // Default: send to Cardioserv primary
        toList = [{ name: "Don Gerig", email: "don@cardioserv.net" }];
        ccList = [{ name: "Judith Buckland", email: "j.buckland@cardioserv.net" }];
        if (org?.cmeContactEmail) {
          ccList.push({ name: senderName, email: org.cmeContactEmail });
        }
      }

      const htmlBody = `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head><body style="font-family:Arial,sans-serif;font-size:15px;color:#1e293b;line-height:1.7;max-width:640px;margin:0 auto;padding:24px;">
${input.body.split('\n').map(line => line.trim() ? `<p style="margin:0 0 12px;">${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>` : '<br/>').join('')}
<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;"/>
<p style="font-size:12px;color:#94a3b8;">Sent from ${orgName} CME Administration via Teachific™</p>
</body></html>`;

      const apiKey = process.env.SENDGRID_API_KEY;
      if (!apiKey) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Email service not configured" });

      const htmlBase64 = htmlBuffer.toString("base64");
      const safeTitle = (course.title ?? "CME-Activity-Form").replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "-");
      const filename = `${safeTitle}-CME-Activity-Form.html`;

      const payload = {
        personalizations: [{
          to: toList,
          ...(ccList.length > 0 ? { cc: ccList } : {}),
          subject: input.subject,
        }],
        from: { name: senderName, email: senderEmail },
        reply_to: { name: senderName, email: senderEmail },
        content: [{ type: "text/html", value: htmlBody }],
        attachments: [{
          content: htmlBase64,
          type: "text/html",
          filename,
          disposition: "attachment",
        }],
        tracking_settings: {
          click_tracking: { enable: false },
          open_tracking: { enable: false },
        },
      };

      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error(`[CME Email] SendGrid error ${res.status}: ${text}`);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Email send failed: ${res.status}` });
      }

      const now = Date.now();
      if (form) {
        await db.update(cmeActivityForms)
          .set({ lastSentAt: now } as any)
          .where(and(
            eq(cmeActivityForms.orgId, orgId),
            eq(cmeActivityForms.courseId, input.courseId)
          ));
      }
      await db.insert(cmeSendHistory).values({
        orgId,
        courseId: input.courseId,
        sentAt: now,
        subject: input.subject,
        sentBy: ctx.user?.name ?? ctx.user?.email ?? "Admin",
      } as any);

      console.log(`[CME Email] Sent "${input.subject}" to don@cardioserv.net for course ${course.title} (org ${orgId})`);

      // Optionally upload PDF to org's Google Drive (non-blocking — failure doesn't break email send)
      let driveFileId: string | null = null;
      let driveWebViewLink: string | null = null;
      try {
        const driveResult = await uploadCmePdfToDrive(orgId, htmlBuffer, filename);
        if (driveResult) {
          driveFileId = driveResult.fileId;
          driveWebViewLink = driveResult.webViewLink;
        }
      } catch (driveErr) {
        console.warn(`[CME Drive] Upload failed (non-fatal): ${driveErr}`);
      }

      return { success: true, lastSentAt: now, driveFileId, driveWebViewLink };
    }),

  // ── Update CME status ──────────────────────────────────────────────
  updateCmeStatus: protectedProcedure
    .input(z.object({
      orgId: z.number().int().positive().optional(),
      courseId: z.number().int().positive(),
      status: z.enum(["draft", "pending_approval", "approved", "expired"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await resolveOrgId(ctx.user.id, ctx.user.role, input.orgId);
      await assertCmeEnabled(orgId, ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const approvedAt = input.status === "approved" ? Date.now() : null;
      await db.update(cmeActivityForms)
        .set({ cmeStatus: input.status, approvedAt } as any)
        .where(and(
          eq(cmeActivityForms.orgId, orgId),
          eq(cmeActivityForms.courseId, input.courseId)
        ));
      return { success: true };
    }),

  // ── Check CME enabled status for current org ──────────────────────────────
  getCmeStatus: protectedProcedure
    .input(z.object({ orgId: z.number().int().positive().optional() }))
    .query(async ({ ctx, input }) => {
      const orgId = await resolveOrgId(ctx.user.id, ctx.user.role, input.orgId);
      const db = await getDb();
      if (!db) return { enabled: false, cmeOrgName: null, cmeContactEmail: null };
      const [org] = await db
        .select({
          cmeEnabled: organizations.cmeEnabled,
          cmeOrgName: organizations.cmeOrgName,
          cmeContactEmail: organizations.cmeContactEmail,
        })
        .from(organizations)
        .where(eq(organizations.id, orgId))
        .limit(1);
      return {
        enabled: !!(org as any)?.cmeEnabled,
        orgName: (org as any)?.cmeOrgName ?? null,
        cmeOrgName: (org as any)?.cmeOrgName ?? null,
        cmeContactEmail: (org as any)?.cmeContactEmail ?? null,
      };
    }),

  // ── Get send history ──────────────────────────────────────────────────────
  getCmeSendHistory: protectedProcedure
    .input(z.object({
      orgId: z.number().int().positive().optional(),
      courseId: z.number().int().positive(),
    }))
    .query(async ({ ctx, input }) => {
      const orgId = await resolveOrgId(ctx.user.id, ctx.user.role, input.orgId);
      await assertCmeEnabled(orgId, ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db
        .select()
        .from(cmeSendHistory)
        .where(and(
          eq(cmeSendHistory.orgId, orgId),
          eq(cmeSendHistory.courseId, input.courseId)
        ))
        .orderBy(desc(cmeSendHistory.sentAt));
      return rows;
    }),
});
