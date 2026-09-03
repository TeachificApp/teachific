import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getPlatformDisputeDashboardUrl } from "./stripeWebhookRoutes";

const webhookSource = fs.readFileSync(path.resolve(process.cwd(), "server/stripeWebhookRoutes.ts"), "utf8");

describe("Course360 Stripe dispute notification fallbacks", () => {
  it("uses the Course360 platform dashboard fallback while retaining the compatible dispute panel key", () => {
    expect(getPlatformDisputeDashboardUrl()).toBe("https://course360.app/admin?tab=teachificpay&subtab=disputes");
  });

  it("uses Course360 display copy while retaining persisted TeachificPay compatibility identifiers", () => {
    expect(webhookSource).toContain("Course360™ automated notification");
    expect(webhookSource).toContain("Automated notification from Course360™");
    expect(webhookSource).toContain("teachificPayDisputes");
    expect(webhookSource).not.toContain("https://teachific.app/admin?tab=teachificpay");
  });
});
