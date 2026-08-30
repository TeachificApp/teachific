/**
 * Media Repository delivery routes.
 *
 * Only current-version redirects are restored here. Embed HTML and extracted
 * SCORM paths remain unavailable until their separate path-serving contract is
 * rebuilt. Signed learner tokens are bound to a live course enrollment in the
 * asset's owning organization before a private object is released.
 */
import express, { type Request, type Response } from "express";
import { and, desc, eq, gte, inArray, isNull, or } from "drizzle-orm";
import { lmsCourses, lmsEnrollments, mediaAssets, mediaVersions } from "../drizzle/schema";
import { authenticateRequest } from "./authHelper";
import { getDb, getOrgIdForUserWithFallback, requireOrgAdmin } from "./db";
import { verifyMediaViewerToken } from "./lib/mediaEmbedAccess";
import { storageGet } from "./storage";

const router = express.Router();

async function hasActiveCourseEnrollment(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  userId: number,
  courseId: number,
  orgId: number,
): Promise<boolean> {
  const [course] = await db.select({ id: lmsCourses.id }).from(lmsCourses)
    .where(and(eq(lmsCourses.id, courseId), eq(lmsCourses.orgId, orgId)))
    .limit(1);
  if (!course) return false;

  const now = new Date();
  const [enrollment] = await db.select({ id: lmsEnrollments.id }).from(lmsEnrollments)
    .where(and(
      eq(lmsEnrollments.userId, userId),
      eq(lmsEnrollments.courseId, courseId),
      eq(lmsEnrollments.orgId, orgId),
      inArray(lmsEnrollments.status, ["active", "completed"]),
      or(isNull(lmsEnrollments.expiresAt), gte(lmsEnrollments.expiresAt, now)),
      or(isNull(lmsEnrollments.accessExpiresAt), gte(lmsEnrollments.accessExpiresAt, now)),
    ))
    .limit(1);
  return !!enrollment;
}

async function hasSignedLearnerAccess(
  req: Request,
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  asset: typeof mediaAssets.$inferSelect,
): Promise<boolean> {
  const access = typeof req.query.access === "string" ? req.query.access : "";
  const token = access ? verifyMediaViewerToken(access, asset.slug) : null;
  if (!token?.courseId) return false;
  return hasActiveCourseEnrollment(db, token.userId, token.courseId, asset.orgId);
}

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

async function serveCurrentVersion(req: Request, res: Response) {
  try {
    const slug = String(req.params.slug ?? "");
    if (!/^[a-z0-9-]{1,128}$/.test(slug)) return res.status(400).json({ error: "Invalid media slug" });

    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database unavailable" });
    const [asset] = await db.select().from(mediaAssets)
      .where(and(eq(mediaAssets.slug, slug), isNull(mediaAssets.deletedAt)))
      .limit(1);
    if (!asset) return res.status(404).json({ error: "Media asset not found" });

    if (asset.access !== "public") {
      const signedLearnerAccess = await hasSignedLearnerAccess(req, db, asset);
      if (!signedLearnerAccess && !(await requirePrivateAssetAdmin(req, res, asset.orgId))) return;
    }

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
    console.error("[Media Delivery] Current version request failed:", error);
    if (!res.headersSent) res.status(500).json({ error: "Unable to deliver media" });
  }
}

/** Current-version file download. */
router.get("/:slug/download", serveCurrentVersion);

/** Current-version ZIP source for the browser SCORM player. */
router.get("/:slug/scorm-zip", serveCurrentVersion);

export default router;
