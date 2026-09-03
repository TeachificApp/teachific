import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/pages/profile/BillingPage.tsx"),
  "utf8",
);

describe("Course360 Billing Page branding", () => {
  it("uses Course360 subscription copy and the platform support fallback", () => {
    expect(source).toContain("Manage your Course360 subscription and payment methods.");
    expect(source).toContain("mailto:support@course360.app");
    expect(source).not.toContain("Manage your Teachific subscription");
    expect(source).not.toContain("support@teachific.app");
  });
});
