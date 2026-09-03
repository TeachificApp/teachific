import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

function findActiveSourceMatches(pattern: string): string {
  try {
    return execFileSync(
      "git",
      ["grep", "-inE", pattern, "--", "client/src", "server", "shared", ":!*.test.ts"],
      { cwd: process.cwd(), encoding: "utf8" },
    ).trim();
  } catch (error: any) {
    if (error.status === 1) return "";
    throw error;
  }
}

describe("Course360 dedicated text-to-speech exclusion", () => {
  it("keeps dedicated read-aloud, browser speech synthesis, and server text-to-speech features out of active source", () => {
    const matches = findActiveSourceMatches("read[- ]?aloud|text[- ]?to[- ]?speech|speechSynthesis|speech\.speak|\\btts\\b");
    expect(matches).toBe("");
  });
});
