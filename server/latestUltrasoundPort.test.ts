import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isStaleAssetError } from "../client/src/components/ErrorBoundary";
import { mapQuestionType, parseBlocks } from "./lib/lessonQuizQuestionBankSync";

describe("latest Ultrasound-App learning feature port", () => {
  it("recognizes HTML returned in place of a Quiz Creator JavaScript module", () => {
    expect(isStaleAssetError(new Error("'text/html' is not a valid JavaScript MIME type."))).toBe(true);
    expect(isStaleAssetError(new Error("Loading chunk 42 failed"))).toBe(true);
    expect(isStaleAssetError(new Error("ordinary validation error"))).toBe(false);
  });

  it("maps lesson quiz question variants into supported Question Bank types", () => {
    expect(mapQuestionType("multiple_choice")).toBe("mcq");
    expect(mapQuestionType("true_false")).toBe("tf");
    expect(mapQuestionType("multiselect")).toBe("multiple_select");
    expect(mapQuestionType("drag_sort")).toBe("ordering");
    expect(mapQuestionType("fill_blank")).toBe("fill_blank");
  });

  it("accepts only serialized block arrays for page-builder lesson quiz synchronization", () => {
    expect(parseBlocks('[{"id":"quiz-1","type":"lesson_quiz"}]')).toHaveLength(1);
    expect(parseBlocks('{"type":"lesson_quiz"}')).toEqual([]);
    expect(parseBlocks("not JSON")).toEqual([]);
    expect(parseBlocks(null)).toEqual([]);
  });

  it("enforces org-owned waitlist and enrollment-closed states before creating a course enrollment", () => {
    const routerSource = readFileSync(new URL("./lmsRouter.ts", import.meta.url), "utf8");
    expect(routerSource).toContain('eq(contentAvailability.productType, "course")');
    expect(routerSource).toContain('availability?.status === "waitlist"');
    expect(routerSource).toContain('availability?.status === "enrollment_closed"');
    expect(routerSource).toContain("orgId: course.orgId");
  });

  it("protects active Question Bank banks, tags, questions, and import jobs with org ownership checks", () => {
    const routerSource = readFileSync(new URL("./routers/quizBankRouter.ts", import.meta.url), "utf8");
    expect(routerSource).toContain("requireOwnedOrg(ctx, input.orgId)");
    expect(routerSource).toContain("requireBankAccess(ctx, input.id)");
    expect(routerSource).toContain("requireQuestionAccess(ctx, input.id)");
    expect(routerSource).toContain("requireTagAccess(ctx, input.id)");
    expect(routerSource).toContain("requireImportJobAccess(ctx, input.jobId)");
    expect(routerSource).toContain("The selected Question Bank belongs to another organisation.");
  });

  it("uses the linked standalone quiz for quiz and exam lessons when a lesson quizId is present", () => {
    const playerSource = readFileSync(new URL("../client/src/pages/lms/CoursePlayerPage.tsx", import.meta.url), "utf8");
    expect(playerSource).toContain('import EmbeddedQuizPlayer from "@/components/EmbeddedQuizPlayer"');
    expect(playerSource).toContain("lesson.quizId ? (");
    expect(playerSource).toContain("<EmbeddedQuizPlayer");
    expect(playerSource).toContain("quizId={lesson.quizId}");
  });

  it("exposes answer-level feedback and media controls in the org-scoped Question Bank editor", () => {
    const questionBankPage = readFileSync(new URL("../client/src/pages/lms/QuestionBankPage.tsx", import.meta.url), "utf8");
    expect(questionBankPage).toContain('updateChoice(idx, "mediaUrl", e.target.value)');
    expect(questionBankPage).toContain('updateChoice(idx, "feedbackText", e.target.value)');
    expect(questionBankPage).toContain('updateChoice(idx, "feedbackMediaUrl", e.target.value)');
    expect(questionBankPage).toContain("Feedback for this answer (optional)");
  });

  it("wires the active organization into Question Bank media picker controls", () => {
    const questionBankPage = readFileSync(new URL("../client/src/pages/lms/QuestionBankPage.tsx", import.meta.url), "utf8");
    expect(questionBankPage).toContain('import { MediaLibraryPicker } from "@/components/MediaLibraryPicker"');
    expect(questionBankPage).toContain("orgId={orgId}");
    expect(questionBankPage).toContain("Choose question media");
    expect(questionBankPage).toContain("Feedback media");
  });

  it("provides an org-admin-gated AI generator that creates questions only in the selected Question Bank", () => {
    const routerSource = readFileSync(new URL("./routers/quizBankRouter.ts", import.meta.url), "utf8");
    const questionBankPage = readFileSync(new URL("../client/src/pages/lms/QuestionBankPage.tsx", import.meta.url), "utf8");
    expect(routerSource).toContain("generateQuestions: protectedProcedure");
    expect(routerSource).toContain("const bank = await requireBankAccess(ctx, input.bankId)");
    expect(routerSource).toContain('model: "gpt-5-mini"');
    expect(routerSource).toContain("orgId: bank.orgId");
    expect(questionBankPage).toContain("AI Question Generator");
    expect(questionBankPage).toContain("trpc.quizBank.generateQuestions.useMutation");
  });

  it("provides a Teachific-branded visual workspace for an authorized standalone Quiz Creator quiz", () => {
    const appSource = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");
    const workspaceSource = readFileSync(new URL("../client/src/pages/QuizVisualBuilderPage.tsx", import.meta.url), "utf8");
    expect(appSource).toContain('path="/quiz-creator/:quizId/builder"');
    expect(workspaceSource).toContain("trpc.quizMaker.getQuiz.useQuery");
    expect(workspaceSource).toContain("Back to Teachific Quiz Creator");
    expect(workspaceSource).toContain("BrandingPanel");
    expect(workspaceSource).not.toContain("All About Ultrasound");
  });

  it("protects Quiz Creator authoring with organization ownership helpers", () => {
    const routerSource = readFileSync(new URL("./routers/quizRouter.ts", import.meta.url), "utf8");
    expect(routerSource).toContain("async function requireQuizAdmin");
    expect(routerSource).toContain("await requireOrgAdmin(ctx.user.id, ctx.user.role, input.orgId)");
    expect(routerSource).toContain("await requireQuizAdmin(ctx, input.id)");
  });

  it("rejects cross-organization Question Bank pools, tags, and overrides", () => {
    const routerSource = readFileSync(new URL("./routers/quizRouter.ts", import.meta.url), "utf8");
    expect(routerSource).toContain("requireQuizBankInOrg(pool.bankId, quiz.orgId)");
    expect(routerSource).toContain("Question Bank tags must belong to the quiz organization.");
    expect(routerSource).toContain("Question overrides must belong to the quiz organization.");
  });

  it("protects legacy lesson quiz authoring, groups, and AI lesson context with course ownership checks", () => {
    const routerSource = readFileSync(new URL("./routers/lmsQuizLandingRouter.ts", import.meta.url), "utf8");
    expect(routerSource).toContain("async function requireLegacyQuizOwnership");
    expect(routerSource).toContain("await requireLessonQuizOwnership(ctx, input.lessonId)");
    expect(routerSource).toContain("await requireLegacyQuestionOwnership(ctx, input.id)");
    expect(routerSource).toContain("AI course context must belong to the quiz course.");
    expect(routerSource).toContain("Selected lesson context must belong to the quiz course.");
    expect(routerSource).toContain("await requireLegacyQuizGroupOwnership(ctx, input.groupId)");
  });
});
