import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  getParticipantAudienceHandoff,
  getWorkshopInstanceParticipantCampaignPath,
} from "../client/src/lib/courseParticipantEmailHandoff";

const workshopAdminSource = readFileSync(
  new URL("../client/src/pages/admin/WorkshopsAdmin.tsx", import.meta.url),
  "utf8",
);
const dashboardSource = readFileSync(
  new URL("../client/src/pages/marketing/EmailCampaignDashboard.tsx", import.meta.url),
  "utf8",
);
const editorSource = readFileSync(
  new URL("../client/src/pages/EmailCampaignEditor.tsx", import.meta.url),
  "utf8",
);
const routerSource = readFileSync(
  new URL("./routers/emailCampaignRouter.ts", import.meta.url),
  "utf8",
);
const audienceResolverSource = readFileSync(
  new URL("./lib/emailCampaignAudienceResolver.ts", import.meta.url),
  "utf8",
);

describe("workshop participant email campaign handoff", () => {
  it("uses only a workshop instance identifier and starts with active accounts", () => {
    expect(getWorkshopInstanceParticipantCampaignPath(789)).toBe("/marketing/email?workshopInstanceId=789");
    expect(getParticipantAudienceHandoff("?workshopInstanceId=789")).toEqual({
      activeAccessCourseIds: [],
      inCohortGroupIds: [],
      workshopInstanceIds: [789],
      userStatus: "active",
    });
  });

  it("rejects malformed, unsafe, and conflicting workshop participant route hints", () => {
    for (const search of [
      "?workshopInstanceId=0",
      "?workshopInstanceId=-1",
      "?workshopInstanceId=1.5",
      "?workshopInstanceId=abc",
      "?workshopInstanceId=9007199254740992",
      "?workshopInstanceId=789&courseId=42",
    ]) {
      expect(getParticipantAudienceHandoff(search)).toBeNull();
    }
    expect(() => getWorkshopInstanceParticipantCampaignPath(0)).toThrow("A valid workshop instance is required");
  });

  it("keeps the workshop prefill narrow and preserves active-organization authorization", () => {
    expect(workshopAdminSource).toContain("getWorkshopInstanceParticipantCampaignPath(inst.id)");
    expect(workshopAdminSource).toContain("Email Active Participants");
    expect(workshopAdminSource).not.toContain("prefillEmails");
    expect(dashboardSource).toContain("getParticipantAudienceHandoff");
    expect(editorSource).toContain("workshopInstanceIds: number[];");
    expect(editorSource).toContain('MultiSelect label="Workshop Instance"');
    expect(editorSource).toContain("options.workshopInstances");
    expect(routerSource).toContain("async function validateAudienceWorkshopsForOrg");
    expect(routerSource).toContain("One or more selected workshop instances do not belong to the active organization.");
    expect(routerSource).toContain("await validateAudienceWorkshopsForOrg(db, filter, orgId);");
  });

  it("filters both workshop-level and instance-level campaign audiences to active enrollments", () => {
    const activeEnrollmentChecks = audienceResolverSource.match(/eq\(workshopEnrollments\.status, "active"\)/g) ?? [];
    expect(activeEnrollmentChecks).toHaveLength(2);
    expect(audienceResolverSource).toContain("inArray(workshopEnrollments.instanceId, filter.workshopInstanceIds!)");
  });
});
