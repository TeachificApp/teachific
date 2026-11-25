import { TRPCError } from "@trpc/server";
import { resolveCourse360ChatConfiguration } from "./lib/course360AiProviderConfig";
export type CreatorAiProviderRequest = { messages: { role: "system" | "user"; content: string }[]; schema: Record<string, unknown>; maxTokens: number };
/** Isolated cancellation contract; no shared provider behavior or model changes. */
export async function invokeCreatorAiConfigured(request: CreatorAiProviderRequest, signal: AbortSignal) {
  const config = resolveCourse360ChatConfiguration();
  if (!config) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Creator AI is not configured. Ask the account administrator to configure the existing course AI provider." });
  const url = new URL(config.url);
  if (url.protocol !== "https:" || url.username || url.password) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Creator AI requires a configured HTTPS provider endpoint." });
  if (JSON.stringify(request.messages).length > 24000 || request.maxTokens < 1 || request.maxTokens > 4096) throw new TRPCError({ code: "BAD_REQUEST", message: "AI request exceeds safe limits." });
  // Match _core/llm exactly: OpenAI's explicit model and Forge's retained configured default.
  const model = config.backend === "openai" ? process.env.OPENAI_MODEL || "gpt-4o-mini" : "gemini-3-flash-preview";
  const body = { model, messages: request.messages,
    ...(config.backend === "openai" && /^gpt-5/.test(model) ? { max_completion_tokens: request.maxTokens } : { max_tokens: request.maxTokens }),
    ...(config.backend === "forge" ? { thinking: { budget_tokens: 128 } } : {}),
    response_format: { type: "json_schema", json_schema: { name: "creator_draft", strict: true, schema: request.schema } },
  };
  let response: Response;
  try { response = await fetch(url, { method: "POST", redirect: "error", signal: AbortSignal.any([signal, AbortSignal.timeout(45000)]), headers: { "content-type": "application/json", "Accept-Encoding": "identity", authorization: `Bearer ${config.key}` }, body: JSON.stringify(body) }); }
  catch { throw new TRPCError({ code: "TIMEOUT", message: "Creator AI failed or timed out. Your existing content is unchanged." }); }
  if (!response.ok || !response.body) { await response.body?.cancel().catch(() => {}); throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The configured AI provider is unavailable or does not support structured drafts. No provider/model was switched." }); }
  const reader = response.body.getReader(); let bytes = 0; const chunks: Uint8Array[] = [];
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break; bytes += value.length; if (bytes > 128000) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "AI response exceeds the bounded limit." }); chunks.push(value); }
    const result = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (result.error || !result.choices?.[0] || result.choices[0].finish_reason !== "stop" || typeof result.choices[0].message?.content !== "string") throw new Error();
    return result.choices[0].message.content as string;
  } catch (e) { if (e instanceof TRPCError) throw e; throw new TRPCError({ code: "BAD_REQUEST", message: "AI returned an invalid or incomplete response. Nothing has been applied." }); }
  finally { await reader.cancel().catch(() => {}); }
}
