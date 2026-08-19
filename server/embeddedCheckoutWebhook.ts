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
import { funnelPurchases, courseEnrollments, mediaAccessGrants, membershipSubscriptions, digitalBundlePurchases, digitalBundleItems, digitalPurchases, orgMembers, users, organizations } from "../drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";
import { sendEmail, sendEmailViaOrg, buildFunnelPurchaseConfirmationEmail, buildOrgAdminNewPurchaseEmail } from "./_core/email";
import { fulfillOrderBumpPurchase } from "./lib/orderBumpCheckout";
import { getOrgBaseUrl } from "./lib/orgUrl";

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
        if (!purchase.fulfillmentBundleId) break;
        // Check if bundle purchase already exists (idempotent)
        const existingBundlePurchase = await db
          .select()
          .from(digitalBundlePurchases)
          .where(
            and(
              eq(digitalBundlePurchases.userId, userId),
              eq(digitalBundlePurchases.bundleId, purchase.fulfillmentBundleId)
            )
          )
          .limit(1);

        if (!existingBundlePurchase.length) {
          // Record the bundle-level purchase
          await db.insert(digitalBundlePurchases).values({
            userId,
            bundleId: purchase.fulfillmentBundleId,
            stripeCheckoutSessionId: purchase.stripeSessionId ?? undefined,
          });

          // Grant access to each item in the bundle
          const bundleItems = await db
            .select()
            .from(digitalBundleItems)
            .where(eq(digitalBundleItems.bundleId, purchase.fulfillmentBundleId));

          for (const item of bundleItems) {
            // Check if individual product access already granted
            const existingItemAccess = await db
              .select()
              .from(digitalPurchases)
              .where(
                and(
                  eq(digitalPurchases.userId, userId),
                  eq(digitalPurchases.productId, item.productId)
                )
              )
              .limit(1);

            if (!existingItemAccess.length) {
              await db.insert(digitalPurchases).values({
                userId,
                productId: item.productId,
                stripeCheckoutSessionId: purchase.stripeSessionId ?? undefined,
              });
            }
          }
          console.log(`[Embedded Checkout Webhook] User ${userId} granted bundle ${purchase.fulfillmentBundleId} (${bundleItems.length} items)`);
        } else {
          console.log(`[Embedded Checkout Webhook] User ${userId} already has bundle ${purchase.fulfillmentBundleId}`);
        }
        break;
      }
    }

    // Process order bumps if any
    if (purchase.orderBumps) {
      try {
        const bumps = JSON.parse(purchase.orderBumps) as Array<{
          title: string; price: number;
          bumpId?: number | null; bumpType?: string | null; productId?: number | null;
        }>;
        for (const bump of bumps) {
          if (!bump.bumpId || !bump.bumpType) {
            console.log(`[Embedded Checkout Webhook] Skipping bump "${bump.title}" — no bumpId/bumpType`);
            continue;
          }
          const bumpMeta: Record<string, string> = {
            order_bump_id: String(bump.bumpId),
            order_bump_type: bump.bumpType,
            order_bump_product_id: String(bump.productId ?? ""),
            order_bump_price: String(bump.price),
          };
          await fulfillOrderBumpPurchase(db, bumpMeta, {
            userId,
            sessionId: paymentIntentId,
            triggerOrderType: (purchase.productType as any) ?? "course",
          }).catch((e: any) => console.error(`[Embedded Checkout Webhook] Bump fulfillment error: ${e.message}`));
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

    // Send Teachific-branded confirmation email to buyer
    const buyerFirstName = (purchase.name ?? purchase.email).split(/[\s@]/)[0] ?? "there";
    // Resolve org base URL for org-scoped links
    let orgBase: string | null = null;
    if (purchase.orgId) {
      try {
        const [orgInfo] = await db.select({ slug: organizations.slug, customDomain: organizations.customDomain, domainVerificationStatus: organizations.domainVerificationStatus })
          .from(organizations).where(eq(organizations.id, purchase.orgId)).limit(1);
        if (orgInfo?.slug) orgBase = getOrgBaseUrl(orgInfo.slug, orgInfo.customDomain, orgInfo.domainVerificationStatus);
      } catch { /* keep default */ }
    }
    const fallbackBase = orgBase ?? "https://teachific.app";
    let loginUrl = `${fallbackBase}/my-courses`;
    if (purchase.fulfillmentCourseId) {
      try {
        const { lmsCourses } = await import("../drizzle/schema");
        const [courseRow] = await db.select({ slug: lmsCourses.slug }).from(lmsCourses)
          .where(eq(lmsCourses.id, purchase.fulfillmentCourseId)).limit(1);
        if (courseRow?.slug) loginUrl = `${fallbackBase}/courses/${courseRow.slug}`;
      } catch { /* keep default */ }
    } else if (purchase.productType === "download") {
      loginUrl = `${fallbackBase}/my-downloads`;
    }
    const orderBumpsForEmail = purchase.orderBumps
      ? (() => { try { return JSON.parse(purchase.orderBumps); } catch { return []; } })()
      : [];
    const { subject: confirmSubject, htmlBody: confirmHtml, previewText: confirmPreview } =
      buildFunnelPurchaseConfirmationEmail({
        firstName: buyerFirstName,
        productName: purchase.productName,
        amountPaid: Number(purchase.amount),
        orderBumps: orderBumpsForEmail,
        loginUrl,
      });
    await sendEmailViaOrg({
      to: { name: purchase.name ?? purchase.email, email: purchase.email },
      subject: confirmSubject,
      htmlBody: confirmHtml,
      previewText: confirmPreview,
    }, purchase.orgId ?? null).catch((e: any) => console.error("[Embedded Checkout Webhook] Confirmation email failed:", e.message));

    // Notify org admins via Teachific email.
    if (purchase.orgId) {
      try {
        const ORG_ADMIN_ROLES = ["org_super_admin", "org_admin"];
        const [orgRow] = await db.select({ name: organizations.name })
          .from(organizations).where(eq(organizations.id, purchase.orgId)).limit(1);
        const orgName = orgRow?.name ?? `School #${purchase.orgId}`;
        const adminMembers = await db
          .select({ email: users.email, name: users.name })
          .from(orgMembers)
          .innerJoin(users, eq(orgMembers.userId, users.id))
          .where(and(
            eq(orgMembers.orgId, purchase.orgId),
            inArray(orgMembers.role, ORG_ADMIN_ROLES),
          ));
        const adminDashboardUrl = `https://teachific.com/admin?tab=enrollments`;
        const { subject: adminSubject, htmlBody: adminHtml, previewText: adminPreview } =
          buildOrgAdminNewPurchaseEmail({
            orgName,
            buyerName: purchase.name ?? purchase.email,
            buyerEmail: purchase.email,
            productName: purchase.productName,
            amountPaid: Number(purchase.amount),
            productType: purchase.productType,
            adminDashboardUrl,
          });
        for (const admin of adminMembers) {
          if (admin.email) {
            await sendEmail({
              to: { name: admin.name ?? admin.email, email: admin.email },
              subject: adminSubject,
              htmlBody: adminHtml,
              previewText: adminPreview,
            }).catch(() => {});
          }
        }
        console.log(`[Embedded Checkout Webhook] Notified ${adminMembers.length} org admin(s) of purchase`);
      } catch (e: any) {
        console.error("[Embedded Checkout Webhook] Org admin notification failed:", e.message);
      }
    }

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
