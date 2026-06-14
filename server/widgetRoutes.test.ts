import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
  },
}));

describe("Widget Routes", () => {
  describe("Widget Data Endpoint", () => {
    it("should return course not found for invalid slug", async () => {
      const response = await fetch("http://localhost:3000/api/widget/data/nonexistent-slug");
      const data = await response.json();
      expect(response.status).toBe(404);
      expect(data.error).toBe("Course not found");
    });

    it("should return course data for valid slug", async () => {
      const response = await fetch("http://localhost:3000/api/widget/data/test-course-dUJAmB");
      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.course).toBeDefined();
      expect(data.course.slug).toBe("test-course-dUJAmB");
      expect(data.course.title).toBeDefined();
      expect(data.course.primaryColor).toBeDefined();
      expect(data.curriculum).toBeDefined();
      expect(Array.isArray(data.curriculum)).toBe(true);
    });

    it("should include primaryColor in course data", async () => {
      const response = await fetch("http://localhost:3000/api/widget/data/test-course-dUJAmB");
      const data = await response.json();
      expect(data.course.primaryColor).toBe("#179ca3");
    });
  });

  describe("Card Widget Endpoint", () => {
    it("should return JavaScript content for valid slug", async () => {
      const response = await fetch("http://localhost:3000/api/widget/card/test-course-dUJAmB");
      expect(response.status).toBe(200);
      const contentType = response.headers.get("content-type");
      expect(contentType).toContain("application/javascript");
      const text = await response.text();
      expect(text).toContain("teachific-widget");
      expect(text).toContain("tw-card-btn");
      expect(text).toContain("Enroll Now");
    });

    it("should include dynamic color application in card widget", async () => {
      const response = await fetch("http://localhost:3000/api/widget/card/test-course-dUJAmB");
      const text = await response.text();
      expect(text).toContain("primaryColor");
      expect(text).toContain(".tw-card-btn");
    });

    it("should support curriculum query parameter", async () => {
      const response = await fetch("http://localhost:3000/api/widget/card/test-course-dUJAmB?curriculum=1");
      const text = await response.text();
      expect(text).toContain("showCurriculum = true");
    });

    it("should set CORS headers for cross-origin embedding", async () => {
      const response = await fetch("http://localhost:3000/api/widget/card/test-course-dUJAmB");
      expect(response.headers.get("access-control-allow-origin")).toBe("*");
    });
  });

  describe("Curriculum Widget Endpoint", () => {
    it("should return JavaScript content for valid slug", async () => {
      const response = await fetch("http://localhost:3000/api/widget/curriculum/test-course-dUJAmB");
      expect(response.status).toBe(200);
      const contentType = response.headers.get("content-type");
      expect(contentType).toContain("application/javascript");
      const text = await response.text();
      expect(text).toContain("teachific-widget");
      expect(text).toContain("tw-curriculum");
    });

    it("should support card query parameter for showing course card header", async () => {
      const response = await fetch("http://localhost:3000/api/widget/curriculum/test-course-dUJAmB?card=1");
      const text = await response.text();
      expect(text).toContain("showCard = true");
    });

    it("should include dynamic color application in curriculum widget", async () => {
      const response = await fetch("http://localhost:3000/api/widget/curriculum/test-course-dUJAmB");
      const text = await response.text();
      expect(text).toContain("primaryColor");
      expect(text).toContain(".tw-icon");
      expect(text).toContain(".tw-curriculum-link");
    });
  });
});
