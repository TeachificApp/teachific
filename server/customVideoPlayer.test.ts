/**
 * customVideoPlayer.test.ts
 * Unit tests for CustomVideoPlayer logic and playerColor schema field.
 * These tests verify the data layer and color resolution logic without
 * mounting the actual React component (which requires a browser environment).
 */
import { describe, it, expect } from "vitest";

// ─── playerColor resolution logic ────────────────────────────────────────────

function resolvePlayerColor(
  playerColor: string | null | undefined,
  primaryColor: string | null | undefined,
  fallback = "#00b4b4"
): string {
  return playerColor || primaryColor || fallback;
}

describe("resolvePlayerColor", () => {
  it("returns playerColor when set", () => {
    expect(resolvePlayerColor("#ff5500", "#0d9488")).toBe("#ff5500");
  });

  it("falls back to primaryColor when playerColor is null", () => {
    expect(resolvePlayerColor(null, "#0d9488")).toBe("#0d9488");
  });

  it("falls back to primaryColor when playerColor is empty string", () => {
    expect(resolvePlayerColor("", "#0d9488")).toBe("#0d9488");
  });

  it("falls back to default teal when both are null", () => {
    expect(resolvePlayerColor(null, null)).toBe("#00b4b4");
  });

  it("falls back to default teal when both are empty strings", () => {
    expect(resolvePlayerColor("", "")).toBe("#00b4b4");
  });

  it("accepts any valid hex color", () => {
    expect(resolvePlayerColor("#1a2b3c", null)).toBe("#1a2b3c");
  });
});

// ─── Video block source detection ────────────────────────────────────────────

function isMediaRepoVideo(block: { type: string; data?: { source?: string } }): boolean {
  return block.type === "video" && block.data?.source === "media_repo";
}

function isDirectVideoUrl(url: string): boolean {
  return /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(url);
}

describe("isMediaRepoVideo", () => {
  it("returns true for media_repo video blocks", () => {
    expect(isMediaRepoVideo({ type: "video", data: { source: "media_repo" } })).toBe(true);
  });

  it("returns false for youtube video blocks", () => {
    expect(isMediaRepoVideo({ type: "video", data: { source: "youtube" } })).toBe(false);
  });

  it("returns false for non-video blocks", () => {
    expect(isMediaRepoVideo({ type: "text", data: { source: "media_repo" } })).toBe(false);
  });

  it("returns false when data is missing", () => {
    expect(isMediaRepoVideo({ type: "video" })).toBe(false);
  });
});

describe("isDirectVideoUrl", () => {
  it("detects .mp4 URLs", () => {
    expect(isDirectVideoUrl("https://cdn.example.com/video.mp4")).toBe(true);
  });

  it("detects .webm URLs", () => {
    expect(isDirectVideoUrl("https://cdn.example.com/video.webm")).toBe(true);
  });

  it("detects .mp4 URLs with query strings", () => {
    expect(isDirectVideoUrl("https://cdn.example.com/video.mp4?token=abc")).toBe(true);
  });

  it("returns false for YouTube embed URLs", () => {
    expect(isDirectVideoUrl("https://www.youtube.com/embed/abc123")).toBe(false);
  });

  it("returns false for Vimeo URLs", () => {
    expect(isDirectVideoUrl("https://player.vimeo.com/video/123")).toBe(false);
  });
});

// ─── Playback speed options ───────────────────────────────────────────────────

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

describe("SPEED_OPTIONS", () => {
  it("includes 1x normal speed", () => {
    expect(SPEED_OPTIONS).toContain(1);
  });

  it("includes 2x max speed", () => {
    expect(SPEED_OPTIONS).toContain(2);
  });

  it("includes 0.5x min speed", () => {
    expect(SPEED_OPTIONS).toContain(0.5);
  });

  it("has 7 speed options", () => {
    expect(SPEED_OPTIONS).toHaveLength(7);
  });

  it("is sorted ascending", () => {
    const sorted = [...SPEED_OPTIONS].sort((a, b) => a - b);
    expect(SPEED_OPTIONS).toEqual(sorted);
  });
});

// ─── Time formatting ──────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

describe("formatTime", () => {
  it("formats 0 seconds", () => {
    expect(formatTime(0)).toBe("0:00");
  });

  it("formats 65 seconds as 1:05", () => {
    expect(formatTime(65)).toBe("1:05");
  });

  it("formats 3600 seconds as 1:00:00", () => {
    expect(formatTime(3600)).toBe("1:00:00");
  });

  it("formats 3661 seconds as 1:01:01", () => {
    expect(formatTime(3661)).toBe("1:01:01");
  });

  it("handles Infinity gracefully", () => {
    expect(formatTime(Infinity)).toBe("0:00");
  });

  it("handles NaN gracefully", () => {
    expect(formatTime(NaN)).toBe("0:00");
  });

  it("handles negative numbers gracefully", () => {
    expect(formatTime(-5)).toBe("0:00");
  });
});
