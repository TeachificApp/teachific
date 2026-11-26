import { TRPCError } from "@trpc/server";
import { ENV } from "./_core/env";
import { CREATOR_IMAGE_MAX_RESPONSE, decodeCreatorImageBase64 } from "./course360CreatorImageBytes";

export const CREATOR_IMAGE_DEADLINE_MS = 60_000;
function endpoint() {
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The existing configured Forge image provider is unavailable. No alternative provider/model is selected." });
  const base = new URL(ENV.forgeApiUrl.endsWith("/") ? ENV.forgeApiUrl : `${ENV.forgeApiUrl}/`);
  if (base.protocol !== "https:" || base.username || base.password || base.hash || base.search || base.port && base.port !== "443") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The configured image provider requires a credential-free HTTPS base URL without query/fragment/nonstandard port." });
  return new URL("images.v1.ImageService/GenerateImage", base).toString();
}
export function creatorImageProviderStatus() {
  try { endpoint(); return { available: true as const, configured: true as const, reason: "Configured Forge ImageService; legacy service default selection (model/quality omitted). Verified static 8-bit non-interlaced PNG inline responses only; live availability is not tested." }; }
  catch (e) { return { available: false as const, configured: false as const, reason: e instanceof Error ? e.message : "Image provider configuration unavailable." }; }
}
function plain(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
/** Mirrors actual legacy request/defaults exactly; never calls its unscoped auto-upload. */
export async function generateCreatorConfiguredImageBytes(prompt: string, callerSignal: AbortSignal) {
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 4000 || Buffer.byteLength(prompt) > 16000) throw new TRPCError({ code: "BAD_REQUEST", message: "Enter a nonempty image prompt up to 4,000 characters." });
  const url = endpoint(), signal = AbortSignal.any([callerSignal, AbortSignal.timeout(CREATOR_IMAGE_DEADLINE_MS)]);
  signal.throwIfAborted();
  let response: Response;
  try { response = await fetch(url, { method: "POST", redirect: "error", signal, headers: { accept: "application/json", "content-type": "application/json", "connect-protocol-version": "1", authorization: `Bearer ${ENV.forgeApiKey}` }, body: JSON.stringify({ prompt, original_images: [] }) }); }
  catch { throw new TRPCError({ code: "TIMEOUT", message: "Configured image request failed or was cancelled; no fallback or fake image was saved." }); }
  if (!response.ok || response.redirected || response.url && response.url !== url) { await response.body?.cancel().catch(() => {}); throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Configured image provider failed or redirected. No substitute asset was saved." }); }
  const type = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  const declared = response.headers.get("content-length");
  const encoding = response.headers.get("content-encoding");
  if (type !== "application/json" || encoding && encoding !== "identity" || declared !== null && (!/^\d+$/.test(declared) || Number(declared) < 1 || Number(declared) > CREATOR_IMAGE_MAX_RESPONSE) || !response.body) {
    await response.body?.cancel().catch(() => {}); throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Image provider returned unsupported MIME, encoding or response bounds." });
  }
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  const cancelled = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", cancelled, { once: true });
  try {
    while (true) { signal.throwIfAborted(); const part = await reader.read(); signal.throwIfAborted(); if (part.done) break; size += part.value.byteLength; if (size > CREATOR_IMAGE_MAX_RESPONSE) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Image provider response exceeded the bounded byte allowance." }); chunks.push(part.value); }
    if (!size || declared !== null && Number(declared) !== size) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Image provider response byte count does not match its receipt." });
    let result: unknown;
    try { result = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks))); }
    catch { throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Image provider returned invalid JSON/UTF-8." }); }
    if (!plain(result) || Object.keys(result).some(k => k !== "image") || !plain(result.image) || Object.keys(result.image).some(k => !["b64Json", "mimeType"].includes(k))) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Unsupported image provider response contract. Inline {image:{b64Json,mimeType}} is required; URLs are never fetching authority." });
    signal.throwIfAborted(); return decodeCreatorImageBase64(result.image.b64Json, result.image.mimeType);
  } finally { signal.removeEventListener("abort", cancelled); await reader.cancel().catch(() => {}); }
}
