/**
 * Zapier Integration Router
 *
 * Allows org admins (Builder tier and above) to register webhook URLs
 * that receive events from their school. Supports:
 *  - new_enrollment: when a learner enrolls in a course
 *  - course_completed: when a learner completes a course
 *  - form_submitted: when a form response is submitted
 *  - new_order: when a purchase/order is completed
 *  - new_member: when a new member joins the org
 *
 * Tier gate: Builder, Pro, Enterprise only.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, and, desc, sql } from "drizzle-orm";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { zapierWebhooks, zapierWebhookLogs, orgMembers, organizations, orgSubscriptions } from "../drizzle/schema";
import type { PlanTier } from "../shared/tierLimits";
import crypto from "crypto";

// ─── Supported event types ────────────────────────────────────────────────────
export const ZAPIER_EVENT_TYPES = [
  "new_enrollment",
  "course_completed",
  "form_submitted",
  "new_order",
  "new_member",
] as const;
export type ZapierEventType = (typeof ZAPIER_EVENT_TYPES)[number];

// ─── Tier gate: Builder and above ─────────────────────────────────────────────
const ALLOWED_TIERS: PlanTier[] = ["builder", "pro", "enterprise"];

async function getOrgContextForZapier(userId: number, userRole?: string) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

  // Platform owners/admins bypass all tier checks
  const isPlatformAdmin = userRole === "site_owner" || userRole === "site_admin";

  const rows = await db
    .select({
      orgId: orgMembers.orgId,
      role: orgMembers.role,
      orgName: organizations.name,
    })
    .from(orgMembers)
    .innerJoin(organizations, eq(organizations.id, orgMembers.orgId))
    .where(eq(orgMembers.userId, userId))
    .limit(1);

  const orgCtx = rows[0];
  if (!orgCtx) throw new TRPCError({ code: "FORBIDDEN", message: "No organization found" });

  // Platform admins skip role and tier checks
  if (isPlatformAdmin) {
    return { ...orgCtx, tier: "enterprise" as PlanTier };
  }

  // Must be org_admin or org_super_admin
  if (orgCtx.role !== "org_admin" && orgCtx.role !== "org_super_admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Only org admins can manage Zapier integrations" });
  }

  // Check plan tier
  const [sub] = await db
    .select({ plan: orgSubscriptions.plan })
    .from(orgSubscriptions)
    .where(eq(orgSubscriptions.orgId, orgCtx.orgId))
    .limit(1);

  const tier = (sub?.plan as PlanTier) ?? "free";
  if (!ALLOWED_TIERS.includes(tier)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Zapier integration requires Builder plan or above. Please upgrade your subscription.",
    });
  }

  return { ...orgCtx, tier };
}

// ─── Webhook dispatch helper (called from event sources) ──────────────────────
export async function dispatchZapierEvent(
  orgId: number,
  eventType: ZapierEventType,
  payload: Record<string, unknown>,
) {
  const db = await getDb();
  if (!db) return;

  // Find all active webhooks for this org + event type
  const webhooks = await db
    .select()
    .from(zapierWebhooks)
    .where(
      and(
        eq(zapierWebhooks.orgId, orgId),
        eq(zapierWebhooks.eventType, eventType),
        eq(zapierWebhooks.isActive, true),
      ),
    );

  if (!webhooks.length) return;

  const eventPayload = {
    event: eventType,
    timestamp: new Date().toISOString(),
    org_id: orgId,
    data: payload,
  };

  // Fire webhooks in parallel (non-blocking)
  for (const webhook of webhooks) {
    fireWebhook(db, webhook, eventPayload).catch((err) => {
      console.error(`[Zapier] Failed to fire webhook ${webhook.id}:`, err.message);
    });
  }
}

async function fireWebhook(
  db: any,
  webhook: typeof zapierWebhooks.$inferSelect,
  payload: Record<string, unknown>,
) {
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "Teachific-Zapier/1.0",
  };

  // Add HMAC signature if secret is configured
  if (webhook.secret) {
    const signature = crypto
      .createHmac("sha256", webhook.secret)
      .update(body)
      .digest("hex");
    headers["X-Teachific-Signature"] = signature;
  }

  let responseStatus = 0;
  let responseBody = "";
  let success = false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(webhook.webhookUrl, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    responseStatus = response.status;
    responseBody = await response.text().catch(() => "");
    success = response.ok;
  } catch (err: any) {
    responseStatus = 0;
    responseBody = err.message ?? "Network error";
    success = false;
  }

  // Log the attempt
  await db.insert(zapierWebhookLogs).values({
    webhookId: webhook.id,
    orgId: webhook.orgId,
    eventType: webhook.eventType,
    payload: body,
    responseStatus,
    responseBody: responseBody.slice(0, 2000),
    success,
  });

  // Update webhook stats
  await db
    .update(zapierWebhooks)
    .set({
      lastTriggeredAt: new Date(),
      lastStatus: success ? "success" : "failed",
      triggerCount: sql`${zapierWebhooks.triggerCount} + 1`,
    })
    .where(eq(zapierWebhooks.id, webhook.id));
}

// ─── tRPC Router ──────────────────────────────────────────────────────────────
export const zapierRouter = router({
  /**
   * List all webhooks for the org.
   * Groups rows by URL so the frontend sees one webhook with multiple events.
   */
  list: protectedProcedure
    .input(z.object({ orgId: z.number().optional() }).optional())
    .query(async ({ ctx }) => {
      const orgCtx = await getOrgContextForZapier(ctx.user.id, ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const rows = await db
        .select()
        .from(zapierWebhooks)
        .where(eq(zapierWebhooks.orgId, orgCtx.orgId))
        .orderBy(desc(zapierWebhooks.createdAt));

      // Group by webhookUrl so the frontend sees one entry per endpoint
      const grouped = new Map<string, {
        id: number;
        name: string;
        url: string;
        events: string[];
        active: boolean;
        lastTriggeredAt: Date | null;
        secret: string | null;
        triggerCount: number;
      }>();

      for (const row of rows) {
        const key = row.webhookUrl;
        if (grouped.has(key)) {
          grouped.get(key)!.events.push(row.eventType);
          // Use the most recent trigger time
          if (row.lastTriggeredAt && (!grouped.get(key)!.lastTriggeredAt || row.lastTriggeredAt > grouped.get(key)!.lastTriggeredAt!)) {
            grouped.get(key)!.lastTriggeredAt = row.lastTriggeredAt;
          }
        } else {
          grouped.set(key, {
            id: row.id, // use first row's id as the group id
            name: row.name,
            url: row.webhookUrl,
            events: [row.eventType],
            active: row.isActive,
            lastTriggeredAt: row.lastTriggeredAt,
            secret: row.secret,
            triggerCount: row.triggerCount,
          });
        }
      }

      return Array.from(grouped.values());
    }),

  /**
   * Create webhook endpoint — creates one row per event type for the same URL.
   * Frontend sends { orgId, url, name?, events: string[] }.
   */
  create: protectedProcedure
    .input(
      z.object({
        orgId: z.number().optional(),
        url: z.string().url().max(2000),
        name: z.string().max(255).optional(),
        events: z.array(z.enum(ZAPIER_EVENT_TYPES)).min(1),
        secret: z.string().max(128).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgCtx = await getOrgContextForZapier(ctx.user.id, ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Limit to 50 webhook rows per org
      const [countRow] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(zapierWebhooks)
        .where(eq(zapierWebhooks.orgId, orgCtx.orgId));
      if ((countRow?.count ?? 0) + input.events.length > 50) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Maximum 50 webhook subscriptions per organization" });
      }

      const secret = input.secret || crypto.randomBytes(32).toString("hex");
      const webhookName = input.name || "Webhook";

      for (const eventType of input.events) {
        await db.insert(zapierWebhooks).values({
          orgId: orgCtx.orgId,
          name: webhookName,
          webhookUrl: input.url,
          eventType,
          secret,
          isActive: true,
        });
      }

      return { success: true };
    }),

  /** Toggle active state for all rows sharing the same webhookUrl */
  toggle: protectedProcedure
    .input(z.object({ id: z.number(), orgId: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      const orgCtx = await getOrgContextForZapier(ctx.user.id, ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [webhook] = await db
        .select()
        .from(zapierWebhooks)
        .where(and(eq(zapierWebhooks.id, input.id), eq(zapierWebhooks.orgId, orgCtx.orgId)))
        .limit(1);
      if (!webhook) throw new TRPCError({ code: "NOT_FOUND" });

      const newActive = !webhook.isActive;
      // Toggle all rows with the same URL for this org
      await db
        .update(zapierWebhooks)
        .set({ isActive: newActive })
        .where(and(
          eq(zapierWebhooks.orgId, orgCtx.orgId),
          eq(zapierWebhooks.webhookUrl, webhook.webhookUrl),
        ));

      return { success: true };
    }),

  /** Delete all webhook rows sharing the same URL */
  delete: protectedProcedure
    .input(z.object({ id: z.number(), orgId: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      const orgCtx = await getOrgContextForZapier(ctx.user.id, ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [webhook] = await db
        .select()
        .from(zapierWebhooks)
        .where(and(eq(zapierWebhooks.id, input.id), eq(zapierWebhooks.orgId, orgCtx.orgId)))
        .limit(1);
      if (!webhook) throw new TRPCError({ code: "NOT_FOUND" });

      // Get all rows with same URL
      const allRows = await db
        .select({ id: zapierWebhooks.id })
        .from(zapierWebhooks)
        .where(and(
          eq(zapierWebhooks.orgId, orgCtx.orgId),
          eq(zapierWebhooks.webhookUrl, webhook.webhookUrl),
        ));

      for (const row of allRows) {
        await db.delete(zapierWebhookLogs).where(eq(zapierWebhookLogs.webhookId, row.id));
        await db.delete(zapierWebhooks).where(eq(zapierWebhooks.id, row.id));
      }

      return { success: true };
    }),

  /** Send a test ping to a webhook (fires the first event type) */
  test: protectedProcedure
    .input(z.object({ id: z.number(), orgId: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      const orgCtx = await getOrgContextForZapier(ctx.user.id, ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [webhook] = await db
        .select()
        .from(zapierWebhooks)
        .where(and(eq(zapierWebhooks.id, input.id), eq(zapierWebhooks.orgId, orgCtx.orgId)))
        .limit(1);
      if (!webhook) throw new TRPCError({ code: "NOT_FOUND" });

      const testPayload = {
        event: webhook.eventType,
        timestamp: new Date().toISOString(),
        org_id: orgCtx.orgId,
        test: true,
        data: getTestPayloadForEvent(webhook.eventType as ZapierEventType),
      };

      const body = JSON.stringify(testPayload);
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "Teachific-Zapier/1.0",
      };

      if (webhook.secret) {
        const signature = crypto
          .createHmac("sha256", webhook.secret)
          .update(body)
          .digest("hex");
        headers["X-Teachific-Signature"] = signature;
      }

      let status = 0;
      let responseBody = "";
      let success = false;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const response = await fetch(webhook.webhookUrl, {
          method: "POST",
          headers,
          body,
          signal: controller.signal,
        });
        clearTimeout(timeout);
        status = response.status;
        responseBody = await response.text().catch(() => "");
        success = response.ok;
      } catch (err: any) {
        status = 0;
        responseBody = err.message ?? "Network error";
        success = false;
      }

      // Log the test
      await db.insert(zapierWebhookLogs).values({
        webhookId: webhook.id,
        orgId: orgCtx.orgId,
        eventType: webhook.eventType,
        payload: body,
        responseStatus: status,
        responseBody: responseBody.slice(0, 2000),
        success,
      });

      return { success, status };
    }),

  /** Get recent delivery logs */
  logs: protectedProcedure
    .input(z.object({ orgId: z.number().optional(), webhookId: z.number().optional(), limit: z.number().min(1).max(100).default(20) }).optional())
    .query(async ({ ctx, input }) => {
      const orgCtx = await getOrgContextForZapier(ctx.user.id, ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const conditions = [eq(zapierWebhookLogs.orgId, orgCtx.orgId)];
      if (input?.webhookId) {
        conditions.push(eq(zapierWebhookLogs.webhookId, input.webhookId));
      }

      const logs = await db
        .select({
          id: zapierWebhookLogs.id,
          webhookId: zapierWebhookLogs.webhookId,
          eventType: zapierWebhookLogs.eventType,
          statusCode: zapierWebhookLogs.responseStatus,
          success: zapierWebhookLogs.success,
          createdAt: zapierWebhookLogs.createdAt,
        })
        .from(zapierWebhookLogs)
        .where(and(...conditions))
        .orderBy(desc(zapierWebhookLogs.createdAt))
        .limit(input?.limit ?? 20);

      // Join webhook URL for display
      const webhookIds = Array.from(new Set(logs.map(l => l.webhookId)));
      const webhookMap = new Map<number, string>();
      if (webhookIds.length > 0) {
        const webhookRows = await db
          .select({ id: zapierWebhooks.id, webhookUrl: zapierWebhooks.webhookUrl })
          .from(zapierWebhooks)
          .where(sql`${zapierWebhooks.id} IN (${sql.join(webhookIds.map(id => sql`${id}`), sql`, `)})`);
        for (const w of webhookRows) {
          webhookMap.set(w.id, w.webhookUrl);
        }
      }

      return logs.map(l => ({
        ...l,
        webhookUrl: webhookMap.get(l.webhookId) ?? "(deleted)",
      }));
    }),

  /** Update a webhook (advanced) */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(255).optional(),
        webhookUrl: z.string().url().max(2000).optional(),
        eventType: z.enum(ZAPIER_EVENT_TYPES).optional(),
        isActive: z.boolean().optional(),
        secret: z.string().max(128).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgCtx = await getOrgContextForZapier(ctx.user.id, ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [webhook] = await db
        .select()
        .from(zapierWebhooks)
        .where(and(eq(zapierWebhooks.id, input.id), eq(zapierWebhooks.orgId, orgCtx.orgId)))
        .limit(1);
      if (!webhook) throw new TRPCError({ code: "NOT_FOUND" });

      const { id, ...updates } = input;
      await db
        .update(zapierWebhooks)
        .set(updates)
        .where(eq(zapierWebhooks.id, id));

      return { success: true };
    }),
});

// ─── Test payload generators ──────────────────────────────────────────────────
function getTestPayloadForEvent(eventType: ZapierEventType): Record<string, unknown> {
  switch (eventType) {
    case "new_enrollment":
      return {
        enrollment_id: 12345,
        user_id: 100,
        user_email: "learner@example.com",
        user_name: "Jane Doe",
        course_id: 42,
        course_title: "Introduction to SCORM",
        enrolled_at: new Date().toISOString(),
      };
    case "course_completed":
      return {
        enrollment_id: 12345,
        user_id: 100,
        user_email: "learner@example.com",
        user_name: "Jane Doe",
        course_id: 42,
        course_title: "Introduction to SCORM",
        completed_at: new Date().toISOString(),
        progress_pct: 100,
      };
    case "form_submitted":
      return {
        submission_id: 789,
        form_id: 10,
        form_title: "Course Feedback Survey",
        respondent_email: "learner@example.com",
        respondent_name: "Jane Doe",
        submitted_at: new Date().toISOString(),
        answers: {},
      };
    case "new_order":
      return {
        order_id: 456,
        user_id: 100,
        user_email: "buyer@example.com",
        user_name: "John Smith",
        product_type: "course",
        product_title: "Advanced SCORM Packaging",
        amount: 49.99,
        currency: "USD",
        ordered_at: new Date().toISOString(),
      };
    case "new_member":
      return {
        member_id: 200,
        user_id: 100,
        user_email: "newmember@example.com",
        user_name: "Alex Johnson",
        role: "member",
        joined_at: new Date().toISOString(),
      };
    default:
      return { message: "Test event" };
  }
}
