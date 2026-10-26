import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb, getOrgIdForUserWithFallback, requireOrgAdmin } from "../db";
import { emailCampaigns, emailSenderProfiles, emailWorkflowExecutions, emailWorkflows, emailWorkflowSteps, generalFormTemplates, lmsCourses } from "../../drizzle/schema";
import { assertEmailAutomationEntitlement, EMAIL_WORKFLOW_TRIGGER_TYPES } from "../lib/emailWorkflowEngine";

const triggerSchema = z.enum(EMAIL_WORKFLOW_TRIGGER_TYPES);
const stepSchema = z.object({ id: z.number().int().positive().optional(), delayMinutes: z.number().int().min(0).max(525600).default(0), subject: z.string().trim().min(1).max(500), htmlBody: z.string().min(1).max(250000), previewText: z.string().trim().max(300).optional(), senderProfileId: z.number().int().positive().optional() });
async function requireWorkflowOrg(user: { id: number; role: string }) {
  const orgId = await getOrgIdForUserWithFallback(user.id, user.role);
  if (!orgId) throw new TRPCError({ code: "FORBIDDEN", message: "Select an active organization before managing email automations." });
  await requireOrgAdmin(user.id, user.role, orgId);
  return orgId;
}
async function validateWorkflowResources(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, orgId: number, triggerType: string, triggerResourceId: number | undefined, steps: Array<z.infer<typeof stepSchema>>) {
  if (triggerResourceId && triggerType === "form_submitted") {
    const [form] = await db.select({ id: generalFormTemplates.id }).from(generalFormTemplates).where(and(eq(generalFormTemplates.id, triggerResourceId), eq(generalFormTemplates.orgId, orgId))).limit(1);
    if (!form) throw new TRPCError({ code: "FORBIDDEN", message: "Selected form does not belong to the active organization." });
  }
  if (triggerResourceId && ["course_enrolled", "lesson_completed", "course_completed", "purchase_completed"].includes(triggerType)) {
    const [course] = await db.select({ id: lmsCourses.id }).from(lmsCourses).where(and(eq(lmsCourses.id, triggerResourceId), eq(lmsCourses.orgId, orgId))).limit(1);
    if (!course) throw new TRPCError({ code: "FORBIDDEN", message: "Selected course does not belong to the active organization." });
  }
  if (triggerResourceId && ["campaign_opened", "campaign_clicked"].includes(triggerType)) {
    const [campaign] = await db.select({ id: emailCampaigns.id }).from(emailCampaigns).where(and(eq(emailCampaigns.id, triggerResourceId), eq(emailCampaigns.orgId, orgId))).limit(1);
    if (!campaign) throw new TRPCError({ code: "FORBIDDEN", message: "Selected campaign does not belong to the active organization." });
  }
  const senderIds = [...new Set(steps.flatMap((step) => step.senderProfileId ? [step.senderProfileId] : []))];
  if (senderIds.length) {
    const rows = await db.select({ id: emailSenderProfiles.id }).from(emailSenderProfiles).where(and(inArray(emailSenderProfiles.id, senderIds), eq(emailSenderProfiles.orgId, orgId)));
    if (rows.length !== senderIds.length) throw new TRPCError({ code: "FORBIDDEN", message: "A selected sender profile does not belong to the active organization." });
  }
}
export const emailWorkflowRouter = router({
  getAvailability: protectedProcedure.query(async ({ ctx }) => {
    const orgId = await requireWorkflowOrg(ctx.user);
    try { await assertEmailAutomationEntitlement(orgId); return { available: true, requiredPlan: "pro" as const }; }
    catch (error) { if (error instanceof TRPCError && error.code === "FORBIDDEN") return { available: false, requiredPlan: "pro" as const }; throw error; }
  }),
  listForms: protectedProcedure.query(async ({ ctx }) => {
    const orgId = await requireWorkflowOrg(ctx.user);
    const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db.select({ id: generalFormTemplates.id, name: generalFormTemplates.name, slug: generalFormTemplates.slug }).from(generalFormTemplates).where(eq(generalFormTemplates.orgId, orgId)).orderBy(asc(generalFormTemplates.name));
  }),
  listTriggerResources: protectedProcedure.input(z.object({ triggerType: triggerSchema })).query(async ({ ctx, input }) => {
    const orgId = await requireWorkflowOrg(ctx.user);
    const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    if (input.triggerType === "form_submitted") {
      return db.select({ id: generalFormTemplates.id, name: generalFormTemplates.name, detail: generalFormTemplates.slug }).from(generalFormTemplates).where(eq(generalFormTemplates.orgId, orgId)).orderBy(asc(generalFormTemplates.name));
    }
    if (["course_enrolled", "lesson_completed", "course_completed", "purchase_completed"].includes(input.triggerType)) {
      return db.select({ id: lmsCourses.id, name: lmsCourses.title, detail: lmsCourses.slug }).from(lmsCourses).where(eq(lmsCourses.orgId, orgId)).orderBy(asc(lmsCourses.title));
    }
    if (["campaign_opened", "campaign_clicked"].includes(input.triggerType)) {
      return db.select({ id: emailCampaigns.id, name: emailCampaigns.name, detail: emailCampaigns.subject }).from(emailCampaigns).where(and(eq(emailCampaigns.orgId, orgId), eq(emailCampaigns.status, "sent"))).orderBy(asc(emailCampaigns.name));
    }
    return [];
  }),
  listWorkflows: protectedProcedure.query(async ({ ctx }) => {
    const orgId = await requireWorkflowOrg(ctx.user); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const workflows = await db.select().from(emailWorkflows).where(and(eq(emailWorkflows.orgId, orgId), eq(emailWorkflows.managedByPlatform, false))).orderBy(asc(emailWorkflows.name));
    return Promise.all(workflows.map(async (workflow) => ({ ...workflow, steps: await db.select().from(emailWorkflowSteps).where(and(eq(emailWorkflowSteps.orgId, orgId), eq(emailWorkflowSteps.workflowId, workflow.id))).orderBy(asc(emailWorkflowSteps.position)) })));
  }),
  listExecutions: protectedProcedure.input(z.object({ workflowId: z.number().int().positive(), limit: z.number().int().min(1).max(100).default(30) })).query(async ({ ctx, input }) => {
    const orgId = await requireWorkflowOrg(ctx.user); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [workflow] = await db.select({ id: emailWorkflows.id }).from(emailWorkflows).where(and(eq(emailWorkflows.id, input.workflowId), eq(emailWorkflows.orgId, orgId))).limit(1);
    if (!workflow) throw new TRPCError({ code: "NOT_FOUND", message: "Workflow not found in the active organization." });
    return db.select().from(emailWorkflowExecutions).where(and(eq(emailWorkflowExecutions.orgId, orgId), eq(emailWorkflowExecutions.workflowId, input.workflowId))).orderBy(asc(emailWorkflowExecutions.createdAt)).limit(input.limit);
  }),
  saveWorkflow: protectedProcedure.input(z.object({ id: z.number().int().positive().optional(), name: z.string().trim().min(1).max(255), description: z.string().trim().max(1000).optional(), triggerType: triggerSchema, triggerResourceId: z.number().int().positive().optional(), conditionField: z.string().trim().max(128).optional(), conditionOperator: z.enum(["equals", "not_equals", "contains", "is_set"]).optional(), conditionValue: z.string().trim().max(1000).optional(), isActive: z.boolean().default(false), steps: z.array(stepSchema).min(1).max(8) })).mutation(async ({ ctx, input }) => {
    const orgId = await requireWorkflowOrg(ctx.user); const db = await assertEmailAutomationEntitlement(orgId);
    await validateWorkflowResources(db, orgId, input.triggerType, input.triggerResourceId, input.steps);
    if (input.id) {
      const [existing] = await db.select({ id: emailWorkflows.id }).from(emailWorkflows).where(and(eq(emailWorkflows.id, input.id), eq(emailWorkflows.orgId, orgId), eq(emailWorkflows.managedByPlatform, false))).limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Workflow not found in the active organization." });
      await db.update(emailWorkflows).set({ name: input.name, description: input.description ?? null, triggerType: input.triggerType, triggerResourceId: input.triggerResourceId ?? null, conditionField: input.conditionField ?? null, conditionOperator: input.conditionOperator ?? null, conditionValue: input.conditionValue ?? null, isActive: input.isActive }).where(and(eq(emailWorkflows.id, input.id), eq(emailWorkflows.orgId, orgId)));
      await db.delete(emailWorkflowSteps).where(and(eq(emailWorkflowSteps.workflowId, input.id), eq(emailWorkflowSteps.orgId, orgId)));
      await db.insert(emailWorkflowSteps).values(input.steps.map((step, position) => ({ workflowId: input.id!, orgId, position, delayMinutes: step.delayMinutes, subject: step.subject, htmlBody: step.htmlBody, previewText: step.previewText ?? null, senderProfileId: step.senderProfileId ?? null })));
      return { id: input.id };
    }
    const [created] = await db.insert(emailWorkflows).values({ orgId, name: input.name, description: input.description ?? null, triggerType: input.triggerType, triggerResourceId: input.triggerResourceId ?? null, conditionField: input.conditionField ?? null, conditionOperator: input.conditionOperator ?? null, conditionValue: input.conditionValue ?? null, isActive: input.isActive, createdByUserId: ctx.user.id });
    const workflowId = Number((created as any).insertId);
    await db.insert(emailWorkflowSteps).values(input.steps.map((step, position) => ({ workflowId, orgId, position, delayMinutes: step.delayMinutes, subject: step.subject, htmlBody: step.htmlBody, previewText: step.previewText ?? null, senderProfileId: step.senderProfileId ?? null })));
    return { id: workflowId };
  }),
  deleteWorkflow: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const orgId = await requireWorkflowOrg(ctx.user); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.update(emailWorkflows).set({ isActive: false }).where(and(eq(emailWorkflows.id, input.id), eq(emailWorkflows.orgId, orgId)));
    await db.update(emailWorkflowExecutions).set({ status: "cancelled", completedAt: new Date(), errorMessage: "Workflow was deleted." }).where(and(eq(emailWorkflowExecutions.workflowId, input.id), eq(emailWorkflowExecutions.orgId, orgId), eq(emailWorkflowExecutions.status, "scheduled")));
    await db.delete(emailWorkflowSteps).where(and(eq(emailWorkflowSteps.workflowId, input.id), eq(emailWorkflowSteps.orgId, orgId)));
    await db.delete(emailWorkflows).where(and(eq(emailWorkflows.id, input.id), eq(emailWorkflows.orgId, orgId)));
    return { success: true };
  }),
});
