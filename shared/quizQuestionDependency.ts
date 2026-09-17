export type QuizQuestionDependency = {
  parentQuestionId: string;
  expectedAnswer: string;
};

export type DependentQuizQuestion = {
  id: string | number;
  type?: string;
  order?: number;
  showWhen?: QuizQuestionDependency | null;
};

/** Match a saved dependency against a raw learner answer without trusting UI visibility. */
export function matchesQuestionDependency(
  dependency: QuizQuestionDependency | undefined | null,
  rawParentAnswer: unknown,
): boolean {
  if (!dependency) return true;
  if (!dependency.parentQuestionId || !dependency.expectedAnswer) return false;
  if (Array.isArray(rawParentAnswer)) {
    return rawParentAnswer.map(String).includes(dependency.expectedAnswer);
  }
  if (typeof rawParentAnswer === "boolean" || typeof rawParentAnswer === "number") {
    return String(rawParentAnswer) === dependency.expectedAnswer;
  }
  return typeof rawParentAnswer === "string" && rawParentAnswer === dependency.expectedAnswer;
}

/**
 * Filter conditional questions using the saved quiz definition and supplied raw
 * answers. Dependencies are recursively evaluated so shuffled delivery cannot
 * expose a child before its own parent condition is satisfied.
 */
export function filterVisibleDependentQuestions<T extends DependentQuizQuestion>(
  questions: T[],
  answers: Record<string, unknown>,
): T[] {
  const questionById = new Map(questions.map(question => [String(question.id), question]));

  const isVisible = (question: T, visiting = new Set<string>()): boolean => {
    const dependency = question.showWhen;
    if (!dependency) return true;
    const questionId = String(question.id);
    if (visiting.has(questionId)) return false;
    const parent = questionById.get(dependency.parentQuestionId);
    if (!parent) return false;
    const nextVisiting = new Set(visiting).add(questionId);
    return isVisible(parent, nextVisiting)
      && matchesQuestionDependency(dependency, answers[dependency.parentQuestionId]);
  };

  return questions.filter(question => isVisible(question));
}

/** Validate safe, acyclic, same-quiz conditional question dependencies at save time. */
export function validateQuizQuestionDependencies(questionsJson: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(questionsJson);
  } catch {
    return "Quiz questions could not be read.";
  }
  if (!Array.isArray(parsed)) return "Quiz questions must be an array.";

  const questions = parsed as DependentQuizQuestion[];
  const questionIndex = new Map<string, number>();
  for (const [index, question] of questions.entries()) {
    const id = typeof question?.id === "string" || typeof question?.id === "number" ? String(question.id).trim() : "";
    if (!id || questionIndex.has(id)) return "Quiz questions must have unique identifiers.";
    questionIndex.set(id, index);
  }

  for (const [index, question] of questions.entries()) {
    const dependency = question?.showWhen;
    if (dependency == null) continue;
    if (typeof dependency !== "object") return "Question visibility rules must be valid.";
    const parentQuestionId = typeof dependency.parentQuestionId === "string" ? dependency.parentQuestionId.trim() : "";
    const expectedAnswer = typeof dependency.expectedAnswer === "string" ? dependency.expectedAnswer.trim() : "";
    const parentIndex = questionIndex.get(parentQuestionId);
    if (!parentQuestionId || !expectedAnswer || parentIndex === undefined) {
      return "A conditional question must reference an earlier question in this quiz and one expected answer.";
    }
    if (parentIndex >= index) {
      return "A conditional question must reference an earlier question in this quiz.";
    }
    const parent = questions[parentIndex];
    if (!parent || !["mcq", "image_choice", "tf"].includes(parent.type ?? "")) {
      return "Conditional questions can depend only on an earlier multiple-choice, image-choice, or true/false question.";
    }
  }

  return null;
}
