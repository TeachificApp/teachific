import { and, asc, eq, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  contactConsents,
  contacts,
  emailSenderProfiles,
  emailUnsubscribes,
  emailWorkflowEvents,
  emailWorkflowExecutions,
  emailWorkflowSteps,
  emailWorkflows,
  organizations,
  orgSubscriptions,
  orgThemes,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { sdk } from "../_core/sdk";
import { createHeartbeatJob } from "../_core/heartbeat";
import { sendEmailViaOrg } from "../_core/email";
import { getEffectiveSubscriptionPlan } from "../../shared/subscriptionEntitlement";
import { getOrgBaseUrl } from "./orgUrl";
import { prepareEmailRichTextHtml } from "../../shared/emailRichTextHtml";
import { wrapInBrandedCampaignEmail } from "../../shared/emailCampaignLayout";
import { buildEmailWorkflowUnsubscribeToken } from "./emailWorkflowUnsubscribe";

export const EMAIL_WORKFLOW_TRIGGER_TYPES = ["form_submitted", "lesson_completed", "course_completed", "course_enrolled", "purchase_completed", "campaign_opened", "campaign_clicked"] as const;
export type EmailWorkflowTriggerType = typeof EMAIL_WORKFLOW_TRIGGER_TYPES[number];

export function canUseEmailAutomations(plan?: string | null, status?: string | null) {
  const effective = getEffectiveSubscriptionPlan(plan, status);
  return effective === "pro" || effective === "enterprise";
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] ?? char));
const cronForDate = (date: Date) => `0 ${date.getUTCMinutes()} ${date.getUTCHours()} ${date.getUTCDate()} ${date.getUTCMonth() + 1} *`;
const normalizeEmail = (email: string) => email.trim().toLowerCase();

function evaluateCondition(workflow: typeof emailWorkflows.$inferSelect, payload: Record<string, unknown>) {
  if (!workflow.conditionField || !workflow.conditionOperator) return true;
  const nested = payload.responses && typeof payload.responses === "object" ? payload.responses as Record<string, unknown> : {};
  const actual = payload[workflow.conditionField] ?? nested[workflow.conditionField];
  const text = Array.isArray(actual) ? actual.join(", ") : actual == null ? "" : String(actual);
  const expected = workflow.conditionValue ?? "";
  switch (workflow.conditionOperator) {
    case "equals": return text === expected;
    case "not_equals": return text !== expected;
    case "contains": return text.toLowerCase().includes(expected.toLowerCase());
    case "is_set": return text.trim().length > 0;
    default: return false;
  }
}

function matchesWorkflowResource(
  workflow: typeof emailWorkflows.$inferSelect,
  sourceId: number,
  payload: Record<string, unknown>,
) {
  if (!workflow.triggerResourceId) return true;
  if (["course_enrolled", "lesson_completed", "course_completed", "purchase_completed"].includes(workflow.triggerType)) {
    return Number(payload.courseId) === workflow.triggerResourceId;
  }
  return workflow.triggerResourceId === sourceId;
}

export async function assertEmailAutomationEntitlement(orgId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
  const [subscription] = await db.select({ plan: orgSubscriptions.plan, status: orgSubscriptions.status }).from(orgSubscriptions).where(eq(orgSubscriptions.orgId, orgId)).limit(1);
  if (!canUseEmailAutomations(subscription?.plan, subscription?.status)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Email automations are available on active Pro and Enterprise plans." });
  }
  return db;
}

export async function emitEmailWorkflowEvent(input: {
  orgId: number;
  eventType: EmailWorkflowTriggerType;
  sourceType: string;
  sourceId: number;
  idempotencyKey: string;
  recipientEmail?: string | null;
  recipientName?: string | null;
  recipientUserId?: number | null;
  payload?: Record<string, unknown>;
}) {
  const email = input.recipientEmail ? normalizeEmail(input.recipientEmail) : "";
  if (!email) return { accepted: false, reason: "missing_recipient" as const };
  const db = await getDb();
  if (!db) return { accepted: false, reason: "database_unavailable" as const };
  const [org, subscription] = await Promise.all([
    db.select({ isActive: organizations.isActive }).from(organizations).where(eq(organizations.id, input.orgId)).limit(1),
    db.select({ plan: orgSubscriptions.plan, status: orgSubscriptions.status }).from(orgSubscriptions).where(eq(orgSubscriptions.orgId, input.orgId)).limit(1),
  ]);
  if (!org[0]?.isActive) return { accepted: false, reason: "not_entitled" as const };
  const [existing] = await db.select({ id: emailWorkflowEvents.id }).from(emailWorkflowEvents).where(and(eq(emailWorkflowEvents.orgId, input.orgId), eq(emailWorkflowEvents.idempotencyKey, input.idempotencyKey))).limit(1);
  if (existing) return { accepted: false, reason: "duplicate" as const };
  let eventId: number;
  try {
    const [created] = await db.insert(emailWorkflowEvents).values({ orgId: input.orgId, eventType: input.eventType, sourceType: input.sourceType, sourceId: input.sourceId, recipientEmail: email, recipientName: input.recipientName ?? null, recipientUserId: input.recipientUserId ?? null, payload: input.payload ?? {}, idempotencyKey: input.idempotencyKey });
    eventId = Number((created as any).insertId);
  } catch { return { accepted: false, reason: "duplicate" as const }; }
  const workflows = await db.select().from(emailWorkflows).where(and(or(eq(emailWorkflows.orgId, input.orgId), eq(emailWorkflows.isPlatformWide, true)), eq(emailWorkflows.triggerType, input.eventType), eq(emailWorkflows.isActive, true)));
  let queued = 0;
  for (const workflow of workflows) {
    if (!workflow.managedByPlatform && !canUseEmailAutomations(subscription[0]?.plan, subscription[0]?.status)) continue;
    if (!matchesWorkflowResource(workflow, input.sourceId, input.payload ?? {})) continue;
    if (!evaluateCondition(workflow, input.payload ?? {})) continue;
    const stepScopeOrgId = workflow.isPlatformWide ? 0 : input.orgId;
    const steps = await db.select().from(emailWorkflowSteps).where(and(eq(emailWorkflowSteps.orgId, stepScopeOrgId), eq(emailWorkflowSteps.workflowId, workflow.id), eq(emailWorkflowSteps.isActive, true))).orderBy(asc(emailWorkflowSteps.position));
    let cumulativeMinutes = 0;
    for (const step of steps) {
      cumulativeMinutes += Math.max(0, step.delayMinutes ?? 0);
      const dueAt = new Date(Date.now() + cumulativeMinutes * 60_000);
      const [result] = await db.insert(emailWorkflowExecutions).values({ orgId: input.orgId, workflowId: workflow.id, workflowStepId: step.id, eventId, recipientEmail: email, recipientName: input.recipientName ?? null, recipientUserId: input.recipientUserId ?? null, status: cumulativeMinutes === 0 ? "pending" : "scheduled", dueAt });
      const executionId = Number((result as any).insertId);
      if (cumulativeMinutes === 0) {
        await executeEmailWorkflowExecution(executionId);
      } else {
        try {
          const task = await createHeartbeatJob({ name: `email-workflow-${executionId}`, cron: cronForDate(dueAt), path: "/api/scheduled/send-email-workflow", payload: { executionId }, description: `Send email automation execution #${executionId}` }, "");
          await db.update(emailWorkflowExecutions).set({ scheduleCronTaskUid: task.taskUid }).where(and(eq(emailWorkflowExecutions.id, executionId), eq(emailWorkflowExecutions.orgId, input.orgId)));
        } catch (error) {
          await db.update(emailWorkflowExecutions).set({ status: "failed", errorMessage: error instanceof Error ? error.message.slice(0, 2000) : "Unable to schedule workflow email", completedAt: new Date() }).where(eq(emailWorkflowExecutions.id, executionId));
        }
      }
      queued++;
    }
  }
  return { accepted: true, eventId, queued };
}

export async function executeEmailWorkflowExecution(executionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [execution] = await db.select().from(emailWorkflowExecutions).where(eq(emailWorkflowExecutions.id, executionId)).limit(1);
  if (!execution || !["pending", "scheduled"].includes(execution.status)) return { ok: true, skipped: true };
  const [workflow, step, org, subscription] = await Promise.all([
    db.select().from(emailWorkflows).where(eq(emailWorkflows.id, execution.workflowId)).limit(1),
    db.select().from(emailWorkflowSteps).where(eq(emailWorkflowSteps.id, execution.workflowStepId)).limit(1),
    db.select({ name: organizations.name, slug: organizations.slug, customDomain: organizations.customDomain, domainVerificationStatus: organizations.domainVerificationStatus, isActive: organizations.isActive }).from(organizations).where(eq(organizations.id, execution.orgId)).limit(1),
    db.select({ plan: orgSubscriptions.plan, status: orgSubscriptions.status }).from(orgSubscriptions).where(eq(orgSubscriptions.orgId, execution.orgId)).limit(1),
  ]);
  if (!workflow[0]?.isActive || !step[0]?.isActive || !org[0]?.isActive || (!workflow[0]?.managedByPlatform && !canUseEmailAutomations(subscription[0]?.plan, subscription[0]?.status))) {
    await db.update(emailWorkflowExecutions).set({ status: "cancelled", completedAt: new Date(), errorMessage: "Workflow, organization, or subscription is inactive." }).where(eq(emailWorkflowExecutions.id, executionId));
    return { ok: true, skipped: true };
  }
  const [unsubscribed, contact] = await Promise.all([
    db.select({ id: emailUnsubscribes.id }).from(emailUnsubscribes).where(and(eq(emailUnsubscribes.orgId, execution.orgId), eq(emailUnsubscribes.email, execution.recipientEmail))).limit(1),
    db.select({ id: contacts.id, deletedAt: contacts.deletedAt }).from(contacts).where(and(eq(contacts.orgId, execution.orgId), eq(contacts.emailNormalized, execution.recipientEmail))).limit(1),
  ]);
  if (unsubscribed || contact[0]?.deletedAt) {
    await db.update(emailWorkflowExecutions).set({ status: "skipped", completedAt: new Date(), errorMessage: "Recipient is suppressed or deleted." }).where(eq(emailWorkflowExecutions.id, executionId));
    return { ok: true, skipped: true };
  }
  if (contact[0]) {
    const [consent] = await db.select({ status: contactConsents.status }).from(contactConsents).where(and(eq(contactConsents.orgId, execution.orgId), eq(contactConsents.contactId, contact[0].id), eq(contactConsents.consentType, "marketing_email"))).limit(1);
    if (consent?.status === "withdrawn") {
      await db.update(emailWorkflowExecutions).set({ status: "skipped", completedAt: new Date(), errorMessage: "Marketing consent was withdrawn." }).where(eq(emailWorkflowExecutions.id, executionId));
      return { ok: true, skipped: true };
    }
  }
  await db.update(emailWorkflowExecutions).set({ status: "sending", attempts: (execution.attempts ?? 0) + 1 }).where(and(eq(emailWorkflowExecutions.id, executionId), eq(emailWorkflowExecutions.status, execution.status)));
  const [theme, sender] = await Promise.all([
    db.select({ schoolName: orgThemes.schoolName, primaryColor: orgThemes.primaryColor, buttonColor: orgThemes.buttonColor, adminLogoUrl: orgThemes.adminLogoUrl }).from(orgThemes).where(eq(orgThemes.orgId, execution.orgId)).limit(1),
    step[0].senderProfileId ? db.select().from(emailSenderProfiles).where(and(eq(emailSenderProfiles.id, step[0].senderProfileId), eq(emailSenderProfiles.orgId, execution.orgId))).limit(1) : Promise.resolve([]),
  ]);
  const displayName = theme[0]?.schoolName?.trim() || org[0].name || "Course360™";
  const baseUrl = getOrgBaseUrl(org[0].slug, org[0].customDomain, org[0].domainVerificationStatus) || "https://course360.app";
  const token = buildEmailWorkflowUnsubscribeToken({ orgId: execution.orgId, email: execution.recipientEmail, userId: execution.recipientUserId });
  const unsubscribeUrl = `${baseUrl.replace(/\/$/, "")}/api/email/workflow-unsubscribe?token=${encodeURIComponent(token)}`;
  const name = execution.recipientName ? escapeHtml(execution.recipientName) : "there";
  const body = prepareEmailRichTextHtml(step[0].htmlBody).replaceAll("{{recipient_name}}", name).replaceAll("{{org_name}}", escapeHtml(displayName)).replaceAll("{{unsubscribe_url}}", unsubscribeUrl);
  const htmlBody = wrapInBrandedCampaignEmail(body, step[0].previewText ?? undefined, undefined, undefined, undefined, true, theme[0]?.buttonColor ?? theme[0]?.primaryColor ?? "#189aa1", displayName, theme[0]?.adminLogoUrl ?? null);
  const sent = await sendEmailViaOrg({ to: { name: execution.recipientName ?? execution.recipientEmail, email: execution.recipientEmail }, subject: step[0].subject.replaceAll("{{recipient_name}}", execution.recipientName ?? "there").replaceAll("{{org_name}}", displayName), htmlBody, previewText: step[0].previewText ?? undefined, fromName: sender[0]?.name, fromEmail: sender[0]?.email, listUnsubscribeUrl: unsubscribeUrl }, execution.orgId);
  await db.update(emailWorkflowExecutions).set({ status: sent ? "sent" : "failed", sentAt: sent ? new Date() : null, completedAt: new Date(), errorMessage: sent ? null : "Email provider did not accept the send." }).where(eq(emailWorkflowExecutions.id, executionId));
  return { ok: sent };
}

export async function handleScheduledEmailWorkflowSend(req: Request, res: any) {
  try {
    const cronUser = await sdk.authenticateRequest(req as any);
    if (!cronUser.isCron || !cronUser.taskUid) return res.status(403).json({ error: "cron-only" });
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "DB unavailable" });
    const [execution] = await db.select({ id: emailWorkflowExecutions.id }).from(emailWorkflowExecutions).where(eq(emailWorkflowExecutions.scheduleCronTaskUid, cronUser.taskUid)).limit(1);
    if (!execution) return res.json({ ok: true, skipped: "orphaned" });
    const result = await executeEmailWorkflowExecution(execution.id);
    return res.json({ ...result, executionId: execution.id });
  } catch (error) { return res.status(500).json({ error: error instanceof Error ? error.message : "Workflow delivery failed" }); }
}
