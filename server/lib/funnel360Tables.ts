import { mysqlTable, int, varchar, boolean, text, timestamp, primaryKey } from "drizzle-orm/mysql-core";

// Isolated additive tables. Apply the reviewed migration before registration;
// request/public handlers never create or repair schema.
export const funnel360DraftRequests = mysqlTable("funnel360_draft_requests", {
  orgId: int("orgId").notNull(),
  requestId: varchar("requestId", { length: 36 }).notNull(),
  actorId: int("actorId").notNull(),
  payloadHash: varchar("payloadHash", { length: 64 }).notNull(),
  funnelId: int("funnelId"),
  pageIdsJson: text("pageIdsJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [primaryKey({ columns: [table.orgId, table.requestId] })]);

export const funnel360PageLearnSettings = mysqlTable("funnel360_page_learn_settings", {
  orgId: int("orgId").notNull(),
  pageId: int("pageId").notNull(),
  seoKeywords: varchar("seoKeywords", { length: 1000 }),
  displayName: varchar("displayName", { length: 255 }),
  showInLibrary: boolean("showInLibrary").default(false).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [primaryKey({ columns: [table.orgId, table.pageId] })]);
