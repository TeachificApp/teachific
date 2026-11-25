import { afterEach, describe, expect, it, vi } from "vitest";
import { invokeStudioBoundedLlm } from "./course360StudioAi";
import { transcribeStudioSpeech } from "./course360StudioIntelligence";
const config = vi.hoisted(() => vi.fn());
vi.mock("./course360AiProviderConfig", () => ({ resolveCourse360ChatConfiguration: config }));
vi.mock("../_core/env", () => ({ ENV: { forgeApiUrl: "https://speech.example.test/", forgeApiKey: "mock-not-a-credential" } }));
afterEach(() => vi.unstubAllGlobals());
const params: any = { messages: [{ role: "user", content: "timed words" }], maxTokens: 1800, response_format: { type: "json_schema", json_schema: { name: "highlights", strict: true, schema: {} } } };
describe("Studio abortable configured provider adapter (mock only)", () => {
  it("retains configured model/provider and sends abortable redirect-denied bounded request", async () => {
    config.mockReturnValue({ backend: "forge", url: "https://ai.example.test/v1/chat/completions", key: "mock-not-a-credential" });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: '{"clips":[]}' } }] })));
    vi.stubGlobal("fetch", fetchMock);
    const response = await invokeStudioBoundedLlm(params, AbortSignal.timeout(5000));
    expect(response.choices).toHaveLength(1);
    const options = fetchMock.mock.calls[0][1] as any;
    expect(options.redirect).toBe("error"); expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(options.body)).toMatchObject({ model: "gemini-3-flash-preview", max_tokens: 1800 });
  });
  it("fails closed for unconfigured provider, rejects oversized response, and surfaces upstream errors honestly", async () => {
    config.mockReturnValue(undefined); await expect(invokeStudioBoundedLlm(params, AbortSignal.timeout(1000))).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    config.mockReturnValue({ backend: "forge", url: "https://ai.example.test/v1/chat/completions", key: "mock" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("x".repeat(65_000))));
    await expect(invokeStudioBoundedLlm(params, AbortSignal.timeout(1000))).rejects.toMatchObject({ code: "PAYLOAD_TOO_LARGE" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"error":"failed"}')));
    await expect(invokeStudioBoundedLlm(params, AbortSignal.timeout(1000))).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("honors abort rather than leaving a detached provider request", async () => {
    config.mockReturnValue({ backend: "forge", url: "https://ai.example.test/v1/chat/completions", key: "mock" });
    vi.stubGlobal("fetch", vi.fn((_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true }))));
    const controller = new AbortController(); const pending = invokeStudioBoundedLlm(params, controller.signal); controller.abort();
    await expect(pending).rejects.toMatchObject({ code: "TIMEOUT" });
  });
  it("mock segment-only speech provider is normalized immediately and does not accept oversized audio", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ language: "en", text: "timed speech words", duration: 4, segments: [{ id: 0, start: 0, end: 4, text: "timed speech words" }] }))));
    const result = await transcribeStudioSpeech(Buffer.from("mock mp3 bytes"), 4, AbortSignal.timeout(1000));
    expect(result.words).toHaveLength(3); expect(result.studio.timingSource).toBe("segment-interpolation");
    await expect(transcribeStudioSpeech(Buffer.alloc(1_048_577), 4, AbortSignal.timeout(1000))).rejects.toMatchObject({ code: "PAYLOAD_TOO_LARGE" });
  });
});
