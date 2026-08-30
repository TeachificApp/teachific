/**
 * Media Repository delivery routes.
 *
 * Only the current-version download endpoint is restored here. Embedded and
 * SCORM delivery remain unavailable until their learner authorization and
 * extracted-path contracts are rebuilt against the organization-owned model.
 */
import express, { type Request, type Response } from "express";
import { and, desc, eq, isNull } from "drizzle-orm";
import { mediaAssets, mediaVersions } from "../drizzle/schema";
import { authenticateRequest } from "./authHelper";
import { getDb, getOrgIdForUserWithFallback, requireOrgAdmin } from "./db";
import { storageGet } from "./storage";

const router = express.Router();

async function requirePrivateAssetAdmin(req: Request, res: Response, assetOrgId: number): Promise<boolean> {
  const user = await authenticateRequest(req);
  if (!user) {
    res.status(401).json({ error: "Authentication is required for this media asset" });
    return false;
  }
  const activeOrgId = await getOrgIdForUserWithFallback(user.id, user.role);
  if (activeOrgId !== assetOrgId) {
    res.status(404).json({ error: "Media asset not found" });
    return false;
  }
  try {
    await requireOrgAdmin(user.id, user.role, assetOrgId);
    return true;
  } catch {
    res.status(403).json({ error: "You do not have access to this media asset" });
    return false;
  }
}

/**
 * GET /api/media/:slug/download
 * Resolve an active asset's latest version and issue a short-lived storage
 * redirect. Private assets require an authenticated active-organization admin.
 */
router.get("/:slug/download", async (req: Request, res: Response) => {
  try {
    const slug = String(req.params.slug ?? "");
    if (!/^[a-z0-9-]{1,128}$/.test(slug)) return res.status(400).json({ error: "Invalid media slug" });

    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database unavailable" });
    const [asset] = await db.select().from(mediaAssets)
      .where(and(eq(mediaAssets.slug, slug), isNull(mediaAssets.deletedAt)))
      .limit(1);
    if (!asset) return res.status(404).json({ error: "Media asset not found" });

    if (asset.access !== "public" && !(await requirePrivateAssetAdmin(req, res, asset.orgId))) return;

    const [version] = await db.select({ s3Key: mediaVersions.s3Key })
      .from(mediaVersions)
      .where(and(eq(mediaVersions.assetId, asset.id), eq(mediaVersions.orgId, asset.orgId)))
      .orderBy(desc(mediaVersions.versionNumber))
      .limit(1);
    if (!version?.s3Key) return res.status(404).json({ error: "No current media version found" });

    const { url } = await storageGet(version.s3Key);
    res.setHeader("Cache-Control", "private, no-store");
    res.redirect(302, url);
  } catch (error) {
    console.error("[Media Delivery] Download failed:", error);
    if (!res.headersSent) res.status(500).json({ error: "Unable to deliver media" });
  }
});

export default router;
