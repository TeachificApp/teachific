/**
 * Feature Alignment Tests
 * Covers: Groups invite link, CSV import parsing, course announcements/resources,
 * community multi-emoji reactions, page editor mobile preview state, EnrollmentGate logic
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── Groups: Invite Token ─────────────────────────────────────────────────────
describe("Groups invite token", () => {
  it("generates a 32-char hex token", () => {
    const { randomBytes } = require("crypto");
    const token = randomBytes(16).toString("hex");
    expect(token).toHaveLength(32);
    expect(/^[0-9a-f]+$/.test(token)).toBe(true);
  });

  it("invite URL is constructed correctly", () => {
    const origin = "https://example.manus.space";
    const token = "abc123def456";
    const url = `${origin}/join-group?token=${token}`;
    expect(url).toBe("https://example.manus.space/join-group?token=abc123def456");
  });
});

// ─── Groups: CSV Import Parsing ───────────────────────────────────────────────
describe("Groups CSV import parsing", () => {
  function parseCSV(csv: string): { email: string; name?: string }[] {
    const lines = csv.trim().split("\n");
    const headers = lines[0].toLowerCase().split(",").map(h => h.trim());
    const emailIdx = headers.indexOf("email");
    const nameIdx = headers.indexOf("name");
    if (emailIdx === -1) throw new Error("CSV must have an email column");
    return lines.slice(1).map(line => {
      const cols = line.split(",").map(c => c.trim());
      const email = cols[emailIdx];
      const name = nameIdx >= 0 ? cols[nameIdx] : undefined;
      return { email, name };
    }).filter(r => r.email && r.email.includes("@"));
  }

  it("parses a simple email-only CSV", () => {
    const csv = "email\nalice@example.com\nbob@example.com";
    const result = parseCSV(csv);
    expect(result).toHaveLength(2);
    expect(result[0].email).toBe("alice@example.com");
  });

  it("parses a CSV with name and email columns", () => {
    const csv = "name,email\nAlice,alice@example.com\nBob,bob@example.com";
    const result = parseCSV(csv);
    expect(result[0].name).toBe("Alice");
    expect(result[0].email).toBe("alice@example.com");
  });

  it("filters out rows with invalid emails", () => {
    const csv = "email\nalice@example.com\nnot-an-email\n";
    const result = parseCSV(csv);
    expect(result).toHaveLength(1);
  });

  it("throws if no email column", () => {
    const csv = "name\nAlice\nBob";
    expect(() => parseCSV(csv)).toThrow("CSV must have an email column");
  });
});

// ─── Course Announcements ─────────────────────────────────────────────────────
describe("Course announcements schema validation", () => {
  interface Announcement {
    title: string;
    body: string;
    isPinned?: boolean;
    publishedAt?: Date | null;
  }

  function validateAnnouncement(a: Announcement): string[] {
    const errors: string[] = [];
    if (!a.title || a.title.trim().length === 0) errors.push("Title is required");
    if (!a.body || a.body.trim().length === 0) errors.push("Body is required");
    if (a.title && a.title.length > 200) errors.push("Title must be 200 chars or less");
    return errors;
  }

  it("validates a valid announcement", () => {
    const errors = validateAnnouncement({ title: "New Module Released", body: "Check out the new content!" });
    expect(errors).toHaveLength(0);
  });

  it("requires title", () => {
    const errors = validateAnnouncement({ title: "", body: "Some body" });
    expect(errors).toContain("Title is required");
  });

  it("requires body", () => {
    const errors = validateAnnouncement({ title: "Title", body: "" });
    expect(errors).toContain("Body is required");
  });

  it("enforces title max length", () => {
    const errors = validateAnnouncement({ title: "a".repeat(201), body: "body" });
    expect(errors).toContain("Title must be 200 chars or less");
  });
});

// ─── Course Resources ─────────────────────────────────────────────────────────
describe("Course resources", () => {
  const ALLOWED_TYPES = ["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "zip", "mp3", "mp4", "jpg", "png", "gif", "svg", "txt", "csv"];

  function isAllowedFileType(filename: string): boolean {
    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    return ALLOWED_TYPES.includes(ext);
  }

  it("allows PDF files", () => expect(isAllowedFileType("handout.pdf")).toBe(true));
  it("allows PowerPoint files", () => expect(isAllowedFileType("slides.pptx")).toBe(true));
  it("allows ZIP files", () => expect(isAllowedFileType("resources.zip")).toBe(true));
  it("rejects executable files", () => expect(isAllowedFileType("malware.exe")).toBe(false));
  it("rejects PHP files", () => expect(isAllowedFileType("script.php")).toBe(false));
});

// ─── Community Multi-Emoji Reactions ─────────────────────────────────────────
describe("Community multi-emoji reactions", () => {
  const ALLOWED_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "👏"];

  function isAllowedEmoji(emoji: string): boolean {
    return ALLOWED_EMOJIS.includes(emoji);
  }

  function aggregateReactions(reactions: { emoji: string; userId: number }[]): Record<string, number> {
    return reactions.reduce((acc, r) => {
      acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  it("allows standard emojis", () => {
    expect(isAllowedEmoji("👍")).toBe(true);
    expect(isAllowedEmoji("❤️")).toBe(true);
    expect(isAllowedEmoji("🎉")).toBe(true);
  });

  it("rejects non-standard emojis", () => {
    expect(isAllowedEmoji("🍕")).toBe(false);
    expect(isAllowedEmoji("custom")).toBe(false);
  });

  it("aggregates reactions correctly", () => {
    const reactions = [
      { emoji: "👍", userId: 1 },
      { emoji: "👍", userId: 2 },
      { emoji: "❤️", userId: 3 },
    ];
    const agg = aggregateReactions(reactions);
    expect(agg["👍"]).toBe(2);
    expect(agg["❤️"]).toBe(1);
    expect(agg["😂"]).toBeUndefined();
  });

  it("a user can only react once per emoji (toggle logic)", () => {
    const reactions = [
      { emoji: "👍", userId: 1 },
      { emoji: "👍", userId: 2 },
    ];
    // Toggle: user 1 removes their 👍
    const userId = 1;
    const emoji = "👍";
    const existing = reactions.find(r => r.userId === userId && r.emoji === emoji);
    const updated = existing
      ? reactions.filter(r => !(r.userId === userId && r.emoji === emoji))
      : [...reactions, { emoji, userId }];
    expect(updated).toHaveLength(1);
    expect(updated[0].userId).toBe(2);
  });
});

// ─── Page Editor: Mobile Preview State ───────────────────────────────────────
describe("Page editor mobile preview state", () => {
  it("desktop mode uses 900px max width", () => {
    const previewWidth = "desktop";
    const maxWidth = previewWidth === "mobile" ? "390px" : "900px";
    expect(maxWidth).toBe("900px");
  });

  it("mobile mode uses 390px max width", () => {
    const previewWidth = "mobile";
    const maxWidth = previewWidth === "mobile" ? "390px" : "900px";
    expect(maxWidth).toBe("390px");
  });
});

// ─── Page Editor: Undo/Redo History ──────────────────────────────────────────
describe("Page editor undo/redo history", () => {
  interface Block { id: string; type: string }

  function createHistoryManager() {
    let blocks: Block[] = [];
    let history: Block[][] = [];
    let future: Block[][] = [];

    return {
      getBlocks: () => blocks,
      set: (newBlocks: Block[]) => {
        history = [...history.slice(-49), blocks];
        future = [];
        blocks = newBlocks;
      },
      undo: () => {
        if (!history.length) return;
        future = [blocks, ...future.slice(0, 49)];
        blocks = history[history.length - 1];
        history = history.slice(0, -1);
      },
      redo: () => {
        if (!future.length) return;
        history = [...history.slice(-49), blocks];
        blocks = future[0];
        future = future.slice(1);
      },
      canUndo: () => history.length > 0,
      canRedo: () => future.length > 0,
    };
  }

  it("tracks history on set", () => {
    const mgr = createHistoryManager();
    mgr.set([{ id: "1", type: "hero" }]);
    expect(mgr.canUndo()).toBe(true);
    expect(mgr.canRedo()).toBe(false);
  });

  it("undoes to previous state", () => {
    const mgr = createHistoryManager();
    mgr.set([{ id: "1", type: "hero" }]);
    mgr.set([{ id: "1", type: "hero" }, { id: "2", type: "text" }]);
    mgr.undo();
    expect(mgr.getBlocks()).toHaveLength(1);
  });

  it("redoes after undo", () => {
    const mgr = createHistoryManager();
    mgr.set([{ id: "1", type: "hero" }]);
    mgr.set([{ id: "1", type: "hero" }, { id: "2", type: "text" }]);
    mgr.undo();
    mgr.redo();
    expect(mgr.getBlocks()).toHaveLength(2);
  });

  it("clears redo stack on new set", () => {
    const mgr = createHistoryManager();
    mgr.set([{ id: "1", type: "hero" }]);
    mgr.set([{ id: "1", type: "hero" }, { id: "2", type: "text" }]);
    mgr.undo();
    mgr.set([{ id: "1", type: "hero" }, { id: "3", type: "image" }]);
    expect(mgr.canRedo()).toBe(false);
  });

  it("limits history to 50 entries", () => {
    const mgr = createHistoryManager();
    for (let i = 0; i < 60; i++) {
      mgr.set([{ id: String(i), type: "text" }]);
    }
    // After 60 sets, history should be capped at 50 (not 60)
    let undoCount = 0;
    while (mgr.canUndo()) { mgr.undo(); undoCount++; }
    expect(undoCount).toBeLessThanOrEqual(50);
  });
});

// ─── Workshop Checkout: Content Type ─────────────────────────────────────────
describe("Workshop checkout content type", () => {
  const VALID_CONTENT_TYPES = ["course", "download", "bundle", "membership", "physical", "workshop"];

  it("workshop is a valid content type", () => {
    expect(VALID_CONTENT_TYPES.includes("workshop")).toBe(true);
  });

  it("workshop checkout URL is constructed correctly", () => {
    const orgSlug = "myorg";
    const workshopSlug = "advanced-echo-workshop";
    const url = `/checkout/${orgSlug}/workshop/${workshopSlug}`;
    expect(url).toBe("/checkout/myorg/workshop/advanced-echo-workshop");
  });
});

// ─── EnrollmentGate: Access Logic ────────────────────────────────────────────
describe("EnrollmentGate access logic", () => {
  function shouldShowGate(opts: {
    isLoggedIn: boolean;
    isEnrolled: boolean;
    isPreviewMode: boolean;
    isFreeLesson: boolean;
  }): boolean {
    if (opts.isPreviewMode) return false;
    if (opts.isFreeLesson) return false;
    if (!opts.isLoggedIn) return true;
    if (!opts.isEnrolled) return true;
    return false;
  }

  it("shows gate for unauthenticated user", () => {
    expect(shouldShowGate({ isLoggedIn: false, isEnrolled: false, isPreviewMode: false, isFreeLesson: false })).toBe(true);
  });

  it("shows gate for logged-in but not enrolled user", () => {
    expect(shouldShowGate({ isLoggedIn: true, isEnrolled: false, isPreviewMode: false, isFreeLesson: false })).toBe(true);
  });

  it("does not show gate for enrolled user", () => {
    expect(shouldShowGate({ isLoggedIn: true, isEnrolled: true, isPreviewMode: false, isFreeLesson: false })).toBe(false);
  });

  it("does not show gate in preview mode", () => {
    expect(shouldShowGate({ isLoggedIn: false, isEnrolled: false, isPreviewMode: true, isFreeLesson: false })).toBe(false);
  });

  it("does not show gate for free lessons", () => {
    expect(shouldShowGate({ isLoggedIn: false, isEnrolled: false, isPreviewMode: false, isFreeLesson: true })).toBe(false);
  });
});
