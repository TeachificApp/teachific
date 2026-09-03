import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Course360 individual-download checkout", () => {
  it("uses the selected product organization for returns and Course360 coupon metadata", () => {
    const source = readFileSync(new URL("./routers/downloadsRouter.ts", import.meta.url), "utf8");
    const start = source.indexOf("createCheckout: protectedProcedure");
    const procedure = source.slice(start, source.indexOf("/** Track a file download event */", start));

    expect(procedure).toContain("const organizationBaseUrl = getOrgBaseUrl(");
    expect(procedure).toContain("where(eq(organizations.id, product.orgId))");
    expect(procedure).toContain("success_url: `${organizationBaseUrl}/downloads/${encodeURIComponent(product.slug)}/files?success=1`");
    expect(procedure).toContain("cancel_url: `${organizationBaseUrl}/downloads/${encodeURIComponent(product.slug)}`");
    expect(procedure).toContain("name: `Course360 ${normalizedCode}`");
    expect(procedure).not.toContain("const origin = ctx.req.headers.origin");
    expect(procedure).not.toContain("name: `Teachific ${normalizedCode}`");
  });
});
