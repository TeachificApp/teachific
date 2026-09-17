import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routerSource = readFileSync(new URL("./routers/lmsQuizLandingRouter.ts", import.meta.url), "utf8");
const lmsAdminSource = readFileSync(new URL("../client/src/pages/admin/LMSAdmin.tsx", import.meta.url), "utf8");
const courseBuilderSource = readFileSync(new URL("../client/src/pages/lms/CourseBuilderPage.tsx", import.meta.url), "utf8");
const landingBuilderSource = readFileSync(new URL("../client/src/pages/lms/LandingPageBuilder.tsx", import.meta.url), "utf8");

describe("Course360 landing-page AI claims safety", () => {
  it("prohibits invented endorsements and unsupported claims in course landing generation", () => {
    expect(routerSource).toContain("Do not invent testimonials, reviews, ratings, named learners, outcome claims");
    expect(routerSource).toContain("Do not add a testimonial, review, rating, learner name, result, or claim not supplied above.");
    expect(routerSource).not.toContain('console.error("[aiGenerateLandingPage] parse error:", err?.message, "raw:"');
  });

  it("does not promise generated testimonials in active LMS controls", () => {
    expect(lmsAdminSource).not.toContain("pricing, testimonials, and more");
    expect(courseBuilderSource).not.toContain("pricing, testimonials, and more");
    expect(lmsAdminSource).toContain("Review it in the builder, then select Save Page to apply it.");
    expect(courseBuilderSource).toContain("Review it in the builder, then select Save Page to apply it.");
  });

  it("returns generation as a review-only draft until an administrator explicitly saves it", () => {
    const generationSection = routerSource.slice(
      routerSource.indexOf("aiGenerateLandingPage: protectedProcedure"),
      routerSource.indexOf("// ─── Page Templates"),
    );
    expect(generationSection).toContain("return { success: true, blockCount: draftBlocks.length, blocks: draftBlocks };");
    expect(generationSection).not.toContain("db.update(lmsLandingPages)");
    expect(generationSection).not.toContain("db.insert(lmsLandingPages)");
    expect(lmsAdminSource).toContain("sessionStorage.setItem(`landing-page-ai-draft:${courseId}`, JSON.stringify(result.blocks));");
    expect(courseBuilderSource).toContain("sessionStorage.setItem(`landing-page-ai-draft:${courseId}`, JSON.stringify(result.blocks));");
    expect(landingBuilderSource).toContain("AI draft loaded for review.");
    expect(landingBuilderSource).toContain("setAiDraftLoaded(false);");
  });
});
