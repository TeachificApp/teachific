export type StripeCredentialMode = "live" | "test" | "missing" | "invalid";

export function stripeCredentialMode(value: string | undefined | null, kind: "secret" | "publishable"): StripeCredentialMode {
  if (!value?.trim()) return "missing";
  const prefix = kind === "secret" ? "(?:sk|rk)" : "pk";
  const match = value.trim().match(new RegExp(`^${prefix}_(live|test)_[A-Za-z0-9]+$`));
  return match ? match[1] as "live" | "test" : "invalid";
}

export function getPaymentDeploymentReadiness(input: {
  secretKey?: string | null;
  publishableKey?: string | null;
  webhookSecret?: string | null;
  requireLive?: boolean;
}) {
  const secretMode = stripeCredentialMode(input.secretKey, "secret");
  const publishableMode = stripeCredentialMode(input.publishableKey, "publishable");
  const webhookConfigured = /^whsec_[A-Za-z0-9]+$/.test(input.webhookSecret?.trim() ?? "");
  const sameMode = (secretMode === "live" || secretMode === "test") && secretMode === publishableMode;
  const issues: string[] = [];
  if (!sameMode) issues.push("Stripe secret and publishable keys must be configured in the same mode.");
  if (input.requireLive && (secretMode !== "live" || publishableMode !== "live")) {
    issues.push("Live Stripe keys are required for production payments; test keys cannot collect real payments.");
  }
  if (!webhookConfigured) issues.push("A Stripe endpoint signing secret is required for verified payment fulfillment.");
  return { ready: issues.length === 0, secretMode, publishableMode, webhookConfigured, issues };
}

export const REQUIRED_STRIPE_PAYMENT_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
] as const;

export function missingStripePaymentEvents(enabledEvents: readonly string[]): string[] {
  if (enabledEvents.includes("*")) return [];
  return REQUIRED_STRIPE_PAYMENT_EVENTS.filter(event => !enabledEvents.includes(event));
}
