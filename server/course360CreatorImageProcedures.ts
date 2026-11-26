import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "./_core/trpc";
import { getDb, getOrgStorageUsage } from "./db";
import { orgMediaLibrary } from "../drizzle/schema";
import { requireCourse360AppCapability } from "./lib/course360AppCapabilities";
import { requireActiveMediaOrganization } from "./formsRouter";
import { CREATOR_IMAGE_MAX_BYTES, verifyCreatorImageBytes } from "./course360CreatorImageBytes";
import { creatorImageProviderStatus, generateCreatorConfiguredImageBytes } from "./course360CreatorImageProvider";
import { creatorImageStorageStatus, saveCreatorOwnedImageBytes } from "./course360CreatorImageStorage";

const orgInput = z.object({ expectedOrgId: z.number().int().positive() }).strict();
const requestInput = orgInput.extend({ requestId: z.string().uuid() }).strict();
const generateInput = requestInput.extend({ prompt: z.string().trim().min(1).max(4000), consentToGenerate: z.literal(true), consentToSaveToMainLibrary: z.literal(true) }).strict();
const active = new Map<string, { userId: number; orgId: number; controller: AbortController }>();
const recent = new Map<string, number>();
function failure(message: string, code: "CONFLICT" | "FORBIDDEN" | "PRECONDITION_FAILED" = "PRECONDITION_FAILED"): never { throw new TRPCError({ code, message }); }
/** Exact persisted author/school/Creator Web authority; support bypass is not a purchased capability. */
export async function requireCreatorImageScope(userId: number, expectedOrgId: number) {
  const access = await requireCourse360AppCapability(userId, "creator", "web");
  if (access.orgId !== expectedOrgId) failure("The selected school changed. No image is inserted into another school.", "CONFLICT");
  if (!access.access?.isActive || access.platformSupport || (!access.isPaid && !access.hasManualGrant)) failure("Paid Creator Web or an explicit active Creator Web manual grant is required; platform support is not a paid capability.", "FORBIDDEN");
  const mediaOrg = await requireActiveMediaOrganization(userId, expectedOrgId);
  if (mediaOrg !== expectedOrgId) failure("Creator and main Media Library schools must match.", "FORBIDDEN");
  return access;
}
async function quota(orgId: number, size: number) {
  const usage = await getOrgStorageUsage(orgId);
  if (!Number.isSafeInteger(usage.usedBytes) || usage.usedBytes < 0 || !Number.isSafeInteger(usage.maxBytes) || usage.maxBytes < -1 || !Number.isSafeInteger(usage.usedBytes + size)) failure("Main-library quota is unavailable or invalid.");
  if (usage.maxBytes !== -1 && usage.usedBytes + size > usage.maxBytes) failure("The image exceeds the main school Media Library allowance. No Studio subscription is required.", "FORBIDDEN");
  return usage;
}
export const creatorImageProcedures = {
  creatorOwnedImageStatus: protectedProcedure.input(orgInput).mutation(async ({ ctx, input }) => {
    await requireCreatorImageScope(ctx.user.id, input.expectedOrgId);
    const provider = creatorImageProviderStatus(), storageConfigured = creatorImageStorageStatus();
    const usage = await quota(input.expectedOrgId, 0);
    const quotaAvailable = usage.maxBytes === -1 || usage.maxBytes - usage.usedBytes >= CREATOR_IMAGE_MAX_BYTES;
    return { orgId: input.expectedOrgId, ...provider, available: provider.available && storageConfigured && quotaAvailable, storageConfigured, quotaAvailable, maxImageBytes: CREATOR_IMAGE_MAX_BYTES, reason: !storageConfigured ? "Abortable owned storage is unavailable." : !quotaAvailable ? "Generation requires 8 MiB headroom in the main school library before starting; the actual saved bytes are charged to storage usage." : provider.reason };
  }),
  cancelCreatorOwnedImage: protectedProcedure.input(requestInput).mutation(async ({ ctx, input }) => {
    // A scope switch can prevent cancellation; the in-flight operation independently rereads scope before writes.
    await requireCreatorImageScope(ctx.user.id, input.expectedOrgId);
    const key = `${ctx.user.id}:${input.expectedOrgId}:${input.requestId}`, pending = active.get(key);
    if (pending) pending.controller.abort(new Error("Author cancelled image generation."));
    return { orgId: input.expectedOrgId, cancelled: !!pending };
  }),
  generateCreatorOwnedImage: protectedProcedure.input(generateInput).mutation(async ({ ctx, input }) => {
    await requireCreatorImageScope(ctx.user.id, input.expectedOrgId);
    await quota(input.expectedOrgId, CREATOR_IMAGE_MAX_BYTES);
    const provider = creatorImageProviderStatus();
    if (!provider.available || !creatorImageStorageStatus()) failure(provider.available ? "Owned image storage is not configured." : provider.reason);
    const db = await getDb(); if (!db || typeof db.transaction !== "function") failure("Transactional image metadata persistence is unavailable.");
    const now = Date.now(); for (const [k, expires] of recent) if (expires < now) recent.delete(k);
    const key = `${ctx.user.id}:${input.expectedOrgId}:${input.requestId}`;
    if (recent.has(key) || active.has(key)) failure("This image request was already submitted; use a new request ID for a deliberate new image.", "CONFLICT");
    if (active.size || recent.size >= 1000) failure("The bounded image processor is busy. Retry deliberately after it finishes.", "CONFLICT");
    const controller = new AbortController(); const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(90_000)]);
    active.set(key, { userId: ctx.user.id, orgId: input.expectedOrgId, controller }); recent.set(key, now + 15 * 60_000);
    const disconnect = () => controller.abort(new Error("Request disconnected."));
    ctx.req?.once?.("aborted", disconnect);
    try {
      await requireCreatorImageScope(ctx.user.id, input.expectedOrgId); await quota(input.expectedOrgId, CREATOR_IMAGE_MAX_BYTES); signal.throwIfAborted();
      const image = await generateCreatorConfiguredImageBytes(input.prompt, signal); signal.throwIfAborted();
      const verified = verifyCreatorImageBytes(image.bytes, image.mimeType);
      if (image.width !== verified.width || image.height !== verified.height) failure("Provider image dimensions are inconsistent.");
      await requireCreatorImageScope(ctx.user.id, input.expectedOrgId); await quota(input.expectedOrgId, image.bytes.length); signal.throwIfAborted();
      const fileKey = `org-${input.expectedOrgId}/media/creator-images/${randomUUID()}.png`;
      const stored = await saveCreatorOwnedImageBytes(input.expectedOrgId, fileKey, verified, signal); signal.throwIfAborted();
      if (stored.key !== fileKey || stored.size !== image.bytes.length || stored.mimeType !== image.mimeType || !(stored.url === `/manus-storage/${fileKey}` || stored.url === `/manus-storage/${fileKey.split("/").map(encodeURIComponent).join("/")}` || (() => { try { const u = new URL(stored.url); return u.protocol === "https:" && !u.username && !u.password && !u.hash; } catch { return false; } })())) failure("Owned storage returned an inconsistent image receipt.");
      await requireCreatorImageScope(ctx.user.id, input.expectedOrgId); await quota(input.expectedOrgId, image.bytes.length); signal.throwIfAborted();
      const alt = input.prompt.slice(0, 500), filename = `creator-image-${fileKey.split("/").at(-1)}`;
      const result = await db.transaction(async tx => {
        await requireCreatorImageScope(ctx.user.id, input.expectedOrgId); await quota(input.expectedOrgId, image.bytes.length); signal.throwIfAborted();
        const [inserted] = await tx.insert(orgMediaLibrary).values({ orgId: input.expectedOrgId, uploadedBy: ctx.user.id, filename, mimeType: image.mimeType, fileSize: image.bytes.length, fileKey, url: stored.url, source: "other", tags: JSON.stringify(["creator-generated-image"]), altText: alt });
        const mediaId = Number((inserted as any).insertId); if (!Number.isSafeInteger(mediaId) || mediaId < 1) failure("New image media row was not created.");
        const [row] = await tx.select().from(orgMediaLibrary).where(and(eq(orgMediaLibrary.id, mediaId), eq(orgMediaLibrary.orgId, input.expectedOrgId), eq(orgMediaLibrary.uploadedBy, ctx.user.id))).limit(1);
        if (!row || row.fileKey !== fileKey || row.url !== stored.url || row.fileSize !== image.bytes.length || row.mimeType !== image.mimeType) failure("New media row does not match the authoritative image receipt.");
        await requireCreatorImageScope(ctx.user.id, input.expectedOrgId); signal.throwIfAborted();
        return { orgId: input.expectedOrgId, mediaId, url: stored.url, key: fileKey, mimeType: image.mimeType, fileSize: image.bytes.length, width: image.width, height: image.height, alt };
      });
      return result;
    } catch (e) {
      if (signal.aborted) throw new TRPCError({ code: "TIMEOUT", message: "Image work was cancelled or exceeded its deadline. No image block was inserted; a completed upload may remain an unreferenced new object." });
      throw e;
    } finally { active.delete(key); ctx.req?.removeListener?.("aborted", disconnect); }
  }),
};
