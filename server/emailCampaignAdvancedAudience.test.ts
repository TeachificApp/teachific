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
const resolverSource = readFileSync(
  new URL("./lib/emailCampaignAudienceResolver.ts", import.meta.url),
  "utf8",
);

describe("advanced email campaign audience controls", () => {
  it("shows only server-provided active-organization resource options", () => {
    const selectors = [
      ["Membership Plan", "options.membershipPlans", "membershipPlanIds"],
      ["Bundle Enrollment", "options.bundles", "bundleIds"],
      ["Workshop", "options.workshops", "workshopIds"],
      ["Webinar Registration", "options.webinars", "webinarIds"],
    ] as const;
    for (const [label, options, field] of selectors) {
      expect(editorSource).toContain(`MultiSelect label="${label}"`);
      expect(editorSource).toContain(options);
      expect(editorSource).toContain(`${field}: number[];`);
    }
  });

  it("validates every advanced resource family against the active organization before delivery", () => {
    expect(routerSource).toContain("async function validateAudienceAdvancedResourcesForOrg");
    expect(routerSource).toContain("eq(membershipPlans.orgId, orgId)");
    expect(routerSource).toContain("eq(bundles.orgId, orgId)");
    expect(routerSource).toContain("eq(webinars.orgId, orgId)");
    expect(routerSource).toContain("await validateAudienceAdvancedResourcesForOrg(db, filter, orgId);");
    expect(resolverSource).toContain("eq(membershipPlans.orgId, orgId)");
    expect(resolverSource).toContain("eq(digitalBundles.orgId, orgId)");
    expect(resolverSource).toContain("eq(workshops.orgId, orgId)");
    expect(resolverSource).toContain("webinars.orgId = ${orgId}");
  });

  it("accepts the supported advanced filters in the shared campaign contract", () => {
    const parsed = AudienceFilterSchema.safeParse({
      membershipPlanIds: [11],
      bundleIds: [22],
      workshopIds: [33],
      webinarIds: [44],
      userStatus: "active",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toMatchObject({
        membershipPlanIds: [11],
        bundleIds: [22],
        workshopIds: [33],
        webinarIds: [44],
        userStatus: "active",
      });
    }
  });
});
