/**
 * Content proxy routes for serving extracted SCORM/HTML package files.
 * Mounted at /api/content in server/_core/index.ts
 *
 * GET /api/content/:packageId/entry  — proxy the entry point file from S3
 * GET /api/content/:packageId/*      — proxy the matching file from S3
 *
 * We PROXY (not redirect) so that:
 *  1. The response comes from the Course360 domain — no X-Frame-Options block from S3.
 *  2. We can set our own headers (X-Frame-Options: ALLOWALL, CORS, etc.).
 *  3. The iframe src stays on the Course360 origin so relative asset paths resolve.
 *
 * NOTE: For large binary assets (images, video, audio) we still redirect to S3
 * to avoid unnecessary bandwidth through the server. Only HTML/JS/CSS files are
 * proxied because those are the ones that trigger frame-blocking checks.
 */
import express, { Request, Response } from "express";
import { getDb } from "./db";
import { fileAssets, contentPackages } from "../drizzle/schema";
import { and, eq } from "drizzle-orm";
import https from "https";
import http from "http";

const router = express.Router();

// MIME types that must be proxied (frame-sensitive)
const PROXY_MIME_TYPES = new Set([
  "text/html",
  "application/javascript",
  "text/javascript",
  "text/css",
  "application/json",
  "text/xml",
  "application/xml",
  "application/xhtml+xml",
]);

// Headers to add to every proxied response
function setFrameHeaders(res: Response) {
  // Allow embedding from any origin
  res.setHeader("X-Frame-Options", "ALLOWALL");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Range");
  // Prevent mobile browsers from serving stale content after a version upload
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.removeHeader("ETag");
}

// Proxy a URL through the server, streaming bytes
function proxyUrl(url: string, res: Response, contentType: string) {
  const protocol = url.startsWith("https") ? https : http;
  protocol.get(url, (upstream) => {
    setFrameHeaders(res); // already sets no-store; do NOT forward S3 cache headers
    res.setHeader("Content-Type", contentType);
    res.status(upstream.statusCode ?? 200);
    upstream.pipe(res);
  }).on("error", (err) => {
    console.error("[Content] Proxy error:", err.message);
    if (!res.headersSent) res.status(502).json({ error: "Upstream fetch failed" });
  });
}

// Helper: find entry asset for a package
async function findEntryAsset(packageId: number) {
  const db = await getDb();
  if (!db) return null;

  const pkgs = await db.select().from(contentPackages).where(eq(contentPackages.id, packageId)).limit(1);
  const pkg = pkgs[0];
  if (!pkg || pkg.status !== "ready") return { pkg, asset: null };

  // Filter to the current version's assets so a new upload is immediately reflected
  const versionFilter = pkg.currentVersionId
    ? and(eq(fileAssets.packageId, packageId), eq(fileAssets.versionId, pkg.currentVersionId))
    : eq(fileAssets.packageId, packageId);
  const allAssets = await db.select().from(fileAssets).where(versionFilter);

  let asset = allAssets.find((a) => Boolean(a.isEntryPoint));

  if (!asset && pkg.scormEntryPoint) {
    const ep = pkg.scormEntryPoint.toLowerCase();
    asset = allAssets.find((a) => a.relativePath.toLowerCase() === ep);
    if (!asset) {
      asset = allAssets.find((a) =>
        a.relativePath.toLowerCase().endsWith("/" + ep) ||
        a.relativePath.toLowerCase() === ep
      );
    }
  }

  if (!asset) asset = allAssets.find((a) => a.relativePath.toLowerCase().endsWith("/index.html") || a.relativePath.toLowerCase() === "index.html");
  if (!asset) asset = allAssets.find((a) => a.relativePath.toLowerCase().endsWith("/story.html"));
  if (!asset) asset = allAssets.find((a) => a.mimeType === "text/html");

  return { pkg, asset: asset ?? null };
}

// GET /api/content/:packageId/entry
router.get("/:packageId/entry", async (req: Request, res: Response) => {
  try {
    const packageId = parseInt(req.params.packageId, 10);
    if (!packageId) return res.status(400).json({ error: "Invalid packageId" });

    const result = await findEntryAsset(packageId);
    if (!result) return res.status(503).json({ error: "DB unavailable" });

    const { pkg, asset } = result;
    if (!pkg) return res.status(404).json({ error: "Package not found" });
    if (!asset) return res.status(404).json({ error: "No entry point found for this package" });

    const mime = asset.mimeType ?? "text/html";
    // Always proxy HTML entry points
    proxyUrl(asset.s3Url, res, mime);
  } catch (err) {
    console.error("[Content] Entry proxy error:", err);
    if (!res.headersSent) res.status(500).json({ error: "Internal error" });
  }
});

// GET /api/content/:packageId/*
router.get("/:packageId/*", async (req: Request, res: Response) => {
  try {
    const packageId = parseInt(req.params.packageId, 10);
    if (!packageId) return res.status(400).json({ error: "Invalid packageId" });

    const filePath = (req.params as Record<string, string>)["0"] || "";
    if (!filePath) {
      return res.redirect(302, `/api/content/${packageId}/entry`);
    }

    const db = await getDb();
    if (!db) return res.status(503).json({ error: "DB unavailable" });

    // Use currentVersionId so asset lookups always hit the latest uploaded version
    const pkgs = await db.select().from(contentPackages).where(eq(contentPackages.id, packageId)).limit(1);
    const pkg = pkgs[0];
    const versionFilter = pkg?.currentVersionId
      ? and(eq(fileAssets.packageId, packageId), eq(fileAssets.versionId, pkg.currentVersionId))
      : eq(fileAssets.packageId, packageId);
    const allAssets = await db.select().from(fileAssets).where(versionFilter);

    let asset = allAssets.find((a) => a.relativePath.toLowerCase() === filePath.toLowerCase());
    if (!asset) {
      asset = allAssets.find((a) =>
        a.relativePath.toLowerCase().endsWith("/" + filePath.toLowerCase())
      );
    }

    if (!asset) {
      return res.status(404).json({ error: `File not found: ${filePath}` });
    }

    const mime = asset.mimeType ?? "application/octet-stream";

    // Proxy frame-sensitive types; redirect large binary assets to S3 for efficiency
    if (PROXY_MIME_TYPES.has(mime)) {
      proxyUrl(asset.s3Url, res, mime);
    } else {
      // Binary asset — redirect to S3 CDN (images, video, audio, fonts, etc.)
      setFrameHeaders(res);
      res.redirect(302, asset.s3Url);
    }
  } catch (err) {
    console.error("[Content] File proxy error:", err);
    if (!res.headersSent) res.status(500).json({ error: "Internal error" });
  }
});

export default router;
