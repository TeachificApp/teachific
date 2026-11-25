import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { extractJson } from "./extractJson";
import { canUseAiCourseGenerator } from "./aiCourseGeneratorEntitlement";
import { COURSE360_AI_SOURCE_MIMES, canUseCourse360AdvancedAi } from "./course360AiSourceMetadata";
import { buildCourseSourceContext, type CourseSourceOwner } from "./course360AiCourseSource";
import { buildCourse360SourceMessage } from "./course360AiCourseSourceMessage";
import { invokeCourse360SourceLLM } from "./course360AiSourceProvider";
import { resolveCourse360ChatConfiguration } from "./course360AiProviderConfig";
import { assertCourse360GeneratedStructure, getCourse360AiStructureInstructions } from "./course360AiCourseStructure";

export const course360AiSourceInput = z.object({ url: z.string().url(), mimeType: z.enum(COURSE360_AI_SOURCE_MIMES), name: z.string().min(1).max(255), storageKey: z.string().max(1000).optional() });
export const course360AiPreviewInput = z.object({
  topics: z.string().max(10000).default(""),
  productType: z.enum(["course", "quiz"]).default("course"),
  targetAudience: z.string().max(500).optional(),
  difficultyLevel: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  estimatedDurationMinutes: z.number().int().min(5).max(600).optional(),
  structureMode: z.enum(["manual", "ai"]).default("manual"),
  moduleCount: z.number().int().min(1).max(20).default(5),
  lessonsPerModule: z.number().int().min(1).max(10).default(4),
  starterContent: z.string().max(20000).optional(),
  generateQuizzes: z.boolean().default(true),
  generateCourseQuiz: z.boolean().default(false),
  sourceFile: course360AiSourceInput.optional(),
  sourceFiles: z.array(course360AiSourceInput).min(1).max(3).optional(),
}).superRefine((input, context) => {
  if (input.topics.trim().length < 3 && (input.starterContent?.trim().length ?? 0) < 3 && !input.sourceFile && !input.sourceFiles?.length) context.addIssue({ code: "custom", path: ["topics"], message: "Enter a subject or outline, or upload a course source." });
  if (input.sourceFile && input.sourceFiles?.length) context.addIssue({ code: "custom", path: ["sourceFiles"], message: "Use sourceFile or sourceFiles, not both." });
});
export type Course360AiPreviewInput = z.infer<typeof course360AiPreviewInput>;
export type Course360AiPreviewOwner = CourseSourceOwner & { plan?: string | null; status?: string | null };
export function assertCourse360AdvancedAiAccess(owner: Course360AiPreviewOwner, advanced: boolean): void {
  if (!Number.isSafeInteger(owner.orgId) || owner.orgId <= 0 || !Number.isSafeInteger(owner.userId) || owner.userId <= 0) throw new TRPCError({ code: "FORBIDDEN", message: "Select an active organization before generating course content." });
  if (advanced && !canUseCourse360AdvancedAi(owner.plan, owner.status)) throw new TRPCError({ code: "FORBIDDEN", message: "Source-aware and AI-planned course generation requires an active Pro or Enterprise organization plan." });
}

/** Preview only: caller supplies server-resolved active school and subscription; never writes course/content. */
export async function generateCourse360AiPreview(input: Course360AiPreviewInput, owner: Course360AiPreviewOwner) {
      const systemPrompt = `You are an expert instructional designer for Course360.
You create structured, accurate, original, and pedagogically sound course content for the subject supplied by the author.
Always use United States English spelling.
Return ONLY valid JSON — no markdown, no code fences, no extra text.
IMPORTANT: Each lesson content must be comprehensive — minimum 300 words of rich HTML with clear context, key concepts, practical examples, and useful tips.
IMPORTANT: Each requested lesson quiz must include exactly 5 MCQ questions with 4 options each.
IMPORTANT: The landing page must have fully written, publication-ready content — not placeholders.`;

      if (!canUseAiCourseGenerator(owner.plan, owner.status)) throw new TRPCError({ code: "FORBIDDEN", message: "AI course generation requires an active paid organization plan." });
      const sourceFiles = input.sourceFiles?.length ? input.sourceFiles : input.sourceFile ? [input.sourceFile] : [];
      assertCourse360AdvancedAiAccess(owner, sourceFiles.length > 0 || input.structureMode === "ai");
      let sourceContext: string;
      let sourceMessage: Awaited<ReturnType<typeof buildCourse360SourceMessage>>;
      try {
        sourceContext = await buildCourseSourceContext(sourceFiles, owner);
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Re-upload the source file." });
      }
      const topics = input.topics.trim() || "Use supplied documents and author notes to determine the subject and scope.";
      const isQuiz = input.productType === "quiz";
      const { moduleCount, lessonsPerModule, starterContent, generateQuizzes, generateCourseQuiz } = input;

      const starterSection = starterContent
        ? `\n\nSTARTER CONTENT / OUTLINE PROVIDED BY AUTHOR (use this as the primary source of truth for topics, structure, and terminology):\n---\n${starterContent}\n---\n`
        : "";

      const userPrompt = isQuiz
        ? `Create a standalone quiz on the following topics:
"${topics}"
${input.targetAudience ? `Target audience: ${input.targetAudience}` : ""}
${input.difficultyLevel ? `Difficulty: ${input.difficultyLevel}` : ""}${starterSection}\n${sourceContext}

Return a JSON object with this exact structure:
{
  "title": "Quiz title (concise, clinical)",
  "subtitle": "One-line subtitle",
  "questions": [
    {
      "question": "Question text",
      "type": "mcq",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option A",
      "explanation": "Brief clinical explanation of the correct answer"
    }
  ],
  "landingPage": {
    "heroTitle": "Engaging hero headline",
    "heroSubtitle": "One sentence description",
    "ctaText": "Start Quiz",
    "whatYouLearn": "<ul><li>Key topic 1</li><li>Key topic 2</li><li>Key topic 3</li></ul>",
    "bodyContent": "<p>2-3 paragraph HTML description of the quiz</p>",
    "requirements": "<p>Who this quiz is for and any prerequisites</p>"
  }
}
Generate 10-20 high-quality MCQ questions. Each question must have exactly 4 options.`
        : `Create a comprehensive course on the following topics:
"${topics}"
${input.targetAudience ? `Target audience: ${input.targetAudience}` : ""}
${input.difficultyLevel ? `Difficulty: ${input.difficultyLevel}` : ""}
${input.estimatedDurationMinutes ? `Estimated duration: ${input.estimatedDurationMinutes} minutes` : ""}${starterSection}\n${sourceContext}

${getCourse360AiStructureInstructions(input)}

Return a JSON object with this exact structure:
{
  "title": "Course title (concise and specific)",
  "subtitle": "One-line subtitle",
  "sections": [
    {
      "title": "Module title",
      "lessons": [
        {
          "title": "Lesson title",
          "type": "text",
          "durationMinutes": 15,
          "learningObjectives": ["Objective 1", "Objective 2", "Objective 3"],
          "content": "<h2>Introduction</h2><p>Detailed lesson content in HTML — minimum 300 words. Include useful context, key concepts, practical examples, and concrete tips. Use <h2>, <h3>, <ul>, <ol>, <strong>, <em> tags for structure.</p>",
          "imageSearchQuery": "specific educational image topic",
          ${generateQuizzes ? `"quiz": {
            "questions": [
              {
                "question": "Assessment question text?",
                "options": ["Option A", "Option B", "Option C", "Option D"],
                "correctAnswer": "Option A",
                "explanation": "Explanation of why this is correct"
              }
            ]
          }` : '"quiz": null'}
        }
      ]
    }
  ],
  "courseQuiz": ${generateCourseQuiz ? `{
    "title": "Course Assessment",
    "questions": [
      { "question": "Assessment question", "options": ["Option A", "Option B", "Option C", "Option D"], "correctAnswer": "Option A", "explanation": "Explain why the answer is correct" }
    ]
  }` : "null"},
  "landingPage": {
    "heroTitle": "Compelling course headline (not a placeholder)",
    "heroSubtitle": "One powerful sentence describing the transformation or outcome",
    "ctaText": "Enroll Now",
    "whatYouLearn": "<ul><li>Specific learning outcome 1</li><li>Specific learning outcome 2</li><li>Specific learning outcome 3</li><li>Specific learning outcome 4</li><li>Specific learning outcome 5</li><li>Specific learning outcome 6</li></ul>",
    "bodyContent": "<h2>About This Course</h2><p>3-4 paragraph fully written HTML description. First paragraph: what the course covers and why it matters clinically. Second paragraph: who will benefit most. Third paragraph: what makes this course unique. Fourth paragraph: what students will be able to do after completing it.</p>",
    "requirements": "<h3>Who This Course Is For</h3><ul><li>Specific audience type 1</li><li>Specific audience type 2</li></ul><h3>Prerequisites</h3><p>Any required background knowledge or equipment.</p>",
    "heroImageSearchQuery": "${topics.split(' ').slice(0,3).join(' ')} professional educational visual"
  }
}

CRITICAL REQUIREMENTS:
- Follow the exact manual counts or AI-planned structure instructions above.
- Each lesson content must be minimum 300 words of rich HTML
- Each requested lesson quiz and optional course-wide assessment must have EXACTLY 5 questions with 4 options each
- All landing page fields must be fully written — NO placeholders like "[Topic]" or "[Description]"
- imageSearchQuery should be a specific, descriptive search query for a relevant course image`;

      try {
        sourceMessage = await buildCourse360SourceMessage(userPrompt, sourceFiles, owner, { openAiNativePdf: resolveCourse360ChatConfiguration()?.backend === "openai" });
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Re-upload the source file." });
      }
      const response = await invokeCourse360SourceLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: sourceMessage },
        ],
        response_format: { type: "json_object" },
      });

      if (response?.choices?.[0]?.finish_reason === "length") throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI could not finish the full course. Choose a focused subject or smaller manual counts. No course content has been saved." });
      const raw = String(response?.choices?.[0]?.message?.content ?? "{}");
      let parsed: any;
      try {
        parsed = extractJson(raw);
      } catch {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI returned invalid JSON. Please try again." });
      }

      if (!isQuiz) {
        try { assertCourse360GeneratedStructure(parsed, input); }
        catch (error) { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "AI returned an incomplete curriculum." }); }
      }
      return { generated: parsed, productType: input.productType };
}
