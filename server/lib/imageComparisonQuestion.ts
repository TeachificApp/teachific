type SerializedImageComparisonQuestion = {
  type?: unknown;
  data?: {
    comparisonImageA?: unknown;
    comparisonImageB?: unknown;
    comparisonLabelA?: unknown;
    comparisonLabelB?: unknown;
  };
};

/**
 * Image comparison is a Quiz Creator-only exploratory question. Drafts can
 * omit either image, but the public publication boundary requires two images.
 */
export function validateImageComparisonQuestions(questionsJson: string, requirePublishable = false): string | null {
  let questions: unknown;
  try {
    questions = JSON.parse(questionsJson);
  } catch {
    return "Quiz questions could not be read.";
  }
  if (!Array.isArray(questions)) return "Quiz questions must be an array.";

  for (const rawQuestion of questions) {
    const question = rawQuestion as SerializedImageComparisonQuestion;
    if (question?.type !== "image_comparison") continue;
    if (!question.data || typeof question.data !== "object") {
      return "Image-comparison questions require a comparison configuration.";
    }
    for (const label of [question.data.comparisonLabelA, question.data.comparisonLabelB]) {
      if (label !== undefined && typeof label !== "string") {
        return "Image-comparison image labels must be text.";
      }
    }
    if (requirePublishable && (!isNonEmptyString(question.data.comparisonImageA) || !isNonEmptyString(question.data.comparisonImageB))) {
      return "Add both comparison images before publishing an image-comparison question.";
    }
  }
  return null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
