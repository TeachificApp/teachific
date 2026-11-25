import { createHash, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { mysqlTable, int, varchar, text, decimal, timestamp, uniqueIndex } from "drizzle-orm/mysql-core";
import { TRPCError } from "@trpc/server";
import Stripe from "stripe";
import { course360RecurringBindings, course360EntitlementTargets, course360EntitlementSources } from "./course360HostedCheckoutTables";
import { resolveProtectedCourse360CheckoutGateway } from "./course360SchoolStripeGateway";

export const COURSE360_HOSTED_CHECKOUT_FAMILY = "course360_hosted_checkout_v1";
export const HOSTED_CONTENT_TYPES = ["course", "download", "physical_product", "webinar", "membership", "membership_plan", "workshop", "bundle"] as const;
export type HostedContentType = typeof HOSTED_CONTENT_TYPES[number];

/** Additive migration required; deliberately separate from course-only lms_orders. */
export const course360HostedCheckoutPurchases = mysqlTable("course360_hosted_checkout_purchases", {
  id: varchar("id", { length: 64 }).primaryKey(),
  orgId: int("org_id").notNull(),
  userId: int("user_id").notNull(),
  contentType: varchar("content_type", { length: 32 }).notNull(),
  contentId: int("content_id").notNull(),
  contentSlug: varchar("content_slug", { length: 255 }).notNull(),
  gateway: varchar("gateway", { length: 32 }).notNull(),
  accountId: varchar("account_id", { length: 255 }).notNull(),
  stripeSessionId: varchar("stripe_session_id", { length: 255 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
  pricingOptionId: int("pricing_option_id"),
  pricingType: varchar("pricing_type", { length: 32 }).notNull(),
  unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
  seats: int("seats").notNull(),
  currency: varchar("currency", { length: 8 }).notNull(),
  trialDays: int("trial_days").default(0).notNull(),
  zeroPaymentEligible: int("zero_payment_eligible").default(0).notNull(),
  selectedBumpIds: text("selected_bump_ids"),
  amount: decimal("amount", { precision: 12, scale: 2 }),
  status: varchar("status", { length: 32 }).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, table => [uniqueIndex("course360_hosted_account_session_uq").on(table.gateway, table.accountId, table.stripeSessionId)]);

export type HostedPurchase = typeof course360HostedCheckoutPurchases.$inferSelect;
export type HostedGateway = { gateway: "own_gateway" | "connect"; accountId: string; stripe: Stripe; requestOptions: Stripe.RequestOptions };

export async function resolveCourse360HostedGateway(org: any, platformSecretKey: string, db?: any): Promise<HostedGateway> {
  if (!org || !Number.isSafeInteger(org.id) || org.id <= 0 || org.isActive === false) {
    throw new TRPCError({ code: "FORBIDDEN", message: "The checkout school is unavailable." });
  }
  if (db) {
    const protectedGateway = await resolveProtectedCourse360CheckoutGateway(db, org);
    if (protectedGateway) return protectedGateway;
  }
  if (org.paymentGateway === "own_gateway") {
    // Existing organization settings currently store a raw Stripe key in this legacy-named field.
    // Reject unknown encrypted formats rather than silently charging the platform account.
    const key = org.ownStripeSecretKeyEncrypted;
    if (typeof key !== "string" || !/^(sk|rk)_(test|live)_/.test(key)) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The school's payment gateway is not configured." });
    }
    const stripe = new Stripe(key, { apiVersion: "2024-06-20" as any });
    const account = await stripe.accounts.retrieve();
    if (!account.id) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Could not verify the school's payment account." });
    return { gateway: "own_gateway", accountId: account.id, stripe, requestOptions: {} };
  }
  if (org.paymentGateway === "teachific_pay" && org.stripeConnectStatus === "active" && /^acct_/.test(org.stripeConnectAccountId ?? "") && platformSecretKey) {
    const accountId = org.stripeConnectAccountId;
    return { gateway: "connect", accountId, stripe: new Stripe(platformSecretKey, { apiVersion: "2024-06-20" as any }), requestOptions: { stripeAccount: accountId } };
  }
  throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The school's payment gateway is not ready." });
}

export function hostedPurchaseMetadata(purchase: HostedPurchase): Record<string, string> {
  return {
    type: COURSE360_HOSTED_CHECKOUT_FAMILY,
    trigger_order_type: "lms_hosted_checkout",
    hosted_purchase_id: purchase.id,
    org_id: String(purchase.orgId), user_id: String(purchase.userId),
    content_type: purchase.contentType, content_id: String(purchase.contentId), content_slug: purchase.contentSlug,
    pricing_type: purchase.pricingType, seat_count: String(purchase.seats),
    gateway: purchase.gateway, stripe_account_id: purchase.accountId,
    ...(purchase.pricingOptionId ? { pricing_option_id: String(purchase.pricingOptionId) } : {}),
    ...(purchase.selectedBumpIds ? { selected_bump_ids: purchase.selectedBumpIds } : {}),
  };
}

export async function createHostedPurchase(db: any, values: Omit<typeof course360HostedCheckoutPurchases.$inferInsert, "id">, free = false): Promise<HostedPurchase> {
  const id = free ? `free_${createHash("sha256").update(JSON.stringify([values.orgId, values.userId, values.contentType, values.contentId, values.pricingOptionId ?? null])).digest("hex").slice(0, 48)}` : randomUUID();
  await db.insert(course360HostedCheckoutPurchases).values({ ...values, id }).onDuplicateKeyUpdate({ set: { id } });
  const [purchase] = await db.select().from(course360HostedCheckoutPurchases).where(and(eq(course360HostedCheckoutPurchases.id, id), eq(course360HostedCheckoutPurchases.orgId, values.orgId))).limit(1);
  if (!purchase) throw new Error("Hosted purchase persistence failed");
  return purchase;
}

export function validateHostedSession(session: any, purchase: HostedPurchase, gateway: Pick<HostedGateway, "gateway" | "accountId">, expected?: { userId: number; orgId: number; contentType: string; contentId: number; slug: string }) {
  const meta = session.metadata ?? {};
  const immutable = hostedPurchaseMetadata(purchase);
  for (const key of ["type", "hosted_purchase_id", "org_id", "user_id", "content_type", "content_id", "content_slug", "pricing_type", "seat_count", "gateway", "stripe_account_id", "pricing_option_id", "selected_bump_ids"]) {
    if ((meta[key] ?? "") !== (immutable[key] ?? "")) throw new TRPCError({ code: "FORBIDDEN", message: "Checkout does not match its school-owned purchase." });
  }
  if (!session.id || session.client_reference_id !== String(purchase.userId) || (purchase.stripeSessionId && purchase.stripeSessionId !== session.id) || gateway.gateway !== purchase.gateway || gateway.accountId !== purchase.accountId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Checkout account or buyer mismatch." });
  }
  if (expected && (expected.userId !== purchase.userId || expected.orgId !== purchase.orgId || expected.contentType !== purchase.contentType || expected.contentId !== purchase.contentId || expected.slug !== purchase.contentSlug)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "This checkout belongs to another buyer or item." });
  }
  const sessionSubscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;
  if (purchase.stripeSubscriptionId && sessionSubscriptionId !== purchase.stripeSubscriptionId) throw new TRPCError({ code: "FORBIDDEN", message: "Checkout subscription binding mismatch." });
  if (session.mode !== (purchase.pricingType === "subscription" || purchase.pricingType === "trial_then_subscription" ? "subscription" : "payment")) throw new TRPCError({ code: "FORBIDDEN", message: "Checkout billing mode mismatch." });
  if (session.currency?.toLowerCase() !== purchase.currency.toLowerCase() || !Number.isSafeInteger(session.amount_total) || session.amount_total < 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid checkout settlement." });
  if (session.status !== "complete") return false;
  if (session.payment_status === "paid") return true;
  return session.payment_status === "no_payment_required" && session.amount_total === 0 && (purchase.zeroPaymentEligible === 1 || (session.mode === "subscription" && purchase.trialDays > 0));
}

export function settledHostedDollars(amountCents: number): string {
  if (!Number.isSafeInteger(amountCents) || amountCents < 0) throw new Error("Invalid settled cents");
  return (amountCents / 100).toFixed(2);
}

export function hostedEnrollmentHasCurrentFullAccess(row: any, now = Date.now()): boolean {
  return !!row && row.enrollmentType === "full" && ["active", "completed"].includes(row.status) && (!row.accessExpiresAt || new Date(row.accessExpiresAt).getTime() > now) && (!row.expiresAt || new Date(row.expiresAt).getTime() > now);
}

/** Presence check only: never creates tables at startup/request time. Fail before creating a charge. */
export async function assertCourse360HostedPersistenceReady(db: any, recurring: boolean): Promise<void> {
  await db.select().from(course360EntitlementTargets).limit(1);
  await db.select().from(course360EntitlementSources).limit(1);
  if (recurring) await db.select().from(course360RecurringBindings).limit(1);
}
