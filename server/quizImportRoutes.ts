/**
 * REST routes for quiz Excel import/export.
 * Mounted at /api/quiz in server/_core/index.ts
 *
 * Supports:
 *  - POST /api/quiz/import/preview  — accepts .xlsx, .xls, or .zip (with media/ folder)
 *  - GET  /api/quiz/export/:quizId  — export quiz to XLSX
 *  - GET  /api/quiz/template        — download Teachific ZIP import template (redirects to CDN)
 *  - GET  /api/quiz/template/xlsx   — download XLSX-only template
 */
import express, { Request, Response } from "express";
import multer from "multer";
import unzipper from "unzipper";
import { Readable } from "stream";
import { storagePut } from "./storage";
import { parseQuizExcel, exportQuizToExcel, parsedToDbQuestions } from "./quizExcel";
import { getQuizById, getQuestionsByQuiz, getChoicesByQuestion } from "./quizDb";
import { sdk } from "./_core/sdk";
import { authenticateRequest } from "./authHelper";

// CDN URLs for the pre-built Teachific templates
const TEMPLATE_ZIP_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/fJXMsdmk8vcb8V4GDt37f6/TeachificQuizImportTemplate_a611ae1e.zip";
const TEMPLATE_XLSX_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/fJXMsdmk8vcb8V4GDt37f6/QuizImportTemplate_ad09d65c.xlsx";

const router = express.Router();
// Accept up to 3 GB for ZIP files with media
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3 * 1024 * 1024 * 1024 } });

/**
 * Extract a ZIP buffer into:
 *   - xlsxBuffer: the first .xlsx/.xls file found
 *   - mediaMap: Map<relativePath, Buffer>  e.g. "media/image.jpg" → Buffer
 */
async function extractZip(
  zipBuffer: Buffer
): Promise<{ xlsxBuffer: Buffer | null; mediaMap: Map<string, Buffer> }> {
  const mediaMap = new Map<string, Buffer>();
  let xlsxBuffer: Buffer | null = null;

  const readable = Readable.from(zipBuffer);
  const directory = readable.pipe(unzipper.Parse({ forceStream: true }));

  for await (const entry of directory) {
    const entryPath: string = (entry as any).path as string;
    const type: string = (entry as any).type as string;

    if (type === "Directory") {
      await (entry as any).autodrain();
      continue;
    }

    const chunks: Buffer[] = [];
    for await (const chunk of entry) {
      chunks.push(chunk as Buffer);
    }
    const buf = Buffer.concat(chunks);
    const lower = entryPath.toLowerCase();

    if (!xlsxBuffer && (lower.endsWith(".xlsx") || lower.endsWith(".xls"))) {
      xlsxBuffer = buf;
      continue;
    }

    if (
      lower.includes("media/") &&
      /\.(jpg|jpeg|png|gif|webp|svg|mp4|webm|mov|avi|mp3|wav|ogg|m4a|aac)$/i.test(lower)
    ) {
      const normalized = entryPath.replace(/^.*?(media\/.+)$/, "$1");
      mediaMap.set(normalized, buf);
    }
  }

  return { xlsxBuffer, mediaMap };
}

/**
 * Upload all media files in the map to S3 and return a path→URL map.
 */
async function uploadMediaToS3(
  mediaMap: Map<string, Buffer>,
  orgId: string
): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>();
  const mimeTypes: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
    gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
    mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
    avi: "video/x-msvideo", mp3: "audio/mpeg", wav: "audio/wav",
    ogg: "audio/ogg", m4a: "audio/mp4", aac: "audio/aac",
  };

  await Promise.all(
    Array.from(mediaMap.entries()).map(async ([relPath, buf]) => {
      const ext = relPath.split(".").pop()?.toLowerCase() ?? "bin";
      const mime = mimeTypes[ext] ?? "application/octet-stream";
      const fileName = relPath.split("/").pop() ?? "file";
      const key = `quiz-imports/${orgId}/${Date.now()}-${fileName}`;
      try {
        const { url } = await storagePut(key, buf, mime);
        urlMap.set(relPath, url);
        urlMap.set(relPath.replace(/\//g, "\\\\"), url);
      } catch (e) {
        console.error(`[Quiz Import] Failed to upload media ${relPath}:`, e);
      }
    })
  );

  return urlMap;
}

// ── POST /api/quiz/import/preview ─────────────────────────────────────────────
// Parse an XLS/XLSX or ZIP file and return parsed questions for preview (no DB write)
router.post("/import/preview", upload.single("file"), async (req: Request, res: Response) => {
  try {
    const authUser = await authenticateRequest(req);
    if (!authUser) return res.status(401).json({ error: "Unauthorized" });
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const orgId = (authUser as any).orgId?.toString() ?? "unknown";
    const originalName = req.file.originalname.toLowerCase();
    let xlsxBuffer = req.file.buffer;
    let mediaUrlMap = new Map<string, string>();

    // Handle ZIP upload
    if (originalName.endsWith(".zip")) {
      const { xlsxBuffer: extracted, mediaMap } = await extractZip(req.file.buffer);
      if (!extracted) {
        return res.status(400).json({ error: "No Excel file (.xlsx or .xls) found inside the ZIP." });
      }
      xlsxBuffer = extracted;
      if (mediaMap.size > 0) {
        mediaUrlMap = await uploadMediaToS3(mediaMap, orgId);
      }
    }

    const result = parseQuizExcel(xlsxBuffer);

    // Replace local media paths with S3 URLs
    if (mediaUrlMap.size > 0) {
      for (const q of result.questions) {
        if (q.imagePath) {
          const url = mediaUrlMap.get(q.imagePath) ?? mediaUrlMap.get(q.imagePath.replace(/\\/g, "/"));
          if (url) q.imagePath = url;
        }
        if (q.videoPath) {
          const url = mediaUrlMap.get(q.videoPath) ?? mediaUrlMap.get(q.videoPath.replace(/\\/g, "/"));
          if (url) q.videoPath = url;
        }
        if (q.audioPath) {
          const url = mediaUrlMap.get(q.audioPath) ?? mediaUrlMap.get(q.audioPath.replace(/\\/g, "/"));
          if (url) q.audioPath = url;
        }
      }
    }

    return res.json({ ...result, mediaUploaded: mediaUrlMap.size });
  } catch (err: unknown) {
    console.error("[Quiz Import] Parse error:", err);
    return res.status(500).json({ error: "Failed to parse file", detail: String(err) });
  }
});

// ── GET /api/quiz/export/:quizId ──────────────────────────────────────────────
// Export a quiz to XLSX in the Teachific Template format
router.get("/export/:quizId", async (req: Request, res: Response) => {
  try {
    const authUser = await authenticateRequest(req);
    if (!authUser) return res.status(401).json({ error: "Unauthorized" });
    const quizId = parseInt(req.params.quizId, 10);
    if (isNaN(quizId)) return res.status(400).json({ error: "Invalid quiz ID" });

    const quiz = await getQuizById(quizId);
    if (!quiz) return res.status(404).json({ error: "Quiz not found" });

    const questions = await getQuestionsByQuiz(quizId);
    const questionsWithChoices = await Promise.all(
      questions.map(async (q) => ({
        questionType: q.questionType as any,
        questionText: q.questionText,
        imagePath: q.imageUrl ?? undefined,
        explanation: q.explanation ?? undefined,
        points: q.points,
        correctFeedback: undefined as string | undefined,
        incorrectFeedback: undefined as string | undefined,
        choices: (await getChoicesByQuestion(q.id)).map((c) => ({
          sortOrder: c.sortOrder,
          choiceText: c.choiceText,
          isCorrect: c.isCorrect,
          matchTarget: c.matchTarget ?? undefined,
        })),
      }))
    );

    const buf = exportQuizToExcel(quiz.title, questionsWithChoices);

    const filename = `${quiz.title.replace(/[^a-z0-9]/gi, "_")}_quiz.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(buf);
  } catch (err: unknown) {
    console.error("[Quiz Export] Error:", err);
    return res.status(500).json({ error: "Failed to export quiz", detail: String(err) });
  }
});

// ── POST /api/quiz/bank-import/preview ───────────────────────────────────────
// Parse a CSV or SCORM ZIP/XML file and return questions for preview (no DB write)
// Accepts: .csv, .xml, .zip (SCORM package), .xlsx/.xls
router.post("/bank-import/preview", upload.single("file"), async (req: Request, res: Response) => {
  try {
    const user = await authenticateRequest(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const originalName = req.file.originalname.toLowerCase();
    const source = req.body.source as string ?? "auto";
    // ── CSV ─────────────────────────────────────────────────────────────────
    if (originalName.endsWith(".csv") || source === "csv") {
      const text = req.file.buffer.toString("utf-8");
      const questions = parseCSVToBank(text);
      return res.json({ source: "csv", questions, totalRows: questions.length, validCount: questions.length, errorCount: 0, warnings: [] });
    }
    // ── SCORM XML ────────────────────────────────────────────────────────────
    if (originalName.endsWith(".xml") || source === "scorm_xml") {
      const text = req.file.buffer.toString("utf-8");
      const questions = parseSCORMQTIToBank(text);
      return res.json({ source: "scorm", questions, totalRows: questions.length, validCount: questions.length, errorCount: 0, warnings: [] });
    }
    // ── SCORM ZIP ────────────────────────────────────────────────────────────
    if (originalName.endsWith(".zip")) {
      const { xlsxBuffer, xmlBuffers, mediaMap } = await extractBankZip(req.file.buffer);
      // If it contains an XLSX, treat as Teachific Excel import
      if (xlsxBuffer) {
        const orgId = (user as any)?.orgId?.toString() ?? "unknown";
        let mediaUrlMap = new Map<string, string>();
        if (mediaMap.size > 0) mediaUrlMap = await uploadMediaToS3(mediaMap, orgId);
        const result = parseQuizExcel(xlsxBuffer);
        if (mediaUrlMap.size > 0) {
          for (const q of result.questions) {
            if (q.imagePath) { const u = mediaUrlMap.get(q.imagePath); if (u) q.imagePath = u; }
          }
        }
        const bankQuestions = result.questions.map(q => excelParsedToBankQuestion(q));
        return res.json({ source: "xlsx", questions: bankQuestions, totalRows: result.totalRows, validCount: result.validCount, errorCount: result.errorCount, warnings: result.warnings });
      }
      // Otherwise look for QTI XML files (SCORM package)
      if (xmlBuffers.length > 0) {
        const allQuestions: BankQuestion[] = [];
        for (const xmlBuf of xmlBuffers) {
          const text = xmlBuf.toString("utf-8");
          allQuestions.push(...parseSCORMQTIToBank(text));
        }
        return res.json({ source: "scorm", questions: allQuestions, totalRows: allQuestions.length, validCount: allQuestions.length, errorCount: 0, warnings: [] });
      }
      return res.status(400).json({ error: "No supported file found inside the ZIP. Expected .xlsx, .xls, or QTI .xml files." });
    }
    // ── XLSX/XLS (direct) ────────────────────────────────────────────────────
    if (originalName.endsWith(".xlsx") || originalName.endsWith(".xls")) {
      const result = parseQuizExcel(req.file.buffer);
      const bankQuestions = result.questions.map(q => excelParsedToBankQuestion(q));
      return res.json({ source: "xlsx", questions: bankQuestions, totalRows: result.totalRows, validCount: result.validCount, errorCount: result.errorCount, warnings: result.warnings });
    }
    return res.status(400).json({ error: "Unsupported file type. Supported: .csv, .xml, .zip, .xlsx, .xls" });
  } catch (err: unknown) {
    console.error("[Bank Import] Parse error:", err);
    return res.status(500).json({ error: "Failed to parse file", detail: String(err) });
  }
});

// ─── Bank Question type ───────────────────────────────────────────────────────
interface BankQuestion {
  questionType: string;
  stem: string;
  dataJson: string;
  points: number;
  difficulty: "easy" | "medium" | "hard";
  explanation?: string;
  tags?: string;
}

// ─── CSV → Bank Questions ─────────────────────────────────────────────────────
function parseCSVToBank(csvText: string): BankQuestion[] {
  const lines = csvText.split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase().replace(/["']/g, ""));
  const questions: BankQuestion[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = (cols[idx] ?? "").trim(); });
    const stem = row["question"] || row["question_text"] || row["stem"] || row["text"];
    if (!stem) continue;
    const typeRaw = (row["type"] || row["question_type"] || "").toLowerCase();
    const questionType = detectBankType(typeRaw);
    const choices: Array<{ text: string; isCorrect: boolean; feedback?: string }> = [];
    ["a","b","c","d","e","f"].forEach(letter => {
      const text = row[letter] || row[`choice_${letter}`] || row[`option_${letter}`];
      if (text) {
        const correctAnswer = (row["correct_answer"] || row["answer"] || "").toLowerCase();
        choices.push({
          text,
          isCorrect: correctAnswer === letter || correctAnswer.split(/[,;]/).map(s => s.trim()).includes(letter),
          feedback: row[`feedback_${letter}`],
        });
      }
    });
    const dataJson = JSON.stringify({ choices, imageUrl: row["image_url"] || row["media_url"] || undefined });
    questions.push({
      questionType,
      stem,
      dataJson,
      points: parseFloat(row["points"] || row["point_value"] || "1") || 1,
      difficulty: normalizeDifficulty(row["difficulty"]),
      explanation: row["explanation"] || row["feedback"] || row["rationale"] || undefined,
      tags: row["tags"] || row["category"] || undefined,
    });
  }
  return questions;
}
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') { inQuotes = !inQuotes; }
    else if (char === "," && !inQuotes) { result.push(current); current = ""; }
    else { current += char; }
  }
  result.push(current);
  return result;
}
function detectBankType(raw: string): string {
  if (raw.includes("true") || raw === "tf" || raw === "boolean") return "tf";
  if (raw.includes("multi") && raw.includes("select")) return "multiple_select";
  if (raw.includes("match")) return "matching";
  if (raw.includes("order") || raw.includes("sequence")) return "ordering";
  if (raw.includes("numeric") || raw.includes("number")) return "numeric";
  if (raw.includes("short") || raw.includes("text") || raw === "sa") return "short_answer";
  if (raw.includes("long") || raw.includes("essay")) return "long_answer";
  if (raw.includes("fill") || raw.includes("blank")) return "fill_blank";
  return "mcq";
}
function normalizeDifficulty(raw?: string): "easy" | "medium" | "hard" {
  const v = (raw ?? "").toLowerCase();
  if (v === "easy" || v === "1" || v === "low") return "easy";
  if (v === "hard" || v === "3" || v === "high" || v === "difficult") return "hard";
  return "medium";
}

// ─── SCORM QTI XML → Bank Questions ──────────────────────────────────────────
function parseSCORMQTIToBank(xmlText: string): BankQuestion[] {
  const questions: BankQuestion[] = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let itemMatch;
  while ((itemMatch = itemRegex.exec(xmlText)) !== null) {
    const itemXml = itemMatch[1];
    // Extract question text from mattext or first <p>
    const matTextMatch = itemXml.match(/<mattext[^>]*>([\s\S]*?)<\/mattext>/i)
      || itemXml.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    if (!matTextMatch) continue;
    const stem = stripHtmlEntities(matTextMatch[1]).trim();
    if (!stem) continue;
    // Determine cardinality
    const rtMatch = itemXml.match(/rcardinality="([^"]+)"/i);
    const cardinality = rtMatch ? rtMatch[1].toLowerCase() : "single";
    const questionType = cardinality === "multiple" ? "multiple_select" : "mcq";
    // Extract choices
    const choices: Array<{ text: string; isCorrect: boolean }> = [];
    const choiceRegex = /<response_label[^>]*ident="([^"]+)"[^>]*>([\s\S]*?)<\/response_label>/gi;
    let choiceMatch;
    while ((choiceMatch = choiceRegex.exec(itemXml)) !== null) {
      const choiceId = choiceMatch[1];
      const choiceText = stripHtmlEntities(choiceMatch[2]).trim();
      if (choiceText) choices.push({ text: choiceText, isCorrect: false, id: choiceId } as any);
    }
    // Mark correct answers
    const correctRegex = /<varequal[^>]*>(.*?)<\/varequal>/gi;
    let correctMatch;
    while ((correctMatch = correctRegex.exec(itemXml)) !== null) {
      const correctId = correctMatch[1].trim();
      const choice = (choices as any[]).find(c => c.id === correctId);
      if (choice) choice.isCorrect = true;
    }
    // Extract explanation from feedback
    const feedbackMatches = itemXml.match(/<mattext[^>]*>([\s\S]*?)<\/mattext>/gi);
    const explanation = feedbackMatches && feedbackMatches.length > 1
      ? stripHtmlEntities(feedbackMatches[feedbackMatches.length - 1]).trim()
      : undefined;
    questions.push({
      questionType,
      stem,
      dataJson: JSON.stringify({ choices: choices.map(c => ({ text: (c as any).text, isCorrect: c.isCorrect })) }),
      points: 1,
      difficulty: "medium",
      explanation,
    });
  }
  return questions;
}
function stripHtmlEntities(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, " ").trim();
}

// ─── Excel ParsedQuestion → BankQuestion ─────────────────────────────────────
function excelParsedToBankQuestion(q: any): BankQuestion {
  // Map InternalQuestionType to questionBankItems enum
  const typeMap: Record<string, string> = {
    multiple_choice: "mcq", true_false: "tf", short_answer: "short_answer",
    matching: "matching", multiple_select: "multiple_select", sequence: "ordering",
    numeric: "numeric", info_slide: "mcq", essay: "long_answer", survey: "mcq",
  };
  const questionType = typeMap[q.questionType] ?? "mcq";
  const choices = (q.choices ?? []).map((c: any) => ({ text: c.choiceText, isCorrect: c.isCorrect, matchTarget: c.matchTarget }));
  const dataJson = JSON.stringify({ choices, imageUrl: q.imagePath, videoUrl: q.videoPath, audioUrl: q.audioPath });
  return {
    questionType,
    stem: q.questionText,
    dataJson,
    points: q.points ?? 1,
    difficulty: "medium",
    explanation: q.correctFeedback ? `✓ ${q.correctFeedback}${q.incorrectFeedback ? `\n✗ ${q.incorrectFeedback}` : ""}` : undefined,
  };
}

// ─── ZIP extractor for bank imports ──────────────────────────────────────────
async function extractBankZip(zipBuffer: Buffer): Promise<{ xlsxBuffer: Buffer | null; xmlBuffers: Buffer[]; mediaMap: Map<string, Buffer> }> {
  const mediaMap = new Map<string, Buffer>();
  const xmlBuffers: Buffer[] = [];
  let xlsxBuffer: Buffer | null = null;
  const readable = Readable.from(zipBuffer);
  const directory = readable.pipe(unzipper.Parse({ forceStream: true }));
  for await (const entry of directory) {
    const entryPath: string = (entry as any).path as string;
    const type: string = (entry as any).type as string;
    if (type === "Directory") { await (entry as any).autodrain(); continue; }
    const chunks: Buffer[] = [];
    for await (const chunk of entry) chunks.push(chunk as Buffer);
    const buf = Buffer.concat(chunks);
    const lower = entryPath.toLowerCase();
    if (!xlsxBuffer && (lower.endsWith(".xlsx") || lower.endsWith(".xls"))) { xlsxBuffer = buf; continue; }
    if (lower.endsWith(".xml") && (lower.includes("assessment") || lower.includes("quiz") || lower.includes("question") || lower.includes("qti"))) {
      xmlBuffers.push(buf); continue;
    }
    if (lower.endsWith(".xml") && !lower.includes("imsmanifest") && !lower.includes("metadata")) {
      xmlBuffers.push(buf); continue;
    }
    if (lower.includes("media/") && /\.(jpg|jpeg|png|gif|webp|svg|mp4|webm|mov|mp3|wav|ogg|m4a|aac)$/i.test(lower)) {
      const normalized = entryPath.replace(/^.*?(media\/.+)$/, "$1");
      mediaMap.set(normalized, buf);
    }
  }
  return { xlsxBuffer, xmlBuffers, mediaMap };
}

// ── GET /api/quiz/bank-import/csv-template ──────────────────────────────────
// Return a sample CSV template for question bank imports
router.get("/bank-import/csv-template", (_req: Request, res: Response) => {
  const csvContent = [
    "question,type,a,b,c,d,correct_answer,explanation,difficulty,tags,points",
    '"What is the capital of France?",mcq,Paris,London,Berlin,Madrid,a,"Paris is the capital of France.",easy,"geography,europe",1',
    '"The Earth orbits the Sun.",tf,True,False,,,a,"The Earth does orbit the Sun.",easy,science,1',
    '"Which of the following are prime numbers? (select all)",multiple_select,2,4,7,9,"a,c","2 and 7 are prime numbers.",medium,math,2',
    '"What is 15 * 4?",numeric,,,,,,"The answer is 60.",medium,math,1',
  ].join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="question-bank-template.csv"');
  res.send(csvContent);
});

// ── GET /api/quiz/template ────────────────────────────────────────────────────
// Redirect to the pre-built Teachific ZIP import template (includes sample media)
router.get("/template", (_req: Request, res: Response) => {
  res.redirect(302, TEMPLATE_ZIP_URL);
});

// ── GET /api/quiz/template/xlsx ───────────────────────────────────────────────
// Redirect to the XLSX-only template (no media, for simple imports)
router.get("/template/xlsx", (_req: Request, res: Response) => {
  res.redirect(302, TEMPLATE_XLSX_URL);
});

export default router;
