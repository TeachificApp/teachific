import { describe, expect, it } from "vitest";
import { normalizeCampaignEmailHtml, wrapInBrandedCampaignEmail } from "../shared/emailCampaignLayout";

describe("Course360 campaign email layout", () => {
  it("uses Course360 only as the platform fallback while preserving an organization-provided email identity", () => {
    expect(wrapInBrandedCampaignEmail("<p>Hello</p>")).toContain("Course360™");
    const organizationEmail = wrapInBrandedCampaignEmail("<p>Hello</p>", undefined, "Northwind Learning", "Learn together", "#0f766e", true, "#0f766e");
    expect(organizationEmail).toContain("Northwind Learning");
    expect(organizationEmail).toContain("Learn together");
    expect(organizationEmail).not.toContain("Course360™");
  });

  it("normalizes the same campaign HTML used for preview, draft save, and send without rewriting rich text", () => {
    const input = '<table style="max-width:600px"><tr><td><p><strong>Welcome</strong> to your course.</p><img src="https://cdn.example.test/image.png"></td></tr></table>';
    const normalized = normalizeCampaignEmailHtml(input, "#0f766e");
    expect(normalized).toContain("max-width:750px");
    expect(normalized).toContain("<strong>Welcome</strong>");
    expect(normalized).toContain('width="100%"');
  });
});
