import { hasUsableSubscriptionStatus } from "../../shared/subscriptionEntitlement";

export const COURSE360_AI_SOURCE_MAX_BYTES = 50 * 1024 * 1024;
export const COURSE360_PPT_MIME = "application/vnd.ms-powerpoint" as const;
export const COURSE360_PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation" as const;
export const COURSE360_AI_SOURCE_MIMES = ["application/pdf", "image/jpeg", "image/png", "image/webp", COURSE360_PPT_MIME, COURSE360_PPTX_MIME] as const;
export type Course360SourceMime = typeof COURSE360_AI_SOURCE_MIMES[number];

/** Browser Office MIME aliases are disambiguated by extension, then verified by parser bytes. */
export function normalizeCourse360SourceMime(mime: string | undefined, name?: string): Course360SourceMime | undefined {
  const extension = name?.split(".").pop()?.toLowerCase();
  const extensions: Record<string, Course360SourceMime> = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", ppt: COURSE360_PPT_MIME, pptx: COURSE360_PPTX_MIME };
  if (extension === "ppt" || extension === "pptx") return extensions[extension];
  if ((COURSE360_AI_SOURCE_MIMES as readonly string[]).includes(mime ?? "")) return mime as Course360SourceMime;
  return extension ? extensions[extension] : undefined;
}

/** New source-aware/AI-planned course features require the active school's Pro plan. */
export function canUseCourse360AdvancedAi(plan?: string | null, status?: string | null): boolean {
  return (plan === "pro" || plan === "enterprise") && hasUsableSubscriptionStatus(status);
}
