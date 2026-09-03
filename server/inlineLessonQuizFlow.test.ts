import { describe, expect, it } from "vitest";
import {
  evaluateInlineLessonQuizCompletion,
  getVisibleInlineLessonQuizQuestionIndexes,
} from "../shared/inlineLessonQuizFlow";

describe("Course360 inline lesson CME survey flow", () => {
  const questions = [
    { id: "attend", type: "survey_choice" },
    { id: "why", type: "open_text", showWhen: { parentQuestionKey: "attend", expectedAnswer: "No" } },
  ];

  it("fails closed for a dependent question until its earlier answer matches", () => {
    expect(getVisibleInlineLessonQuizQuestionIndexes(questions, {})).toEqual([0]);
    expect(getVisibleInlineLessonQuizQuestionIndexes(questions, { attend: "No" })).toEqual([0, 1]);
  });

  it("requires responses for each visible item when configured as a completion survey", () => {
    expect(evaluateInlineLessonQuizCompletion({
      questions,
      responses: [{ questionKey: "attend", answerValue: "No" }],
      scorePassed: false,
      requireSurveyCompletion: true,
    }).passed).toBe(false);
    expect(evaluateInlineLessonQuizCompletion({
      questions,
      responses: [
        { questionKey: "attend", answerValue: "No" },
        { questionKey: "why", answerValue: "Scheduling" },
      ],
      scorePassed: false,
      requireSurveyCompletion: true,
    }).passed).toBe(true);
  });
});
