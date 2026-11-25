import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import http from "node:http";
import https from "node:https";
import { getTableColumns, getTableName, SQL } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "../drizzle/schema";
import { embeddedCheckoutSnapshots } from "./lib/embeddedCheckoutTables";

const mocks = vi.hoisted(() => ({ db: null as any, getDb: vi.fn(), user: vi.fn(), create: vi.fn(), retrieve: vi.fn(), cancel: vi.fn(), constructEvent: vi.fn(), charge: vi.fn(), notify: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb, getOrCreateUserByEmail: mocks.user }));
vi.mock("./stripePlans", () => ({ getStripe: () => gateway }));
vi.mock("./_core/env", () => ({ ENV: { stripeSecretKey: "", stripePublishableKey: "", stripeWebhookSecret: "" } }));
vi.mock("./lib/embeddedCheckoutNotifications", () => ({ notifyEmbeddedPurchase: mocks.notify }));
vi.mock("stripe", () => ({ default: class { paymentIntents = { create: mocks.create, retrieve: mocks.retrieve, cancel: mocks.cancel }; webhooks = { constructEvent: mocks.constructEvent }; charges = { retrieve: mocks.charge }; } }));
const gateway = { paymentIntents: { create: mocks.create, retrieve: mocks.retrieve, cancel: mocks.cancel }, webhooks: { constructEvent: mocks.constructEvent }, charges: { retrieve: mocks.charge } };
import { embeddedCheckoutRouter } from "./embeddedCheckoutRouter";
import { handleEmbeddedCheckoutWebhook } from "./embeddedCheckoutWebhook";
import { embeddedEnrollmentDeadlineOpen, hashEmbedded, readEmbeddedManifest } from "./lib/embeddedCheckoutSelection";
import { reconcileEmbeddedPurchase } from "./lib/embeddedCheckoutFulfillment";

const tables = { ...schema, embeddedCheckoutSnapshots };
const dialect = new MySqlDialect();
class MemoryDb {
  rows = new Map<string, any[]>();
  failTable: string | null = null; failProduct: number | null = null;
  locks = 0; mutations = 0; reads = 0; queue: Promise<any> = Promise.resolve();
  table(table: any) { const name = getTableName(table); if (!this.rows.has(name)) this.rows.set(name, []); return this.rows.get(name)!; }
  seed(table: any, rows: any[]) { this.rows.set(getTableName(table), structuredClone(rows)); }
  matches(table: any, row: any, condition?: SQL) {
    if (!condition) return true;
    const { sql, params } = dialect.sqlToQuery(condition);
    const columns = getTableColumns(table); const reverse = Object.fromEntries(Object.entries(columns).map(([key, col]: any) => [col.name, key]));
    let index = 0;
    return [...sql.matchAll(/`[^`]+`\.`([^`]+)`\s*(=\s*\?|IN\s*\('pending', 'failed'\))/g)].every(match => {
      const actual = row[reverse[match[1]]];
      if (match[2].startsWith("IN")) return ["pending", "failed"].includes(actual);
      const wanted = params[index++];
      return typeof actual === "boolean" ? Number(actual) === Number(wanted) : actual === wanted;
    });
  }
  select(fields?: any) {
    this.reads++;
    const db = this; let table: any; let condition: SQL | undefined; let max = Infinity;
    const evaluate = () => db.table(table).filter(row => db.matches(table, row, condition)).slice(0, max).map(row => fields ? Object.fromEntries(Object.entries(fields).map(([key, col]: any) => [key, row[Object.entries(getTableColumns(table)).find(([, value]) => value === col)?.[0] ?? key]])) : structuredClone(row));
    const chain: any = { from(t: any) { table = t; return chain; }, where(c: SQL) { condition = c; return chain; }, limit(n: number) { max = n; return chain; }, for(mode: string) { expect(mode).toBe("update"); db.locks++; return chain; }, then(resolve: any, reject: any) { return Promise.resolve().then(evaluate).then(resolve, reject); } };
    return chain;
  }
  insert(table: any) { return { values: async (values: any) => {
    const cols = getTableColumns(table);
    for (const key of Object.keys(values)) if (!(key in cols)) throw new Error(`Unknown column ${getTableName(table)}.${key}`);
    if (this.failTable === getTableName(table) && (this.failProduct == null || values.productId === this.failProduct)) throw new Error("Injected grant failure");
    const rows = this.table(table); const id = rows.reduce((max, row) => Math.max(max, row.id ?? 0), 0) + 1;
    if (table === embeddedCheckoutSnapshots && rows.some(row => row.purchaseId === values.purchaseId)) throw new Error("Duplicate snapshot");
    rows.push({ id, ...structuredClone(values) }); this.mutations++;
    return [{ insertId: id }];
  } }; }
  update(table: any) { return { set: (values: any) => ({ where: async (condition: SQL) => { this.mutations++; for (const row of this.table(table)) if (this.matches(table, row, condition)) Object.assign(row, structuredClone(values)); } }) }; }
  delete(table: any) { return { where: async (condition: SQL) => {
    if (this.failTable === getTableName(table)) throw new Error("Injected revocation failure");
    this.mutations++; this.rows.set(getTableName(table), this.table(table).filter(row => !this.matches(table, row, condition)));
  } }; }
  transaction(fn: any) {
    const run = async () => { const backup = structuredClone(this.rows); try { return await fn(this); } catch (error) { this.rows = backup; throw error; } };
    const result = this.queue.then(run); this.queue = result.catch(() => {}); return result;
  }
}
let db: MemoryDb;
let intent: any;
let event: any;
const guestCtx = () => ({ req: { hostname: "school.course360.app", headers: { host: "school.course360.app" } }, res: {}, user: null } as any);
const payload = (more: any = {}) => ({ email: "guest@example.com", productName: "Course", productType: "course" as const, productId: 10, productPrice: 99, origin: "https://school.course360.app", ...more });
function caller(user: any = null) { return embeddedCheckoutRouter.createCaller({ ...guestCtx(), user }); }
function response() { const res: any = { code: 200, body: null, status(n: number) { res.code = n; return res; }, json(body: any) { res.body = body; return res; } }; return res; }
async function webhook(signature: any = "valid", body: any = Buffer.from("fixture")) { const res = response(); await handleEmbeddedCheckoutWebhook({ headers: signature === undefined ? {} : { "stripe-signature": signature }, body } as any, res); return res; }
function course(more: any = {}) { return { id: 10, orgId: 1, title: "School course", type: "course", status: "public", price: "99.00", currency: "usd", pricingType: "one_time", isFree: false, enrollmentClosed: false, enrollmentCloseDate: null, ...more }; }
async function paid(more: any = {}) {
  const result = await caller().createPaymentIntent(payload(more));
  event = { id: "evt_signed", type: "payment_intent.succeeded", livemode: false, data: { object: intent } };
  return result;
}

beforeEach(() => {
  vi.clearAllMocks();
  const noNetwork = () => { throw new Error("External network calls are prohibited in embedded repair tests"); };
  vi.spyOn(http, "request").mockImplementation(noNetwork as any);
  vi.spyOn(https, "request").mockImplementation(noNetwork as any);
  vi.stubGlobal("fetch", vi.fn(noNetwork));
  vi.stubEnv("DATABASE_URL", ""); vi.stubEnv("STRIPE_SECRET_KEY", ""); vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
  vi.stubEnv("COURSE360_STRIPE_SECRET_KEY", "sk_test_mock_only"); vi.stubEnv("VITE_COURSE360_STRIPE_PUBLISHABLE_KEY", "pk_test_mock_only"); vi.stubEnv("COURSE360_EMBEDDED_STRIPE_WEBHOOK_SECRET", "whsec_mock_only");
  db = new MemoryDb(); mocks.db = db; mocks.getDb.mockImplementation(async () => db);
  db.seed(schema.organizations, [{ id: 1, slug: "school", isActive: true }]);
  db.seed(schema.lmsCourses, [course()]); db.seed(schema.orgPaymentSettings, []);
  mocks.user.mockResolvedValue({ user: { id: 7, email: "guest@example.com", name: "Guest" }, isNew: true, resetToken: "not-an-auth-session" });
  mocks.notify.mockResolvedValue(undefined);
  mocks.create.mockImplementation(async (params: any) => { intent = { id: "pi_fixture", object: "payment_intent", client_secret: "pi_fixture_secret_mock", status: "succeeded", amount_received: params.amount, livemode: false, latest_charge: "ch_fixture", ...params }; return intent; });
  mocks.retrieve.mockImplementation(async () => intent);
  mocks.cancel.mockResolvedValue({});
  mocks.constructEvent.mockImplementation((_body: any, signature: string) => { if (signature !== "valid") throw new Error("Invalid signature"); return event; });
  mocks.charge.mockImplementation(async () => ({ id: "ch_fixture", object: "charge", payment_intent: "pi_fixture", amount: intent.amount, amount_refunded: event?.type === "charge.refunded" ? intent.amount : 0, currency: "usd", refunded: event?.type === "charge.refunded", livemode: false }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("mounted Course360 embedded selection and client contract", () => {
  it("accepts exact client payload without orgId and persists catalog dollars with separate immutable snapshot", async () => {
    const result = await paid({ lmsCourseId: 10 });
    expect(result.publishableKey).toBe("pk_test_mock_only"); expect(result.amount).toBe(99);
    expect(mocks.create.mock.calls[0][0].amount).toBe(9900);
    expect(db.table(schema.funnelPurchases)[0]).toMatchObject({ orgId: 1, amount: "99.00", fulfillmentCourseId: 10, status: "pending", orderBumps: null });
    expect(readEmbeddedManifest(db.table(embeddedCheckoutSnapshots)[0].manifest)).toMatchObject({ orgId: 1, productId: 10, buyerId: null });
    await expect(caller().getPostPurchaseWorkflow({ productId: 10, productType: "course" })).rejects.toThrow("Checkout unavailable");
  });
  it.each([
    { productPrice: 0.5 }, { orgId: 2 }, { productId: 99 }, { fulfillmentCourseId: 11 }, { fulfillmentDownloadId: 11 },
    { selectedBumps: [{ title: "Fake", price: 1, productId: 11 }] }, { additionalAccess: [{ type: "course", productId: 11 }] },
    { promoCode: "ARBITRARY" }, { origin: "https://other.course360.app" },
  ])("rejects tampered checkout before Stripe/write: %j", async (change) => {
    await expect(caller().createPaymentIntent(payload(change))).rejects.toThrow();
    expect(mocks.create).not.toHaveBeenCalled(); expect(db.mutations).toBe(0);
  });
  it("rejects cross-school ownership and recurring memberships/course terms before charging", async () => {
    db.seed(schema.lmsCourses, [course({ orgId: 2 })]);
    await expect(caller().createPaymentIntent(payload())).rejects.toThrow();
    db.seed(schema.lmsCourses, [course({ pricingType: "subscription" })]);
    await expect(caller().createPaymentIntent(payload())).rejects.toThrow("subscription checkout");
    await expect(caller().createPaymentIntent(payload({ productType: "membership" }))).rejects.toThrow("native checkout");
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("never silently falls back from school-direct gateway and requires dedicated endpoint secret", async () => {
    db.seed(schema.orgPaymentSettings, [{ orgId: 1, stripeSecretKey: "sk_test_tenant_mock" }]);
    await expect(caller().createPaymentIntent(payload())).rejects.toThrow("tenant webhook");
    db.seed(schema.orgPaymentSettings, []); vi.stubEnv("COURSE360_EMBEDDED_STRIPE_WEBHOOK_SECRET", "");
    await expect(caller().createPaymentIntent(payload())).rejects.toThrow("endpoint signing secret");
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("uses real digital_product_prices, rejects missing/ambiguous/inactive prices", async () => {
    db.seed(schema.digitalProducts, [{ id: 20, orgId: 1, title: "Download", visibility: "published", enrollmentClosed: false }]);
    await expect(caller().createPaymentIntent(payload({ productType: "download", productId: 20 }))).rejects.toThrow("active one-time");
    db.seed(schema.digitalProductPrices, [{ id: 21, productId: 20, amount: "12.00", currency: "USD", type: "one_time", isActive: true }]);
    const result = await caller().createPaymentIntent(payload({ productType: "download", productId: 20, productPrice: 12, priceId: 21 }));
    expect(result.amount).toBe(12); expect(intent.amount).toBe(1200);
  });
  it("honors saved page price/bonus and rejects arbitrary client bonus or unapproved bump", async () => {
    const data = { products: [{ type: "course", productId: 10, price: 30 }], additionalAccess: [{ type: "course", productId: 11 }], orderBumps: [{ title: "Add course", productType: "course", productId: 11, price: 5 }] };
    db.seed(schema.pageBuilderPages, [{ id: 30, orgId: 1, isPublished: true, blocksJson: JSON.stringify([{ id: "checkout", type: "embedded_checkout", data }]) }]);
    db.seed(schema.lmsCourses, [course(), course({ id: 11, title: "Bonus" })]);
    const result = await paid({ sourceLandingPageId: 30, checkoutBlockId: "checkout", productPrice: 30, addedBumpIndexes: [0] });
    expect(result.amount).toBe(35);
    expect(JSON.parse(db.table(schema.funnelPurchases)[0].orderBumps)).toEqual([{ title: "Add course", price: 5, productId: 11, productType: "course" }]);
    expect(readEmbeddedManifest(db.table(embeddedCheckoutSnapshots)[0].manifest).targets).toHaveLength(3);
    await expect(caller().createPaymentIntent(payload({ sourceLandingPageId: 30, productPrice: 30, addedBumpIndexes: [1] }))).rejects.toThrow("order bump");
  });
  it("uses Eastern enrollment deadline through end of day and blocks stale/closed products", async () => {
    expect(embeddedEnrollmentDeadlineOpen(new Date("2026-08-17T23:59:59.999Z"), new Date("2026-08-18T03:59:59.998Z"))).toBe(true);
    expect(embeddedEnrollmentDeadlineOpen(new Date("2026-08-17T23:59:59.999Z"), new Date("2026-08-18T04:00:00Z"))).toBe(false);
    db.seed(schema.lmsCourses, [course({ enrollmentClosed: true })]);
    await expect(caller().createPaymentIntent(payload())).rejects.toThrow("unavailable");
  });
  it("saved manual zero-priced product cannot borrow caller catalog target for unauthorized free access", async () => {
    db.seed(schema.pageBuilderPages, [{ id: 30, orgId: 1, isPublished: true, blocksJson: JSON.stringify([{ type: "embedded_checkout", data: { products: [{ type: "course", price: 0 }] } }]) }]);
    await expect(caller().processFreeOrder(payload({ sourceLandingPageId: 30, productPrice: 0 }))).rejects.toThrow("catalog target");
    expect(db.mutations).toBe(0);
  });
  it("production gateway does not allow preview test-key fallback", async () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("APP_URL", "https://course360.app");
    await expect(caller().createPaymentIntent(payload())).rejects.toThrow("live gateway keys");
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

describe("verified confirmation and school entitlements", () => {
  it("rejects guest without proof and another buyer even with guessed intent", async () => {
    const result = await paid();
    await expect(caller().confirmPayment({ paymentIntentId: result.paymentIntentId })).rejects.toThrow("another buyer");
    await expect(caller({ id: 99, email: "different@example.com" }).confirmPayment({ paymentIntentId: result.paymentIntentId, confirmationToken: result.confirmationToken })).rejects.toThrow("another buyer");
    expect(mocks.retrieve).not.toHaveBeenCalled();
  });
  it.each(["processing", "requires_payment_method", "requires_action"])("refuses %s PaymentIntent before grants", async status => {
    const result = await paid(); intent.status = status;
    await expect(caller().confirmPayment({ paymentIntentId: result.paymentIntentId, confirmationToken: result.confirmationToken })).rejects.toThrow("not settled");
    expect(db.table(schema.lmsEnrollments)).toHaveLength(0); expect(db.table(schema.funnelPurchases)[0].status).toBe("pending");
  });
  it("resolves new guest from returned user, persists buyer and creates actual School enrollment once under concurrent replay", async () => {
    const result = await paid();
    await Promise.all([caller().confirmPayment({ paymentIntentId: result.paymentIntentId, confirmationToken: result.confirmationToken }), caller().confirmPayment({ paymentIntentId: result.paymentIntentId, confirmationToken: result.confirmationToken })]);
    expect(db.table(schema.funnelPurchases)[0]).toMatchObject({ userId: 7, status: "completed" });
    expect(db.table(schema.lmsEnrollments)).toEqual([expect.objectContaining({ orgId: 1, userId: 7, courseId: 10, status: "active", source: "embedded_purchase:1" })]);
    expect(db.table(schema.courseEnrollments)).toHaveLength(0); expect(db.table(schema.mediaAccessGrants)).toHaveLength(0);
    expect(db.locks).toBeGreaterThanOrEqual(1);
    await expect(caller().getPostPurchaseWorkflow({ paymentIntentId: result.paymentIntentId, confirmationToken: result.confirmationToken, productId: 11 })).rejects.toThrow("Workflow product mismatch");
  });
  it("free paid-item rejection and actual free grant return driver insert ID; retry resumes same failed purchase", async () => {
    await expect(caller().processFreeOrder(payload())).rejects.toThrow("not free");
    expect(db.mutations).toBe(0);
    db.seed(schema.lmsCourses, [course({ price: "0.00", isFree: true })]);
    db.failTable = getTableName(schema.lmsEnrollments);
    await expect(caller().processFreeOrder(payload({ productPrice: 0 }))).rejects.toThrow("Injected grant");
    expect(db.table(schema.funnelPurchases)).toHaveLength(1); expect(db.table(schema.funnelPurchases)[0].status).toBe("pending");
    db.failTable = null;
    const result = await caller().processFreeOrder(payload({ productPrice: 0 }));
    expect(result.purchaseId).toBe(1); expect(db.table(schema.funnelPurchases)).toHaveLength(1); expect(db.table(schema.lmsEnrollments)).toHaveLength(1);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("bundle failure on child 2 rolls back all grants and replay completes every child exactly once", async () => {
    db.seed(schema.digitalBundles, [{ id: 40, orgId: 1, title: "Bundle", status: "published", originalPrice: "99.00", discountPrice: "0.00", currency: "usd" }]);
    db.seed(schema.digitalProducts, [20, 21].map(id => ({ id, orgId: 1, visibility: "published", enrollmentClosed: false })));
    db.seed(schema.digitalBundleItems, [{ bundleId: 40, productId: 20 }, { bundleId: 40, productId: 21 }]);
    await paid({ productType: "bundle", productId: 40 });
    db.failTable = getTableName(schema.digitalPurchases); db.failProduct = 21;
    expect((await webhook()).code).toBe(500); expect(db.table(schema.digitalPurchases)).toHaveLength(0); expect(db.table(schema.digitalBundlePurchases)).toHaveLength(0);
    db.failTable = null; expect((await webhook()).code).toBe(200); expect((await webhook()).code).toBe(200);
    expect(db.table(schema.digitalPurchases)).toHaveLength(2); expect(db.table(schema.digitalBundlePurchases)).toHaveLength(1);
    expect(db.table(schema.digitalPurchases)[0]).toMatchObject({ userId: 7, stripePaymentIntentId: "pi_fixture", stripeCheckoutSessionId: "embedded_purchase:1" });
  });
});

describe("raw signed webhook, refund linkage and retry monotonicity", () => {
  it("missing endpoint secret, signature, wrong signature and malformed/raw body fail without DB", async () => {
    vi.stubEnv("COURSE360_EMBEDDED_STRIPE_WEBHOOK_SECRET", ""); expect((await webhook()).code).toBe(503);
    vi.stubEnv("COURSE360_EMBEDDED_STRIPE_WEBHOOK_SECRET", "whsec_mock_only");
    expect((await webhook("", Buffer.from("bad"))).code).toBe(400);
    expect((await webhook("wrong")).code).toBe(400); expect((await webhook("valid", { type: "fake" })).code).toBe(400);
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
  it.each([{ account: "acct_other" }, { livemode: true }])("wrong gateway or mode never grants: %j", async change => {
    await paid(); Object.assign(event, change); expect((await webhook()).code).toBe(500); expect(db.table(schema.lmsEnrollments)).toHaveLength(0);
  });
  it("signed evt_test prefix does not bypass settlement; unresolved guest is retryable HTTP 500", async () => {
    await paid(); event.id = "evt_test_signed"; mocks.user.mockResolvedValue({ user: undefined });
    expect((await webhook()).code).toBe(500); expect(db.table(schema.funnelPurchases)[0].status).toBe("pending");
  });
  it("partial refund retains access, full refund revokes only linked guest purchase and success replay cannot restore it", async () => {
    const result = await paid(); expect((await webhook()).code).toBe(200);
    db.table(schema.lmsEnrollments).push({ id: 99, orgId: 1, courseId: 10, userId: 7, source: "manual", status: "active" });
    event.type = "charge.refunded"; event.data.object = { id: "ch_fixture", object: "charge", payment_intent: "pi_fixture", livemode: false };
    mocks.charge.mockResolvedValueOnce({ id: "ch_fixture", payment_intent: "pi_fixture", amount: 9900, amount_refunded: 100, refunded: false, currency: "usd", livemode: false });
    expect((await webhook()).body.partialRefund).toBe(true); expect(db.table(schema.funnelPurchases)[0].status).toBe("completed");
    expect((await webhook()).code).toBe(200); expect(db.table(schema.funnelPurchases)[0].status).toBe("refunded");
    expect(db.table(schema.lmsEnrollments)[0].status).toBe("cancelled"); expect(db.table(schema.lmsEnrollments)[1].status).toBe("active");
    event.type = "payment_intent.succeeded"; event.data.object = intent; expect((await webhook()).code).toBe(200);
    expect(db.table(schema.lmsEnrollments)[0].status).toBe("cancelled");
    await expect(caller().confirmPayment({ paymentIntentId: result.paymentIntentId, confirmationToken: result.confirmationToken })).rejects.toThrow("refunded");
  });
  it("foreign charge linkage rejects before revoke; revocation failure rolls back financial status and retries", async () => {
    db.seed(schema.digitalProducts, [{ id: 20, orgId: 1, title: "File", visibility: "published" }]);
    db.seed(schema.digitalProductPrices, [{ id: 21, productId: 20, amount: "99.00", currency: "USD", type: "one_time", isActive: true }]);
    await paid({ productType: "download", productId: 20 }); expect((await webhook()).code).toBe(200);
    event.type = "charge.refunded"; event.data.object = { id: "ch_fixture", object: "charge", payment_intent: "pi_fixture", livemode: false };
    mocks.charge.mockResolvedValueOnce({ id: "ch_fixture", payment_intent: "pi_other", amount: 9900, amount_refunded: 9900, refunded: true, currency: "usd", livemode: false });
    expect((await webhook()).code).toBe(500); expect(db.table(schema.digitalPurchases)).toHaveLength(1);
    db.failTable = getTableName(schema.digitalPurchases); expect((await webhook()).code).toBe(500); expect(db.table(schema.funnelPurchases)[0].status).toBe("completed");
    db.failTable = null; expect((await webhook()).code).toBe(200); expect(db.table(schema.digitalPurchases)).toHaveLength(0); expect(db.table(schema.funnelPurchases)[0].status).toBe("refunded");
  });
  it("stale payment_failed event cannot downgrade completed/refunded status", async () => {
    await paid(); expect((await webhook()).code).toBe(200);
    event.type = "payment_intent.payment_failed"; expect((await webhook()).code).toBe(200);
    expect(db.table(schema.funnelPurchases)[0].status).toBe("completed");
  });
  it("refund at Stripe before success delivery cannot newly grant even while refund webhook is delayed", async () => {
    await paid();
    mocks.charge.mockResolvedValue({ id: "ch_fixture", object: "charge", payment_intent: "pi_fixture", amount: 9900, amount_refunded: 9900, currency: "usd", refunded: true, livemode: false });
    expect((await webhook()).code).toBe(200);
    expect(db.table(schema.funnelPurchases)[0].status).toBe("refunded");
    expect(db.table(schema.lmsEnrollments)).toHaveLength(0);
  });
  it.each([
    { amount_received: 50 }, { amount: 50 }, { currency: "eur" }, { livemode: true },
    { metadata: { type: "embedded_checkout_purchase", org_id: "2" } },
  ])("mismatched settlement never grants: %j", async change => {
    await paid(); Object.assign(intent, change);
    expect((await webhook()).code).toBe(500); expect(db.table(schema.lmsEnrollments)).toHaveLength(0);
  });
  it("missing signature header does not reach verifier or any DB mutation", async () => {
    const res = response();
    await handleEmbeddedCheckoutWebhook({ headers: {}, body: Buffer.from("fixture") } as any, res);
    expect(res.code).toBe(400); expect(mocks.constructEvent).not.toHaveBeenCalled(); expect(mocks.getDb).not.toHaveBeenCalled();
  });
  it("real schema SQL uses required amount and School access columns; snapshot table remains school-bound", () => {
    const sqlDb = drizzle.mock();
    const query = sqlDb.insert(schema.funnelPurchases).values({ orgId: 1, email: "buyer@example.com", productName: "Course", amount: "99.00" }).toSQL();
    expect(query.sql).toContain("`amount`"); expect(query.params).toContain("99.00"); expect(query.sql).not.toContain("amount_paid");
    expect(Object.keys(getTableColumns(schema.lmsEnrollments))).toEqual(expect.arrayContaining(["orgId", "userId", "courseId", "source"]));
    expect(Object.keys(getTableColumns(embeddedCheckoutSnapshots))).toEqual(expect.arrayContaining(["orgId", "purchaseId", "manifest"]));
  });
});
