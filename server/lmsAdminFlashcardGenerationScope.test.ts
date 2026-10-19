import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const routerSource = fs.readFileSync(
  path.resolve(process.cwd(), "server/routers/lmsCourseBuilderRouter.ts"),
  "utf8",
);
const editorSource = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/components/LessonFlashcardBlockEditor.tsx"),
  "utf8",
);

describe("Course360 LMS admin flashcard generation", () => {
  it("keeps the course curriculum selector protected and active-organization scoped", () => {
    const start = routerSource.indexOf("getCurriculumById: protectedProcedure");
    const end = routerSource.indexOf("generateFlashcardsFromLesson: protectedProcedure", start);
    const procedure = routerSource.slice(start, end);

    expect(procedure).toContain("await assertAdmin(ctx)");
    expect(procedure).toContain("await assertCourseOwnership(ctx, input.courseId)");
    expect(procedure).toContain("eq(lmsSections.courseId, course.id)");
    expect(procedure).toContain("eq(lmsLessons.courseId, course.id)");
  });

  it("validates every requested lesson or course against the active organization before AI generation", () => {
    const start = routerSource.indexOf("generateFlashcardsFromLesson: protectedProcedure");
    const end = routerSource.indexOf("// ── Courses ──", start);
    const procedure = routerSource.slice(start, end);

    expect(procedure).toContain("await getOrgIdForUserWithFallback(ctx.user.id, ctx.user.role)");
    expect(procedure).toContain("await assertAiCourseGeneratorAccess(ctx, orgId)");
    expect(procedure).toContain("await assertCourseOwnership(ctx, input.courseId)");
    expect(procedure).toContain("await assertLessonOwnership(ctx, lessonId)");
    expect(procedure).toContain("input.lessonIds ?? []");
    expect(procedure).toContain("userContext.slice(0, 18_000)");
    expect(procedure).toContain("additionalProperties: false");
    expect(procedure).toContain("Course360 instructional designer");
    expect(procedure).not.toContain("All About Ultrasound");
    expect(procedure).not.toContain("iHeartEcho");
  });

  it("connects the authoring editor only to secured LMS admin procedures", () => {
    expect(editorSource).toContain("trpc.lmsAdmin.getCurriculumById.useQuery");
    expect(editorSource).toContain("trpc.lmsAdmin.generateFlashcardsFromLesson.useMutation");
    expect(editorSource).not.toContain("trpc.lms.generateFlashcardsFromLesson");
  });
});
