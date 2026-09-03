import { describe, expect, it, vi } from "vitest";
import { coupons, lmsCourses, lmsPricingOptions } from "../drizzle/schema";

const getDb = vi.hoisted(() => vi.fn());
const Stripe = vi.hoisted(() => vi.fn());

vi.mock("./db", () => ({ getDb }));
vi.mock("stripe", () => ({ default: Stripe }));

import { lmsCheckoutLearnerRouter } from "./routers/lmsCheckoutRouter";

const course = {
  id: 41,
  orgId: 7,
  slug: "organization-course",
  title: "Organization Course",
  subtitle: null,
  description: null,
  coverImageUrl: null,
  thumbnailUrl: null,
  primaryColor: null,
  accentColor: null,
  pricingType: "one_time",
  price: "125.00",
  currency: "usd",
  isFree: false,
  subscriptionInterval: null,
  trialDays: null,
  stripePriceId: null,
  stripeProductId: null,
  status: "published",
  enrollmentClosed: false,
};

function createDbForCoupon(coupon: Record<string, unknown>) {
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
      if (table === lmsCourses) return Promise.resolve([course]);
      if (table === coupons) return Promise.resolve([coupon]);
      return Promise.resolve([]);
    },
    orderBy() {
      if (table === lmsPricingOptions) return Promise.resolve([]);
      return Promise.resolve([]);
    },
  };

  return { select: vi.fn(() => chain) };
}

describe("Course360 hosted checkout coupon scope", () => {
  it.each([
    [
      "belongs to another organization",
      { orgId: 8, targetScope: "all" },
    ],
    [
      "targets a different organization product",
      { orgId: 7, targetScope: "products", targetProducts: JSON.stringify([{ contentType: "course", productId: 42 }]) },
    ],
  ])("rejects a discount code that %s before Stripe coupon creation", async (_reason, scope) => {
    const stripeCouponsCreate = vi.fn();
    Stripe.mockImplementation(() => ({
      coupons: { create: stripeCouponsCreate },
      checkout: { sessions: { create: vi.fn() } },
    }));
    getDb.mockResolvedValue(createDbForCoupon({
      id: 9,
      code: "ORGONLY",
      isActive: true,
      expiresAt: null,
      maxUses: null,
      usedCount: 0,
      discountType: "percentage",
      discountValue: "10",
      appliesToCourseIds: null,
      targetContentTypes: null,
      ...scope,
    }));

    const caller = lmsCheckoutLearnerRouter.createCaller({
      user: { id: 101, email: "learner@example.test", role: "user" },
    } as any);

    await expect(caller.createHostedCheckoutSession({
      contentType: "course",
      slug: course.slug,
      origin: "https://academy.course360.app",
      promoCode: "orgonly",
    })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "This discount code is not available for this item.",
    });

    expect(stripeCouponsCreate).not.toHaveBeenCalled();
  });
});
