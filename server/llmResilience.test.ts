import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const envKeys = ["OPENAI_API_KEY", "BUILT_IN_FORGE_API_URL", "BUILT_IN_FORGE_API_KEY"] as const;
const originalEnv: Record<string, string | undefined> = {};
const originalFetch = global.fetch;

describe("Course360 Forge LLM resilience", () => {
  beforeEach(() => {
    for (const key of envKeys) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
    process.env.BUILT_IN_FORGE_API_URL = "https://forge.test";
    process.env.BUILT_IN_FORGE_API_KEY = "test-forge-key";
    vi.resetModules();
  });

  afterEach(() => {
    for (const key of envKeys) {
      const value = originalEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    global.fetch = originalFetch;
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("retries exactly once after a rate limit and returns the completed response", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("provider detail", { status: 429, headers: { "retry-after": "0" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: "chatcmpl-after-retry",
        created: 1,
        model: "gemini-3-flash-preview",
        choices: [{ index: 0, message: { role: "assistant", content: "Generated" }, finish_reason: "stop" }],
      }), { status: 200 }));
    global.fetch = fetchMock as typeof fetch;
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { invokeLLM } = await import("./_core/llm");

    await expect(invokeLLM({ messages: [{ role: "user", content: "Generate content." }] }))
      .resolves.toMatchObject({ id: "chatcmpl-after-retry" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(warning).toHaveBeenCalledWith(expect.stringContaining("retrying once"));
  });

  it("stops after one rate-limit retry and does not expose provider response text", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("sensitive provider rate-limit detail", { status: 429, headers: { "retry-after": "0" } }))
      .mockResolvedValueOnce(new Response("sensitive provider rate-limit detail", { status: 429, headers: { "retry-after": "0" } }));
    global.fetch = fetchMock as typeof fetch;
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { invokeLLM } = await import("./_core/llm");

    await expect(invokeLLM({ messages: [{ role: "user", content: "Generate content." }] }))
      .rejects.toThrow("AI generation is temporarily busy. Please try again shortly.");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns a generic temporary-unavailability error for non-rate-limit provider failures", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response("sensitive upstream payload", { status: 500 })) as typeof fetch;
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { invokeLLM } = await import("./_core/llm");

    await expect(invokeLLM({ messages: [{ role: "user", content: "Generate content." }] }))
      .rejects.toThrow("AI generation is temporarily unavailable. Please try again.");
  });
});
