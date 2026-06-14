/**
 * Platform Import Router
 *
 * Self-service import integrations for Thinkific and Teachable.
 * Each org admin can connect their own account via API key and sync:
 *   - Users (imported as local users + org members)
 *   - Courses (imported as draft LMS courses with sections/lessons)
 *   - Enrollments (linked to imported users and courses)
 *
 * Credentials are stored per-org in thinkific_integrations / teachable_integrations tables.
 * No global/hardcoded credentials are used.
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import {
  thinkificIntegrations,
  teachableIntegrations,
  kajabiIntegrations,
  users,
  orgMembers,
  lmsCourses,
  lmsSections,
  lmsLessons,
  lmsEnrollments,
} from "../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";
import { createTeachableClient } from "../teachable";
import { createKajabiClient } from "../kajabi";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function assertOrgAdmin(role: string) {
  const adminRoles = ["site_owner", "site_admin", "org_super_admin", "org_admin"];
  if (!adminRoles.includes(role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Organization admin access required." });
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 80);
}

async function makeUniqueSlug(db: ReturnType<typeof getDb>, base: string, orgId: number): Promise<string> {
  let slug = slugify(base);
  let attempt = 0;
  while (true) {
    const candidate = attempt === 0 ? slug : `${slug}-${attempt}`;
    const existing = await db
      .select({ id: lmsCourses.id })
      .from(lmsCourses)
      .where(and(eq(lmsCourses.orgId, orgId), eq(lmsCourses.slug, candidate)))
      .limit(1);
    if (existing.length === 0) return candidate;
    attempt++;
  }
}

/**
 * Create a Thinkific API client bound to specific per-org credentials.
 */
function createThinkificClient(subdomain: string, apiKey: string) {
  const BASE_URL = "https://api.thinkific.com/api/public/v1";

  async function thinkificFetch<T>(path: string, retries = 5): Promise<T> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const res = await fetch(`${BASE_URL}${path}`, {
        headers: {
          "X-Auth-API-Key": apiKey,
          "X-Auth-Subdomain": subdomain,
          "Content-Type": "application/json",
        },
      });
      if (res.status === 429) {
        const waitMs = Math.min(3000 * Math.pow(2, attempt), 60000);
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }
        throw new Error("Thinkific API rate limit exceeded. Please wait and try again.");
      }
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Thinkific API error ${res.status}: ${body.substring(0, 200)}`);
      }
      return res.json() as Promise<T>;
    }
    throw new Error("Thinkific API request failed after retries.");
  }

  async function fetchAllPages<T>(basePath: string, limit = 250): Promise<T[]> {
    const results: T[] = [];
    let page = 1;
    while (true) {
      const sep = basePath.includes("?") ? "&" : "?";
      const data = await thinkificFetch<{ items: T[]; meta: { pagination: { next_page: number | null } } }>(
        `${basePath}${sep}page=${page}&limit=${limit}`
      );
      results.push(...data.items);
      if (!data.meta.pagination.next_page) break;
      page++;
      if (page > 1) await new Promise(r => setTimeout(r, 200));
    }
    return results;
  }

  return {
    async validateApiKey(): Promise<{ name: string; subdomain: string }> {
      const data = await thinkificFetch<{ site: { name: string; subdomain: string } }>("/site");
      return data.site;
    },
    async getAllUsers() {
      return fetchAllPages<{
        id: number; email: string; first_name: string; last_name: string;
        created_at: string; roles: string[];
      }>("/users");
    },
    async getAllCourses() {
      return fetchAllPages<{
        id: number; name: string; slug: string; description: string | null;
        course_card_image_url: string | null; banner_image_url: string | null;
        published: boolean; created_at: string;
      }>("/courses");
    },
    async getCourseChapters(courseId: number) {
      return fetchAllPages<{
        id: number; name: string; position: number;
        contents: { id: number; name: string; position: number; content_type: string }[];
      }>(`/courses/${courseId}/chapters`);
    },
    async getCourseEnrollments(courseId: number) {
      return fetchAllPages<{
        id: number; user_id: number; course_id: number;
        activated_at: string | null; completed_at: string | null; percentage_completed: number;
      }>(`/courses/${courseId}/enrollments`);
    },
  };
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const platformImportRouter = router({

  // ─── Thinkific ─────────────────────────────────────────────────────────────

  thinkific: router({
    /**
     * Get current Thinkific integration status for this org.
     */
    getStatus: protectedProcedure
      .input(z.object({ orgId: z.number() }))
      .query(async ({ ctx, input }) => {
        assertOrgAdmin(ctx.user.role);
        const db = getDb();
        const [integration] = await db
          .select()
          .from(thinkificIntegrations)
          .where(eq(thinkificIntegrations.orgId, input.orgId))
          .limit(1);
        if (!integration) return { connected: false };
        const stats = integration.lastSyncStats
          ? JSON.parse(integration.lastSyncStats) as Record<string, number>
          : null;
        return {
          connected: true,
          subdomain: integration.subdomain,
          status: integration.status,
          lastSyncAt: integration.lastSyncAt,
          stats,
        };
      }),

    /**
     * Connect a Thinkific account by validating and storing credentials.
     */
    connect: protectedProcedure
      .input(z.object({
        orgId: z.number(),
        subdomain: z.string().min(1).max(100),
        apiKey: z.string().min(10),
      }))
      .mutation(async ({ ctx, input }) => {
        assertOrgAdmin(ctx.user.role);
        const client = createThinkificClient(input.subdomain, input.apiKey);
        // Validate credentials
        let siteName: string;
        try {
          const site = await client.validateApiKey();
          siteName = site.name;
        } catch (err) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Could not connect to Thinkific: ${(err as Error).message}`,
          });
        }
        const db = getDb();
        await db
          .insert(thinkificIntegrations)
          .values({
            orgId: input.orgId,
            subdomain: input.subdomain,
            apiKey: input.apiKey,
            status: "connected",
          })
          .onDuplicateKeyUpdate({
            set: {
              subdomain: input.subdomain,
              apiKey: input.apiKey,
              status: "connected",
            },
          });
        return { success: true, siteName };
      }),

    /**
     * Disconnect Thinkific integration for this org.
     */
    disconnect: protectedProcedure
      .input(z.object({ orgId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        assertOrgAdmin(ctx.user.role);
        const db = getDb();
        await db
          .delete(thinkificIntegrations)
          .where(eq(thinkificIntegrations.orgId, input.orgId));
        return { success: true };
      }),

    /**
     * Sync users from Thinkific into the local database.
     */
    syncUsers: protectedProcedure
      .input(z.object({ orgId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        assertOrgAdmin(ctx.user.role);
        const db = getDb();
        const [integration] = await db
          .select()
          .from(thinkificIntegrations)
          .where(eq(thinkificIntegrations.orgId, input.orgId))
          .limit(1);
        if (!integration) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Thinkific not connected. Please connect first." });
        }
        const client = createThinkificClient(integration.subdomain, integration.apiKey);
        const thinkificUsers = await client.getAllUsers();

        let imported = 0;
        let skipped = 0;
        let errors = 0;

        for (const tu of thinkificUsers) {
          try {
            const email = tu.email?.toLowerCase().trim();
            if (!email) { skipped++; continue; }
            const fullName = `${tu.first_name ?? ""} ${tu.last_name ?? ""}`.trim() || email;

            // Upsert user by email
            const [existing] = await db
              .select({ id: users.id })
              .from(users)
              .where(eq(users.email, email))
              .limit(1);

            let userId: number;
            if (existing) {
              userId = existing.id;
              skipped++;
            } else {
              const openId = `thinkific_${tu.id}_${Date.now()}`;
              const result = await db.insert(users).values({
                openId,
                name: fullName,
                email,
                loginMethod: "thinkific_import",
                role: "member",
                emailVerified: true,
              });
              userId = (result as unknown as { insertId: number }).insertId;
              imported++;
            }

            // Ensure org membership
            const [existingMember] = await db
              .select({ id: orgMembers.id })
              .from(orgMembers)
              .where(and(eq(orgMembers.orgId, input.orgId), eq(orgMembers.userId, userId)))
              .limit(1);

            if (!existingMember) {
              await db.insert(orgMembers).values({
                orgId: input.orgId,
                userId,
                role: "member",
              });
            }
          } catch {
            errors++;
          }
        }

        // Update sync stats
        const stats = { users: imported, skipped, errors };
        await db
          .update(thinkificIntegrations)
          .set({
            lastSyncAt: new Date(),
            lastSyncStats: JSON.stringify(stats),
          })
          .where(eq(thinkificIntegrations.orgId, input.orgId));

        return { success: true, imported, skipped, errors, total: thinkificUsers.length };
      }),

    /**
     * Sync courses from Thinkific into the local LMS.
     */
    syncCourses: protectedProcedure
      .input(z.object({ orgId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        assertOrgAdmin(ctx.user.role);
        const db = getDb();
        const [integration] = await db
          .select()
          .from(thinkificIntegrations)
          .where(eq(thinkificIntegrations.orgId, input.orgId))
          .limit(1);
        if (!integration) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Thinkific not connected. Please connect first." });
        }
        const client = createThinkificClient(integration.subdomain, integration.apiKey);
        const thinkificCourses = await client.getAllCourses();

        let imported = 0;
        let skipped = 0;
        let errors = 0;

        // Get the owner user id for this org
        const [orgRow] = await db
          .select({ ownerId: orgMembers.userId })
          .from(orgMembers)
          .where(and(eq(orgMembers.orgId, input.orgId), eq(orgMembers.role, "org_super_admin")))
          .limit(1);
        const createdByUserId = orgRow?.ownerId ?? ctx.user.id;

        for (const tc of thinkificCourses) {
          try {
            // Check if already imported (by slug + orgId)
            const baseSlug = slugify(tc.slug || tc.name);
            const [existing] = await db
              .select({ id: lmsCourses.id })
              .from(lmsCourses)
              .where(and(eq(lmsCourses.orgId, input.orgId), eq(lmsCourses.slug, baseSlug)))
              .limit(1);

            if (existing) { skipped++; continue; }

            const slug = await makeUniqueSlug(db, tc.slug || tc.name, input.orgId);
            const [insertResult] = await db.insert(lmsCourses).values({
              orgId: input.orgId,
              slug,
              title: tc.name,
              description: tc.description ?? null,
              coverImageUrl: tc.banner_image_url ?? tc.course_card_image_url ?? null,
              thumbnailUrl: tc.course_card_image_url ?? null,
              status: tc.published ? "public" : "draft",
              isFree: false,
              price: "0",
              pricingType: "one_time",
              createdByUserId,
            });

            const courseId = (insertResult as unknown as { insertId: number }).insertId;

            // Import chapters as sections
            try {
              const chapters = await client.getCourseChapters(tc.id);
              for (const chapter of chapters) {
                const [sectionResult] = await db.insert(lmsSections).values({
                  orgId: input.orgId,
                  courseId,
                  title: chapter.name,
                  position: chapter.position,
                });
                const sectionId = (sectionResult as unknown as { insertId: number }).insertId;

                // Import contents as lessons
                for (const content of chapter.contents ?? []) {
                  const lessonType = content.content_type === "Video" ? "video"
                    : content.content_type === "Quiz" ? "quiz"
                    : content.content_type === "Download" ? "download"
                    : "text";
                  await db.insert(lmsLessons).values({
                    orgId: input.orgId,
                    courseId,
                    sectionId,
                    title: content.name,
                    type: lessonType,
                    position: content.position,
                    isPublished: true,
                  });
                }
              }
            } catch {
              // Section import failure is non-fatal
            }

            imported++;
          } catch {
            errors++;
          }
        }

        return { success: true, imported, skipped, errors, total: thinkificCourses.length };
      }),

    /**
     * Sync enrollments for all imported courses.
     */
    syncEnrollments: protectedProcedure
      .input(z.object({ orgId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        assertOrgAdmin(ctx.user.role);
        const db = getDb();
        const [integration] = await db
          .select()
          .from(thinkificIntegrations)
          .where(eq(thinkificIntegrations.orgId, input.orgId))
          .limit(1);
        if (!integration) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Thinkific not connected. Please connect first." });
        }
        const client = createThinkificClient(integration.subdomain, integration.apiKey);
        const thinkificCourses = await client.getAllCourses();

        let imported = 0;
        let skipped = 0;
        let errors = 0;

        for (const tc of thinkificCourses) {
          try {
            const slug = slugify(tc.slug || tc.name);
            const [localCourse] = await db
              .select({ id: lmsCourses.id })
              .from(lmsCourses)
              .where(and(eq(lmsCourses.orgId, input.orgId), eq(lmsCourses.slug, slug)))
              .limit(1);
            if (!localCourse) continue;

            const enrollments = await client.getCourseEnrollments(tc.id);
            for (const enr of enrollments) {
              try {
                // Find local user by thinkific user_id (via openId pattern)
                const [localUser] = await db
                  .select({ id: users.id })
                  .from(users)
                  .where(sql`openId LIKE ${`thinkific_${enr.user_id}_%`}`)
                  .limit(1);
                if (!localUser) { skipped++; continue; }

                const [existing] = await db
                  .select({ id: lmsEnrollments.id })
                  .from(lmsEnrollments)
                  .where(and(
                    eq(lmsEnrollments.orgId, input.orgId),
                    eq(lmsEnrollments.userId, localUser.id),
                    eq(lmsEnrollments.courseId, localCourse.id)
                  ))
                  .limit(1);

                if (existing) { skipped++; continue; }

                await db.insert(lmsEnrollments).values({
                  orgId: input.orgId,
                  userId: localUser.id,
                  courseId: localCourse.id,
                  status: enr.completed_at ? "completed" : "active",
                  enrolledAt: enr.activated_at ? new Date(enr.activated_at) : new Date(),
                  completedAt: enr.completed_at ? new Date(enr.completed_at) : null,
                  progressPercent: String(enr.percentage_completed ?? 0),
                });
                imported++;
              } catch {
                errors++;
              }
            }
          } catch {
            errors++;
          }
        }

        return { success: true, imported, skipped, errors };
      }),
  }),

  // ─── Teachable ─────────────────────────────────────────────────────────────

  teachable: router({
    /**
     * Get current Teachable integration status for this org.
     */
    getStatus: protectedProcedure
      .input(z.object({ orgId: z.number() }))
      .query(async ({ ctx, input }) => {
        assertOrgAdmin(ctx.user.role);
        const db = getDb();
        const [integration] = await db
          .select()
          .from(teachableIntegrations)
          .where(eq(teachableIntegrations.orgId, input.orgId))
          .limit(1);
        if (!integration) return { connected: false };
        const stats = integration.lastSyncStats
          ? JSON.parse(integration.lastSyncStats) as Record<string, number>
          : null;
        return {
          connected: true,
          schoolName: integration.schoolName,
          status: integration.status,
          lastSyncAt: integration.lastSyncAt,
          stats,
        };
      }),

    /**
     * Connect a Teachable account by validating and storing the API key.
     */
    connect: protectedProcedure
      .input(z.object({
        orgId: z.number(),
        apiKey: z.string().min(10),
      }))
      .mutation(async ({ ctx, input }) => {
        assertOrgAdmin(ctx.user.role);
        const client = createTeachableClient(input.apiKey);
        let schoolName: string;
        try {
          const school = await client.validateApiKey();
          schoolName = school.name;
        } catch (err) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Could not connect to Teachable: ${(err as Error).message}`,
          });
        }
        const db = getDb();
        await db
          .insert(teachableIntegrations)
          .values({
            orgId: input.orgId,
            apiKey: input.apiKey,
            schoolName,
            status: "connected",
          })
          .onDuplicateKeyUpdate({
            set: {
              apiKey: input.apiKey,
              schoolName,
              status: "connected",
            },
          });
        return { success: true, schoolName };
      }),

    /**
     * Disconnect Teachable integration for this org.
     */
    disconnect: protectedProcedure
      .input(z.object({ orgId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        assertOrgAdmin(ctx.user.role);
        const db = getDb();
        await db
          .delete(teachableIntegrations)
          .where(eq(teachableIntegrations.orgId, input.orgId));
        return { success: true };
      }),

    /**
     * Sync users from Teachable into the local database.
     */
    syncUsers: protectedProcedure
      .input(z.object({ orgId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        assertOrgAdmin(ctx.user.role);
        const db = getDb();
        const [integration] = await db
          .select()
          .from(teachableIntegrations)
          .where(eq(teachableIntegrations.orgId, input.orgId))
          .limit(1);
        if (!integration) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Teachable not connected. Please connect first." });
        }
        const client = createTeachableClient(integration.apiKey);
        const teachableUsers = await client.getAllUsers();

        let imported = 0;
        let skipped = 0;
        let errors = 0;

        for (const tu of teachableUsers) {
          try {
            const email = tu.email?.toLowerCase().trim();
            if (!email) { skipped++; continue; }

            const [existing] = await db
              .select({ id: users.id })
              .from(users)
              .where(eq(users.email, email))
              .limit(1);

            let userId: number;
            if (existing) {
              userId = existing.id;
              skipped++;
            } else {
              const openId = `teachable_${tu.id}_${Date.now()}`;
              const result = await db.insert(users).values({
                openId,
                name: tu.name || email,
                email,
                loginMethod: "teachable_import",
                role: "member",
                emailVerified: true,
              });
              userId = (result as unknown as { insertId: number }).insertId;
              imported++;
            }

            const [existingMember] = await db
              .select({ id: orgMembers.id })
              .from(orgMembers)
              .where(and(eq(orgMembers.orgId, input.orgId), eq(orgMembers.userId, userId)))
              .limit(1);

            if (!existingMember) {
              await db.insert(orgMembers).values({
                orgId: input.orgId,
                userId,
                role: "member",
              });
            }
          } catch {
            errors++;
          }
        }

        const stats = { users: imported, skipped, errors };
        await db
          .update(teachableIntegrations)
          .set({
            lastSyncAt: new Date(),
            lastSyncStats: JSON.stringify(stats),
          })
          .where(eq(teachableIntegrations.orgId, input.orgId));

        return { success: true, imported, skipped, errors, total: teachableUsers.length };
      }),

    /**
     * Sync courses from Teachable into the local LMS.
     */
    syncCourses: protectedProcedure
      .input(z.object({ orgId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        assertOrgAdmin(ctx.user.role);
        const db = getDb();
        const [integration] = await db
          .select()
          .from(teachableIntegrations)
          .where(eq(teachableIntegrations.orgId, input.orgId))
          .limit(1);
        if (!integration) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Teachable not connected. Please connect first." });
        }
        const client = createTeachableClient(integration.apiKey);
        const teachableCourses = await client.getAllCourses();

        let imported = 0;
        let skipped = 0;
        let errors = 0;

        const [orgRow] = await db
          .select({ ownerId: orgMembers.userId })
          .from(orgMembers)
          .where(and(eq(orgMembers.orgId, input.orgId), eq(orgMembers.role, "org_super_admin")))
          .limit(1);
        const createdByUserId = orgRow?.ownerId ?? ctx.user.id;

        for (const tc of teachableCourses) {
          try {
            const baseSlug = slugify(tc.name);
            const [existing] = await db
              .select({ id: lmsCourses.id })
              .from(lmsCourses)
              .where(and(eq(lmsCourses.orgId, input.orgId), eq(lmsCourses.slug, baseSlug)))
              .limit(1);
            if (existing) { skipped++; continue; }

            const slug = await makeUniqueSlug(db, tc.name, input.orgId);
            const [insertResult] = await db.insert(lmsCourses).values({
              orgId: input.orgId,
              slug,
              title: tc.name,
              description: tc.description ?? null,
              coverImageUrl: tc.image_url ?? null,
              thumbnailUrl: tc.image_url ?? null,
              status: tc.is_published ? "public" : "draft",
              isFree: false,
              price: "0",
              pricingType: "one_time",
              createdByUserId,
            });

            const courseId = (insertResult as unknown as { insertId: number }).insertId;

            // Import sections
            try {
              const sections = await client.getCourseSections(tc.id);
              for (const section of sections) {
                const [sectionResult] = await db.insert(lmsSections).values({
                  orgId: input.orgId,
                  courseId,
                  title: section.name,
                  position: section.position,
                });
                const sectionId = (sectionResult as unknown as { insertId: number }).insertId;

                for (const lecture of section.lectures ?? []) {
                  const lessonType = lecture.lecture_type === "video" ? "video"
                    : lecture.lecture_type === "quiz" ? "quiz"
                    : "text";
                  await db.insert(lmsLessons).values({
                    orgId: input.orgId,
                    courseId,
                    sectionId,
                    title: lecture.name,
                    type: lessonType,
                    position: lecture.position,
                    isPublished: lecture.is_published,
                  });
                }
              }
            } catch {
              // Section import failure is non-fatal
            }

            imported++;
          } catch {
            errors++;
          }
        }

        return { success: true, imported, skipped, errors, total: teachableCourses.length };
      }),

    /**
     * Sync enrollments from Teachable.
     */
    syncEnrollments: protectedProcedure
      .input(z.object({ orgId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        assertOrgAdmin(ctx.user.role);
        const db = getDb();
        const [integration] = await db
          .select()
          .from(teachableIntegrations)
          .where(eq(teachableIntegrations.orgId, input.orgId))
          .limit(1);
        if (!integration) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Teachable not connected. Please connect first." });
        }
        const client = createTeachableClient(integration.apiKey);
        const teachableCourses = await client.getAllCourses();
        const allEnrollments = await client.getAllEnrollments(teachableCourses);

        let imported = 0;
        let skipped = 0;
        let errors = 0;

        for (const enr of allEnrollments) {
          try {
            const [localUser] = await db
              .select({ id: users.id })
              .from(users)
              .where(sql`openId LIKE ${`teachable_${enr.user_id}_%`}`)
              .limit(1);
            if (!localUser) { skipped++; continue; }

            // Find local course by teachable course id (approximation by position)
            const slug = slugify(teachableCourses.find(c => c.id === enr.course_id)?.name ?? "");
            if (!slug) { skipped++; continue; }

            const [localCourse] = await db
              .select({ id: lmsCourses.id })
              .from(lmsCourses)
              .where(and(eq(lmsCourses.orgId, input.orgId), eq(lmsCourses.slug, slug)))
              .limit(1);
            if (!localCourse) { skipped++; continue; }

            const [existing] = await db
              .select({ id: lmsEnrollments.id })
              .from(lmsEnrollments)
              .where(and(
                eq(lmsEnrollments.orgId, input.orgId),
                eq(lmsEnrollments.userId, localUser.id),
                eq(lmsEnrollments.courseId, localCourse.id)
              ))
              .limit(1);
            if (existing) { skipped++; continue; }

            await db.insert(lmsEnrollments).values({
              orgId: input.orgId,
              userId: localUser.id,
              courseId: localCourse.id,
              status: enr.completed_at ? "completed" : "active",
              enrolledAt: new Date(enr.enrolled_at),
              completedAt: enr.completed_at ? new Date(enr.completed_at) : null,
              progressPercent: String(enr.percent_complete ?? 0),
            });
            imported++;
          } catch {
            errors++;
          }
        }

        return { success: true, imported, skipped, errors };
      }),
  }),

  // ─── Kajabi ────────────────────────────────────────────────────────────────

  kajabi: router({
    /**
     * Get current Kajabi integration status for this org.
     */
    getStatus: protectedProcedure
      .input(z.object({ orgId: z.number() }))
      .query(async ({ ctx, input }) => {
        assertOrgAdmin(ctx.user.role);
        const db = getDb();
        const [integration] = await db
          .select()
          .from(kajabiIntegrations)
          .where(eq(kajabiIntegrations.orgId, input.orgId))
          .limit(1);
        if (!integration) return { connected: false };
        const stats = integration.lastSyncStats
          ? JSON.parse(integration.lastSyncStats as string) as Record<string, number>
          : null;
        return {
          connected: true,
          schoolName: integration.schoolName,
          status: integration.status,
          lastSyncAt: integration.lastSyncAt,
          stats,
        };
      }),

    /**
     * Connect a Kajabi account by validating and storing the API key.
     */
    connect: protectedProcedure
      .input(z.object({
        orgId: z.number(),
        apiKey: z.string().min(10),
      }))
      .mutation(async ({ ctx, input }) => {
        assertOrgAdmin(ctx.user.role);
        const client = createKajabiClient(input.apiKey);
        let schoolName: string;
        try {
          const site = await client.validateAndGetSite();
          schoolName = site.schoolName;
        } catch (err) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Could not connect to Kajabi: ${(err as Error).message}`,
          });
        }
        const db = getDb();
        const now = Date.now();
        await db
          .insert(kajabiIntegrations)
          .values({
            orgId: input.orgId,
            apiKey: input.apiKey,
            schoolName,
            status: "connected",
            createdAt: now,
            updatedAt: now,
          })
          .onDuplicateKeyUpdate({
            set: {
              apiKey: input.apiKey,
              schoolName,
              status: "connected",
              updatedAt: now,
            },
          });
        return { success: true, schoolName };
      }),

    /**
     * Disconnect Kajabi integration for this org.
     */
    disconnect: protectedProcedure
      .input(z.object({ orgId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        assertOrgAdmin(ctx.user.role);
        const db = getDb();
        await db
          .delete(kajabiIntegrations)
          .where(eq(kajabiIntegrations.orgId, input.orgId));
        return { success: true };
      }),

    /**
     * Sync Kajabi members into the local users + org_members tables.
     */
    syncUsers: protectedProcedure
      .input(z.object({ orgId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        assertOrgAdmin(ctx.user.role);
        const db = getDb();
        const [integration] = await db
          .select()
          .from(kajabiIntegrations)
          .where(eq(kajabiIntegrations.orgId, input.orgId))
          .limit(1);
        if (!integration) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Kajabi not connected. Please connect first." });
        }
        const client = createKajabiClient(integration.apiKey);
        const members = await client.getAllMembers();

        let imported = 0;
        let skipped = 0;
        let errors = 0;

        for (const member of members) {
          try {
            const email = member.email?.toLowerCase().trim();
            if (!email) { skipped++; continue; }
            const fullName = `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() || email;

            const [existing] = await db
              .select({ id: users.id })
              .from(users)
              .where(eq(users.email, email))
              .limit(1);

            let userId: number;
            if (existing) {
              userId = existing.id;
              skipped++;
            } else {
              const openId = `kajabi_${member.id}_${Date.now()}`;
              const result = await db.insert(users).values({
                openId,
                name: fullName,
                email,
                loginMethod: "kajabi_import",
                role: "member",
                emailVerified: true,
              });
              userId = (result as unknown as { insertId: number }).insertId;
              imported++;
            }

            const [existingMember] = await db
              .select({ id: orgMembers.id })
              .from(orgMembers)
              .where(and(eq(orgMembers.orgId, input.orgId), eq(orgMembers.userId, userId)))
              .limit(1);

            if (!existingMember) {
              await db.insert(orgMembers).values({
                orgId: input.orgId,
                userId,
                role: "member",
              });
            }
          } catch {
            errors++;
          }
        }

        const now = Date.now();
        const stats = { users: imported, skipped, errors };
        await db
          .update(kajabiIntegrations)
          .set({ lastSyncAt: now, lastSyncStats: JSON.stringify(stats), updatedAt: now })
          .where(eq(kajabiIntegrations.orgId, input.orgId));

        return { success: true, imported, skipped, errors, total: members.length };
      }),

    /**
     * Sync Kajabi products (courses) into the local LMS.
     */
    syncCourses: protectedProcedure
      .input(z.object({ orgId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        assertOrgAdmin(ctx.user.role);
        const db = getDb();
        const [integration] = await db
          .select()
          .from(kajabiIntegrations)
          .where(eq(kajabiIntegrations.orgId, input.orgId))
          .limit(1);
        if (!integration) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Kajabi not connected. Please connect first." });
        }
        const client = createKajabiClient(integration.apiKey);
        const products = await client.getAllProducts();

        let imported = 0;
        let skipped = 0;
        let errors = 0;

        const [orgRow] = await db
          .select({ ownerId: orgMembers.userId })
          .from(orgMembers)
          .where(and(eq(orgMembers.orgId, input.orgId), eq(orgMembers.role, "org_super_admin")))
          .limit(1);
        const createdByUserId = orgRow?.ownerId ?? ctx.user.id;

        for (const product of products) {
          try {
            const baseSlug = slugify(product.slug ?? product.title);
            const [existing] = await db
              .select({ id: lmsCourses.id })
              .from(lmsCourses)
              .where(and(eq(lmsCourses.orgId, input.orgId), eq(lmsCourses.slug, baseSlug)))
              .limit(1);
            if (existing) { skipped++; continue; }

            const slug = await makeUniqueSlug(db, product.slug ?? product.title, input.orgId);
            await db.insert(lmsCourses).values({
              orgId: input.orgId,
              slug,
              title: product.title,
              description: product.description ?? null,
              thumbnailUrl: product.thumbnail_url ?? null,
              status: product.published ? "public" : "draft",
              isFree: false,
              price: product.price ? String(product.price / 100) : "0",
              pricingType: "one_time",
              createdByUserId,
            });
            imported++;
          } catch {
            errors++;
          }
        }

        const now = Date.now();
        const stats = { courses: imported, skipped, errors };
        await db
          .update(kajabiIntegrations)
          .set({ lastSyncAt: now, lastSyncStats: JSON.stringify(stats), updatedAt: now })
          .where(eq(kajabiIntegrations.orgId, input.orgId));

        return { success: true, imported, skipped, errors, total: products.length };
      }),

    /**
     * Sync Kajabi memberships (product access grants) as LMS enrollments.
     */
    syncMemberships: protectedProcedure
      .input(z.object({ orgId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        assertOrgAdmin(ctx.user.role);
        const db = getDb();
        const [integration] = await db
          .select()
          .from(kajabiIntegrations)
          .where(eq(kajabiIntegrations.orgId, input.orgId))
          .limit(1);
        if (!integration) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Kajabi not connected. Please connect first." });
        }
        const client = createKajabiClient(integration.apiKey);
        const memberships = await client.getAllMemberships();
        const products = await client.getAllProducts();

        let imported = 0;
        let skipped = 0;
        let errors = 0;

        for (const membership of memberships) {
          try {
            if (membership.state !== "active") { skipped++; continue; }

            // Find local user by Kajabi member id pattern
            const [localUser] = await db
              .select({ id: users.id, email: users.email })
              .from(users)
              .where(sql`${users.openId} LIKE ${`kajabi_${membership.member_id}_%`}`)
              .limit(1);
            if (!localUser) { skipped++; continue; }

            const product = products.find(p => p.id === membership.product_id);
            if (!product) { skipped++; continue; }

            const productSlug = slugify(product.slug ?? product.title);
            const [localCourse] = await db
              .select({ id: lmsCourses.id })
              .from(lmsCourses)
              .where(and(eq(lmsCourses.orgId, input.orgId), eq(lmsCourses.slug, productSlug)))
              .limit(1);
            if (!localCourse) { skipped++; continue; }

            const [existing] = await db
              .select({ id: lmsEnrollments.id })
              .from(lmsEnrollments)
              .where(and(
                eq(lmsEnrollments.orgId, input.orgId),
                eq(lmsEnrollments.userId, localUser.id),
                eq(lmsEnrollments.courseId, localCourse.id)
              ))
              .limit(1);
            if (existing) { skipped++; continue; }

            await db.insert(lmsEnrollments).values({
              orgId: input.orgId,
              userId: localUser.id,
              courseId: localCourse.id,
              status: "active",
              enrolledAt: new Date(membership.created_at),
            });
            imported++;
          } catch {
            errors++;
          }
        }

        const now = Date.now();
        const stats = { memberships: imported, skipped, errors };
        await db
          .update(kajabiIntegrations)
          .set({ lastSyncAt: now, lastSyncStats: JSON.stringify(stats), updatedAt: now })
          .where(eq(kajabiIntegrations.orgId, input.orgId));

        return { success: true, imported, skipped, errors, total: memberships.length };
      }),
  }),
});
