import { TRPCError } from "@trpc/server";
import type { InvokeParams, InvokeResult } from "../_core/llm";
import { resolveCourse360ChatConfiguration } from "./course360AiProviderConfig";

/** The existing shared invokeLLM has no cancellation contract. This isolated
 * adapter retains its configured provider/model, adds a hard deadline/response
 * cap, and does not change any other caller's AI behavior. */
export async function invokeStudioBoundedLlm(params: InvokeParams, signal: AbortSignal): Promise<InvokeResult> {
  const config = resolveCourse360ChatConfiguration();
  if (!config) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Studio AI is not configured." });
  const url = new URL(config.url);
  if (url.protocol !== "https:" || url.username || url.password) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Studio AI requires a configured HTTPS provider endpoint." });
  const providerSignal = AbortSignal.any([signal, AbortSignal.timeout(40_000)]);
  const openai = config.backend === "openai";
  const payload = { model: openai ? process.env.OPENAI_MODEL || "gpt-4o-mini" : "gemini-3-flash-preview",
    messages: params.messages, max_tokens: params.maxTokens ?? 1800,
    ...(!openai ? { thinking: { budget_tokens: 128 } } : {}), response_format: params.response_format };
  let response: Response;
  try {
    response = await fetch(url, { method: "POST", redirect: "error", signal: providerSignal,
      headers: { "content-type": "application/json", "Accept-Encoding": "identity", authorization: `Bearer ${config.key}` }, body: JSON.stringify(payload) });
  } catch { throw new TRPCError({ code: "TIMEOUT", message: "Studio AI failed or timed out; retry without any fabricated highlights." }); }
  if (!response.ok || !response.body) {
    await response.body?.cancel().catch(() => {});
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Studio AI provider is unavailable; retry shortly." });
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.length;
      if (bytes > 64_000) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Studio AI response exceeded the bounded limit." }); chunks.push(part.value); }
    const result = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (result.error || !Array.isArray(result.choices)) throw new Error();
    return result as InvokeResult;
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    throw new TRPCError({ code: "BAD_REQUEST", message: "Studio AI returned an invalid or incomplete response." });
  } finally { await reader.cancel().catch(() => {}); }
}
