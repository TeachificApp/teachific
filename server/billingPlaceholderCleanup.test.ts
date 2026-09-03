import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Course360 billing surface", () => {
  it("uses the active profile billing route and excludes the unused static billing placeholder", () => {
    const appSource = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");

    expect(appSource).toContain('import BillingPage from "./pages/profile/BillingPage";');
    expect(appSource).toContain('<Route path="/billing" component={BillingPage} />');
    expect(existsSync(new URL("../client/src/pages/BillingPage.tsx", import.meta.url))).toBe(false);
  });
});
