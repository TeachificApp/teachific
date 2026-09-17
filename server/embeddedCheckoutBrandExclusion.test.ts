import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./routers/embeddedCheckoutRouter.ts", import.meta.url), "utf8");

describe("Course360 embedded checkout source-brand exclusion", () => {
  it("does not accept or grant legacy source-project membership brands from a public checkout", () => {
    expect(source).not.toContain("brandMemberships");
    expect(source).not.toContain("fulfillmentBrand");
    expect(source).not.toContain("fulfillment_brand");
    expect(source).not.toContain('z.enum(["aaus", "iheartecho", "both"])');
    expect(source).not.toContain("../routes/autoLogin");
    expect(source).toContain('brandMode: "course360"');
  });
});
