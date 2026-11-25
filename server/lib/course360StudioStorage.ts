import { TRPCError } from "@trpc/server";
import { lookup } from "node:dns/promises";
import https from "node:https";
import { createWriteStream, createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import { storageGet } from "../storage";
import { ENV } from "../_core/env";
import { isPublicIpAddress, validatePublicSourceUrl } from "./publicSourceUrl";

export const STUDIO_INPUT_BYTES = 8 * 1024 * 1024;
export const STUDIO_OUTPUT_BYTES = 16 * 1024 * 1024;
const fail = (message: string): never => { throw new TRPCError({ code: "BAD_REQUEST", message }); };
export function validateStudioStorageKey(key: string) {
  if (!key || key.length > 1000 || key.startsWith("/") || /[\\\x00-\x1f?#]/.test(key) || key.split("/").some(p => p === "." || p === ".." || !p)) fail("A valid owned storage key is required.");
  return key;
}
export function isStudioKeyForOrg(key: string, orgId: number) {
  validateStudioStorageKey(key);
  return key.startsWith(`org-${orgId}/`) || key.startsWith(`lms-media/${orgId}/`) || new RegExp(`^[a-z0-9-]+/${orgId}/`, "i").test(key);
}
export async function resolveStudioStorage(key: string, signal = AbortSignal.timeout(15_000)) {
  validateStudioStorageKey(key);
  // AWS storageGet only signs a request locally with the configured credentials.
  // Manus storageGet currently has no timeout/signal; retain its key-first API
  // contract through a bounded downloadUrl lookup rather than a detached fetch.
  let result: { key: string; url: string };
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_REGION && process.env.AWS_S3_BUCKET) {
    result = await storageGet(key);
  } else {
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Studio storage is not configured." });
    const endpoint = new URL("v1/storage/downloadUrl", ENV.forgeApiUrl.replace(/\/?$/, "/"));
    endpoint.searchParams.set("path", key);
    const response = await fetch(endpoint, { redirect: "error", signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]), headers: { Authorization: `Bearer ${ENV.forgeApiKey}` } });
    if (!response.ok || !response.body) throw new TRPCError({ code: "BAD_REQUEST", message: "The owned storage key could not be resolved." });
    const reader = response.body.getReader(); let size = 0; const chunks: Uint8Array[] = [];
    try {
      while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length;
        if (size > 16_000) fail("Storage returned an oversized object reference."); chunks.push(part.value); }
      result = { key, url: JSON.parse(Buffer.concat(chunks).toString("utf8")).url };
    } finally { await reader.cancel().catch(() => {}); }
  }
  if (result.key !== key) fail("Storage returned a different object identity.");
  const url = validatePublicSourceUrl(result.url);
  if (url.protocol !== "https:") fail("Studio storage retrieval requires HTTPS.");
  return { key, url: url.toString() };
}

/** Every connection is pinned to public DNS; redirects are never followed. Signed queries are never logged. */
export async function requestStudioStorage(urlString: string, method: "GET" | "HEAD", signal: AbortSignal) {
  const url = validatePublicSourceUrl(urlString);
  if (url.protocol !== "https:") fail("Studio storage retrieval requires HTTPS.");
  const records = await lookup(url.hostname, { all: true, verbatim: true });
  if (!records.length || records.some(r => !isPublicIpAddress(r.address))) fail("Storage must resolve only to public internet addresses.");
  const address = records[0];
  signal.throwIfAborted();
  return await new Promise<import("node:http").IncomingMessage>((resolve, reject) => {
    const req = https.request({ hostname: url.hostname, port: 443, path: url.pathname + url.search, method, signal,
      headers: { "Accept-Encoding": "identity" }, lookup: (_host, _options, callback) => callback(null, address.address, address.family) }, res => {
      if ((res.statusCode ?? 0) < 200 || (res.statusCode ?? 0) >= 300 || (res.headers["content-encoding"] && res.headers["content-encoding"] !== "identity")) {
        res.destroy(); reject(new TRPCError({ code: "BAD_REQUEST", message: "The owned storage object is unavailable or redirects; no external URL was followed." }));
      } else resolve(res);
    });
    req.setTimeout(15_000, () => req.destroy(new Error("Studio storage retrieval timed out.")));
    req.once("error", () => reject(new TRPCError({ code: "TIMEOUT", message: "Studio storage retrieval failed or timed out." })));
    req.end();
  });
}

export async function downloadStudioSource(key: string, destination: string, signal: AbortSignal) {
  const { url } = await resolveStudioStorage(key, signal);
  const response = await requestStudioStorage(url, "GET", signal);
  const declared = Number(response.headers["content-length"]);
  if (Number.isFinite(declared) && declared > STUDIO_INPUT_BYTES) { response.destroy(); fail("This source exceeds the bounded 8 MiB Studio processor. Shorten or compress the source before retrying."); }
  let bytes = 0;
  const cap = new Transform({ transform(chunk: Buffer, _encoding, callback) {
    bytes += chunk.length;
    callback(bytes > STUDIO_INPUT_BYTES ? new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "This source exceeds the bounded 8 MiB Studio processor." }) : null, chunk);
  } });
  await pipeline(response, cap, createWriteStream(destination, { flags: "wx", mode: 0o600 }), { signal });
  if (!bytes) fail("The owned storage object is empty.");
  return { bytes };
}

export function assertStudioRegistrationUrl(input: string, key: string, authoritative: string) {
  validateStudioStorageKey(key);
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  if (input === `/manus-storage/${encodedKey}` || input === `/manus-storage/${key}`) return;
  let candidate: URL, canonical: URL;
  try { candidate = new URL(input); canonical = new URL(authoritative); } catch { return fail("The media URL does not identify the uploaded storage object."); }
  if (candidate.username || candidate.password || candidate.protocol !== "https:" || candidate.hash) fail("The media URL does not identify the uploaded storage object.");
  // A generic download endpoint can encode object identity in its query. Only
  // object-key paths may ignore expiring signing queries; otherwise exact URL is required.
  const pathCarriesKey = decodeURIComponent(canonical.pathname).endsWith(`/${key}`);
  let matches = candidate.origin === canonical.origin && candidate.pathname === canonical.pathname
    && (pathCarriesKey || candidate.search === canonical.search);
  if (process.env.AWS_S3_PUBLIC_URL) {
    const publicUrl = new URL(`${process.env.AWS_S3_PUBLIC_URL.replace(/\/$/, "")}/${encodedKey}`);
    matches ||= candidate.origin === publicUrl.origin && candidate.pathname === publicUrl.pathname;
  }
  if (!matches) fail("The media URL and key do not identify the same authoritative storage object.");
}

/** Lookup, not textual key prefix, proves object existence/URL/MIME/size. */
export async function inspectStudioRegistration(key: string, inputUrl: string, signal = AbortSignal.timeout(15_000)) {
  const resolved = await resolveStudioStorage(key, signal);
  assertStudioRegistrationUrl(inputUrl, key, resolved.url);
  const response = await requestStudioStorage(resolved.url, "HEAD", signal);
  response.resume();
  const size = Number(response.headers["content-length"]);
  const mimeType = String(response.headers["content-type"] ?? "application/octet-stream").split(";")[0].trim();
  if (!Number.isSafeInteger(size) || size < 1 || size > 2_147_483_647) fail("Storage must report a positive size representable by the current media schema; larger media requires a migration.");
  if (!/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(mimeType) || mimeType.length > 100) fail("Storage returned an unsupported MIME type.");
  // Stable application reference; retrieval always resolves the key, never this public string.
  const url = inputUrl.startsWith("/manus-storage/") ? inputUrl : (() => {
    const u = new URL(inputUrl);
    if (decodeURIComponent(u.pathname).endsWith(`/${key}`)) u.search = "";
    return u.toString();
  })();
  return { key, url, size, mimeType };
}

/** Abortable bounded derivative upload; shared storagePutStream's 30-minute timeout is unsuitable here. */
export async function storeStudioFile(key: string, path: string, mimeType: string, signal: AbortSignal) {
  validateStudioStorageKey(key);
  const size = (await stat(path)).size;
  if (size <= 0 || size > STUDIO_OUTPUT_BYTES) fail("Studio output exceeds the bounded 16 MiB storage limit.");
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_REGION && process.env.AWS_S3_BUCKET) {
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = new S3Client({ region: process.env.AWS_REGION });
    const body = createReadStream(path);
    try {
      await client.send(new PutObjectCommand({ Bucket: process.env.AWS_S3_BUCKET, Key: key, Body: body, ContentLength: size, ContentType: mimeType }), { abortSignal: signal });
    } finally { body.destroy(); client.destroy(); }
    return { key, url: process.env.AWS_S3_PUBLIC_URL ? `${process.env.AWS_S3_PUBLIC_URL.replace(/\/$/, "")}/${key}` : `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}` };
  }
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Studio storage is not configured." });
  const endpoint = new URL("v1/storage/upload", ENV.forgeApiUrl.replace(/\/?$/, "/"));
  endpoint.searchParams.set("path", key);
  const FormDataNode = (await import("form-data")).default;
  const form = new FormDataNode();
  const body = createReadStream(path);
  form.append("file", body, { filename: key.split("/").at(-1), contentType: mimeType, knownLength: size });
  const http = await import("node:http");
  return await new Promise<{ key: string; url: string }>((resolve, reject) => {
    const transport = endpoint.protocol === "https:" ? https : http;
    const req = transport.request(endpoint, { method: "POST", signal, headers: { ...form.getHeaders(), Authorization: `Bearer ${ENV.forgeApiKey}` } }, res => {
      let value = "";
      res.on("data", chunk => { value += chunk; if (Buffer.byteLength(value) > 32_000) req.destroy(new Error("Invalid storage response.")); });
      res.on("end", () => {
        try {
          if ((res.statusCode ?? 0) < 200 || (res.statusCode ?? 0) >= 300) throw new Error();
          const url = JSON.parse(value).url;
          assertStudioRegistrationUrl(url, key, url);
          resolve({ key, url });
        } catch { reject(new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Studio output storage failed." })); }
      });
      res.on("error", reject);
    });
    req.setTimeout(15_000, () => req.destroy(new Error("Studio output storage timed out.")));
    req.once("error", () => reject(new TRPCError({ code: "TIMEOUT", message: "Studio output storage failed or timed out." })));
    req.once("close", () => body.destroy());
    form.pipe(req);
  });
}
