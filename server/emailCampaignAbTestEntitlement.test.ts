import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AudienceFilterSchema, pickAbVariant } from "../shared/emailCampaignAudience";
import {
  EMAIL_CAMPAIGN_AB_TEST_TIERS,
  canUseEmailCampaignAbTests,
} from "./lib/emailCampaignAbTestEntitlement";

const routerSource = readFileSync(new URL("./routers/emailCampaignRouter.ts", import.meta.url), "utf8");
const editorSource = readFileSync(new URL("../client/src/pages/EmailCampaignEditor.tsx", import.meta.url), "utf8");

describe("Course360 organization campaign A/B testing", () => {
  it("allows only active or trialing Pro and Enterprise organizations", () => {
    expect(EMAIL_CAMPAIGN_AB_TEST_TIERS).toEqual(["pro", "enterprise"]);
    expect(canUseEmailCampaignAbTests("pro", "active")).toBe(true);
    expect(canUseEmailCampaignAbTests("enterprise", "trialing")).toBe(true);
    expect(canUseEmailCampaignAbTests("starter", "active")).toBe(false);
    expect(canUseEmailCampaignAbTests("pro", "past_due")).toBe(false);
    expect(canUseEmailCampaignAbTests(undefined, undefined)).toBe(false);
  });

  it("requires two non-empty, unique, 100-percent variants when enabled", () => {
    const valid = AudienceFilterSchema.safeParse({
      abTest: {
        enabled: true,
        variants: [
          { key: "a", weight: 50, subject: "Subject A" },
          { key: "b", weight: 50, subject: "Subject B" },
        ],
      },
    });
    expect(valid.success).toBe(true);
    expect(AudienceFilterSchema.safeParse({ abTest: { enabled: true, variants: [{ key: "a", weight: 100, subject: "Only" }] } }).success).toBe(false);
    expect(AudienceFilterSchema.safeParse({ abTest: { enabled: true, variants: [{ key: "a", weight: 40, subject: "A" }, { key: "a", weight: 40, subject: "B" }] } }).success).toBe(false);
    expect(AudienceFilterSchema.safeParse({ abTest: { enabled: true, variants: [{ key: "a", weight: 50 }, { key: "b", weight: 50, subject: "B" }] } }).success).toBe(false);
  });

  it("keeps assignment stable and applies the configured split", () => {
    const abTest = {
      enabled: true,
      variants: [
        { key: "a", weight: 50, subject: "A" },
        { key: "b", weight: 50, subject: "B" },
      ],
    };
    expect(pickAbVariant("learner@example.test", abTest, 91)?.key)
      .toBe(pickAbVariant("learner@example.test", abTest, 91)?.key);
    expect(pickAbVariant("learner@example.test", abTest, 91)?.key).toMatch(/[ab]/);
  });

  it("enforces entitlement both before recipient resolution and again at delivery", () => {
    expect(routerSource).toContain("async function assertCampaignAbTestEntitlement");
    expect(routerSource).toContain("eq(orgSubscriptions.orgId, orgId)");
    expect(routerSource).toContain("Campaign A/B testing is available on active Pro and Enterprise plans.");
    expect(routerSource).toContain("await assertCampaignAbTestEntitlement(db, filter, orgId);");
    const executionSlice = routerSource.slice(routerSource.indexOf("async function executeCampaignSend"));
    expect(executionSlice).toContain("await assertCampaignAbTestEntitlement(db, filter, campaign.orgId);");
    expect(executionSlice).toContain("buildCampaignHtmlForOrganization(variant.htmlBody");
  });

  it("exposes only server-computed entitlement availability in the editor", () => {
    expect(routerSource).toContain("canUseAbTesting: canUseEmailCampaignAbTests(subscription?.plan, subscription?.status)");
    expect(editorSource).toContain("const canUseAbTesting = Boolean(campaignBranding?.canUseAbTesting);");
    expect(editorSource).toContain('id="campaign-ab-testing"');
    expect(editorSource).toContain("disabled={!canUseAbTesting && !abTest}");
    expect(editorSource).toContain("A/B campaign testing requires an active Pro or Enterprise organization subscription.");
    expect(editorSource).toContain("Variant B updates automatically.");
  });
});
