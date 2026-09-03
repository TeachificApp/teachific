import { afterEach, describe, expect, it, vi } from "vitest";
import { getEmailCampaignAppUrl } from "./lib/emailCampaignTracking";

describe("email campaign tracking URL resolution", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the Course360 platform URL only when no organization learner base URL or configured platform URL exists", () => {
    vi.stubEnv("VITE_APP_URL", "");
    vi.stubEnv("CANONICAL_ROOT_DOMAIN", "");

    expect(getEmailCampaignAppUrl()).toBe("https://course360.app");
  });

  it("uses the owning organization learner base URL before any platform fallback", () => {
    vi.stubEnv("VITE_APP_URL", "https://course360.app");
    vi.stubEnv("CANONICAL_ROOT_DOMAIN", "course360.app");

    expect(getEmailCampaignAppUrl("https://learn.example-organization.com/")).toBe(
      "https://learn.example-organization.com",
    );
  });
});
