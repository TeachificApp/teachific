import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm, readFile, mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { renderStudioLocal, runStudioProcess, withStudioProcessing } from "./course360StudioRender";
import { segmentWords, parseStudioTranscript, mergeStudioTranscript, serializeStudioAss, serializeStudioCaptions, studioTimestamp, studioRetainedRanges, remapStudioTranscript, validateStudioRange } from "./course360StudioTimeline";
import { assertStudioRegistrationUrl, isStudioKeyForOrg } from "./course360StudioStorage";
import { normalizeStudioProviderTranscript, validateStudioHighlights, generateStudioSemanticHighlights } from "./course360StudioIntelligence";
const llm = vi.hoisted(() => vi.fn());
vi.mock("./course360StudioAi", () => ({ invokeStudioBoundedLlm: llm }));
const transcript = { words: [
  { id: 0, word: "Hello", start: 0, end: 1 }, { id: 1, word: "removed", start: 1, end: 2, deleted: true },
  { id: 2, word: "also", start: 1.5, end: 2.5, deleted: true }, { id: 3, word: "κόσμε", start: 2.5, end: 3.5 },
  { id: 4, word: "finish", start: 3.5, end: 4 },
], segments: [{ id: 0, start: 0, end: 4, text: "Hello removed also κόσμε finish" }], language: "el", unknownLegacy: { retained: true }, studioEdit: { version: 1, sourceMediaItemId: 44, revision: 1, presetId: "karaoke", captionStyle: { fontFamily: "DejaVu Sans" }, showCaptions: true } };

describe("Studio actual timeline and provider contracts", () => {
  it("merges overlapping deleted-word cuts and rebases retained captions", () => {
    const ranges = studioRetainedRanges(transcript, 0, 4, 4);
    expect(ranges).toEqual([{ startSec: 0, endSec: 1 }, { startSec: 2.5, endSec: 4 }]);
    const edited = remapStudioTranscript(transcript, ranges);
    expect(edited.duration).toBe(2.5);
    expect(edited.words.map(w => w.word)).toEqual(["Hello", "κόσμε", "finish"]);
    expect(edited.words[1].start).toBe(1);
    expect(serializeStudioCaptions(edited, "srt")).not.toContain("removed");
  });
  it.each([[-1, 2, 4], [2, 1, 4], [0, 5, 4], [0, 1, Infinity], [0, NaN, 4]])("rejects invalid ranges %j", (start, end, duration) => {
    expect(() => validateStudioRange(start, end, duration)).toThrow();
  });
  it("carries timestamp rounding across minutes and strips cue/control syntax", () => {
    expect(studioTimestamp(59.9996)).toBe("00:01:00.000");
    expect(serializeStudioCaptions({ words: [], segments: [{ id: 0, start: 0, end: 1, text: "<script> -->\ntext" }] }, "srt")).toContain("script → text");
  });
  it("retains unknown original fields/language/source while incrementing additive revisions", () => {
    const original = parseStudioTranscript(JSON.stringify(transcript));
    const updated = mergeStudioTranscript(original, { words: original.words, style: { fontSize: 28 } }, 4, 0);
    expect(updated.unknownLegacy).toEqual({ retained: true }); expect(updated.language).toBe("el");
    expect(updated.studio.originalTranscript.unknownLegacy).toEqual({ retained: true });
    expect(updated.studio.revision).toBe(1);
    expect(() => mergeStudioTranscript(updated, {}, 4, 0)).toThrow(/reload/);
  });
  it("derives words immediately from segment-only provider response and retains raw metadata", () => {
    const result = normalizeStudioProviderTranscript({ duration: 4, language: "el", text: "Hello κόσμε", segments: [{ id: 0, start: 0, end: 4, text: "Hello κόσμε", seek: 7 }], providerExtra: 9 }, 4);
    expect(result.words).toHaveLength(2); expect(result.words[1]).toMatchObject({ start: 2, end: 4 });
    expect(result.providerExtra).toBe(9); expect(result.segments[0]).toMatchObject({ seek: 7 });
    expect(result.studio.timingSource).toBe("segment-interpolation");
  });
  it("serializes actual timed Unicode karaoke while blocking ASS overrides", () => {
    const edited = remapStudioTranscript(transcript, studioRetainedRanges(transcript, 0, 4, 4));
    const ass = serializeStudioAss(edited, 640, 360);
    expect(ass).toContain("κόσμε"); expect(ass).toContain("\\kf100"); expect(ass).toContain("DejaVu Sans");
    expect(serializeStudioAss({ ...edited, segments: [{ id: 0, start: 0, end: 1, text: "{\\pos(1,1)}hack" }], studioEdit: { captionStyle: {} } }, 640, 360)).not.toContain("\\pos");
  });
  it("preserves historical prefixes but rejects traversal and mismatched URLs", () => {
    expect(isStudioKeyForOrg("old-folder/7/file.webm", 7)).toBe(true);
    expect(isStudioKeyForOrg("org-8/media/file.webm", 7)).toBe(false);
    expect(() => isStudioKeyForOrg("org-7/../8/file.webm", 7)).toThrow();
    expect(() => assertStudioRegistrationUrl("https://evil.test/video", "org-7/file", "https://cdn.test/org-7/file?sig=abc")).toThrow();
    expect(() => assertStudioRegistrationUrl("https://cdn.test/org-7/other", "org-7/file", "https://cdn.test/org-7/file")).toThrow();
    expect(() => assertStudioRegistrationUrl("/manus-storage/org-7/file", "org-7/file", "https://cdn.test/object")).not.toThrow();
  });
  it("calls existing configured AI helper and validates exactly ten semantic ranges", async () => {
    const segments = Array.from({ length: 10 }, (_, i) => ({ id: i, start: i * 4, end: i * 4 + 3, text: `Meaningful topic ${i} offers ten useful clear explanatory spoken words here` }));
    const timed = { segments, words: segmentWords(segments) };
    const clips = segments.map(s => ({ startSec: s.start, endSec: s.end, label: `Actual topic ${s.id}` }));
    llm.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ clips }) }, finish_reason: "stop" }] });
    expect(await generateStudioSemanticHighlights(timed, 40)).toEqual({ clips });
    expect(llm.mock.calls[0][0].response_format.json_schema.strict).toBe(true);
    expect(llm.mock.calls[0][0].messages[1].content).toContain("Meaningful");
    expect(() => validateStudioHighlights({ clips: [...clips.slice(1), clips[1]] }, timed, 40)).toThrow();
    expect(() => validateStudioHighlights({ clips: clips.slice(1) }, timed, 40)).toThrow();
    await expect(generateStudioSemanticHighlights({ words: [], segments: [] }, 40)).rejects.toThrow(/insufficient/);
    llm.mockResolvedValue({ choices: [{ message: { content: '{"clips":[]}' }, finish_reason: "stop" }] });
    await expect(generateStudioSemanticHighlights(timed, 40)).rejects.toThrow(/ten valid/);
  });
  it("enforces concurrency one and releases the slot on errors", async () => {
    let release!: () => void;
    const first = withStudioProcessing(async () => new Promise<void>(resolve => { release = resolve; }));
    await expect(withStudioProcessing(async () => 1)).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    release(); await first;
    await expect(withStudioProcessing(async () => { throw new Error("failed"); })).rejects.toThrow("failed");
    expect(await withStudioProcessing(async () => 1)).toBe(1);
  });
});

describe("Studio real synthetic local FFmpeg bytes (no network)", () => {
  let directory: string, source: string;
  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), "studio-offline-test-")); source = join(directory, "source.mp4");
    await runStudioProcess("ffmpeg", ["-nostdin", "-v", "error", "-threads", "1", "-filter_threads", "1", "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=30:duration=4", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=16000:duration=4", "-c:v", "libx264", "-preset", "ultrafast", "-threads", "1", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", source], AbortSignal.timeout(15_000));
  }, 20_000);
  afterAll(async () => { if (directory) await rm(directory, { recursive: true, force: true }); });
  it("creates a new H.264/AAC MP4 with deleted footage removed and captions burned", async () => {
    const before = await readFile(source); const outputDir = join(directory, "edited"); await mkdir(outputDir);
    const result = await renderStudioLocal(source, outputDir, transcript, { burnCaptions: true }, AbortSignal.timeout(20_000));
    expect(result.probe).toMatchObject({ videoCodec: "h264", audioCodec: "aac", width: 320, height: 180 });
    expect(result.probe.duration).toBeCloseTo(2.5, 1);
    expect(result.output).not.toBe(source); expect((await stat(result.output)).size).toBeGreaterThan(1000);
    expect(await readFile(source)).toEqual(before);
    expect(result.transcript.words.map(w => w.word)).toEqual(["Hello", "κόσμε", "finish"]);
  }, 25_000);
  it("renders a bounded explicit clip rather than returning the full source", async () => {
    const outputDir = join(directory, "clip"); await mkdir(outputDir);
    const result = await renderStudioLocal(source, outputDir, { words: [], segments: [] }, { startSec: 1, endSec: 2 }, AbortSignal.timeout(20_000));
    expect(result.probe.duration).toBeCloseTo(1, 1); expect(result.probe.videoCodec).toBe("h264");
  }, 25_000);
  it("handles silent video without inventing audio and burns trial watermark bytes", async () => {
    const silent = join(directory, "silent.mp4");
    await runStudioProcess("ffmpeg", ["-nostdin", "-v", "error", "-threads", "1", "-i", source, "-an", "-c:v", "copy", silent], AbortSignal.timeout(15_000));
    const outputDir = join(directory, "silent-out"); await mkdir(outputDir);
    const result = await renderStudioLocal(silent, outputDir, { words: [], segments: [] }, { startSec: 0, endSec: 1, watermark: true }, AbortSignal.timeout(20_000));
    expect(result.probe.hasAudio).toBe(false); expect(result.probe.duration).toBeCloseTo(1, 1);
    expect(await readFile(join(outputDir, "watermark.ass"), "utf8")).toContain("Course360 Studio");
  }, 25_000);
});
