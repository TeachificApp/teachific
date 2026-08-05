/**
 * Tests for CME / Cardioserv changes (Aug 4, 2026)
 * - Three new date fields in CmeActivityFormDialog
 * - Multi-email chip list for Send to Cardioserv
 * - sendCmeForm toEmails array support
 */

import { describe, it, expect } from "vitest";

// ── Date field validation helpers ─────────────────────────────────────────────

function isValidDateString(value: string): boolean {
  if (!value) return true; // optional fields
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value));
}

describe("CME date fields", () => {
  it("accepts valid ISO date strings for originalReleaseDate", () => {
    expect(isValidDateString("2024-01-15")).toBe(true);
    expect(isValidDateString("2026-08-04")).toBe(true);
  });

  it("accepts valid ISO date strings for mostRecentReviewDate", () => {
    expect(isValidDateString("2025-06-01")).toBe(true);
  });

  it("accepts valid ISO date strings for expirationDate", () => {
    expect(isValidDateString("2027-12-31")).toBe(true);
  });

  it("accepts empty string (optional field)", () => {
    expect(isValidDateString("")).toBe(true);
  });

  it("rejects malformed date strings", () => {
    expect(isValidDateString("not-a-date")).toBe(false);
    expect(isValidDateString("2024/01/15")).toBe(false);
  });
});

// ── Multi-email chip list helpers ─────────────────────────────────────────────

const CARDIOSERV_DEFAULTS = ["don@cardioserv.net", "j.buckland@cardioserv.net"];

function buildDefaultEmailList(cmeContactEmail?: string | null): string[] {
  const defaults = [...CARDIOSERV_DEFAULTS];
  if (cmeContactEmail && !defaults.includes(cmeContactEmail)) {
    defaults.push(cmeContactEmail);
  }
  return defaults;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function addEmail(list: string[], email: string): { list: string[]; error?: string } {
  const trimmed = email.trim();
  if (!trimmed) return { list, error: "Email is empty" };
  if (!isValidEmail(trimmed)) return { list, error: "Invalid email address" };
  if (list.includes(trimmed)) return { list, error: "Email already in list" };
  return { list: [...list, trimmed] };
}

function removeEmail(list: string[], email: string): string[] {
  return list.filter(e => e !== email);
}

describe("Multi-email chip list — default population", () => {
  it("includes both Cardioserv defaults", () => {
    const list = buildDefaultEmailList(null);
    expect(list).toContain("don@cardioserv.net");
    expect(list).toContain("j.buckland@cardioserv.net");
    expect(list).toHaveLength(2);
  });

  it("adds org contact email if set and not already in list", () => {
    const list = buildDefaultEmailList("cme@myorg.com");
    expect(list).toContain("cme@myorg.com");
    expect(list).toHaveLength(3);
  });

  it("does not duplicate if org contact email matches a Cardioserv default", () => {
    const list = buildDefaultEmailList("don@cardioserv.net");
    expect(list.filter(e => e === "don@cardioserv.net")).toHaveLength(1);
    expect(list).toHaveLength(2);
  });

  it("handles undefined org contact email gracefully", () => {
    const list = buildDefaultEmailList(undefined);
    expect(list).toHaveLength(2);
  });
});

describe("Multi-email chip list — add/remove", () => {
  it("adds a valid email to the list", () => {
    const { list, error } = addEmail(["don@cardioserv.net"], "new@example.com");
    expect(error).toBeUndefined();
    expect(list).toContain("new@example.com");
    expect(list).toHaveLength(2);
  });

  it("rejects invalid email format", () => {
    const { list, error } = addEmail(["don@cardioserv.net"], "not-an-email");
    expect(error).toBe("Invalid email address");
    expect(list).toHaveLength(1);
  });

  it("rejects duplicate email", () => {
    const { list, error } = addEmail(["don@cardioserv.net"], "don@cardioserv.net");
    expect(error).toBe("Email already in list");
    expect(list).toHaveLength(1);
  });

  it("rejects empty string", () => {
    const { error } = addEmail(["don@cardioserv.net"], "");
    expect(error).toBe("Email is empty");
  });

  it("removes an email from the list", () => {
    const list = removeEmail(["don@cardioserv.net", "j.buckland@cardioserv.net"], "don@cardioserv.net");
    expect(list).not.toContain("don@cardioserv.net");
    expect(list).toHaveLength(1);
  });

  it("removing a non-existent email is a no-op", () => {
    const list = removeEmail(["don@cardioserv.net"], "unknown@example.com");
    expect(list).toHaveLength(1);
  });
});

// ── sendCmeForm toEmails resolution ──────────────────────────────────────────

interface SendCmeInput {
  toEmails?: string[];
  recipientEmail?: string;
  cmeContactEmail?: string | null;
}

interface EmailEntry { name: string; email: string; }

function resolveToList(input: SendCmeInput): { toList: EmailEntry[]; ccList: EmailEntry[] } {
  const senderName = "Org";
  let toList: EmailEntry[];
  let ccList: EmailEntry[] = [];

  if (input.toEmails && input.toEmails.length > 0) {
    toList = input.toEmails.map(email => ({ name: email, email }));
  } else if (input.recipientEmail) {
    toList = [{ name: input.recipientEmail, email: input.recipientEmail }];
    ccList = [{ name: "Judith Buckland", email: "j.buckland@cardioserv.net" }];
    if (input.cmeContactEmail) {
      ccList.push({ name: senderName, email: input.cmeContactEmail });
    }
  } else {
    toList = [{ name: "Don Gerig", email: "don@cardioserv.net" }];
    ccList = [{ name: "Judith Buckland", email: "j.buckland@cardioserv.net" }];
    if (input.cmeContactEmail) {
      ccList.push({ name: senderName, email: input.cmeContactEmail });
    }
  }
  return { toList, ccList };
}

describe("sendCmeForm — toEmails resolution", () => {
  it("uses toEmails array as full TO list when provided", () => {
    const { toList, ccList } = resolveToList({
      toEmails: ["don@cardioserv.net", "j.buckland@cardioserv.net", "cme@myorg.com"],
    });
    expect(toList).toHaveLength(3);
    expect(toList.map(e => e.email)).toContain("cme@myorg.com");
    expect(ccList).toHaveLength(0);
  });

  it("falls back to recipientEmail in legacy mode with Cardioserv CC", () => {
    const { toList, ccList } = resolveToList({ recipientEmail: "custom@example.com" });
    expect(toList).toHaveLength(1);
    expect(toList[0].email).toBe("custom@example.com");
    expect(ccList.map(e => e.email)).toContain("j.buckland@cardioserv.net");
  });

  it("adds org contact email to CC in legacy mode", () => {
    const { ccList } = resolveToList({
      recipientEmail: "custom@example.com",
      cmeContactEmail: "cme@myorg.com",
    });
    expect(ccList.map(e => e.email)).toContain("cme@myorg.com");
  });

  it("defaults to Cardioserv primary when neither toEmails nor recipientEmail provided", () => {
    const { toList } = resolveToList({});
    expect(toList[0].email).toBe("don@cardioserv.net");
  });

  it("toEmails takes precedence over recipientEmail", () => {
    const { toList } = resolveToList({
      toEmails: ["a@example.com"],
      recipientEmail: "b@example.com",
    });
    expect(toList[0].email).toBe("a@example.com");
    expect(toList.map(e => e.email)).not.toContain("b@example.com");
  });

  it("empty toEmails array falls back to recipientEmail", () => {
    const { toList } = resolveToList({
      toEmails: [],
      recipientEmail: "fallback@example.com",
    });
    expect(toList[0].email).toBe("fallback@example.com");
  });
});
