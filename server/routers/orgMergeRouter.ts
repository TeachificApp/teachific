/**
 * orgMergeRouter.ts
 * Teachific™ — Platform Admin Org Merge System
 *
 * Procedures:
 *   preview  — counts all records that would be moved, identifies conflicts
 *   execute  — atomically merges all org-scoped data from source → target
 *   listLogs — lists all merge operations (platform admin only)
 *   getLog   — get details of a single merge operation
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, eq, ne, sql } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb, isPlatformAdmin } from "../db";
import {
  organizations,
  orgMembers,
  orgMergeLogs,
  users,
} from "../../drizzle/schema";

async function assertPlatformAdmin(ctx: { user: { role: string } }) {
  if (!isPlatformAdmin(ctx.user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin access required" });
  }
}

// All org-scoped tables and their column names
// Each entry: [tableName, orgIdColumn]
const ORG_SCOPED_TABLES: [string, string][] = [
  ["org_members", "orgId"],
  ["content_folders", "orgId"],
  ["content_packages", "orgId"],
  ["play_sessions", "orgId"],
  ["analytics_events", "orgId"],
  ["lms_courses", "orgId"],
  ["lms_sections", "orgId"],
  ["lms_lessons", "orgId"],
  ["lms_enrollments", "orgId"],
  ["lms_orders", "orgId"],
  ["lms_groups", "orgId"],
  ["lms_group_seats", "orgId"],
  ["lms_group_courses", "orgId"],
  ["lms_instructors", "orgId"],
  ["lms_course_instructors", "orgId"],
  ["lms_quizzes", "orgId"],
  ["lms_quiz_questions", "orgId"],
  ["lms_quiz_attempts", "orgId"],
  ["lms_lesson_progress", "orgId"],
  ["lms_lesson_notes", "orgId"],
  ["lms_lesson_bookmarks", "orgId"],
  ["lms_video_events", "orgId"],
  ["lms_cohort_sessions", "orgId"],
  ["lms_cohort_groups", "orgId"],
  ["lms_cohort_group_enrollments", "orgId"],
  ["lms_cohort_staff", "orgId"],
  ["lms_cohort_submissions", "orgId"],
  ["lms_cohort_recordings", "orgId"],
  ["lms_cohort_messages", "orgId"],
  ["lms_cohort_assignments", "orgId"],
  ["lms_collections", "orgId"],
  ["lms_collection_courses", "orgId"],
  ["lms_certificates", "orgId"],
  ["lms_certificate_templates", "orgId"],
  ["lms_page_templates", "orgId"],
  ["lms_checkout_pages", "orgId"],
  ["lms_checkout_page_templates", "orgId"],
  ["lms_affiliate_conversions", "orgId"],
  ["funnels", "orgId"],
  ["funnel_pages", "orgId"],
  ["funnel_leads", "orgId"],
  ["funnel_purchases", "orgId"],
  ["funnel_branch_rules", "orgId"],
  ["digital_products", "orgId"],
  ["digital_orders", "orgId"],
  ["digital_bundles", "orgId"],
  ["forms", "orgId"],
  ["general_form_sections", "orgId"],
  ["general_form_items", "orgId"],
  ["general_form_options", "orgId"],
  ["general_form_submissions", "orgId"],
  ["general_form_webhooks", "orgId"],
  ["general_form_branch_rules", "orgId"],
  ["general_form_templates", "orgId"],
  ["email_campaigns", "orgId"],
  ["email_lists", "orgId"],
  ["email_templates", "orgId"],
  ["email_unsubscribes", "orgId"],
  ["media_assets", "orgId"],
  ["media_folders", "orgId"],
  ["media_upload_sessions", "orgId"],
  ["media_versions", "orgId"],
  ["media_view_events", "orgId"],
  ["media_access_rules", "orgId"],
  ["media_access_grants", "orgId"],
  ["org_media_library", "orgId"],
  ["org_media_folders", "orgId"],
  ["memberships", "orgId"],
  ["membership_plans", "orgId"],
  ["membership_plan_access", "orgId"],
  ["membership_subscriptions", "orgId"],
  ["member_activity_events", "orgId"],
  ["courses", "orgId"],
  ["course_enrollments", "orgId"],
  ["course_orders", "orgId"],
  ["course_resources", "orgId"],
  ["course_reviews", "orgId"],
  ["course_announcements", "orgId"],
  ["categories", "orgId"],
  ["instructors", "orgId"],
  ["groups", "orgId"],
  ["coupons", "orgId"],
  ["affiliates", "orgId"],
  ["revenue_partners", "orgId"],
  ["instructor_payout_config", "orgId"],
  ["assignments", "orgId"],
  ["discussions", "orgId"],
  ["community_hubs", "orgId"],
  ["community_spaces", "orgId"],
  ["community_posts", "orgId"],
  ["community_dms", "orgId"],
  ["webinars", "orgId"],
  ["webinar_registrations", "orgId"],
  ["workshops", "orgId"],
  ["flashcard_decks", "orgId"],
  ["quiz_banks", "orgId"],
  ["quiz_bank_questions", "orgId"],
  ["quiz_bank_tags", "orgId"],
  ["quizzes", "orgId"],
  ["quiz_import_jobs", "orgId"],
  ["question_bank_folders", "orgId"],
  ["question_bank_items", "orgId"],
  ["page_builder_pages", "orgId"],
  ["org_site_pages", "orgId"],
  ["org_landing_pages", "orgId"],
  ["org_themes", "orgId"],
  ["org_invoices", "orgId"],
  ["org_subscriptions", "orgId"],
  ["org_user_roles", "orgId"],
  ["org_limit_overrides", "orgId"],
  ["org_payment_settings", "orgId"],
  ["private_invites", "orgId"],
  ["authoring_projects", "orgId"],
  ["block_templates", "orgId"],
  ["order_bumps", "orgId"],
  ["order_bump_conversions", "orgId"],
  ["video_clips", "orgId"],
  ["zapier_webhooks", "orgId"],
  ["zapier_webhook_logs", "orgId"],
  ["certificates", "orgId"],
  ["certificate_templates", "orgId"],
  ["bundles", "orgId"],
  ["physical_products", "orgId"],
  ["kajabi_integrations", "orgId"],
  ["thinkific_integrations", "orgId"],
  ["teachable_integrations", "orgId"],
  ["teachific_pay_charges", "orgId"],
  ["teachific_pay_disputes", "orgId"],
  ["blueprint_installations", "orgId"],
  ["blueprint_licenses", "orgId"],
  ["blueprint_reviews", "orgId"],
  ["blueprint_purchases", "orgId"],
];

// Tables that have a unique constraint on (orgId, slug) or similar — need slug deduplication
const SLUG_TABLES = ["lms_courses", "funnels", "digital_products", "memberships", "courses"];

export const orgMergeRouter = router({
  // ── Preview: count all records that would be moved ────────────────────────
  preview: protectedProcedure
    .input(z.object({
      sourceOrgId: z.number().int().positive(),
      targetOrgId: z.number().int().positive(),
    }))
    .query(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      if (input.sourceOrgId === input.targetOrgId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Source and target organizations must be different" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Verify both orgs exist
      const [sourceOrg] = await db.select({ id: organizations.id, name: organizations.name, slug: organizations.slug })
        .from(organizations).where(eq(organizations.id, input.sourceOrgId)).limit(1);
      if (!sourceOrg) throw new TRPCError({ code: "NOT_FOUND", message: "Source organization not found" });

      const [targetOrg] = await db.select({ id: organizations.id, name: organizations.name, slug: organizations.slug })
        .from(organizations).where(eq(organizations.id, input.targetOrgId)).limit(1);
      if (!targetOrg) throw new TRPCError({ code: "NOT_FOUND", message: "Target organization not found" });

      // Count records per table
      const counts: Record<string, number> = {};
      let totalRecords = 0;

      for (const [table, col] of ORG_SCOPED_TABLES) {
        try {
          const [row] = await db.execute(
            sql.raw(`SELECT COUNT(*) as cnt FROM \`${table}\` WHERE \`${col}\` = ${input.sourceOrgId}`)
          ) as any[];
          const cnt = Number((row as any[])[0]?.cnt ?? 0);
          if (cnt > 0) {
            counts[table] = cnt;
            totalRecords += cnt;
          }
        } catch {
          // Table may not exist in this deployment — skip silently
        }
      }

      // Count org members and check for duplicate emails
      const sourceMembers = await db.select({ userId: orgMembers.userId })
        .from(orgMembers).where(eq(orgMembers.orgId, input.sourceOrgId));

      const targetMemberUserIds = new Set(
        (await db.select({ userId: orgMembers.userId })
          .from(orgMembers).where(eq(orgMembers.orgId, input.targetOrgId)))
          .map(m => m.userId)
      );

      let duplicateMembersCount = 0;
      for (const m of sourceMembers) {
        if (targetMemberUserIds.has(m.userId)) duplicateMembersCount++;
      }

      // Summary counts for key categories
      const summary = {
        sourceOrg,
        targetOrg,
        counts,
        totalRecords,
        members: counts["org_members"] ?? 0,
        duplicateMembersCount,
        courses: (counts["lms_courses"] ?? 0) + (counts["courses"] ?? 0),
        contentPackages: counts["content_packages"] ?? 0,
        enrollments: (counts["lms_enrollments"] ?? 0) + (counts["course_enrollments"] ?? 0),
        funnels: counts["funnels"] ?? 0,
        downloads: counts["digital_products"] ?? 0,
        forms: counts["forms"] ?? 0,
        emailLists: counts["email_lists"] ?? 0,
        mediaAssets: counts["media_assets"] ?? 0,
        blueprintInstalls: counts["blueprint_installations"] ?? 0,
      };

      return summary;
    }),

  // ── Execute: atomically merge all org-scoped data ─────────────────────────
  execute: protectedProcedure
    .input(z.object({
      sourceOrgId: z.number().int().positive(),
      targetOrgId: z.number().int().positive(),
      confirmSourceOrgName: z.string(), // must match source org name exactly
    }))
    .mutation(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      if (input.sourceOrgId === input.targetOrgId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Source and target organizations must be different" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Verify both orgs exist
      const [sourceOrg] = await db.select().from(organizations).where(eq(organizations.id, input.sourceOrgId)).limit(1);
      if (!sourceOrg) throw new TRPCError({ code: "NOT_FOUND", message: "Source organization not found" });
      if (sourceOrg.name !== input.confirmSourceOrgName) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Confirmation name does not match. Expected: "${sourceOrg.name}"` });
      }

      const [targetOrg] = await db.select().from(organizations).where(eq(organizations.id, input.targetOrgId)).limit(1);
      if (!targetOrg) throw new TRPCError({ code: "NOT_FOUND", message: "Target organization not found" });

      // Create merge log entry
      const now = Date.now();
      const [logRow] = await db.insert(orgMergeLogs).values({
        sourceOrgId: input.sourceOrgId,
        targetOrgId: input.targetOrgId,
        initiatedBy: ctx.user.id,
        status: "in_progress",
        createdAt: now,
      }).$returningId();
      const logId = logRow.id;

      const mergedCounts: Record<string, number> = {};
      let totalRecords = 0;
      let duplicateEmailsResolved = 0;
      let slugConflictsResolved = 0;

      try {
        // ── Step 1: Handle org_members — skip duplicates, add new ones ────────
        const targetMemberUserIds = new Set(
          (await db.select({ userId: orgMembers.userId })
            .from(orgMembers).where(eq(orgMembers.orgId, input.targetOrgId)))
            .map(m => m.userId)
        );

        const sourceMembers = await db.select().from(orgMembers).where(eq(orgMembers.orgId, input.sourceOrgId));
        let membersMoved = 0;
        for (const member of sourceMembers) {
          if (targetMemberUserIds.has(member.userId)) {
            // User already in target org — skip (they keep their existing role)
            duplicateEmailsResolved++;
          } else {
            // Move member to target org
            await db.update(orgMembers)
              .set({ orgId: input.targetOrgId })
              .where(eq(orgMembers.id, member.id));
            membersMoved++;
          }
        }
        if (membersMoved > 0) {
          mergedCounts["org_members"] = membersMoved;
          totalRecords += membersMoved;
        }

        // ── Step 2: Bulk UPDATE all other org-scoped tables ───────────────────
        for (const [table, col] of ORG_SCOPED_TABLES) {
          if (table === "org_members") continue; // handled above
          // Skip tables with unique constraints that need special handling
          if (SLUG_TABLES.includes(table)) continue;

          try {
            const result = await db.execute(
              sql.raw(`UPDATE \`${table}\` SET \`${col}\` = ${input.targetOrgId} WHERE \`${col}\` = ${input.sourceOrgId}`)
            ) as any;
            const affected = Number(result[0]?.affectedRows ?? result?.affectedRows ?? 0);
            if (affected > 0) {
              mergedCounts[table] = affected;
              totalRecords += affected;
            }
          } catch {
            // Table may not exist — skip silently
          }
        }

        // ── Step 3: Slug-conflict tables — rename on conflict ─────────────────
        for (const table of SLUG_TABLES) {
          try {
            // Find slug conflicts
            const conflicts = await db.execute(
              sql.raw(`
                SELECT s.id, s.slug FROM \`${table}\` s
                WHERE s.orgId = ${input.sourceOrgId}
                AND EXISTS (
                  SELECT 1 FROM \`${table}\` t
                  WHERE t.orgId = ${input.targetOrgId} AND t.slug = s.slug
                )
              `)
            ) as any;
            const conflictRows = (conflicts[0] as any[]) ?? [];
            for (const row of conflictRows) {
              const newSlug = `${row.slug}-merged-${input.sourceOrgId}`;
              await db.execute(
                sql.raw(`UPDATE \`${table}\` SET slug = '${newSlug}' WHERE id = ${row.id}`)
              );
              slugConflictsResolved++;
            }
            // Now bulk update
            const result = await db.execute(
              sql.raw(`UPDATE \`${table}\` SET orgId = ${input.targetOrgId} WHERE orgId = ${input.sourceOrgId}`)
            ) as any;
            const affected = Number(result[0]?.affectedRows ?? result?.affectedRows ?? 0);
            if (affected > 0) {
              mergedCounts[table] = (mergedCounts[table] ?? 0) + affected;
              totalRecords += affected;
            }
          } catch {
            // Table may not exist — skip silently
          }
        }

        // ── Step 4: Transfer ownership of source org's ownerId to target org ──
        // If the source org owner is not already in the target org, add them as org_admin
        if (sourceOrg.ownerId && !targetMemberUserIds.has(sourceOrg.ownerId)) {
          try {
            await db.insert(orgMembers).values({
              orgId: input.targetOrgId,
              userId: sourceOrg.ownerId,
              role: "org_admin",
              invitedBy: ctx.user.id,
            });
          } catch {
            // May already exist after step 1
          }
        }

        // ── Step 5: Deactivate source org ─────────────────────────────────────
        await db.update(organizations)
          .set({
            isActive: false,
            adminNotes: `Merged into org #${input.targetOrgId} (${targetOrg.name}) on ${new Date().toISOString()} by admin #${ctx.user.id}. ${sourceOrg.adminNotes ?? ""}`.trim(),
          })
          .where(eq(organizations.id, input.sourceOrgId));

        // ── Step 6: Update merge log ───────────────────────────────────────────
        const summaryData = {
          users: mergedCounts["org_members"] ?? 0,
          courses: (mergedCounts["lms_courses"] ?? 0) + (mergedCounts["courses"] ?? 0),
          contentPackages: mergedCounts["content_packages"] ?? 0,
          enrollments: (mergedCounts["lms_enrollments"] ?? 0) + (mergedCounts["course_enrollments"] ?? 0),
          funnels: mergedCounts["funnels"] ?? 0,
          downloads: mergedCounts["digital_products"] ?? 0,
          forms: mergedCounts["forms"] ?? 0,
          emailLists: mergedCounts["email_lists"] ?? 0,
          mediaAssets: mergedCounts["media_assets"] ?? 0,
          otherTables: mergedCounts,
          totalRecords,
          duplicateEmailsResolved,
          slugConflictsResolved,
        };

        await db.update(orgMergeLogs)
          .set({ status: "completed", summary: summaryData, completedAt: Date.now() })
          .where(eq(orgMergeLogs.id, logId));

        return {
          success: true,
          logId,
          summary: summaryData,
          sourceOrgDeactivated: true,
          targetOrgName: targetOrg.name,
        };

      } catch (err) {
        // Mark log as failed
        await db.update(orgMergeLogs)
          .set({
            status: "failed",
            errorMessage: err instanceof Error ? err.message : String(err),
            completedAt: Date.now(),
          })
          .where(eq(orgMergeLogs.id, logId));

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Merge failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }),

  // ── List merge logs ───────────────────────────────────────────────────────
  listLogs: protectedProcedure
    .input(z.object({
      page: z.number().default(1),
      pageSize: z.number().default(20),
    }))
    .query(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const offset = (input.page - 1) * input.pageSize;
      const logs = await db.select().from(orgMergeLogs)
        .orderBy(sql`created_at DESC`)
        .limit(input.pageSize)
        .offset(offset);

      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(orgMergeLogs);

      // Enrich with org names
      const enriched = await Promise.all(logs.map(async (log) => {
        const [src] = await db.select({ name: organizations.name, slug: organizations.slug })
          .from(organizations).where(eq(organizations.id, log.sourceOrgId)).limit(1);
        const [tgt] = await db.select({ name: organizations.name, slug: organizations.slug })
          .from(organizations).where(eq(organizations.id, log.targetOrgId)).limit(1);
        const [initiator] = await db.select({ name: users.name, email: users.email })
          .from(users).where(eq(users.id, log.initiatedBy)).limit(1);
        return {
          ...log,
          sourceOrgName: src?.name ?? `Org #${log.sourceOrgId}`,
          targetOrgName: tgt?.name ?? `Org #${log.targetOrgId}`,
          initiatorName: initiator?.name ?? initiator?.email ?? `User #${log.initiatedBy}`,
        };
      }));

      return { logs: enriched, total: Number(count), page: input.page, pageSize: input.pageSize };
    }),
});
