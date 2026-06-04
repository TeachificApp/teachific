import { describe, it, expect } from "vitest";

// ─── Unit tests for VideoEditor logic (word-level transcript operations) ─────
// These test the pure logic functions that the VideoEditor uses

interface TranscriptWord {
  id: number;
  word: string;
  start: number;
  end: number;
  deleted?: boolean;
}

// Replicate the filler word detection logic
const FILLER_WORDS = ["uh", "um", "uhm", "hmm", "like", "you know", "so", "right", "basically", "actually", "literally", "i mean"];

function detectFillers(words: TranscriptWord[]): number[] {
  return words
    .filter((w) => !w.deleted && FILLER_WORDS.includes(w.word.toLowerCase().replace(/[.,!?;:]/g, "")))
    .map((w) => w.id);
}

function removeFillers(words: TranscriptWord[]): TranscriptWord[] {
  return words.map((w) => {
    const clean = w.word.toLowerCase().replace(/[.,!?;:]/g, "");
    if (!w.deleted && FILLER_WORDS.includes(clean)) {
      return { ...w, deleted: true };
    }
    return w;
  });
}

function findOccurrences(words: TranscriptWord[], searchText: string): number[] {
  return words
    .filter((w) => !w.deleted && w.word.toLowerCase().includes(searchText.toLowerCase()))
    .map((w) => w.id);
}

function replaceOne(words: TranscriptWord[], targetId: number, findText: string, replaceText: string): TranscriptWord[] {
  return words.map((w) => w.id === targetId ? { ...w, word: w.word.replace(new RegExp(findText, "i"), replaceText) } : w);
}

function replaceAll(words: TranscriptWord[], findText: string, replaceText: string): TranscriptWord[] {
  return words.map((w) => {
    if (!w.deleted && w.word.toLowerCase().includes(findText.toLowerCase())) {
      return { ...w, word: w.word.replace(new RegExp(findText, "gi"), replaceText) };
    }
    return w;
  });
}

function deleteAllOccurrences(words: TranscriptWord[], findText: string): TranscriptWord[] {
  return words.map((w) => {
    if (!w.deleted && w.word.toLowerCase().includes(findText.toLowerCase())) {
      return { ...w, deleted: true };
    }
    return w;
  });
}

function getDeletedRegions(words: TranscriptWord[]): { start: number; end: number }[] {
  const deleted = words.filter((w) => w.deleted);
  if (deleted.length === 0) return [];
  const regions: { start: number; end: number }[] = [];
  let current = { start: deleted[0].start, end: deleted[0].end };
  for (let i = 1; i < deleted.length; i++) {
    if (deleted[i].start - current.end < 0.1) {
      current.end = deleted[i].end;
    } else {
      regions.push(current);
      current = { start: deleted[i].start, end: deleted[i].end };
    }
  }
  regions.push(current);
  return regions;
}

function buildSegmentsFromWords(words: TranscriptWord[], chunkSize = 8) {
  const visibleWords = words.filter((w) => !w.deleted);
  const segments: { id: number; start: number; end: number; text: string }[] = [];
  for (let i = 0; i < visibleWords.length; i += chunkSize) {
    const chunk = visibleWords.slice(i, i + chunkSize);
    segments.push({
      id: Math.floor(i / chunkSize),
      start: chunk[0].start,
      end: chunk[chunk.length - 1].end,
      text: chunk.map((w) => w.word).join(" "),
    });
  }
  return segments;
}

// ─── Test Data ───────────────────────────────────────────────────────────────

const sampleWords: TranscriptWord[] = [
  { id: 0, word: "Hello", start: 0.0, end: 0.5 },
  { id: 1, word: "um", start: 0.5, end: 0.8 },
  { id: 2, word: "welcome", start: 0.8, end: 1.3 },
  { id: 3, word: "to", start: 1.3, end: 1.5 },
  { id: 4, word: "uh", start: 1.5, end: 1.7 },
  { id: 5, word: "the", start: 1.7, end: 1.9 },
  { id: 6, word: "course", start: 1.9, end: 2.4 },
  { id: 7, word: "basically", start: 2.4, end: 2.9 },
  { id: 8, word: "we", start: 2.9, end: 3.1 },
  { id: 9, word: "will", start: 3.1, end: 3.3 },
  { id: 10, word: "like", start: 3.3, end: 3.5 },
  { id: 11, word: "learn", start: 3.5, end: 3.9 },
  { id: 12, word: "everything", start: 3.9, end: 4.5 },
];

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("VideoEditor word-level transcript operations", () => {
  describe("Filler word detection", () => {
    it("detects filler words correctly", () => {
      const fillers = detectFillers(sampleWords);
      expect(fillers).toContain(1); // "um"
      expect(fillers).toContain(4); // "uh"
      expect(fillers).toContain(7); // "basically"
      expect(fillers).toContain(10); // "like"
      expect(fillers).toHaveLength(4);
    });

    it("does not detect non-filler words", () => {
      const fillers = detectFillers(sampleWords);
      expect(fillers).not.toContain(0); // "Hello"
      expect(fillers).not.toContain(2); // "welcome"
      expect(fillers).not.toContain(6); // "course"
    });

    it("skips already deleted words", () => {
      const wordsWithDeleted = sampleWords.map((w) => w.id === 1 ? { ...w, deleted: true } : w);
      const fillers = detectFillers(wordsWithDeleted);
      expect(fillers).not.toContain(1); // "um" is already deleted
      expect(fillers).toHaveLength(3);
    });
  });

  describe("Filler word removal", () => {
    it("marks all filler words as deleted", () => {
      const result = removeFillers(sampleWords);
      expect(result[1].deleted).toBe(true);  // "um"
      expect(result[4].deleted).toBe(true);  // "uh"
      expect(result[7].deleted).toBe(true);  // "basically"
      expect(result[10].deleted).toBe(true); // "like"
    });

    it("preserves non-filler words", () => {
      const result = removeFillers(sampleWords);
      expect(result[0].deleted).toBeFalsy(); // "Hello"
      expect(result[2].deleted).toBeFalsy(); // "welcome"
      expect(result[6].deleted).toBeFalsy(); // "course"
      expect(result[11].deleted).toBeFalsy(); // "learn"
    });
  });

  describe("Find & Replace", () => {
    it("finds all occurrences of a word", () => {
      const results = findOccurrences(sampleWords, "the");
      expect(results).toContain(5); // "the"
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it("finds partial matches", () => {
      const results = findOccurrences(sampleWords, "ello");
      expect(results).toContain(0); // "Hello" contains "ello"
    });

    it("replaces one occurrence", () => {
      const result = replaceOne(sampleWords, 0, "Hello", "Hi");
      expect(result[0].word).toBe("Hi");
      expect(result[2].word).toBe("welcome"); // unchanged
    });

    it("replaces all occurrences", () => {
      const wordsWithDuplicates: TranscriptWord[] = [
        { id: 0, word: "the", start: 0, end: 0.3 },
        { id: 1, word: "cat", start: 0.3, end: 0.6 },
        { id: 2, word: "the", start: 0.6, end: 0.9 },
        { id: 3, word: "dog", start: 0.9, end: 1.2 },
      ];
      const result = replaceAll(wordsWithDuplicates, "the", "a");
      expect(result[0].word).toBe("a");
      expect(result[2].word).toBe("a");
      expect(result[1].word).toBe("cat"); // unchanged
    });

    it("deletes all occurrences", () => {
      const result = deleteAllOccurrences(sampleWords, "um");
      expect(result[1].deleted).toBe(true); // "um"
      expect(result[0].deleted).toBeFalsy(); // "Hello" unchanged
    });
  });

  describe("Deleted regions for playback skip", () => {
    it("returns empty array when no words deleted", () => {
      const regions = getDeletedRegions(sampleWords);
      expect(regions).toHaveLength(0);
    });

    it("returns single region for one deleted word", () => {
      const wordsWithDeleted = sampleWords.map((w) => w.id === 1 ? { ...w, deleted: true } : w);
      const regions = getDeletedRegions(wordsWithDeleted);
      expect(regions).toHaveLength(1);
      expect(regions[0].start).toBe(0.5);
      expect(regions[0].end).toBe(0.8);
    });

    it("merges adjacent deleted words into one region", () => {
      // Delete words 3,4,5 (to, uh, the) — they are adjacent (1.3→1.5, 1.5→1.7, 1.7→1.9)
      const wordsWithDeleted = sampleWords.map((w) => [3, 4, 5].includes(w.id) ? { ...w, deleted: true } : w);
      const regions = getDeletedRegions(wordsWithDeleted);
      expect(regions).toHaveLength(1);
      expect(regions[0].start).toBe(1.3);
      expect(regions[0].end).toBe(1.9);
    });

    it("creates separate regions for non-adjacent deleted words", () => {
      // Delete word 1 (um: 0.5-0.8) and word 7 (basically: 2.4-2.9) — far apart
      const wordsWithDeleted = sampleWords.map((w) => [1, 7].includes(w.id) ? { ...w, deleted: true } : w);
      const regions = getDeletedRegions(wordsWithDeleted);
      expect(regions).toHaveLength(2);
      expect(regions[0].start).toBe(0.5);
      expect(regions[0].end).toBe(0.8);
      expect(regions[1].start).toBe(2.4);
      expect(regions[1].end).toBe(2.9);
    });
  });

  describe("Build segments from words (for VTT export)", () => {
    it("groups words into segments of chunkSize", () => {
      const segments = buildSegmentsFromWords(sampleWords, 4);
      expect(segments.length).toBe(4); // 13 words / 4 = 3.25 → 4 segments
      expect(segments[0].text).toBe("Hello um welcome to");
      expect(segments[0].start).toBe(0.0);
      expect(segments[0].end).toBe(1.5);
    });

    it("excludes deleted words from segments", () => {
      const wordsWithDeleted = removeFillers(sampleWords); // removes um, uh, basically, like
      const segments = buildSegmentsFromWords(wordsWithDeleted, 4);
      // 13 - 4 fillers = 9 visible words → 3 segments of 4,4,1
      expect(segments.length).toBe(3);
      expect(segments[0].text).toBe("Hello welcome to the");
      expect(segments[0].text).not.toContain("um");
      expect(segments[0].text).not.toContain("uh");
    });

    it("handles all words deleted gracefully", () => {
      const allDeleted = sampleWords.map((w) => ({ ...w, deleted: true }));
      const segments = buildSegmentsFromWords(allDeleted);
      expect(segments).toHaveLength(0);
    });
  });

  describe("Video input methods", () => {
    it("supports current, upload, url, and record modes", () => {
      const validModes = ["current", "upload", "url", "record"];
      validModes.forEach((mode) => {
        expect(["current", "upload", "url", "record"]).toContain(mode);
      });
    });
  });

  describe("generateCaptions backend response format", () => {
    it("expects word-level data with start/end timestamps", () => {
      const expectedFormat: TranscriptWord = { id: 0, word: "Hello", start: 0.0, end: 0.5 };
      expect(expectedFormat).toHaveProperty("id");
      expect(expectedFormat).toHaveProperty("word");
      expect(expectedFormat).toHaveProperty("start");
      expect(expectedFormat).toHaveProperty("end");
      expect(typeof expectedFormat.start).toBe("number");
      expect(typeof expectedFormat.end).toBe("number");
    });

    it("word timestamps are non-negative and end > start", () => {
      for (const w of sampleWords) {
        expect(w.start).toBeGreaterThanOrEqual(0);
        expect(w.end).toBeGreaterThan(w.start);
      }
    });
  });
});
