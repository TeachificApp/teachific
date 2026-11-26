import { describe, expect, it } from "vitest";
import { isCourse360CrossToolOnboardingConfigured } from "./lib/course360CrossToolOnboardingReadiness";

describe("package onboarding configuration readiness", () => {
  it.each([undefined, "", " "])("blocks absent transport %s", SENDGRID_API_KEY => {
    expect(isCourse360CrossToolOnboardingConfigured({ SENDGRID_API_KEY })).toBe(false);
  });
  it("requires the retained actual transport and allows its default sender without claiming delivery", () => {
    expect(isCourse360CrossToolOnboardingConfigured({ SENDGRID_API_KEY: "SG_nonsecret_fixture" })).toBe(true);
  });
  it.each(["", "not-an-email", " user@example.test", "x@example.test\n"])("blocks unusable sender %s", SENDGRID_FROM_EMAIL => {
    expect(isCourse360CrossToolOnboardingConfigured({ SENDGRID_API_KEY: "SG_nonsecret_fixture", SENDGRID_FROM_EMAIL })).toBe(false);
  });
  it("uses an existing custom sender without rewriting it", () => {
    const env = Object.freeze({ SENDGRID_API_KEY: "SG_nonsecret_fixture", SENDGRID_FROM_EMAIL: "notify@course360.app" });
    expect(isCourse360CrossToolOnboardingConfigured(env)).toBe(true);
    expect(env.SENDGRID_FROM_EMAIL).toBe("notify@course360.app");
  });
});
