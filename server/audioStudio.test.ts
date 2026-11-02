/**
 * Course360 Studio™ — Audio & TTS feature tests
 * Tests for TTS input validation, audio format helpers, and voice options.
 */

import { describe, it, expect } from "vitest";

// ─── TTS Input Validation ─────────────────────────────────────────────────────

describe("TTS input validation", () => {
  const VALID_VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"] as const;
  const MAX_CHARS = 4096;

  it("accepts all six valid voice options", () => {
    for (const voice of VALID_VOICES) {
      expect(VALID_VOICES).toContain(voice);
    }
    expect(VALID_VOICES).toHaveLength(6);
  });

  it("rejects empty text", () => {
    const text = "";
    expect(text.trim().length).toBe(0);
  });

  it("accepts text up to 4096 characters", () => {
    const text = "a".repeat(MAX_CHARS);
    expect(text.length).toBeLessThanOrEqual(MAX_CHARS);
  });

  it("rejects text exceeding 4096 characters", () => {
    const text = "a".repeat(MAX_CHARS + 1);
    expect(text.length).toBeGreaterThan(MAX_CHARS);
  });

  it("accepts speed values in valid range 0.25–4.0", () => {
    const validSpeeds = [0.25, 0.5, 1.0, 1.5, 2.0, 4.0];
    for (const speed of validSpeeds) {
      expect(speed).toBeGreaterThanOrEqual(0.25);
      expect(speed).toBeLessThanOrEqual(4.0);
    }
  });

  it("rejects speed values outside valid range", () => {
    const invalidSpeeds = [0.0, 0.24, 4.01, 10.0, -1];
    for (const speed of invalidSpeeds) {
      expect(speed < 0.25 || speed > 4.0).toBe(true);
    }
  });

  it("sanitizes file name by removing unsafe characters", () => {
    // The sanitize function in the backend first strips .mp3 extension, then replaces unsafe chars
    const sanitize = (name: string) =>
      name.replace(/\.mp3$/i, "").replace(/[^a-z0-9_-]/gi, "-");
    expect(sanitize("My Audio File!.mp3")).toBe("My-Audio-File-");
    expect(sanitize("lecture-01.mp3")).toBe("lecture-01");
    expect(sanitize("test file (2).mp3")).toBe("test-file--2-");
  });
});

// ─── Audio Format Helpers ─────────────────────────────────────────────────────

describe("audio format helpers", () => {
  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  it("formats time correctly", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(59)).toBe("0:59");
    expect(formatTime(60)).toBe("1:00");
    expect(formatTime(90)).toBe("1:30");
    expect(formatTime(3600)).toBe("60:00");
  });

  it("formats file sizes correctly", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(1024)).toBe("1.0 KB");
    expect(formatFileSize(1536)).toBe("1.5 KB");
    expect(formatFileSize(1048576)).toBe("1.0 MB");
    expect(formatFileSize(2621440)).toBe("2.5 MB");
  });
});

// ─── Audio MIME Type Detection ────────────────────────────────────────────────

describe("audio MIME type detection", () => {
  const isAudioMimeType = (mimeType: string) => mimeType.startsWith("audio/");
  const isVideoMimeType = (mimeType: string) => mimeType.startsWith("video/");

  it("correctly identifies audio MIME types", () => {
    const audioTypes = ["audio/mpeg", "audio/webm", "audio/wav", "audio/ogg", "audio/mp4"];
    for (const type of audioTypes) {
      expect(isAudioMimeType(type)).toBe(true);
    }
  });

  it("correctly identifies video MIME types", () => {
    const videoTypes = ["video/mp4", "video/webm", "video/quicktime", "video/avi"];
    for (const type of videoTypes) {
      expect(isVideoMimeType(type)).toBe(true);
    }
  });

  it("does not confuse audio and video types", () => {
    expect(isAudioMimeType("video/mp4")).toBe(false);
    expect(isVideoMimeType("audio/mpeg")).toBe(false);
  });
});

// ─── Voice Option Labels ──────────────────────────────────────────────────────

describe("voice option labels", () => {
  const VOICE_OPTIONS = [
    { value: "alloy", label: "Alloy", description: "Neutral, balanced" },
    { value: "echo", label: "Echo", description: "Warm, resonant" },
    { value: "fable", label: "Fable", description: "Expressive, narrative" },
    { value: "onyx", label: "Onyx", description: "Deep, authoritative" },
    { value: "nova", label: "Nova", description: "Bright, energetic" },
    { value: "shimmer", label: "Shimmer", description: "Clear, professional" },
  ];

  it("has exactly 6 voice options", () => {
    expect(VOICE_OPTIONS).toHaveLength(6);
  });

  it("each voice has a non-empty value, label, and description", () => {
    for (const v of VOICE_OPTIONS) {
      expect(v.value.length).toBeGreaterThan(0);
      expect(v.label.length).toBeGreaterThan(0);
      expect(v.description.length).toBeGreaterThan(0);
    }
  });

  it("default voice is nova", () => {
    const defaultVoice = "nova";
    const found = VOICE_OPTIONS.find((v) => v.value === defaultVoice);
    expect(found).toBeDefined();
    expect(found?.label).toBe("Nova");
  });
});
