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
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const orgId = (req as any).user?.orgId?.toString() ?? "unknown";
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
    const user = await sdk.authenticateRequest(req).catch(() => null);
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

// ── GET /api/quiz/export-html/:quizId ──────────────────────────────────────────────────────────────
router.get("/export-html/:quizId", async (req: Request, res: Response) => {
  try {
    const quizId = parseInt(req.params.quizId, 10);
    if (isNaN(quizId)) return res.status(400).json({ error: "Invalid quiz ID" });
    const quiz = await getQuizById(quizId);
    if (!quiz) return res.status(404).json({ error: "Quiz not found" });
    const questions = await getQuestionsByQuiz(quizId);
    const questionsWithChoices = await Promise.all(
      questions.map(async (q) => ({ ...q, choices: await getChoicesByQuestion(q.id) }))
    );
    const html = buildQuizHtml(quiz, questionsWithChoices, { scormMode: false });
    const filename = sanitizeFilename(quiz.title ?? "quiz");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.html"`);
    res.send(html);
  } catch (err) {
    console.error("[Quiz HTML Export]", err);
    res.status(500).json({ error: "Export failed", detail: String(err) });
  }
});

// ── GET /api/quiz/export-scorm/:quizId ─────────────────────────────────────────────────────────────
router.get("/export-scorm/:quizId", async (req: Request, res: Response) => {
  try {
    const quizId = parseInt(req.params.quizId, 10);
    if (isNaN(quizId)) return res.status(400).json({ error: "Invalid quiz ID" });
    const quiz = await getQuizById(quizId);
    if (!quiz) return res.status(404).json({ error: "Quiz not found" });
    const questions = await getQuestionsByQuiz(quizId);
    const questionsWithChoices = await Promise.all(
      questions.map(async (q) => ({ ...q, choices: await getChoicesByQuestion(q.id) }))
    );
    // Build the HTML and manifest in memory, then zip them
    const quizHtml = buildQuizHtml(quiz, questionsWithChoices, { scormMode: true });
    const manifest = buildScormManifest(quiz);
    const scormApiJs = buildScormApi();
    // Use archiver to create the ZIP
    const archiver = (await import("archiver")).default;
    const { PassThrough } = await import("stream");
    const archive = archiver("zip", { zlib: { level: 9 } });
    const pass = new PassThrough();
    archive.pipe(pass);
    archive.append(quizHtml, { name: "index.html" });
    archive.append(manifest, { name: "imsmanifest.xml" });
    archive.append(scormApiJs, { name: "scorm_api.js" });
    await archive.finalize();
    const chunks: Buffer[] = [];
    for await (const chunk of pass) chunks.push(chunk as Buffer);
    const zipBuf = Buffer.concat(chunks);
    const filename = sanitizeFilename(quiz.title ?? "quiz");
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}_scorm.zip"`);
    res.send(zipBuf);
  } catch (err) {
    console.error("[Quiz SCORM Export]", err);
    res.status(500).json({ error: "SCORM export failed", detail: String(err) });
  }
});

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-\s]/g, "").replace(/\s+/g, "_").slice(0, 80);
}

function escHtml(s: string): string {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildQuizHtml(quiz: any, questions: any[], opts: { scormMode?: boolean } = {}): string {
  const { scormMode = false } = opts;
  const title = quiz.title ?? "Quiz";
  const passingScore = quiz.passingScore ?? quiz.passScorePercent ?? 70;
  const shuffleQ = quiz.shuffleQuestions ?? quiz.randomizeQuestions ?? false;
  const shuffleA = quiz.shuffleAnswers ?? quiz.randomizeAnswers ?? false;
  const feedbackMode = quiz.feedbackMode ?? (quiz.showFeedbackImmediately ? "immediate" : "end");
  const questionsJson = JSON.stringify(questions.map(q => ({
    id: q.id,
    type: q.questionType,
    text: q.questionText,
    imageUrl: q.imageUrl ?? q.image ?? null,
    videoUrl: q.videoUrl ?? q.video ?? null,
    explanation: q.explanation ?? null,
    points: q.points ?? 1,
    choices: (q.choices ?? []).map((c: any) => ({
      id: c.id,
      text: c.choiceText ?? c.text ?? "",
      isCorrect: !!c.isCorrect,
      feedback: c.feedbackText ?? c.feedback ?? null,
    })),
  })));

  const scormScript = scormMode ? '<script src="scorm_api.js"><\/script>' : "";
  const descHtml = quiz.description ? '<p class="quiz-subtitle">' + escHtml(quiz.description) + '</p>' : "";

  // JS code as string concatenation to avoid nested backtick issues
  const jsCode = [
    'const QUESTIONS = ' + questionsJson + ';',
    'const CONFIG = { passingScore: ' + passingScore + ', shuffleQ: ' + shuffleQ + ', shuffleA: ' + shuffleA + ', feedbackMode: "' + feedbackMode + '", scormMode: ' + scormMode + ' };',
    'let current = 0, answers = [], score = 0;',
    'function shuffle(arr) { for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]}return arr; }',
    'let qs = CONFIG.shuffleQ ? shuffle([...QUESTIONS]) : [...QUESTIONS];',
    'function startQuiz() {',
    '  document.getElementById("start-screen").classList.add("hidden");',
    '  document.getElementById("quiz-screen").classList.remove("hidden");',
    '  showQuestion();',
    '}',
    'function showQuestion() {',
    '  const q = qs[current];',
    '  const choices = CONFIG.shuffleA ? shuffle([...q.choices]) : [...q.choices];',
    '  const letters = ["A","B","C","D","E","F"];',
    '  let choicesHtml = choices.map((c,i) => {',
    '    const btn = document.createElement("button");',
    '    btn.className = "choice-btn";',
    '    btn.dataset.correct = c.isCorrect;',
    '    btn.dataset.feedback = c.feedback || "";',
    '    btn.onclick = function(){ selectChoice(this, c.isCorrect); };',
    '    btn.innerHTML = "<span class=\\"choice-letter\\">" + letters[i] + "</span>" + escJs2(c.text);',
    '    return btn.outerHTML;',
    '  }).join("");',
    '  const mediaHtml = q.imageUrl ? "<div class=\\"question-media\\"><img src=\\"" + escJs(q.imageUrl) + "\\" alt=\\"Question image\\"></div>" :',
    '    q.videoUrl ? "<div class=\\"question-media\\"><video controls src=\\"" + escJs(q.videoUrl) + "\\"></video></div>" : "";',
    '  document.getElementById("quiz-screen").innerHTML =',
    '    "<div class=\\"progress-bar\\"><div class=\\"progress-fill\\" style=\\"width:" + Math.round((current/qs.length)*100) + "%\\"></div></div>" +',
    '    "<div class=\\"question-card\\">" +',
    '      "<div class=\\"question-num\\">Question " + (current+1) + " of " + qs.length + "</div>" +',
    '      mediaHtml +',
    '      "<div class=\\"question-text\\">" + escJs2(q.text) + "</div>" +',
    '      "<div class=\\"choices\\" id=\\"choices\\">" + choicesHtml + "</div>" +',
    '      "<div id=\\"feedback\\" class=\\"hidden\\"></div>" +',
    '    "</div>" +',
    '    "<div class=\\"nav-btns\\">" +',
    '      "<button class=\\"btn btn-secondary\\" onclick=\\"prevQ()\\" " + (current===0?"disabled":"") + ">Back</button>" +',
    '      "<button class=\\"btn btn-primary\\" id=\\"next-btn\\" onclick=\\"nextQ()\\" disabled>" + (current===qs.length-1?"Finish":"Next") + "</button>" +',
    '    "</div>";',
    '}',
    'function selectChoice(btn, correct) {',
    '  document.querySelectorAll(".choice-btn").forEach(b => b.classList.remove("selected"));',
    '  btn.classList.add("selected");',
    '  answers[current] = { correct };',
    '  document.getElementById("next-btn").disabled = false;',
    '  if (CONFIG.feedbackMode === "immediate") showFeedback(correct, btn.dataset.feedback, qs[current].explanation);',
    '}',
    'function showFeedback(correct, choiceFeedback, explanation) {',
    '  document.querySelectorAll(".choice-btn").forEach(b => {',
    '    if (b.dataset.correct === "true") b.classList.add("correct");',
    '    else if (b.classList.contains("selected")) b.classList.add("incorrect");',
    '  });',
    '  const fb = document.getElementById("feedback");',
    '  fb.className = "feedback-box " + (correct ? "correct" : "incorrect");',
    '  const msg = choiceFeedback || explanation || "";',
    '  fb.innerHTML = (correct ? "\\u2713 Correct! " : "\\u2717 Incorrect. ") + escJs2(msg);',
    '  fb.classList.remove("hidden");',
    '  document.getElementById("next-btn").disabled = false;',
    '}',
    'function nextQ() { if (current < qs.length-1) { current++; showQuestion(); } else showResults(); }',
    'function prevQ() { if (current > 0) { current--; showQuestion(); } }',
    'function showResults() {',
    '  let correct = answers.filter(a => a && a.correct).length;',
    '  let pct = Math.round((correct / qs.length) * 100);',
    '  let passed = pct >= CONFIG.passingScore;',
    '  if (CONFIG.scormMode) {',
    '    try { API.LMSInitialize(""); API.LMSSetValue("cmi.core.score.raw", String(pct)); API.LMSSetValue("cmi.core.lesson_status", passed ? "passed" : "failed"); API.LMSCommit(""); API.LMSFinish(""); } catch(e){}',
    '  }',
    '  document.getElementById("quiz-screen").classList.add("hidden");',
    '  const rs = document.getElementById("results-screen");',
    '  rs.classList.remove("hidden");',
    '  rs.innerHTML =',
    '    "<div class=\\"results-card\\">" +',
    '      "<div class=\\"score-circle\\" style=\\"--pct:" + (pct*3.6) + "\\">" +',
    '        "<div class=\\"score-inner\\"><div class=\\"score-pct\\">" + pct + "%</div><div class=\\"score-label\\">Score</div></div>" +',
    '      "</div>" +',
    '      "<div class=\\"pass-badge " + (passed?"pass":"fail") + "\\">" + (passed ? "\\u2713 PASSED" : "\\u2717 FAILED") + "</div>" +',
    '      "<p style=\\"color:#94a3b8;margin-bottom:24px\\">" + correct + " of " + qs.length + " correct &bull; Passing: " + CONFIG.passingScore + "%</p>" +',
    '      "<button class=\\"btn btn-primary\\" onclick=\\"location.reload()\\">Retake Quiz</button>" +',
    '    "</div>";',
    '}',
    'function escJs(s) { return (s||"").replace(/"/g,"&quot;").replace(/\'/g,"&#39;"); }',
    'function escJs2(s) { const d=document.createElement("div");d.textContent=s||"";return d.innerHTML; }',
  ].join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(title)}</title>
${scormScript}
<style>
*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}.quiz-container{width:100%;max-width:720px;background:#1e293b;border-radius:16px;padding:32px;box-shadow:0 25px 50px rgba(0,0,0,.5)}.quiz-header{text-align:center;margin-bottom:32px}.quiz-title{font-size:1.8rem;font-weight:700;color:#fff;margin-bottom:8px}.quiz-subtitle{color:#94a3b8;font-size:.95rem}.progress-bar{background:#334155;border-radius:8px;height:8px;margin-bottom:24px;overflow:hidden}.progress-fill{background:linear-gradient(90deg,#24abbc,#0e7490);height:100%;border-radius:8px;transition:width .4s ease}.question-card{background:#0f172a;border-radius:12px;padding:24px;margin-bottom:20px}.question-num{font-size:.8rem;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px}.question-text{font-size:1.1rem;font-weight:500;color:#e2e8f0;line-height:1.6;margin-bottom:20px}.question-media img,.question-media video{max-width:100%;border-radius:8px;margin-bottom:16px}.choices{display:flex;flex-direction:column;gap:10px}.choice-btn{background:#1e293b;border:2px solid #334155;border-radius:10px;padding:14px 18px;text-align:left;cursor:pointer;color:#e2e8f0;font-size:.95rem;transition:all .2s;display:flex;align-items:center;gap:12px}.choice-btn:hover{border-color:#24abbc;background:#1e3a4a}.choice-btn.selected{border-color:#24abbc;background:#0e3a45}.choice-btn.correct{border-color:#22c55e;background:#052e16;color:#86efac}.choice-btn.incorrect{border-color:#ef4444;background:#2d0a0a;color:#fca5a5}.choice-letter{width:28px;height:28px;border-radius:50%;background:#334155;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.8rem;flex-shrink:0}.feedback-box{margin-top:16px;padding:14px;border-radius:8px;font-size:.9rem;line-height:1.5}.feedback-box.correct{background:#052e16;border:1px solid #22c55e;color:#86efac}.feedback-box.incorrect{background:#2d0a0a;border:1px solid #ef4444;color:#fca5a5}.nav-btns{display:flex;justify-content:space-between;margin-top:24px;gap:12px}.btn{padding:12px 28px;border-radius:10px;border:none;cursor:pointer;font-size:.95rem;font-weight:600;transition:all .2s}.btn-primary{background:#24abbc;color:#fff}.btn-primary:hover{background:#1a8fa0}.btn-secondary{background:#334155;color:#e2e8f0}.btn-secondary:hover{background:#475569}.results-card{text-align:center;padding:32px}.score-circle{width:140px;height:140px;border-radius:50%;background:conic-gradient(#24abbc calc(var(--pct)*1deg),#334155 0);display:flex;align-items:center;justify-content:center;margin:0 auto 24px;position:relative}.score-inner{width:110px;height:110px;border-radius:50%;background:#1e293b;display:flex;flex-direction:column;align-items:center;justify-content:center}.score-pct{font-size:2rem;font-weight:800;color:#fff}.score-label{font-size:.75rem;color:#94a3b8}.pass-badge{display:inline-block;padding:6px 16px;border-radius:20px;font-size:.85rem;font-weight:700;margin-bottom:20px}.pass{background:#052e16;color:#22c55e;border:1px solid #22c55e}.fail{background:#2d0a0a;color:#ef4444;border:1px solid #ef4444}.hidden{display:none}
</style>
</head>
<body>
<div class="quiz-container" id="app">
  <div id="start-screen">
    <div class="quiz-header">
      <h1 class="quiz-title">${escHtml(title)}</h1>
      ${descHtml}
    </div>
    <div style="text-align:center;margin-top:32px">
      <p style="color:#94a3b8;margin-bottom:24px">${questions.length} question${questions.length !== 1 ? "s" : ""} &bull; Passing score: ${passingScore}%</p>
      <button class="btn btn-primary" onclick="startQuiz()" style="font-size:1.1rem;padding:16px 48px">Start Quiz</button>
    </div>
  </div>
  <div id="quiz-screen" class="hidden"></div>
  <div id="results-screen" class="hidden"></div>
</div>
<script>
${jsCode}
</script>
</body>
</html>`;
}

function buildScormManifest(quiz: any): string {
  const title = escHtml(quiz.title ?? "Quiz");
  const id = `quiz_${quiz.id ?? Date.now()}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${id}" version="1.2"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd">
  <metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata>
  <organizations default="${id}_org">
    <organization identifier="${id}_org">
      <title>${title}</title>
      <item identifier="${id}_item" identifierref="${id}_res">
        <title>${title}</title>
        <adlcp:masteryscore>${quiz.passingScore ?? quiz.passScorePercent ?? 70}</adlcp:masteryscore>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="${id}_res" type="webcontent" adlcp:scormtype="sco" href="index.html">
      <file href="index.html"/>
      <file href="scorm_api.js"/>
    </resource>
  </resources>
</manifest>`;
}

function buildScormApi(): string {
  return `// SCORM 1.2 API Wrapper - auto-discovers LMS API in parent frames
var API = (function() {
  var data = {};
  return {
    LMSInitialize: function(s) { return 'true'; },
    LMSFinish: function(s) { return 'true'; },
    LMSGetValue: function(k) { return data[k] || ''; },
    LMSSetValue: function(k,v) { data[k]=v; return 'true'; },
    LMSCommit: function(s) { return 'true'; },
    LMSGetLastError: function() { return '0'; },
    LMSGetErrorString: function(c) { return ''; },
    LMSGetDiagnostic: function(c) { return ''; }
  };
})();
(function() {
  var win = window;
  for (var i=0; i<10; i++) {
    try { if (win.parent && win.parent !== win && typeof win.parent.API !== 'undefined') { API = win.parent.API; break; } } catch(e) { break; }
    if (!win.parent || win.parent === win) break;
    win = win.parent;
  }
})();`;
}

// ── GET /api/quiz/template ──────────────────────────────────────────────────────────────────────────────
// Redirect to the pre-built Teachific ZIP import template (includes sample media)
router.get("/template", (_req: Request, res: Response) => {ct(302, TEMPLATE_ZIP_URL);
});

// ── GET /api/quiz/template/xlsx ───────────────────────────────────────────────
// Redirect to the XLSX-only template (no media, for simple imports)
router.get("/template/xlsx", (_req: Request, res: Response) => {
  res.redirect(302, TEMPLATE_XLSX_URL);
});

export default router;
