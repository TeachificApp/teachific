import { MySqlDialect } from "drizzle-orm/mysql-core";
import { getTableName } from "drizzle-orm";
import { vi } from "vitest";
const dialect = new MySqlDialect();
/** Test-only adapter: evaluates actual equality predicates, durable-key inserts, row locks and transaction rollback. */
export function memoryHostedDb(initial: Array<[any, any[]]> = []) {
  let store = new Map<string, any[]>(initial.map(([table, rows]) => [getTableName(table), structuredClone(rows)]));
  let tail = Promise.resolve(); const writes: any[] = [];
  const db: any = {
    rows: (table: any) => store.get(getTableName(table)) ?? [], writes, failTable: null,
    select: vi.fn(() => {
      let table: any; let predicate: any;
      const run = () => db.rows(table).filter((row: any) => matches(table, row, predicate));
      const chain: any = { from: (v: any) => (table = v, chain), where: (v: any) => (predicate = v, chain), for: () => chain, limit: (n: number) => Promise.resolve(run().slice(0, n)), orderBy: () => Promise.resolve(run()), then: (ok: any, fail: any) => Promise.resolve(run()).then(ok, fail) };
      return chain;
    }),
    insert: vi.fn((table: any) => ({ values: (values: any) => {
      let done: any; let duplicate = false;
      const run = () => {
        if (done) return done;
        if (db.failTable === table) throw new Error("Injected persistence failure");
        const rows = db.rows(table); const prior = values.id != null ? rows.find((r: any) => r.id === values.id) : null;
        if (prior && duplicate) return done = [{ id: prior.id }];
        if (prior) throw new Error("Duplicate test identity");
        const row = { id: rows.length + 1, ...(getTableName(table) === "course360_hosted_checkout_purchases" ? { status: "pending" } : {}), ...values }; rows.push(row); store.set(getTableName(table), rows); writes.push({ table, values: { ...row } });
        return done = [{ id: row.id }];
      };
      const chain: any = { $returningId: () => Promise.resolve(run()), onDuplicateKeyUpdate: () => (duplicate = true, chain), then: (ok: any, fail: any) => Promise.resolve().then(run).then(ok, fail) };
      return chain;
    } })),
    update: vi.fn((table: any) => ({ set: (values: any) => ({ where: async (predicate: any) => {
      if (db.failTable === table) throw new Error("Injected persistence failure");
      for (const row of db.rows(table)) if (matches(table, row, predicate)) { Object.assign(row, values); writes.push({ table, values }); }
    } }) })),
    transaction: vi.fn(async (fn: any) => {
      const wait = tail; let release!: () => void; tail = new Promise<void>(resolve => { release = resolve; }); await wait;
      const before = structuredClone(store); const length = writes.length;
      try { return await fn(db); } catch (error) { store = before; writes.splice(length); throw error; } finally { release(); }
    }),
  };
  function matches(table: any, row: any, predicate: any) {
    if (!predicate) return true;
    const query = dialect.sqlToQuery(predicate); const clauses = [...query.sql.matchAll(/`[^`]+`\.`([^`]+)` = \?/g)];
    if (clauses.length !== query.params.length) throw new Error(`Unsupported test predicate: ${query.sql}`);
    return clauses.every((c, i) => { const key = Object.keys(table).find(k => table[k]?.name === c[1]); return key && row[key] === query.params[i]; });
  }
  return db;
}
