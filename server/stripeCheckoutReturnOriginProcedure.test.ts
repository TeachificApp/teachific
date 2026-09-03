import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENV } from "./_core/env";

const checkoutCalls: any[] = [];
let memberOrganizations: Array<{ customDomain: string | null; domainVerificationStatus: string | null }> = [];

const db = {
  select: vi.fn(() => ({
    from: () => ({
      innerJoin: () => ({
        where: async () => memberOrganizations,
      }),
    }),
  })),
};

vi.mock("./db", () => ({
  getDb: vi.fn(async () => db),
}));

vi.mock("./stripePlans", () => ({
  getStripe: () => ({
    checkout: {
      sessions: {
        create: vi.fn(async (input: any) => {
          checkoutCalls.push(input);
          return { url: "https://checkout.stripe.example/session" };
        }),
      },
    },
  }),
  STRIPE_PRICE_IDS: {
    creator_desktop_monthly: "price_creator",
    studio_desktop_monthly: "price_studio",
    quiz_creator_desktop_monthly: "price_quiz_creator",
  },
  PLAN_LIMITS: { enterprise: {} },
}));

import { stripeRouter } from "./stripeRouter";

const context = { user: { id: 17, role: "org_admin", email: "admin@example.test", name: "Admin" } } as any;
const originalAppUrl = ENV.appUrl;

describe("protected Course360 product checkout routes", () => {
  beforeEach(() => {
    checkoutCalls.splice(0);
    memberOrganizations = [];
    (ENV as any).appUrl = originalAppUrl;
    vi.clearAllMocks();
  });

  it("allows all three product checkouts to retain an approved Course360 browser return origin", async () => {
    const caller = stripeRouter.createCaller(context);

    await caller.createCreatorSingleCheckout({ interval: "monthly", origin: "https://academy.course360.app" });
    await caller.createStudioSingleCheckout({ interval: "monthly", origin: "https://academy.course360.app" });
    await caller.createQuizCreatorCheckout({ interval: "monthly", origin: "https://academy.course360.app" });

    expect(checkoutCalls).toHaveLength(3);
    expect(checkoutCalls.map((call) => call.success_url)).toEqual([
      "https://academy.course360.app/creator?upgraded=1",
      "https://academy.course360.app/studio?upgraded=1",
      "https://academy.course360.app/quiz-creator?upgraded=1",
    ]);
  });

  it("allows a verified custom organization domain for its authenticated member", async () => {
    memberOrganizations = [{ customDomain: "learn.example-academy.org", domainVerificationStatus: "verified" }];
    const caller = stripeRouter.createCaller(context);

    await caller.createCreatorSingleCheckout({ interval: "monthly", origin: "https://learn.example-academy.org" });
    await caller.createStudioSingleCheckout({ interval: "monthly", origin: "https://learn.example-academy.org" });
    await caller.createQuizCreatorCheckout({ interval: "monthly", origin: "https://learn.example-academy.org" });

    expect(checkoutCalls).toHaveLength(3);
    expect(checkoutCalls.map((call) => call.success_url)).toEqual([
      "https://learn.example-academy.org/creator?upgraded=1",
      "https://learn.example-academy.org/studio?upgraded=1",
      "https://learn.example-academy.org/quiz-creator?upgraded=1",
    ]);
  });

  it("allows all three routes to return to the configured development preview", async () => {
    const previewOrigin = "https://course360-preview.manus.computer";
    (ENV as any).appUrl = previewOrigin;
    const caller = stripeRouter.createCaller(context);

    await caller.createCreatorSingleCheckout({ interval: "monthly", origin: previewOrigin });
    await caller.createStudioSingleCheckout({ interval: "monthly", origin: previewOrigin });
    await caller.createQuizCreatorCheckout({ interval: "monthly", origin: previewOrigin });

    expect(checkoutCalls).toHaveLength(3);
    expect(checkoutCalls.map((call) => call.cancel_url)).toEqual([
      `${previewOrigin}/creator-pro`,
      `${previewOrigin}/studio-pro`,
      `${previewOrigin}/quiz-creator-pro`,
    ]);
  });

  it("rejects arbitrary, lookalike, pending, and insecure custom origins before any Stripe session is created", async () => {
    const caller = stripeRouter.createCaller(context);
    memberOrganizations = [{ customDomain: "pending.example-academy.org", domainVerificationStatus: "pending" }];

    await expect(caller.createCreatorSingleCheckout({ interval: "monthly", origin: "https://attacker.example" }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.createStudioSingleCheckout({ interval: "monthly", origin: "https://course360.app.attacker.example" }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.createQuizCreatorCheckout({ interval: "monthly", origin: "https://pending.example-academy.org" }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.createCreatorSingleCheckout({ interval: "monthly", origin: "http://custom.example-academy.org" }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(checkoutCalls).toHaveLength(0);
  });

  it("rejects an explicitly unverified custom organization origin before any Stripe session is created", async () => {
    memberOrganizations = [{ customDomain: "unverified.example-academy.org", domainVerificationStatus: "unverified" }];
    const caller = stripeRouter.createCaller(context);

    await expect(caller.createStudioSingleCheckout({ interval: "monthly", origin: "https://unverified.example-academy.org" }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(checkoutCalls).toHaveLength(0);
  });
});
