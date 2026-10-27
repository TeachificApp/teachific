import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const getUserById = vi.hoisted(() => vi.fn());
const getOrgIdForUserWithFallback = vi.hoisted(() => vi.fn());
const requireOrgAdmin = vi.hoisted(() => vi.fn());
const getBundlesByOrg = vi.hoisted(() => vi.fn());
const getBundleById = vi.hoisted(() => vi.fn());
const createBundle = vi.hoisted(() => vi.fn());
const updateBundle = vi.hoisted(() => vi.fn());
const deleteBundle = vi.hoisted(() => vi.fn());
const getCourseById = vi.hoisted(() => vi.fn());

vi.mock("./db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./db")>()),
  getUserById,
  getOrgIdForUserWithFallback,
  requireOrgAdmin,
}));

vi.mock("./lmsDb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./lmsDb")>()),
  getBundlesByOrg,
  getBundleById,
  createBundle,
  updateBundle,
  deleteBundle,
  getCourseById,
}));

const { lmsRouter } = await import("./lmsRouter");

function caller() {
  return lmsRouter.createCaller({
    user: { id: 101, role: "org_admin", email: "admin@example.test" },
    req: { hostname: "course360.app", headers: { host: "course360.app" }, socket: {} },
  } as any);
}

describe("Course360 legacy Bundle active-organization scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserById.mockResolvedValue({ id: 101, role: "org_admin" });
    getOrgIdForUserWithFallback.mockResolvedValue(7);
    requireOrgAdmin.mockResolvedValue(7);
    getBundlesByOrg.mockResolvedValue([{ id: 91, orgId: 7, name: "Current school bundle" }]);
    getBundleById.mockResolvedValue({ id: 91, orgId: 7, name: "Current school bundle", courseIds: "[41]" });
    createBundle.mockResolvedValue({ id: 92, orgId: 7, name: "New bundle" });
    updateBundle.mockResolvedValue({ id: 91, orgId: 7, name: "Refined bundle", courseIds: "[41]" });
    getCourseById.mockResolvedValue({ id: 41, orgId: 7, title: "Current school course" });
  });

  it("uses only the selected active organization for legacy Bundle lists and creation", async () => {
    await expect(caller().bundles.list({ orgId: 7 })).resolves.toEqual([
      expect.objectContaining({ id: 91, orgId: 7 }),
    ]);
    await expect(caller().bundles.create({ orgId: 7, name: "Bundle", price: 29.99 }))
      .resolves.toEqual(expect.objectContaining({ id: 92, orgId: 7 }));

    expect(getBundlesByOrg).toHaveBeenCalledWith(7);
    expect(createBundle).toHaveBeenCalledWith(expect.objectContaining({ orgId: 7, price: 29.99, courseIds: "[]" }));
    await expect(caller().bundles.list({ orgId: 8 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("preserves existing Bundle course references unless an author deliberately changes the selection", async () => {
    await caller().bundles.update({ id: 91, data: { name: "Refined bundle" } });

    expect(getCourseById).not.toHaveBeenCalled();
    expect(updateBundle).toHaveBeenCalledWith(91, 7, { name: "Refined bundle" });
  });

  it("accepts only unique courses owned by the active organization when the selection changes", async () => {
    await caller().bundles.update({ id: 91, data: { courseIds: [41] } });

    expect(getCourseById).toHaveBeenCalledWith(41);
    expect(updateBundle).toHaveBeenCalledWith(91, 7, { courseIds: "[41]" });

    await expect(caller().bundles.update({ id: 91, data: { courseIds: [41, 41] } }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects cross-school Bundle courses and deletes with a tenant predicate", async () => {
    getCourseById.mockResolvedValue({ id: 41, orgId: 8, title: "Other school course" });
    await expect(caller().bundles.update({ id: 91, data: { courseIds: [41] } }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(updateBundle).not.toHaveBeenCalled();

    getCourseById.mockResolvedValue({ id: 41, orgId: 7 });
    await caller().bundles.delete({ id: 91 });
    expect(deleteBundle).toHaveBeenCalledWith(91, 7);
  });

  it("does not let a raw foreign Bundle ID authorize reads, updates, or deletion", async () => {
    getBundleById.mockResolvedValue({ id: 91, orgId: 8, name: "Other school bundle", courseIds: "[]" });

    await expect(caller().bundles.get({ id: 91 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller().bundles.update({ id: 91, data: { name: "Changed" } })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller().bundles.delete({ id: 91 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(updateBundle).not.toHaveBeenCalled();
    expect(deleteBundle).not.toHaveBeenCalled();
  });

  it("uses typed Bundle updates and organization-scoped persistence helpers", () => {
    const routerSource = readFileSync(new URL("./lmsRouter.ts", import.meta.url), "utf8");
    const dbSource = readFileSync(new URL("./lmsDb.ts", import.meta.url), "utf8");
    const bundleSource = routerSource.slice(routerSource.indexOf("bundles: router({"), routerSource.indexOf("// ── Flashcards"));

    expect(bundleSource).toContain("data: legacyBundleUpdateSchema");
    expect(bundleSource).toContain("serializeLegacyBundleCourseIds(bundle.orgId, courseIds)");
    expect(bundleSource).toContain("updateBundle(input.id, bundle.orgId, data)");
    expect(bundleSource).toContain("deleteBundle(input.id, bundle.orgId)");
    expect(bundleSource).not.toContain("z.record(z.string(), z.unknown())");
    expect(dbSource).toContain("getBundleByIdForOrg(id: number, orgId: number)");
    expect(dbSource).toContain("updateBundle(id: number, orgId: number");
    expect(dbSource).toContain("deleteBundle(id: number, orgId: number)");
    expect(dbSource).toContain("and(eq(bundles.id, id), eq(bundles.orgId, orgId))");
  });
});
