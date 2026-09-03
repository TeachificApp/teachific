import { describe, expect, it, vi } from "vitest";
import { organizations, orgPaymentSettings, orgSubscriptions } from "../drizzle/schema";

const getDb = vi.hoisted(() => vi.fn());
const getDigitalProduct = vi.hoisted(() => vi.fn());
const listProductPrices = vi.hoisted(() => vi.fn());
const createDigitalOrder = vi.hoisted(() => vi.fn());
const Stripe = vi.hoisted(() => vi.fn());

vi.mock("./db", () => ({ getDb }));
vi.mock("./lmsDb", () => ({
  getOrgSubscription: vi.fn(),
  upsertOrgSubscription: vi.fn(),
  getDigitalProduct,
  listProductPrices,
  createDigitalOrder,
}));
vi.mock("./stripePlans", () => ({
  getStripe: vi.fn(),
  STRIPE_PRICE_IDS: {},
  PLAN_LIMITS: { builder: { transactionFeePercent: 1 } },
}));
vi.mock("stripe", () => ({ default: Stripe }));

import { stripeRouter } from "./stripeRouter";

function createDb() {
  const responses = [
    [{ slug: "academy", customDomain: "learn.academy.example.test", domainVerificationStatus: "verified" }],
    [{ stripeSecretKey: "test-owned-stripe-key" }],
    [{ plan: "builder" }],
  ];
  const chain = {
    from: () => chain,
    where: () => chain,
    limit: () => Promise.resolve(responses.shift() ?? []),
  };
  return { select: vi.fn(() => chain) };
}

describe("Course360 public digital-product checkout scope", () => {
  it("derives Stripe payment ownership and return URLs from the selected product rather than caller-supplied organization or origin values", async () => {
    const checkoutCreate = vi.fn().mockResolvedValue({ id: "checkout_1", url: "https://checkout.stripe.test/session" });
    Stripe.mockImplementation(function () {
      return { checkout: { sessions: { create: checkoutCreate } } };
    });
    getDb.mockResolvedValue(createDb());
    getDigitalProduct.mockResolvedValue({
      id: 41,
      orgId: 7,
      slug: "digital-course-kit",
      title: "Digital Course Kit",
      description: "Organization-owned download",
      thumbnailUrl: null,
      defaultAccessDays: null,
      defaultMaxDownloads: null,
    });
    listProductPrices.mockResolvedValue([{ id: 8, amount: "20.50", currency: "USD" }]);
    createDigitalOrder.mockResolvedValue({ id: 9 });

    const caller = stripeRouter.createCaller({} as any);
    await expect(caller.createCourseCheckout({
      productId: 41,
      priceId: 8,
      buyerEmail: "buyer@example.test",
      buyerName: "Buyer",
      orgId: 999,
      origin: "https://attacker.example.test",
    } as any)).resolves.toMatchObject({ orderId: 9, checkoutUrl: "https://checkout.stripe.test/session" });

    expect(createDigitalOrder).toHaveBeenCalledWith(expect.objectContaining({ orgId: 7, productId: 41, priceId: 8 }));
    expect(checkoutCreate).toHaveBeenCalledWith(expect.objectContaining({
      success_url: "https://learn.academy.example.test/shop/digital-course-kit?order_id=9&session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://learn.academy.example.test/shop/digital-course-kit",
      metadata: expect.objectContaining({ teachific_org_id: "7", teachific_product_id: "41" }),
      line_items: [expect.objectContaining({ price_data: expect.objectContaining({ unit_amount: 2050 }) })],
    }));
    expect(JSON.stringify(checkoutCreate.mock.calls)).not.toContain("attacker.example.test");
    expect(JSON.stringify(checkoutCreate.mock.calls)).not.toContain("999");
  });
});
