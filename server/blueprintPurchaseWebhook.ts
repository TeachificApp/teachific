/**
 * blueprintPurchaseWebhook.ts
 *
 * Stripe webhook handler for blueprint purchases.
 * Handles checkout.session.completed events where metadata.type === "blueprint_purchase".
 *
 * On successful payment:
 *   1. Creates a blueprint_purchases row (idempotent via stripeCheckoutSessionId)
 *   2. Records a blueprint_commissions row if a referral link was used
 *   3. Increments totalConversions on the referral link
 *   4. Notifies the platform owner
 *
 * MUST be registered BEFORE express.json() middleware.
 */

import express from "express";
import type Stripe from "stripe";
import { ENV } from "./_core/env";
import { getStripe } from "./stripePlans";
import { getDb } from "./db";
import { blueprintPurchases, blueprintReferralLinks, blueprintCommissions, blueprints, blueprintVersions } from "../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";
import { notifyOwner } from "./_core/notification";

const router = express.Router();

router.post(
  "/blueprint-purchase",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = ENV.stripeWebhookSecret;

    if (!sig || !webhookSecret) {
      console.warn("[Blueprint Webhook] Missing signature or secret");
      return res.status(400).send("Missing signature");
    }

    let event: Stripe.Event;
    try {
      const stripe = getStripe();
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      console.error("[Blueprint Webhook] Signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type !== "checkout.session.completed") {
      return res.json({ received: true });
    }

    const session = event.data.object as Stripe.Checkout.Session;

    // Only handle blueprint purchases
    if (session.metadata?.type !== "blueprint_purchase") {
      return res.json({ received: true });
    }

    console.log(`[Blueprint Webhook] Processing blueprint purchase: ${session.id}`);

    try {
      const db = await getDb();
      if (!db) {
        console.error("[Blueprint Webhook] Database unavailable");
        return res.status(500).send("Database unavailable");
      }

      const blueprintId = parseInt(session.metadata.blueprint_id ?? "0");
      const blueprintVersionId = parseInt(session.metadata.blueprint_version_id ?? "0");
      const buyerUserId = parseInt(session.metadata.buyer_user_id ?? "0");
      const buyerOrgId = parseInt(session.metadata.buyer_org_id ?? "0");
      const referralLinkId = session.metadata.referral_link_id
        ? parseInt(session.metadata.referral_link_id)
        : null;
      const buyerEmail = session.metadata.buyer_email ?? session.customer_details?.email ?? "";
      const buyerName = session.metadata.buyer_name ?? session.customer_details?.name ?? "";
      const amountPaid = session.amount_total ? session.amount_total / 100 : 0;
      const currency = (session.currency ?? "usd").toUpperCase();
      const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;

      if (!blueprintId || !buyerUserId || !buyerOrgId) {
        console.error("[Blueprint Webhook] Missing required metadata fields");
        return res.status(400).send("Missing metadata");
      }

      // Idempotency check — skip if already processed
      const [existing] = await db
        .select({ id: blueprintPurchases.id })
        .from(blueprintPurchases)
        .where(eq(blueprintPurchases.stripeCheckoutSessionId, session.id))
        .limit(1);

      if (existing) {
        console.log(`[Blueprint Webhook] Already processed session ${session.id}, skipping`);
        return res.json({ received: true });
      }

      // Create purchase record
      await db.insert(blueprintPurchases).values({
        blueprintId,
        blueprintVersionId: blueprintVersionId || 1,
        buyerUserId,
        buyerOrgId,
        purchasePrice: String(amountPaid.toFixed(2)),
        currency,
        licenseType: "single_organization",
        accessStatus: "active",
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: paymentIntentId,
        referralLinkId,
        buyerEmail,
        buyerName,
      });

      console.log(`[Blueprint Webhook] Purchase recorded for blueprint ${blueprintId}, org ${buyerOrgId}`);

      // ── Commission recording ──────────────────────────────────────────────
      if (referralLinkId) {
        try {
          const [link] = await db
            .select()
            .from(blueprintReferralLinks)
            .where(and(
              eq(blueprintReferralLinks.id, referralLinkId),
              eq(blueprintReferralLinks.isActive, true),
            ))
            .limit(1);

          if (link) {
            const commissionRate = parseFloat(String(link.commissionRate));
            const amountCents = Math.round(amountPaid * 100);
            const commissionCents = Math.round(amountCents * commissionRate);

            await db.insert(blueprintCommissions).values({
              referralLinkId,
              pendingInstallId: null,
              subscriberUserId: buyerUserId,
              subscriberOrgId: buyerOrgId,
              creatorOrgId: link.creatorOrgId,
              subscriptionAmountCents: amountCents,
              commissionAmountCents: commissionCents,
              currency,
              status: "pending",
              stripePaymentIntentId: paymentIntentId,
            });

            // Increment totalConversions on the referral link
            await db
              .update(blueprintReferralLinks)
              .set({ totalConversions: sql`total_conversions + 1` })
              .where(eq(blueprintReferralLinks.id, referralLinkId));

            console.log(`[Blueprint Webhook] Commission of ${commissionCents} cents recorded for link ${referralLinkId}`);
          }
        } catch (commissionErr: any) {
          console.error("[Blueprint Webhook] Commission recording failed:", commissionErr.message);
          // Non-fatal — purchase is still fulfilled
        }
      }

      // ── Notify platform owner ─────────────────────────────────────────────
      try {
        const [bp] = await db.select({ title: blueprints.title }).from(blueprints).where(eq(blueprints.id, blueprintId)).limit(1);
        await notifyOwner({
          title: "New Blueprint Purchase",
          content: `${buyerName || buyerEmail} purchased "${bp?.title ?? `Blueprint #${blueprintId}`}" for $${amountPaid.toFixed(2)} ${currency}`,
        });
      } catch (notifyErr: any) {
        console.warn("[Blueprint Webhook] Owner notification failed:", notifyErr.message);
      }

      return res.json({ received: true });
    } catch (err: any) {
      console.error("[Blueprint Webhook] Fulfillment error:", err.message);
      return res.status(500).send("Fulfillment error");
    }
  }
);

export default router;
