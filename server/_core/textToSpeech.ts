/**
 * Text-to-Speech helper using the Manus Forge API (OpenAI-compatible /audio/speech endpoint).
 *
 * Usage:
 *   const { buffer, mimeType } = await generateSpeech({ text: "Hello world", voice: "nova", speed: 1.0 });
 */
import { ENV } from "./env";

export type TTSOptions = {
  text: string;
  voice?: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
  speed?: number; // 0.25 – 4.0, default 1.0
  model?: string; // default "tts-1"
};

export type TTSResult = {
  buffer: Buffer;
  mimeType: "audio/mpeg";
};

export async function generateSpeech(options: TTSOptions): Promise<TTSResult> {
  if (!ENV.forgeApiUrl) throw new Error("BUILT_IN_FORGE_API_URL is not configured");
  if (!ENV.forgeApiKey) throw new Error("BUILT_IN_FORGE_API_KEY is not configured");

  const baseUrl = ENV.forgeApiUrl.endsWith("/") ? ENV.forgeApiUrl : `${ENV.forgeApiUrl}/`;
  // OpenAI-compatible endpoint exposed by the Forge proxy
  const url = new URL("v1/audio/speech", baseUrl).toString();

  const body = {
    model: options.model ?? "tts-1",
    input: options.text,
    voice: options.voice ?? "nova",
    speed: options.speed ?? 1.0,
    response_format: "mp3",
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.forgeApiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`TTS API error ${response.status}: ${errText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), mimeType: "audio/mpeg" };
}
