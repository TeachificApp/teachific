import {
  evaluateInlineLessonQuizCompletion,
  getVisibleInlineLessonQuizQuestionIndexes,
  inlineLessonQuizQuestionKey,
  type InlineLessonQuizFlowQuestion,
  type InlineLessonQuizFlowResponse,
} from "../../shared/inlineLessonQuizFlow";

const NON_SCORING_SURVEY_QUESTION_TYPES = new Set([
  "mcq", "truefalse", "multiselect", "hotspot", "matching",
  "likert", "star_rating", "open_text", "survey_choice",
]);

export type InlineLessonSurveyResponseInput = {
  questionKey: string;
  answerValue: string | number | string[] | null;
};

export type StoredInlineLessonQuizQuestion = InlineLessonQuizFlowQuestion & {
  question: string;
  options?: string[];
  correctAnswer?: unknown;
  starMax?: number;
};

export type StoredInlineLessonQuizBlock = {
  id: string;
  data: {
    questions: StoredInlineLessonQuizQuestion[];
    isSurvey: boolean;
    requireSurveyCompletion: boolean;
    requirePassToComplete: boolean;
    passingScore: number;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedText(value: unknown, maxLength: number) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 && text.length <= maxLength ? text : null;
}

function parseQuestion(raw: unknown): StoredInlineLessonQuizQuestion | null {
  if (!isRecord(raw)) return null;
  const question = boundedText(raw.question ?? raw.stem, 10_000);
  if (!question) return null;
  const type = boundedText(raw.type, 32) ?? "mcq";
  const options = Array.isArray(raw.options)
    ? raw.options.map((option) => boundedText(option, 1_000)).filter((option): option is string => !!option).slice(0, 100)
    : undefined;
  const starMaxCandidate = Number(raw.starMax);
  return {
    id: boundedText(raw.id, 128) ?? undefined,
    type,
    question,
    options,
    correctAnswer: raw.correctAnswer,
    required: raw.required === true,
    surveyRequired: raw.surveyRequired === true,
    showWhen: isRecord(raw.showWhen)
      ? {
          parentQuestionKey: boundedText(raw.showWhen.parentQuestionKey, 128) ?? undefined,
          expectedAnswer: boundedText(raw.showWhen.expectedAnswer, 1_000) ?? undefined,
        }
      : null,
    matchingPairs: Array.isArray(raw.matchingPairs)
      ? raw.matchingPairs.map((pair) => isRecord(pair) ? { id: boundedText(pair.id, 128) ?? undefined } : null).filter((pair): pair is { id?: string } => !!pair)
      : undefined,
    starMax: Number.isInteger(starMaxCandidate) && starMaxCandidate >= 1 && starMaxCandidate <= 10
      ? starMaxCandidate
      : undefined,
  };
}

/**
 * Parse a lesson's persisted blocks defensively. Client data can identify one block,
 * but question text, type, completion rules, and scoring all come from this result.
 */
export function getStoredInlineLessonQuizBlock(
  contentBlocks: string | null | undefined,
  quizBlockId: string,
): StoredInlineLessonQuizBlock | null {
  if (!contentBlocks || !quizBlockId) return null;
  let blocks: unknown;
  try {
    blocks = JSON.parse(contentBlocks);
  } catch {
    return null;
  }
  if (!Array.isArray(blocks)) return null;
  const rawBlock = blocks.find((block) => isRecord(block) && block.type === "lesson_quiz" && String(block.id ?? "") === quizBlockId);
  if (!isRecord(rawBlock) || !isRecord(rawBlock.data) || !Array.isArray(rawBlock.data.questions)) return null;
  const questions = rawBlock.data.questions.map(parseQuestion);
  if (questions.some((question) => !question) || questions.length === 0) return null;
  const passingScoreCandidate = Number(rawBlock.data.passingScore);
  return {
    id: quizBlockId,
    data: {
      questions: questions as StoredInlineLessonQuizQuestion[],
      isSurvey: rawBlock.data.isSurvey === true,
      requireSurveyCompletion: rawBlock.data.requireSurveyCompletion === true,
      requirePassToComplete: rawBlock.data.requirePassToComplete !== false,
      passingScore: Number.isFinite(passingScoreCandidate)
        ? Math.max(0, Math.min(100, Math.round(passingScoreCandidate)))
        : 70,
    },
  };
}

/** Identify every stored inline lesson quiz that becomes completion-required when CME is enabled. */
export function getRequiredCmeSurveyBlockIds(contentBlocks: string | null | undefined) {
  if (!contentBlocks) return [] as string[];
  let blocks: unknown;
  try {
    blocks = JSON.parse(contentBlocks);
  } catch {
    return [];
  }
  if (!Array.isArray(blocks)) return [];
  return blocks.flatMap((block) => {
    if (!isRecord(block) || block.type !== "lesson_quiz" || !isRecord(block.data) || block.data.requireSurveyCompletion !== true) {
      return [];
    }
    const id = boundedText(block.id, 128);
    return id ? [id] : [];
  });
}

/** Detect settings that are available only to CME-enabled organizations. */
export function hasCmeOnlyInlineSurveyConfiguration(contentBlocks: string | null | undefined) {
  if (!contentBlocks) return false;
  let blocks: unknown;
  try {
    blocks = JSON.parse(contentBlocks);
  } catch {
    return false;
  }
  if (!Array.isArray(blocks)) return false;
  return blocks.some((block) => {
    if (!isRecord(block) || block.type !== "lesson_quiz" || !isRecord(block.data)) return false;
    if (block.data.isSurvey === true || block.data.requireSurveyCompletion === true) return true;
    return Array.isArray(block.data.questions) && block.data.questions.some((question) =>
      isRecord(question) && ["likert", "star_rating", "open_text", "survey_choice"].includes(String(question.type)),
    );
  });
}

/** Survey blocks must use a response type that the legacy learner player renders without graded feedback. */
export function hasUnsupportedNonScoringSurveyQuestionType(contentBlocks: string | null | undefined) {
  if (!contentBlocks) return false;
  let blocks: unknown;
  try {
    blocks = JSON.parse(contentBlocks);
  } catch {
    return false;
  }
  if (!Array.isArray(blocks)) return false;
  return blocks.some((block) => {
    if (!isRecord(block) || block.type !== "lesson_quiz" || !isRecord(block.data) || block.data.isSurvey !== true) return false;
    return !Array.isArray(block.data.questions) || block.data.questions.some((question) =>
      !isRecord(question) || !NON_SCORING_SURVEY_QUESTION_TYPES.has(String(question.type ?? "mcq")),
    );
  });
}

export function normalizeInlineLessonSurveyResponses(
  questions: StoredInlineLessonQuizQuestion[],
  responses: InlineLessonSurveyResponseInput[],
) {
  const knownKeys = new Set(questions.map((question, index) => inlineLessonQuizQuestionKey(question, index)));
  const normalized = new Map<string, InlineLessonSurveyResponseInput>();
  for (const response of responses) {
    if (!knownKeys.has(response.questionKey) || normalized.has(response.questionKey)) return null;
    normalized.set(response.questionKey, response);
  }
  const answerByQuestionKey = Object.fromEntries(
    [...normalized.entries()].map(([key, response]) => [key, response.answerValue]),
  );
  const visibleIndexes = getVisibleInlineLessonQuizQuestionIndexes(questions, answerByQuestionKey);
  const visibleKeys = new Set(visibleIndexes.map((index) => inlineLessonQuizQuestionKey(questions[index], index)));
  if ([...normalized.keys()].some((key) => !visibleKeys.has(key))) return null;
  return visibleIndexes.map((index) => {
    const question = questions[index];
    const key = inlineLessonQuizQuestionKey(question, index);
    return {
      question,
      questionKey: key,
      answerValue: normalized.get(key)?.answerValue ?? null,
    };
  });
}

function answersMatch(actual: unknown, expected: unknown) {
  if (Array.isArray(actual)) {
    return actual.map(String).sort().join("\u0000") === (Array.isArray(expected) ? expected : [expected]).map(String).sort().join("\u0000");
  }
  return actual !== null && actual !== undefined && String(actual) === String(expected ?? "");
}

export function evaluateStoredInlineLessonQuizSubmission(input: {
  block: StoredInlineLessonQuizBlock;
  responses: Array<{ question: StoredInlineLessonQuizQuestion; questionKey: string; answerValue: string | number | string[] | null }>;
  cmeEnabled: boolean;
}) {
  const flowResponses: InlineLessonQuizFlowResponse[] = input.responses.map((response) => ({
    questionKey: response.questionKey,
    answerValue: response.answerValue,
  }));
  const cmeRequiredSurvey = input.cmeEnabled && input.block.data.requireSurveyCompletion;
  const nonScoringSurvey = input.block.data.isSurvey || cmeRequiredSurvey;
  const score = nonScoringSurvey
    ? 0
    : Math.round((input.responses.filter((response) => answersMatch(response.answerValue, response.question.correctAnswer)).length / input.responses.length) * 100);
  const scorePassed = !input.block.data.requirePassToComplete || score >= input.block.data.passingScore;
  return {
    ...evaluateInlineLessonQuizCompletion({
      questions: input.block.data.questions,
      responses: flowResponses,
      scorePassed,
      nonScoringSurvey,
      requireSurveyCompletion: cmeRequiredSurvey,
    }),
    score,
  };
}

export function serializeInlineLessonSurveyAnswer(value: InlineLessonSurveyResponseInput["answerValue"]) {
  return Array.isArray(value) ? JSON.stringify(value) : value === null ? null : String(value);
}
