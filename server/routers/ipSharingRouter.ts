/**
 * ipSharingRouter — IP Sharing Monitor
 *
 * Scoping rules:
 *  - Platform admin (site_owner / site_admin): sees all flags across all orgs
 *  - Org admin (org_super_admin / org_admin): sees only flags for members of their org
 *  - Members / sub-users: no access
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb, isPlatformAdmin, requireOrgAdmin } from "../db";
import {
  sharingAbuseFlags,
  ipAccessLogs,
  users,
  organizations,
  orgMembers,
  courseEnrollments,
  lmsCourses,
} from "../../drizzle/schema";
import { and, desc, eq, gte, inArray, sql, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function assertCanViewFlags(
  userId: number,
  platformRole: string,
  orgIdHint?: number
): Promise<{ isPlatform: boolean; orgId: number | null }> {
  if (isPlatformAdmin(platformRole)) {
    return { isPlatform: true, orgId: orgIdHint ?? null };
  }
  // Must be org admin — resolve their org
  const orgId = await requireOrgAdmin(userId, platformRole, orgIdHint);
  return { isPlatform: false, orgId };
}

// ─── Router ──────────────────────────────────────────────────────────────────

export const ipSharingRouter = router({
  /**
   * List flagged users.
   * Platform admin: all orgs (optionally filtered by orgId).
   * Org admin: only their org's members.
   */
  getFlags: protectedProcedure
    .input(
      z.object({
        orgId: z.number().optional(),
        status: z.enum(["flagged", "confirmed", "dismissed", "warned", "all"]).default("all"),
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const { isPlatform, orgId } = await assertCanViewFlags(
        ctx.user.id,
        ctx.user.role,
        input.orgId
      );

      // Build the base query — join users + org membership to get org context
      const conditions = [];
      if (input.status !== "all") {
        conditions.push(eq(sharingAbuseFlags.status, input.status as any));
      }

      // If org-scoped, restrict to users who are members of that org
      let orgScopedUserIds: number[] | null = null;
      if (!isPlatform && orgId) {
        const members = await db
          .select({ userId: orgMembers.userId })
          .from(orgMembers)
          .where(eq(orgMembers.orgId, orgId));
        orgScopedUserIds = members.map((m) => m.userId);
        if (orgScopedUserIds.length === 0) return { flags: [], total: 0 };
        conditions.push(inArray(sharingAbuseFlags.userId, orgScopedUserIds));
      } else if (isPlatform && orgId) {
        // Platform admin filtering by specific org
        const members = await db
          .select({ userId: orgMembers.userId })
          .from(orgMembers)
          .where(eq(orgMembers.orgId, orgId));
        orgScopedUserIds = members.map((m) => m.userId);
        if (orgScopedUserIds.length === 0) return { flags: [], total: 0 };
        conditions.push(inArray(sharingAbuseFlags.userId, orgScopedUserIds));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [flags, [{ total }]] = await Promise.all([
        db
          .select({
            id: sharingAbuseFlags.id,
            userId: sharingAbuseFlags.userId,
            status: sharingAbuseFlags.status,
            distinctIpCount: sharingAbuseFlags.distinctIpCount,
            ipAddresses: sharingAbuseFlags.ipAddresses,
            detectionReason: sharingAbuseFlags.detectionReason,
            alertSentAt: sharingAbuseFlags.alertSentAt,
            reviewedAt: sharingAbuseFlags.reviewedAt,
            notes: sharingAbuseFlags.notes,
            createdAt: sharingAbuseFlags.createdAt,
            updatedAt: sharingAbuseFlags.updatedAt,
            // User info
            userName: users.name,
            userEmail: users.email,
            userAvatar: users.avatarUrl,
          })
          .from(sharingAbuseFlags)
          .innerJoin(users, eq(sharingAbuseFlags.userId, users.id))
          .where(whereClause)
          .orderBy(desc(sharingAbuseFlags.createdAt))
          .limit(input.limit)
          .offset(input.offset),
        db
          .select({ total: count() })
          .from(sharingAbuseFlags)
          .where(whereClause),
      ]);

      // Attach org info for platform admin view
      let flagsWithOrg = flags as Array<typeof flags[0] & { orgName?: string; orgId?: number }>;
      if (isPlatform) {
        const userIds = flags.map((f) => f.userId);
        if (userIds.length > 0) {
          const memberships = await db
            .select({
              userId: orgMembers.userId,
              orgId: orgMembers.orgId,
              orgName: organizations.name,
            })
            .from(orgMembers)
            .innerJoin(organizations, eq(orgMembers.orgId, organizations.id))
            .where(inArray(orgMembers.userId, userIds));
          const orgByUser = new Map<number, { orgId: number; orgName: string }>();
          for (const m of memberships) {
            if (!orgByUser.has(m.userId)) {
              orgByUser.set(m.userId, { orgId: m.orgId, orgName: m.orgName });
            }
          }
          flagsWithOrg = flags.map((f) => ({
            ...f,
            orgName: orgByUser.get(f.userId)?.orgName,
            orgId: orgByUser.get(f.userId)?.orgId,
          }));
        }
      }

      return { flags: flagsWithOrg, total };
    }),

  /**
   * Update a flag status (confirm / warn / dismiss) with optional notes.
   * Platform admin: any flag. Org admin: only flags for their org's members.
   */
  updateFlag: protectedProcedure
    .input(
      z.object({
        flagId: z.number(),
        status: z.enum(["flagged", "confirmed", "dismissed", "warned"]),
        notes: z.string().max(2000).optional(),
        orgId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const { isPlatform, orgId } = await assertCanViewFlags(
        ctx.user.id,
        ctx.user.role,
        input.orgId
      );

      // Fetch the flag to verify org scope
      const [flag] = await db
        .select({ id: sharingAbuseFlags.id, userId: sharingAbuseFlags.userId })
        .from(sharingAbuseFlags)
        .where(eq(sharingAbuseFlags.id, input.flagId))
        .limit(1);

      if (!flag) throw new TRPCError({ code: "NOT_FOUND", message: "Flag not found" });

      // Org admin: verify the flagged user is in their org
      if (!isPlatform && orgId) {
        const [membership] = await db
          .select({ userId: orgMembers.userId })
          .from(orgMembers)
          .where(and(eq(orgMembers.userId, flag.userId), eq(orgMembers.orgId, orgId)))
          .limit(1);
        if (!membership) {
          throw new TRPCError({ code: "FORBIDDEN", message: "This user is not in your organisation" });
        }
      }

      await db
        .update(sharingAbuseFlags)
        .set({
          status: input.status,
          notes: input.notes ?? null,
          reviewedAt: new Date(),
          reviewedBy: ctx.user.id,
          updatedAt: new Date(),
        })
        .where(eq(sharingAbuseFlags.id, input.flagId));

      return { success: true };
    }),

  /**
   * Get the full IP access timeline for a specific user.
   * Returns chronological log of all IP accesses with content info.
   */
  getIpTimeline: protectedProcedure
    .input(
      z.object({
        userId: z.number(),
        orgId: z.number().optional(),
        limit: z.number().min(1).max(500).default(100),
        offset: z.number().default(0),
        since: z.date().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const { isPlatform, orgId } = await assertCanViewFlags(
        ctx.user.id,
        ctx.user.role,
        input.orgId
      );

      // Org admin: verify the target user is in their org
      if (!isPlatform && orgId) {
        const [membership] = await db
          .select({ userId: orgMembers.userId })
          .from(orgMembers)
          .where(and(eq(orgMembers.userId, input.userId), eq(orgMembers.orgId, orgId)))
          .limit(1);
        if (!membership) {
          throw new TRPCError({ code: "FORBIDDEN", message: "This user is not in your organisation" });
        }
      }

      const conditions = [eq(ipAccessLogs.userId, input.userId)];
      if (input.since) {
        conditions.push(gte(ipAccessLogs.accessedAt, input.since));
      }

      const logs = await db
        .select({
          id: ipAccessLogs.id,
          ipAddress: ipAccessLogs.ipAddress,
          userAgent: ipAccessLogs.userAgent,
          contentType: ipAccessLogs.contentType,
          contentId: ipAccessLogs.contentId,
          accessedAt: ipAccessLogs.accessedAt,
        })
        .from(ipAccessLogs)
        .where(and(...conditions))
        .orderBy(desc(ipAccessLogs.accessedAt))
        .limit(input.limit)
        .offset(input.offset);

      // Enrich with course titles for course-type logs
      const courseIds = logs
        .filter((l) => l.contentType === "course" && l.contentId)
        .map((l) => l.contentId as number);

      const courseTitles = new Map<number, string>();
      if (courseIds.length > 0) {
        const courses = await db
          .select({ id: lmsCourses.id, title: lmsCourses.title })
          .from(lmsCourses)
          .where(inArray(lmsCourses.id, courseIds));
        for (const c of courses) courseTitles.set(c.id, c.title);
      }

      const enriched = logs.map((l) => ({
        ...l,
        contentTitle:
          l.contentType === "course" && l.contentId
            ? (courseTitles.get(l.contentId) ?? `Course #${l.contentId}`)
            : l.contentType === "download"
            ? `Download #${l.contentId}`
            : l.contentType === "paid_content"
            ? `Content #${l.contentId}`
            : "Unknown",
      }));

      // Summary stats
      const distinctIps = new Set(logs.map((l) => l.ipAddress)).size;
      const last24hIps = new Set(
        logs
          .filter((l) => l.accessedAt > new Date(Date.now() - 24 * 60 * 60 * 1000))
          .map((l) => l.ipAddress)
      ).size;

      return {
        logs: enriched,
        summary: {
          totalAccesses: logs.length,
          distinctIps,
          last24hIps,
        },
      };
    }),

  /**
   * Get per-enrollment IP access summary for a user.
   * Used in the Enrollments tab of UserDetailPanel.
   */
  getEnrollmentIpSummary: protectedProcedure
    .input(
      z.object({
        userId: z.number(),
        orgId: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const { isPlatform, orgId } = await assertCanViewFlags(
        ctx.user.id,
        ctx.user.role,
        input.orgId
      );

      // Org admin: verify the target user is in their org
      if (!isPlatform && orgId) {
        const [membership] = await db
          .select({ userId: orgMembers.userId })
          .from(orgMembers)
          .where(and(eq(orgMembers.userId, input.userId), eq(orgMembers.orgId, orgId)))
          .limit(1);
        if (!membership) {
          throw new TRPCError({ code: "FORBIDDEN", message: "This user is not in your organisation" });
        }
      }

      // Get enrollments with course titles
      const enrollments = await db
        .select({
          enrollmentId: courseEnrollments.id,
          courseId: courseEnrollments.courseId,
          courseTitle: lmsCourses.title,
          enrolledAt: courseEnrollments.enrolledAt,
          progressPct: courseEnrollments.progressPct,
          lastAccessedAt: courseEnrollments.lastAccessedAt,
          isActive: courseEnrollments.isActive,
        })
        .from(courseEnrollments)
        .innerJoin(lmsCourses, eq(courseEnrollments.courseId, lmsCourses.id))
        .where(
          and(
            eq(courseEnrollments.userId, input.userId),
            eq(courseEnrollments.isActive, true)
          )
        )
        .orderBy(desc(courseEnrollments.enrolledAt));

      if (enrollments.length === 0) return { enrollments: [] };

      // For each enrollment, get distinct IPs and last access IP from ip_access_logs
      const courseIds = enrollments.map((e) => e.courseId);
      const ipLogs = await db
        .select({
          contentId: ipAccessLogs.contentId,
          ipAddress: ipAccessLogs.ipAddress,
          accessedAt: ipAccessLogs.accessedAt,
        })
        .from(ipAccessLogs)
        .where(
          and(
            eq(ipAccessLogs.userId, input.userId),
            eq(ipAccessLogs.contentType, "course"),
            inArray(ipAccessLogs.contentId as any, courseIds)
          )
        )
        .orderBy(desc(ipAccessLogs.accessedAt));

      // Group by courseId
      const ipsByCourse = new Map<
        number,
        { ips: Set<string>; lastIp: string | null; lastAt: Date | null; accessCount: number }
      >();
      for (const log of ipLogs) {
        if (!log.contentId) continue;
        if (!ipsByCourse.has(log.contentId)) {
          ipsByCourse.set(log.contentId, { ips: new Set(), lastIp: null, lastAt: null, accessCount: 0 });
        }
        const entry = ipsByCourse.get(log.contentId)!;
        entry.ips.add(log.ipAddress);
        entry.accessCount++;
        if (!entry.lastAt || log.accessedAt > entry.lastAt) {
          entry.lastAt = log.accessedAt;
          entry.lastIp = log.ipAddress;
        }
      }

      const result = enrollments.map((e) => {
        const ipData = ipsByCourse.get(e.courseId);
        return {
          ...e,
          distinctIpCount: ipData?.ips.size ?? 0,
          lastAccessIp: ipData?.lastIp ?? null,
          lastIpAccessAt: ipData?.lastAt ?? null,
          accessCount: ipData?.accessCount ?? 0,
          isSuspicious: (ipData?.ips.size ?? 0) >= 3,
        };
      });

      return { enrollments: result };
    }),

  /**
   * Get org-level risk summary.
   * Platform admin: all orgs. Org admin: their org only.
   */
  getOrgRiskSummary: protectedProcedure
    .input(
      z.object({
        orgId: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const { isPlatform, orgId } = await assertCanViewFlags(
        ctx.user.id,
        ctx.user.role,
        input.orgId
      );

      if (!isPlatform && !orgId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No org context" });
      }

      if (!isPlatform && orgId) {
        // Single org summary
        const members = await db
          .select({ userId: orgMembers.userId })
          .from(orgMembers)
          .where(eq(orgMembers.orgId, orgId));
        const userIds = members.map((m) => m.userId);
        if (userIds.length === 0) return { orgs: [], totalFlagged: 0, totalConfirmed: 0 };

        const [flagCounts] = await db
          .select({
            flagged: sql<number>`SUM(CASE WHEN ${sharingAbuseFlags.status} = 'flagged' THEN 1 ELSE 0 END)`,
            confirmed: sql<number>`SUM(CASE WHEN ${sharingAbuseFlags.status} = 'confirmed' THEN 1 ELSE 0 END)`,
            warned: sql<number>`SUM(CASE WHEN ${sharingAbuseFlags.status} = 'warned' THEN 1 ELSE 0 END)`,
            dismissed: sql<number>`SUM(CASE WHEN ${sharingAbuseFlags.status} = 'dismissed' THEN 1 ELSE 0 END)`,
          })
          .from(sharingAbuseFlags)
          .where(inArray(sharingAbuseFlags.userId, userIds));

        return {
          orgs: [],
          totalFlagged: Number(flagCounts?.flagged ?? 0),
          totalConfirmed: Number(flagCounts?.confirmed ?? 0),
          totalWarned: Number(flagCounts?.warned ?? 0),
          totalDismissed: Number(flagCounts?.dismissed ?? 0),
          memberCount: userIds.length,
        };
      }

      // Platform admin: per-org breakdown
      const orgFlagCounts = await db
        .select({
          orgId: orgMembers.orgId,
          orgName: organizations.name,
          flagged: sql<number>`SUM(CASE WHEN ${sharingAbuseFlags.status} = 'flagged' THEN 1 ELSE 0 END)`,
          confirmed: sql<number>`SUM(CASE WHEN ${sharingAbuseFlags.status} = 'confirmed' THEN 1 ELSE 0 END)`,
          warned: sql<number>`SUM(CASE WHEN ${sharingAbuseFlags.status} = 'warned' THEN 1 ELSE 0 END)`,
        })
        .from(sharingAbuseFlags)
        .innerJoin(orgMembers, eq(sharingAbuseFlags.userId, orgMembers.userId))
        .innerJoin(organizations, eq(orgMembers.orgId, organizations.id))
        .groupBy(orgMembers.orgId, organizations.name)
        .orderBy(desc(sql`SUM(CASE WHEN ${sharingAbuseFlags.status} = 'flagged' THEN 1 ELSE 0 END)`))
        .limit(50);

      const totalFlagged = orgFlagCounts.reduce((s, r) => s + Number(r.flagged ?? 0), 0);
      const totalConfirmed = orgFlagCounts.reduce((s, r) => s + Number(r.confirmed ?? 0), 0);

      return {
        orgs: orgFlagCounts.map((r) => ({
          orgId: r.orgId,
          orgName: r.orgName,
          flagged: Number(r.flagged ?? 0),
          confirmed: Number(r.confirmed ?? 0),
          warned: Number(r.warned ?? 0),
        })),
        totalFlagged,
        totalConfirmed,
      };
    }),

  /**
   * Manually flag a user for sharing abuse.
   * Platform admin: any user. Org admin: their org's members only.
   */
  flagUser: protectedProcedure
    .input(
      z.object({
        userId: z.number(),
        reason: z.string().max(500),
        orgId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const { isPlatform, orgId } = await assertCanViewFlags(
        ctx.user.id,
        ctx.user.role,
        input.orgId
      );

      if (!isPlatform && orgId) {
        const [membership] = await db
          .select({ userId: orgMembers.userId })
          .from(orgMembers)
          .where(and(eq(orgMembers.userId, input.userId), eq(orgMembers.orgId, orgId)))
          .limit(1);
        if (!membership) {
          throw new TRPCError({ code: "FORBIDDEN", message: "This user is not in your organisation" });
        }
      }

      // Get current distinct IP count for this user
      const [ipCount] = await db
        .select({ cnt: sql<number>`COUNT(DISTINCT ${ipAccessLogs.ipAddress})` })
        .from(ipAccessLogs)
        .where(eq(ipAccessLogs.userId, input.userId));

      await db.insert(sharingAbuseFlags).values({
        userId: input.userId,
        status: "flagged",
        distinctIpCount: Number(ipCount?.cnt ?? 0),
        detectionReason: `Manual flag: ${input.reason}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return { success: true };
    }),
});
