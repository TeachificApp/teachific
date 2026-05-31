// LMS Router - Integrated from imported modules
// Courses, Enrollments, Cohorts, Instructors, Affiliates, Certificates, Orders

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
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
  organizations,
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
        
        // Verify org exists
        const org = await db.select().from(organizations).where(eq(organizations.id, input.orgId)).limit(1);
        if (!org.length) throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
        
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
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        const slug = `${input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${nanoid(6)}`;
        
        await db.insert(lmsCourses).values({
          orgId: input.orgId,
          title: input.title,
          description: input.description ?? null,
          slug,
          category: input.category ?? null,
          level: input.level ?? "beginner",
          status: "draft",
          enrollmentCount: 0,
          publishedAt: null,
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
        status: z.enum(["draft", "published", "archived"]).optional(),
        customDomain: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        const { id, ...updates } = input;
        await db.update(lmsCourses).set({
          ...updates,
          updatedAt: new Date(),
        }).where(eq(lmsCourses.id, id));
        
        return getCourseById(db, id);
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
        
        await db.insert(lmsEnrollments).values({
          courseId: input.courseId,
          userId: input.userId,
          enrollmentDate: input.enrollmentDate ?? new Date(),
          status: "active",
          completionPercentage: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
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
        
        await db.insert(lmsCohortSessions).values({
          courseId: input.courseId,
          name: input.name,
          startDate: input.startDate,
          endDate: input.endDate,
          maxCapacity: input.maxCapacity ?? null,
          currentEnrollment: 0,
          status: "scheduled",
          createdAt: new Date(),
          updatedAt: new Date(),
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
          saleAmount: input.amount,
          commissionAmount: commission,
          status: "pending",
          conversionDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
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
        
        const certificateCode = `CERT-${nanoid(12).toUpperCase()}`;
        
        await db.insert(lmsCertificates).values({
          enrollmentId: input.enrollmentId,
          certificateCode,
          issuedDate: input.issuedDate ?? new Date(),
          expiryDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        
        return { success: true, certificateCode };
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
          orderId,
          amount: input.amount,
          status: input.status ?? "pending",
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        
        return { success: true, orderId };
      }),
  }),
});
