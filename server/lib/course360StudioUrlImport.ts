import { TRPCError } from "@trpc/server";
import { Resolver } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { STUDIO_INPUT_BYTES, resolveStudioStorage, assertStudioRegistrationUrl, storeStudioFile } from "./course360StudioStorage";
import { probeStudioFile, withStudioProcessing, type StudioProbe } from "./course360StudioRender";
import { validatePublicSourceUrl } from "./publicSourceUrl";

export type StudioImportSourceAuthority = (url: string) => Promise<void>;
export const STUDIO_URL_IMPORT_PAGE_BYTES = 750_000;
export const STUDIO_URL_IMPORT_DEADLINE_MS = 60_000;
const fail = (message: string, code: "BAD_REQUEST" | "PAYLOAD_TOO_LARGE" | "PRECONDITION_FAILED" | "FORBIDDEN" = "BAD_REQUEST"): never => { throw new TRPCError({ code, message }); };

/** Conservative unicast-only policy; mapped, compatible, NAT64, 6to4 and Teredo alternatives are not accepted. */
export function isStudioImportPublicIp(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b, c] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && (b === 0 || b === 168 || (b === 88 && c === 99)))
      || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113));
  }
  if (isIP(address) !== 6 || address.includes(".") || address.includes("%")) return false;
  const [left, right] = address.toLowerCase().split("::");
  const first = left ? left.split(":") : [];
  const last = right ? right.split(":") : [];
  const parts = right === undefined ? first : [...first, ...Array(8 - first.length - last.length).fill("0"), ...last];
  const words = parts.map(v => parseInt(v, 16));
  return words.length === 8 && words[0] >= 0x2000 && words[0] <= 0x3fff
    && words[0] !== 0x2002 && !(words[0] === 0x2001 && (words[1] < 0x0200 || words[1] === 0x0db8));
}

export function validateStudioImportUrl(input: string, orgId?: number): URL {
  if (input.length > 4096 || /[\x00-\x20\x7f\\]/.test(input)) fail("Use a valid public http(s) media URL without credentials or control characters.");
  let url: URL;
  try { url = validatePublicSourceUrl(input); } catch { return fail("Use a public http(s) media URL on a standard port without embedded credentials."); }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!host || (!isIP(host) && !host.includes(".")) || /(?:^|\.)(?:localhost|local|internal|intranet|lan|home|localdomain|corp|onion|test|invalid)$/.test(host) || host.endsWith(".home.arpa")
    || ["metadata.google.internal", "metadata.google", "instance-data.ec2.internal"].includes(host)
    || (isIP(host) && !isStudioImportPublicIp(host))) fail("Only public internet media sources are supported; local, private and metadata addresses are forbidden.");
  if (url.hash) fail("Use a media source URL without a fragment.");
  // Known school-owned source paths are not permission to copy a foreign library object.
  if (orgId !== undefined) {
    let path = url.pathname;
    for (let i = 0; i < 3; i++) { try { const decoded = decodeURIComponent(path); if (decoded === path) break; path = decoded; } catch { fail("Invalid source URL encoding."); } }
    const matches = [...path.matchAll(/(?:^|\/)(?:org-(\d+)\/|(?:lms-media|org-media)\/(\d+)\/)/g)];
    if (matches.some(m => Number(m[1] ?? m[2]) !== orgId)) fail("The source media belongs to another school.", "FORBIDDEN");
  }
  return url;
}

/** Resolver.cancel aborts pending queries; no Promise.race leaves DNS work running after timeout. */
export async function resolveStudioImportAddress(url: URL, signal: AbortSignal) {
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const literalFamily = isIP(hostname);
  if (literalFamily) {
    if (!isStudioImportPublicIp(hostname)) fail("The media source is not a public internet address.");
    return { address: hostname, family: literalFamily };
  }
  const resolver = new Resolver({ timeout: 2500, tries: 1 });
  const abort = () => resolver.cancel();
  signal.throwIfAborted(); signal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 5000);
  try {
    const results = await Promise.allSettled([resolver.resolve4(hostname), resolver.resolve6(hostname)]);
    signal.throwIfAborted();
    const addresses: { address: string; family: number }[] = [];
    for (const [i, result] of results.entries()) {
      if (result.status === "fulfilled") addresses.push(...result.value.map(address => ({ address, family: i === 0 ? 4 : 6 })));
      else if (!["ENODATA", "ENOTFOUND"].includes(result.reason?.code)) fail("The media source DNS lookup failed or timed out.");
    }
    if (!addresses.length || addresses.some(r => !isStudioImportPublicIp(r.address))) fail("The media source must resolve only to public internet addresses.");
    return addresses[0];
  } finally { clearTimeout(timer); signal.removeEventListener("abort", abort); resolver.cancel(); }
}

/** Each redirect is revalidated and re-resolved. The connection uses the selected vetted address, not another DNS lookup. */
export async function requestStudioImportUrl(input: string, orgId: number, signal: AbortSignal, method: "GET" | "HEAD" = "GET", authorizeSource?: StudioImportSourceAuthority): Promise<{ response: http.IncomingMessage; url: URL }> {
  let current = input;
  for (let redirect = 0; redirect <= 4; redirect++) {
    const url = validateStudioImportUrl(current, orgId);
    if (authorizeSource) await authorizeSource(url.toString());
    const address = await resolveStudioImportAddress(url, signal);
    signal.throwIfAborted();
    const transport = url.protocol === "https:" ? https : http;
    const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
      const request = transport.request({ protocol: url.protocol, hostname: url.hostname.replace(/^\[|\]$/g, ""), port: url.protocol === "https:" ? 443 : 80,
        path: url.pathname + url.search, method, signal, agent: false,
        headers: { Accept: "video/*,audio/*,application/octet-stream,text/html;q=0.5", "Accept-Encoding": "identity", "User-Agent": "Course360-Media-Import/1.0" },
        lookup: (_host, _options, callback) => callback(null, address.address, address.family),
      }, resolve);
      request.setTimeout(10_000, () => request.destroy(new Error("Media source request timed out.")));
      request.once("error", () => reject(new TRPCError({ code: "TIMEOUT", message: "Media source retrieval failed or timed out." })));
      request.end();
    });
    const status = response.statusCode ?? 0;
    if ([301, 302, 303, 307, 308].includes(status)) {
      const location = response.headers.location; response.destroy();
      if (!location || redirect === 4) fail("The media source has too many redirects or an invalid redirect.");
      try { current = new URL(location, url).toString(); } catch { return fail("The media source returned an invalid redirect."); }
      validateStudioImportUrl(current, orgId);
      continue;
    }
    if (status !== 200) { response.destroy(); fail("The source is unavailable, private, or not a complete downloadable media response."); }
    if (response.headers["content-encoding"] && response.headers["content-encoding"] !== "identity") { response.destroy(); fail("Compressed source responses are not supported by this bounded importer."); }
    return { response, url };
  }
  return fail("The media source has too many redirects.");
}

export async function writeStudioImportResponse(response: http.IncomingMessage, path: string, limit: number, signal: AbortSignal) {
  const length = response.headers["content-length"];
  if (length !== undefined && (!/^\d+$/.test(String(length)) || !Number.isSafeInteger(Number(length)))) { response.destroy(); fail("The source returned an invalid byte length."); }
  const declared = length === undefined ? undefined : Number(length);
  if (declared !== undefined && declared > limit) { response.destroy(); fail("This source exceeds the bounded 8 MiB media / 750 KB page import limit. Use a shorter or compressed source.", "PAYLOAD_TOO_LARGE"); }
  let size = 0;
  const cap = new Transform({ transform(chunk: Buffer, _encoding, callback) {
    size += chunk.length;
    callback(size > limit ? new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "The source stream exceeds the bounded import byte limit." }) : null, chunk);
  } });
  await pipeline(response, cap, createWriteStream(path, { flags: "wx", mode: 0o600 }), { signal });
  if (!size || (declared !== undefined && size !== declared)) fail("The source is empty or its byte length is inconsistent.");
  return size;
}

function decodeAttribute(text: string) {
  return text.replace(/&(?:amp|quot|apos|lt|gt);|&#(?:x[0-9a-f]+|\d+);/gi, value => {
    const known: Record<string, string> = { "&amp;": "&", "&quot;": '"', "&apos;": "'", "&lt;": "<", "&gt;": ">" };
    if (known[value.toLowerCase()]) return known[value.toLowerCase()];
    const n = value.toLowerCase().startsWith("&#x") ? parseInt(value.slice(3, -1), 16) : Number(value.slice(2, -1));
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
  });
}

/** Retains public HTML video/social extraction without invoking the unsafe legacy downloader/ytdl request machinery. */
export function extractStudioImportPageMedia(html: string, pageUrl: URL) {
  for (const tag of html.match(/<(?:meta|video|source)\b[^>]{0,8192}>/gi) ?? []) {
    const attributes = new Map<string, string>();
    for (const match of tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)) attributes.set(match[1].toLowerCase(), decodeAttribute(match[2]));
    const property = (attributes.get("property") ?? attributes.get("name") ?? "").toLowerCase();
    const candidate = /^<meta/i.test(tag) ? /^(?:og:video(?::(?:secure_)?url)?|twitter:player:stream)$/.test(property) ? attributes.get("content") : undefined : attributes.get("src");
    if (candidate) {
      try { return new URL(candidate, pageUrl).toString(); } catch { fail("The page/provider returned an invalid media URL."); }
    }
  }
  return fail("No public downloadable media was found. This platform may require a provider, authentication or unsupported streaming. Use a direct public media URL; no platform download was claimed.", "PRECONDITION_FAILED");
}

export async function inspectStudioImportFile(path: string, declaredMime: string, signal: AbortSignal) {
  const size = (await stat(path)).size;
  if (size < 1 || size > STUDIO_INPUT_BYTES) fail("The import exceeds the bounded 8 MiB input limit.", "PAYLOAD_TOO_LARGE");
  const { open } = await import("node:fs/promises");
  const header = await open(path, "r");
  const bytes = Buffer.alloc(Math.min(size, 4096));
  try { await header.read(bytes, 0, bytes.length, 0); } finally { await header.close(); }
  const probe = await probeStudioFile(path, signal);
  let mimeType: string, extension: string;
  const hasVideo = !!probe.videoCodec;
  if (bytes.subarray(4, 8).toString() === "ftyp" && probe.format.includes("mov")) {
    const quicktime = bytes.subarray(8, 12).toString() === "qt  ";
    mimeType = hasVideo ? quicktime ? "video/quicktime" : "video/mp4" : "audio/mp4"; extension = hasVideo ? quicktime ? "mov" : "mp4" : "m4a";
  } else if (bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) && probe.format.includes("matroska")) {
    const webm = bytes.subarray(0, 4096).includes(Buffer.from("webm"));
    mimeType = hasVideo ? webm ? "video/webm" : "video/x-matroska" : webm ? "audio/webm" : "audio/x-matroska"; extension = webm ? "webm" : "mkv";
  } else if (!hasVideo && probe.format === "mp3" && (bytes.subarray(0, 3).toString() === "ID3" || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0))) { mimeType = "audio/mpeg"; extension = "mp3";
  } else if (!hasVideo && probe.format === "wav" && bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WAVE") { mimeType = "audio/wav"; extension = "wav";
  } else if (probe.format === "ogg" && bytes.subarray(0, 4).toString() === "OggS") { mimeType = hasVideo ? "video/ogg" : "audio/ogg"; extension = hasVideo ? "ogv" : "ogg";
  } else if (!hasVideo && probe.format === "flac" && bytes.subarray(0, 4).toString() === "fLaC") { mimeType = "audio/flac"; extension = "flac";
  } else return fail("The downloaded bytes are not a supported media container; no library item was saved.");
  if ((!hasVideo && !probe.hasAudio) || !Number.isFinite(probe.duration) || probe.duration <= 0 || probe.duration > 2_147_483_647) fail("The source has no supported finite media stream/duration.");
  if (hasVideo && (!Number.isSafeInteger(probe.width) || !Number.isSafeInteger(probe.height) || probe.width <= 0 || probe.height <= 0 || probe.width > 1920 || probe.height > 1080 || !Number.isFinite(probe.fps) || probe.fps > 60)) fail("This bounded importer supports video through 1920×1080 / 60 fps. Larger/4K sources require a verified larger runtime.", "PRECONDITION_FAILED");
  const aliases: Record<string, string> = { "audio/x-wav": "audio/wav", "audio/mp3": "audio/mpeg", "video/matroska": "video/x-matroska", "audio/x-flac": "audio/flac" };
  const actualDeclared = aliases[declaredMime] ?? declaredMime;
  if (actualDeclared && actualDeclared !== "application/octet-stream" && actualDeclared !== mimeType) fail("The source MIME type does not match the probed media container.");
  return { size, mimeType, extension, probe };
}

export function assertStudioImportQuota(usage: { usedBytes: number; maxBytes: number }, size: number) {
  if (!Number.isSafeInteger(usage.usedBytes) || usage.usedBytes < 0 || !Number.isSafeInteger(usage.maxBytes) || usage.maxBytes < -1 || !Number.isSafeInteger(size) || size < 1) fail("Authoritative school storage usage is unavailable.", "PRECONDITION_FAILED");
  if (usage.maxBytes !== -1 && usage.usedBytes + size > usage.maxBytes) fail("The school's Media Library storage quota would be exceeded.", "PAYLOAD_TOO_LARGE");
}

/** Use the existing abortable real-byte uploader, then prove its key/URL identity by authoritative key lookup. */
export async function storeStudioImportFile(key: string, path: string, mimeType: string, signal: AbortSignal) {
  const stored = await storeStudioFile(key, path, mimeType, signal);
  if (stored.key !== key) fail("Storage returned an inconsistent import key.", "PRECONDITION_FAILED");
  const resolved = await resolveStudioStorage(key, signal);
  assertStudioRegistrationUrl(stored.url, key, resolved.url);
  const orgId = Number(/^org-(\d+)\//.exec(key)?.[1]);
  if (!Number.isSafeInteger(orgId) || orgId < 1 || resolved.key !== key || !resolved.url.startsWith("https://")) fail("Storage returned an inconsistent import object reference.", "PRECONDITION_FAILED");
  const head = await requestStudioImportUrl(resolved.url, orgId, signal, "HEAD");
  const length = String(head.response.headers["content-length"] ?? "");
  const contentType = String(head.response.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
  head.response.destroy();
  if (!/^\d+$/.test(length) || Number(length) !== (await stat(path)).size || contentType !== mimeType) fail("Storage returned inconsistent import byte/MIME metadata.", "PRECONDITION_FAILED");
  let url = stored.url;
  if (!url.startsWith("/manus-storage/")) {
    const canonical = new URL(url);
    if (decodeURIComponent(canonical.pathname).endsWith(`/${key}`)) canonical.search = "";
    url = canonical.toString();
  }
  return { key, url };
}

export async function withStudioUrlImport<T>(input: string, orgId: number, work: (media: { path: string; filename: string; size: number; mimeType: string; extension: string; probe: StudioProbe }, signal: AbortSignal) => Promise<T>, authorizeSource?: StudioImportSourceAuthority): Promise<T> {
  const source = validateStudioImportUrl(input, orgId);
  if (/(?:^|\.)(?:youtube\.com|youtu\.be|youtube-nocookie\.com)$/.test(source.hostname)) fail("YouTube downloads are not available through this bounded public importer. Use an authorized direct public media URL; private/provider-only downloads are unsupported.", "PRECONDITION_FAILED");
  return withStudioProcessing(async overallSignal => {
    const signal = AbortSignal.any([overallSignal, AbortSignal.timeout(STUDIO_URL_IMPORT_DEADLINE_MS)]);
    const directory = await mkdtemp(join(tmpdir(), "course360-studio-url-import-"));
    try {
      const first = await requestStudioImportUrl(input, orgId, signal, "GET", authorizeSource);
      let mediaResponse = first.response;
      let mime = String(mediaResponse.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
      const path = join(directory, "source.media");
      let mediaUrl = first.url;
      if (["text/html", "application/xhtml+xml"].includes(mime)) {
        const pagePath = join(directory, "source.html");
        await writeStudioImportResponse(mediaResponse, pagePath, STUDIO_URL_IMPORT_PAGE_BYTES, signal);
        const candidate = extractStudioImportPageMedia(await readFile(pagePath, "utf8"), first.url);
        // Output is untrusted: URL, DNS, redirects and response bytes receive the same independent validation.
        const extracted = await requestStudioImportUrl(candidate, orgId, signal, "GET", authorizeSource);
        mediaResponse = extracted.response; mediaUrl = extracted.url;
        mime = String(mediaResponse.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
      }
      if (mime && !/^(?:video\/|audio\/|application\/octet-stream$)/.test(mime)) { mediaResponse.destroy(); fail("The page/provider did not return downloadable supported media.", "PRECONDITION_FAILED"); }
      await writeStudioImportResponse(mediaResponse, path, STUDIO_INPUT_BYTES, signal);
      const inspected = await inspectStudioImportFile(path, mime, signal);
      let title = "Imported Media";
      try { title = decodeURIComponent(mediaUrl.pathname.split("/").filter(Boolean).at(-1) ?? "Imported Media").replace(/\.[^.]+$/, ""); } catch { /* retain safe title */ }
      const filename = (title.replace(/[\x00-\x1f\x7f/\\]/g, "_").trim().slice(0, 480) || "Imported Media") + "." + inspected.extension;
      signal.throwIfAborted();
      return await work({ path, filename, ...inspected }, signal);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
}
