/**
 * Chunked upload routes — splits large ZIPs into 5 MB pieces to bypass proxy body limits.
 * Mounted at /api/chunked in server/_core/index.ts
 *
 * Flow for version upload:
 *   POST /api/chunked/version/:packageId/initiate   → { uploadId }
 *   POST /api/chunked/version/:packageId/chunk/:uploadId  (repeat per chunk, 5 MB each)
 *   POST /api/chunked/version/:packageId/finalize/:uploadId → assembles + processes directly
 *
 * The finalize handler calls processZipVersion() directly (no internal HTTP forward),
 * so the assembled file never crosses the proxy again.
 */
import express, { Request, Response } from "express";
import multer from "multer";
import { existsSync, unlinkSync, createWriteStream, createReadStream, statSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { nanoid } from "nanoid";
import { and, eq, sql } from "drizzle-orm";
import { processZipVersion, processZip, emitProgress } from "./scormUploadRoutes";
import { storageDelete, storagePutStream } from "./storage";
import { getDb, getPackageById, updatePackage, createPackage, requireOrgAdmin, getOrgIdForUserWithFallback } from "./db";
import { sdk } from "./_core/sdk";
import { authenticateRequest } from "./authHelper";
import { ENV } from "./_core/env";
import { mediaAssets, mediaFolders, mediaVersions } from "../drizzle/schema";
import { initialScormExtractionStatus, queueScormExtractionIfNeeded } from "./lib/scormPackage";

const LARGE_FILE_LIMIT = 3 * 1024 * 1024 * 1024; // 3 GB

const router = express.Router();

// ── Chunk multer — each chunk is a small binary blob ─────────────────────────
const chunkUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, tmpdir()),
    filename: (_req, file, cb) => cb(null, `chunk-${nanoid(12)}-${file.originalname}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per chunk max (client sends 1 MB chunks)
});

// ── In-memory upload session registry ────────────────────────────────────────
interface UploadSession {
  uploadId: string;
  authUserId: number;
  totalChunks: number;
  receivedChunks: Set<number>;
  chunkPaths: Map<number, string>;
  filename: string;
}

const sessions = new Map<string, UploadSession>();

// ── In-memory new-package session registry ───────────────────────────────────
interface NewPackageSession extends UploadSession {
  orgId: number;
  uploadedBy: number;
  title: string;
  displayMode: string;
  lmsShellConfig?: string;
}
const newPackageSessions = new Map<string, NewPackageSession>();

// ── POST /api/chunked/package/initiate ────────────────────────────────────────
router.post("/package/initiate", express.json(), async (req: Request, res: Response) => {
  const user = await authenticateRequest(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  const { totalChunks, filename, totalBytes, orgId, uploadedBy, title, displayMode, lmsShellConfig } = req.body;
  if (!totalChunks || !filename || !orgId || !uploadedBy) {
    return res.status(400).json({ error: "totalChunks, filename, orgId and uploadedBy are required" });
  }
  const parsedOrgId = parseInt(String(orgId), 10);
  const parsedUploadedBy = parseInt(String(uploadedBy), 10);
  if (parsedUploadedBy !== user.id) return res.status(403).json({ error: "Upload user does not match the authenticated user" });
  try {
    await requireOrgAdmin(user.id, user.role, parsedOrgId);
  } catch {
    return res.status(403).json({ error: "You are not authorized to upload content for this organization" });
  }
  const fileSizeBytes = parseInt(String(totalBytes ?? "0"), 10);
  if (fileSizeBytes > LARGE_FILE_LIMIT) {
    const isOwner = !!(user.role === "site_owner" || user.role === "site_admin" || user.openId === ENV.ownerOpenId);
    if (!isOwner) return res.status(403).json({ error: "File size is restricted to 3 GB." });
  }
  const uploadId = nanoid(16);
  newPackageSessions.set(uploadId, {
    uploadId,
    totalChunks: parseInt(String(totalChunks), 10),
    receivedChunks: new Set(),
    chunkPaths: new Map(),
    filename: String(filename),
    orgId: parsedOrgId,
    uploadedBy: parsedUploadedBy,
    authUserId: user.id,
    title: String(title ?? String(filename).replace(/\.zip$/i, "").replace(/[-_]/g, " ")),
    displayMode: String(displayMode ?? "native"),
    lmsShellConfig: lmsShellConfig ? String(lmsShellConfig) : undefined,
  });
  return res.json({ uploadId });
});

// ── POST /api/chunked/package/chunk/:uploadId ─────────────────────────────────
router.post(
  "/package/chunk/:uploadId",
  chunkUpload.single("chunk"),
  async (req: Request, res: Response) => {
    const { uploadId } = req.params;
    const session = newPackageSessions.get(uploadId);
    const chunkIndex = parseInt(String(req.body.chunkIndex ?? "-1"), 10);
    const tmpPath = (req.file as (Express.Multer.File & { path: string }) | undefined)?.path;
    const user = await authenticateRequest(req);
    if (!session) {
      if (tmpPath && existsSync(tmpPath)) unlinkSync(tmpPath);
      return res.status(404).json({ error: "Upload session not found" });
    }
    if (!user || user.id !== session.authUserId) {
      if (tmpPath && existsSync(tmpPath)) unlinkSync(tmpPath);
      return res.status(403).json({ error: "Upload session does not belong to the authenticated user" });
    }
    if (chunkIndex < 0 || chunkIndex >= session.totalChunks) {
      if (tmpPath && existsSync(tmpPath)) unlinkSync(tmpPath);
      return res.status(400).json({ error: "Invalid chunkIndex" });
    }
    if (!req.file || !tmpPath) return res.status(400).json({ error: "No chunk data received" });
    session.chunkPaths.set(chunkIndex, tmpPath);
    session.receivedChunks.add(chunkIndex);
    return res.json({ uploadId, chunkIndex, received: session.receivedChunks.size, total: session.totalChunks });
  }
);

// ── POST /api/chunked/package/finalize/:uploadId ──────────────────────────────
router.post("/package/finalize/:uploadId", express.json(), async (req: Request, res: Response) => {
  const { uploadId } = req.params;
  const session = newPackageSessions.get(uploadId);
  if (!session) return res.status(404).json({ error: "Upload session not found" });
  if (session.receivedChunks.size !== session.totalChunks) {
    return res.status(400).json({
      error: `Missing chunks: received ${session.receivedChunks.size} of ${session.totalChunks}`,
    });
  }
  const user = await authenticateRequest(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (user.id !== session.authUserId) return res.status(403).json({ error: "Upload session does not belong to the authenticated user" });
  try {
    await requireOrgAdmin(user.id, user.role, session.orgId);
  } catch {
    return res.status(403).json({ error: "You are not authorized to upload content for this organization" });
  }
  const assembledPath = join(tmpdir(), `pkg-assembled-${uploadId}-${session.filename}`);
  try {
    await assembleChunks(session, assembledPath);
    // Free chunk temp files immediately
    session.chunkPaths.forEach((p) => { try { if (existsSync(p)) unlinkSync(p); } catch { /* ignore */ } });
    newPackageSessions.delete(uploadId);
    const fileSize = statSync(assembledPath).size;
    const suffix = nanoid(8);
    const { orgId, uploadedBy, title, displayMode, lmsShellConfig } = session;
    const zipKey = `orgs/${orgId}/packages/${suffix}/${session.filename}`;
    const { url: zipUrl } = await storagePutStream(zipKey, assembledPath, "application/zip");
    await createPackage({
      orgId,
      uploadedBy,
      title,
      originalZipKey: zipKey,
      originalZipUrl: zipUrl,
      originalZipSize: fileSize,
      contentType: "unknown",
      scormVersion: "none",
      displayMode,
      lmsShellConfig,
      status: "processing",
    });
    const { getDb } = await import("./db");
    const { contentPackages } = await import("../drizzle/schema");
    const { desc, eq } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) {
      if (existsSync(assembledPath)) unlinkSync(assembledPath);
      return res.status(500).json({ error: "DB unavailable" });
    }
    const pkgs = await db.select().from(contentPackages)
      .where(eq(contentPackages.orgId, orgId))
      .orderBy(desc(contentPackages.createdAt))
      .limit(1);
    const pkg = pkgs[0];
    if (!pkg) {
      if (existsSync(assembledPath)) unlinkSync(assembledPath);
      return res.status(500).json({ error: "Package creation failed" });
    }
    // Respond immediately — processing runs in background
    res.json({ packageId: pkg.id, zipUrl, status: "processing", message: "Upload received. Processing in background." });
    // Process ZIP asynchronously
    processZip(assembledPath, fileSize, pkg.id, orgId, suffix).catch((err) => {
      console.error(`[Chunked Package] Package ${pkg.id} failed:`, err);
      emitProgress(pkg.id, 0, 1, "error");
      updatePackage(pkg.id, { status: "error", processingError: String(err) }).catch(console.error);
    });
  } catch (err: unknown) {
    session.chunkPaths.forEach((p) => { try { if (existsSync(p)) unlinkSync(p); } catch { /* ignore */ } });
    newPackageSessions.delete(uploadId);
    if (existsSync(assembledPath)) { try { unlinkSync(assembledPath); } catch { /* ignore */ } }
    console.error("[Chunked Package Finalize] Error:", err);
    return res.status(500).json({ error: "Finalize failed", detail: String(err) });
  }
});

// ── POST /api/chunked/version/:packageId/initiate ─────────────────────────────
router.post("/version/:packageId/initiate", express.json(), async (req: Request, res: Response) => {
  const user = await authenticateRequest(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  const packageId = parseInt(req.params.packageId, 10);
  const pkg = await getPackageById(packageId);
  if (!pkg) return res.status(404).json({ error: "Package not found" });
  try {
    await requireOrgAdmin(user.id, user.role, pkg.orgId);
  } catch {
    return res.status(403).json({ error: "You are not authorized to upload content for this organization" });
  }
  const { totalChunks, filename, totalBytes } = req.body;
  if (!totalChunks || !filename) {
    return res.status(400).json({ error: "totalChunks and filename are required" });
  }

  // Restrict large uploads (> 100 MB) to site owner only
  const fileSizeBytes = parseInt(String(totalBytes ?? "0"), 10);
  if (fileSizeBytes > LARGE_FILE_LIMIT) {
    let isOwner = false;
    try {
      const user = await authenticateRequest(req);
      // site_owner and site_admin have unlimited upload access; fallback: openId match
      isOwner = !!(user && (user.role === "site_owner" || user.role === "site_admin" || user.openId === ENV.ownerOpenId));
    } catch {
      isOwner = false;
    }
    if (!isOwner) {
      return res.status(403).json({
        error: "File size is restricted to 3 GB.",
      });
    }
  }

  const uploadId = nanoid(16);
  sessions.set(uploadId, {
    uploadId,
    authUserId: user.id,
    totalChunks: parseInt(String(totalChunks), 10),
    receivedChunks: new Set(),
    chunkPaths: new Map(),
    filename: String(filename),
  });
  return res.json({ uploadId });
});

// ── POST /api/chunked/version/:packageId/chunk/:uploadId ──────────────────────
router.post(
  "/version/:packageId/chunk/:uploadId",
  chunkUpload.single("chunk"),
  async (req: Request, res: Response) => {
    const { uploadId } = req.params;
    const chunkIndex = parseInt(String(req.body.chunkIndex ?? "-1"), 10);
    const tmpPath = (req.file as (Express.Multer.File & { path: string }) | undefined)?.path;

    const session = sessions.get(uploadId);
    const user = await authenticateRequest(req);
    if (!session) {
      if (tmpPath && existsSync(tmpPath)) unlinkSync(tmpPath);
      return res.status(404).json({ error: "Upload session not found" });
    }
    if (!user || user.id !== session.authUserId) {
      if (tmpPath && existsSync(tmpPath)) unlinkSync(tmpPath);
      return res.status(403).json({ error: "Upload session does not belong to the authenticated user" });
    }
    if (chunkIndex < 0 || chunkIndex >= session.totalChunks) {
      if (tmpPath && existsSync(tmpPath)) unlinkSync(tmpPath);
      return res.status(400).json({ error: "Invalid chunkIndex" });
    }
    if (!req.file || !tmpPath) {
      return res.status(400).json({ error: "No chunk data received" });
    }

    session.chunkPaths.set(chunkIndex, tmpPath);
    session.receivedChunks.add(chunkIndex);

    return res.json({
      uploadId,
      chunkIndex,
      received: session.receivedChunks.size,
      total: session.totalChunks,
    });
  }
);

// ── POST /api/chunked/version/:packageId/finalize/:uploadId ───────────────────
// Assembles all chunks into one temp file, then calls processZipVersion directly.
// No internal HTTP forward — the assembled file never crosses the proxy again.
router.post(
  "/version/:packageId/finalize/:uploadId",
  express.json(),
  async (req: Request, res: Response) => {
    const { uploadId, packageId: packageIdStr } = req.params;
    const packageId = parseInt(packageIdStr, 10);
    const session = sessions.get(uploadId);
    if (!session) return res.status(404).json({ error: "Upload session not found" });
    const user = await authenticateRequest(req);
    if (!user || user.id !== session.authUserId) {
      return res.status(403).json({ error: "Upload session does not belong to the authenticated user" });
    }
    const pkg = await getPackageById(packageId);
    if (!pkg) return res.status(404).json({ error: "Package not found" });
    try {
      await requireOrgAdmin(user.id, user.role, pkg.orgId);
    } catch {
      return res.status(403).json({ error: "You are not authorized to upload content for this organization" });
    }

    if (session.receivedChunks.size !== session.totalChunks) {
      return res.status(400).json({
        error: `Missing chunks: received ${session.receivedChunks.size} of ${session.totalChunks}`,
      });
    }

    const assembledPath = join(tmpdir(), `assembled-${uploadId}-${session.filename}`);
    try {
      // 1. Assemble all chunks into one temp file (pure disk I/O, no RAM buffer)
      await assembleChunks(session, assembledPath);
      cleanupSession(session); // free chunk temp files immediately

      const fileSize = statSync(assembledPath).size;
      const { uploadedBy, changelog } = req.body;
      const requestedUploadedBy = uploadedBy === undefined ? user.id : parseInt(String(uploadedBy), 10);
      if (requestedUploadedBy !== user.id) {
        if (existsSync(assembledPath)) unlinkSync(assembledPath);
        return res.status(403).json({ error: "Version attribution does not match the authenticated user" });
      }
      const uploadedByNum = user.id;
      const changelogStr = String(changelog ?? "New version");

      // 2. Look up package to get orgId
      const suffix = nanoid(8);
      const orgId = pkg.orgId;

      // 3. Stream original ZIP to S3 (true streaming — no RAM buffer)
      const zipKey = `orgs/${orgId}/packages/${suffix}/original.zip`;
      const { url: zipUrl } = await storagePutStream(zipKey, assembledPath, "application/zip");

      // 4. Mark package as processing
      await updatePackage(packageId, { status: "processing" });

      // 5. Respond immediately — processing runs in the background
      res.json({
        packageId,
        zipUrl,
        status: "processing",
        message: "Version upload received. Processing in background.",
      });

      // 6. Process ZIP asynchronously (extracts files, uploads to S3, updates DB)
      processZipVersion(assembledPath, fileSize, packageId, orgId, suffix, uploadedByNum, changelogStr)
        .catch((err) => {
          console.error(`[Chunked Version] Package ${packageId} failed:`, err);
          emitProgress(packageId, 0, 1, "error");
          updatePackage(packageId, { status: "error", processingError: String(err) }).catch(console.error);
        });

    } catch (err: unknown) {
      cleanupSession(session);
      if (existsSync(assembledPath)) {
        try { unlinkSync(assembledPath); } catch { /* ignore */ }
      }
      console.error("[Chunked Version Finalize] Error:", err);
      return res.status(500).json({ error: "Finalize failed", detail: String(err) });
    }
  }
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function assembleChunks(session: UploadSession, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const writeStream = createWriteStream(outputPath);
    writeStream.on("error", reject);

    let i = 0;
    function writeNext() {
      if (i >= session.totalChunks) {
        writeStream.end();
        writeStream.on("finish", resolve);
        return;
      }
      const chunkPath = session.chunkPaths.get(i);
      if (!chunkPath || !existsSync(chunkPath)) {
        writeStream.destroy(new Error(`Chunk ${i} missing at path: ${chunkPath}`));
        return;
      }
      const readStream = createReadStream(chunkPath);
      readStream.on("error", (err) => writeStream.destroy(err));
      readStream.on("end", () => {
        i++;
        writeNext();
      });
      readStream.pipe(writeStream, { end: false });
    }
    writeNext();
  });
}

function cleanupSession(session: UploadSession) {
  const paths = Array.from(session.chunkPaths.values());
  for (const chunkPath of paths) {
    try { if (existsSync(chunkPath)) unlinkSync(chunkPath); } catch { /* ignore */ }
  }
  sessions.delete(session.uploadId);
}

// ─── Media Chunked Upload ────────────────────────────────────────────────────
// Separate session registry for media uploads (avoids collision with SCORM sessions)
interface MediaUploadSession {
  uploadId: string;
  createdAt: number;
  authUserId: number;
  totalChunks: number;
  receivedChunks: Set<number>;
  chunkPaths: Map<number, string>;
  filename: string;
  orgId: number;
  folder: string;
  contentType: string;
  repositoryUpload: boolean;
  replaceAssetId: number | null;
  replaceAssetSlug: string | null;
  folderId: number | null;
  title: string;
  description: string | null;
  tags: string | null;
  notes: string | null;
  access: "public" | "private";
}
const mediaSessions = new Map<string, MediaUploadSession>();
const MEDIA_SESSION_TTL_MS = 60 * 60 * 1000;

function getLiveMediaSession(uploadId: string): MediaUploadSession | undefined {
  const session = mediaSessions.get(uploadId);
  if (!session) return undefined;
  if (Date.now() - session.createdAt > MEDIA_SESSION_TTL_MS) {
    cleanupMediaSession(session);
    return undefined;
  }
  return session;
}

function cleanupExpiredMediaSessions() {
  const now = Date.now();
  for (const session of mediaSessions.values()) {
    if (now - session.createdAt > MEDIA_SESSION_TTL_MS) cleanupMediaSession(session);
  }
}

const mediaSessionCleanupTimer = setInterval(cleanupExpiredMediaSessions, 5 * 60 * 1000);
mediaSessionCleanupTimer.unref();

function classifyMediaType(contentType: string, filename: string) {
  const lowerFilename = filename.toLowerCase();
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  if (contentType.startsWith("audio/")) return "audio";
  if (contentType === "text/html" || lowerFilename.endsWith(".html") || lowerFilename.endsWith(".htm")) return "html";
  if (contentType === "application/pdf" || contentType.includes("word") || contentType.includes("presentation")) return "document";
  if (contentType === "application/zip" || contentType === "application/x-zip-compressed" || lowerFilename.endsWith(".zip")) return "zip";
  return "other";
}

function asOptionalText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const text = value.trim().slice(0, maxLength);
  return text || null;
}

// POST /api/chunked/media/initiate
router.post("/media/initiate", express.json(), async (req: Request, res: Response) => {
  cleanupExpiredMediaSessions();
  const { totalChunks, filename, orgId, folder, contentType, repositoryUpload, replaceAssetId, folderId, title, description, tags, notes, access } = req.body;
  if (!totalChunks || !filename) {
    return res.status(400).json({ error: "totalChunks and filename are required" });
  }
  const parsedTotalChunks = parseInt(String(totalChunks), 10);
  const safeFilename = String(filename).trim().replace(/[\\/]/g, "_").slice(0, 255);
  if (!Number.isInteger(parsedTotalChunks) || parsedTotalChunks < 1 || !safeFilename) {
    return res.status(400).json({ error: "A valid positive totalChunks value and filename are required" });
  }
  const user = await authenticateRequest(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  const activeOrgId = await getOrgIdForUserWithFallback(user.id, user.role);
  const requestedOrgId = orgId ? parseInt(String(orgId), 10) : activeOrgId;
  if (!activeOrgId || !requestedOrgId || requestedOrgId !== activeOrgId) {
    return res.status(403).json({ error: "Switch to the requested organization before uploading media" });
  }
  try {
    await requireOrgAdmin(user.id, user.role, activeOrgId);
  } catch {
    return res.status(403).json({ error: "You are not authorized to upload media for this organization" });
  }
  const isRepositoryUpload = repositoryUpload === true;
  const parsedReplaceAssetId = replaceAssetId === undefined || replaceAssetId === null || replaceAssetId === ""
    ? null
    : parseInt(String(replaceAssetId), 10);
  if (parsedReplaceAssetId !== null && (!isRepositoryUpload || !Number.isInteger(parsedReplaceAssetId) || parsedReplaceAssetId <= 0)) {
    return res.status(400).json({ error: "replaceAssetId must identify an existing Media Repository asset" });
  }
  const parsedFolderId = folderId === undefined || folderId === null || folderId === ""
    ? null
    : parseInt(String(folderId), 10);
  if (parsedFolderId !== null && (!Number.isInteger(parsedFolderId) || parsedFolderId <= 0)) {
    return res.status(400).json({ error: "folderId must be a positive integer when provided" });
  }
  let replaceAssetSlug: string | null = null;
  if (isRepositoryUpload && (parsedFolderId !== null || parsedReplaceAssetId !== null)) {
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "Database unavailable" });
    if (parsedFolderId !== null) {
      const [ownedFolder] = await db.select({ id: mediaFolders.id })
        .from(mediaFolders)
        .where(and(eq(mediaFolders.id, parsedFolderId), eq(mediaFolders.orgId, activeOrgId)))
        .limit(1);
      if (!ownedFolder) return res.status(404).json({ error: "Media folder not found in the active organization" });
    }
    if (parsedReplaceAssetId !== null) {
      const [ownedAsset] = await db.select({ id: mediaAssets.id, slug: mediaAssets.slug })
        .from(mediaAssets)
        .where(and(eq(mediaAssets.id, parsedReplaceAssetId), eq(mediaAssets.orgId, activeOrgId), sql`${mediaAssets.deletedAt} IS NULL`))
        .limit(1);
      if (!ownedAsset) return res.status(404).json({ error: "Media asset not found in the active organization" });
      replaceAssetSlug = ownedAsset.slug ?? `media-${ownedAsset.id}-${nanoid(8)}`;
    }
  }
  const safeFolder = String(folder ?? "lms-media").toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "lms-media";
  const safeContentType = String(contentType ?? "application/octet-stream").slice(0, 100);

  const uploadId = nanoid(16);
  mediaSessions.set(uploadId, {
    uploadId,
    createdAt: Date.now(),
    authUserId: user.id,
    totalChunks: parsedTotalChunks,
    receivedChunks: new Set(),
    chunkPaths: new Map(),
    filename: safeFilename,
    orgId: activeOrgId,
    folder: isRepositoryUpload ? "media-repo" : safeFolder,
    contentType: safeContentType,
    repositoryUpload: isRepositoryUpload,
    replaceAssetId: parsedReplaceAssetId,
    replaceAssetSlug,
    folderId: isRepositoryUpload && parsedReplaceAssetId === null ? parsedFolderId : null,
    title: asOptionalText(title, 255) ?? safeFilename.replace(/\.[^.]+$/, ""),
    description: asOptionalText(description, 2_000),
    tags: asOptionalText(tags, 500),
    notes: asOptionalText(notes, 500),
    access: access === "public" ? "public" : "private",
  });
  return res.json({ uploadId });
});

// POST /api/chunked/media/chunk/:uploadId
router.post(
  "/media/chunk/:uploadId",
  chunkUpload.single("chunk"),
  async (req: Request, res: Response) => {
    const { uploadId } = req.params;
    const chunkIndex = parseInt(String(req.body.chunkIndex ?? "-1"), 10);
    const tmpPath = (req.file as (Express.Multer.File & { path: string }) | undefined)?.path;
    const session = getLiveMediaSession(uploadId);
    const user = await authenticateRequest(req);
    if (!session) {
      if (tmpPath && existsSync(tmpPath)) unlinkSync(tmpPath);
      return res.status(404).json({ error: "Upload session not found" });
    }
    if (!user || user.id !== session.authUserId) {
      if (tmpPath && existsSync(tmpPath)) unlinkSync(tmpPath);
      return res.status(403).json({ error: "Upload session does not belong to the authenticated user" });
    }
    const activeOrgId = await getOrgIdForUserWithFallback(user.id, user.role);
    if (activeOrgId !== session.orgId) {
      if (tmpPath && existsSync(tmpPath)) unlinkSync(tmpPath);
      return res.status(403).json({ error: "Upload session no longer matches the active organization" });
    }
    try {
      await requireOrgAdmin(user.id, user.role, session.orgId);
    } catch {
      if (tmpPath && existsSync(tmpPath)) unlinkSync(tmpPath);
      return res.status(403).json({ error: "You are not authorized to upload media for this organization" });
    }
    if (chunkIndex < 0 || chunkIndex >= session.totalChunks) {
      if (tmpPath && existsSync(tmpPath)) unlinkSync(tmpPath);
      return res.status(400).json({ error: "Invalid chunkIndex" });
    }
    if (!req.file || !tmpPath) {
      return res.status(400).json({ error: "No chunk data received" });
    }
    session.chunkPaths.set(chunkIndex, tmpPath);
    session.receivedChunks.add(chunkIndex);
    return res.json({ uploadId, chunkIndex, received: session.receivedChunks.size, total: session.totalChunks });
  }
);

// POST /api/chunked/media/finalize/:uploadId
router.post(
  "/media/finalize/:uploadId",
  express.json(),
  async (req: Request, res: Response) => {
    const { uploadId } = req.params;
    const session = getLiveMediaSession(uploadId);
    if (!session) return res.status(404).json({ error: "Upload session not found" });
    if (session.receivedChunks.size !== session.totalChunks) {
      return res.status(400).json({
        error: `Missing chunks: received ${session.receivedChunks.size} of ${session.totalChunks}`,
      });
    }
    const user = await authenticateRequest(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    if (user.id !== session.authUserId) return res.status(403).json({ error: "Upload session does not belong to the authenticated user" });
    const activeOrgId = await getOrgIdForUserWithFallback(user.id, user.role);
    if (activeOrgId !== session.orgId) return res.status(403).json({ error: "Upload session no longer matches the active organization" });
    try {
      await requireOrgAdmin(user.id, user.role, session.orgId);
    } catch {
      return res.status(403).json({ error: "You are not authorized to upload media for this organization" });
    }

    const safeName = session.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
    const assembledPath = join(tmpdir(), `media-assembled-${uploadId}-${safeName}`);
    let storedKey: string | null = null;
    try {
      // Re-use the same assembleChunks helper (works on any session shape with same fields)
      await assembleChunks(session as unknown as UploadSession, assembledPath);
      cleanupMediaSession(session);
      const fileSize = statSync(assembledPath).size;
      const key = session.replaceAssetSlug
        ? `media-repo/${session.replaceAssetSlug}/versions/${Date.now()}-${nanoid(8)}-${safeName}`
        : `${session.folder}/${session.orgId}/${Date.now()}-${nanoid(8)}-${safeName}`;
      const { url } = await storagePutStream(key, assembledPath, session.contentType);
      storedKey = key;
      try { unlinkSync(assembledPath); } catch { /* ignore */ }
      if (!session.repositoryUpload) {
        return res.json({ key, url, fileName: session.filename, fileSize, fileType: session.contentType });
      }

      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const mediaType = classifyMediaType(session.contentType, session.filename);
      const slug = session.replaceAssetSlug ?? `media-${nanoid(12)}`;
      let assetId = session.replaceAssetId ?? 0;
      let versionId = 0;
      let versionNumber = 1;
      await db.transaction(async (tx) => {
        if (session.replaceAssetId !== null) {
          const [asset] = await tx.select({ id: mediaAssets.id, slug: mediaAssets.slug })
            .from(mediaAssets)
            .where(and(eq(mediaAssets.id, session.replaceAssetId), eq(mediaAssets.orgId, session.orgId), sql`${mediaAssets.deletedAt} IS NULL`))
            .limit(1);
          if (!asset) throw new Error("Media asset no longer belongs to the active organization");
          const [{ maxVersion }] = await tx.select({ maxVersion: sql<number>`MAX(${mediaVersions.versionNumber})` })
            .from(mediaVersions)
            .where(and(eq(mediaVersions.assetId, asset.id), eq(mediaVersions.orgId, session.orgId)));
          versionNumber = (maxVersion ?? 0) + 1;
          assetId = asset.id;
          await tx.update(mediaAssets).set({
            filename: session.filename,
            mimeType: session.contentType,
            size: fileSize,
            s3Key: key,
            s3Url: url,
            uploadedBy: session.authUserId,
            slug: session.replaceAssetSlug,
            mediaType,
          }).where(and(eq(mediaAssets.id, asset.id), eq(mediaAssets.orgId, session.orgId)));
        } else {
          const [assetResult] = await tx.insert(mediaAssets).values({
            orgId: session.orgId,
            folderId: session.folderId,
            filename: session.filename,
            mimeType: session.contentType,
            size: fileSize,
            s3Key: key,
            s3Url: url,
            uploadedBy: session.authUserId,
            slug,
            title: session.title,
            description: session.description,
            mediaType,
            access: session.access,
            tags: session.tags,
            createdByUserId: session.authUserId,
          });
          assetId = Number((assetResult as { insertId?: number }).insertId);
        }
        const [versionResult] = await tx.insert(mediaVersions).values({
          orgId: session.orgId,
          assetId,
          versionNumber,
          s3Key: key,
          s3Url: url,
          fileName: session.filename,
          fileSize,
          mimeType: session.contentType,
          notes: session.notes,
          uploadedByUserId: session.authUserId,
          scormExtractionStatus: initialScormExtractionStatus({ mediaType, mimeType: session.contentType, fileName: session.filename }),
        });
        versionId = Number((versionResult as { insertId?: number }).insertId);
      });
      queueScormExtractionIfNeeded(versionId, url, slug, { mediaType, mimeType: session.contentType, fileName: session.filename })
        .catch((error) => console.error("[Chunked Media Finalize] SCORM extraction queue failed:", error));
      return res.json({ assetId, versionId, versionNumber, slug, key, url, fileName: session.filename, fileSize, fileType: session.contentType });
    } catch (err: unknown) {
      cleanupMediaSession(session);
      try { if (existsSync(assembledPath)) unlinkSync(assembledPath); } catch { /* ignore */ }
      if (storedKey) {
        try { await storageDelete(storedKey); } catch (cleanupError) { console.error("[Chunked Media Finalize] Stored-object cleanup failed:", cleanupError); }
      }
      console.error("[Chunked Media Finalize] Error:", err);
      return res.status(500).json({ error: "Finalize failed", detail: String(err) });
    }
  }
);

function cleanupMediaSession(session: MediaUploadSession) {
  session.chunkPaths.forEach((p) => {
    try { if (existsSync(p)) unlinkSync(p); } catch { /* ignore */ }
  });
  mediaSessions.delete(session.uploadId);
}

export default router;
