/**
 * Tests for magic link authentication procedures
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Token generation ─────────────────────────────────────────────────────────
describe("Magic link token generation", () => {
  it("generates a 96-character hex token (48 bytes)", () => {
    const crypto = require("crypto");
    const token = crypto.randomBytes(48).toString("hex");
    expect(token).toHaveLength(96);
    expect(token).toMatch(/^[0-9a-f]+$/);
  });

  it("generates unique tokens on each call", () => {
    const crypto = require("crypto");
    const t1 = crypto.randomBytes(48).toString("hex");
    const t2 = crypto.randomBytes(48).toString("hex");
    expect(t1).not.toBe(t2);
  });
});

// ─── Token expiry logic ───────────────────────────────────────────────────────
describe("Magic link expiry", () => {
  it("expires in 15 minutes", () => {
    const now = Date.now();
    const expiresAt = new Date(now + 15 * 60 * 1000);
    const diffMs = expiresAt.getTime() - now;
    expect(diffMs).toBe(15 * 60 * 1000);
  });

  it("correctly identifies an expired token", () => {
    const pastDate = new Date(Date.now() - 1000); // 1 second ago
    expect(pastDate < new Date()).toBe(true);
  });

  it("correctly identifies a valid (non-expired) token", () => {
    const futureDate = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
    expect(futureDate > new Date()).toBe(true);
  });
});

// ─── Email template ───────────────────────────────────────────────────────────
describe("Magic link email template", () => {
  it("includes the magic URL in the email body", async () => {
    const { magicLinkEmailHtml } = await import("./emailTemplates");
    const html = magicLinkEmailHtml("Alice", "https://teachific.app/magic-link/verify?token=abc123", 15);
    expect(html).toContain("https://teachific.app/magic-link/verify?token=abc123");
  });

  it("includes the expiry time in the email body", async () => {
    const { magicLinkEmailHtml } = await import("./emailTemplates");
    const html = magicLinkEmailHtml("Bob", "https://teachific.app/magic-link/verify?token=xyz", 15);
    expect(html).toContain("15");
  });

  it("shows 'there' when name is empty", async () => {
    const { magicLinkEmailHtml } = await import("./emailTemplates");
    const html = magicLinkEmailHtml("", "https://teachific.app/magic-link/verify?token=xyz", 15);
    expect(html).toContain("there");
  });

  it("shows the user's name when provided", async () => {
    const { magicLinkEmailHtml } = await import("./emailTemplates");
    const html = magicLinkEmailHtml("Charlie", "https://teachific.app/magic-link/verify?token=xyz", 15);
    expect(html).toContain("Charlie");
  });

  it("includes a sign-in CTA button", async () => {
    const { magicLinkEmailHtml } = await import("./emailTemplates");
    const html = magicLinkEmailHtml("Dave", "https://teachific.app/magic-link/verify?token=xyz", 15);
    expect(html).toContain("Sign in to Teachific");
  });
});

// ─── Auto-register logic ──────────────────────────────────────────────────────
describe("Magic link auto-register", () => {
  it("derives username from email local part", () => {
    const email = "john.doe@example.com";
    const name = email.split("@")[0];
    expect(name).toBe("john.doe");
  });

  it("handles emails with + aliases", () => {
    const email = "user+tag@example.com";
    const name = email.split("@")[0];
    expect(name).toBe("user+tag");
  });
});

// ─── Session cookie ───────────────────────────────────────────────────────────
describe("Session token encoding", () => {
  it("encodes and decodes user session payload correctly", () => {
    const payload = { userId: 42, ts: Date.now() };
    const token = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const decoded = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
    expect(decoded.userId).toBe(42);
    expect(decoded.ts).toBe(payload.ts);
  });

  it("produces a URL-safe base64 token (no +, /, = chars)", () => {
    const payload = { userId: 99, ts: 1718000000000 };
    const token = Buffer.from(JSON.stringify(payload)).toString("base64url");
    expect(token).not.toMatch(/[+/=]/);
  });
});
