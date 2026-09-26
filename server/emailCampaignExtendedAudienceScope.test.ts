import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AudienceFilterSchema } from "../shared/emailCampaignAudience";

const routerSource = readFileSync(new URL("./routers/emailCampaignRouter.ts", import.meta.url), "utf8");
const editorSource = readFileSync(new URL("../client/src/pages/EmailCampaignEditor.tsx", import.meta.url), "utf8");

describe("Course360 extended campaign audience scope", () => {
  it("accepts the existing additional resource dimensions through the canonical shared contract", () => {
    const parsed = AudienceFilterSchema.parse({
      enrolledInQuizIds: [11],
      completedQuizIds: [12],
      activeAccessQuizIds: [13],
      freePreviewQuizIds: [14],
      purchasedQuizIds: [15],
      inGroupIds: [21],
      submittedFormIds: [22],
      purchasedProductIds: [23],
      downloadedProductIds: [24],
      purchasedDigitalBundleIds: [25],
      purchasedPhysicalProductIds: [26],
      communityIds: [27],
    });
    expect(parsed.enrolledInQuizIds).toEqual([11]);
    expect(parsed.purchasedPhysicalProductIds).toEqual([26]);
  });

  it("validates each resource against the server-resolved active organization before resolver access", () => {
    expect(routerSource).toContain("async function validateAudienceAdditionalResourcesForOrg");
    expect(routerSource).toContain("eq(lmsGroups.orgId, orgId)");
    expect(routerSource).toContain("eq(generalFormTemplates.orgId, orgId)");
    expect(routerSource).toContain("eq(digitalProducts.orgId, orgId)");
    expect(routerSource).toContain("eq(digitalBundles.orgId, orgId)");
    expect(routerSource).toContain("eq(physicalProducts.orgId, orgId)");
    expect(routerSource).toContain("eq(communitySpaces.orgId, orgId)");
    expect(routerSource).toContain("await validateAudienceAdditionalResourcesForOrg(db, filter, orgId);");
    expect(routerSource).toContain("eq(lmsCourses.type, \"quiz\")");
    expect(routerSource).toContain("One or more selected quizzes do not belong to the active organization.");
  });

  it("surfaces only options returned by the protected active-organization endpoint", () => {
    for (const label of [
      "Free Course Preview",
      "Purchased Course",
      "Enrolled in Quiz",
      "Completed Quiz",
      "Active Quiz Access",
      "Free Quiz Preview",
      "Purchased Quiz",
      "Purchased Physical Product",
      "Purchased Digital Bundle",
    ]) {
      expect(editorSource).toContain(`label="${label}"`);
    }
    expect(editorSource).toContain("options.quizzes");
    expect(editorSource).toContain("options.physicalProducts");
    expect(editorSource).toContain("options.digitalBundles");
  });
});
