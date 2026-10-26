import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canPreviewNonPublicCourseInActiveOrg } from "./lib/courseVisibility";

describe("Course360 non-public course visibility", () => {
  it("allows a non-public preview only for an administrator in the owning active organization", () => {
    expect(canPreviewNonPublicCourseInActiveOrg({
      role: "org_admin",
      activeOrgId: 11,
      courseOrgId: 11,
    })).toBe(true);

    expect(canPreviewNonPublicCourseInActiveOrg({
      role: "site_owner",
      activeOrgId: 12,
      courseOrgId: 11,
    })).toBe(false);
    expect(canPreviewNonPublicCourseInActiveOrg({
      role: "member",
      activeOrgId: 11,
      courseOrgId: 11,
    })).toBe(false);
    expect(canPreviewNonPublicCourseInActiveOrg({
      role: "org_admin",
      activeOrgId: null,
      courseOrgId: 11,
    })).toBe(false);
  });

  it("enforces the active organization on legacy course-settings mutations", () => {
    const source = readFileSync(new URL("./routers/lmsRouter.ts", import.meta.url), "utf8");
    const legacySettings = source.slice(
      source.indexOf("updateCourseEnrollmentEmail: protectedProcedure"),
      source.indexOf("// ── Certificate Templates"),
    );

    expect(legacySettings).toContain('message: "Course not found in the active organization"');
    expect(legacySettings).toContain("getOrgIdForUserWithFallback(ctx.user.id, ctx.user.role)");
    expect(legacySettings).toContain("requireOrgAdmin(ctx.user.id, ctx.user.role, activeOrgId)");
    expect(legacySettings).toContain("eq(lmsCourses.orgId, orgId)");
    expect(legacySettings).not.toContain(".where(eq(lmsCourses.id, input.courseId));");
  });

  it("does not let any admin role bypass the selected organization for draft, archived, or private previews", () => {
    const source = readFileSync(new URL("./routers/lmsRouter.ts", import.meta.url), "utf8");
    const publicRouter = source.slice(
      source.indexOf("export const lmsPublicRouter"),
      source.indexOf("export const lmsLearnerRouter"),
    );

    expect(publicRouter).toContain("canPreviewNonPublicCourseInActiveOrg");
    expect(publicRouter).toContain("getOrgIdForUserWithFallback(ctx.user.id, ctx.user.role)");
    expect(publicRouter).toContain("course.status === \"private\"");
    expect(publicRouter).toContain('throw new TRPCError({ code: "NOT_FOUND" })');
  });
});
