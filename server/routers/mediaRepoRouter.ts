/**
 * mediaRepoRouter — Media Repository tRPC procedures
 *
 * Provides:
 *  - listAssets: paginated list of org media assets (for pickers in block editors)
 *  - uploadPageMedia: base64 → S3 upload, records in media_assets (used by block editors)
 *  - updateAsset: update title/description/mediaType
 *  - deleteAsset: soft-delete by removing from S3 and DB
 */

import { z } from "zod";
import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { mediaAssets } from "../../drizzle/schema";
import { storagePut } from "../storage";

// ── Helpers ────────────────────────────────────────────────────────────────────

function deriveMediaType(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (
    mimeType === "application/pdf" ||
    mimeType.includes("word") ||
    mimeType.includes("spreadsheet") ||
    mimeType.includes("presentation") ||
    mimeType.includes("text/")
  )
    return "document";
  if (
    mimeType === "application/zip" ||
    mimeType === "application/x-zip-compressed"
  )
    return "archive";
  return "other";
}

function generateSlug(filename: string): string {
  const base = filename
    .replace(/\.[^.]+$/, "") // strip extension
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base}-${nanoid(8)}`;
}

// ── Router ─────────────────────────────────────────────────────────────────────

export const mediaRepoRouter = router({
  /**
   * List media assets for the current user's org.
   * Used by block editor media pickers.
   */
  listAssets: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        mediaType: z.string().optional(), // "image" | "video" | "audio" | "document" | "archive" | "other"
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(24),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { assets: [], total: 0, page: input.page, pageSize: input.pageSize };

      // Resolve orgId from org membership
      const { orgMembers } = await import("../../drizzle/schema");
      const membership = await db
        .select({ orgId: orgMembers.orgId })
        .from(orgMembers)
        .where(eq(orgMembers.userId, ctx.user.id))
        .limit(1);
      if (!membership.length) return { assets: [], total: 0, page: input.page, pageSize: input.pageSize };
      const orgId = membership[0].orgId;

      const conditions = [eq(mediaAssets.orgId, orgId)];
      if (input.search) {
        conditions.push(
          or(
            like(mediaAssets.filename, `%${input.search}%`),
            like(mediaAssets.title, `%${input.search}%`)
          ) as any
        );
      }
      if (input.mediaType) {
        conditions.push(eq(mediaAssets.mediaType as any, input.mediaType));
      }

      const offset = (input.page - 1) * input.pageSize;

      const [rows, countRows] = await Promise.all([
        db
          .select()
          .from(mediaAssets)
          .where(and(...conditions))
          .orderBy(desc(mediaAssets.createdAt))
          .limit(input.pageSize)
          .offset(offset),
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(mediaAssets)
          .where(and(...conditions)),
      ]);

      const total = Number(countRows[0]?.count ?? 0);

      // Shape assets to match what block editors expect
      const assets = rows.map((a) => ({
        id: a.id,
        slug: a.slug ?? "",
        title: a.title ?? a.filename,
        mediaType: a.mediaType ?? deriveMediaType(a.mimeType),
        mimeType: a.mimeType,
        description: a.description ?? "",
        createdAt: a.createdAt,
        // currentVersion shape (mirrors ultrasound-app pattern)
        currentVersion: {
          s3Url: a.s3Url,
          s3Key: a.s3Key,
          fileName: a.filename,
          fileSize: Number(a.size),
          mimeType: a.mimeType,
        },
      }));

      return { assets, total, page: input.page, pageSize: input.pageSize };
    }),

  /**
   * Upload a file from a base64 data URI and record it in media_assets.
   * Used by block editors (image, video, file_download blocks).
   */
  uploadPageMedia: protectedProcedure
    .input(
      z.object({
        dataUri: z.string().min(10),
        mimeType: z.string().min(1),
        fileName: z.string().min(1),
        context: z.string().optional(), // e.g. "file-download-block", "image-block"
        title: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Resolve orgId
      const { orgMembers } = await import("../../drizzle/schema");
      const membership = await db
        .select({ orgId: orgMembers.orgId })
        .from(orgMembers)
        .where(eq(orgMembers.userId, ctx.user.id))
        .limit(1);
      const orgId = membership.length ? membership[0].orgId : 0;

      // Decode base64 data URI
      const matches = input.dataUri.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) throw new Error("Invalid data URI format");
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, "base64");

      if (buffer.length > 200 * 1024 * 1024) {
        throw new Error("File must be under 200 MB");
      }

      const safeName = input.fileName
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .slice(0, 100);
      const context = input.context ?? "page-media";
      const key = `${context}/${orgId}/${Date.now()}-${nanoid(8)}-${safeName}`;

      const { url } = await storagePut(key, buffer, input.mimeType);

      const slug = generateSlug(input.fileName);
      const mediaType = deriveMediaType(input.mimeType);

      // Record in media_assets
      const [inserted] = await db
        .insert(mediaAssets)
        .values({
          orgId,
          filename: input.fileName,
          mimeType: input.mimeType,
          size: buffer.length,
          s3Key: key,
          s3Url: url,
          uploadedBy: ctx.user.id,
          slug,
          title: input.title ?? input.fileName,
          mediaType,
        })
        .$returningId();

      return {
        id: inserted?.id ?? 0,
        url,
        key,
        slug,
        fileName: input.fileName,
        fileSize: buffer.length,
        mimeType: input.mimeType,
        mediaType,
      };
    }),

  /**
   * Update asset metadata (title, description, mediaType).
   */
  updateAsset: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        title: z.string().optional(),
        description: z.string().optional(),
        mediaType: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const { orgMembers } = await import("../../drizzle/schema");
      const membership = await db
        .select({ orgId: orgMembers.orgId })
        .from(orgMembers)
        .where(eq(orgMembers.userId, ctx.user.id))
        .limit(1);
      if (!membership.length) throw new Error("No org membership");
      const orgId = membership[0].orgId;

      // Verify ownership
      const [asset] = await db
        .select({ id: mediaAssets.id })
        .from(mediaAssets)
        .where(and(eq(mediaAssets.id, input.id), eq(mediaAssets.orgId, orgId)))
        .limit(1);
      if (!asset) throw new Error("Asset not found");

      const updates: Record<string, any> = {};
      if (input.title !== undefined) updates.title = input.title;
      if (input.description !== undefined) updates.description = input.description;
      if (input.mediaType !== undefined) updates.mediaType = input.mediaType;

      if (Object.keys(updates).length > 0) {
        await db
          .update(mediaAssets)
          .set(updates)
          .where(eq(mediaAssets.id, input.id));
      }

      return { success: true };
    }),

  /**
   * Delete a media asset (removes from DB; S3 key is kept for audit).
   */
  deleteAsset: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const { orgMembers } = await import("../../drizzle/schema");
      const membership = await db
        .select({ orgId: orgMembers.orgId })
        .from(orgMembers)
        .where(eq(orgMembers.userId, ctx.user.id))
        .limit(1);
      if (!membership.length) throw new Error("No org membership");
      const orgId = membership[0].orgId;

      const [asset] = await db
        .select({ id: mediaAssets.id, orgId: mediaAssets.orgId })
        .from(mediaAssets)
        .where(and(eq(mediaAssets.id, input.id), eq(mediaAssets.orgId, orgId)))
        .limit(1);
      if (!asset) throw new Error("Asset not found");

      await db.delete(mediaAssets).where(eq(mediaAssets.id, input.id));
      return { success: true };
    }),
});
