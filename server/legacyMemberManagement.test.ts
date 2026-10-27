import { beforeEach, describe, expect, it, vi } from "vitest";

const getOrgIdForUserWithFallback = vi.hoisted(() => vi.fn());
const requireOrgAdmin = vi.hoisted(() => vi.fn());
const getOrgById = vi.hoisted(() => vi.fn());
const getUserByEmail = vi.hoisted(() => vi.fn());
const getUserById = vi.hoisted(() => vi.fn());
const getOrgMember = vi.hoisted(() => vi.fn());
const addOrgMember = vi.hoisted(() => vi.fn());
const createManualUser = vi.hoisted(() => vi.fn());
const updateOrgMemberRole = vi.hoisted(() => vi.fn());
const getDb = vi.hoisted(() => vi.fn());
const sendEmailViaOrg = vi.hoisted(() => vi.fn());
const getCourseById = vi.hoisted(() => vi.fn());
const getEnrollment = vi.hoisted(() => vi.fn());
const getEnrollmentIncludingInactive = vi.hoisted(() => vi.fn());
const reactivateEnrollment = vi.hoisted(() => vi.fn());
const createEnrollment = vi.hoisted(() => vi.fn());

vi.mock("./db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./db")>()),
  getOrgIdForUserWithFallback,
  requireOrgAdmin,
  getOrgById,
  getUserByEmail,
  getUserById,
  getOrgMember,
  addOrgMember,
  createManualUser,
  updateOrgMemberRole,
  getDb,
}));

vi.mock("./lmsDb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./lmsDb")>()),
  getCourseById,
  getEnrollment,
  getEnrollmentIncludingInactive,
  reactivateEnrollment,
  createEnrollment,
}));

vi.mock("./_core/email", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./_core/email")>()),
  sendEmailViaOrg,
}));

const { lmsRouter } = await import("./lmsRouter");

function caller(role = "org_super_admin") {
  return lmsRouter.createCaller({
    user: { id: 101, role, email: "owner@example.test" },
    req: { hostname: "academy.course360.app", headers: { host: "academy.course360.app" }, socket: {} },
  } as any);
}

function activeOrganization() {
  getOrgIdForUserWithFallback.mockResolvedValue(7);
  requireOrgAdmin.mockResolvedValue(undefined);
  getOrgById.mockResolvedValue({
    id: 7,
    name: "Academy School",
    slug: "academy",
    customDomain: null,
    domainVerificationStatus: null,
  });
}

describe("Course360 scoped legacy Member management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    activeOrganization();
    getCourseById.mockResolvedValue({ id: 41, orgId: 7, title: "Active school course" });
    getEnrollment.mockResolvedValue(undefined);
    getEnrollmentIncludingInactive.mockResolvedValue(undefined);
    reactivateEnrollment.mockResolvedValue({ id: 501, isActive: true });
    createEnrollment.mockResolvedValue({ id: 501, orgId: 7 });
    sendEmailViaOrg.mockResolvedValue(true);
    getDb.mockReturnValue({
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue(undefined),
        })),
      })),
    });
  });

  it("adds an existing identity only to the active organization and enrolls it only in active-school courses", async () => {
    const existingUser = { id: 202, email: "student@example.test", name: "Student" };
    getUserByEmail.mockResolvedValue(existingUser);
    getOrgMember.mockImplementation(async (_orgId: number, userId: number) => {
      if (userId === 101) return { orgId: 7, userId: 101, role: "org_super_admin" };
      if (userId === 202) return undefined;
      return undefined;
    });

    await expect(caller().members.createAndAdd({
      orgId: 7,
      name: "Student",
      email: "student@example.test",
      password: "secure-password",
      role: "user",
      memberSubRole: "instructor",
      courseIds: [41],
    })).resolves.toEqual({ success: true, userId: 202 });

    expect(addOrgMember).toHaveBeenCalledWith(7, 202, "member", 101, "instructor");
    expect(createEnrollment).toHaveBeenCalledWith(expect.objectContaining({
      orgId: 7,
      courseId: 41,
      userId: 202,
      amountPaid: 0,
    }));
  });

  it("rejects a cross-school course before creating any enrollment", async () => {
    getUserByEmail.mockResolvedValue({ id: 202, email: "student@example.test" });
    getOrgMember.mockImplementation(async (_orgId: number, userId: number) => (
      userId === 101 ? { orgId: 7, userId: 101, role: "org_super_admin" } : undefined
    ));
    getCourseById.mockResolvedValue({ id: 99, orgId: 8, title: "Other school course" });

    await expect(caller().members.createAndAdd({
      orgId: 7,
      name: "Student",
      email: "student@example.test",
      password: "secure-password",
      courseIds: [99],
    })).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(createEnrollment).not.toHaveBeenCalled();
  });

  it("reactivates a prior active-school enrollment without duplicating its learner record", async () => {
    getUserByEmail.mockResolvedValue({ id: 202, email: "student@example.test" });
    getOrgMember.mockImplementation(async (_orgId: number, userId: number) => (
      userId === 101 ? { orgId: 7, userId: 101, role: "org_super_admin" } : undefined
    ));
    getEnrollmentIncludingInactive.mockResolvedValue({ id: 612, orgId: 7, isActive: false, progressPct: 54 });

    await expect(caller().members.createAndAdd({
      orgId: 7,
      name: "Student",
      email: "student@example.test",
      password: "secure-password",
      courseIds: [41],
    })).resolves.toEqual({ success: true, userId: 202 });

    expect(reactivateEnrollment).toHaveBeenCalledWith(612);
    expect(createEnrollment).not.toHaveBeenCalled();
  });

  it("sends a new bulk member a 24-hour setup link on the owning organization domain", async () => {
    const newUser = { id: 303, email: "new.student@example.test", name: "New Student" };
    getUserByEmail
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(newUser);
    getOrgMember.mockImplementation(async (_orgId: number, userId: number) => (
      userId === 101 ? { orgId: 7, userId: 101, role: "org_super_admin" } : undefined
    ));

    const result = await caller().members.bulkImport({
      orgId: 7,
      users: [{ name: "New Student", email: "new.student@example.test" }],
    });

    expect(result).toMatchObject({ total: 1, created: 1, updated: 0, failed: 0, setupEmailsSent: 1 });
    expect(addOrgMember).toHaveBeenCalledWith(7, 303, "member", 101, "basic_member");
    expect(sendEmailViaOrg).toHaveBeenCalledWith(expect.objectContaining({
      to: { name: "New Student", email: "new.student@example.test" },
      subject: "Set up your Academy School account",
      htmlBody: expect.stringContaining("https://academy.course360.app/reset-password?token="),
    }), 7);
  });

  it("does not let an org admin grant or modify super administrator access", async () => {
    getOrgMember.mockImplementation(async (_orgId: number, userId: number) => {
      if (userId === 101) return { orgId: 7, userId: 101, role: "org_admin" };
      if (userId === 303) return { orgId: 7, userId: 303, role: "member" };
      return undefined;
    });

    await expect(caller("org_admin").members.updateMemberRole({
      orgId: 7,
      userId: 303,
      role: "org_super_admin",
      memberSubRole: "basic_member",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(updateOrgMemberRole).not.toHaveBeenCalled();
  });

  it("allows an active-school administrator to reset only an active-school member password", async () => {
    getOrgMember.mockResolvedValue({ orgId: 7, userId: 303, role: "member" });
    getUserById.mockResolvedValue({ id: 303, role: "user" });

    await expect(caller("org_admin").members.resetPassword({
      orgId: 7,
      userId: 303,
      newPassword: "renewed-password",
    })).resolves.toEqual({ success: true });

    expect(getDb().update).toHaveBeenCalled();
    await expect(caller("org_admin").members.resetPassword({
      orgId: 8,
      userId: 303,
      newPassword: "renewed-password",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("does not let an organization administrator reset a platform administrator password", async () => {
    getOrgMember.mockResolvedValue({ orgId: 7, userId: 303, role: "member" });
    getUserById.mockResolvedValue({ id: 303, role: "site_admin" });

    await expect(caller("org_super_admin").members.resetPassword({
      orgId: 7,
      userId: 303,
      newPassword: "renewed-password",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
