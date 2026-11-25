/** Mounted Course360 embedded checkout boundary. Stored dollars; Stripe cents only. */
import { z } from "zod";
import Stripe from "stripe";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { funnelPurchases, organizations, orgPaymentSettings } from "../drizzle/schema";
import { getStripe } from "./stripePlans";
import { embeddedCheckoutSnapshots, loadEmbeddedSnapshot } from "./lib/embeddedCheckoutTables";
import { ENV } from "./_core/env";
import { getPublicRequestHostname, resolvePublicOrganizationScope } from "./lib/publicOrgRequestScope";
import { embeddedSuccessUrl, hashEmbedded, newEmbeddedProof, readEmbeddedManifest, resolveEmbeddedSelection, validEmbeddedProof, type EmbeddedManifest } from "./lib/embeddedCheckoutSelection";
import { reconcileEmbeddedPurchase } from "./lib/embeddedCheckoutFulfillment";
import { notifyEmbeddedPurchase } from "./lib/embeddedCheckoutNotifications";

const id = z.number().int().positive();
const address = z.object({ name: z.string(), line1: z.string(), line2: z.string().optional(), city: z.string(), state: z.string(), postalCode: z.string(), country: z.string() });
const inputSchema = z.object({
  orgId: id.optional(), orgSlug: z.string().min(1).max(100).optional(),
  email: z.string().email(), firstName: z.string().optional(), lastName: z.string().optional(), phone: z.string().max(20).optional(),
  productName: z.string(), productPrice: z.number().finite().nonnegative().optional(),
  productType: z.enum(["course", "download", "quiz", "physical", "membership", "bundle", "other", "subscription"]).default("other"),
  productId: id.optional(), priceId: id.optional(),
  selectedProductIndex: z.number().int().nonnegative().default(0), addedBumpIndexes: z.array(z.number().int().nonnegative()).default([]), checkoutBlockId: z.string().optional(),
  selectedBumps: z.array(z.object({ title: z.string(), price: z.number().finite().nonnegative(), productType: z.string().optional(), productId: id.optional(), bumpId: id.optional(), bumpType: z.string().optional() })).default([]),
  billingAddress: z.object({ address: z.string(), address2: z.string().optional(), country: z.string(), state: z.string(), city: z.string(), postalCode: z.string() }).optional(),
  shippingAddress: address.optional(), collectShipping: z.boolean().default(false),
  sourceType: z.enum(["funnel", "landing_page", "product_page", "lms_lesson", "email", "other"]).default("other"),
  sourceFunnelId: id.optional(), sourceFunnelPageId: id.optional(), sourceLandingPageId: id.optional(), sourceLmsLessonId: id.optional(),
  lmsCourseId: id.optional(), fulfillmentCourseId: id.optional(), fulfillmentDownloadId: id.optional(), fulfillmentQuizId: id.optional(), fulfillmentMembershipId: id.optional(), fulfillmentBundleId: id.optional(),
  // Legacy configs remain stored unchanged. Brand grants are rejected by the resolver, never created.
  fulfillmentBrand: z.string().optional(), additionalAccess: z.array(z.object({ label: z.string().optional(), type: z.string(), id: id.optional(), productId: id.optional(), brand: z.string().optional() })).optional(),
  successRedirect: z.string().optional(), origin: z.string(), promoCode: z.string().optional(),
});
const purchaseAccess = z.object({ paymentIntentId: z.string().min(1).optional(), purchaseId: id.optional(), confirmationToken: z.string().optional(), orgSlug: z.string().optional() });

export function embeddedPlatformGateway() {
  const secretKey = process.env.COURSE360_STRIPE_SECRET_KEY?.trim() || ENV.stripeSecretKey;
  const publishableKey = process.env.VITE_COURSE360_STRIPE_PUBLISHABLE_KEY?.trim() || ENV.stripePublishableKey;
  const signingSecret = process.env.COURSE360_EMBEDDED_STRIPE_WEBHOOK_SECRET?.trim();
  if (!secretKey || !publishableKey || !signingSecret) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Embedded payment gateway and endpoint signing secret are not configured" });
  if ((!/^sk_(test|live)_/.test(secretKey) && !/^rk_(test|live)_/.test(secretKey)) || !/^pk_(test|live)_/.test(publishableKey) || secretKey.includes("_live_") !== publishableKey.includes("_live_")) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Embedded gateway key modes do not match" });
  const deployedHost = process.env.APP_URL || process.env.VITE_APP_URL || process.env.RAILWAY_PUBLIC_DOMAIN || "";
  const preview = /localhost|127\.0\.0\.1|\.manus\.computer|\.manus\.space/.test(deployedHost);
  if (process.env.NODE_ENV === "production" && !preview && !secretKey.includes("_live_")) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Production embedded payments require live gateway keys" });
  return { secretKey, publishableKey, signingSecret, livemode: secretKey.includes("_live_"), keyFingerprint: hashEmbedded(secretKey) };
}
export async function embeddedStripeClient() {
  const gateway = embeddedPlatformGateway();
  // stripePlans is updated by the integration owner to prefer Course360 keys.
  // Instantiate directly when custom keys are present so this boundary is correct independently.
  if (process.env.COURSE360_STRIPE_SECRET_KEY) {
    return new Stripe(gateway.secretKey, { apiVersion: "2025-03-31.basil" as any });
  }
  return getStripe();
}
function checkoutOrigin(req: any, supplied: string) {
  const host = getPublicRequestHostname(req);
  const origin = new URL(supplied);
  if (!host || origin.hostname !== host || !["http:", "https:"].includes(origin.protocol)) throw new TRPCError({ code: "BAD_REQUEST", message: "Checkout origin does not match this school request" });
  return origin.origin;
}
async function authorizedPurchase(ctx: any, input: z.infer<typeof purchaseAccess>) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  const scope = await resolvePublicOrganizationScope(db, ctx.req, input.orgSlug);
  if (!scope || (!input.paymentIntentId && !input.purchaseId)) throw new TRPCError({ code: "NOT_FOUND", message: "Checkout unavailable" });
  const [purchase] = await db.select().from(funnelPurchases).where(and(eq(funnelPurchases.orgId, scope.id), input.paymentIntentId ? eq(funnelPurchases.stripePaymentIntentId, input.paymentIntentId) : eq(funnelPurchases.id, input.purchaseId!))).limit(1);
  if (!purchase || purchase.orgId !== scope.id) throw new TRPCError({ code: "NOT_FOUND", message: "Checkout unavailable" });
  const stored = await loadEmbeddedSnapshot(db, purchase);
  const manifest = readEmbeddedManifest(stored.snapshotManifest);
  const isBuyer = !!ctx.user && ctx.user.id === purchase.userId;
  if (ctx.user && !isBuyer || (!isBuyer && !validEmbeddedProof(input.confirmationToken, manifest.confirmationHash))) throw new TRPCError({ code: "FORBIDDEN", message: "Checkout belongs to another buyer" });
  return { db, purchase: stored, manifest };
}
function purchaseValues(ctx: any, input: z.infer<typeof inputSchema>, selection: any, manifest: EmbeddedManifest) {
  if (ctx.user?.email && ctx.user.email.toLowerCase() !== input.email.toLowerCase()) throw new TRPCError({ code: "FORBIDDEN", message: "Use your signed-in buyer email" });
  return {
    orgId: selection.orgId, userId: ctx.user?.id ?? null, email: input.email.toLowerCase(), name: [input.firstName, input.lastName].filter(Boolean).join(" ") || null, phone: input.phone ?? null,
    productName: selection.name, productType: selection.productType, productId: selection.productId, amount: manifest.amount, currency: "USD",
    orderBumps: manifest.bumps.length ? JSON.stringify(manifest.bumps) : null, sourceType: input.sourceType, sourceFunnelId: input.sourceFunnelId ?? null, sourceFunnelPageId: input.sourceFunnelPageId ?? null, sourceLandingPageId: input.sourceLandingPageId ?? null, sourceLmsLessonId: input.sourceLmsLessonId ?? null,
    fulfillmentCourseId: selection.productType === "course" ? selection.productId : null, fulfillmentQuizId: selection.productType === "quiz" ? selection.productId : null, fulfillmentDownloadId: selection.productType === "download" ? selection.productId : null, fulfillmentBundleId: selection.productType === "bundle" ? selection.productId : null,
    status: "pending" as const,
  };
}
export const embeddedCheckoutRouter = router({
  createPaymentIntent: publicProcedure.input(inputSchema).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    const selection = await resolveEmbeddedSelection(db, ctx.req, input);
    if (selection.cents < 50) throw new TRPCError({ code: "BAD_REQUEST", message: selection.cents === 0 ? "Use processFreeOrder for a free checkout" : "Minimum charge amount is $0.50" });
    const [settings] = await db.select().from(orgPaymentSettings).where(eq(orgPaymentSettings.orgId, selection.orgId)).limit(1);
    // Direct-account and Connect payments must not silently fall back to a different account.
    if (settings?.stripeSecretKey || settings?.stripeConnectEnabled) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This school's gateway requires its native checkout and tenant webhook setup" });
    const gateway = embeddedPlatformGateway();
    const proof = newEmbeddedProof();
    const manifest: EmbeddedManifest = { version: 2, orgId: selection.orgId, name: selection.name, productType: selection.productType, productId: selection.productId, amount: (selection.cents / 100).toFixed(2), currency: "usd", targets: selection.targets, bumps: selection.bumps, gateway: { accountId: null, livemode: gateway.livemode, keyFingerprint: gateway.keyFingerprint }, confirmationHash: proof.hash, buyerId: ctx.user?.id ?? null, successUrl: embeddedSuccessUrl(checkoutOrigin(ctx.req, input.origin), selection.redirect), workflow: selection.workflow };
    const values = purchaseValues(ctx, input, selection, manifest);
    // Do not create a payable intent if the additive snapshot migration has not been applied.
    await db.select({ purchaseId: embeddedCheckoutSnapshots.purchaseId }).from(embeddedCheckoutSnapshots).where(eq(embeddedCheckoutSnapshots.orgId, selection.orgId)).limit(1);
    const stripe = await embeddedStripeClient();
    const payment = await stripe.paymentIntents.create({ amount: selection.cents, currency: "usd", description: selection.name.slice(0, 1000), receipt_email: values.email, metadata: { type: "embedded_checkout_purchase", org_id: String(selection.orgId), customer_email: values.email, user_id: ctx.user?.id ? String(ctx.user.id) : "", checkout_manifest_hash: hashEmbedded(JSON.stringify(manifest)) }, automatic_payment_methods: { enabled: true } });
    if (payment.livemode !== gateway.livemode || !payment.client_secret) throw new Error("Unexpected gateway payment mode");
    try { await db.transaction(async (tx: any) => {
      const inserted = await tx.insert(funnelPurchases).values({ ...values, stripePaymentIntentId: payment.id });
      const result = Array.isArray(inserted) ? inserted[0] : inserted;
      if (!result?.insertId) throw new Error("Checkout was not recorded");
      await tx.insert(embeddedCheckoutSnapshots).values({ purchaseId: Number(result.insertId), orgId: selection.orgId, manifest: JSON.stringify(manifest) });
    }); }
    catch (error) { await stripe.paymentIntents.cancel(payment.id).catch(() => {}); throw error; }
    return { clientSecret: payment.client_secret, paymentIntentId: payment.id, confirmationToken: proof.token, publishableKey: gateway.publishableKey, amount: selection.cents / 100, successUrl: manifest.successUrl };
  }),
  confirmPayment: publicProcedure.input(purchaseAccess.extend({ paymentIntentId: z.string().min(1) })).mutation(async ({ ctx, input }) => {
    const { purchase, manifest } = await authorizedPurchase(ctx, input);
    if (manifest.gateway.keyFingerprint !== embeddedPlatformGateway().keyFingerprint || manifest.gateway.accountId !== null) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Original checkout gateway is unavailable" });
    if (purchase.status === "refunded") throw new TRPCError({ code: "BAD_REQUEST", message: "This checkout was refunded" });
    const stripe = await embeddedStripeClient();
    const intent = await stripe.paymentIntents.retrieve(input.paymentIntentId);
    if (intent.status === "succeeded") {
      const chargeId = typeof intent.latest_charge === "string" ? intent.latest_charge : intent.latest_charge?.id;
      if (!chargeId) throw new Error("Settled payment charge is unavailable");
      const charge = await stripe.charges.retrieve(chargeId);
      const linked = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
      if (linked !== intent.id || charge.amount !== intent.amount_received || charge.currency !== manifest.currency || charge.livemode !== manifest.gateway.livemode) throw new Error("Settled charge linkage mismatch");
      if (charge.refunded && charge.amount_refunded >= charge.amount) {
        await reconcileEmbeddedPurchase(purchase.id, purchase.orgId, { intent, refund: true });
        throw new TRPCError({ code: "BAD_REQUEST", message: "This checkout was refunded" });
      }
    }
    const result = await reconcileEmbeddedPurchase(purchase.id, purchase.orgId, { intent });
    if (result.changed) await notifyEmbeddedPurchase(result.purchase);
    return { success: true, status: result.purchase.status };
  }),
  processFreeOrder: publicProcedure.input(inputSchema).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    const selection = await resolveEmbeddedSelection(db, ctx.req, input);
    if (selection.cents !== 0) throw new TRPCError({ code: "BAD_REQUEST", message: "This school product is not free" });
    const proof = newEmbeddedProof();
    const manifest: EmbeddedManifest = { version: 2, orgId: selection.orgId, name: selection.name, productType: selection.productType, productId: selection.productId, amount: "0.00", currency: "usd", targets: selection.targets, bumps: selection.bumps, gateway: { accountId: null, livemode: false, keyFingerprint: "free" }, confirmationHash: proof.hash, buyerId: ctx.user?.id ?? null, successUrl: embeddedSuccessUrl(checkoutOrigin(ctx.req, input.origin), selection.redirect), workflow: selection.workflow };
    const values = purchaseValues(ctx, input, selection, manifest);
    const retryKey = `embedded_free:${hashEmbedded(JSON.stringify({ orgId: selection.orgId, email: values.email, buyerId: values.userId, targets: selection.targets })).slice(0, 64)}`;
    const purchaseId = await db.transaction(async (tx: any) => {
      // Serialize free-checkout insertion within the school; no new schema fields required.
      const [school] = await tx.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, selection.orgId)).limit(1).for("update");
      if (!school) throw new Error("School unavailable");
      const [existing] = await tx.select().from(funnelPurchases).where(and(eq(funnelPurchases.orgId, selection.orgId), eq(funnelPurchases.stripeSessionId, retryKey))).limit(1);
      if (existing) return existing.id;
      const inserted = await tx.insert(funnelPurchases).values({ ...values, stripeSessionId: retryKey });
      const result = Array.isArray(inserted) ? inserted[0] : inserted;
      if (!result?.insertId) throw new Error("Free checkout was not recorded");
      await tx.insert(embeddedCheckoutSnapshots).values({ purchaseId: Number(result.insertId), orgId: selection.orgId, manifest: JSON.stringify(manifest) });
      return Number(result.insertId);
    });
    const result = await reconcileEmbeddedPurchase(purchaseId, selection.orgId, { free: true });
    if (result.changed) await notifyEmbeddedPurchase(result.purchase);
    // On retry, workflow is returned only after completed, school-bound fulfillment; no guest account session is minted.
    const original = readEmbeddedManifest(result.purchase.snapshotManifest);
    return { purchaseId, successUrl: original.successUrl, workflow: original.workflow, confirmationToken: result.purchase.snapshotManifest === JSON.stringify(manifest) ? proof.token : undefined };
  }),
  getPostPurchaseWorkflow: publicProcedure.input(purchaseAccess.extend({ productId: id.optional(), productType: z.string().optional() })).query(async ({ ctx, input }) => {
    const { purchase, manifest } = await authorizedPurchase(ctx, input);
    if (purchase.status !== "completed") return { workflow: null };
    if ((input.productId != null && input.productId !== purchase.productId) || (input.productType && input.productType !== purchase.productType)) throw new TRPCError({ code: "FORBIDDEN", message: "Workflow product mismatch" });
    return { workflow: manifest.workflow };
  }),
});
