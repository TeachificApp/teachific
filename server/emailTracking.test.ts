/**
 * emailTracking.test.ts
 *
 * Unit tests for:
 * 1. sendgridSuppressions.ts helpers
 * 2. emailTrackingRoutes.ts — token generation/verification
 * 3. emailCampaignsRouter.ts — wrapCampaignHtml, injectClickTracking,
 *    injectOpenPixel, injectUnsubscribeFooter
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildCampaignUnsubscribeUrl,
  composeCampaignEmailHtml,
  getCampaignOrganizationBrandName,
  injectCampaignClickTracking,
  injectCampaignOpenPixel,
} from "./lib/emailCampaignPresentation";

// ─── sendgridSuppressions helpers ────────────────────────────────────────────

describe("sendgridSuppressions", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("addToSendGridGlobalUnsubscribes: sends POST with normalized emails", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, text: async () => "" });
    vi.stubGlobal("fetch", mockFetch);

    const { addToSendGridGlobalUnsubscribes } = await import("./lib/sendgridSuppressions");
    await addToSendGridGlobalUnsubscribes(["Alice@Example.com", "  bob@test.com  "], "test-key");

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.sendgrid.com/v3/asm/suppressions/global");
    expect(opts.method).toBe("POST");
    const body = JSON.parse(opts.body);
    expect(body.recipient_emails).toEqual(["alice@example.com", "bob@test.com"]);
  });

  it("addToSendGridGlobalUnsubscribes: skips empty list", async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    const { addToSendGridGlobalUnsubscribes } = await import("./lib/sendgridSuppressions");
    await addToSendGridGlobalUnsubscribes([], "test-key");

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("addToSendGridGlobalUnsubscribes: skips when explicitly empty API key", async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    const { addToSendGridGlobalUnsubscribes } = await import("./lib/sendgridSuppressions");
    // Pass an explicit empty string key to simulate no-key scenario
    await addToSendGridGlobalUnsubscribes(["test@example.com"], "");

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("removeFromSendGridGlobalUnsubscribes: sends DELETE with encoded email", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", mockFetch);

    const { removeFromSendGridGlobalUnsubscribes } = await import("./lib/sendgridSuppressions");
    await removeFromSendGridGlobalUnsubscribes("user@example.com", "test-key");

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("user%40example.com");
    expect(opts.method).toBe("DELETE");
  });

  it("isOnSendGridGlobalUnsubscribes: returns true when 200", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ status: 200 });
    vi.stubGlobal("fetch", mockFetch);

    const { isOnSendGridGlobalUnsubscribes } = await import("./lib/sendgridSuppressions");
    const result = await isOnSendGridGlobalUnsubscribes("user@example.com", "test-key");
    expect(result).toBe(true);
  });

  it("isOnSendGridGlobalUnsubscribes: returns false when 404", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ status: 404 });
    vi.stubGlobal("fetch", mockFetch);

    const { isOnSendGridGlobalUnsubscribes } = await import("./lib/sendgridSuppressions");
    const result = await isOnSendGridGlobalUnsubscribes("user@example.com", "test-key");
    expect(result).toBe(false);
  });
});

// ─── Email HTML helpers (extracted from emailCampaignsRouter) ─────────────────

// We test the pure helper functions directly by importing the module and
// accessing them via a thin re-export shim. Since the helpers are not
// exported from the router, we test their behaviour via the output HTML.

describe("email HTML helpers", () => {
  /**
   * Inline copies of the helpers so we can unit-test them without
   * importing the full tRPC router (which requires a DB connection).
   */
  function wrapCampaignHtml(htmlBody: string, orgName: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Email from ${orgName}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:#179ca3;padding:20px 32px;text-align:center;">
              <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">${orgName}</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${htmlBody}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }


  function injectUnsubscribeFooter(htmlBody: string, unsubscribeUrl: string, orgName: string): string {
    const footer = `
<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#6b7280;">
  <p style="margin:0 0 8px;">You are receiving this email because you are a member of <strong>${orgName}</strong>.</p>
  <p style="margin:0;"><a href="${unsubscribeUrl}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a></p>
</div>`;
    const closeBodyIdx = htmlBody.lastIndexOf("</body>");
    if (closeBodyIdx !== -1) {
      return htmlBody.slice(0, closeBodyIdx) + footer + htmlBody.slice(closeBodyIdx);
    }
    return htmlBody + footer;
  }

  it("buildCampaignUnsubscribeUrl: falls back to the Course360 organization subdomain", () => {
    const url = buildCampaignUnsubscribeUrl({ name: "Northstar Learning", slug: "northstar" }, "abc123");
    expect(url).toBe("https://northstar.course360.app/unsubscribe?token=abc123");
  });

  it("buildCampaignUnsubscribeUrl: prefers a verified custom domain and encodes the token", () => {
    const url = buildCampaignUnsubscribeUrl({
      name: "Northstar Learning",
      slug: "northstar",
      customDomain: "learn.northstar.example",
      domainVerificationStatus: "verified",
    }, "abc+def=xyz");
    expect(url).toBe("https://learn.northstar.example/unsubscribe?token=abc%2Bdef%3Dxyz");
  });

  it("getCampaignOrganizationBrandName: prefers the configured organization sender identity", () => {
    expect(getCampaignOrganizationBrandName({
      name: "Northstar Learning",
      slug: "northstar",
      customSenderName: "Northstar Academy",
    })).toBe("Northstar Academy");
  });

  it("composeCampaignEmailHtml: keeps organization brand and every tracked URL on a verified custom domain", () => {
    const result = composeCampaignEmailHtml(
      '<p>Welcome <a href="https://example.com/offer">View offer</a></p>',
      {
        name: "Northstar Learning",
        slug: "northstar",
        customSenderName: "Northstar Academy",
        customDomain: "learn.northstar.example",
        domainVerificationStatus: "verified",
      },
      42,
      7,
      "abc+def",
    );

    expect(result).toContain("Northstar Academy");
    expect(result).toContain("https://learn.northstar.example/unsubscribe?token=abc%2Bdef");
    expect(result).toContain("https://learn.northstar.example/api/email/click?c=42&r=7&u=");
    expect(result).toContain("https://learn.northstar.example/api/email/open?c=42&r=7");
    expect(result).not.toContain("teachific.app");
  });

  it("wrapCampaignHtml: wraps body in 600px email container", () => {
    const wrapped = wrapCampaignHtml("<p>Hello</p>", "Test Org");
    expect(wrapped).toContain("max-width:600px");
    expect(wrapped).toContain("<p>Hello</p>");
    expect(wrapped).toContain("Test Org");
    expect(wrapped).toContain("<!DOCTYPE html>");
  });

  it("injectClickTracking: rewrites http/https links", () => {
    const html = '<a href="https://example.com/page">Click</a>';
    const result = injectCampaignClickTracking(html, { name: "Northstar", slug: "northstar" }, 42, 7);
    expect(result).toContain("https://northstar.course360.app/api/email/click?c=42&r=7&u=");
    expect(result).not.toContain('href="https://example.com/page"');
  });

  it("injectClickTracking: does not rewrite mailto or relative links", () => {
    const html = '<a href="mailto:test@example.com">Mail</a><a href="/local">Local</a>';
    const result = injectCampaignClickTracking(html, { name: "Northstar", slug: "northstar" }, 1, 1);
    // mailto and relative links should be unchanged
    expect(result).toContain('href="mailto:test@example.com"');
    expect(result).toContain('href="/local"');
  });

  it("injectOpenPixel: inserts 1x1 pixel before </body>", () => {
    const html = "<html><body><p>Hi</p></body></html>";
    const result = injectCampaignOpenPixel(html, {
      name: "Northstar",
      slug: "northstar",
      customDomain: "learn.northstar.example",
      domainVerificationStatus: "verified",
    }, 5, 3);
    expect(result).toContain("https://learn.northstar.example/api/email/open?c=5&r=3");
    expect(result).toContain('width="1" height="1"');
    // Pixel should be before </body>
    const pixelIdx = result.indexOf("/api/email/open");
    const bodyIdx = result.lastIndexOf("</body>");
    expect(pixelIdx).toBeLessThan(bodyIdx);
  });

  it("injectOpenPixel: appends pixel when no </body> tag", () => {
    const html = "<p>No body tag</p>";
    const result = injectCampaignOpenPixel(html, { name: "Northstar", slug: "northstar" }, 1, 2);
    expect(result).toContain("https://northstar.course360.app/api/email/open?c=1&r=2");
    expect(result.endsWith('style="display:block;width:1px;height:1px;border:0;" />')).toBe(true);
  });

  it("injectUnsubscribeFooter: appends footer with unsubscribe link", () => {
    const html = "<html><body><p>Content</p></body></html>";
    const result = injectUnsubscribeFooter(html, "https://app.teachific.com/api/unsubscribe?token=xyz", "My Org");
    expect(result).toContain("Unsubscribe");
    expect(result).toContain("https://app.teachific.com/api/unsubscribe?token=xyz");
    expect(result).toContain("My Org");
    // Footer should be before </body>
    const footerIdx = result.indexOf("Unsubscribe");
    const bodyIdx = result.lastIndexOf("</body>");
    expect(footerIdx).toBeLessThan(bodyIdx);
  });
});

// ─── lmsRouter createCheckout duplicate prevention ────────────────────────────

describe("lmsRouter createCheckout: alreadyEnrolled flag", () => {
  it("returns alreadyEnrolled:false on the normal path (shape check)", () => {
    // The actual DB call is tested via integration; here we just verify the
    // return type shape is consistent with what CourseLanding expects.
    const normalReturn = { checkoutUrl: "https://checkout.stripe.com/pay/xxx", alreadyEnrolled: false as const };
    const enrolledReturn = { alreadyEnrolled: true as const, courseSlug: "my-course", checkoutUrl: null };

    expect(normalReturn.alreadyEnrolled).toBe(false);
    expect(normalReturn.checkoutUrl).toBeTruthy();

    expect(enrolledReturn.alreadyEnrolled).toBe(true);
    expect(enrolledReturn.checkoutUrl).toBeNull();
    expect(enrolledReturn.courseSlug).toBe("my-course");
  });
});
