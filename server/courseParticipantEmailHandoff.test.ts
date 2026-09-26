import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  getCourseParticipantAudienceHandoff,
  getCourseParticipantCampaignPath,
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

describe("course participant email campaign handoff", () => {
  it("uses a narrow course identifier and defaults to active course access", () => {
    expect(getCourseParticipantCampaignPath(42)).toBe("/marketing/email?courseId=42");
    expect(getCourseParticipantAudienceHandoff("?courseId=42")).toEqual({
      activeAccessCourseIds: [42],
      userStatus: "active",
    });
  });

  it("rejects malformed, zero, and unsafe route hints", () => {
    for (const search of ["", "?courseId=0", "?courseId=-1", "?courseId=2.5", "?courseId=abc", "?courseId=9007199254740992"]) {
      expect(getCourseParticipantAudienceHandoff(search)).toBeNull();
    }
    expect(() => getCourseParticipantCampaignPath(0)).toThrow("A valid course is required");
  });

  it("does not put participant emails into browser URLs and retains server-side audience authority", () => {
    for (const source of [courseBuilderSource, legacyCourseBuilderSource]) {
      expect(source).toContain("getCourseParticipantCampaignPath(courseId)");
      expect(source).toContain("Email Active Participants");
      expect(source).not.toContain("prefillEmails");
    }
    expect(dashboardSource).toContain("useLocation, useSearch");
    expect(dashboardSource).toContain("const search = useSearch()");
    expect(dashboardSource).toContain("getParticipantAudienceHandoff");
    expect(dashboardSource).toContain("initialAudienceFilter={initialAudienceFilter}");
    expect(editorSource).toContain("initialAudienceFilter?: ParticipantAudienceHandoff");
    expect(editorSource).toContain("...initialAudienceFilter");
  });
});
