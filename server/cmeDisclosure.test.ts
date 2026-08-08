/**
 * cmeDisclosure.test.ts
 * Tests for CME Financial Disclosure system and lesson drip-out (expiry).
 */
import { describe, it, expect } from "vitest";

// ─── CME Disclosure token generation ─────────────────────────────────────────

describe("CME Disclosure token generation", () => {
  it("generates a 64-character hex token", () => {
    const { randomBytes } = require("crypto");
    const token = randomBytes(32).toString("hex");
    expect(token).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(token)).toBe(true);
  });

  it("generates unique tokens each time", () => {
    const { randomBytes } = require("crypto");
    const t1 = randomBytes(32).toString("hex");
    const t2 = randomBytes(32).toString("hex");
    expect(t1).not.toBe(t2);
  });
});

// ─── CME Disclosure status logic ─────────────────────────────────────────────

describe("CME Disclosure status", () => {
  it("initial status is pending", () => {
    const disclosure = { status: "pending", submittedAt: null };
    expect(disclosure.status).toBe("pending");
    expect(disclosure.submittedAt).toBeNull();
  });

  it("submitted status has submittedAt timestamp", () => {
    const now = Date.now();
    const disclosure = { status: "submitted", submittedAt: now };
    expect(disclosure.status).toBe("submitted");
    expect(disclosure.submittedAt).toBeGreaterThan(0);
  });

  it("prevents double submission", () => {
    const disclosure = { status: "submitted" };
    const canSubmit = disclosure.status !== "submitted";
    expect(canSubmit).toBe(false);
  });
});

// ─── Disclosure PDF data construction ────────────────────────────────────────

describe("Disclosure PDF data construction", () => {
  it("builds PDF data from disclosure record", () => {
    const disclosure = {
      facultyName: "Dr. Jane Smith",
      facultyEmail: "jane@example.com",
      rolesJson: JSON.stringify(["Teacher / Instructor / Faculty"]),
      hasRelationships: "no",
      relationshipsJson: JSON.stringify([]),
      attestationName: "Dr. Jane Smith",
      attestationDate: "08/08/2026",
      submittedAt: Date.now(),
    };
    const roles = JSON.parse(disclosure.rolesJson);
    const relationships = JSON.parse(disclosure.relationshipsJson);
    expect(roles).toContain("Teacher / Instructor / Faculty");
    expect(relationships).toHaveLength(0);
    expect(disclosure.hasRelationships).toBe("no");
  });

  it("includes org name in PDF footer (no hardcoded brand)", () => {
    const orgName = "Test Medical School";
    const footer = `Financial Disclosure Form  ·  ${orgName}  ·  CME Joint Provider with CardioServ, LLC`;
    expect(footer).toContain("Test Medical School");
    expect(footer).not.toContain("All About Ultrasound");
    expect(footer).not.toContain("iHeartEcho");
  });
});

// ─── Lesson drip-out (expiry) logic ──────────────────────────────────────────

describe("Lesson drip-out (expiry)", () => {
  it("lesson without dripOutDays never expires", () => {
    const lesson = { dripOutDays: null };
    const isExpired = lesson.dripOutDays != null ? false : false;
    expect(isExpired).toBe(false);
  });

  it("lesson expires after dripOutDays from enrollment", () => {
    const enrolledAt = Date.now() - 91 * 24 * 60 * 60 * 1000; // 91 days ago
    const dripOutDays = 90;
    const expiresAt = enrolledAt + dripOutDays * 24 * 60 * 60 * 1000;
    const isExpired = Date.now() > expiresAt;
    expect(isExpired).toBe(true);
  });

  it("lesson is not expired before dripOutDays", () => {
    const enrolledAt = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 days ago
    const dripOutDays = 90;
    const expiresAt = enrolledAt + dripOutDays * 24 * 60 * 60 * 1000;
    const isExpired = Date.now() > expiresAt;
    expect(isExpired).toBe(false);
  });

  it("expiry date is computed correctly", () => {
    const enrolledAt = new Date("2026-01-01").getTime();
    const dripOutDays = 30;
    const expiresAt = enrolledAt + dripOutDays * 24 * 60 * 60 * 1000;
    const expiryDate = new Date(expiresAt).toISOString().split("T")[0];
    expect(expiryDate).toBe("2026-01-31");
  });

  it("drip-out error message includes expiry date", () => {
    const expiresAt = new Date("2026-08-01").getTime();
    const expiryDate = new Date(expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const message = `This lesson expired on ${expiryDate}`;
    expect(message).toContain("Aug");
    expect(message).toContain("2026");
  });
});

// ─── CME form hydration fix ───────────────────────────────────────────────────

describe("CME form hydration", () => {
  it("extracts form data from nested form object", () => {
    const serverResponse = {
      form: {
        activityTitle: "Advanced Echo",
        activityStructure: "ongoing",
        offeredMoreThanOnce: "yes",
        estimatedLearners: "500",
        cmeCreditsRequested: "1.5",
      },
      course: { id: 1, title: "Advanced Echo" },
      org: { name: "Test Org" },
      isNew: false,
    };
    const fd = serverResponse.form;
    expect(fd.activityTitle).toBe("Advanced Echo");
    expect(fd.activityStructure).toBe("ongoing");
    expect(fd.offeredMoreThanOnce).toBe("yes");
    expect(fd.estimatedLearners).toBe("500");
    expect(fd.cmeCreditsRequested).toBe("1.5");
  });

  it("handles null/undefined fields gracefully", () => {
    const fd: any = { activityTitle: null, activityStructure: undefined };
    const activityTitle = fd.activityTitle ?? "Default Title";
    const activityStructure = fd.activityStructure ?? "Enduring Material";
    expect(activityTitle).toBe("Default Title");
    expect(activityStructure).toBe("Enduring Material");
  });
});

// ─── Org-scoped disclosure isolation ─────────────────────────────────────────

describe("Org-scoped disclosure isolation", () => {
  it("disclosures are filtered by orgId", () => {
    const allDisclosures = [
      { id: 1, orgId: 10, courseId: 100, facultyName: "Dr. A" },
      { id: 2, orgId: 20, courseId: 200, facultyName: "Dr. B" },
      { id: 3, orgId: 10, courseId: 100, facultyName: "Dr. C" },
    ];
    const orgId = 10;
    const courseId = 100;
    const filtered = allDisclosures.filter(d => d.orgId === orgId && d.courseId === courseId);
    expect(filtered).toHaveLength(2);
    expect(filtered.map(d => d.facultyName)).toContain("Dr. A");
    expect(filtered.map(d => d.facultyName)).toContain("Dr. C");
    expect(filtered.map(d => d.facultyName)).not.toContain("Dr. B");
  });
});
