import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const editorSource = readFileSync(new URL("../client/src/pages/EmailCampaignEditor.tsx", import.meta.url), "utf8");
const routerSource = readFileSync(new URL("./routers/emailCampaignRouter.ts", import.meta.url), "utf8");

describe("active course participant campaign audiences", () => {
  it("offers an active-access course audience selector", () => {
    expect(editorSource).toContain('type AudienceFilter } from "@shared/emailCampaignAudience"');
    expect(editorSource).toContain("selected={filter.activeAccessCourseIds}");
    expect(editorSource).toContain('label="Active Course Access"');
  });

  it("validates selected course ownership before previewing, saving, scheduling, or sending", () => {
    expect(routerSource).toContain("async function validateAudienceCoursesForOrg");
    expect(routerSource).toContain("...(filter.activeAccessCourseIds ?? [])");
    expect(routerSource).toContain("One or more selected courses do not belong to the active organization.");
    expect(routerSource.match(/await validateAudienceScopeForOrg\(/g)?.length).toBeGreaterThanOrEqual(4);
  });
});
