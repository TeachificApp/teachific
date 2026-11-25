import Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { digitalBundleItems, digitalBundlePurchases, digitalBundles, digitalProducts, digitalPurchases, lmsEnrollments, organizations, orgMembers, orgSubscriptions, platformTrialSignupFulfillments, userActiveOrg, users } from "../drizzle/schema";
import { getOrgSubscriptionPeriodDates, getOrgSubscriptionTrialDates } from "./lib/orgSubscriptionTrialDates";
import { course360AppSubscriptionTier } from "./lib/course360WebhookAppEntitlement";
import { normalizeCourse360StripeStatus, invoiceSubscriptionId, configureCourse360AppSubscriptionProjector, serializeCourse360Subscription } from "./lib/course360WebhookLifecycle";
import { getEffectiveSubscriptionPlan } from "../shared/subscriptionEntitlement";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(), getUserByEmail: vi.fn(), getOrCreateUserByEmail: vi.fn(),
  retrieveSubscription: vi.fn(), retrieveInvoice: vi.fn(), retrievePrice: vi.fn(), updateSubscription: vi.fn(),
  retrieveCharge: vi.fn(), retrieveDispute: vi.fn(),
  constructEvent: vi.fn(), upsert: vi.fn(), createEnrollment: vi.fn(), getEnrollment: vi.fn(), getCourse: vi.fn(),
  sendEmail: vi.fn(), bump: vi.fn(), provider: vi.fn(),
  env: { isProduction: false, stripeSecretKey: "sk_test_course360_mock", stripeWebhookSecret: "whsec_course360_synthetic", ownerOpenId: "" },
}));
vi.mock("./_core/env", () => ({ ENV: mocks.env }));
vi.mock("./db", () => ({ getDb: mocks.getDb, getUserByEmail: mocks.getUserByEmail, getOrCreateUserByEmail: mocks.getOrCreateUserByEmail }));
vi.mock("./stripePlans", () => ({ getStripe: () => ({
  webhooks: { constructEvent: mocks.constructEvent }, subscriptions: { retrieve: mocks.retrieveSubscription, update: mocks.updateSubscription },
  invoices: { retrieve: mocks.retrieveInvoice }, prices: { retrieve: mocks.retrievePrice },
  charges: { retrieve: mocks.retrieveCharge }, disputes: { retrieve: mocks.retrieveDispute },
}), PLAN_LIMITS: {} }));
vi.mock("./lmsDb", () => ({ upsertOrgSubscription: mocks.upsert, createEnrollment: mocks.createEnrollment, getEnrollment: mocks.getEnrollment, getCourseById: mocks.getCourse }));
vi.mock("./sendgrid", () => ({ sendEmail: mocks.sendEmail }));
vi.mock("./_core/email", () => ({ buildOrgAdminNewPurchaseEmail: vi.fn(), sendEmailViaOrg: vi.fn().mockResolvedValue(undefined), buildFunnelPurchaseConfirmationEmail: vi.fn(() => ({ subject: "mock", htmlBody: "mock" })) }));
vi.mock("./_core/notification", () => ({ notifyOwner: vi.fn().mockResolvedValue(undefined) }));
vi.mock("./lib/emailWorkflowEngine", () => ({ emitEmailWorkflowEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock("./lib/orderBumpCheckout", () => ({ fulfillOrderBumpPurchase: mocks.bump }));
vi.mock("./routers/downloadsRouter", () => ({ sendPurchaseConfirmationEmail: vi.fn().mockResolvedValue(undefined) }));
vi.mock("./lib/fulfillBookvaultOrder", () => ({ fulfillBookvaultOrder: mocks.provider }));
vi.mock("./lib/fulfillPrintfulOrder", () => ({ fulfillPrintfulOrder: mocks.provider }));
vi.mock("./lib/fulfillPrintifyOrder", () => ({ fulfillPrintifyOrder: mocks.provider }));
import router, { fulfillPlatformTrialSignup, fulfillNativePhysicalProductCheckout } from "./stripeWebhookRoutes";

const signingClient = new Stripe("sk_test_only_local_signature");
const callback = (router as any).stack.find((layer: any) => layer.route?.path === "/webhook").route.stack.at(-1).handle;
const nowSeconds = Math.floor(Date.now() / 1000);
function subscription(extra: Record<string, unknown> = {}) {
  return { id: "sub_school", customer: "cus_school", status: "active", cancel_at_period_end: false,
    metadata: { org_id: "7", plan: "pro", user_id: "101" },
    items: { data: [{ id: "si_school", price: { id: "price_school" }, current_period_start: nowSeconds, current_period_end: nowSeconds + 3600 }] }, ...extra };
}
function event(type: string, object: unknown, extra: Record<string, unknown> = {}) {
  return { id: "evt_course360_fixture", type, created: nowSeconds, livemode: false, data: { object }, ...extra };
}
async function dispatch(payload: unknown, signature: "valid" | "missing" | "invalid" = "valid") {
  const body = Buffer.from(JSON.stringify(payload));
  const sig = signature === "valid" ? signingClient.webhooks.generateTestHeaderString({ payload: body.toString(), secret: mocks.env.stripeWebhookSecret })
    : signature === "invalid" ? "invalid" : undefined;
  const response = { statusCode: 200, body: undefined as unknown,
    status(code: number) { this.statusCode = code; return this; }, json(data: unknown) { this.body = data; return this; } };
  await callback({ headers: { "stripe-signature": sig }, body }, response);
  return response;
}
function schoolDb() {
  const updates: Array<{ table: unknown; values: unknown }> = [];
  return { updates, select: vi.fn(() => { const chain: any = { from: () => chain, where: () => chain, limit: async () => [{ stripeSubscriptionId: "sub_school", orgId: 7 }] }; return chain; }),
    update: vi.fn(table => ({ set: (values: unknown) => ({ where: async () => { updates.push({ table, values }); } }) })) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.env.isProduction = false;
  mocks.env.stripeWebhookSecret = "whsec_course360_synthetic";
  mocks.env.stripeSecretKey = "sk_test_course360_mock";
  // Any real credential inherited from the workspace is deliberately ignored.
  vi.stubEnv("COURSE360_STRIPE_SECRET_KEY", "");
  vi.stubEnv("COURSE360_STRIPE_WEBHOOK_SECRET", "");
  vi.stubEnv("DATABASE_URL", "");
  mocks.constructEvent.mockImplementation((body, signature, secret) => signingClient.webhooks.constructEvent(body, signature, secret));
  mocks.retrieveSubscription.mockResolvedValue(subscription());
  mocks.retrieveInvoice.mockResolvedValue({ id: "in_school", status: "paid" });
  mocks.retrievePrice.mockResolvedValue({ metadata: { course360_tier: "pro" } });
  mocks.updateSubscription.mockResolvedValue({});
  mocks.sendEmail.mockResolvedValue(undefined);
  mocks.bump.mockResolvedValue(undefined);
  mocks.getDb.mockResolvedValue(schoolDb());
  mocks.getUserByEmail.mockResolvedValue({ id: 101, name: "Buyer", email: "buyer@example.test" });
  mocks.getCourse.mockResolvedValue({ id: 31, orgId: 7, title: "Course", slug: "course" });
  mocks.upsert.mockResolvedValue(undefined);
});

describe("Course360 webhook authenticated ingress", () => {
  it.each([false, true])("requires signatures in production=%s", async production => {
    mocks.env.isProduction = production;
    for (const signature of ["missing", "invalid"] as const) expect((await dispatch(event("checkout.session.completed", {}), signature)).statusCode).toBe(400);
    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(mocks.retrieveSubscription).not.toHaveBeenCalled();
    expect((await dispatch(event("course360.ignored", {}))).statusCode).toBe(200);
  });
  it("requires a signing secret and configured platform mode", async () => {
    mocks.env.stripeWebhookSecret = "";
    expect((await dispatch(event("course360.ignored", {}), "missing")).statusCode).toBe(500);
    mocks.env.stripeWebhookSecret = "whsec_course360_synthetic";
    mocks.env.stripeSecretKey = "";
    expect((await dispatch(event("course360.ignored", {}))).statusCode).toBe(500);
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
  it.each([{}, { id: null }, { type: null }, { data: null }, { data: "bad" }, { data: { object: null } }, { data: { object: [] } }, { livemode: "false" }, { created: null }])("rejects malformed authenticated envelopes %j without callback rejection", async malformed => {
    expect((await dispatch({ ...event("course360.ignored", {}), ...malformed, ...(Object.keys(malformed).length ? {} : { id: undefined }) })).statusCode).toBe(400);
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
  it("rejects incompatible mode and connected-account events before retrieval or writes", async () => {
    expect((await dispatch(event("customer.subscription.updated", subscription(), { livemode: true }))).statusCode).toBe(400);
    expect((await dispatch(event("customer.subscription.updated", subscription(), { account: "acct_other" }))).statusCode).toBe(400);
    expect(mocks.retrieveSubscription).not.toHaveBeenCalled();
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
  it("does not use a test event ID prefix to bypass real lifecycle dispatch", async () => {
    expect((await dispatch(event("customer.subscription.updated", subscription(), { id: "evt_test_real_signed" }))).statusCode).toBe(200);
    expect(mocks.retrieveSubscription).toHaveBeenCalledWith("sub_school");
  });
  it("prefers a Course360 endpoint secret and mode over preview fallbacks", async () => {
    vi.stubEnv("COURSE360_STRIPE_WEBHOOK_SECRET", "whsec_course360_custom_synthetic");
    vi.stubEnv("COURSE360_STRIPE_SECRET_KEY", "sk_live_course360_synthetic");
    const payload = JSON.stringify(event("course360.ignored", {}, { livemode: true }));
    const signature = signingClient.webhooks.generateTestHeaderString({ payload, secret: "whsec_course360_custom_synthetic" });
    const res: any = { statusCode: 200, status(code: number) { this.statusCode = code; return this; }, json() { return this; } };
    await callback({ body: Buffer.from(payload), headers: { "stripe-signature": signature } }, res);
    expect(res.statusCode).toBe(200);
    expect(mocks.constructEvent).toHaveBeenCalledWith(expect.any(Buffer), signature, "whsec_course360_custom_synthetic");
  });
});

describe("Course360 current-state lifecycle", () => {
  const refs = [
    { parent: { type: "subscription_details", subscription_details: { subscription: "sub_school" } } },
    { parent: { type: "subscription_details", subscription_details: { subscription: { id: "sub_school" } } } },
    { subscription: "sub_school" }, { subscription: { id: "sub_school" } },
  ];
  it.each(refs)("routes modern and legacy invoice references %j", async ref => {
    for (const type of ["invoice.paid", "invoice.payment_failed"]) {
      expect((await dispatch(event(type, { id: "in_school", billing_reason: "subscription_cycle", ...ref }))).statusCode).toBe(200);
    }
    expect(mocks.retrieveSubscription).toHaveBeenCalledTimes(2);
    expect(mocks.retrieveInvoice).toHaveBeenCalledTimes(2);
    expect(mocks.upsert).toHaveBeenCalledWith(7, expect.objectContaining({ status: "active" }));
  });
  it("intentionally ignores modern non-subscription parents and missing references", async () => {
    expect(invoiceSubscriptionId({ parent: { type: "quote_details" }, subscription: "sub_school" })).toBeNull();
    await dispatch(event("invoice.paid", { id: "in_quote", parent: { type: "quote_details" }, billing_reason: "subscription_cycle" }));
    await dispatch(event("invoice.payment_failed", { id: "in_manual", parent: null }));
    expect(mocks.retrieveSubscription).not.toHaveBeenCalled();
  });
  it.each(["active", "trialing", "past_due", "unpaid", "canceled", "incomplete", "incomplete_expired", "paused", "unexpected"])("fails closed for actual dispatch of status %s", async status => {
    mocks.retrieveSubscription.mockResolvedValue(subscription({ status }));
    expect((await dispatch(event("customer.subscription.updated", subscription({ status: "active" })))).statusCode).toBe(200);
    const projection = mocks.upsert.mock.calls[0][1];
    expect(projection.status).toBe(normalizeCourse360StripeStatus(status));
    expect(projection.rawStripeStatus).toBe(status);
    expect(getEffectiveSubscriptionPlan("pro", projection.status)).toBe(["active", "trialing"].includes(status) ? "pro" : "free");
  });
  it("does not resurrect paid access when active snapshots arrive after current cancellation", async () => {
    await dispatch(event("customer.subscription.updated", subscription()));
    mocks.retrieveSubscription.mockResolvedValue(subscription({ status: "canceled" }));
    await dispatch(event("customer.subscription.deleted", subscription({ status: "canceled" })));
    await dispatch(event("customer.subscription.updated", subscription({ status: "active" })));
    expect(mocks.upsert.mock.calls.map(call => call[1].status)).toEqual(["active", "cancelled", "cancelled"]);
    expect(mocks.upsert.mock.calls.at(-1)?.[1].plan).toBe("pro");
  });
  it("late failed invoice after recovery stays active; late paid invoice after cancellation stays canceled", async () => {
    const db = schoolDb(); mocks.getDb.mockResolvedValue(db);
    const metadata = { org_id: "7", content_type: "course", content_id: "31", user_id: "101" };
    mocks.retrieveSubscription.mockResolvedValue(subscription({ metadata, status: "active" }));
    await dispatch(event("invoice.payment_failed", { id: "in_school", subscription: "sub_school" }));
    mocks.retrieveSubscription.mockResolvedValue(subscription({ metadata, status: "canceled" }));
    await dispatch(event("invoice.paid", { id: "in_school", subscription: "sub_school", billing_reason: "subscription_cycle" }));
    expect(db.updates).toEqual([{ table: lmsEnrollments, values: { status: "active" } }, { table: lmsEnrollments, values: { status: "cancelled" } }]);
  });
  it("replaced organization subscription is ignored", async () => {
    mocks.retrieveSubscription.mockResolvedValue(subscription({ id: "sub_old" }));
    await dispatch(event("customer.subscription.updated", { id: "sub_old" }));
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("projects legacy/modern finite periods and never manufactures trial dates", () => {
    expect(getOrgSubscriptionPeriodDates({ current_period_start: 100, current_period_end: 200, items: { data: [{}] } }).currentPeriodEnd?.getTime()).toBe(200000);
    expect(getOrgSubscriptionPeriodDates({ items: { data: [{ id: "a", current_period_end: 100 }, { id: "b", current_period_end: 300 }] } }, "b").currentPeriodEnd?.getTime()).toBe(300000);
    expect(getOrgSubscriptionPeriodDates({ items: { data: [{ current_period_end: 300 }, { current_period_end: 100 }] } }).currentPeriodEnd?.getTime()).toBe(100000);
    for (const value of [undefined, null, NaN, Infinity, -1, 1e30]) expect(getOrgSubscriptionPeriodDates({ current_period_end: value }).currentPeriodEnd).toBeNull();
    expect(getOrgSubscriptionTrialDates({ status: "active" }).trialEndsAt).toBeNull();
  });
  it("serializes local same-subscription work even after failure", async () => {
    const order: string[] = []; let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    const first = serializeCourse360Subscription("sub_serialized", async () => { order.push("a"); await pending; throw new Error("retry"); });
    const caught = first.catch(() => undefined);
    const second = serializeCourse360Subscription("sub_serialized", async () => { order.push("b"); });
    await Promise.resolve(); await Promise.resolve(); expect(order).toEqual(["a"]);
    release(); await caught; await second; expect(order).toEqual(["a", "b"]);
  });
});

describe("Course360 app lifecycle manual-grant safety", () => {
  it("missing school binding fails for retry without altering legacy/manual fields", async () => {
    const db = schoolDb(); mocks.getDb.mockResolvedValue(db);
    mocks.retrieveSubscription.mockResolvedValue(subscription({ metadata: { product_type: "studio", user_id: "101", access_tier: "bundle" } }));
    expect((await dispatch(event("customer.subscription.deleted", { id: "sub_school" }))).statusCode).toBe(500);
    expect(db.update).not.toHaveBeenCalled();
  });
  it("a school-bound app event still retries when durable ledger integration is absent", async () => {
    const db = schoolDb(); mocks.getDb.mockResolvedValue(db);
    mocks.retrieveSubscription.mockResolvedValue(subscription({ metadata: { product_type: "studio", user_id: "101", org_id: "7", access_tier: "bundle" } }));
    expect((await dispatch(event("customer.subscription.updated", { id: "sub_school" }))).statusCode).toBe(500);
    expect(db.update).not.toHaveBeenCalled();
  });
  it.each(["studio", "creator", "quiz_creator"])("passes school-bound %s cancellation to ledger with none, never NULL", async product => {
    const projector = vi.fn().mockResolvedValue(undefined); configureCourse360AppSubscriptionProjector(projector);
    const db = schoolDb(); mocks.getDb.mockResolvedValue(db);
    mocks.retrieveSubscription.mockResolvedValue(subscription({ status: "canceled", metadata: { product_type: product, user_id: "101", org_id: "7", access_tier: "bundle" } }));
    expect((await dispatch(event("customer.subscription.deleted", { id: "sub_school" }))).statusCode).toBe(200);
    expect(projector).toHaveBeenCalledWith(expect.objectContaining({ orgId: 7, userId: 101, product, entitledTier: "none" }));
    expect(db.update).not.toHaveBeenCalled();
  });
  it("retryable projector failures are not swallowed", async () => {
    configureCourse360AppSubscriptionProjector(vi.fn().mockRejectedValue(new Error("ledger unavailable")));
    mocks.retrieveSubscription.mockResolvedValue(subscription({ metadata: { product_type: "creator", user_id: "101", org_id: "7", access_tier: "bundle" } }));
    expect((await dispatch(event("customer.subscription.updated", { id: "sub_school" }))).statusCode).toBe(500);
  });
  it("expired trials and terminal or unknown states never become lifetime paid tiers", () => {
    const now = new Date(200000);
    expect(course360AppSubscriptionTier({ metadata: { access_tier: "bundle" }, status: "trialing", trial_end: 201 }, now)).toBe("bundle");
    expect(course360AppSubscriptionTier({ metadata: { access_tier: "bundle" }, status: "trialing", trial_end: 199 }, now)).toBe("none");
    for (const status of ["past_due", "unpaid", "canceled", "paused", "incomplete", "unexpected"]) expect(course360AppSubscriptionTier({ metadata: { access_tier: "bundle" }, status, current_period_end: 300 }, now)).toBe("none");
    expect(course360AppSubscriptionTier({ metadata: { access_tier: "bundle" }, status: "active", current_period_end: 300 }, now)).toBe("bundle");
    expect(course360AppSubscriptionTier({ metadata: { access_tier: "bundle" }, status: "active", current_period_end: 199 }, now)).toBe("none");
  });
  it("app retrieval failure during checkout returns 500 instead of acknowledged loss", async () => {
    mocks.retrieveSubscription.mockRejectedValue(new Error("retrieval failed"));
    expect((await dispatch(event("checkout.session.completed", { id: "cs_app", mode: "subscription", subscription: "sub_app", customer: "cus_school", metadata: { product_type: "studio", access_tier: "web", user_id: "101", org_id: "7" } }))).statusCode).toBe(500);
  });
});

describe("Course360 required fulfillment retries", () => {
  it("unintegrated hosted school subscriptions cannot fall through to platform plan upgrades", async () => {
    const metadata = { type: "course360_hosted_checkout_v1", org_id: "7", content_type: "course", content_id: "31", user_id: "101" };
    expect((await dispatch(event("checkout.session.completed", { id: "cs_hosted", mode: "subscription", subscription: "sub_school", customer: "cus_school", metadata }))).statusCode).toBe(500);
    mocks.retrieveSubscription.mockResolvedValue(subscription({ metadata }));
    expect((await dispatch(event("customer.subscription.updated", { id: "sub_school" }))).statusCode).toBe(500);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("unsettled one-time payment is denied before any database work", async () => {
    expect((await dispatch(event("checkout.session.completed", { id: "cs_unpaid", mode: "payment", payment_status: "unpaid", metadata: { type: "digital_download", org_id: "7", product_id: "31", user_id: "101" } }))).statusCode).toBe(500);
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
  it("physical provider failure results propagate for retry; already-submitted handoff is idempotent", async () => {
    let selection = 0;
    const db: any = { select: () => { const result = selection++ % 2 === 0 ? [{ id: 31, orgId: 7, bookvaultEnabled: true }] : [{ id: 91 }]; const chain: any = { from: () => chain, where: () => chain, limit: async () => result }; return chain; } };
    mocks.getDb.mockResolvedValue(db);
    const session = { id: "cs_physical", mode: "payment", customer_details: { email: "buyer@example.test" }, metadata: { type: "physical_product", product_id: "31", org_id: "7", user_id: "101" } } as any;
    mocks.provider.mockResolvedValue({ submitted: false, error: "provider transient" });
    await expect(fulfillNativePhysicalProductCheckout(session)).rejects.toThrow("provider transient");
    mocks.provider.mockResolvedValue({ submitted: false, skipped: true, reason: "already_submitted" });
    await expect(fulfillNativePhysicalProductCheckout(session)).resolves.toBeUndefined();
  });
  it("late charge success snapshot persists the current refunded state", async () => {
    let persisted: any; let duplicate: any;
    const db: any = { select: () => { const chain: any = { from: () => chain, where: () => chain, limit: async () => [{ id: 7 }] }; return chain; },
      insert: () => ({ values: (values: any) => { persisted = values; return { onDuplicateKeyUpdate: async (options: any) => { duplicate = options.set; } }; } }) };
    mocks.getDb.mockResolvedValue(db);
    mocks.retrieveCharge.mockResolvedValue({ id: "ch_school", amount: 1000, amount_refunded: 1000, paid: true, application_fee_amount: 0, currency: "usd", transfer_data: { destination: "acct_school" } });
    expect((await dispatch(event("charge.succeeded", { id: "ch_school", amount_refunded: 0 }))).statusCode).toBe(200);
    expect(persisted.status).toBe("refunded"); expect(persisted.amountRefunded).toBe(1000);
    expect(duplicate).toEqual({ status: "refunded", amountRefunded: 1000 });
  });
  it("course grant failure produces retriable 500", async () => {
    mocks.getEnrollment.mockResolvedValue(null); mocks.createEnrollment.mockRejectedValue(new Error("write unavailable"));
    expect((await dispatch(event("checkout.session.completed", { id: "cs_course", mode: "payment", payment_status: "paid", customer_details: { email: "buyer@example.test" }, metadata: { type: "course_purchase", course_id: "31", org_id: "7" } }))).statusCode).toBe(500);
  });
  it.each(["digital_download", "digital_bundle", "membership"])("DB outage cannot acknowledge %s fulfillment", async type => {
    mocks.getDb.mockResolvedValue(null);
    mocks.retrieveSubscription.mockResolvedValue(subscription({ metadata: { org_id: "7", membership_plan_id: "31" } }));
    const res = await dispatch(event("checkout.session.completed", { id: "cs_required", mode: type === "membership" ? "subscription" : "payment", payment_status: "paid", subscription: "sub_school", customer_details: { email: "buyer@example.test" }, metadata: { type, org_id: "7", product_id: "31", bundle_id: "31", membership_plan_id: "31", user_id: "101" } }));
    expect(res.statusCode).toBe(500);
  });
  it("bundle retry resumes partial grants and inserts marker only after all children", async () => {
    const granted = new Set<number>(); let marked = false; let failSecond = true;
    const writes: string[] = [];
    function sqlParameters(value: any): unknown[] {
      if (!value || typeof value !== "object") return [];
      if ("value" in value) return [value.value];
      return (value.queryChunks ?? []).flatMap(sqlParameters);
    }
    const db: any = { select: () => {
      let table: unknown; let selectedProduct: number | undefined;
      const rows = () => table === digitalBundles || table === digitalProducts ? [{ id: 31 }]
        : table === digitalBundlePurchases ? (marked ? [{ id: 1 }] : [])
        : table === digitalBundleItems ? [{ productId: 51 }, { productId: 52 }]
        : table === digitalPurchases ? (selectedProduct && granted.has(selectedProduct) ? [{ id: selectedProduct }] : []) : [];
      const chain: any = { from(next: unknown) { table = next; return chain; }, where(condition: unknown) { selectedProduct = sqlParameters(condition).find(value => value === 51 || value === 52) as number | undefined; return chain; }, limit: async () => rows(), then(resolve: any, reject: any) { return Promise.resolve(rows()).then(resolve, reject); } };
      return chain;
    }, insert: (table: unknown) => ({ values: async (values: any) => {
      if (table === digitalPurchases) {
        if (values.productId === 52 && failSecond) { failSecond = false; throw new Error("second child transient"); }
        if (granted.has(values.productId)) throw new Error("Child grant must not be repeated");
        granted.add(values.productId); writes.push(`child:${values.productId}`);
      } else if (table === digitalBundlePurchases) { marked = true; writes.push("marker"); }
      return [{ insertId: 1 }];
    } }), update: () => ({ set: () => ({ where: () => Promise.resolve() }) }) };
    mocks.getDb.mockResolvedValue(db);
    const fixture = event("checkout.session.completed", { id: "cs_bundle", mode: "payment", payment_status: "paid", customer_details: { email: "buyer@example.test" }, metadata: { type: "digital_bundle", bundle_id: "31", org_id: "7" } });
    expect((await dispatch(fixture)).statusCode).toBe(500);
    expect(marked).toBe(false); expect(granted).toEqual(new Set([51]));
    expect((await dispatch(fixture)).statusCode).toBe(200);
    expect(granted).toEqual(new Set([51, 52])); expect(writes).toEqual(["child:51", "child:52", "marker"]);
  });
});

describe("Course360 checkout-first existing-email school binding", () => {
  it("creates a purchased school but preserves an existing user's global role and active school", async () => {
    const inserts: Array<{ table: unknown; values: any }> = []; const updates: Array<{ table: unknown; values: any }> = [];
    const existingUser = { id: 101, role: "user", name: "Existing", email: "buyer@example.test" };
    let orgInserted = false;
    const db: any = { transaction: async (work: any) => work(db),
      select: () => { let table: unknown; const chain: any = { from(next: unknown) { table = next; return chain; }, where() { return chain; }, limit: async () => table === users ? [existingUser] : table === organizations && orgInserted ? [{ id: 7, slug: "existing-school" }] : [] }; return chain; },
      insert: (table: unknown) => ({ values: (values: any) => { inserts.push({ table, values }); if (table === organizations) orgInserted = true; const promise: any = Promise.resolve([{ insertId: 1 }]); promise.onDuplicateKeyUpdate = () => Promise.resolve(); return promise; } }),
      update: (table: unknown) => ({ set: (values: any) => ({ where: async () => { updates.push({ table, values }); } }) }),
    };
    mocks.getDb.mockResolvedValue(db);
    mocks.retrieveSubscription.mockResolvedValue(subscription({ status: "trialing", metadata: {}, trial_end: nowSeconds + 1000 }));
    await fulfillPlatformTrialSignup({ id: "cs_existing", mode: "subscription", customer: "cus_school", subscription: "sub_school", customer_details: { email: "buyer@example.test" }, metadata: { type: "platform_trial_signup", plan: "pro" } } as any);
    expect(inserts.some(insert => insert.table === organizations)).toBe(true);
    expect(inserts.some(insert => insert.table === orgMembers && insert.values.orgId === 7 && insert.values.userId === 101)).toBe(true);
    expect(inserts.some(insert => insert.table === userActiveOrg || insert.table === users)).toBe(false);
    expect(updates.some(update => update.table === users)).toBe(false);
    expect(inserts.some(insert => insert.table === orgSubscriptions)).toBe(true);
    expect(updates.some(update => update.table === platformTrialSignupFulfillments && update.values.status === "completed")).toBe(true);
    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "buyer@example.test" }));
  });
});
