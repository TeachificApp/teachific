import { and, eq, sql } from "drizzle-orm";
import {
  digitalBundleItems,
  digitalBundlePurchases,
  digitalBundles,
  digitalProducts,
  digitalPurchases,
  lmsCourses,
  lmsEnrollments,
  orderBumpConversions,
  orderBumps,
} from "../../drizzle/schema";

type TriggerType = "course" | "download" | "quiz" | "bundle" | "workshop";
type BumpType = "course" | "download" | "quiz";

export type OrderBumpCheckoutLine = {
  lineItem: Record<string, unknown>;
  metadata: Record<string, string>;
  amount: number;
  requiresShipping: boolean;
};

export async function buildOrderBumpCheckoutLine(
  db: any,
  input: {
    orderBumpId?: number | null;
    triggerType: TriggerType;
    triggerProductId: number;
    currency: string;
  },
): Promise<OrderBumpCheckoutLine | null> {
  if (!input.orderBumpId) return null;
  if (input.triggerType !== "course" && input.triggerType !== "download" && input.triggerType !== "quiz") return null;

  const [bump] = await db
    .select()
    .from(orderBumps)
    .where(
      and(
        eq(orderBumps.id, input.orderBumpId),
        eq(orderBumps.triggerProductType, input.triggerType),
        eq(orderBumps.triggerProductId, input.triggerProductId),
        eq(orderBumps.placement, "before_checkout"),
        eq(orderBumps.isActive, true),
      ),
    )
    .limit(1);

  if (!bump) return null;

  const bumpType = bump.bumpProductType as BumpType;
  let name = bump.headline || "Order bump";
  let description = bump.description || undefined;
  let imageUrl = bump.imageUrl || undefined;
  let amount = bump.discountedPrice ? Number(bump.discountedPrice) : 0;

  if (bumpType === "download") {
    const [product] = await db.select().from(digitalProducts).where(eq(digitalProducts.id, bump.bumpProductId)).limit(1);
    if (product) {
      name = bump.headline || product.title;
      description = bump.description || product.subtitle || undefined;
      imageUrl = bump.imageUrl || product.thumbnailUrl || undefined;
      if (!amount) amount = product.price;
    }
  } else if (bumpType === "course") {
    const [course] = await db.select().from(lmsCourses).where(eq(lmsCourses.id, bump.bumpProductId)).limit(1);
    if (course) {
      name = bump.headline || course.title;
      description = bump.description || course.subtitle || undefined;
      if (!amount) amount = course.price;
    }
  }

  if (!amount || amount < 0) return null;

  return {
    amount,
    requiresShipping: false,
    lineItem: {
      price_data: {
        currency: input.currency,
        product_data: {
          name,
          description,
          images: imageUrl ? [imageUrl] : undefined,
          metadata: {
            order_bump_id: String(bump.id),
            order_bump_type: bumpType,
          },
        },
        unit_amount: Math.round(Number(amount) * 100),
      },
      quantity: 1,
    },
    metadata: {
      order_bump_id: String(bump.id),
      order_bump_type: bumpType,
      order_bump_product_id: String(bump.bumpProductId),
      order_bump_price: String(amount),
    },
  };
}

export async function fulfillOrderBumpPurchase(
  db: any,
  meta: Record<string, string>,
  input: {
    userId: number;
    sessionId: string;
    triggerOrderType: TriggerType;
    triggerOrderId?: number | null;
  },
) {
  const bumpId = meta.order_bump_id ? Number(meta.order_bump_id) : null;
  const bumpProductId = meta.order_bump_product_id ? Number(meta.order_bump_product_id) : null;
  const bumpType = meta.order_bump_type as BumpType | undefined;
  if (!bumpId || !bumpType) return;
  const [bump] = await db.select().from(orderBumps).where(eq(orderBumps.id, bumpId)).limit(1);
  if (!bump || bump.bumpProductType !== bumpType) return;

  if (bumpType === "download" && bumpProductId) {
    const [existing] = await db
      .select()
      .from(digitalPurchases)
      .where(and(eq(digitalPurchases.userId, input.userId), eq(digitalPurchases.productId, bumpProductId)))
      .limit(1);
    if (!existing) {
      await db.insert(digitalPurchases).values({
        userId: input.userId,
        productId: bumpProductId,
        stripeCheckoutSessionId: input.sessionId,
      });
    }
  } else if (bumpType === "course" && bumpProductId) {
    const [existing] = await db
      .select()
      .from(lmsEnrollments)
      .where(and(eq(lmsEnrollments.userId, input.userId), eq(lmsEnrollments.courseId, bumpProductId)))
      .limit(1);
    if (!existing) {
      await db.insert(lmsEnrollments).values({
        userId: input.userId,
        courseId: bumpProductId,
        affiliateCode: null,
      });
    }
  }

  const [existingConversion] = await db
    .select()
    .from(orderBumpConversions)
    .where(and(eq(orderBumpConversions.bumpId, bumpId), eq(orderBumpConversions.sessionId, input.sessionId)))
    .limit(1);
  if (existingConversion) return;

  await db.insert(orderBumpConversions).values({
    bumpId,
    orgId: bump.orgId,
    triggerOrderId: input.triggerOrderId ?? null,
    accepted: true,
    sessionId: input.sessionId,
  });
}
