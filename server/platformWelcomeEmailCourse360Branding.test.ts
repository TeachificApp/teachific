import { describe, expect, it } from "vitest";
import {
  buildPlatformFreeWelcomeEmail,
  buildPlatformPremiumWelcomeEmail,
} from "./_core/email";

describe("Course360 platform welcome email fallbacks", () => {
  const options = {
    firstName: "Avery",
    loginUrl: "https://academy.example.com/login",
  };

  it("renders free-account onboarding with Course360 and no legacy clinical defaults", () => {
    const email = buildPlatformFreeWelcomeEmail(options);
    expect(email.subject).toContain("Course360™");
    expect(email.previewText).toContain("Course360");
    expect(email.htmlBody).toContain(options.loginUrl);
    expect(email.htmlBody).toContain("support@course360.app");
    expect(email.htmlBody).not.toMatch(/Teachific|TI-RADS|Thyroid/i);
  });

  it("renders plan-access onboarding with Course360 and neutral capabilities", () => {
    const email = buildPlatformPremiumWelcomeEmail(options);
    expect(email.subject).toContain("Course360™");
    expect(email.previewText).toContain("Course360");
    expect(email.htmlBody).toContain(options.loginUrl);
    expect(email.htmlBody).toContain("Expanded course and content access");
    expect(email.htmlBody).not.toMatch(/Teachific|Clinical Intelligence|SoundBytes/i);
  });
});
