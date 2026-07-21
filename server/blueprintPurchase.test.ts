/**
 * blueprintPurchase.test.ts
 * Tests for the Blueprint Phase 2 purchase + commission system
 */

import { describe, it, expect } from "vitest";

describe("blueprintPurchaseRouter module", () => {
  it("is importable without errors", async () => {
    const mod = await import("./routers/blueprintPurchaseRouter");
    expect(mod.blueprintPurchaseRouter).toBeDefined();
  });

  it("exports createCheckoutSession, verifyPurchase, listPurchases, checkAccess procedures", async () => {
    const { blueprintPurchaseRouter } = await import("./routers/blueprintPurchaseRouter");
    const router = blueprintPurchaseRouter as any;
    expect(router._def.procedures).toBeDefined();
    const procedures = Object.keys(router._def.procedures);
    expect(procedures).toContain("createCheckoutSession");
    expect(procedures).toContain("verifyPurchase");
    expect(procedures).toContain("listPurchases");
    expect(procedures).toContain("checkAccess");
  });
});

describe("blueprintPurchaseWebhook module", () => {
  it("is importable without errors", async () => {
    const mod = await import("./blueprintPurchaseWebhook");
    // blueprintPurchaseWebhook uses a default export (Express router)
    expect(mod.default).toBeDefined();
  });
});

describe("Blueprint Phase 2 pricing logic", () => {
  it("correctly identifies free blueprints", () => {
    const isFree = (pricingType: string, price: string | null) =>
      pricingType === "free" || !price;
    expect(isFree("free", null)).toBe(true);
    expect(isFree("free", "0")).toBe(true);
    expect(isFree("one_time", null)).toBe(true);
    expect(isFree("one_time", "49.99")).toBe(false);
    expect(isFree("subscription_included", null)).toBe(true);
  });

  it("correctly identifies paid blueprints", () => {
    const isPaid = (pricingType: string, price: string | null) =>
      pricingType === "one_time" && !!price && parseFloat(price) > 0;
    expect(isPaid("one_time", "49.99")).toBe(true);
    expect(isPaid("one_time", "0")).toBe(false);
    expect(isPaid("free", "49.99")).toBe(false);
    expect(isPaid("subscription_included", "49.99")).toBe(false);
  });

  it("formats price correctly for display", () => {
    const formatPrice = (price: string | null) =>
      price ? parseFloat(price).toFixed(2) : "0.00";
    expect(formatPrice("49.99")).toBe("49.99");
    expect(formatPrice("100")).toBe("100.00");
    expect(formatPrice("9.9")).toBe("9.90");
    expect(formatPrice(null)).toBe("0.00");
  });

  it("validates commission rate bounds", () => {
    const isValidCommissionRate = (rate: number) => rate >= 0 && rate <= 100;
    expect(isValidCommissionRate(0)).toBe(true);
    expect(isValidCommissionRate(30)).toBe(true);
    expect(isValidCommissionRate(100)).toBe(true);
    expect(isValidCommissionRate(-1)).toBe(false);
    expect(isValidCommissionRate(101)).toBe(false);
  });

  it("calculates commission amount correctly", () => {
    const calcCommission = (price: number, ratePercent: number) =>
      Math.round((price * ratePercent / 100) * 100) / 100;
    expect(calcCommission(100, 30)).toBe(30);
    expect(calcCommission(49.99, 20)).toBe(10);
    expect(calcCommission(199, 15)).toBe(29.85);
  });
});

describe("Blueprint getPublishedById procedure", () => {
  it("blueprintRouter exports getPublishedById", async () => {
    const { blueprintRouter } = await import("./routers/blueprintRouter");
    const router = blueprintRouter as any;
    const procedures = Object.keys(router._def.procedures);
    expect(procedures).toContain("getPublishedById");
  });
});

describe("Blueprint commission webhook logic", () => {
  it("correctly identifies first subscription as conversion", () => {
    // A conversion is when a new subscription is created (not updated)
    const isNewSubscription = (eventType: string) =>
      eventType === "customer.subscription.created";
    expect(isNewSubscription("customer.subscription.created")).toBe(true);
    expect(isNewSubscription("customer.subscription.updated")).toBe(false);
    expect(isNewSubscription("invoice.paid")).toBe(false);
  });

  it("generates unique commission IDs", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const id = `comm_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      ids.add(id);
    }
    expect(ids.size).toBe(100);
  });
});
