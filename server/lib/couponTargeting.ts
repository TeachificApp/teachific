import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import {
  bundles,
  digitalProducts,
  lmsCourses,
  membershipPlans,
  memberships,
  physicalProducts,
  webinars,
  workshops,
} from "../../drizzle/schema";

export const COUPON_TARGET_CONTENT_TYPES = [
  "course",
  "download",
  "physical_product",
  "webinar",
  "membership",
  "membership_plan",
  "workshop",
  "bundle",
] as const;

export type CouponTargetContentType = typeof COUPON_TARGET_CONTENT_TYPES[number];
export type CouponTargetScope = "all" | "content_types" | "products";
export type CouponProductTarget = { contentType: CouponTargetContentType; productId: number };

function parseArray<T>(value: unknown, isItem: (item: unknown) => item is T): T[] {
  if (!value) return [];
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed.filter(isItem) : [];
  } catch {
    return [];
  }
}

function isContentType(value: unknown): value is CouponTargetContentType {
  return typeof value === "string" && (COUPON_TARGET_CONTENT_TYPES as readonly string[]).includes(value);
}

function isProductTarget(value: unknown): value is CouponProductTarget {
  return !!value
    && typeof value === "object"
    && isContentType((value as CouponProductTarget).contentType)
    && Number.isInteger((value as CouponProductTarget).productId)
    && (value as CouponProductTarget).productId > 0;
}

export function parseCouponTargetContentTypes(value: unknown): CouponTargetContentType[] {
  return [...new Set(parseArray(value, isContentType))];
}

export function parseCouponProductTargets(value: unknown): CouponProductTarget[] {
  const seen = new Set<string>();
  return parseArray(value, isProductTarget).filter((target) => {
    const key = `${target.contentType}:${target.productId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function couponAppliesToTarget(
  coupon: { targetScope?: unknown; targetContentTypes?: unknown; targetProducts?: unknown; appliesToCourseIds?: unknown },
  contentType: CouponTargetContentType,
  productId: number,
): boolean {
  const scope = coupon.targetScope as CouponTargetScope | undefined;
  if (scope === "content_types") return parseCouponTargetContentTypes(coupon.targetContentTypes).includes(contentType);
  if (scope === "products") {
    return parseCouponProductTargets(coupon.targetProducts)
      .some((target) => target.contentType === contentType && target.productId === productId);
  }

  // Coupons created before granular targets used this course-only JSON field.
  const legacyCourseIds = parseArray(coupon.appliesToCourseIds, (item): item is number => Number.isInteger(item) && item > 0);
  return contentType !== "course" || legacyCourseIds.length === 0 || legacyCourseIds.includes(productId);
}

export function couponIsRedeemableForTarget(
  coupon: {
    isActive: boolean;
    expiresAt?: Date | null;
    maxUses?: number | null;
    usedCount?: number | null;
    targetScope?: unknown;
    targetContentTypes?: unknown;
    targetProducts?: unknown;
    appliesToCourseIds?: unknown;
  },
  contentType: CouponTargetContentType,
  productId: number,
  now = new Date(),
): boolean {
  if (!coupon.isActive) return false;
  if (coupon.expiresAt && coupon.expiresAt <= now) return false;
  if (coupon.maxUses !== null && coupon.maxUses !== undefined && (coupon.usedCount ?? 0) >= coupon.maxUses) return false;
  return couponAppliesToTarget(coupon, contentType, productId);
}

const productTables: Record<CouponTargetContentType, { table: any; label: any }> = {
  course: { table: lmsCourses, label: lmsCourses.title },
  download: { table: digitalProducts, label: digitalProducts.title },
  physical_product: { table: physicalProducts, label: physicalProducts.title },
  webinar: { table: webinars, label: webinars.title },
  membership: { table: memberships, label: memberships.name },
  membership_plan: { table: membershipPlans, label: membershipPlans.name },
  workshop: { table: workshops, label: workshops.title },
  bundle: { table: bundles, label: bundles.name },
};

export async function assertCouponProductTargetsBelongToOrg(db: any, orgId: number, targets: CouponProductTarget[]) {
  for (const target of targets) {
    const { table } = productTables[target.contentType];
    const [product] = await db
      .select({ id: table.id })
      .from(table)
      .where(and(eq(table.id, target.productId), eq(table.orgId, orgId)))
      .limit(1);
    if (!product) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Each discount-code product must belong to the active organization.",
      });
    }
  }
}

export async function listCouponTargetableProducts(db: any, orgId: number) {
  const groups = await Promise.all(
    (Object.entries(productTables) as Array<[CouponTargetContentType, { table: any; label: any }]>).map(async ([contentType, { table, label }]) => {
      const rows = await db
        .select({ id: table.id, label })
        .from(table)
        .where(eq(table.orgId, orgId));
      return rows.map((row: { id: number; label: string | null }) => ({
        contentType,
        productId: row.id,
        label: row.label || `Untitled ${contentType.replace(/_/g, " ")}`,
      }));
    }),
  );
  return groups.flat();
}
