/**
 * cmeDisclosureRouter.ts
 * CME Financial Disclosure procedures — org-scoped.
 *
 * Procedures:
 *   createDisclosure(orgId?, courseId, facultyName, facultyEmail) — create + return token
 *   sendDisclosureEmail(orgId?, disclosureId, origin)             — email link to faculty
 *   getDisclosureByToken(token)                                   — public (no auth)
 *   submitDisclosure(token, roles, hasRelationships, relationships, attestationName, attestationDate)
 *   listDisclosures(orgId?, courseId)                             — list for a course
 *   deleteDisclosure(orgId?, disclosureId)                        — delete a record
 *   getDisclosurePdf(orgId?, disclosureId)                        — generate/return PDF URL
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb, getOrgIdForUserWithFallback, requireOrgAdmin } from "../db";
import {
  cmeFinancialDisclosures,
  lmsCourses,
  organizations,
} from "../../drizzle/schema";
import { storagePut } from "../storage";
import { sendEmail } from "../_core/email";
import { generateDisclosurePdf } from "../lib/disclosurePdf";
import { getOrgBaseUrl } from "../lib/orgUrl";
import { randomBytes } from "crypto";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

async function resolveOrgId(userId: number, platformRole: string, orgIdInput?: number | null): Promise<number> {
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
    throw new TRPCError({ code: "FORBIDDEN", message: "CME disclosures must be managed from the active organization." });
  }
  return requireOrgAdmin(userId, platformRole, activeOrgId);
}

async function assertCmeEnabled(orgId: number, platformRole: string): Promise<void> {
  if (platformRole === "site_owner" || platformRole === "site_admin") return;
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  const [org] = await db
    .select({ cmeEnabled: organizations.cmeEnabled })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  if (!(org as any)?.cmeEnabled) {
    throw new TRPCError({ code: "FORBIDDEN", message: "CME is not enabled for this organization." });
  }
}

async function requireCmeCourseForOrg(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  courseId: number,
  orgId: number,
) {
  const [course] = await db
    .select({ id: lmsCourses.id, title: lmsCourses.title, orgId: lmsCourses.orgId })
    .from(lmsCourses)
    .where(and(eq(lmsCourses.id, courseId), eq(lmsCourses.orgId, orgId)))
    .limit(1);
  if (!course) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Course not found in this organization." });
  }
  return course;
}

async function requireDisclosureForOrg(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  disclosureId: number,
  orgId: number,
) {
  const [disclosure] = await db
    .select()
    .from(cmeFinancialDisclosures)
    .where(and(eq(cmeFinancialDisclosures.id, disclosureId), eq(cmeFinancialDisclosures.orgId, orgId)))
    .limit(1);
  if (!disclosure) throw new TRPCError({ code: "NOT_FOUND" });
  await requireCmeCourseForOrg(db, (disclosure as any).courseId, orgId);
  return disclosure;
}

async function getDisclosureOrgContext(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  orgId: number,
) {
  const [org] = await db
    .select({
      name: organizations.name,
      slug: organizations.slug,
      customDomain: organizations.customDomain,
      domainVerificationStatus: organizations.domainVerificationStatus,
    })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found." });
  return {
    name: (org as any).name ?? "Your Organization",
    baseUrl: getOrgBaseUrl(
      (org as any).slug ?? "",
      (org as any).customDomain ?? null,
      (org as any).domainVerificationStatus ?? "unverified",
    ),
  };
}

function buildDisclosureUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/$/, "")}/cme-disclosure/${token}`;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const cmeDisclosureRouter = router({
  // ── Create a disclosure record ────────────────────────────────────────────
  createDisclosure: protectedProcedure
    .input(z.object({
      orgId: z.number().int().positive().optional(),
      courseId: z.number().int().positive(),
      facultyName: z.string().min(1).max(255),
      facultyEmail: z.string().email().max(255),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await resolveOrgId(ctx.user.id, ctx.user.role, input.orgId);
      await assertCmeEnabled(orgId, ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await requireCmeCourseForOrg(db, input.courseId, orgId);
      const orgContext = await getDisclosureOrgContext(db, orgId);
      const token = generateToken();
      const [result] = await db.insert(cmeFinancialDisclosures).values({
        orgId,
        courseId: input.courseId,
        facultyName: input.facultyName,
        facultyEmail: input.facultyEmail,
        token,
        status: "pending",
      } as any);
      const insertId = (result as any).insertId;
      return { id: insertId, token, disclosureUrl: buildDisclosureUrl(orgContext.baseUrl, token) };
    }),

  // ── Send disclosure email to faculty ─────────────────────────────────────
  sendDisclosureEmail: protectedProcedure
    .input(z.object({
      orgId: z.number().int().positive().optional(),
      disclosureId: z.number().int().positive(),
      origin: z.string().url().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await resolveOrgId(ctx.user.id, ctx.user.role, input.orgId);
      await assertCmeEnabled(orgId, ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const disclosure = await requireDisclosureForOrg(db, input.disclosureId, orgId);
      const orgContext = await getDisclosureOrgContext(db, orgId);
      const course = await requireCmeCourseForOrg(db, (disclosure as any).courseId, orgId);
      const disclosureUrl = buildDisclosureUrl(orgContext.baseUrl, (disclosure as any).token);

      const orgName = orgContext.name;
      const courseTitle = (course as any)?.title ?? "CME Activity";

      const htmlBody = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1e293b;">
          <div style="background:#189aa1;padding:20px 24px;border-radius:8px 8px 0 0;">
            <h1 style="color:white;margin:0;font-size:20px;">Financial Disclosure Required</h1>
          </div>
          <div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
            <p>Dear <strong>${(disclosure as any).facultyName}</strong>,</p>
            <p>As a faculty member or planner for the following CME activity, you are required to complete a Financial Disclosure Form:</p>
            <div style="background:white;border:1px solid #e2e8f0;border-radius:6px;padding:16px;margin:16px 0;">
              <strong>${courseTitle}</strong><br/>
              <span style="color:#64748b;font-size:14px;">${orgName}</span>
            </div>
            <p>Please complete your disclosure by clicking the button below:</p>
            <div style="text-align:center;margin:24px 0;">
              <a href="${disclosureUrl}" style="background:#189aa1;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">
                Complete Financial Disclosure
              </a>
            </div>
            <p style="color:#64748b;font-size:13px;">Or copy this link: <a href="${disclosureUrl}" style="color:#189aa1;">${disclosureUrl}</a></p>
            <p style="color:#94a3b8;font-size:12px;margin-top:24px;">This link is unique to you. Please do not share it with others.</p>
          </div>
        </div>
      `;

      await sendEmail({
        to: { name: (disclosure as any).facultyName, email: (disclosure as any).facultyEmail },
        subject: `Financial Disclosure Required — ${courseTitle}`,
        htmlBody,
      });

      return { success: true, disclosureUrl };
    }),

  // ── Get disclosure by token (public — no auth required) ───────────────────
  getDisclosureByToken: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [disclosure] = await db
        .select()
        .from(cmeFinancialDisclosures)
        .where(eq(cmeFinancialDisclosures.token, input.token))
        .limit(1);
      if (!disclosure) throw new TRPCError({ code: "NOT_FOUND", message: "Disclosure form not found. The link may be invalid or expired." });

      // Fetch course title and org name for display
      const [course] = await db
        .select({ title: lmsCourses.title })
        .from(lmsCourses)
        .where(and(
          eq(lmsCourses.id, (disclosure as any).courseId),
          eq(lmsCourses.orgId, (disclosure as any).orgId),
        ))
        .limit(1);
      const [org] = await db
        .select({ name: organizations.name })
        .from(organizations)
        .where(eq(organizations.id, (disclosure as any).orgId))
        .limit(1);

      return {
        id: (disclosure as any).id,
        facultyName: (disclosure as any).facultyName,
        facultyEmail: (disclosure as any).facultyEmail,
        courseTitle: (course as any)?.title ?? "CME Activity",
        orgName: (org as any)?.name ?? "Organization",
        status: (disclosure as any).status,
        // Return existing submission data if already submitted
        rolesJson: (disclosure as any).rolesJson ?? null,
        relationshipsJson: (disclosure as any).relationshipsJson ?? null,
        hasRelationships: (disclosure as any).hasRelationships ?? null,
        attestationName: (disclosure as any).attestationName ?? null,
        attestationDate: (disclosure as any).attestationDate ?? null,
        submittedAt: (disclosure as any).submittedAt ?? null,
      };
    }),

  // ── Submit disclosure (public — no auth required) ─────────────────────────
  submitDisclosure: publicProcedure
    .input(z.object({
      token: z.string().min(1),
      roles: z.array(z.string()).min(1, "Select at least one role"),
      hasRelationships: z.enum(["yes", "no"]),
      relationships: z.array(z.object({
        company: z.string(),
        relationship: z.string(),
        ended: z.boolean(),
      })).optional().default([]),
      attestationName: z.string().min(1, "Full name is required for attestation"),
      attestationDate: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [disclosure] = await db
        .select()
        .from(cmeFinancialDisclosures)
        .where(eq(cmeFinancialDisclosures.token, input.token))
        .limit(1);
      if (!disclosure) throw new TRPCError({ code: "NOT_FOUND" });
      if ((disclosure as any).status === "submitted") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This disclosure has already been submitted." });
      }

      const now = Date.now();
      const attestationDate = input.attestationDate || new Date().toLocaleDateString("en-US");

      // Generate PDF
      const [course] = await db
        .select({ title: lmsCourses.title })
        .from(lmsCourses)
        .where(and(
          eq(lmsCourses.id, (disclosure as any).courseId),
          eq(lmsCourses.orgId, (disclosure as any).orgId),
        ))
        .limit(1);
      const [org] = await db
        .select({ name: organizations.name })
        .from(organizations)
        .where(eq(organizations.id, (disclosure as any).orgId))
        .limit(1);

      let pdfUrl: string | null = null;
      try {
        const pdfBuffer = await generateDisclosurePdf({
          facultyName: (disclosure as any).facultyName,
          facultyEmail: (disclosure as any).facultyEmail,
          courseTitle: (course as any)?.title ?? "CME Activity",
          orgName: (org as any)?.name ?? "Organization",
          roles: input.roles,
          hasRelationships: input.hasRelationships,
          relationships: input.relationships,
          attestationName: input.attestationName,
          attestationDate,
          submittedAt: new Date(now),
        });
        const fileKey = `cme-disclosures/${(disclosure as any).orgId}/${(disclosure as any).courseId}/${(disclosure as any).id}-${now}.pdf`;
        const { url } = await storagePut(fileKey, pdfBuffer, "application/pdf");
        pdfUrl = url;
      } catch (err) {
        console.error("[cmeDisclosure] PDF generation failed:", err);
      }

      await db
        .update(cmeFinancialDisclosures)
        .set({
          status: "submitted",
          rolesJson: JSON.stringify(input.roles),
          relationshipsJson: JSON.stringify(input.relationships),
          hasRelationships: input.hasRelationships,
          attestationName: input.attestationName,
          attestationDate,
          submittedAt: now,
          pdfUrl,
        } as any)
        .where(eq(cmeFinancialDisclosures.token, input.token));

      return { success: true, pdfUrl };
    }),

  // ── List disclosures for a course ─────────────────────────────────────────
  listDisclosures: protectedProcedure
    .input(z.object({
      orgId: z.number().int().positive().optional(),
      courseId: z.number().int().positive(),
    }))
    .query(async ({ ctx, input }) => {
      const orgId = await resolveOrgId(ctx.user.id, ctx.user.role, input.orgId);
      await assertCmeEnabled(orgId, ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await requireCmeCourseForOrg(db, input.courseId, orgId);
      const orgContext = await getDisclosureOrgContext(db, orgId);
      const rows = await db
        .select()
        .from(cmeFinancialDisclosures)
        .where(and(
          eq(cmeFinancialDisclosures.orgId, orgId),
          eq(cmeFinancialDisclosures.courseId, input.courseId)
        ));
      return rows.map((row: any) => ({
        ...row,
        disclosureUrl: buildDisclosureUrl(orgContext.baseUrl, row.token),
      }));
    }),

  // ── Delete a disclosure record ────────────────────────────────────────────
  deleteDisclosure: protectedProcedure
    .input(z.object({
      orgId: z.number().int().positive().optional(),
      disclosureId: z.number().int().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await resolveOrgId(ctx.user.id, ctx.user.role, input.orgId);
      await assertCmeEnabled(orgId, ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await requireDisclosureForOrg(db, input.disclosureId, orgId);
      await db
        .delete(cmeFinancialDisclosures)
        .where(and(
          eq(cmeFinancialDisclosures.id, input.disclosureId),
          eq(cmeFinancialDisclosures.orgId, orgId)
        ));
      return { success: true };
    }),

  // ── Get/regenerate PDF for a submitted disclosure ─────────────────────────
  getDisclosurePdf: protectedProcedure
    .input(z.object({
      orgId: z.number().int().positive().optional(),
      disclosureId: z.number().int().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await resolveOrgId(ctx.user.id, ctx.user.role, input.orgId);
      await assertCmeEnabled(orgId, ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const disclosure = await requireDisclosureForOrg(db, input.disclosureId, orgId);
      if ((disclosure as any).status !== "submitted") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Disclosure has not been submitted yet." });
      }

      // Return existing PDF URL if available
      if ((disclosure as any).pdfUrl) return { url: (disclosure as any).pdfUrl };

      // Regenerate
      const course = await requireCmeCourseForOrg(db, (disclosure as any).courseId, orgId);
      const [org] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, orgId)).limit(1);

      const pdfBuffer = await generateDisclosurePdf({
        facultyName: (disclosure as any).facultyName,
        facultyEmail: (disclosure as any).facultyEmail,
        courseTitle: (course as any)?.title ?? "CME Activity",
        orgName: (org as any)?.name ?? "Organization",
        roles: JSON.parse((disclosure as any).rolesJson ?? "[]"),
        hasRelationships: ((disclosure as any).hasRelationships ?? "no") as "yes" | "no",
        relationships: JSON.parse((disclosure as any).relationshipsJson ?? "[]"),
        attestationName: (disclosure as any).attestationName ?? "",
        attestationDate: (disclosure as any).attestationDate ?? "",
        submittedAt: new Date((disclosure as any).submittedAt ?? Date.now()),
      });

      const fileKey = `cme-disclosures/${orgId}/${(disclosure as any).courseId}/${(disclosure as any).id}-regen-${Date.now()}.pdf`;
      const { url } = await storagePut(fileKey, pdfBuffer, "application/pdf");

      await db
        .update(cmeFinancialDisclosures)
        .set({ pdfUrl: url } as any)
        .where(and(eq(cmeFinancialDisclosures.id, input.disclosureId), eq(cmeFinancialDisclosures.orgId, orgId)));
      return { url };
    }),
});
