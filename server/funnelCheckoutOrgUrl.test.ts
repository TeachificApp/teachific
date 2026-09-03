import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Course360 funnel checkout organization URLs", () => {
  it("resolves default funnel checkout redirects from the owning organization base URL", () => {
    const source = readFileSync(new URL("./routers/funnelRouter.ts", import.meta.url), "utf8");
    const checkoutSlice = source.slice(
      source.indexOf("createFunnelFormCheckout: publicProcedure"),
      source.indexOf("/** Create a PaymentIntent for inline Stripe Elements checkout"),
    );
    const inlineCheckoutSlice = source.slice(
      source.indexOf("createFunnelPaymentIntent: publicProcedure"),
      source.indexOf("submitLead: publicProcedure"),
    );

    expect(checkoutSlice).toContain("const organization = await getOrgById(funnel.orgId);");
    expect(checkoutSlice).toContain("const organizationBaseUrl = getOrgBaseUrl(");
    expect(checkoutSlice).toContain("`${organizationBaseUrl}/${funnel.slug}/${thankYouPage.slug}?success=1`");
    expect(checkoutSlice).toContain("`${organizationBaseUrl}/my-dashboard?purchase=success`");
    expect(checkoutSlice).toContain("`${organizationBaseUrl}/${redirect.slice(11)}?success=1`");
    expect(checkoutSlice).toContain("return redirect;");
    expect(checkoutSlice).toContain("const cancelUrl = `${organizationBaseUrl}/${funnel.slug}/${page.slug}`;");
    expect(checkoutSlice).toContain("sourcePage: `${organizationBaseUrl}/${funnel.slug}/${page.slug}`,");
    expect(checkoutSlice).not.toContain("const cancelUrl = `${input.origin}/${funnel.slug}/${page.slug}`;");
    expect(checkoutSlice).not.toContain("sourcePage: input.origin ? `${input.origin}/${funnel.slug}/${page.slug}` : null,");

    expect(inlineCheckoutSlice).toContain("const orgBaseUrl = getOrgBaseUrl(");
    expect(inlineCheckoutSlice).toContain("sourcePage: `${orgBaseUrl}/${funnel.slug}/${page.slug}`,");
    expect(inlineCheckoutSlice).not.toContain("sourcePage: input.origin ? `${input.origin}/${funnel.slug}/${page.slug}` : null,");
  });
});
