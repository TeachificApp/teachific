import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const getUserById = vi.hoisted(() => vi.fn());
const getOrgIdForUserWithFallback = vi.hoisted(() => vi.fn());
const requireOrgAdmin = vi.hoisted(() => vi.fn());
const getDb = vi.hoisted(() => vi.fn());
const resolvePublicOrganizationScope = vi.hoisted(() => vi.fn());
const getWebinarsByOrg = vi.hoisted(() => vi.fn());
const getWebinarById = vi.hoisted(() => vi.fn());
const getPublishedWebinarBySlugForOrg = vi.hoisted(() => vi.fn());
const createWebinar = vi.hoisted(() => vi.fn());
const updateWebinar = vi.hoisted(() => vi.fn());
const deleteWebinar = vi.hoisted(() => vi.fn());
const getWebinarRegistrations = vi.hoisted(() => vi.fn());
const getWebinarRegistrationByIdForWebinar = vi.hoisted(() => vi.fn());
const createWebinarRegistration = vi.hoisted(() => vi.fn());
const createWebinarSession = vi.hoisted(() => vi.fn());
const getWebinarSessionByToken = vi.hoisted(() => vi.fn());
const updateWebinarSession = vi.hoisted(() => vi.fn());
const getWebinarFunnelSteps = vi.hoisted(() => vi.fn());
const upsertWebinarFunnelSteps = vi.hoisted(() => vi.fn());
const getWebinarStats = vi.hoisted(() => vi.fn());
const getCourseById = vi.hoisted(() => vi.fn());

vi.mock("./db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./db")>()),
  getUserById,
  getOrgIdForUserWithFallback,
  requireOrgAdmin,
  getDb,
}));

vi.mock("./lib/publicOrgRequestScope", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./lib/publicOrgRequestScope")>()),
  resolvePublicOrganizationScope,
}));

vi.mock("./lmsDb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./lmsDb")>()),
  getWebinarsByOrg,
  getWebinarById,
  getPublishedWebinarBySlugForOrg,
  createWebinar,
  updateWebinar,
  deleteWebinar,
  getWebinarRegistrations,
  getWebinarRegistrationByIdForWebinar,
  createWebinarRegistration,
  createWebinarSession,
  getWebinarSessionByToken,
  updateWebinarSession,
  getWebinarFunnelSteps,
  upsertWebinarFunnelSteps,
  getWebinarStats,
  getCourseById,
}));

const { lmsRouter } = await import("./lmsRouter");

function caller(role = "org_admin") {
  return lmsRouter.createCaller({
    user: { id: 101, role, email: "admin@academy.test", name: "Alex Admin" },
    req: { hostname: "academy.course360.app", headers: { host: "academy.course360.app" }, socket: {} },
  } as any);
}

function currentWebinar() {
  return {
    id: 91,
    orgId: 7,
    title: "Current school webinar",
    slug: "current-school-webinar",
    type: "evergreen" as const,
    isPublished: true,
    enrollmentClosed: false,
    requireRegistration: true,
    linkedCourseId: null,
  };
}

describe("Course360 legacy Webinar active-school scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserById.mockResolvedValue({ id: 101, role: "org_admin" });
    getOrgIdForUserWithFallback.mockResolvedValue(7);
    requireOrgAdmin.mockResolvedValue(7);
    getDb.mockResolvedValue({});
    resolvePublicOrganizationScope.mockResolvedValue({ id: 7, slug: "academy", source: "course360_subdomain" });
    getWebinarsByOrg.mockResolvedValue([currentWebinar()]);
    getWebinarById.mockResolvedValue(currentWebinar());
    getPublishedWebinarBySlugForOrg.mockResolvedValue(currentWebinar());
    createWebinar.mockResolvedValue(currentWebinar());
    updateWebinar.mockResolvedValue(currentWebinar());
    createWebinarRegistration.mockResolvedValue({ id: 301, webinarId: 91, orgId: 7, email: "learner@example.test" });
    getWebinarRegistrationByIdForWebinar.mockResolvedValue({ id: 301, webinarId: 91, orgId: 7 });
    createWebinarSession.mockResolvedValue({ id: 401, webinarId: 91, sessionToken: "session-token" });
    getWebinarSessionByToken.mockResolvedValue({ id: 401, webinarId: 91, sessionToken: "session-token" });
    getWebinarRegistrations.mockResolvedValue([{ id: 301, webinarId: 91, orgId: 7 }]);
    getWebinarFunnelSteps.mockResolvedValue([]);
    getWebinarStats.mockResolvedValue({ totalRegistrations: 1, attended: 0, converted: 0, conversionRate: 0, avgWatchMinutes: 0 });
    getCourseById.mockResolvedValue({ id: 41, orgId: 7, title: "Current school course" });
  });

  it("uses the server-resolved active organization for Webinar lists and creates", async () => {
    await expect(caller().webinars.list({ orgId: 7 })).resolves.toEqual([
      expect.objectContaining({ id: 91, orgId: 7 }),
    ]);
    await expect(caller().webinars.create({ orgId: 7, title: "New webinar", type: "live" }))
      .resolves.toEqual(expect.objectContaining({ orgId: 7 }));

    expect(getWebinarsByOrg).toHaveBeenCalledWith(7);
    expect(createWebinar).toHaveBeenCalledWith(expect.objectContaining({ orgId: 7, type: "live" }));
    await expect(caller().webinars.list({ orgId: 8 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller().webinars.create({ orgId: 8, title: "Other school webinar" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects foreign raw Webinar identifiers even for a platform administrator with another active school selected", async () => {
    getWebinarById.mockResolvedValue({ ...currentWebinar(), orgId: 8 });
    const admin = caller("site_admin");

    await expect(admin.webinars.get({ webinarId: 91 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(admin.webinars.update({ id: 91, title: "No access" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(admin.webinars.delete({ id: 91 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(admin.webinars.getRegistrations({ webinarId: 91 })).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(updateWebinar).not.toHaveBeenCalled();
    expect(deleteWebinar).not.toHaveBeenCalled();
    expect(getWebinarRegistrations).not.toHaveBeenCalled();
  });

  it("uses typed updates, preserves decimal-dollar amounts, and rejects ownership reassignment or foreign course references", async () => {
    await expect(caller().webinars.update({ id: 91, orgId: 8 } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });

    getCourseById.mockResolvedValue({ id: 41, orgId: 8, title: "Other school course" });
    await expect(caller().webinars.update({ id: 91, linkedCourseId: 41 })).rejects.toMatchObject({ code: "FORBIDDEN" });

    getCourseById.mockResolvedValue({ id: 41, orgId: 7, title: "Current school course" });
    await caller().webinars.update({
      id: 91,
      title: "Updated Webinar",
      price: 149.95,
      currency: "USD",
      pricingType: "one_time",
      linkedCourseId: 41,
    });

    expect(updateWebinar).toHaveBeenCalledWith(91, 7, expect.objectContaining({
      title: "Updated Webinar",
      price: 149.95,
      currency: "USD",
      pricingType: "one_time",
      linkedCourseId: 41,
    }));
  });

  it("keeps registrations, sessions, funnels, stats, and deletion scoped to the active Webinar organization", async () => {
    await caller().webinars.getRegistrations({ webinarId: 91 });
    await caller().webinars.getFunnelSteps({ webinarId: 91 });
    await caller().webinars.saveFunnelSteps({ webinarId: 91, steps: [] });
    await caller().webinars.getStats({ webinarId: 91 });
    await caller().webinars.delete({ id: 91 });

    expect(getWebinarRegistrations).toHaveBeenCalledWith(91, 7);
    expect(getWebinarFunnelSteps).toHaveBeenCalledWith(91, 7);
    expect(upsertWebinarFunnelSteps).toHaveBeenCalledWith(91, 7, []);
    expect(getWebinarStats).toHaveBeenCalledWith(91, 7);
    expect(deleteWebinar).toHaveBeenCalledWith(91, 7);
  });

  it("serves and registers published Webinars only through the verified request organization", async () => {
    await expect(caller().webinars.getBySlug({ slug: "current-school-webinar", orgId: 7 }))
      .resolves.toMatchObject({ id: 91, orgId: 7 });
    expect(getPublishedWebinarBySlugForOrg).toHaveBeenCalledWith(7, "current-school-webinar");

    await expect(caller().webinars.register({ webinarId: 91, email: "learner@example.test", firstName: "Learner" }))
      .resolves.toMatchObject({ registration: expect.objectContaining({ id: 301, orgId: 7 }) });
    expect(createWebinarRegistration).toHaveBeenCalledWith(expect.objectContaining({ webinarId: 91, orgId: 7 }));

    resolvePublicOrganizationScope.mockResolvedValue({ id: 8, slug: "other-school", source: "course360_subdomain" });
    await expect(caller().webinars.getBySlug({ slug: "current-school-webinar" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller().webinars.register({ webinarId: 91, email: "learner@example.test" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(createWebinarRegistration).toHaveBeenCalledTimes(1);
  });

  it("requires a Webinar-owned registration and verified tenant host for public watch sessions and heartbeats", async () => {
    await expect(caller().webinars.startSession({ webinarId: 91, registrationId: 301 }))
      .resolves.toMatchObject({ webinarId: 91 });
    expect(getWebinarRegistrationByIdForWebinar).toHaveBeenCalledWith(301, 91, 7);

    await caller().webinars.heartbeat({ sessionToken: "session-token", watchedSeconds: 30, currentViewerCount: 42 });
    expect(updateWebinarSession).toHaveBeenCalledWith(401, 91, 7, expect.objectContaining({ watchedSeconds: 30, peakViewerCount: 42 }));

    getWebinarRegistrationByIdForWebinar.mockResolvedValue(null);
    await expect(caller().webinars.startSession({ webinarId: 91, registrationId: 999 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("uses active-organization guards and scoped persistence in both mounted Webinar administration routes", () => {
    const routerSource = readFileSync(new URL("./lmsRouter.ts", import.meta.url), "utf8");
    const dbSource = readFileSync(new URL("./lmsDb.ts", import.meta.url), "utf8");
    const adminRouterSource = readFileSync(new URL("./routers/webinarAdminRouter.ts", import.meta.url), "utf8");

    const webinarSource = routerSource.slice(routerSource.indexOf("webinars: router({"), routerSource.indexOf("// ── Members", routerSource.indexOf("webinars: router({")));
    expect(routerSource).toContain("async function requireActiveLegacyWebinarOrg");
    expect(routerSource).toContain("async function requireLegacyWebinarInActiveOrg");
    expect(webinarSource).toContain("legacyWebinarUpdateInputSchema");
    expect(webinarSource).not.toContain("z.record(z.string(), z.unknown())");
    expect(webinarSource).toContain("resolvePublicOrganizationScope(db as any, ctx.req");
    expect(routerSource).toContain("getPublishedWebinarBySlugForOrg(publicScope.id, slug)");
    expect(dbSource).toContain("updateWebinar(id: number, orgId: number");
    expect(dbSource).toContain("deleteWebinar(id: number, orgId: number");
    expect(dbSource).toContain("getWebinarRegistrations(webinarId: number, orgId: number)");
    expect(dbSource).toContain("EXISTS (SELECT 1 FROM ${webinars}");
    expect(adminRouterSource).toContain("getOrgIdForUserWithFallback");
    expect(adminRouterSource).toContain("async function requireActiveWebinarOrg");
    expect(adminRouterSource).toContain("webinarAdminUpdateInputSchema");
    expect(adminRouterSource).not.toContain("data: z.record(z.string(), z.unknown())");
  });
});
