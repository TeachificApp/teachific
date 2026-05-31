/**
 * teamRouter.ts
 * Full Teams / Group Seat management — ported from ultrasound-app lmsEnrollmentAdminRouter.
 * Handles team CRUD, per-course seat allocation, seat assignment, and student profile lookups.
 */
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { randomBytes } from "crypto";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  lmsGroups,
  lmsGroupCourses,
  lmsGroupSeats,
  lmsCourses,
  lmsEnrollments,
  users,
} from "../../drizzle/schema";

function assertAdmin(ctx: { user: { role: string } }) {
  const adminRoles = ["site_owner", "site_admin", "org_super_admin", "org_admin"];
  if (!adminRoles.includes(ctx.user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
}

export const teamRouter = router({
  /** List all teams with their courses and seat counts */
  listTeams: protectedProcedure.query(async ({ ctx }) => {
    assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const groups = await db.select().from(lmsGroups).orderBy(desc(lmsGroups.createdAt));

    const enriched = await Promise.all(groups.map(async (g) => {
      // Get courses for this team
      const groupCourses = await db
        .select({
          id: lmsGroupCourses.id,
          courseId: lmsGroupCourses.courseId,
          seats: lmsGroupCourses.seats,
          courseTitle: lmsCourses.title,
          courseSlug: lmsCourses.slug,
        })
        .from(lmsGroupCourses)
        .leftJoin(lmsCourses, eq(lmsCourses.id, lmsGroupCourses.courseId))
        .where(eq(lmsGroupCourses.groupId, g.id));

      // Get seat records enriched with userId via enrollment join
      const seats = await db
        .select({
          id: lmsGroupSeats.id,
          groupId: lmsGroupSeats.groupId,
          email: lmsGroupSeats.email,
          memberName: lmsGroupSeats.memberName,
          status: lmsGroupSeats.status,
          assignedAt: lmsGroupSeats.assignedAt,
          enrollmentId: lmsGroupSeats.enrollmentId,
          acceptedAt: lmsGroupSeats.acceptedAt,
          userId: lmsEnrollments.userId,
        })
        .from(lmsGroupSeats)
        .leftJoin(lmsEnrollments, eq(lmsEnrollments.id, lmsGroupSeats.enrollmentId))
        .where(eq(lmsGroupSeats.groupId, g.id));

      const activeSeats = seats.filter(s => s.status === "active").length;
      const pendingSeats = seats.filter(s => s.status === "pending").length;

      // Legacy single course
      const legacyCourse = g.courseId
        ? await db.select({ title: lmsCourses.title, slug: lmsCourses.slug })
            .from(lmsCourses).where(eq(lmsCourses.id, g.courseId)).limit(1)
            .then(r => r[0] ?? null)
        : null;

      // Team admin user
      const teamAdmin = g.teamAdminId
        ? await db.select({ id: users.id, name: users.name, email: users.email })
            .from(users).where(eq(users.id, g.teamAdminId)).limit(1)
            .then(r => r[0] ?? null)
        : null;

      return {
        ...g,
        courses: groupCourses,
        legacyCourse,
        teamAdmin,
        totalSeats: seats.length,
        activeSeats,
        pendingSeats,
        seatList: seats,
      };
    }));

    return enriched;
  }),

  /** Create a new team */
  createTeam: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      orgName: z.string().optional(),
      adminEmail: z.string().email().optional(),
      adminPhone: z.string().optional(),
      website: z.string().optional(),
      notes: z.string().optional(),
      teamAdminId: z.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [result] = await db.insert(lmsGroups).values({
        name: input.name,
        orgName: input.orgName ?? null,
        adminEmail: input.adminEmail ?? null,
        adminPhone: input.adminPhone ?? null,
        website: input.website ?? null,
        notes: input.notes ?? null,
        teamAdminId: input.teamAdminId ?? null,
        seats: 0,
        courseId: null,
      }).$returningId();
      return { id: result.id };
    }),

  /** Update team info */
  updateTeam: protectedProcedure
    .input(z.object({
      id: z.number().int(),
      name: z.string().min(1).max(255).optional(),
      orgName: z.string().optional().nullable(),
      adminEmail: z.string().email().optional().nullable(),
      adminPhone: z.string().optional().nullable(),
      website: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
      teamAdminId: z.number().int().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...updates } = input;
      const filtered = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
      if (Object.keys(filtered).length > 0) {
        await db.update(lmsGroups).set(filtered).where(eq(lmsGroups.id, id));
      }
      return { success: true };
    }),

  /** Delete a team (removes group + all seats + course allocations) */
  deleteTeam: protectedProcedure
    .input(z.object({ groupId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(lmsGroupSeats).where(eq(lmsGroupSeats.groupId, input.groupId));
      await db.delete(lmsGroupCourses).where(eq(lmsGroupCourses.groupId, input.groupId));
      await db.delete(lmsGroups).where(eq(lmsGroups.id, input.groupId));
      return { success: true };
    }),

  /** Add a course allocation to a team */
  addCourseToTeam: protectedProcedure
    .input(z.object({
      groupId: z.number().int(),
      courseId: z.number().int(),
      seats: z.number().int().min(1).default(1),
    }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [existing] = await db.select().from(lmsGroupCourses)
        .where(and(eq(lmsGroupCourses.groupId, input.groupId), eq(lmsGroupCourses.courseId, input.courseId)))
        .limit(1);
      if (existing) throw new TRPCError({ code: "BAD_REQUEST", message: "Course already added to this team" });
      const [result] = await db.insert(lmsGroupCourses).values({
        groupId: input.groupId,
        courseId: input.courseId,
        seats: input.seats,
      }).$returningId();
      return { id: result.id };
    }),

  /** Remove a course allocation from a team */
  removeCourseFromTeam: protectedProcedure
    .input(z.object({ groupCourseId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(lmsGroupCourses).where(eq(lmsGroupCourses.id, input.groupCourseId));
      return { success: true };
    }),

  /** Update seat count for a course allocation */
  updateCourseSeatCount: protectedProcedure
    .input(z.object({ groupCourseId: z.number().int(), seats: z.number().int().min(1) }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(lmsGroupCourses).set({ seats: input.seats }).where(eq(lmsGroupCourses.id, input.groupCourseId));
      return { success: true };
    }),

  /** Assign a seat to an email address (sends invite) */
  assignSeat: protectedProcedure
    .input(z.object({ groupId: z.number(), email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [group] = await db.select().from(lmsGroups).where(eq(lmsGroups.id, input.groupId)).limit(1);
      if (!group) throw new TRPCError({ code: "NOT_FOUND" });
      const seats = await db.select().from(lmsGroupSeats).where(eq(lmsGroupSeats.groupId, input.groupId));
      const existing = seats.find(s => s.email.toLowerCase() === input.email.toLowerCase() && s.status !== "revoked");
      if (existing) throw new TRPCError({ code: "BAD_REQUEST", message: "Email already assigned" });
      const token = randomBytes(32).toString("hex");
      const [result] = await db.insert(lmsGroupSeats).values({
        groupId: input.groupId,
        email: input.email,
        inviteToken: token,
        status: "pending",
      }).$returningId();
      return { id: result.id, token };
    }),

  /** Revoke a seat */
  revokeSeat: protectedProcedure
    .input(z.object({ seatId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(lmsGroupSeats).set({ status: "revoked" }).where(eq(lmsGroupSeats.id, input.seatId));
      return { success: true };
    }),

  /** Move an existing enrolled student into a group seat */
  assignExistingStudentToGroup: protectedProcedure
    .input(z.object({
      groupId: z.number(),
      userId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [group] = await db.select().from(lmsGroups).where(eq(lmsGroups.id, input.groupId)).limit(1);
      if (!group) throw new TRPCError({ code: "NOT_FOUND", message: "Group not found" });
      const [user] = await db.select({ id: users.id, email: users.email, name: users.name })
        .from(users).where(eq(users.id, input.userId)).limit(1);
      if (!user || !user.email) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      const seats = await db.select().from(lmsGroupSeats).where(eq(lmsGroupSeats.groupId, input.groupId));
      const alreadyInGroup = seats.find(s => s.email.toLowerCase() === (user.email ?? "").toLowerCase() && s.status !== "revoked");
      if (alreadyInGroup) throw new TRPCError({ code: "BAD_REQUEST", message: "User is already in this group" });
      // Find existing enrollment for the primary course
      const [enrollment] = group.courseId
        ? await db.select().from(lmsEnrollments)
            .where(and(eq(lmsEnrollments.userId, input.userId), eq(lmsEnrollments.courseId, group.courseId)))
            .limit(1)
        : [undefined];
      const now = new Date();
      const [result] = await db.insert(lmsGroupSeats).values({
        groupId: input.groupId,
        email: user.email,
        memberName: user.name ?? null,
        status: "active",
        assignedAt: now,
        acceptedAt: now,
        enrollmentId: enrollment?.id ?? null,
        inviteToken: null,
      }).$returningId();
      return { id: result.id, alreadyEnrolled: !!enrollment };
    }),

  /** Get all teams a specific user belongs to (for student profile) */
  getUserTeams: protectedProcedure
    .input(z.object({ userId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Get user email first
      const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, input.userId)).limit(1);
      if (!user?.email) return [];
      // Find all seat records for this user's email
      const seats = await db.select({
        seatId: lmsGroupSeats.id,
        status: lmsGroupSeats.status,
        acceptedAt: lmsGroupSeats.acceptedAt,
        assignedAt: lmsGroupSeats.assignedAt,
        groupId: lmsGroupSeats.groupId,
        enrollmentId: lmsGroupSeats.enrollmentId,
      })
        .from(lmsGroupSeats)
        .where(eq(lmsGroupSeats.email, user.email));
      if (seats.length === 0) return [];
      // Enrich with group info
      const result = await Promise.all(seats.map(async (seat) => {
        const [group] = await db.select({
          id: lmsGroups.id,
          name: lmsGroups.name,
          orgName: lmsGroups.orgName,
          adminEmail: lmsGroups.adminEmail,
        }).from(lmsGroups).where(eq(lmsGroups.id, seat.groupId)).limit(1);
        const groupCourses = await db.select({
          courseId: lmsGroupCourses.courseId,
          seats: lmsGroupCourses.seats,
          courseTitle: lmsCourses.title,
        })
          .from(lmsGroupCourses)
          .leftJoin(lmsCourses, eq(lmsCourses.id, lmsGroupCourses.courseId))
          .where(eq(lmsGroupCourses.groupId, seat.groupId));
        return { ...seat, group: group ?? null, courses: groupCourses };
      }));
      return result;
    }),

  /** Get teams for the currently logged-in user (learner portal) */
  myTeams: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
    if (!user?.email) return [];
    const seats = await db.select({
      seatId: lmsGroupSeats.id,
      status: lmsGroupSeats.status,
      acceptedAt: lmsGroupSeats.acceptedAt,
      assignedAt: lmsGroupSeats.assignedAt,
      groupId: lmsGroupSeats.groupId,
      enrollmentId: lmsGroupSeats.enrollmentId,
    })
      .from(lmsGroupSeats)
      .where(and(eq(lmsGroupSeats.email, user.email), eq(lmsGroupSeats.status, "active")));
    if (seats.length === 0) return [];
    const result = await Promise.all(seats.map(async (seat) => {
      const [group] = await db.select({
        id: lmsGroups.id,
        name: lmsGroups.name,
        orgName: lmsGroups.orgName,
      }).from(lmsGroups).where(eq(lmsGroups.id, seat.groupId)).limit(1);
      const groupCourses = await db.select({
        courseId: lmsGroupCourses.courseId,
        seats: lmsGroupCourses.seats,
        courseTitle: lmsCourses.title,
        courseSlug: lmsCourses.slug,
      })
        .from(lmsGroupCourses)
        .leftJoin(lmsCourses, eq(lmsCourses.id, lmsGroupCourses.courseId))
        .where(eq(lmsGroupCourses.groupId, seat.groupId));
      return { ...seat, group: group ?? null, courses: groupCourses };
    }));
    return result;
  }),
});
