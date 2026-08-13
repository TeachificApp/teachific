import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isStaleAssetError } from "../client/src/components/ErrorBoundary";
import { mapQuestionType, parseBlocks } from "./lib/lessonQuizQuestionBankSync";

describe("latest Ultrasound-App learning feature port", () => {
  it("recognizes HTML returned in place of a Quiz Creator JavaScript module", () => {
    expect(isStaleAssetError(new Error("'text/html' is not a valid JavaScript MIME type."))).toBe(true);
    expect(isStaleAssetError(new Error("Loading chunk 42 failed"))).toBe(true);
    expect(isStaleAssetError(new Error("ordinary validation error"))).toBe(false);
  });

  it("maps lesson quiz question variants into supported Question Bank types", () => {
    expect(mapQuestionType("multiple_choice")).toBe("mcq");
    expect(mapQuestionType("true_false")).toBe("tf");
    expect(mapQuestionType("multiselect")).toBe("multiple_select");
    expect(mapQuestionType("drag_sort")).toBe("ordering");
    expect(mapQuestionType("fill_blank")).toBe("fill_blank");
  });

  it("accepts only serialized block arrays for page-builder lesson quiz synchronization", () => {
    expect(parseBlocks('[{"id":"quiz-1","type":"lesson_quiz"}]')).toHaveLength(1);
    expect(parseBlocks('{"type":"lesson_quiz"}')).toEqual([]);
    expect(parseBlocks("not JSON")).toEqual([]);
    expect(parseBlocks(null)).toEqual([]);
  });

  it("enforces org-owned waitlist and enrollment-closed states before creating a course enrollment", () => {
    const routerSource = readFileSync(new URL("./lmsRouter.ts", import.meta.url), "utf8");
    expect(routerSource).toContain('eq(contentAvailability.productType, "course")');
    expect(routerSource).toContain('availability?.status === "waitlist"');
    expect(routerSource).toContain('availability?.status === "enrollment_closed"');
    expect(routerSource).toContain("orgId: course.orgId");
  });
});
