import { Router, Request, Response } from "express";
import multer from "multer";
import { randomBytes } from "crypto";
import { authenticateRequest } from "../authHelper";
import { requireOrgAdmin } from "../db";
import { storagePut } from "../storage";
import { AI_SOURCE_FILE_MAX_BYTES, isSupportedAiSourceMimeType } from "../lib/aiSourceFile";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: AI_SOURCE_FILE_MAX_BYTES + 1 } });

router.post("/", (req, res, next) => upload.single("file")(req, res, error => {
  if (error?.code === "LIMIT_FILE_SIZE") return res.status(400).json({ error: "Each source file must be 50 MB or smaller." });
  if (error) return res.status(400).json({ error: error.message });
  next();
}), async (req: Request, res: Response) => {
  const user = await authenticateRequest(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  const orgId = Number(req.body.orgId);
  if (!Number.isInteger(orgId) || orgId <= 0) return res.status(400).json({ error: "A valid organization is required." });
  if (!req.file || !isSupportedAiSourceMimeType(req.file.mimetype)) return res.status(400).json({ error: "Only PDF, JPG, PNG, and WebP files are supported." });
  await requireOrgAdmin(user.id, (user as any).role ?? "user", orgId);
  const extension = req.file.originalname.split(".").pop()?.toLowerCase() || "source";
  const key = `ai-generation-sources/${orgId}/${user.id}/${Date.now()}-${randomBytes(6).toString("hex")}.${extension}`;
  const { url } = await storagePut(key, req.file.buffer, req.file.mimetype);
  return res.json({ sourceFile: { url, mimeType: req.file.mimetype, name: req.file.originalname }, fileKey: key });
});

export default router;
