import { TRPCError } from "@trpc/server";
import type { quizzes } from "../../drizzle/schema";

export const QUIZ_NATIVE_CONFIG_KEY = "course360QuizNativeV1";
type QuizRow = typeof quizzes.$inferSelect;
const object = (value: unknown): Record<string, any> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
function jsonObject(value: unknown) { if (typeof value !== "string") return object(value); try { return object(JSON.parse(value)); } catch { return {}; } }
export function readNativeQuizConfig(row: Partial<QuizRow> & Record<string, any>): { meta: Record<string, any>; questions: any[]; [key: string]: any } {
  const envelope = jsonObject(row.themeConfig)[QUIZ_NATIVE_CONFIG_KEY];
  let questions: any[] = [];
  if (Array.isArray(envelope?.config?.questions)) questions = envelope.config.questions;
  else { try { const parsed = JSON.parse(row.instructions || "[]"); if (Array.isArray(parsed)) questions = parsed; else if (Array.isArray(parsed?.questions)) questions = parsed.questions; } catch { /* Legacy raw instructions retained; no rewrite on read. */ } }
  const saved = object(envelope?.config), savedMeta = object(saved.meta);
  const now = row.createdAt?.toISOString?.() ?? new Date().toISOString();
  return {
    ...saved,
    meta: {
      id: String(row.id ?? ""), author: "", authorEmail: "", createdAt: now,
      updatedAt: row.updatedAt?.toISOString?.() ?? now, version: 1, licenseKey: null, tags: [],
      passingScore: row.legacyPassingScore ?? row.passingScore ?? row.passScorePercent ?? 70,
      timeLimit: row.timeLimitSeconds != null ? row.timeLimitSeconds / 60 : row.timeLimit != null ? row.timeLimit / 60 : null,
      shuffleQuestions: row.legacyShuffleQuestions ?? row.shuffleQuestions ?? row.randomizeQuestions ?? false,
      shuffleAnswers: row.legacyShuffleAnswers ?? row.shuffleAnswers ?? row.randomizeAnswers ?? false,
      showFeedback: row.legacyShowFeedbackImmediately != null ? row.legacyShowFeedbackImmediately ? "immediate" : "deferred" : row.feedbackMode === "never" ? "never" : row.feedbackMode === "immediate" ? "immediate" : "deferred",
      resultSlide: row.completionMessage ? { enabled: true, passMessage: row.completionMessage, failMessage: row.completionMessage } : undefined, allowRetry: true, maxAttempts: row.maxAttempts ?? 0,
      branding: { primaryColor: row.brandPrimaryColor ?? "#24abbc", backgroundColor: row.brandBgColor ?? "#f9fafb", logoUrl: row.brandLogoUrl ?? undefined, fontFamily: row.brandFontFamily ?? undefined },
      ...savedMeta,
      // Row authority wins only for identity/title and explicit security state. Native fractional settings stay exact.
      cloudId: row.id, teachificOrgId: row.orgId ?? null, title: row.title ?? savedMeta.title, description: row.description ?? savedMeta.description ?? "",
      mockExamEnabled: row.mockExamEnabled ?? savedMeta.mockExamEnabled ?? false,
      nativeRevision: envelope?.revision ?? 0,
    },
    questions,
  };
}
export function nativeQuizRevision(row: Partial<QuizRow> & Record<string, any>) { return Number(jsonObject(row.themeConfig)[QUIZ_NATIVE_CONFIG_KEY]?.revision ?? 0); }
/** Every returned property exists on the current Drizzle table; instructions remains the established array reader. */
export function nativeQuizSaveFields(input: { title: string; description?: string; questionsJson: string; settingsJson?: string }, previous?: QuizRow | null): Partial<typeof quizzes.$inferInsert> {
  let questions: unknown, settings: any = {};
  try { questions = JSON.parse(input.questionsJson); settings = input.settingsJson ? JSON.parse(input.settingsJson) : {}; } catch { throw new TRPCError({ code: "BAD_REQUEST", message: "Quiz configuration must be valid JSON." }); }
  if (!Array.isArray(questions) || !settings || typeof settings !== "object" || Array.isArray(settings)) throw new TRPCError({ code: "BAD_REQUEST", message: "Quiz questions and settings are invalid." });
  const prior: { meta: Record<string, any>; questions: any[]; [key: string]: any } = previous ? readNativeQuizConfig(previous) : { meta: {}, questions: [] };
  const meta: Record<string, any> = { ...prior.meta, ...settings, title: input.title, description: input.description ?? prior.meta.description ?? "" };
  if (meta.passingScore === undefined) meta.passingScore = 70;
  if (!Number.isFinite(meta.passingScore) || meta.passingScore < 0 || meta.passingScore > 100) throw new TRPCError({ code: "BAD_REQUEST", message: "Passing score must be between 0 and 100." });
  if (meta.timeLimit != null && (!Number.isFinite(meta.timeLimit) || meta.timeLimit <= 0 || meta.timeLimit > 1440)) throw new TRPCError({ code: "BAD_REQUEST", message: "Time limit must be positive minutes, up to 24 hours." });
  if (meta.maxAttempts != null && (!Number.isInteger(meta.maxAttempts) || meta.maxAttempts < 0)) throw new TRPCError({ code: "BAD_REQUEST", message: "Maximum attempts must be a nonnegative integer." });
  if (meta.showFeedback === undefined) meta.showFeedback = meta.showFeedbackImmediately === false ? "deferred" : "immediate";
  if (!["immediate", "deferred", "never"].includes(meta.showFeedback)) throw new TRPCError({ code: "BAD_REQUEST", message: "Feedback mode is invalid." });
  const ids = new Map((questions as any[]).map((q, i) => [String(q.id), i]));
  for (const [index, q] of (questions as any[]).entries()) {
    for (const rule of q.branchRules ?? []) if (rule.target?.type === "question" && (!ids.has(String(rule.target.questionId)) || Number(ids.get(String(rule.target.questionId))) <= index)) throw new TRPCError({ code: "BAD_REQUEST", message: "Branch targets must reference a later question in this quiz; cycles are not allowed." });
    if (q.type === "hotspot") {
      const regions = q.data?.regions ?? [], seen = new Set<string>();
      for (const z of regions) { if (!z?.id || seen.has(z.id)) throw new TRPCError({ code: "BAD_REQUEST", message: "Hotspot regions require unique identifiers." }); seen.add(z.id); if (!["circle", "rect", "polygon"].includes(z.shape) || !Number.isFinite(z.x) || !Number.isFinite(z.y) || z.x < 0 || z.x > 100 || z.y < 0 || z.y > 100 || z.shape === "circle" && !(z.radius > 0) || z.shape === "rect" && (!(z.width > 0) || !(z.height > 0)) || z.shape === "polygon" && (!Array.isArray(z.points) || z.points.length < 3 || z.points.some((p: any) => !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.x > 100 || p.y < 0 || p.y > 100)) || z.scoreWeight !== undefined && (!Number.isFinite(z.scoreWeight) || z.scoreWeight <= 0)) throw new TRPCError({ code: "BAD_REQUEST", message: "Hotspot region geometry or weight is invalid." }); }
    }
    if (q.points !== undefined && (!Number.isFinite(q.points) || q.points < 0)) throw new TRPCError({ code: "BAD_REQUEST", message: "Question points must be finite and nonnegative." }); }
  // Full JSON is versioned in the existing compatible JSON column, without deleting unrelated theme keys.
  const theme = jsonObject(previous?.themeConfig), revision = previous ? nativeQuizRevision(previous) + 1 : 1;
  return {
    title: input.title, description: meta.description || null, instructions: JSON.stringify(questions),
    themeConfig: { ...theme, [QUIZ_NATIVE_CONFIG_KEY]: { ...object(theme[QUIZ_NATIVE_CONFIG_KEY]), version: 1, revision, config: { ...prior, meta: { ...meta, nativeRevision: revision }, questions } } },
    legacyPassingScore: meta.passingScore, passScorePercent: Math.round(meta.passingScore), timeLimitSeconds: meta.timeLimit == null ? null : Math.round(meta.timeLimit * 60),
    maxAttempts: meta.maxAttempts ?? null, legacyShuffleQuestions: Boolean(meta.shuffleQuestions), randomizeQuestions: Boolean(meta.shuffleQuestions), legacyShuffleAnswers: Boolean(meta.shuffleAnswers), randomizeAnswers: Boolean(meta.shuffleAnswers),
    legacyShowFeedbackImmediately: meta.showFeedback === "immediate", feedbackMode: meta.showFeedback === "deferred" ? "end" : meta.showFeedback,
    ...(typeof meta.showCorrectAnswers === "boolean" ? { showCorrectAnswers: meta.showCorrectAnswers } : {}),
    ...(typeof meta.mockExamEnabled === "boolean" ? { mockExamEnabled: meta.mockExamEnabled } : {}),
    ...(meta.branding ? { brandPrimaryColor: meta.branding.primaryColor, brandBgColor: meta.branding.backgroundColor, brandLogoUrl: meta.branding.logoUrl ?? null, brandFontFamily: meta.branding.fontFamily ?? null } : {}),
  };
}
/** Legacy API names remain readable without pretending they are Drizzle columns. Time is seconds at the player boundary. */
export function nativeQuizPlayerSettings(row: QuizRow) {
  const meta = readNativeQuizConfig(row).meta;
  return { passingScore: meta.passingScore, timeLimit: meta.timeLimit == null ? null : meta.timeLimit * 60, maxAttempts: meta.maxAttempts, shuffleQuestions: meta.shuffleQuestions, shuffleAnswers: meta.shuffleAnswers,
    showFeedbackImmediately: meta.showFeedback === "immediate", showFeedback: meta.showFeedback, showCorrectAnswers: row.showCorrectAnswers, drawConfig: meta.drawConfig, branchingEnabled: meta.branchingEnabled, branding: meta.branding, introSlide: meta.introSlide, resultSlide: meta.resultSlide, allowRetry: meta.allowRetry, allowBackNavigation: meta.allowBackNavigation };
}
/** A learner never receives keys/model answers/rubrics/solution-bearing feedback before an attempt is graded. */
export function redactNativeQuizQuestions(questions: any[]) {
  return questions.map(question => {
    const q = JSON.parse(JSON.stringify(question)); const d = q.data ?? {};
    delete q.explanation; delete q.explanationHtml; delete q.feedback; delete q.feedbackImage; delete q.feedbackVideo;
    if (q.branchRules) q.branchRules = q.branchRules.filter((r: any) => ["choice", "always"].includes(r.condition?.type));
    for (const key of ["correct", "correctValue", "rangeMin", "rangeMax", "tolerance", "sampleAnswer", "keywords", "acceptedVariants", "rubric", "trueFeedback", "falseFeedback"]) delete d[key];
    for (const key of ["choices", "regions", "blanks", "targets", "items"]) for (const item of Array.isArray(d[key]) ? d[key] : []) {
      for (const answerKey of ["correct", "correctIndex", "correctWord", "acceptedAnswers", "keywords", "labelId", "targetId", "feedback", "feedbackHtml", "scoreWeight"]) delete item[answerKey];
    }
    // Matching pair IDs must not encode the correct mapping in the learner payload.
    if (q.type === "matching") { d.responses = (d.pairs ?? []).map((p: any, i: number) => ({ id: `response-text:${p.response ?? ""}|${p.responseImageUrl ?? ""}`, text: p.response, imageUrl: p.responseImageUrl })).sort((a: any, b: any) => String(a.id).localeCompare(String(b.id))); for (const p of d.pairs ?? []) { delete p.response; delete p.responseImageUrl; } }
    if (q.type === "ordering") d.items = [...(d.items ?? [])].sort((a: any, b: any) => String(a.id).localeCompare(String(b.id)));
    if (q.type === "drag_words") d.wordOptions = [...new Set([...(question.data?.blanks ?? []).map((b: any) => b.correctWord), ...(d.distractorWords ?? [])])].sort();
    q.data = d; return q;
  });
}
