import { describe, expect, it } from "vitest";
import {
  buildFunnelPurchaseConfirmationEmail,
  buildOrgAdminNewPurchaseEmail,
  buildPaymentFailedEmail,
} from "./_core/email";

describe("Course360 purchase and payment email fallbacks", () => {
  it("uses the Course360 support fallback in a buyer purchase confirmation", () => {
    const email = buildFunnelPurchaseConfirmationEmail({
      firstName: "Avery",
      productName: "Course",
      amountPaid: 129,
      loginUrl: "https://academy.example.com/library",
    });
    expect(email.htmlBody).toContain("support@course360.app");
    expect(email.htmlBody).toContain("https://academy.example.com/library");
    expect(email.htmlBody).not.toContain("support@teachific.com");
  });

  it("keeps supplied organization dashboard URLs while using Course360 purchase-alert wording", () => {
    const email = buildOrgAdminNewPurchaseEmail({
      orgName: "Example Academy",
      buyerName: "Avery Learner",
      buyerEmail: "avery@example.com",
      productName: "Course",
      amountPaid: 129,
      productType: "course",
      adminDashboardUrl: "https://academy.example.com/lms/sales",
    });
    expect(email.htmlBody).toContain("https://academy.example.com/lms/sales");
    expect(email.htmlBody).toContain("Course360™");
    expect(email.htmlBody).not.toContain("Teachific™");
  });

  it("uses the Course360 support fallback in payment-failure messages", () => {
    const email = buildPaymentFailedEmail({
      firstName: "Avery",
      productName: "Course360 Studio",
      updatePaymentUrl: "https://course360.app/settings/billing",
    });
    expect(email.htmlBody).toContain("support@course360.app");
    expect(email.htmlBody).toContain("https://course360.app/settings/billing");
    expect(email.htmlBody).not.toContain("support@teachific.com");
  });
});
