import { inflateRawSync } from "node:zlib";
import { posix } from "node:path";
import { parseStringPromise } from "xml2js";
export const PPTX_MAX_INPUT = 16 * 1024 * 1024;
const MAX_TOTAL = 48 * 1024 * 1024, MAX_PART = 12 * 1024 * 1024, MAX_ENTRIES = 1200;
export function escapePptxXml(value: string) { return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;"); }
function crc32(data: Buffer) { let crc = -1; for (const byte of data) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); } return (crc ^ -1) >>> 0; }
function safePart(name: string) { return name.length > 0 && name.length <= 240 && /^[a-z\d_./\[\] -]+$/i.test(name) && !name.startsWith("/") && !name.split("/").some(s => s === ".." || s === ".") && !name.includes("//"); }
/** Parse central/local headers before allocating decompressed bytes. ZIP64/encryption/multidisk rejected. */
export function readCreatorPptxZip(input: Buffer): Map<string, Buffer> {
  if (!input.length || input.length > PPTX_MAX_INPUT) throw new Error("Choose a nonempty PPTX no larger than 16 MiB.");
  let end = -1;
  for (let i = input.length - 22; i >= Math.max(0, input.length - 65557); i--) if (input.readUInt32LE(i) === 0x06054b50 && i + 22 + input.readUInt16LE(i + 20) === input.length) { end = i; break; }
  if (end < 0 || input.readUInt16LE(end + 4) || input.readUInt16LE(end + 6)) throw new Error("Invalid or multidisk PPTX ZIP.");
  const count = input.readUInt16LE(end + 10), offset = input.readUInt32LE(end + 16), size = input.readUInt32LE(end + 12);
  if (!count || count > MAX_ENTRIES || count !== input.readUInt16LE(end + 8) || offset + size !== end) throw new Error("Unsupported ZIP directory/ZIP64 or too many parts.");
  const entries: { name: string; method: number; compressed: number; uncompressed: number; crc: number; local: number }[] = []; let cursor = offset, total = 0; const seen = new Set<string>();
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > end || input.readUInt32LE(cursor) !== 0x02014b50) throw new Error("Invalid ZIP directory.");
    const flags = input.readUInt16LE(cursor + 8), method = input.readUInt16LE(cursor + 10), compressed = input.readUInt32LE(cursor + 20), uncompressed = input.readUInt32LE(cursor + 24), n = input.readUInt16LE(cursor + 28), x = input.readUInt16LE(cursor + 30), c = input.readUInt16LE(cursor + 32), local = input.readUInt32LE(cursor + 42);
    if (cursor + 46 + n + x + c > end || flags & 1 || flags & 0x40 || ![0, 8].includes(method) || uncompressed > MAX_PART || compressed === 0xffffffff || local === 0xffffffff || input.readUInt16LE(cursor + 34)) throw new Error("Encrypted, oversize or unsupported ZIP part.");
    const name = input.subarray(cursor + 46, cursor + 46 + n).toString("utf8");
    if (!safePart(name) || seen.has(name.toLowerCase()) || /(?:vba|activex|embeddings|oleobject|\.exe|\.js|\.html)/i.test(name)) throw new Error("Unsafe, duplicate, macro or embedded executable PPTX part.");
    seen.add(name.toLowerCase()); total += uncompressed;
    if (total > MAX_TOTAL || (uncompressed > 1024 * 1024 && uncompressed > Math.max(1, compressed) * 200)) throw new Error("PPTX ZIP expansion exceeds safe limits.");
    entries.push({ name, method, compressed, uncompressed, crc: input.readUInt32LE(cursor + 16), local }); cursor += 46 + n + x + c;
  }
  if (cursor !== end) throw new Error("Invalid ZIP directory length.");
  const parts = new Map<string, Buffer>(); const regions: [number, number][] = [];
  for (const e of entries) {
    if (e.local + 30 > offset || input.readUInt32LE(e.local) !== 0x04034b50 || input.readUInt16LE(e.local + 8) !== e.method || input.readUInt16LE(e.local + 6) & 1) throw new Error("Invalid local ZIP part.");
    const n = input.readUInt16LE(e.local + 26), x = input.readUInt16LE(e.local + 28), start = e.local + 30 + n + x, finish = start + e.compressed;
    if (finish > offset || input.subarray(e.local + 30, e.local + 30 + n).toString("utf8") !== e.name || regions.some(([a, b]) => e.local < b && finish > a)) throw new Error("Overlapping or mismatched ZIP part.");
    regions.push([e.local, finish]);
    const data = e.method === 0 ? Buffer.from(input.subarray(start, finish)) : inflateRawSync(input.subarray(start, finish), { maxOutputLength: Math.max(1, e.uncompressed) });
    if (data.length !== e.uncompressed || crc32(data) !== e.crc) throw new Error("Corrupt ZIP size or checksum.");
    if (!e.name.endsWith("/")) parts.set(e.name, data);
  }
  return parts;
}
export async function parseCreatorPptxXml(data: Buffer | string) {
  const text = Buffer.isBuffer(data) ? data.toString("utf8") : data;
  if (text.length > 6 * 1024 * 1024 || /<!DOCTYPE|<!ENTITY|<\?(?!xml(?:\s|\?))/i.test(text)) throw new Error("PPTX XML declarations/entities are unsafe.");
  let tags = 0, depth = 0;
  for (const tag of text.matchAll(/<\/?[^>]+>/g)) { if (++tags > 100000) throw new Error("PPTX XML is too complex."); if (/^<\//.test(tag[0])) depth--; else if (!/^<[!?]/.test(tag[0]) && !/\/>$/.test(tag[0])) depth++; if (depth > 100) throw new Error("PPTX XML nesting exceeds limits."); }
  return parseStringPromise(text, { strict: true, explicitArray: true, explicitChildren: true, preserveChildrenOrder: true });
}
export function resolvePptxRelationship(source: string, target: string) {
  if (!target || /[\\%?#\u0000-\u0020]/.test(target) || /^[a-z]+:/i.test(target) || target.startsWith("//")) throw new Error("Unsafe external or escaped PPTX relationship.");
  const resolved = posix.normalize(target.startsWith("/") ? target.slice(1) : posix.join(posix.dirname(source), target));
  if (!safePart(resolved)) throw new Error("Relationship traverses outside the PPTX package."); return resolved;
}
export async function validateCreatorPptxParts(parts: Map<string, Buffer>) {
  for (const name of ["[Content_Types].xml", "_rels/.rels", "ppt/presentation.xml", "ppt/_rels/presentation.xml.rels"]) if (!parts.has(name)) throw new Error("Not a valid PresentationML PPTX package.");
  const xml = new Map<string, any>();
  for (const [name, bytes] of parts) if (/\.(xml|rels)$/.test(name)) {
    const parsed = await parseCreatorPptxXml(bytes); xml.set(name, parsed);
    if (name === "[Content_Types].xml" && /macroenabled|vba|activex|oleobject/i.test(bytes.toString("utf8"))) throw new Error("Macro/executable presentation rejected.");
    if (name.endsWith(".rels")) {
      const source = name === "_rels/.rels" ? "" : name.replace(/(^|\/)\_rels\//, "$1").replace(/\.rels$/, "");
      const ids = new Set();
      for (const rel of parsed.Relationships?.Relationship || []) { const attrs = rel.$; if (!attrs?.Id || ids.has(attrs.Id)) throw new Error("Invalid relationship IDs."); ids.add(attrs.Id); if (attrs.TargetMode === "External") throw new Error("External relationships are not imported; re-export with embedded media."); const target = resolvePptxRelationship(source, attrs.Target); if (!parts.has(target)) throw new Error("PPTX relationship target is missing."); }
    }
  }
  const types = xml.get("[Content_Types].xml")?.Types;
  if (!types?.Override?.some((o: any) => o.$.PartName === "/ppt/presentation.xml" && o.$.ContentType === "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml")) throw new Error("Unsupported presentation content type.");
  return xml;
}
