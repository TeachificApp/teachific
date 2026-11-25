import { and, eq, sql } from "drizzle-orm";
import { digitalBundlePurchases, digitalProducts, digitalPurchases, funnelPurchases, lmsCourses, lmsEnrollments, organizations } from "../../drizzle/schema";
import { loadEmbeddedSnapshot } from "./embeddedCheckoutTables";
import { getDb, getOrCreateUserByEmail } from "../db";
import { dollarsToStripeCents } from "./checkoutPricing";
import { hashEmbedded, readEmbeddedManifest, type EmbeddedManifest, type EmbeddedTarget } from "./embeddedCheckoutSelection";

export function assertEmbeddedPayment(purchase: any, manifest: EmbeddedManifest, intent: any, event?: { account?: string; livemode: boolean }) {
  if (manifest.orgId !== purchase.orgId || manifest.productId !== purchase.productId || manifest.productType !== purchase.productType || manifest.amount !== String(purchase.amount) || purchase.currency.toLowerCase() !== manifest.currency) throw new Error("Purchase snapshot mismatch");
  if (!intent || intent.object !== "payment_intent" || intent.id !== purchase.stripePaymentIntentId || intent.status !== "succeeded" || intent.amount !== dollarsToStripeCents(purchase.amount) || intent.amount_received !== dollarsToStripeCents(purchase.amount) || intent.currency !== manifest.currency || intent.livemode !== manifest.gateway.livemode) throw new Error("Payment has not settled for this checkout");
  if (event && ((event.account ?? null) !== manifest.gateway.accountId || event.livemode !== manifest.gateway.livemode)) throw new Error("Payment account or mode mismatch");
  const meta = intent.metadata ?? {};
  if (meta.type !== "embedded_checkout_purchase" || meta.org_id !== String(purchase.orgId) || meta.checkout_manifest_hash !== hashEmbedded(purchase.snapshotManifest) || meta.customer_email?.toLowerCase() !== purchase.email.toLowerCase() || meta.user_id !== (manifest.buyerId ? String(manifest.buyerId) : "")) throw new Error("Payment identity or snapshot mismatch");
}

async function checkTargetOwnership(tx: any, orgId: number, target: EmbeddedTarget) {
  if (!["course", "quiz", "download", "bundle"].includes(target.type) || !Number.isSafeInteger(target.id)) throw new Error("Unsupported saved fulfillment target");
  if (target.type === "bundle") {
    const { digitalBundles } = await import("../../drizzle/schema");
    const [bundle] = await tx.select({ orgId: digitalBundles.orgId }).from(digitalBundles).where(and(eq(digitalBundles.id, target.id), eq(digitalBundles.orgId, orgId))).limit(1);
    if (!bundle || bundle.orgId !== orgId || !target.children?.length) throw new Error("Bundle is no longer school-bound");
    for (const child of target.children) await checkTargetOwnership(tx, orgId, child);
  } else {
    const table = target.type === "download" ? digitalProducts : lmsCourses;
    const [row] = await tx.select({ orgId: table.orgId }).from(table).where(and(eq(table.id, target.id), eq(table.orgId, orgId))).limit(1);
    if (!row || row.orgId !== orgId) throw new Error("Fulfillment target is outside the school");
  }
}

async function grantTarget(tx: any, purchase: any, userId: number, target: EmbeddedTarget, ref: string) {
  if (target.type === "bundle") {
    // Children always reconcile, regardless of an earlier bundle marker. A failed child aborts this transaction.
    for (const child of target.children ?? []) await grantTarget(tx, purchase, userId, child, ref);
    const [existing] = await tx.select().from(digitalBundlePurchases).where(and(eq(digitalBundlePurchases.userId, userId), eq(digitalBundlePurchases.bundleId, target.id), eq(digitalBundlePurchases.stripeCheckoutSessionId, ref))).limit(1);
    if (!existing) await tx.insert(digitalBundlePurchases).values({ userId, bundleId: target.id, stripeCheckoutSessionId: ref });
  } else if (target.type === "download") {
    const [existing] = await tx.select().from(digitalPurchases).where(and(eq(digitalPurchases.userId, userId), eq(digitalPurchases.productId, target.id), eq(digitalPurchases.stripeCheckoutSessionId, ref))).limit(1);
    if (!existing) await tx.insert(digitalPurchases).values({ userId, productId: target.id, stripePaymentIntentId: purchase.stripePaymentIntentId, stripeCheckoutSessionId: ref });
  } else {
    const [existing] = await tx.select().from(lmsEnrollments).where(and(eq(lmsEnrollments.orgId, purchase.orgId), eq(lmsEnrollments.userId, userId), eq(lmsEnrollments.courseId, target.id), eq(lmsEnrollments.source, ref))).limit(1);
    if (!existing) {
      const expires = target.accessDays != null ? new Date(Date.now() + target.accessDays * 86400000) : null;
      await tx.insert(lmsEnrollments).values({ orgId: purchase.orgId, userId, courseId: target.id, status: "active", enrollmentType: "full", source: ref, accessExpiresAt: expires });
    }
  }
}
async function revokeTarget(tx: any, purchase: any, target: EmbeddedTarget, ref: string) {
  if (target.type === "bundle") {
    for (const child of target.children ?? []) await revokeTarget(tx, purchase, child, ref);
    await tx.delete(digitalBundlePurchases).where(and(eq(digitalBundlePurchases.userId, purchase.userId), eq(digitalBundlePurchases.bundleId, target.id), eq(digitalBundlePurchases.stripeCheckoutSessionId, ref)));
  } else if (target.type === "download") {
    // Remove only this purchase's grant. Other paid/manual access remains intact.
    await tx.delete(digitalPurchases).where(and(eq(digitalPurchases.userId, purchase.userId), eq(digitalPurchases.productId, target.id), eq(digitalPurchases.stripeCheckoutSessionId, ref)));
  } else {
    await tx.update(lmsEnrollments).set({ status: "cancelled", accessExpiresAt: new Date(0) }).where(and(eq(lmsEnrollments.orgId, purchase.orgId), eq(lmsEnrollments.userId, purchase.userId), eq(lmsEnrollments.courseId, target.id), eq(lmsEnrollments.source, ref)));
  }
}

/** The purchase row lock is the durable claim: all grants and status updates share one transaction. */
export async function reconcileEmbeddedPurchase(purchaseId: number, orgId: number, options: { intent?: any; event?: any; free?: boolean; refund?: boolean } = {}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  // Guest identity helper returns {user}; upsertUser returns void and must never be used here.
  const [initial] = await db.select().from(funnelPurchases).where(and(eq(funnelPurchases.id, purchaseId), eq(funnelPurchases.orgId, orgId))).limit(1);
  if (!initial) throw new Error("Purchase unavailable in this school");
  const storedInitial = await loadEmbeddedSnapshot(db, initial);
  const manifest = readEmbeddedManifest(storedInitial.snapshotManifest);
  if (options.intent) assertEmbeddedPayment(storedInitial, manifest, options.intent, options.event);
  if (options.refund && !options.intent) throw new Error("Verified refund payment reference is required");
  if (!options.intent && !options.free && !options.refund) throw new Error("Verified settlement is required");
  if (options.free && (dollarsToStripeCents(initial.amount) !== 0 || manifest.amount !== "0.00" || initial.stripePaymentIntentId)) throw new Error("Order is not free");
  if (initial.status === "refunded" || (initial.status === "completed" && !options.refund)) return { purchase: storedInitial, changed: false };
  return db.transaction(async (tx: any) => {
    if (!initial.userId) {
      const [school] = await tx.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, orgId)).limit(1).for("update");
      if (!school) throw new Error("School unavailable");
    }
    const [row] = await tx.select().from(funnelPurchases).where(and(eq(funnelPurchases.id, purchaseId), eq(funnelPurchases.orgId, orgId))).limit(1).for("update");
    if (!row) throw new Error("Purchase unavailable");
    const purchase = await loadEmbeddedSnapshot(tx, row);
    const saved = readEmbeddedManifest(purchase.snapshotManifest);
    if (saved.orgId !== orgId || saved.amount !== String(purchase.amount)) throw new Error("Invalid checkout snapshot");
    if (options.intent) assertEmbeddedPayment(purchase, saved, options.intent, options.event);
    if (purchase.status === "refunded" || (purchase.status === "completed" && !options.refund)) return { purchase, changed: false };
    if (!purchase.userId) {
      // Serialize new guests within the school and re-use the returned helper's user contract.
      const resolved = await getOrCreateUserByEmail({ email: purchase.email.toLowerCase(), name: purchase.name ?? undefined });
      if (!resolved?.user?.id) throw new Error("Unable to resolve checkout buyer");
      purchase.userId = resolved.user.id;
    }
    if (!purchase.userId) throw new Error("Checkout buyer is unresolved");
    const ref = `embedded_purchase:${purchase.id}`;
    for (const target of saved.targets) {
      await checkTargetOwnership(tx, orgId, target);
      if (options.refund) await revokeTarget(tx, purchase, target, ref);
      else await grantTarget(tx, purchase, purchase.userId, target, ref);
    }
    const status = options.refund ? "refunded" : "completed";
    await tx.update(funnelPurchases).set({ userId: purchase.userId, status, updatedAt: new Date() }).where(and(eq(funnelPurchases.id, purchase.id), eq(funnelPurchases.orgId, orgId)));
    return { purchase: { ...purchase, status }, changed: true };
  });
}

export async function markEmbeddedPaymentFailed(purchaseId: number, orgId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(funnelPurchases).set({ status: "failed", updatedAt: new Date() }).where(and(eq(funnelPurchases.id, purchaseId), eq(funnelPurchases.orgId, orgId), sql`${funnelPurchases.status} IN ('pending', 'failed')`));
}
