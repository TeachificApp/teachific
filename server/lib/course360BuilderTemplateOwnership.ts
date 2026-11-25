import { and, eq } from "drizzle-orm";
import { int, mysqlTable, primaryKey, timestamp, varchar, index } from "drizzle-orm/mysql-core";
import { TRPCError } from "@trpc/server";

/** Additive association only: historical ownership is never inferred from a creator's memberships. */
export const course360BuilderTemplateOwnership = mysqlTable("course360_builder_template_ownership", {
  templateKind: varchar("template_kind", { length: 32 }).notNull(),
  templateId: int("template_id").notNull(),
  orgId: int("org_id").notNull(),
  savedByUserId: int("saved_by_user_id").notNull(),
  sourceCourseId: int("source_course_id"),
  sourceSectionId: int("source_section_id"),
  evidence: varchar("evidence", { length: 255 }).notNull(),
  verifiedAt: timestamp("verified_at").defaultNow().notNull(),
}, table => [
  primaryKey({ columns: [table.templateKind, table.templateId] }),
  index("course360_builder_template_org_idx").on(table.orgId, table.templateKind),
]);

export async function assertCourse360BuilderTemplate(db: any, orgId: number, kind: "section" | "checkout", templateId: number) {
  const [owned] = await db.select({ templateId: course360BuilderTemplateOwnership.templateId })
    .from(course360BuilderTemplateOwnership).where(and(
      eq(course360BuilderTemplateOwnership.templateKind, kind),
      eq(course360BuilderTemplateOwnership.templateId, templateId),
      eq(course360BuilderTemplateOwnership.orgId, orgId),
    )).limit(1);
  if (!owned) throw new TRPCError({ code: "NOT_FOUND", message: "Template has no verified ownership in the active organization" });
}
