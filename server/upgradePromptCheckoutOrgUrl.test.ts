import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Course360 upgrade-prompt checkout return URLs", () => {
  it("derives course, download, and physical product returns from trusted organization records", () => {
    const routerSource = readFileSync(new URL("./routers/lmsRouter.ts", import.meta.url), "utf8");
    const start = routerSource.indexOf("upgradePromptCheckout: protectedProcedure");
    const procedure = routerSource.slice(start, routerSource.indexOf("/** Accept group seat invite */", start));
    const blockPreviewSource = readFileSync(new URL("../client/src/components/BlockPreview.tsx", import.meta.url), "utf8");
    const checkoutStart = blockPreviewSource.indexOf("const createCheckout = trpc.lmsLearner.upgradePromptCheckout.useMutation();");
    const checkoutCall = blockPreviewSource.slice(checkoutStart, blockPreviewSource.indexOf("if (result.checkoutUrl)", checkoutStart));

    expect(procedure).toContain("const resolveOrganizationBaseUrl = async (organizationId: number)");
    expect(procedure).toContain("const createScopedDiscount = async (target:");
    expect(procedure).toContain("eq(coupons.orgId, target.orgId)");
    expect(procedure).toContain("couponIsRedeemableForCheckout(coupon, target)");
    expect(procedure).toContain('contentType: "course",');
    expect(procedure).toContain('contentType: "download",');
    expect(procedure).toContain('contentType: "physical_product",');
    expect(procedure).toContain("const organizationBaseUrl = await resolveOrganizationBaseUrl(course.orgId);");
    expect(procedure).toContain("const organizationBaseUrl = await resolveOrganizationBaseUrl(product.orgId);");
    expect(procedure).toContain("success_url: `${organizationBaseUrl}/courses/${encodeURIComponent(course.slug)}?success=1`");
    expect(procedure).toContain("success_url: `${organizationBaseUrl}/downloads/${encodeURIComponent(product.slug)}/files?success=1`");
    expect(procedure).toContain("success_url: `${organizationBaseUrl}/product/${encodeURIComponent(product.slug)}?success=1`");
    expect(procedure).not.toContain("const origin = input.origin");
    expect(procedure).not.toContain("origin: z.string()");
    expect(procedure).not.toContain("stripe.promotionCodes.list");
    expect(procedure).not.toContain("allow_promotion_codes: true");
    expect(checkoutCall).not.toContain("origin: window.location.origin");
  });
});
