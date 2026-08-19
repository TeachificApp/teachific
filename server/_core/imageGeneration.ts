/**
 * Image generation helper using OpenAI Images.
 *
 * Example usage:
 *   const { url: imageUrl } = await generateImage({
 *     prompt: "A serene landscape with mountains"
 *   });
 *
 * For editing:
 *   const { url: imageUrl } = await generateImage({
 *     prompt: "Add a rainbow to this landscape",
 *     originalImages: [{
 *       url: "https://example.com/original.jpg",
 *       mimeType: "image/jpeg"
 *     }]
 *   });
 */
import { storagePut } from "../storage";
import { ENV } from "./env";

export type GenerateImageOptions = {
  prompt: string;
  originalImages?: Array<{
    url?: string;
    b64Json?: string;
    mimeType?: string;
  }>;
};

export type GenerateImageResponse = {
  url?: string;
};

export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  if (!ENV.openAiApiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  if (options.originalImages?.length) {
    console.warn("[ImageGeneration] Image edits are not supported in the Railway OpenAI path yet; generating from prompt only.");
  }

  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: ENV.openAiApiKey });
  const result = await client.images.generate({
    model: ENV.openAiImageModel,
    prompt: options.prompt,
    size: "1024x1024",
  } as any);
  const image = result.data?.[0] as any;
  const base64Data = image?.b64_json;
  if (!base64Data) {
    throw new Error("Image generation returned no image data");
  }
  const buffer = Buffer.from(base64Data, "base64");

  const { url } = await storagePut(
    `generated/${Date.now()}.png`,
    buffer,
    "image/png"
  );
  return {
    url,
  };
}
