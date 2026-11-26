import { getTableName } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import {
  organizations,
  orgMembers,
  users,
  userActiveOrg,
} from "../drizzle/schema";
const dialect = new MySqlDialect();
export function crossToolMockDb() {
  let rows: Record<string, any[]> = {};
  let tail = Promise.resolve();
  const journal: any[] = [];
  const bucket = (table: any) => (rows[getTableName(table)] ??= []);
  function matches(
    tables: any[],
    context: Record<string, any>,
    condition: any
  ) {
    if (!condition) return true;
    const query = dialect.sqlToQuery(condition);
    const clauses = [...query.sql.matchAll(/`([^`]+)`\.`([^`]+)` = \?/g)];
    return clauses.every((clause, i) => {
      const table = tables.find(t => getTableName(t) === clause[1]);
      const key = Object.keys(table).find(k => table[k]?.name === clause[2])!;
      return context[clause[1]]?.[key] === query.params[i];
    });
  }
  const db: any = {
    rows: () => rows,
    journal,
    seed(table: any, data: any[]) {
      rows[getTableName(table)] = data;
    },
    transaction: async (work: any) => {
      const prev = tail;
      let release!: () => void;
      tail = new Promise(r => (release = r));
      await prev;
      const saved = structuredClone(rows);
      try {
        return await work(db);
      } catch (e) {
        rows = saved;
        throw e;
      } finally {
        release();
      }
    },
    insert: (table: any) => ({
      values: (values: any) => {
        const apply = (duplicate: boolean) => {
          const list = bucket(table);
          const existing =
            values.id !== undefined && list.find(r => r.id === values.id);
          if (existing) {
            if (!duplicate) throw new Error("duplicate");
            return [{ affectedRows: 0 }];
          }
          const defaults: Record<string, any> = {
            course360_payment_slots: { revision: 0, reservationId: null },
            course360_payment_locks: { revision: 0 },
            course360_payment_inbox: {
              state: "pending",
              attempts: 0,
              claimToken: null,
              leaseUntil: null,
            },
            course360_payment_checkouts: {
              state: "reserved",
              sessionId: null,
              subscriptionId: null,
              customerId: null,
              sessionUrl: null,
              completedAt: null,
              createdAt: new Date(),
            },
            course360_payment_manual_grants: {
              expiresAt: null,
              revokedAt: null,
            },
            course360_payment_owner_claims: { state: "pending" },
            organizations: { isActive: true },
            org_subscriptions: {
              stripeSubscriptionId: null,
              rawStripeStatus: null,
            },
            users: { role: "user", creatorAccess: "none" },
          };
          list.push({
            id: list.reduce((n, r) => Math.max(n, Number(r.id) || 0), 0) + 1,
            ...defaults[getTableName(table)],
            ...values,
          });
          journal.push({ insert: getTableName(table), values });
          return [{ affectedRows: 1 }];
        };
        return {
          then: (resolve: any, reject: any) =>
            Promise.resolve()
              .then(() => apply(false))
              .then(resolve, reject),
          onDuplicateKeyUpdate: async () => apply(true),
        };
      },
    }),
    update: (table: any) => ({
      set: (values: any) => ({
        where: async (condition: any) => {
          journal.push({ update: getTableName(table), values });
          let affectedRows = 0;
          for (const row of bucket(table))
            if (matches([table], { [getTableName(table)]: row }, condition)) {
              for (const [key, value] of Object.entries(values))
                row[key] =
                  value && typeof value === "object" && "queryChunks" in value
                    ? (row[key] ?? 0) + 1
                    : value;
              affectedRows++;
            }
          return [{ affectedRows }];
        },
      }),
    }),
    select: () => {
      let table: any;
      let condition: any;
      const joins: any[] = [];
      const apply = () =>
        bucket(table).filter(row => {
          const context = { [getTableName(table)]: row };
          for (const joined of joins) {
            const match = bucket(joined).find(candidate =>
              joined === organizations
                ? candidate.id === row.orgId
                : candidate.userId === row.userId &&
                  candidate.orgId === row.orgId
            );
            if (!match) return false;
            context[getTableName(joined)] = match;
          }
          return matches([table, ...joins], context, condition);
        });
      const chain: any = {
        from(t: any) {
          table = t;
          return chain;
        },
        innerJoin(t: any) {
          joins.push(t);
          return chain;
        },
        where(c: any) {
          condition = c;
          return chain;
        },
        for() {
          return chain;
        },
        limit: async (n: number) => apply().slice(0, n),
        then: (resolve: any, reject: any) =>
          Promise.resolve(apply()).then(resolve, reject),
      };
      return chain;
    },
  };
  db.seed(organizations, [
    { id: 7, isActive: true, ownerId: 10, name: "A", slug: "a" },
    { id: 8, isActive: true, ownerId: 11, name: "B", slug: "b" },
  ]);
  db.seed(users, [
    {
      id: 10,
      email: "owner@example.test",
      emailVerified: true,
      name: "Owner",
      role: "org_super_admin",
      creatorAccess: "none",
      resetToken: "preserved",
    },
    { id: 11, email: "foreign@example.test", role: "org_super_admin" },
  ]);
  db.seed(orgMembers, [
    {
      id: 1,
      orgId: 7,
      userId: 10,
      role: "org_super_admin",
      memberSubRole: "basic_member",
    },
    { id: 2, orgId: 8, userId: 11, role: "org_super_admin" },
  ]);
  db.seed(userActiveOrg, [
    { userId: 10, orgId: 7 },
    { userId: 11, orgId: 8 },
  ]);
  return db;
}
