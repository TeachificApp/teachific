export type EmbeddedLearnerQuizAccessInput = {
  lessonType: string;
  isStaffPreview: boolean;
  isPublished: boolean;
  isPreviewLesson: boolean;
  enrollmentStatus?: "active" | "completed" | "cancelled" | "expired" | "suspended";
  enrollmentType?: "full" | "free_preview";
  accessExpiresAt?: Date | null;
  now?: number;
};

/**
 * Applies the learner-facing eligibility rules only after the caller has verified
 * the course, lesson, quiz, and organization linkage. Staff access is restricted
 * by the caller to administrators of the owning organization.
 */
export function canOpenEmbeddedLearnerQuiz(input: EmbeddedLearnerQuizAccessInput) {
  if (![
    "quiz",
    "exam",
  ].includes(input.lessonType)) return false;
  if (input.isStaffPreview) return true;
  if (!input.isPublished) return false;
  if (input.isPreviewLesson) return true;
  if (!input.enrollmentStatus || !["active", "completed"].includes(input.enrollmentStatus)) return false;
  if (input.enrollmentType === "free_preview") return false;
  const now = input.now ?? Date.now();
  return !input.accessExpiresAt || input.accessExpiresAt.getTime() >= now;
}
