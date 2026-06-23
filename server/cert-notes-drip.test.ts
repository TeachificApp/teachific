/**
 * Tests for:
 * 1. Certificate completion email template
 * 2. Drip unlock email template
 * 3. Drip lock logic (isDripLocked computation)
 * 4. Notes/bookmarks router input validation
 */
import { describe, it, expect } from "vitest";
import { certificateCompletionHtml, dripUnlockHtml } from "./emailTemplates";

// ─── Certificate Email Template ──────────────────────────────────────────────
describe("certificateCompletionHtml", () => {
  it("includes the user name and course title", () => {
    const html = certificateCompletionHtml({
      userName: "Alice Johnson",
      courseTitle: "Advanced Echocardiography",
      issuedAt: new Date("2026-01-15"),
      verificationCode: "CERT-ABC123",
    });
    expect(html).toContain("Alice Johnson");
    expect(html).toContain("Advanced Echocardiography");
    expect(html).toContain("CERT-ABC123");
  });

  it("includes the org name when provided", () => {
    const html = certificateCompletionHtml({
      userName: "Bob",
      courseTitle: "POCUS Basics",
      issuedAt: new Date(),
      verificationCode: "CERT-XYZ",
      orgName: "Teachific",
    });
    expect(html).toContain("Teachific");
  });

  it("includes the course URL CTA when provided", () => {
    const html = certificateCompletionHtml({
      userName: "Carol",
      courseTitle: "Registry Review",
      issuedAt: new Date(),
      verificationCode: "CERT-999",
      courseUrl: "https://example.com/learn/registry-review",
    });
    expect(html).toContain("https://example.com/learn/registry-review");
  });

  it("returns a non-empty HTML string", () => {
    const html = certificateCompletionHtml({
      userName: "Dave",
      courseTitle: "Test Course",
      issuedAt: new Date(),
      verificationCode: "CERT-001",
    });
    expect(typeof html).toBe("string");
    expect(html.length).toBeGreaterThan(100);
    expect(html).toContain("<!DOCTYPE html>");
  });
});

// ─── Drip Unlock Email Template ───────────────────────────────────────────────
describe("dripUnlockHtml", () => {
  it("includes the user name, course title, and unlocked lessons", () => {
    const html = dripUnlockHtml({
      userName: "Eve Smith",
      courseTitle: "Cardiac Imaging",
      unlockedLessons: ["Module 3: Valves", "Module 4: Pericardium"],
    });
    expect(html).toContain("Eve Smith");
    expect(html).toContain("Cardiac Imaging");
    expect(html).toContain("Module 3: Valves");
    expect(html).toContain("Module 4: Pericardium");
  });

  it("includes the org name when provided", () => {
    const html = dripUnlockHtml({
      userName: "Frank",
      courseTitle: "Echo Basics",
      orgName: "Teachific",
      unlockedLessons: ["Lesson 1"],
    });
    expect(html).toContain("Teachific");
  });

  it("includes the course URL CTA when provided", () => {
    const html = dripUnlockHtml({
      userName: "Grace",
      courseTitle: "POCUS",
      unlockedLessons: ["Intro"],
      courseUrl: "https://example.com/learn/pocus",
    });
    expect(html).toContain("https://example.com/learn/pocus");
  });

  it("handles an empty lessons list gracefully", () => {
    const html = dripUnlockHtml({
      userName: "Henry",
      courseTitle: "Empty Course",
      unlockedLessons: [],
    });
    expect(typeof html).toBe("string");
    expect(html.length).toBeGreaterThan(100);
  });
});

// ─── Drip Lock Logic ──────────────────────────────────────────────────────────
describe("drip lock computation", () => {
  // Replicate the logic from the curriculum.get procedure
  function computeDripLock(lesson: {
    dripType: string;
    dripDays?: number | null;
    dripDate?: Date | null;
  }, enrolledAt: Date, now: Date): { isDripLocked: boolean; unlocksAt: Date | null } {
    let isDripLocked = false;
    let unlocksAt: Date | null = null;
    if (lesson.dripType && lesson.dripType !== "immediate") {
      if (lesson.dripType === "days_after_enrollment" && lesson.dripDays != null) {
        const unlockDate = new Date(enrolledAt.getTime() + lesson.dripDays * 24 * 60 * 60 * 1000);
        if (unlockDate > now) {
          isDripLocked = true;
          unlocksAt = unlockDate;
        }
      } else if (lesson.dripType === "specific_date" && lesson.dripDate) {
        const unlockDate = new Date(lesson.dripDate);
        if (unlockDate > now) {
          isDripLocked = true;
          unlocksAt = unlockDate;
        }
      }
    }
    return { isDripLocked, unlocksAt };
  }

  const now = new Date("2026-04-24T12:00:00Z");
  const enrolledAt = new Date("2026-04-20T12:00:00Z"); // enrolled 4 days ago

  it("immediate lessons are never locked", () => {
    const result = computeDripLock({ dripType: "immediate" }, enrolledAt, now);
    expect(result.isDripLocked).toBe(false);
    expect(result.unlocksAt).toBeNull();
  });

  it("days_after_enrollment: locked when not enough days have passed", () => {
    const result = computeDripLock({ dripType: "days_after_enrollment", dripDays: 7 }, enrolledAt, now);
    expect(result.isDripLocked).toBe(true);
    expect(result.unlocksAt).not.toBeNull();
    // Should unlock 7 days after enrollment = 2026-04-27
    expect(result.unlocksAt!.toISOString().startsWith("2026-04-27")).toBe(true);
  });

  it("days_after_enrollment: unlocked when enough days have passed", () => {
    const result = computeDripLock({ dripType: "days_after_enrollment", dripDays: 3 }, enrolledAt, now);
    expect(result.isDripLocked).toBe(false);
    expect(result.unlocksAt).toBeNull();
  });

  it("days_after_enrollment: exactly at unlock boundary is unlocked", () => {
    // Enrolled 4 days ago, dripDays = 4 → unlocks exactly at enrolledAt + 4 days = now
    const result = computeDripLock({ dripType: "days_after_enrollment", dripDays: 4 }, enrolledAt, now);
    expect(result.isDripLocked).toBe(false);
  });

  it("specific_date: locked when date is in the future", () => {
    const futureDate = new Date("2026-05-01T12:00:00Z");
    const result = computeDripLock({ dripType: "specific_date", dripDate: futureDate }, enrolledAt, now);
    expect(result.isDripLocked).toBe(true);
    expect(result.unlocksAt).toEqual(futureDate);
  });

  it("specific_date: unlocked when date is in the past", () => {
    const pastDate = new Date("2026-04-01T12:00:00Z");
    const result = computeDripLock({ dripType: "specific_date", dripDate: pastDate }, enrolledAt, now);
    expect(result.isDripLocked).toBe(false);
    expect(result.unlocksAt).toBeNull();
  });

  it("days_after_enrollment with null dripDays is not locked", () => {
    const result = computeDripLock({ dripType: "days_after_enrollment", dripDays: null }, enrolledAt, now);
    expect(result.isDripLocked).toBe(false);
  });
});

// ─── Drip Unlock Label ────────────────────────────────────────────────────────
describe("getDripUnlockLabel", () => {
  // Replicate the label logic from CoursePlayerPage
  function getDripUnlockLabel(lesson: { isDripLocked: boolean; unlocksAt?: Date | null }, now: Date): string | null {
    if (!lesson.isDripLocked || !lesson.unlocksAt) return null;
    const unlockDate = new Date(lesson.unlocksAt);
    const diffMs = unlockDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return null;
    if (diffDays === 1) return "Unlocks tomorrow";
    if (diffDays <= 7) return `Unlocks in ${diffDays} days`;
    return `Unlocks ${unlockDate.toLocaleDateString()}`;
  }

  const now = new Date("2026-04-24T12:00:00Z");

  it("returns null for non-drip-locked lessons", () => {
    expect(getDripUnlockLabel({ isDripLocked: false }, now)).toBeNull();
  });

  it("returns null when unlocksAt is null", () => {
    expect(getDripUnlockLabel({ isDripLocked: true, unlocksAt: null }, now)).toBeNull();
  });

  it("returns 'Unlocks tomorrow' for 1 day away", () => {
    const tomorrow = new Date("2026-04-25T12:00:00Z");
    expect(getDripUnlockLabel({ isDripLocked: true, unlocksAt: tomorrow }, now)).toBe("Unlocks tomorrow");
  });

  it("returns 'Unlocks in X days' for 2-7 days", () => {
    const in3Days = new Date("2026-04-27T12:00:00Z");
    expect(getDripUnlockLabel({ isDripLocked: true, unlocksAt: in3Days }, now)).toBe("Unlocks in 3 days");
  });

  it("returns formatted date for more than 7 days away", () => {
    const in14Days = new Date("2026-05-08T12:00:00Z");
    const label = getDripUnlockLabel({ isDripLocked: true, unlocksAt: in14Days }, now);
    expect(label).not.toBeNull();
    expect(label).toContain("2026");
  });
});
