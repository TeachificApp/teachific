import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routerSource = readFileSync(new URL("./routers/productsRouter.ts", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../client/src/pages/lms/PublicPhysicalProductSalesPage.tsx", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");

function publicRouterSlice() {
  return routerSource.slice(
    routerSource.indexOf("export const productsPublicRouter"),
    routerSource.indexOf("// ─── Learner / Buyer Router"),
  );
}

describe("Course360 public physical storefront", () => {
  it("resolves published products from the verified request organization", () => {
    const source = publicRouterSlice();

    expect(source).toContain("resolvePublicOrganizationScope(db as any, ctx.req, input?.orgSlug)");
    expect(source).toContain("resolvePublicOrganizationScope(db as any, ctx.req, input.orgSlug)");
    expect(source).toContain("eq(physicalProducts.orgId, publicScope.id)");
    expect(source).toContain("eq(physicalProducts.status, \"published\")");
    expect(source).toContain("eq(organizations.id, publicScope.id)");
    expect(source).not.toContain("getPrimaryOrgId()");
  });

  it("requires both active organization context and active-org administration for previews", () => {
    const source = publicRouterSlice();

    expect(source).toContain("const activeOrgId = await getOrgIdForUserWithFallback");
    expect(source).toContain("if (activeOrgId === publicScope.id)");
    expect(source).toContain("await requireOrgAdmin(ctx.user.id, ctx.user.role, publicScope.id)");
    expect(source).toContain("if (product.status !== \"published\" && !canPreview)");
  });

  it("uses native checkout and organization branding without rendering untrusted HTML", () => {
    expect(pageSource).toContain("trpc.productsLearner.createCheckout.useMutation");
    expect(pageSource).toContain("trpc.productsPublic.getBySlug.useQuery");
    expect(pageSource).toContain("getSubdomain() ?? undefined");
    expect(pageSource).toContain("parseLandingBlocks(product?.landingBlocks)");
    expect(pageSource).toContain("htmlToPlainText");
    expect(pageSource).toContain("Secure checkout is provided by Stripe");
    expect(pageSource).not.toContain("dangerouslySetInnerHTML");
    expect(pageSource).not.toContain("window.open(");
    expect(appSource).toContain('path="/product/:slug" component={PublicPhysicalProductSalesPage}');
    expect(appSource).toContain('path="/products/:slug" component={PublicPhysicalProductSalesPage}');
  });
});
