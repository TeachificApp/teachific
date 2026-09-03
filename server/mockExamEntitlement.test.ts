import { describe, expect, it } from "vitest";
import { canUseMockExamSubscription, canUseMockExams } from "./lib/mockExamEntitlement";

describe("Course360 mock-exam organization entitlement", () => {
  it("allows only Pro and Enterprise organizations", () => {
    expect(canUseMockExams("free")).toBe(false);
    expect(canUseMockExams("starter")).toBe(false);
    expect(canUseMockExams("builder")).toBe(false);
    expect(canUseMockExams("pro")).toBe(true);
    expect(canUseMockExams("enterprise")).toBe(true);
  });

  it("fails closed for missing or unrecognized organization plans", () => {
    expect(canUseMockExams(undefined)).toBe(false);
    expect(canUseMockExams(null)).toBe(false);
    expect(canUseMockExams("custom")).toBe(false);
  });

  it("revokes delivery when a Pro-or-higher organization subscription is no longer active or trialing", () => {
    expect(canUseMockExamSubscription("pro", "active")).toBe(true);
    expect(canUseMockExamSubscription("enterprise", "trialing")).toBe(true);
    expect(canUseMockExamSubscription("pro", "past_due")).toBe(false);
    expect(canUseMockExamSubscription("enterprise", "unpaid")).toBe(false);
    expect(canUseMockExamSubscription("builder", "active")).toBe(false);
  });
});
