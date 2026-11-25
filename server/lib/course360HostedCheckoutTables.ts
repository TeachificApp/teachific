import { mysqlTable, varchar, int, text, timestamp, uniqueIndex, index } from "drizzle-orm/mysql-core";

/** Isolated additive tables: never attribute old canonical grants from metadata. */
export const course360RecurringBindings = mysqlTable("course360_recurring_bindings", {
  id: varchar("id", { length: 64 }).primaryKey(),
  purchaseId: varchar("purchase_id", { length: 64 }).notNull(),
  orgId: int("org_id").notNull(), userId: int("user_id").notNull(),
  contentType: varchar("content_type", { length: 32 }).notNull(), contentId: int("content_id").notNull(),
  gateway: varchar("gateway", { length: 32 }).notNull(), accountId: varchar("account_id", { length: 255 }).notNull(),
  subscriptionId: varchar("subscription_id", { length: 255 }).notNull(), customerId: varchar("customer_id", { length: 255 }).notNull(),
  livemode: int("livemode").notNull(), rawStatus: varchar("raw_status", { length: 64 }).notNull(),
  periodEnd: timestamp("period_end"), cancelAtPeriodEnd: int("cancel_at_period_end").default(0).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, t => [uniqueIndex("course360_recurring_account_sub_uq").on(t.accountId, t.subscriptionId, t.livemode), uniqueIndex("course360_recurring_purchase_uq").on(t.purchaseId)]);

export const course360EntitlementTargets = mysqlTable("course360_entitlement_targets", {
  id: varchar("id", { length: 64 }).primaryKey(), orgId: int("org_id").notNull(), userId: int("user_id").notNull(),
  family: varchar("family", { length: 32 }).notNull(), resourceId: int("resource_id").notNull(),
  canonicalId: int("canonical_id"),
  /** Last exact managed projection; null means no ownership of any historic row. */
  projection: text("projection"),
}, t => [uniqueIndex("course360_target_identity_uq").on(t.orgId, t.userId, t.family, t.resourceId)]);

export const course360EntitlementSources = mysqlTable("course360_entitlement_sources", {
  id: varchar("id", { length: 64 }).primaryKey(), targetId: varchar("target_id", { length: 64 }).notNull(),
  purchaseId: varchar("purchase_id", { length: 64 }).notNull(), orgId: int("org_id").notNull(), userId: int("user_id").notNull(),
  family: varchar("family", { length: 32 }).notNull(), resourceId: int("resource_id").notNull(),
  subscriptionId: varchar("subscription_id", { length: 255 }),
  canonicalValues: text("canonical_values"),
  source: varchar("source", { length: 128 }).notNull(), status: varchar("status", { length: 32 }).notNull(),
  cutoff: timestamp("cutoff"), updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, t => [index("course360_source_purchase_target_idx").on(t.purchaseId, t.targetId), index("course360_source_target_idx").on(t.targetId)]);

/** AES-GCM ciphertext only. This table has no public settings/read RPC. */
export const course360SchoolStripeEndpoints = mysqlTable("course360_school_stripe_endpoints", {
  id: varchar("id", { length: 64 }).primaryKey(), orgId: int("org_id").notNull(),
  gateway: varchar("gateway", { length: 32 }).notNull(), accountId: varchar("account_id", { length: 255 }).notNull(),
  livemode: int("livemode").notNull(), active: int("active").default(1).notNull(),
  signingSecretCiphertext: text("signing_secret_ciphertext").notNull(),
  merchantKeyCiphertext: text("merchant_key_ciphertext"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, t => [index("course360_school_endpoint_org_idx").on(t.orgId)]);
