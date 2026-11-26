import JSZip from "jszip";
import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import type { getDb } from "./db";
import { resolveCreatorMedia, resolveCreatorProjectMedia } from "./course360CreatorMedia";
import { and, eq } from "drizzle-orm";
import { orgMediaLibrary } from "../drizzle/schema";
import { isStudioKeyForOrg, resolveStudioStorage, requestStudioStorage } from "./lib/course360StudioStorage";
import { buildCreatorRuntimeHtml } from "../shared/course360CreatorRuntime";
import { creatorPrimitives, validateCreatorDocument, readCreatorDocument, type CreatorCourse, type CreatorSlide } from "../shared/course360CreatorModel";

export const CREATOR_SCHOOL_ARTIFACT_BYTES = 16 * 1024 * 1024;
export function creatorSchoolSnapshotDigest(project: unknown, slides: unknown) {
  return createHash("sha256").update(JSON.stringify({ project, slides })).digest("hex");
}
const bad = (message: string): never => { throw new TRPCError({ code: "BAD_REQUEST", message }); };
export async function creatorSchoolMediaSnapshots(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, orgId: number, project: Omit<CreatorCourse, "slides">, slides: CreatorSlide[], lock = false) {
  const ids = new Set<number>();
  const collect = (v: { mediaId?: number }) => { if (v.mediaId) ids.add(v.mediaId); };
  for (const slide of slides) for (const b of readCreatorDocument(slide.contentJson).blocks) { collect(b); if (b.assessment) { collect(b.assessment); for (const o of b.assessment.options || []) collect(o); } }
  const settings = JSON.parse(project.settingsJson || "{}");
  if (settings.creatorBrand?.logoMediaId) ids.add(settings.creatorBrand.logoMediaId);
  const rows = []; let total = 0;
  for (const id of [...ids].sort((a, b) => a - b)) {
    const query = db.select().from(orgMediaLibrary).where(and(eq(orgMediaLibrary.id, id), eq(orgMediaLibrary.orgId, orgId))).limit(1);
    const [row] = await (lock ? query.for("update") : query);
    if (!row || !isStudioKeyForOrg(row.fileKey, orgId)) throw new TRPCError({ code: "FORBIDDEN", message: "Bound media requires an exact-school owned storage key." });
    if (!Number.isSafeInteger(row.fileSize) || row.fileSize < 1 || row.fileSize > CREATOR_SCHOOL_ARTIFACT_BYTES) bad("Bound media size is missing or exceeds school publishing limits.");
    total += row.fileSize; if (total > CREATOR_SCHOOL_ARTIFACT_BYTES) bad("School delivery media exceeds the bounded 16 MiB artifact envelope.");
    rows.push(row);
  }
  return rows;
}
/** Separate NEW HTML5 delivery artifact. Historical HTML/SCORM exports are not called or changed. */
export async function buildCreatorSchoolArtifact(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, orgId: number, project: Omit<CreatorCourse, "slides">, slides: CreatorSlide[], showWatermark: boolean) {
  if (!slides.length || slides.length > 100) bad("School delivery requires 1–100 saved slides.");
  if (Buffer.byteLength(JSON.stringify({ project, slides })) > CREATOR_SCHOOL_ARTIFACT_BYTES) bad("The retained source document exceeds the bounded 16 MiB school publishing envelope.");
  const ids = new Set(slides.map(s => s.id));
  if (ids.size !== slides.length) bad("Saved slide IDs must be unique.");
  const requireBinding = (target: { src?: string; mediaId?: number }, required: boolean) => {
    if (!target.mediaId && (target.src || required)) bad("Bind all learner media to the selected school's main Media Library before publishing. Remote/unowned media cannot be published.");
  };
  for (const slide of slides) {
    const doc = validateCreatorDocument(slide.contentJson || '{"blocks":[]}');
    if (slide.nextSlideId != null && !ids.has(slide.nextSlideId)) bad("A saved branch target is missing.");
    if (creatorPrimitives.safeUrl(slide.background, true)) bad("Remote or unbound image backgrounds are not supported by school publishing. Use an owned image block.");
    for (const b of doc.blocks) {
      if (b.action?.kind === "slide" && !ids.has(b.action.targetSlideId!)) bad("A saved button target is missing.");
      if (b.action?.kind === "url" && !/^https?:\/\//i.test(creatorPrimitives.safeUrl(b.action.url))) bad("An external button link is unsafe.");
      if (["image", "video", "audio"].includes(b.type)) requireBinding(b, true);
      if (b.assessment) {
        requireBinding(b.assessment, b.assessment.type === "hotspot");
        for (const o of b.assessment.options || []) requireBinding(o, b.assessment.type === "image_choice");
      }
    }
  }
  const settings = JSON.parse(project.settingsJson || "{}");
  if (settings.creatorBrand?.logoUrl && !settings.creatorBrand.logoMediaId) bad("Bind the school logo to an owned Media Library item before publishing.");
  const mediaSnapshots = await creatorSchoolMediaSnapshots(db, orgId, project, slides);
  // Retain existing persisted school/media/type and brand resolution, but source bytes use
  // the existing bounded, abortable, public-DNS-pinned owned-key transport rather than
  // the export helper's larger 100 MiB envelope and non-abortable storageGet lookup.
  const resolved = await resolveCreatorMedia(db, orgId, slides);
  const branded = await resolveCreatorProjectMedia(db, orgId, project);
  if (resolved.warnings.length) bad("School publishing requires self-contained owned media.");
  const dataUris = new Map<number, string>(); const signal = AbortSignal.timeout(60_000);
  const supported = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "audio/mpeg", "audio/wav", "audio/ogg", "video/mp4", "video/webm"]);
  for (const row of mediaSnapshots) {
    const mime = row.mimeType.toLowerCase();
    if (!supported.has(mime)) bad("This media format is not supported by the current embedded learner renderer.");
    const storage = await resolveStudioStorage(row.fileKey, signal);
    if (storage.key !== row.fileKey) bad("Source storage returned a different owned media key.");
    const response = await requestStudioStorage(storage.url, "GET", signal);
    const type = String(response.headers["content-type"] || "").split(";")[0].toLowerCase();
    const length = Number(response.headers["content-length"]);
    const chunks: Buffer[] = []; let size = 0;
    try {
      if (type !== mime || (Number.isFinite(length) && length !== row.fileSize)) bad("The owned source media MIME/size receipt changed during packaging.");
      for await (const chunk of response) { size += chunk.length; if (size > row.fileSize || size > CREATOR_SCHOOL_ARTIFACT_BYTES) bad("The owned source media byte receipt exceeded its bound."); chunks.push(Buffer.from(chunk)); }
    } finally { response.destroy(); }
    if (size !== row.fileSize) bad("The owned source media byte receipt changed during packaging.");
    const uri = `data:${mime};base64,${Buffer.concat(chunks).toString("base64")}`;
    if (!creatorPrimitives.safeUrl(uri, true)) bad("This media format is not supported by the current embedded learner renderer.");
    dataUris.set(row.id, uri);
  }
  // Existing ZIP playback only rewrites literal HTML src/href, not JSON renderer paths.
  // Owned data URIs genuinely retain media through its HTML5 Blob launch.
  function bind(target: { src?: string; mediaId?: number }) { if (target.mediaId) { const uri = dataUris.get(target.mediaId); if (!uri) bad("A packaged learner asset is missing."); target.src = uri; } }
  const retainedSlides = resolved.slides.map(slide => {
    const doc = readCreatorDocument(slide.contentJson);
    for (const b of doc.blocks) { bind(b); if (b.assessment) { bind(b.assessment); for (const o of b.assessment.options || []) bind(o); } }
    return { ...slide, contentJson: JSON.stringify(doc) };
  });
  const retainedSettings = JSON.parse(branded.settingsJson || "{}");
  if (retainedSettings.creatorBrand?.logoMediaId) retainedSettings.creatorBrand.logoUrl = dataUris.get(retainedSettings.creatorBrand.logoMediaId) || bad("A packaged school logo is missing.");
  const html = buildCreatorRuntimeHtml({ ...branded, settingsJson: JSON.stringify(retainedSettings), slides: retainedSlides, showWatermark }, "html5");
  if (Buffer.byteLength(html) > CREATOR_SCHOOL_ARTIFACT_BYTES) bad("School delivery HTML exceeds the bounded 16 MiB artifact envelope.");
  const zip = new JSZip(); zip.file("index.html", html);
  // Preserve the complete original model without changing source project or slides.
  zip.file("creator-source.json", JSON.stringify({ version: 1, project, slides }));
  const bytes = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  if (bytes.length > CREATOR_SCHOOL_ARTIFACT_BYTES) bad("School delivery archive exceeds the bounded 16 MiB artifact envelope.");
  return { bytes, sha256: createHash("sha256").update(bytes).digest("hex"), format: "html5" as const, launchFile: "index.html" as const, mediaCount: dataUris.size, mediaSnapshots };
}
