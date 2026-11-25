import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import Stripe from "stripe";
import { and, eq } from "drizzle-orm";
import { course360SchoolStripeEndpoints as endpoints } from "./course360HostedCheckoutTables";
import type { HostedGateway } from "./course360HostedCheckout";

type Bootstrap = { encryptionKey: Buffer; connectApiKey?: string };
let bootstrap: Bootstrap | undefined;
/** Server bootstrap only. Key must be supplied by protected deployment secret storage; never persisted beside ciphertext. */
export function configureCourse360SchoolStripeGateway(config: Bootstrap): void {
  if (!Buffer.isBuffer(config.encryptionKey) || config.encryptionKey.length !== 32) throw new Error("School gateway encryption requires a 32-byte protected key");
  bootstrap = { encryptionKey: Buffer.from(config.encryptionKey), connectApiKey: config.connectApiKey };
}
function configured() { if (!bootstrap) throw new Error("School gateway encryption bootstrap unavailable"); return bootstrap; }
function aad(row: any, purpose: string) { return Buffer.from(JSON.stringify(["course360-school-v1", row.id, row.orgId, row.gateway, row.accountId, row.livemode, purpose])); }
function seal(value: string, row: any, purpose: string): string {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", configured().encryptionKey, iv); cipher.setAAD(aad(row, purpose));
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(".");
}
function open(value: string, row: any, purpose: string): string {
  const [version, iv, tag, data, excess] = (value ?? "").split(".");
  if (version !== "v1" || !iv || !tag || !data || excess) throw new Error("Invalid protected school gateway ciphertext");
  const cipher = createDecipheriv("aes-256-gcm", configured().encryptionKey, Buffer.from(iv, "base64")); cipher.setAAD(aad(row, purpose)); cipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([cipher.update(Buffer.from(data, "base64")), cipher.final()]).toString("utf8");
}
function assertKeyMode(key: string, live: boolean) { if (!new RegExp(`^(sk|rk)_${live ? "live" : "test"}_`).test(key)) throw new Error("School gateway API key mode mismatch"); }
/** Administrative provisioning helper, intentionally NOT exposed as an RPC or HTTP route.
 * Parent must authenticate school admin and verify merchant account before supplying trusted identities.
 */
export async function provisionCourse360SchoolStripeEndpoint(db: any, input: { orgId: number; gateway: "own_gateway" | "connect"; accountId: string; livemode: boolean; signingSecret: string; merchantApiKey?: string }): Promise<{ endpointId: string }> {
  if (!Number.isSafeInteger(input.orgId) || input.orgId <= 0 || !/^acct_[A-Za-z0-9]+$/.test(input.accountId) || !/^whsec_[A-Za-z0-9]+$/.test(input.signingSecret)) throw new Error("Invalid school endpoint provisioning contract");
  if (input.gateway !== "own_gateway" && input.gateway !== "connect") throw new Error("Unsupported school gateway");
  const key = input.gateway === "own_gateway" ? input.merchantApiKey : configured().connectApiKey;
  if (!key) throw new Error("School endpoint API key unavailable"); assertKeyMode(key, input.livemode);
  const row = { id: randomUUID(), orgId: input.orgId, gateway: input.gateway, accountId: input.accountId, livemode: Number(input.livemode), active: 1 };
  await db.insert(endpoints).values({ ...row, signingSecretCiphertext: seal(input.signingSecret, row, "webhook"), merchantKeyCiphertext: input.gateway === "own_gateway" ? seal(key, row, "merchant") : null });
  return { endpointId: row.id };
}
export async function resolveCourse360SchoolStripeEndpoint(db: any, endpointId: string) {
  if (!/^[A-Za-z0-9-]{1,64}$/.test(endpointId ?? "")) throw new Error("Invalid school endpoint identifier");
  const [row] = await db.select().from(endpoints).where(and(eq(endpoints.id, endpointId), eq(endpoints.active, 1))).limit(1);
  if (!row) throw new Error("School endpoint unavailable");
  if (!["connect", "own_gateway"].includes(row.gateway) || !/^acct_[A-Za-z0-9]+$/.test(row.accountId) || ![0, 1].includes(row.livemode)) throw new Error("Invalid protected endpoint account binding");
  const signingSecret = open(row.signingSecretCiphertext, row, "webhook");
  const key = row.gateway === "own_gateway" ? open(row.merchantKeyCiphertext, row, "merchant") : configured().connectApiKey;
  if (!key || !/^whsec_[A-Za-z0-9]+$/.test(signingSecret)) throw new Error("School endpoint secrets unavailable"); assertKeyMode(key, row.livemode === 1);
  const gateway: HostedGateway = { gateway: row.gateway, accountId: row.accountId, stripe: new Stripe(key, { apiVersion: "2024-06-20" as any }), requestOptions: row.gateway === "connect" ? { stripeAccount: row.accountId } : {} };
  return { orgId: row.orgId, livemode: row.livemode === 1, signingSecret, gateway };
}
/** Retained encrypted rows permit historical reconciliation; ambiguous rotations must be resolved administratively. */
export async function resolveRegisteredCourse360HostedGateway(db: any, orgId: number, accountId: string, gateway: string, livemode: boolean): Promise<HostedGateway | null> {
  const rows = await db.select().from(endpoints).where(and(eq(endpoints.orgId, orgId), eq(endpoints.accountId, accountId), eq(endpoints.gateway, gateway), eq(endpoints.livemode, Number(livemode)), eq(endpoints.active, 1)));
  if (!rows.length) return null;
  if (rows.length !== 1) throw new Error("Ambiguous school gateway registry binding");
  return (await resolveCourse360SchoolStripeEndpoint(db, rows[0].id)).gateway;
}

/** Prefer protected merchant keys for new checkout; select only the owning school's saved gateway.
 * Missing registry is returned to the existing legacy resolver; ambiguous configuration never falls back.
 */
export async function resolveProtectedCourse360CheckoutGateway(db: any, org: any): Promise<HostedGateway | null> {
  const gateway = org.paymentGateway === "own_gateway" ? "own_gateway" : org.paymentGateway === "teachific_pay" && org.stripeConnectStatus === "active" ? "connect" : null;
  if (!gateway) return null;
  const clauses = [eq(endpoints.orgId, org.id), eq(endpoints.gateway, gateway), eq(endpoints.active, 1)];
  if (gateway === "connect") clauses.push(eq(endpoints.accountId, org.stripeConnectAccountId ?? ""));
  const rows = await db.select().from(endpoints).where(and(...clauses));
  if (!rows.length) return null;
  if (rows.length !== 1) throw new Error("School checkout requires one explicit protected account/mode endpoint");
  return (await resolveCourse360SchoolStripeEndpoint(db, rows[0].id)).gateway;
}
/** Historical account resolution deliberately does not follow a school's newly selected gateway. */
export async function resolveProtectedCourse360PurchaseGateway(db: any, purchase: { orgId: number; accountId: string; gateway: string }): Promise<HostedGateway | null> {
  const rows = await db.select().from(endpoints).where(and(eq(endpoints.orgId, purchase.orgId), eq(endpoints.accountId, purchase.accountId), eq(endpoints.gateway, purchase.gateway), eq(endpoints.active, 1)));
  if (!rows.length) return null;
  if (rows.length !== 1) throw new Error("Historical purchase requires an explicit protected account/mode binding");
  return (await resolveCourse360SchoolStripeEndpoint(db, rows[0].id)).gateway;
}
