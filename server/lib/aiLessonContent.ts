export const FULL_LESSON_MINIMUM_WORDS = 1500;

export function cleanGeneratedLessonContent(content: string): string {
  return content
    .replace(/^```(?:html|markdown)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export function countGeneratedContentWords(content: string): number {
  const plainText = cleanGeneratedLessonContent(content)
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:#\d+|#x[\da-f]+|[a-z]+);/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return plainText.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

export function requiresFullLessonMinimum(contentType: string): boolean {
  return contentType === "lesson" || contentType === "text";
}

export function fullLessonLengthRequirement(): string {
  return `Write at least ${FULL_LESSON_MINIMUM_WORDS} words of learner-facing instructional prose. Use a clear introduction, multiple substantive sections, examples or applications where helpful, key takeaways, and a concise conclusion. HTML tags, headings, and lists do not count toward the minimum.`;
}

export function buildFullLessonExpansionPrompt(input: {
  content: string;
  wordCount: number;
}): string {
  return `Rewrite and expand the complete lesson below. The final lesson itself must contain at least ${FULL_LESSON_MINIMUM_WORDS} words of learner-facing instructional prose; the current draft has ${input.wordCount} words. Preserve useful material, then add substantive explanations, examples, applications, and learner-focused detail. Return the complete revised HTML only, without commentary or code fences.\n\nCurrent lesson:\n${input.content}`;
}
