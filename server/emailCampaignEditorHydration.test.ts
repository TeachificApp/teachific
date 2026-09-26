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
    expect(editorSource).toContain("setHeaderTitle(campaign.headerTitle ?? \"\")");
    expect(editorSource).toContain("setHeaderSubtext(campaign.headerSubtext ?? \"\")");
    expect(editorSource).toContain("setHeaderColor(campaign.headerColor ?? \"\")");
    expect(editorSource).toContain("setHeaderEnabled(campaign.headerEnabled ?? true)");
    expect(routerSource).toContain("return requireCampaignForOrg(db, input.id, orgId);");
  });

  it("persists editable block state for drafts, immediate sends, and scheduled sends", () => {
    const serializationCount = (editorSource.match(/blocksJson: JSON\.stringify\(blocks\)/g) ?? []).length;
    expect(serializationCount).toBeGreaterThanOrEqual(3);
    const headerEnabledCount = (editorSource.match(/headerEnabled,/g) ?? []).length;
    expect(headerEnabledCount).toBeGreaterThanOrEqual(4);
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

  it("debounces draft-only autosave after protected hydration and clears timers on unmount", () => {
    expect(editorSource).toContain("const isAutosaveEligible = Boolean(");
    expect(editorSource).toContain("if (!isAutosaveEligible) return;");
    expect(editorSource).toContain("saveModeRef.current = \"autosave\"");
    expect(editorSource).toContain("saveDraftMutation.mutate(draftPayload);");
    expect(editorSource).toContain("}, 900);");
    expect(editorSource).toContain("if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);");
    expect(editorSource).toContain("disabled={isScheduledCampaign || isSaving || saveDraftMutation.isPending}");
    expect(editorSource).toContain("const isWaitingForExistingCampaign = Boolean(");
    expect(editorSource).toContain("Loading campaign draft…");
    expect(editorSource).not.toContain("sendMutation.mutate(draftPayload)");
    expect(editorSource).not.toContain("scheduleMutation.mutate(draftPayload)");
  });
});
