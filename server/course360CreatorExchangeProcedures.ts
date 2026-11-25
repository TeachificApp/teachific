import { z } from "zod";
import { and, eq, asc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import JSZip from "jszip";
import { randomUUID } from "node:crypto";
import { protectedProcedure } from "./_core/trpc";
import { getDb, getOrgStorageUsage } from "./db";
import { authoringProjects, authoringSlides, orgMediaLibrary } from "../drizzle/schema";
import { requireCourse360AppCapability } from "./lib/course360AppCapabilities";
import { creatorAiRequestSchema, creatorExchangeApplySchema, creatorExchangeDraftSchema, validateCreatorExchangeDraft } from "../shared/course360CreatorExchangeDraft";
import { readCreatorDocument, creatorPrimitives } from "../shared/course360CreatorModel";
import { generateCreatorAiDraft, previewCreatorExchange } from "./course360CreatorAiDraftEngine";
import { importCreatorEditablePptx, exportCreatorEditablePptx, sniffCreatorPptxImage } from "./course360CreatorPptxExchange";
import { PPTX_MAX_INPUT } from "./course360CreatorPptxSafePackage";
import { resolveCreatorMedia, resolveCreatorProjectMedia } from "./course360CreatorMedia";
import { storagePut } from "./storage";
import { issueCreatorExchangeReviewTicket, claimCreatorExchangeReviewTicket } from "./course360CreatorExchangeReviewTickets";
async function scope(userId: number, expectedOrgId: number) {
  const access = await requireCourse360AppCapability(userId, "creator", "web");
  if (access.orgId !== expectedOrgId) throw new TRPCError({ code: "CONFLICT", message: "The selected school changed. Re-open and review this draft in the intended school." });
  if (!access.isPaid && !access.hasManualGrant && !access.platformSupport) throw new TRPCError({ code: "FORBIDDEN", message: "Paid Creator Web access (or an explicitly reviewed manual/support grant) is required for AI and PowerPoint authoring." });
  return access;
}
async function database() { const db = await getDb(); if (!db) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Authoring persistence is unavailable." }); return db; }
async function project(db: any, userId: number, orgId: number, id: number) {
  const [row] = await db.select().from(authoringProjects).where(and(eq(authoringProjects.id, id), eq(authoringProjects.userId, userId), eq(authoringProjects.orgId, orgId))).limit(1);
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Project is not owned by this author in the selected school." }); return row;
}
function decodeBase64(value: string, maximum: number) {
  if (!value || value.length > Math.ceil(maximum / 3) * 4 + 4 || !/^(?:[a-z\d+/]{4})*(?:[a-z\d+/]{2}==|[a-z\d+/]{3}=)?$/i.test(value)) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or oversized base64 file." });
  const bytes = Buffer.from(value, "base64"); if (!bytes.length || bytes.length > maximum || bytes.toString("base64") !== value) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid file bytes." }); return bytes;
}
const applyLocks = new Set<string>();
export const creatorExchangeProcedures = {
  generateAiDraft: protectedProcedure.input(creatorAiRequestSchema).mutation(async ({ ctx, input }) => {
    const access = await scope(ctx.user.id, input.expectedOrgId);
    const existing = input.projectId ? await project(await database(), ctx.user.id, access.orgId, input.projectId) : undefined;
    const draft = await generateCreatorAiDraft(input, { userId: ctx.user.id, orgId: access.orgId }, existing);
    await scope(ctx.user.id, input.expectedOrgId); return { orgId: access.orgId, draft };
  }),
  previewExchangeDraft: protectedProcedure.input(z.object({ expectedOrgId: z.number().int().positive(), draft: creatorExchangeDraftSchema }).strict()).mutation(async ({ ctx, input }) => {
    const access = await scope(ctx.user.id, input.expectedOrgId); const validated = validateCreatorExchangeDraft(input.draft);
    // Validate any retained native bindings with school authority before rendering preview.
    const media = await resolveCreatorMedia(await database(), access.orgId, validated.slides);
    const result = previewCreatorExchange({ ...validated, slides: media.slides });
    const reviewToken = issueCreatorExchangeReviewTicket(validated, ctx.user.id, access.orgId);
    return { orgId: access.orgId, reviewToken, html: result.html, warnings: [...validated.warnings, ...(validated.assets.length ? ["Imported pictures are byte drafts until you explicitly save them to the main Media Library. Preview shows placeholders."] : [])] };
  }),
  importPptxDraft: protectedProcedure.input(z.object({ expectedOrgId: z.number().int().positive(), filename: z.string().min(1).max(255).regex(/\.pptx$/i), base64: z.string().max(Math.ceil(PPTX_MAX_INPUT / 3) * 4), consentToImport: z.literal(true) }).strict()).mutation(async ({ ctx, input }) => {
    const access = await scope(ctx.user.id, input.expectedOrgId);
    try { const draft = await importCreatorEditablePptx(decodeBase64(input.base64, PPTX_MAX_INPUT), input.filename.replace(/\.pptx$/i, "")); await scope(ctx.user.id, input.expectedOrgId); return { orgId: access.orgId, draft }; }
    catch (error) { if (error instanceof TRPCError) throw error; throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Invalid PowerPoint package." }); }
  }),
  applyExchangeDraft: protectedProcedure.input(creatorExchangeApplySchema).mutation(async ({ ctx, input }) => {
    const access = await scope(ctx.user.id, input.expectedOrgId), db = await database();
    const draft = validateCreatorExchangeDraft(input.draft);
    if ((input.target === "append_slides") !== !!input.projectId) throw new TRPCError({ code: "BAD_REQUEST", message: "Explicitly select the append project, or create a new project." });
    const existing = input.projectId ? await project(db, ctx.user.id, access.orgId, input.projectId) : null;
    if (existing) { const current = JSON.parse(existing.settingsJson || "{}"), incoming = JSON.parse(draft.settingsJson); if ((Number(current.width) || 1000) !== (Number(incoming.width) || 1000) || (Number(current.height) || 563) !== (Number(incoming.height) || 563)) throw new TRPCError({ code: "BAD_REQUEST", message: "Different slide geometry: create a new project to preserve the imported canvas." }); }
    // Validate all media references before a write. Browser URLs never become byte authority.
    await resolveCreatorMedia(db, access.orgId, draft.slides); await resolveCreatorProjectMedia(db, access.orgId, { title: draft.title, settingsJson: draft.settingsJson });
    if (draft.assets.length && !input.saveImportedMedia) throw new TRPCError({ code: "BAD_REQUEST", message: "Imported pictures require explicit consent to save new main-account media. Existing media is not replaced." });
    const assets = draft.assets.map(a => ({ ...a, bytes: decodeBase64(a.base64, 8 * 1024 * 1024) }));
    for (const a of assets) sniffCreatorPptxImage(a.bytes, a.mimeType);
    const total = assets.reduce((s, a) => s + a.bytes.length, 0); if (total > 24 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Imported media exceeds 24 MiB." });
    if (assets.length) {
      const { requireActiveMediaOrganization } = await import("./formsRouter"); const mediaOrg = await requireActiveMediaOrganization(ctx.user.id, access.orgId);
      if (mediaOrg !== access.orgId) throw new TRPCError({ code: "FORBIDDEN", message: "Media Library and Creator schools must agree." });
      const quota = await getOrgStorageUsage(access.orgId); if (!Number.isSafeInteger(quota.usedBytes) || quota.usedBytes < 0 || !Number.isSafeInteger(quota.maxBytes) || quota.maxBytes < -1) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Media quota unavailable." });
      if (quota.maxBytes !== -1 && quota.usedBytes + total > quota.maxBytes) throw new TRPCError({ code: "FORBIDDEN", message: "Imported pictures exceed the main Media Library allowance." });
    }
    const key = `${access.orgId}:${ctx.user.id}:${input.projectId || "new"}`;
    if (applyLocks.has(key)) throw new TRPCError({ code: "CONFLICT", message: "A draft is already being applied. Wait for that result." });
    if (typeof db.transaction !== "function") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Transactional authoring is required; existing content remains untouched." });
    const review = claimCreatorExchangeReviewTicket(input.reviewToken, draft, ctx.user.id, access.orgId);
    applyLocks.add(key);
    try {
      await scope(ctx.user.id, input.expectedOrgId);
      const result = await db.transaction(async tx => {
        // Persistence ownership is re-read in transaction; only new rows receive content updates.
        if (input.projectId) await project(tx, ctx.user.id, access.orgId, input.projectId);
        const mediaIds = new Map<string, { id: number; url: string }>();
        for (const a of assets) {
          const ext = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" }[a.mimeType];
          const fileKey = `org-${access.orgId}/media/creator-imports/${randomUUID()}.${ext}`;
          const stored = await storagePut(fileKey, a.bytes, a.mimeType); if (!creatorPrimitives.safeUrl(stored.url)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Storage returned unsafe media URL." });
          const [created] = await tx.insert(orgMediaLibrary).values({ orgId: access.orgId, uploadedBy: ctx.user.id, filename: a.filename.replace(/[^a-z\d._ -]/gi, "_"), mimeType: a.mimeType, fileSize: a.bytes.length, fileKey, url: stored.url, source: "other", tags: JSON.stringify(["creator-pptx-import"]), altText: "Imported PowerPoint picture" });
          const id = Number((created as any).insertId); if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Media record creation failed."); mediaIds.set(a.id, { id, url: stored.url });
        }
        let projectId = input.projectId;
        if (!projectId) {
          const settings = JSON.parse(draft.settingsJson);
          const [created] = await tx.insert(authoringProjects).values({ orgId: access.orgId, userId: ctx.user.id, title: draft.title, description: draft.description, settingsJson: JSON.stringify({ ...settings, creatorExchange: { ...(settings.creatorExchange || {}), source: draft.source, nativeProject: draft.nativeProject, fullLessonText: draft.fullLessonText, reviewedAt: new Date().toISOString() } }), status: "draft" });
          projectId = Number((created as any).insertId); if (!Number.isSafeInteger(projectId) || projectId <= 0) throw new Error("New draft project creation failed.");
        }
        const siblings = await tx.select().from(authoringSlides).where(eq(authoringSlides.projectId, projectId)).orderBy(asc(authoringSlides.slideIndex));
        const start = siblings.reduce((n, s) => Math.max(n, s.slideIndex + 1), 0), ids = new Map<number, number>(); const docs = new Map<number, any>();
        for (let i = 0; i < draft.slides.length; i++) {
          const slide = draft.slides[i], doc = structuredClone(readCreatorDocument(slide.contentJson));
          for (const block of doc.blocks) if (block.importedAssetId) { const m = mediaIds.get(String(block.importedAssetId)); if (!m) throw new Error("Imported asset not saved."); block.mediaId = m.id; block.src = m.url; delete block.importedAssetId; }
          const { contentJson: _originalContent, ...originalSlideFields } = slide;
          doc.creatorExchangeSource = { ...(doc.creatorExchangeSource || {}), source: draft.source, originalSlideFields, reviewed: true }; docs.set(slide.id, doc);
          if (JSON.stringify(doc).length > 1000000) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Imported slide metadata exceeds the shared editor limit. Split the source before applying." });
          const [created] = await tx.insert(authoringSlides).values({ projectId, slideIndex: start + i, title: slide.title, slideType: slide.slideType || "content", layout: slide.layout || "blank", background: slide.background, notes: slide.notes || null, contentJson: JSON.stringify(doc) });
          const id = Number((created as any).insertId); if (!Number.isSafeInteger(id) || id <= 0) throw new Error("New slide creation failed."); ids.set(slide.id, id);
        }
        for (const slide of draft.slides) { const doc = docs.get(slide.id); for (const b of doc.blocks) if (b.action?.kind === "slide") b.action = { ...b.action, targetSlideId: ids.get(b.action.targetSlideId!) }; await tx.update(authoringSlides).set({ contentJson: JSON.stringify(doc), nextSlideId: slide.nextSlideId ? ids.get(slide.nextSlideId) : null }).where(and(eq(authoringSlides.id, ids.get(slide.id)!), eq(authoringSlides.projectId, projectId))); }
        await scope(ctx.user.id, input.expectedOrgId);
        return { id: projectId, slideIds: [...ids.values()], orgId: access.orgId, status: "draft" as const };
      });
      review.complete(); return result;
    } catch (error) { review.retry(); throw error; }
    finally { applyLocks.delete(key); }
  }),
  exportPptx: protectedProcedure.input(z.object({ expectedOrgId: z.number().int().positive(), projectId: z.number().int().positive() }).strict()).mutation(async ({ ctx, input }) => {
    const access = await scope(ctx.user.id, input.expectedOrgId), db = await database(), original = await project(db, ctx.user.id, access.orgId, input.projectId);
    const slides = await db.select().from(authoringSlides).where(eq(authoringSlides.projectId, input.projectId)).orderBy(asc(authoringSlides.slideIndex));
    const assets = new JSZip(); const media = await resolveCreatorMedia(db, access.orgId, slides, assets); await resolveCreatorProjectMedia(db, access.orgId, original, assets);
    const result = await exportCreatorEditablePptx(original, slides, media.slides, assets); await scope(ctx.user.id, input.expectedOrgId);
    // Download bytes only: no storage/upload, publish metadata or existing export defaults changed.
    return { filename: `${original.title.replace(/[^a-z\d_-]/gi, "_").slice(0, 100)}.pptx`, mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", base64: result.bytes.toString("base64"), warnings: [...result.warnings, ...media.warnings] };
  }),
  creatorImageGenerationStatus: protectedProcedure.input(z.object({ expectedOrgId: z.number().int().positive() })).query(async ({ ctx, input }) => { await scope(ctx.user.id, input.expectedOrgId); return { available: false as const, reason: "The configured image helper uploads to an unscoped generated namespace and has no cancellable org-media output contract. Creator shows editable missing-image placeholders; bind owned library images instead. No images are claimed generated." }; }),
};
