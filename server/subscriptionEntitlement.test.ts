import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  getEffectiveSubscriptionPlan,
  hasUsableSubscriptionStatus,
} from "../shared/subscriptionEntitlement";

const lmsRouterSource = readFileSync(new URL("./lmsRouter.ts", import.meta.url), "utf8");
const orgPlanSource = readFileSync(new URL("../client/src/hooks/useOrgPlan.ts", import.meta.url), "utf8");
const certificateSettingsSource = readFileSync(new URL("../client/src/pages/lms/CertificateSettingsTab.tsx", import.meta.url), "utf8");

describe("organization subscription entitlement", () => {
  it("retains paid plan entitlements only while Stripe reports active or trialing", () => {
    expect(hasUsableSubscriptionStatus("active")).toBe(true);
    expect(hasUsableSubscriptionStatus("trialing")).toBe(true);
    expect(hasUsableSubscriptionStatus("past_due")).toBe(false);
    expect(hasUsableSubscriptionStatus("unpaid")).toBe(false);
    expect(hasUsableSubscriptionStatus("cancelled")).toBe(false);
    expect(hasUsableSubscriptionStatus(undefined)).toBe(false);

    expect(getEffectiveSubscriptionPlan("starter", "trialing")).toBe("starter");
    expect(getEffectiveSubscriptionPlan("pro", "active")).toBe("pro");
    expect(getEffectiveSubscriptionPlan("enterprise", "past_due")).toBe("free");
    expect(getEffectiveSubscriptionPlan("builder", "unpaid")).toBe("free");
    expect(getEffectiveSubscriptionPlan("unknown", "active")).toBe("free");
  });

  it("returns and consumes the server-computed entitlement tier for organization UI gates", () => {
    expect(lmsRouterSource).toContain("effectivePlan: getEffectiveSubscriptionPlan(subscription.plan, subscription.status)");
    expect(orgPlanSource).toContain("effectivePlan?: PlanTier");
    expect(certificateSettingsSource).toContain("sub?.effectivePlan ?? sub?.plan ?? \"free\"");
  });
});
