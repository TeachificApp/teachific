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

const router = Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, tmpdir()),
    filename: (_req, file, cb) => {
      const ext = file.originalname.split(".").pop() ?? "png";
      cb(null, `course-img-${nanoid(12)}.${ext}`);
    },
  }),
  limits: { fileSize: 40 * 1024 * 1024 }, // 40 MB max
});

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
    const ext = req.file.originalname.split(".").pop()?.replace(/[^a-z0-9]/gi, "") || "png";
    const key = `course-images/${Date.now()}-${nanoid(8)}.${ext}`;
    const { url } = await storagePutStream(key, req.file.path, req.file.mimetype || "image/png");
    res.json({ url });
  } catch (err: any) {
    console.error("[upload-course-image]", err);
    res.status(500).json({ error: err?.message ?? "Upload failed" });
  }
});

export default router;
