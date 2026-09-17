import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  inserts: [] as unknown[],
  email: null as null | Record<string, unknown>,
  eligibilityInput: null as null | Record<string, unknown>,
  selectCount: 0,
}));

vi.mock("./db", () => ({
  getDb: vi.fn(async () => ({
    select: vi.fn(() => {
      fixture.selectCount += 1;
      const result = fixture.selectCount === 1
        ? [{ orgId: 9 }]
        : fixture.selectCount === 2
          ? []
          : [{ slug: "free-course" }];
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => ({ limit: vi.fn(async () => result) })),
        })),
      };
    }),
    insert: vi.fn(() => ({ values: vi.fn(async (value: unknown) => fixture.inserts.push(value)) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) })),
  })),
  getOrgById: vi.fn(async () => ({ id: 9, slug: "acme-school", customDomain: "learn.acme.example", domainVerificationStatus: "verified" })),
  getOrCreateUserByEmail: vi.fn(async () => ({ user: { id: 41, name: "Taylor Learner" }, isNew: false })),
}));
vi.mock("./lib/checkoutPricing", () => ({
  assertFreeOrderEligible: vi.fn(async (_db: unknown, input: Record<string, unknown>) => { fixture.eligibilityInput = input; }),
  resolveEmbeddedCheckoutExpectedCents: vi.fn(),
}));
vi.mock("./_core/notification", () => ({ notifyOwner: vi.fn(async () => true) }));
vi.mock("./_core/email", () => ({
  sendEmail: vi.fn(),
  sendEmailViaOrg: vi.fn(async (message: Record<string, unknown>) => { fixture.email = message; }),
  buildFunnelPurchaseConfirmationEmail: vi.fn(({ loginUrl }) => ({ subject: "Access", htmlBody: String(loginUrl), previewText: "Access" })),
}));
vi.mock("./lib/stripeClient", () => ({ getStripeClient: vi.fn() }));

import { embeddedCheckoutRouter } from "./routers/embeddedCheckoutRouter";

describe("embeddedCheckout.processFreeOrder", () => {
  beforeEach(() => {
    fixture.inserts = [];
    fixture.email = null;
    fixture.eligibilityInput = null;
    fixture.selectCount = 0;
  });

  it("fulfills an eligible free course and sends a verified-organization access link while stripping retired brand grants", async () => {
    const caller = embeddedCheckoutRouter.createCaller({ user: null } as any);
    const result = await caller.processFreeOrder({
      email: "learner@example.test",
      productName: "Free Course",
      productType: "course",
      lmsCourseId: 21,
      origin: "https://attacker.example",
      fulfillmentBrand: "aaus",
      additionalAccess: [{ type: "membership", label: "Legacy membership", brand: "iheartecho" }],
    } as any);

    expect(result.success).toBe(true);
    expect(fixture.eligibilityInput).toMatchObject({ productType: "course", lmsCourseId: 21 });
    expect(fixture.inserts).toContainEqual(expect.objectContaining({ userId: 41, courseId: 21 }));
    expect(fixture.email).toMatchObject({ htmlBody: "https://learn.acme.example/courses/free-course" });
    expect(JSON.stringify(fixture.inserts)).not.toContain("aaus");
    expect(JSON.stringify(fixture.inserts)).not.toContain("iheartecho");
  });
});
