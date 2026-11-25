import express from "express";
import type { Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { getDb } from "./db";
import { COURSE360_HOSTED_CHECKOUT_FAMILY, course360HostedCheckoutPurchases as purchases, validateHostedSession } from "./lib/course360HostedCheckout";
import { reconcileCourse360HostedSignedSession } from "./lib/course360HostedCheckoutReconciliation";
import { reconcileCourse360HostedRecurring } from "./lib/course360HostedCheckoutLifecycle";
import { resolveCourse360SchoolStripeEndpoint } from "./lib/course360SchoolStripeGateway";
import { invoiceSubscriptionId, isCourse360StripeEvent, stripeObjectId } from "./lib/course360WebhookLifecycle";

export const COURSE360_SCHOOL_STRIPE_WEBHOOK_PATH = "/api/webhooks/stripe/school/:endpointId";
export const COURSE360_SCHOOL_STRIPE_EVENTS = [
  "checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed",
  "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted", "customer.subscription.paused", "customer.subscription.resumed",
  "invoice.paid", "invoice.payment_failed",
] as const;

/** Separate from platform ingress. Must be mounted before global JSON parsing. No server starts here. */
export async function handleCourse360SchoolStripeWebhook(req: Request, res: Response) {
  const signature = req.headers["stripe-signature"];
  if (typeof signature !== "string" || !Buffer.isBuffer(req.body)) return res.status(400).json({ error: "Raw signed school webhook required" });
  let db: any; let endpoint: Awaited<ReturnType<typeof resolveCourse360SchoolStripeEndpoint>>;
  try {
    db = await getDb(); if (!db) throw new Error("School webhook database unavailable");
    endpoint = await resolveCourse360SchoolStripeEndpoint(db, req.params.endpointId);
  } catch { return res.status(503).json({ error: "Protected school webhook configuration unavailable" }); }
  let event: any;
  try {
    event = endpoint.gateway.stripe.webhooks.constructEvent(req.body, signature, endpoint.signingSecret);
    if (!isCourse360StripeEvent(event) || event.livemode !== endpoint.livemode) throw new Error("Invalid school event envelope or mode");
    if (endpoint.gateway.gateway === "connect") {
      if (event.account !== endpoint.gateway.accountId) throw new Error("Signed Connect account mismatch");
    } else if (event.account != null) throw new Error("Own-account endpoint cannot accept connected-account events");
  } catch { return res.status(400).json({ error: "Invalid school webhook signature or account binding" }); }
  const verifiedAccountId = endpoint.gateway.gateway === "connect" ? event.account : endpoint.gateway.accountId;
  const object = event.data.object;
  try {
    if (event.type.startsWith("checkout.session.")) {
      if (!COURSE360_SCHOOL_STRIPE_EVENTS.includes(event.type)) return res.status(200).json({ received: true, ignored: true });
      if (object.metadata?.type === "membership" || object.metadata?.membership_plan_id) throw new Error("Native membership Checkout requires an immutable server reservation adapter");
      if (object.metadata?.type !== COURSE360_HOSTED_CHECKOUT_FAMILY) return res.status(200).json({ received: true, ignored: true });
      const [purchase] = await db.select().from(purchases).where(and(eq(purchases.id, object.metadata.hosted_purchase_id), eq(purchases.orgId, endpoint.orgId))).limit(1);
      if (!purchase || purchase.accountId !== verifiedAccountId || purchase.gateway !== endpoint.gateway.gateway) throw new Error("School Checkout ledger/account identity mismatch");
      validateHostedSession(object, purchase, endpoint.gateway);
      if (event.type === "checkout.session.async_payment_failed") {
        // Failure never grants, never rolls a completed/overlapping grant back. Record deliberate pending state durably.
        await persistPending(db, purchase, "payment_failed");
        return res.status(200).json({ received: true, state: purchase.status === "completed" ? "completed" : "payment_failed" });
      }
      const result = await reconcileCourse360HostedSignedSession({ db, signedSession: object, verifiedAccountId, gateway: endpoint.gateway, verifiedLivemode: endpoint.livemode });
      if (!result.handled) throw new Error("School Checkout adapter did not handle family");
      if (!result.success) await persistPending(db, purchase, "pending_payment");
      return res.status(200).json({ received: true, state: result.success ? "completed" : "pending_payment" });
    }
    let subscriptionId: string | null = null;
    if (event.type.startsWith("customer.subscription.") && COURSE360_SCHOOL_STRIPE_EVENTS.includes(event.type)) subscriptionId = stripeObjectId(object);
    else if (["invoice.paid", "invoice.payment_failed"].includes(event.type)) subscriptionId = invoiceSubscriptionId(object);
    else return res.status(200).json({ received: true, ignored: true });
    if (!subscriptionId) return res.status(200).json({ received: true, ignored: true });
    const result = await reconcileCourse360HostedRecurring({ db, subscriptionId, verifiedAccountId, verifiedOrgId: endpoint.orgId, livemode: endpoint.livemode, gateway: endpoint.gateway });
    if (!result.handled && (object.metadata?.type === COURSE360_HOSTED_CHECKOUT_FAMILY || object.metadata?.hosted_purchase_id)) throw new Error("Hosted recurring binding unavailable; retry after Checkout");
    return res.status(200).json({ received: true, ignored: !result.handled });
  } catch { return res.status(500).json({ error: "School payment reconciliation must retry" }); }
}
async function persistPending(db: any, purchase: any, status: string) {
  await db.transaction(async (tx: any) => {
    const [locked] = await tx.select().from(purchases).where(and(eq(purchases.id, purchase.id), eq(purchases.orgId, purchase.orgId))).for("update").limit(1);
    if (!locked) throw new Error("Pending purchase disappeared");
    if (locked.status !== "completed") await tx.update(purchases).set({ status }).where(and(eq(purchases.id, purchase.id), eq(purchases.orgId, purchase.orgId)));
  });
}
const router = express.Router();
router.post(COURSE360_SCHOOL_STRIPE_WEBHOOK_PATH, express.raw({ type: "application/json", limit: "2mb" }), handleCourse360SchoolStripeWebhook);
export default router;
