const MAX_ERROR_BYTES = 8192;

/** Only a known machine code is retained; provider bodies may contain credentials or prompts. */
export async function getSafeAiProviderErrorCode(response: Response): Promise<"model_not_found" | "unknown"> {
  if (!response.body) return "unknown";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (size <= MAX_ERROR_BYTES) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_ERROR_BYTES) return "unknown";
      chunks.push(value);
    }
    const data = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { error?: { code?: unknown } };
    return data.error?.code === "model_not_found" ? "model_not_found" : "unknown";
  } catch {
    return "unknown";
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export function getAiProviderNotFoundHelp(code: "model_not_found" | "unknown"): string {
  return code === "model_not_found"
    ? "The configured AI provider cannot access the requested model (HTTP 404). Check the server AI model and provider settings before retrying."
    : "The configured AI provider returned HTTP 404 for the requested model or endpoint. Check the server AI provider settings before retrying.";
}

const MAX_CHAT_RESPONSE_BYTES = 8 * 1024 * 1024;
const INVALID_CHAT_RESPONSE = "The AI provider returned an invalid chat response. Please try again.";
const HTML_CHAT_RESPONSE = "The AI service returned a web page instead of a JSON response. Please retry; if it continues, check the server AI endpoint.";

/** Validate the provider envelope, not the model's content (which may itself be HTML). */
export async function readAiProviderChatResponse(response: Response): Promise<unknown> {
  if (!response.body) throw new Error(INVALID_CHAT_RESPONSE);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    if (response.headers.get("content-type")?.toLowerCase().includes("text/html")) {
      throw new Error(HTML_CHAT_RESPONSE);
    }
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_CHAT_RESPONSE_BYTES) {
        throw new Error("The AI provider response was too large. Please try again.");
      }
      chunks.push(value);
    }
    const text = Buffer.concat(chunks).toString("utf8").trim();
    if (/^(?:<!doctype\s+html|<html\b)/i.test(text)) throw new Error(HTML_CHAT_RESPONSE);
    let parsed: any;
    try { parsed = JSON.parse(text); } catch { throw new Error(INVALID_CHAT_RESPONSE); }
    const message = parsed?.choices?.[0]?.message;
    if (!parsed || typeof parsed !== "object" || parsed.error || !Array.isArray(parsed.choices)
      || !message || typeof message !== "object"
      || !(typeof message.content === "string" || Array.isArray(message.content)
        || (message.content == null && Array.isArray(message.tool_calls) && message.tool_calls.length > 0))) {
      throw new Error(INVALID_CHAT_RESPONSE);
    }
    return parsed;
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
