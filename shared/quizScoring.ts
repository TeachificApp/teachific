import { gradeImageLabelingAnswer } from "./imageLabeling";
import { filterVisibleDependentQuestions, type QuizQuestionDependency } from "./quizQuestionDependency";

export type PublicQuizScoringQuestion = {
  id: string | number;
  type?: string;
  points?: number;
  data?: Record<string, any> | null;
  showWhen?: QuizQuestionDependency | null;
};

export type PublicQuizAttemptScore = {
  earnedPoints: number;
  totalPoints: number;
  scorePercent: number;
};

function pointsFor(question: PublicQuizScoringQuestion): number {
  const points = Number(question.points);
  return Number.isFinite(points) && points >= 0 ? points : 1;
}

function sameValues(left: unknown, right: unknown): boolean {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  return [...left].map(String).sort().join("\u0000") === [...right].map(String).sort().join("\u0000");
}

function objectAnswer(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringAnswer(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function answerIsCorrect(question: PublicQuizScoringQuestion, answer: unknown): boolean {
  const data = question.data ?? {};
  switch (question.type) {
    case "mcq":
    case "image_choice": {
      const correctChoiceIds = Array.isArray(data.choices)
        ? data.choices.filter((choice: any) => choice?.correct === true).map((choice: any) => choice.id)
        : [];
      return correctChoiceIds.length > 0 && sameValues(correctChoiceIds, answer);
    }
    case "tf":
      return typeof data.correct === "boolean" && answer === data.correct;
    case "matching": {
      const submitted = objectAnswer(answer);
      return Array.isArray(data.pairs) && data.pairs.length > 0
        && data.pairs.every((pair: any) => submitted[String(pair.id)] === pair.id);
    }
    case "fill_blank": {
      const submitted = objectAnswer(answer);
      return Array.isArray(data.blanks) && data.blanks.length > 0 && data.blanks.every((blank: any) => {
        const submittedValue = stringAnswer(submitted[String(blank.id)]).trim();
        return Array.isArray(blank.acceptedAnswers) && blank.acceptedAnswers.some((accepted: unknown) => {
          const expected = String(accepted).trim();
          return blank.caseSensitive
            ? submittedValue === expected
            : submittedValue.toLocaleLowerCase() === expected.toLocaleLowerCase();
        });
      });
    }
    case "ordering":
      return Array.isArray(data.items) && data.items.length > 0
        && Array.isArray(answer)
        && answer.length === data.items.length
        && answer.every((itemId, index) => itemId === data.items[index]?.id);
    case "numeric": {
      const submitted = Number(answer);
      if (!Number.isFinite(submitted)) return false;
      if (data.allowRange && data.rangeMin != null && data.rangeMax != null) {
        return submitted >= Number(data.rangeMin) && submitted <= Number(data.rangeMax);
      }
      const expected = Number(data.correctValue);
      const tolerance = Number(data.tolerance ?? 0);
      return Number.isFinite(expected) && Number.isFinite(tolerance) && Math.abs(submitted - expected) <= tolerance;
    }
    case "dropdown": {
      const submitted = objectAnswer(answer);
      return Array.isArray(data.blanks) && data.blanks.length > 0
        && data.blanks.every((blank: any) => Number(submitted[String(blank.id)]) === Number(blank.correctIndex));
    }
    case "drag_words": {
      const submitted = objectAnswer(answer);
      return Array.isArray(data.blanks) && data.blanks.length > 0
        && data.blanks.every((blank: any) => submitted[String(blank.id)] === blank.correctWord);
    }
    case "image_labeling":
      return Array.isArray(data.targets) && data.targets.length > 0
        && gradeImageLabelingAnswer(data.targets, objectAnswer(answer) as Record<string, string>);
    default:
      return false;
  }
}

/** Score a public Quiz Creator attempt solely from saved quiz questions and raw learner answers. */
export function scorePublicQuizAttempt(
  questions: PublicQuizScoringQuestion[],
  answers: Record<string, unknown>,
): PublicQuizAttemptScore {
  const visibleQuestions = filterVisibleDependentQuestions(questions, answers);
  const totalPoints = visibleQuestions.reduce((total, question) => total + pointsFor(question), 0);
  const earnedPoints = visibleQuestions.reduce(
    (total, question) => total + (answerIsCorrect(question, answers[String(question.id)]) ? pointsFor(question) : 0),
    0,
  );
  const scorePercent = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 10_000) / 100 : 0;
  return { earnedPoints, totalPoints, scorePercent };
}
