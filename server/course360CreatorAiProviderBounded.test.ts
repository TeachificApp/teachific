import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invokeCreatorAiConfigured } from "./course360CreatorAiProviderBounded";
const request = { messages: [{ role: "system" as const, content: "Strict JSON only" }, { role: "user" as const, content: "Topic" }], maxTokens: 4096, schema: { type: "object", additionalProperties: false, properties: {}, required: [] } };
const response = () => new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: '{"valid":true}' } }] }));
beforeEach(() => { vi.stubEnv("OPENAI_API_KEY", "synthetic-key"); vi.stubEnv("OPENAI_MODEL", "retained-owner-model"); vi.stubEnv("OPENAI_BASE_URL", "https://provider.invalid/v1"); vi.stubGlobal("fetch", vi.fn(async () => response())); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("Creator configured bounded AI provider actual source", () => {
  it("retains configured URL/provider/model and sends strict schema, exact cap, no tools or fallback calls", async () => {
    expect(await invokeCreatorAiConfigured(request, AbortSignal.timeout(1000))).toBe('{"valid":true}'); const call = vi.mocked(fetch).mock.calls[0]; expect(String(call[0])).toBe("https://provider.invalid/v1/chat/completions"); const options = call[1]!; const payload = JSON.parse(String(options.body)); expect(payload.model).toBe("retained-owner-model"); expect(payload.max_tokens).toBe(4096); expect(payload.response_format.json_schema.strict).toBe(true); expect(payload.response_format.json_schema.schema.additionalProperties).toBe(false); expect(options.redirect).toBe("error"); expect(options.signal).toBeInstanceOf(AbortSignal); expect(payload.tools).toBeUndefined(); expect(fetch).toHaveBeenCalledOnce();
  });
  it("keeps existing Forge default/model and never substitutes OpenAI on Forge failure", async () => {
    vi.stubEnv("OPENAI_API_KEY", ""); vi.stubEnv("BUILT_IN_FORGE_API_KEY", "synthetic-forge-key"); vi.stubEnv("BUILT_IN_FORGE_API_URL", "https://forge.invalid"); await invokeCreatorAiConfigured(request, AbortSignal.timeout(1000)); expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body)).model).toBe("gemini-3-flash-preview");
  });
  it("rejects missing config, unsafe endpoints, excessive prompt/cap without issuing HTTP", async () => {
    vi.stubEnv("OPENAI_BASE_URL", "http://unsafe.invalid"); await expect(invokeCreatorAiConfigured(request, AbortSignal.timeout(1000))).rejects.toThrow("HTTPS"); vi.stubEnv("OPENAI_BASE_URL", "https://provider.invalid"); await expect(invokeCreatorAiConfigured({ ...request, maxTokens: 32768 }, AbortSignal.timeout(1000))).rejects.toThrow("safe limits"); expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects incomplete/schema-unsupported/error/oversized output with no retries or provider switches", async () => {
    for (const r of [new Response("unavailable", { status: 400 }), new Response(JSON.stringify({ choices: [{ finish_reason: "length", message: { content: "{}" } }] })), new Response("x".repeat(128001)), new Response(JSON.stringify({ error: "error" }))]) { vi.mocked(fetch).mockResolvedValueOnce(r); await expect(invokeCreatorAiConfigured(request, AbortSignal.timeout(1000))).rejects.toThrow(); }
    expect(fetch).toHaveBeenCalledTimes(4);
  });
  it("a network timeout fails honestly without fabricating draft content", async () => { vi.mocked(fetch).mockRejectedValueOnce(new Error("Aborted")); await expect(invokeCreatorAiConfigured(request, AbortSignal.timeout(1000))).rejects.toMatchObject({ code: "TIMEOUT" }); expect(fetch).toHaveBeenCalledOnce(); });
});
