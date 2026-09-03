import { describe, expect, it } from "vitest";
import { getMockExamReviewSummary, shouldOpenMockExamReview, toggleMockExamFlag } from "../shared/mockExamFlow";

describe("Course360 mock-exam learner flow", () => {
  const questions = [{ id: "q1" }, { id: "q2" }, { id: "q3" }];

  it("requires review before final scoring only in enabled mock-exam mode at the end of an attempt", () => {
    expect(shouldOpenMockExamReview(false, true)).toBe(false);
    expect(shouldOpenMockExamReview(true, false)).toBe(false);
    expect(shouldOpenMockExamReview(true, true)).toBe(true);
  });

  it("toggles flags without changing learner answers and presents review status for every question", () => {
    const onceFlagged = toggleMockExamFlag({}, "q2");
    const summary = getMockExamReviewSummary(questions, { q1: "answer", q3: false }, onceFlagged);
    expect(onceFlagged).toEqual({ q2: true });
    expect(summary.answeredCount).toBe(2);
    expect(summary.flaggedCount).toBe(1);
    expect(summary.questions).toEqual([
      { id: "q1", index: 0, answered: true, flagged: false },
      { id: "q2", index: 1, answered: false, flagged: true },
      { id: "q3", index: 2, answered: true, flagged: false },
    ]);
    expect(toggleMockExamFlag(onceFlagged, "q2")).toEqual({});
  });
});
