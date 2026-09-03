import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Course360 course checkout organization URLs", () => {
  it("uses a trusted organization base URL for both signed-in and guest course checkout return paths", () => {
    const source = readFileSync(new URL("./routers/lmsRouter.ts", import.meta.url), "utf8");
    const signedInSlice = source.slice(source.indexOf("createCheckout: protectedProcedure"), source.indexOf("/** Guest checkout"));
    const guestSlice = source.slice(source.indexOf("guestCheckoutRegister: publicProcedure"), source.indexOf("// ── Instructor profile"));

    expect(source).toContain('import { getOrgBaseUrl } from "../lib/orgUrl";');
    for (const slice of [signedInSlice, guestSlice]) {
      expect(slice).toContain("const organizationBaseUrl = getOrgBaseUrl(");
      expect(slice).toContain("const coursePath = `/courses/${encodeURIComponent(course.slug)}`;");
      expect(slice).toContain("const successUrl = `${organizationBaseUrl}${coursePath}/success?session_id={CHECKOUT_SESSION_ID}`;");
      expect(slice).toContain("const cancelUrl = `${organizationBaseUrl}${coursePath}`;");
      expect(slice).not.toContain("const successUrl = `${input.origin}/courses/");
      expect(slice).not.toContain("const cancelUrl = `${input.origin}/courses/");
    }
  });
});
