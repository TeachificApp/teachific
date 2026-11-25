import { z } from "zod";
import { randomBytes } from "crypto";
import { assertCourse360GeneratedStructure } from "./course360AiCourseStructure";
import { cleanGeneratedLessonContent } from "./aiLessonContent";
import { selectCuratedUnsplashCourseVisual } from "./aiCourseVisuals";

const title = z.string().trim().min(1).max(255);
const question = z.object({
  question: z.string().trim().min(1).max(20000),
  type: z.enum(["mcq", "truefalse"]).optional(),
  options: z.array(z.string().trim().min(1).max(10000)).min(2).max(10),
  correctAnswer: z.string().trim().min(1).max(10000),
  explanation: z.string().max(50000).nullable().optional(),
}).passthrough().superRefine((q, ctx) => {
  if (!q.options.includes(q.correctAnswer)) ctx.addIssue({ code: "custom", message: "Quiz answers must match an option." });
  if (new Set(q.options).size !== q.options.length) ctx.addIssue({ code: "custom", message: "Quiz options must be distinct." });
});
const quiz = z.object({ title: title.optional(), questions: z.array(question).min(1).max(100) }).passthrough();
const lesson = z.object({
  title,
  type: z.enum(["text", "video", "download", "embed", "video_text", "quiz"]).optional(),
  content: z.string().min(1).max(1000000),
  durationMinutes: z.number().int().min(0).max(10000).nullable().optional(),
  learningObjectives: z.array(z.string().max(10000)).max(100).optional(),
  quiz: quiz.nullable().optional(),
  takeaways: z.array(z.string().max(10000)).max(20).optional(),
  reflectionQuestion: z.string().max(50000).optional(),
  practiceActivity: z.string().max(50000).optional(),
}).passthrough();
const landingPage = z.object({
  heroTitle: z.string().max(255).nullable().optional(),
  heroSubtitle: z.string().max(100000).nullable().optional(),
  ctaText: z.string().max(128).nullable().optional(),
  whatYouLearn: z.string().max(1000000).nullable().optional(),
  bodyContent: z.string().max(1000000).nullable().optional(),
  requirements: z.string().max(1000000).nullable().optional(),
}).passthrough();
const draft = z.object({
  title: title.optional(),
  courseTitle: title.optional(),
  subtitle: z.string().max(500).nullable().optional(),
  sections: z.array(z.object({ title, lessons: z.array(lesson).min(1).max(10) }).passthrough()).min(1).max(20).optional(),
  questions: z.array(question).min(1).max(100).optional(),
  courseQuiz: quiz.nullable().optional(),
  landingPage: landingPage.nullable().optional(),
}).passthrough();
export type Course360ReviewedDraft = z.infer<typeof draft>;

/** Validate the entire reviewed payload before any write, without shortening lesson HTML. */
export function validateCourse360ReviewedDraft(value: unknown, productType: "course" | "quiz"): Course360ReviewedDraft {
  if ((JSON.stringify(value)?.length ?? 0) > 12000000) throw new Error("AI draft is too large. Apply a smaller curriculum.");
  const parsed = draft.safeParse(value);
  if (!parsed.success) throw new Error("The AI draft contains invalid curriculum, quiz, or landing-page fields. Review the complete preview before applying it.");
  if (productType === "course") assertCourse360GeneratedStructure(parsed.data, { structureMode: "ai", moduleCount: 5, lessonsPerModule: 4 });
  else if (!parsed.data.questions?.length) throw new Error("The AI quiz draft must contain valid questions before applying it.");
  for (const section of parsed.data.sections ?? []) {
    for (const lesson of section.lessons) {
      if (lesson.quiz && `${lesson.title} — Quiz`.length > 255) throw new Error("A lesson title is too long for its attached quiz. Shorten the reviewed title before applying.");
    }
  }
  return parsed.data;
}

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
export function course360ReviewedLessonBlocks(input: {
  courseTitle: string; sectionTitle: string; lesson: NonNullable<Course360ReviewedDraft["sections"]>[number]["lessons"][number];
  primaryColor?: string | null; includeUnsplashImages: boolean; aiImageUrl?: string;
}): string {
  const { lesson } = input;
  const color = input.primaryColor || "#179ca3";
  const block = (type: string, data: Record<string, unknown>) => ({ id: `reviewed-${randomBytes(10).toString("hex")}`, type, data });
  const blocks = [block("hero", { headline: lesson.title, headline2: "", subheadline: input.sectionTitle, hideButtons: true, buttons: [], bgType: "color", bgColor: color, textColor: "#ffffff", align: "left", heroMinHeight: 150 })];
  if (input.aiImageUrl) blocks.push(block("ai_image", { url: input.aiImageUrl, alt: `AI-generated course visual for ${lesson.title}`, caption: "", align: "center", maxWidth: "100%", showShadow: true, source: "ai" }));
  blocks.push(block("text", { html: cleanGeneratedLessonContent(lesson.content), align: "left", bgColor: "#ffffff", textColor: "#1a1a1a" }));
  if (input.includeUnsplashImages) {
    const visual = selectCuratedUnsplashCourseVisual(`${input.courseTitle} ${input.sectionTitle} ${lesson.title}`);
    blocks.push(block("image", { url: visual.url, alt: `${lesson.title} — ${visual.alt}`, caption: "", align: "center", maxWidth: "100%", showShadow: true, source: "unsplash" }));
  }
  if (lesson.takeaways?.length) blocks.push(block("checklist", { headline: "Key Takeaways", items: lesson.takeaways, accentColor: color, bgColor: "#ffffff" }));
  const items = [
    ...(lesson.reflectionQuestion ? [{ q: "Reflection question", a: `<p>${escape(lesson.reflectionQuestion)}</p>` }] : []),
    ...(lesson.practiceActivity ? [{ q: "Practice activity", a: `<p>${escape(lesson.practiceActivity)}</p>` }] : []),
  ];
  if (items.length) blocks.push(block("faq", { headline: "Reflect & Apply", accentColor: color, items }));
  return JSON.stringify(blocks);
}
