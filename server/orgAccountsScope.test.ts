import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import type { OrgAccountRecord } from "../shared/orgAccountStatus";

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));

// The router imports ../db from server/routers; ./db is that same module here.
vi.mock("./db", () => ({ getDb: mocks.getDb }));

import { organizations, orgSubscriptions, users } from "../drizzle/schema";
import { describeOrgAccount } from "../shared/orgAccountStatus";
import { getOrgSubscriptionTrialDates } from "./lib/orgSubscriptionTrialDates";
import { orgAccountsRouter } from "./routers/orgAccountsRouter";

const NOW = Date.parse("2030-01-10T12:00:00.000Z");
const TRIAL_START = Date.parse("2030-01-08T00:00:00.000Z");
const TRIAL_END = Date.parse("2030-01-15T12:00:00.000Z");

// Include the nullable raw Stripe status so these fixtures also satisfy the
// forthcoming verification field without treating an unknown status as active.
type Fixture = OrgAccountRecord & {
  rawStripeStatus: string | null;
  stripeCustomerId?: string;
  clientSecret?: string;
  adminNotes?: string;
};

function record(overrides: Partial<Fixture> = {}): Fixture {
  return {
    orgId: 101,
    orgName: "Example Academy",
    orgSlug: "example-academy",
    orgIsActive: true,
    ownerName: "Fixture Owner",
    ownerEmail: "owner@example.test",
    joinedAt: new Date("2029-11-01T00:00:00.000Z"),
    subscriptionId: 1001,
    plan: "pro",
    subscriptionStatus: "trialing",
    stripeSubscriptionId: "sub_fixture_101",
    rawStripeStatus: "trialing",
    trialStartedAt: new Date(TRIAL_START),
    trialEndsAt: new Date(TRIAL_END),
    currentPeriodStart: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    updatedAt: new Date("2030-01-09T00:00:00.000Z"),
    ...overrides,
  };
}

function paidRecord(overrides: Partial<Fixture> = {}): Fixture {
  return record({
    subscriptionStatus: "active",
    rawStripeStatus: "active",
    trialStartedAt: null,
    trialEndsAt: null,
    currentPeriodStart: new Date("2030-01-01T00:00:00.000Z"),
    currentPeriodEnd: new Date("2030-02-01T00:00:00.000Z"),
    ...overrides,
  });
}

function createDbMock(fixtures: Fixture[]) {
  const chain: any = {};
  chain.from = vi.fn(() => chain);
  chain.leftJoin = vi.fn(() => chain);
  chain.orderBy = vi.fn(async () => fixtures);
  return { select: vi.fn((_selection?: Record<string, unknown>) => chain), chain };
}

function caller(role: string | null = "site_admin") {
  const ctx: TrpcContext = {
    req: { headers: { host: "fixture.example.test" } } as any,
    res: {} as any,
    user: role == null ? null : ({
      id: 77,
      role,
      name: "Platform Fixture",
      email: "platform@example.test",
      openId: "fixture-platform",
      orgId: 101,
    } as any),
  };
  return orgAccountsRouter.createCaller(ctx);
}

beforeEach(() => {
  mocks.getDb.mockReset();
  vi.spyOn(Date, "now").mockReturnValue(NOW);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("organization account platform authorization and scope", () => {
  it.each([null, "user", "org_admin", "org_super_admin"])(
    "denies role %s before accessing the database",
    async role => {
      const db = createDbMock([record()]);
      mocks.getDb.mockResolvedValue(db);

      await expect(caller(role).list({})).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(mocks.getDb).not.toHaveBeenCalled();
      expect(db.select).not.toHaveBeenCalled();
    },
  );

  it.each(["site_admin", "site_owner"])(
    "allows %s global oversight while keeping same-owner organizations separate",
    async role => {
      const first = record({ orgId: 101, orgName: "North Academy", orgSlug: "north", subscriptionId: 1001 });
      const second = paidRecord({ orgId: 202, orgName: "South Academy", orgSlug: "south", subscriptionId: 2002, stripeSubscriptionId: "sub_fixture_202" });
      // Both rows deliberately share the same owner and email. They must not be
      // coalesced into a personal account or constrained to ctx.user.orgId.
      const db = createDbMock([first, second]);
      mocks.getDb.mockResolvedValue(db);

      const result = await caller(role).list({});

      expect(result).toMatchObject({ scope: "platform_organizations", asOf: NOW, total: 2 });
      expect(result.summary).toMatchObject({ total: 2, trialing: 1, activeSubscriptions: 1 });
      expect(result.accounts.map(account => account.orgId)).toEqual([101, 202]);
      expect(result.accounts).toEqual([
        expect.objectContaining({ orgId: 101, orgName: "North Academy", status: "trialing", ownerEmail: "owner@example.test" }),
        expect.objectContaining({ orgId: 202, orgName: "South Academy", status: "active", ownerEmail: "owner@example.test" }),
      ]);
      expect(db.select).toHaveBeenCalledOnce();
      expect(db.chain.from).toHaveBeenCalledWith(organizations);
      expect(db.chain.leftJoin).toHaveBeenCalledTimes(2);
      expect(db.chain.leftJoin).toHaveBeenNthCalledWith(1, orgSubscriptions, expect.objectContaining({
        queryChunks: expect.arrayContaining([orgSubscriptions.orgId, organizations.id]),
      }));
      expect(db.chain.leftJoin).toHaveBeenNthCalledWith(2, users, expect.objectContaining({
        queryChunks: expect.arrayContaining([users.id, organizations.ownerId]),
      }));
      expect(db.chain.orderBy).toHaveBeenCalledWith(
        expect.objectContaining({ queryChunks: expect.arrayContaining([organizations.createdAt]) }),
        expect.objectContaining({ queryChunks: expect.arrayContaining([organizations.id]) }),
      );
    },
  );

  it("projects only account display data and never returns Stripe identifiers or customer secrets", async () => {
    const sensitiveRow = paidRecord({
      stripeSubscriptionId: "sub_fixture_private_marker",
      stripeCustomerId: "cus_fixture_private_marker",
      clientSecret: "fixture_client_private_marker",
      adminNotes: "fixture_internal_private_marker",
    });
    const db = createDbMock([sensitiveRow]);
    mocks.getDb.mockResolvedValue(db);

    const result = await caller().list({});
    const projection = db.select.mock.calls[0]?.[0] as Record<string, unknown>;

    expect(projection).toMatchObject({ orgId: organizations.id, subscriptionId: orgSubscriptions.id });
    expect(projection).not.toHaveProperty("stripeCustomerId");
    expect(projection).not.toHaveProperty("clientSecret");
    expect(projection).not.toHaveProperty("adminNotes");
    expect(result.accounts[0]).toMatchObject({ orgId: 101, isStripeLinked: true, status: "active" });
    for (const field of ["subscriptionId", "stripeSubscriptionId", "stripeCustomerId", "clientSecret", "adminNotes"]) {
      expect(result.accounts[0]).not.toHaveProperty(field);
    }
    const serialized = JSON.stringify(result);
    for (const value of [sensitiveRow.stripeSubscriptionId, sensitiveRow.stripeCustomerId, sensitiveRow.clientSecret, sensitiveRow.adminNotes]) {
      expect(serialized).not.toContain(value!);
    }
  });

  it("returns a controlled error if the database is unavailable", async () => {
    mocks.getDb.mockResolvedValue(null);
    await expect(caller("site_owner").list({})).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });

  it("strictly rejects an orgId override before database access", async () => {
    await expect(caller().list({ orgId: 202 } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it.each([
    { page: 0 },
    { page: 1.5 },
    { pageSize: 0 },
    { pageSize: 101 },
    { pageSize: 1.5 },
    { status: "cancelled" },
    { search: "x".repeat(201) },
  ])("rejects invalid list input %j without a query", async input => {
    await expect(caller().list(input as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
});

describe("organization account trial and billing labels", () => {
  it.each([
    ["2030-01-07T00:00:00.000Z", null, 9, 204, 0],
    ["2030-01-08T00:00:00.000Z", 1, 8, 180, 0],
    ["2030-01-10T12:00:00.000Z", 3, 5, 120, 33],
    ["2030-01-15T11:59:59.999Z", 8, 1, 1, 100],
    ["2030-01-15T12:00:00.000Z", 8, 0, 0, 100],
    ["2030-01-20T12:00:00.000Z", 8, 0, 0, 100],
  ] as const)("uses actual nonstandard trial bounds at %s", (instant, trialDay, daysRemaining, hoursRemaining, trialProgressPercent) => {
    const now = Date.parse(instant);
    expect(describeOrgAccount(record(), now)).toMatchObject({
      trialStartedAt: TRIAL_START,
      trialEndsAt: TRIAL_END,
      trialDateSource: "stripe_trial",
      trialLengthDays: 8,
      trialDay,
      daysRemaining,
      hoursRemaining,
      trialProgressPercent,
      status: now >= TRIAL_END ? "trial_ended" : "trialing",
    });
  });

  it("uses a recorded billing-period fallback, not account join date or an invented 14-day trial", () => {
    const result = describeOrgAccount(record({
      joinedAt: new Date("2020-01-01T00:00:00.000Z"),
      trialStartedAt: null,
      trialEndsAt: null,
      currentPeriodStart: new Date(TRIAL_START),
      currentPeriodEnd: new Date(TRIAL_END),
    }), NOW);

    expect(result).toMatchObject({
      trialStartedAt: TRIAL_START,
      trialEndsAt: TRIAL_END,
      trialDateSource: "recorded_billing_period",
      trialLengthDays: 8,
      trialDay: 3,
      daysRemaining: 5,
      trialProgressPercent: 33,
    });
  });

  it("prefers explicit Stripe trial dates over different current billing dates", () => {
    expect(describeOrgAccount(record({
      currentPeriodStart: new Date("2029-12-01T00:00:00.000Z"),
      currentPeriodEnd: new Date("2030-02-01T00:00:00.000Z"),
    }), NOW)).toMatchObject({
      trialStartedAt: TRIAL_START,
      trialEndsAt: TRIAL_END,
      trialDateSource: "stripe_trial",
      trialLengthDays: 8,
      trialProgressPercent: 33,
    });
  });

  it.each([
    { trialStartedAt: null, trialEndsAt: null },
    { trialStartedAt: null, trialEndsAt: new Date(TRIAL_END) },
    { trialStartedAt: new Date(TRIAL_START), trialEndsAt: null },
    { trialStartedAt: new Date(TRIAL_END), trialEndsAt: new Date(TRIAL_START) },
    { trialStartedAt: new Date(TRIAL_START), trialEndsAt: new Date(TRIAL_START) },
    { trialStartedAt: "not-a-date", trialEndsAt: new Date(TRIAL_END) },
    { trialStartedAt: new Date(TRIAL_START), trialEndsAt: new Date(Number.NaN) },
  ])("does not invent trial progress for missing, invalid, or inverted dates %j", overrides => {
    const result = describeOrgAccount(record({ ...overrides, currentPeriodStart: null, currentPeriodEnd: null }), NOW);
    expect(result.trialDay).toBeNull();
    expect(result.trialLengthDays).toBeNull();
    expect(result.trialProgressPercent).toBeNull();
  });

  it("keeps unavailable trial dates and remaining time null", () => {
    expect(describeOrgAccount(record({ trialStartedAt: null, trialEndsAt: null }), NOW)).toMatchObject({
      trialStartedAt: null,
      trialEndsAt: null,
      trialDateSource: "unavailable",
      daysRemaining: null,
      hoursRemaining: null,
      trialProgressPercent: null,
    });
  });

  it("normalizes serialized date values and invalid optional dates safely", () => {
    expect(describeOrgAccount(record({
      joinedAt: "invalid",
      updatedAt: new Date(Number.NaN),
      trialStartedAt: "2030-01-08T00:00:00.000Z",
      trialEndsAt: TRIAL_END,
    }), NOW)).toMatchObject({ joinedAt: null, updatedAt: null, trialStartedAt: TRIAL_START, trialEndsAt: TRIAL_END });
  });

  it("treats an expired trial as attention, not an active subscription or current free trial", async () => {
    mocks.getDb.mockResolvedValue(createDbMock([record({ trialEndsAt: new Date(NOW) })]));
    const result = await caller().list({});
    expect(result.accounts[0]).toMatchObject({ status: "trial_ended", daysRemaining: 0, hoursRemaining: 0 });
    expect(result.accounts[0].statusLabel).not.toBe("Active subscription");
    expect(result.summary).toMatchObject({ trialing: 0, endingSoon: 0, active: 0, activeSubscriptions: 0, attention: 1 });
    expect((await caller().list({ status: "trialing" })).accounts).toEqual([]);
    expect((await caller().list({ status: "active" })).accounts).toEqual([]);
    expect((await caller().list({ status: "attention" })).accounts.map(account => account.orgId)).toEqual([101]);
  });

  it("preserves scheduled cancellation without falsely labelling an active subscription cancelled", async () => {
    mocks.getDb.mockResolvedValue(createDbMock([paidRecord({ cancelAtPeriodEnd: true })]));
    const result = await caller().list({});
    expect(result.accounts[0]).toMatchObject({ status: "active", statusLabel: "Active subscription", cancelAtPeriodEnd: true });
    expect(result.summary.activeSubscriptions).toBe(1);
    expect(describeOrgAccount(record({ cancelAtPeriodEnd: true }), NOW)).toMatchObject({ status: "trialing", cancelAtPeriodEnd: true });
    expect(describeOrgAccount(paidRecord({ subscriptionStatus: "cancelled", rawStripeStatus: "canceled", cancelAtPeriodEnd: false }), NOW)).toMatchObject({ status: "cancelled", cancelAtPeriodEnd: false });
  });

  it("keeps admin-assigned and free access distinct from Active subscription", async () => {
    const manual = paidRecord({ orgId: 301, stripeSubscriptionId: null, rawStripeStatus: null, plan: "enterprise" });
    const free = paidRecord({ orgId: 302, plan: "free" });
    const db = createDbMock([manual, free, paidRecord({ orgId: 303 })]);
    mocks.getDb.mockResolvedValue(db);

    const result = await caller().list({ status: "active" });
    expect(result.accounts.map(account => account.status)).toEqual(["manual", "legacy_free", "active"]);
    expect(result.accounts[0]).toMatchObject({ isStripeLinked: false, statusLabel: "Active · admin-assigned access" });
    expect(result.accounts[1]).toMatchObject({ statusLabel: "Legacy free access" });
    expect(result.accounts.slice(0, 2).every(account => account.statusLabel !== "Active subscription")).toBe(true);
    expect(result.summary).toMatchObject({ active: 3, activeSubscriptions: 1 });
    expect(describeOrgAccount(paidRecord({ stripeSubscriptionId: "   ", rawStripeStatus: null }), NOW)).toMatchObject({ status: "manual", isStripeLinked: false });
  });

  it("does not count disabled organizations or absent subscriptions as active", async () => {
    mocks.getDb.mockResolvedValue(createDbMock([
      paidRecord({ orgId: 401, orgIsActive: false }),
      record({ orgId: 402, subscriptionId: null, subscriptionStatus: null, stripeSubscriptionId: null, rawStripeStatus: null, plan: null, trialStartedAt: null, trialEndsAt: null }),
    ]));
    const result = await caller().list({ status: "other" });
    expect(result.accounts.map(account => account.status)).toEqual(["suspended", "no_subscription"]);
    expect(result.summary).toMatchObject({ total: 2, active: 0, activeSubscriptions: 0, trialing: 0 });
  });
});

describe("organization account list filters and pagination", () => {
  it("preserves deterministic query order, paginates after filtering, and keeps global summary counts", async () => {
    const fixtures = [
      paidRecord({ orgId: 505, orgName: "Match Newest" }),
      paidRecord({ orgId: 504, orgName: "Unrelated" }),
      paidRecord({ orgId: 503, orgName: "Match Middle" }),
      paidRecord({ orgId: 502, orgName: "Match Oldest" }),
      record({ orgId: 501, orgName: "Unrelated Trial" }),
    ];
    mocks.getDb.mockResolvedValue(createDbMock(fixtures));
    const input = { search: "  MATCH  ", pageSize: 2, page: 1 };
    const first = await caller().list(input);
    const repeated = await caller().list(input);
    const second = await caller().list({ ...input, page: 2 });
    const clamped = await caller().list({ ...input, page: 99 });

    expect(repeated).toEqual(first);
    expect(first).toMatchObject({ total: 3, page: 1, pageCount: 2, summary: { total: 5, trialing: 1, activeSubscriptions: 4 } });
    expect(first.accounts.map(account => account.orgId)).toEqual([505, 503]);
    expect(second).toMatchObject({ total: 3, page: 2, pageCount: 2 });
    expect(second.accounts.map(account => account.orgId)).toEqual([502]);
    expect(clamped).toEqual(second);
    expect(fixtures.map(row => row.orgId)).toEqual([505, 504, 503, 502, 501]);
  });

  it.each([
    ["North ACADEMY", "orgName"],
    ["north-slug", "orgSlug"],
    ["Owner TARGET", "ownerName"],
    ["owner-target@example.test", "ownerEmail"],
  ] as const)("searches %s case-insensitively through %s", async (value, field) => {
    mocks.getDb.mockResolvedValue(createDbMock([
      record({ orgId: 601, [field]: value }),
      record({ orgId: 602, ownerName: null, ownerEmail: null }),
    ]));
    const result = await caller().list({ search: `  ${value.toUpperCase()}  ` });
    expect(result.total).toBe(1);
    expect(result.accounts.map(account => account.orgId)).toEqual([601]);
  });

  it("sorts trial-only results by actual end date before slicing with stable ties", async () => {
    const fixtures = [
      record({ orgId: 705, trialEndsAt: new Date("2030-01-20T12:00:00.000Z") }),
      paidRecord({ orgId: 704 }),
      record({ orgId: 703, trialEndsAt: null }),
      record({ orgId: 702, trialEndsAt: new Date("2030-01-11T12:00:00.000Z") }),
      record({ orgId: 701, trialEndsAt: new Date("2030-01-11T12:00:00.000Z") }),
    ];
    mocks.getDb.mockResolvedValue(createDbMock(fixtures));
    const first = await caller().list({ status: "trialing", pageSize: 2 });
    const second = await caller().list({ status: "trialing", pageSize: 2, page: 2 });

    expect(first).toMatchObject({ total: 4, pageCount: 2, summary: { total: 5, trialing: 4, endingSoon: 2 } });
    expect(first.accounts.map(account => account.orgId)).toEqual([702, 701]);
    expect(second.accounts.map(account => account.orgId)).toEqual([705, 703]);
    expect((await caller().list({ status: "trialing", pageSize: 2 })).accounts).toEqual(first.accounts);
    expect(fixtures.map(row => row.orgId)).toEqual([705, 704, 703, 702, 701]);
  });

  it("filters attention and other without mixing in paid, manual, free, or unexpired trial accounts", async () => {
    mocks.getDb.mockResolvedValue(createDbMock([
      record({ orgId: 801, trialEndsAt: new Date(NOW) }),
      paidRecord({ orgId: 802, subscriptionStatus: "past_due", rawStripeStatus: "past_due" }),
      paidRecord({ orgId: 803, subscriptionStatus: "unpaid", rawStripeStatus: "unpaid" }),
      paidRecord({ orgId: 804, subscriptionStatus: "cancelled", rawStripeStatus: "canceled" }),
      paidRecord({ orgId: 805 }),
      paidRecord({ orgId: 806, stripeSubscriptionId: null, rawStripeStatus: null }),
      paidRecord({ orgId: 807, plan: "free" }),
      record({ orgId: 808 }),
    ]));
    const attention = await caller().list({ status: "attention" });
    const other = await caller().list({ status: "other" });
    expect(attention.accounts.map(account => account.orgId)).toEqual([801, 802, 803]);
    expect(other.accounts.map(account => account.orgId)).toEqual([804]);
    expect(attention.summary).toEqual(other.summary);
    expect(attention.summary).toMatchObject({ total: 8, attention: 3, active: 3, activeSubscriptions: 1, trialing: 1 });
  });

  it("returns deterministic empty results and clamps the page to one", async () => {
    mocks.getDb.mockResolvedValue(createDbMock([record()]));
    expect(await caller().list({ search: "no-fixture-match", page: 99 })).toMatchObject({
      accounts: [], total: 0, page: 1, pageCount: 1, summary: { total: 1 },
    });
    mocks.getDb.mockResolvedValue(createDbMock([]));
    expect(await caller().list({})).toMatchObject({
      accounts: [], total: 0, page: 1, pageCount: 1,
      summary: { total: 0, trialing: 0, endingSoon: 0, active: 0, activeSubscriptions: 0, attention: 0 },
    });
  });
});

describe("Stripe organization subscription trial date conversion", () => {
  it("converts Stripe epoch seconds into exact Date values, not milliseconds", () => {
    const result = getOrgSubscriptionTrialDates({ trial_start: TRIAL_START / 1000, trial_end: TRIAL_END / 1000 });
    expect(result.trialStartedAt).toBeInstanceOf(Date);
    expect(result.trialEndsAt).toBeInstanceOf(Date);
    expect(result.trialStartedAt?.getTime()).toBe(TRIAL_START);
    expect(result.trialEndsAt?.getTime()).toBe(TRIAL_END);
    expect(result.trialStartedAt?.toISOString()).toBe("2030-01-08T00:00:00.000Z");
    expect(result.trialEndsAt?.toISOString()).toBe("2030-01-15T12:00:00.000Z");
  });

  it.each([undefined, null, 0, -1, Number.NaN, Infinity, -Infinity, Number.MAX_VALUE, "1894060800"])(
    "returns null for missing, invalid, or out-of-range seconds %s",
    value => {
      expect(getOrgSubscriptionTrialDates({ trial_start: value as any, trial_end: value as any })).toEqual({
        trialStartedAt: null,
        trialEndsAt: null,
      });
    },
  );

  it("handles each optional timestamp independently without inventing dates", () => {
    expect(getOrgSubscriptionTrialDates({})).toEqual({ trialStartedAt: null, trialEndsAt: null });
    expect(getOrgSubscriptionTrialDates({ trial_start: TRIAL_START / 1000, trial_end: null })).toEqual({
      trialStartedAt: new Date(TRIAL_START), trialEndsAt: null,
    });
    expect(getOrgSubscriptionTrialDates({ trial_start: Number.NaN, trial_end: TRIAL_END / 1000 })).toEqual({
      trialStartedAt: null, trialEndsAt: new Date(TRIAL_END),
    });
  });
});
