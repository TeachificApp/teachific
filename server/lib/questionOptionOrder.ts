/**
 * Preserve an author's answer order unless quiz or question settings explicitly
 * request randomization. The returned array is always a copy, so stored choices
 * and existing attempt snapshots cannot be mutated during learner playback.
 */
export function orderQuestionOptions<T>(
  options: readonly T[],
  shuffleAnswerOptions: boolean,
  random: () => number = Math.random,
): T[] {
  if (!shuffleAnswerOptions) return [...options];

  const ordered = [...options];
  for (let index = ordered.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [ordered[index], ordered[swapIndex]] = [ordered[swapIndex], ordered[index]];
  }
  return ordered;
}

export function shouldShuffleQuestionOptions({
  quizDefault,
  questionSetting,
  lockAnswerOrder,
}: {
  quizDefault: boolean;
  questionSetting?: boolean | null;
  lockAnswerOrder?: boolean | null;
}): boolean {
  if (lockAnswerOrder) return false;
  return questionSetting ?? quizDefault;
}

export function buildStandaloneLearnerOptions<T>({
  options,
  quizShuffleAnswers,
  questionShuffleAnswerOptions,
  lockAnswerOrder,
  random,
}: {
  options: readonly T[];
  quizShuffleAnswers: boolean;
  questionShuffleAnswerOptions?: boolean | null;
  lockAnswerOrder?: boolean | null;
  random?: () => number;
}): T[] {
  return orderQuestionOptions(
    options,
    shouldShuffleQuestionOptions({
      quizDefault: quizShuffleAnswers,
      questionSetting: questionShuffleAnswerOptions,
      lockAnswerOrder,
    }),
    random,
  );
}
