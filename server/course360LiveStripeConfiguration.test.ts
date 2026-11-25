import { describe, expect, it } from "vitest";
import { getPaymentDeploymentReadiness } from "./lib/paymentDeploymentReadiness";

const enabled = process.env.COURSE360_VALIDATE_LIVE_STRIPE === "1";
describe.skipIf(!enabled)("protected Course360 production Stripe credentials", () => {
  it("uses matching live-mode keys and a configured signing secret", () => {
    const result = getPaymentDeploymentReadiness({
      secretKey: process.env.COURSE360_STRIPE_SECRET_KEY,
      publishableKey: process.env.VITE_COURSE360_STRIPE_PUBLISHABLE_KEY,
      webhookSecret: process.env.COURSE360_STRIPE_WEBHOOK_SECRET,
      requireLive: true,
    });
    expect(result.secretMode).toBe("live");
    expect(result.publishableMode).toBe("live");
    expect(result.webhookConfigured).toBe(true);
    expect(result.ready).toBe(true);
  });
  it("authenticates against the lightweight read-only Stripe account endpoint", async () => {
    const key = process.env.COURSE360_STRIPE_SECRET_KEY?.trim();
    expect(Boolean(key)).toBe(true);
    const response = await fetch("https://api.stripe.com/v1/account", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(20000),
    });
    expect(response.status, "Live Stripe credential could not read its account; check validity and permission.").toBe(200);
    const account = await response.json() as Record<string, unknown>;
    expect(account.object).toBe("account");
    expect(typeof account.id).toBe("string");
    expect(account.charges_enabled, "Stripe account must be enabled for production charges.").toBe(true);
  }, 25000);
});
