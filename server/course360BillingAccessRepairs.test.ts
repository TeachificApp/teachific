import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ access: "web", userRole: "org_admin" }));
vi.mock("./_core/env", () => ({
  ENV: { stripeSecretKey: "", isProduction: false },
}));
vi.mock("./db", () => ({
  getDb: async () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [
            {
              creatorAccess: state.access,
              studioAccess: state.access,
              quizCreatorAccess: state.access,
            },
          ],
        }),
      }),
    }),
  }),
  getOrgIdForUserWithFallback: async () => 42,
}));
vi.mock("./lmsDb", () => ({
  getOrgSubscription: vi.fn(),
  upsertOrgSubscription: vi.fn(),
}));
vi.mock("./stripePlans", () => ({
  getStripe: () => {
    throw new Error("Provider calls forbidden in this test");
  },
  getPlatformStripeSecretKey: () => "",
  getPlatformStripePublishableKey: () => "",
  getPlatformPaymentReadiness: () => ({ ready: false, secretMode: "missing" }),
  STRIPE_PRICE_IDS: {},
  PLAN_LIMITS: {},
}));
import { stripeRouter } from "./stripeRouter";
import {
  nextSchoolBillingPeriodEnd,
  preservedSchoolSchedulePhase,
} from "./course360BillingState";
beforeEach(() => {
  state.access = "web";
  state.userRole = "org_admin";
});
describe("Course360 app access and schedule safeguards", () => {
  it.each(["creator", "studio", "quizCreator"] as const)(
    "web-only access cannot download desktop %s",
    async app => {
      const caller = stripeRouter.createCaller({
        user: { id: 7, role: state.userRole },
      } as any);
      await expect(caller.getDesktopDownloads({ app })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    }
  );
  it.each(["desktop", "bundle"])(
    "retains download entitlement for %s",
    async access => {
      state.access = access;
      const caller = stripeRouter.createCaller({
        user: { id: 7, role: "org_admin" },
      } as any);
      await expect(
        caller.getDesktopDownloads({ app: "studio" })
      ).resolves.toBeDefined();
    }
  );
  it("retains platform manual download entitlement", async () => {
    state.access = "none";
    const caller = stripeRouter.createCaller({
      user: { id: 7, role: "site_owner" },
    } as any);
    await expect(
      caller.getDesktopDownloads({ app: "creator" })
    ).resolves.toBeDefined();
  });
  it("preserves phase and item discounts, tax IDs, metadata and invoice terms", () => {
    const phase = {
      start_date: 100,
      end_date: 200,
      items: [
        {
          price: { id: "price_original" },
          quantity: 1,
          metadata: { legacy: "yes" },
          discounts: [{ coupon: { id: "coupon_item" } }],
          tax_rates: [{ id: "tax_item" }],
        },
      ],
      discounts: [{ discount: "di_keep" }],
      default_tax_rates: [{ id: "tax_default" }],
      automatic_tax: { enabled: true },
      invoice_settings: {
        days_until_due: 14,
        account_tax_ids: [{ id: "txi_keep" }],
      },
      metadata: { owner: "school" },
      add_invoice_items: [],
    };
    expect(preservedSchoolSchedulePhase(phase as any)).toMatchObject({
      items: [
        {
          price: "price_original",
          quantity: 1,
          metadata: { legacy: "yes" },
          discounts: [{ coupon: "coupon_item" }],
          tax_rates: ["tax_item"],
        },
      ],
      discounts: [{ discount: "di_keep" }],
      invoice_settings: { days_until_due: 14, account_tax_ids: ["txi_keep"] },
    });
  });
  it("rejects custom schedule billing rather than removing it", () => {
    expect(() =>
      preservedSchoolSchedulePhase({
        add_invoice_items: [{}],
        items: [],
      } as any)
    ).toThrow("custom billing");
  });
  it.each([
    ["2027-01-31T12:30:00Z", "monthly", "2027-02-28T12:30:00Z"],
    ["2028-01-31T12:30:00Z", "monthly", "2028-02-29T12:30:00Z"],
    ["2028-02-29T12:30:00Z", "annual", "2029-02-28T12:30:00Z"],
    ["2027-12-25T12:30:00Z", "monthly", "2028-01-25T12:30:00Z"],
  ])(
    "uses calendar-safe phase boundaries from %s (%s)",
    (from, interval, to) => {
      expect(
        new Date(
          nextSchoolBillingPeriodEnd(
            Date.parse(from) / 1000,
            interval as "monthly" | "annual"
          ) * 1000
        ).toISOString()
      ).toBe(new Date(to).toISOString());
    }
  );
});
