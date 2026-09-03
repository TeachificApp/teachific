import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Course360 digital-bundle checkout return URLs", () => {
  it("uses the selected bundle's trusted organization record rather than the request origin", () => {
    const source = readFileSync(new URL("./routers/downloadsRouter.ts", import.meta.url), "utf8");
    const start = source.indexOf("createBundleCheckout: protectedProcedure");
    const procedure = source.slice(start, source.indexOf("/** List published bundles */", start));

    expect(source).toContain('import { getOrgBaseUrl } from "../lib/orgUrl";');
    expect(procedure).toContain("const organizationBaseUrl = getOrgBaseUrl(");
    expect(procedure).toContain("success_url: `${organizationBaseUrl}/my-downloads?success=1`");
    expect(procedure).toContain("cancel_url: `${organizationBaseUrl}/bundles/${encodeURIComponent(bundle.slug)}`");
    expect(procedure).not.toContain("const origin = ctx.req.headers.origin");
    expect(procedure).not.toContain("success_url: `${origin}/my-downloads?success=1`");
  });
});
