import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { lmsRouter } from "./lmsRouter";
import { getDb } from "./db";
import { courses, courseEnrollments, cohortSessions, instructors, affiliateConversions, certificates, orders } from "../drizzle/schema";
import { eq } from "drizzle-orm";

// Mock context
const mockCtx = {
  user: { id: 1, email: "test@example.com", role: "admin" },
  req: { headers: { origin: "http://localhost:3000" } },
};

describe("LMS Router", () => {
  let db: any;
  const testOrgId = 1;
  let courseId: number;
  let enrollmentId: number;

  beforeAll(async () => {
    db = await getDb();
  });

  describe("Courses", () => {
    it("should create a course with org-level scoping", async () => {
      const caller = lmsRouter.createCaller(mockCtx);
      
      const result = await caller.courses.create({
        orgId: testOrgId,
        title: "Test Course",
        description: "A test course",
        category: "programming",
        level: "beginner",
      });

      expect(result).toBeDefined();
      expect(result.title).toBe("Test Course");
      expect(result.orgId).toBe(testOrgId);
      expect(result.status).toBe("draft");
      
      courseId = result.id;
    });

    it("should list courses for an organization", async () => {
      const caller = lmsRouter.createCaller(mockCtx);
      
      const courses = await caller.courses.list({ orgId: testOrgId });
      
      expect(Array.isArray(courses)).toBe(true);
      expect(courses.length).toBeGreaterThan(0);
      expect(courses[0].orgId).toBe(testOrgId);
    });

    it("should get a course by ID", async () => {
      const caller = lmsRouter.createCaller(mockCtx);
      
      const course = await caller.courses.get({ id: courseId });
      
      expect(course).toBeDefined();
      expect(course.id).toBe(courseId);
      expect(course.title).toBe("Test Course");
    });

    it("should update a course", async () => {
      const caller = lmsRouter.createCaller(mockCtx);
      
      const updated = await caller.courses.update({
        id: courseId,
        title: "Updated Course Title",
        status: "published",
        customDomain: "courses.example.com",
      });
      
      expect(updated.title).toBe("Updated Course Title");
      expect(updated.status).toBe("published");
      expect(updated.customDomain).toBe("courses.example.com");
    });
  });

  describe("Enrollments", () => {
    it("should enroll a user in a course", async () => {
      const caller = lmsRouter.createCaller(mockCtx);
      
      const result = await caller.enrollments.enroll({
        courseId,
        userId: 1,
        enrollmentDate: new Date(),
      });
      
      expect(result.success).toBe(true);
    });

    it("should prevent duplicate enrollments", async () => {
      const caller = lmsRouter.createCaller(mockCtx);
      
      await expect(
        caller.enrollments.enroll({
          courseId,
          userId: 1,
          enrollmentDate: new Date(),
        })
      ).rejects.toThrow("already enrolled");
    });

    it("should list enrollments for a course", async () => {
      const caller = lmsRouter.createCaller(mockCtx);
      
      const enrollments = await caller.enrollments.list({ courseId });
      
      expect(Array.isArray(enrollments)).toBe(true);
      expect(enrollments.length).toBeGreaterThan(0);
      expect(enrollments[0].courseId).toBe(courseId);
      
      enrollmentId = enrollments[0].id;
    });

    it("should update enrollment progress", async () => {
      const caller = lmsRouter.createCaller(mockCtx);
      
      const result = await caller.enrollments.updateProgress({
        enrollmentId,
        completionPercentage: 50,
      });
      
      expect(result.success).toBe(true);
    });
  });

  describe("Cohorts", () => {
    it("should create a cohort session", async () => {
      const caller = lmsRouter.createCaller(mockCtx);
      
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days later
      
      const result = await caller.cohorts.create({
        courseId,
        name: "Cohort 1",
        startDate,
        endDate,
        maxCapacity: 50,
      });
      
      expect(result.success).toBe(true);
    });

    it("should list cohorts for a course", async () => {
      const caller = lmsRouter.createCaller(mockCtx);
      
      const cohorts = await caller.cohorts.list({ courseId });
      
      expect(Array.isArray(cohorts)).toBe(true);
      expect(cohorts.length).toBeGreaterThan(0);
      expect(cohorts[0].courseId).toBe(courseId);
      expect(cohorts[0].name).toBe("Cohort 1");
    });
  });

  describe("Instructors", () => {
    it("should create an instructor", async () => {
      const caller = lmsRouter.createCaller(mockCtx);
      
      const result = await caller.instructors.create({
        orgId: testOrgId,
        userId: 2,
        title: "Senior Instructor",
        bio: "An experienced instructor",
        commissionRate: 25,
      });
      
      expect(result.success).toBe(true);
    });

    it("should list instructors for an organization", async () => {
      const caller = lmsRouter.createCaller(mockCtx);
      
      const instructors = await caller.instructors.list({ orgId: testOrgId });
      
      expect(Array.isArray(instructors)).toBe(true);
      expect(instructors.length).toBeGreaterThan(0);
      expect(instructors[0].orgId).toBe(testOrgId);
    });
  });

  describe("Affiliates", () => {
    it("should track an affiliate conversion", async () => {
      const caller = lmsRouter.createCaller(mockCtx);
      
      const result = await caller.affiliates.trackConversion({
        orgId: testOrgId,
        affiliateId: 1,
        courseId,
        amount: 99.99,
        commissionPercentage: 20,
      });
      
      expect(result.success).toBe(true);
    });

    it("should list affiliate conversions for an organization", async () => {
      const caller = lmsRouter.createCaller(mockCtx);
      
      const conversions = await caller.affiliates.list({ orgId: testOrgId });
      
      expect(Array.isArray(conversions)).toBe(true);
      expect(conversions.length).toBeGreaterThan(0);
      expect(conversions[0].orgId).toBe(testOrgId);
      expect(conversions[0].commissionAmount).toBe(99.99 * 0.2);
    });
  });

  describe("Certificates", () => {
    it("should issue a certificate", async () => {
      const caller = lmsRouter.createCaller(mockCtx);
      
      const result = await caller.certificates.issue({
        enrollmentId,
        issuedDate: new Date(),
      });
      
      expect(result.success).toBe(true);
      expect(result.certificateCode).toBeDefined();
      expect(result.certificateCode).toMatch(/^CERT-/);
    });
  });

  describe("Orders", () => {
    it("should create an order", async () => {
      const caller = lmsRouter.createCaller(mockCtx);
      
      const result = await caller.orders.create({
        orgId: testOrgId,
        userId: 1,
        courseId,
        amount: 99.99,
        status: "completed",
      });
      
      expect(result.success).toBe(true);
      expect(result.orderId).toBeDefined();
      expect(result.orderId).toMatch(/^ORD-/);
    });

    it("should list orders for an organization", async () => {
      const caller = lmsRouter.createCaller(mockCtx);
      
      const orders = await caller.orders.list({ orgId: testOrgId });
      
      expect(Array.isArray(orders)).toBe(true);
      expect(orders.length).toBeGreaterThan(0);
      expect(orders[0].orgId).toBe(testOrgId);
    });
  });

  describe("Org-level scoping", () => {
    it("should only return courses for the specified org", async () => {
      const caller = lmsRouter.createCaller(mockCtx);
      
      // Create a course for a different org
      const otherOrgCourse = await caller.courses.create({
        orgId: 999,
        title: "Other Org Course",
        description: "Course for another org",
      });
      
      // List courses for testOrgId
      const testOrgCourses = await caller.courses.list({ orgId: testOrgId });
      
      // Verify no courses from other org are included
      const hasOtherOrgCourse = testOrgCourses.some(c => c.orgId === 999);
      expect(hasOtherOrgCourse).toBe(false);
    });
  });
});
