/**
 * blueprintPurchaseRouter.ts
 *
 * Handles paid blueprint purchases via Stripe Checkout.
 * Flow:
 *   1. createCheckoutSession — creates a Stripe Checkout Session for a paid blueprint
 *   2. Stripe webhook (blueprintPurchaseWebhook.ts) — fulfills on checkout.session.completed
 *   3. verifyPurchase — called by frontend after redirect to confirm access
 *   4. listPurchases — lists all blueprint purchases for the current org
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getStripe } from "../stripePlans";
import { ENV } from "../_core/env";

async function getDb() {
  const { getDb: _getDb } = await import("../db");
  const db = await _getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  return db;
}

async function getOrgContext(userId: number) {
  const db = await getDb();
  const { orgMembers, organizations } = await import("../../drizzle/schema");
  const rows = await db
    .select({ orgId: orgMembers.orgId, role: orgMembers.role, orgName: organizations.name })
    .from(orgMembers)
    .innerJoin(organizations, eq(organizations.id, orgMembers.orgId))
    .where(eq(orgMembers.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

export const blueprintPurchaseRouter = router({
  // ── Create Stripe Checkout Session for a paid blueprint ───────────────────
  createCheckoutSession: protectedProcedure
    .input(z.object({
      blueprintId: z.number(),
      referralLinkId: z.number().optional(),
      origin: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ENV.stripeSecretKey) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Stripe not configured" });
      }

      const db = await getDb();
      const { blueprints, blueprintVersions, blueprintPurchases, blueprintReferralLinks } = await import("../../drizzle/schema");

      // Load blueprint
      const [bp] = await db.select().from(blueprints).where(eq(blueprints.id, input.blueprintId)).limit(1);
      if (!bp) throw new TRPCError({ code: "NOT_FOUND", message: "Blueprint not found" });
      if (bp.status !== "published") throw new TRPCError({ code: "BAD_REQUEST", message: "Blueprint is not published" });
      if (bp.pricingType === "free" || !bp.price) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This blueprint is free — use the install endpoint instead" });
      }

      const orgCtx = await getOrgContext(ctx.user.id);
      if (!orgCtx) throw new TRPCError({ code: "FORBIDDEN", message: "No organization found" });

      // Check if already purchased
      const [existing] = await db
        .select()
        .from(blueprintPurchases)
        .where(and(
          eq(blueprintPurchases.blueprintId, input.blueprintId),
          eq(blueprintPurchases.buyerOrgId, orgCtx.orgId),
          eq(blueprintPurchases.accessStatus, "active"),
        ))
        .limit(1);
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "You have already purchased this blueprint" });
      }

      // Get latest version
      const [latestVersion] = await db
        .select()
        .from(blueprintVersions)
        .where(eq(blueprintVersions.blueprintId, input.blueprintId))
        .orderBy(desc(blueprintVersions.createdAt))
        .limit(1);
      if (!latestVersion) throw new TRPCError({ code: "BAD_REQUEST", message: "Blueprint has no published version" });

      // Validate referral link if provided
      let referralLinkSlug: string | null = null;
      if (input.referralLinkId) {
        const [link] = await db
          .select()
          .from(blueprintReferralLinks)
          .where(and(
            eq(blueprintReferralLinks.id, input.referralLinkId),
            eq(blueprintReferralLinks.blueprintId, input.blueprintId),
            eq(blueprintReferralLinks.isActive, true),
          ))
          .limit(1);
        if (link) referralLinkSlug = link.slug;
      }

      const priceInCents = Math.round(parseFloat(String(bp.price)) * 100);
      const stripe = getStripe();

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: (bp.currency ?? "usd").toLowerCase(),
            product_data: {
              name: bp.title,
              description: bp.shortDescription ?? undefined,
              images: bp.thumbnailUrl ? [bp.thumbnailUrl] : undefined,
            },
            unit_amount: priceInCents,
          },
          quantity: 1,
        }],
        customer_email: ctx.user.email ?? undefined,
        client_reference_id: String(ctx.user.id),
        metadata: {
          type: "blueprint_purchase",
          blueprint_id: String(bp.id),
          blueprint_version_id: String(latestVersion.id),
          buyer_user_id: String(ctx.user.id),
          buyer_org_id: String(orgCtx.orgId),
          buyer_email: ctx.user.email ?? "",
          buyer_name: ctx.user.name ?? "",
          referral_link_id: input.referralLinkId ? String(input.referralLinkId) : "",
          referral_link_slug: referralLinkSlug ?? "",
        },
        success_url: `${input.origin}/blueprints/purchase-success?session_id={CHECKOUT_SESSION_ID}&blueprint_id=${bp.id}`,
        cancel_url: `${input.origin}/blueprints/marketplace?cancelled=1`,
      });

      return { url: session.url, sessionId: session.id };
    }),

  // ── Verify purchase after Stripe redirect ─────────────────────────────────
  verifyPurchase: protectedProcedure
    .input(z.object({
      blueprintId: z.number(),
      stripeSessionId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      const { blueprintPurchases } = await import("../../drizzle/schema");
      const orgCtx = await getOrgContext(ctx.user.id);
      if (!orgCtx) return { hasPurchase: false, purchase: null };

      const [purchase] = await db
        .select()
        .from(blueprintPurchases)
        .where(and(
          eq(blueprintPurchases.blueprintId, input.blueprintId),
          eq(blueprintPurchases.buyerOrgId, orgCtx.orgId),
          eq(blueprintPurchases.accessStatus, "active"),
        ))
        .limit(1);

      return { hasPurchase: !!purchase, purchase: purchase ?? null };
    }),

  // ── List all blueprint purchases for the current org ─────────────────────
  listPurchases: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      const { blueprintPurchases, blueprints } = await import("../../drizzle/schema");
      const orgCtx = await getOrgContext(ctx.user.id);
      if (!orgCtx) return [];

      const rows = await db
        .select({
          id: blueprintPurchases.id,
          blueprintId: blueprintPurchases.blueprintId,
          blueprintTitle: blueprints.title,
          blueprintSlug: blueprints.slug,
          blueprintThumbnail: blueprints.thumbnailUrl,
          purchasePrice: blueprintPurchases.purchasePrice,
          currency: blueprintPurchases.currency,
          accessStatus: blueprintPurchases.accessStatus,
          purchasedAt: blueprintPurchases.purchasedAt,
        })
        .from(blueprintPurchases)
        .innerJoin(blueprints, eq(blueprints.id, blueprintPurchases.blueprintId))
        .where(eq(blueprintPurchases.buyerOrgId, orgCtx.orgId))
        .orderBy(desc(blueprintPurchases.purchasedAt));

      return rows;
    }),

  // ── Check if org has access to a specific blueprint (free or purchased) ───
  checkAccess: protectedProcedure
    .input(z.object({ blueprintId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      const { blueprints, blueprintPurchases } = await import("../../drizzle/schema");
      const orgCtx = await getOrgContext(ctx.user.id);
      if (!orgCtx) return { hasAccess: false, reason: "no_org" };

      const [bp] = await db.select().from(blueprints).where(eq(blueprints.id, input.blueprintId)).limit(1);
      if (!bp) return { hasAccess: false, reason: "not_found" };

      // Free blueprints — access based on plan tier (handled separately by blueprintRouter)
      if (bp.pricingType === "free") return { hasAccess: true, reason: "free" };

      // Paid — check for active purchase
      const [purchase] = await db
        .select()
        .from(blueprintPurchases)
        .where(and(
          eq(blueprintPurchases.blueprintId, input.blueprintId),
          eq(blueprintPurchases.buyerOrgId, orgCtx.orgId),
          eq(blueprintPurchases.accessStatus, "active"),
        ))
        .limit(1);

      if (purchase) return { hasAccess: true, reason: "purchased" };
      return { hasAccess: false, reason: "not_purchased", price: bp.price, currency: bp.currency, pricingType: bp.pricingType };
    }),
});
