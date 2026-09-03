import { describe, expect, it } from "vitest";
import {
  evaluateInlineLessonQuizCompletion,
  getVisibleInlineLessonQuizQuestionIndexes,
} from "../shared/inlineLessonQuizFlow";

describe("Course360 inline lesson CME survey flow", () => {
  const questions = [
    { id: "attend", type: "survey_choice", surveyRequired: true },
    { id: "why", type: "open_text", surveyRequired: true, showWhen: { parentQuestionKey: "attend", expectedAnswer: "No" } },
  ];

  it("fails closed for a dependent question until its earlier answer matches", () => {
    expect(getVisibleInlineLessonQuizQuestionIndexes(questions, {})).toEqual([0]);
    expect(getVisibleInlineLessonQuizQuestionIndexes(questions, { attend: "No" })).toEqual([0, 1]);
  });

  it("does not let a supplied answer for a hidden parent unlock a later dependent question", () => {
    const chainedQuestions = [
      { id: "attend", type: "survey_choice" },
      { id: "why", type: "open_text", showWhen: { parentQuestionKey: "attend", expectedAnswer: "No" } },
      { id: "follow_up", type: "open_text", showWhen: { parentQuestionKey: "why", expectedAnswer: "Scheduling" } },
    ];
    expect(getVisibleInlineLessonQuizQuestionIndexes(chainedQuestions, {
      attend: "Yes",
      why: "Scheduling",
    })).toEqual([0]);
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

  it("does not require an optional visible survey item", () => {
    expect(evaluateInlineLessonQuizCompletion({
      questions: [
        { id: "required", type: "survey_choice", surveyRequired: true },
        { id: "optional", type: "open_text" },
      ],
      responses: [{ questionKey: "required", answerValue: "Yes" }],
      scorePassed: false,
      requireSurveyCompletion: true,
    }).passed).toBe(true);
  });

  it("allows a non-scoring survey without required completion to save even when a hypothetical quiz score would fail", () => {
    expect(evaluateInlineLessonQuizCompletion({
      questions: [{ id: "feedback", type: "mcq" }],
      responses: [{ questionKey: "feedback", answerValue: 1 }],
      scorePassed: false,
      nonScoringSurvey: true,
      requireSurveyCompletion: false,
    })).toMatchObject({ nonScoringSurvey: true, requiresSurveyCompletion: false, passed: true });
  });

  it("does not treat a partially matched required survey prompt as complete", () => {
    const questions = [{
      id: "matching-feedback",
      type: "matching",
      surveyRequired: true,
      matchingPairs: [{ id: "first" }, { id: "second" }],
    }];
    expect(evaluateInlineLessonQuizCompletion({
      questions,
      responses: [{ questionKey: "matching-feedback", answerValue: JSON.stringify({ first: "A" }) }],
      scorePassed: false,
      nonScoringSurvey: true,
      requireSurveyCompletion: true,
    })).toMatchObject({ surveyCompleted: false, passed: false });
    expect(evaluateInlineLessonQuizCompletion({
      questions,
      responses: [{ questionKey: "matching-feedback", answerValue: JSON.stringify({ first: "A", second: "B" }) }],
      scorePassed: false,
      nonScoringSurvey: true,
      requireSurveyCompletion: true,
    })).toMatchObject({ surveyCompleted: true, passed: true });
  });
});
