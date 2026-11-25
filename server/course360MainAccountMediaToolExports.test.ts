import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTableColumns, getTableName } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { TRPCError } from "@trpc/server";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import JSZip from "jszip";
import * as schema from "../drizzle/schema";

const mocks = vi.hoisted(() => ({
  db: null as any,
  user: { id: 101, role: "org_admin" } as any,
  activeOrg: 7 as number | null,
  membershipRole: "org_admin",
  membershipOrg: 7, membershipUser: 101, memberSubRole: null as string | null,
  organizationActive: true,
  appActive: true,
  organization: vi.fn(), capability: vi.fn(), supportAudit: vi.fn(),
  usedBytes: 0,
  maxBytes: 100 * 1024 * 1024 * 1024,
  getUser: vi.fn(), resolveOrg: vi.fn(), admin: vi.fn(), usage: vi.fn(),
  savedOrg: vi.fn(),
  mediaGuard: vi.fn(),
  storage: vi.fn(), creator: vi.fn(), generate: vi.fn(),
  external: vi.fn(() => { throw new Error("Network/provider access denied in isolated export tests"); }),
}));
vi.mock("./db", () => ({
  getDb: async () => mocks.db,
  getUserById: mocks.getUser,
  getOrgIdForUserWithFallback: mocks.resolveOrg,
  requireOrgAdmin: mocks.admin,
  getOrgStorageUsage: mocks.usage,
}));
vi.mock("./formsRouter", () => ({ getActiveOrgIdForUser: mocks.savedOrg, requireActiveMediaOrganization: mocks.mediaGuard }));
vi.mock("./storage", () => ({ storagePut: mocks.storage }));
vi.mock("./lib/course360PaymentLedger", () => ({
  getCourse360PaymentAppAccess: mocks.creator,
  setCourse360PaymentManualRole: mocks.external,
}));
vi.mock("./lib/course360AppCapabilities", () => ({
  requireCourse360AppOrganization: mocks.organization,
  requireCourse360AppCapability: mocks.capability,
}));
vi.mock("./_core/llm", () => ({ invokeLLM: mocks.external }));
vi.mock("./lib/publicSourceUrl", () => ({ fetchPublicSourceText: mocks.external }));
vi.mock("./scormGenerator", () => ({ generateScormPackage: mocks.generate }));
const { authoringRouter } = await import("./authoringRouter");
const { quizMakerRouter } = await import("./quizMakerRouter");
const realGenerator = await vi.importActual<typeof import("./scormGenerator")>("./scormGenerator");

const dialect = new MySqlDialect();
class MemoryDb {
  rows = new Map<string, any[]>();
  writes: { kind: string; table: string; values: any }[] = [];
  failInsert = false;
  insertId: any = 901;
  failUpdate = false;
  table(table: any) { return this.rows.get(getTableName(table)) ?? []; }
  seed(table: any, rows: any[]) {
    for (const row of rows) for (const key of Object.keys(row)) if (!(key in getTableColumns(table))) throw new Error(`Unknown fixture field ${getTableName(table)}.${key}`);
    this.rows.set(getTableName(table), structuredClone(rows));
  }
  matches(table: any, row: any, condition: any) {
    if (!condition) throw new Error("Unscoped mock DB access denied");
    const query = dialect.sqlToQuery(condition);
    const columns = getTableColumns(table);
    const reverse = Object.fromEntries(Object.entries(columns).map(([key, col]: any) => [col.name, key]));
    const terms = [...query.sql.matchAll(/`[^`]+`\.`([^`]+)`\s*=\s*\?/g)];
    if (terms.length !== query.params.length) throw new Error(`Unsupported mock predicate: ${query.sql}`);
    return terms.every((term, index) => row[reverse[term[1]]] === query.params[index]);
  }
  select() {
    let table: any, condition: any, limit = Infinity;
    const chain: any = {
      from: (value: any) => { table = value; return chain; },
      where: (value: any) => { condition = value; return chain; },
      limit: (value: number) => { limit = value; return chain; },
      orderBy: () => chain,
      then: (resolve: any, reject: any) => Promise.resolve().then(() =>
        structuredClone(this.table(table).filter(row => this.matches(table, row, condition)).slice(0, limit)),
      ).then(resolve, reject),
    };
    return chain;
  }
  insert(table: any) {
    return { values: async (values: any) => {
      if (table !== schema.orgMediaLibrary) throw new Error("Unexpected table insert");
      if (this.failInsert) throw new Error("Injected media persistence failure");
      for (const key of Object.keys(values)) if (!(key in getTableColumns(table))) throw new Error(`Unknown metadata field ${key}`);
      this.writes.push({ kind: "insert", table: getTableName(table), values: structuredClone(values) });
      this.rows.set(getTableName(table), [...this.table(table), { id: this.insertId, ...structuredClone(values) }]);
      return [{ insertId: this.insertId }];
    } };
  }
  update(table: any) { return { set: (values: any) => ({ where: async (condition: any) => {
    if (this.failUpdate) throw new Error("Injected publication update failure");
    for (const key of Object.keys(values)) if (!(key in getTableColumns(table))) throw new Error(`Unknown update field ${key}`);
    this.writes.push({ kind: "update", table: getTableName(table), values: structuredClone(values) });
    let affectedRows = 0;
    for (const row of this.table(table)) if (this.matches(table, row, condition)) { Object.assign(row, values); affectedRows++; }
    return [{ affectedRows }];
  } }) }; }
}
let db: MemoryDb;
const context = (role = "org_admin") => ({ user: { id: 101, role }, req: {}, res: {} } as any);
const creatorCaller = (role?: string) => authoringRouter.createCaller(context(role));
const quizCaller = (role?: string) => quizMakerRouter.createCaller(context(role));
const questions = [{ id: "q1", type: "multiple_choice", stem: "Safe locally generated question", points: 1, data: { options: [{ id: "a", text: "Answer", correct: true }] } }];
function seedQuiz(more: any = {}) {
  db.seed(schema.quizzes, [{ id: 5, orgId: 7, userId: 101, legacyCreatedBy: 101, title: "Stored quiz", description: "Preserved", instructions: JSON.stringify(questions), legacyPassingScore: 80, passScorePercent: 80, timeLimitSeconds: null, legacyShuffleQuestions: false, randomizeQuestions: false, ...more }]);
}
const tools = [
  { name: "Creator", run: (save: boolean | undefined = true, role?: string, format = "scorm12") => creatorCaller(role).exportPackage({ projectId: 4, format: format as any, ...(save === undefined ? {} : { saveToMediaLibrary: save }) }), source: schema.authoringProjects, sourceId: 4, prefix: "creator-exports" },
  { name: "Quiz Creator", run: (save: boolean | undefined = true, role?: string, format = "scorm12") => quizCaller(role).exportScorm({ quizId: 5, format: format as any, ...(save === undefined ? {} : { saveToMediaLibrary: save }) }), source: schema.quizzes, sourceId: 5, prefix: "quiz-exports" },
];

beforeEach(() => {
  vi.clearAllMocks();
  const denied = mocks.external as any;
  vi.stubGlobal("fetch", denied);
  vi.spyOn(http, "request").mockImplementation(denied);
  vi.spyOn(http, "get").mockImplementation(denied);
  vi.spyOn(https, "request").mockImplementation(denied);
  vi.spyOn(https, "get").mockImplementation(denied);
  vi.spyOn(net.Socket.prototype, "connect").mockImplementation(denied);
  for (const key of ["DATABASE_URL", "STRIPE_SECRET_KEY", "COURSE360_STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION", "AWS_S3_BUCKET", "BUILT_IN_FORGE_API_KEY", "BUILT_IN_FORGE_API_URL", "OPENAI_API_KEY", "JWT_SECRET"]) vi.stubEnv(key, "");
  mocks.user = { id: 101, role: "org_admin" }; mocks.activeOrg = 7; mocks.membershipRole = "org_admin";
  mocks.membershipOrg = 7; mocks.membershipUser = 101; mocks.memberSubRole = null;
  mocks.organizationActive = true; mocks.appActive = true;
  mocks.usedBytes = 0; mocks.maxBytes = 100 * 1024 * 1024 * 1024;
  db = new MemoryDb(); mocks.db = db;
  db.seed(schema.authoringProjects, [{ id: 4, userId: 101, orgId: 7, title: "Stored course", status: "draft", description: "Preserved", settingsJson: "{}" }]);
  db.seed(schema.authoringSlides, [{ id: 12, projectId: 4, title: "Slide", slideIndex: 0, contentJson: '{"blocks":[]}', background: "#fff", notes: "Keep me" }]);
  db.seed(schema.orgMediaLibrary, [{ id: 10, orgId: 7, filename: "grandfathered.zip", fileKey: "legacy/key", url: "https://legacy.example.test/old.zip" }]);
  seedQuiz();
  mocks.getUser.mockImplementation(async () => mocks.user);
  mocks.resolveOrg.mockImplementation(async () => mocks.activeOrg);
  mocks.savedOrg.mockImplementation(async () => mocks.activeOrg);
  mocks.admin.mockImplementation(async (_id, role, orgId) => {
    if (!['site_owner', 'site_admin', 'admin'].includes(role) && (mocks.membershipOrg !== orgId || mocks.membershipUser !== _id || !['org_super_admin', 'org_admin', 'sub_admin'].includes(mocks.membershipRole))) throw new TRPCError({ code: "FORBIDDEN" });
    return orgId ?? mocks.activeOrg;
  });
  mocks.organization.mockImplementation(async (userId: number, requestedOrgId?: number) => {
    if (!mocks.db) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "School access service is unavailable." });
    const orgId = await mocks.savedOrg(userId);
    if (!orgId || !mocks.organizationActive || requestedOrgId !== undefined && requestedOrgId !== orgId) throw new TRPCError({ code: "FORBIDDEN" });
    const user = await mocks.getUser(userId);
    if (!user || user.id !== userId) throw new TRPCError({ code: "FORBIDDEN" });
    const platformSupport = ['site_owner', 'site_admin'].includes(user.role);
    const member = mocks.membershipOrg === orgId && mocks.membershipUser === userId
      ? { role: mocks.membershipRole, memberSubRole: mocks.memberSubRole } : null;
    if (!platformSupport && (!member || !['org_super_admin', 'org_admin', 'sub_admin'].includes(member.role) && member.memberSubRole !== 'instructor')) throw new TRPCError({ code: "FORBIDDEN" });
    return { orgId, platformSupport, member };
  });
  mocks.supportAudit.mockResolvedValue(undefined);
  mocks.capability.mockImplementation(async (userId: number, app: string, mode: string) => {
    if (!['creator', 'quiz_creator'].includes(app) || mode !== 'web') throw new Error('Unexpected app capability: Studio never owns this library');
    const scope = await mocks.organization(userId);
    if (scope.platformSupport) await mocks.supportAudit({ userId, orgId: scope.orgId, app, mode });
    else if (!mocks.appActive) throw new TRPCError({ code: 'FORBIDDEN' });
    const provenance = scope.platformSupport ? { isPaid: false, hasManualGrant: false } : await mocks.creator(scope.orgId, userId, app);
    return { ...scope, ...provenance, schoolIncluded: false, access: { tier: 'web', isActive: true, isInTrial: !provenance.isPaid && !provenance.hasManualGrant && !scope.platformSupport, ...provenance } };
  });
  mocks.mediaGuard.mockImplementation(async (userId) => {
    const user = await mocks.getUser(userId);
    if (!user) throw new TRPCError({ code: "FORBIDDEN" });
    const orgId = await mocks.savedOrg(userId);
    if (!orgId) throw new TRPCError({ code: "FORBIDDEN" });
    await mocks.admin(userId, user.role, orgId);
    if (!['site_owner', 'site_admin'].includes(user.role) && !['org_super_admin', 'org_admin', 'sub_admin'].includes(mocks.membershipRole)) throw new TRPCError({ code: "FORBIDDEN" });
    return orgId;
  });
  mocks.usage.mockImplementation(async () => ({ usedBytes: mocks.usedBytes, maxBytes: mocks.maxBytes }));
  mocks.creator.mockResolvedValue({ isPaid: false, hasManualGrant: false });
  mocks.storage.mockImplementation(async (key: string) => ({ key, url: `https://storage.example.test/${key}` }));
  mocks.generate.mockImplementation(realGenerator.generateScormPackage);
});
afterEach(() => {
  expect(mocks.external).not.toHaveBeenCalled();
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
});

for (const tool of tools) describe(`${tool.name} main-account Media Library export`, () => {
  it.each([undefined, false])("preserves download-only export when save flag is %s", async (save) => {
    // Supply an explicit omitted input; the helper default is true.
    const result = tool.name === "Creator"
      ? await creatorCaller().exportPackage({ projectId: 4, format: "scorm12", ...(save === undefined ? {} : { saveToMediaLibrary: save }) })
      : await quizCaller().exportScorm({ quizId: 5, format: "scorm12", ...(save === undefined ? {} : { saveToMediaLibrary: save }) });
    expect(result).not.toHaveProperty("mediaItemId");
    expect(mocks.storage.mock.calls[0][0]).toMatch(tool.name === "Creator" ? /^authoring\/101\/exports\// : /^scorm-exports\/101\//);
    // Central author guard rereads persisted identity; downloads still bypass library authority/quota.
    expect(mocks.getUser).toHaveBeenCalledWith(101); expect(mocks.mediaGuard).not.toHaveBeenCalled(); expect(mocks.usage).not.toHaveBeenCalled();
    expect(mocks.capability).toHaveBeenCalledWith(101, tool.name === "Creator" ? "creator" : "quiz_creator", "web");
    expect(db.table(schema.orgMediaLibrary)).toHaveLength(1);
    if (tool.name === "Creator") expect(result).toEqual({ url: expect.any(String), format: "scorm12", warnings: [] });
    else expect(result).toEqual({ downloadUrl: expect.any(String) });
  });
  it.each(["scorm12", "scorm2004"])("saves generated %s ZIP and exact metadata without Studio access", async (format) => {
    const oldItem = structuredClone(db.table(schema.orgMediaLibrary)[0]);
    const source = structuredClone(db.table(tool.source)[0]);
    const slides = structuredClone(db.table(schema.authoringSlides));
    const result = await tool.run(true, "site_owner", format);
    expect(result.mediaItemId).toBe(901);
    expect(mocks.savedOrg).toHaveBeenCalledWith(101);
    expect(mocks.resolveOrg).not.toHaveBeenCalled();
    expect(mocks.admin).toHaveBeenCalledWith(101, "org_admin", 7);
    expect(mocks.usage).toHaveBeenCalledWith(7);
    const [key, bytes, mimeType] = mocks.storage.mock.calls[0];
    expect(key).toMatch(new RegExp(`^org-7/media/${tool.prefix}/${tool.sourceId}-${format}-[A-Za-z0-9_-]{16}\\.zip$`));
    expect(Buffer.isBuffer(bytes)).toBe(true); expect(mimeType).toBe("application/zip");
    const zip = await JSZip.loadAsync(bytes);
    expect(zip.file("imsmanifest.xml")).not.toBeNull(); expect(zip.file("index.html")).not.toBeNull();
    const manifest = await zip.file("imsmanifest.xml")!.async("string");
    expect(manifest).toContain(format === "scorm12" ? "1.2" : "2004");
    expect(db.table(schema.orgMediaLibrary)[1]).toMatchObject({ id: 901, orgId: 7, uploadedBy: 101, mimeType, fileSize: bytes.length, fileKey: key, url: `https://storage.example.test/${key}`, source: "other", sourceId: tool.sourceId });
    expect(db.table(schema.orgMediaLibrary)[0]).toEqual(oldItem);
    expect(db.table(schema.authoringSlides)).toEqual(slides);
    if (tool.name === "Quiz Creator") expect(db.table(tool.source)[0]).toEqual(source);
    else {
      expect(db.table(tool.source)[0]).toEqual({ ...source, status: "published", lastPublishedFormat: format, lastPublishedUrl: (result as any).url });
      expect(mocks.creator).toHaveBeenCalledWith(7, 101, "creator");
      expect(await zip.file("index.html")!.async("string")).toContain("teachific-watermark");
    }
  });
  it("rejects same-user foreign-org content even if administrator guard would authorize both schools", async () => {
    db.table(tool.source)[0].orgId = 8;
    const original = structuredClone(db.table(tool.source));
    await expect(tool.run()).rejects.toMatchObject({ code: tool.name === "Creator" ? "NOT_FOUND" : "FORBIDDEN" });
    expect(db.table(tool.source)).toEqual(original); expect(db.writes).toEqual([]);
    expect(mocks.storage).not.toHaveBeenCalled(); expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("fails closed with no persisted active organization", async () => {
    mocks.activeOrg = null;
    await expect(tool.run()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.admin).not.toHaveBeenCalled(); expect(mocks.storage).not.toHaveBeenCalled(); expect(db.writes).toEqual([]);
  });
  it("does not select a valid fallback school when saved active organization is absent", async () => {
    mocks.activeOrg = null;
    mocks.resolveOrg.mockResolvedValue(7);
    await expect(tool.run()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.resolveOrg).not.toHaveBeenCalled();
    expect(mocks.storage).not.toHaveBeenCalled(); expect(db.writes).toEqual([]);
  });
  it("fails closed when persisted user is unavailable", async () => {
    mocks.user = null;
    await expect(tool.run()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.resolveOrg).not.toHaveBeenCalled(); expect(mocks.storage).not.toHaveBeenCalled();
  });
  it.each(["member", "user", "instructor", "group_manager"])("rejects %s membership despite a forged/stale Creator session role", async (role) => {
    mocks.user.role = "user"; mocks.membershipRole = role;
    await expect(tool.run(true, "site_owner")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.getUser).toHaveBeenCalledWith(101); expect(mocks.organization).toHaveBeenCalledWith(101);
    expect(mocks.user.role).toBe("user"); expect(mocks.admin).not.toHaveBeenCalled();
    expect(mocks.storage).not.toHaveBeenCalled(); expect(db.writes).toEqual([]);
  });
  it.each(["org_super_admin", "org_admin", "sub_admin"])("uses existing media guard for %s", async (role) => {
    mocks.membershipRole = role;
    await expect(tool.run()).resolves.toHaveProperty("mediaItemId", 901);
  });
  it.each(["site_owner", "site_admin"])("retains persisted %s authority in the explicitly selected school without a membership row", async (role) => {
    mocks.user.role = role; mocks.membershipRole = "member";
    await expect(tool.run(true, "user")).resolves.toHaveProperty("mediaItemId", 901);
    expect(mocks.mediaGuard).toHaveBeenCalledWith(101);
    expect(mocks.resolveOrg).not.toHaveBeenCalled();
  });
  it("does not treat a persisted legacy admin label as global media authority", async () => {
    mocks.user.role = "admin"; mocks.membershipRole = "member";
    await expect(tool.run()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.storage).not.toHaveBeenCalled(); expect(db.writes).toEqual([]);
  });
  it("fails closed before upload when main SCHOOL storage is full", async () => {
    mocks.usedBytes = 100; mocks.maxBytes = 100;
    await expect(tool.run()).rejects.toMatchObject({ code: "FORBIDDEN", message: expect.stringContaining("main account") });
    expect(mocks.storage).not.toHaveBeenCalled(); expect(db.writes).toEqual([]);
  });
  it("honors existing unlimited main account storage", async () => {
    mocks.maxBytes = -1;
    await expect(tool.run()).resolves.toHaveProperty("mediaItemId", 901);
  });
  it.each([{ usedBytes: NaN, maxBytes: 1 }, { usedBytes: -1, maxBytes: 1 }, { usedBytes: 0, maxBytes: -2 }])("fails closed for invalid usage %j", async (usage) => {
    Object.assign(mocks, usage);
    await expect(tool.run()).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(mocks.storage).not.toHaveBeenCalled(); expect(db.writes).toEqual([]);
  });
  it("propagates storage failure without media metadata or publication changes", async () => {
    const source = structuredClone(db.table(tool.source));
    mocks.storage.mockRejectedValue(new Error("Injected upload failure"));
    await expect(tool.run()).rejects.toThrow("Injected upload failure");
    expect(db.table(tool.source)).toEqual(source); expect(db.writes).toEqual([]);
  });
  it("does not pretend success when media insertion fails", async () => {
    const source = structuredClone(db.table(tool.source)); db.failInsert = true;
    await expect(tool.run()).rejects.toThrow("Injected media persistence failure");
    expect(db.table(tool.source)).toEqual(source); expect(db.table(schema.orgMediaLibrary)).toHaveLength(1);
  });
  it.each([undefined, 0, -1, "invalid"])("rejects missing/invalid successful insert ID %s", async (id) => {
    db.insertId = id;
    await expect(tool.run()).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(db.writes.filter(write => write.kind === "update")).toEqual([]);
  });
  it("rejects a storage success response missing its URL", async () => {
    mocks.storage.mockResolvedValue({ key: "ignored" });
    await expect(tool.run()).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" }); expect(db.writes).toEqual([]);
  });
  it("rejects unavailable DB without invoking a provider", async () => {
    mocks.db = null;
    // Quiz now reaches the central unavailable-school service guard first.
    await expect(tool.run()).rejects.toMatchObject({ code: tool.name === "Creator" ? "INTERNAL_SERVER_ERROR" : "PRECONDITION_FAILED" });
    expect(mocks.storage).not.toHaveBeenCalled(); expect(db.writes).toEqual([]);
  });
  it("rejects an unauthenticated caller", async () => {
    const caller = (tool.name === "Creator" ? authoringRouter : quizMakerRouter).createCaller({ user: null, req: {}, res: {} } as any) as any;
    await expect(tool.name === "Creator" ? caller.exportPackage({ projectId: 4, format: "scorm12", saveToMediaLibrary: true }) : caller.exportScorm({ quizId: 5, format: "scorm12", saveToMediaLibrary: true })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.getUser).not.toHaveBeenCalled(); expect(mocks.storage).not.toHaveBeenCalled();
  });
  it("rejects an inactive persisted selected organization", async () => {
    mocks.organizationActive = false;
    await expect(tool.run()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.storage).not.toHaveBeenCalled(); expect(mocks.mediaGuard).not.toHaveBeenCalled(); expect(db.writes).toEqual([]);
  });
  it.each(["membershipOrg", "membershipUser"] as const)("rejects stale/foreign %s without trusting session role", async (key) => {
    mocks[key] = key === "membershipOrg" ? 8 : 202;
    await expect(tool.run(true, "site_owner")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.getUser).toHaveBeenCalledWith(101); expect(mocks.storage).not.toHaveBeenCalled(); expect(db.writes).toEqual([]);
  });
  it("author instructor subrole does not bypass the independent main-library admin guard", async () => {
    mocks.user.role = "user"; mocks.membershipRole = "member"; mocks.memberSubRole = "instructor";
    await expect(tool.run(false)).resolves.toBeDefined();
    const before = structuredClone(db.table(tool.source)); db.writes.length = 0; mocks.storage.mockClear();
    await expect(tool.run(true)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.admin).toHaveBeenCalledWith(101, "user", 7); expect(mocks.storage).not.toHaveBeenCalled();
    expect(db.table(tool.source)).toEqual(before); expect(db.writes).toEqual([]);
  });
  it("inactive app access denies export before optional library authority without consulting Studio", async () => {
    mocks.appActive = false;
    await expect(tool.run()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.capability).toHaveBeenCalledWith(101, tool.name === "Creator" ? "creator" : "quiz_creator", "web");
    expect(mocks.mediaGuard).not.toHaveBeenCalled(); expect(mocks.storage).not.toHaveBeenCalled(); expect(db.writes).toEqual([]);
  });
  it("persisted support audit failure blocks export without fabricating paid/manual provenance", async () => {
    mocks.user.role = "site_owner"; mocks.membershipRole = "member";
    mocks.supportAudit.mockRejectedValueOnce(new Error("Support audit failed"));
    await expect(tool.run()).rejects.toThrow("Support audit failed");
    expect(mocks.supportAudit).toHaveBeenCalledWith({ userId: 101, orgId: 7, app: tool.name === "Creator" ? "creator" : "quiz_creator", mode: "web" });
    expect(mocks.creator).not.toHaveBeenCalled(); expect(mocks.storage).not.toHaveBeenCalled(); expect(db.writes).toEqual([]);
  });
  it("rejects changed persisted school between app capability and library authority before any writes", async () => {
    // A persisted school switch can occur between awaits, not just in a browser hint.
    // Both schools have admin permission, but authorization for 7 cannot export 8.
    const mediaGuard = mocks.mediaGuard.getMockImplementation()!;
    mocks.mediaGuard.mockImplementation(async (userId: number) => {
      mocks.activeOrg = 8; mocks.membershipOrg = 8;
      return mediaGuard(userId);
    });
    db.table(tool.source)[0].orgId = 8;
    const original = structuredClone(db.table(tool.source));
    await expect(tool.run()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.table(tool.source)).toEqual(original); expect(mocks.storage).not.toHaveBeenCalled(); expect(db.writes).toEqual([]);
  });
});

describe("special-case preservation and failure behavior", () => {
  it.each([0, null, undefined, -1])("never adopts org-less/invalid-org Quiz records during a library save: %s", async (orgId) => {
    seedQuiz({ orgId }); const oldQuiz = structuredClone(db.table(schema.quizzes));
    await expect(quizCaller().exportScorm({ quizId: 5, format: "scorm12", saveToMediaLibrary: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.table(schema.quizzes)).toEqual(oldQuiz); expect(db.writes).toEqual([]); expect(mocks.generate).not.toHaveBeenCalled(); expect(mocks.storage).not.toHaveBeenCalled();
  });
  it("default Quiz download also rejects legacy unscoped records without adoption or content changes", async () => {
    seedQuiz({ orgId: 0 }); const original = structuredClone(db.table(schema.quizzes));
    await expect(quizCaller().exportScorm({ quizId: 5, format: "scorm12" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.table(schema.quizzes)).toEqual(original); expect(db.table(schema.orgMediaLibrary)).toHaveLength(1);
    expect(mocks.getUser).toHaveBeenCalledWith(101); expect(mocks.storage).not.toHaveBeenCalled(); expect(mocks.generate).not.toHaveBeenCalled(); expect(db.writes).toEqual([]);
  });
  it.each(["[]", "malformed", "{}"])("retains quiz question validation and makes no persistence for %s", async (instructions) => {
    seedQuiz({ instructions });
    await expect(quizCaller().exportScorm({ quizId: 5, format: "scorm12", saveToMediaLibrary: true })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.storage).not.toHaveBeenCalled(); expect(mocks.generate).not.toHaveBeenCalled(); expect(db.writes).toEqual([]);
  });
  it("preserves SCORM generation failure instead of claiming library save", async () => {
    mocks.generate.mockRejectedValue(new Error("Injected generation failure"));
    await expect(quizCaller().exportScorm({ quizId: 5, format: "scorm12", saveToMediaLibrary: true })).rejects.toThrow("Injected generation failure");
    expect(mocks.storage).not.toHaveBeenCalled(); expect(db.writes).toEqual([]);
  });
  it("preserves Creator HTML5 export and root library metadata", async () => {
    const result = await creatorCaller().exportPackage({ projectId: 4, format: "html5", saveToMediaLibrary: true });
    expect(result).toMatchObject({ format: "html5", mediaItemId: 901 });
    const zip = await JSZip.loadAsync(mocks.storage.mock.calls[0][1]);
    expect(zip.file("index.html")).not.toBeNull(); expect(zip.file("imsmanifest.xml")).toBeNull();
    expect(db.table(schema.orgMediaLibrary)[1]).not.toHaveProperty("folderId");
  });
  it("does not authorize a different user's Creator project", async () => {
    db.table(schema.authoringProjects)[0].userId = 202;
    await expect(creatorCaller().exportPackage({ projectId: 4, format: "scorm12", saveToMediaLibrary: true })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.storage).not.toHaveBeenCalled(); expect(db.writes).toEqual([]);
  });
  it("preserves organization-admin Quiz authoring permission for another author in the same school", async () => {
    seedQuiz({ userId: 202 });
    await expect(quizCaller().exportScorm({ quizId: 5, format: "scorm12", saveToMediaLibrary: true })).resolves.toHaveProperty("mediaItemId", 901);
    expect(db.table(schema.quizzes)[0].userId).toBe(202);
  });
  it("preserves Creator publication failure as a rejected export", async () => {
    db.failUpdate = true;
    await expect(creatorCaller().exportPackage({ projectId: 4, format: "scorm12", saveToMediaLibrary: true })).rejects.toThrow("Injected publication update failure");
    expect(db.table(schema.authoringProjects)[0].status).toBe("draft");
  });
  it("ignores browser URLs/foreign media IDs rather than registering or reassigning them", async () => {
    await creatorCaller().exportPackage({ projectId: 4, format: "scorm12", saveToMediaLibrary: true, orgId: 8, mediaItemId: 10, fileKey: "org-8/foreign.zip", url: "https://foreign.example.test" } as any);
    expect(db.table(schema.orgMediaLibrary)[0].fileKey).toBe("legacy/key");
    expect(db.table(schema.orgMediaLibrary)[1].orgId).toBe(7);
    expect(mocks.storage.mock.calls[0][0]).toMatch(/^org-7\//);
    expect(db.table(schema.orgMediaLibrary)[1].url).not.toBe("https://foreign.example.test");
  });
  it.each([{ isPaid: true, hasManualGrant: false }, { isPaid: false, hasManualGrant: true }])("retains paid/manual Creator watermark provenance %j independently of library ownership", async (provenance) => {
    mocks.creator.mockResolvedValue(provenance);
    await creatorCaller().exportPackage({ projectId: 4, format: "scorm12", saveToMediaLibrary: true });
    const zip = await JSZip.loadAsync(mocks.storage.mock.calls[0][1]);
    expect(await zip.file("index.html")!.async("string")).not.toContain('id="teachific-watermark"');
    expect(mocks.creator).toHaveBeenCalledWith(7, 101, "creator");
    expect(db.table(schema.orgMediaLibrary)[1].orgId).toBe(7);
    expect(provenance.isPaid).toBe(!provenance.hasManualGrant);
  });
  it("native Quiz theme JSON and precise settings/media survive generated library export unchanged", async () => {
    const nativeQuestions = [{ id: "native-q", type: "mcq", stem: "Retained precise question", points: 0.25, data: { multiSelect: false, choices: [{ id: "a", text: "Answer", correct: true }], imageUrl: "https://legacy.example.test/keep.png" } }];
    const meta = { id: "native-uuid", title: "Stored quiz", passingScore: 80.125, timeLimit: 2.5, shuffleQuestions: false, futureMeta: { retained: true } };
    seedQuiz({ instructions: JSON.stringify(nativeQuestions), legacyPassingScore: 80.125, timeLimitSeconds: 150, themeConfig: { historicalTheme: { preserved: true }, course360QuizNativeV1: { version: 1, revision: 3, config: { meta, questions: nativeQuestions, futureConfig: "retained" } } } });
    const original = structuredClone(db.table(schema.quizzes));
    await quizCaller().exportScorm({ quizId: 5, format: "scorm2004", saveToMediaLibrary: true });
    expect(mocks.generate).toHaveBeenCalledWith(expect.objectContaining({ passingScore: 80.125, timeLimit: 150, nativeConfig: expect.objectContaining({ meta: expect.objectContaining(meta), questions: nativeQuestions, futureConfig: "retained" }) }));
    const zip = await JSZip.loadAsync(mocks.storage.mock.calls[0][1]);
    const html = await zip.file("index.html")!.async("string");
    expect(html).toContain("80.125"); expect(html).toContain("0.25"); expect(html).toContain("https://legacy.example.test/keep.png");
    expect(db.table(schema.quizzes)).toEqual(original); expect(mocks.external).not.toHaveBeenCalled();
  });
});
