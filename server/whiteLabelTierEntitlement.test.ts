import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PLAN_LIMITS } from "./stripePlans";
import { getLimits, requiredPlanFor } from "../shared/tierLimits";

const organizationRouterSource = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
const landingPageSource = readFileSync(new URL("../client/src/pages/LandingPage.tsx", import.meta.url), "utf8");
const billingPageSource = readFileSync(new URL("../client/src/pages/profile/BillingPage.tsx", import.meta.url), "utf8");
const orgSettingsSource = readFileSync(new URL("../client/src/pages/OrgSettingsPage.tsx", import.meta.url), "utf8");

describe("white-label subscription entitlement", () => {
  it("starts at Pro in both shared and Stripe plan contracts", () => {
    expect(getLimits("builder").whiteLabel).toBe(false);
    expect(getLimits("pro").whiteLabel).toBe(true);
    expect(getLimits("enterprise").whiteLabel).toBe(true);
    expect(requiredPlanFor("whiteLabel")).toBe("pro");

    expect(PLAN_LIMITS.builder.whiteLabel).toBe(false);
    expect(PLAN_LIMITS.pro.whiteLabel).toBe(true);
    expect(PLAN_LIMITS.enterprise.whiteLabel).toBe(true);
  });

  it("renders white-label availability only for Pro and Enterprise across plan detail surfaces", () => {
    expect(landingPageSource).toContain('{ feature: "White-label branding", starter: false, builder: false, pro: true, enterprise: true }');
    expect(landingPageSource).not.toContain('"White-label branding",\n      "Stripe payments');
    expect(billingPageSource).toContain('"White-label branding",\n      "No transaction fees"');
  });

  it("fails closed for expired plans and resets legacy hidden-branding settings", () => {
    expect(organizationRouterSource).toContain('getEffectiveSubscriptionPlan(subscription.plan, subscription.status)');
    expect(organizationRouterSource).toContain('White-label branding requires an active Pro or Enterprise subscription.');
    expect(organizationRouterSource).toContain('updates.embedHideTeachificBranding = canWhiteLabel ? input.hideTeachificBranding : false;');
    expect(orgSettingsSource).toContain('const canWhiteLabel = ["pro", "enterprise"].includes(plan);');
    expect(orgSettingsSource).toContain('Upgrade to Pro or Enterprise to hide Course360 branding');
  });
});
