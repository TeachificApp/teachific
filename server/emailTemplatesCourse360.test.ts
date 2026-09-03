import { describe, expect, it } from "vitest";
import {
  campaignEmailHtml,
  courseEnrollmentHtml,
  magicLinkEmailHtml,
  resetPasswordHtml,
  verifyEmailHtml,
} from "./emailTemplates";

describe("Course360 custom-auth email templates", () => {
  it("uses Course360 platform fallbacks and the required linked platform attribution", () => {
    const html = verifyEmailHtml("Learner", "https://course360.app/verify-email?token=token");

    expect(html).toContain("Course360™");
    expect(html).toContain("support@course360.app");
    expect(html).toContain('href="https://soundmedianow.com/"');
    expect(html).toContain("a SoundMedia, Inc. brand");
    expect(html).not.toContain("Teachific");
    expect(html).not.toContain("teachific.app");
  });

  it("preserves organization and caller-provided learner links instead of replacing them with the platform fallback", () => {
    const organizationUrl = "https://learn.example-academy.org/courses/intro";
    const enrollmentHtml = courseEnrollmentHtml({
      userName: "Learner",
      orgName: "Example Academy",
      courseTitles: ["Introduction"],
      loginUrl: organizationUrl,
    });
    const campaignHtml = campaignEmailHtml({
      orgName: "Example Academy",
      bodyHtml: "<p>Updates</p>",
      unsubscribeUrl: "https://learn.example-academy.org/unsubscribe?token=token",
    });

    expect(enrollmentHtml).toContain(organizationUrl);
    expect(enrollmentHtml).toContain("This enrollment was managed by Example Academy.");
    expect(campaignHtml).toContain("This email was sent by <strong>Example Academy</strong>.");
    expect(campaignHtml).not.toContain("via Teachific");
  });

  it("uses Course360 language for password reset and magic-link customer messages", () => {
    expect(resetPasswordHtml("Learner", "https://course360.app/reset-password?token=token")).toContain("Course360 account");
    expect(magicLinkEmailHtml("Learner", "https://course360.app/magic-link/verify?token=token")).toContain("Sign in to Course360");
  });
});
