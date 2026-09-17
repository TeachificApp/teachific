import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routerSource = readFileSync(new URL("./routers/lmsQuizLandingRouter.ts", import.meta.url), "utf8");
const lmsAdminSource = readFileSync(new URL("../client/src/pages/admin/LMSAdmin.tsx", import.meta.url), "utf8");
const courseBuilderSource = readFileSync(new URL("../client/src/pages/lms/CourseBuilderPage.tsx", import.meta.url), "utf8");

describe("Course360 landing-page AI claims safety", () => {
  it("prohibits invented endorsements and unsupported claims in course landing generation", () => {
    expect(routerSource).toContain("Do not invent testimonials, reviews, ratings, named learners, outcome claims");
    expect(routerSource).toContain("Do not add a testimonial, review, rating, learner name, result, or claim not supplied above.");
    expect(routerSource).not.toContain('console.error("[aiGenerateLandingPage] parse error:", err?.message, "raw:"');
  });

  it("does not promise generated testimonials in active LMS controls", () => {
    expect(lmsAdminSource).not.toContain("pricing, testimonials, and more");
    expect(courseBuilderSource).not.toContain("pricing, testimonials, and more");
    expect(lmsAdminSource).toContain("pricing, FAQs, and more");
    expect(courseBuilderSource).toContain("pricing, FAQs, and more");
  });
});
