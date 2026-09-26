import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AudienceFilterSchema, DEFAULT_AUDIENCE_FILTER } from "../shared/emailCampaignAudience";

const editorSource = readFileSync(new URL("../client/src/pages/EmailCampaignEditor.tsx", import.meta.url), "utf8");
const routerSource = readFileSync(new URL("./routers/emailCampaignRouter.ts", import.meta.url), "utf8");

describe("organization-scoped list and engagement campaign audiences", () => {
  it("uses the canonical shared audience contract instead of a reduced editor-local filter", () => {
    expect(editorSource).toContain('import { DEFAULT_AUDIENCE_FILTER, type AudienceFilter } from "@shared/emailCampaignAudience";');
    expect(editorSource).not.toContain("interface AudienceFilter {");
    expect(editorSource).toContain("...DEFAULT_AUDIENCE_FILTER");

    const parsed = AudienceFilterSchema.parse({});
    expect(parsed.listIds).toEqual([]);
    expect(parsed.listMode).toBe("intersect");
    expect(parsed.openedCampaignIds).toEqual([]);
    expect(parsed.clickedCampaignIds).toEqual([]);
    expect(DEFAULT_AUDIENCE_FILTER.interestIds).toEqual([]);
  });

  it("exposes only server-provided organization lists and sent campaigns", () => {
    expect(editorSource).toContain('label="Email Lists"');
    expect(editorSource).toContain("options.lists");
    expect(editorSource).toContain('value="only"');
    expect(editorSource).toContain('value="union"');
    expect(editorSource).toContain('value="intersect"');
    expect(editorSource).toContain('label="Opened a Sent Campaign"');
    expect(editorSource).toContain('label="Clicked a Link in a Sent Campaign"');
    expect(editorSource).toContain("options.sentCampaigns");
    expect(routerSource).toContain("WHERE orgId = ${orgId} AND status = 'sent'");
  });

  it("rejects foreign, inactive, or unsent engagement campaign IDs before audience resolution", () => {
    expect(routerSource).toContain("async function validateAudienceEngagementCampaignsForOrg");
    expect(routerSource).toContain("...(filter.openedCampaignIds ?? [])");
    expect(routerSource).toContain("...(filter.clickedCampaignIds ?? [])");
    expect(routerSource).toContain("eq(emailCampaigns.orgId, orgId)");
    expect(routerSource).toContain('eq(emailCampaigns.status, "sent")');
    expect(routerSource).toContain("One or more selected engagement campaigns do not belong to the active organization.");
    expect(routerSource).toContain("await validateAudienceEngagementCampaignsForOrg(db, filter, orgId);");
  });
});
