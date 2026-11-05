import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { describeOrgAccount, type OrgAccountRecord } from "../shared/orgAccountStatus";
import { getOrgSubscriptionTrialDates, isOrgPlatformSubscription } from "./lib/orgSubscriptionTrialDates";

const now = Date.parse("2030-01-08T00:00:00Z");
const record: OrgAccountRecord = {
  orgId: 1, orgName: "Test School", orgSlug: "test-school", orgIsActive: true,
  ownerName: "Test Owner", ownerEmail: "owner@example.test", joinedAt: null,
  subscriptionId: 1, plan: "pro", subscriptionStatus: "active", stripeSubscriptionId: "sub_platform",
  trialStartedAt: now - 2 * 86400000, trialEndsAt: now + 12 * 86400000,
  currentPeriodStart: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, updatedAt: null,
};

describe("organization account lifecycle reporting", () => {
  it.each(["incomplete", "incomplete_expired", "paused", "unexpected"])("does not report %s as an active subscription", rawStripeStatus => {
    expect(describeOrgAccount({ ...record, rawStripeStatus }, now).status).toBe("unverified");
  });
  it("uses actual Stripe trial state even when an older local action wrote active", () => {
    const account = describeOrgAccount({ ...record, rawStripeStatus: "trialing" }, now);
    expect(account.status).toBe("trialing");
    expect(account.trialDay).toBe(3);
    expect(account.daysRemaining).toBe(12);
  });
  it("does not call a non-Stripe trial verified", () => {
    expect(describeOrgAccount({ ...record, subscriptionStatus: "trialing", stripeSubscriptionId: null }, now).status).toBe("unverified");
  });
  it("recognizes raw Stripe cancellation without reviving retained Stripe IDs", () => {
    expect(describeOrgAccount({ ...record, rawStripeStatus: "canceled" }, now).status).toBe("cancelled");
  });
  it("stores exact Stripe dates and raw status rather than billing period assumptions", () => {
    expect(getOrgSubscriptionTrialDates({ trial_start: now / 1000, trial_end: now / 1000 + 432000, status: "trialing" })).toEqual({
      trialStartedAt: new Date(now), trialEndsAt: new Date(now + 432000000), rawStripeStatus: "trialing",
    });
  });
  it("accepts only the current saved platform subscription", () => {
    expect(isOrgPlatformSubscription({ id: "sub_platform", metadata: { org_id: "1", plan: "pro" } }, "sub_platform")).toBe(true);
    expect(isOrgPlatformSubscription({ id: "sub_old", metadata: { org_id: "1" } }, "sub_platform")).toBe(false);
    expect(isOrgPlatformSubscription({ id: "sub_platform" }, null)).toBe(false);
  });
  it.each(["content_type", "content_id", "product_type", "product_id"])("rejects learner/product subscription metadata %s", key => {
    expect(isOrgPlatformSubscription({ id: "sub_platform", metadata: { org_id: "1", [key]: "course" } }, "sub_platform")).toBe(false);
  });
  it("records trial dates in all platform billing lifecycle paths with ownership guards", () => {
    const source = readFileSync(new URL("./stripeWebhookRoutes.ts", import.meta.url), "utf8");
    expect(source.match(/\.\.\.getOrgSubscriptionTrialDates\(subscription\)/g)?.length).toBe(6);
    expect(source.match(/await isCurrentOrgPlatformSubscription\(orgId, subscription\)/g)?.length).toBe(4);
    expect(source).toContain("return isOrgPlatformSubscription(subscription, stored?.stripeSubscriptionId)");
  });
  it("preserves both Members routes and the existing user-management controls", () => {
    const app = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");
    const menu = readFileSync(new URL("../client/src/components/DashboardLayout.tsx", import.meta.url), "utf8");
    const members = readFileSync(new URL("../client/src/pages/lms/MembersPage.tsx", import.meta.url), "utf8");
    expect(app.match(/path="\/members\/organization-accounts"/g)?.length).toBe(2);
    expect(menu).toContain('path: "/members/organization-accounts", adminOnly: true');
    expect(menu).toContain("if (sub.adminOnly && !isAdmin) return false");
    for (const label of ["Add Member", "Bulk Import", "Reset Password", "Organization Accounts"]) expect(members).toContain(label);
  });
});
