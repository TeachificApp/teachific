import { describe, expect, it } from "vitest";
import {
  evaluateStoredInlineLessonQuizSubmission,
  hasUnsupportedNonScoringSurveyQuestionType,
  getRequiredCmeSurveyBlockIds,
  getStoredInlineLessonQuizBlock,
  normalizeInlineLessonSurveyResponses,
} from "./lib/inlineLessonCmeSurvey";

const contentBlocks = JSON.stringify([
  {
    id: "cme-feedback",
    type: "lesson_quiz",
    data: {
      isSurvey: true,
      requireSurveyCompletion: true,
      questions: [
        { id: "recommend", type: "survey_choice", question: "Would you recommend this course?", options: ["Yes", "No"], surveyRequired: true },
        { id: "reason", type: "open_text", question: "Why?", surveyRequired: true, showWhen: { parentQuestionKey: "recommend", expectedAnswer: "No" } },
      ],
    },
  },
]);

describe("Course360 stored inline CME lesson surveys", () => {
  it("derives required survey blocks from persisted lesson data only", () => {
    expect(getRequiredCmeSurveyBlockIds(contentBlocks)).toEqual(["cme-feedback"]);
    expect(getRequiredCmeSurveyBlockIds("not-json")).toEqual([]);
  });

  it("rejects client responses for unknown or invisible stored questions", () => {
    const block = getStoredInlineLessonQuizBlock(contentBlocks, "cme-feedback");
    expect(block).not.toBeNull();
    expect(normalizeInlineLessonSurveyResponses(block!.data.questions, [
      { questionKey: "recommend", answerValue: "Yes" },
      { questionKey: "reason", answerValue: "made up hidden answer" },
    ])).toBeNull();
    expect(normalizeInlineLessonSurveyResponses(block!.data.questions, [
      { questionKey: "untrusted", answerValue: "Yes" },
    ])).toBeNull();
  });

  it("enforces required responses only when the owning organization has CME enabled", () => {
    const block = getStoredInlineLessonQuizBlock(contentBlocks, "cme-feedback");
    const responses = normalizeInlineLessonSurveyResponses(block!.data.questions, [
      { questionKey: "recommend", answerValue: "No" },
    ]);
    expect(responses).not.toBeNull();
    expect(evaluateStoredInlineLessonQuizSubmission({ block: block!, responses: responses!, cmeEnabled: true }))
      .toMatchObject({ requiresSurveyCompletion: true, surveyCompleted: false, passed: false });
    expect(evaluateStoredInlineLessonQuizSubmission({ block: block!, responses: responses!, cmeEnabled: false }))
      .toMatchObject({ requiresSurveyCompletion: false, passed: true });
  });

  it("uses stored question text and types rather than accepting client snapshots", () => {
    const block = getStoredInlineLessonQuizBlock(contentBlocks, "cme-feedback");
    const responses = normalizeInlineLessonSurveyResponses(block!.data.questions, [
      { questionKey: "recommend", answerValue: "Yes" },
    ]);
    expect(responses?.[0]).toMatchObject({
      questionKey: "recommend",
      question: { question: "Would you recommend this course?", type: "survey_choice" },
    });
  });

  it("records every legacy inline response type without calculating grades when survey mode is enabled", () => {
    const feedbackBlock = getStoredInlineLessonQuizBlock(JSON.stringify([{
      id: "ungraded-feedback",
      type: "lesson_quiz",
      data: {
        isSurvey: true,
        requireSurveyCompletion: false,
        questions: [
          { id: "choice", type: "mcq", question: "Choice", options: ["A", "B"], correctAnswer: 0 },
          { id: "likert", type: "likert", question: "Scale", options: ["Low", "High"], correctAnswer: "Low" },
          { id: "survey", type: "survey_choice", question: "Survey", options: ["Yes", "No"], correctAnswer: "Yes" },
          { id: "stars", type: "star_rating", question: "Stars", starMax: 5, correctAnswer: 5 },
          { id: "text", type: "open_text", question: "Text", correctAnswer: "Expected" },
        ],
      },
    }]), "ungraded-feedback");
    expect(feedbackBlock).not.toBeNull();
    const responses = normalizeInlineLessonSurveyResponses(feedbackBlock!.data.questions, [
      { questionKey: "choice", answerValue: 1 },
      { questionKey: "likert", answerValue: "High" },
      { questionKey: "survey", answerValue: "No" },
      { questionKey: "stars", answerValue: 2 },
      { questionKey: "text", answerValue: "Different feedback" },
    ]);
    expect(evaluateStoredInlineLessonQuizSubmission({ block: feedbackBlock!, responses: responses!, cmeEnabled: true }))
      .toMatchObject({ nonScoringSurvey: true, requiresSurveyCompletion: false, score: 0, passed: true });
  });

  it("rejects unsupported interactive question types from non-scoring survey blocks before they reach the learner player", () => {
    expect(hasUnsupportedNonScoringSurveyQuestionType(JSON.stringify([{
      id: "supported", type: "lesson_quiz", data: { isSurvey: true, questions: [{ type: "matching", question: "Match" }] },
    }]))).toBe(false);
    expect(hasUnsupportedNonScoringSurveyQuestionType(JSON.stringify([{
      id: "unsupported", type: "lesson_quiz", data: { isSurvey: true, questions: [{ type: "fill_blank", question: "Fill in" }] },
    }]))).toBe(true);
  });
});
