/**
 * Stripe Payment Link helpers
 *
 * Generates permanent, shareable Stripe Payment Links for pricing options.
 * For orgs using TeachificPay (Free/Starter/Builder), links use the platform Stripe account.
 * For Pro/Enterprise orgs with own_gateway, links use the org's connected Stripe account.
 */

import Stripe from "stripe";
import { ENV } from "./_core/env";

const platformStripe = new Stripe(ENV.stripeSecretKey, { apiVersion: "2024-06-20" as any });

interface CreatePaymentLinkOptions {
  /** Product name shown on the Stripe checkout page */
  productName: string;
  /** Price in dollars (e.g. 49.99) */
  priceAmount: number;
  /** Currency code (default: usd) */
  currency?: string;
  /** Pricing type */
  pricingType: "one_time" | "subscription" | "payment_plan" | "free";
  /** Subscription interval (for subscription pricing) */
  subscriptionInterval?: "monthly" | "quarterly" | "annual" | null;
  /** Org's own Stripe secret key (Pro/Enterprise with own_gateway) */
  orgStripeSecretKey?: string | null;
  /** Org's Stripe Connect account ID (for TeachificPay transfers) */
  stripeConnectAccountId?: string | null;
  /** Platform fee percentage (0-100) for TeachificPay orgs */
  platformFeePercent?: number;
  /** Metadata to attach to the payment link */
  metadata?: Record<string, string>;
}

interface PaymentLinkResult {
  url: string;
  id: string;
}

/**
 * Get the Stripe client to use for a given org.
 * - Pro/Enterprise with own_gateway: use org's own Stripe key
 * - All others: use platform Stripe key
 */
function getStripeClient(orgStripeSecretKey?: string | null): Stripe {
  if (orgStripeSecretKey) {
    return new Stripe(orgStripeSecretKey, { apiVersion: "2024-06-20" as any });
  }
  return platformStripe;
}

/**
 * Create a Stripe Payment Link for a pricing option.
 * Returns the permanent shareable URL and the Payment Link ID.
 */
export async function createStripePaymentLink(
  opts: CreatePaymentLinkOptions
): Promise<PaymentLinkResult | null> {
  try {
    const stripe = getStripeClient(opts.orgStripeSecretKey);
    const currency = (opts.currency ?? "usd").toLowerCase();

    // Free products don't need a payment link
    if (opts.pricingType === "free" || opts.priceAmount <= 0) {
      return null;
    }

    // Create a Stripe Product
    const product = await stripe.products.create({
      name: opts.productName,
      metadata: opts.metadata ?? {},
    });

    let priceId: string;

    if (opts.pricingType === "subscription" && opts.subscriptionInterval) {
      const intervalMap: Record<string, { interval: Stripe.PriceCreateParams.Recurring.Interval; interval_count: number }> = {
        monthly: { interval: "month", interval_count: 1 },
        quarterly: { interval: "month", interval_count: 3 },
        annual: { interval: "year", interval_count: 1 },
      };
      const recurring = intervalMap[opts.subscriptionInterval] ?? { interval: "month", interval_count: 1 };

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: Math.round(opts.priceAmount * 100),
        currency,
        recurring,
      });
      priceId = price.id;
    } else {
      // one_time or payment_plan (payment_plan uses one_time price, installments handled in-app)
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: Math.round(opts.priceAmount * 100),
        currency,
      });
      priceId = price.id;
    }

    // Build payment link params
    const linkParams: Stripe.PaymentLinkCreateParams = {
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      metadata: opts.metadata ?? {},
    };

    // Add platform fee for TeachificPay orgs (not own_gateway)
    if (!opts.orgStripeSecretKey && opts.stripeConnectAccountId && opts.platformFeePercent && opts.platformFeePercent > 0) {
      linkParams.application_fee_percent = opts.platformFeePercent;
      linkParams.transfer_data = { destination: opts.stripeConnectAccountId };
    }

    const paymentLink = await stripe.paymentLinks.create(linkParams);

    return { url: paymentLink.url, id: paymentLink.id };
  } catch (err) {
    console.error("[StripePaymentLinks] Failed to create payment link:", err);
    return null;
  }
}

/**
 * Deactivate a Stripe Payment Link (when a pricing option is deleted or deactivated).
 */
export async function deactivateStripePaymentLink(
  linkId: string,
  orgStripeSecretKey?: string | null
): Promise<void> {
  try {
    const stripe = getStripeClient(orgStripeSecretKey);
    await stripe.paymentLinks.update(linkId, { active: false });
  } catch (err) {
    console.error("[StripePaymentLinks] Failed to deactivate payment link:", err);
  }
}
