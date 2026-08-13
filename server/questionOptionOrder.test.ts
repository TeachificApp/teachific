import { describe, expect, it } from "vitest";
import {
  buildStandaloneLearnerOptions,
  shouldShuffleQuestionOptions,
} from "./lib/questionOptionOrder";

describe("standalone Quiz Creator answer ordering", () => {
  const choices = ["A", "B", "C", "D"];

  it("preserves authored order when a question locks its answer order", () => {
    expect(buildStandaloneLearnerOptions({
      options: choices,
      quizShuffleAnswers: true,
      lockAnswerOrder: true,
      random: () => 0,
    })).toEqual(choices);
  });

  it("honors an explicit question-level shuffle override over the quiz default", () => {
    expect(shouldShuffleQuestionOptions({ quizDefault: false, questionSetting: true, lockAnswerOrder: false })).toBe(true);
    expect(shouldShuffleQuestionOptions({ quizDefault: true, questionSetting: false, lockAnswerOrder: false })).toBe(false);
  });

  it("shuffles a copy instead of mutating authored choice order", () => {
    const authored = [...choices];
    const output = buildStandaloneLearnerOptions({
      options: authored,
      quizShuffleAnswers: true,
      lockAnswerOrder: false,
      random: () => 0,
    });
    expect(authored).toEqual(choices);
    expect(output).not.toBe(authored);
    expect(output).toEqual(["B", "C", "D", "A"]);
  });
});
