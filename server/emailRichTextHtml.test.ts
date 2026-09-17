import { describe, expect, it } from "vitest";
import { prepareEmailRichTextHtml } from "../shared/emailRichTextHtml";
import { normalizeCampaignEmailHtml } from "../shared/emailCampaignLayout";

describe("Course360 campaign rich text rendering", () => {
  it("removes unsafe and editor-only markup while retaining supported email content", () => {
    const html = prepareEmailRichTextHtml([
      '<p data-start="1" contenteditable="true">Welcome <strong>learner</strong></p>',
      '<script>alert("unsafe")</script>',
      '<iframe src="https://video.example.test/embed/1"></iframe>',
      '<img src="https://cdn.example.test/image.png" data-mce-style="width: 300px">',
    ].join(""));

    expect(html).toContain("Welcome <strong>learner</strong>");
    expect(html).toContain('<a href="https://video.example.test/embed/1"');
    expect(html).toContain("View content");
    expect(html).toContain("max-width:100%;height:auto;display:block;");
    expect(html).not.toMatch(/<script|<iframe|contenteditable|data-start|data-mce/i);
  });

  it("neutralizes unsafe URL protocols and renders math as readable email text", () => {
    const html = prepareEmailRichTextHtml([
      '<a href="javascript:alert(1)">Unsafe</a>',
      '<img src="javascript:alert(1)">',
      '<span data-type="inline-math" data-latex="E=mc^2"></span>',
    ].join(""));

    expect(html).toContain('<a href="#">Unsafe</a>');
    expect(html).not.toContain("javascript:");
    expect(html).toContain("[E=mc^2]");
  });

  it("applies the same rich text safety processing before campaign layout normalization", () => {
    const html = normalizeCampaignEmailHtml(
      '<table style="max-width:600px"><tr><td><p data-start="1"><a href="https://example.test">Hello</a></p><script>unsafe</script></td></tr></table>',
      "#0f766e",
    );

    expect(html).toContain("max-width:750px");
    expect(html).toContain("Hello");
    expect(html).toContain("color:#0f766e");
    expect(html).not.toMatch(/script|data-start/i);
  });
});
