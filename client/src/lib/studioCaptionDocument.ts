export interface StudioTranscriptWord { id: number; word: string; start: number; end: number; deleted?: boolean; [key: string]: unknown }
export interface StudioTranscriptSegment { id: number; start: number; end: number; text: string; [key: string]: unknown }
export interface StudioCaptionStyle {
  textColor: string; bgColor: string; bgOpacity: number; bold: boolean; italic: boolean;
  shadow: boolean; fontSize: number; emojiEnabled: boolean; fontFamily: string;
}
export interface StudioEditEnvelope {
  version: 1; sourceMediaItemId: number; revision: number;
  captionStyle: StudioCaptionStyle; showCaptions: boolean; presetId?: string;
}
export function readStudioTranscript(json?: string | null): Record<string, any> {
  if (!json) return {};
  try { const parsed = JSON.parse(json); return Array.isArray(parsed) ? { segments: parsed } : parsed && typeof parsed === "object" ? parsed : {}; } catch { return {}; }
}
export function transcriptWords(document: Record<string, any>): StudioTranscriptWord[] {
  if (Array.isArray(document.words) && document.words.length) return document.words.map((w: any, i: number) => ({ ...w, id: Number.isFinite(w.id) ? w.id : i }));
  const words: StudioTranscriptWord[] = [];
  for (const segment of document.segments ?? []) {
    if (!Number.isFinite(segment.start) || !Number.isFinite(segment.end) || segment.end <= segment.start) continue;
    const tokens = String(segment.text ?? "").split(/\s+/).filter(Boolean);
    tokens.forEach((word, i) => words.push({ id: words.length, word, start: segment.start + i * (segment.end - segment.start) / tokens.length, end: segment.start + (i + 1) * (segment.end - segment.start) / tokens.length }));
  }
  return words;
}
export function literalReplace(text: string, find: string, replacement: string, all: boolean): string {
  if (!find) return text;
  // Escape the search pattern and use a callback so $&, $1 etc remain literal replacement text.
  return text.replace(new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), all ? "gi" : "i"), () => replacement);
}
export function fillerWordIds(words: StudioTranscriptWord[], fillers: string[]): Set<number> {
  const ids = new Set<number>(); const normalize = (value: string) => value.toLowerCase().replace(/^[\s.,!?;:]+|[\s.,!?;:]+$/g, "");
  for (let i = 0; i < words.length; i++) {
    if (words[i].deleted) continue;
    for (const filler of fillers) {
      const tokens = filler.split(/\s+/);
      const span = words.slice(i, i + tokens.length);
      if (span.length === tokens.length && span.every((w, j) => !w.deleted && normalize(w.word) === tokens[j] && (j === 0 || w.start - span[j - 1].end <= 0.6))) span.forEach(w => ids.add(w.id));
    }
  }
  return ids;
}
export function deletedStudioRegions(words: StudioTranscriptWord[]): Array<{ start: number; end: number }> {
  const regions: Array<{ start: number; end: number }> = [];
  const sorted = words.filter(w => w.deleted && Number.isFinite(w.start) && Number.isFinite(w.end) && w.end > w.start).sort((a, b) => a.start - b.start);
  for (const word of sorted) {
    const last = regions[regions.length - 1];
    if (last && word.start <= last.end) last.end = Math.max(last.end, word.end);
    else regions.push({ start: Math.max(0, word.start), end: word.end });
  }
  return regions;
}
/** Split at deleted spans and silent gaps so subtitle cues never bleed across cuts. */
export function segmentsFromStudioWords(words: StudioTranscriptWord[], editedTimeline = false): StudioTranscriptSegment[] {
  const cuts = deletedStudioRegions(words); const output: StudioTranscriptSegment[] = [];
  let group: StudioTranscriptWord[] = [];
  const mapped = (time: number) => editedTimeline ? time - cuts.reduce((sum, cut) => sum + Math.max(0, Math.min(time, cut.end) - cut.start), 0) : time;
  const flush = () => {
    if (group.length) output.push({ id: output.length, start: mapped(group[0].start), end: mapped(group[group.length - 1].end), text: group.map(w => w.word).join(" ") });
    group = [];
  };
  for (const word of [...words].sort((a, b) => a.start - b.start)) {
    if (word.deleted || !Number.isFinite(word.start) || !Number.isFinite(word.end) || word.start < 0 || word.end <= word.start) { flush(); continue; }
    const previous = group[group.length - 1];
    if (previous && (group.length >= 8 || word.start - previous.end > 0.6 || cuts.some(cut => cut.start >= previous.end && cut.end <= word.start))) flush();
    group.push(word);
  }
  flush(); return output;
}
export function subtitleTimestamp(seconds: number, separator: "." | ","): string {
  const milliseconds = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(milliseconds / 3600000);
  const minutes = Math.floor(milliseconds % 3600000 / 60000);
  const secs = Math.floor(milliseconds % 60000 / 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}${separator}${String(milliseconds % 1000).padStart(3, "0")}`;
}
export function serializeStudioSubtitles(segments: StudioTranscriptSegment[], format: "srt" | "vtt"): string {
  const cues = segments.filter(s => Number.isFinite(s.start) && Number.isFinite(s.end) && s.start >= 0 && s.end > s.start && s.text.trim()).sort((a, b) => a.start - b.start);
  const lines = format === "vtt" ? ["WEBVTT", ""] : [];
  cues.forEach((cue, i) => {
    if (format === "srt") lines.push(String(i + 1));
    lines.push(`${subtitleTimestamp(cue.start, format === "srt" ? "," : ".")} --> ${subtitleTimestamp(cue.end, format === "srt" ? "," : ".")}`);
    lines.push(cue.text.replace(/[\r\n\u0000]+/g, " ").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"), "");
  });
  return lines.join("\n") + "\n";
}
/** Keep all historical provider and original transcript fields; old readers still see root words/segments. */
export function makeStudioTranscriptEnvelope(original: Record<string, any>, words: StudioTranscriptWord[], segments: StudioTranscriptSegment[], edit: StudioEditEnvelope, duration: number): string {
  return JSON.stringify({ ...original, words, segments, language: original.language ?? "en", duration,
    originalTranscript: original.originalTranscript ?? { words: original.words ?? [], segments: original.segments ?? [], language: original.language, duration: original.duration },
    studioEdit: { ...original.studioEdit, ...edit },
  });
}
export function downloadStudioBlob(content: string, filename: string, mimeType: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function normalizeStudioMediaList<T>(data: T[] | { items?: T[] } | null | undefined): T[] {
  return Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
}
export function validStudioClip(start: number, end: number, duration: number): boolean {
  return Number.isFinite(start) && Number.isFinite(end) && Number.isFinite(duration) && start >= 0 && end > start && end <= duration;
}
