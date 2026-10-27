import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const getDb = vi.hoisted(() => vi.fn());
const getOrgIdForUserWithFallback = vi.hoisted(() => vi.fn());
const getEnrolledCoursesForUser = vi.hoisted(() => vi.fn());

vi.mock("./db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./db")>()),
  getDb,
  getOrgIdForUserWithFallback,
}));

vi.mock("./lmsDb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./lmsDb")>()),
  getEnrolledCoursesForUser,
}));

const { lmsRouter } = await import("./lmsRouter");

function publicScopeDb(rows: unknown[][]) {
  const next = () => rows.shift() ?? [];
  const chain: any = {
    from: () => chain,
    where: () => chain,
    limit: async () => next(),
  };
  return { select: () => chain };
}

function caller(host = "course360.app") {
  return lmsRouter.createCaller({
    user: { id: 101, role: "member", email: "learner@example.test" },
    req: { hostname: host, headers: { host }, socket: {} },
  } as any);
}

describe("Course360 legacy learner dashboard organization scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOrgIdForUserWithFallback.mockResolvedValue(7);
    getDb.mockResolvedValue(publicScopeDb([[{ id: 7, slug: "current-school" }]]));
    getEnrolledCoursesForUser.mockResolvedValue([
      { enrollmentId: 301, courseId: 41, orgId: 7, title: "Current school course" },
    ]);
  });

  it("lists learner course cards only for the server-resolved active organization", async () => {
    await expect(caller().dashboard.enrolledCourses()).resolves.toEqual([
      expect.objectContaining({ enrollmentId: 301, orgId: 7 }),
    ]);

    expect(getOrgIdForUserWithFallback).toHaveBeenCalledWith(101, "member");
    expect(getEnrolledCoursesForUser).toHaveBeenCalledWith(101, 7);
  });

  it("applies the same active-organization isolation to the retained myEnrollments procedure", async () => {
    await caller().enrollments.myEnrollments();
    expect(getEnrolledCoursesForUser).toHaveBeenCalledWith(101, 7);
  });

  it("rejects a stale shared session on another school's learner hostname before listing enrollments", async () => {
    getDb.mockResolvedValue(publicScopeDb([[{ id: 8, slug: "other-school" }]]));

    await expect(caller("other-school.course360.app").dashboard.enrolledCourses())
      .rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "This learner dashboard belongs to another organization. Sign in at that school's domain or switch organizations.",
      });
    expect(getEnrolledCoursesForUser).not.toHaveBeenCalled();
  });

  it("keeps database filtering, host mismatch rejection, and the school route hint in the protected contract", () => {
    const dbSource = readFileSync(new URL("./lmsDb.ts", import.meta.url), "utf8");
    const routerSource = readFileSync(new URL("./lmsRouter.ts", import.meta.url), "utf8");
    const pageSource = readFileSync(new URL("../client/src/pages/lms/SchoolMyCoursesPage.tsx", import.meta.url), "utf8");

    const helperStart = dbSource.indexOf("export async function getEnrolledCoursesForUser");
    const helper = dbSource.slice(helperStart, dbSource.indexOf("// ─── LMS Analytics", helperStart));
    expect(helper).toContain("userId: number, orgId: number");
    expect(helper).toContain("eq(courseEnrollments.orgId, orgId)");
    expect(helper).toContain("eq(courses.orgId, orgId)");

    const dashboardGuardStart = routerSource.indexOf("async function requireLegacyLearnerDashboardOrg");
    const dashboardGuard = routerSource.slice(dashboardGuardStart, routerSource.indexOf("async function requireLegacyWorkshopAccess", dashboardGuardStart));
    expect(dashboardGuard).toContain("getOrgIdForUserWithFallback(ctx.user.id, ctx.user.role)");
    expect(dashboardGuard).toContain("resolvePublicOrganizationScope(db as any, ctx.req, orgSlug)");
    expect(dashboardGuard).toContain("publicScope.id !== activeOrgId");

    expect(pageSource).toContain("const enrollmentQueryInput = useMemo(() => orgSlug ? { orgSlug } : undefined, [orgSlug])");
    expect(pageSource).toContain("enrolledCourses.useQuery(enrollmentQueryInput");
  });
});
