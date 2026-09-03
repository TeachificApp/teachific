import { describe, expect, it } from "vitest";
import { validateImageComparisonQuestions } from "./lib/imageComparisonQuestion";

describe("Course360 image-comparison question validation", () => {
  const question = {
    id: "compare-1",
    type: "image_comparison",
    data: {
      comparisonImageA: "https://cdn.example.test/a.png",
      comparisonImageB: "https://cdn.example.test/b.png",
      comparisonLabelA: "Before",
      comparisonLabelB: "After",
    },
  };

  it("allows incomplete comparison-image drafts but requires both images for public publication", () => {
    const draft = { ...question, data: { ...question.data, comparisonImageB: "" } };
    expect(validateImageComparisonQuestions(JSON.stringify([draft]))).toBeNull();
    expect(validateImageComparisonQuestions(JSON.stringify([draft]), true)).toBe("Add both comparison images before publishing an image-comparison question.");
  });

  it("accepts complete comparison configurations and rejects malformed labels", () => {
    expect(validateImageComparisonQuestions(JSON.stringify([question]), true)).toBeNull();
    const malformed = { ...question, data: { ...question.data, comparisonLabelA: 42 } };
    expect(validateImageComparisonQuestions(JSON.stringify([malformed]))).toBe("Image-comparison image labels must be text.");
  });
});
