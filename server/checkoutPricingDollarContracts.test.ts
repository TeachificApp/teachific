import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { dollarsToStripeCents } from "./lib/checkoutPricing";

const checkoutPricingSource = readFileSync(new URL("./lib/checkoutPricing.ts", import.meta.url), "utf8");

describe("Course360 decimal-dollar checkout pricing", () => {
  it.each([
    ["0", 0],
    ["0.01", 1],
    ["7.00", 700],
    ["99.97", 9997],
    ["299.97", 29997],
    ["2297.00", 229700],
    [39, 3900],
  ])("converts persisted decimal dollars %s to Stripe cents %i", (dollars, cents) => {
    expect(dollarsToStripeCents(dollars)).toBe(cents);
  });

  it("rejects malformed, negative, and over-precision amounts", () => {
    for (const price of ["-1.00", "1.001", "abc", "", null, undefined]) {
      expect(() => dollarsToStripeCents(price)).toThrow("Invalid decimal dollar price");
    }
  });

  it("uses the same conversion for catalog, embedded, and free-order validation", () => {
    expect(checkoutPricingSource).toContain("return dollarsToStripeCents(course.price ?? 0)");
    expect(checkoutPricingSource).toContain("return prod ? dollarsToStripeCents(prod.price ?? 0) : null");
    expect(checkoutPricingSource).toContain("assertClientPriceMatches(dollarsToStripeCents(input.productPrice), baseCents, \"product price\")");
    expect(checkoutPricingSource).toContain("dollarsToStripeCents(course.price ?? 0) === 0");
  });
});
