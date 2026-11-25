/** Register before express.json. A distinct endpoint MUST use its own signing secret. */
import express from "express";
import type { Request, Response } from "express";
import type Stripe from "stripe";
import { and, eq } from "drizzle-orm";
import { loadEmbeddedSnapshot } from "./lib/embeddedCheckoutTables";
import { getDb } from "./db";
import { funnelPurchases } from "../drizzle/schema";
import { embeddedPlatformGateway, embeddedStripeClient } from "./embeddedCheckoutRouter";
import { hashEmbedded, readEmbeddedManifest } from "./lib/embeddedCheckoutSelection";
import { assertEmbeddedPayment, markEmbeddedPaymentFailed, reconcileEmbeddedPurchase } from "./lib/embeddedCheckoutFulfillment";
import { notifyEmbeddedPurchase } from "./lib/embeddedCheckoutNotifications";

export async function handleEmbeddedCheckoutWebhook(req: Request, res: Response) {
  const sig = req.headers["stripe-signature"];
  if (!process.env.COURSE360_EMBEDDED_STRIPE_WEBHOOK_SECRET) return res.status(503).json({ error: "Embedded webhook verification is not configured" });
  if (typeof sig !== "string" || !Buffer.isBuffer(req.body)) return res.status(400).json({ error: "A raw signed Stripe delivery is required" });
  let event: Stripe.Event;
  let stripe: Stripe;
  try {
    stripe = await embeddedStripeClient();
    event = stripe.webhooks.constructEvent(req.body, sig, embeddedPlatformGateway().signingSecret);
  } catch { return res.status(400).json({ error: "Invalid Stripe signature or gateway configuration" }); }
  // No event-id prefix is a bypass: signed fixtures follow the same checks as every event.
  if (!["payment_intent.succeeded", "payment_intent.payment_failed", "charge.refunded"].includes(event.type)) return res.json({ received: true });
  try {
    const object: any = event.data.object;
    const paymentIntentId = event.type === "charge.refunded" ? (typeof object.payment_intent === "string" ? object.payment_intent : object.payment_intent?.id) : object.id;
    if (!paymentIntentId) throw new Error("Payment reference is missing");
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const rows = await db.select().from(funnelPurchases).where(eq(funnelPurchases.stripePaymentIntentId, paymentIntentId)).limit(2);
    if (!rows.length) {
      // A delivery may arrive between intent creation and purchase insert. Retry embedded events.
      if (object.metadata?.type === "embedded_checkout_purchase" || event.type === "charge.refunded") throw new Error("Checkout record not yet available");
      return res.json({ received: true });
    }
    if (rows.length !== 1) throw new Error("Ambiguous payment ownership requires reconciliation");
    const purchase = await loadEmbeddedSnapshot(db, rows[0]);
    const manifest = readEmbeddedManifest(purchase.snapshotManifest);
    const gateway = embeddedPlatformGateway();
    if (manifest.orgId !== purchase.orgId || manifest.gateway.keyFingerprint !== gateway.keyFingerprint || manifest.gateway.accountId !== (event.account ?? null) || manifest.gateway.livemode !== event.livemode || event.livemode !== gateway.livemode) throw new Error("Wrong payment gateway, school or mode");
    if (event.type === "payment_intent.succeeded") {
      // Do not trust even a stale signed event to override current refunded/failed gateway state.
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
      assertEmbeddedPayment(purchase, manifest, intent, event);
      const chargeId = typeof intent.latest_charge === "string" ? intent.latest_charge : intent.latest_charge?.id;
      if (!chargeId) throw new Error("Settled payment charge is unavailable");
      const charge = await stripe.charges.retrieve(chargeId);
      const linked = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
      if (linked !== intent.id || charge.amount !== intent.amount_received || charge.currency !== manifest.currency || charge.livemode !== manifest.gateway.livemode) throw new Error("Settled charge linkage mismatch");
      const refunded = charge.refunded && charge.amount_refunded >= charge.amount;
      const result = await reconcileEmbeddedPurchase(purchase.id, purchase.orgId, { intent, event, refund: refunded });
      if (result.changed && !refunded) await notifyEmbeddedPurchase(result.purchase);
    } else if (event.type === "payment_intent.payment_failed") {
      if (object.object !== "payment_intent" || object.currency !== manifest.currency || object.amount !== Math.round(Number(purchase.amount) * 100) || object.metadata?.org_id !== String(purchase.orgId) || object.metadata?.checkout_manifest_hash !== hashEmbedded(purchase.snapshotManifest)) throw new Error("Failed payment snapshot mismatch");
      await markEmbeddedPaymentFailed(purchase.id, purchase.orgId);
    } else {
      if (object.object !== "charge" || object.livemode !== event.livemode) throw new Error("Invalid refund delivery");
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
      assertEmbeddedPayment(purchase, manifest, intent, event);
      const charge = await stripe.charges.retrieve(object.id);
      const chargeIntent = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
      if (chargeIntent !== paymentIntentId || charge.currency !== manifest.currency || charge.amount !== intent.amount_received || charge.livemode !== manifest.gateway.livemode || (typeof intent.latest_charge === "string" ? intent.latest_charge : intent.latest_charge?.id) !== charge.id) throw new Error("Refund charge is not linked to this settled checkout");
      // Partial-refund policy: keep access. Only the current fully-refunded charge revokes this purchase.
      if (!charge.refunded || charge.amount_refunded < charge.amount) return res.json({ received: true, partialRefund: true });
      await reconcileEmbeddedPurchase(purchase.id, purchase.orgId, { intent, event, refund: true });
    }
    return res.json({ received: true });
  } catch (error) {
    console.error("[Embedded checkout] Retryable webhook reconciliation failure", error);
    return res.status(500).json({ error: "Checkout reconciliation failed; retry required" });
  }
}
const router = express.Router();
router.post("/embedded-checkout", express.raw({ type: "application/json" }), handleEmbeddedCheckoutWebhook);
export const embeddedCheckoutWebhookRouter = router;
