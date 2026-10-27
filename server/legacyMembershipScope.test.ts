import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const getOrgIdForUserWithFallback = vi.hoisted(() => vi.fn());
const requireOrgAdmin = vi.hoisted(() => vi.fn());
const getMembershipsByOrg = vi.hoisted(() => vi.fn());
const createMembership = vi.hoisted(() => vi.fn());
const getMembershipById = vi.hoisted(() => vi.fn());
const updateMembership = vi.hoisted(() => vi.fn());
const getCourseById = vi.hoisted(() => vi.fn());
const getDigitalProduct = vi.hoisted(() => vi.fn());
const getWebinarById = vi.hoisted(() => vi.fn());
const getOrgMember = vi.hoisted(() => vi.fn());
const addMembershipContent = vi.hoisted(() => vi.fn());
const addMembershipMember = vi.hoisted(() => vi.fn());
const addMembershipRule = vi.hoisted(() => vi.fn());

vi.mock("./db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./db")>()),
  getOrgIdForUserWithFallback,
  requireOrgAdmin,
  getOrgMember,
}));

vi.mock("./lmsDb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./lmsDb")>()),
  getMembershipsByOrg,
  createMembership,
  getMembershipById,
  updateMembership,
  getCourseById,
  getDigitalProduct,
  getWebinarById,
  addMembershipContent,
  addMembershipMember,
  addMembershipRule,
}));

const { lmsRouter } = await import("./lmsRouter");

function caller() {
  return lmsRouter.createCaller({
    user: { id: 101, role: "org_admin", email: "admin@example.test" },
    req: { hostname: "course360.app", headers: { host: "course360.app" }, socket: {} },
  } as any);
}

describe("Course360 legacy Memberships active-organization scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOrgIdForUserWithFallback.mockResolvedValue(7);
    requireOrgAdmin.mockResolvedValue(7);
    getMembershipsByOrg.mockResolvedValue([{ id: 91, orgId: 7, name: "Current school membership" }]);
    createMembership.mockResolvedValue({ id: 92, orgId: 7, name: "New membership" });
    getMembershipById.mockResolvedValue({ id: 91, orgId: 7, name: "Current school membership" });
    getCourseById.mockResolvedValue({ id: 41, orgId: 7 });
    getDigitalProduct.mockResolvedValue({ id: 51, orgId: 7 });
    getWebinarById.mockResolvedValue({ id: 61, orgId: 7 });
    getOrgMember.mockResolvedValue({ orgId: 7, userId: 501, role: "member" });
  });

  it("uses the selected active organization for legacy Memberships lists and creates", async () => {
    await expect(caller().memberships.list({ orgId: 7 })).resolves.toEqual([
      expect.objectContaining({ id: 91, orgId: 7 }),
    ]);
    await expect(caller().memberships.create({
      orgId: 7, name: "Membership", description: "Access", price: 29.99,
      billingInterval: "monthly", trialDays: 14,
    })).resolves.toEqual(expect.objectContaining({ orgId: 7 }));

    expect(getMembershipsByOrg).toHaveBeenCalledWith(7);
    expect(createMembership).toHaveBeenCalledWith(expect.objectContaining({
      orgId: 7, price: 29.99, billingInterval: "monthly", trialDays: 14,
    }));
  });

  it("rejects stale organization hints and foreign membership-linked users or content", async () => {
    await expect(caller().memberships.list({ orgId: 8 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller().memberships.create({ orgId: 8, name: "Other school" })).rejects.toMatchObject({ code: "FORBIDDEN" });

    getCourseById.mockResolvedValue({ id: 41, orgId: 8 });
    await expect(caller().memberships.addContent({ membershipId: 91, contentType: "course", contentId: 41 }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });

    getOrgMember.mockResolvedValue(undefined);
    await expect(caller().memberships.addMember({ membershipId: 91, userId: 501 }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(caller().memberships.addContent({ membershipId: 91, contentType: "community", contentId: 77 }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(addMembershipContent).not.toHaveBeenCalled();
    expect(addMembershipMember).not.toHaveBeenCalled();
  });

  it("accepts only same-school typed content and trigger entities", async () => {
    await caller().memberships.addContent({ membershipId: 91, contentType: "digital_product", contentId: 51 });
    await caller().memberships.addRule({ membershipId: 91, triggerType: "webinar_registration", triggerEntityId: 61, action: "add_to_membership" });

    expect(addMembershipContent).toHaveBeenCalledWith({ membershipId: 91, contentType: "digital_product", contentId: 51 });
    expect(addMembershipRule).toHaveBeenCalledWith(expect.objectContaining({ membershipId: 91, triggerEntityId: 61 }));
  });

  it("does not accept generic update objects that could reassign an existing membership", async () => {
    await expect(caller().memberships.update({ id: 91, orgId: 8 } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await caller().memberships.update({ id: 91, name: "Renamed", isActive: false });

    expect(updateMembership).toHaveBeenCalledWith(91, 7, { name: "Renamed", isActive: false });
  });

  it("keeps persisted helper mutations tied to both membership and organization identifiers", () => {
    const routerSource = readFileSync(new URL("./lmsRouter.ts", import.meta.url), "utf8");
    const dbSource = readFileSync(new URL("./lmsDb.ts", import.meta.url), "utf8");
    const membershipSource = routerSource.slice(routerSource.indexOf("memberships: router({"), routerSource.indexOf("// ── Bundles"));

    expect(membershipSource).toContain("assertLegacyMembershipContentTarget");
    expect(membershipSource).toContain("assertLegacyMembershipRuleTarget");
    expect(membershipSource).toContain("getOrgMember(membership.orgId, input.userId)");
    expect(membershipSource).not.toContain("z.record(z.string(), z.unknown())");
    expect(dbSource).toContain("updateMembership(id: number, orgId: number");
    expect(dbSource).toContain("deleteMembership(id: number, orgId: number");
    expect(dbSource).toContain("eq(membershipMembers.membershipId, membershipId)");
  });
});
