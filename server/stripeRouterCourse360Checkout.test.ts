import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(path.resolve(process.cwd(), "server/stripeRouter.ts"), "utf8");

describe("Course360 creator product checkout routes", () => {
  it("uses Course360 customer-facing checkout error copy while retaining stable product-type keys", () => {
    expect(source).toContain("Course360 Creator price not found");
    expect(source).toContain("Course360 Studio price not found");
    expect(source).toContain("Course360 Quiz Creator price not found");
    expect(source).not.toContain("TeachificCreator price not found");
    expect(source).toContain('product_type: "creator"');
    expect(source).toContain('product_type: "studio"');
    expect(source).toContain('product_type: "quiz_creator"');
  });

  it("routes each browser-origin return path through the protected return-origin resolver", () => {
    const creatorStart = source.indexOf("createCreatorSingleCheckout:");
    const creatorEnd = source.indexOf("createStudioSingleCheckout:", creatorStart);
    const creatorSource = source.slice(creatorStart, creatorEnd);

    expect(creatorSource).toContain("const returnOrigin = await resolveProductCheckoutReturnOrigin(input.origin, ctx.user.id);");
    expect(creatorSource).toContain('success_url: `${returnOrigin}/creator?upgraded=1`');
    expect(creatorSource).toContain('cancel_url: `${returnOrigin}/creator-pro`');
    expect(creatorSource).not.toContain("https://teachific");
  });
});
