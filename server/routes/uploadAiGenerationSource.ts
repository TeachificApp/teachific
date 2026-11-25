import { Router, Request, Response } from "express";
import multer from "multer";
import { randomBytes } from "crypto";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { authenticateRequest } from "../authHelper";
import { getDb } from "../db";
import { orgSubscriptions } from "../../drizzle/schema";
import { requireCourse360AiIntegrationSchool } from "../lib/course360AiIntegrationScope";
import { storagePut } from "../storage";
import { AI_SOURCE_FILE_MAX_BYTES, isSupportedAiSourceMimeType } from "../lib/aiSourceFile";
import { COURSE360_AI_SOURCE_MAX_BYTES, normalizeCourse360SourceMime, canUseCourse360AdvancedAi } from "../lib/course360AiSourceMetadata";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: AI_SOURCE_FILE_MAX_BYTES + 1 } });

router.post("/", (req, res, next) => upload.single("file")(req, res, error => {
  if (error?.code === "LIMIT_FILE_SIZE") return res.status(400).json({ error: "Each source file must be 50 MB or smaller." });
  if (error) return res.status(400).json({ error: "Source upload could not be read." });
  next();
}), async (req: Request, res: Response) => {
  try {
    const user = await authenticateRequest(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const purpose = req.body?.purpose ?? "question_bank";
    if (purpose !== "course" && purpose !== "question_bank") return res.status(400).json({ error: "Invalid source purpose." });
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Source uploads are temporarily unavailable." });
    const orgId = await requireCourse360AiIntegrationSchool(db, { id: user.id, role: user.role ?? "user" });
    if (req.body?.orgId !== undefined && (Number(req.body.orgId) !== orgId || !Number.isSafeInteger(Number(req.body.orgId)))) {
      return res.status(403).json({ error: "Switch to the active organization before adding source files." });
    }
    if (!req.file) return res.status(400).json({ error: "A source file is required." });
    if (!req.file.buffer?.byteLength || req.file.buffer.byteLength > COURSE360_AI_SOURCE_MAX_BYTES) {
      return res.status(400).json({ error: "Each source file must contain data and be 50 MB or smaller." });
    }
    const mimeType = purpose === "course"
      ? normalizeCourse360SourceMime(req.file.mimetype, req.file.originalname)
      : isSupportedAiSourceMimeType(req.file.mimetype) ? req.file.mimetype : undefined;
    if (!mimeType) return res.status(400).json({ error: purpose === "course" ? "Only PDF, PPTX, PPT, JPG, PNG, and WebP files are supported." : "Only PDF, JPG, PNG, and WebP files are supported." });
    if (!req.file.originalname || req.file.originalname.length > 255) return res.status(400).json({ error: "Use a source filename of 1–255 characters." });
    if (purpose === "course") {
      const [subscription] = await db.select({ plan: orgSubscriptions.plan, status: orgSubscriptions.status })
        .from(orgSubscriptions).where(eq(orgSubscriptions.orgId, orgId)).limit(1);
      if (!canUseCourse360AdvancedAi(subscription?.plan, subscription?.status)) {
        return res.status(403).json({ error: "Course source uploads require an active Pro or Enterprise organization plan." });
      }
    }
    const extensions: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/vnd.ms-powerpoint": "ppt", "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx" };
    const key = `ai-generation-sources/${orgId}/${user.id}/${Date.now()}-${randomBytes(6).toString("hex")}.${extensions[mimeType]}`;
    const { url } = await storagePut(key, req.file.buffer, mimeType);
    return res.json({ sourceFile: { url, mimeType, name: req.file.originalname, storageKey: key }, fileKey: key });
  } catch (error) {
    if (error instanceof TRPCError) return res.status(error.code === "UNAUTHORIZED" ? 401 : error.code === "FORBIDDEN" ? 403 : 400).json({ error: error.message });
    return res.status(503).json({ error: "Source upload failed. Please try again." });
  }
});

export default router;
