export type MockExamQuestion = { id: string };

export function toggleMockExamFlag(flags: Record<string, true>, questionId: string): Record<string, true> {
  const next = { ...flags };
  if (next[questionId]) delete next[questionId];
  else next[questionId] = true;
  return next;
}

export function shouldOpenMockExamReview(mockExamEnabled: boolean, hasReachedFinalQuestion: boolean): boolean {
  return mockExamEnabled && hasReachedFinalQuestion;
}

export function getMockExamReviewSummary(
  questions: MockExamQuestion[],
  answers: Record<string, unknown>,
  flags: Record<string, true>,
) {
  return {
    answeredCount: questions.filter((question) => answers[question.id] !== undefined).length,
    flaggedCount: Object.keys(flags).length,
    questions: questions.map((question, index) => ({
      id: question.id,
      index,
      answered: answers[question.id] !== undefined,
      flagged: Boolean(flags[question.id]),
    })),
  };
}
