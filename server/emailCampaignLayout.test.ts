import { describe, expect, it } from "vitest";
import { normalizeCampaignEmailHtml, wrapInBrandedCampaignEmail } from "../shared/emailCampaignLayout";

describe("Course360 campaign email layout", () => {
  it("uses Course360 only as the platform fallback while preserving an organization-provided email identity", () => {
    expect(wrapInBrandedCampaignEmail("<p>Hello</p>")).toContain("Course360™");
    expect(wrapInBrandedCampaignEmail("<p>Hello</p>")).toContain("a SoundMedia, Inc. brand");
    const organizationEmail = wrapInBrandedCampaignEmail("<p>Hello</p>", undefined, "Northwind Learning", "Learn together", "#0f766e", true, "#0f766e");
    expect(organizationEmail).toContain("Northwind Learning");
    expect(organizationEmail).toContain("Learn together");
    expect(organizationEmail).not.toContain("Course360™");
  });

  it("makes verified organization identity authoritative and safely renders an organization logo", () => {
    const organizationEmail = wrapInBrandedCampaignEmail(
      "<p>Hello</p>",
      "Preview",
      "Ignored campaign title",
      "School updates",
      "#0f766e",
      true,
      "#0f766e",
      "Northwind Learning",
      "https://cdn.example.test/northwind-logo.png",
    );
    expect(organizationEmail).toContain("Northwind Learning");
    expect(organizationEmail).toContain('src="https://cdn.example.test/northwind-logo.png"');
    expect(organizationEmail).toContain("background:#0f766e;");
    expect(organizationEmail).toContain("Ignored campaign title");
    expect(organizationEmail.indexOf("Northwind Learning")).toBeLessThan(organizationEmail.indexOf("Ignored campaign title"));
    expect(organizationEmail).not.toContain("Course360™");
    expect(organizationEmail).not.toContain("a SoundMedia, Inc. brand");
  });

  it("can hide optional campaign copy without hiding the organization identity", () => {
    const organizationEmail = wrapInBrandedCampaignEmail(
      "<p>Hello</p>",
      undefined,
      "Campaign headline",
      "Campaign subheading",
      undefined,
      false,
      "#0f766e",
      "Northwind Learning",
    );
    expect(organizationEmail).toContain("Northwind Learning");
    expect(organizationEmail).not.toContain("Campaign headline");
    expect(organizationEmail).not.toContain("Campaign subheading");
  });

  it("escapes organization presentation text and omits unsafe logo URLs", () => {
    const email = wrapInBrandedCampaignEmail(
      "<p>Hello</p>",
      undefined,
      undefined,
      undefined,
      "url(javascript:alert(1))",
      true,
      "javascript:alert(1)",
      '<img src=x onerror=alert(1)>',
      "javascript:alert(1)",
    );
    expect(email).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(email).not.toContain('src="javascript:alert(1)"');
    expect(email).toContain("background:#189aa1;");
  });

  it("normalizes the same campaign HTML used for preview, draft save, and send without rewriting rich text", () => {
    const input = '<table style="max-width:600px"><tr><td><p><strong>Welcome</strong> to your course.</p><img src="https://cdn.example.test/image.png"></td></tr></table>';
    const normalized = normalizeCampaignEmailHtml(input, "#0f766e");
    expect(normalized).toContain("max-width:750px");
    expect(normalized).toContain("<strong>Welcome</strong>");
    expect(normalized).toContain('width="100%"');
  });
});
