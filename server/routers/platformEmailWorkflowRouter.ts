import { TRPCError } from "@trpc/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  emailWorkflowExecutions,
  emailWorkflowSteps,
  emailWorkflows,
  generalFormTemplates,
  organizations,
} from "../../drizzle/schema";
import { EMAIL_WORKFLOW_TRIGGER_TYPES } from "../lib/emailWorkflowEngine";

const siteAdmin = protectedProcedure.use(({ ctx, next }) => {
  if (!["site_owner", "site_admin"].includes(ctx.user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Platform administrator access required." });
  }
  return next({ ctx });
});

const stepSchema = z.object({
  delayMinutes: z.number().int().min(0).max(525600),
  subject: z.string().trim().min(1).max(500),
  htmlBody: z.string().min(1).max(250000),
  previewText: z.string().trim().max(300).optional(),
});

const platformWorkflowInput = z.object({
  id: z.number().int().positive().optional(),
  orgId: z.number().int().positive(),
  name: z.string().trim().min(1).max(255),
  triggerType: z.enum(EMAIL_WORKFLOW_TRIGGER_TYPES),
  triggerResourceId: z.number().int().positive().optional(),
  isActive: z.boolean(),
  steps: z.array(stepSchema).min(1).max(8),
});

async function requireActiveTargetOrganization(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  orgId: number,
) {
  const [organization] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(and(eq(organizations.id, orgId), eq(organizations.isActive, true)))
    .limit(1);
  if (!organization) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Active organization not found." });
  }
}

async function validatePlatformWorkflowResources(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  input: z.infer<typeof platformWorkflowInput>,
) {
  if (input.triggerType !== "form_submitted" || !input.triggerResourceId) return;
  const [form] = await db
    .select({ id: generalFormTemplates.id })
    .from(generalFormTemplates)
    .where(and(
      eq(generalFormTemplates.id, input.triggerResourceId),
      eq(generalFormTemplates.orgId, input.orgId),
    ))
    .limit(1);
  if (!form) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Selected form does not belong to the target organization.",
    });
  }
}

async function cancelScheduledExecutions(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  workflowId: number,
  message: string,
) {
  await db
    .update(emailWorkflowExecutions)
    .set({ status: "cancelled", completedAt: new Date(), errorMessage: message })
    .where(and(
      eq(emailWorkflowExecutions.workflowId, workflowId),
      eq(emailWorkflowExecutions.status, "scheduled"),
    ));
}

export const platformEmailWorkflowRouter = router({
  listTargetOrganizations: siteAdmin.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db
      .select({ id: organizations.id, name: organizations.name, slug: organizations.slug, isActive: organizations.isActive })
      .from(organizations)
      .where(eq(organizations.isActive, true))
      .orderBy(asc(organizations.name));
  }),

  list: siteAdmin
    .input(z.object({ orgId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await requireActiveTargetOrganization(db, input.orgId);
      const items = await db
        .select()
        .from(emailWorkflows)
        .where(and(
          eq(emailWorkflows.orgId, input.orgId),
          eq(emailWorkflows.managedByPlatform, true),
          eq(emailWorkflows.isPlatformWide, false),
        ))
        .orderBy(asc(emailWorkflows.name));
      return Promise.all(items.map(async (item) => ({
        ...item,
        steps: await db
          .select()
          .from(emailWorkflowSteps)
          .where(and(
            eq(emailWorkflowSteps.workflowId, item.id),
            eq(emailWorkflowSteps.orgId, input.orgId),
          ))
          .orderBy(asc(emailWorkflowSteps.position)),
      })));
    }),

  save: siteAdmin.input(platformWorkflowInput).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await requireActiveTargetOrganization(db, input.orgId);
    await validatePlatformWorkflowResources(db, input);

    const data = {
      name: input.name,
      triggerType: input.triggerType,
      triggerResourceId: input.triggerResourceId ?? null,
      isActive: input.isActive,
    };

    if (input.id) {
      const [existing] = await db
        .select({ id: emailWorkflows.id })
        .from(emailWorkflows)
        .where(and(
          eq(emailWorkflows.id, input.id),
          eq(emailWorkflows.orgId, input.orgId),
          eq(emailWorkflows.managedByPlatform, true),
          eq(emailWorkflows.isPlatformWide, false),
        ))
        .limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Platform organization workflow not found." });

      await cancelScheduledExecutions(db, input.id, "Workflow was updated before this email was sent.");
      await db.update(emailWorkflows).set(data).where(eq(emailWorkflows.id, input.id));
      await db.delete(emailWorkflowSteps).where(and(
        eq(emailWorkflowSteps.workflowId, input.id),
        eq(emailWorkflowSteps.orgId, input.orgId),
      ));
      await db.insert(emailWorkflowSteps).values(input.steps.map((step, position) => ({
        orgId: input.orgId,
        workflowId: input.id!,
        position,
        delayMinutes: step.delayMinutes,
        subject: step.subject,
        htmlBody: step.htmlBody,
        previewText: step.previewText ?? null,
      })));
      return { id: input.id };
    }

    const [created] = await db.insert(emailWorkflows).values({
      orgId: input.orgId,
      managedByPlatform: true,
      isPlatformWide: false,
      createdByUserId: ctx.user.id,
      ...data,
    });
    const id = Number((created as { insertId?: number | string }).insertId);
    await db.insert(emailWorkflowSteps).values(input.steps.map((step, position) => ({
      orgId: input.orgId,
      workflowId: id,
      position,
      delayMinutes: step.delayMinutes,
      subject: step.subject,
      htmlBody: step.htmlBody,
      previewText: step.previewText ?? null,
    })));
    return { id };
  }),

  delete: siteAdmin
    .input(z.object({ id: z.number().int().positive(), orgId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await requireActiveTargetOrganization(db, input.orgId);
      const [workflow] = await db
        .select({ id: emailWorkflows.id })
        .from(emailWorkflows)
        .where(and(
          eq(emailWorkflows.id, input.id),
          eq(emailWorkflows.orgId, input.orgId),
          eq(emailWorkflows.managedByPlatform, true),
          eq(emailWorkflows.isPlatformWide, false),
        ))
        .limit(1);
      if (!workflow) throw new TRPCError({ code: "NOT_FOUND", message: "Platform organization workflow not found." });
      await cancelScheduledExecutions(db, input.id, "Workflow was deleted.");
      await db.delete(emailWorkflowSteps).where(and(
        eq(emailWorkflowSteps.workflowId, input.id),
        eq(emailWorkflowSteps.orgId, input.orgId),
      ));
      await db.delete(emailWorkflows).where(eq(emailWorkflows.id, input.id));
      return { success: true };
    }),

  listPlatformWide: siteAdmin.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const items = await db
      .select()
      .from(emailWorkflows)
      .where(and(
        eq(emailWorkflows.managedByPlatform, true),
        eq(emailWorkflows.isPlatformWide, true),
      ))
      .orderBy(asc(emailWorkflows.name));
    return Promise.all(items.map(async (item) => ({
      ...item,
      steps: await db
        .select()
        .from(emailWorkflowSteps)
        .where(and(
          eq(emailWorkflowSteps.workflowId, item.id),
          eq(emailWorkflowSteps.orgId, 0),
        ))
        .orderBy(asc(emailWorkflowSteps.position)),
    })));
  }),

  savePlatformWide: siteAdmin
    .input(z.object({
      id: z.number().int().positive().optional(),
      name: z.string().trim().min(1).max(255),
      triggerType: z.enum(EMAIL_WORKFLOW_TRIGGER_TYPES),
      isActive: z.boolean(),
      steps: z.array(stepSchema).min(1).max(8),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const data = { name: input.name, triggerType: input.triggerType, triggerResourceId: null, isActive: input.isActive };
      if (input.id) {
        const [existing] = await db
          .select({ id: emailWorkflows.id })
          .from(emailWorkflows)
          .where(and(
            eq(emailWorkflows.id, input.id),
            eq(emailWorkflows.managedByPlatform, true),
            eq(emailWorkflows.isPlatformWide, true),
          ))
          .limit(1);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Platform-wide workflow not found." });
        await cancelScheduledExecutions(db, input.id, "Workflow was updated before this email was sent.");
        await db.update(emailWorkflows).set(data).where(eq(emailWorkflows.id, input.id));
        await db.delete(emailWorkflowSteps).where(and(
          eq(emailWorkflowSteps.workflowId, input.id),
          eq(emailWorkflowSteps.orgId, 0),
        ));
        await db.insert(emailWorkflowSteps).values(input.steps.map((step, position) => ({
          orgId: 0,
          workflowId: input.id!,
          position,
          delayMinutes: step.delayMinutes,
          subject: step.subject,
          htmlBody: step.htmlBody,
          previewText: step.previewText ?? null,
        })));
        return { id: input.id };
      }
      const [created] = await db.insert(emailWorkflows).values({
        orgId: 0,
        managedByPlatform: true,
        isPlatformWide: true,
        createdByUserId: ctx.user.id,
        ...data,
      });
      const id = Number((created as { insertId?: number | string }).insertId);
      await db.insert(emailWorkflowSteps).values(input.steps.map((step, position) => ({
        orgId: 0,
        workflowId: id,
        position,
        delayMinutes: step.delayMinutes,
        subject: step.subject,
        htmlBody: step.htmlBody,
        previewText: step.previewText ?? null,
      })));
      return { id };
    }),

  deletePlatformWide: siteAdmin
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [workflow] = await db
        .select({ id: emailWorkflows.id })
        .from(emailWorkflows)
        .where(and(
          eq(emailWorkflows.id, input.id),
          eq(emailWorkflows.managedByPlatform, true),
          eq(emailWorkflows.isPlatformWide, true),
        ))
        .limit(1);
      if (!workflow) throw new TRPCError({ code: "NOT_FOUND", message: "Platform-wide workflow not found." });
      await cancelScheduledExecutions(db, input.id, "Workflow was deleted.");
      await db.delete(emailWorkflowSteps).where(and(
        eq(emailWorkflowSteps.workflowId, input.id),
        eq(emailWorkflowSteps.orgId, 0),
      ));
      await db.delete(emailWorkflows).where(eq(emailWorkflows.id, input.id));
      return { success: true };
    }),
});
