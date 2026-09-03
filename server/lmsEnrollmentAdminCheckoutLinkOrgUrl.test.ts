import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Course360 enrollment-admin checkout links", () => {
  it("builds course checkout links from the trusted owning organization rather than the caller origin", () => {
    const source = readFileSync(new URL("./routers/lmsEnrollmentAdminRouter.ts", import.meta.url), "utf8");
    const checkoutLinksStart = source.indexOf("getCheckoutLinks: protectedProcedure");
    const checkoutLinksSlice = source.slice(
      checkoutLinksStart,
      source.indexOf("// ───", checkoutLinksStart),
    );

    expect(source).toContain('import { getOrgBaseUrl } from "../lib/orgUrl";');
    expect(checkoutLinksSlice).toContain("const organizationBaseUrl = getOrgBaseUrl(");
    expect(checkoutLinksSlice).toContain("const base = `${organizationBaseUrl}/courses/${encodeURIComponent(course.slug)}`;");
    expect(checkoutLinksSlice).not.toContain("const base = `${input.origin}/courses/${course.slug}`;");
  });
});
