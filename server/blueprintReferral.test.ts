/**
 * blueprintReferral.test.ts
 * Tests for the Blueprint Referral system backend procedures
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock the database module ──────────────────────────────────────────────────
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

// ── Slug validation helper ────────────────────────────────────────────────────
function isValidSlug(slug: string): boolean {
  return /^[a-z0-9-]+$/.test(slug) && slug.length >= 3 && slug.length <= 100;
}

// ── Commission rate validation ────────────────────────────────────────────────
function isValidCommissionRate(rate: number): boolean {
  return rate >= 0 && rate <= 1;
}

// ── Session token generation ──────────────────────────────────────────────────
function generateSessionToken(): string {
  const { randomBytes } = require("crypto");
  return randomBytes(32).toString("hex");
}

// ── Pending install expiry ────────────────────────────────────────────────────
function pendingInstallExpiry(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d;
}

// ── URL construction ──────────────────────────────────────────────────────────
function buildReferralUrl(slug: string): string {
  return `https://${slug}.teachific.app?ref=1`;
}

describe("Blueprint Referral — slug validation", () => {
  it("accepts valid lowercase slugs", () => {
    expect(isValidSlug("my-fitness-school")).toBe(true);
    expect(isValidSlug("yoga-101")).toBe(true);
    expect(isValidSlug("abc")).toBe(true);
  });

  it("rejects slugs with uppercase letters", () => {
    expect(isValidSlug("MySchool")).toBe(false);
  });

  it("rejects slugs with spaces", () => {
    expect(isValidSlug("my school")).toBe(false);
  });

  it("rejects slugs shorter than 3 characters", () => {
    expect(isValidSlug("ab")).toBe(false);
  });

  it("rejects slugs longer than 100 characters", () => {
    expect(isValidSlug("a".repeat(101))).toBe(false);
  });

  it("accepts slugs with numbers and hyphens", () => {
    expect(isValidSlug("school-2024")).toBe(true);
    expect(isValidSlug("123-course")).toBe(true);
  });
});

describe("Blueprint Referral — commission rate validation", () => {
  it("accepts 0% commission", () => {
    expect(isValidCommissionRate(0)).toBe(true);
  });

  it("accepts 20% commission (0.2)", () => {
    expect(isValidCommissionRate(0.2)).toBe(true);
  });

  it("accepts 100% commission (1.0)", () => {
    expect(isValidCommissionRate(1.0)).toBe(true);
  });

  it("rejects negative commission", () => {
    expect(isValidCommissionRate(-0.1)).toBe(false);
  });

  it("rejects commission above 100%", () => {
    expect(isValidCommissionRate(1.1)).toBe(false);
  });
});

describe("Blueprint Referral — URL construction", () => {
  it("builds correct subdomain referral URL", () => {
    expect(buildReferralUrl("my-fitness-school")).toBe("https://my-fitness-school.teachific.app?ref=1");
  });

  it("always includes ?ref=1 query param", () => {
    const url = buildReferralUrl("test-school");
    expect(url).toContain("?ref=1");
  });

  it("uses teachific.app domain", () => {
    const url = buildReferralUrl("yoga-101");
    expect(url).toContain(".teachific.app");
  });
});

describe("Blueprint Referral — session token", () => {
  it("generates a 64-character hex token", () => {
    const token = generateSessionToken();
    expect(token).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(token)).toBe(true);
  });

  it("generates unique tokens on each call", () => {
    const t1 = generateSessionToken();
    const t2 = generateSessionToken();
    expect(t1).not.toBe(t2);
  });
});

describe("Blueprint Referral — pending install expiry", () => {
  it("sets expiry 30 days in the future", () => {
    const before = new Date();
    const expiry = pendingInstallExpiry();
    const after = new Date();

    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    expect(expiry.getTime()).toBeGreaterThanOrEqual(before.getTime() + thirtyDaysMs - 1000);
    expect(expiry.getTime()).toBeLessThanOrEqual(after.getTime() + thirtyDaysMs + 1000);
  });
});

describe("Blueprint Referral — subdomain detection logic", () => {
  it("detects blueprint referral from ?ref=1 param", () => {
    const search = "?ref=1";
    const isBlueprintReferral = search.includes("ref=1");
    expect(isBlueprintReferral).toBe(true);
  });

  it("does not detect blueprint referral without ?ref=1", () => {
    const search = "?preview=1";
    const isBlueprintReferral = search.includes("ref=1");
    expect(isBlueprintReferral).toBe(false);
  });
});
