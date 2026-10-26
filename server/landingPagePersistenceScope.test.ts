import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routerSource = readFileSync(new URL("./routers/lmsQuizLandingRouter.ts", import.meta.url), "utf8");
const adminRouterSource = readFileSync(new URL("./routers/lmsAdminRouter.ts", import.meta.url), "utf8");
const builderSource = readFileSync(new URL("../client/src/pages/lms/LandingPageBuilder.tsx", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");
const embeddedSource = readFileSync(new URL("./lib/landingEmbeddedResources.ts", import.meta.url), "utf8");
const publicLmsSource = readFileSync(new URL("./routers/lmsRouter.ts", import.meta.url), "utf8");
const publicLandingSource = readFileSync(new URL("../client/src/pages/lms/CourseLanding.tsx", import.meta.url), "utf8");

function procedure(name: string, nextName: string) {
  const start = routerSource.indexOf(`${name}: protectedProcedure`);
  const end = routerSource.indexOf(nextName, start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return routerSource.slice(start, end);
}

describe("Course360 landing page ownership and persistence", () => {
  it("registers only the active landing procedures without importing conflicting legacy quiz methods", () => {
    expect(routerSource).toContain("export const lmsLandingPageRouter = router({");
    expect(routerSource).toContain("getLandingPageBlocks: lmsQuizLandingRouter._def.procedures.getLandingPageBlocks,");
    expect(adminRouterSource).toContain('import { lmsLandingPageRouter } from "./lmsQuizLandingRouter";');
    expect(adminRouterSource).toContain("...lmsLandingPageRouter._def.procedures,");
  });

  it("keeps the landing builder reachable before the full-screen course editor catch-all", () => {
    const fullScreenRouter = appSource.slice(
      appSource.indexOf("function FullScreenEditorRouter"),
      appSource.indexOf("function Router()"),
    );
    expect(fullScreenRouter).toContain('path="/lms/courses/:courseId/landing-builder"');
    expect(fullScreenRouter.indexOf('path="/lms/courses/:courseId/landing-builder"'))
      .toBeLessThan(fullScreenRouter.indexOf('path="/lms/courses/:id" component={CourseEditorPage}'));
  });

  it("requires the server-resolved active organization to own every landing read, write, SEO, and AI request", () => {
    const procedures = [
      procedure("updateLandingPage", "// ── Landing Page Blocks"),
      procedure("getLandingPageBlocks", "saveLandingPageBlocks: protectedProcedure"),
      procedure("saveLandingPageBlocks", "// ── Save Landing Page SEO"),
      procedure("saveLandingPageSeo", "// ── AI Generate Landing Page"),
      procedure("aiGenerateLandingPage", "// ── Page Templates"),
    ];

    for (const source of procedures) {
      expect(source).toContain("await assertCourseOwnership(ctx, input.courseId);");
    }
  });

  it("rejects cross-organization group-purchase references and verifies the exact saved block payload", () => {
    const saveSource = procedure("saveLandingPageBlocks", "// ── Save Landing Page SEO");
    expect(saveSource).toContain("eq(lmsCourses.orgId, owningCourse.orgId)");
    expect(saveSource).toContain("Landing-page checkout references must belong to the active organization.");
    expect(saveSource).toContain("saved.blocks !== blocksJson");
    expect(saveSource).toContain("Landing page could not be verified after save.");
    expect(saveSource).toContain("return { success: true, blocks: input.blocks, updatedAt: saved.updatedAt };");
  });

  it("keeps explicit save feedback dependent on the mutation and refreshes the scoped read model", () => {
    expect(builderSource).toContain("await saveBlocks.mutateAsync({ courseId: numericCourseId, blocks });");
    expect(builderSource).toContain("lpUtils.lmsAdmin.getLandingPageBlocks.invalidate({ courseId: numericCourseId });");
    expect(builderSource).toContain("setAiDraftLoaded(false);");
  });

  it("validates nested embedded course, quiz, and card references before a landing write", () => {
    const saveSource = procedure("saveLandingPageBlocks", "// ── Save Landing Page SEO");
    expect(saveSource).toContain("await validateLandingEmbeddedReferences(db, owningCourse.orgId, input.blocks);");
    expect(embeddedSource).toContain("visitLandingBlocks(data.leftBlocks, visitor, depth + 1);");
    expect(embeddedSource).toContain("visitLandingBlocks(data.rightBlocks, visitor, depth + 1);");
    expect(embeddedSource).toContain("Quiz embeds require a published public quiz with an active share link.");
    expect(embeddedSource).toContain("${context} must reference a course in this organization.");
  });

  it("uses fail-closed, organization-scoped public resource data rather than saved snapshots", () => {
    expect(publicLmsSource).toContain("resolvePublicLandingEmbeddedResources");
    expect(publicLmsSource).toContain("sanitizePublicLandingBlocks(storedLandingPage.blocks)");
    expect(embeddedSource).toContain("eq(lmsCourses.orgId, options.organizationId)");
    expect(embeddedSource).toContain("eq(quizzes.orgId, options.organizationId)");
    expect(embeddedSource).toContain("if (!quiz || !quiz.shareToken || !isPublicQuizDeliveryVisible(quiz.visibility)) continue;");
    expect(embeddedSource).toContain("eq(lmsEnrollments.courseId, options.sourceCourseId)");
    expect(embeddedSource).not.toContain("recentActivity");
  });

  it("uses host-scoped course data and resolved organization course and quiz URLs", () => {
    expect(publicLandingSource).toContain("trpc.lmsPublic.getCourse.useQuery");
    expect(publicLandingSource).toContain("linked.courseUrl");
    expect(publicLandingSource).toContain("linked.quizUrl");
    expect(publicLandingSource).not.toContain("EmbeddedQuizPlayer quizId");
    expect(builderSource).toContain("eligibleQuizzes");
  });
});
