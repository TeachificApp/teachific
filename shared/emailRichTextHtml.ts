/**
 * Prepare stored rich-text HTML for email preview and delivery.
 *
 * Email clients do not support interactive embeds or editor metadata. This module
 * deliberately uses string transforms so the same safety behavior applies in
 * browser previews and server-side campaign delivery without a DOM dependency.
 */

const UNSAFE_CONTAINER_TAGS = ["script", "style", "object", "embed"] as const;

function readAttribute(attributes: string, name: string): string | null {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = attributes.match(new RegExp(`\\b${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function textFromHtml(value: string): string {
  return value.replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").trim();
}

function isSafeLink(value: string): boolean {
  return /^(?:https?:|mailto:|\/|#)/i.test(value.trim());
}

function isSafeImage(value: string): boolean {
  return /^(?:https?:|cid:|data:image\/)/i.test(value.trim());
}

function stripEditorMetadata(html: string): string {
  return html
    .replace(/\s(?:on[a-z0-9_-]+|contenteditable|spellcheck)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\sdata-[a-z0-9:_-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
}

function replaceMathNodes(html: string): string {
  return html.replace(/<(span|div)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi, (match, _tag, attributes: string, inner: string) => {
    const type = readAttribute(attributes, "data-type");
    if (type !== "block-math" && type !== "inline-math") return match;
    const latex = readAttribute(attributes, "data-latex")?.trim() ?? textFromHtml(inner);
    const display = latex ? `[${latex}]` : "";
    return `<span style="font-style:italic;color:#4a6070;">${escapeHtml(display)}</span>`;
  });
}

function replaceIframes(html: string): string {
  return html.replace(/<iframe\b([^>]*)>(?:[\s\S]*?)<\/iframe\s*>/gi, (_match, attributes: string) => {
    const src = readAttribute(attributes, "src")?.trim() ?? "";
    return src && isSafeLink(src)
      ? `<a href="${escapeHtml(src)}" style="text-decoration:underline;">View content</a>`
      : "";
  });
}

function normalizeImageTags(html: string): string {
  return html.replace(/<img\b([^>]*)>/gi, (_match, attributes: string) => {
    const src = readAttribute(attributes, "src")?.trim() ?? "";
    if (src && !isSafeImage(src)) return "";
    const style = readAttribute(attributes, "style") ?? "";
    if (/max-width\s*:/i.test(style)) return `<img${attributes}>`;
    const imageStyle = `${style}${style && !style.trim().endsWith(";") ? ";" : ""}max-width:100%;height:auto;display:block;`;
    if (/\bstyle\s*=/i.test(attributes)) {
      return `<img${attributes.replace(/\bstyle\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i, `style="${imageStyle}"`)}>`;
    }
    return `<img${attributes} style="${imageStyle}">`;
  });
}

function normalizeLinks(html: string): string {
  return html.replace(/\b(href|src)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi, (_match, attribute: string, _raw: string, doubleQuoted?: string, singleQuoted?: string, unquoted?: string) => {
    const value = doubleQuoted ?? singleQuoted ?? unquoted ?? "";
    const safe = attribute.toLowerCase() === "href" ? isSafeLink(value) : isSafeImage(value);
    return safe ? `${attribute}="${escapeHtml(value)}"` : `${attribute}="#"`;
  });
}

/** Normalize rich text HTML for reliable, non-interactive email rendering. */
export function prepareEmailRichTextHtml(html: string | null | undefined): string {
  if (!html?.trim()) return html ?? "";

  let prepared = html;
  for (const tag of UNSAFE_CONTAINER_TAGS) {
    prepared = prepared.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, "gi"), "");
    prepared = prepared.replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, "gi"), "");
  }
  prepared = replaceMathNodes(prepared);
  prepared = replaceIframes(prepared);
  prepared = stripEditorMetadata(prepared);
  prepared = normalizeLinks(prepared);
  return normalizeImageTags(prepared);
}
