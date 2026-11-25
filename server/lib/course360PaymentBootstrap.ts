import { sql } from "drizzle-orm";

// Independently retrieved with the configured platform client on 2026-11-25.
// Public Stripe resource identities, not credentials. Changing account ownership
// requires a separate reviewed verification; never infer it from Checkout metadata.
export const COURSE360_VERIFIED_PAYMENT_IDENTITY = Object.freeze({
  accountId: "acct_1TPy411uhi9xlcrH",
  endpointId: "we_1Ufmig1uhi9xlcrHvAcphk8h",
  endpointUrl: "https://course360.app/api/stripe/webhook",
  livemode: true,
});

export type Course360PaymentBootstrapDependencies = {
  readiness: { ready: boolean; secretMode: string; publishableMode: string; webhookConfigured: boolean };
  retrieveOwnAccount: () => Promise<{ id: string; charges_enabled?: boolean }>;
  retrieveEndpoint: (id: string) => Promise<{ id: string; url: string; status: string; livemode: boolean; enabled_events: readonly string[] }>;
  probeSchema: () => Promise<void>;
  configure: (identity: typeof COURSE360_VERIFIED_PAYMENT_IDENTITY) => void;
};
export class Course360PaymentBootstrapError extends Error {
  constructor(readonly category: "credentials" | "account" | "endpoint" | "schema" | "provider") {
    super(`Course360 payment bootstrap blocked (${category}).`);
  }
}

/** Every probe is read-only; configure is called only after all checks succeed. */
export async function verifyCourse360PaymentBootstrap(deps: Course360PaymentBootstrapDependencies) {
  const ready = deps.readiness;
  if (!ready.ready || ready.secretMode !== "live" || ready.publishableMode !== "live" || !ready.webhookConfigured) {
    throw new Course360PaymentBootstrapError("credentials");
  }
  let account: Awaited<ReturnType<typeof deps.retrieveOwnAccount>>;
  let endpoint: Awaited<ReturnType<typeof deps.retrieveEndpoint>>;
  try {
    account = await deps.retrieveOwnAccount();
    if (account.id !== COURSE360_VERIFIED_PAYMENT_IDENTITY.accountId || !account.charges_enabled) {
      throw new Course360PaymentBootstrapError("account");
    }
    endpoint = await deps.retrieveEndpoint(COURSE360_VERIFIED_PAYMENT_IDENTITY.endpointId);
  } catch (error) {
    if (error instanceof Course360PaymentBootstrapError) throw error;
    throw new Course360PaymentBootstrapError("provider");
  }
  const required = ["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "customer.subscription.updated", "customer.subscription.deleted", "invoice.paid", "invoice.payment_failed"];
  if (endpoint.id !== COURSE360_VERIFIED_PAYMENT_IDENTITY.endpointId || endpoint.url !== COURSE360_VERIFIED_PAYMENT_IDENTITY.endpointUrl || endpoint.status !== "enabled" || !endpoint.livemode || !required.every(event => endpoint.enabled_events.includes("*") || endpoint.enabled_events.includes(event))) {
    throw new Course360PaymentBootstrapError("endpoint");
  }
  try { await deps.probeSchema(); }
  catch { throw new Course360PaymentBootstrapError("schema"); }
  deps.configure(COURSE360_VERIFIED_PAYMENT_IDENTITY);
  return { ready: true as const, verifiedAt: new Date().toISOString(), providerReadOnly: true as const };
}

type BootstrapStatus = { state: "not_started" | "verifying" | "ready" | "blocked"; verifiedAt: string | null; reason: string | null };
let status: BootstrapStatus = { state: "not_started", verifiedAt: null, reason: null };
let startup: Promise<void> | undefined;
export function getCourse360PaymentBootstrapStatus(): Readonly<BootstrapStatus> { return { ...status }; }

/** Called once during startup before billing/webhook routes accept traffic. No timers or DDL. */
export function bootstrapConfiguredCourse360PaymentLedger(): Promise<void> {
  if (startup) return startup;
  status = { state: "verifying", verifiedAt: null, reason: null };
  startup = (async () => {
    const [{ getStripe, getPlatformPaymentReadiness }, { getDb }, tables, capabilities] = await Promise.all([
      import("../stripePlans"), import("../db"), import("./course360PaymentTables"), import("./course360AppCapabilities"),
    ]);
    const readiness = getPlatformPaymentReadiness();
    const stripe = readiness.ready ? getStripe() : null;
    const request = { timeout: 12000, maxNetworkRetries: 0 };
    const result = await verifyCourse360PaymentBootstrap({
      readiness,
      retrieveOwnAccount: () => stripe!.accounts.retrieve(null, {}, request),
      retrieveEndpoint: id => stripe!.webhookEndpoints.retrieve(id, {}, request),
      probeSchema: async () => {
        const db = await getDb();
        if (!db) throw new Error("Payment database unavailable");
        // SELECT LIMIT 0 validates every current Drizzle column without fetching records.
        for (const table of Object.values(tables)) await db.select().from(table).limit(0);
        const result = await db.execute(sql`SELECT TABLE_NAME AS tableName, ENGINE AS engine, TABLE_COLLATION AS collationName FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('course360_payment_slots','course360_payment_checkouts','course360_payment_app_subscriptions','course360_payment_manual_grants','course360_payment_trial_history','course360_payment_inbox','course360_payment_locks','course360_payment_owner_claims')`);
        const rows = result[0] as unknown as Array<{ tableName: string; engine: string; collationName: string }>;
        if (rows.length !== 8 || rows.some(row => row.engine !== "InnoDB" || !row.collationName?.endsWith("_bin"))) throw new Error("Payment schema engine or identity collation unavailable");
      },
      configure: identity => capabilities.configureCourse360AppCapabilityLedger({ getDb, accountId: identity.accountId, livemode: identity.livemode }),
    });
    status = { state: "ready", verifiedAt: result.verifiedAt, reason: null };
  })().catch(error => {
    status = { state: "blocked", verifiedAt: null, reason: error instanceof Course360PaymentBootstrapError ? error.category : "configuration" };
    // Do not disclose raw provider errors, SQL, credentials or user records.
    console.warn("[Course360 Payments] Ledger bootstrap blocked:", status.reason);
  });
  return startup;
}
