import { z } from "zod";
import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { funnels, funnelSteps, pageBuilderPages } from "../../drizzle/schema";
import { requireFunnel360School } from "../lib/funnel360Scope";
import { funnel360InsertedId } from "../lib/funnelAiDraftStore";

const schoolProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const school = await requireFunnel360School(ctx);
  return next({ ctx: { ...ctx, school } });
});
const id = z.number().int().positive();
const stepType = z.enum(["landing", "sales", "order", "upsell", "downsell", "thank_you", "webinar", "custom"]);
function expectedSchool(actual: number, expected: number) {
  if (actual !== expected) throw new TRPCError({ code: "CONFLICT", message: "The active school changed. Reload the builder." });
}
async function ownedFunnel(db: any, orgId: number, funnelId: number) {
  const [funnel] = await db.select().from(funnels).where(and(eq(funnels.id, funnelId), eq(funnels.orgId, orgId))).limit(1);
  if (!funnel) throw new TRPCError({ code: "NOT_FOUND" });
  return funnel;
}
async function ownedStep(db: any, orgId: number, stepId: number) {
  const [step] = await db.select().from(funnelSteps).where(eq(funnelSteps.id, stepId)).limit(1);
  if (!step) throw new TRPCError({ code: "NOT_FOUND" });
  await ownedFunnel(db, orgId, step.funnelId);
  return step;
}
export const funnel360NativeRouter = router({
  ensureStepPage: schoolProcedure.input(z.object({ stepId: id }).strict()).mutation(async ({ ctx, input }) => {
    const advanced = await requireFunnel360School(ctx, true);
    expectedSchool(advanced.orgId, ctx.school.orgId);
    await ownedStep(ctx.school.db, ctx.school.orgId, input.stepId);
    return ctx.school.db.transaction(async (tx: any) => {
      const [step] = await tx.select().from(funnelSteps).where(eq(funnelSteps.id, input.stepId)).limit(1).for("update");
      if (!step) throw new TRPCError({ code: "NOT_FOUND" });
      await ownedFunnel(tx, ctx.school.orgId, step.funnelId);
      if (step.pageId) {
        const [page] = await tx.select({ id: pageBuilderPages.id }).from(pageBuilderPages).where(and(eq(pageBuilderPages.id, step.pageId), eq(pageBuilderPages.orgId, ctx.school.orgId))).limit(1);
        if (!page) throw new TRPCError({ code: "NOT_FOUND", message: "The linked page is unavailable in this school." });
        return { pageId: page.id, funnelId: step.funnelId, orgId: ctx.school.orgId };
      }
      const pageId = funnel360InsertedId(await tx.insert(pageBuilderPages).values({
        orgId: ctx.school.orgId, title: step.name, slug: step.slug,
        pageType: step.stepType === "order" ? "checkout" : step.stepType === "thank_you" ? "thank_you" : "custom",
        blocksJson: "[]", isPublished: false,
      }));
      await tx.update(funnelSteps).set({ pageId }).where(and(eq(funnelSteps.id, step.id), eq(funnelSteps.funnelId, step.funnelId)));
      return { pageId, funnelId: step.funnelId, orgId: ctx.school.orgId };
    });
  }),
  getStepPage: schoolProcedure.input(z.object({ stepId: id }).strict()).query(async ({ ctx, input }) => {
    const step = await ownedStep(ctx.school.db, ctx.school.orgId, input.stepId);
    if (!step.pageId) throw new TRPCError({ code: "NOT_FOUND", message: "Design this page first." });
    const [page] = await ctx.school.db.select().from(pageBuilderPages).where(and(eq(pageBuilderPages.id, step.pageId), eq(pageBuilderPages.orgId, ctx.school.orgId))).limit(1);
    if (!page) throw new TRPCError({ code: "NOT_FOUND" });
    const funnel = await ownedFunnel(ctx.school.db, ctx.school.orgId, step.funnelId);
    return { page, orgId: ctx.school.orgId, step, funnel, baseUrl: ctx.school.baseUrl };
  }),
  updateStepPage: schoolProcedure.input(z.object({
    stepId: id, expectedOrgId: id, title: z.string().trim().min(1).max(255),
    metaTitle: z.string().trim().max(255), metaDescription: z.string().trim().max(500),
    blocksJson: z.string().max(500000).refine(value => { try { return Array.isArray(JSON.parse(value)); } catch { return false; } }, "Invalid blocks"),
    isPublished: z.boolean(),
  }).strict()).mutation(async ({ ctx, input }) => {
    expectedSchool(ctx.school.orgId, input.expectedOrgId);
    const advanced = await requireFunnel360School(ctx, true);
    expectedSchool(advanced.orgId, ctx.school.orgId);
    const step = await ownedStep(ctx.school.db, ctx.school.orgId, input.stepId);
    if (!step.pageId) throw new TRPCError({ code: "NOT_FOUND" });
    const [page] = await ctx.school.db.select({ id: pageBuilderPages.id }).from(pageBuilderPages).where(and(eq(pageBuilderPages.id, step.pageId), eq(pageBuilderPages.orgId, ctx.school.orgId))).limit(1);
    if (!page) throw new TRPCError({ code: "NOT_FOUND" });
    const { stepId, expectedOrgId, ...patch } = input;
    await ctx.school.db.update(pageBuilderPages).set(patch).where(and(eq(pageBuilderPages.id, page.id), eq(pageBuilderPages.orgId, ctx.school.orgId)));
    return { success: true };
  }),
  setActive: schoolProcedure.input(z.object({ id, isActive: z.boolean() }).strict()).mutation(async ({ ctx, input }) => {
    const advanced = await requireFunnel360School(ctx, true);
    expectedSchool(advanced.orgId, ctx.school.orgId);
    await ownedFunnel(ctx.school.db, ctx.school.orgId, input.id);
    await ctx.school.db.update(funnels).set({ isActive: input.isActive }).where(and(eq(funnels.id, input.id), eq(funnels.orgId, ctx.school.orgId)));
    return { success: true };
  }),
  list: schoolProcedure.input(z.object({ expectedOrgId: id }).strict()).query(async ({ ctx, input }) => {
    expectedSchool(ctx.school.orgId, input.expectedOrgId);
    return ctx.school.db.select().from(funnels).where(eq(funnels.orgId, ctx.school.orgId)).orderBy(asc(funnels.createdAt));
  }),
  create: schoolProcedure.input(z.object({ expectedOrgId: id, name: z.string().trim().min(1).max(255) }).strict()).mutation(async ({ ctx, input }) => {
    expectedSchool(ctx.school.orgId, input.expectedOrgId);
    const slug = `${input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100) || "funnel"}-${randomUUID()}`;
    const inserted = funnel360InsertedId(await ctx.school.db.insert(funnels).values({ orgId: ctx.school.orgId, name: input.name, slug }));
    return { id: inserted, slug };
  }),
  delete: schoolProcedure.input(z.object({ id }).strict()).mutation(async ({ ctx, input }) => {
    await ownedFunnel(ctx.school.db, ctx.school.orgId, input.id);
    await ctx.school.db.transaction(async tx => {
      await tx.delete(funnelSteps).where(eq(funnelSteps.funnelId, input.id));
      await tx.delete(funnels).where(and(eq(funnels.id, input.id), eq(funnels.orgId, ctx.school.orgId)));
      // Preserve authored pages, content and shared Learn settings, matching manual deletion.
    });
    return { success: true };
  }),
  getWithSteps: schoolProcedure.input(z.object({ id }).strict()).query(async ({ ctx, input }) => {
    const funnel = await ownedFunnel(ctx.school.db, ctx.school.orgId, input.id);
    const steps = await ctx.school.db.select().from(funnelSteps).where(eq(funnelSteps.funnelId, funnel.id)).orderBy(asc(funnelSteps.sortOrder));
    return { ...funnel, steps, baseUrl: ctx.school.baseUrl };
  }),
  createStep: schoolProcedure.input(z.object({ funnelId: id, name: z.string().trim().min(1).max(255), stepType: stepType.optional(), sortOrder: z.number().int().min(0).optional() }).strict()).mutation(async ({ ctx, input }) => {
    await ownedFunnel(ctx.school.db, ctx.school.orgId, input.funnelId);
    const inserted = funnel360InsertedId(await ctx.school.db.insert(funnelSteps).values({
      ...input, stepType: input.stepType || "landing", slug: `step-${randomUUID()}`,
    }));
    return { id: inserted };
  }),
  updateStep: schoolProcedure.input(z.object({ id, name: z.string().trim().min(1).max(255).optional(), stepType: stepType.optional() }).strict()).mutation(async ({ ctx, input }) => {
    const step = await ownedStep(ctx.school.db, ctx.school.orgId, input.id);
    const { id: stepId, ...patch } = input;
    await ctx.school.db.update(funnelSteps).set(patch).where(and(eq(funnelSteps.id, stepId), eq(funnelSteps.funnelId, step.funnelId)));
    return { success: true };
  }),
  deleteStep: schoolProcedure.input(z.object({ id }).strict()).mutation(async ({ ctx, input }) => {
    const step = await ownedStep(ctx.school.db, ctx.school.orgId, input.id);
    await ctx.school.db.delete(funnelSteps).where(and(eq(funnelSteps.id, step.id), eq(funnelSteps.funnelId, step.funnelId)));
    return { success: true };
  }),
  reorderSteps: schoolProcedure.input(z.object({ funnelId: id, stepIds: z.array(id).max(100) }).strict()).mutation(async ({ ctx, input }) => {
    await ownedFunnel(ctx.school.db, ctx.school.orgId, input.funnelId);
    if (new Set(input.stepIds).size !== input.stepIds.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Duplicate steps." });
    const steps = await ctx.school.db.select({ id: funnelSteps.id }).from(funnelSteps).where(eq(funnelSteps.funnelId, input.funnelId));
    if (steps.length !== input.stepIds.length || steps.some(step => !input.stepIds.includes(step.id)))
      throw new TRPCError({ code: "BAD_REQUEST", message: "Steps must belong to this funnel and include the complete order." });
    await ctx.school.db.transaction(async tx => {
      for (const [sortOrder, stepId] of input.stepIds.entries()) await tx.update(funnelSteps).set({ sortOrder })
        .where(and(eq(funnelSteps.id, stepId), eq(funnelSteps.funnelId, input.funnelId)));
    });
    return { success: true };
  }),
});
