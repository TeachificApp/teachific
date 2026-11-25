import type Stripe from "stripe";
import { course360AppSubscriptionTier, type Course360AppTier } from "./course360WebhookAppEntitlement";

export type Course360SubscriptionStatus = "active" | "trialing" | "past_due" | "cancelled" | "unpaid";

/** Unknown/non-usable Stripe states must never become a paid entitlement. */
export function normalizeCourse360StripeStatus(status: string): Course360SubscriptionStatus {
  if (status === "canceled" || status === "cancelled") return "cancelled";
  if (status === "active" || status === "trialing" || status === "past_due" || status === "unpaid") return status;
  return "unpaid";
}

export function stripeObjectId(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  if (value && typeof value === "object" && "id" in value && typeof value.id === "string" && value.id.length > 0) return value.id;
  return null;
}

export function invoiceSubscriptionId(invoice: {
  parent?: { type?: string; subscription_details?: { subscription?: unknown } | null } | null;
  subscription?: unknown;
}): string | null {
  if (invoice.parent?.type === "subscription_details") {
    return stripeObjectId(invoice.parent.subscription_details?.subscription) ?? stripeObjectId(invoice.subscription);
  }
  // A modern non-subscription parent must not be routed through legacy metadata.
  if (invoice.parent != null) return null;
  return stripeObjectId(invoice.subscription);
}

export function isCourse360StripeEvent(value: unknown): value is Stripe.Event {
  if (!value || typeof value !== "object") return false;
  const event = value as Record<string, unknown>;
  if (typeof event.id !== "string" || !event.id.startsWith("evt_") || event.id.length <= 4) return false;
  if (typeof event.type !== "string" || event.type.length === 0 || typeof event.livemode !== "boolean") return false;
  if (typeof event.created !== "number" || !Number.isFinite(event.created) || event.created < 0) return false;
  if (event.account != null && (typeof event.account !== "string" || !event.account.startsWith("acct_"))) return false;
  const data = event.data;
  return !!data && typeof data === "object" && !Array.isArray(data)
    && "object" in data && !!data.object && typeof data.object === "object" && !Array.isArray(data.object);
}

/** This ingestion URL retrieves platform objects, not arbitrary connected-account objects. */
export function assertCourse360PlatformEventBinding(event: Stripe.Event, apiKey: string): void {
  const testKey = /^(sk|rk)_test_/.test(apiKey);
  const liveKey = /^(sk|rk)_live_/.test(apiKey);
  if (!testKey && !liveKey) throw new Error("Webhook account/mode configuration unavailable");
  if (event.livemode !== liveKey) throw new Error("Webhook mode does not match configured platform client");
  if (event.account) throw new Error("Connected-account events require a separately bound webhook endpoint");
}

export function currentCourse360EnrollmentStatus(status: string): "active" | "suspended" | "cancelled" {
  if (status === "active" || status === "trialing") return "active";
  if (status === "canceled" || status === "incomplete_expired") return "cancelled";
  return "suspended";
}

export type Course360AppProduct = "studio" | "creator" | "quiz_creator";
export function isCourse360AppProduct(value: unknown): value is Course360AppProduct {
  return value === "studio" || value === "creator" || value === "quiz_creator";
}

export type Course360AppProjection = {
  orgId: number;
  userId: number;
  product: Course360AppProduct;
  tier: "web" | "desktop" | "bundle";
  entitledTier: Course360AppTier;
  subscription: Stripe.Subscription;
  checkoutSessionId?: string;
};

// The six legacy user fields have no subscription identity or grant provenance.
// Never erase a manual grant or subscription B on receipt of subscription A.
// Parent integration MUST persist a school-bound subscription ledger, aggregate
// eligible subscriptions and independent manual grants transactionally, and use
// "none" (never NULL) when no source grants a product.
let appProjector: ((projection: Course360AppProjection) => Promise<void>) | undefined;
export function configureCourse360AppSubscriptionProjector(projector: (projection: Course360AppProjection) => Promise<void>): void {
  appProjector = projector;
}

export async function projectCourse360AppSubscription(subscription: Stripe.Subscription, session?: Stripe.Checkout.Session): Promise<boolean> {
  const product = subscription.metadata?.product_type ?? session?.metadata?.product_type;
  if (!isCourse360AppProduct(product)) return false;
  const userId = Number(subscription.metadata?.user_id ?? session?.metadata?.user_id);
  const orgId = Number(subscription.metadata?.org_id ?? session?.metadata?.org_id);
  const tier = subscription.metadata?.access_tier ?? session?.metadata?.access_tier ?? session?.metadata?.studio_tier;
  if (!Number.isSafeInteger(userId) || userId <= 0 || !Number.isSafeInteger(orgId) || orgId <= 0
    || (tier !== "web" && tier !== "desktop" && tier !== "bundle")) {
    throw new Error("App subscription requires a reconciled school/user/product binding");
  }
  if (session) {
    for (const key of ["product_type", "user_id", "org_id", "access_tier"] as const) {
      if (subscription.metadata?.[key] && session.metadata?.[key] && subscription.metadata[key] !== session.metadata[key]) {
        throw new Error("App Checkout and current subscription ownership do not match");
      }
    }
  }
  if (!appProjector) throw new Error("App subscription ledger projector is not configured; retry after reconciliation");
  const entitledTier = course360AppSubscriptionTier({ ...subscription, metadata: { ...subscription.metadata, access_tier: tier } });
  await appProjector({ orgId, userId, product, tier, entitledTier, subscription, ...(session ? { checkoutSessionId: session.id } : {}) });
  return true;
}

/** In-process serialization reduces races; durable multi-instance locking is still required. */
const subscriptionWork = new Map<string, Promise<unknown>>();
export async function serializeCourse360Subscription<T>(id: string, work: () => Promise<T>): Promise<T> {
  const previous = subscriptionWork.get(id) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(work);
  subscriptionWork.set(id, next);
  try { return await next; }
  finally { if (subscriptionWork.get(id) === next) subscriptionWork.delete(id); }
}
