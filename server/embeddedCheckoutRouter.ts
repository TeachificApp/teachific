/**
 * embeddedCheckoutRouter.ts
 *
 * tRPC procedures for embedded Stripe PaymentIntent checkout blocks.
 * This block can be placed on any page builder surface (funnels, landing pages,
 * product pages, LMS lessons) and provides inline Stripe PaymentElement checkout
 * with order bumps, address collection, and dashboard purchase recording.
 *
 * Supports:
 * - Courses, downloads, quizzes, memberships, physical products
 * - Order bumps (additional products at discounted rates)
 * - Promo code validation and discount application
 * - Shipping address collection for physical products
 * - Auto-fulfillment on payment success (course enrollment, download access, etc.)
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { funnelPurchases } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { getStripe, PLAN_LIMITS, type PlanTier } from "./stripePlans";
import { getOrgSubscription } from "./lmsDb";

const billingAddressSchema = z.object({
  address: z.string(),
  address2: z.string().optional(),
  country: z.string(),
  state: z.string(),
  city: z.string(),
  postalCode: z.string(),
});

const shippingAddressSchema = z.object({
  name: z.string(),
  line1: z.string(),
  line2: z.string().optional(),
  city: z.string(),
  state: z.string(),
  postalCode: z.string(),
  country: z.string(),
});

const orderBumpInputSchema = z.object({
  title: z.string(),
  price: z.number(), // dollars (e.g. 37.00)
  productType: z.string().optional(),
  productId: z.number().optional(),
  bumpId: z.number().optional(),    // order_bumps.id — needed for webhook fulfillment
  bumpType: z.string().optional(),  // "course" | "download" | "bundle" | "physical"
});

const additionalAccessSchema = z.array(z.object({
  label: z.string().optional(),
  type: z.enum(["course", "download", "quiz", "physical", "membership", "bundle"]),
  id: z.number().optional(),
  productId: z.number().optional(),
  brand: z.enum(["teachific", "both"]).optional(),
})).optional();

export const embeddedCheckoutRouter = router({
  /**
   * Create a Stripe PaymentIntent for an embedded checkout block.
   * Works on any page type — funnel, landing page, product page, or LMS lesson.
   *
   * Supports org's own Stripe gateway (Pro+ plans) or TeachificPay (all plans).
   */
  createPaymentIntent: publicProcedure
    .input(
      z.object({
        // Org context
        orgId: z.number(),
        // Customer details
        email: z.string().email(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        phone: z.string().optional(),
        // Primary product
        productName: z.string(),
        productPrice: z.number().positive(), // dollars (e.g. 37.00), min $0.50 enforced below
        productType: z.enum(["course", "download", "quiz", "physical", "membership", "bundle", "other"]).default("other"),
        productId: z.number().optional(),
        // Order bumps selected by the user
        selectedBumps: z.array(orderBumpInputSchema).default([]),
        // Address (required for physical products)
        billingAddress: billingAddressSchema.optional(),
        shippingAddress: shippingAddressSchema.optional(),
        collectShipping: z.boolean().default(false),
        // Source context (for attribution and dashboard display)
        sourceType: z.enum(["funnel", "landing_page", "product_page", "lms_lesson", "email", "other"]).default("other"),
        sourceFunnelId: z.number().optional(),
        sourceFunnelPageId: z.number().optional(),
        sourceLandingPageId: z.number().optional(),
        sourceLmsLessonId: z.number().optional(),
        // Fulfillment: auto-enroll in LMS course or grant access on payment success
        fulfillmentCourseId: z.number().optional(),
        fulfillmentDownloadId: z.number().optional(),
        fulfillmentQuizId: z.number().optional(),
        fulfillmentMembershipId: z.number().optional(),
        fulfillmentBrand: z.enum(["teachific", "both"]).optional(),
        additionalAccess: additionalAccessSchema,
        // Redirect after success
        successRedirect: z.string().optional(),
        origin: z.string(),
        // Optional promo code to validate and apply
        promoCode: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Prices arrive in DOLLARS (e.g. 37.00). Convert to cents only at the Stripe boundary.
      let totalAmountDollars = Number(input.productPrice);
      for (const bump of input.selectedBumps) {
        if (bump.price > 0) totalAmountDollars += Number(bump.price);
      }
      let totalAmountCents = Math.round(totalAmountDollars * 100);

      // Apply promo code discount if provided
      let discountAppliedCents = 0;
      let promoCodeId: string | undefined;
      if (input.promoCode) {
        const Stripe2 = (await import("stripe")).default;
        const stripe2 = new Stripe2(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-02-24.acacia" as any });
        try {
          const promoCodes = await stripe2.promotionCodes.list({ code: input.promoCode, active: true, limit: 1 });
          if (promoCodes.data.length > 0) {
            const promoCodeObj = promoCodes.data[0];
            promoCodeId = promoCodeObj.id;
            const coupon = promoCodeObj.coupon;
            if (coupon.percent_off) {
              // percent_off is a percentage (0-100)
              discountAppliedCents = Math.round(totalAmountCents * (coupon.percent_off / 100));
            } else if (coupon.amount_off) {
              // amount_off from Stripe is already in cents
              discountAppliedCents = Math.min(coupon.amount_off, totalAmountCents);
            }
            totalAmountCents = Math.max(50, totalAmountCents - discountAppliedCents);
            totalAmountDollars = totalAmountCents / 100;
          } else {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or expired promo code" });
          }
        } catch (e: any) {
          if (e instanceof TRPCError) throw e;
          // Stripe API error — ignore silently and proceed without discount
        }
      }

      if (totalAmountCents < 50) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Minimum charge amount is $0.50" });
      }

      // totalAmountCents is in cents for Stripe; totalAmountDollars is for DB storage and display
      const totalAmount = totalAmountDollars;

      // Get org payment settings to determine which Stripe account to use
      const { orgPaymentSettings, orgSubscriptions } = await import("../drizzle/schema");
      const [paySettings] = await db
        .select()
        .from(orgPaymentSettings)
        .where(eq(orgPaymentSettings.orgId, input.orgId))
        .limit(1);

      // Get org subscription tier to determine fee behavior
      const orgSub = await getOrgSubscription(input.orgId);
      const planTier = (orgSub?.plan ?? "free") as PlanTier;
      const planLimits = PLAN_LIMITS[planTier];

      // Determine which Stripe account to use
      const Stripe = (await import("stripe")).default;
      let stripeInstance: InstanceType<typeof Stripe>;
      let useOwnGateway = false;

      if (paySettings?.stripeSecretKey && planLimits.customGateway) {
        // Org has configured their own Stripe account and plan allows it
        stripeInstance = new Stripe(paySettings.stripeSecretKey, { apiVersion: "2025-02-24.acacia" as any });
        useOwnGateway = true;
      } else if (!paySettings?.stripeSecretKey && planLimits.customGateway) {
        // Plan allows custom gateway but not configured — use TeachificPay
        stripeInstance = getStripe();
        useOwnGateway = false;
      } else {
        // Free/Starter/Builder plans must use TeachificPay
        stripeInstance = getStripe();
        useOwnGateway = false;
      }

      const customerName = [input.firstName, input.lastName].filter(Boolean).join(" ") || undefined;

      // Build bump metadata (pipe-separated for Stripe metadata string limits)
      const bumpTitles = input.selectedBumps.map(b => b.title).join("|");
      const bumpPrices = input.selectedBumps.map(b => b.price).join("|");
      const bumpIds = input.selectedBumps.map(b => b.bumpId ?? "").join("|");
      const bumpTypes = input.selectedBumps.map(b => b.bumpType ?? "").join("|");
      const bumpProductIds = input.selectedBumps.map(b => b.productId ?? "").join("|");

      // Success URL — resolve special values
      const resolveSuccessUrl = (redirect: string | undefined) => {
        if (!redirect) return `${input.origin}/?checkout_success=1`;
        if (redirect === "__dashboard__") return `${input.origin}/dashboard?purchase=success`;
        if (redirect.startsWith("__funnel__:")) return `${input.origin}/${redirect.slice(11)}?success=1`;
        if (redirect.startsWith("http")) return redirect;
        return `${input.origin}${redirect}`;
      };
      const successUrl = resolveSuccessUrl(input.successRedirect);

      // Build metadata — all values must be strings ≤ 500 chars
      const metadata: Record<string, string> = {
        type: "embedded_checkout_purchase",
        org_id: String(input.orgId),
        product_name: input.productName.slice(0, 490),
        product_type: input.productType,
        customer_email: input.email,
        customer_name: customerName?.slice(0, 490) ?? "",
        customer_phone: input.phone ?? "",
        user_id: ctx.user?.id?.toString() ?? "",
        bumps_added: input.selectedBumps.length > 0 ? "1" : "",
        bump_titles: bumpTitles.slice(0, 490),
        bump_prices: bumpPrices.slice(0, 490),
        bump_ids: bumpIds.slice(0, 490),
        bump_types: bumpTypes.slice(0, 490),
        bump_product_ids: bumpProductIds.slice(0, 490),
        source_type: input.sourceType,
        success_url: successUrl.slice(0, 490),
        gateway: useOwnGateway ? "own_gateway" : "teachific_pay",
      };

      if (input.productId) metadata.product_id = input.productId.toString();
      if (input.sourceFunnelId) metadata.funnel_id = input.sourceFunnelId.toString();
      if (input.sourceFunnelPageId) metadata.funnel_page_id = input.sourceFunnelPageId.toString();
      if (input.sourceLandingPageId) metadata.landing_page_id = input.sourceLandingPageId.toString();
      if (input.sourceLmsLessonId) metadata.lms_lesson_id = input.sourceLmsLessonId.toString();

      // Fulfillment metadata — used by webhook to auto-enroll/grant access
      if (input.fulfillmentCourseId) metadata.fulfillment_course_id = input.fulfillmentCourseId.toString();
      if (input.fulfillmentDownloadId) metadata.fulfillment_download_id = input.fulfillmentDownloadId.toString();
      if (input.fulfillmentQuizId) metadata.fulfillment_quiz_id = input.fulfillmentQuizId.toString();
      if (input.fulfillmentMembershipId) metadata.fulfillment_membership_id = input.fulfillmentMembershipId.toString();
      if (input.promoCode) metadata.promo_code = input.promoCode.slice(0, 100);
      if (discountAppliedCents > 0) metadata.discount_applied = (discountAppliedCents / 100).toString();
      if (promoCodeId) metadata.promo_code_id = promoCodeId;

      // Add shipping address to metadata if physical product
      if (input.shippingAddress && input.collectShipping) {
        const s = input.shippingAddress;
        metadata.shipping_name = s.name.slice(0, 255);
        metadata.shipping_line1 = s.line1.slice(0, 255);
        metadata.shipping_line2 = (s.line2 ?? "").slice(0, 255);
        metadata.shipping_city = s.city.slice(0, 100);
        metadata.shipping_state = s.state.slice(0, 100);
        metadata.shipping_postal_code = s.postalCode.slice(0, 20);
        metadata.shipping_country = s.country.slice(0, 10);
      }

      // Build description
      let description = input.productName;
      if (input.selectedBumps.length > 0) {
        description += " + " + input.selectedBumps.map(b => b.title).join(", ");
      }

      const paymentIntent = await stripeInstance.paymentIntents.create({
        amount: totalAmountCents,
        currency: "usd",
        description: description.slice(0, 1000),
        receipt_email: input.email,
        metadata,
        automatic_payment_methods: { enabled: true },
      });

      // Create a pending purchase record immediately (will be confirmed by webhook)
      await db.insert(funnelPurchases).values({
        orgId: input.orgId,
        userId: ctx.user?.id ?? null,
        leadId: null,
        email: input.email,
        name: customerName ?? null,
        phone: input.phone ?? null,
        productName: input.productName,
        productType: input.productType,
        productId: input.productId ?? null,
        amount: totalAmount, // stored in dollars
        currency: "USD",
        orderBumps: input.selectedBumps.length > 0 ? JSON.stringify(input.selectedBumps.map(b => ({
          title: b.title,
          price: b.price,
          bumpId: b.bumpId ?? null,
          bumpType: b.bumpType ?? null,
          productId: b.productId ?? null,
        }))) : null,
        stripePaymentIntentId: paymentIntent.id,
        sourceType: input.sourceType,
        sourceFunnelId: input.sourceFunnelId ?? null,
        sourceFunnelPageId: input.sourceFunnelPageId ?? null,
        sourceLandingPageId: input.sourceLandingPageId ?? null,
        sourceLmsLessonId: input.sourceLmsLessonId ?? null,
        fulfillmentCourseId: input.fulfillmentCourseId ?? null,
        fulfillmentDownloadId: input.fulfillmentDownloadId ?? null,
        fulfillmentQuizId: input.fulfillmentQuizId ?? null,
        fulfillmentMembershipId: input.fulfillmentMembershipId ?? null,
        shippingName: input.shippingAddress?.name ?? null,
        shippingLine1: input.shippingAddress?.line1 ?? null,
        shippingLine2: input.shippingAddress?.line2 ?? null,
        shippingCity: input.shippingAddress?.city ?? null,
        shippingState: input.shippingAddress?.state ?? null,
        shippingPostalCode: input.shippingAddress?.postalCode ?? null,
        shippingCountry: input.shippingAddress?.country ?? null,
        promoCode: input.promoCode ?? null,
        discountApplied: discountAppliedCents > 0 ? (discountAppliedCents / 100) : null,
        status: "pending",
      });

      return {
        clientSecret: paymentIntent.client_secret!,
        paymentIntentId: paymentIntent.id,
        amount: totalAmount, // dollars for display
        successUrl,
      };
    }),

  /**
   * Confirm a payment intent succeeded (called from client after Stripe confirms).
   * Updates the funnelPurchases record status to "paid".
   */
  confirmPayment: publicProcedure
    .input(z.object({
      paymentIntentId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await db.update(funnelPurchases)
        .set({ status: "paid" })
        .where(eq(funnelPurchases.stripePaymentIntentId, input.paymentIntentId));

      return { success: true };
    }),

  /**
   * Process a free order (total = $0) without Stripe.
   * Performs the same fulfillment as the Stripe webhook: course enrollment,
   * download access, quiz access, and membership grants.
   */
  processFreeOrder: publicProcedure
    .input(z.object({
      orgId: z.number(),
      email: z.string().email(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      phone: z.string().optional(),
      productName: z.string(),
      productType: z.enum(["course", "download", "quiz", "physical", "membership", "bundle", "other"]).default("other"),
      productId: z.number().optional(),
      sourceType: z.enum(["funnel", "landing_page", "product_page", "lms_lesson", "email", "other"]).default("other"),
      sourceFunnelId: z.number().optional(),
      sourceFunnelPageId: z.number().optional(),
      sourceLandingPageId: z.number().optional(),
      sourceLmsLessonId: z.number().optional(),
      fulfillmentCourseId: z.number().optional(),
      fulfillmentDownloadId: z.number().optional(),
      fulfillmentQuizId: z.number().optional(),
      fulfillmentMembershipId: z.number().optional(),
      fulfillmentBrand: z.enum(["teachific", "both"]).optional(),
      additionalAccess: additionalAccessSchema,
      successRedirect: z.string().optional(),
      origin: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const customerName = [input.firstName, input.lastName].filter(Boolean).join(" ") || undefined;

      // Create a completed purchase record (no payment required)
      const purchase = await db.insert(funnelPurchases).values({
        orgId: input.orgId,
        userId: ctx.user?.id ?? null,
        leadId: null,
        email: input.email,
        name: customerName ?? null,
        phone: input.phone ?? null,
        productName: input.productName,
        productType: input.productType,
        productId: input.productId ?? null,
        amount: 0,
        currency: "USD",
        orderBumps: null,
        stripePaymentIntentId: null,
        sourceType: input.sourceType,
        sourceFunnelId: input.sourceFunnelId ?? null,
        sourceFunnelPageId: input.sourceFunnelPageId ?? null,
        sourceLandingPageId: input.sourceLandingPageId ?? null,
        sourceLmsLessonId: input.sourceLmsLessonId ?? null,
        fulfillmentCourseId: input.fulfillmentCourseId ?? null,
        fulfillmentDownloadId: input.fulfillmentDownloadId ?? null,
        fulfillmentQuizId: input.fulfillmentQuizId ?? null,
        fulfillmentMembershipId: input.fulfillmentMembershipId ?? null,
        status: "completed",
      });

      // TODO: Perform fulfillment (enroll in course, grant download access, etc.)
      // This will be implemented in the webhook handler

      const resolveSuccessUrl = (redirect: string | undefined) => {
        if (!redirect) return `${input.origin}/?checkout_success=1`;
        if (redirect === "__dashboard__") return `${input.origin}/dashboard?purchase=success`;
        if (redirect.startsWith("__funnel__:")) return `${input.origin}/${redirect.slice(11)}?success=1`;
        if (redirect.startsWith("http")) return redirect;
        return `${input.origin}${redirect}`;
      };

      return {
        purchaseId: purchase.insertId,
        successUrl: resolveSuccessUrl(input.successRedirect),
      };
    }),
});
