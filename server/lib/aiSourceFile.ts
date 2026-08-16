export const AI_SOURCE_FILE_MAX_BYTES = 50 * 1024 * 1024;

export const AI_SOURCE_FILE_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AiSourceFileMimeType = typeof AI_SOURCE_FILE_MIME_TYPES[number];

export type AiSourceFile = {
  url: string;
  mimeType: AiSourceFileMimeType;
  name: string;
};

export function isSupportedAiSourceMimeType(mimeType: string | undefined): mimeType is AiSourceFileMimeType {
  return Boolean(mimeType && (AI_SOURCE_FILE_MIME_TYPES as readonly string[]).includes(mimeType));
}

export function isWithinAiSourceFileSizeLimit(size: number) {
  return Number.isFinite(size) && size >= 0 && size <= AI_SOURCE_FILE_MAX_BYTES;
}

export function buildAiSourceMessage(instruction: string, sourceInput?: AiSourceFile | AiSourceFile[]) {
  const sourceFiles = (Array.isArray(sourceInput) ? sourceInput : sourceInput ? [sourceInput] : []).slice(0, 3);
  if (!sourceFiles.length) return instruction;
  const context = `Use the attached source file${sourceFiles.length === 1 ? "" : "s"} (${sourceFiles.map(file => `“${file.name}”`).join(", ")}) as the primary factual source. Do not invent details absent from ${sourceFiles.length === 1 ? "it" : "them"}.\n\n${instruction}`;
  return [
    { type: "text", text: context },
    ...sourceFiles.map(file => file.mimeType === "application/pdf"
      ? { type: "file_url", file_url: { url: file.url, mime_type: "application/pdf" } }
      : { type: "image_url", image_url: { url: file.url, detail: "high" } }),
  ];
}
