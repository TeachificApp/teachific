import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { getTableName, getTableColumns } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { TRPCError } from "@trpc/server";
import { orgMediaLibrary } from "../drizzle/schema";
const m = vi.hoisted(() => ({ db: null as any, orgId: 7, author: true, paid: true, manual: false, support: false, active: true, config: true, storageConfig: true, provider: vi.fn(), store: vi.fn(), mediaGuard: vi.fn(), quota: vi.fn(), capability: vi.fn(), beforeRead: vi.fn(), beforeWrite: vi.fn() }));
vi.mock("./db", () => ({ getDb: async () => m.db, getOrgStorageUsage: m.quota }));
vi.mock("./formsRouter", () => ({ requireActiveMediaOrganization: m.mediaGuard }));
vi.mock("./lib/course360AppCapabilities", () => ({ requireCourse360AppCapability: m.capability }));
vi.mock("./course360CreatorImageProvider", () => ({ creatorImageProviderStatus: () => ({ available: m.config, configured: m.config, reason: "configured-defaults" }), generateCreatorConfiguredImageBytes: m.provider }));
vi.mock("./course360CreatorImageStorage", () => ({ creatorImageStorageStatus: () => m.storageConfig, saveCreatorOwnedImageBytes: m.store }));
import { router } from "./_core/trpc";
import { creatorImageProcedures } from "./course360CreatorImageProcedures";
import { verifyCreatorImageBytes, CREATOR_IMAGE_MAX_BYTES } from "./course360CreatorImageBytes";
import { fixturePng } from "./course360CreatorImageTestFixtures";
const app = router(creatorImageProcedures), dialect = new MySqlDialect();
class Db {
  rows: any[] = [{ id: 20, orgId: 7, uploadedBy: 3, fileKey: "legacy/unchanged", url: "/original.png", mimeType: "image/png", fileSize: 99, altText: "Original" }]; writes: any[] = [];
  insert(table: any) { expect(getTableName(table)).toBe(getTableName(orgMediaLibrary)); return { values: async (v: any) => { await m.beforeWrite(); const row = { id: 100, ...v }; this.rows.push(row); this.writes.push(v); return [{ insertId: row.id }]; } }; }
  select() { let condition: any; const c: any = { from: () => c, where: (v: any) => { condition = v; return c; }, limit: () => c, then: (resolve: any, reject: any) => Promise.resolve().then(async () => { await m.beforeRead(); const q = dialect.sqlToQuery(condition); const columns = Object.fromEntries(Object.entries(getTableColumns(orgMediaLibrary)).map(([k, v]: any) => [v.name, k])); const terms = [...q.sql.matchAll(/`[^`]+`\.`([^`]+)`\s*=\s*\?/g)]; expect(terms).toHaveLength(3); return structuredClone(this.rows.filter(r => terms.every((v, i) => r[columns[v[1]]] === q.params[i]))); }).then(resolve, reject) }; return c; }
  async transaction(fn: any) { const old = structuredClone(this.rows), writes = [...this.writes]; try { return await fn(this); } catch (e) { this.rows = old; this.writes = writes; throw e; } }
}
let db: Db;
const caller = (req = new EventEmitter()) => app.createCaller({ user: { id: 3, role: "org_admin", primaryOrgId: 7, email: "same@test.invalid" }, req, res: {} } as any);
const input = () => ({ expectedOrgId: 7, requestId: randomUUID(), prompt: "Literal educational illustration", consentToGenerate: true as const, consentToSaveToMainLibrary: true as const });
beforeEach(() => {
  vi.clearAllMocks(); m.orgId = 7; m.author = true; m.paid = true; m.manual = false; m.support = false; m.active = true; m.config = true; m.storageConfig = true; db = new Db(); m.db = db;
  m.capability.mockImplementation(async (user, app, mode) => { expect(user).toBe(3); expect(app).toBe("creator"); expect(mode).toBe("web"); if (!m.author) throw new TRPCError({ code: "FORBIDDEN", message: "Persisted author required" }); return { orgId: m.orgId, access: { isActive: m.active }, isPaid: m.paid, hasManualGrant: m.manual, platformSupport: m.support }; });
  m.mediaGuard.mockResolvedValue(7); m.quota.mockResolvedValue({ usedBytes: 0, maxBytes: 100_000_000 }); m.provider.mockResolvedValue(verifyCreatorImageBytes(fixturePng(), "image/png")); m.store.mockImplementation(async (_org, key, image, signal) => { expect(signal).toBeInstanceOf(AbortSignal); return { key, url: `https://storage.invalid/${key}`, size: image.bytes.length, mimeType: image.mimeType }; }); m.beforeRead.mockResolvedValue(undefined); m.beforeWrite.mockResolvedValue(undefined);
});
describe("Creator real owned-image tRPC procedures", () => {
  it("requires literal generation and new-library-save consents before provider/storage calls", async () => { for (const patch of [{ consentToGenerate: false }, { consentToSaveToMainLibrary: false }, { consentToGenerate: undefined }, { consentToSaveToMainLibrary: undefined }, { unexpected: "url" }]) await expect(caller().generateCreatorOwnedImage({ ...input(), ...patch } as any)).rejects.toThrow(); expect(m.provider).not.toHaveBeenCalled(); expect(m.store).not.toHaveBeenCalled(); expect(db.writes).toHaveLength(0); });
  it("rejects browser/session/primary/email fallback, persisted author denial, exact school drift and support-as-paid", async () => {
    m.author = false; await expect(caller().generateCreatorOwnedImage(input())).rejects.toMatchObject({ code: "FORBIDDEN" }); m.author = true; m.orgId = 8; await expect(caller().generateCreatorOwnedImage(input())).rejects.toMatchObject({ code: "CONFLICT" }); m.orgId = 7; m.paid = false; m.support = true; await expect(caller().generateCreatorOwnedImage(input())).rejects.toMatchObject({ code: "FORBIDDEN" }); m.support = false; m.active = false; m.paid = true; await expect(caller().generateCreatorOwnedImage(input())).rejects.toMatchObject({ code: "FORBIDDEN" }); expect(m.provider).not.toHaveBeenCalled();
  });
  it("requires shared main-library permission but never adds a Studio entitlement gate", async () => { m.mediaGuard.mockRejectedValueOnce(new TRPCError({ code: "FORBIDDEN" })); await expect(caller().generateCreatorOwnedImage(input())).rejects.toMatchObject({ code: "FORBIDDEN" }); m.mediaGuard.mockResolvedValueOnce(8); await expect(caller().generateCreatorOwnedImage(input())).rejects.toMatchObject({ code: "FORBIDDEN" }); expect(m.provider).not.toHaveBeenCalled(); });
  it("honest explicit status does not generate/upload or fake provider availability", async () => { expect(await caller().creatorOwnedImageStatus({ expectedOrgId: 7 })).toMatchObject({ available: true, configured: true, storageConfigured: true, orgId: 7 }); m.config = false; expect(await caller().creatorOwnedImageStatus({ expectedOrgId: 7 })).toMatchObject({ available: false }); m.config = true; m.quota.mockResolvedValue({ usedBytes: 1, maxBytes: CREATOR_IMAGE_MAX_BYTES }); expect(await caller().creatorOwnedImageStatus({ expectedOrgId: 7 })).toMatchObject({ available: false, quotaAvailable: false }); expect(m.provider).not.toHaveBeenCalled(); expect(m.store).not.toHaveBeenCalled(); });
  it("rejects unavailable config/persistence, invalid quota and pre-generation headroom without external work", async () => {
    for (const quota of [{ usedBytes: -1, maxBytes: 10 }, { usedBytes: NaN, maxBytes: -1 }, { usedBytes: 0, maxBytes: -2 }, { usedBytes: 1, maxBytes: CREATOR_IMAGE_MAX_BYTES }]) { m.quota.mockResolvedValueOnce(quota); await expect(caller().generateCreatorOwnedImage(input())).rejects.toThrow(); }
    m.config = false; await expect(caller().generateCreatorOwnedImage(input())).rejects.toThrow(); m.config = true; m.storageConfig = false; await expect(caller().generateCreatorOwnedImage(input())).rejects.toThrow(); m.storageConfig = true; m.db = null; await expect(caller().generateCreatorOwnedImage(input())).rejects.toThrow(); expect(m.provider).not.toHaveBeenCalled();
  });
  it("saves real bytes only under random exact-school new keys/new rows and returns verified media ID/URL/key without changing original rows", async () => {
    const original = structuredClone(db.rows); const result = await caller().generateCreatorOwnedImage(input()); expect(result).toMatchObject({ orgId: 7, mediaId: 100, mimeType: "image/png", width: 2, height: 2, fileSize: fixturePng().length }); expect(result.key).toMatch(/^org-7\/media\/creator-images\/[a-f0-9-]{36}\.png$/); expect(result.url).toBe(`https://storage.invalid/${result.key}`); expect(db.rows[0]).toEqual(original[0]); expect(db.writes).toHaveLength(1); expect(db.writes[0]).toMatchObject({ orgId: 7, uploadedBy: 3, fileKey: result.key, fileSize: fixturePng().length }); expect(m.quota.mock.calls.length).toBeGreaterThanOrEqual(4); expect(m.capability.mock.calls.length).toBeGreaterThanOrEqual(5);
  });
  it("allows only explicit active exact Creator manual grant and unlimited main-school quota", async () => { m.paid = false; m.manual = true; m.quota.mockResolvedValue({ usedBytes: 100_000_000, maxBytes: -1 }); expect((await caller().generateCreatorOwnedImage(input())).mediaId).toBe(100); });
  it("scope/author/quota drift during generation prevents upload and metadata insertion", async () => {
    for (const change of [() => { m.orgId = 8; }, () => { m.author = false; }, () => { m.quota.mockResolvedValue({ usedBytes: 100, maxBytes: 100 }); }]) { m.orgId = 7; m.author = true; m.quota.mockResolvedValue({ usedBytes: 0, maxBytes: 100_000_000 }); m.provider.mockImplementationOnce(async () => { change(); return verifyCreatorImageBytes(fixturePng(), "image/png"); }); await expect(caller().generateCreatorOwnedImage(input())).rejects.toThrow(); }
    expect(m.store).not.toHaveBeenCalled(); expect(db.writes).toHaveLength(0);
  });
  it("scope and quota drift during upload prevents metadata insertion without deleting existing rows", async () => { const original = structuredClone(db.rows); m.store.mockImplementationOnce(async (_o, key, image) => { m.orgId = 8; return { key, url: `https://storage.invalid/${key}`, size: image.bytes.length, mimeType: image.mimeType }; }); await expect(caller().generateCreatorOwnedImage(input())).rejects.toMatchObject({ code: "CONFLICT" }); m.orgId = 7; m.store.mockImplementationOnce(async (_o, key, image) => { m.quota.mockResolvedValue({ usedBytes: 0, maxBytes: 0 }); return { key, url: `https://storage.invalid/${key}`, size: image.bytes.length, mimeType: image.mimeType }; }); await expect(caller().generateCreatorOwnedImage(input())).rejects.toThrow(); expect(db.rows).toEqual(original); expect(db.writes).toHaveLength(0); });
  it("rejects corrupt/provider dimensions and mismatched owned storage receipts before metadata writes", async () => {
    m.provider.mockResolvedValueOnce({ ...verifyCreatorImageBytes(fixturePng(), "image/png"), width: 100 }); await expect(caller().generateCreatorOwnedImage(input())).rejects.toThrow();
    for (const patch of [{ key: "org-8/foreign.png" }, { size: 1 }, { mimeType: "image/jpeg" }, { url: "http://unsafe.invalid/x" }]) { m.store.mockImplementationOnce(async (_o, key, image) => ({ key, url: `https://storage.invalid/${key}`, size: image.bytes.length, mimeType: image.mimeType, ...patch })); await expect(caller().generateCreatorOwnedImage(input())).rejects.toThrow(); }
    expect(db.writes).toHaveLength(0);
  });
  it("metadata verification/scope drift fails transaction and retains original rows and assertions", async () => { const original = structuredClone(db.rows); m.beforeRead.mockImplementationOnce(() => { db.rows.at(-1).fileKey = "foreign"; }); await expect(caller().generateCreatorOwnedImage(input())).rejects.toThrow("receipt"); expect(db.rows).toEqual(original); m.beforeRead.mockImplementationOnce(() => { m.orgId = 8; }); await expect(caller().generateCreatorOwnedImage(input())).rejects.toMatchObject({ code: "CONFLICT" }); expect(db.rows).toEqual(original); expect(db.writes).toHaveLength(0); });
  it("explicit cancellation aborts actual provider signal and prevents late saves", async () => {
    let begin!: () => void; const ready = new Promise<void>(resolve => { begin = resolve; }); m.provider.mockImplementationOnce((_prompt, signal) => new Promise((_resolve, reject) => { signal.addEventListener("abort", () => reject(new Error("cancel")), { once: true }); begin(); })); const request = input(), work = caller().generateCreatorOwnedImage(request); const rejected = expect(work).rejects.toMatchObject({ code: "TIMEOUT" }); await ready; expect(await caller().cancelCreatorOwnedImage({ expectedOrgId: 7, requestId: request.requestId })).toMatchObject({ cancelled: true }); await rejected; expect(m.store).not.toHaveBeenCalled(); expect(db.writes).toHaveLength(0);
  });
  it("request disconnect aborts work; bounded busy admission and reused request IDs never silently duplicate generation", async () => {
    let begin!: () => void; const ready = new Promise<void>(resolve => { begin = resolve; }); const req = new EventEmitter(), request = input(); m.provider.mockImplementationOnce((_p, signal) => new Promise((_r, reject) => { signal.addEventListener("abort", () => reject(new Error("aborted"))); begin(); })); const work = caller(req).generateCreatorOwnedImage(request); const rejected = expect(work).rejects.toThrow(); await ready; await expect(caller().generateCreatorOwnedImage(input())).rejects.toMatchObject({ code: "CONFLICT" }); req.emit("aborted"); await rejected; await expect(caller().generateCreatorOwnedImage(request)).rejects.toMatchObject({ code: "CONFLICT" }); expect(m.provider).toHaveBeenCalledOnce(); expect(req.listenerCount("aborted")).toBe(0);
  });
  it("applies a fixed 90-second overall deadline and aborts pending provider work before storage/persistence", async () => {
    const deadline = new AbortController(), timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(deadline.signal);
    let begin!: () => void; const ready = new Promise<void>(resolve => { begin = resolve; });
    m.provider.mockImplementationOnce((_p, signal) => new Promise((_resolve, reject) => { signal.addEventListener("abort", () => reject(new Error("deadline")), { once: true }); begin(); }));
    const work = caller().generateCreatorOwnedImage(input()), rejected = expect(work).rejects.toMatchObject({ code: "TIMEOUT" }); await ready;
    expect(timeout).toHaveBeenCalledWith(90_000); deadline.abort(); await rejected; expect(m.store).not.toHaveBeenCalled(); expect(db.writes).toHaveLength(0); timeout.mockRestore();
  });
});
