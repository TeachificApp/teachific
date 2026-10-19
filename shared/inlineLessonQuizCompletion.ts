type InlineLessonQuizBlock = {
  type?: unknown;
  id?: unknown;
  data?: {
    questions?: unknown;
    isSurvey?: unknown;
    requireSurveyCompletion?: unknown;
    requirePassToComplete?: unknown;
  };
};

function parseBlocks(blocks: unknown): InlineLessonQuizBlock[] {
  if (Array.isArray(blocks)) return blocks as InlineLessonQuizBlock[];
  if (typeof blocks !== "string") return [];
  try {
    const parsed = JSON.parse(blocks);
    return Array.isArray(parsed) ? parsed as InlineLessonQuizBlock[] : [];
  } catch {
    return [];
  }
}

/**
 * A graded inline lesson quiz with its pass requirement enabled owns completion
 * of its lesson. Survey completion remains a separately scoped CME workflow.
 */
export function lessonHasRequiredGradedInlineQuiz(blocks: unknown): boolean {
  return parseBlocks(blocks).some((block) => {
    if (block?.type !== "lesson_quiz" || !block.data || !Array.isArray(block.data.questions) || block.data.questions.length === 0) {
      return false;
    }
    const isSurvey = block.data.isSurvey === true || block.data.requireSurveyCompletion === true;
    return !isSurvey && block.data.requirePassToComplete !== false;
  });
}
