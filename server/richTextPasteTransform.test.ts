import { describe, expect, it } from "vitest";
import {
  mergeEmojiOnlyPlainTextLines,
  plainTextToPasteHtml,
  shouldFallbackToPlainTextEmojiPaste,
} from "../shared/richTextPasteTransform";

describe("Course360 rich-text paste transform", () => {
  it("merges a standalone emoji clipboard line into the following text line", () => {
    expect(mergeEmojiOnlyPlainTextLines("📚\nCourse notes\n\nNext section"))
      .toBe("📚 Course notes\n\nNext section");
  });

  it("uses the safe plaintext fallback only for missing or malformed emoji-only HTML blocks", () => {
    expect(shouldFallbackToPlainTextEmojiPaste({ pastedHtml: "", pastedText: "✨\nWelcome", hasImage: false })).toBe(true);
    expect(shouldFallbackToPlainTextEmojiPaste({ pastedHtml: "<p>✨</p><p>Welcome</p>", pastedText: "✨\nWelcome", hasImage: false })).toBe(true);
    expect(shouldFallbackToPlainTextEmojiPaste({ pastedHtml: "<p><strong>Welcome</strong></p>", pastedText: "Welcome", hasImage: false })).toBe(false);
    expect(shouldFallbackToPlainTextEmojiPaste({ pastedHtml: "<img src='data:image/png;base64,abc'>", pastedText: "✨", hasImage: true })).toBe(false);
  });

  it("escapes plaintext before creating TipTap-compatible paragraphs", () => {
    expect(plainTextToPasteHtml("<notes> & guidance\nNext line"))
      .toBe("<p>&lt;notes&gt; &amp; guidance<br>Next line</p>");
  });
});
