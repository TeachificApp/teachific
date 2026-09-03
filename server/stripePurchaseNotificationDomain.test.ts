import { describe, expect, it } from "vitest";
import { getOrgAdminPurchaseDashboardUrl } from "./stripeWebhookRoutes";

describe("Course360 Stripe purchase notification URLs", () => {
  it("uses the verified custom organization domain before the Course360 subdomain", () => {
    expect(getOrgAdminPurchaseDashboardUrl({
      slug: "academy",
      customDomain: "learn.example-academy.org",
      domainVerificationStatus: "verified",
    })).toBe("https://learn.example-academy.org/admin?tab=enrollments");
  });

  it("uses the Course360 organization domain when no verified custom domain is available", () => {
    expect(getOrgAdminPurchaseDashboardUrl({
      slug: "academy",
      customDomain: "learn.example-academy.org",
      domainVerificationStatus: "pending",
    })).toBe("https://academy.course360.app/admin?tab=enrollments");
  });
});
