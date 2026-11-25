/**
 * Media upload routes — handles direct file uploads from the browser.
 * Mounted at /api/media-upload in server/_core/index.ts
 *
 * POST /api/media-upload
 *   Accepts: multipart/form-data with fields:
 *     - file: the file to upload
 *     - orgId: optional active-organization consistency hint
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
import { authenticateRequest } from "./authHelper";
import { getDb } from "./db";
import { requireActiveMediaOrganization } from "./formsRouter";
import { TRPCError } from "@trpc/server";
import { orgMediaLibrary } from "../drizzle/schema";
import { and, eq } from "drizzle-orm";

class MediaUploadRouteError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function parseOptionalOrganizationId(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" && typeof value !== "number") {
    throw new MediaUploadRouteError(400, "Organization ID must be a positive integer.");
  }
  const orgId = Number(value);
  if (!Number.isSafeInteger(orgId) || orgId <= 0) {
    throw new MediaUploadRouteError(400, "Organization ID must be a positive integer.");
  }
  return orgId;
}

function normalizeMediaFolder(value: unknown): string {
  const folder = String(value ?? "media")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return folder || "media";
}

function assertMediaReplacementKeyOrganization(fileKey: string, orgId: number): void {
  // Known scoped keys must agree with the authoritative row. Opaque historical
  // keys remain usable; do not rename or backfill existing objects.
  const scoped = /^(?:org-(\d+)\/|(?:org-media|lms-media)\/(\d+)\/)/.exec(fileKey);
  const keyOrgId = scoped ? Number(scoped[1] ?? scoped[2]) : undefined;
  if (keyOrgId !== undefined && keyOrgId !== orgId) {
    throw new MediaUploadRouteError(403, "Media storage key does not belong to the active organization.");
  }
}

async function requireActiveMediaUploadOrganization(
  user: { id: number; role?: string | null },
  requestedOrgId?: number,
): Promise<number> {
  try {
    return await requireActiveMediaOrganization(user.id, requestedOrgId);
  } catch (error) {
    if (error instanceof TRPCError && error.code === "FORBIDDEN") {
      throw new MediaUploadRouteError(403, error.message.replace("managing media", "uploading media").replace("manage media", "upload media"));
    }
    if (error instanceof TRPCError && error.code === "INTERNAL_SERVER_ERROR") {
      throw new MediaUploadRouteError(503, "Database unavailable");
    }
    throw error;
  }
}

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

    const orgId = await requireActiveMediaUploadOrganization(
      user,
      parseOptionalOrganizationId(req.body.orgId),
    );
    const folder = normalizeMediaFolder(req.body.folder);
    const safeName = req.file.originalname
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 100);
    const key = `org-${orgId}/${folder}/${Date.now()}-${nanoid(8)}-${safeName}`;

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
    if (err instanceof MediaUploadRouteError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("[media-upload] error:", err instanceof Error ? err.name : "unknown error");
    res.status(500).json({ error: "Upload failed" });
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
    const activeOrgId = await requireActiveMediaUploadOrganization(user, parseOptionalOrganizationId(req.body.orgId));

    if (!req.file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }

    const mediaItemId = req.body.mediaItemId ? Number(req.body.mediaItemId) : 0;
    if ((typeof req.body.mediaItemId !== "string" && typeof req.body.mediaItemId !== "number") || !Number.isSafeInteger(mediaItemId) || mediaItemId <= 0) {
      res.status(400).json({ error: "mediaItemId must be a positive integer" });
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
      .where(and(eq(orgMediaLibrary.id, mediaItemId), eq(orgMediaLibrary.orgId, activeOrgId)))
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
    if (item.orgId !== activeOrgId) {
      res.status(404).json({ error: "Media item not found in the active organization" });
      return;
    }
    assertMediaReplacementKeyOrganization(item.fileKey, activeOrgId);

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
      .where(and(eq(orgMediaLibrary.id, mediaItemId), eq(orgMediaLibrary.orgId, activeOrgId)));

    res.json({
      key: item.fileKey,
      url,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      fileType: req.file.mimetype || item.mimeType,
    });
  } catch (err: any) {
    if (err instanceof MediaUploadRouteError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("[media-upload/replace] error:", err instanceof Error ? err.name : "unknown error");
    res.status(500).json({ error: "Replace failed" });
  }
});

export default router;
