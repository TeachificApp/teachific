import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { physicalProductOrders, physicalProducts } from "../drizzle/schema";

const getDb = vi.hoisted(() => vi.fn());
const getOrCreateUserByEmail = vi.hoisted(() => vi.fn());
const fulfillBookvaultOrder = vi.hoisted(() => vi.fn());
const fulfillPrintfulOrder = vi.hoisted(() => vi.fn());
const fulfillPrintifyOrder = vi.hoisted(() => vi.fn());

vi.mock("./db", () => ({
  getDb,
  getUserByEmail: vi.fn(),
  getOrCreateUserByEmail,
}));
vi.mock("./lib/fulfillBookvaultOrder", () => ({ fulfillBookvaultOrder }));
vi.mock("./lib/fulfillPrintfulOrder", () => ({ fulfillPrintfulOrder }));
vi.mock("./lib/fulfillPrintifyOrder", () => ({ fulfillPrintifyOrder }));

import { fulfillNativePhysicalProductCheckout } from "./stripeWebhookRoutes";

const physicalProduct = {
  id: 31,
  orgId: 7,
  title: "Organization Physical Product",
  currency: "usd",
  bookvaultEnabled: true,
  printfulEnabled: false,
  printifyEnabled: false,
};

function createDb(existingOrder: { id: number } | null = null) {
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
      if (table === physicalProducts) return Promise.resolve([physicalProduct]);
      if (table === physicalProductOrders) return Promise.resolve(existingOrder ? [existingOrder] : []);
      return Promise.resolve([]);
    },
  };
  const values = vi.fn().mockResolvedValue([{ insertId: 91 }]);
  const insert = vi.fn(() => ({ values }));

  return { select: vi.fn(() => chain), insert, values };
}

function completedGuestSession() {
  return {
    id: "cs_native_physical_100",
    mode: "payment",
    amount_total: 0,
    currency: "usd",
    payment_intent: null,
    customer_email: "buyer@example.test",
    customer_details: {
      email: "buyer@example.test",
      name: "Buyer Example",
    },
    shipping_details: {
      name: "Buyer Example",
      address: {
        line1: "1 Shipping Lane",
        line2: "Suite 2",
        city: "Austin",
        state: "TX",
        postal_code: "78701",
        country: "US",
      },
    },
    metadata: {
      type: "physical_product",
      product_id: "31",
      org_id: "7",
      pricing_option_id: "",
      user_id: "",
      customer_email: "",
      internal_coupon_id: "10",
      internal_coupon_code: "FREESHIP",
    },
  };
}

describe("native physical-product Stripe completion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fulfillBookvaultOrder.mockResolvedValue({ submitted: true });
    fulfillPrintfulOrder.mockResolvedValue({ submitted: false, skipped: true });
    fulfillPrintifyOrder.mockResolvedValue({ submitted: false, skipped: true });
  });

  it("uses Course360 fulfillment identifiers and dollar-denominated Printful retail prices", () => {
    const printify = readFileSync(new URL("./lib/fulfillPrintifyOrder.ts", import.meta.url), "utf8");
    const printful = readFileSync(new URL("./lib/fulfillPrintfulOrder.ts", import.meta.url), "utf8");
    const bookvault = readFileSync(new URL("./lib/fulfillBookvaultOrder.ts", import.meta.url), "utf8");

    expect(printify).toContain("course360-ppo-");
    expect(printful).toContain("course360-ppo-");
    expect(printful).toContain("Number(product.price).toFixed(2)");
    expect(`${printify}\n${printful}\n${bookvault}`).toContain("orders@course360.app");
    expect(`${printify}\n${printful}`).not.toContain("aaus-ppo-");
    expect(`${printify}\n${printful}\n${bookvault}`).not.toContain("orders@teachific.app");
  });

  it("registers native physical checkout fulfillment before other payment handlers", () => {
    const webhook = readFileSync(new URL("./stripeWebhookRoutes.ts", import.meta.url), "utf8");
    const completedSessionHandler = webhook.slice(
      webhook.indexOf('case "checkout.session.completed"'),
      webhook.indexOf("// ── Course purchase", webhook.indexOf('case "checkout.session.completed"')),
    );

    expect(completedSessionHandler).toContain('session.metadata?.type === "physical_product"');
    expect(completedSessionHandler).toContain("await fulfillNativePhysicalProductCheckout(session)");
  });

  it("persists captured shipping and hands a guest 100%-discount checkout to the configured provider", async () => {
    const db = createDb();
    getDb.mockResolvedValue(db);
    getOrCreateUserByEmail.mockResolvedValue({
      user: { id: 101, email: "buyer@example.test", name: "Buyer Example" },
      isNew: true,
      resetToken: "not-exposed-to-checkout",
    });

    await fulfillNativePhysicalProductCheckout(completedGuestSession() as any);

    expect(getOrCreateUserByEmail).toHaveBeenCalledWith({
      email: "buyer@example.test",
      name: "Buyer Example",
    });
    expect(db.insert).toHaveBeenCalledWith(physicalProductOrders);
    expect(db.values).toHaveBeenCalledWith(expect.objectContaining({
      userId: 101,
      productId: 31,
      pricingOptionId: null,
      amountPaid: "0.00",
      currency: "usd",
      stripeCheckoutSessionId: "cs_native_physical_100",
      stripePaymentIntentId: null,
      shippingName: "Buyer Example",
      shippingLine1: "1 Shipping Lane",
      shippingLine2: "Suite 2",
      shippingCity: "Austin",
      shippingState: "TX",
      shippingPostalCode: "78701",
      shippingCountry: "US",
    }));
    expect(fulfillBookvaultOrder).toHaveBeenCalledWith(db, 91, {
      customerEmail: "buyer@example.test",
    });
    expect(fulfillPrintfulOrder).not.toHaveBeenCalled();
    expect(fulfillPrintifyOrder).not.toHaveBeenCalled();
  });

  it("does not create a duplicate order when Stripe retries a completed session", async () => {
    const db = createDb({ id: 91 });
    getDb.mockResolvedValue(db);
    getOrCreateUserByEmail.mockResolvedValue({
      user: { id: 101, email: "buyer@example.test", name: "Buyer Example" },
      isNew: false,
      resetToken: null,
    });

    await fulfillNativePhysicalProductCheckout(completedGuestSession() as any);

    expect(db.insert).not.toHaveBeenCalled();
    expect(fulfillBookvaultOrder).toHaveBeenCalledWith(db, 91, {
      customerEmail: "buyer@example.test",
    });
  });
});
