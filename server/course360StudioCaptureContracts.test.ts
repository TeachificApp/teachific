import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StudioCaptureSession, selectStudioCodec, studioRecordingExtension } from "../client/src/lib/studioCaptureSession";
import { fillerWordIds, literalReplace, makeStudioTranscriptEnvelope, readStudioTranscript, segmentsFromStudioWords, serializeStudioSubtitles, transcriptWords, normalizeStudioMediaList } from "../client/src/lib/studioCaptionDocument";
import { captureFixture, FakeAudio, FakeRecorder, FakeTrack, FakeStream } from "./course360StudioCaptureFakes";
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
describe("actual Studio capture session", () => {
  it.each(["camera", "screen", "screen+camera"] as const)("records one composed video and one mixed audio in %s mode", async mode => {
    const fixture = captureFixture(); const result = vi.fn();
    const session = new StudioCaptureSession({ mode, width: 1920, height: 1080, frameRate: 60, onResult: result }, fixture.deps);
    await session.start(0);
    const recorder = FakeRecorder.instances[0];
    expect(recorder.stream.getVideoTracks()).toHaveLength(1); expect(recorder.stream.getAudioTracks()).toHaveLength(1);
    expect(recorder.stream.getVideoTracks()[0].label).toBe("composite");
    expect(fixture.context.drawImage).toHaveBeenCalled();
    if (mode === "screen+camera") expect(FakeAudio.instances[0].createMediaStreamSource).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1100); session.stop();
    expect(result).toHaveBeenCalledWith(expect.objectContaining({ id: "stable-recording-id", duration: 1.1, mimeType: "video/webm;codecs=vp8,opus" }));
    expect(FakeAudio.instances[0].close).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("composites PiP position in output coordinates and honors source quality rather than upscaling", async () => {
    const f = captureFixture(); let p = { x: 100, y: 60, size: 160, width: 640, height: 360 }; const warning = vi.fn();
    const session = new StudioCaptureSession({ mode: "screen+camera", width: 3840, height: 2160, frameRate: 60, pip: () => p, onResult: vi.fn(), onWarning: warning }, f.deps);
    await session.start(0); expect(f.canvas.width).toBe(1280); expect(f.canvas.height).toBe(720); expect(f.canvas.captureStream).toHaveBeenCalledWith(24);
    expect(f.context.arc).toHaveBeenLastCalledWith(360, 280, 160, 0, Math.PI * 2);
    p = { ...p, x: 250, y: 100 }; await vi.advanceTimersByTimeAsync(50);
    expect(f.context.arc).toHaveBeenLastCalledWith(660, 360, 160, 0, Math.PI * 2); expect(warning).toHaveBeenCalled(); session.stop();
  });
  it("camera-only uses the actual camera reference clone and leaves preview track intact", async () => {
    const f = captureFixture(); const preview = new FakeTrack("video", "preview", { width: 1920, height: 1080, frameRate: 30 });
    const session = new StudioCaptureSession({ mode: "camera", cameraStream: new FakeStream([preview]) as any, onResult: vi.fn() }, f.deps);
    await session.start(0); expect(f.devices.getUserMedia.mock.calls.every(([options]) => !options.video)).toBe(true);
    expect(f.videos[0].srcObject.getVideoTracks()[0].label).toBe("preview-clone"); session.stop(); expect(preview.stop).not.toHaveBeenCalled();
  });
  it("pause-excluding media clock and live mute apply to video and audio", async () => {
    const f = captureFixture(); const result = vi.fn(); const session = new StudioCaptureSession({ mode: "audio", onResult: result }, f.deps);
    await session.start(0); session.setMicEnabled(false); expect(f.mic.getAudioTracks()[0].enabled).toBe(false);
    await vi.advanceTimersByTimeAsync(2000); session.pause(); await vi.advanceTimersByTimeAsync(10000); session.resume(); session.setMicEnabled(true); await vi.advanceTimersByTimeAsync(3000); session.stop();
    expect(result.mock.calls[0][0].duration).toBe(5); expect(result.mock.calls[0][0].mimeType).toBe("audio/mp4"); expect(studioRecordingExtension("audio/mp4")).toBe("m4a");
  });
  it("countdown cancellation releases all resources and cannot start later", async () => {
    const f = captureFixture(); const session = new StudioCaptureSession({ mode: "screen+camera", onResult: vi.fn() }, f.deps);
    await session.start(); session.cancel(); await vi.advanceTimersByTimeAsync(5000);
    expect(FakeRecorder.instances[0].start).not.toHaveBeenCalled(); expect(f.screen.getTracks().every(t => t.stop.mock.calls.length)).toBe(true); expect(vi.getTimerCount()).toBe(0);
  });
  it("late permission resolution after cancellation is cleaned without resurrection", async () => {
    const f = captureFixture(); let resolve: any; f.devices.getDisplayMedia.mockImplementationOnce(() => new Promise(done => { resolve = done; }) as any);
    const session = new StudioCaptureSession({ mode: "screen", onResult: vi.fn() }, f.deps); const pending = session.start(); session.cancel(); resolve(f.screen); await pending;
    expect(f.screen.getTracks().every(t => t.stop.mock.calls.length)).toBe(true); expect(FakeRecorder.instances).toHaveLength(0);
  });
  it("constructor failure cleans acquired streams, timers, videos and audio", async () => {
    const f = captureFixture(); class ThrowRecorder { static isTypeSupported = () => true; constructor() { throw new Error("codec refused"); } }
    const error = vi.fn(); const session = new StudioCaptureSession({ mode: "screen+camera", onResult: vi.fn(), onError: error }, { ...f.deps, Recorder: ThrowRecorder });
    await session.start(); expect(error).toHaveBeenCalled(); expect(f.screen.getTracks().every(t => t.stop.mock.calls.length)).toBe(true); expect(FakeAudio.instances[0].close).toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });
  it("screen track ended finalizes active media and cleans listeners", async () => {
    const f = captureFixture(); const result = vi.fn(); const session = new StudioCaptureSession({ mode: "screen", onResult: result }, f.deps);
    await session.start(0); f.screen.getVideoTracks()[0].end(); expect(result).toHaveBeenCalledTimes(1); expect(f.screen.getVideoTracks()[0].listeners.get("ended")?.size).toBe(0);
  });
  it("unsupported codec probe falls back to the browser-selected container", () => {
    expect(selectStudioCodec({ isTypeSupported: () => false } as any, false)).toBeUndefined();
  });
});
describe("actual caption document module", () => {
  it("literal find and replacement preserve regex punctuation and dollar replacement text", () => {
    expect(literalReplace("a[ A[", "a[", "$&", true)).toBe("$& $&"); expect(literalReplace("x.y xzy", "x.y", "$1", false)).toBe("$1 xzy");
  });
  it("multiword fillers only match contiguous nondeleted nearby words", () => {
    const words = ["you", "know,", "I", "mean", "thing"].map((word, id) => ({ id, word, start: id, end: id + .9 }));
    expect([...fillerWordIds(words, ["you know", "i mean"])]).toEqual([0, 1, 2, 3]); words[1].start = 5; expect([...fillerWordIds(words, ["you know"])]).toEqual([]);
  });
  it("segments and subtitles exclude cut words and rebase edited clock with millisecond carry", () => {
    const words = [{ id: 0, word: "before", start: 59.9996, end: 61 }, { id: 1, word: "cut", start: 61, end: 62, deleted: true }, { id: 2, word: "<after>", start: 62, end: 63 }];
    const segments = segmentsFromStudioWords(words, true); expect(segments[1].start).toBe(61);
    const srt = serializeStudioSubtitles(segments, "srt"); expect(srt).toContain("00:01:00,000 --> 00:01:01,000"); expect(srt).not.toContain("cut"); expect(srt).toContain("&lt;after&gt;");
    expect(serializeStudioSubtitles(segments, "vtt")).toMatch(/^WEBVTT\n/);
  });
  it("empty words fall back to segments immediately", () => { expect(transcriptWords({ words: [], segments: [{ start: 0, end: 2, text: "two words" }] })).toHaveLength(2); });
  it("envelope preserves provider fields, originals and old root readers", () => {
    const original = { language: "fr", words: [{ id: 0, word: "original", start: 0, end: 1 }], segments: [], historical: { untouched: true } };
    const style = { fontFamily: "Georgia", fontSize: 22, textColor: "#ffffff", bgColor: "#000000", bgOpacity: .5, bold: true, italic: false, shadow: false, emojiEnabled: false };
    const document = readStudioTranscript(makeStudioTranscriptEnvelope(original, [{ ...original.words[0], word: "edited" }], [], { version: 1, sourceMediaItemId: 7, revision: 1, captionStyle: style, showCaptions: true }, 3));
    expect(document.historical).toEqual(original.historical); expect(document.originalTranscript.words[0].word).toBe("original"); expect(document.language).toBe("fr"); expect(document.words[0].word).toBe("edited"); expect(document.studioEdit.captionStyle.fontFamily).toBe("Georgia");
  });
  it("normalizes current and historical list envelopes without truncating", () => {
    const rows = Array.from({ length: 251 }, (_, id) => ({ id })); expect(normalizeStudioMediaList(rows)).toBe(rows); expect(normalizeStudioMediaList({ items: rows })).toBe(rows);
  });
});
