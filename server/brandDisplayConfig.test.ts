import { afterEach, describe, expect, it, vi } from "vitest";
import { detectBrandMode, getBrandDisplayConfig } from "@shared/brands";

afterEach(() => vi.unstubAllEnvs());

describe("Course360 shared platform display configuration", () => {
  it("uses Course360 customer-facing defaults while retaining the legacy internal brand-mode contract", () => {
    vi.stubEnv("SENDGRID_FROM_EMAIL", undefined);
    vi.stubEnv("SENDGRID_FROM_NAME", undefined);
    vi.stubEnv("VITE_OAUTH_PORTAL_URL", undefined);
    const config = getBrandDisplayConfig(detectBrandMode("academy.course360.app"));

    expect(config.brandMode).toBe("teachific");
    expect(config.displayName).toBe("Course360™");
    expect(config.shortName).toBe("Course360");
    expect(config.senderName).toBe("Course360™");
    expect(config.senderEmail).toBe("noreply@course360.app");
    expect(config.supportEmail).toBe("support@course360.app");
    expect(config.websiteUrl).toBe("https://www.course360.app");
    expect(config.appUrl).toBe("https://course360.app");
  });

  it("does not allow stale source-branded environment fallbacks to reappear in customer-facing platform configuration", () => {
    vi.stubEnv("SENDGRID_FROM_EMAIL", "noreply@teachific.com");
    vi.stubEnv("SENDGRID_FROM_NAME", "Teachific™");
    vi.stubEnv("VITE_OAUTH_PORTAL_URL", "https://app.teachific.com");

    const config = getBrandDisplayConfig();
    expect(config.senderEmail).toBe("noreply@course360.app");
    expect(config.senderName).toBe("Course360™");
    expect(config.appUrl).toBe("https://course360.app");
  });
});
