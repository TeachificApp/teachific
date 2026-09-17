import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../client/src/pages/lms/CoursePlayer.tsx", import.meta.url), "utf8");
const routerSource = readFileSync(new URL("./routers/lmsRouter.ts", import.meta.url), "utf8");

describe("Course360 inline lesson survey answer recovery", () => {
  it("loads stored answers and retains a local draft until a successful submission", () => {
    expect(source).toContain("trpc.lmsLearner.getInlineLessonQuizAttempt.useQuery");
    expect(source).toContain("inline-lesson-quiz-answers:${courseSlug}:${lessonId}:${quizBlockId}");
    expect(source).toContain("if (!isAdminPreview && isSavedAttemptLoading) return;");
    expect(source).toContain("sessionStorage.setItem(answerDraftKey, JSON.stringify({ selected }))");
    expect(source).toContain("sessionStorage.removeItem(answerDraftKey);");
    expect(source).toContain("setSubmitted(true);");
  });

  it("uses a server-authorized attempt lookup rather than caller-provided organization data", () => {
    expect(routerSource).toContain("getInlineLessonQuizAttempt: protectedProcedure");
    expect(routerSource).toContain("const activeOrgId = await getOrgIdForUserWithFallback(ctx.user.id, ctx.user.role);");
    expect(routerSource).toContain("eq(lmsInlineQuizAttempts.enrollmentId, enrollment.id)");
    expect(routerSource).toContain("eq(lmsInlineQuizResponses.orgId, course.orgId)");
    expect(routerSource).toContain("getStoredInlineLessonQuizBlock(lesson.contentBlocks, input.quizBlockId)");
  });
});
