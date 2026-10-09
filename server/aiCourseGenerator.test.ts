import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { canUseAiCourseGenerator } from "./lib/aiCourseGeneratorEntitlement";
import { CURATED_UNSPLASH_COURSE_VISUALS, selectCuratedUnsplashCourseVisual } from "./lib/aiCourseVisuals";

const routerSource = fs.readFileSync(
  path.resolve(process.cwd(), "server/routers/lmsCourseBuilderRouter.ts"),
  "utf8",
);
const editorSource = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/pages/lms/CourseBuilderPage.tsx"),
  "utf8",
);

describe("Course360 AI Course Generator", () => {
  it("allows only active paid-organization plans to use full course generation", () => {
    expect(canUseAiCourseGenerator("starter", "trialing")).toBe(true);
    expect(canUseAiCourseGenerator("builder", "active")).toBe(true);
    expect(canUseAiCourseGenerator("pro", "active")).toBe(true);
    expect(canUseAiCourseGenerator("enterprise", "active")).toBe(true);
    expect(canUseAiCourseGenerator("free", "active")).toBe(false);
    expect(canUseAiCourseGenerator("starter", "past_due")).toBe(false);
    expect(canUseAiCourseGenerator(undefined, undefined)).toBe(false);
  });

  it("selects reviewed Unsplash visuals deterministically without an external search request", () => {
    const health = selectCuratedUnsplashCourseVisual("clinical healthcare patient care");
    const technology = selectCuratedUnsplashCourseVisual("software coding and data analysis");
    expect(health.url).toContain("images.unsplash.com");
    expect(technology.url).toContain("images.unsplash.com");
    expect(CURATED_UNSPLASH_COURSE_VISUALS).toContain(health);
    expect(CURATED_UNSPLASH_COURSE_VISUALS).toContain(technology);
    expect(health.alt).toBeTruthy();
    expect(technology.alt).toBeTruthy();
  });

  it("enforces active-organization ownership before using course data or source files", () => {
    const procedureStart = routerSource.indexOf("generateCourseOutline: protectedProcedure");
    const procedureEnd = routerSource.indexOf("generateLessonContent: protectedProcedure", procedureStart);
    const procedure = routerSource.slice(procedureStart, procedureEnd);
    expect(procedure).toContain("await assertCourseOwnership(ctx, input.courseId)");
    expect(procedure).toContain("await assertAiCourseGeneratorAccess(ctx, course.orgId)");
    expect(procedure).toContain("/ai-generation-sources/${course.orgId}/${ctx.user.id}/");
    expect(procedure).toContain("orgId: course.orgId");
  });

  it("builds complete editable lesson blocks and preserves curriculum when image generation fails", () => {
    const procedureStart = routerSource.indexOf("generateCourseOutline: protectedProcedure");
    const procedureEnd = routerSource.indexOf("generateLessonContent: protectedProcedure", procedureStart);
    const procedure = routerSource.slice(procedureStart, procedureEnd);
    expect(procedure).toContain('type: "hero"');
    expect(procedure).toContain('type: "text"');
    expect(procedure).toContain('type: "image"');
    expect(procedure).toContain('type: "ai_image"');
    expect(procedure).toContain('type: "checklist"');
    expect(procedure).toContain('type: "faq"');
    expect(procedure).toContain("curated Unsplash visual remains available");
    expect(procedure).toContain("generatedAiImages: aiModuleVisuals.size");
  });

  it("uses Course360-neutral instructional guidance and makes visual controls explicit", () => {
    const procedureStart = routerSource.indexOf("generateCourseOutline: protectedProcedure");
    const procedureEnd = routerSource.indexOf("generateLessonContent: protectedProcedure", procedureStart);
    const procedure = routerSource.slice(procedureStart, procedureEnd);
    expect(procedure).toContain("expert instructional designer for Course360");
    expect(procedure).not.toContain("ultrasound and echocardiography");
    expect(procedure).not.toContain("All About Ultrasound");
    expect(editorSource).toContain("Topics, Notes & Required Details");
    expect(editorSource).toContain("Add curated Unsplash images");
    expect(editorSource).toContain("Generate original AI module visuals");
    expect(editorSource).toContain("sourceFiles.map(({ url, mimeType, name })");
  });
});
