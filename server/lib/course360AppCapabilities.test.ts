import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { organizations, orgMembers, orgSubscriptions, userActiveOrg, userActivityLogs } from "../../drizzle/schema";
import { course360PaymentAppSubscriptions, course360PaymentManualGrants } from "./course360PaymentTables";
const mocks = vi.hoisted(() => ({ db: null as any, user: { id: 10, role: "user" } as any, member: { id: 2, orgId: 7, userId: 10, role: "org_admin", memberSubRole: "basic_member" } as any }));
vi.mock("../db", () => ({ getDb: async () => mocks.db, getUserById: async (id: number) => id === 10 ? mocks.user : null, getOrgMember: async (orgId: number, userId: number) => mocks.member && orgId === mocks.member.orgId && userId === mocks.member.userId ? mocks.member : null }));
import { configureCourse360AppCapabilityLedger, getCourse360AppCapabilityStatus, requireCourse360AppCapability, requireCourse360AppOrganization, getCourse360AppBillingRecords, course360DesktopArtifactUrl } from "./course360AppCapabilities";

const dialect = new MySqlDialect();
function fixture() {
  const rows: Record<string, any[]> = {}, queries: any[] = [], inserts: any[] = [];
  const db: any = {
    rows, queries, inserts, auditFail: false,
    seed(table: any, values: any[]) { rows[getTableName(table)] = values; },
    select: (projection?: any) => {
      let table: any, condition: any, joins: any[] = [];
      const apply = () => {
        const query = condition ? dialect.sqlToQuery(condition) : { sql: "", params: [] };
        queries.push({ table: getTableName(table), ...query });
        let contexts = (rows[getTableName(table)] ?? []).map(row => ({ [getTableName(table)]: row }));
        for (const join of joins) contexts = contexts.flatMap(ctx => (rows[getTableName(join)] ?? []).map(row => ({ ...ctx, [getTableName(join)]: row })));
        contexts = contexts.filter(ctx => {
          if (joins.includes(organizations) && ctx.user_active_org && ctx.organizations.id !== ctx.user_active_org.orgId) return false;
          const clauses = [...query.sql.matchAll(/`([^`]+)`\.`([^`]+)` = \?/g)];
          return clauses.every((m, index) => {
            const source = [table, ...joins].find(t => getTableName(t) === m[1]);
            const key = Object.keys(source ?? {}).find(k => source[k]?.name === m[2]);
            return key && ctx[m[1]]?.[key] === query.params[index];
          });
        });
        return contexts.map(ctx => projection ? Object.fromEntries(Object.entries(projection).map(([key, column]: any) => {
          const source = [table, ...joins].find(t => Object.values(t).includes(column));
          const field = Object.keys(source).find(k => source[k] === column)!;
          return [key, ctx[getTableName(source)][field]];
        })) : ctx[getTableName(table)]);
      };
      const chain: any = { from(t: any) { table = t; return chain; }, innerJoin(t: any) { joins.push(t); return chain; }, where(c: any) { condition = c; return chain; }, limit: async (n: number) => apply().slice(0, n), then: (ok: any, fail: any) => Promise.resolve().then(apply).then(ok, fail) };
      return chain;
    },
    insert: (table: any) => ({ values: async (value: any) => { if (db.auditFail) throw new Error("audit unavailable"); inserts.push({ table: getTableName(table), value }); (rows[getTableName(table)] ??= []).push(value); return [{ affectedRows: 1 }]; } }),
  };
  db.seed(userActiveOrg, [{ userId: 10, orgId: 7 }]); db.seed(organizations, [{ id: 7, isActive: true }, { id: 8, isActive: true }]);
  db.seed(orgSubscriptions, []); db.seed(course360PaymentAppSubscriptions, []); db.seed(course360PaymentManualGrants, []);
  return db;
}
const future = () => new Date(Date.now() + 3600000);
const paid = (overrides: any = {}) => ({ orgId: 7, userId: 10, product: "studio", accountId: "acct_fixture", livemode: false, tier: "web", rawStatus: "active", currentPeriodEnd: future(), trialEnd: null, subscriptionId: "sub_app", customerId: "cus_app", ...overrides });
beforeEach(() => { mocks.db = fixture(); mocks.user = { id: 10, role: "user", studioAccess: "bundle", studioTrialEndsAt: new Date(0), creatorAccess: "bundle", quizCreatorAccess: "bundle" }; mocks.member = { id: 2, orgId: 7, userId: 10, role: "org_admin", memberSubRole: "basic_member" }; configureCourse360AppCapabilityLedger({ getDb: async () => mocks.db, accountId: "acct_fixture", livemode: false }); });

describe("persisted identity, selected school and author permission", () => {
  it("requires saved active school even with legacy access or persisted platform role", async () => {
    mocks.db.seed(userActiveOrg, []); mocks.user.role = "site_owner";
    expect((await getCourse360AppCapabilityStatus(10, "studio", "web")).access.isActive).toBe(false);
    await expect(requireCourse360AppCapability(10, "studio", "web")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.db.inserts).toEqual([]);
  });
  it("rejects inactive school and stale browser org hint without first/primary fallback", async () => {
    await expect(requireCourse360AppOrganization(10, 8)).rejects.toMatchObject({ code: "FORBIDDEN" });
    mocks.db.seed(organizations, [{ id: 7, isActive: false }, { id: 8, isActive: true }]);
    expect((await getCourse360AppCapabilityStatus(10, "studio", "web")).orgId).toBeNull();
  });
  it("does not trust session/global org-admin or same-email other user membership", async () => {
    mocks.user.role = "org_admin"; mocks.member.userId = 11;
    mocks.db.seed(course360PaymentAppSubscriptions, [paid()]);
    await expect(requireCourse360AppCapability(10, "studio", "web")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("permits persisted instructor authors but not basic learners even when paid", async () => {
    mocks.member.role = "member"; mocks.db.seed(course360PaymentAppSubscriptions, [paid()]);
    await expect(requireCourse360AppCapability(10, "studio", "web")).rejects.toMatchObject({ code: "FORBIDDEN" });
    mocks.member.memberSubRole = "instructor";
    expect((await requireCourse360AppCapability(10, "studio", "web")).orgId).toBe(7);
  });
  it("records an awaited exact-school platform support bypass without fabricated paid/manual state", async () => {
    mocks.user.role = "site_admin"; mocks.member = null;
    const result = await requireCourse360AppCapability(10, "creator", "desktop");
    expect(result).toMatchObject({ orgId: 7, isPaid: false, hasManualGrant: false, platformSupport: true, access: { isActive: true } });
    expect(mocks.db.inserts).toEqual([{ table: getTableName(userActivityLogs), value: expect.objectContaining({ userId: 10, eventType: "course360_app_support_bypass", metadata: { orgId: 7, app: "creator", mode: "desktop", permission: "persisted-platform-role" } }) }]);
    mocks.db.auditFail = true;
    await expect(requireCourse360AppCapability(10, "creator", "desktop")).rejects.toThrow("audit unavailable");
  });
  it("unavailable persistence is an error, not false no-access/upgrade status", async () => {
    mocks.db = null;
    await expect(getCourse360AppCapabilityStatus(10, "studio", "web")).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
  it("obsolete global admin has no platform bypass", async () => {
    mocks.user.role = "admin"; mocks.member = null;
    await expect(requireCourse360AppCapability(10, "studio", "web")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("actual canonical mode/source lifecycle", () => {
  it.each(["canceled", "past_due", "unpaid", "paused", "incomplete", "unknown"])("denies %s without legacy fallback", async rawStatus => {
    mocks.db.seed(course360PaymentAppSubscriptions, [paid({ rawStatus })]);
    expect((await getCourse360AppCapabilityStatus(10, "studio", "web")).access.isActive).toBe(false);
  });
  it("denies expired/missing paid-through and expired trial while preserving history", async () => {
    for (const row of [paid({ currentPeriodEnd: new Date(0) }), paid({ currentPeriodEnd: null }), paid({ rawStatus: "trialing", trialEnd: new Date(0) })]) {
      mocks.db.seed(course360PaymentAppSubscriptions, [row]);
      expect((await getCourse360AppCapabilityStatus(10, "studio", "web")).access.isActive).toBe(false);
      expect(mocks.user.studioAccess).toBe("bundle");
    }
  });
  it("honors current trial but never classifies it paid", async () => {
    mocks.db.seed(course360PaymentAppSubscriptions, [paid({ rawStatus: "trialing", trialEnd: future() })]);
    expect(await requireCourse360AppCapability(10, "studio", "web")).toMatchObject({ isPaid: false, access: { isInTrial: true, trialEndsAt: expect.any(Date) } });
  });
  it.each(["web", "desktop", "bundle"])("enforces %s modes", async tier => {
    mocks.db.seed(course360PaymentAppSubscriptions, [paid({ tier })]);
    for (const mode of ["web", "desktop"] as const) expect((await getCourse360AppCapabilityStatus(10, "studio", mode)).access.isActive).toBe(tier === mode || tier === "bundle");
  });
  it("paid Desktop cannot remove Web trial watermark; independent manual Web grant survives cancellation", async () => {
    mocks.db.seed(course360PaymentAppSubscriptions, [paid({ tier: "desktop" }), paid({ rawStatus: "trialing", trialEnd: future() })]);
    expect((await requireCourse360AppCapability(10, "studio", "web")).isPaid).toBe(false);
    mocks.db.seed(course360PaymentAppSubscriptions, [paid({ rawStatus: "canceled" })]);
    const grant = { orgId: 7, userId: 10, product: "studio", tier: "web", expiresAt: future(), revokedAt: null, actorId: 3, source: "historical-reviewed", reason: "retained provenance" };
    mocks.db.seed(course360PaymentManualGrants, [grant]);
    expect(await requireCourse360AppCapability(10, "studio", "web")).toMatchObject({ isPaid: false, hasManualGrant: true });
    expect(grant.source).toBe("historical-reviewed");
    expect((await getCourse360AppCapabilityStatus(10, "studio", "desktop")).access.isActive).toBe(false);
  });
  it("excludes expired/revoked manual sources", async () => {
    mocks.db.seed(course360PaymentManualGrants, [{ orgId: 7, userId: 10, product: "studio", tier: "bundle", expiresAt: new Date(0), revokedAt: null }, { orgId: 7, userId: 10, product: "studio", tier: "web", expiresAt: null, revokedAt: new Date() }]);
    expect((await getCourse360AppCapabilityStatus(10, "studio", "web")).access.isActive).toBe(false);
  });
  it("isolates exact school/user/app/account/mode in actual SQL contract", async () => {
    mocks.db.seed(course360PaymentAppSubscriptions, [paid({ orgId: 8 }), paid({ userId: 11 }), paid({ product: "creator" }), paid({ accountId: "acct_other" }), paid({ livemode: true })]);
    expect((await getCourse360AppCapabilityStatus(10, "studio", "web")).access.isActive).toBe(false);
    const query = mocks.db.queries.find((q: any) => q.table === getTableName(course360PaymentAppSubscriptions));
    expect(query.params).toEqual([7, 10, "studio", "acct_fixture", false]);
    expect(query.sql).toContain("`account_id` = ?");
  });
});

describe("explicit school inclusion only", () => {
  it.each(["builder", "pro", "enterprise"])("includes Studio Web for current %s school, not Creator/Quiz/Desktop", async plan => {
    mocks.db.seed(orgSubscriptions, [{ orgId: 7, plan, status: "active", stripeSubscriptionId: "sub_school", currentPeriodEnd: future(), trialEndsAt: null }]);
    expect(await requireCourse360AppCapability(10, "studio", "web")).toMatchObject({ schoolIncluded: true, isPaid: true });
    for (const [app, mode] of [["studio", "desktop"], ["creator", "web"], ["quiz_creator", "web"]] as const) expect((await getCourse360AppCapabilityStatus(10, app, mode)).access.isActive).toBe(false);
  });
  it("does not include free/Starter, expired trial, expired paid or unassigned plan defaults", async () => {
    for (const school of [{ plan: "starter", stripeSubscriptionId: "sub_school", currentPeriodEnd: future() }, { plan: "builder", stripeSubscriptionId: "sub_school", status: "trialing", trialEndsAt: new Date(0) }, { plan: "builder", stripeSubscriptionId: "sub_school", currentPeriodEnd: new Date(0) }, { plan: "builder" }]) {
      mocks.db.seed(orgSubscriptions, [{ orgId: 7, status: "active", ...school }]);
      expect((await getCourse360AppCapabilityStatus(10, "studio", "web")).access.isActive).toBe(false);
    }
  });
  it("paid school inclusion wins over standalone Web trial without altering that trial", async () => {
    mocks.db.seed(orgSubscriptions, [{ orgId: 7, plan: "builder", status: "active", stripeSubscriptionId: "sub_school", currentPeriodEnd: future(), trialEndsAt: null }]);
    mocks.db.seed(course360PaymentAppSubscriptions, [paid({ rawStatus: "trialing", trialEnd: future() })]);
    expect(await requireCourse360AppCapability(10, "studio", "web")).toMatchObject({ schoolIncluded: true, isPaid: true, access: { isInTrial: false } });
    expect(mocks.db.rows[getTableName(course360PaymentAppSubscriptions)][0].rawStatus).toBe("trialing");
  });
  it("retains explicit administrator-assigned school inclusion as manual not paid", async () => {
    mocks.db.seed(orgSubscriptions, [{ orgId: 7, plan: "builder", status: "active", assignedByUserId: 3, stripeSubscriptionId: null, currentPeriodEnd: null }]);
    expect(await requireCourse360AppCapability(10, "studio", "web")).toMatchObject({ schoolIncluded: true, isPaid: false, hasManualGrant: true });
    expect(mocks.db.inserts).toEqual([]);
  });
});

describe("billing recovery and artifact readiness", () => {
  it("reads expired app-ledger customer/subscription without access gate or school customer", async () => {
    mocks.db.seed(course360PaymentAppSubscriptions, [paid({ rawStatus: "unpaid", currentPeriodEnd: new Date(0) }), paid({ orgId: 8, customerId: "cus_foreign" })]);
    expect(await getCourse360AppBillingRecords(10, "studio")).toEqual([expect.objectContaining({ subscriptionId: "sub_app", customerId: "cus_app", rawStatus: "unpaid" })]);
  });
  it.each([null, "", "javascript:alert(1)", "http://example.test/app.zip", "https://user:pass@example.test/app.zip"])("does not mark %s as download URL", value => expect(course360DesktopArtifactUrl(value)).toBeNull());
  it("retains https release URL without asserting signing or installation", () => expect(course360DesktopArtifactUrl("https://example.test/app.zip")).toBe("https://example.test/app.zip"));
});
