// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ info: null as any, response: null as any, result: null as any, start: vi.fn(), save: vi.fn(), submit: vi.fn(), legacyStart: vi.fn(), legacyCheck: vi.fn(), legacyComplete: vi.fn() }));
vi.mock("../client/src/lib/trpc", () => ({ trpc: { quiz: {
 getNativeCourseAttempt: { useQuery: () => ({ data: state.response, error: null }) },
 getLearnerQuizInfo: { useQuery: () => ({ data: state.info, isLoading: false }) }, listLearnerAttempts: { useQuery: () => ({ data: [], refetch: vi.fn() }) },
 startNativeCourseAttempt: { useMutation: () => ({ mutateAsync: state.start, isPending: false }) }, saveNativeCourseAnswers: { useMutation: () => ({ mutateAsync: state.save, isPending: false }) }, submitNativeCourseAttempt: { useMutation: () => ({ mutateAsync: state.submit, isPending: false }) },
 startLearnerAttempt: { useMutation: () => ({ mutate: state.legacyStart, isPending: false }) }, checkLearnerResponse: { useMutation: () => ({ mutateAsync: state.legacyCheck, mutate: vi.fn(), isPending: false }) }, completeLearnerAttempt: { useMutation: () => ({ mutateAsync: state.legacyComplete, isPending: false }) },
} } }));
vi.mock("../client/src/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 5 }, loading: false }) }));
vi.mock("wouter", () => ({ useLocation: () => ["/", vi.fn()] }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("../client/src/const", () => ({ getLoginUrl: () => "/login" }));
import EmbeddedQuizPlayer from "../client/src/components/EmbeddedQuizPlayer";
import { Course360NativeLessonQuizControls } from "../client/src/components/Course360NativeLessonQuizControls";
const questions = [
 { id: "mc", type: "mcq", stem: "Select", data: { choices: [{ id: "a", text: "A" }, { id: "b", text: "B" }], multiSelect: false } },
 { id: "tf", type: "tf", stem: "True?", data: {} },
 { id: "hot", type: "hotspot", stem: "Region", data: { regions: [{ id: "region", label: "Center" }] } },
 { id: "match", type: "matching", stem: "Match", data: { pairs: [{ id: "p1", premise: "Term" }], responses: [{ id: "opaque-response", text: "Definition" }] } },
 { id: "blank", type: "fill_blank", stem: "Blank", data: { template: "A {{blank}}", blanks: [{ id: "blank" }] } },
 { id: "short", type: "short_answer", stem: "Explain", data: { autoGrade: true } },
 { id: "image", type: "image_choice", stem: "Image choice", data: { choices: [{ id: "img", label: "Pick" }] } },
];
const props = { quizId: 44, sourceLessonId: 31, courseSlug: "course-a" };
beforeEach(() => {
 vi.clearAllMocks();
 state.info = { kind: "native", title: "Native lesson", questionCount: 7, timeLimitMinutes: 2.5, passingScore: 85.125, type: "mock_exam", attemptCount: 0, canAttempt: true, allowRetakes: true };
 state.response = { kind: "native", attemptId: 100, questions, settings: {}, deadlineAt: null, answerRevision: 0, answers: {}, gradingStatus: "in_progress", result: null };
 state.result = { kind: "native", attemptId: 100, score: 100, earnedPoints: 4.25, totalPoints: 4.25, correctAnswers: 7, totalQuestions: 7, passed: true, gradingStatus: "graded", canCompleteLesson: true };
 state.start.mockImplementation(async () => state.response); let revision = 0; state.save.mockImplementation(async () => ({ answerRevision: ++revision })); state.submit.mockImplementation(async () => state.result);
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
async function start() { fireEvent.click(screen.getByRole("button", { name: "Start Quiz" })); await screen.findByText("Select"); }
async function next() { fireEvent.click(screen.getByRole("button", { name: "Save & Next" })); await waitFor(() => expect(screen.queryByText("Select")).toBeNull()); }
describe("actual EmbeddedQuizPlayer native dispatch", () => {
 it("uses all seven real native controls, string IDs and only remote score; fractional result advances enrolled lesson once", async () => {
  const complete = vi.fn(); render(<EmbeddedQuizPlayer {...props} onComplete={complete} />); await start();
  fireEvent.click(screen.getByRole("button", { name: "A" })); await next();
  fireEvent.click(screen.getByRole("button", { name: "False" })); fireEvent.click(screen.getByRole("button", { name: "Save & Next" })); await screen.findByText("Region");
  fireEvent.click(screen.getByRole("button", { name: "Center" })); fireEvent.click(screen.getByRole("button", { name: "Save & Next" })); await screen.findByText("Match");
  fireEvent.change(screen.getByLabelText("Term"), { target: { value: "opaque-response" } }); fireEvent.click(screen.getByRole("button", { name: "Save & Next" })); await screen.findByText("Blank");
  fireEvent.change(screen.getByLabelText("Blank blank"), { target: { value: "test" } }); fireEvent.click(screen.getByRole("button", { name: "Save & Next" })); await screen.findByText("Explain");
  fireEvent.change(screen.getByLabelText("Written answer"), { target: { value: "Pressure" } }); fireEvent.click(screen.getByRole("button", { name: "Save & Next" })); await screen.findByText("Image choice");
  fireEvent.click(screen.getByRole("button", { name: "Pick" })); fireEvent.click(screen.getByRole("button", { name: "Submit exam" })); await screen.findByText("Quiz Passed!");
  expect(state.legacyStart).not.toHaveBeenCalled(); expect(state.legacyCheck).not.toHaveBeenCalled(); expect(state.submit).toHaveBeenCalledTimes(1);
  expect(state.submit.mock.calls[0][0]).toMatchObject({ ...props, authorPreview: false, answers: { mc: ["a"], tf: false, hot: ["region"], match: { p1: "opaque-response" }, blank: { blank: "test" }, short: "Pressure", image: ["img"] } });
  expect(screen.getByText(/4.25 \/ 4.25 points/)).toBeTruthy(); expect(complete).toHaveBeenCalledTimes(1); expect(complete).toHaveBeenCalledWith(100, true);
 });
 it.each(["pending", "author", "lesson-preview"])("%s never invokes course completion callback", async kind => {
  state.response.questions = [questions[0]]; if (kind === "pending") state.result = { ...state.result, gradingStatus: "pending_manual", passed: false, canCompleteLesson: false, earnedPoints: .25, totalPoints: .75 }; else state.result.canCompleteLesson = false;
  const complete = vi.fn(); render(<EmbeddedQuizPlayer {...props} authorPreview={kind === "author"} onComplete={complete} />); await start(); fireEvent.click(screen.getByRole("button", { name: "A" })); fireEvent.click(screen.getByRole("button", { name: "Submit exam" }));
  if (kind === "pending") { await screen.findByText("Awaiting instructor review"); expect(screen.queryByText("Quiz Complete")).toBeNull(); expect(screen.queryByRole("button", { name: "Retake Quiz" })).toBeNull(); } else await screen.findByText("Quiz Passed!"); expect(complete).not.toHaveBeenCalled();
 });
 it("resumed server deadline disables new answers and submits saved-only", async () => {
  state.response.deadlineAt = Date.now() - 1000; state.response.questions = [questions[0]]; state.response.answers = { mc: ["a"] }; state.response.answerRevision = 4;
  render(<EmbeddedQuizPlayer {...props} />); await start(); await screen.findByRole("button", { name: "Submit saved answers" }); expect(screen.getByRole("button", { name: "B" }).matches(":disabled")).toBe(true); fireEvent.click(screen.getByRole("button", { name: "Submit saved answers" })); await screen.findByText("Quiz Passed!"); expect(state.save).not.toHaveBeenCalled(); expect(state.submit.mock.calls[0][0]).toMatchObject({ submitSavedOnly: true, answers: {}, expectedAnswerRevision: 4 });
 });
 it("submission retry after network failure preserves answers and blocks concurrent double-click", async () => {
  state.response.questions = [questions[0]]; state.submit.mockRejectedValueOnce(new Error("Offline retry")); const complete = vi.fn(); render(<EmbeddedQuizPlayer {...props} onComplete={complete} />); await start(); fireEvent.click(screen.getByRole("button", { name: "A" })); fireEvent.click(screen.getByRole("button", { name: "Submit exam" })); await screen.findByRole("alert"); expect(screen.getByText("Offline retry")).toBeTruthy(); expect(complete).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole("button", { name: "Submit exam" })); fireEvent.click(screen.getByRole("button", { name: "Submit exam" })); await screen.findByText("Quiz Passed!"); expect(state.submit).toHaveBeenCalledTimes(2); expect(state.submit.mock.calls[1][0].answers).toEqual({ mc: ["a"] }); expect(complete).toHaveBeenCalledTimes(1);
 });
 it("changing course lesson unmounts native attempt and old answers", async () => {
  const view = render(<EmbeddedQuizPlayer {...props} />); await start(); fireEvent.click(screen.getByRole("button", { name: "A" })); view.rerender(<EmbeddedQuizPlayer {...props} sourceLessonId={33} />); await screen.findByRole("button", { name: "Start Quiz" }); expect(screen.queryByText("Select")).toBeNull(); expect(state.submit).not.toHaveBeenCalled();
 });
 it("ordinary numeric bank screen retains real legacy start/check/complete methods", async () => {
  state.info = { ...state.info, kind: "bank", questionCount: 1, maxAttempts: 2 };
  state.legacyStart.mockImplementation((_input, options) => options.onSuccess({ attemptId: 200, questions: [{ id: 71, questionBankId: 71, question: "Bank question", choices: [{ id: 72, text: "Bank right" }] }], quiz: { type: "mock_exam" } })); state.legacyCheck.mockResolvedValue({ isCorrect: true }); state.legacyComplete.mockResolvedValue({ attemptId: 200, score: 100, passed: true, correctAnswers: 1, totalQuestions: 1 });
  const complete = vi.fn(); render(<EmbeddedQuizPlayer {...props} onComplete={complete} />); fireEvent.click(screen.getByRole("button", { name: "Start Quiz" })); await screen.findByText("Bank question"); fireEvent.click(screen.getByRole("button", { name: "A. Bank right" })); fireEvent.click(screen.getByRole("button", { name: "Review & Submit" })); fireEvent.click(screen.getByRole("button", { name: "Submit exam" })); await screen.findByText("Quiz Passed!"); expect(state.start).not.toHaveBeenCalled(); expect(state.legacyCheck.mock.calls[0][0]).toMatchObject({ questionId: 71, selectedChoiceIds: [72] }); expect(complete).toHaveBeenCalledTimes(1); expect(complete).toHaveBeenCalledWith(100, true);
 });
 it("safe image URL and written controls cannot execute native content", () => {
  const onAnswer = vi.fn(); const view = render(<Course360NativeLessonQuizControls question={{ id: "essay", type: "essay", stem: "<script>bad</script>", image: { url: "javascript:alert(1)" }, data: { rubric: "Hidden rubric" } }} answer="" onAnswer={onAnswer} />); expect(screen.getByText("<script>bad</script>")).toBeTruthy(); expect(view.container.querySelector("script,img")).toBeNull(); expect(screen.queryByText("Hidden rubric")).toBeNull(); fireEvent.change(screen.getByLabelText("Written answer"), { target: { value: "My answer" } }); expect(onAnswer).toHaveBeenCalledWith("My answer");
 });
});

describe("native latest result access", () => {
 it("pending server result can be reopened without another start or completion callback", async () => {
   state.info = { ...state.info, awaitingReview: true, latestAttemptId: 100, canAttempt: false };
   state.response.result = { ...state.result, gradingStatus: "pending_manual", passed: false, canCompleteLesson: false };
   const complete = vi.fn(); render(<EmbeddedQuizPlayer {...props} onComplete={complete} />);
   fireEvent.click(screen.getByRole("button", { name: "View latest result" }));
   await screen.findByText("Awaiting instructor review"); expect(state.start).not.toHaveBeenCalled(); expect(complete).not.toHaveBeenCalled();
 });
});

describe("native late-response isolation", () => {
 it("an old lesson submit finishing after unmount cannot complete the newly selected lesson", async () => {
   state.response.questions = [questions[0]];
   let release: (value: any) => void = () => {};
   state.submit.mockImplementation(() => new Promise(resolve => { release = resolve; }));
   const complete = vi.fn(); const view = render(<EmbeddedQuizPlayer {...props} onComplete={complete} />);
   await start(); fireEvent.click(screen.getByRole("button", { name: "A" })); fireEvent.click(screen.getByRole("button", { name: "Submit exam" }));
   await waitFor(() => expect(state.submit).toHaveBeenCalledTimes(1));
   view.rerender(<EmbeddedQuizPlayer {...props} sourceLessonId={33} onComplete={complete} />);
   await act(async () => release(state.result));
   expect(complete).not.toHaveBeenCalled(); expect(screen.queryByText("Quiz Passed!")).toBeNull();
 });
});
