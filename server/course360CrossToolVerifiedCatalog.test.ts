import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { course360CrossToolPriceId, COURSE360_CROSS_TOOL_VERIFIED_LIVE_PRICE_IDS } from "./lib/course360CrossToolVerifiedCatalog";
import { crossToolPriceIds } from "./lib/course360CrossToolCatalog";
import { COURSE360_CROSS_TOOL_OFFERS } from "../shared/course360CrossToolOffers";

const slots = Object.keys(COURSE360_CROSS_TOOL_VERIFIED_LIVE_PRICE_IDS);
describe("verified package catalog configuration", () => {
  it.each([undefined, "development", "test", "Production"])("does not adopt live IDs in %s", NODE_ENV => {
    expect(crossToolPriceIds({ NODE_ENV })).toEqual(Object.fromEntries(slots.map(slot => [slot, ""])));
  });
  it("uses exactly four distinct independently verified non-secret price IDs in production", () => {
    const ids = crossToolPriceIds({ NODE_ENV: "production" });
    expect(ids).toEqual(COURSE360_CROSS_TOOL_VERIFIED_LIVE_PRICE_IDS);
    expect(new Set(Object.values(ids)).size).toBe(4);
    expect(Object.values(ids).every(id => /^price_[A-Za-z0-9]+$/.test(id))).toBe(true);
    expect(Object.isFrozen(COURSE360_CROSS_TOOL_VERIFIED_LIVE_PRICE_IDS)).toBe(true);
  });
  it("retains an explicit environment override without mutating configuration", () => {
    const env = Object.freeze({ NODE_ENV: "production", COURSE360_CROSS_TOOL_BUILDER_CREATOR_WEB_MONTHLY_PRICE_ID: "  price_ownerOverride  " });
    expect(course360CrossToolPriceId(env, "builder_creator_web", "monthly")).toBe("price_ownerOverride");
    expect(env.COURSE360_CROSS_TOOL_BUILDER_CREATOR_WEB_MONTHLY_PRICE_ID).toBe("  price_ownerOverride  ");
  });
  it.each(["", " ", "not_a_price", "price_wrongAccount"])("does not replace explicit %s override with live fallback", value => {
    expect(crossToolPriceIds({ NODE_ENV: "production", COURSE360_CROSS_TOOL_PRO_CREATOR_WEB_ANNUAL_PRICE_ID: value }).pro_creator_web_annual).toBe(value.trim());
  });
  it("keeps the exact dollar values including the approved Pro annual 2497.00", () => {
    expect(COURSE360_CROSS_TOOL_OFFERS.builder_creator_web).toMatchObject({ monthly: 169.97, annual: 1599.97, schoolPlan: "builder", creatorMode: "web" });
    expect(COURSE360_CROSS_TOOL_OFFERS.pro_creator_web).toMatchObject({ monthly: 249.97, annual: 2497, schoolPlan: "pro", creatorMode: "web" });
  });
  it("uses the verified configuration through the actual catalog and still requires bootstrap plus live price validation", () => {
    const source = readFileSync(new URL("./lib/course360CrossToolCatalog.ts", import.meta.url), "utf8");
    expect(source).toContain("course360CrossToolPriceId(env");
    expect(source).toContain('getCourse360PaymentBootstrapStatus().state === "ready"');
    expect(source).toContain("assertCourse360CrossToolPrice(price, offer, interval, id, true)");
    expect(source).not.toMatch(/products\.create|prices\.create/);
  });
  it("does not strip retained Builder/Pro Studio school-plan inclusion for a Creator package", () => {
    const source = readFileSync(new URL("./lib/course360AppCapabilities.ts", import.meta.url), "utf8");
    expect(source).toContain('["builder", "pro", "enterprise"].includes(school.plan)');
    expect(source).not.toContain("isCourse360CrossToolSchoolSubscription");
  });
});
