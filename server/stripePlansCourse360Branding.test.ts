import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { COURSE360_PRICES, course360StripeCents } from "../shared/course360Pricing";

const source = fs.readFileSync(path.resolve(process.cwd(), "server/stripePlans.ts"), "utf8");

describe("Course360 Stripe subscription catalog", () => {
  it("uses Course360 customer-facing displays, stable internal keys and approved canonical prices", () => {
    expect(source).toContain('name: "Course360 Studio™ Web"');
    expect(source).toContain('name: "Course360 Creator™ Web"');
    expect(source).toContain('name: "Course360 Quiz Creator™ Web"');
    expect(source).not.toContain('name: "Teachific Studio™ Web"');
    expect(source).toContain('const productKey = `studio_${tier}`');
    expect(source).toContain('const productKey = `creator_${tier}`');
    expect(source).toContain('const productKey = `quiz_creator_${tier}`');
    expect(source).toContain('course360StripeCents(COURSE360_PRICES.studio_web.monthly)');
    expect(source).toContain('course360StripeCents(COURSE360_PRICES.creator_bundle.annual)');
    expect(course360StripeCents(COURSE360_PRICES.studio_web.monthly)).toBe(3997);
    expect(course360StripeCents(COURSE360_PRICES.creator_bundle.annual)).toBe(129997);
  });

  it("preserves product identity and prevents live reconciliation display mutations", () => {
    expect(source).toContain('async function syncStripeProductDisplay');
    expect(source).toContain('if (!allowWrites) return product;');
    expect(source).toContain('return stripe.products.update(product.id, { name: plan.name, description: plan.description });');
    expect(source).toMatch(/syncStripeProductDisplay\(\s*stripe,\s*product,\s*plan,\s*allowWrites\s*\)/);
    expect(source).toContain('metadata: { product_key: productKey');
  });
});
