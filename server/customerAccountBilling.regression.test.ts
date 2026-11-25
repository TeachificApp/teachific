import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({
  db: null as any, orgId: 10 as number | null,
  rows: new Map<any, any[]>(), writes: [] as any[],
  retrieve: vi.fn(), update: vi.fn(), cancel: vi.fn(), getStripe: vi.fn(), ownStripe: vi.fn(), requireAdmin: vi.fn(),
}));
vi.mock("./db", () => ({
  getDb: vi.fn(async () => fake.db), getOrgIdForUserWithFallback: vi.fn(async () => fake.orgId),
  requireOrgAdmin: (...args: any[]) => fake.requireAdmin(...args),
}));
vi.mock("./stripePlans", () => ({ getStripe: () => { fake.getStripe(); return { subscriptions: { retrieve: fake.retrieve, update: fake.update, cancel: fake.cancel } }; } }));
vi.mock("stripe", () => ({ default: class { constructor(key: string) { fake.ownStripe(key); } subscriptions = { retrieve: fake.retrieve, update: fake.update, cancel: fake.cancel }; } }));
vi.mock("./_core/email", () => ({ sendEmail: vi.fn(), sendEmailViaOrg: vi.fn(), buildPasswordResetEmail: vi.fn() }));
vi.mock("./lib/enrollmentEmail", () => ({ sendEnrollmentEmail: vi.fn() }));
vi.mock("./lib/orgUrl", () => ({ getOrgBaseUrl: vi.fn() }));
vi.mock("drizzle-orm", async (original) => {
  const actual = await original<typeof import("drizzle-orm")>();
  return { ...actual,
    eq: (a: any, b: any) => ({ op: "eq", a, b }),
    and: (...args: any[]) => ({ op: "and", args }), or: (...args: any[]) => ({ op: "or", args }),
    like: (a: any, b: any) => ({ op: "like", a, b }),
  };
});

import { users, orgMembers, userActiveOrg, orgPaymentSettings, lmsEnrollments, lmsOrders, lmsCourses,
  lmsCertificates, membershipMembers, memberships, membershipSubscriptions, membershipPlans, organizations } from "../drizzle/schema";
import { adminUserRouter } from "./routers/adminUserRouter";
import { getCustomerAccountSubscriptions } from "./lib/customerAccountSubscriptions";
import { loadCustomerBillingSnapshots, scheduleCustomerCancellation } from "./lib/customerSubscriptionBilling";
import { stripePeriodEnd, subscriptionCancellationState, formatStoredDollars } from "../shared/customerSubscriptionBilling";
import { SubscriptionCancellationIndicator } from "../client/src/components/customer/SubscriptionCancellationIndicator";

// Predicate-aware in-memory adapter. Evaluates actual router-built joins/filters/projections.
function value(v: any, env: Map<any, any>): any { return v?.table ? env.get(v.table)?.[v.name] ?? env.get(v.table)?.[columnKey(v)] : v; }
function columnKey(column: any) { return Object.keys(column.table).find(key => column.table[key] === column)!; }
function matches(condition: any, env: Map<any, any>): boolean {
  if (!condition) return true;
  if (condition.op === "eq") return value(condition.a, env) === value(condition.b, env);
  if (condition.op === "and") return condition.args.every((arg: any) => matches(arg, env));
  if (condition.op === "or") return condition.args.some((arg: any) => matches(arg, env));
  if (condition.op === "like") return String(value(condition.a, env) ?? "").toLowerCase().includes(condition.b.replaceAll("%", "").toLowerCase());
  throw new Error("Unvetted SQL predicate in regression test");
}
function database() {
  return {
    select(projection?: any) {
      let base: any; let condition: any; let limit = Infinity; const joins: any[] = [];
      const query: any = {
        from(table: any) { base = table; return query; },
        where(predicate: any) { condition = predicate; return query; },
        innerJoin(table: any, predicate: any) { joins.push({ table, predicate, inner: true }); return query; },
        leftJoin(table: any, predicate: any) { joins.push({ table, predicate }); return query; },
        limit(count: number) { limit = count; return query; }, orderBy() { return query; }, offset() { return query; },
        then(resolve: any, reject: any) {
          try {
            let envs = (fake.rows.get(base) ?? []).map(row => new Map([[base, row]]));
            for (const join of joins) envs = envs.flatMap(env => {
              const joined = (fake.rows.get(join.table) ?? []).map(row => new Map([...env, [join.table, row]])).filter(env => matches(join.predicate, env));
              return joined.length || join.inner ? joined : [env];
            });
            const result = envs.filter(env => matches(condition, env)).slice(0, limit).map(env => projection
              ? Object.fromEntries(Object.entries(projection).map(([key, col]) => [key, value(col, env)])) : env.get(base));
            return Promise.resolve(result).then(resolve, reject);
          } catch (error) { return Promise.reject(error).then(resolve, reject); }
        },
      }; return query;
    },
    update(table: any) { return { set(patch: any) { return { where(predicate: any) {
      const rows = (fake.rows.get(table) ?? []).filter(row => matches(predicate, new Map([[table, row]])));
      fake.writes.push({ table, patch, ids: rows.map(row => row.id) }); rows.forEach(row => Object.assign(row, patch));
      return Promise.resolve();
    } }; } }; },
    insert() { throw new Error("Destructive/insert operation is not authorized in this test"); },
    delete() { throw new Error("Destructive operation is not authorized in this test"); },
  };
}
const end = new Date("2027-02-05T00:00:00Z");
const seconds = end.getTime() / 1000;
const owner = { orgId: 10, userId: 8, subscriptionId: "sub_synthetic" };
const admin = () => adminUserRouter.createCaller({ user: { id: 1, role: "site_owner" }, req: {}, res: {} } as any);
const live = (patch = {}) => ({ id: "sub_synthetic", status: "active", cancel_at_period_end: false,
  metadata: { orgId: "10", userId: "8" }, items: { data: [{ current_period_end: seconds }] }, ...patch });
function seed() {
  fake.rows.set(orgMembers, [{ id: 1, orgId: 10, userId: 8 }, { id: 2, orgId: 20, userId: 9 }]);
  fake.rows.set(users, [{ id: 8, email: "same@example.invalid", name: "School One" }, { id: 9, email: "same@example.invalid", name: "School Two" }]);
  fake.rows.set(lmsCourses, [{ id: 61, orgId: 10, title: "Own course" }, { id: 62, orgId: 20, title: "Private course" }]);
  fake.rows.set(lmsEnrollments, [{ id: 51, orgId: 10, userId: 8, courseId: 61, status: "active", stripeSubscriptionId: "sub_synthetic", accessExpiresAt: null },
    { id: 52, orgId: 20, userId: 9, courseId: 62, status: "active", stripeSubscriptionId: "sub_other" }]);
  fake.rows.set(lmsOrders, [{ id: 31, orgId: 10, userId: 8, courseId: 61, stripeSubscriptionId: "sub_synthetic", status: "completed", amount: "49.99" }]);
}
beforeEach(() => {
  vi.clearAllMocks(); fake.rows.clear(); fake.writes.length = 0; fake.orgId = 10; fake.db = database();
  fake.requireAdmin.mockResolvedValue(10); fake.retrieve.mockResolvedValue(live()); fake.update.mockResolvedValue(live({ cancel_at_period_end: true })); seed();
});

describe("Course360 customer billing real behavior (mock-only)", () => {
  it("cancels renewal at item billing end while keeping enrollment access active", async () => {
    await admin().cancelLmsEnrollmentSubscription({ enrollmentId: 51 });
    expect(fake.update).toHaveBeenCalledWith("sub_synthetic", { cancel_at_period_end: true }, {});
    expect(fake.cancel).not.toHaveBeenCalled(); expect(fake.writes[0].patch).toEqual({ accessExpiresAt: end });
    expect(fake.rows.get(lmsEnrollments)![0].status).toBe("active"); expect(fake.writes[0].ids).toEqual([51]);
  });
  it("never marks cancellation as a refund or changes stored dollars", async () => {
    await admin().cancelLmsOrderSubscription({ orderId: 31 });
    expect(fake.writes.every(write => write.table !== lmsOrders)).toBe(true);
    expect(fake.rows.get(lmsOrders)![0]).toMatchObject({ status: "completed", amount: "49.99" });
  });
  it("does not fake success or write access when Stripe update fails", async () => {
    fake.update.mockRejectedValue(new Error("synthetic failure"));
    await expect(admin().cancelLmsEnrollmentSubscription({ enrollmentId: 51 })).rejects.toThrow("Unable to confirm");
    expect(fake.writes).toHaveLength(0);
  });
  it("fails closed for unknown billing periods without touching provider or local data", async () => {
    fake.retrieve.mockResolvedValue(live({ items: { data: [] } }));
    await expect(admin().cancelLmsOrderSubscription({ orderId: 31 })).rejects.toThrow("Billing period end");
    expect(fake.update).not.toHaveBeenCalled(); expect(fake.writes).toHaveLength(0);
  });
  it("preserves access for already-ended subscriptions", async () => {
    fake.retrieve.mockResolvedValue(live({ status: "canceled", items: { data: [] } }));
    expect(await admin().cancelLmsEnrollmentSubscription({ enrollmentId: 51 })).toMatchObject({ outcome: "already_ended" });
    expect(fake.update).not.toHaveBeenCalled(); expect(fake.writes).toHaveLength(0);
  });
  it("does not repeat already-scheduled cancellation", async () => {
    fake.retrieve.mockResolvedValue(live({ cancel_at_period_end: true }));
    expect(await scheduleCustomerCancellation(owner)).toMatchObject({ outcome: "already_scheduled", periodEnd: end });
    expect(fake.update).not.toHaveBeenCalled();
  });
  it("reads the saved native Stripe ID and retains paid-through membership status", async () => {
    fake.rows.set(memberships, [{ id: 71, orgId: 10, name: "Own membership" }]);
    fake.rows.set(membershipMembers, [{ id: 81, membershipId: 71, userId: 8, stripeSubscriptionId: "sub_synthetic", status: "active" }]);
    await admin().cancelNativeMembership({ membershipMemberId: 81 });
    expect(fake.retrieve).toHaveBeenCalledWith("sub_synthetic", {}, {});
    expect(fake.writes[0].patch).toMatchObject({ expiresAt: end });
    expect(fake.rows.get(membershipMembers)![0].status).toBe("active");
  });
  it("rejects another school's native membership before any provider call", async () => {
    fake.rows.set(memberships, [{ id: 71, orgId: 20 }]);
    fake.rows.set(membershipMembers, [{ id: 81, membershipId: 71, userId: 9, stripeSubscriptionId: "sub_other" }]);
    await expect(admin().cancelNativeMembership({ membershipMemberId: 81 })).rejects.toThrow("active organization");
    expect(fake.retrieve).not.toHaveBeenCalled(); expect(fake.writes).toHaveLength(0);
  });
  it("rejects raw arbitrary subscription IDs even for platform admins", async () => {
    await expect(admin().cancelStripeSubscription({ subscriptionId: "sub_other" })).rejects.toThrow("school's customer");
    expect(fake.retrieve).not.toHaveBeenCalled();
  });
  it("generic subscription cancellation updates only school-bound member and enrollment access", async () => {
    fake.rows.set(memberships, [{ id: 71, orgId: 10 }, { id: 72, orgId: 20 }]);
    fake.rows.set(membershipMembers, [{ id: 81, membershipId: 71, userId: 8, stripeSubscriptionId: "sub_synthetic", status: "active" },
      { id: 82, membershipId: 72, userId: 9, stripeSubscriptionId: "sub_other", status: "active" }]);
    await admin().cancelStripeSubscription({ subscriptionId: "sub_synthetic" });
    expect(fake.writes.map(write => write.ids)).toEqual([[51], [81]]);
    expect(fake.rows.get(membershipMembers)![1].expiresAt).toBeUndefined();
    expect(fake.rows.get(lmsOrders)![0].status).toBe("completed");
  });
  it("rejects conflicting Stripe school metadata and unscoped platform subscriptions", async () => {
    for (const metadata of [{ orgId: "20", userId: "8" }, { userId: "8" }, { orgId: "10", userId: "9" }]) {
      fake.retrieve.mockResolvedValue(live({ metadata }));
      await expect(scheduleCustomerCancellation(owner)).rejects.toThrow("ownership");
    }
    expect(fake.update).not.toHaveBeenCalled();
  });
  it("uses a school's configured Stripe key, without platform fallback", async () => {
    fake.rows.set(orgPaymentSettings, [{ orgId: 10, stripeSecretKey: "sk_test_synthetic_only" }]);
    fake.retrieve.mockResolvedValue(live({ metadata: {} }));
    await scheduleCustomerCancellation(owner);
    expect(fake.ownStripe).toHaveBeenCalledWith("sk_test_synthetic_only"); expect(fake.getStripe).not.toHaveBeenCalled();
  });
  it("routes connected-account reads and cancellation to exactly the school's account", async () => {
    fake.rows.set(organizations, [{ id: 10, paymentGateway: "teachific_pay", stripeConnectStatus: "active", stripeConnectAccountId: "acct_synthetic" }]);
    await scheduleCustomerCancellation(owner);
    expect(fake.retrieve).toHaveBeenCalledWith("sub_synthetic", {}, { stripeAccount: "acct_synthetic" });
    expect(fake.update).toHaveBeenCalledWith("sub_synthetic", { cancel_at_period_end: true }, { stripeAccount: "acct_synthetic" });
  });
  it("fails closed for missing own-gateway configuration instead of using platform billing", async () => {
    fake.rows.set(organizations, [{ id: 10, paymentGateway: "own_gateway", ownStripeSecretKeyEncrypted: null }]);
    await expect(scheduleCustomerCancellation(owner)).rejects.toThrow("not configured");
    expect(fake.getStripe).not.toHaveBeenCalled(); expect(fake.retrieve).not.toHaveBeenCalled();
  });
  it("authorizes the exact active school instead of a caller's other administrator membership", async () => {
    fake.requireAdmin.mockRejectedValue(new Error("not admin of active school"));
    await expect(admin().getUserDetail({ userId: 8 })).rejects.toThrow("not admin of active school");
    expect(fake.requireAdmin).toHaveBeenCalledWith(1, "site_owner", 10); expect(fake.retrieve).not.toHaveBeenCalled();
  });
  it("does not reveal same-email learners or foreign membership plans in account/detail data", async () => {
    fake.rows.set(membershipPlans, [{ id: 1, orgId: 10, name: "Own", price: "49.99", billingInterval: "monthly" }, { id: 2, orgId: 20, name: "Private", price: "1.00" }]);
    fake.rows.set(membershipSubscriptions, [{ id: 11, orgId: 10, userId: 8, planId: 1, status: "active", endDate: end },
      { id: 12, orgId: 10, userId: 8, planId: 2, status: "active" }, { id: 13, orgId: 20, userId: 9, planId: 2 }]);
    const detail = await admin().getUserDetail({ userId: 8 });
    expect(detail.memberships).toHaveLength(1); expect(detail.memberships[0]).toMatchObject({ planTitle: "Own", price: "49.99", expiresAt: end });
    const account = await getCustomerAccountSubscriptions({ id: 8, role: "member" });
    expect(account.savedPlans).toHaveLength(1); expect(account.content).toHaveLength(1); expect(account.content[0].title).toBe("Own course");
    expect(JSON.stringify(account)).not.toContain("Private");
    await expect(admin().getUserDetail({ userId: 9 })).rejects.toThrow("not a member");
  });
  it("rejects ambiguous learner school context and ignores unowned active school preferences", async () => {
    fake.rows.set(orgMembers, [{ userId: 8, orgId: 10 }, { userId: 8, orgId: 20 }]);
    fake.rows.set(userActiveOrg, [{ userId: 8, orgId: 30 }]);
    await expect(getCustomerAccountSubscriptions({ id: 8, role: "member" })).rejects.toThrow("Select a school");
    expect(fake.retrieve).not.toHaveBeenCalled();
  });
  it("uses the request's verified school over another saved active school and prevents host leaks", async () => {
    fake.rows.set(organizations, [{ id: 10, slug: "first", isActive: true }, { id: 20, slug: "second", isActive: true }]);
    fake.rows.set(orgMembers, [{ userId: 8, orgId: 10 }, { userId: 8, orgId: 20 }]);
    fake.rows.set(userActiveOrg, [{ userId: 8, orgId: 20 }]);
    const account = await getCustomerAccountSubscriptions({ id: 8, role: "member" }, { hostname: "first.course360.app" });
    expect(account.orgId).toBe(10); expect(account.content[0].title).toBe("Own course");
    fake.rows.set(orgMembers, [{ userId: 8, orgId: 10 }]);
    await expect(getCustomerAccountSubscriptions({ id: 8, role: "member" }, { hostname: "second.course360.app" })).rejects.toThrow("not a member");
    await expect(getCustomerAccountSubscriptions({ id: 8, role: "member" }, { hostname: "missing.course360.app" })).rejects.toThrow("could not be verified");
  });
  it("restricts same-email merge search to the active school and refuses cross-school merge without writes", async () => {
    const rows = await admin().searchUsersForMerge({ query: "same@example.invalid" });
    expect(rows.map(row => row.id)).toEqual([8]);
    await expect(admin().mergeUsers({ primaryUserId: 8, secondaryUserId: 9 })).rejects.toThrow("not a member");
    expect(fake.writes).toHaveLength(0);
  });
  it("refuses merge for accounts with another school membership or orphaned school content", async () => {
    fake.rows.set(orgMembers, [{ userId: 8, orgId: 10 }, { userId: 9, orgId: 10 }, { userId: 9, orgId: 20 }]);
    await expect(admin().mergeUsers({ primaryUserId: 8, secondaryUserId: 9 })).rejects.toThrow("another school");
    fake.rows.set(orgMembers, [{ userId: 8, orgId: 10 }, { userId: 9, orgId: 10 }]);
    await expect(admin().mergeUsers({ primaryUserId: 8, secondaryUserId: 9 })).rejects.toThrow("Cross-school");
    expect(fake.writes).toHaveLength(0);
  });
  it("marks wrong-ID, unavailable or foreign snapshots unverified without failing profile data", async () => {
    for (const response of [live({ id: "sub_wrong" }), live({ metadata: { orgId: "20" } }), live({ status: undefined })]) {
      fake.retrieve.mockResolvedValue(response);
      expect((await loadCustomerBillingSnapshots(10, [owner])).get("sub_synthetic")?.verified).toBe(false);
    }
    fake.retrieve.mockRejectedValue(new Error("offline"));
    expect((await loadCustomerBillingSnapshots(10, [owner])).get("sub_synthetic")?.verified).toBe(false);
  });
  it("deduplicates verified subscription snapshots and does not mutate provider data", async () => {
    fake.retrieve.mockResolvedValue(live({ cancel_at_period_end: true }));
    const snapshots = await loadCustomerBillingSnapshots(10, [owner, owner]);
    expect(fake.retrieve).toHaveBeenCalledTimes(1); expect(snapshots.get(owner.subscriptionId)).toMatchObject({ verified: true, currentPeriodEnd: end });
    expect(fake.update).not.toHaveBeenCalled();
  });
  it("sync reads modern billing periods with explicit school ownership, without claiming writes", async () => {
    const result = await admin().syncStripeSubscription({ subscriptionId: "sub_synthetic" });
    expect(result).toMatchObject({ currentPeriodEnd: end, stripeStatus: "active", updated: [] }); expect(fake.writes).toHaveLength(0);
  });
});

describe("Course360 cancellation display and accounting", () => {
  it("formats database dollars as dollars rather than dividing by 100", () => {
    expect(formatStoredDollars("49.99")).toBe("$49.99"); expect(formatStoredDollars(499)).toBe("$499.00");
  });
  it("resolves legacy, mixed-item, trial and invalid period boundaries", () => {
    expect(stripePeriodEnd({ current_period_end: seconds })).toEqual(end);
    expect(stripePeriodEnd({ items: { data: [{ current_period_end: seconds + 500 }, { current_period_end: seconds }] } })).toEqual(end);
    expect(stripePeriodEnd({ trial_end: seconds })).toEqual(end);
    for (const value of [0, -1, NaN, Infinity]) expect(stripePeriodEnd({ current_period_end: value })).toBeNull();
  });
  it("never infers cancellation from expiry or attaches another subscription's result", () => {
    const snapshot = { subscriptionId: "sub_synthetic", verified: true, status: "active", cancelAtPeriodEnd: true, currentPeriodEnd: end, checkedAt: new Date() };
    expect(subscriptionCancellationState("sub_other", snapshot).kind).toBe("unverified");
    expect(subscriptionCancellationState("sub_synthetic", { ...snapshot, status: "unverified" }).kind).toBe("unverified");
    const html = renderToStaticMarkup(React.createElement(SubscriptionCancellationIndicator, { subscriptionId: "sub_synthetic", accessExpiresAt: end }));
    expect(html).toContain('data-subscription-cancellation="unverified"'); expect(html).not.toContain("will not renew");
  });
  it("renders confirmed renewal cancellation and millisecond access dates", () => {
    const snapshot = { subscriptionId: "sub_synthetic", verified: true, status: "active", cancelAtPeriodEnd: true, currentPeriodEnd: end, checkedAt: new Date() };
    const html = renderToStaticMarkup(React.createElement(SubscriptionCancellationIndicator, { subscriptionId: "sub_synthetic", snapshot, accessExpiresAt: end.getTime() }));
    expect(html).toContain("will not renew"); expect(html).toContain("2027"); expect(html).not.toContain("Invalid Date");
    expect(subscriptionCancellationState("sub_synthetic", { ...snapshot, cancelAtPeriodEnd: false }).kind).toBe("not-cancelled");
    expect(subscriptionCancellationState("sub_synthetic", { ...snapshot, status: "incomplete_expired" }).kind).toBe("ended");
  });
});
