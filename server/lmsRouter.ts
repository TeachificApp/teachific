// LMS Router - Integrated from imported modules
// Courses, Enrollments, Cohorts, Instructors, Affiliates, Certificates, Orders

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { membershipRouter } from "./routers/membershipRouter";
import { eq, and, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { randomBytes } from "crypto";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import {
  lmsCourses,
  lmsEnrollments,
  lmsCohortSessions,
  lmsInstructors,
  lmsAffiliateConversions,
  lmsCertificates,
  lmsOrders,
  lmsGroups,
  lmsGroupCourses,
  lmsGroupSeats,
  users,
} from "../drizzle/schema";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getCourseById(db: any, id: number) {
  return db.select().from(lmsCourses).where(eq(lmsCourses.id, id)).limit(1).then((r: any[]) => r[0]);
}

async function getOrgCourses(db: any, orgId: number) {
  return db.select().from(lmsCourses).where(eq(lmsCourses.orgId, orgId)).orderBy(desc(lmsCourses.createdAt));
}

// ── LMS Router ────────────────────────────────────────────────────────────────

export const lmsRouter = router({
  // ── Courses ───────────────────────────────────────────────────────────────

  courses: router({
    list: protectedProcedure
      .input(z.object({ orgId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        
        return getOrgCourses(db, input.orgId);
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        const course = await getCourseById(db, input.id);
        if (!course) throw new TRPCError({ code: "NOT_FOUND" });
        return course;
      }),

    create: protectedProcedure
      .input(z.object({
        orgId: z.number(),
        title: z.string().min(1),
        description: z.string().optional(),
        category: z.string().optional(),
        level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        const slug = `${input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${nanoid(6)}`;
        
        await db.insert(lmsCourses).values({
          orgId: input.orgId,
          title: input.title,
          description: input.description ?? null,
          slug,
          status: "draft",
          createdByUserId: ctx.user.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        
        const created = await db.select().from(lmsCourses).where(eq(lmsCourses.slug, slug)).limit(1);
        return created[0];
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        category: z.string().optional(),
        level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
        status: z.enum(["draft", "public", "hidden", "private", "archived", "published"]).optional(),
        customDomain: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        const { id, status, ...rest } = input;
        // Map "published" -> "public" for DB compatibility
        const dbStatus = status === "published" ? "public" : status;
        const updates: Record<string, any> = { ...rest };
        if (dbStatus) updates.status = dbStatus;
        await db.update(lmsCourses).set({
          ...updates,
          updatedAt: new Date(),
        }).where(eq(lmsCourses.id, id));
        
        const course = await getCourseById(db, id);
        // Map "public" -> "published" in response for API consistency
        if (course && course.status === "public") course.status = "published";
        return course;
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        // Delete related data
        await db.delete(lmsEnrollments).where(eq(lmsEnrollments.courseId, input.id));
        await db.delete(lmsCourses).where(eq(lmsCourses.id, input.id));
        
        return { success: true };
      }),
  }),

  // ── Enrollments ───────────────────────────────────────────────────────────

  enrollments: router({
    list: protectedProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return db.select().from(lmsEnrollments).where(eq(lmsEnrollments.courseId, input.courseId));
      }),

    enroll: protectedProcedure
      .input(z.object({
        courseId: z.number(),
        userId: z.number(),
        enrollmentDate: z.date().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        // Check if already enrolled
        const existing = await db.select().from(lmsEnrollments)
          .where(and(eq(lmsEnrollments.courseId, input.courseId), eq(lmsEnrollments.userId, input.userId)))
          .limit(1);
        
        if (existing.length) {
          throw new TRPCError({ code: "CONFLICT", message: "User already enrolled in this course" });
        }
        
        // Get the course to find its orgId
        const course = await getCourseById(db, input.courseId);
        if (!course) throw new TRPCError({ code: "NOT_FOUND", message: "Course not found" });
        
        await db.insert(lmsEnrollments).values({
          orgId: course.orgId,
          courseId: input.courseId,
          userId: input.userId,
          status: "active",
        });
        
        return { success: true };
      }),

    updateProgress: protectedProcedure
      .input(z.object({
        enrollmentId: z.number(),
        completionPercentage: z.number().min(0).max(100),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        await db.update(lmsEnrollments).set({
          completionPercentage: input.completionPercentage,
          lastAccessedAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(lmsEnrollments.id, input.enrollmentId));
        
        return { success: true };
      }),
  }),

  // ── Cohorts ───────────────────────────────────────────────────────────────

  cohorts: router({
    list: protectedProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return db.select().from(lmsCohortSessions).where(eq(lmsCohortSessions.courseId, input.courseId));
      }),

    create: protectedProcedure
      .input(z.object({
        courseId: z.number(),
        name: z.string().min(1),
        startDate: z.date(),
        endDate: z.date(),
        maxCapacity: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        const course = await getCourseById(db, input.courseId);
        if (!course) throw new TRPCError({ code: "NOT_FOUND", message: "Course not found" });
        
        await db.insert(lmsCohortSessions).values({
          orgId: course.orgId,
          courseId: input.courseId,
          name: input.name,
          startDate: input.startDate,
          endDate: input.endDate,
          maxParticipants: input.maxCapacity ?? null,
          status: "upcoming",
        });
        
        return { success: true };
      }),
  }),

  // ── Instructors ───────────────────────────────────────────────────────────

  instructors: router({
    list: protectedProcedure
      .input(z.object({ orgId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return db.select().from(lmsInstructors).where(eq(lmsInstructors.orgId, input.orgId));
      }),

    create: protectedProcedure
      .input(z.object({
        orgId: z.number(),
        userId: z.number(),
        title: z.string().optional(),
        bio: z.string().optional(),
        commissionRate: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        await db.insert(lmsInstructors).values({
          orgId: input.orgId,
          userId: input.userId,
          title: input.title ?? null,
          bio: input.bio ?? null,
          commissionRate: input.commissionRate ?? 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        
        return { success: true };
      }),
  }),

  // ── Affiliates ────────────────────────────────────────────────────────────

  affiliates: router({
    list: protectedProcedure
      .input(z.object({ orgId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return db.select().from(lmsAffiliateConversions).where(eq(lmsAffiliateConversions.orgId, input.orgId));
      }),

    trackConversion: protectedProcedure
      .input(z.object({
        orgId: z.number(),
        affiliateId: z.number(),
        courseId: z.number(),
        amount: z.number(),
        commissionPercentage: z.number(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        const commission = input.amount * (input.commissionPercentage / 100);
        
        await db.insert(lmsAffiliateConversions).values({
          orgId: input.orgId,
          affiliateId: input.affiliateId,
          courseId: input.courseId,
          enrollmentId: 0, // placeholder - no enrollment in this context
          commissionAmount: commission.toFixed(2),
          status: "pending",
        });
        
        return { success: true };
      }),
  }),

  // ── Certificates ──────────────────────────────────────────────────────────

  certificates: router({
    issue: protectedProcedure
      .input(z.object({
        enrollmentId: z.number(),
        issuedDate: z.date().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        // Get enrollment to find orgId
        const enrollment = await db.select().from(lmsEnrollments).where(eq(lmsEnrollments.id, input.enrollmentId)).limit(1);
        if (!enrollment.length) throw new TRPCError({ code: "NOT_FOUND", message: "Enrollment not found" });
        
        const certificateNumber = `CERT-${nanoid(12).toUpperCase()}`;
        
        await db.insert(lmsCertificates).values({
          orgId: enrollment[0].orgId,
          enrollmentId: input.enrollmentId,
          templateId: 0, // default template
          certificateNumber,
        });
        
        return { success: true, certificateCode: certificateNumber };
      }),
  }),

  // ── Orders ────────────────────────────────────────────────────────────────

  orders: router({
    list: protectedProcedure
      .input(z.object({ orgId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return db.select().from(lmsOrders).where(eq(lmsOrders.orgId, input.orgId)).orderBy(desc(lmsOrders.createdAt));
      }),

    create: protectedProcedure
      .input(z.object({
        orgId: z.number(),
        userId: z.number(),
        courseId: z.number(),
        amount: z.number(),
        status: z.enum(["pending", "completed", "failed"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        const orderId = `ORD-${nanoid(10).toUpperCase()}`;
        
        await db.insert(lmsOrders).values({
          orgId: input.orgId,
          userId: input.userId,
          courseId: input.courseId,
          amount: String(input.amount),
          status: input.status ?? "pending",
        });
        
        return { success: true, orderId };
      }),
  }),

  // ─── Groups / Teams ───────────────────────────────────────────────────────
  memberships: membershipRouter,
  groups: router({
    /** List all groups with member counts */
    list: protectedProcedure
      .input(z.object({ orgId: z.number().optional() }).optional())
      .query(async () => {
        const db = await getDb();
        if (!db) return [];
        const groups = await db.select().from(lmsGroups).orderBy(desc(lmsGroups.createdAt));
        return Promise.all(groups.map(async (g: any) => {
          const seats = await db.select().from(lmsGroupSeats).where(eq(lmsGroupSeats.groupId, g.id));
          return {
            ...g,
            memberCount: seats.filter((s: any) => s.status === "active").length,
            pendingCount: seats.filter((s: any) => s.status === "pending").length,
            members: seats.map((s: any) => ({ id: s.id, email: s.email, name: s.memberName, status: s.status })),
          };
        }));
      }),

    create: protectedProcedure
      .input(z.object({ name: z.string().min(1), description: z.string().optional() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [result] = await db.insert(lmsGroups).values({ name: input.name, seats: 0, courseId: null }).$returningId();
        return { id: result.id };
      }),

    update: protectedProcedure
      .input(z.object({ id: z.number(), name: z.string().optional(), description: z.string().optional() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { id, ...updates } = input;
        await db.update(lmsGroups).set(updates).where(eq(lmsGroups.id, id));
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.delete(lmsGroupSeats).where(eq(lmsGroupSeats.groupId, input.id));
        await db.delete(lmsGroupCourses).where(eq(lmsGroupCourses.groupId, input.id));
        await db.delete(lmsGroups).where(eq(lmsGroups.id, input.id));
        return { success: true };
      }),

    addMember: protectedProcedure
      .input(z.object({ groupId: z.number(), email: z.string().email(), name: z.string().optional() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const existing = await db.select().from(lmsGroupSeats)
          .where(and(eq(lmsGroupSeats.groupId, input.groupId), eq(lmsGroupSeats.email, input.email))).limit(1);
        if (existing.length > 0 && existing[0].status !== "revoked") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Email already in group" });
        }
        const token = randomBytes(32).toString("hex");
        const [result] = await db.insert(lmsGroupSeats).values({
          groupId: input.groupId,
          email: input.email,
          memberName: input.name ?? null,
          status: "pending",
          inviteToken: token,
        }).$returningId();
        return { id: result.id };
      }),

    removeMember: protectedProcedure
      .input(z.object({ memberId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.update(lmsGroupSeats).set({ status: "revoked" }).where(eq(lmsGroupSeats.id, input.memberId));
        return { success: true };
      }),

    bulkEnroll: protectedProcedure
      .input(z.object({ groupId: z.number(), courseId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const seats = await db.select().from(lmsGroupSeats)
          .where(and(eq(lmsGroupSeats.groupId, input.groupId), eq(lmsGroupSeats.status, "active")));
        let enrolled = 0;
        for (const seat of seats) {
          const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, seat.email)).limit(1);
          if (!user) continue;
          const [existing] = await db.select().from(lmsEnrollments)
            .where(and(eq(lmsEnrollments.userId, user.id), eq(lmsEnrollments.courseId, input.courseId))).limit(1);
          if (existing) continue;
          const course = await getCourseById(db, input.courseId);
          await db.insert(lmsEnrollments).values({
            userId: user.id,
            courseId: input.courseId,
            orgId: course?.orgId ?? 0,
            status: "active",
          });
          enrolled++;
        }
        return { enrolled };
      }),
  }),
});
