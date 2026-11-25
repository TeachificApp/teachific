import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { orgMediaLibrary, mediaFolders, userActiveOrg, organizations } from "../../drizzle/schema";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { mkdtemp, readFile, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const f = vi.hoisted(() => ({ db: null as any, getDb: vi.fn(), user: vi.fn(), member: vi.fn(), fallback: vi.fn(), capability: vi.fn(), quota: vi.fn(),
  resolve4: vi.fn(), resolve6: vi.fn(), cancel: vi.fn(), request: vi.fn(), store: vi.fn(), resolve: vi.fn(), inspect: vi.fn(), sourceBytes: Buffer.alloc(0),
  uploads: [] as any[], requests: [] as any[], pages: new Map<string, any>(), selected: 7 }));
vi.mock("../db", async original => ({ ...(await original<any>()), getDb: f.getDb, getUserById: f.user, getOrgMember: f.member, getOrgIdForUserWithFallback: f.fallback, getOrgStorageUsage: f.quota }));
vi.mock("./course360AppCapabilities", () => ({ requireCourse360AppCapability: f.capability }));
vi.mock("node:dns/promises", async original => ({ ...(await original<any>()), Resolver: class { resolve4 = f.resolve4; resolve6 = f.resolve6; cancel = f.cancel; } }));
vi.mock("node:http", async original => { const m = await original<any>(); return { ...m, default: { ...m.default, request: f.request } }; });
vi.mock("node:https", async original => { const m = await original<any>(); return { ...m, default: { ...m.default, request: f.request } }; });
vi.mock("./course360StudioStorage", async original => ({ ...(await original<any>()), storeStudioFile: f.store, resolveStudioStorage: f.resolve, inspectStudioRegistration: f.inspect }));
const { lmsRouter } = await import("../lmsRouter");
const { isStudioImportPublicIp, validateStudioImportUrl, assertStudioImportQuota, writeStudioImportResponse, withStudioUrlImport } = await import("./course360StudioUrlImport");
const dialect = new MySqlDialect();
let fixtureDirectory: string;

function fakeDb() {
  const rows = new Map<any, any[]>([
    [orgMediaLibrary, [
      { id: 44, orgId: 7, uploadedBy: 101, fileKey: "legacy/pseudo-external-asset", url: "https://legacy.example.net/old", filename: "historical", mimeType: "video/mp4", fileSize: 1, tags: '["kept"]', transcriptJson: '{"original":true}' },
      { id: 55, orgId: 8, uploadedBy: 102, fileKey: "org-8/media/foreign.mp4", url: "https://cdn.example.net/opaque-foreign", fileSize: 2 },
    ]], [mediaFolders, [{ id: 1, orgId: 7 }, { id: 2, orgId: 8 }]],
  ]);
  const writes: any[] = [], queries: any[] = [];
  function matching(row: any, condition: any) {
    if (!condition) return true;
    const query = dialect.sqlToQuery(condition); queries.push(query);
    return [...query.sql.matchAll(/`[^`]+`\.`([^`]+)` (=|<>) \?/g)].every((match, i) => match[2] === "=" ? row[match[1]] === query.params[i] : row[match[1]] !== query.params[i]);
  }
  const db: any = { rows, writes, queries, corruptReceipt: false,
    select: vi.fn((selection?: any) => {
      let table: any, condition: any;
      const result = () => table === userActiveOrg ? (f.selected ? [{ orgId: f.selected }] : []) : (rows.get(table) ?? []).filter(row => matching(row, condition)).map(row => {
        if (db.corruptReceipt && row.id === 90 && !selection) return { ...row, orgId: 8, fileKey: "foreign" };
        return selection ? Object.fromEntries(Object.entries(selection).map(([name, column]: any) => [name, row[column.name]])) : row;
      });
      const chain: any = { from: (v: any) => { table = v; return chain; }, innerJoin: () => chain, where: (v: any) => { condition = v; return chain; }, limit: async (n: number) => result().slice(0, n), then: (resolve: any, reject: any) => Promise.resolve(result()).then(resolve, reject) }; return chain;
    }),
    insert: vi.fn((table: any) => ({ values: (value: any) => ({ $returningId: async () => { const id = 90 + writes.length; writes.push({ table, value }); rows.get(table)?.push({ id, ...value }); return [{ id }]; } }) })),
    update: vi.fn(() => { throw new Error("Existing assets must never be updated"); }), delete: vi.fn(() => { throw new Error("Existing assets must never be deleted"); }),
  };
  return db;
}
function media(sessionRole = "member") { return lmsRouter.createCaller({ user: { id: 101, role: sessionRole }, req: { headers: { cookie: "ambient-secret", authorization: "Bearer ambient-secret" }, socket: {} }, res: {} } as any).media; }
const direct = "https://media.example.net/tiny.mp4";
function response(bytes: Buffer, mime = "video/mp4", extra: any = {}) { return { bytes, mime, status: 200, ...extra }; }

beforeAll(async () => {
  fixtureDirectory = await mkdtemp(join(tmpdir(), "course360-import-test-"));
  const result = spawnSync("prlimit", ["--as=1073741824", "--data=268435456", "--fsize=1048576", "--cpu=10", "--nofile=64", "--", "ffmpeg", "-cpucount", "1", "-nostdin", "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=teal:s=160x90:r=10:d=1.2", "-f", "lavfi", "-i", "sine=frequency=440:duration=1.2", "-c:v", "libx264", "-threads", "1", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", "-movflags", "+faststart", join(fixtureDirectory, "tiny.mp4")], { timeout: 15_000, env: { PATH: process.env.PATH, HOME: fixtureDirectory, LANG: "C.UTF-8" } });
  if (result.status !== 0) throw new Error("Local synthetic fixture encoding failed: " + result.stderr?.toString().slice(-300));
  f.sourceBytes = await readFile(join(fixtureDirectory, "tiny.mp4"));
});
afterAll(async () => { await rm(fixtureDirectory, { recursive: true, force: true }); });
beforeEach(() => {
  vi.clearAllMocks(); f.db = fakeDb(); f.selected = 7; f.requests = []; f.uploads = []; f.pages = new Map([[direct, response(f.sourceBytes)]]);
  f.getDb.mockResolvedValue(f.db); f.user.mockResolvedValue({ id: 101, role: "member" }); f.member.mockResolvedValue({ orgId: 7, userId: 101, role: "org_admin" });
  f.quota.mockResolvedValue({ usedBytes: 2, maxBytes: 100_000_000 });
  f.resolve4.mockResolvedValue(["93.184.216.34"]); f.resolve6.mockRejectedValue(Object.assign(new Error("no AAAA"), { code: "ENODATA" }));
  f.request.mockImplementation((options, callback) => {
    const req: any = new EventEmitter(); let res: any;
    req.setTimeout = vi.fn(() => req); req.destroy = vi.fn((error) => { res?.destroy(); if (error) req.emit("error", error); return req; });
    req.end = () => {
      const url = `${options.protocol}//${options.hostname}${options.path}`;
      const item = f.pages.get(url) ?? (options.method === "HEAD" ? response(Buffer.alloc(0), "video/mp4", { length: f.sourceBytes.length }) : response(Buffer.from("missing"), "text/plain", { status: 404 }));
      options.lookup(options.hostname, {}, (_error: any, address: string, family: number) => {
        if (options.method !== "HEAD") f.requests.push({ url, options, address, family });
        res = new PassThrough(); res.statusCode = item.status; res.headers = { "content-type": item.mime, ...(item.length === undefined ? {} : { "content-length": item.length }), ...(item.location ? { location: item.location } : {}), ...(item.encoding ? { "content-encoding": item.encoding } : {}) };
        queueMicrotask(() => { callback(res); if (!item.hang) res.end(item.bytes); });
      });
    };
    return req;
  });
  f.store.mockImplementation(async (key, path, mimeType, signal) => {
    const bytes = await readFile(path); f.uploads.push({ key, path, mimeType, bytes, signal });
    return { key, url: `https://cdn.example.net/${key}` };
  });
  f.resolve.mockImplementation(async key => ({ key, url: `https://cdn.example.net/${key}?signed=1` }));
  f.inspect.mockImplementation(async (key, url) => ({ key, url, size: f.sourceBytes.length, mimeType: "video/mp4" }));
});

describe("Studio bounded URL import actual procedure", () => {
  it("imports actual synthetic bytes into the exact active school's main library with probe metadata and consistent receipt", async () => {
    const existing = JSON.stringify(f.db.rows.get(orgMediaLibrary));
    const saved = await media().importFromUrl({ url: direct, folderId: 1 });
    expect(saved).toMatchObject({ id: 90, orgId: 7, uploadedBy: 101, mimeType: "video/mp4", fileSize: f.sourceBytes.length, folderId: 1, source: "direct", tags: '["import","url-import"]' });
    expect(saved.fileKey).toMatch(/^org-7\/media\/url-imports\/[\w-]{24}\.mp4$/);
    expect(saved.url).toBe(`https://cdn.example.net/${saved.fileKey}`);
    expect(JSON.parse(saved.transcriptJson)).toMatchObject({ duration: expect.any(Number), studio: { importProbe: { videoCodec: "h264", audioCodec: "aac", width: 160, height: 90 } } });
    expect(f.uploads[0].bytes.equals(f.sourceBytes)).toBe(true);
    expect(f.db.writes).toHaveLength(1); expect(JSON.stringify(f.db.rows.get(orgMediaLibrary).slice(0, 2))).toBe(existing);
    expect(f.capability).not.toHaveBeenCalled(); expect(f.fallback).not.toHaveBeenCalled();
    expect(f.member).toHaveBeenCalledWith(7, 101); expect(f.quota).toHaveBeenCalledTimes(3);
    expect(f.requests[0].address).toBe("93.184.216.34"); expect(f.requests[0].options.headers).not.toHaveProperty("Referer");
    expect(JSON.stringify(f.requests)).not.toContain("ambient-secret");
    await expect(readFile(f.uploads[0].path)).rejects.toThrow();
    const list = await media().listOrgMedia(); expect(list).toHaveLength(2); expect(list[0].fileKey).toBe("legacy/pseudo-external-asset");
  });
  it("creates randomized independent keys on repeat imports without adoption, overwrites, or deletes", async () => {
    await media().importFromUrl({ url: direct }); await media().importFromUrl({ url: direct });
    expect(f.uploads[0].key).not.toBe(f.uploads[1].key); expect(f.db.update).not.toHaveBeenCalled(); expect(f.db.delete).not.toHaveBeenCalled();
  });
  it.each([{ orgId: 8, url: direct }, { url: direct, folderId: 2 }, { url: "https://cdn.example.net/opaque-foreign" }, { url: "https://cdn.example.net/org-8/media/foreign.mp4" }])("rejects foreign hint, folder and known school-owned source before bytes or writes: %j", async input => {
    await expect(media("site_owner").importFromUrl(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(f.request).not.toHaveBeenCalled(); expect(f.store).not.toHaveBeenCalled(); expect(f.db.writes).toEqual([]);
  });
  it("requires persisted active selection and exact author permission, never session role or fallback", async () => {
    f.selected = 0; await expect(media("site_owner").importFromUrl({ url: direct })).rejects.toMatchObject({ code: "FORBIDDEN" });
    f.selected = 7; f.member.mockResolvedValue({ orgId: 8, userId: 101, role: "member" });
    await expect(media("site_owner").importFromUrl({ url: direct })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(f.request).not.toHaveBeenCalled(); expect(f.fallback).not.toHaveBeenCalled();
  });
  it("rechecks active selection/author after download and storage", async () => {
    f.store.mockImplementation(async key => { f.selected = 8; return { key, url: `https://cdn.example.net/${key}` }; });
    await expect(media().importFromUrl({ url: direct })).rejects.toMatchObject({ code: "FORBIDDEN" }); expect(f.db.writes).toEqual([]);
  });
  it("checks authoritative library quota before bytes and immediately before saves", async () => {
    f.quota.mockResolvedValue({ usedBytes: 100, maxBytes: 100 });
    await expect(media().importFromUrl({ url: direct })).rejects.toMatchObject({ code: "PAYLOAD_TOO_LARGE" }); expect(f.request).not.toHaveBeenCalled();
    f.quota.mockResolvedValue({ usedBytes: 0, maxBytes: f.sourceBytes.length - 1 });
    await expect(media().importFromUrl({ url: direct })).rejects.toMatchObject({ code: "PAYLOAD_TOO_LARGE" }); expect(f.store).not.toHaveBeenCalled();
  });
  it.each(["file:///etc/passwd", "ftp://media.example.net/file.mp4", "http://127.1/x", "http://2130706433/x", "http://0x7f000001/x", "http://169.254.169.254/latest", "http://[::1]/x", "http://[::ffff:7f00:1]/x", "http://[64:ff9b::7f00:1]/x", "https://user:password@media.example.net/x", "https://metadata.google.internal/x", "https://secret.internal/x", "https://media.example.net:123/x"]) ("rejects unsafe scheme/host/alternate address: %s", async url => {
    await expect(media().importFromUrl({ url })).rejects.toMatchObject({ code: "BAD_REQUEST" }); expect(f.request).not.toHaveBeenCalled(); expect(f.db.writes).toEqual([]);
  });
  it("rejects all DNS records if any are private, and DNS timeout", async () => {
    f.resolve4.mockResolvedValue(["93.184.216.34", "10.0.0.2"]);
    await expect(media().importFromUrl({ url: direct })).rejects.toMatchObject({ code: "BAD_REQUEST" }); expect(f.request).not.toHaveBeenCalled();
    f.resolve4.mockRejectedValue(Object.assign(new Error("timeout"), { code: "ETIMEOUT" }));
    await expect(media().importFromUrl({ url: direct })).rejects.toMatchObject({ code: "BAD_REQUEST" }); expect(f.cancel).toHaveBeenCalled();
  });
  it("independently validates and pins each public redirect", async () => {
    f.pages.set(direct, response(Buffer.alloc(0), "video/mp4", { status: 302, location: "https://second.example.net/actual.mp4" }));
    f.pages.set("https://second.example.net/actual.mp4", response(f.sourceBytes));
    const saved = await media().importFromUrl({ url: direct }); expect(saved.mimeType).toBe("video/mp4");
    expect(f.requests.map(r => r.url)).toEqual([direct, "https://second.example.net/actual.mp4"]); expect(f.resolve4).toHaveBeenCalledWith("second.example.net");
  });
  it.each(["http://127.0.0.1/private", "https://user:secret@second.example.net/private", "https://cdn.example.net/org-8/media/foreign.mp4"])("rejects malicious redirect without requesting it: %s", async location => {
    f.pages.set(direct, response(Buffer.alloc(0), "video/mp4", { status: 302, location }));
    await expect(media().importFromUrl({ url: direct })).rejects.toThrow(); expect(f.requests).toHaveLength(1); expect(f.store).not.toHaveBeenCalled();
  });
  it("blocks redirect DNS rebinding/mixed private output and limits loops", async () => {
    f.pages.set(direct, response(Buffer.alloc(0), "video/mp4", { status: 302, location: "https://second.example.net/actual.mp4" }));
    f.resolve4.mockImplementation(async host => host === "second.example.net" ? ["10.0.0.1"] : ["93.184.216.34"]);
    await expect(media().importFromUrl({ url: direct })).rejects.toMatchObject({ code: "BAD_REQUEST" }); expect(f.requests).toHaveLength(1);
    f.resolve4.mockResolvedValue(["93.184.216.34"]); f.requests = [];
    f.pages.set(direct, response(Buffer.alloc(0), "video/mp4", { status: 302, location: direct }));
    await expect(media().importFromUrl({ url: direct })).rejects.toMatchObject({ code: "BAD_REQUEST" }); expect(f.requests).toHaveLength(5);
  });
  it.each([response(Buffer.alloc(8 * 1024 * 1024 + 1)), response(f.sourceBytes, "video/mp4", { length: 8 * 1024 * 1024 + 1 }), response(f.sourceBytes, "video/mp4", { length: 3 }), response(Buffer.alloc(0)), response(f.sourceBytes, "video/mp4", { encoding: "gzip" })])("rejects oversized/misdeclared/empty/encoded response before storage", async item => {
    f.pages.set(direct, item); await expect(media().importFromUrl({ url: direct })).rejects.toThrow(); expect(f.store).not.toHaveBeenCalled(); expect(f.db.writes).toEqual([]);
  });
  it.each([response(Buffer.from("<!doctype html><script>not media</script>")), response(f.sourceBytes, "video/webm"), response(Buffer.from("#EXTM3U\nhttp://127.0.0.1/payload"), "video/mp4"), response(f.sourceBytes, "text/plain")])("requires actual supported container and matching MIME, never remote playlist probing", async item => {
    f.pages.set(direct, item); await expect(media().importFromUrl({ url: direct })).rejects.toThrow(); expect(f.store).not.toHaveBeenCalled(); expect(f.requests).toHaveLength(1);
  });
  it("imports public HTML provider output only after independent URL/DNS/redirect/bytes/probe checks", async () => {
    const page = "https://social.example.net/post";
    f.pages.set(page, response(Buffer.from(`<meta content="${direct}" property="og:video">`), "text/html"));
    const saved = await media().importFromUrl({ url: page }); expect(saved.fileSize).toBe(f.sourceBytes.length); expect(f.requests.map(r => r.url)).toEqual([page, direct]);
    expect(f.requests[1].options.headers).not.toHaveProperty("Cookie"); expect(f.requests[1].options.headers).not.toHaveProperty("Authorization");
  });
  it.each(["http://169.254.169.254/latest", "https://cdn.example.net/org-8/media/foreign.mp4", "file:///etc/passwd"])("rejects unsafe scraper/provider output without downloading: %s", async candidate => {
    const page = "https://social.example.net/post"; f.pages.set(page, response(Buffer.from(`<video src="${candidate}">`), "text/html"));
    await expect(media().importFromUrl({ url: page })).rejects.toThrow(); expect(f.requests).toHaveLength(1); expect(f.store).not.toHaveBeenCalled();
  });
  it("returns honest unsupported/private/provider errors without pseudo rows", async () => {
    await expect(media().importFromUrl({ url: "https://www.youtube.com/watch?v=test" })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" }); expect(f.requests).toHaveLength(0);
    const page = "https://social.example.net/private"; f.pages.set(page, response(Buffer.from("private or provider needed"), "text/html"));
    await expect(media().importFromUrl({ url: page })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    f.pages.set(page, response(Buffer.from("private"), "text/html", { status: 403 }));
    await expect(media().importFromUrl({ url: page })).rejects.toMatchObject({ code: "BAD_REQUEST" }); expect(f.db.writes).toEqual([]);
  });
  it("fails storage key/url mismatch and authoritative receipt mismatch without claiming success", async () => {
    f.store.mockResolvedValue({ key: "org-8/foreign", url: "https://cdn.example.net/org-8/foreign" });
    await expect(media().importFromUrl({ url: direct })).rejects.toThrow("inconsistent import key"); expect(f.db.writes).toEqual([]);
    f.store.mockImplementation(async key => ({ key, url: "https://evil.example.net/unrelated" }));
    await expect(media().importFromUrl({ url: direct })).rejects.toThrow("same authoritative"); expect(f.db.writes).toEqual([]);
    f.store.mockImplementation(async key => ({ key, url: `https://cdn.example.net/${key}` })); f.db.corruptReceipt = true;
    await expect(media().importFromUrl({ url: direct })).rejects.toThrow("saved import receipt");
    expect(f.db.update).not.toHaveBeenCalled(); expect(f.db.delete).not.toHaveBeenCalled();
  });
  it("ignores caller fileKey/headers/provider fields rather than accepting SSRF controls", async () => {
    const saved = await media().importFromUrl({ url: direct, fileKey: "org-8/foreign", headers: { Cookie: "forged" }, providerUrl: "http://127.0.0.1" } as any);
    expect(saved.orgId).toBe(7); expect(saved.fileKey).not.toContain("foreign"); expect(JSON.stringify(f.requests)).not.toContain("forged");
  });
  it("checks opaque foreign library ownership on extracted URLs and every redirect", async () => {
    const page = "https://social.example.net/post";
    f.pages.set(page, response(Buffer.from('<video src="https://cdn.example.net/opaque-foreign">'), "text/html"));
    await expect(media().importFromUrl({ url: page })).rejects.toMatchObject({ code: "FORBIDDEN" }); expect(f.requests).toHaveLength(1);
    f.requests = []; f.pages.set(direct, response(Buffer.alloc(0), "video/mp4", { status: 302, location: "https://cdn.example.net/opaque-foreign" }));
    await expect(media().importFromUrl({ url: direct })).rejects.toMatchObject({ code: "FORBIDDEN" }); expect(f.requests).toHaveLength(1);
  });
  it("rejects malicious storage DNS/redirect and MIME/byte receipt before library writes", async () => {
    f.resolve.mockImplementation(async key => ({ key, url: "https://[::ffff:7f00:1]/" + key }));
    f.store.mockImplementation(async key => ({ key, url: "https://[::ffff:7f00:1]/" + key }));
    await expect(media().importFromUrl({ url: direct })).rejects.toMatchObject({ code: "BAD_REQUEST" }); expect(f.db.writes).toEqual([]);
    f.resolve.mockImplementation(async key => ({ key, url: `https://cdn.example.net/${key}?signed=1` }));
    f.store.mockImplementation(async key => {
      f.pages.set(`https://cdn.example.net/${key}?signed=1`, response(Buffer.alloc(0), "video/mp4", { status: 302, location: "http://169.254.169.254/metadata" }));
      return { key, url: `https://cdn.example.net/${key}` };
    });
    await expect(media().importFromUrl({ url: direct })).rejects.toMatchObject({ code: "BAD_REQUEST" }); expect(f.db.writes).toEqual([]);
    f.store.mockImplementation(async key => {
      f.pages.set(`https://cdn.example.net/${key}?signed=1`, response(Buffer.alloc(0), "video/webm", { length: f.sourceBytes.length + 1 }));
      return { key, url: `https://cdn.example.net/${key}` };
    });
    await expect(media().importFromUrl({ url: direct })).rejects.toThrow("inconsistent import byte/MIME"); expect(f.db.writes).toEqual([]);
  });
});

describe("Studio import bounded runtime helpers", () => {
  it.each(["127.0.0.1", "169.254.169.254", "::1", "::ffff:7f00:1", "::7f00:1", "64:ff9b::a00:1", "2002:7f00:1::", "2001::1", "2001:db8::1", "fe80::1", "fc00::1", "198.51.100.2"])("rejects nonpublic and alternate-IP encodings: %s", ip => expect(isStudioImportPublicIp(ip)).toBe(false));
  it("allows public unicast and rejects invalid quota metadata", () => {
    expect(isStudioImportPublicIp("93.184.216.34")).toBe(true); expect(isStudioImportPublicIp("2606:4700:4700::1111")).toBe(true);
    expect(() => assertStudioImportQuota({ usedBytes: NaN, maxBytes: -1 }, 1)).toThrow(); expect(() => validateStudioImportUrl("https://host.local./x")).toThrow();
  });
  it("aborts a stalled streamed download and removes partial tempfile", async () => {
    const path = join(fixtureDirectory, "partial.media"); const res: any = new PassThrough(); res.headers = {};
    const controller = new AbortController(); const pending = writeStudioImportResponse(res, path, 1024, controller.signal); res.write(Buffer.from("partial")); controller.abort();
    await expect(pending).rejects.toThrow(); expect(res.destroyed).toBe(true); await rm(path, { force: true });
  });
  it("shares processor concurrency-one admission and cleans temporary directory on failure", async () => {
    let release!: () => void; let entered!: () => void; const enteredPromise = new Promise<void>(resolve => { entered = resolve; });
    const before = (await readdir(tmpdir())).filter(name => name.startsWith("course360-studio-url-import-"));
    const pending = withStudioUrlImport(direct, 7, async () => { entered(); await new Promise<void>(resolve => { release = resolve; }); throw new Error("local failure"); });
    await enteredPromise; await expect(media().importFromUrl({ url: direct })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" }); release();
    await expect(pending).rejects.toThrow("local failure");
    const after = (await readdir(tmpdir())).filter(name => name.startsWith("course360-studio-url-import-")); expect(after).toEqual(before);
  });
});
