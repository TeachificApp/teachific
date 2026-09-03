export type InlineLessonQuizCondition = {
  parentQuestionKey?: unknown;
  expectedAnswer?: unknown;
};

export type InlineLessonQuizFlowQuestion = {
  id?: unknown;
  type?: unknown;
  required?: unknown;
  surveyRequired?: unknown;
  showWhen?: InlineLessonQuizCondition | null;
  matchingPairs?: Array<{ id?: unknown }>;
};

export type InlineLessonQuizFlowResponse = {
  questionKey?: unknown;
  answerValue?: unknown;
};

export const INLINE_SURVEY_QUESTION_TYPES = new Set([
  "likert",
  "star_rating",
  "open_text",
  "survey_choice",
]);

export function inlineLessonQuizQuestionKey(question: InlineLessonQuizFlowQuestion, index: number) {
  return String(question.id ?? index);
}

function hasResponseValue(value: unknown) {
  return value !== undefined && value !== null && String(value).trim().length > 0;
}

function hasCompletedQuestionResponse(question: InlineLessonQuizFlowQuestion, value: unknown) {
  if (!hasResponseValue(value)) return false;
  if (question.type !== "matching" || !Array.isArray(question.matchingPairs) || question.matchingPairs.length === 0) return true;
  if (typeof value !== "string") return false;
  try {
    const matches = JSON.parse(value);
    if (typeof matches !== "object" || matches === null || Array.isArray(matches)) return false;
    return question.matchingPairs.every((pair, index) => {
      const key = String(pair.id ?? index);
      return hasResponseValue((matches as Record<string, unknown>)[key]);
    });
  } catch {
    return false;
  }
}

/** Dependent questions fail closed unless an earlier parent has the exact expected response. */
export function isInlineLessonQuizQuestionVisible(
  questions: InlineLessonQuizFlowQuestion[],
  questionIndex: number,
  answerByQuestionKey: Record<string, unknown>,
) {
  const question = questions[questionIndex];
  const condition = question?.showWhen;
  if (!condition) return true;
  if (condition.parentQuestionKey === undefined || condition.expectedAnswer === undefined) return false;
  const parentIndex = questions.findIndex((candidate, index) =>
    inlineLessonQuizQuestionKey(candidate, index) === String(condition.parentQuestionKey),
  );
  if (parentIndex < 0 || parentIndex >= questionIndex) return false;
  // A response supplied for an invisible parent must not unlock a later child.
  // Conditions only permit backwards references, so this recursive check remains
  // acyclic while ensuring the whole dependency chain is actually visible.
  if (!isInlineLessonQuizQuestionVisible(questions, parentIndex, answerByQuestionKey)) return false;
  const actualAnswer = answerByQuestionKey[String(condition.parentQuestionKey)];
  return hasResponseValue(actualAnswer) && String(actualAnswer) === String(condition.expectedAnswer);
}

export function getVisibleInlineLessonQuizQuestionIndexes(
  questions: InlineLessonQuizFlowQuestion[],
  answerByQuestionKey: Record<string, unknown>,
) {
  return questions.flatMap((_, index) =>
    isInlineLessonQuizQuestionVisible(questions, index, answerByQuestionKey) ? [index] : [],
  );
}

/** Required unscored surveys are complete only after every visible required item has a response. */
export function hasCompletedRequiredInlineSurvey(
  questions: InlineLessonQuizFlowQuestion[],
  responses: InlineLessonQuizFlowResponse[],
  requireSurveyCompletion: boolean,
) {
  if (!requireSurveyCompletion) return true;
  const answerByQuestionKey = Object.fromEntries(
    responses
      .filter((response) => response?.questionKey !== undefined)
      .map((response) => [String(response.questionKey), response.answerValue]),
  );
  const visibleQuestions = getVisibleInlineLessonQuizQuestionIndexes(questions, answerByQuestionKey)
    .map((index) => ({ question: questions[index], index }));
  const requiredVisibleQuestions = visibleQuestions.filter(({ question }) =>
    question.required === true || question.surveyRequired === true,
  );
  return requiredVisibleQuestions.every(({ question, index }) =>
    hasCompletedQuestionResponse(question, answerByQuestionKey[inlineLessonQuizQuestionKey(question, index)]),
  );
}

export function evaluateInlineLessonQuizCompletion(input: {
  questions: InlineLessonQuizFlowQuestion[];
  responses: InlineLessonQuizFlowResponse[];
  scorePassed: boolean;
  nonScoringSurvey?: boolean;
  requireSurveyCompletion?: boolean;
}) {
  const nonScoringSurvey = input.nonScoringSurvey === true || input.requireSurveyCompletion === true;
  const requiresSurveyCompletion = input.requireSurveyCompletion === true;
  const surveyCompleted = hasCompletedRequiredInlineSurvey(input.questions, input.responses, requiresSurveyCompletion);
  return {
    nonScoringSurvey,
    requiresSurveyCompletion,
    surveyCompleted,
    passed: nonScoringSurvey ? (requiresSurveyCompletion ? surveyCompleted : true) : input.scorePassed,
  };
}
