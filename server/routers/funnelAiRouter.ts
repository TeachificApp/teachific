import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { router, protectedProcedure } from "../_core/trpc";
import { funnels, funnelSteps, pageBuilderPages } from "../../drizzle/schema";
import { funnelAiDraftSchema, funnelAiGenerateInputSchema } from "../../shared/funnelAi";
import { generateFunnelAiDraft } from "../lib/funnelAiGeneration";
import { createReviewedFunnelAiDraft } from "../lib/funnelAiDraftStore";
import { requireFunnel360School, assertFunnel360Destination } from "../lib/funnel360Scope";
import { funnel360PageLearnSettings } from "../lib/funnel360Tables";

const generating = new Set<string>();
const advancedSchoolProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const school = await requireFunnel360School(ctx, true);
  return next({ ctx: { ...ctx, school } });
});
export const funnelAiRouter = router({
  scope: protectedProcedure.query(async ({ ctx }) => {
    const { orgId, org, baseUrl } = await requireFunnel360School(ctx);
    return { orgId, schoolName: org.name, baseUrl };
  }),
  generateAiDraft: advancedSchoolProcedure.input(funnelAiGenerateInputSchema).mutation(async ({ ctx, input }) => {
    assertFunnel360Destination(input.ctaUrl, ctx.school.baseUrl);
    const key = `${ctx.school.orgId}:${ctx.user.id}`;
    if (generating.has(key) || generating.size >= 2)
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "A draft is already generating. Please wait and retry." });
    generating.add(key);
    try {
      return { orgId: ctx.school.orgId, draft: await generateFunnelAiDraft(input) };
    } catch (error) {
      throw new TRPCError({ code: error instanceof Error && /deadline/i.test(error.message) ? "TIMEOUT" : "INTERNAL_SERVER_ERROR",
        message: "AI could not return complete copy. No pages were saved; your prior draft is unchanged." });
    } finally { generating.delete(key); }
  }),
  createFromAiDraft: advancedSchoolProcedure.input(z.object({
    requestId: z.string().uuid(), draft: funnelAiDraftSchema,
    // Confirmation only, never selects the organization. Prevents saving an old
    // browser draft after the active school changed in another tab.
    expectedOrgId: z.number().int().positive(),
  }).strict()).mutation(async ({ ctx, input }) => {
    if (input.expectedOrgId !== ctx.school.orgId)
      throw new TRPCError({ code: "CONFLICT", message: "The active school changed. Return to the original school or generate a new draft." });
    try {
      return await createReviewedFunnelAiDraft(ctx.school.db, ctx.school.orgId, ctx.user.id, input.requestId, input.draft, ctx.school.baseUrl);
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Draft could not be saved completely. Your reviewed draft remains available to retry." });
    }
  }),
  getPageLearnSettings: protectedProcedure.input(z.object({ pageId: z.number().int().positive() }).strict()).query(async ({ ctx, input }) => {
    const { db, orgId } = await requireFunnel360School(ctx);
    const [page] = await db.select().from(pageBuilderPages).where(and(eq(pageBuilderPages.id, input.pageId), eq(pageBuilderPages.orgId, orgId))).limit(1);
    if (!page) throw new TRPCError({ code: "NOT_FOUND" });
    const [settings] = await db.select().from(funnel360PageLearnSettings).where(and(eq(funnel360PageLearnSettings.orgId, orgId), eq(funnel360PageLearnSettings.pageId, page.id))).limit(1);
    return { orgId, pageId: page.id, title: page.title, displayName: settings?.displayName ?? null, showInLibrary: settings?.showInLibrary ?? false };
  }),
  updatePageLearnSettings: advancedSchoolProcedure.input(z.object({
    pageId: z.number().int().positive(), displayName: z.string().trim().max(255).nullable().optional(),
    showInLibrary: z.boolean().optional(), expectedOrgId: z.number().int().positive(),
  }).strict()).mutation(async ({ ctx, input }) => {
    const { db, orgId } = ctx.school;
    if (input.expectedOrgId !== orgId) throw new TRPCError({ code: "CONFLICT", message: "The active school changed." });
    const [page] = await db.select({ id: pageBuilderPages.id }).from(pageBuilderPages)
      .where(and(eq(pageBuilderPages.id, input.pageId), eq(pageBuilderPages.orgId, orgId))).limit(1);
    if (!page) throw new TRPCError({ code: "NOT_FOUND" });
    const patch = {
      ...(input.displayName !== undefined ? { displayName: input.displayName?.trim() || null } : {}),
      ...(input.showInLibrary !== undefined ? { showInLibrary: input.showInLibrary } : {}),
    };
    if (Object.keys(patch).length) await db.insert(funnel360PageLearnSettings)
      .values({ orgId, pageId: page.id, ...patch }).onDuplicateKeyUpdate({ set: patch });
    return { success: true as const };
  }),
  getFunnelPublishingInfo: protectedProcedure.input(z.object({ funnelId: z.number().int().positive() }).strict()).query(async ({ ctx, input }) => {
    const { db, orgId, baseUrl } = await requireFunnel360School(ctx);
    const [funnel] = await db.select({ id: funnels.id }).from(funnels).where(and(eq(funnels.id, input.funnelId), eq(funnels.orgId, orgId))).limit(1);
    if (!funnel) throw new TRPCError({ code: "NOT_FOUND" });
    // Through the owning funnel, not arbitrary step/page IDs supplied by the browser.
    const steps = await db.select().from(funnelSteps).where(eq(funnelSteps.funnelId, funnel.id));
    return { orgId, baseUrl, stepIds: steps.map(step => step.id) };
  }),
});
