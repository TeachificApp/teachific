import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { resolveCourseTheme } from "../shared/courseTheme";

const root = path.resolve(__dirname, "..");
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("Course360 course appearance inheritance", () => {
  const organizationTheme = {
    primaryColor: "#124455",
    accentColor: "#1a7788",
    buttonColor: "#0f6677",
    studentPrimaryColor: "#0d8f99",
    studentAccentColor: "#075965",
    studentTheme: "dark",
  } as const;

  it("uses only the owning organization learner palette when inheritance is enabled", () => {
    expect(resolveCourseTheme({
      inheritOrganizationTheme: true,
      primaryColor: "#111111",
      accentColor: "#222222",
      playerColor: "#333333",
    }, organizationTheme)).toEqual(expect.objectContaining({
      source: "organization",
      primaryColor: "#0d8f99",
      accentColor: "#075965",
      playerColor: "#0d8f99",
      playerTheme: "dark",
      gradientFrom: null,
      gradientTo: null,
    }));
  });

  it("keeps a saved per-course palette as an explicit override", () => {
    expect(resolveCourseTheme({
      inheritOrganizationTheme: false,
      primaryColor: "#111111",
      accentColor: "#222222",
      gradientFrom: "#333333",
      gradientTo: "#444444",
      gradientDirection: "to right",
      playerColor: "#555555",
      playerTheme: "dark",
    }, organizationTheme)).toEqual({
      source: "course",
      primaryColor: "#111111",
      accentColor: "#222222",
      gradientFrom: "#333333",
      gradientTo: "#444444",
      gradientDirection: "to right",
      playerColor: "#555555",
      playerTheme: "dark",
    });
  });

  it("defaults legacy courses to the organization learner palette without erasing stored overrides", () => {
    expect(resolveCourseTheme({ primaryColor: "#179ca3", accentColor: "#0d9488" }, organizationTheme))
      .toEqual(expect.objectContaining({ source: "course", primaryColor: "#179ca3" }));
    expect(read("drizzle/0102_lms_course_org_theme_inheritance.sql"))
      .toContain("UPDATE `lms_courses`");
    expect(read("drizzle/0102_lms_course_org_theme_inheritance.sql"))
      .toContain("SET `inherit_organization_theme` = false");
  });

  it("persists the option through the active organization-owned Course Builder endpoint", () => {
    const router = read("server/routers/lmsCourseBuilderRouter.ts");
    const builder = read("client/src/pages/lms/CourseBuilderPage.tsx");
    expect(router).toContain("inheritOrganizationTheme: z.boolean().optional()");
    expect(router).toContain("await assertCourseOwnership(ctx, input.id)");
    expect(builder).toContain("Use organization learner theme");
    expect(builder).toContain("inheritOrganizationTheme,");
  });

  it("returns resolved palettes only from public or active-org learner course procedures", () => {
    const router = read("server/routers/lmsRouter.ts");
    expect(router).toContain("resolvedCourseTheme: resolveCourseTheme(course, organizationTheme");
    expect(router).toContain("eq(lmsCourses.orgId, activeOrgId)");
    expect(router).toContain("eq(lmsCourseInstructors.orgId, activeOrgId)");
    expect(router).toContain("eq(lmsInstructors.orgId, activeOrgId)");
  });

  it("uses server-resolved palettes in the public landing, learner player, and course overview", () => {
    expect(read("client/src/pages/lms/CourseLanding.tsx")).toContain("const displayCourse = { ...course, ...((course as any).resolvedCourseTheme ?? {}) }");
    expect(read("client/src/pages/lms/CoursePlayer.tsx")).toContain("const course = { ...data.course, ...(data.resolvedCourseTheme ?? {}) }");
    expect(read("client/src/pages/lms/CourseOverview.tsx")).toContain("const course = { ...rawCourse, ...((data as any).resolvedCourseTheme ?? {}) }");
  });
});
