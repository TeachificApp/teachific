import { invokeLLM, type InvokeParams, type InvokeResult } from "../_core/llm";
import { resolveCourse360ChatConfiguration } from "./course360AiProviderConfig";
import { readAiProviderChatResponse, getSafeAiProviderErrorCode, getAiProviderNotFoundHelp } from "./course360AiProviderError";
import type { Course360SourcePart } from "./course360AiCourseSourceMessage";

/** Isolated source adapter: existing non-source callers keep the shared LLM behavior. */
export async function invokeCourse360SourceLLM(params: Omit<InvokeParams, "messages"> & { messages: Array<{ role: "system" | "user"; content: string | Course360SourcePart[] }> }): Promise<InvokeResult> {
  if (params.messages.every(message => typeof message.content === "string")) return invokeLLM(params as InvokeParams);
  const configuration = resolveCourse360ChatConfiguration();
  if (!configuration) throw new Error("No LLM backend configured. Configure a complete server AI provider URL/key pair.");
  const openai = configuration.backend === "openai";
  const payload = {
    model: openai ? process.env.OPENAI_MODEL || "gpt-4o-mini" : "gemini-3-flash-preview",
    messages: params.messages,
    max_tokens: params.maxTokens ?? params.max_tokens ?? (openai ? 4096 : 32768),
    ...(!openai ? { thinking: { budget_tokens: 128 } } : {}),
    ...(params.response_format ? { response_format: params.response_format } : {}),
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    let response: Response;
    try {
      response = await fetch(configuration.url, { method: "POST", redirect: "manual", headers: { "content-type": "application/json", authorization: `Bearer ${configuration.key}` }, body: JSON.stringify(payload) });
    } catch { throw new Error("AI generation is temporarily unavailable. Please try again."); }
    if (response.ok) return await readAiProviderChatResponse(response) as InvokeResult;
    if (response.status === 404) throw new Error(getAiProviderNotFoundHelp(await getSafeAiProviderErrorCode(response)));
    if (response.status === 429 && attempt === 0) {
      const seconds = Number(response.headers.get("retry-after"));
      const delay = Number.isFinite(seconds) && seconds >= 0 ? Math.min(seconds * 1000, 5000) : 500;
      await response.body?.cancel().catch(() => undefined);
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      continue;
    }
    await response.body?.cancel().catch(() => undefined);
    throw new Error(response.status === 429 ? "AI generation is temporarily busy. Please try again shortly." : "AI generation is temporarily unavailable. Please try again.");
  }
  throw new Error("AI generation is temporarily busy. Please try again shortly.");
}
