import { describe, expect, it } from "vitest";
import { getPaymentDeploymentReadiness, missingStripePaymentEvents, REQUIRED_STRIPE_PAYMENT_EVENTS, stripeCredentialMode } from "./lib/paymentDeploymentReadiness";

const live = { secretKey: "sk_live_fixture", publishableKey: "pk_live_fixture", webhookSecret: "whsec_fixture", requireLive: true };

describe("Course360 live payment deployment readiness", () => {
  it("accepts a matching live credential pair and configured signing secret without exposing values", () => {
    const result = getPaymentDeploymentReadiness(live);
    expect(result).toMatchObject({ ready: true, secretMode: "live", publishableMode: "live", webhookConfigured: true, issues: [] });
    expect(JSON.stringify(result)).not.toContain("fixture");
  });
  it("does not confuse production hosting with real payment mode", () => {
    expect(getPaymentDeploymentReadiness({ ...live, secretKey: "sk_test_fixture", publishableKey: "pk_test_fixture" }).ready).toBe(false);
  });
  it("rejects mismatched account modes", () => {
    expect(getPaymentDeploymentReadiness({ ...live, publishableKey: "pk_test_fixture", requireLive: false }).ready).toBe(false);
  });
  it("requires signing configuration even when both keys are live", () => {
    expect(getPaymentDeploymentReadiness({ ...live, webhookSecret: undefined }).ready).toBe(false);
  });
  it("supports restricted live server credentials and rejects malformed keys", () => {
    expect(stripeCredentialMode("rk_live_fixture", "secret")).toBe("live");
    expect(stripeCredentialMode("sk_test_fixture", "publishable")).toBe("invalid");
    expect(stripeCredentialMode("", "secret")).toBe("missing");
    expect(stripeCredentialMode("pk_live_", "publishable")).toBe("invalid");
  });
  it("keeps fixture-only test mode available when live mode is not required", () => {
    expect(getPaymentDeploymentReadiness({ ...live, secretKey: "sk_test_fixture", publishableKey: "pk_test_fixture", requireLive: false }).ready).toBe(true);
  });
  it("requires renewal, failure, and delayed-payment event delivery", () => {
    expect(missingStripePaymentEvents(["checkout.session.completed"])).toEqual(expect.arrayContaining(["invoice.paid", "invoice.payment_failed", "checkout.session.async_payment_succeeded"]));
    expect(missingStripePaymentEvents(REQUIRED_STRIPE_PAYMENT_EVENTS)).toEqual([]);
    expect(missingStripePaymentEvents(["*"])).toEqual([]);
  });
});

describe.skipIf(process.env.COURSE360_VALIDATE_LIVE_STRIPE !== "1")("supplied production Stripe credential verification", () => {
  it("has a live matching key pair and signing secret", () => {
    const result = getPaymentDeploymentReadiness({
      secretKey: process.env.COURSE360_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY,
      publishableKey: process.env.VITE_COURSE360_STRIPE_PUBLISHABLE_KEY || process.env.VITE_STRIPE_PUBLISHABLE_KEY,
      webhookSecret: process.env.COURSE360_STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET,
      requireLive: true,
    });
    expect(result.secretMode).toBe("live");
    expect(result.publishableMode).toBe("live");
    expect(result.webhookConfigured).toBe(true);
    expect(result.ready).toBe(true);
  });
});
