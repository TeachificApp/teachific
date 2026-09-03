type SerializedImageLabelingQuestion = {
  type?: unknown;
  image?: { url?: unknown } | null;
  data?: {
    labels?: Array<{ id?: unknown; text?: unknown }>;
    targets?: Array<{ id?: unknown; x?: unknown; y?: unknown; labelId?: unknown }>;
  };
};

function isPercent(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

/**
 * Image-labeling remains a Quiz Creator-only type. Drafts may be incomplete,
 * but malformed IDs and mappings are rejected at save time. Publication
 * requires an image, labels, targets, and one unique valid label assignment per target.
 */
export function validateImageLabelingQuestions(questionsJson: string, requirePublishable = false): string | null {
  let questions: unknown;
  try {
    questions = JSON.parse(questionsJson);
  } catch {
    return "Quiz questions could not be read.";
  }
  if (!Array.isArray(questions)) return "Quiz questions must be an array.";

  for (const rawQuestion of questions) {
    const question = rawQuestion as SerializedImageLabelingQuestion;
    if (question?.type !== "image_labeling") continue;
    const labels = question.data?.labels;
    const targets = question.data?.targets;
    if (!Array.isArray(labels) || !Array.isArray(targets)) {
      return "Image-labeling questions require label and target lists.";
    }

    const labelIds = labels.map((label) => typeof label?.id === "string" ? label.id.trim() : "");
    if (labelIds.some((id) => !id) || new Set(labelIds).size !== labelIds.length) {
      return "Image-labeling labels must have unique identifiers.";
    }
    const targetIds = targets.map((target) => typeof target?.id === "string" ? target.id.trim() : "");
    if (targetIds.some((id) => !id) || new Set(targetIds).size !== targetIds.length) {
      return "Image-labeling targets must have unique identifiers.";
    }
    if (targets.some((target) => !isPercent(target?.x) || !isPercent(target?.y))) {
      return "Image-labeling targets must use positions between 0 and 100 percent.";
    }

    if (!requirePublishable) continue;
    if (typeof question.image?.url !== "string" || !question.image.url.trim()) {
      return "Add an image before publishing an image-labeling question.";
    }
    if (labels.length === 0 || targets.length === 0 || labels.some((label) => typeof label?.text !== "string" || !label.text.trim())) {
      return "Image-labeling questions need at least one named label and one target before publishing.";
    }
    const assignedLabelIds = targets.map((target) => typeof target?.labelId === "string" ? target.labelId.trim() : "");
    if (assignedLabelIds.some((labelId) => !labelIds.includes(labelId)) || new Set(assignedLabelIds).size !== assignedLabelIds.length) {
      return "Assign a different available label to every image-labeling target before publishing.";
    }
  }
  return null;
}
