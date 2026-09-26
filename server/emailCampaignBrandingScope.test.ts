import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routerSource = readFileSync(
  new URL("./routers/emailCampaignRouter.ts", import.meta.url),
  "utf8",
);
const editorSource = readFileSync(
  new URL("../client/src/pages/EmailCampaignEditor.tsx", import.meta.url),
  "utf8",
);
const appSource = readFileSync(
  new URL("../client/src/App.tsx", import.meta.url),
  "utf8",
);

describe("email campaign organization branding", () => {
  it("derives delivery branding from the active organization rather than client input", () => {
    expect(routerSource).toContain("const orgId = await requireActiveEmailMarketingOrg(ctx.user);");
    expect(routerSource).toContain("schoolName: orgThemes.schoolName");
    expect(routerSource).toContain("adminLogoUrl: orgThemes.adminLogoUrl");
    expect(routerSource).toContain("logoUrl: organizations.logoUrl");
    expect(routerSource).toContain('const displayName = theme?.schoolName?.trim() || organization?.name || "Course360™";');
    expect(routerSource).toContain("getCampaignBranding: protectedProcedure.query");
  });

  it("wraps each server-persisted campaign form with organization branding", () => {
    const brandedWriteCount = (routerSource.match(/buildCampaignHtmlForOrganization\(input\.htmlBody, input\.previewText, orgContext/g) ?? []).length;
    expect(brandedWriteCount).toBe(3);
    expect(routerSource).toContain("wrapInBrandedCampaignEmail(");
    expect(routerSource).toContain("orgContext.displayName");
    expect(routerSource).toContain("orgContext.logoUrl");
  });

  it("uses the same server-derived branding for the editor preview while retaining Course360 only before branding is available", () => {
    expect(editorSource).toContain("trpc.emailCampaign.getCampaignBranding.useQuery");
    expect(editorSource).toContain("wrapInBrandedEmail(htmlBody, previewText, campaignBranding)");
    expect(editorSource).toContain("wrapInBrandedCampaignEmail");
    expect(editorSource).not.toContain("CREATE. TEACH. GROW.");
  });

  it("passes the route campaign ID to the organization-scoped editor in both admin shells", () => {
    const editRouteCount = (appSource.match(/<EmailCampaignEditor campaignId=\{Number\(params\.campaignId\)\} \/>/g) ?? []).length;
    expect(editRouteCount).toBe(2);
  });
});
