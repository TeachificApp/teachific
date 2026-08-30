/**
 * Seed script: uploads a local SCORM package to S3 and registers it in the
 * database under org 1, user 1.
 *
 * Usage: node server/seedPackage.mjs
 */
import fs from "fs";
import path from "path";
import { createReadStream } from "fs";
import { pipeline } from "stream/promises";
import unzipper from "unzipper";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ZIP_PATH = process.env.SCORM_SEED_PACKAGE_PATH || "/home/ubuntu/upload/package.zip";

// ── Storage helpers (mirrors server/storage.ts) ──────────────────────────────
const FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL;
const FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;

async function storagePut(relKey, data, contentType = "application/octet-stream") {
  const normalizedKey = relKey.replace(/^\/+/, "");
  const fileName = normalizedKey.split("/").pop() || "file";
  const blob = new Blob([data], { type: contentType });
  const formData = new FormData();
  formData.append("file", blob, fileName);

  // path is passed as a query param (matches storage.ts buildUploadUrl)
  const baseUrl = FORGE_API_URL.replace(/\/+$/, "");
  const uploadUrl = `${baseUrl}/v1/storage/upload?path=${encodeURIComponent(normalizedKey)}`;

  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${FORGE_API_KEY}` },
    body: formData,
  });
  if (!res.ok) throw new Error(`storagePut failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return { key: normalizedKey, url: json.url };
}

// ── DB helpers (raw mysql2) ───────────────────────────────────────────────────
import mysql from "mysql2/promise";

const db = await mysql.createConnection(process.env.DATABASE_URL);

async function insertPackage(orgId, uploadedBy, title, description, displayMode) {
  const [result] = await db.execute(
    `INSERT INTO content_packages
       (orgId, uploadedBy, title, description, displayMode, status, contentType, originalZipKey, originalZipUrl, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, 'processing', 'unknown', '', '', NOW(), NOW())`,
    [orgId, uploadedBy, title, description, displayMode]
  );
  return result.insertId;
}

async function updatePackageZip(packageId, zipKey, zipUrl) {
  await db.execute(
    `UPDATE content_packages SET originalZipKey=?, originalZipUrl=?, updatedAt=NOW() WHERE id=?`,
    [zipKey, zipUrl, packageId]
  );
}

async function insertVersion(packageId, uploadedBy, versionNumber, zipKey, zipUrl, notes, fileCount) {
  const [result] = await db.execute(
    `INSERT INTO content_versions
       (packageId, uploadedBy, versionNumber, zipKey, zipUrl, zipSize, changelog, isActive, fileCount, createdAt)
     VALUES (?, ?, ?, ?, ?, 0, ?, 1, ?, NOW())`,
    [packageId, uploadedBy, versionNumber, zipKey, zipUrl, notes, fileCount || 0]
  );
  return result.insertId;
}

async function insertAsset(packageId, versionId, s3Key, s3Url, mimeType, relativePath, isEntry, fileSize) {
  await db.execute(
    `INSERT INTO file_assets
       (packageId, versionId, s3Key, s3Url, mimeType, relativePath, isEntryPoint, fileSize, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [packageId, versionId, s3Key, s3Url, mimeType, relativePath, isEntry ? 1 : 0, fileSize || 0]
  );
}

async function finalizePackage(packageId, entryPoint, contentType, title) {
  await db.execute(
    `UPDATE content_packages
     SET status='ready', scormEntryPoint=?, contentType=?, title=?, updatedAt=NOW()
     WHERE id=?`,
    [entryPoint, contentType, title, packageId]
  );
}

// ── MIME helper ───────────────────────────────────────────────────────────────
function getMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    ".html": "text/html", ".htm": "text/html",
    ".js": "application/javascript", ".mjs": "application/javascript",
    ".css": "text/css",
    ".json": "application/json", ".xml": "application/xml",
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".gif": "image/gif", ".svg": "image/svg+xml", ".ico": "image/x-icon",
    ".webp": "image/webp",
    ".mp4": "video/mp4", ".webm": "video/webm", ".ogv": "video/ogg",
    ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav",
    ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf",
    ".pdf": "application/pdf",
    ".zip": "application/zip",
  };
  return map[ext] || "application/octet-stream";
}

// ── SCORM manifest detection ──────────────────────────────────────────────────
function detectScormVersion(xmlContent) {
  if (xmlContent.includes("CAM_V1p3") || xmlContent.includes("adlcp_rootv1p2")) return "scorm_12";
  if (xmlContent.includes("2004") || xmlContent.includes("SCORM_2004")) return "scorm_2004";
  return "html5";
}

function findEntryPoint(files) {
  // Priority: story.html > index.html (deepest first)
  const htmlFiles = files.filter(f => /\.(html|htm)$/i.test(f));
  const story = htmlFiles.find(f => /story\.html?$/i.test(f));
  if (story) return story;
  // Prefer shallowest index.html
  const indices = htmlFiles.filter(f => /index\.html?$/i.test(f));
  if (indices.length > 0) {
    indices.sort((a, b) => a.split("/").length - b.split("/").length);
    return indices[0];
  }
  return htmlFiles[0] || null;
}

// ── Main ──────────────────────────────────────────────────────────────────────
const ORG_ID = 1;
const USER_ID = 1;
const TITLE = process.env.SCORM_SEED_PACKAGE_TITLE || "Imported SCORM Package";
const DESCRIPTION = process.env.SCORM_SEED_PACKAGE_DESCRIPTION || "Imported training content";
const DISPLAY_MODE = "native";
const BATCH = 8; // parallel S3 uploads

console.log(`\n🚀 Seeding: ${TITLE}`);
console.log(`   File: ${ZIP_PATH}`);
const stat = fs.statSync(ZIP_PATH);
console.log(`   Size: ${(stat.size / 1024 / 1024).toFixed(1)} MB\n`);

// 1. Insert package record
const packageId = await insertPackage(ORG_ID, USER_ID, TITLE, DESCRIPTION, DISPLAY_MODE);
console.log(`✅ Package record created: ID=${packageId}`);

// 2. Upload raw ZIP to S3
const suffix = Date.now();
const zipKey = `org-${ORG_ID}/packages/${packageId}/v1/source-${suffix}.zip`;
console.log("📤 Uploading ZIP to S3...");
const zipBuffer = fs.readFileSync(ZIP_PATH);
const { url: zipUrl } = await storagePut(zipKey, zipBuffer, "application/zip");
console.log(`✅ ZIP uploaded: ${zipUrl}`);
await updatePackageZip(packageId, zipKey, zipUrl);

// 3. Insert version record
const versionId = await insertVersion(packageId, USER_ID, 1, zipKey, zipUrl, "Initial upload");
console.log(`✅ Version record created: ID=${versionId}`);

// 4. Extract ZIP and upload each file
console.log("📦 Extracting and uploading files...");
const fileEntries = [];
const directory = await unzipper.Open.file(ZIP_PATH);
for (const entry of directory.files) {
  if (entry.type === "Directory") continue;
  fileEntries.push(entry);
}
console.log(`   Total files: ${fileEntries.length}`);

let done = 0;
let scormXml = null;
const allPaths = fileEntries.map(e => e.path);
const entryPointPath = findEntryPoint(allPaths);

// Process in batches
for (let i = 0; i < fileEntries.length; i += BATCH) {
  const batch = fileEntries.slice(i, i + BATCH);
  await Promise.all(batch.map(async (entry) => {
    const filePath = entry.path;
    const fileKey = `org-${ORG_ID}/packages/${packageId}/v1/files/${filePath}`;
    const mime = getMime(filePath);
    const buffer = await entry.buffer();

    // Capture SCORM manifest
    if (filePath.toLowerCase().includes("imsmanifest.xml") && !scormXml) {
      scormXml = buffer.toString("utf-8");
    }

    const { url: fileUrl } = await storagePut(fileKey, buffer, mime);
    const isEntry = filePath === entryPointPath;
    await insertAsset(packageId, versionId, fileKey, fileUrl, mime, filePath, isEntry);
    done++;
    if (done % 20 === 0 || done === fileEntries.length) {
      process.stdout.write(`\r   Progress: ${done}/${fileEntries.length} files`);
    }
  }));
}
console.log(`\n✅ All ${done} files uploaded`);

// 5. Detect content type
let contentType = "html5";
if (scormXml) {
  contentType = detectScormVersion(scormXml);
  console.log(`✅ SCORM manifest found: ${contentType}`);
} else {
  console.log("ℹ️  No SCORM manifest — treating as HTML5");
}

// 6. Finalize package
await finalizePackage(packageId, entryPointPath, contentType, TITLE);
console.log(`✅ Package finalized: entry=${entryPointPath}, type=${contentType}`);

await db.end();
console.log(`\n🎉 Done! Package ID: ${packageId} — "${TITLE}" is ready in Teachific™\n`);
