import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  getCohortGroupParticipantCampaignPath,
  getParticipantAudienceHandoff,
} from "../client/src/lib/courseParticipantEmailHandoff";

const dashboardSource = readFileSync(
  new URL("../client/src/pages/marketing/EmailCampaignDashboard.tsx", import.meta.url),
  "utf8",
);
const editorSource = readFileSync(
  new URL("../client/src/pages/EmailCampaignEditor.tsx", import.meta.url),
  "utf8",
);
const courseBuilderSource = readFileSync(
  new URL("../client/src/pages/lms/CourseBuilderPage.tsx", import.meta.url),
  "utf8",
);
const legacyCourseBuilderSource = readFileSync(
  new URL("../client/src/pages/admin/LMSAdmin.tsx", import.meta.url),
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

describe("cohort participant email campaign handoff", () => {
  it("uses only a cohort group identifier and starts with active accounts", () => {
    expect(getCohortGroupParticipantCampaignPath(456)).toBe("/marketing/email?cohortGroupId=456");
    expect(getParticipantAudienceHandoff("?cohortGroupId=456")).toEqual({
      activeAccessCourseIds: [],
      inCohortGroupIds: [456],
      workshopInstanceIds: [],
      userStatus: "active",
    });
  });

  it("rejects malformed, unsafe, and conflicting participant route hints", () => {
    for (const search of [
      "",
      "?cohortGroupId=0",
      "?cohortGroupId=-1",
      "?cohortGroupId=2.5",
      "?cohortGroupId=abc",
      "?cohortGroupId=9007199254740992",
      "?courseId=42&cohortGroupId=456",
      "?cohortGroupId=456&workshopInstanceId=789",
    ]) {
      expect(getParticipantAudienceHandoff(search)).toBeNull();
    }
    expect(() => getCohortGroupParticipantCampaignPath(0)).toThrow("A valid cohort group is required");
  });

  it("keeps the cohort prefill narrow and retains server-side ownership enforcement", () => {
    for (const source of [courseBuilderSource, legacyCourseBuilderSource]) {
      expect(source).toContain("getCohortGroupParticipantCampaignPath(group.id)");
      expect(source).toContain("Email Active Participants");
      expect(source).not.toContain("prefillEmails");
    }
    expect(dashboardSource).toContain("getParticipantAudienceHandoff");
    expect(dashboardSource).toContain("initialAudienceFilter={initialAudienceFilter}");
    expect(editorSource).toContain("initialAudienceFilter?: ParticipantAudienceHandoff");
    expect(routerSource).toContain("async function validateAudienceCohortGroupsForOrg");
    expect(routerSource).toContain("One or more selected cohort groups do not belong to the active organization.");
    expect(routerSource).toContain("await validateAudienceCohortGroupsForOrg(db, filter, orgId);");
  });

  it("resolves only group members with active course enrollments", () => {
    expect(audienceResolverSource).toContain("eq(lmsEnrollments.id, lmsCohortGroupEnrollments.enrollmentId)");
    expect(audienceResolverSource).toContain('eq(lmsEnrollments.status, "active")');
  });
});
