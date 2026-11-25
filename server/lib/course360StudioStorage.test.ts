import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { resolveStudioStorage, requestStudioStorage, assertStudioRegistrationUrl } from "./course360StudioStorage";
import { parseStudioVtt, validateStudioTranscript, segmentWords } from "./course360StudioTimeline";
const lookup = vi.hoisted(() => vi.fn());
const request = vi.hoisted(() => vi.fn());
vi.mock("node:dns/promises", () => ({ lookup }));
vi.mock("node:https", () => ({ default: { request } }));
vi.mock("../_core/env", () => ({ ENV: { forgeApiUrl: "https://storage-api.test/", forgeApiKey: "mock-not-a-credential" } }));
afterEach(() => vi.unstubAllGlobals());
beforeEach(() => vi.clearAllMocks());
describe("Studio authoritative storage safety (mock transport only)", () => {
  it("resolves only the owned key through bounded storage lookup and rejects private provider-returned URL", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ url: "https://cdn.test/org-7/key?signature=mock" })));
    vi.stubGlobal("fetch", fetchMock);
    expect(await resolveStudioStorage("org-7/key")).toMatchObject({ key: "org-7/key" });
    expect(fetchMock.mock.calls[0][0].searchParams.get("path")).toBe("org-7/key");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: "error", signal: expect.any(AbortSignal) });
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ url: "http://127.0.0.1/internal" })));
    await expect(resolveStudioStorage("org-7/key")).rejects.toThrow();
  });
  it("rejects private or mixed public/private DNS before an HTTP request", async () => {
    lookup.mockResolvedValue([{ address: "127.0.0.1", family: 4 }]);
    await expect(requestStudioStorage("https://cdn.test/key", "GET", AbortSignal.timeout(1000))).rejects.toThrow(/public/);
    lookup.mockResolvedValue([{ address: "8.8.8.8", family: 4 }, { address: "10.0.0.1", family: 4 }]);
    await expect(requestStudioStorage("https://cdn.test/key", "GET", AbortSignal.timeout(1000))).rejects.toThrow(/public/);
    expect(request).not.toHaveBeenCalled();
  });
  it("pins the public address and rejects redirects rather than following them", async () => {
    lookup.mockResolvedValue([{ address: "8.8.8.8", family: 4 }]);
    const destroyed = vi.fn();
    request.mockImplementation((_options, callback) => {
      const req: any = new EventEmitter(); req.setTimeout = vi.fn(); req.end = () => callback({ statusCode: 302, headers: { location: "http://127.0.0.1/internal" }, destroy: destroyed }); return req;
    });
    await expect(requestStudioStorage("https://cdn.test/key", "GET", AbortSignal.timeout(1000))).rejects.toThrow(/redirects/);
    const options = request.mock.calls[0][0]; const callback = vi.fn(); options.lookup("cdn.test", {}, callback);
    expect(callback).toHaveBeenCalledWith(null, "8.8.8.8", 4); expect(destroyed).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledOnce();
  });
  it("does not accept another object hidden in a generic download URL query", () => {
    expect(() => assertStudioRegistrationUrl("https://cdn.test/download?object=other", "org-7/key", "https://cdn.test/download?object=org-7/key")).toThrow();
    expect(() => assertStudioRegistrationUrl("https://cdn.test/org-7/key?sig=old", "org-7/key", "https://cdn.test/org-7/key?sig=new")).not.toThrow();
  });
  it("preserves VTT-only legacy editing with validated finite timed words", () => {
    const segments = parseStudioVtt("WEBVTT\n\n1\n00:00:00.000 --> 00:00:01.000\nLegacy captions\n");
    expect(segmentWords(segments)).toHaveLength(2);
    expect(() => validateStudioTranscript({ segments, words: segmentWords(segments) }, 1)).not.toThrow();
    expect(() => parseStudioVtt("WEBVTT\n\n00:00:00.000 --> 00:99:01.000\ninvalid")).toThrow();
  });
});
