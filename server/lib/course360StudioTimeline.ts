import { TRPCError } from "@trpc/server";
import { z } from "zod";

export const studioWordSchema = z.object({ id: z.number().int(), word: z.string().max(2000), start: z.number().finite().nonnegative(), end: z.number().finite().nonnegative(), deleted: z.boolean().optional() });
export const studioSegmentSchema = z.object({ id: z.number().int(), start: z.number().finite().nonnegative(), end: z.number().finite().nonnegative(), text: z.string().max(12000) });
export const studioStyleSchema = z.object({
  preset: z.enum(["classic", "neon", "karaoke", "tiktok", "fire", "minimal", "purple", "white"]).optional(),
  fontFamily: z.string().regex(/^[\p{L}\p{N} _-]{1,80}$/u).optional(),
  textColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(), bgColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  bgOpacity: z.number().min(0).max(1).optional(), fontSize: z.number().min(14).max(40).optional(),
  bold: z.boolean().optional(), italic: z.boolean().optional(), shadow: z.boolean().optional(),
  emojiEnabled: z.boolean().optional(), visible: z.boolean().optional(),
});
export type StudioWord = z.infer<typeof studioWordSchema>;
export type StudioSegment = z.infer<typeof studioSegmentSchema>;
export type StudioStyle = z.infer<typeof studioStyleSchema>;
export type StudioRange = { startSec: number; endSec: number };
export type StudioTranscript = Record<string, any> & { words: StudioWord[]; segments: StudioSegment[] };
const bad = (message: string): never => { throw new TRPCError({ code: "BAD_REQUEST", message }); };

export function validateStudioRange(startSec: number, endSec: number, duration: number): StudioRange {
  if (![startSec, endSec, duration].every(Number.isFinite) || duration <= 0 || startSec < 0 || endSec <= startSec || endSec > duration) bad("Clip boundaries must satisfy 0 ≤ start < end ≤ the probed source duration.");
  return { startSec, endSec };
}

export function parseStudioTranscript(value: string | null | undefined): StudioTranscript {
  if (!value) return { words: [], segments: [] };
  if (Buffer.byteLength(value) > 60_000) bad("This transcript exceeds the current database-safe Studio limit; a long-transcript migration is required.");
  let parsed: any;
  try { parsed = JSON.parse(value); } catch { return bad("The saved transcript is not valid JSON; the original is unchanged."); }
  // Earlier media stored a segment array rather than the current object envelope.
  const envelope = Array.isArray(parsed) ? { segments: parsed, legacyTranscript: parsed } : parsed;
  if (!envelope || typeof envelope !== "object") return bad("The saved transcript format is unsupported.");
  const segments = z.array(studioSegmentSchema.passthrough()).max(2000).parse(envelope.segments ?? []);
  const words = z.array(studioWordSchema.passthrough()).max(4000).parse(envelope.words ?? []);
  return { ...envelope, segments, words: words.length ? words : segmentWords(segments) };
}

export function segmentWords(segments: StudioSegment[]): StudioWord[] {
  let id = 0;
  return segments.flatMap(segment => {
    const tokens = segment.text.trim().split(/\s+/u).filter(Boolean);
    if (!tokens.length || segment.end <= segment.start) return [];
    return tokens.map((word, i) => ({ id: id++, word, start: segment.start + (segment.end - segment.start) * i / tokens.length, end: segment.start + (segment.end - segment.start) * (i + 1) / tokens.length }));
  });
}

export function validateStudioTranscript(transcript: StudioTranscript, duration: number) {
  if (!Number.isFinite(duration) || duration <= 0) bad("A finite source duration is required.");
  for (const entries of [transcript.words, transcript.segments]) {
    let previous = -1;
    const ids = new Set<number>();
    for (const entry of entries) {
      if (!Number.isFinite(entry.start) || !Number.isFinite(entry.end) || entry.start < 0 || entry.end <= entry.start || entry.end > duration + 0.05 || entry.start < previous || ids.has(entry.id)) bad("Transcript timestamps or IDs are invalid for this source.");
      ids.add(entry.id); previous = entry.start;
    }
  }
}

export function studioRetainedRanges(transcript: StudioTranscript, startSec: number, endSec: number, duration: number): StudioRange[] {
  validateStudioRange(startSec, endSec, duration);
  validateStudioTranscript(transcript, duration);
  const cuts = transcript.words.filter(w => w.deleted && w.end > startSec && w.start < endSec)
    .map(w => ({ startSec: Math.max(startSec, w.start), endSec: Math.min(endSec, w.end) })).sort((a, b) => a.startSec - b.startSec);
  const merged: StudioRange[] = [];
  for (const cut of cuts) {
    const prior = merged.at(-1);
    if (prior && cut.startSec <= prior.endSec) prior.endSec = Math.max(prior.endSec, cut.endSec);
    else merged.push({ ...cut });
  }
  const retained: StudioRange[] = [];
  let cursor = startSec;
  for (const cut of merged) { if (cut.startSec > cursor) retained.push({ startSec: cursor, endSec: cut.startSec }); cursor = cut.endSec; }
  if (cursor < endSec) retained.push({ startSec: cursor, endSec });
  if (!retained.length) bad("All footage in the requested range was deleted.");
  if (retained.length > 64) bad("This edit exceeds the bounded 64-cut renderer; split the export into shorter ranges.");
  return retained;
}

export function remapStudioTranscript(transcript: StudioTranscript, ranges: StudioRange[]): StudioTranscript {
  let offset = 0;
  const words: StudioWord[] = [];
  for (const range of ranges) {
    for (const w of transcript.words) {
      const start = Math.max(w.start, range.startSec), end = Math.min(w.end, range.endSec);
      if (!w.deleted && end > start) words.push({ ...w, id: words.length, start: offset + start - range.startSec, end: offset + end - range.startSec, deleted: false });
    }
    offset += range.endSec - range.startSec;
  }
  // Word-derived cues prevent deleted/replaced text from leaking into exported captions.
  const segments: StudioSegment[] = [];
  for (const word of words) {
    const cue = segments.at(-1);
    if (cue && word.start - cue.end < 0.5 && word.end - cue.start <= 4 && cue.text.length + word.word.length < 100) { cue.end = word.end; cue.text += ` ${word.word}`; }
    else segments.push({ id: segments.length, start: word.start, end: word.end, text: word.word });
  }
  return { ...transcript, words, segments, duration: offset, studio: { ...transcript.studio, sourceRanges: ranges } };
}

export function studioTimestamp(sec: number, separator = ".") {
  const ms = Math.max(0, Math.round(sec * 1000));
  return `${String(Math.floor(ms / 3600000)).padStart(2, "0")}:${String(Math.floor(ms / 60000) % 60).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}${separator}${String(ms % 1000).padStart(3, "0")}`;
}
const cueText = (text: string) => text.replace(/\r/g, "").replace(/\n+/g, " ").replace(/-->/g, "→").replace(/[<>]/g, "").trim();
export function serializeStudioCaptions(transcript: StudioTranscript, format: "srt" | "vtt") {
  return (format === "vtt" ? "WEBVTT\n\n" : "") + transcript.segments.filter(s => s.text.trim()).map((s, i) => `${i + 1}\n${studioTimestamp(s.start, format === "srt" ? "," : ".")} --> ${studioTimestamp(s.end, format === "srt" ? "," : ".")}\n${cueText(s.text)}\n`).join("\n");
}

/** Retained VTT-only callers are normalized into the same validated timed document. */
export function parseStudioVtt(input: string): StudioSegment[] {
  if (Buffer.byteLength(input) > 60_000 || !input.trimStart().startsWith("WEBVTT")) bad("Valid bounded WEBVTT captions are required.");
  const cues: StudioSegment[] = [];
  const timestamp = (text: string) => {
    const parts = text.replace(",", ".").split(":").map(Number);
    if (parts.length < 2 || parts.length > 3 || parts.some(n => !Number.isFinite(n) || n < 0) || parts.at(-1)! >= 60 || parts.at(-2)! >= 60) bad("Invalid VTT timestamp.");
    return parts.reduce((total, n) => total * 60 + n, 0);
  };
  for (const block of input.replace(/\r/g, "").split(/\n\s*\n/)) {
    const lines = block.split("\n"); const i = lines.findIndex(line => line.includes("-->"));
    if (i < 0) continue;
    const match = lines[i].match(/^\s*(\d{1,3}:\d{2}(?::\d{2})?\.\d{3})\s+-->\s+(\d{1,3}:\d{2}(?::\d{2})?\.\d{3})(?:\s.*)?$/);
    if (!match) bad("Invalid VTT cue timing.");
    const text = lines.slice(i + 1).join(" ").replace(/<[^>]*>/g, "").trim();
    if (text) cues.push({ id: cues.length, start: timestamp(match![1]), end: timestamp(match![2]), text });
  }
  if (!cues.length) bad("No timed VTT captions were supplied.");
  return cues;
}

export function mergeStudioTranscript(original: StudioTranscript, changes: Partial<StudioTranscript>, duration: number, expectedRevision?: number): StudioTranscript {
  const revision = Number(original.studio?.revision ?? 0);
  if (expectedRevision !== undefined && expectedRevision !== revision) throw new TRPCError({ code: "CONFLICT", message: "This transcript changed; reload before saving edits." });
  const { style, ...fields } = changes;
  if (original.originalTranscript) fields.originalTranscript = original.originalTranscript;
  const transcript = { ...original, ...fields, words: changes.words ?? original.words, segments: changes.segments ?? original.segments,
    studio: { ...original.studio, version: 1, revision: revision + 1, sourceDuration: duration,
      originalTranscript: original.studio?.originalTranscript ?? { ...original, studio: undefined },
      style: { ...original.studio?.style, ...studioStyleSchema.parse(style ?? {}) } }, duration } as StudioTranscript;
  validateStudioTranscript(transcript, duration);
  if (Buffer.byteLength(JSON.stringify(transcript)) > 60_000) bad("This edit exceeds the current database-safe transcript limit; the original was not changed.");
  return transcript;
}

const presets: Record<string, StudioStyle> = {
  classic: { textColor: "#ffffff", bgColor: "#000000", bgOpacity: .75, bold: true, shadow: false, fontSize: 22 },
  neon: { textColor: "#00ffcc", bgColor: "#000000", bgOpacity: .8, bold: true, shadow: true, fontSize: 22 },
  karaoke: { textColor: "#ffee00", bgColor: "#1a0050", bgOpacity: .85, bold: true, shadow: true, fontSize: 24 },
  tiktok: { textColor: "#ffffff", bgColor: "#fe2c55", bgOpacity: .9, bold: true, shadow: false, fontSize: 24 },
  fire: { textColor: "#ff6b00", bgColor: "#1a0000", bgOpacity: .85, bold: true, italic: true, shadow: true, fontSize: 24 },
  minimal: { textColor: "#ffffff", bgColor: "#000000", bgOpacity: 0, bold: false, shadow: true, fontSize: 18 },
  purple: { textColor: "#ffffff", bgColor: "#6d28d9", bgOpacity: .85, bold: true, shadow: false, fontSize: 22 },
  white: { textColor: "#000000", bgColor: "#ffffff", bgOpacity: .9, bold: true, shadow: false, fontSize: 22 },
};
export function serializeStudioAss(transcript: StudioTranscript, width: number, height: number) {
  const custom = studioStyleSchema.parse({ ...transcript.studio?.style, ...transcript.studioEdit?.captionStyle,
    ...(transcript.studioEdit?.presetId ? { preset: transcript.studioEdit.presetId } : {}),
    ...(typeof transcript.studioEdit?.showCaptions === "boolean" ? { visible: transcript.studioEdit.showCaptions } : {}) });
  const style = { ...presets.classic, ...(presets[custom.preset ?? "classic"] ?? {}), ...custom };
  const color = (hex: string, alpha = 0) => `&H${Math.round(alpha).toString(16).padStart(2, "0")}${hex.slice(5, 7)}${hex.slice(3, 5)}${hex.slice(1, 3)}`.toUpperCase();
  const assTime = (sec: number) => studioTimestamp(sec).replace(/0*(\d+):/, "$1:").slice(0, -1);
  const text = (value: string) => cueText(value).replace(/[{}\\]/g, "");
  const header = `[Script Info]\nScriptType: v4.00+\nPlayResX: ${width}\nPlayResY: ${height}\nWrapStyle: 0\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,${style.fontFamily ?? "DejaVu Sans"},${Math.round(style.fontSize! * height / 720)},${color(style.textColor!)},${color("#ffffff")},${color(style.bgColor!, 255 * (1 - style.bgOpacity!))},${color(style.bgColor!, 255 * (1 - style.bgOpacity!))},${style.bold ? -1 : 0},${style.italic ? -1 : 0},3,2,${style.shadow ? 1 : 0},2,20,20,20,1\n[Events]\nFormat: Layer, Start, End, Style, Text\n`;
  if (style.visible === false) return header;
  return header + transcript.segments.map(s => {
    let caption = text(s.text);
    if (style.preset === "karaoke") {
      let cursor = s.start;
      caption = transcript.words.filter(w => w.start >= s.start && w.start < s.end).map(w => {
        const gap = Math.max(0, Math.round((w.start - cursor) * 100)); cursor = w.end;
        return `${gap ? `{\\k${gap}}` : ""}{\\kf${Math.max(1, Math.round((w.end - w.start) * 100))}}${text(w.word)} `;
      }).join("").trim();
    }
    return `Dialogue: 0,${assTime(s.start)},${assTime(s.end)},Default,${caption}\n`;
  }).join("");
}
