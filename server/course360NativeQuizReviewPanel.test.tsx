// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), grade: vi.fn(), release: vi.fn(), queue: null as any, detail: null as any }));
vi.mock("../client/src/lib/trpc", () => ({ trpc: { quiz: {
  listNativeQuizReviewAttempts: { useMutation: () => ({ mutateAsync: state.list }) },
  getNativeQuizReviewAttempt: { useMutation: () => ({ mutateAsync: state.get }) },
  gradeNativeQuizReviewQuestion: { useMutation: () => ({ mutateAsync: state.grade }) },
  releaseNativeQuizReviewAttempt: { useMutation: () => ({ mutateAsync: state.release }) },
} } }));
import { Course360NativeQuizReviewPanel } from "../client/src/components/quiz-creator/Course360NativeQuizReviewPanel";
const props = { orgId: 9, quizId: 44 };
beforeEach(() => {
  vi.clearAllMocks();
  state.queue = { orgId: 9, nextCursor: null, items: [{ attemptId: 100, quizId: 44, quizTitle: "Frozen Quiz", courseTitle: "Course A", learnerId: 5, reviewRevision: 0, manualQuestionCount: 2, reviewedQuestionCount: 0, readyToRelease: false }] };
  state.detail = { attemptId: 100, quizId: 44, quizTitle: "Frozen Quiz", courseTitle: "Course A", source: { orgId: 9, userId: 5 }, reviewRevision: 0, releasedAt: null, gradingStatus: "pending_manual", readyToRelease: false, draftResult: null, releasedResult: null, audit: [], questions: [
    { id: "essay", stem: "Frozen essay", maxPoints: .5, rubric: "Frozen rubric", sampleAnswer: "Frozen model", answer: "Learner answer", review: null },
    { id: "short", stem: "Frozen short", maxPoints: .75, rubric: null, sampleAnswer: null, answer: "Short learner answer", review: null },
  ] };
  state.list.mockImplementation(async () => state.queue); state.get.mockImplementation(async () => state.detail);
  state.grade.mockImplementation(async (input: any) => {
    const questions = state.detail.questions.map((q: any) => q.id === input.questionId ? { ...q, review: { points: input.points, feedback: input.feedback, reviewer: { userId: 7 } } } : q);
    const all = questions.every((q: any) => q.review);
    state.detail = { ...state.detail, questions, reviewRevision: state.detail.reviewRevision + 1, readyToRelease: all, draftResult: all ? { earnedPoints: 1.25, totalPoints: 1.5, scorePercent: 83.33, passed: false } : null };
    return state.detail;
  });
  state.release.mockImplementation(async () => { state.detail = { ...state.detail, releasedAt: 1234567, gradingStatus: "graded", readyToRelease: false, reviewRevision: state.detail.reviewRevision + 1, releasedResult: { earnedPoints: 1.25, totalPoints: 1.5, scorePercent: 83.33, passed: false } }; return state.detail; });
});
afterEach(cleanup);
async function open() { fireEvent.click(screen.getByRole("button", { name: "Review enrolled quizzes" })); await screen.findByRole("button", { name: /Frozen Quiz — learner/ }); }
async function select() { fireEvent.click(screen.getByRole("button", { name: /Frozen Quiz — learner/ })); await screen.findByText("Frozen essay"); }
async function save(id: string, value: string) { fireEvent.change(screen.getByLabelText(`Points for ${id}`), { target: { value } }); fireEvent.click(screen.getByRole("button", { name: `Save grade for ${id}` })); await waitFor(() => expect(screen.getByRole("button", { name: `Save grade for ${id}` }).matches(":disabled")).toBe(false)); }
describe("actual native review panel", () => {
  it("makes no network requests on mount; explicit open scopes mutation-only queue and detail", async () => {
    render(<Course360NativeQuizReviewPanel {...props} />); expect(state.list).not.toHaveBeenCalled(); expect(state.get).not.toHaveBeenCalled(); expect(screen.queryByRole("dialog")).toBeNull();
    await open(); expect(state.list).toHaveBeenCalledWith({ orgId: 9, quizId: 44, limit: 50 }); await select(); expect(state.get).toHaveBeenCalledWith({ orgId: 9, quizId: 44, attemptId: 100 }); expect(screen.getByText("Frozen rubric: Frozen rubric")).toBeTruthy(); expect(screen.getByText("Learner answer", { selector: "pre" })).toBeTruthy();
  });
  it("sends bounded question points/revision only, never browser totals/pass or learner answers", async () => {
    render(<Course360NativeQuizReviewPanel {...props} />); await open(); await select();
    fireEvent.change(screen.getByLabelText("Feedback for essay"), { target: { value: "Saved feedback" } }); await save("essay", ".25");
    const input = state.grade.mock.calls[0][0]; expect(input).toMatchObject({ ...props, attemptId: 100, questionId: "essay", points: .25, expectedReviewRevision: 0, feedback: "Saved feedback" }); expect(input.operationId.length).toBeGreaterThan(12);
    for (const key of ["score", "passed", "totalPoints", "earnedPoints", "answers"]) expect(input).not.toHaveProperty(key);
    expect(screen.getByText("Awaiting instructor review / explicit release", { exact: false })).toBeTruthy(); expect(screen.getByRole("button", { name: "Release final result" }).matches(":disabled")).toBe(true); expect(state.release).not.toHaveBeenCalled();
  });
  it.each(["", "-1", ".501"])("blocks invalid point draft %s before mutation", async value => { render(<Course360NativeQuizReviewPanel {...props} />); await open(); await select(); await save("essay", value); expect(state.grade).not.toHaveBeenCalled(); expect(screen.getByRole("alert").textContent).toContain("between 0 and 0.5"); });
  it("preserves other unsaved question drafts and requires all saved grades plus explicit consent to release", async () => {
    render(<Course360NativeQuizReviewPanel {...props} />); await open(); await select();
    fireEvent.change(screen.getByLabelText("Points for short"), { target: { value: ".75" } }); fireEvent.change(screen.getByLabelText("Feedback for short"), { target: { value: "Unsaved retained draft" } });
    await save("essay", ".5"); expect((screen.getByLabelText("Points for short") as HTMLInputElement).value).toBe(".75"); expect((screen.getByLabelText("Feedback for short") as HTMLTextAreaElement).value).toBe("Unsaved retained draft");
    await save("short", ".75"); expect(screen.getByText(/Server draft: 1.25 \/ 1.5/)).toBeTruthy(); const button = screen.getByRole("button", { name: "Release final result" }); expect(button.matches(":disabled")).toBe(true); expect(state.release).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(button); await screen.findByText(/Released result: 1.25 \/ 1.5/); expect(state.release.mock.calls[0][0]).toMatchObject({ ...props, attemptId: 100, expectedReviewRevision: 2 }); expect(state.release.mock.calls[0][0]).not.toHaveProperty("passed"); expect(screen.getByText(/Learner completion remains a separate action/)).toBeTruthy(); expect(screen.queryByRole("button", { name: "Release final result" })).toBeNull(); expect(screen.queryByRole("button", { name: /Frozen Quiz — learner/ })).toBeNull();
  });
  it("failed grade retains exact operation ID and payload on retry rather than inventing another grade", async () => {
    state.grade.mockRejectedValueOnce(new Error("Connection dropped")); render(<Course360NativeQuizReviewPanel {...props} />); await open(); await select(); await save("essay", ".25"); await screen.findByRole("alert"); const first = state.grade.mock.calls[0][0];
    fireEvent.change(screen.getByLabelText("Points for essay"), { target: { value: ".5" } }); fireEvent.click(screen.getByRole("button", { name: "Retry exact request" })); await screen.findByText("Saved 0.25 points by reviewer #7"); expect(state.grade.mock.calls[1][0]).toEqual(first);
  });
  it("stale revision error retains draft and explicit reload gets authoritative revision", async () => {
    state.grade.mockRejectedValueOnce(new Error("Review changed in another session. Reload before grading or releasing.")); render(<Course360NativeQuizReviewPanel {...props} />); await open(); await select(); await save("essay", ".25"); expect((screen.getByLabelText("Points for essay") as HTMLInputElement).value).toBe(".25"); expect(screen.getByRole("alert").textContent).toContain("Reload");
    state.detail = { ...state.detail, reviewRevision: 4 }; fireEvent.click(screen.getByRole("button", { name: "Reload saved review" })); await screen.findByText(/Review revision 4/); expect(screen.queryByRole("button", { name: "Retry exact request" })).toBeNull();
  });
  it("scope changes unmount old detail and late school A responses cannot disclose into school B", async () => {
    let resolve: (value: any) => void = () => {}; state.get.mockImplementation(() => new Promise(r => { resolve = r; }));
    const view = render(<Course360NativeQuizReviewPanel {...props} />); await open(); fireEvent.click(screen.getByRole("button", { name: /Frozen Quiz — learner/ })); await waitFor(() => expect(state.get).toHaveBeenCalledTimes(1));
    view.rerender(<Course360NativeQuizReviewPanel orgId={10} quizId={45} />); await act(async () => resolve(state.detail)); expect(screen.queryByText("Learner answer")).toBeNull(); expect(screen.queryByRole("dialog")).toBeNull(); expect(state.list).toHaveBeenCalledTimes(1);
  });
  it("closing while detail request is pending does not reveal late content", async () => {
    let resolve: (value: any) => void = () => {}; state.get.mockImplementation(() => new Promise(r => { resolve = r; })); render(<Course360NativeQuizReviewPanel {...props} />); await open(); fireEvent.click(screen.getByRole("button", { name: /Frozen Quiz — learner/ })); fireEvent.click(screen.getByRole("button", { name: "Close review" })); await act(async () => resolve(state.detail)); expect(screen.queryByRole("dialog")).toBeNull(); expect(screen.queryByText("Learner answer")).toBeNull();
  });
  it("renders frozen learner/rubric text without executing markup", async () => {
    state.detail.questions[0].answer = "<script>unsafe()</script>"; state.detail.questions[0].rubric = "<img src=x onerror=unsafe()>";
    const view = render(<Course360NativeQuizReviewPanel {...props} />); await open(); await select(); expect(screen.getByText("<script>unsafe()</script>")).toBeTruthy(); expect(view.container.querySelector("script,img")).toBeNull();
  });
  it("double-click grading sends one request and retains its successful server revision", async () => {
    let resolve: (value: any) => void = () => {}; state.grade.mockImplementation(() => new Promise(r => { resolve = r; }));
    render(<Course360NativeQuizReviewPanel {...props} />); await open(); await select(); fireEvent.change(screen.getByLabelText("Points for essay"), { target: { value: ".25" } }); const button = screen.getByRole("button", { name: "Save grade for essay" }); fireEvent.click(button); fireEvent.click(button); expect(state.grade).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ ...state.detail, reviewRevision: 1, questions: state.detail.questions.map((q: any) => q.id === "essay" ? { ...q, review: { points: .25, feedback: "", reviewer: { userId: 7 } } } : q) })); await screen.findByText(/Review revision 1/);
  });
  it("queue failure displays denied access without any detail or automatic retries", async () => {
    state.list.mockRejectedValue(new Error("Select an active school before using this app.")); render(<Course360NativeQuizReviewPanel {...props} />); fireEvent.click(screen.getByRole("button", { name: "Review enrolled quizzes" })); await screen.findByRole("alert"); expect(state.list).toHaveBeenCalledTimes(1); expect(state.get).not.toHaveBeenCalled(); expect(screen.queryByText("Learner answer")).toBeNull();
  });
  it("next queue page uses server cursor, optional all-quiz scope omits quizId", async () => {
    state.queue.nextCursor = 100; render(<Course360NativeQuizReviewPanel orgId={9} />); await open(); state.list.mockResolvedValueOnce({ ...state.queue, items: [], nextCursor: null }); fireEvent.click(screen.getByRole("button", { name: "Load more attempts" })); await waitFor(() => expect(state.list).toHaveBeenCalledTimes(2)); expect(state.list.mock.calls[1][0]).toEqual({ orgId: 9, limit: 50, cursor: 100 });
  });
});
