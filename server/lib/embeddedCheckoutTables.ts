import { and, eq } from "drizzle-orm";
import { index, int, longtext, mysqlTable, timestamp } from "drizzle-orm/mysql-core";

/** Apply embeddedCheckoutTables.sql before enabling this boundary; never create schema in a public request. */
export const embeddedCheckoutSnapshots = mysqlTable("embedded_checkout_snapshots", {
  purchaseId: int("purchase_id").primaryKey(),
  orgId: int("org_id").notNull(),
  manifest: longtext("manifest").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, table => [index("embedded_snapshot_org").on(table.orgId, table.purchaseId)]);

export async function loadEmbeddedSnapshot(db: any, purchase: any) {
  const [snapshot] = await db.select().from(embeddedCheckoutSnapshots).where(and(eq(embeddedCheckoutSnapshots.purchaseId, purchase.id), eq(embeddedCheckoutSnapshots.orgId, purchase.orgId))).limit(1);
  if (!snapshot || snapshot.orgId !== purchase.orgId) throw new Error("Legacy checkout requires manual reconciliation; saved snapshot is missing");
  return { ...purchase, snapshotManifest: snapshot.manifest };
}
