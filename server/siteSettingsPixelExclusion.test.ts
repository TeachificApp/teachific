import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routerSource = readFileSync(new URL("./routers/siteSettingsRouter.ts", import.meta.url), "utf8");

describe("Course360 source-brand pixel exclusion", () => {
  it("removes the dormant source-branded pixel component", () => {
    expect(existsSync(new URL("../client/src/components/MetaPixel.tsx", import.meta.url))).toBe(false);
  });

  it("retains no public source-brand pixel setting API", () => {
    expect(routerSource).not.toMatch(/meta_pixel_id_(aaus|ihe|learn)/);
    expect(routerSource).not.toContain("getPixelIds");
    expect(routerSource).not.toContain("updatePixelId");
  });
});
