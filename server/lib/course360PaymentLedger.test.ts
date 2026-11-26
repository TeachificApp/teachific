import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import type Stripe from "stripe";
import { orgMembers, organizations, users } from "../../drizzle/schema";
import * as tables from "./course360PaymentTables";
import { aggregateCourse360PaymentAppAccess, configureCourse360PaymentLedger, createCourse360PaymentCheckout, reserveCourse360PaymentCheckout, processCourse360PaymentVerifiedEvent, completeCourse360PaymentSchoolCheckout, projectCourse360PaymentAppSubscription, withCourse360PaymentAppCheckout, getCourse360PaymentAppAccess, persistCourse360PaymentOwnerClaim, claimCourse360PaymentSchoolOwner, setCourse360PaymentManualRole, course360PaymentAppTrialEligible } from "./course360PaymentLedger";

// Deterministic in-memory Drizzle contract fixture: no actual SQL/DB connection.
const dialect = new MySqlDialect();
function fakeDb() {
  let rows: Record<string, any[]> = {};
  const journal: any[] = [];
  let tail = Promise.resolve();
  function bucket(table: any) { const name = getTableName(table); return rows[name] ??= []; }
  function matches(table: any, row: any, condition: any): boolean {
    if (!condition) return true;
    const query = dialect.sqlToQuery(condition); const clauses = query.sql.match(/`[^`]+`\.`([^`]+)` = \?/g) ?? [];
    return clauses.every((clause, i) => {
      const dbName = clause.match(/\.`([^`]+)`/)![1];
      const key = Object.keys(table).find(key => table[key]?.name === dbName)!;
      return row[key] === query.params[i];
    });
  }
  const db: any = {
    rows: () => rows, journal,
    seed(table: any, values: any[]) { rows[getTableName(table)] = values; },
    transaction: async (work: any) => {
      const prev = tail; let release!: () => void; tail = new Promise(r => release = r); await prev;
      const backup = structuredClone(rows);
      try { return await work(db); } catch (e) { rows = backup; throw e; } finally { release(); }
    },
    insert: (table: any) => ({ values: (values: any) => {
      const apply = (duplicate: boolean) => {
        const list = bucket(table); const existing = list.find(r => r.id === values.id);
        if (existing) { if (!duplicate) throw new Error("duplicate"); return [{ affectedRows: 0 }]; }
        const defaults: Record<string, any> = {
          course360_payment_slots: { revision: 0, reservationId: null }, course360_payment_locks: { revision: 0 },
          course360_payment_inbox: { state: "pending", attempts: 0, claimToken: null, leaseUntil: null },
          course360_payment_checkouts: { state: "reserved", sessionId: null, subscriptionId: null, customerId: null, sessionUrl: null, completedAt: null, createdAt: new Date() },
          course360_payment_manual_grants: { expiresAt: null, revokedAt: null }, course360_payment_owner_claims: { state: "pending" },
        };
        list.push({ ...defaults[getTableName(table)], ...values }); journal.push({ insert: getTableName(table), values }); return [{ affectedRows: 1 }];
      };
      return { then: (resolve: any, reject: any) => Promise.resolve().then(() => apply(false)).then(resolve, reject), onDuplicateKeyUpdate: async () => apply(true) };
    } }),
    update: (table: any) => ({ set: (values: any) => ({ where: async (condition: any) => {
      journal.push({ update: getTableName(table), values, where: dialect.sqlToQuery(condition) }); let count = 0;
      for (const row of bucket(table).filter(r => matches(table, r, condition))) {
        for (const [key, value] of Object.entries(values)) row[key] = value && typeof value === "object" && "queryChunks" in value ? (row[key] ?? 0) + 1 : value;
        count++;
      }
      return [{ affectedRows: count }];
    } }) }),
    select: () => { let table: any; let condition: any; let joined = false;
      const apply = () => joined ? bucket(orgMembers).filter(r => bucket(organizations).some(o => o.id === r.orgId && o.isActive)) : bucket(table).filter(r => matches(table, r, condition));
      const chain: any = { from: (t: any) => { table = t; return chain; }, innerJoin: () => { joined = true; return chain; }, where: (c: any) => { condition = c; return chain; }, limit: async (n: number) => apply().slice(0, n), then: (resolve: any, reject: any) => Promise.resolve(apply()).then(resolve, reject) };
      return chain;
    },
  };
  db.seed(orgMembers, [{ id: 1, userId: 10, orgId: 7 }]); db.seed(organizations, [{ id: 7, isActive: true, ownerId: 10 }]);
  return db;
}
let db: ReturnType<typeof fakeDb>;
let provider: any;
const base = () => ({ orgId: 7, userId: 10, product: "platform" as const, selection: "starter", interval: "monthly" as const, trialEligible: true,
  params: { mode: "subscription" as const, payment_method_types: ["card" as const], line_items: [{ price: "price_starter", quantity: 1 }],
    metadata: { org_id: "7", user_id: "10", plan: "starter", interval: "monthly" }, subscription_data: { metadata: { org_id: "7", user_id: "10", plan: "starter", interval: "monthly" } }, success_url: "https://course360.app/billing", cancel_url: "https://course360.app/billing" } });
function appInput() {
  const input: any = base(); input.product = "creator"; input.selection = "desktop";
  input.params.metadata = { org_id: "7", user_id: "10", product_type: "creator", access_tier: "desktop", interval: "monthly" };
  input.params.subscription_data.metadata = { ...input.params.metadata }; return input;
}
function subscription(session: any, override: any = {}): any { return { id: "sub_one", livemode: false, customer: "cus_one", status: "active", cancel_at_period_end: false,
  metadata: { ...session.metadata }, items: { data: [{ price: { id: "price_starter" }, quantity: 1, current_period_start: Math.floor(Date.now()/1000), current_period_end: Math.floor(Date.now()/1000) + 3600 }] }, ...override }; }
function event(id = "evt_fixture", extra: any = {}): any { return { id, type: "customer.subscription.updated", livemode: false, created: 1700000000, data: { object: { id: "sub_one" } }, ...extra }; }
beforeEach(() => {
  db = fakeDb(); configureCourse360PaymentLedger({ getDb: async () => db, accountId: "acct_fixture", livemode: false });
  provider = { checkout: { sessions: { create: vi.fn(async (params: any) => ({ id: "cs_one", url: "https://checkout.stripe.test/mock", status: "open", livemode: false, metadata: params.metadata })), retrieve: vi.fn() } } };
});
describe("durable school checkout CAS", () => {
  it("serializes concurrent same-selection reservations into one durable identity", async () => {
    const [a,b] = await Promise.all([reserveCourse360PaymentCheckout(base()), reserveCourse360PaymentCheckout(base())]);
    expect(a.id).toBe(b.id); expect(db.rows().course360_payment_checkouts).toHaveLength(1);
    expect(db.journal.some(j => j.where?.sql.includes('`revision` = ?'))).toBe(true);
  });
  it("rejects different competing plan, user, or origin despite same school", async () => {
    await reserveCourse360PaymentCheckout(base());
    await expect(reserveCourse360PaymentCheckout({ ...base(), selection: "pro" })).rejects.toThrow("already pending");
    db.rows().org_members.push({ id: 2, userId: 11, orgId: 7 });
    await expect(reserveCourse360PaymentCheckout({ ...base(), userId: 11 })).rejects.toThrow("already pending");
  });
  it.each(["starter", "builder", "pro"])("preserves 14-day card-backed %s checkout and stable provider idempotency", async plan => {
    const input = base(); input.selection = plan;
    await createCourse360PaymentCheckout(input, provider);
    const [params, options] = provider.checkout.sessions.create.mock.calls[0];
    expect(params.subscription_data.trial_period_days).toBe(14); expect(params.payment_method_collection).toBe("always"); expect(params.payment_method_types).toEqual(["card"]);
    expect(options.idempotencyKey).toBe(`course360-checkout:${params.metadata.payment_reservation_id}`);
  });
  it("reuses provider session after restart and never shifts idempotency time windows", async () => {
    const input = base(); const first = await createCourse360PaymentCheckout(input, provider);
    configureCourse360PaymentLedger({ getDb: async () => db, accountId: "acct_fixture", livemode: false });
    provider.checkout.sessions.retrieve.mockResolvedValue(first);
    await createCourse360PaymentCheckout(input, provider); expect(provider.checkout.sessions.create).toHaveBeenCalledTimes(1);
  });
  it("retains reservation on provider failure and reuses immutable spec/key", async () => {
    provider.checkout.sessions.create.mockRejectedValueOnce(new Error("network unknown"));
    await expect(createCourse360PaymentCheckout(base(), provider)).rejects.toThrow("network unknown");
    await createCourse360PaymentCheckout(base(), provider);
    expect(provider.checkout.sessions.create.mock.calls[0]).toEqual(provider.checkout.sessions.create.mock.calls[1]);
  });
  it("never releases an unresolved expired reservation just by wall clock", async () => {
    const record = await reserveCourse360PaymentCheckout(base()); db.rows().course360_payment_checkouts[0].expiresAt = new Date(0);
    await expect(createCourse360PaymentCheckout(base(), provider)).rejects.toThrow("reconciliation required"); expect(provider.checkout.sessions.create).not.toHaveBeenCalled();
    expect(db.rows().course360_payment_slots[0].reservationId).toBe(record.id);
  });
  it("expiration must be current provider-confirmed and never resets trial history", async () => {
    const session = await createCourse360PaymentCheckout(base(), provider);
    provider.checkout.sessions.retrieve.mockResolvedValue({ ...session, status: "expired" });
    await expect(createCourse360PaymentCheckout(base(), provider)).rejects.toThrow("no longer open");
    const next = await reserveCourse360PaymentCheckout(base()); expect(next.trial).toBe(false);
  });
  it("stale session completion cannot replace a newer school slot", async () => {
    const open = await createCourse360PaymentCheckout(base(), provider); const session: any = { ...open, status: "complete", mode: "subscription", customer: "cus_one", subscription: "sub_one" };
    db.rows().course360_payment_slots[0].reservationId = "newer-reservation";
    await expect(completeCourse360PaymentSchoolCheckout(session, subscription(session))).rejects.toThrow("reference mismatch");
    expect(db.rows().org_subscriptions).toBeUndefined();
  });
  it("rejects a completed session with an unapproved catalog price", async () => {
    const open = await createCourse360PaymentCheckout(base(), provider); const session: any = { ...open, status: "complete", mode: "subscription", customer: "cus_one", subscription: "sub_one" };
    await expect(completeCourse360PaymentSchoolCheckout(session, subscription(session, { items: { data: [{ price: { id: "price_unapproved" }, quantity: 1 }] } }))).rejects.toThrow("catalog price mismatch");
  });
  it("anonymous signup remains checkout-first and reservation-bound", async () => {
    const input: any = base(); input.orgId = null; input.userId = null; input.product = "signup"; input.email = "owner@example.test";
    input.params.metadata = { type: "platform_trial_signup", signup_email: input.email, plan: "starter", interval: "monthly" }; input.params.subscription_data.metadata = { ...input.params.metadata };
    await createCourse360PaymentCheckout(input, provider);
    const params = provider.checkout.sessions.create.mock.calls[0][0];
    expect(params.subscription_data.trial_period_days).toBe(14); expect(params.payment_method_collection).toBe("always"); expect(db.rows().users).toBeUndefined();
  });
  it("completion validates immutable customer/session and rolls back mismatch", async () => {
    const open = await createCourse360PaymentCheckout(base(), provider); const session: any = { ...open, status: "complete", mode: "subscription", customer: "cus_one", subscription: "sub_one" };
    await expect(completeCourse360PaymentSchoolCheckout({ ...session, customer: "cus_wrong" }, subscription(session))).rejects.toThrow("reference mismatch");
    expect(db.rows().course360_payment_checkouts[0].state).toBe("open");
    await completeCourse360PaymentSchoolCheckout(session, subscription(session));
    expect(db.rows().course360_payment_checkouts[0].state).toBe("completed"); expect(db.rows().org_subscriptions[0].stripeSubscriptionId).toBe("sub_one");
  });
});
describe("app immutable ledger and school-source aggregation", () => {
  it("requires Checkout completion before lifecycle projection", async () => {
    await expect(projectCourse360PaymentAppSubscription({ orgId: 7, userId: 10, product: "creator", tier: "desktop", entitledTier: "desktop", subscription: subscription({ metadata: {} }) })).rejects.toThrow("Checkout completion required");
  });
  it("persists account/customer/user/school/product and rejects rebinding", async () => {
    const open = await createCourse360PaymentCheckout(appInput(), provider); const session: any = { ...open, status: "complete", mode: "subscription", customer: "cus_one", subscription: "sub_one" }; const sub = subscription(session);
    const projection: any = { orgId: 7, userId: 10, product: "creator", tier: "desktop", entitledTier: "desktop", subscription: sub, checkoutSessionId: session.id };
    await withCourse360PaymentAppCheckout(session, () => projectCourse360PaymentAppSubscription(projection));
    expect(db.rows().course360_payment_app_subscriptions[0]).toMatchObject({ accountId: "acct_fixture", orgId: 7, userId: 10, customerId: "cus_one", subscriptionId: "sub_one" });
    await expect(projectCourse360PaymentAppSubscription({ ...projection, userId: 11 })).rejects.toThrow("identity mismatch");
    await expect(projectCourse360PaymentAppSubscription({ ...projection, subscription: { ...sub, customer: "cus_other" } })).rejects.toThrow("identity mismatch");
    expect(db.journal.some(j => j.update === "users")).toBe(false);
  });
  it("duplicate billing blocks all nonterminal app subscriptions", async () => {
    const open = await createCourse360PaymentCheckout(appInput(), provider); const session: any = { ...open, status: "complete", mode: "subscription", customer: "cus_one", subscription: "sub_one" };
    await withCourse360PaymentAppCheckout(session, () => projectCourse360PaymentAppSubscription({ orgId: 7, userId: 10, product: "creator", tier: "desktop", entitledTier: "desktop", subscription: subscription(session), checkoutSessionId: session.id }));
    await expect(reserveCourse360PaymentCheckout(appInput())).rejects.toThrow("subscription already exists");
  });
  it("canceled A cannot erase B or independent manual desktop source", () => {
    const end = new Date(Date.now() + 3600000);
    const records = [{ tier: "bundle", rawStatus: "canceled", currentPeriodEnd: end, trialEnd: null }, { tier: "web", rawStatus: "active", currentPeriodEnd: end, trialEnd: null }];
    expect(aggregateCourse360PaymentAppAccess(records, [{ tier: "desktop", expiresAt: null, revokedAt: null }])).toMatchObject({ tier: "bundle", isPaid: true, hasManualGrant: true });
    expect(aggregateCourse360PaymentAppAccess(records.slice(0,1), [{ tier: "desktop", expiresAt: null, revokedAt: null }])).toMatchObject({ tier: "desktop", isPaid: false, isActive: true });
  });
  it("exact-school access excludes school B, unknown legacy globals and expired trial/paid periods", async () => {
    db.seed(tables.course360PaymentAppSubscriptions, [{ orgId: 8, userId: 10, product: "creator", accountId: "acct_fixture", livemode: false, tier: "bundle", rawStatus: "active", currentPeriodEnd: new Date(Date.now()+3600000), trialEnd: null }]);
    db.seed(users, [{ id: 10, creatorAccess: "bundle" }]);
    expect(await getCourse360PaymentAppAccess(7,10,"creator")).toMatchObject({ tier: "none", isPaid: false });
    expect(aggregateCourse360PaymentAppAccess([{ tier: "bundle", rawStatus: "trialing", trialEnd: new Date(0), currentPeriodEnd: new Date(Date.now()+100000) }], [])).toMatchObject({ tier: "none", isPaid: false });
  });
});
describe("manual provenance and historical trial protection", () => {
  it("explicit school-bound grant is valid but never classified as paid", async () => {
    db.seed(users, [{ id: 99, role: "site_admin" }]);
    await setCourse360PaymentManualRole({ orgId: 7, userId: 10, product: "creator", tier: "desktop", actorId: 99, source: "platform-admin", reason: "Reviewed manual grant" });
    expect(await getCourse360PaymentAppAccess(7,10,"creator")).toMatchObject({ tier: "desktop", isPaid: false, hasManualGrant: true });
    const grant = db.rows().course360_payment_manual_grants[0]; expect(grant).toMatchObject({ actorId: 99, source: "platform-admin", reason: "Reviewed manual grant" });
  });
  it("manual role revoke leaves unrelated/newer/manual other-school sources intact", async () => {
    db.seed(users, [{ id: 99, role: "site_owner" }]);
    db.seed(tables.course360PaymentManualGrants, [{ id: "a", orgId: 7, userId: 10, product: "creator", tier: "web", source: "platform-admin", revokedAt: null, expiresAt: null }, { id: "b", orgId: 7, userId: 10, product: "creator", tier: "desktop", source: "support-approved", revokedAt: null, expiresAt: null }, { id: "c", orgId: 8, userId: 10, product: "creator", tier: "bundle", source: "platform-admin", revokedAt: null, expiresAt: null }]);
    await setCourse360PaymentManualRole({ orgId: 7, userId: 10, product: "creator", tier: "none", actorId: 99, source: "platform-admin", reason: "Explicit school revoke" });
    expect(db.rows().course360_payment_manual_grants.find((g:any) => g.id === "b").revokedAt).toBeNull(); expect(db.rows().course360_payment_manual_grants.find((g:any) => g.id === "c").revokedAt).toBeNull();
    expect(await getCourse360PaymentAppAccess(7,10,"creator")).toMatchObject({ tier: "desktop", isPaid: false });
  });
  it("historical unknown global access prevents repeat intro but is not a paid ledger grant", async () => {
    db.seed(users, [{ id: 10, creatorAccess: "bundle", creatorTrialEndsAt: null }]);
    expect(await course360PaymentAppTrialEligible(10,"creator")).toBe(false);
    expect(await getCourse360PaymentAppAccess(7,10,"creator")).toMatchObject({ tier: "none", isPaid: false });
    expect(db.rows().users[0].creatorAccess).toBe("bundle");
  });
  it("ordinary member cannot forge a manual grant actor", async () => {
    db.seed(users, [{ id: 10, role: "user" }]);
    await expect(setCourse360PaymentManualRole({ orgId: 7, userId: 10, product: "creator", tier: "bundle", actorId: 10, source: "platform-admin", reason: "forged" })).rejects.toThrow("administrator");
  });
});
describe("durable verified inbox claiming/retry", () => {
  it("claims once, records completion and deduplicates after process bootstrap", async () => {
    const work = vi.fn().mockResolvedValue(undefined);
    expect(await processCourse360PaymentVerifiedEvent(event(), "platform-account", work)).toBe("completed");
    configureCourse360PaymentLedger({ getDb: async () => db, accountId: "acct_fixture", livemode: false });
    expect(await processCourse360PaymentVerifiedEvent(event(), "platform-account", work)).toBe("duplicate"); expect(work).toHaveBeenCalledTimes(1);
  });
  it("failed required work is durably retained and retried without falsely completed marker", async () => {
    const work = vi.fn().mockRejectedValueOnce(new Error("required grant failed")).mockResolvedValue(undefined);
    await expect(processCourse360PaymentVerifiedEvent(event(), "platform-account", work)).rejects.toThrow("required grant failed");
    expect(db.rows().course360_payment_inbox[0]).toMatchObject({ state: "failed", attempts: 1, lastError: "required grant failed" });
    await processCourse360PaymentVerifiedEvent(event(), "platform-account", work);
    expect(db.rows().course360_payment_inbox[0]).toMatchObject({ state: "completed", attempts: 2 });
  });
  it("does not bypass signed evt_test event processing", async () => {
    const work = vi.fn().mockResolvedValue(undefined); await processCourse360PaymentVerifiedEvent(event("evt_test_real"), "platform-account", work); expect(work).toHaveBeenCalledOnce();
  });
  it("rejects account/mode/payload mutation without running work", async () => {
    const work = vi.fn().mockResolvedValue(undefined);
    await expect(processCourse360PaymentVerifiedEvent(event("evt_one", { account: "acct_other" }), "platform-account", work)).rejects.toThrow("account/mode");
    await expect(processCourse360PaymentVerifiedEvent(event("evt_one", { livemode: true }), "platform-account", work)).rejects.toThrow("account/mode");
    await processCourse360PaymentVerifiedEvent(event(), "platform-account", work);
    await expect(processCourse360PaymentVerifiedEvent(event("evt_fixture", { type: "other.type" }), "platform-account", work)).rejects.toThrow("payload changed"); expect(work).toHaveBeenCalledOnce();
  });
  it("reclaims crashed lease but denies a nonexpired processing claim", async () => {
    await processCourse360PaymentVerifiedEvent(event(), "platform-account", async () => {});
    const row = db.rows().course360_payment_inbox[0]; row.state = "processing"; row.claimToken = "crashed"; row.leaseUntil = new Date(Date.now()+10000);
    await expect(processCourse360PaymentVerifiedEvent(event(), "platform-account", async () => {})).rejects.toThrow("already claimed");
    db.rows().course360_payment_inbox[0].leaseUntil = new Date(0); await processCourse360PaymentVerifiedEvent(event(), "platform-account", async () => {});
    expect(db.rows().course360_payment_inbox[0].attempts).toBe(2);
  });
});
describe("existing identity verified owner claim", () => {
  it("does not authenticate/reset/promote existing identity and requires normal auth + verified email", async () => {
    await persistCourse360PaymentOwnerClaim(db, { orgId: 7, userId: 10, email: "owner@example.test", sessionId: "cs_paid", subscriptionId: "sub_paid" });
    db.seed(users, [{ id: 10, email: "owner@example.test", emailVerified: false, role: "user", resetToken: "original" }]);
    const claimId = db.rows().course360_payment_owner_claims[0].id;
    await expect(claimCourse360PaymentSchoolOwner({ claimId, authenticatedUserId: 11 })).rejects.toThrow("verified account");
    await expect(claimCourse360PaymentSchoolOwner({ claimId, authenticatedUserId: 10 })).rejects.toThrow("verified account");
    db.rows().users[0].emailVerified = true;
    expect(await claimCourse360PaymentSchoolOwner({ claimId, authenticatedUserId: 10 })).toBe(7);
    expect(db.rows().users[0]).toMatchObject({ role: "user", resetToken: "original" }); expect(db.rows().user_active_org).toBeUndefined();
  });
});


describe("paid-school claim one-time and exact-owner guard", () => {
  it("a replay cannot regrant removed school membership or switch the active school", async () => {
    await persistCourse360PaymentOwnerClaim(db, { orgId: 7, userId: 10, email: "owner@example.test", sessionId: "cs_paid", subscriptionId: "sub_paid" });
    db.seed(users, [{ id: 10, email: "owner@example.test", emailVerified: true, role: "user", resetToken: "original" }]);
    const claimId = db.rows().course360_payment_owner_claims[0].id;
    await claimCourse360PaymentSchoolOwner({ claimId, authenticatedUserId: 10 });
    db.seed(orgMembers, []);
    await expect(claimCourse360PaymentSchoolOwner({ claimId, authenticatedUserId: 10 })).rejects.toThrow("no longer pending");
    expect(db.rows().org_members).toEqual([]);
    expect(db.rows().user_active_org).toBeUndefined();
    expect(db.rows().users[0]).toMatchObject({ role: "user", resetToken: "original" });
  });
  it("rejects a pending claim after school ownership changed", async () => {
    await persistCourse360PaymentOwnerClaim(db, { orgId: 7, userId: 10, email: "owner@example.test", sessionId: "cs_paid", subscriptionId: "sub_paid" });
    db.seed(users, [{ id: 10, email: "owner@example.test", emailVerified: true }]);
    db.seed(organizations, [{ id: 7, isActive: true, ownerId: 11 }]);
    const claimId = db.rows().course360_payment_owner_claims[0].id;
    await expect(claimCourse360PaymentSchoolOwner({ claimId, authenticatedUserId: 10 })).rejects.toThrow("school ownership mismatch");
    expect(db.rows().course360_payment_owner_claims[0].state).toBe("pending");
    expect(db.rows().user_active_org).toBeUndefined();
  });
  it("rejects a verified account whose email no longer matches the claim", async () => {
    await persistCourse360PaymentOwnerClaim(db, { orgId: 7, userId: 10, email: "owner@example.test", sessionId: "cs_paid", subscriptionId: "sub_paid" });
    db.seed(users, [{ id: 10, email: "different@example.test", emailVerified: true }]);
    const claimId = db.rows().course360_payment_owner_claims[0].id;
    await expect(claimCourse360PaymentSchoolOwner({ claimId, authenticatedUserId: 10 })).rejects.toThrow("verified account");
    expect(db.rows().course360_payment_owner_claims[0].state).toBe("pending");
  });
});
