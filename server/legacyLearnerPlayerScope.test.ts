import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolveCourseTheme } from "../shared/courseTheme";

describe("Course360 legacy learner player scope", () => {
  const routerSource = readFileSync(new URL("./lmsRouter.ts", import.meta.url), "utf8");
  const playerSource = readFileSync(new URL("../client/src/pages/lms/CoursePlayerPage.tsx", import.meta.url), "utf8");

  it("binds numeric legacy course routes to the server-resolved active organization", () => {
    const helperStart = routerSource.indexOf("async function requireLegacyCourseInActiveOrg");
    const helperEnd = routerSource.indexOf("async function requireLegacyCourseAccess", helperStart);
    const helper = routerSource.slice(helperStart, helperEnd);

    expect(helper).toContain("getOrgIdForUserWithFallback(ctx.user.id, ctx.user.role)");
    expect(helper).toContain("course.orgId !== activeOrgId");
    expect(helper).toContain("Switch to this course's organization before accessing it.");

    const learnerHelperStart = routerSource.indexOf("async function requireLegacyCourseLearnerAccess");
    const learnerHelperEnd = routerSource.indexOf("async function requireLegacyWorkshopAccess", learnerHelperStart);
    const learnerHelper = routerSource.slice(learnerHelperStart, learnerHelperEnd);
    expect(learnerHelper).toContain("requireLegacyCourseInActiveOrg(ctx, courseId)");
    expect(learnerHelper).toContain("enrollment?.isActive && enrollment.orgId === course.orgId");
  });

  it("uses the learner access guard for both the historical player course and curriculum reads", () => {
    const coursesStart = routerSource.indexOf("courses: router({");
    const curriculumStart = routerSource.indexOf("curriculum: router({", coursesStart);
    const courses = routerSource.slice(coursesStart, curriculumStart);
    const curriculum = routerSource.slice(curriculumStart, routerSource.indexOf("pricing: router({", curriculumStart));

    expect(courses).toContain("const course = await requireLegacyCourseLearnerAccess(ctx, input.id)");
    expect(courses).toContain("resolvedCourseTheme: resolveCourseTheme(course, organizationTheme)");
    expect(curriculum).toContain("await requireLegacyCourseLearnerAccess(ctx, input.courseId)");
  });

  it("keeps the legacy player palette tied to its authorized course response, not a browser-selected organization", () => {
    expect(playerSource).toContain("course?.resolvedCourseTheme?.playerColor");
    expect(playerSource).not.toContain("trpc.lms.themes.get.useQuery");
    expect(playerSource).toContain("trpc.cme.getCmeStatus.useQuery({}");
    expect(playerSource).not.toContain("getCmeStatus.useQuery({ orgId:");
    expect(playerSource).toContain("Do not fetch a theme by a browser");
  });

  it("uses the owning organization learner palette when the course is configured to inherit it", () => {
    const palette = resolveCourseTheme(
      { inheritOrganizationTheme: true, primaryColor: "#111111", playerColor: "#222222" },
      { studentPrimaryColor: "#0a9eaa", studentAccentColor: "#08717a", studentTheme: "dark" },
    );

    expect(palette).toMatchObject({
      source: "organization",
      primaryColor: "#0a9eaa",
      playerColor: "#0a9eaa",
      playerTheme: "dark",
    });
  });
});
