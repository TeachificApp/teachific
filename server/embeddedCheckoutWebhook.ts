/**
 * embeddedCheckoutWebhook.ts
 *
 * Handles Stripe webhook events for embedded checkout payments.
 * Fulfills purchases by:
 * - Enrolling users in courses
 * - Granting download access
 * - Granting quiz access
 * - Granting membership access
 * - Processing order bumps
 *
 * MUST be registered BEFORE express.json() middleware.
 */

import express from "express";
import type Stripe from "stripe";
import { ENV } from "./_core/env";
import { getStripe } from "./stripePlans";
import { getDb, getUserByEmail, upsertUser } from "./db";
import { funnelPurchases, courseEnrollments, mediaAccessGrants, membershipSubscriptions } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { sendEmail } from "./sendgrid";

const router = express.Router();

/**
 * Fulfill a purchase by granting access to the purchased product
 * Idempotent: safe to call multiple times for the same purchase
 */
async function fulfillPurchase(purchase: typeof funnelPurchases.$inferSelect, paymentIntentId: string) {
  const db = await getDb();
  if (!db) {
    console.error("[Embedded Checkout Webhook] Database unavailable for fulfillment");
    return;
  }

  try {
    // Get or create user by email
    let userId: number | null = purchase.userId;
    if (!userId) {
      const existingUser = await getUserByEmail(purchase.email);
      if (existingUser) {
        userId = existingUser.id;
      } else {
        // Create new user
        const newUser = await upsertUser({
          openId: `email_${purchase.email}_${Date.now()}`,
          email: purchase.email,
          name: purchase.name ?? undefined,
          loginMethod: "email",
        });
        userId = newUser?.id ?? null;
      }
    }

    if (!userId) {
      console.error(`[Embedded Checkout Webhook] Could not create user for ${purchase.email}`);
      return;
    }

    // Fulfill based on product type
    switch (purchase.productType) {
      case "course": {
        if (!purchase.fulfillmentCourseId) break;
        // Check if user is already enrolled (idempotent for webhook retries)
        const existing = await db
          .select()
          .from(courseEnrollments)
          .where(
            and(
              eq(courseEnrollments.courseId, purchase.fulfillmentCourseId),
              eq(courseEnrollments.userId, userId)
            )
          )
          .limit(1);

        if (!existing.length) {
          await db.insert(courseEnrollments).values({
            courseId: purchase.fulfillmentCourseId,
            userId,
            orgId: purchase.orgId,
            enrolledAt: new Date(),
            amountPaid: Number(purchase.amount),
            currency: purchase.currency,
            progressPct: 0,
          });
          console.log(`[Embedded Checkout Webhook] User ${userId} enrolled in course ${purchase.fulfillmentCourseId}`);
        } else {
          console.log(`[Embedded Checkout Webhook] User ${userId} already enrolled in course ${purchase.fulfillmentCourseId}`);
        }
        break;
      }

      case "download": {
        if (!purchase.fulfillmentDownloadId) break;
        // Check if grant already exists (idempotent for webhook retries)
        const existing = await db
          .select()
          .from(mediaAccessGrants)
          .where(
            and(
              eq(mediaAccessGrants.userId, userId),
              eq(mediaAccessGrants.mediaId, purchase.fulfillmentDownloadId)
            )
          )
          .limit(1);

        if (!existing.length) {
          await db.insert(mediaAccessGrants).values({
            orgId: purchase.orgId,
            userId,
            mediaId: purchase.fulfillmentDownloadId,
            grantType: "purchase",
            grantedAt: new Date(),
            expiresAt: null, // Lifetime access
          });
          console.log(`[Embedded Checkout Webhook] User ${userId} granted download ${purchase.fulfillmentDownloadId}`);
        } else {
          console.log(`[Embedded Checkout Webhook] User ${userId} already has download access ${purchase.fulfillmentDownloadId}`);
        }
        break;
      }

      case "quiz": {
        if (!purchase.fulfillmentQuizId) break;
        // Check if grant already exists (idempotent for webhook retries)
        const existing = await db
          .select()
          .from(mediaAccessGrants)
          .where(
            and(
              eq(mediaAccessGrants.userId, userId),
              eq(mediaAccessGrants.mediaId, purchase.fulfillmentQuizId)
            )
          )
          .limit(1);

        if (!existing.length) {
          await db.insert(mediaAccessGrants).values({
            orgId: purchase.orgId,
            userId,
            mediaId: purchase.fulfillmentQuizId,
            grantType: "purchase",
            grantedAt: new Date(),
            expiresAt: null, // Lifetime access
          });
          console.log(`[Embedded Checkout Webhook] User ${userId} granted quiz ${purchase.fulfillmentQuizId}`);
        } else {
          console.log(`[Embedded Checkout Webhook] User ${userId} already has quiz access ${purchase.fulfillmentQuizId}`);
        }
        break;
      }

      case "membership": {
        if (!purchase.fulfillmentMembershipId) break;
        // Check if subscription already exists (idempotent for webhook retries)
        const existing = await db
          .select()
          .from(membershipSubscriptions)
          .where(
            and(
              eq(membershipSubscriptions.userId, userId),
              eq(membershipSubscriptions.planId, purchase.fulfillmentMembershipId)
            )
          )
          .limit(1);

        if (!existing.length) {
          await db.insert(membershipSubscriptions).values({
            orgId: purchase.orgId,
            userId,
            planId: purchase.fulfillmentMembershipId,
            status: "active",
            startDate: new Date(),
            endDate: null, // Lifetime or until cancelled
          });
          console.log(`[Embedded Checkout Webhook] User ${userId} granted membership ${purchase.fulfillmentMembershipId}`);
        } else {
          console.log(`[Embedded Checkout Webhook] User ${userId} already has membership ${purchase.fulfillmentMembershipId}`);
        }
        break;
      }

      case "bundle": {
        // Handle bundle fulfillment (multiple products)
        // TODO: Implement bundle fulfillment logic
        break;
      }
    }

    // Process order bumps if any
    if (purchase.orderBumps) {
      try {
        const bumps = JSON.parse(purchase.orderBumps);
        for (const bump of bumps) {
          // TODO: Process each bump based on its type
          console.log(`[Embedded Checkout Webhook] Processing order bump: ${bump.title}`);
        }
      } catch (e) {
        console.error("[Embedded Checkout Webhook] Failed to parse order bumps:", e);
      }
    }

    // Update purchase status to completed
    await db
      .update(funnelPurchases)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(funnelPurchases.stripePaymentIntentId, paymentIntentId));

    // Send confirmation email
    await sendEmail({
      to: purchase.email,
      subject: `Your purchase is confirmed: ${purchase.productName}`,
      html: `
        <h2>Thank you for your purchase!</h2>
        <p>Your order for <strong>${purchase.productName}</strong> has been confirmed.</p>
        <p>Amount paid: <strong>$${Number(purchase.amount).toFixed(2)} ${purchase.currency}</strong></p>
        <p>You now have access to your purchase. Log in to your account to get started.</p>
      `,
    });

    console.log(`[Embedded Checkout Webhook] Purchase ${purchase.id} fulfilled successfully`);
  } catch (error: any) {
    console.error("[Embedded Checkout Webhook] Fulfillment failed:", error.message);
    throw error;
  }
}

/**
 * Revoke access to a purchased product (for refunds)
 */
async function revokePurchaseAccess(purchase: typeof funnelPurchases.$inferSelect) {
  const db = await getDb();
  if (!db) {
    console.error("[Embedded Checkout Webhook] Database unavailable for revocation");
    return;
  }

  if (!purchase.userId) {
    console.warn("[Embedded Checkout Webhook] No userId for revocation");
    return;
  }

  try {
    switch (purchase.productType) {
      case "course":
        if (purchase.fulfillmentCourseId) {
          // Remove course enrollment
          await db
            .delete(courseEnrollments)
            .where(
              and(
                eq(courseEnrollments.courseId, purchase.fulfillmentCourseId),
                eq(courseEnrollments.userId, purchase.userId)
              )
            );
          console.log(`[Embedded Checkout Webhook] Revoked course access for user ${purchase.userId}`);
        }
        break;

      case "download":
      case "quiz":
        if (purchase.fulfillmentDownloadId || purchase.fulfillmentQuizId) {
          // Remove media access grant
          const mediaId = purchase.fulfillmentDownloadId || purchase.fulfillmentQuizId;
          await db
            .delete(mediaAccessGrants)
            .where(
              and(
                eq(mediaAccessGrants.userId, purchase.userId),
                eq(mediaAccessGrants.mediaId, mediaId),
                eq(mediaAccessGrants.grantType, "purchase")
              )
            );
          console.log(`[Embedded Checkout Webhook] Revoked media access for user ${purchase.userId}`);
        }
        break;

      case "membership":
        if (purchase.fulfillmentMembershipId) {
          // Deactivate membership subscription
          await db
            .update(membershipSubscriptions)
            .set({ status: "cancelled", endDate: new Date() })
            .where(
              and(
                eq(membershipSubscriptions.userId, purchase.userId),
                eq(membershipSubscriptions.planId, purchase.fulfillmentMembershipId)
              )
            );
          console.log(`[Embedded Checkout Webhook] Revoked membership for user ${purchase.userId}`);
        }
        break;
    }
  } catch (error: any) {
    console.error("[Embedded Checkout Webhook] Access revocation failed:", error.message);
  }
}

// Webhook handler
router.post(
  "/embedded-checkout",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];

    let event: Stripe.Event;
    try {
      if (!ENV.stripeWebhookSecret || !sig) {
        // In development without webhook secret, parse directly
        event = JSON.parse(req.body.toString()) as Stripe.Event;
      } else {
        const stripe = getStripe();
        event = stripe.webhooks.constructEvent(req.body, sig as string, ENV.stripeWebhookSecret);
      }
    } catch (err: any) {
      console.error("[Embedded Checkout Webhook] Signature verification failed:", err.message);
      return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    // Test event detection
    if (event.id.startsWith("evt_test_")) {
      console.log("[Embedded Checkout Webhook] Test event detected, returning verification response");
      return res.json({ verified: true });
    }

    console.log(`[Embedded Checkout Webhook] Event: ${event.type} (${event.id})`);

    try {
      switch (event.type) {
        case "payment_intent.succeeded": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          const paymentIntentId = paymentIntent.id;

          // Find the corresponding purchase record
          const db = await getDb();
          if (!db) {
            console.error("[Embedded Checkout Webhook] Database unavailable");
            return res.status(500).json({ error: "Database unavailable" });
          }

          const [purchase] = await db
            .select()
            .from(funnelPurchases)
            .where(eq(funnelPurchases.stripePaymentIntentId, paymentIntentId))
            .limit(1);

          if (!purchase) {
            console.warn(`[Embedded Checkout Webhook] No purchase found for payment intent ${paymentIntentId}`);
            return res.json({ received: true });
          }

          // Fulfill the purchase
          await fulfillPurchase(purchase, paymentIntentId);
          break;
        }

        case "payment_intent.payment_failed": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          const paymentIntentId = paymentIntent.id;

          const db = await getDb();
          if (!db) return res.status(500).json({ error: "Database unavailable" });

          // Mark purchase as failed
          await db
            .update(funnelPurchases)
            .set({ status: "failed", updatedAt: new Date() })
            .where(eq(funnelPurchases.stripePaymentIntentId, paymentIntentId));

          console.log(`[Embedded Checkout Webhook] Payment failed for intent ${paymentIntentId}`);
          break;
        }

        case "charge.refunded": {
          const charge = event.data.object as Stripe.Charge;
          const paymentIntentId = charge.payment_intent as string;

          const db = await getDb();
          if (!db) return res.status(500).json({ error: "Database unavailable" });

          // Get the purchase to revoke access
          const [purchase] = await db
            .select()
            .from(funnelPurchases)
            .where(eq(funnelPurchases.stripePaymentIntentId, paymentIntentId))
            .limit(1);

          if (purchase) {
            // Mark purchase as refunded
            await db
              .update(funnelPurchases)
              .set({ status: "refunded", updatedAt: new Date() })
              .where(eq(funnelPurchases.stripePaymentIntentId, paymentIntentId));

            // Revoke access to the purchased product
            await revokePurchaseAccess(purchase);
          }

          console.log(`[Embedded Checkout Webhook] Refund processed for intent ${paymentIntentId}`);
          break;
        }
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error("[Embedded Checkout Webhook] Error processing event:", error.message);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

export const embeddedCheckoutWebhookRouter = router;
