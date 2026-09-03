import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(path.resolve(process.cwd(), "server/stripePlans.ts"), "utf8");

describe("Course360 Stripe subscription catalog", () => {
  it("uses Course360 customer-facing product displays while retaining stable internal product keys and price amounts", () => {
    expect(source).toContain('name: "Course360 Studio™ Web"');
    expect(source).toContain('name: "Course360 Creator™ Web"');
    expect(source).toContain('name: "Course360 Quiz Creator™ Web"');
    expect(source).not.toContain('name: "Teachific Studio™ Web"');
    expect(source).toContain('const productKey = `studio_${tier}`');
    expect(source).toContain('const productKey = `creator_${tier}`');
    expect(source).toContain('const productKey = `quiz_creator_${tier}`');
    expect(source).toContain('monthlyPrice: 3700, annualPrice: 29900');
    expect(source).toContain('monthlyPrice: 14900, annualPrice: 129900');
  });

  it("synchronizes existing Stripe product display values without replacing products or price identifiers", () => {
    expect(source).toContain('async function syncStripeProductDisplay');
    expect(source).toContain('return stripe.products.update(product.id, { name: plan.name, description: plan.description });');
    expect(source).toContain('product = await syncStripeProductDisplay(stripe, product, plan);');
    expect(source).toContain('metadata: { product_key: productKey');
  });
});
