import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { forms, lmsCourses, orgMediaLibrary, organizations, userActiveOrg } from "../drizzle/schema";

const fixture = vi.hoisted(() => ({
  db: null as any,
  user: { id: 101, role: "org_admin", email: "same@example.test" } as any,
  persistedRole: "org_admin" as string | null,
  membership: { userId: 101, orgId: 7, role: "org_admin" } as any,
  getDb: vi.fn(), getOrgMember: vi.fn(), getUserById: vi.fn(), storagePut: vi.fn(), storagePutStream: vi.fn(),
  provider: vi.fn(() => { throw new Error("Provider forbidden in media tests"); }),
}));
vi.mock("./db", () => ({ getDb: fixture.getDb, getOrgMember: fixture.getOrgMember, getUserById: fixture.getUserById }));
vi.mock("./storage", () => ({ storagePut: fixture.storagePut, storagePutStream: fixture.storagePutStream }));
vi.mock("./authHelper", () => ({ authenticateRequest: vi.fn(async () => fixture.user) }));
vi.mock("./_core/llm", () => ({ invokeLLM: fixture.provider }));
vi.mock("@sendgrid/mail", () => ({ default: { send: fixture.provider, setApiKey: fixture.provider } }));

import { formsRouter, getActiveOrgIdForUser } from "./formsRouter";
import multipartRouter from "./mediaUploadRoutes";

const dialect = new MySqlDialect();
function fakeDb() {
  const rows = new Map<any, any[]>([
    [userActiveOrg, [{ userId: 101, orgId: 7 }]],
    [organizations, [{ id: 7, isActive: true }]],
    [orgMediaLibrary, [
      { id: 44, orgId: 7, filename: "historical.mp4", mimeType: "video/mp4", fileKey: "historical/unscoped-key.mp4", url: "https://cdn.test/historical.mp4", tags: '["school"]', fileSize: 8 },
      { id: 55, orgId: 8, filename: "foreign.png", mimeType: "image/png", fileKey: "org-8/media/foreign.png", tags: "[]" },
    ]],
    [forms, [{ id: 20, orgId: 7 }, { id: 21, orgId: 8 }]],
    [lmsCourses, [{ id: 30, orgId: 7 }, { id: 31, orgId: 8 }]],
  ]);
  const queries: any[] = [], writes: any[] = [];
  function matches(row: any, condition: any, table: any) {
    if (!condition) return true;
    const { sql, params } = dialect.sqlToQuery(condition);
    const columns = [...sql.matchAll(/`([^`]+)`\.`([^`]+)` = \?/g)];
    return columns.every((match, index) => {
      if (match[1] === "organizations" && table === userActiveOrg) {
        return rows.get(organizations)?.some(org => org.id === row.orgId && org[match[2]] === params[index]);
      }
      return row[match[2]] === params[index];
    });
  }
  const db: any = {
    rows, queries, writes,
    select: vi.fn(() => {
      let table: any, condition: any;
      const chain: any = {
        from: (value: any) => { table = value; return chain; },
        innerJoin: () => chain,
        where: (value: any) => { condition = value; queries.push({ table, ...dialect.sqlToQuery(value) }); return chain; },
        limit: async (count: number) => (rows.get(table) ?? []).filter(row => matches(row, condition, table)).slice(0, count),
        orderBy: async () => (rows.get(table) ?? []).filter(row => matches(row, condition, table)),
      };
      return chain;
    }),
    insert: vi.fn((table: any) => ({ values: vi.fn(async (value: any) => {
      const id = 90; writes.push({ kind: "insert", table, value }); rows.get(table)?.push({ id, ...value }); return [{ insertId: id }];
    }) })),
    update: vi.fn((table: any) => ({ set: (value: any) => ({ where: async (condition: any) => {
      writes.push({ kind: "update", table, value, ...dialect.sqlToQuery(condition) });
      for (const row of rows.get(table) ?? []) if (matches(row, condition, table)) Object.assign(row, value);
    } }) })),
    delete: vi.fn((table: any) => ({ where: async (condition: any) => {
      writes.push({ kind: "delete", table, ...dialect.sqlToQuery(condition) });
      rows.set(table, (rows.get(table) ?? []).filter(row => !matches(row, condition, table)));
    } })),
  };
  return db;
}
function caller() {
  return formsRouter.createCaller({ user: fixture.user, req: { headers: {}, socket: {} }, res: {} } as any).media;
}
const mediaInput = { orgId: 7, base64: Buffer.from("image").toString("base64"), filename: "school.png", mimeType: "image/png" };
function mediaRequests() {
  return [
    () => caller().list({ orgId: 7 }), () => caller().upload(mediaInput),
    () => caller().updateTags({ id: 44, tags: ["updated"] }), () => caller().delete({ id: 44 }),
  ];
}
async function multipart(path: "/" | "/replace", body: Record<string, unknown> = {}, file: any = undefined) {
  const layer = (multipartRouter as any).stack.find((entry: any) => entry.route?.path === path);
  const response: any = { code: 200, payload: undefined };
  response.status = vi.fn((code: number) => { response.code = code; return response; });
  response.json = vi.fn((payload: any) => { response.payload = payload; return response; });
  await layer.route.stack.at(-1).handle({ headers: {}, body, file: file === null ? undefined : file ?? { path: "/mock/no-file-read", originalname: "Replacement.png", mimetype: "image/png", size: 12 } }, response);
  return response;
}
function expectNoWrites() {
  expect(fixture.db.writes).toEqual([]);
  expect(fixture.storagePut).not.toHaveBeenCalled();
  expect(fixture.storagePutStream).not.toHaveBeenCalled();
}
beforeEach(() => {
  vi.clearAllMocks(); fixture.db = fakeDb();
  fixture.user = { id: 101, role: "org_admin", email: "same@example.test" };
  fixture.persistedRole = "org_admin";
  fixture.membership = { userId: 101, orgId: 7, role: "org_admin" };
  fixture.getDb.mockImplementation(async () => fixture.db);
  fixture.getUserById.mockImplementation(async userId => fixture.persistedRole === null ? undefined : { id: userId, role: fixture.persistedRole });
  fixture.getOrgMember.mockImplementation(async (orgId, userId) => fixture.membership?.orgId === orgId && fixture.membership?.userId === userId ? fixture.membership : undefined);
  fixture.storagePut.mockResolvedValue({ url: "https://cdn.test/mock-new.png" });
  fixture.storagePutStream.mockResolvedValue({ url: "https://cdn.test/historical.mp4" });
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network forbidden in media tests"); }));
});
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); expect(fixture.provider).not.toHaveBeenCalled(); vi.unstubAllGlobals(); });

describe("Course360 main-account media server isolation", () => {
  it("reads only an explicit persisted active selection and excludes inactive schools", async () => {
    expect(await getActiveOrgIdForUser(101)).toBe(7);
    expect(fixture.db.queries[0].params).toEqual([101, true]);
    fixture.db.rows.get(organizations)[0].isActive = false;
    expect(await getActiveOrgIdForUser(101)).toBeNull();
  });
  it("rejects all media procedures with no persisted selection rather than falling back", async () => {
    fixture.db.rows.set(userActiveOrg, []);
    for (const request of mediaRequests()) await expect(request()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(fixture.getOrgMember).not.toHaveBeenCalled(); expectNoWrites();
  });
  it.each(["site_owner", "site_admin", "admin", "member"])("does not grant school media through a stale session role %s", async role => {
    fixture.user.role = role; fixture.membership = null;
    for (const request of mediaRequests()) await expect(request()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expectNoWrites();
  });
  it.each(["site_owner", "site_admin"])("preserves persisted %s authority only in the explicitly selected school", async role => {
    fixture.persistedRole = role; fixture.membership = null; fixture.user.role = "member";
    expect(await caller().list({ orgId: 7 })).toMatchObject({ total: 1, items: [{ id: 44 }] });
    await caller().updateTags({ id: 44, tags: ["platform"] });
    expect(fixture.getOrgMember).not.toHaveBeenCalled();
    await expect(caller().list({ orgId: 8 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller().delete({ id: 55 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller().upload({ ...mediaInput, source: "course", sourceId: 31 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    fixture.db.rows.set(userActiveOrg, []);
    await expect(caller().upload(mediaInput)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(fixture.storagePut).not.toHaveBeenCalled();
  });
  it("fails closed for a deleted account and does not preserve legacy admin as a platform bypass", async () => {
    fixture.persistedRole = null;
    await expect(caller().list({ orgId: 7 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    fixture.persistedRole = "admin"; fixture.membership = null;
    await expect(caller().list({ orgId: 7 })).rejects.toMatchObject({ code: "FORBIDDEN" }); expectNoWrites();
  });
  it("does not share same-email accounts or read another user's selected organization", async () => {
    fixture.user.id = 102;
    for (const request of mediaRequests()) await expect(request()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expectNoWrites();
  });
  it("rejects member-only and different-school admin memberships", async () => {
    for (const membership of [{ userId: 101, orgId: 7, role: "member" }, { userId: 101, orgId: 8, role: "org_admin" }]) {
      fixture.membership = membership;
      for (const request of mediaRequests()) await expect(request()).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expectNoWrites();
  });
  it.each(["org_super_admin", "org_admin", "sub_admin"])("retains administrator media access for membership %s with no app subscription", async role => {
    fixture.membership.role = role;
    const result = await caller().list({ orgId: 7, mimeType: "video/", tag: "school", pageSize: 200 });
    expect(result).toMatchObject({ total: 1, items: [{ id: 44, fileKey: "historical/unscoped-key.mp4" }] });
    expect(fixture.getOrgMember).toHaveBeenCalledWith(7, 101);
    expect(fixture.db.queries.map((q: any) => q.table)).toEqual([userActiveOrg, orgMediaLibrary]);
  });
  it("treats all provided org hints as consistency only", async () => {
    const requests = [() => caller().list({ orgId: 8 }), () => caller().upload({ ...mediaInput, orgId: 8 }), () => caller().updateTags({ id: 44, orgId: 8, tags: [] }), () => caller().delete({ id: 44, orgId: 8 })];
    for (const request of requests) await expect(request()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(fixture.db.queries.every((q: any) => q.table === userActiveOrg)).toBe(true); expectNoWrites();
  });
  it.each([55, 999])("rejects foreign/missing media child ID %s before update or delete", async id => {
    await expect(caller().updateTags({ id, tags: [] })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller().delete({ id })).rejects.toMatchObject({ code: "NOT_FOUND" }); expectNoWrites();
    for (const query of fixture.db.queries.filter((q: any) => q.table === orgMediaLibrary)) {
      expect(query.sql).toContain("`org_media_library`.`orgId` = ?"); expect(query.params).toEqual([id, 7]);
    }
  });
  it("preserves tag mutation and metadata-only delete while scoping final writes", async () => {
    await caller().updateTags({ id: 44, tags: ["revised"], altText: "Caption" });
    expect(fixture.db.rows.get(orgMediaLibrary)[0]).toMatchObject({ tags: '["revised"]', altText: "Caption" });
    await caller().delete({ id: 44 });
    expect(fixture.db.rows.get(orgMediaLibrary).map((row: any) => row.id)).toEqual([55]);
    for (const write of fixture.db.writes) expect(write.params).toEqual([44, 7]);
    expect(fixture.storagePut).not.toHaveBeenCalled(); expect(fixture.storagePutStream).not.toHaveBeenCalled();
  });
  it("uploads to server-owned namespace, ignores forged uploader/size, and retains paginated response", async () => {
    const uploaded = await caller().upload({ ...mediaInput, uploadedBy: 102, fileSize: 999 } as any);
    expect(uploaded).toMatchObject({ id: 90, orgId: 7, uploadedBy: 101, fileSize: 5, source: "direct" });
    expect(fixture.storagePut.mock.calls[0][0]).toMatch(/^org-media\/7\//);
    expect(await caller().list({ orgId: 7, mimeType: "image/", page: 1, pageSize: 1 })).toMatchObject({ total: 1, items: [{ id: 90 }] });
  });
  it.each([["form", 21], ["course", 31], ["form", 999], ["course", 999]] as const)("validates %s source child %s before storage", async (source, sourceId) => {
    await expect(caller().upload({ ...mediaInput, source, sourceId })).rejects.toMatchObject({ code: "NOT_FOUND" }); expectNoWrites();
  });
  it.each([["form", 20], ["course", 30]] as const)("accepts active-school %s source %s", async (source, sourceId) => {
    expect(await caller().upload({ ...mediaInput, source, sourceId })).toMatchObject({ source, sourceId, orgId: 7 });
  });
  it.each(["direct", "other"] as const)("rejects unvalidated sourceId for %s", async source => {
    await expect(caller().upload({ ...mediaInput, source, sourceId: 55 })).rejects.toMatchObject({ code: "BAD_REQUEST" }); expectNoWrites();
  });
  it("rejects malformed child IDs and pagination before queries", async () => {
    await expect(caller().updateTags({ id: -1, tags: [] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller().delete({ id: 1.5 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller().list({ orgId: 7, page: 0 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(fixture.getDb).not.toHaveBeenCalled(); expectNoWrites();
  });
});

describe("Course360 main-account multipart media handlers", () => {
  it("stores new upload under persisted school prefix and normalizes folder as an object-key segment", async () => {
    const response = await multipart("/", { orgId: "7", folder: "Course Images / Banners" });
    expect(response.code).toBe(200); expect(response.payload.key).toMatch(/^org-7\/course-images-banners\//);
    expect(fixture.storagePutStream).toHaveBeenCalledWith(response.payload.key, "/mock/no-file-read", "image/png");
  });
  it.each(["/", "/replace"] as const)("denies no selection, foreign hint and missing membership for %s", async path => {
    fixture.db.rows.set(userActiveOrg, []);
    expect((await multipart(path, { mediaItemId: "44" })).code).toBe(403);
    fixture.db.rows.set(userActiveOrg, [{ userId: 101, orgId: 7 }]);
    expect((await multipart(path, { mediaItemId: "44", orgId: "8" })).code).toBe(403);
    fixture.membership = null; fixture.user.role = "site_owner";
    expect((await multipart(path, { mediaItemId: "44" })).code).toBe(403); expectNoWrites();
  });
  it.each(["site_owner", "site_admin"])("preserves persisted %s selected-school multipart authority without cross-school access", async role => {
    fixture.persistedRole = role; fixture.membership = null;
    expect((await multipart("/", { orgId: "7" })).code).toBe(200);
    expect((await multipart("/replace", { mediaItemId: "44" })).code).toBe(200);
    expect((await multipart("/", { orgId: "8" })).code).toBe(403);
    expect((await multipart("/replace", { mediaItemId: "55" })).code).toBe(404);
    expect(fixture.storagePutStream).toHaveBeenCalledTimes(2);
    fixture.db.rows.set(userActiveOrg, []);
    expect((await multipart("/")).code).toBe(403);
  });
  it.each(["bad", "1.5", "-7", ["7"], true])("rejects invalid organization hint %s", async orgId => {
    expect((await multipart("/", { orgId })).code).toBe(400); expectNoWrites();
  });
  it.each(["0", "-1", "1.5", "NaN", ["44"]])("rejects invalid replacement ID %s before lookup/write", async mediaItemId => {
    expect((await multipart("/replace", { mediaItemId })).code).toBe(400); expectNoWrites();
  });
  it("does not replace another school's or missing child item", async () => {
    expect((await multipart("/replace", { mediaItemId: "55" })).code).toBe(404);
    expect((await multipart("/replace", { mediaItemId: "999" })).code).toBe(404); expectNoWrites();
  });
  it.each(["org-8/media/file.png", "org-media/8/file.png", "lms-media/8/file.png"])("rejects an owned row pointing to another school's scoped key %s", async fileKey => {
    fixture.db.rows.get(orgMediaLibrary)[0].fileKey = fileKey;
    expect((await multipart("/replace", { mediaItemId: "44" })).code).toBe(403); expectNoWrites();
  });
  it.each(["org-7/media/file.png", "org-media/7/file.png", "lms-media/7/file.png"])("retains same-school historical scoped key %s", async fileKey => {
    fixture.db.rows.get(orgMediaLibrary)[0].fileKey = fileKey;
    expect((await multipart("/replace", { mediaItemId: "44" })).payload.key).toBe(fileKey);
  });
  it("retains historical object key/URL during valid replacement and tenant-scopes lookup/update", async () => {
    const response = await multipart("/replace", { orgId: "7", mediaItemId: "44", folderId: "foreign-ignored" });
    expect(response.code).toBe(200);
    expect(response.payload).toMatchObject({ key: "historical/unscoped-key.mp4", url: "https://cdn.test/historical.mp4", fileName: "Replacement.png", fileSize: 12 });
    expect(fixture.db.queries.at(-1).params).toEqual([44, 7]);
    expect(fixture.db.writes[0].params).toEqual([44, 7]);
    expect(fixture.db.rows.get(orgMediaLibrary)[0].folderId).toBeUndefined();
  });
  it("returns authentication, missing-file and database-unavailable errors without storage", async () => {
    fixture.user = null; expect((await multipart("/")).code).toBe(401);
    fixture.user = { id: 101 }; expect((await multipart("/", {}, null)).code).toBe(400);
    fixture.getDb.mockResolvedValue(null); expect((await multipart("/")).code).toBe(503); expectNoWrites();
  });
  it("fails closed when persisted school is inactive", async () => {
    fixture.db.rows.get(organizations)[0].isActive = false;
    expect((await multipart("/")).code).toBe(403); expectNoWrites();
  });
});
