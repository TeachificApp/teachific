/**
 * LMS Router Integration Tests
 * Tests the actual procedures available in lmsRouter using the real DB.
 * Procedure names match the current router structure.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { lmsRouter } from "./lmsRouter";
import { getDb } from "./db";

// Mock context — user id 1 is the platform owner
const mockCtx = {
  user: { id: 1, email: "test@example.com", role: "admin" },
  req: { headers: { origin: "http://localhost:3000" } },
};

describe("LMS Router", () => {
  let db: any;
  const testOrgId = 1;
  let courseId: number;

  beforeAll(async () => {
    db = await getDb();
  });

  // ─── Courses ────────────────────────────────────────────────────────────────

  describe("Courses", () => {
    it("should create a course with org-level scoping", async () => {
      const caller = lmsRouter.createCaller(mockCtx);

      const result = await caller.courses.create({
        orgId: testOrgId,
        title: "Test Course",
        description: "A test course",
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

    it("should update a course title and status", async () => {
      const caller = lmsRouter.createCaller(mockCtx);

      const updated = await caller.courses.update({
        id: courseId,
        title: "Updated Course Title",
        status: "published",
      });

      expect(updated).toBeDefined();
      expect(updated!.title).toBe("Updated Course Title");
      expect(updated!.status).toBe("published");
    });
  });

  // ─── Enrollments ────────────────────────────────────────────────────────────

  describe("Enrollments", () => {
    it("should enroll the current user in a course", async () => {
      const caller = lmsRouter.createCaller(mockCtx);

      // enroll returns the enrollment row (or existing row if already enrolled)
      const result = await caller.enrollments.enroll({
        courseId,
        orgId: testOrgId,
      });

      expect(result).toBeDefined();
      expect(result.courseId).toBe(courseId);
      expect(result.userId).toBe(1);
    });

    it("should return existing enrollment on duplicate enroll (idempotent)", async () => {
      const caller = lmsRouter.createCaller(mockCtx);

      const first = await caller.enrollments.enroll({ courseId, orgId: testOrgId });
      const second = await caller.enrollments.enroll({ courseId, orgId: testOrgId });

      // Both should return the same enrollment id
      expect(first.id).toBe(second.id);
    });

    it("should return enrollment progress for a course", async () => {
      const caller = lmsRouter.createCaller(mockCtx);

      const progress = await caller.enrollments.progress({ courseId });

      // May be null if no lesson progress yet, but enrollment should exist
      expect(progress).toBeDefined();
      expect(progress!.enrollment.courseId).toBe(courseId);
    });
  });

  // ─── Instructors ────────────────────────────────────────────────────────────

  describe("Instructors", () => {
    it("should upsert an instructor profile", async () => {
      const caller = lmsRouter.createCaller(mockCtx);

      const result = await caller.instructors.upsert({
        orgId: testOrgId,
        userId: 1,
        displayName: "Dr. Test Instructor",
        title: "Senior Instructor",
        bio: "An experienced instructor",
      });

      expect(result).toBeDefined();
      expect(result.orgId).toBe(testOrgId);
      expect(result.userId).toBe(1);
    });

    it("should list instructors for an organization", async () => {
      const caller = lmsRouter.createCaller(mockCtx);

      const instructors = await caller.instructors.list({ orgId: testOrgId });

      expect(Array.isArray(instructors)).toBe(true);
      expect(instructors.length).toBeGreaterThan(0);
      expect(instructors[0].orgId).toBe(testOrgId);
    });
  });

  // ─── Affiliates ─────────────────────────────────────────────────────────────

  describe("Affiliates", () => {
    it("should create an affiliate", async () => {
      const caller = lmsRouter.createCaller(mockCtx);

      const result = await caller.affiliates.create({
        orgId: testOrgId,
        name: "Test Affiliate",
        email: "affiliate@example.com",
        commissionValue: 20,
      });

      expect(result).toBeDefined();
      expect(result.orgId).toBe(testOrgId);
      expect(result.name).toBe("Test Affiliate");
      expect(result.code).toBeDefined();
    });

    it("should list affiliates for an organization", async () => {
      const caller = lmsRouter.createCaller(mockCtx);

      const affiliates = await caller.affiliates.list({ orgId: testOrgId });

      expect(Array.isArray(affiliates)).toBe(true);
      expect(affiliates.length).toBeGreaterThan(0);
      expect(affiliates[0].orgId).toBe(testOrgId);
    });
  });

  // ─── Certificates ────────────────────────────────────────────────────────────

  describe("Certificates", () => {
    it("should create a certificate", async () => {
      const caller = lmsRouter.createCaller(mockCtx);

      const result = await caller.certificates.create({
        userId: 1,
        courseId,
        enrollmentId: 1,
        orgId: testOrgId,
      });

      expect(result).toBeDefined();
      expect(result.userId).toBe(1);
      expect(result.courseId).toBe(courseId);
    });

    it("should list certificates for a user", async () => {
      const caller = lmsRouter.createCaller(mockCtx);

      const certs = await caller.certificates.myList();

      expect(Array.isArray(certs)).toBe(true);
    });
  });

  // ─── Course Orders ───────────────────────────────────────────────────────────

  describe("Course Orders", () => {
    it("should create a course order", async () => {
      const caller = lmsRouter.createCaller(mockCtx);

      const result = await caller.courseOrders.create({
        orgId: testOrgId,
        userId: 1,
        courseId,
        customerEmail: "student@example.com",
        amount: 99.99,
        status: "completed",
      });

      expect(result).toBeDefined();
      expect(result.orgId).toBe(testOrgId);
      expect(result.customerEmail).toBe("student@example.com");
    });

    it("should list orders for an organization", async () => {
      const caller = lmsRouter.createCaller(mockCtx);

      const orders = await caller.courseOrders.list({ orgId: testOrgId });

      expect(Array.isArray(orders)).toBe(true);
      expect(orders.length).toBeGreaterThan(0);
      expect(orders[0].orgId).toBe(testOrgId);
    });
  });

  // ─── Org-level scoping ──────────────────────────────────────────────────────

  describe("Org-level scoping", () => {
    it("should only return courses for the specified org", async () => {
      const caller = lmsRouter.createCaller(mockCtx);

      // Create a course for a different org
      await caller.courses.create({
        orgId: 999,
        title: "Other Org Course",
        description: "Course for another org",
      });

      // List courses for testOrgId
      const testOrgCourses = await caller.courses.list({ orgId: testOrgId });

      // Verify no courses from other org are included
      const hasOtherOrgCourse = testOrgCourses.some((c: any) => c.orgId === 999);
      expect(hasOtherOrgCourse).toBe(false);
    });
  });
});
