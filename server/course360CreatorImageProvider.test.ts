import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const env = vi.hoisted(() => ({ forgeApiUrl: "https://forge.invalid/base", forgeApiKey: "synthetic-key" }));
vi.mock("./_core/env", () => ({ ENV: env }));
import { generateCreatorConfiguredImageBytes, creatorImageProviderStatus } from "./course360CreatorImageProvider";
import { verifyCreatorImageBytes, decodeCreatorImageBase64, CREATOR_IMAGE_MAX_RESPONSE, CREATOR_IMAGE_MAX_BYTES } from "./course360CreatorImageBytes";
import { fixturePng, fixtureChunk } from "./course360CreatorImageTestFixtures";
const body = () => JSON.stringify({ image: { b64Json: fixturePng().toString("base64"), mimeType: "image/png" } });
const response = (value = body(), headers: Record<string, string> = {}) => new Response(value, { headers: { "content-type": "application/json", ...headers } });
beforeEach(() => { env.forgeApiUrl = "https://forge.invalid/base"; env.forgeApiKey = "synthetic-key"; vi.stubGlobal("fetch", vi.fn(async () => response())); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("Creator actual legacy configured byte-only adapter", () => {
  it("preserves configured endpoint/auth/protocol/exact legacy request with no model/quality/provider fallback or upload", async () => {
    const image = await generateCreatorConfiguredImageBytes("Literal prompt", AbortSignal.timeout(1000)); expect(image.bytes).toEqual(fixturePng()); expect(image).toMatchObject({ width: 2, height: 2, mimeType: "image/png" });
    const [url, options] = vi.mocked(fetch).mock.calls[0]; expect(url).toBe("https://forge.invalid/base/images.v1.ImageService/GenerateImage"); expect(options).toMatchObject({ method: "POST", redirect: "error", headers: { authorization: "Bearer synthetic-key", "connect-protocol-version": "1", accept: "application/json" } }); expect(JSON.parse(String(options?.body))).toEqual({ prompt: "Literal prompt", original_images: [] }); expect(options?.signal).toBeInstanceOf(AbortSignal); expect(fetch).toHaveBeenCalledOnce();
  });
  it("configuration status is honest and never requests a catalog/provider or selects a replacement", () => { expect(creatorImageProviderStatus()).toMatchObject({ available: true, configured: true }); env.forgeApiKey = ""; expect(creatorImageProviderStatus()).toMatchObject({ available: false }); expect(fetch).not.toHaveBeenCalled(); });
  it("rejects missing/unsafe configuration and empty/oversized prompt before any HTTP", async () => {
    for (const url of ["http://forge.invalid", "https://user:pass@forge.invalid", "https://forge.invalid/?q=1", "https://forge.invalid/#x", "https://forge.invalid:444"]) { env.forgeApiUrl = url; await expect(generateCreatorConfiguredImageBytes("p", AbortSignal.timeout(1000))).rejects.toThrow(); }
    env.forgeApiUrl = "https://forge.invalid/"; env.forgeApiKey = ""; await expect(generateCreatorConfiguredImageBytes("p", AbortSignal.timeout(1000))).rejects.toThrow(); env.forgeApiKey = "key"; for (const p of ["", " ", "x".repeat(4001)]) await expect(generateCreatorConfiguredImageBytes(p, AbortSignal.timeout(1000))).rejects.toThrow(); expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects error/redirect/URL-only/unknown response without unchecked URL fetching or retries", async () => {
    const redirect = response(); Object.defineProperty(redirect, "redirected", { value: true });
    for (const value of [new Response("private-error-detail", { status: 500 }), redirect, response(JSON.stringify({ image: { url: "https://169.254.169.254/secret" } })), response(JSON.stringify({ image: { b64Json: fixturePng().toString("base64"), mimeType: "image/png", url: "https://untrusted.invalid" } })), response(JSON.stringify({ image: {}, error: "bad" }))]) { vi.mocked(fetch).mockResolvedValueOnce(value); await expect(generateCreatorConfiguredImageBytes("p", AbortSignal.timeout(1000))).rejects.toThrow(); }
    expect(fetch).toHaveBeenCalledTimes(5);
  });
  it("strictly checks JSON MIME/encoding/content-length and actual response byte count", async () => {
    for (const value of [response(body(), { "content-type": "text/html" }), response(body(), { "content-encoding": "gzip" }), response(body(), { "content-length": "NaN" }), response(body(), { "content-length": String(CREATOR_IMAGE_MAX_RESPONSE + 1) }), response(body(), { "content-length": "1" }), response("{broken"), response(""), response("x".repeat(CREATOR_IMAGE_MAX_RESPONSE + 1))]) { vi.mocked(fetch).mockResolvedValueOnce(value); await expect(generateCreatorConfiguredImageBytes("p", AbortSignal.timeout(1000))).rejects.toThrow(); }
    vi.mocked(fetch).mockResolvedValueOnce(response(body(), { "content-length": String(Buffer.byteLength(body())) })); expect((await generateCreatorConfiguredImageBytes("p", AbortSignal.timeout(1000))).bytes).toEqual(fixturePng());
  });
  it("cancels an in-flight body reader and rejects late bytes", async () => {
    const cancel = vi.fn(); const stream = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('{"image":')); }, cancel }); vi.mocked(fetch).mockResolvedValueOnce(new Response(stream, { headers: { "content-type": "application/json" } }));
    const controller = new AbortController(); const work = generateCreatorConfiguredImageBytes("p", controller.signal); await Promise.resolve(); await Promise.resolve(); controller.abort(); await expect(work).rejects.toThrow(); expect(cancel).toHaveBeenCalledOnce();
  });
  it("pre-aborted requests do not call the provider and failed requests never fabricate output", async () => { const c = new AbortController(); c.abort(); await expect(generateCreatorConfiguredImageBytes("p", c.signal)).rejects.toThrow(); expect(fetch).not.toHaveBeenCalled(); vi.mocked(fetch).mockRejectedValueOnce(new Error("network-secret")); await expect(generateCreatorConfiguredImageBytes("p", AbortSignal.timeout(1000))).rejects.toMatchObject({ code: "TIMEOUT" }); expect(fetch).toHaveBeenCalledOnce(); });
  it("selects the fixed 60-second adapter deadline and propagates its abort to the real fetch boundary", async () => {
    const deadline = new AbortController(), timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(deadline.signal);
    let begin!: () => void; const ready = new Promise<void>(resolve => { begin = resolve; });
    vi.mocked(fetch).mockImplementationOnce(async (_url, options) => new Promise((_resolve, reject) => { options!.signal!.addEventListener("abort", () => reject(new Error("deadline")), { once: true }); begin(); }));
    const work = generateCreatorConfiguredImageBytes("p", new AbortController().signal), rejected = expect(work).rejects.toMatchObject({ code: "TIMEOUT" }); await ready;
    expect(timeout).toHaveBeenCalledWith(60_000); deadline.abort(); await rejected; expect(fetch).toHaveBeenCalledOnce(); timeout.mockRestore();
  });
});
describe("Creator strict verified inline PNG bytes", () => {
  it("rejects noncanonical/invalid/oversized base64 before accepting bytes", () => { for (const value of ["", "a==", "a===", "iVBORw0KGgo=\n", "A".repeat(Math.ceil(CREATOR_IMAGE_MAX_BYTES / 3) * 4 + 4)]) expect(() => decodeCreatorImageBase64(value, "image/png")).toThrow(); });
  it("accepts the actual 8 MiB limit with stack-safe canonical base64 and bounded valid PNG chunks", () => {
    const small = fixturePng(), padding = Buffer.alloc(CREATOR_IMAGE_MAX_BYTES - small.length - 12, 65);
    const large = Buffer.concat([small.subarray(0, 33), fixtureChunk("tEXt", padding), small.subarray(33)]);
    expect(large.length).toBe(CREATOR_IMAGE_MAX_BYTES); expect(decodeCreatorImageBase64(large.toString("base64"), "image/png").bytes.equals(large)).toBe(true);
  });
  it("rejects MIME/signature mismatch, unknown formats, corrupt CRC, truncation and trailing content", () => {
    const corrupt = Buffer.from(fixturePng()); corrupt[40] ^= 1;
    for (const [bytes, mime] of [[fixturePng(), "image/jpeg"], [Buffer.alloc(80), "image/png"], [corrupt, "image/png"], [fixturePng().subarray(0, 60), "image/png"], [Buffer.concat([fixturePng(), Buffer.from("extra")]), "image/png"]] as const) expect(() => verifyCreatorImageBytes(bytes, mime)).toThrow();
  });
  it("rejects dimension/decoded size/bitdepth/interlace/filter and pixel-count mismatch", () => {
    for (const image of [fixturePng(0, 1), fixturePng(4097, 1), fixturePng(3000, 3000), fixturePng(2, 2, { bitDepth: 16 }), fixturePng(2, 2, { interlace: 1 }), fixturePng(2, 2, { filter: 5 }), fixturePng(2, 2, { pixels: Buffer.alloc(100) }), fixturePng(2, 2, { pixels: Buffer.alloc(1) })]) expect(() => verifyCreatorImageBytes(image, "image/png")).toThrow();
  });
  it("rejects animation and unknown critical chunks with valid CRC", () => { const png = fixturePng(); for (const name of ["acTL", "BADD"]) { const bytes = Buffer.concat([png.subarray(0, 33), fixtureChunk(name, Buffer.alloc(8)), png.subarray(33)]); expect(() => verifyCreatorImageBytes(bytes, "image/png")).toThrow(); } });
});
