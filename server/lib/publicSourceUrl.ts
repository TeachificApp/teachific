import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";

const MAX_SOURCE_BYTES = 750_000;
const REQUEST_TIMEOUT_MS = 8_000;

function isPrivateIpv4(address: string) {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return true;
  const [a, b] = octets;
  return a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 0)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19));
}

export function isPublicIpAddress(address: string) {
  const family = isIP(address);
  if (family === 4) return !isPrivateIpv4(address);
  if (family !== 6) return false;

  const normalized = address.toLowerCase();
  if (normalized.startsWith("::ffff:")) return !isPrivateIpv4(normalized.slice(7));
  return normalized !== "::" && normalized !== "::1"
    && !normalized.startsWith("fc")
    && !normalized.startsWith("fd")
    && !normalized.startsWith("fe8")
    && !normalized.startsWith("fe9")
    && !normalized.startsWith("fea")
    && !normalized.startsWith("feb")
    && !normalized.startsWith("ff");
}

export function validatePublicSourceUrl(input: string) {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error("Enter a valid public http(s) URL.");
  }
  if (!/^https?:$/.test(url.protocol) || url.username || url.password || !url.hostname) {
    throw new Error("Use a public http(s) URL without embedded credentials.");
  }
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new Error("Local network URLs cannot be used as an AI source.");
  }
  if (isIP(hostname) && !isPublicIpAddress(hostname)) {
    throw new Error("Private or reserved network URLs cannot be used as an AI source.");
  }
  if (url.port && !((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80"))) {
    throw new Error("The source URL must use the standard public HTTP or HTTPS port.");
  }
  return url;
}

async function resolvePublicAddress(url: URL) {
  const records = await lookup(url.hostname, { all: true, verbatim: true });
  const publicRecord = records.find((record) => isPublicIpAddress(record.address));
  if (!publicRecord || records.some((record) => !isPublicIpAddress(record.address))) {
    throw new Error("The source URL must resolve only to public internet addresses.");
  }
  return publicRecord;
}

function cleanSourceText(value: string) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SOURCE_REFERENCE_PATTERN = /\b(?:source\s+(?:page|url|document|file|material|text)|(?:the|this)\s+(?:source|website|web\s*page|document|transcript|pdf|file|passage|reading)|according\s+to\s+(?:the|this)|as\s+(?:stated|described)\s+(?:in|on))\b/i;

/** Rejects source provenance in outputs grounded by a private author-supplied URL. */
export function assertSourceBlindGeneratedContent(value: string, sourceUrl: string) {
  const hostname = validatePublicSourceUrl(sourceUrl).hostname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (/https?:\/\//i.test(value) || new RegExp(`\\b${hostname}\\b`, "i").test(value) || SOURCE_REFERENCE_PATTERN.test(value)) {
    throw new Error("Generated questions must not identify or refer to the private source page.");
  }
}

async function requestSource(url: URL, address: string, family: number) {
  const client = url.protocol === "https:" ? https : http;
  return await new Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: Buffer }>((resolve, reject) => {
    const request = client.get({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      headers: { Accept: "text/html,text/plain,application/json,application/xml,text/xml;q=0.9,*/*;q=0.1", "User-Agent": "Course360-Quiz-Source/1.0" },
      lookup: (_hostname, _options, callback) => callback(null, address, family),
    }, (response) => {
      const chunks: Buffer[] = [];
      let bytes = 0;
      response.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > MAX_SOURCE_BYTES) {
          request.destroy(new Error("The source page is too large to use for question generation."));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => resolve({ statusCode: response.statusCode ?? 0, headers: response.headers, body: Buffer.concat(chunks) }));
    });
    request.setTimeout(REQUEST_TIMEOUT_MS, () => request.destroy(new Error("The source URL did not respond in time.")));
    request.once("error", reject);
  });
}

export async function fetchPublicSourceText(input: string) {
  const url = validatePublicSourceUrl(input);
  const address = await resolvePublicAddress(url);
  const response = await requestSource(url, address.address, address.family);
  if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
    throw new Error("The source URL must not redirect.");
  }
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error("The source URL could not be read.");
  }
  const contentType = String(response.headers["content-type"] ?? "").toLowerCase();
  if (contentType && !/(text\/|application\/(json|xml))/.test(contentType)) {
    throw new Error("The source URL must return readable text, HTML, JSON, or XML content.");
  }
  const text = cleanSourceText(response.body.toString("utf8"));
  if (text.length < 40) throw new Error("The source URL did not contain enough readable text.");
  return text.slice(0, 60_000);
}
