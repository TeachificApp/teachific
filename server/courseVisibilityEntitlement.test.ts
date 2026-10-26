import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canUseHiddenPrivateCourseVisibility } from "./lib/courseVisibilityEntitlement";

describe("Course360 restricted course visibility entitlement", () => {
  it("allows hidden and private visibility only for active Pro-or-higher subscriptions", () => {
    expect(canUseHiddenPrivateCourseVisibility("starter", "active")).toBe(false);
    expect(canUseHiddenPrivateCourseVisibility("builder", "trialing")).toBe(false);
    expect(canUseHiddenPrivateCourseVisibility("pro", "active")).toBe(true);
    expect(canUseHiddenPrivateCourseVisibility("enterprise", "trialing")).toBe(true);
  });

  it("fails closed for cancelled, past-due, missing, and unknown subscriptions", () => {
    expect(canUseHiddenPrivateCourseVisibility("pro", "past_due")).toBe(false);
    expect(canUseHiddenPrivateCourseVisibility("enterprise", "canceled")).toBe(false);
    expect(canUseHiddenPrivateCourseVisibility(undefined, undefined)).toBe(false);
    expect(canUseHiddenPrivateCourseVisibility("unknown", "active")).toBe(false);
  });

  it("enforces the same server-owned rule in active and legacy course settings routes", () => {
    const courseBuilder = readFileSync(new URL("./routers/lmsCourseBuilderRouter.ts", import.meta.url), "utf8");
    const legacyLms = readFileSync(new URL("./routers/lmsRouter.ts", import.meta.url), "utf8");

    expect(courseBuilder).toContain('input.status === "hidden" || input.status === "private"');
    expect(courseBuilder).toContain("canUseHiddenPrivateCourseVisibility(subscription?.plan, subscription?.status)");
    expect(courseBuilder).toContain("changingRestrictedVisibility");
    expect(legacyLms).toContain('input.status === "hidden" || input.status === "private"');
    expect(legacyLms).toContain("canUseHiddenPrivateCourseVisibility(subscription?.plan, subscription?.status)");
  });
});
