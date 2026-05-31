/**
 * mediaRouter — Org-level media repository management
 *
 * Procedures:
 *   folders.list      — list media folders
 *   folders.create    — create media folder
 *   folders.update    — update media folder
 *   folders.delete    — delete media folder
 *   assets.list       — list media assets
 *   assets.upload     — upload media asset
 *   assets.update     — update asset metadata
 *   assets.delete     — delete asset
 *   assets.versions   — list asset versions
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import {
  mediaFolders,
  mediaAssets,
  mediaVersions,
} from "../drizzle/schema";
import { nanoid } from "nanoid";
import { storagePut } from "./storage";

// ─── Media Router ─────────────────────────────────────────────────────────────

export const mediaRouter = router({
  // ── Folders ────────────────────────────────────────────────────────────────

  folders: router({
    list: protectedProcedure
      .input(z.object({ orgId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        
        return db
          .select()
          .from(mediaFolders)
          .where(eq(mediaFolders.orgId, input.orgId))
          .orderBy(desc(mediaFolders.createdAt));
      }),

    create: protectedProcedure
      .input(z.object({
        orgId: z.number(),
        name: z.string().min(1),
        parentFolderId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        await db.insert(mediaFolders).values({
          orgId: input.orgId,
          name: input.name,
          parentFolderId: input.parentFolderId ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        
        const created = await db
          .select()
          .from(mediaFolders)
          .where(and(
            eq(mediaFolders.orgId, input.orgId),
            eq(mediaFolders.name, input.name),
          ))
          .orderBy(desc(mediaFolders.createdAt))
          .limit(1);
        
        return created[0];
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        const { id, ...updates } = input;
        await db
          .update(mediaFolders)
          .set({ ...updates, updatedAt: new Date() })
          .where(eq(mediaFolders.id, id));
        
        return db.select().from(mediaFolders).where(eq(mediaFolders.id, id)).limit(1);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        await db.delete(mediaFolders).where(eq(mediaFolders.id, input.id));
        return { success: true };
      }),
  }),

  // ── Assets ─────────────────────────────────────────────────────────────────

  assets: router({
    list: protectedProcedure
      .input(z.object({ 
        orgId: z.number(),
        folderId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        
        let query = db
          .select()
          .from(mediaAssets)
          .where(eq(mediaAssets.orgId, input.orgId));
        
        if (input.folderId) {
          query = query.where(eq(mediaAssets.folderId, input.folderId));
        }
        
        return query.orderBy(desc(mediaAssets.createdAt));
      }),

    upload: protectedProcedure
      .input(z.object({
        orgId: z.number(),
        folderId: z.number().optional(),
        filename: z.string().min(1),
        mimeType: z.string(),
        fileBuffer: z.instanceof(Buffer),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        // Upload to S3
        const fileKey = `org-${input.orgId}/media/${nanoid()}-${input.filename}`;
        const { url } = await storagePut(fileKey, input.fileBuffer, input.mimeType);
        
        // Create asset record
        const assetId = nanoid();
        await db.insert(mediaAssets).values({
          orgId: input.orgId,
          assetId,
          filename: input.filename,
          mimeType: input.mimeType,
          s3Key: fileKey,
          s3Url: url,
          folderId: input.folderId ?? null,
          fileSize: input.fileBuffer.length,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        
        // Create initial version
        await db.insert(mediaVersions).values({
          assetId,
          versionNumber: 1,
          s3Key: fileKey,
          s3Url: url,
          fileSize: input.fileBuffer.length,
          createdAt: new Date(),
        });
        
        const created = await db
          .select()
          .from(mediaAssets)
          .where(eq(mediaAssets.assetId, assetId))
          .limit(1);
        
        return created[0];
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        filename: z.string().optional(),
        folderId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        const { id, ...updates } = input;
        await db
          .update(mediaAssets)
          .set({ ...updates, updatedAt: new Date() })
          .where(eq(mediaAssets.id, id));
        
        return db.select().from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        // Delete versions first
        const asset = await db
          .select()
          .from(mediaAssets)
          .where(eq(mediaAssets.id, input.id))
          .limit(1);
        
        if (asset.length) {
          await db
            .delete(mediaVersions)
            .where(eq(mediaVersions.assetId, asset[0].assetId));
        }
        
        await db.delete(mediaAssets).where(eq(mediaAssets.id, input.id));
        return { success: true };
      }),

    versions: protectedProcedure
      .input(z.object({ assetId: z.string() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        
        return db
          .select()
          .from(mediaVersions)
          .where(eq(mediaVersions.assetId, input.assetId))
          .orderBy(desc(mediaVersions.versionNumber));
      }),
  }),
});
