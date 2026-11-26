import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import { readFile, access } from "node:fs/promises";
const m = vi.hoisted(() => ({ store: vi.fn(), resolve: vi.fn(), request: vi.fn() }));
vi.mock("./_core/env", () => ({ ENV: { forgeApiUrl: "https://forge.invalid/", forgeApiKey: "synthetic-key" } }));
vi.mock("./lib/course360StudioStorage", async original => { const actual = await original<any>(); return { ...actual, storeStudioFile: m.store, resolveStudioStorage: m.resolve, requestStudioStorage: m.request }; });
import { saveCreatorOwnedImageBytes } from "./course360CreatorImageStorage";
import { verifyCreatorImageBytes } from "./course360CreatorImageBytes";
import { fixturePng } from "./course360CreatorImageTestFixtures";
const key = "org-7/media/creator-images/00000000-0000-4000-8000-000000000001.png";
const url = `https://storage.invalid/${key}`;
function stream(bytes = fixturePng(), headers: any = {}) { return Object.assign(Readable.from([bytes]), { headers: { "content-length": String(bytes.length), "content-type": "image/png", ...headers } }); }
beforeEach(() => { vi.clearAllMocks(); m.store.mockResolvedValue({ key, url }); m.resolve.mockResolvedValue({ key, url: url + "?signature=mock" }); m.request.mockResolvedValue(stream()); });
afterEach(() => vi.restoreAllMocks());
const save = (signal = AbortSignal.timeout(1000)) => saveCreatorOwnedImageBytes(7, key, verifyCreatorImageBytes(fixturePng(), "image/png"), signal);
describe("Creator actual isolated owned-byte storage wrapper", () => {
  it("uses abortable existing owned-key primitives with actual temp bytes, authoritative key/URL and full byte receipt then cleans own temp file", async () => {
    let path = ""; m.store.mockImplementationOnce(async (k, p, mime, signal) => { expect(k).toBe(key); expect(mime).toBe("image/png"); expect(signal).toBeInstanceOf(AbortSignal); path = p; expect(await readFile(p)).toEqual(fixturePng()); return { key, url }; });
    expect(await save()).toEqual({ key, url, size: fixturePng().length, mimeType: "image/png" }); expect(m.request).toHaveBeenCalledWith(url + "?signature=mock", "GET", expect.any(AbortSignal)); await expect(access(path)).rejects.toThrow();
  });
  it("rejects foreign/malformed keys before upload and never overwrites caller-selected keys", async () => { for (const k of [key.replace("org-7", "org-8"), "generated/old.png", "org-7/media/creator-images/../old.png", key + "?x"]) await expect(saveCreatorOwnedImageBytes(7, k, verifyCreatorImageBytes(fixturePng(), "image/png"), AbortSignal.timeout(1000))).rejects.toThrow(); expect(m.store).not.toHaveBeenCalled(); });
  it("rejects different stored/resolved keys and foreign URL identity before fetching bytes", async () => {
    m.store.mockResolvedValueOnce({ key: "org-8/foreign", url }); await expect(save()).rejects.toThrow("different");
    m.resolve.mockResolvedValueOnce({ key: "other", url }); await expect(save()).rejects.toThrow("differs");
    m.store.mockResolvedValueOnce({ key, url: "https://foreign.invalid/unchecked.png" }); await expect(save()).rejects.toThrow("same authoritative"); expect(m.request).not.toHaveBeenCalled();
  });
  it("rejects wrong MIME/header size, actual too-short/long bytes and equal-size corruption", async () => {
    for (const res of [stream(fixturePng(), { "content-type": "image/jpeg" }), stream(fixturePng(), { "content-length": "0" }), stream(fixturePng().subarray(0, 10), { "content-length": String(fixturePng().length) }), stream(Buffer.concat([fixturePng(), Buffer.from("extra")]), { "content-length": String(fixturePng().length) }), stream(Buffer.alloc(fixturePng().length))]) { m.request.mockResolvedValueOnce(res); await expect(save()).rejects.toThrow(); expect(res.destroyed).toBe(true); }
  });
  it("cancellation after upload blocks lookup/receipt and cleanup still occurs", async () => { const c = new AbortController(); let path = ""; m.store.mockImplementationOnce(async (_k, p) => { path = p; c.abort(); return { key, url }; }); await expect(save(c.signal)).rejects.toThrow(); expect(m.resolve).not.toHaveBeenCalled(); await expect(access(path)).rejects.toThrow(); });
  it("cancels a pending authoritative stored-byte stream without accepting late receipt", async () => {
    const c = new AbortController(); let begin!: () => void; const ready = new Promise<void>(resolve => { begin = resolve; });
    const res = Object.assign(new Readable({ read() { begin(); } }), { headers: { "content-length": String(fixturePng().length), "content-type": "image/png" } });
    m.request.mockResolvedValueOnce(res); const work = save(c.signal), rejected = expect(work).rejects.toThrow(); await ready; c.abort(); await rejected; expect(res.destroyed).toBe(true);
  });
  it("pre-aborted save never creates/upload objects", async () => { const c = new AbortController(); c.abort(); await expect(save(c.signal)).rejects.toThrow(); expect(m.store).not.toHaveBeenCalled(); });
});
