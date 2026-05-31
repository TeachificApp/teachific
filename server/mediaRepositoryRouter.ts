/**
 * Media Repository Router
 * Org-level media asset management with versioning, access control, and S3 integration
 */
import { TRPCError } from "@trpc/server";
import { eq, desc, and, or, like, count } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { storagePut, storageGet } from "./storage";
import {
  mediaFolders,
  mediaAssets,
  mediaVersions,
  mediaAccessRules,
  mediaAccessGrants,
  mediaViewEvents,
  organizations,
} from "../drizzle/schema";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getFolderById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(mediaFolders).where(eq(mediaFolders.id, id)).limit(1);
  return rows[0];
}

async function getAssetById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1);
  return rows[0];
}

async function getVersionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(mediaVersions).where(eq(mediaVersions.id, id)).limit(1);
  return rows[0];
}

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ── Router ───────────────────────────────────────────────────────────────────

export const mediaRepositoryRouter = router({
  // ── Folders ────────────────────────────────────────────────────────────────

  /** List folders in an org */
  listFolders: protectedProcedure
    .input(z.object({ orgId: z.number(), parentFolderId: z.number().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const query = db.select().from(mediaFolders).where(
        and(
          eq(mediaFolders.orgId, input.orgId),
          input.parentFolderId ? eq(mediaFolders.parentFolderId, input.parentFolderId) : eq(mediaFolders.parentFolderId, null)
        )
      ).orderBy(desc(mediaFolders.createdAt));
      return query;
    }),

  /** Create a folder */
  createFolder: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      name: z.string().min(1).max(255),
      parentFolderId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const slug = slugify(input.name) || "folder";
      await db.insert(mediaFolders).values({
        orgId: input.orgId,
        name: input.name,
        slug,
        parentFolderId: input.parentFolderId ?? null,
      });
      return { success: true };
    }),

  /** Delete a folder (and all contents) */
  deleteFolder: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(mediaFolders).where(eq(mediaFolders.id, input.id));
      return { success: true };
    }),

  // ── Assets ─────────────────────────────────────────────────────────────────

  /** List assets in a folder or org */
  listAssets: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      folderId: z.number().optional(),
      search: z.string().optional(),
      type: z.enum(["image", "video", "audio", "document", "all"]).default("all"),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      let query = db.select().from(mediaAssets).where(eq(mediaAssets.orgId, input.orgId));
      
      if (input.folderId) {
        query = query.where(eq(mediaAssets.folderId, input.folderId));
      }
      if (input.search) {
        query = query.where(like(mediaAssets.filename, `%${input.search}%`));
      }
      if (input.type !== "all") {
        query = query.where(eq(mediaAssets.type, input.type));
      }
      return query.orderBy(desc(mediaAssets.createdAt));
    }),

  /** Get asset details with versions */
  getAsset: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "NOT_FOUND" });
      const asset = await getAssetById(input.id);
      if (!asset) throw new TRPCError({ code: "NOT_FOUND" });
      const versions = await db.select().from(mediaVersions).where(eq(mediaVersions.assetId, input.id)).orderBy(desc(mediaVersions.createdAt));
      return { ...asset, versions };
    }),

  /** Upload a new asset */
  uploadAsset: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      folderId: z.number().optional(),
      filename: z.string().min(1),
      mimeType: z.string(),
      fileData: z.string(), // base64 encoded
      description: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Determine asset type from mime type
      let assetType: "image" | "video" | "audio" | "document" = "document";
      if (input.mimeType.startsWith("image/")) assetType = "image";
      else if (input.mimeType.startsWith("video/")) assetType = "video";
      else if (input.mimeType.startsWith("audio/")) assetType = "audio";

      // Upload to S3
      const fileBuffer = Buffer.from(input.fileData, "base64");
      const fileKey = `${input.orgId}/media/${nanoid()}-${input.filename}`;
      const { url } = await storagePut(fileKey, fileBuffer, input.mimeType);

      // Create asset record
      const result = await db.insert(mediaAssets).values({
        orgId: input.orgId,
        folderId: input.folderId ?? null,
        filename: input.filename,
        type: assetType,
        mimeType: input.mimeType,
        fileSize: fileBuffer.length,
        s3Key: fileKey,
        s3Url: url,
        description: input.description ?? null,
      });

      // Create initial version
      await db.insert(mediaVersions).values({
        assetId: Number(result.lastInsertRowid ?? 0),
        versionNumber: 1,
        s3Key: fileKey,
        s3Url: url,
        fileSize: fileBuffer.length,
        uploadedBy: "system",
      });

      return { success: true, assetId: result.lastInsertRowid };
    }),

  /** Delete an asset */
  deleteAsset: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(mediaAssets).where(eq(mediaAssets.id, input.id));
      return { success: true };
    }),

  // ── Access Control ─────────────────────────────────────────────────────────

  /** Get access rules for an asset */
  getAccessRules: protectedProcedure
    .input(z.object({ assetId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(mediaAccessRules).where(eq(mediaAccessRules.assetId, input.assetId));
    }),

  /** Create an access rule (e.g., course members only) */
  createAccessRule: protectedProcedure
    .input(z.object({
      assetId: z.number(),
      ruleType: z.enum(["public", "course_members", "org_members", "specific_users"]),
      courseId: z.number().optional(),
      userIds: z.array(z.number()).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.insert(mediaAccessRules).values({
        assetId: input.assetId,
        ruleType: input.ruleType,
        courseId: input.courseId ?? null,
        metadata: JSON.stringify({ userIds: input.userIds ?? [] }),
      });
      return { success: true };
    }),

  /** Delete an access rule */
  deleteAccessRule: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(mediaAccessRules).where(eq(mediaAccessRules.id, input.id));
      return { success: true };
    }),

  // ── Analytics ──────────────────────────────────────────────────────────────

  /** Log a media view event */
  logViewEvent: protectedProcedure
    .input(z.object({
      assetId: z.number(),
      userId: z.number(),
      duration: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.insert(mediaViewEvents).values({
        assetId: input.assetId,
        userId: input.userId,
        duration: input.duration ?? 0,
      });
      return { success: true };
    }),

  /** Get view analytics for an asset */
  getViewAnalytics: protectedProcedure
    .input(z.object({ assetId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { totalViews: 0, uniqueUsers: 0, averageDuration: 0 };
      const events = await db.select().from(mediaViewEvents).where(eq(mediaViewEvents.assetId, input.assetId));
      const uniqueUsers = new Set(events.map(e => e.userId)).size;
      const totalDuration = events.reduce((sum, e) => sum + (e.duration ?? 0), 0);
      const averageDuration = events.length > 0 ? totalDuration / events.length : 0;
      return {
        totalViews: events.length,
        uniqueUsers,
        averageDuration,
      };
    }),
});
