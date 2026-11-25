import { mysqlTable, varchar, int, boolean, timestamp, longtext, index, uniqueIndex } from "drizzle-orm/mysql-core";

// Additive only: deploy reviewed SQL separately. No request/startup DDL.
const identity = () => ({ accountId: varchar("account_id", { length: 64 }).notNull(), livemode: boolean("livemode").notNull() });
export const course360PaymentSlots = mysqlTable("course360_payment_slots", {
  id: varchar("id", { length: 64 }).primaryKey(), reservationId: varchar("reservation_id", { length: 36 }),
  revision: int("revision").notNull().default(0),
});
export const course360PaymentCheckouts = mysqlTable("course360_payment_checkouts", {
  id: varchar("id", { length: 36 }).primaryKey(), slotId: varchar("slot_id", { length: 64 }).notNull(), ...identity(),
  orgId: int("org_id"), userId: int("user_id"), product: varchar("product", { length: 32 }).notNull(),
  selection: varchar("selection", { length: 32 }).notNull(), interval: varchar("billing_interval", { length: 16 }).notNull(),
  fingerprint: varchar("fingerprint", { length: 64 }).notNull(), spec: longtext("spec").notNull(),
  previousSubscriptionId: varchar("previous_subscription_id", { length: 255 }), customerId: varchar("customer_id", { length: 255 }),
  sessionId: varchar("session_id", { length: 255 }), subscriptionId: varchar("subscription_id", { length: 255 }),
  sessionUrl: longtext("session_url"), state: varchar("state", { length: 24 }).notNull().default("reserved"),
  trial: boolean("trial").notNull().default(false), expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(), completedAt: timestamp("completed_at", { mode: "date" }),
}, t => [uniqueIndex("c360_checkout_session_uq").on(t.accountId, t.livemode, t.sessionId), index("c360_checkout_slot_idx").on(t.slotId)]);
export const course360PaymentAppSubscriptions = mysqlTable("course360_payment_app_subscriptions", {
  id: varchar("id", { length: 36 }).primaryKey(), ...identity(), orgId: int("org_id").notNull(), userId: int("user_id").notNull(),
  product: varchar("product", { length: 32 }).notNull(), tier: varchar("tier", { length: 16 }).notNull(),
  subscriptionId: varchar("subscription_id", { length: 255 }).notNull(), customerId: varchar("customer_id", { length: 255 }).notNull(),
  reservationId: varchar("reservation_id", { length: 36 }).notNull(), sessionId: varchar("session_id", { length: 255 }).notNull(),
  rawStatus: varchar("raw_status", { length: 32 }).notNull(), currentPeriodStart: timestamp("current_period_start", { mode: "date" }),
  currentPeriodEnd: timestamp("current_period_end", { mode: "date" }), trialStart: timestamp("trial_start", { mode: "date" }),
  trialEnd: timestamp("trial_end", { mode: "date" }), cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
}, t => [uniqueIndex("c360_app_subscription_uq").on(t.accountId, t.livemode, t.subscriptionId), index("c360_app_school_idx").on(t.orgId, t.userId, t.product)]);
export const course360PaymentManualGrants = mysqlTable("course360_payment_manual_grants", {
  id: varchar("id", { length: 36 }).primaryKey(), orgId: int("org_id").notNull(), userId: int("user_id").notNull(),
  product: varchar("product", { length: 32 }).notNull(), tier: varchar("tier", { length: 16 }).notNull(),
  actorId: int("actor_id").notNull(), source: varchar("source", { length: 255 }).notNull(), reason: longtext("reason").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(), expiresAt: timestamp("expires_at", { mode: "date" }),
  revokedAt: timestamp("revoked_at", { mode: "date" }),
}, t => [index("c360_manual_school_idx").on(t.orgId, t.userId, t.product)]);
export const course360PaymentTrialHistory = mysqlTable("course360_payment_trial_history", {
  id: varchar("id", { length: 64 }).primaryKey(), orgId: int("org_id"), userId: int("user_id"),
  product: varchar("product", { length: 32 }).notNull(), reservationId: varchar("reservation_id", { length: 36 }).notNull(),
  claimedAt: timestamp("claimed_at", { mode: "date" }).notNull().defaultNow(),
});
export const course360PaymentInbox = mysqlTable("course360_payment_inbox", {
  id: varchar("id", { length: 64 }).primaryKey(), ...identity(), endpoint: varchar("endpoint", { length: 64 }).notNull(),
  eventId: varchar("event_id", { length: 255 }).notNull(), eventType: varchar("event_type", { length: 255 }).notNull(),
  objectId: varchar("object_id", { length: 255 }), orgId: int("org_id"), payload: longtext("payload").notNull(), payloadHash: varchar("payload_hash", { length: 64 }).notNull(),
  state: varchar("state", { length: 24 }).notNull().default("pending"), claimToken: varchar("claim_token", { length: 36 }),
  leaseUntil: timestamp("lease_until", { mode: "date" }), attempts: int("attempts").notNull().default(0), lastError: longtext("last_error"),
  receivedAt: timestamp("received_at", { mode: "date" }).notNull().defaultNow(), completedAt: timestamp("completed_at", { mode: "date" }),
}, t => [uniqueIndex("c360_inbox_event_uq").on(t.endpoint, t.accountId, t.livemode, t.eventId)]);
export const course360PaymentLocks = mysqlTable("course360_payment_locks", {
  id: varchar("id", { length: 64 }).primaryKey(), revision: int("revision").notNull().default(0),
});
export const course360PaymentOwnerClaims = mysqlTable("course360_payment_owner_claims", {
  id: varchar("id", { length: 36 }).primaryKey(), orgId: int("org_id").notNull(), userId: int("user_id").notNull(),
  email: varchar("email", { length: 320 }).notNull(), sessionId: varchar("session_id", { length: 255 }).notNull(),
  subscriptionId: varchar("subscription_id", { length: 255 }).notNull(), state: varchar("state", { length: 24 }).notNull().default("pending"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(), claimedAt: timestamp("claimed_at", { mode: "date" }),
}, t => [uniqueIndex("c360_owner_session_uq").on(t.sessionId)]);
