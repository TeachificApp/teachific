import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");

describe("past public offering lifecycle", () => {
  it("removes ended workshop instances from learner enrollment choices", () => {
    const router = source("server/routers/workshopRouter.ts");
    expect(router).toContain("const visibleInstances = allInstances.filter");
    expect(router).toContain("const end = instance.endDate ?? instance.startDate");
    expect(router).toContain("allInstances: visibleInstances.map(toPublicWorkshopInstance)");
  });

  it("hides ended cohort groups and sessions from public course delivery", () => {
    const router = source("server/routers/lmsRouter.ts");
    expect(router).toContain("const visibleCohortGroups = cohortGroupsRaw.filter");
    expect(router).toContain("const end = group.endDate ?? group.startDate");
    expect(router).toContain("const visibleCohortSessions = cohortSessions.filter");
    expect(router).toContain("cohortGroups: visibleCohortGroups.map(toPublicCohortGroup)");
  });

  it("keeps capacity, enrollment counts, and learner meeting links out of public course responses", () => {
    const router = source("server/routers/lmsRouter.ts");
    const getCourse = router.slice(router.indexOf("getCourse: publicProcedure"), router.indexOf("/** Get instructor public profile"));
    expect(getCourse).not.toContain("meetingUrl: lmsCohortSessions.meetingUrl");
    expect(getCourse).toContain("const { maxStudents: _maxStudents, enrollmentCount: _enrollmentCount");
  });
});
