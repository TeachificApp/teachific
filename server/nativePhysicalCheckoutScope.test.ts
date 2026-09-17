import { beforeEach, describe, expect, it, vi } from "vitest";
import { coupons, organizations, physicalProducts } from "../drizzle/schema";

const getDb = vi.hoisted(() => vi.fn());
const getStripeClient = vi.hoisted(() => vi.fn());

vi.mock("./db", () => ({ getDb }));
vi.mock("./lib/stripeClient", () => ({ getStripeClient }));

import { productsLearnerRouter } from "./routers/productsRouter";

const product = {
  id: 31,
  orgId: 7,
  slug: "organization-physical-product",
  title: "Organization Physical Product",
  subtitle: "A shipped product",
  thumbnailUrl: null,
  price: "49.00",
  currency: "usd",
  isFree: false,
  status: "published",
  checkoutMode: "native",
  shippingCountries: JSON.stringify(["US", "CA"]),
};

function createDbForCoupon(
  coupon: Record<string, unknown>,
  organization = {
    slug: "academy",
    customDomain: "learn.academy.example.test",
    domainVerificationStatus: "verified",
  },
) {
  let table: unknown;
  const chain = {
    from(nextTable: unknown) {
      table = nextTable;
      return chain;
    },
    where() {
      return chain;
    },
    limit() {
      if (table === physicalProducts) return Promise.resolve([product]);
      if (table === organizations) return Promise.resolve([organization]);
      if (table === coupons) return Promise.resolve([coupon]);
      return Promise.resolve([]);
    },
  };

  return { select: vi.fn(() => chain) };
}

function couponWith(scope: Record<string, unknown>) {
  return {
    id: 9,
    orgId: 7,
    code: "ORGONLY",
    isActive: true,
    expiresAt: null,
    maxUses: null,
    usedCount: 0,
    targetScope: "all",
    targetProducts: null,
    targetContentTypes: null,
    appliesToCourseIds: null,
    discountType: "percentage",
    discountValue: "10",
    ...scope,
  };
}

describe("Course360 native physical-product checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("derives returns and coupon eligibility from the selected product organization", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(new URL("./routers/productsRouter.ts", import.meta.url), "utf8");
    const start = source.indexOf("createCheckout: publicProcedure");
    const procedure = source.slice(start, source.indexOf("});\n\n// ─── Admin Router", start));

    expect(procedure).toContain("const organizationBaseUrl = getOrgBaseUrl(");
    expect(procedure).toContain("where(eq(organizations.id, product.orgId))");
    expect(procedure).toContain("eq(coupons.orgId, product.orgId)");
    expect(procedure).toContain('contentType: "physical_product",');
    expect(procedure).toContain("couponIsRedeemableForCheckout(coupon, {");
    expect(procedure).toContain("Math.round(Number(unitAmount) * 100)");
    expect(procedure).not.toContain("const priceCents =");
    expect(procedure).toContain("name: `Course360 ${normalizedCode}`");
    expect(procedure).toContain("internal_coupon_id");
    expect(procedure).toContain("shipping_address_collection:");
    expect(procedure).toContain("success_url: `${organizationBaseUrl}/product/${encodeURIComponent(product.slug)}?success=1`");
    expect(procedure).not.toContain("const origin = ctx.req.headers.origin");
    expect(procedure).not.toContain("stripe.promotionCodes.list");
    expect(procedure).not.toContain("allow_promotion_codes: true");
  });

  it.each([
    [
      "belongs to another organization",
      couponWith({ orgId: 8 }),
    ],
    [
      "targets a different physical product",
      couponWith({
        targetScope: "products",
        targetProducts: JSON.stringify([{ contentType: "physical_product", productId: 32 }]),
      }),
    ],
  ])("rejects a discount code that %s before Stripe calls", async (_reason, coupon) => {
    const stripeCouponsCreate = vi.fn();
    const stripeSessionsCreate = vi.fn();
    getStripeClient.mockReturnValue({
      coupons: { create: stripeCouponsCreate },
      checkout: { sessions: { create: stripeSessionsCreate } },
    });
    getDb.mockResolvedValue(createDbForCoupon(coupon));

    const caller = productsLearnerRouter.createCaller({ user: null } as any);

    await expect(caller.createCheckout({
      productId: product.id,
      promoCode: "orgonly",
    })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "This discount code is not available for this product.",
    });

    expect(stripeCouponsCreate).not.toHaveBeenCalled();
    expect(stripeSessionsCreate).not.toHaveBeenCalled();
  });

  it("keeps an anonymous 100% organization coupon in Stripe Checkout for shipping and fulfillment", async () => {
    const stripeCouponsCreate = vi.fn().mockResolvedValue({ id: "stripe_coupon_100" });
    const stripeSessionsCreate = vi.fn().mockResolvedValue({
      id: "checkout_100",
      url: "https://checkout.stripe.test/session-100",
    });
    getStripeClient.mockReturnValue({
      coupons: { create: stripeCouponsCreate },
      checkout: { sessions: { create: stripeSessionsCreate } },
    });
    getDb.mockResolvedValue(createDbForCoupon(couponWith({
      id: 10,
      code: "FREESHIP",
      discountValue: "100",
    })));

    const caller = productsLearnerRouter.createCaller({ user: null } as any);

    await expect(caller.createCheckout({
      productId: product.id,
      promoCode: "freeship",
    })).resolves.toEqual({
      checkoutUrl: "https://checkout.stripe.test/session-100",
      free: false,
    });

    expect(stripeCouponsCreate).toHaveBeenCalledWith({
      percent_off: 100,
      duration: "once",
      name: "Course360 FREESHIP",
    });
    expect(stripeSessionsCreate).toHaveBeenCalledWith(expect.objectContaining({
      mode: "payment",
      discounts: [{ coupon: "stripe_coupon_100" }],
      shipping_address_collection: { allowed_countries: ["US", "CA"] },
      success_url: "https://learn.academy.example.test/product/organization-physical-product?success=1",
      cancel_url: "https://learn.academy.example.test/product/organization-physical-product",
      metadata: expect.objectContaining({
        type: "physical_product",
        product_id: "31",
        org_id: "7",
        user_id: "",
        internal_coupon_id: "10",
        internal_coupon_code: "FREESHIP",
      }),
      line_items: [expect.objectContaining({
        price_data: expect.objectContaining({ unit_amount: 4900 }),
      })],
    }));
  });
});
