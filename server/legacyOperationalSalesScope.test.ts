import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const getOrgIdForUserWithFallback = vi.hoisted(() => vi.fn());
const requireOrgAdmin = vi.hoisted(() => vi.fn());
const getOrgNotificationSettings = vi.hoisted(() => vi.fn());
const updateOrgNotificationSettings = vi.hoisted(() => vi.fn());
const getRevenuePartnersByOrg = vi.hoisted(() => vi.fn());
const createRevenuePartner = vi.hoisted(() => vi.fn());
const getRevenuePartnerById = vi.hoisted(() => vi.fn());
const updateRevenuePartner = vi.hoisted(() => vi.fn());
const deleteRevenuePartner = vi.hoisted(() => vi.fn());
const getCourseOrdersByOrg = vi.hoisted(() => vi.fn());
const getCourseOrderById = vi.hoisted(() => vi.fn());
const createCourseOrder = vi.hoisted(() => vi.fn());
const updateCourseOrder = vi.hoisted(() => vi.fn());
const getCourseOrderStats = vi.hoisted(() => vi.fn());
const getCourseById = vi.hoisted(() => vi.fn());

vi.mock("./db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./db")>()),
  getOrgIdForUserWithFallback,
  requireOrgAdmin,
}));

vi.mock("./lmsDb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./lmsDb")>()),
  getOrgNotificationSettings,
  updateOrgNotificationSettings,
  getRevenuePartnersByOrg,
  createRevenuePartner,
  getRevenuePartnerById,
  updateRevenuePartner,
  deleteRevenuePartner,
  getCourseOrdersByOrg,
  getCourseOrderById,
  createCourseOrder,
  updateCourseOrder,
  getCourseOrderStats,
  getCourseById,
}));

const { lmsRouter } = await import("./lmsRouter");

function caller(role = "org_admin") {
  return lmsRouter.createCaller({
    user: { id: 101, role, email: "admin@example.test" },
    req: { hostname: "course360.app", headers: { host: "course360.app" }, socket: {} },
  } as any);
}

describe("Course360 legacy operational sales administration scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOrgIdForUserWithFallback.mockResolvedValue(7);
    requireOrgAdmin.mockResolvedValue(undefined);
    getOrgNotificationSettings.mockResolvedValue({ enrollment: true });
    updateOrgNotificationSettings.mockResolvedValue({ enrollment: false });
    getRevenuePartnersByOrg.mockResolvedValue([{ id: 41, orgId: 7, name: "Current school partner" }]);
    createRevenuePartner.mockResolvedValue({ id: 42, orgId: 7, name: "New current school partner" });
    getRevenuePartnerById.mockResolvedValue({ id: 41, orgId: 7, name: "Current school partner" });
    updateRevenuePartner.mockResolvedValue({ id: 41, orgId: 7, name: "Updated partner" });
    deleteRevenuePartner.mockResolvedValue(undefined);
    getCourseOrdersByOrg.mockResolvedValue([{ id: 51, orgId: 7, customerEmail: "student@example.test" }]);
    getCourseOrderById.mockResolvedValue({ id: 51, orgId: 7, customerEmail: "student@example.test" });
    createCourseOrder.mockResolvedValue({ id: 52, orgId: 7, customerEmail: "buyer@example.test" });
    updateCourseOrder.mockResolvedValue({ id: 51, orgId: 7, status: "completed" });
    getCourseOrderStats.mockResolvedValue({ total: 1, completed: 1, refunded: 0, totalRevenue: 49 });
    getCourseById.mockResolvedValue({ id: 61, orgId: 7, title: "Current school course" });
  });

  it("uses the server-resolved active organization for notifications and sales operations", async () => {
    await caller().notifications.getOrgSettings({ orgId: 7 });
    await caller().notifications.updateOrgSettings({ orgId: 7, settings: { enrollment: false } });
    await caller().revenuePartners.list({ orgId: 7 });
    await caller().revenuePartners.create({
      orgId: 7,
      name: "New partner",
      email: "partner@example.test",
      shareType: "fixed",
      shareValue: 25,
      appliesTo: "specific",
    });
    await caller().courseOrders.list({ orgId: 7 });
    await caller().courseOrders.create({ orgId: 7, customerEmail: "buyer@example.test", amount: 49 });
    await caller().courseOrders.stats({ orgId: 7 });

    expect(getOrgNotificationSettings).toHaveBeenCalledWith(7);
    expect(updateOrgNotificationSettings).toHaveBeenCalledWith(7, { enrollment: false });
    expect(getRevenuePartnersByOrg).toHaveBeenCalledWith(7);
    expect(createRevenuePartner).toHaveBeenCalledWith(expect.objectContaining({
      orgId: 7,
      shareType: "fixed",
      shareValue: 25,
      appliesTo: "specific",
    }));
    expect(getCourseOrdersByOrg).toHaveBeenCalledWith(7);
    expect(createCourseOrder).toHaveBeenCalledWith(expect.objectContaining({ orgId: 7, amount: 49 }));
    expect(getCourseOrderStats).toHaveBeenCalledWith(7);
    expect(requireOrgAdmin).toHaveBeenCalledWith(101, "org_admin", 7);
  });

  it("rejects forged organization hints before any notification or sales data is accessed", async () => {
    const requests = [
      () => caller().notifications.getOrgSettings({ orgId: 8 }),
      () => caller().notifications.updateOrgSettings({ orgId: 8, settings: { enrollment: false } }),
      () => caller().revenuePartners.list({ orgId: 8 }),
      () => caller().revenuePartners.create({ orgId: 8, name: "Other partner", email: "other@example.test" }),
      () => caller().courseOrders.list({ orgId: 8 }),
      () => caller().courseOrders.create({ orgId: 8, customerEmail: "buyer@example.test" }),
      () => caller().courseOrders.stats({ orgId: 8 }),
    ];

    for (const request of requests) {
      await expect(request()).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "LMS operational data must use the active organization.",
      });
    }

    expect(getOrgNotificationSettings).not.toHaveBeenCalled();
    expect(updateOrgNotificationSettings).not.toHaveBeenCalled();
    expect(getRevenuePartnersByOrg).not.toHaveBeenCalled();
    expect(createRevenuePartner).not.toHaveBeenCalled();
    expect(getCourseOrdersByOrg).not.toHaveBeenCalled();
    expect(createCourseOrder).not.toHaveBeenCalled();
    expect(getCourseOrderStats).not.toHaveBeenCalled();
  });

  it("keeps platform administrators bound to their selected active organization for operational data", async () => {
    await expect(caller("site_admin").revenuePartners.list({ orgId: 8 })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "LMS operational data must use the active organization.",
    });
    await expect(caller("site_admin").courseOrders.stats({ orgId: 8 })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "LMS operational data must use the active organization.",
    });
  });

  it("rejects foreign partner and order records before reading, updating, or deleting them", async () => {
    getRevenuePartnerById.mockResolvedValue({ id: 81, orgId: 8, name: "Other school partner" });
    await expect(caller().revenuePartners.update({ id: 81, data: { name: "Changed" } }))
      .rejects.toMatchObject({ code: "FORBIDDEN", message: "Revenue partner does not belong to the active organization." });
    await expect(caller().revenuePartners.delete({ id: 81 }))
      .rejects.toMatchObject({ code: "FORBIDDEN", message: "Revenue partner does not belong to the active organization." });

    getCourseOrderById.mockResolvedValue({ id: 91, orgId: 8, customerEmail: "other@example.test" });
    await expect(caller().courseOrders.get({ id: 91 }))
      .rejects.toMatchObject({ code: "FORBIDDEN", message: "Course order does not belong to the active organization." });
    await expect(caller().courseOrders.update({ id: 91, data: { status: "completed" } }))
      .rejects.toMatchObject({ code: "FORBIDDEN", message: "Course order does not belong to the active organization." });

    expect(updateRevenuePartner).not.toHaveBeenCalled();
    expect(deleteRevenuePartner).not.toHaveBeenCalled();
    expect(updateCourseOrder).not.toHaveBeenCalled();
  });

  it("cannot move same-school records to another organization and validates order course ownership", async () => {
    await caller().revenuePartners.update({ id: 41, data: { name: "Updated", orgId: 8 } });
    expect(updateRevenuePartner).toHaveBeenCalledWith(41, { name: "Updated" });

    await caller().courseOrders.update({ id: 51, data: { status: "completed", orgId: 8 } });
    expect(updateCourseOrder).toHaveBeenCalledWith(51, { status: "completed" });

    getCourseById.mockResolvedValue({ id: 61, orgId: 8, title: "Other school course" });
    await expect(caller().courseOrders.create({
      orgId: 7,
      courseId: 61,
      customerEmail: "buyer@example.test",
    })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Course does not belong to the active organization",
    });
    expect(createCourseOrder).not.toHaveBeenCalled();
  });

  it("keeps the existing notification, revenue-partner, and order screens on their protected request contracts", () => {
    const orgSettingsSource = readFileSync(new URL("../client/src/pages/OrgSettingsPage.tsx", import.meta.url), "utf8");
    const partnersSource = readFileSync(new URL("../client/src/pages/sales/RevenuePartnersPage.tsx", import.meta.url), "utf8");
    const ordersSource = readFileSync(new URL("../client/src/pages/sales/OrdersPage.tsx", import.meta.url), "utf8");

    expect(orgSettingsSource).toContain("settings: {");
    expect(partnersSource).toContain("data: { name, email, shareType");
    expect(ordersSource).toContain('data: { status: "completed" }');
    expect(ordersSource).toContain('data: { status: "refunded" }');
  });
});
