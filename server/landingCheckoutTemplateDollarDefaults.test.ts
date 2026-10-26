import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const lmsBuilderSource = readFileSync(
  new URL("../client/src/pages/lms/LandingPageBuilder.tsx", import.meta.url),
  "utf8",
);
const adminBuilderSource = readFileSync(
  new URL("../client/src/pages/admin/LandingPageBuilder.tsx", import.meta.url),
  "utf8",
);

const legacyCentDefaults = ["price: 9700", "price: 99700", "price: 199700", "price: 29997", "price: 2700"];

describe("Course360 landing checkout template defaults", () => {
  it.each([
    ["LMS landing builder", lmsBuilderSource],
    ["administrative landing builder", adminBuilderSource],
  ])("keeps new %s checkout blocks dollar-denominated", (_name, source) => {
    for (const legacyValue of legacyCentDefaults) {
      expect(source).not.toContain(legacyValue);
    }

    expect(source).toContain("price: 997");
    expect(source).toContain("price: 1997");
    expect(source).toContain("price: 299.97");
    expect(source).toContain("price: 97");
    expect(source).toContain("price: 27");
    expect(source).toContain("price is stored in dollars");
  });

  it.each([
    ["LMS landing builder", lmsBuilderSource],
    ["administrative landing builder", adminBuilderSource],
  ])("uses Course360 terms defaults for new %s checkout blocks", (_name, source) => {
    expect(source).toContain('termsLinkUrl: "https://course360.app/terms"');
    expect(source).toContain('placeholder="https://course360.app/terms"');
    expect(source).not.toContain("teachific.com/terms-of-service.html");
  });
});
