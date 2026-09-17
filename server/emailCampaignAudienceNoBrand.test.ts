import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AudienceFilterSchema, DEFAULT_AUDIENCE_FILTER } from "../shared/emailCampaignAudience";

const resolverSource = readFileSync(new URL("./lib/emailCampaignAudienceResolver.ts", import.meta.url), "utf8");

describe("Course360 campaign audience brand exclusion", () => {
  it("drops legacy source-brand filter values rather than targeting legacy memberships", () => {
    const parsed = AudienceFilterSchema.parse({ brands: ["aaus", "iheartecho"] } as any);
    expect(parsed).not.toHaveProperty("brands");
    expect(DEFAULT_AUDIENCE_FILTER).not.toHaveProperty("brands");
  });

  it("does not resolve campaign recipients through source-brand membership records", () => {
    expect(resolverSource).not.toContain("brandMemberships");
    expect(resolverSource).not.toContain('dimension === "brands"');
    expect(resolverSource).not.toContain("filter.brands");
  });
});
