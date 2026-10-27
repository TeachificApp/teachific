import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const getOrgIdForUserWithFallback = vi.hoisted(() => vi.fn());
const requireOrgAdmin = vi.hoisted(() => vi.fn());
const getUserById = vi.hoisted(() => vi.fn());
const getOrgById = vi.hoisted(() => vi.fn());
const getDb = vi.hoisted(() => vi.fn());
const addOrgMember = vi.hoisted(() => vi.fn());
const getOrgMember = vi.hoisted(() => vi.fn());
const resolvePublicOrganizationScope = vi.hoisted(() => vi.fn());
const getCategoriesByOrg = vi.hoisted(() => vi.fn());
const getCategoryById = vi.hoisted(() => vi.fn());
const createCategory = vi.hoisted(() => vi.fn());
const updateCategory = vi.hoisted(() => vi.fn());
const deleteCategory = vi.hoisted(() => vi.fn());
const getGroupsByOrg = vi.hoisted(() => vi.fn());
const getGroupById = vi.hoisted(() => vi.fn());
const getGroupMembers = vi.hoisted(() => vi.fn());
const createGroup = vi.hoisted(() => vi.fn());
const updateGroup = vi.hoisted(() => vi.fn());
const deleteGroup = vi.hoisted(() => vi.fn());
const removeGroupMember = vi.hoisted(() => vi.fn());
const getCourseById = vi.hoisted(() => vi.fn());

vi.mock("./db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./db")>()),
  getOrgIdForUserWithFallback,
  requireOrgAdmin,
  getUserById,
  getOrgById,
  getDb,
  addOrgMember,
  getOrgMember,
}));

vi.mock("./lib/publicOrgRequestScope", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./lib/publicOrgRequestScope")>()),
  resolvePublicOrganizationScope,
}));

vi.mock("./lmsDb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./lmsDb")>()),
  getCategoriesByOrg,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  getGroupsByOrg,
  getGroupById,
  getGroupMembers,
  createGroup,
  updateGroup,
  deleteGroup,
  removeGroupMember,
  getCourseById,
}));

const { lmsRouter } = await import("./lmsRouter");

function caller(role = "org_admin", email = "admin@school.test") {
  return lmsRouter.createCaller({
    user: { id: 101, role, email },
    req: { hostname: "school.course360.app", headers: { host: "school.course360.app" }, socket: {} },
  } as any);
}

describe("Course360 legacy Category and Group active-school scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserById.mockResolvedValue({ id: 101, role: "org_admin", email: "admin@school.test" });
    getOrgById.mockResolvedValue({ id: 7, slug: "school", customDomain: null, domainVerificationStatus: "unverified" });
    getOrgIdForUserWithFallback.mockResolvedValue(7);
    requireOrgAdmin.mockResolvedValue(7);
    addOrgMember.mockResolvedValue(undefined);
    getOrgMember.mockResolvedValue({ orgId: 7, userId: 101, role: "org_admin", memberSubRole: "basic_member" });
    resolvePublicOrganizationScope.mockResolvedValue({ id: 7, slug: "school", source: "course360_subdomain" });
    getCategoriesByOrg.mockResolvedValue([{ id: 31, orgId: 7, name: "Current school category" }]);
    getCategoryById.mockResolvedValue({ id: 31, orgId: 7, name: "Current school category" });
    createCategory.mockResolvedValue({ id: 32, orgId: 7, name: "New category" });
    getGroupsByOrg.mockResolvedValue([{ id: 41, orgId: 7, name: "Current school group", seats: 10, managerId: 101, managerEmail: "admin@school.test" }]);
    getGroupById.mockResolvedValue({ id: 41, orgId: 7, name: "Current school group", seats: 10, managerId: 101, managerEmail: "admin@school.test" });
    getGroupMembers.mockResolvedValue([]);
    createGroup.mockResolvedValue({ id: 42, orgId: 7, name: "New current school group" });
    getCourseById.mockResolvedValue({ id: 51, orgId: 7, title: "Current school course" });
  });

  it("uses the server-resolved active organization for Category and Group lists", async () => {
    await expect(caller().categories.list({ orgId: 7 })).resolves.toEqual([
      expect.objectContaining({ id: 31, orgId: 7 }),
    ]);
    await expect(caller().groups.list({ orgId: 7 })).resolves.toEqual([
      expect.objectContaining({ id: 41, orgId: 7, members: [] }),
    ]);
    expect(getCategoriesByOrg).toHaveBeenCalledWith(7);
    expect(getGroupsByOrg).toHaveBeenCalledWith(7);
    expect(requireOrgAdmin).toHaveBeenCalledWith(101, "org_admin", 7);
  });

  it("rejects stale browser organization hints before reading or writing Category and Group data", async () => {
    const requests = [
      () => caller().categories.list({ orgId: 8 }),
      () => caller().categories.create({ orgId: 8, name: "Other school category" }),
      () => caller().groups.list({ orgId: 8 }),
      () => caller().groups.create({ orgId: 8, name: "Other school group" }),
      () => caller().groups.assignSeat({ orgId: 8, groupId: 41, email: "student@school.test" }),
    ];
    for (const request of requests) {
      await expect(request()).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(getCategoriesByOrg).not.toHaveBeenCalled();
    expect(createCategory).not.toHaveBeenCalled();
    expect(getGroupsByOrg).not.toHaveBeenCalled();
    expect(createGroup).not.toHaveBeenCalled();
    expect(getGroupById).not.toHaveBeenCalled();
  });

  it("rejects cross-school record references even for platform administrators with a selected school", async () => {
    getCategoryById.mockResolvedValue({ id: 32, orgId: 8, name: "Other school category" });
    getGroupById.mockResolvedValue({ id: 42, orgId: 8, name: "Other school group", seats: 10 });

    await expect(caller("site_admin").categories.update({ id: 32, data: { name: "No access" } }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller("site_admin").groups.delete({ groupId: 42 }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(updateCategory).not.toHaveBeenCalled();
    expect(deleteGroup).not.toHaveBeenCalled();
  });

  it("persists only active-school references and presentation fields for groups and categories", async () => {
    await caller().categories.create({
      orgId: 7,
      name: "Featured courses",
      description: "Public catalog highlights",
      color: "#0d9488",
    });
    await caller().groups.create({
      orgId: 7,
      name: "Spring cohort",
      productIds: [51],
      managerEmail: "manager@school.test",
      seats: 25,
    });

    expect(createCategory).toHaveBeenCalledWith(expect.objectContaining({
      orgId: 7,
      description: "Public catalog highlights",
      color: "#0d9488",
    }));
    expect(createGroup).toHaveBeenCalledWith(expect.objectContaining({
      orgId: 7,
      productIds: JSON.stringify([51]),
      seats: 25,
    }));
  });

  it("keeps the manager portal limited to groups assigned to that manager in the active school", async () => {
    getOrgMember.mockResolvedValue({ orgId: 7, userId: 101, role: "member", memberSubRole: "group_manager" });
    getGroupsByOrg.mockResolvedValue([
      { id: 41, orgId: 7, name: "Assigned", seats: 10, managerId: 101, managerEmail: "admin@school.test" },
      { id: 42, orgId: 7, name: "Another manager", seats: 10, managerId: 202, managerEmail: "other@school.test" },
    ]);

    await expect(caller("user").groups.listManaged()).resolves.toEqual([
      expect.objectContaining({ id: 41, members: [] }),
    ]);
  });

  it("keeps the page mutation contracts synchronized with protected router inputs", () => {
    const categoryPage = readFileSync(new URL("../client/src/pages/products/CategoriesPage.tsx", import.meta.url), "utf8");
    const groupsPage = readFileSync(new URL("../client/src/pages/members/GroupsPage.tsx", import.meta.url), "utf8");
    expect(categoryPage).toContain("data: {");
    expect(groupsPage).toContain("groupId: editId");
    expect(groupsPage).toContain("deleteMut.mutate({ groupId: deleteConfirmId })");
    expect(groupsPage).toContain("csvImportMut.mutate({ groupId: csvImportGroupId, rows })");
    expect(groupsPage).toContain("setInviteLink(res.inviteUrl)");
  });

  it("keeps Group invite links on legacy group records with expiry, owner-domain URLs, and tenant-bound redemption", () => {
    const source = readFileSync(new URL("./lmsRouter.ts", import.meta.url), "utf8");
    const schema = readFileSync(new URL("../drizzle/schema.ts", import.meta.url), "utf8");
    expect(schema).toContain('inviteToken: varchar("inviteToken", { length: 96 })');
    expect(schema).toContain('inviteExpiresAt: timestamp("inviteExpiresAt")');
    expect(source).toContain("requireLegacyGroupInActiveOrg(ctx, input.groupId)");
    expect(source).toContain("getOrgBaseUrl(organization.slug");
    expect(source).toContain("resolvePublicOrganizationScope(db, ctx.req)");
    expect(source).toContain("eq(groups.inviteToken, input.token)");
    expect(source).toContain("db.insert(groupMembers).values");
    expect(source).not.toContain("lmsGroups).set({ inviteToken");
  });

  it("generates an expiry-bound Group invite on the owning school domain", async () => {
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));
    getDb.mockResolvedValue({ update });

    const response = await caller().groups.generateInviteLink({ groupId: 41 });

    expect(response.inviteUrl).toMatch(/^https:\/\/school\.course360\.app\/join-group\?token=/);
    expect(response.token).toHaveLength(48);
    expect(response.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(update).toHaveBeenCalledOnce();
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ inviteToken: response.token }));
    expect(getOrgById).toHaveBeenCalledWith(7);
  });

  it("rejects Group invite redemption on another school's hostname before adding a membership", async () => {
    const inviteGroup = {
      id: 41,
      orgId: 7,
      name: "Current school group",
      seats: 10,
      inviteToken: "valid-token",
      inviteExpiresAt: new Date(Date.now() + 60_000),
    };
    const values = vi.fn().mockResolvedValue(undefined);
    const db = {
      select: vi.fn(() => ({ from: () => ({ where: () => ({ limit: async () => [inviteGroup] }) }) })),
      insert: vi.fn(() => ({ values })),
    };
    getDb.mockResolvedValue(db);
    resolvePublicOrganizationScope.mockResolvedValue({ id: 8, slug: "other-school", source: "course360_subdomain" });
    getUserById.mockResolvedValue({ id: 101, name: "Learner", email: "admin@school.test" });

    await expect(caller("member").groups.joinByInvite({ token: "valid-token" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(addOrgMember).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("adds accepted invitations to the legacy Group members model and the owning organization only", async () => {
    const inviteGroup = {
      id: 41,
      orgId: 7,
      name: "Current school group",
      seats: 10,
      inviteToken: "valid-token",
      inviteExpiresAt: new Date(Date.now() + 60_000),
    };
    const values = vi.fn().mockResolvedValue(undefined);
    const db = {
      select: vi.fn(() => ({ from: () => ({ where: () => ({ limit: async () => [inviteGroup] }) }) })),
      insert: vi.fn(() => ({ values })),
    };
    getDb.mockResolvedValue(db);
    getGroupMembers.mockResolvedValue([]);
    getOrgMember.mockResolvedValue(undefined);
    getUserById.mockResolvedValue({ id: 101, name: "Learner", email: "learner@school.test" });

    await expect(caller("member", "learner@school.test").groups.joinByInvite({ token: "valid-token" }))
      .resolves.toMatchObject({ ok: true, groupId: 41, alreadyMember: false });

    expect(addOrgMember).toHaveBeenCalledWith(7, 101, "member", undefined, "group_member");
    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      groupId: 41,
      userId: 101,
      email: "learner@school.test",
      status: "active",
    }));
  });

  it("reactivates an existing removed Group member rather than duplicating their membership", async () => {
    const inviteGroup = {
      id: 41,
      orgId: 7,
      name: "Current school group",
      seats: 10,
      inviteToken: "valid-token",
      inviteExpiresAt: new Date(Date.now() + 60_000),
    };
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));
    const insert = vi.fn();
    const db = {
      select: vi.fn(() => ({ from: () => ({ where: () => ({ limit: async () => [inviteGroup] }) }) })),
      update,
      insert,
    };
    getDb.mockResolvedValue(db);
    getGroupMembers.mockResolvedValue([
      { id: 72, groupId: 41, userId: 101, email: "learner@school.test", status: "removed" },
    ]);
    getOrgMember.mockResolvedValue({ orgId: 7, userId: 101, role: "member" });
    getUserById.mockResolvedValue({ id: 101, name: "Learner", email: "learner@school.test" });

    await expect(caller("member", "learner@school.test").groups.joinByInvite({ token: "valid-token" }))
      .resolves.toMatchObject({ ok: true, groupId: 41, alreadyMember: false });

    expect(update).toHaveBeenCalledOnce();
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ status: "active" }));
    expect(insert).not.toHaveBeenCalled();
  });
});
