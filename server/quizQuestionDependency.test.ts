import { describe, expect, it } from "vitest";
import {
  filterVisibleDependentQuestions,
  validateQuizQuestionDependencies,
} from "../shared/quizQuestionDependency";
import { scorePublicQuizAttempt } from "../shared/quizScoring";

const questions = [
  {
    id: "parent",
    order: 0,
    type: "mcq",
    points: 1,
    data: { choices: [{ id: "show", correct: true }, { id: "hide", correct: false }] },
  },
  {
    id: "child",
    order: 1,
    type: "tf",
    points: 5,
    showWhen: { parentQuestionId: "parent", expectedAnswer: "show" },
    data: { correct: true },
  },
];

describe("Course360 conditional Quiz Creator visibility", () => {
  it("filters dependent questions from delivery and server scoring when their parent answer does not match", () => {
    const answers = { parent: ["hide"], child: true };
    expect(filterVisibleDependentQuestions(questions, answers).map(question => question.id)).toEqual(["parent"]);
    expect(scorePublicQuizAttempt(questions, answers)).toEqual({
      earnedPoints: 0,
      totalPoints: 1,
      scorePercent: 0,
    });
  });

  it("includes a dependent question and its points only after its expected answer", () => {
    const answers = { parent: ["show"], child: true };
    expect(filterVisibleDependentQuestions(questions, answers).map(question => question.id)).toEqual(["parent", "child"]);
    expect(scorePublicQuizAttempt(questions, answers)).toEqual({
      earnedPoints: 6,
      totalPoints: 6,
      scorePercent: 100,
    });
  });

  it("rejects missing, later, or unsupported dependency parents at save time", () => {
    expect(validateQuizQuestionDependencies(JSON.stringify([
      { id: "child", type: "tf", showWhen: { parentQuestionId: "missing", expectedAnswer: "yes" } },
    ]))).toContain("earlier question");
    expect(validateQuizQuestionDependencies(JSON.stringify([
      { id: "child", type: "tf", showWhen: { parentQuestionId: "parent", expectedAnswer: "yes" } },
      { id: "parent", type: "mcq" },
    ]))).toContain("earlier question");
    expect(validateQuizQuestionDependencies(JSON.stringify([
      { id: "parent", type: "essay" },
      { id: "child", type: "tf", showWhen: { parentQuestionId: "parent", expectedAnswer: "yes" } },
    ]))).toContain("multiple-choice, image-choice, or true/false");
  });

  it("accepts a same-quiz dependency on an earlier supported question", () => {
    expect(validateQuizQuestionDependencies(JSON.stringify(questions))).toBeNull();
  });
});
