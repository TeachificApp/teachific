import { createHash, randomBytes } from "node:crypto";

export const DEFAULT_QUIZ_WIDGET_EXPIRY_DAYS = 30;
export const MAX_QUIZ_WIDGET_EXPIRY_DAYS = 90;

/** A widget credential is URL-safe but is persisted only as a SHA-256 digest. */
export function createQuizWidgetToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashQuizWidgetToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function buildQuizWidgetEmbed(input: {
  baseUrl: string;
  token: string;
  quizTitle: string;
}): { widgetUrl: string; embedCode: string } {
  const widgetUrl = `${input.baseUrl.replace(/\/+$/, "")}/quiz/widget?token=${encodeURIComponent(input.token)}`;
  const title = input.quizTitle.replace(/["<>]/g, "").trim() || "Course360 quiz";
  return {
    widgetUrl,
    embedCode: `<iframe src="${widgetUrl}" width="100%" height="720" frameborder="0" style="border:0;border-radius:12px" title="${title}"></iframe>`,
  };
}
