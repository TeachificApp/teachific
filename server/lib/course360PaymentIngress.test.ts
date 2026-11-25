import Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  env: { stripeSecretKey: "sk_test_fixture", stripeWebhookSecret: "whsec_synthetic", isProduction: false },
  inbox: vi.fn(), construct: vi.fn(), session: vi.fn(), db: vi.fn(),
}));
vi.mock("../_core/env", () => ({ ENV: mocks.env }));
vi.mock("../stripePlans", () => ({ getStripe: () => ({ webhooks: { constructEvent: mocks.construct }, checkout: { sessions: { retrieve: mocks.session } } }), PLAN_LIMITS: {} }));
vi.mock("../db", () => ({ getDb: mocks.db, getUserByEmail: vi.fn(), getOrCreateUserByEmail: vi.fn() }));
vi.mock("../lmsDb", () => ({ upsertOrgSubscription: vi.fn(), createEnrollment: vi.fn(), getEnrollment: vi.fn(), getCourseById: vi.fn() }));
vi.mock("../sendgrid", () => ({ sendEmail: vi.fn() }));
vi.mock("../_core/email", () => ({ buildOrgAdminNewPurchaseEmail: vi.fn(), sendEmailViaOrg: vi.fn(), buildFunnelPurchaseConfirmationEmail: vi.fn() }));
vi.mock("../_core/notification", () => ({ notifyOwner: vi.fn() }));
vi.mock("../lib/orderBumpCheckout", () => ({ fulfillOrderBumpPurchase: vi.fn() }));
vi.mock("../routers/downloadsRouter", () => ({ sendPurchaseConfirmationEmail: vi.fn() }));
vi.mock("../lib/fulfillBookvaultOrder", () => ({ fulfillBookvaultOrder: vi.fn() }));
vi.mock("../lib/fulfillPrintfulOrder", () => ({ fulfillPrintfulOrder: vi.fn() }));
vi.mock("../lib/fulfillPrintifyOrder", () => ({ fulfillPrintifyOrder: vi.fn() }));
vi.mock("../lib/emailWorkflowEngine", () => ({ emitEmailWorkflowEvent: vi.fn() }));
vi.mock("./course360PaymentLedger", () => ({
  currentCourse360PaymentTransaction: () => undefined, getCourse360PaymentDb: vi.fn(),
  processCourse360PaymentVerifiedEvent: mocks.inbox, completeCourse360PaymentSchoolCheckout: vi.fn(),
  upsertCourse360PaymentPlatformState: vi.fn(), dispatchCourse360PaymentHostedPlatformEvent: vi.fn().mockResolvedValue(false),
  withCourse360PaymentAppCheckout: vi.fn(), withCourse360PaymentSignupCompletion: vi.fn(), persistCourse360PaymentOwnerClaim: vi.fn(),
}));
import router from "../stripeWebhookRoutes";
const signing = new Stripe("sk_test_signature_only");
const callback = (router as any).stack.find((l: any) => l.route?.path === "/webhook").route.stack.at(-1).handle;
const fixture = (extra: any = {}) => ({ id: "evt_test_signed", type: "course360.unknown", livemode: false, created: 1700000000, data: { object: { id: "obj_one" } }, ...extra });
async function dispatch(payload: any, valid = true) {
  const body = Buffer.from(JSON.stringify(payload));
  const signature = valid ? signing.webhooks.generateTestHeaderString({ payload: body.toString(), secret: mocks.env.stripeWebhookSecret }) : undefined;
  const response: any = { statusCode: 200, status(code: number) { this.statusCode = code; return this; }, json(data: any) { this.body = data; return this; } };
  await callback({ body, headers: { "stripe-signature": signature } }, response); return response;
}
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("COURSE360_STRIPE_SECRET_KEY", ""); vi.stubEnv("COURSE360_STRIPE_WEBHOOK_SECRET", "");
  mocks.env.stripeSecretKey = "sk_test_fixture"; mocks.env.stripeWebhookSecret = "whsec_synthetic";
  mocks.construct.mockImplementation((body, signature, secret) => signing.webhooks.constructEvent(body, signature, secret));
  mocks.inbox.mockImplementation(async (_event, _resource, work) => { await work(); return "completed"; });
});
describe("signature-verified durable platform ingress", () => {
  it("never persists unsigned evt_test events", async () => {
    expect((await dispatch(fixture(), false)).statusCode).toBe(400); expect(mocks.inbox).not.toHaveBeenCalled();
  });
  it("rejects invalid envelope, mode, or Connect account before inbox", async () => {
    for (const payload of [fixture({ livemode: true }), fixture({ account: "acct_other" }), fixture({ id: undefined }), fixture({ data: { object: null } })]) expect((await dispatch(payload)).statusCode).toBe(400);
    expect(mocks.inbox).not.toHaveBeenCalled();
  });
  it("valid evt_test ID still executes signature-verified inbox work", async () => {
    expect((await dispatch(fixture())).statusCode).toBe(200); expect(mocks.inbox).toHaveBeenCalledOnce();
    expect(mocks.inbox.mock.calls[0][0].id).toBe("evt_test_signed"); expect(mocks.inbox.mock.calls[0][1]).toBe("platform-account");
  });
  it("durable inbox unavailable/CAS conflict returns retryable failure", async () => {
    mocks.inbox.mockRejectedValue(new Error("CAS lost")); expect((await dispatch(fixture())).statusCode).toBe(500);
  });
  it("deduplicated completed delivery avoids provider retrieval", async () => {
    mocks.inbox.mockResolvedValue("duplicate"); expect((await dispatch(fixture({ type: "checkout.session.completed", data: { object: { id: "cs_one" } } }))).statusCode).toBe(200); expect(mocks.session).not.toHaveBeenCalled();
  });
  it("retrieves current Checkout instead of granting from delayed signed snapshot", async () => {
    mocks.session.mockResolvedValue({ id: "cs_one", mode: "payment", payment_status: "unpaid" });
    const res = await dispatch(fixture({ type: "checkout.session.completed", data: { object: { id: "cs_one", mode: "payment", payment_status: "paid" } } }));
    expect(res.statusCode).toBe(500); expect(mocks.session).toHaveBeenCalledWith("cs_one");
  });
  it("missing config has no unsigned fallback", async () => {
    mocks.env.stripeWebhookSecret = ""; expect((await dispatch(fixture(), false)).statusCode).toBe(500); expect(mocks.inbox).not.toHaveBeenCalled();
  });
});
