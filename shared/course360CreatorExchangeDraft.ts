import { z } from "zod";
import { creatorDocumentSchema, creatorPrimitives } from "./course360CreatorModel";

export const CREATOR_EXCHANGE_MAX_BYTES = 16 * 1024 * 1024;
export const creatorAiRequestSchema = z.object({
  expectedOrgId: z.number().int().positive(), projectId: z.number().int().positive().optional(),
  topic: z.string().trim().max(500).default(""), details: z.string().max(8000).default(""),
  mode: z.enum(["slides", "outline", "questions", "narration", "full_lesson"]).default("slides"),
  slideCount: z.number().int().min(1).max(12).default(5), consentToGenerate: z.literal(true),
}).strict();
export const creatorExchangeAssetSchema = z.object({
  id: z.string().regex(/^pptx-asset-\d+$/), filename: z.string().max(128),
  mimeType: z.enum(["image/png", "image/jpeg", "image/gif", "image/webp"]),
  base64: z.string().max(12 * 1024 * 1024),
}).strict();
export const creatorExchangeSlideSchema = z.object({
  id: z.number().int().positive(), title: z.string().min(1).max(255),
  contentJson: z.string().max(1000000), background: z.string().max(512).nullable(),
  notes: z.string().max(200000).nullable().optional(), nextSlideId: z.number().int().positive().nullable().optional(),
  slideType: z.enum(["content", "quiz", "interaction", "scenario", "video"]).optional(),
  layout: z.string().max(64).optional(),
}).passthrough();
export const creatorExchangeDraftSchema = z.object({
  version: z.literal(1), source: z.enum(["ai", "pptx"]),
  title: z.string().trim().min(1).max(255), description: z.string().max(20000).nullable().optional(),
  settingsJson: z.string().max(500000), slides: z.array(creatorExchangeSlideSchema).min(1).max(100),
  assets: z.array(creatorExchangeAssetSchema).max(100).default([]),
  warnings: z.array(z.string().max(1000)).max(200).default([]),
  fullLessonText: z.string().max(100000).optional(),
  nativeProject: z.record(z.string(), z.unknown()).optional(),
}).passthrough();
export type CreatorExchangeDraft = z.infer<typeof creatorExchangeDraftSchema>;
export const creatorExchangeApplySchema = z.object({
  expectedOrgId: z.number().int().positive(), draft: creatorExchangeDraftSchema,
  target: z.enum(["new_project", "append_slides"]), projectId: z.number().int().positive().optional(),
  reviewToken: z.string().uuid(),
  consentToApply: z.literal(true), saveImportedMedia: z.boolean().default(false),
}).strict();
export function validateCreatorExchangeDraft(value: unknown): CreatorExchangeDraft {
  if ((JSON.stringify(value)?.length ?? 0) > 32 * 1024 * 1024) throw new Error("Review draft exceeds the bounded limit.");
  const draft = creatorExchangeDraftSchema.parse(value);
  const settings = JSON.parse(draft.settingsJson);
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) throw new Error("Invalid project settings.");
  for (const key of ["width", "height"]) if (settings[key] !== undefined && (!Number.isFinite(settings[key]) || settings[key] < 1 || settings[key] > 4000)) throw new Error("Canvas dimensions exceed supported limits.");
  const ids = new Set(draft.slides.map(s => s.id));
  if (ids.size !== draft.slides.length) throw new Error("Draft slide IDs must be unique.");
  const assetIds = new Set(draft.assets.map(a => a.id));
  if (assetIds.size !== draft.assets.length) throw new Error("Draft media IDs must be unique.");
  for (const slide of draft.slides) {
    const doc = creatorDocumentSchema.parse(JSON.parse(slide.contentJson));
    if (slide.nextSlideId && !ids.has(slide.nextSlideId)) throw new Error("Draft contains a missing branch target.");
    for (const block of doc.blocks) {
      if (block.action?.kind === "slide" && !ids.has(block.action.targetSlideId!)) throw new Error("Draft button targets must stay inside this draft.");
      if (block.action?.kind === "url" && !/^https?:/.test(creatorPrimitives.safeUrl(block.action.url))) throw new Error("Draft has an unsafe button URL.");
      if (block.src && !creatorPrimitives.safeUrl(block.src, true)) throw new Error("Draft has an unsafe media URL.");
      if (block.importedAssetId && !assetIds.has(String(block.importedAssetId))) throw new Error("Draft image is missing its imported asset.");
      if (block.assessment) {
        if (block.assessment.src && !creatorPrimitives.safeUrl(block.assessment.src, true)) throw new Error("Unsafe question media URL.");
        for (const option of block.assessment.options || []) if (option.src && !creatorPrimitives.safeUrl(option.src, true)) throw new Error("Unsafe option media URL.");
      }
    }
  }
  if (draft.fullLessonText !== undefined && draft.fullLessonText.trim().split(/\s+/u).filter(Boolean).length < 1500) throw new Error("Full lesson text must contain at least 1,500 words. No content has been applied.");
  return draft;
}
