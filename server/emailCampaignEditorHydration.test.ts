import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AudienceFilterSchema } from "../shared/emailCampaignAudience";

const editorSource = readFileSync(
  new URL("../client/src/pages/EmailCampaignEditor.tsx", import.meta.url),
  "utf8",
);
const routerSource = readFileSync(
  new URL("./routers/emailCampaignRouter.ts", import.meta.url),
  "utf8",
);

describe("email campaign editor draft hydration", () => {
  it("loads saved campaign data only through the active-organization getCampaign query", () => {
    expect(editorSource).toContain("trpc.emailCampaign.getCampaign.useQuery");
    expect(editorSource).toContain("enabled: !!user && !!campaignId");
    expect(editorSource).toContain("setBlocks(parseCampaignBlocks(campaign.blocksJson, campaign.htmlBody ?? \"\"))");
    expect(editorSource).toContain("setFilter(parseCampaignAudienceFilter(campaign.audienceFilter))");
    expect(routerSource).toContain("return requireCampaignForOrg(db, input.id, orgId);");
  });

  it("persists editable block state for drafts, immediate sends, and scheduled sends", () => {
    const serializationCount = (editorSource.match(/blocksJson: JSON\.stringify\(blocks\)/g) ?? []).length;
    expect(serializationCount).toBe(3);
    expect(editorSource).toContain("function parseCampaignBlocks(blocksJson: string | null, htmlBody: string): Block[]");
    expect(editorSource).toContain("function parseCampaignAudienceFilter(raw: string | null): AudienceFilter");
  });

  it("continues to accept a scoped workshop audience when restoring a saved campaign", () => {
    const parsed = AudienceFilterSchema.safeParse({
      userStatus: "active",
      workshopInstanceIds: [789],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.workshopInstanceIds).toEqual([789]);
      expect(parsed.data.userStatus).toBe("active");
    }
  });
});
