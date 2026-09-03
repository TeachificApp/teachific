import { describe, expect, it } from "vitest";
import { assertSourceBlindGeneratedContent } from "./lib/publicSourceUrl";

describe("public-source Question Bank output guard", () => {
  const sourceUrl = "https://reference.example.org/learning-topic";

  it("permits source-blind educational assessment text", () => {
    expect(() => assertSourceBlindGeneratedContent(
      "Which finding most directly supports the diagnosis?",
      sourceUrl,
    )).not.toThrow();
  });

  it("rejects source URLs, hostnames, and provenance language", () => {
    expect(() => assertSourceBlindGeneratedContent("See https://reference.example.org/learning-topic", sourceUrl)).toThrow("must not identify");
    expect(() => assertSourceBlindGeneratedContent("According to this source page, select the best answer.", sourceUrl)).toThrow("must not identify");
    expect(() => assertSourceBlindGeneratedContent("The reference.example.org website explains this finding.", sourceUrl)).toThrow("must not identify");
  });
});
