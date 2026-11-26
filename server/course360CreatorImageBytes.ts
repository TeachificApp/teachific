import { inflateSync } from "node:zlib";
import { TRPCError } from "@trpc/server";

export const CREATOR_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const CREATOR_IMAGE_MAX_RESPONSE = 11_200_000;
export type CreatorVerifiedImage = { bytes: Buffer; mimeType: "image/png"; extension: "png"; width: number; height: number };
function invalid(message: string): never { throw new TRPCError({ code: "PRECONDITION_FAILED", message }); }
function crc32(bytes: Buffer) {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
/** Narrow verified PNG contract: static, 8-bit, non-interlaced; no URL fetch or format conversion. */
export function verifyCreatorImageBytes(bytes: Buffer, mimeType: string): CreatorVerifiedImage {
  if (mimeType !== "image/png") invalid("The bounded Creator adapter currently accepts verified PNG only; no substitute asset was saved.");
  if (!Buffer.isBuffer(bytes) || bytes.length < 57 || bytes.length > CREATOR_IMAGE_MAX_BYTES) invalid("Generated image byte count is invalid or exceeds 8 MiB.");
  if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) invalid("Generated PNG signature does not match its MIME type.");
  let offset = 8, width = 0, height = 0, channels = 0, color = -1, palette = false, ended = false, dataEnded = false;
  const data: Buffer[] = []; let chunks = 0;
  while (offset < bytes.length) {
    if (++chunks > 4096 || offset + 12 > bytes.length) invalid("Invalid PNG chunk bounds.");
    const length = bytes.readUInt32BE(offset), end = offset + 12 + length;
    if (end > bytes.length) invalid("Truncated PNG chunk.");
    const type = bytes.toString("ascii", offset + 4, offset + 8), payload = bytes.subarray(offset + 8, end - 4);
    if (!/^[A-Za-z]{4}$/.test(type) || crc32(bytes.subarray(offset + 4, end - 4)) !== bytes.readUInt32BE(end - 4)) invalid("Corrupt PNG chunk or checksum.");
    if (chunks === 1 && type !== "IHDR") invalid("PNG header must be first.");
    if (type === "IHDR") {
      if (chunks !== 1 || length !== 13) invalid("Invalid PNG header.");
      width = payload.readUInt32BE(0); height = payload.readUInt32BE(4); color = payload[9];
      channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[color] || 0;
      if (!width || !height || width > 4096 || height > 4096 || width * height > 8_000_000 || !channels) invalid("Generated image dimensions/color exceed bounded support.");
      if (payload[8] !== 8 || payload[10] !== 0 || payload[11] !== 0 || payload[12] !== 0) invalid("Only 8-bit non-interlaced PNG is supported by this bounded adapter.");
    } else if (type === "PLTE") {
      if (palette || data.length || !length || length > 768 || length % 3 || color === 0 || color === 4) invalid("Invalid PNG palette.");
      palette = true;
    } else if (type === "IDAT") {
      if (dataEnded || (color === 3 && !palette)) invalid("Invalid PNG data order."); data.push(payload);
    } else if (type === "IEND") {
      if (length || !data.length || end !== bytes.length) invalid("PNG is incomplete or contains trailing content."); ended = true;
    } else {
      if (data.length) dataEnded = true;
      if (["acTL", "fcTL", "fdAT"].includes(type) || type[0] === type[0].toUpperCase()) invalid("Animated or unknown critical PNG content is unsupported.");
    }
    offset = end;
  }
  if (!ended) invalid("PNG end/data is missing.");
  const expected = (width * channels + 1) * height;
  if (expected > 32_000_000) invalid("PNG decoded pixels exceed the bounded memory envelope.");
  let pixels: Buffer;
  // Node's runtime info:true result is not represented by the installed Buffer-only overload.
  try { const decoded = inflateSync(Buffer.concat(data), { maxOutputLength: expected, info: true }) as unknown as { buffer: Buffer; engine: { bytesWritten: number } }; pixels = decoded.buffer; if (decoded.engine.bytesWritten !== data.reduce((n, p) => n + p.length, 0)) invalid("PNG compressed data has trailing bytes."); }
  catch { invalid("PNG pixel stream is corrupt or oversized."); }
  if (pixels.length !== expected) invalid("PNG pixel dimensions do not match its data.");
  for (let y = 0; y < height; y++) if (pixels[y * (width * channels + 1)] > 4) invalid("PNG uses an invalid row filter.");
  return { bytes, mimeType: "image/png", extension: "png", width, height };
}
export function decodeCreatorImageBase64(value: unknown, mimeType: unknown) {
  // Flat character check avoids V8 regexp stack exhaustion on a valid bounded 8 MiB payload.
  if (typeof value !== "string" || typeof mimeType !== "string" || !value || value.length % 4 !== 0 || value.length > Math.ceil(CREATOR_IMAGE_MAX_BYTES / 3) * 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) invalid("Provider returned invalid or oversized inline base64 image bytes.");
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value) invalid("Provider image base64 is not canonical.");
  return verifyCreatorImageBytes(bytes, mimeType);
}
