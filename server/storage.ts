/**
 * Storage abstraction layer
 *
 * Supports two backends, selected automatically by environment variables:
 *
 * 1. AWS S3 (for Railway / self-hosted deployments)
 *    Required: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_S3_BUCKET
 *    Optional: AWS_S3_PUBLIC_URL  (CDN/CloudFront prefix, e.g. https://cdn.example.com)
 *
 * 2. Manus built-in storage (default when running on the Manus platform)
 *    Required: BUILT_IN_FORGE_API_URL, BUILT_IN_FORGE_API_KEY
 */

import { ENV } from './_core/env';

// ─── Backend detection ────────────────────────────────────────────────────────

function isAwsConfigured(): boolean {
  return !!(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_REGION &&
    process.env.AWS_S3_BUCKET
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

// ─── AWS S3 Backend ───────────────────────────────────────────────────────────

function buildS3PublicUrl(key: string): string {
  const bucket = process.env.AWS_S3_BUCKET!;
  const region = process.env.AWS_REGION!;
  return process.env.AWS_S3_PUBLIC_URL
    ? `${process.env.AWS_S3_PUBLIC_URL.replace(/\/$/, "")}/${key}`
    : `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

async function s3Put(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const client = new S3Client({
    region: process.env.AWS_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
  const key = normalizeKey(relKey);
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: key,
      Body: typeof data === "string" ? Buffer.from(data) : data,
      ContentType: contentType,
    })
  );
  return { key, url: buildS3PublicUrl(key) };
}

async function s3PutStream(
  relKey: string,
  filePath: string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const { createReadStream, statSync } = await import("fs");
  const client = new S3Client({
    region: process.env.AWS_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
  const key = normalizeKey(relKey);
  const fileSize = statSync(filePath).size;
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: key,
      Body: createReadStream(filePath),
      ContentType: contentType,
      ContentLength: fileSize,
    })
  );
  return { key, url: buildS3PublicUrl(key) };
}

async function s3Get(relKey: string): Promise<{ key: string; url: string }> {
  const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const client = new S3Client({
    region: process.env.AWS_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
  const key = normalizeKey(relKey);
  const url = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: process.env.AWS_S3_BUCKET!, Key: key }),
    { expiresIn: 3600 }
  );
  return { key, url };
}

// ─── Manus Built-in Storage Backend ──────────────────────────────────────────

function getManusStorageConfig() {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;
  if (!baseUrl || !apiKey) {
    throw new Error(
      "No storage backend configured. Set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY/AWS_REGION/AWS_S3_BUCKET " +
      "for AWS S3, or BUILT_IN_FORGE_API_URL/BUILT_IN_FORGE_API_KEY for Manus storage."
    );
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

function buildManusUploadUrl(baseUrl: string, relKey: string): URL {
  const url = new URL("v1/storage/upload", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}

async function buildManusDownloadUrl(baseUrl: string, relKey: string, apiKey: string): Promise<string> {
  const url = new URL("v1/storage/downloadUrl", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  url.searchParams.set("path", normalizeKey(relKey));
  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  return (await response.json()).url;
}

async function manusPut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const { baseUrl, apiKey } = getManusStorageConfig();
  const key = normalizeKey(relKey);
  const uploadUrl = buildManusUploadUrl(baseUrl, key);
  const blob = typeof data === "string"
    ? new Blob([data], { type: contentType })
    : new Blob([data as any], { type: contentType });
  const form = new FormData();
  form.append("file", blob, key.split("/").pop() ?? key);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`Storage upload failed (${response.status} ${response.statusText}): ${message}`);
  }
  const url = (await response.json()).url;
  return { key, url };
}

async function manusPutStream(
  relKey: string,
  filePath: string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const { baseUrl, apiKey } = getManusStorageConfig();
  const key = normalizeKey(relKey);
  const uploadUrl = buildManusUploadUrl(baseUrl, key);
  const { createReadStream, statSync } = await import("fs");
  const FormDataNode = (await import("form-data")).default;
  const https = await import("https");
  const http = await import("http");
  const fileSize = statSync(filePath).size;
  const form = new FormDataNode();
  form.append("file", createReadStream(filePath), {
    filename: key.split("/").pop() ?? key,
    contentType,
    knownLength: fileSize,
  });
  const UPLOAD_TIMEOUT_MS = 30 * 60 * 1000;
  return new Promise((resolve, reject) => {
    const isHttps = uploadUrl.protocol === "https:";
    const transport = isHttps ? https : http;
    const options = {
      method: "POST",
      hostname: uploadUrl.hostname,
      port: uploadUrl.port || (isHttps ? 443 : 80),
      path: uploadUrl.pathname + uploadUrl.search,
      headers: { ...form.getHeaders(), Authorization: `Bearer ${apiKey}` },
    };
    let settled = false;
    const done = (fn: () => void) => { if (!settled) { settled = true; fn(); } };
    const req = (transport as typeof https).request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => {
        if ((res.statusCode ?? 500) >= 400) {
          done(() => reject(new Error(`Storage stream upload failed (${res.statusCode}): ${body.slice(0, 300)}`)));
          return;
        }
        try {
          done(() => resolve({ key, url: JSON.parse(body).url }));
        } catch {
          done(() => reject(new Error(`Invalid JSON from storage: ${body.slice(0, 300)}`)));
        }
      });
      res.on("error", (err) => done(() => reject(err)));
    });
    const timer = setTimeout(() => {
      req.destroy(new Error(`Storage upload timed out after ${UPLOAD_TIMEOUT_MS / 60000} minutes`));
    }, UPLOAD_TIMEOUT_MS);
    req.on("error", (err) => { clearTimeout(timer); done(() => reject(err)); });
    req.on("close", () => clearTimeout(timer));
    form.pipe(req);
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  return isAwsConfigured()
    ? s3Put(relKey, data, contentType)
    : manusPut(relKey, data, contentType);
}

export async function storagePutStream(
  relKey: string,
  filePath: string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  return isAwsConfigured()
    ? s3PutStream(relKey, filePath, contentType)
    : manusPutStream(relKey, filePath, contentType);
}

export async function storageGet(
  relKey: string
): Promise<{ key: string; url: string }> {
  if (isAwsConfigured()) {
    return s3Get(relKey);
  }
  const { baseUrl, apiKey } = getManusStorageConfig();
  const key = normalizeKey(relKey);
  return { key, url: await buildManusDownloadUrl(baseUrl, key, apiKey) };
}

/**
 * Generate a presigned PUT URL for direct browser-to-storage uploads.
 * Returns { uploadUrl, fileUrl, key } where:
 *   - uploadUrl: the URL the browser should PUT the file to (presigned S3 URL or server proxy)
 *   - fileUrl: the public URL of the file after upload
 *   - key: the storage key
 */
export async function storagePresignedPut(
  relKey: string,
  contentType = "application/octet-stream",
  expiresIn = 3600
): Promise<{ uploadUrl: string; fileUrl: string; key: string }> {
  const key = normalizeKey(relKey);
  if (isAwsConfigured()) {
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const client = new S3Client({
      region: process.env.AWS_REGION!,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    const uploadUrl = await getSignedUrl(
      client,
      new PutObjectCommand({ Bucket: process.env.AWS_S3_BUCKET!, Key: key, ContentType: contentType }),
      { expiresIn }
    );
    return { uploadUrl, fileUrl: buildS3PublicUrl(key), key };
  }
  // Manus storage: return the server-side upload endpoint as proxy
  // The browser will POST multipart/form-data to /api/media-upload
  return { uploadUrl: "/api/media-upload", fileUrl: "", key };
}

export async function storageDelete(relKey: string): Promise<void> {
  const key = normalizeKey(relKey);
  try {
    if (isAwsConfigured()) {
      const { S3Client, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
      const client = new S3Client({
        region: process.env.AWS_REGION!,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });
      await client.send(new DeleteObjectCommand({ Bucket: process.env.AWS_S3_BUCKET!, Key: key }));
      return;
    }
    // Manus storage delete
    const { baseUrl, apiKey } = getManusStorageConfig();
    const deleteUrl = new URL("v1/storage/delete", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
    deleteUrl.searchParams.set("path", key);
    await fetch(deleteUrl, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  } catch {
    // Ignore delete errors — file may already be gone
  }
}
