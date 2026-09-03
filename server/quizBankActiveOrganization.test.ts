import { describe, expect, it } from "vitest";
import { assertActiveQuizBankOrganization } from "./lib/quizBankActiveOrganization";

describe("Quiz Bank active organization guard", () => {
  it("allows a Question Bank only in the server-resolved active organization", () => {
    expect(() => assertActiveQuizBankOrganization(42, 42)).not.toThrow();
  });

  it("rejects a different organization bank even when an administrator could otherwise have access", () => {
    expect(() => assertActiveQuizBankOrganization(42, 77)).toThrow("not available in the active organization");
  });

  it("fails closed without an active organization", () => {
    expect(() => assertActiveQuizBankOrganization(undefined, 42)).toThrow("not available in the active organization");
  });
});
