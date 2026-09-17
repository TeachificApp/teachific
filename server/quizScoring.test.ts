import { describe, expect, it } from "vitest";
import { scorePublicQuizAttempt } from "../shared/quizScoring";

describe("scorePublicQuizAttempt", () => {
  const questions = [
    { id: "mc", type: "mcq", points: 2, data: { choices: [{ id: "one", correct: true }, { id: "two", correct: false }] } },
    { id: "blank", type: "fill_blank", points: 3, data: { blanks: [{ id: "b1", acceptedAnswers: ["Course360"], caseSensitive: false }] } },
    { id: "numeric", type: "numeric", points: 4, data: { correctValue: 12, tolerance: 0.5 } },
    { id: "essay", type: "essay", points: 5, data: {} },
  ];

  it("scores answers from the saved question definition and does not auto-grade subjective items", () => {
    expect(scorePublicQuizAttempt(questions, {
      mc: ["one"],
      blank: { b1: "course360" },
      numeric: "12.4",
      essay: "A thoughtful response",
    })).toEqual({ earnedPoints: 9, totalPoints: 14, scorePercent: 64.29 });
  });

  it("rejects malformed or over-selected answer shapes instead of trusting submitted totals", () => {
    expect(scorePublicQuizAttempt(questions, {
      mc: ["one", "two"],
      blank: [],
      numeric: "not-a-number",
    })).toEqual({ earnedPoints: 0, totalPoints: 14, scorePercent: 0 });
  });
});
