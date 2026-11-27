import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { orgMediaLibrary } from "../drizzle/schema";
import { storageGet } from "./storage";
import { readCreatorDocument, creatorPrimitives, type CreatorSlide } from "../shared/course360CreatorModel";
import type JSZip from "jszip";
import type { getDb } from "./db";
type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
const MAX_ASSET_BYTES = 25 * 1024 * 1024;
const MAX_TOTAL_BYTES = 100 * 1024 * 1024;
const TYPES = /^(image\/(png|jpeg|gif|webp)|audio\/(mpeg|wav|ogg|mp4|webm)|video\/(mp4|webm|ogg))$/i;
/** Only persisted media IDs inside this school resolve bytes. Browser URLs are never fetched. */
export async function resolveCreatorMedia(db: Db, orgId: number, slides: CreatorSlide[], zip?: JSZip) {
  const resolved = new Map<number, { url: string; mimeType: string }>(); let total = 0; const warnings: string[] = [];
  async function resolve(target: any, expected: string) {
    if (!target.mediaId) { if (target.src && /^https?:/i.test(target.src)) warnings.push("Legacy external media remains a remote reference; bind it to the main Media Library for offline packaging."); return; }
    const id = target.mediaId;
    if (!Number.isSafeInteger(id) || id < 1) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid media binding" });
    let asset = resolved.get(id);
    if (!asset) {
      const [row] = await db.select().from(orgMediaLibrary).where(and(eq(orgMediaLibrary.id, id), eq(orgMediaLibrary.orgId, orgId))).limit(1);
      if (!row) throw new TRPCError({ code: "FORBIDDEN", message: "Media does not belong to the selected main Course360™ account." });
      if (!TYPES.test(row.mimeType || "")) throw new TRPCError({ code: "BAD_REQUEST", message: "Unsupported media type. SVG/HTML assets are not executable course media." });
      if (!creatorPrimitives.safeUrl(row.url, true)) throw new TRPCError({ code: "BAD_REQUEST", message: "Media URL is unsafe." });
      asset = { url: row.url, mimeType: row.mimeType };
      if (zip) {
        if (!row.fileKey || !Number.isSafeInteger(row.fileSize) || row.fileSize < 0 || row.fileSize > MAX_ASSET_BYTES) throw new TRPCError({ code: "BAD_REQUEST", message: "Media is missing a storage key or exceeds the 25 MiB per-asset packaging limit." });
        const { url } = await storageGet(row.fileKey); const trusted = new URL(url);
        if (trusted.protocol !== "https:" || trusted.username || trusted.password) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Storage returned an unsafe asset URL." });
        const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(30000) });
        if (!response.ok || !response.body) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Course media could not be read from storage." });
        const chunks: Uint8Array[] = []; const reader = response.body.getReader(); let bytes = 0;
        try { while (true) { const { done, value } = await reader.read(); if (done) break; bytes += value.length; total += value.length; if (bytes > MAX_ASSET_BYTES || total > MAX_TOTAL_BYTES) { await reader.cancel(); throw new Error("Course media exceeds safe package memory limits."); } chunks.push(value); } } finally { reader.releaseLock(); }
        const extensions: Record<string,string> = { "image/png":"png","image/jpeg":"jpg","image/gif":"gif","image/webp":"webp","audio/mpeg":"mp3","audio/wav":"wav","audio/ogg":"ogg","audio/mp4":"m4a","audio/webm":"webm","video/mp4":"mp4","video/webm":"webm","video/ogg":"ogv" };
        const path = `assets/media-${id}.${extensions[row.mimeType.toLowerCase()]}`; zip.file(path, Buffer.concat(chunks)); asset.url = path;
      }
      resolved.set(id, asset);
    }
    if (!asset.mimeType.startsWith(expected + "/")) throw new TRPCError({ code: "BAD_REQUEST", message: `This binding requires ${expected} media.` });
    target.src = asset.url;
  }
  const output: CreatorSlide[] = [];
  for (const slide of slides) {
    const document = structuredClone(readCreatorDocument(slide.contentJson));
    for (const block of document.blocks) {
      if (["image", "video", "audio"].includes(block.type)) await resolve(block, block.type);
      if (block.assessment) { if (block.assessment.mediaId) await resolve(block.assessment, "image"); for (const option of block.assessment.options || []) if (option.mediaId) await resolve(option, "image"); }
    }
    output.push({ ...slide, contentJson: JSON.stringify(document) });
  }
  return { slides: output, warnings: [...new Set(warnings)], assetPaths: [...resolved.values()].filter(a => a.url.startsWith("assets/")).map(a => a.url) };
}

/** Brand fields are additive; logo bytes keep the same main-account media authority. */
export async function resolveCreatorProjectMedia(db: Db, orgId: number, project: { title: string; settingsJson?: string | null }, zip?: JSZip) {
  if (!project.settingsJson) return project;
  const settings = JSON.parse(project.settingsJson);
  if (!settings?.creatorBrand?.logoMediaId) return project;
  const brand = settings.creatorBrand;
  const media = await resolveCreatorMedia(db, orgId, [{ id: 1, title: "Brand logo", background: null, contentJson: JSON.stringify({ blocks: [{ id: "brand-logo", type: "image", x: 0, y: 0, width: 100, height: 100, mediaId: brand.logoMediaId, src: brand.logoUrl || "" }] }) }], zip);
  const logo = readCreatorDocument(media.slides[0].contentJson).blocks[0];
  return { ...project, settingsJson: JSON.stringify({ ...settings, creatorBrand: { ...brand, logoUrl: logo.src } }) };
}
