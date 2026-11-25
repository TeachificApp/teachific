import { z } from "zod";

export const CREATOR_ASSESSMENT_TYPES = ["multiple_choice", "true_false", "matching", "hotspot", "fill_blank", "short_answer", "image_choice"] as const;
export type CreatorAssessmentType = typeof CREATOR_ASSESSMENT_TYPES[number];
export interface CreatorOption { id: string; text: string; correct?: boolean; src?: string; mediaId?: number; }
export interface CreatorAssessment {
  type: CreatorAssessmentType; prompt: string; points: number; required: boolean; maxAttempts?: number;
  options?: CreatorOption[]; correctAnswer?: boolean; pairs?: { id: string; left: string; right: string }[];
  answers?: string[]; keywords?: string[]; caseSensitive?: boolean;
  regions?: { id: string; x: number; y: number; width: number; height: number }[];
  src?: string; mediaId?: number; correctFeedback?: string; incorrectFeedback?: string;
}
export interface CreatorInteraction { kind: "tabs" | "accordion" | "timeline" | "flip_cards" | "matching_drag"; items: { id: string; title: string; content: string }[]; }
export interface CreatorAction { kind: "next" | "back" | "finish" | "slide" | "url"; targetSlideId?: number; url?: string; }
export interface CreatorBlock {
  id: string; type: "text" | "image" | "shape" | "button" | "video" | "audio" | "assessment" | "interaction";
  x: number; y: number; width: number; height: number; content?: string; contentHtml?: string;
  src?: string; mediaId?: number; alt?: string; action?: CreatorAction; assessment?: CreatorAssessment; interaction?: CreatorInteraction;
  style?: Record<string, string | number | undefined>; [key: string]: unknown;
}
export interface CreatorDocument { blocks: CreatorBlock[]; version?: number; [key: string]: unknown; }
export interface CreatorSlide { id: number; title: string; contentJson: string | null; background: string | null; nextSlideId?: number | null; notes?: string | null; }
export interface CreatorCourse { id?: number; title: string; settingsJson?: string | null; slides: CreatorSlide[]; showWatermark?: boolean; }
const finite = z.number().finite().min(-10000).max(10000);
const option = z.object({ id: z.string().min(1).max(128), text: z.string().max(10000), correct: z.boolean().optional(), src: z.string().max(2048).optional(), mediaId: z.number().int().positive().optional() }).passthrough();
export const creatorAssessmentSchema = z.object({
  type: z.enum(CREATOR_ASSESSMENT_TYPES), prompt: z.string().min(1).max(20000), points: z.number().finite().positive().max(1000), required: z.boolean(), maxAttempts: z.number().int().min(1).max(100).optional(),
  options: z.array(option).max(50).optional(), correctAnswer: z.boolean().optional(),
  pairs: z.array(z.object({ id: z.string(), left: z.string(), right: z.string() }).passthrough()).max(30).optional(),
  answers: z.array(z.string().min(1).max(10000)).max(100).optional(), keywords: z.array(z.string().min(1)).max(100).optional(), caseSensitive: z.boolean().optional(),
  regions: z.array(z.object({ id: z.string(), x: z.number().min(0).max(100), y: z.number().min(0).max(100), width: z.number().positive().max(100), height: z.number().positive().max(100) }).passthrough()).max(50).optional(),
  src: z.string().max(2048).optional(), mediaId: z.number().int().positive().optional(), correctFeedback: z.string().max(10000).optional(), incorrectFeedback: z.string().max(10000).optional(),
}).passthrough().superRefine((q, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: "custom", message });
  if (["multiple_choice", "image_choice"].includes(q.type) && (!q.options?.length || !q.options.some(o => o.correct))) fail("Choice questions need options and at least one correct answer.");
  if (q.options && new Set(q.options.map(o => o.id)).size !== q.options.length) fail("Option IDs must be unique.");
  if (q.type === "true_false" && typeof q.correctAnswer !== "boolean") fail("Choose the correct true/false answer.");
  if (q.type === "matching" && (!q.pairs?.length || new Set(q.pairs.map(p => p.id)).size !== q.pairs.length)) fail("Matching needs unique pairs.");
  if (q.type === "hotspot" && !q.regions?.length) fail("Hotspot needs at least one region.");
  if (q.regions?.some(r => r.x + r.width > 100 || r.y + r.height > 100)) fail("Hotspot regions must fit the image.");
  if (["fill_blank", "short_answer"].includes(q.type) && !q.answers?.length && !(q.type === "short_answer" && q.keywords?.length)) fail("Provide accepted answers or an explicit keyword rubric; ungraded responses cannot pass.");
});
export const creatorDocumentSchema = z.object({ version: z.number().int().optional(), blocks: z.array(z.object({
  id: z.string().min(1).max(128), type: z.enum(["text", "image", "shape", "button", "video", "audio", "assessment", "interaction"]), x: finite, y: finite, width: z.number().finite().positive().max(10000), height: z.number().finite().positive().max(10000),
  content: z.string().max(200000).optional(), contentHtml: z.string().max(200000).optional(), src: z.string().max(2048).optional(), mediaId: z.number().int().positive().optional(),
  style: z.record(z.string(), z.union([z.string().max(2048), z.number().finite()])).optional(), assessment: creatorAssessmentSchema.optional(),
  action: z.object({ kind: z.enum(["next", "back", "finish", "slide", "url"]), targetSlideId: z.number().int().positive().optional(), url: z.string().max(2048).optional() }).passthrough().optional(),
  interaction: z.object({ kind: z.enum(["tabs", "accordion", "timeline", "flip_cards", "matching_drag"]), items: z.array(z.object({ id: z.string(), title: z.string(), content: z.string() }).passthrough()).min(1).max(50) }).passthrough().optional(),
}).passthrough()).max(250) }).passthrough().superRefine((d, ctx) => {
  if (new Set(d.blocks.map(b => b.id)).size !== d.blocks.length) ctx.addIssue({ code: "custom", message: "Block IDs must be unique." });
  for (const b of d.blocks) {
    if (b.type === "assessment" && !b.assessment) ctx.addIssue({ code: "custom", message: "Assessment configuration required." });
    if (b.type === "interaction" && !b.interaction) ctx.addIssue({ code: "custom", message: "Interaction configuration required." });
    if (b.action?.kind === "slide" && !b.action.targetSlideId) ctx.addIssue({ code: "custom", message: "Select a target slide." });
  }
});
/** Readers never mutate or discard saved content. Invalid documents are explicit errors. */
export function readCreatorDocument(raw: string | null): CreatorDocument {
  if (raw && raw.length > 1000000) throw new Error("Slide document exceeds the safe editing limit; original content is retained.");
  const value = JSON.parse(raw || '{"blocks":[]}');
  if (!value || typeof value !== "object" || !Array.isArray(value.blocks)) throw new Error("Slide document is not editable; original content is retained.");
  return value as CreatorDocument;
}
export function validateCreatorDocument(raw: string) { return creatorDocumentSchema.parse(readCreatorDocument(raw)); }

/** Self-contained factory: the identical implementation is serialized into exported packages. */
export function createCreatorPrimitives() {
  function safeUrl(raw: unknown, media = false): string {
    if (typeof raw !== "string" || /[\u0000-\u0020<>"'`\\]/.test(raw)) return "";
    if (/^https?:\/\//i.test(raw)) { try { const u = new URL(raw); return u.username || u.password ? "" : raw; } catch { return ""; } }
    if (media && /^data:(image\/(png|jpeg|gif|webp)|audio\/(mpeg|wav|ogg)|video\/(mp4|webm));base64,[a-z\d+/=]+$/i.test(raw)) return raw;
    if (/^(\/[^/]|assets\/)[a-z\d_./%?=&+~-]*$/i.test(raw) && !raw.split(/[?#]/)[0].split("/").includes("..")) return raw;
    return "";
  }
  function safeStyle(style: any = {}) {
    const out: Record<string, string> = {};
    const colors = ["color", "backgroundColor", "borderColor"];
    colors.forEach(k => { if (typeof style[k] === "string" && /^(#[a-f\d]{3,8}|[a-z]+|rgba?\([\d.,%\s]+\))$/i.test(style[k])) out[k] = style[k]; });
    const numbers: Record<string, [number, number, string]> = { fontSize: [1, 300, "px"], borderRadius: [0, 1000, "px"], opacity: [0, 1, ""], lineHeight: [0.5, 5, ""], letterSpacing: [-20, 100, "px"], borderWidth: [0, 50, "px"], padding: [0, 200, "px"], zIndex: [-100, 10000, ""] };
    Object.entries(numbers).forEach(([k, [min, max, unit]]) => { if (typeof style[k] === "number" && Number.isFinite(style[k])) out[k] = String(Math.max(min, Math.min(max, style[k]))) + unit; });
    const enums: Record<string, string[]> = { fontWeight: ["normal", "bold", "100", "200", "300", "400", "500", "600", "700", "800", "900"], fontStyle: ["normal", "italic", "oblique"], textDecoration: ["none", "underline", "line-through"], textAlign: ["left", "center", "right", "justify"], borderStyle: ["none", "solid", "dashed", "dotted"], objectFit: ["contain", "cover", "fill", "none", "scale-down"] };
    Object.entries(enums).forEach(([k, values]) => { if (values.includes(String(style[k]))) out[k] = String(style[k]); });
    if (typeof style.fontFamily === "string" && /^[a-z\d ,'-]{1,120}$/i.test(style.fontFamily)) out.fontFamily = style.fontFamily;
    return out;
  }
  function grade(q: CreatorAssessment, answer: any) {
    const normalize = (v: any) => { const s = String(v ?? "").trim().replace(/\s+/g, " "); return q.caseSensitive ? s : s.toLocaleLowerCase(); };
    const answered = answer !== undefined && answer !== null && answer !== "" && (!Array.isArray(answer) || answer.length > 0) && (typeof answer !== "object" || Object.keys(answer).length > 0);
    let fraction = 0;
    if (answered) {
      if (q.type === "multiple_choice" || q.type === "image_choice") {
        const expected = (q.options || []).filter(o => o.correct).map(o => o.id).sort();
        const actual = (Array.isArray(answer) ? answer : [answer]).map(String).sort();
        fraction = expected.length > 0 && JSON.stringify(expected) === JSON.stringify(actual) ? 1 : 0;
      } else if (q.type === "true_false") fraction = typeof answer === "boolean" && answer === q.correctAnswer ? 1 : 0;
      else if (q.type === "matching") { const pairs = q.pairs || []; fraction = pairs.length ? pairs.filter(p => answer[p.id] === p.id).length / pairs.length : 0; }
      else if (q.type === "hotspot") fraction = (q.regions || []).some(r => Number.isFinite(answer.x) && Number.isFinite(answer.y) && answer.x >= r.x && answer.x <= r.x + r.width && answer.y >= r.y && answer.y <= r.y + r.height) ? 1 : 0;
      else {
        const value = normalize(answer);
        fraction = (q.answers || []).some(a => normalize(a) === value) ? 1 : 0;
        if (!fraction && q.type === "short_answer" && q.keywords?.length) {
          const words = value.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
          fraction = q.keywords.filter(k => { const tokens = normalize(k).split(/[^\p{L}\p{N}]+/u).filter(Boolean); return tokens.length > 0 && words.some((_, i) => tokens.every((t, j) => words[i + j] === t)); }).length / q.keywords.length;
        }
      }
    }
    const correct = answered && fraction === 1;
    return { answered, correct, fraction, earned: fraction * (q.points || 1), possible: q.points || 1, feedback: !answered ? "Answer this question before submitting." : correct ? q.correctFeedback || "Correct." : q.incorrectFeedback || (fraction ? "Partially correct. Review your answer." : "Incorrect. Review the lesson and try again.") };
  }
  function richText(doc: Document, html: string): DocumentFragment {
    const template = doc.createElement("template"); template.innerHTML = html;
    const fragment = doc.createDocumentFragment();
    const allowed = ["P", "BR", "STRONG", "B", "EM", "I", "U", "S", "UL", "OL", "LI", "SPAN", "H1", "H2", "H3", "BLOCKQUOTE"];
    const blocked = ["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "SVG", "MATH", "FORM", "INPUT", "IMG", "VIDEO", "AUDIO", "LINK", "META"];
    const walk = (node: Node, parent: Node) => {
      if (node.nodeType === 3) { parent.appendChild(doc.createTextNode(node.textContent || "")); return; }
      if (node.nodeType !== 1) return;
      const el = node as HTMLElement; if (blocked.includes(el.tagName)) return;
      const target = allowed.includes(el.tagName) ? doc.createElement(el.tagName.toLowerCase()) : doc.createDocumentFragment();
      Array.from(el.childNodes).forEach(n => walk(n, target)); parent.appendChild(target);
    };
    Array.from(template.content.childNodes).forEach(n => walk(n, fragment)); return fragment;
  }
  return { safeUrl, safeStyle, grade, richText };
}
export const creatorPrimitives = createCreatorPrimitives();
export function serializeCreatorJson(value: unknown) { return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, c => ({ "<": "\\u003c", ">": "\\u003e", "&": "\\u0026", "\u2028": "\\u2028", "\u2029": "\\u2029" }[c]!)); }
export function createCreatorAssessment(type: CreatorAssessmentType): CreatorAssessment {
  const base = { type, prompt: "Edit this question", points: 1, required: true, maxAttempts: 3, correctFeedback: "Correct. Well done.", incorrectFeedback: "Review the lesson and try again." };
  if (type === "true_false") return { ...base, correctAnswer: true };
  if (type === "matching") return { ...base, prompt: "Match each term to its definition", pairs: [{ id: "p1", left: "Term one", right: "Definition one" }, { id: "p2", left: "Term two", right: "Definition two" }] };
  if (type === "hotspot") return { ...base, prompt: "Select the highlighted concept in your image", regions: [{ id: "r1", x: 25, y: 25, width: 25, height: 25 }] };
  if (type === "fill_blank") return { ...base, prompt: "Complete the sentence: The key concept is ____", answers: ["learning"] };
  if (type === "short_answer") return { ...base, prompt: "Explain the key concept using the required terms", keywords: ["learning", "practice"] };
  return { ...base, options: [{ id: "a", text: "Correct option", correct: true }, { id: "b", text: "Alternative option", correct: false }] };
}
