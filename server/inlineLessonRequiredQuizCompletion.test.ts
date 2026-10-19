import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { lessonHasRequiredGradedInlineQuiz } from "../shared/inlineLessonQuizCompletion";

const routerSource = readFileSync(resolve(import.meta.dirname, "routers/lmsRouter.ts"), "utf8");
const playerSource = readFileSync(resolve(import.meta.dirname, "../client/src/pages/lms/CoursePlayer.tsx"), "utf8");

describe("required inline lesson quiz completion", () => {
  it("only treats populated graded quizzes with an enabled pass requirement as a completion gate", () => {
    expect(lessonHasRequiredGradedInlineQuiz([
      { type: "lesson_quiz", data: { questions: [{ question: "One" }] } },
    ])).toBe(true);
    expect(lessonHasRequiredGradedInlineQuiz('[{"type":"lesson_quiz","data":{"questions":[{"question":"One"}],"requirePassToComplete":true}}]')).toBe(true);
    expect(lessonHasRequiredGradedInlineQuiz([
      { type: "lesson_quiz", data: { questions: [], requirePassToComplete: true } },
    ])).toBe(false);
    expect(lessonHasRequiredGradedInlineQuiz([
      { type: "lesson_quiz", data: { questions: [{ question: "Feedback" }], requirePassToComplete: false } },
    ])).toBe(false);
    expect(lessonHasRequiredGradedInlineQuiz([
      { type: "lesson_quiz", data: { questions: [{ question: "Feedback" }], isSurvey: true, requireSurveyCompletion: true } },
    ])).toBe(false);
  });

  it("keeps completion authorization server-owned and scoped to the active course enrollment", () => {
    const completionStart = routerSource.indexOf("markLessonComplete: protectedProcedure");
    const completionEnd = routerSource.indexOf("/** Submit quiz answers */", completionStart);
    const completionSource = routerSource.slice(completionStart, completionEnd);
    expect(completionSource).toContain("getRequiredGradedInlineQuizBlockIds(lesson.contentBlocks)");
    expect(completionSource).toContain("eq(lmsInlineQuizAttempts.orgId, course.orgId)");
    expect(completionSource).toContain("eq(lmsInlineQuizAttempts.enrollmentId, enrollment.id)");
    expect(completionSource).toContain("eq(lmsInlineQuizAttempts.passed, true)");
    expect(completionSource).toContain("Pass each required lesson quiz before marking this lesson complete.");
  });

  it("does not show the manual completion control until required graded quizzes pass", () => {
    expect(playerSource).toContain("lessonHasRequiredGradedInlineQuiz(contentBlocks)");
    expect(playerSource).toContain("inlineCompletion?.requiredQuizComplete === true");
    expect(playerSource).toContain("Pass each required lesson quiz to complete this lesson.");
    expect(playerSource).toContain("const completion = await refetchRequiredInlineSurveyCompletion()");
    expect(playerSource).toContain("completion.data?.complete === true");
    expect(playerSource).toContain("markComplete.mutate({ lessonId: lessonData.id, courseSlug: slug! })");
  });
});
