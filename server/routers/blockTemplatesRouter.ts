import { z } from "zod";
import { eq, desc, like, or, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { blockTemplates } from "../../drizzle/schema";
import { requireCourse360BuilderSchool } from "../lib/course360BuilderSchoolScope";

export const blockTemplatesRouter = router({
  /** Legacy NULL-org rows are preserved, but never exposed as school-owned templates. */
  list: protectedProcedure
    .input(z.object({ search: z.string().optional(), blockType: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const { db, orgId } = await requireCourse360BuilderSchool(ctx);
      const conditions = [eq(blockTemplates.orgId, orgId)];
      if (input.blockType) conditions.push(eq(blockTemplates.blockType, input.blockType));
      if (input.search?.trim()) {
        const q = `%${input.search.trim()}%`;
        conditions.push(or(like(blockTemplates.name, q), like(blockTemplates.tags, q), like(blockTemplates.blockType, q))!);
      }
      return db.select().from(blockTemplates).where(and(...conditions)).orderBy(desc(blockTemplates.createdAt));
    }),

  save: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(200),
      description: z.string().optional(),
      blockType: z.string().min(1).max(80),
      blockData: z.record(z.string(), z.any()),
      tags: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { db, orgId } = await requireCourse360BuilderSchool(ctx);
      const [inserted] = await db.insert(blockTemplates).values({
        orgId,
        name: input.name,
        description: input.description ?? null,
        blockType: input.blockType,
        blockData: JSON.stringify(input.blockData),
        tags: input.tags ?? null,
        createdByUserId: ctx.user.id,
      });
      return { id: (inserted as any).insertId, orgId };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { db, orgId } = await requireCourse360BuilderSchool(ctx);
      const predicate = and(eq(blockTemplates.id, input.id), eq(blockTemplates.orgId, orgId));
      const [existing] = await db.select({ id: blockTemplates.id }).from(blockTemplates).where(predicate).limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      await db.delete(blockTemplates).where(predicate);
      return { success: true, orgId };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(200).optional(),
      description: z.string().optional(),
      tags: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { db, orgId } = await requireCourse360BuilderSchool(ctx);
      const predicate = and(eq(blockTemplates.id, input.id), eq(blockTemplates.orgId, orgId));
      const [existing] = await db.select({ id: blockTemplates.id }).from(blockTemplates).where(predicate).limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      const updates: Partial<typeof blockTemplates.$inferInsert> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.description !== undefined) updates.description = input.description;
      if (input.tags !== undefined) updates.tags = input.tags;
      if (Object.keys(updates).length) await db.update(blockTemplates).set(updates).where(predicate);
      return { success: true, orgId };
    }),
});
