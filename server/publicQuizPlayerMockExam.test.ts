// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const submitAttempt = vi.fn();

vi.mock("wouter", () => ({
  useParams: () => ({ shareToken: "mock-exam-token" }),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    quizMaker: {
      getPublishedQuiz: {
        useQuery: () => ({
          data: {
            id: 55,
            title: "Mock exam",
            description: "Review responses before scoring.",
            questions: [
              { id: "q1", type: "tf", order: 0, points: 1, required: false, stem: "First question", data: { correct: true } },
              { id: "q2", type: "tf", order: 1, points: 1, required: false, stem: "Second question", data: { correct: false } },
            ],
            passingScore: 70,
            timeLimit: null,
            maxAttempts: null,
            shuffleQuestions: false,
            shuffleAnswers: false,
            showFeedbackImmediately: true,
            showCorrectAnswers: true,
            mockExamEnabled: true,
          },
          isLoading: false,
          error: null,
        }),
      },
      getQuizBranding: { useQuery: () => ({ data: null }) },
      getStaffPreviewQuiz: { useQuery: () => ({ data: null, isLoading: false, error: null }) },
      submitAttempt: { useMutation: () => ({ mutate: submitAttempt }) },
    },
  },
}));

import PublicQuizPlayerPage from "../client/src/pages/PublicQuizPlayerPage";

describe("Course360 public mock-exam delivery", () => {
  beforeEach(() => submitAttempt.mockReset());

  it("enters review, returns to a selected flagged question, preserves the flag, and submits only from final review", async () => {
    const user = userEvent.setup();
    render(createElement(PublicQuizPlayerPage));

    await user.click(screen.getByRole("button", { name: "Start Quiz" }));
    expect(screen.getByText("First question")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Flag question" }));
    expect(screen.getByRole("button", { name: "Flagged" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Second question")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Review answers" }));
    expect(screen.getByRole("heading", { name: "Review your responses" })).toBeTruthy();
    expect(submitAttempt).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Review question 1, unanswered, flagged" }));
    expect(screen.getByText("First question")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Flagged" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Review answers" }));
    await user.click(screen.getByRole("button", { name: "Submit for final scoring" }));

    expect(submitAttempt).toHaveBeenCalledTimes(1);
    expect(submitAttempt).toHaveBeenCalledWith(expect.objectContaining({
      shareToken: "mock-exam-token",
      answersJson: "{}",
    }));
    expect(screen.getByText("Not Quite")).toBeTruthy();
  });
});
