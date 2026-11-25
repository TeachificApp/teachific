import { z } from "zod";

export const funnelAiPageTypeSchema = z.enum(["landing", "checkout", "upsell", "downsell", "thank_you", "custom"]);
const shortText = z.string().trim().min(1).max(255);
const plain = z.string().trim().max(6000);
export const funnelAiUrlSchema = z.string().trim().max(2000).refine(value => {
  if (!value) return true;
  if (/^\/(?!\/)/.test(value) && !/[\\\s<>]/.test(value) && !/%(?:0[0-9a-f]|7f|5c)/i.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !/[\\\s<>]/.test(value);
  } catch { return false; }
}, "Use a safe HTTPS URL on your school's domain or a relative path.");
export const funnelAiSectionSchema = z.object({
  kind: z.enum(["hero", "text", "bullets", "faq", "cta"]),
  headline: shortText, body: plain,
  items: z.array(z.string().trim().min(1).max(1000)).max(12),
  questions: z.array(z.object({ q: shortText, a: z.string().trim().min(1).max(2000) }).strict()).max(8),
  buttonText: z.string().trim().max(100),
}).strict().superRefine((section, ctx) => {
  if (["hero", "text", "cta"].includes(section.kind) && !section.body)
    ctx.addIssue({ code: "custom", message: "Section copy is missing" });
  if (section.kind === "bullets" && !section.items.length)
    ctx.addIssue({ code: "custom", message: "Bullet content is missing" });
  if (section.kind === "faq" && !section.questions.length)
    ctx.addIssue({ code: "custom", message: "FAQ content is missing" });
});
const pageFields = {
  title: shortText, seoTitle: shortText,
  seoDescription: z.string().trim().min(1).max(500),
  seoKeywords: z.string().trim().max(1000),
  sections: z.array(funnelAiSectionSchema).min(3).max(6),
};
function completePage(page: { sections: { kind: string }[] }, ctx: z.RefinementCtx) {
  if (page.sections[0]?.kind !== "hero" || page.sections.at(-1)?.kind !== "cta")
    ctx.addIssue({ code: "custom", message: "A complete page needs an opening hero and closing CTA" });
}
export const funnelAiCopySchema = z.object(pageFields).strict().superRefine(completePage);
export const funnelAiPageSchema = z.object({ ...pageFields, pageType: funnelAiPageTypeSchema }).strict().superRefine(completePage);
export const funnelAiDraftSchema = z.object({
  mode: z.enum(["landing", "funnel"]), name: shortText,
  description: z.string().trim().max(4000), ctaUrl: funnelAiUrlSchema,
  pages: z.array(funnelAiPageSchema).min(1).max(5),
}).strict().superRefine((draft, ctx) => {
  if (draft.pages[0]?.pageType !== "landing" || (draft.mode === "landing" ? draft.pages.length !== 1 : draft.pages.length < 2))
    ctx.addIssue({ code: "custom", message: "Choose one landing page or a landing page followed by 1–4 steps" });
});
export const funnelAiGenerateInputSchema = z.object({
  mode: z.enum(["landing", "funnel"]), name: shortText,
  prompt: z.string().trim().min(5).max(12000),
  audience: z.string().trim().max(1000).default(""), goal: z.string().trim().max(1000).default(""),
  ctaUrl: funnelAiUrlSchema.default(""), pageTypes: z.array(funnelAiPageTypeSchema).min(1).max(5),
}).strict().superRefine((input, ctx) => {
  if (input.pageTypes[0] !== "landing" || (input.mode === "landing" ? input.pageTypes.length !== 1 : input.pageTypes.length < 2))
    ctx.addIssue({ code: "custom", message: "Choose one landing page or 2–5 ordered steps" });
});
export type FunnelAiDraft = z.infer<typeof funnelAiDraftSchema>;
export type FunnelAiPage = z.infer<typeof funnelAiPageSchema>;
export type FunnelAiSection = z.infer<typeof funnelAiSectionSchema>;
export type FunnelAiGenerateInput = z.infer<typeof funnelAiGenerateInputSchema>;

/** Native Course360 PageBuilder shapes only. Plain text is rendered by React;
 * models cannot supply HTML, media, product IDs, prices or destination fields. */
export function buildFunnelAiBlocks(page: FunnelAiPage, prefix: string, ctaUrl = "") {
  const url = funnelAiUrlSchema.parse(ctaUrl);
  return page.sections.map((section, i) => {
    const id = `${prefix}_${i + 1}`;
    const common = { headline: section.headline, backgroundColor: "#ffffff", textColor: "#1e293b" };
    switch (section.kind) {
      case "hero": return { id, visible: true, type: "banner" as const, data: {
        ...common, subtext: section.body, backgroundColor: "#123342", textColor: "#ffffff",
        backgroundType: "color", alignment: "center", height: "large",
        ctaText: url ? section.buttonText || "Explore" : "", ctaUrl: url, ctaBgColor: "#189aa1",
      } };
      case "text": return { id, visible: true, type: "bg_section" as const, data: {
        ...common, body: section.body, overlay: false, alignment: "left",
      } };
      case "bullets": return { id, visible: true, type: "checklist" as const, data: {
        ...common, columns: 1, items: section.items.map((text, j) => ({ id: `${id}_${j}`, text })),
      } };
      case "faq": return { id, visible: true, type: "faq" as const, data: {
        ...common, items: section.questions.map((q, j) => ({ id: `${id}_${j}`, question: q.q, answer: q.a })),
      } };
      case "cta": return { id, visible: true, type: "cta" as const, data: {
        ...common, subtext: section.body, backgroundColor: "#123342", textColor: "#ffffff",
        backgroundType: "color", alignment: "center", ctaText: url ? section.buttonText || "Continue" : "",
        ctaUrl: url, ctaBgColor: "#189aa1",
      } };
    }
  });
}
