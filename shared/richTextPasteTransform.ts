const NON_STANDARD_ATTRS = ["containerstyle", "wrapperstyle", "containerStyle", "wrapperStyle"];
const BANNED_ATTR_PREFIXES = ["data-mce", "data-stringify", "data-sheets"];
const CHATGPT_ATTRS = ["data-start", "data-end", "data-is-only-node", "data-is-last-node"];

export function isEmojiOnlyText(text: string): boolean {
  if (!text.trim()) return false;
  return text.replace(/\p{Emoji}/gu, "").replace(/[\u200D\uFE0F\u20E3]/g, "").replace(/\s/g, "").length === 0;
}

/** Merge a standalone emoji line into the next content line for plain-text clipboard fallbacks. */
export function mergeEmojiOnlyPlainTextLines(text: string): string {
  const lines = text.split("\n");
  const merged: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const next = lines[index + 1];
    if (line.trim() && isEmojiOnlyText(line.trim()) && next?.trim()) {
      merged.push(`${line.trim()} ${next.trim()}`);
      index += 1;
    } else {
      merged.push(line);
    }
  }
  return merged.join("\n");
}

function pastedHtmlHasEmojiOnlyBlocks(html: string) {
  return /<(?:p|div|li)[^>]*>\s*(?:[\p{Emoji_Presentation}\u200D\uFE0F\u20E3\s]+)\s*<\/(?:p|div|li)>/mu.test(html);
}

/** Preserve normal rich HTML; use plaintext only when clipboard HTML is absent or malformed around emoji-only blocks. */
export function shouldFallbackToPlainTextEmojiPaste({ pastedHtml, pastedText, hasImage }: { pastedHtml: string; pastedText: string; hasImage: boolean }) {
  return !hasImage && Boolean(pastedText.trim()) && /\p{Emoji}/u.test(pastedText) && (!pastedHtml.trim() || pastedHtmlHasEmojiOnlyBlocks(pastedHtml));
}

export function plainTextToPasteHtml(text: string): string {
  return mergeEmojiOnlyPlainTextLines(text).split(/\n{2,}/).map((paragraph) => {
    const inner = paragraph.split("\n").map((line) => line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")).join("<br>");
    return `<p>${inner}</p>`;
  }).join("");
}

function normalizeInlineStyleSpans(doc: Document) {
  const spans = Array.from(doc.body.querySelectorAll<HTMLSpanElement>("span[style]")).reverse();
  for (const span of spans) {
    const style = span.getAttribute("style") ?? "";
    const formats = [
      [/font-weight:\s*(bold|[6-9]00|bolder)/i.test(style), "strong"],
      [/font-style:\s*italic/i.test(style), "em"],
      [/text-decoration(?:-line)?:\s*[^;]*underline/i.test(style), "u"],
    ] as const;
    if (!formats.some(([enabled]) => enabled)) continue;
    let target: HTMLElement = span;
    for (const [enabled, tag] of formats) {
      if (!enabled) continue;
      const wrapper = doc.createElement(tag);
      while (target.firstChild) wrapper.appendChild(target.firstChild);
      target.replaceWith(wrapper);
      target = wrapper;
    }
  }
}

function mergeEmojiOnlyBlocks(doc: Document) {
  const blocks = Array.from(doc.body.querySelectorAll<HTMLElement>("p, li, div"));
  for (let index = 0; index < blocks.length - 1; index += 1) {
    const block = blocks[index];
    const next = blocks[index + 1];
    if (!block.parentNode || block.parentNode !== next.parentNode) continue;
    const text = block.textContent?.trim() ?? "";
    if (text && isEmojiOnlyText(text)) {
      next.insertBefore(doc.createTextNode(`${text} `), next.firstChild);
      block.remove();
      index -= 1;
    }
  }
}

function convertMathMlToTipTap(doc: Document) {
  doc.body.querySelectorAll<HTMLElement>("math").forEach((math) => {
    const latex = math.querySelector('annotation[encoding="application/x-tex"]')?.textContent?.trim() ?? "";
    if (!latex) return;
    const isBlock = math.getAttribute("display") === "block" || math.closest(".math-display, .katex-display, [data-display='block']") !== null;
    const replacement = doc.createElement(isBlock ? "div" : "span");
    replacement.setAttribute("data-type", isBlock ? "block-math" : "inline-math");
    replacement.setAttribute("data-latex", latex);
    (math.closest(".math, .math-inline, .math-display") ?? math).replaceWith(replacement);
  });
}

/** Normalize paste-only external markup before TipTap parses it. */
export function normalizePastedRichTextHtml(html: string): string {
  if (!html.trim()) return html;
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    convertMathMlToTipTap(doc);
    doc.body.querySelectorAll("*").forEach((element) => {
      NON_STANDARD_ATTRS.forEach((attr) => element.removeAttribute(attr));
      CHATGPT_ATTRS.forEach((attr) => element.removeAttribute(attr));
      Array.from(element.attributes).forEach((attribute) => {
        if (BANNED_ATTR_PREFIXES.some((prefix) => attribute.name.startsWith(prefix))) element.removeAttribute(attribute.name);
      });
    });
    normalizeInlineStyleSpans(doc);
    mergeEmojiOnlyBlocks(doc);
    return doc.body.innerHTML;
  } catch {
    return html;
  }
}
