import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const routerSource = fs.readFileSync(path.resolve(process.cwd(), "server/routers/quizRouter.ts"), "utf8");
const embeddedPlayerSource = fs.readFileSync(path.resolve(process.cwd(), "client/src/components/EmbeddedQuizPlayer.tsx"), "utf8");
const resultsPageSource = fs.readFileSync(path.resolve(process.cwd(), "client/src/pages/lms/CourseQuizResultsPage.tsx"), "utf8");
const appSource = fs.readFileSync(path.resolve(process.cwd(), "client/src/App.tsx"), "utf8");

describe("Course-bound learner quiz results", () => {
  it("requires the verified course lesson path before listing a learner's attempts", () => {
    const start = routerSource.indexOf("listLearnerAttempts: protectedProcedure");
    const end = routerSource.indexOf("startLearnerAttempt: protectedProcedure", start);
    const procedure = routerSource.slice(start, end);

    expect(procedure).toContain("resolveEmbeddedLearnerQuizAccess(ctx, input)");
    expect(procedure).toContain("eq(quizAttempts.userId, ctx.user.id)");
    expect(procedure).toContain("eq(quizAttempts.sourceLessonId, input.sourceLessonId!)");
    expect(procedure).toContain('eq(quizAttempts.status, "completed")');
    expect(procedure).toContain("if (access.isStaffPreview) return []");
  });

  it("binds detailed results to the attempt owner, verified quiz, lesson, and active course access", () => {
    const start = routerSource.indexOf("getLearnerAttemptResult: protectedProcedure");
    const end = routerSource.indexOf("// ─── Quiz CRUD", start);
    const procedure = routerSource.slice(start, end);

    expect(procedure).toContain("resolveEmbeddedLearnerQuizAccess(ctx");
    expect(procedure).toContain("eq(quizAttempts.userId, ctx.user.id)");
    expect(procedure).toContain("eq(quizAttempts.quizId, access.quiz.id)");
    expect(procedure).toContain("eq(quizAttempts.sourceLessonId, input.sourceLessonId)");
    expect(procedure).toContain('eq(quizAttempts.status, "completed")');
    expect(procedure).toContain("const canReviewAnswers = access.quiz.showCorrectAnswers || access.quiz.showExplanations");
    expect(procedure).toContain("access.quiz.showCorrectAnswers");
    expect(procedure).toContain("access.quiz.showExplanations");
  });

  it("routes learner review through a lesson-bound URL rather than a globally discoverable attempt page", () => {
    expect(embeddedPlayerSource).toContain("trpc.quiz.listLearnerAttempts.useQuery");
    expect(embeddedPlayerSource).toContain("/player/quiz/${quizId}/attempt/${resultAttemptId}/lesson/${sourceLessonId}");
    expect(resultsPageSource).toContain("trpc.quiz.getLearnerAttemptResult.useQuery");
    expect(resultsPageSource).toContain("courseSlug: slug ?? \"\"");
    expect(resultsPageSource).toContain("sourceLessonId: lessonIdNumber");
    expect(appSource).toContain('path="/courses/:slug/player/quiz/:quizId/attempt/:attemptId/lesson/:lessonId" component={CourseQuizResultsPage}');
  });

  it("keeps question navigation and flags in the course player while the server retains scoring authority", () => {
    expect(embeddedPlayerSource).toContain("const [flaggedQuestionIds, setFlaggedQuestionIds]");
    expect(embeddedPlayerSource).toContain("const [showReview, setShowReview]");
    expect(embeddedPlayerSource).toContain("Review & Submit");
    expect(embeddedPlayerSource).toContain("toggleQuestionFlag(q.id)");
    expect(embeddedPlayerSource).toContain("handleSubmit(true)");
    expect(embeddedPlayerSource).toContain("trpc.quiz.completeLearnerAttempt.useMutation");
  });
});
