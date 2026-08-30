/**
 * Media upload routes — handles direct file uploads from the browser.
 * Mounted at /api/media-upload in server/_core/index.ts
 *
 * POST /api/media-upload
 *   Accepts: multipart/form-data with fields:
 *     - file: the file to upload
 *     - orgId: the organization ID (for path namespacing)
 *     - folder: optional subfolder (e.g. "downloads", "forms", "media")
 *   Returns: { key, url, fileName, fileSize, fileType }
 *
 * POST /api/media-upload/replace
 *   Accepts: multipart/form-data with fields:
 *     - file: the replacement file
 *     - mediaItemId: the ID of the org_media_library row to replace
 *   Overwrites the same S3 key so the CDN URL stays identical.
 *   Returns: { key, url, fileName, fileSize, fileType }
 */
import express, { Request, Response } from "express";
import multer from "multer";
import { tmpdir } from "os";
import { nanoid } from "nanoid";
import { storagePutStream } from "./storage";
import { sdk } from "./_core/sdk";
import { authenticateRequest } from "./authHelper";
import { getDb, requireOrgAdmin } from "./db";
import { orgMediaLibrary } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const router = express.Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, tmpdir()),
    filename: (_req, file, cb) => {
      const ext = file.originalname.split(".").pop() ?? "bin";
      cb(null, `media-${nanoid(12)}.${ext}`);
    },
  }),
  limits: { fileSize: 3 * 1024 * 1024 * 1024 }, // 3 GB max
});

// ── POST /api/media-upload — new file upload ──────────────────────────────────
router.post("/", upload.single("file"), async (req: Request, res: Response) => {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }

    const orgId = req.body.orgId ? Number(req.body.orgId) : 0;
    if (orgId > 0) {
      await requireOrgAdmin(user.id, (user as any).role ?? "user", orgId);
    }
    const folder = (req.body.folder as string) ?? "media";
    const safeName = req.file.originalname
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 100);
    const key = `${folder}/${orgId}/${Date.now()}-${nanoid(8)}-${safeName}`;

    const { url } = await storagePutStream(
      key,
      req.file.path,
      req.file.mimetype || "application/octet-stream"
    );

    res.json({
      key,
      url,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      fileType: req.file.mimetype,
    });
  } catch (err: any) {
    console.error("[media-upload] error:", err);
    res.status(500).json({ error: err.message ?? "Upload failed" });
  }
});

// ── POST /api/media-upload/replace — replace existing file, keep same URL ────
router.post("/replace", upload.single("file"), async (req: Request, res: Response) => {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }

    const mediaItemId = req.body.mediaItemId ? Number(req.body.mediaItemId) : 0;
    if (!mediaItemId) {
      res.status(400).json({ error: "mediaItemId is required" });
      return;
    }

    const db = await getDb();
    if (!db) {
      res.status(503).json({ error: "Database unavailable" });
      return;
    }

    // Fetch the existing media item to get the S3 key and verify ownership
    const rows = await db
      .select()
      .from(orgMediaLibrary)
      .where(eq(orgMediaLibrary.id, mediaItemId))
      .limit(1);

    const item = rows[0];
    if (!item) {
      res.status(404).json({ error: "Media item not found" });
      return;
    }

    if (!item.orgId) {
      res.status(403).json({ error: "Media item is not associated with an organization" });
      return;
    }
    await requireOrgAdmin(user.id, (user as any).role ?? "user", item.orgId);

    // Overwrite the same S3 key — the CDN URL will remain identical
    const { url } = await storagePutStream(
      item.fileKey,
      req.file.path,
      req.file.mimetype || item.mimeType || "application/octet-stream"
    );

    // Update DB metadata: new filename, size, mime type, and updatedAt (auto-updated by ORM)
    await db
      .update(orgMediaLibrary)
      .set({
        filename: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype || item.mimeType,
      })
      .where(eq(orgMediaLibrary.id, mediaItemId));

    res.json({
      key: item.fileKey,
      url,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      fileType: req.file.mimetype || item.mimeType,
    });
  } catch (err: any) {
    console.error("[media-upload/replace] error:", err);
    res.status(500).json({ error: err.message ?? "Replace failed" });
  }
});

export default router;
