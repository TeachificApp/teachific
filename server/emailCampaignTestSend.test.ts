import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routerSource = readFileSync(
  new URL("./routers/emailCampaignRouter.ts", import.meta.url),
  "utf8",
);
const editorSource = readFileSync(
  new URL("../client/src/pages/EmailCampaignEditor.tsx", import.meta.url),
  "utf8",
);

function procedureSlice(name: string, nextName: string): string {
  const start = routerSource.indexOf(`${name}: protectedProcedure`);
  const end = routerSource.indexOf(`${nextName}: protectedProcedure`, start + 1);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return routerSource.slice(start, end);
}

describe("campaign self-test email", () => {
  it("uses the active organization and the authenticated author email instead of a caller-selected recipient", () => {
    const slice = procedureSlice("sendTestEmail", "sendCampaign");
    expect(slice).toContain("const orgId = await requireActiveEmailMarketingOrg(ctx.user);");
    expect(slice).toContain("if (!ctx.user.email)");
    expect(slice).toContain("email: ctx.user.email");
    expect(slice).not.toMatch(/recipientEmail|testRecipient|\bto:\s*z\./);
  });

  it("reuses organization branding and validates the selected sender profile", () => {
    const slice = procedureSlice("sendTestEmail", "sendCampaign");
    expect(slice).toContain("validateSenderProfileForOrg(db, input.senderProfileId, orgId)");
    expect(slice).toContain("getEmailCampaignOrgContext(db, orgId)");
    expect(slice).toContain("buildCampaignHtmlForOrganization(input.htmlBody, input.previewText, orgContext");
    expect(slice).toContain("subject: `[Test] ${input.subject}`");
  });

  it("does not create a campaign, resolve an audience, or attach campaign tracking to a self-test", () => {
    const slice = procedureSlice("sendTestEmail", "sendCampaign");
    expect(slice).not.toContain("insert(emailCampaigns)");
    expect(slice).not.toContain("resolveRecipients");
    expect(slice).not.toContain("injectTrackingPixel");
    expect(slice).not.toContain("wrapLinksForTracking");
  });

  it("enforces a low-volume rate limit before calling the delivery provider", () => {
    const slice = procedureSlice("sendTestEmail", "sendCampaign");
    expect(routerSource).toContain("const CAMPAIGN_TEST_SEND_LIMIT = 3;");
    expect(routerSource).toContain("const CAMPAIGN_TEST_SEND_WINDOW_MS = 10 * 60 * 1000;");
    expect(slice).toContain("countRecentCampaignTestSends(db, ctx.user.id, ctx.user.email)");
    expect(slice).toContain("claimCampaignTestSendAttempt(attemptKey, persistedAttemptCount)");
    expect(slice.indexOf("claimCampaignTestSendAttempt")).toBeLessThan(slice.indexOf("const sent = await sendEmail"));
  });

  it("requires an explicit confirmation in the editor and keeps the destination read-only", () => {
    expect(editorSource).toContain("trpc.emailCampaign.sendTestEmail.useMutation");
    expect(editorSource).toContain("function confirmSendTest()");
    expect(editorSource).toContain("A test of <strong>“{subject}”</strong> will be sent only to your signed-in account.");
    expect(editorSource).toContain("This does not create a campaign, notify the selected audience, or record campaign tracking. Up to 3 tests can be sent every 10 minutes.");
    expect(editorSource).toContain("{user?.email ?? \"No account email is available\"}");
    expect(editorSource).not.toContain("Test recipient email");
  });
});
