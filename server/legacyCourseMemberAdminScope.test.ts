import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const getOrgIdForUserWithFallback = vi.hoisted(() => vi.fn());
const requireOrgAdmin = vi.hoisted(() => vi.fn());
const getCoursesByOrg = vi.hoisted(() => vi.fn());
const createCourse = vi.hoisted(() => vi.fn());
const getMembersWithEnrollments = vi.hoisted(() => vi.fn());
const getCourseById = vi.hoisted(() => vi.fn());
const getEnrollment = vi.hoisted(() => vi.fn());
const createEnrollment = vi.hoisted(() => vi.fn());

vi.mock("./db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./db")>()),
  getOrgIdForUserWithFallback,
  requireOrgAdmin,
}));

vi.mock("./lmsDb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./lmsDb")>()),
  getCoursesByOrg,
  createCourse,
  getMembersWithEnrollments,
  getCourseById,
  getEnrollment,
  createEnrollment,
}));

const { lmsRouter } = await import("./lmsRouter");

function caller(role = "org_admin") {
  return lmsRouter.createCaller({
    user: { id: 101, role, email: "admin@example.test" },
    req: { hostname: "course360.app", headers: { host: "course360.app" }, socket: {} },
  } as any);
}

describe("Course360 legacy course and member administration scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOrgIdForUserWithFallback.mockResolvedValue(7);
    requireOrgAdmin.mockResolvedValue(7);
    getCoursesByOrg.mockResolvedValue([{ id: 41, orgId: 7, title: "Current school course" }]);
    createCourse.mockResolvedValue({ id: 42, orgId: 7, title: "New current school course" });
    getMembersWithEnrollments.mockResolvedValue([{ userId: 501, orgId: 7, email: "student@example.test" }]);
    getCourseById.mockResolvedValue({ id: 41, orgId: 7, title: "Current school course" });
    getEnrollment.mockResolvedValue(undefined);
    createEnrollment.mockResolvedValue({ id: 301, courseId: 41, userId: 501, orgId: 7 });
  });

  it("uses the server-resolved active organization for legacy course and member lists", async () => {
    await expect(caller().courses.list({ orgId: 7 })).resolves.toEqual([
      expect.objectContaining({ id: 41, orgId: 7 }),
    ]);
    await expect(caller().members.listWithEnrollments({ orgId: 7 })).resolves.toEqual([
      expect.objectContaining({ userId: 501, orgId: 7 }),
    ]);

    expect(getCoursesByOrg).toHaveBeenCalledWith(7);
    expect(getMembersWithEnrollments).toHaveBeenCalledWith(7);
    expect(requireOrgAdmin).toHaveBeenCalledWith(101, "org_admin", 7);
  });

  it("rejects stale organization hints before any legacy course or member data is read or changed", async () => {
    const requests = [
      () => caller().courses.list({ orgId: 8 }),
      () => caller().courses.create({ orgId: 8, title: "Cross-school course" }),
      () => caller().members.listWithEnrollments({ orgId: 8 }),
      () => caller().members.manualEnroll({ orgId: 8, courseId: 41, userId: 501 }),
      () => caller().members.createAndAdd({ orgId: 8, name: "Other School Student", email: "other@example.test", password: "secure-password" }),
      () => caller().members.bulkImport({ orgId: 8, users: [{ name: "Other School Student", email: "bulk@example.test" }] }),
    ];

    for (const request of requests) {
      await expect(request()).rejects.toMatchObject({ code: "FORBIDDEN" });
    }

    expect(getCoursesByOrg).not.toHaveBeenCalled();
    expect(createCourse).not.toHaveBeenCalled();
    expect(getMembersWithEnrollments).not.toHaveBeenCalled();
    expect(getCourseById).not.toHaveBeenCalled();
    expect(createEnrollment).not.toHaveBeenCalled();
  });

  it("keeps platform administrators bound to their selected active organization for operational school work", async () => {
    await expect(caller("site_admin").courses.create({ orgId: 8, title: "Cross-school course" }))
      .rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "Course administration must use the active organization.",
      });
    await expect(caller("site_admin").members.manualEnroll({ orgId: 8, courseId: 41, userId: 501 }))
      .rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "Member administration must use the active organization.",
      });
  });

  it("keeps course and member orgId values as checked context hints in the protected router", () => {
    const source = readFileSync(new URL("./lmsRouter.ts", import.meta.url), "utf8");
    const courseSource = source.slice(source.indexOf("courses: router({"), source.indexOf("// ── Curriculum"));
    const memberSource = source.slice(source.indexOf("members: router({"), source.indexOf("// ── Email Marketing"));

    expect(source).toContain("async function requireActiveLegacyCourseAdminOrg");
    expect(source).toContain("async function requireActiveLegacyMemberOrg");
    expect(courseSource).toContain("requireActiveLegacyCourseAdminOrg(ctx, input?.orgId)");
    expect(courseSource).toContain("requireActiveLegacyCourseAdminOrg(ctx, input.orgId)");
    expect(memberSource.match(/requireActiveLegacyMemberOrg\(ctx, input\??\.orgId\)/g)?.length).toBeGreaterThanOrEqual(6);
    expect(courseSource).not.toContain("input?.orgId ?? await requireOrgId");
    expect(memberSource).not.toContain("input.orgId ?? await requireOrgId");
  });
});
