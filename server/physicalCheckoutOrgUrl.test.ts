import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Course360 physical product checkout organization URLs", () => {
  it("uses the purchased product organization for embedded Stripe returns and exposes completion on organization domains", () => {
    const routerSource = readFileSync(new URL("./routers/productsRouter.ts", import.meta.url), "utf8");
    const appSource = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");
    const physicalCheckoutSlice = routerSource.slice(
      routerSource.indexOf("createEmbeddedCheckoutSession: publicProcedure"),
      routerSource.indexOf("export const productsAdminRouter"),
    );
    const subdomainRouterSlice = appSource.slice(appSource.indexOf("function SubdomainSchoolRouter"));

    expect(routerSource).toContain('import { getOrgBaseUrl } from "../lib/orgUrl";');
    expect(physicalCheckoutSlice).toContain("const organizationBaseUrl = getOrgBaseUrl(");
    expect(physicalCheckoutSlice).toContain("return_url: `${organizationBaseUrl}/checkout/complete?session_id={CHECKOUT_SESSION_ID}&type=physical`");
    expect(physicalCheckoutSlice).not.toContain("return_url: `${input.origin}/checkout/complete");
    expect(subdomainRouterSlice).toContain('<Route path="/checkout/complete" component={CheckoutCompletePage} />');
  });
});
