import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { getTableName } from "drizzle-orm";
import * as schema from "../../drizzle/schema";
import { course360HostedCheckoutPurchases as purchases, hostedPurchaseMetadata, settledHostedDollars, resolveCourse360HostedGateway } from "./course360HostedCheckout";
import { reconcileCourse360HostedSignedSession, fulfillCourse360HostedFreePurchase } from "./course360HostedCheckoutReconciliation";

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), activeOrg: vi.fn(), requireOrgAdmin: vi.fn(), Stripe: vi.fn(), stripe: {} as any }));
vi.mock("../db", () => ({ getDb: mocks.getDb, getOrgIdForUserWithFallback: mocks.activeOrg, requireOrgAdmin: mocks.requireOrgAdmin }));
vi.mock("../_core/env", () => ({ ENV: { stripeSecretKey: "sk_test_mock_only" } }));
vi.mock("stripe", () => ({ default: mocks.Stripe }));
vi.mock("../routers/lmsHelpers", () => ({ assertAdmin: vi.fn() }));
import { lmsCheckoutLearnerRouter, lmsCheckoutAdminRouter } from "../routers/lmsCheckoutRouter";

const dialect = new MySqlDialect();
const org = { id: 7, slug: "academy", isActive: true, customDomain: "academy.example.test", domainVerificationStatus: "verified", paymentGateway: "teachific_pay", stripeConnectStatus: "active", stripeConnectAccountId: "acct_school7" };
const course = { id: 41, orgId: 7, slug: "course-41", title: "Course 41", status: "published", pricingType: "one_time", price: "125.00", currency: "usd", isFree: false, subscriptionInterval: null, trialDays: 0, stripePriceId: null, enrollmentClosed: false };
const purchase = { id: "purchase-1", orgId: 7, userId: 101, contentType: "course", contentId: 41, contentSlug: "course-41", gateway: "connect", accountId: "acct_school7", stripeSessionId: "cs_1", stripeSubscriptionId: null, stripePaymentIntentId: null, pricingOptionId: null, pricingType: "one_time", unitPrice: "125.00", seats: 1, currency: "usd", trialDays: 0, zeroPaymentEligible: 0, selectedBumpIds: null, amount: null, status: "pending", createdAt: new Date(), completedAt: null } as any;
function session(p = purchase, extra: any = {}) { return { id: "cs_1", metadata: hostedPurchaseMetadata(p), client_reference_id: "101", mode: "payment", status: "complete", payment_status: "paid", amount_total: 8750, currency: "usd", subscription: null, payment_intent: "pi_1", customer: "cus_buyer", livemode: false, ...extra }; }

/** Executes generated Drizzle equality predicates rather than blindly returning queue rows. */
function memoryDb(initial: Array<[any, any[]]> = []) {
  let store = new Map<string, any[]>(initial.map(([table, rows]) => [getTableName(table), structuredClone(rows)]));
  let tail = Promise.resolve();
  const writes: any[] = [];
  const db: any = {
    rows: (table: any) => store.get(getTableName(table)) ?? [],
    writes,
    failTable: null,
    select: vi.fn(() => {
      let table: any; let predicate: any;
      const run = () => db.rows(table).filter((row: any) => matches(table, row, predicate));
      const chain: any = { from: (value: any) => (table = value, chain), where: (value: any) => (predicate = value, chain), for: () => chain, limit: (n: number) => Promise.resolve(run().slice(0, n)), orderBy: () => Promise.resolve(run()), then: (resolve: any, reject: any) => Promise.resolve(run()).then(resolve, reject) };
      return chain;
    }),
    insert: vi.fn((table: any) => ({ values: (values: any) => {
      let done: any; let duplicate = false;
      const execute = () => {
        if (done) return done;
        if (db.failTable === table) throw new Error("Injected entitlement failure");
        const rows = db.rows(table);
        const prior = values.id != null ? rows.find((r: any) => r.id === values.id) : null;
        if (prior && duplicate) return done = [{ id: prior.id }];
        const record = { id: rows.length + 1, ...values };
        rows.push(record); store.set(getTableName(table), rows); writes.push({ table, values: { ...record } });
        return done = [{ id: record.id }];
      };
      const chain: any = { $returningId: () => Promise.resolve(execute()), onDuplicateKeyUpdate: () => (duplicate = true, chain), then: (resolve: any, reject: any) => Promise.resolve().then(execute).then(resolve, reject) };
      return chain;
    } })),
    update: vi.fn((table: any) => ({ set: (values: any) => ({ where: async (predicate: any) => {
      if (db.failTable === table) throw new Error("Injected entitlement failure");
      for (const row of db.rows(table)) if (matches(table, row, predicate)) { Object.assign(row, values); writes.push({ table, values }); }
    } }) })),
    transaction: vi.fn(async (fn: any) => {
      const wait = tail; let release!: () => void; tail = new Promise<void>(resolve => { release = resolve; });
      await wait;
      const previous = structuredClone(store); const length = writes.length;
      try { return await fn(db); } catch (error) { store = previous; writes.splice(length); throw error; } finally { release(); }
    }),
  };
  function matches(table: any, row: any, predicate: any) {
    if (!predicate) return true;
    const query = dialect.sqlToQuery(predicate);
    const clauses = [...query.sql.matchAll(/`[^`]+`\.`([^`]+)` = \?/g)];
    if (clauses.length !== query.params.length) throw new Error(`Unsupported test predicate: ${query.sql}`);
    return clauses.every((clause, i) => { const key = Object.keys(table).find(key => table[key]?.name === clause[1]); return key && row[key] === query.params[i]; });
  }
  return db;
}
function seeded(p = purchase, content = course, other: Array<[any, any[]]> = []) {
  const table = p.contentType === "course" ? schema.lmsCourses : p.contentType === "membership" ? schema.memberships : p.contentType === "membership_plan" ? schema.membershipPlans : p.contentType === "bundle" ? schema.bundles : p.contentType === "download" ? schema.digitalProducts : p.contentType === "physical_product" ? schema.physicalProducts : p.contentType === "workshop" ? schema.workshops : schema.webinars;
  return memoryDb([[purchases, [p]], [schema.organizations, [org]], [table, [content]], [schema.users, [{ id: 101, email: "learner@example.test", name: "Learner" }]], ...other]);
}
function caller(userId = 101) { return lmsCheckoutLearnerRouter.createCaller({ user: { id: userId, role: "user", email: "learner@example.test" } } as any); }
function reconcile(db: any, signedSession: any, extra: any = {}) { return reconcileCourse360HostedSignedSession({ db, signedSession, verifiedAccountId: "acct_school7", ...extra }); }

beforeEach(() => {
  vi.clearAllMocks(); mocks.activeOrg.mockResolvedValue(7);
  mocks.stripe = { accounts: { retrieve: vi.fn().mockResolvedValue({ id: "acct_own7" }) }, coupons: { create: vi.fn().mockResolvedValue({ id: "coupon_1" }) }, products: { create: vi.fn().mockResolvedValue({ id: "prod_1" }) }, prices: { create: vi.fn().mockResolvedValue({ id: "price_1" }), retrieve: vi.fn().mockResolvedValue({ id: "price_1", active: true, unit_amount: 12500, currency: "usd", recurring: { interval: "month", interval_count: 1 } }) }, subscriptions: { retrieve: vi.fn().mockResolvedValue({ id: "sub_new", status: "active", customer: "cus_buyer", livemode: false, metadata: {}, items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 86400 }] } }) }, checkout: { sessions: { retrieve: vi.fn().mockResolvedValue(session()), create: vi.fn().mockResolvedValue({ id: "cs_created", url: "https://checkout.example.test" }) } } };
  const originalRetrieve = mocks.stripe.subscriptions.retrieve;
  originalRetrieve.mockImplementation(async (id: string) => {
    const current = await mocks.stripe.checkout.sessions.retrieve();
    return { id, status: "active", customer: "cus_buyer", livemode: false, metadata: current.metadata, items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 86400 }] } };
  });
  mocks.Stripe.mockImplementation(() => mocks.stripe);
});

describe("Course360 hosted immutable checkout and settlement", () => {
  it.each([102, 103])("mounted confirmation rejects another buyer %i without writes", async userId => {
    const db = seeded(); mocks.getDb.mockResolvedValue(db);
    await expect(caller(userId).confirmHostedCheckout({ sessionId: "cs_1", contentType: "course", slug: course.slug })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.writes).toEqual([]);
  });
  it.each(["content_id", "org_id", "content_type", "user_id", "stripe_account_id", "pricing_option_id"])("rejects mutated immutable %s", async key => {
    const db = seeded(); const wrong = session(); wrong.metadata[key] = "999"; mocks.stripe.checkout.sessions.retrieve.mockResolvedValue(wrong);
    await expect(reconcile(db, wrong)).rejects.toMatchObject({ code: "FORBIDDEN" }); expect(db.writes).toEqual([]);
  });
  it("rejects a supplied different course slug in the mounted procedure", async () => {
    const db = seeded(purchase, { ...course, id: 42, slug: "different-course" }); mocks.getDb.mockResolvedValue(db);
    await expect(caller().confirmHostedCheckout({ sessionId: "cs_1", contentType: "course", slug: "different-course" })).rejects.toMatchObject({ code: "FORBIDDEN" }); expect(db.writes).toEqual([]);
  });
  it("rejects cross-school confirmation before Stripe retrieval", async () => {
    const db = seeded(purchase, { ...course, orgId: 8 }); mocks.getDb.mockResolvedValue(db);
    await expect(caller().confirmHostedCheckout({ sessionId: "cs_1", contentType: "course", slug: course.slug })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.stripe.checkout.sessions.retrieve).not.toHaveBeenCalled(); expect(db.writes).toEqual([]);
  });
  it("complete + unpaid grants nothing, later authoritative async settlement grants once", async () => {
    const db = seeded(); const unpaid = session(purchase, { payment_status: "unpaid" }); mocks.stripe.checkout.sessions.retrieve.mockResolvedValue(unpaid);
    await expect(reconcile(db, unpaid)).resolves.toMatchObject({ success: false, status: "unpaid" }); expect(db.writes).toEqual([]);
    mocks.stripe.checkout.sessions.retrieve.mockResolvedValue(session()); await expect(reconcile(db, unpaid)).resolves.toMatchObject({ success: true });
    expect(db.rows(schema.lmsOrders)).toHaveLength(1); expect(db.rows(schema.lmsOrders)[0].amount).toBe("87.50");
  });
  it("signature-account context rejects metadata-derived foreign account", async () => {
    const db = seeded(); await expect(reconcile(db, session(), { verifiedAccountId: "acct_other" })).rejects.toMatchObject({ code: "FORBIDDEN" }); expect(db.writes).toEqual([]);
  });
  it("concurrent webhook and mounted confirmations lock one durable purchase", async () => {
    const db = seeded(); mocks.getDb.mockResolvedValue(db);
    const results = await Promise.all([reconcile(db, session()), caller().confirmHostedCheckout({ sessionId: "cs_1", contentType: "course", slug: course.slug }), reconcile(db, session())]);
    expect(results.every(r => r.success)).toBe(true); expect(db.rows(schema.lmsOrders)).toHaveLength(1); expect(db.rows(schema.lmsEnrollments)).toHaveLength(1); expect(db.rows(purchases)[0].status).toBe("completed");
  });
  it("a persistence failure rolls back the order; retry grants one purchase", async () => {
    const db = seeded(); db.failTable = schema.lmsEnrollments;
    await expect(reconcile(db, session())).rejects.toThrow("Injected entitlement failure"); expect(db.rows(schema.lmsOrders)).toHaveLength(0); expect(db.rows(purchases)[0].status).toBe("pending");
    db.failTable = null; await reconcile(db, session()); expect(db.rows(schema.lmsOrders)).toHaveLength(1); expect(db.rows(schema.lmsEnrollments)).toHaveLength(1);
  });
  it.each(["suspended", "cancelled", "expired", "free_preview"])("reactivates existing %s enrollment with a new subscription and period", async state => {
    const p = { ...purchase, pricingType: "subscription", stripeSubscriptionId: null };
    const s = session(p, { mode: "subscription", subscription: "sub_new" }); mocks.stripe.checkout.sessions.retrieve.mockResolvedValue(s);
    const existing = { id: 9, orgId: 7, courseId: 41, userId: 101, status: state === "free_preview" ? "active" : state, enrollmentType: state === "free_preview" ? state : "full", stripeSubscriptionId: "sub_old", accessExpiresAt: new Date(0) };
    const db = seeded(p, course, [[schema.lmsEnrollments, [existing]]]); await reconcile(db, s);
    expect(db.rows(schema.lmsEnrollments)).toHaveLength(1); expect(db.rows(schema.lmsEnrollments)[0]).toMatchObject({ status: "active", enrollmentType: "full", stripeSubscriptionId: "sub_new" }); expect(db.rows(schema.lmsEnrollments)[0].accessExpiresAt.getTime()).toBeGreaterThan(Date.now());
  });
  it("eligible trial grants zero settled dollars only for a current trialing subscription", async () => {
    const p = { ...purchase, pricingType: "subscription", trialDays: 14 }; const s = session(p, { mode: "subscription", subscription: "sub_new", payment_status: "no_payment_required", amount_total: 0 }); mocks.stripe.checkout.sessions.retrieve.mockResolvedValue(s);
    const db = seeded(p); mocks.stripe.subscriptions.retrieve.mockResolvedValue({ id: "sub_new", status: "trialing", customer: "cus_buyer", livemode: false, metadata: s.metadata, trial_end: Math.floor(Date.now() / 1000) + 86400 });
    await expect(reconcile(db, s)).resolves.toMatchObject({ success: true }); expect(db.rows(schema.lmsOrders)[0].amount).toBe("0.00");
    mocks.stripe.subscriptions.retrieve.mockResolvedValue({ id: "sub_new", status: "past_due" }); const secondDb = seeded(p); await expect(reconcile(secondDb, s)).resolves.toMatchObject({ success: false }); expect(secondDb.writes).toEqual([]);
  });
  it("no-payment-required on an ordinary paid product is not settlement", async () => {
    const db = seeded(); const s = session(purchase, { payment_status: "no_payment_required", amount_total: 0 }); mocks.stripe.checkout.sessions.retrieve.mockResolvedValue(s);
    await expect(reconcile(db, s)).resolves.toMatchObject({ success: false }); expect(db.writes).toEqual([]);
  });
  it.each([[0, "0.00"], [12500, "125.00"], [8750, "87.50"], [37037, "370.37"]])("persists %i cents as %s dollars", (cents, dollars) => { expect(settledHostedDollars(cents)).toBe(dollars); });
});

describe("Course360 canonical hosted families", () => {
  it.each(["membership", "membership_plan", "bundle", "webinar"])("webhook-only %s creates canonical access once, not a fake course order", async family => {
    const p = { ...purchase, contentType: family, contentId: 51, contentSlug: "51" };
    const content = { id: 51, orgId: 7, courseIds: "[41]" };
    const db = seeded(p, content, ["bundle", "membership"].includes(family) ? [[schema.lmsCourses, [course]]] : []); const s = session(p); mocks.stripe.checkout.sessions.retrieve.mockResolvedValue(s);
    await reconcile(db, s); await reconcile(db, s);
    const target = family === "membership" ? schema.membershipMembers : family === "membership_plan" ? schema.membershipSubscriptions : family === "bundle" ? schema.bundleEnrollments : schema.webinarRegistrations;
    expect(db.rows(target)).toHaveLength(1); expect(db.rows(schema.lmsOrders)).toHaveLength(0); expect(db.rows(purchases)[0].amount).toBe("87.50");
    if (family === "bundle") expect(db.rows(schema.lmsEnrollments)[0]).toMatchObject({ orgId: 7, userId: 101, courseId: 41, enrollmentType: "full" });
  });
  it.each(["membership", "membership_plan"])("reactivates cancelled %s canonical row", async family => {
    const p = { ...purchase, contentType: family, contentId: 51, contentSlug: "51" }; const target = family === "membership" ? schema.membershipMembers : schema.membershipSubscriptions;
    const db = seeded(p, { id: 51, orgId: 7 }, [[target, [{ id: 9, orgId: 7, userId: 101, membershipId: 51, planId: 51, status: "cancelled", endDate: new Date(0), cancelledAt: new Date(0) }]]]); const s = session(p); mocks.stripe.checkout.sessions.retrieve.mockResolvedValue(s);
    await reconcile(db, s); expect(db.rows(target)).toHaveLength(1); expect(db.rows(target)[0].status).toBe("active");
  });
  it("foreign-school bundle courses reject and roll back all writes", async () => {
    const p = { ...purchase, contentType: "bundle", contentId: 51, contentSlug: "51" }; const db = seeded(p, { id: 51, orgId: 7, courseIds: "[41]" }, [[schema.lmsCourses, [{ ...course, orgId: 8 }]]]); const s = session(p); mocks.stripe.checkout.sessions.retrieve.mockResolvedValue(s);
    await expect(reconcile(db, s)).rejects.toMatchObject({ code: "FORBIDDEN" }); expect(db.writes).toEqual([]);
  });
  it.each(["membership", "membership_plan", "bundle", "webinar"])("genuine local free %s grants canonically without Stripe calls", async family => {
    const p = { ...purchase, contentType: family, contentId: 51, contentSlug: "51", gateway: "free", unitPrice: "0.00", zeroPaymentEligible: 1, pricingType: "free", stripeSessionId: null }; const db = seeded(p, { id: 51, orgId: 7, courseIds: "[]" });
    await fulfillCourse360HostedFreePurchase(db, p, { id: 51, orgId: 7, courseIds: "[]" }); expect(db.rows(purchases)[0].status).toBe("completed"); expect(mocks.Stripe).not.toHaveBeenCalled();
  });
});

describe("Course360 mounted hosted creation pricing and gateways", () => {
  it("invalid foreign pricing option rejects before all provider writes", async () => {
    const db = seeded(); mocks.getDb.mockResolvedValue(db);
    await expect(caller().createHostedCheckoutSession({ contentType: "course", slug: course.slug, origin: "https://ignored.test", pricingOptionId: 900 })).rejects.toMatchObject({ code: "BAD_REQUEST" }); expect(mocks.Stripe).not.toHaveBeenCalled(); expect(db.writes).toEqual([]);
  });
  it("finite zero-base installment plan cannot silently charge once or grant free", async () => {
    const db = seeded(purchase, { ...course, pricingType: "payment_plan", price: "0.00", downPayment: 100, installmentCount: 3, installmentAmount: 50 }); mocks.getDb.mockResolvedValue(db);
    await expect(caller().createHostedCheckoutSession({ contentType: "course", slug: course.slug, origin: "https://ignored.test" })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" }); expect(mocks.Stripe).not.toHaveBeenCalled(); expect(db.writes).toEqual([]);
  });
  it("current active full course access blocks redundant payment before Stripe", async () => {
    const db = seeded(purchase, course, [[schema.lmsEnrollments, [{ id: 9, orgId: 7, userId: 101, courseId: 41, status: "active", enrollmentType: "full" }]]]); mocks.getDb.mockResolvedValue(db);
    await expect(caller().createHostedCheckoutSession({ contentType: "course", slug: course.slug, origin: "https://ignored.test" })).rejects.toMatchObject({ code: "CONFLICT" }); expect(mocks.Stripe).not.toHaveBeenCalled();
  });
  it.each(["monthly", "quarterly", "annual"])("membership plan %s keeps the real recurring interval and school account context", async interval => {
    const db = memoryDb([[schema.organizations, [org]], [schema.membershipPlans, [{ id: 51, orgId: 7, name: "Plan", price: "125.00", billingInterval: interval, stripePriceId: null }]]]); mocks.getDb.mockResolvedValue(db);
    const recurring = { interval: interval === "annual" ? "year" : "month", interval_count: interval === "quarterly" ? 3 : 1 }; mocks.stripe.prices.retrieve.mockResolvedValue({ active: true, currency: "usd", unit_amount: 12500, recurring });
    await expect(caller().createHostedCheckoutSession({ contentType: "membership_plan", slug: "51", origin: "https://attacker.test" })).resolves.toMatchObject({ type: "redirect" });
    expect(mocks.stripe.prices.create).toHaveBeenCalledWith(expect.objectContaining({ recurring }), { stripeAccount: "acct_school7" });
    expect(mocks.stripe.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({ mode: "subscription", metadata: expect.objectContaining({ org_id: "7", user_id: "101", type: "course360_hosted_checkout_v1" }), success_url: expect.stringContaining("academy.example.test") }), expect.objectContaining({ stripeAccount: "acct_school7", idempotencyKey: expect.stringContaining("course360_hosted:") }));
  });
  it("valid team tier persists only its scoped price and actual seat quantity", async () => {
    const option = { id: 90, courseId: 41, isActive: true, pricingType: "subscription", price: "120.00", perSeatPrice: "25.00", isTeamPricing: true, minSeats: 2, maxSeats: 10, subscriptionInterval: "monthly" };
    const db = seeded(purchase, course, [[schema.lmsPricingOptions, [option, { id: 900, courseId: 42, isActive: true }]]]); mocks.getDb.mockResolvedValue(db); mocks.stripe.prices.retrieve.mockResolvedValue({ active: true, currency: "usd", unit_amount: 2500, recurring: { interval: "month", interval_count: 1 } });
    await caller().createHostedCheckoutSession({ contentType: "course", slug: course.slug, pricingOptionId: 90, seatCount: 4, origin: "https://ignored.test" });
    expect(mocks.stripe.prices.create).toHaveBeenCalledWith(expect.objectContaining({ unit_amount: 2500 }), { stripeAccount: "acct_school7" }); expect(mocks.stripe.checkout.sessions.create.mock.calls[0][0].line_items[0].quantity).toBe(4);
    expect(db.rows(schema.lmsPricingOptions).find((r: any) => r.id === 90).teamStripePriceId).toBe("price_1"); expect(db.rows(schema.lmsPricingOptions).find((r: any) => r.id === 900).stripePriceId).toBeUndefined();
  });
  it("saved price mismatch rejects before a checkout charge", async () => {
    const db = seeded(purchase, { ...course, pricingType: "subscription", subscriptionInterval: "monthly", stripePriceId: "price_foreign" }); mocks.getDb.mockResolvedValue(db); mocks.stripe.prices.retrieve.mockResolvedValue({ active: true, currency: "usd", unit_amount: 1, recurring: { interval: "month", interval_count: 1 } });
    await expect(caller().createHostedCheckoutSession({ contentType: "course", slug: course.slug, origin: "https://ignored.test" })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" }); expect(mocks.stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });
  it("own gateway resolves its authenticated account and never falls back on missing credentials", async () => {
    const own = { ...org, paymentGateway: "own_gateway", ownStripeSecretKeyEncrypted: "sk_test_mock_school7" }; const gateway = await resolveCourse360HostedGateway(own, "sk_test_mock_platform");
    expect(mocks.Stripe).toHaveBeenCalledWith("sk_test_mock_school7", expect.anything()); expect(gateway).toMatchObject({ gateway: "own_gateway", accountId: "acct_own7", requestOptions: {} });
    mocks.Stripe.mockClear(); await expect(resolveCourse360HostedGateway({ ...own, ownStripeSecretKeyEncrypted: null }, "sk_test_mock_platform")).rejects.toMatchObject({ code: "PRECONDITION_FAILED" }); expect(mocks.Stripe).not.toHaveBeenCalled();
  });
});


describe("Course360 hosted preserved free, coupon, bump and admin behavior", () => {
  it.each(["membership", "membership_plan", "bundle", "webinar"])("mounted free %s creates access with no gateway configured", async family => {
    const table = family === "membership" ? schema.memberships : family === "membership_plan" ? schema.membershipPlans : family === "bundle" ? schema.bundles : schema.webinars;
    const row = { id: 51, orgId: 7, slug: "webinar-51", name: "Free Access", title: "Free Access", price: "0.00", currency: "usd", billingInterval: "monthly", isActive: true, isPublished: true, pricingType: "free", courseIds: "[]" };
    const db = memoryDb([[table, [row]], [schema.organizations, [{ ...org, paymentGateway: "own_gateway", ownStripeSecretKeyEncrypted: null }]], [schema.users, [{ id: 101, email: "learner@example.test" }]]]); mocks.getDb.mockResolvedValue(db);
    await expect(caller().createHostedCheckoutSession({ contentType: family as any, slug: family === "webinar" ? row.slug : "51", origin: "https://ignored.test" })).resolves.toMatchObject({ type: "free" });
    expect(db.rows(purchases)[0]).toMatchObject({ orgId: 7, amount: "0.00", status: "completed" }); expect(mocks.Stripe).not.toHaveBeenCalled();
  });
  it("free selected course tier overrides paid base without silently charging", async () => {
    const option = { id: 90, courseId: 41, isActive: true, price: "0.00", pricingType: "free" };
    const db = seeded(purchase, course, [[schema.lmsPricingOptions, [option]]]); mocks.getDb.mockResolvedValue(db);
    await expect(caller().createHostedCheckoutSession({ contentType: "course", slug: course.slug, pricingOptionId: 90, origin: "https://ignored.test" })).resolves.toMatchObject({ type: "free" });
    expect(db.rows(schema.lmsOrders)[0]).toMatchObject({ amount: "0.00", pricingOptionId: 90 }); expect(mocks.Stripe).not.toHaveBeenCalled();
  });
  it("genuine organization coupon uses the school account and settled discount dollars", async () => {
    const coupon = { id: 8, orgId: 7, code: "SAVE", isActive: true, targetScope: "all", discountType: "percentage", discountValue: "30", usedCount: 0 };
    const db = seeded(purchase, course, [[schema.coupons, [coupon]]]); mocks.getDb.mockResolvedValue(db);
    await caller().createHostedCheckoutSession({ contentType: "course", slug: course.slug, promoCode: "save", origin: "https://ignored.test" });
    expect(mocks.stripe.coupons.create).toHaveBeenCalledWith(expect.objectContaining({ percent_off: 30, metadata: expect.objectContaining({ org_id: "7" }) }), { stripeAccount: "acct_school7" });
    const created = db.rows(purchases).find((p: any) => p.id !== "purchase-1"); const paid = session(created, { id: "cs_created", amount_total: 8750 }); mocks.stripe.checkout.sessions.retrieve.mockResolvedValue(paid);
    await reconcile(db, paid); expect(db.rows(schema.lmsOrders)[0].amount).toBe("87.50");
  });
  it("actually charged school/tier bump set grants canonical access atomically", async () => {
    const bump = { id: 9, orgId: 7, triggerProductType: "course", triggerProductId: 41, bumpProductType: "course", bumpProductId: 42, discountedPrice: "10.00", isActive: true, pricingOptionId: null, name: "Bonus" };
    const db = seeded(purchase, course, [[schema.lmsCourses, [course, { ...course, id: 42, slug: "bonus" }]], [schema.orderBumps, [bump]]]); mocks.getDb.mockResolvedValue(db);
    await caller().createHostedCheckoutSession({ contentType: "course", slug: course.slug, selectedBumpIds: [9, 9], origin: "https://ignored.test" });
    const created = db.rows(purchases).find((p: any) => p.id !== "purchase-1"); expect(created.selectedBumpIds).toBe("9"); expect(mocks.stripe.checkout.sessions.create.mock.calls[0][0].line_items).toHaveLength(2);
    const paid = session(created, { id: "cs_created", amount_total: 13500 }); mocks.stripe.checkout.sessions.retrieve.mockResolvedValue(paid);
    await reconcile(db, paid); await reconcile(db, paid); expect(db.rows(schema.lmsEnrollments)).toHaveLength(2); expect(db.rows(schema.lmsOrders)[0].amount).toBe("135.00"); expect(db.rows(schema.orderBumpConversions)).toHaveLength(1);
  });
  it("admin rejects another school's supplied org for config and templates", async () => {
    const db = seeded(); mocks.getDb.mockResolvedValue(db);
    const admin = lmsCheckoutAdminRouter.createCaller({ user: { id: 101, role: "org_admin" } } as any);
    await expect(admin.saveCheckoutPageConfig({ contentType: "course", contentId: 41, orgId: 8 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(admin.listCheckoutTemplates({ orgId: 8 })).rejects.toMatchObject({ code: "FORBIDDEN" }); expect(db.writes).toEqual([]);
  });
  it("admin resolves school-bound content before reading config", async () => {
    const db = seeded(purchase, { ...course, orgId: 8 }); mocks.getDb.mockResolvedValue(db);
    const admin = lmsCheckoutAdminRouter.createCaller({ user: { id: 101, role: "org_admin" } } as any);
    await expect(admin.getCheckoutPageConfig({ contentType: "course", contentId: 41 })).rejects.toMatchObject({ code: "FORBIDDEN" }); expect(db.writes).toEqual([]);
  });
});


describe("Course360 hosted preserved fulfillment and tenant integration", () => {
  it.each(["download", "physical_product", "workshop"])("verified %s settles actual dollars and canonical rows once", async family => {
    const p = { ...purchase, contentType: family, contentId: 51, contentSlug: "item-51" };
    const db = seeded(p, { id: 51, orgId: 7 }); const s = session(p, { amount_total: 4567 }); mocks.stripe.checkout.sessions.retrieve.mockResolvedValue(s);
    await reconcile(db, s); await reconcile(db, s);
    const target = family === "download" ? schema.digitalOrders : family === "physical_product" ? schema.physicalProductOrders : schema.workshopRegistrations;
    expect(db.rows(target)).toHaveLength(1); expect(db.rows(target)[0][family === "download" ? "amount" : "amountPaid"]).toBe("45.67");
    if (family === "download") expect(db.rows(schema.digitalPurchases)).toHaveLength(1);
    expect(db.rows(purchases)[0]).toMatchObject({ amount: "45.67", status: "completed" });
  });
  it("own-gateway mounted confirmation retrieves only on school key and saved account", async () => {
    const p = { ...purchase, gateway: "own_gateway", accountId: "acct_own7" }; const s = session(p);
    const db = seeded(p, course, [[schema.organizations, [{ ...org, paymentGateway: "own_gateway", ownStripeSecretKeyEncrypted: "sk_test_mock_school7" }]]]); mocks.getDb.mockResolvedValue(db); mocks.stripe.checkout.sessions.retrieve.mockResolvedValue(s);
    await expect(caller().confirmHostedCheckout({ sessionId: "cs_1", contentType: "course", slug: course.slug })).resolves.toMatchObject({ success: true });
    expect(mocks.Stripe).toHaveBeenCalledWith("sk_test_mock_school7", expect.anything()); expect(mocks.stripe.checkout.sessions.retrieve).toHaveBeenCalledWith("cs_1", expect.anything(), {});
  });
  it("membership plan course links grant real course-player access in owning school", async () => {
    const p = { ...purchase, contentType: "membership_plan", contentId: 51, contentSlug: "51", pricingType: "subscription" }; const s = session(p, { mode: "subscription", subscription: "sub_new" });
    const db = seeded(p, { id: 51, orgId: 7 }, [[schema.membershipPlanAccess, [{ id: 1, orgId: 7, planId: 51, resourceType: "course", resourceId: 41 }]], [schema.lmsCourses, [course]]]); mocks.stripe.checkout.sessions.retrieve.mockResolvedValue(s);
    await reconcile(db, s); expect(db.rows(schema.lmsEnrollments)[0]).toMatchObject({ orgId: 7, userId: 101, courseId: 41, source: "course360_hosted_membership_plan:51", stripeSubscriptionId: "sub_new" });
    expect(mocks.stripe.subscriptions.retrieve).toHaveBeenCalledWith("sub_new", {}, { stripeAccount: "acct_school7" });
  });
  it("an included bundle grant preserves an existing independent full course purchase", async () => {
    const p = { ...purchase, contentType: "bundle", contentId: 51, contentSlug: "51", pricingType: "subscription" }; const s = session(p, { mode: "subscription", subscription: "sub_new" });
    const row = { id: 9, orgId: 7, userId: 101, courseId: 41, enrollmentType: "full", status: "active", stripeSubscriptionId: "sub_independent", accessExpiresAt: new Date(Date.now() + 172800000), source: "stripe_subscription" };
    const db = seeded(p, { id: 51, orgId: 7, courseIds: "[41]" }, [[schema.lmsCourses, [course]], [schema.lmsEnrollments, [row]]]); mocks.stripe.checkout.sessions.retrieve.mockResolvedValue(s); await reconcile(db, s);
    expect(db.rows(schema.lmsEnrollments)[0]).toMatchObject({ stripeSubscriptionId: "sub_independent", source: "stripe_subscription" });
  });
  it("a recurring bundle uses validated real bundle tiers instead of forcing one time", async () => {
    const db = memoryDb([[schema.bundles, [{ id: 51, orgId: 7, name: "Bundle", price: 100, isActive: true, courseIds: "[]" }]], [schema.bundlePricingOptions, [{ id: 90, bundleId: 51, pricingType: "subscription", price: "125.00", subscriptionInterval: "quarterly", stripePriceId: "price_quarterly" }]], [schema.organizations, [org]]]); mocks.getDb.mockResolvedValue(db);
    mocks.stripe.prices.retrieve.mockResolvedValue({ id: "price_quarterly", active: true, currency: "usd", unit_amount: 12500, recurring: { interval: "month", interval_count: 3 } });
    await caller().createHostedCheckoutSession({ contentType: "bundle", slug: "51", pricingOptionId: 90, origin: "https://ignored.test" });
    expect(mocks.stripe.checkout.sessions.create.mock.calls[0][0]).toMatchObject({ mode: "subscription", line_items: [{ price: "price_quarterly", quantity: 1 }] }); expect(mocks.stripe.prices.create).not.toHaveBeenCalled();
  });
});
