import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  env: {
    stripeSecretKey: "sk_test_mockOnly",
    stripePublishableKey: "pk_test_mockOnly",
    stripeWebhookSecret: "whsec_mockOnly",
    isProduction: false,
  },
  construct: vi.fn(),
  productsList: vi.fn(),
  productsCreate: vi.fn(),
  productsUpdate: vi.fn(),
  pricesList: vi.fn(),
  pricesCreate: vi.fn(),
}));
vi.mock("./_core/env", () => ({ ENV: state.env }));
vi.mock("stripe", () => ({
  default: class MockStripe {
    products = {
      list: state.productsList,
      create: state.productsCreate,
      update: state.productsUpdate,
    };
    prices = { list: state.pricesList, create: state.pricesCreate };
    constructor(...args: unknown[]) {
      state.construct(...args);
    }
  },
}));
import {
  ensureStripePlans,
  STRIPE_PRICE_IDS,
  matchesCourse360CatalogPrice,
  getStripe,
  getPlatformStripeSecretKey,
  getPlatformStripePublishableKey,
} from "./stripePlans";
const product = (id: string, key: string, tier?: string) => ({
  id,
  active: true,
  name: "Existing Course360",
  description: "Existing",
  metadata: tier ? { teachific_tier: tier } : { product_key: key },
});
const price = (
  id: string,
  amount: number,
  interval: string,
  key: string,
  value: string
) => ({
  id,
  active: true,
  currency: "usd",
  unit_amount: amount,
  billing_scheme: "per_unit",
  recurring: { interval, interval_count: 1, usage_type: "licensed" },
  metadata: { [key]: value },
});
const products = [
  product("starter", "", "starter"),
  product("builder", "", "builder"),
  product("pro", "", "pro"),
  ...["studio", "creator", "quiz_creator"].flatMap(app =>
    ["web", "desktop", "bundle"].map(tier =>
      product(`${app}_${tier}`, `${app}_${tier}`)
    )
  ),
];
const amounts: Record<string, [number, number]> = {
  starter: [3997, 39997],
  builder: [9997, 99997],
  pro: [19997, 199997],
  studio_web: [3997, 29997],
  studio_desktop: [4997, 39997],
  studio_bundle: [6997, 59997],
  creator_web: [9997, 89997],
  creator_desktop: [11997, 99997],
  creator_bundle: [14997, 129997],
  quiz_creator_web: [3997, 29997],
  quiz_creator_desktop: [4997, 39997],
  quiz_creator_bundle: [6997, 59997],
};
beforeEach(() => {
  vi.clearAllMocks();
  state.env.isProduction = false;
  state.env.stripeSecretKey = "sk_test_mockOnly";
  state.env.stripePublishableKey = "pk_test_mockOnly";
  state.env.stripeWebhookSecret = "whsec_mockOnly";
  for (const key of Object.keys(STRIPE_PRICE_IDS)) delete STRIPE_PRICE_IDS[key];
  state.productsList.mockImplementation(async ({ starting_after }) =>
    starting_after
      ? { data: products, has_more: false }
      : { data: [product("unrelated", "unrelated")], has_more: true }
  );
  state.productsUpdate.mockImplementation(async (id, display) => ({
    ...products.find(p => p.id === id),
    ...display,
  }));
  state.pricesList.mockImplementation(
    async ({ product: id, starting_after }) => {
      const metaKey = ["starter", "builder", "pro"].includes(id)
        ? "teachific_tier"
        : "product_key";
      const [monthly, annual] = amounts[id];
      if (!starting_after)
        return {
          has_more: true,
          data: [
            {
              ...price(`${id}_wrong`, monthly + 1, "month", metaKey, id),
              currency: "eur",
            },
            {
              ...price(`${id}_count3`, monthly, "month", metaKey, id),
              recurring: {
                interval: "month",
                interval_count: 3,
                usage_type: "licensed",
              },
            },
          ],
        };
      return {
        has_more: false,
        data: [
          price(`${id}_monthly_exact`, monthly, "month", metaKey, id),
          price(`${id}_annual_exact`, annual, "year", metaKey, id),
        ],
      };
    }
  );
  state.productsCreate.mockImplementation(async input => ({
    ...input,
    active: true,
    id: "new_product",
  }));
  state.pricesCreate.mockImplementation(async input => ({
    ...input,
    id: `${input.product}_${input.recurring.interval}_created`,
  }));
});
describe("Course360 catalog repairs (Stripe SDK fully mocked)", () => {
  it.each([
    { currency: "eur" },
    { unit_amount: 3800 },
    { active: false },
    { billing_scheme: "tiered" },
    {
      recurring: {
        interval: "month",
        interval_count: 3,
        usage_type: "licensed",
      },
    },
    {
      recurring: {
        interval: "year",
        interval_count: 1,
        usage_type: "licensed",
      },
    },
    {
      recurring: {
        interval: "month",
        interval_count: 1,
        usage_type: "metered",
      },
    },
    { metadata: { teachific_tier: "pro" } },
  ])("rejects malformed catalog price %j", wrong => {
    expect(
      matchesCourse360CatalogPrice(
        {
          ...price("p", 3997, "month", "teachific_tier", "starter"),
          ...wrong,
        } as any,
        3997,
        "month",
        "teachific_tier",
        "starter"
      )
    ).toBe(false);
  });
  it("selects exact USD prices on later product/price pages for all twelve products without creating or replacing prices", async () => {
    await ensureStripePlans();
    expect(Object.keys(STRIPE_PRICE_IDS)).toHaveLength(24);
    expect(STRIPE_PRICE_IDS.starter_monthly).toBe("starter_monthly_exact");
    expect(STRIPE_PRICE_IDS.quiz_creator_bundle_annual).toBe(
      "quiz_creator_bundle_annual_exact"
    );
    expect(state.productsList).toHaveBeenCalledWith({
      limit: 100,
      starting_after: "unrelated",
    });
    expect(state.pricesList).toHaveBeenCalledWith({
      product: "starter",
      limit: 100,
      starting_after: "starter_count3",
    });
    expect(state.productsCreate).not.toHaveBeenCalled();
    expect(state.pricesCreate).not.toHaveBeenCalled();
    await ensureStripePlans();
    expect(state.pricesCreate).not.toHaveBeenCalled();
  });
  it("live catalog reconciliation is read only including legacy display names", async () => {
    state.env.stripeSecretKey = "sk_live_mockOnly";
    state.env.stripePublishableKey = "pk_live_mockOnly";
    await ensureStripePlans();
    expect(state.productsUpdate).not.toHaveBeenCalled();
    expect(state.pricesCreate).not.toHaveBeenCalled();
    expect(STRIPE_PRICE_IDS.pro_annual).toBe("pro_annual_exact");
  });
  it("does not create missing live prices and does not publish a partial catalog", async () => {
    state.env.stripeSecretKey = "sk_live_mockOnly";
    state.env.stripePublishableKey = "pk_live_mockOnly";
    const list = state.pricesList.getMockImplementation()!;
    state.pricesList.mockImplementation(async input =>
      input.product === "builder" ? { data: [], has_more: false } : list(input)
    );
    await expect(ensureStripePlans()).rejects.toThrow("read-only");
    expect(state.pricesCreate).not.toHaveBeenCalled();
    expect(STRIPE_PRICE_IDS).toEqual({});
  });
  it("test-mode nonproduction setup creates only the existing advertised exact price when missing", async () => {
    const list = state.pricesList.getMockImplementation()!;
    state.pricesList.mockImplementation(async input =>
      input.product === "starter"
        ? {
            data: [price("annual", 39997, "year", "teachific_tier", "starter")],
            has_more: false,
          }
        : list(input)
    );
    await ensureStripePlans();
    expect(state.pricesCreate).toHaveBeenCalledTimes(1);
    expect(state.pricesCreate).toHaveBeenCalledWith({
      product: "starter",
      unit_amount: 3997,
      currency: "usd",
      recurring: { interval: "month" },
      metadata: { teachific_tier: "starter", interval: "monthly" },
    });
  });
  it("production test/missing credentials fail closed without catalog API calls or startup rejection", async () => {
    state.env.isProduction = true;
    await expect(ensureStripePlans()).resolves.toBeUndefined();
    expect(state.productsList).not.toHaveBeenCalled();
    expect(STRIPE_PRICE_IDS).toEqual({});
    expect(() => getStripe()).toThrow("unavailable");
  });
  it("missing secret performs no API calls", async () => {
    state.env.stripeSecretKey = "";
    await ensureStripePlans();
    expect(state.productsList).not.toHaveBeenCalled();
    expect(getPlatformStripeSecretKey()).toBe("");
  });
  it("returns fallback public key without exposing secret credentials", () => {
    expect(getPlatformStripePublishableKey()).toBe("pk_test_mockOnly");
  });
  it("detects nonadvancing pagination rather than hanging", async () => {
    state.productsList.mockResolvedValue({ data: [], has_more: true });
    await expect(ensureStripePlans()).rejects.toThrow(
      "pagination did not advance"
    );
    expect(state.pricesList).not.toHaveBeenCalled();
  });
});
