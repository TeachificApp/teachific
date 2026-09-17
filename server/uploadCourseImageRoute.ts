/**
 * POST /api/upload-course-image
 *
 * Accepts a multipart/form-data file upload and stores it in S3.
 * Used by RichTextEditor for pasted/dropped images.
 * Returns: { url }
 */
import { Router, Request, Response } from "express";
import multer from "multer";
import { tmpdir } from "os";
import { nanoid } from "nanoid";
import { storagePutStream } from "./storage";
import { authenticateRequest } from "./authHelper";
import { getOrgIdForUserWithFallback, requireOrgAdmin } from "./db";
import { unlink } from "node:fs/promises";

const router = Router();
const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
]);
const IMAGE_EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
};

export function isAllowedCourseImageMime(mimeType: string | undefined) {
  return Boolean(mimeType && ALLOWED_IMAGE_MIME_TYPES.has(mimeType.toLowerCase()));
}

export function imageExtensionForMime(mimeType: string) {
  return IMAGE_EXTENSION_BY_MIME[mimeType.toLowerCase()];
}

export function createCourseImageStorageKey(orgId: number, extension: string) {
  return `course-images/org-${orgId}/${Date.now()}-${nanoid(8)}.${extension}`;
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, tmpdir()),
    filename: (_req, file, cb) => {
      const ext = file.originalname.split(".").pop() ?? "png";
      cb(null, `course-img-${nanoid(12)}.${ext}`);
    },
  }),
  limits: { fileSize: MAX_IMAGE_UPLOAD_BYTES },
});

router.post("/", upload.single("file"), async (req: Request, res: Response) => {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const orgId = await getOrgIdForUserWithFallback(user.id, user.role);
    if (!orgId) {
      res.status(403).json({ error: "Organization administrator access is required." });
      return;
    }
    try {
      await requireOrgAdmin(user.id, user.role, orgId);
    } catch {
      res.status(403).json({ error: "Organization administrator access is required." });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }
    if (!isAllowedCourseImageMime(req.file.mimetype)) {
      res.status(400).json({ error: "Upload a PNG, JPEG, GIF, WebP, or AVIF image." });
      return;
    }
    const ext = imageExtensionForMime(req.file.mimetype);
    if (!ext) {
      res.status(400).json({ error: "Upload a supported image file." });
      return;
    }
    const key = createCourseImageStorageKey(orgId, ext);
    const { url } = await storagePutStream(key, req.file.path, req.file.mimetype || "image/png");
    res.json({ url });
  } catch (error) {
    console.error(`[upload-course-image] ${error instanceof Error ? error.name : "unknown error"}`);
    res.status(500).json({ error: "Upload failed" });
  } finally {
    if (req.file?.path) await unlink(req.file.path).catch(() => undefined);
  }
});

export default router;
