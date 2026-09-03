/**
 * emailCampaignsRouter — Org-level email campaigns management
 *
 * Procedures:
 *   templates.list           — list email templates for org
 *   templates.create         — create new email template
 *   templates.update         — update email template
 *   templates.delete         — delete email template
 *   campaigns.list           — list campaigns for org
 *   campaigns.create         — create new campaign (draft)
 *   campaigns.update         — update campaign
 *   campaigns.send           — send campaign immediately
 *   campaigns.schedule       — schedule campaign for future send
 *   campaigns.cancel         — cancel scheduled campaign
 *   campaigns.previewAudience — count recipients matching filter
 *   lists.list               — list email lists for org
 *   lists.create             — create email list
 *   lists.addSubscriber      — add subscriber to list
 *   lists.removeSubscriber   — remove subscriber from list
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, and, desc, lte, isNull, isNotNull, inArray, sql } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getDb, requireOrgAdmin, getOrgMembers } from "./db";
import {
  users,
  emailTemplates,
  emailCampaigns,
  emailCampaignRecipients,
  emailUnsubscribes,
  lmsEnrollments,
  lmsCourses,
  organizations,
  emailListSubscribers,
} from "../drizzle/schema";
import { sendEmail, sendOrgEmail, encryptOrgKey } from "./sendgrid";
import { addToSendGridGlobalUnsubscribes, removeFromSendGridGlobalUnsubscribes } from "./lib/sendgridSuppressions";
import {
  composeCampaignEmailHtml,
} from "./lib/emailCampaignPresentation";
import { randomBytes } from "crypto";
import { nanoid } from "nanoid";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateUnsubscribeToken(): string {
  return randomBytes(32).toString("hex");
}

async function ensureUnsubscribeToken(db: any, userId: number): Promise<string> {
  const [u] = await db
    .select({ unsubscribeToken: users.unsubscribeToken })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  
  if (u?.unsubscribeToken) return u.unsubscribeToken;
  
  const token = generateUnsubscribeToken();
  await db.update(users).set({ unsubscribeToken: token }).where(eq(users.id, userId));
  return token;
}

// ─── Audience resolver ────────────────────────────────────────────────────────

async function resolveOrgRecipients(
  db: any,
  orgId: number,
  filter: {
    courseIds?: number[];
    enrollmentStatus?: "enrolled" | "completed" | "all";
    specificEmails?: string[];
    listIds?: number[];
  },
): Promise<{ id: number; email: string; name: string | null }[]> {
  const recipients = new Set<number>();

  // Get org members only (scoped to this org)
  const orgMemberRows = await getOrgMembers(orgId);
  const orgUserIds = new Set(orgMemberRows.map((m: any) => m.userId).filter(Boolean) as number[]);

  // Fetch user details for org members
  const orgUsers = orgUserIds.size > 0
    ? await db
        .select({ id: users.id, email: users.email, name: users.name })
        .from(users)
        .where(and(isNotNull(users.email), inArray(users.id, [...orgUserIds])))
    : [];

  // If specific emails provided, filter to those
  if (filter.specificEmails && filter.specificEmails.length > 0) {
    return orgUsers.filter((u: any) => filter.specificEmails!.includes(u.email));
  }

  // If email list IDs provided, include subscribers from those lists
  if (filter.listIds && filter.listIds.length > 0) {
    const listSubs = await db
      .select({ email: emailListSubscribers.email, userId: emailListSubscribers.userId })
      .from(emailListSubscribers)
      .where(and(
        inArray(emailListSubscribers.listId, filter.listIds),
        eq(emailListSubscribers.status, "subscribed"),
      ));
    // Merge list subscribers into orgUsers (by email) so they can be filtered by unsubscribes
    const extraEmails = new Set(listSubs.map((s: any) => s.email.toLowerCase()));
    const merged = [...orgUsers];
    for (const sub of listSubs) {
      if (!merged.find((u: any) => u.email?.toLowerCase() === sub.email.toLowerCase())) {
        merged.push({ id: sub.userId ?? 0, email: sub.email, name: null });
      }
    }
    return merged.filter((u: any) => extraEmails.has(u.email?.toLowerCase()));
  }

  // Filter by course enrollment
  if (filter.courseIds && filter.courseIds.length > 0) {
    for (const courseId of filter.courseIds) {
      const enrollments = await db
        .select({ userId: lmsEnrollments.userId, progressPercent: lmsEnrollments.progressPercent })
        .from(lmsEnrollments)
        .where(and(
          eq(lmsEnrollments.courseId, courseId),
          inArray(lmsEnrollments.userId, [...orgUserIds]),
        ));
      
      let filtered = enrollments;
      if (filter.enrollmentStatus === "completed") {
        filtered = enrollments.filter((e: any) => Number(e.progressPercent) >= 100);
      }
      
      filtered.forEach((e: any) => recipients.add(e.userId));
    }
  }

  // If no filters, include all org members
  if (!filter.courseIds?.length) {
    orgUsers.forEach((u: any) => recipients.add(u.id));
  }

  // Build final recipient list
  const result: { id: number; email: string; name: string | null }[] = [];
  for (const userId of recipients) {
    const user = orgUsers.find((u: any) => u.id === userId);
    if (user?.email) {
      result.push({ id: userId, email: user.email, name: user.name });
    }
  }

  return result;
}

// ─── Email Campaigns Router ───────────────────────────────────────────────────

export const emailCampaignsRouter = router({
  // ── Email Templates ────────────────────────────────────────────────────────

  templates: router({
    list: protectedProcedure
      .input(z.object({ orgId: z.number() }))
      .query(async ({ input, ctx }) => {
        await requireOrgAdmin(ctx.user.id, ctx.user.role, input.orgId);
        const db = await getDb();
        if (!db) return [];
        
        return db
          .select()
          .from(emailTemplates)
          .where(eq(emailTemplates.orgId, input.orgId))
          .orderBy(desc(emailTemplates.createdAt));
      }),

    create: protectedProcedure
      .input(z.object({
        orgId: z.number(),
        name: z.string().min(1),
        subject: z.string().min(1),
        htmlBody: z.string(),
        textBody: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await requireOrgAdmin(ctx.user.id, ctx.user.role, input.orgId);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.insert(emailTemplates).values({
          orgId: input.orgId,
          name: input.name,
          subject: input.subject,
          htmlBody: input.htmlBody,
          textBody: input.textBody ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        const created = await db
          .select()
          .from(emailTemplates)
          .where(and(
            eq(emailTemplates.orgId, input.orgId),
            eq(emailTemplates.name, input.name),
          ))
          .orderBy(desc(emailTemplates.createdAt))
          .limit(1);
        return created[0];
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        subject: z.string().optional(),
        htmlBody: z.string().optional(),
        textBody: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        // Verify ownership via template's orgId
        const [tmpl] = await db.select({ orgId: emailTemplates.orgId }).from(emailTemplates).where(eq(emailTemplates.id, input.id)).limit(1);
        if (!tmpl) throw new TRPCError({ code: "NOT_FOUND" });
        await requireOrgAdmin(ctx.user.id, ctx.user.role, tmpl.orgId ?? undefined);
        const { id, ...updates } = input;
        await db
          .update(emailTemplates)
          .set({ ...updates, updatedAt: new Date() })
          .where(eq(emailTemplates.id, id));
        
        return db.select().from(emailTemplates).where(eq(emailTemplates.id, id)).limit(1);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [tmpl] = await db.select({ orgId: emailTemplates.orgId }).from(emailTemplates).where(eq(emailTemplates.id, input.id)).limit(1);
        if (!tmpl) throw new TRPCError({ code: "NOT_FOUND" });
        await requireOrgAdmin(ctx.user.id, ctx.user.role, tmpl.orgId ?? undefined);
        await db.delete(emailTemplates).where(eq(emailTemplates.id, input.id));
        return { success: true };
      }),
  }),

  // ── Email Campaigns ───────────────────────────────────────────────────────

  campaigns: router({
    list: protectedProcedure
      .input(z.object({ orgId: z.number() }))
      .query(async ({ input, ctx }) => {
        await requireOrgAdmin(ctx.user.id, ctx.user.role, input.orgId);
        const db = await getDb();
        if (!db) return [];
        
        return db
          .select()
          .from(emailCampaigns)
          .where(eq(emailCampaigns.orgId, input.orgId))
          .orderBy(desc(emailCampaigns.createdAt));
      }),

    create: protectedProcedure
      .input(z.object({
        orgId: z.number(),
        name: z.string().min(1),
        templateId: z.number(),
        subject: z.string().min(1),
        htmlBody: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        await requireOrgAdmin(ctx.user.id, ctx.user.role, input.orgId);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        await db.insert(emailCampaigns).values({
          orgId: input.orgId,
          name: input.name,
          templateId: input.templateId,
          subject: input.subject,
          htmlBody: input.htmlBody,
          status: "draft",
          recipientCount: 0,
          sentCount: 0,
          openCount: 0,
          clickCount: 0,
          createdBy: ctx.user.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        
        const created = await db
          .select()
          .from(emailCampaigns)
          .where(and(
            eq(emailCampaigns.orgId, input.orgId),
            eq(emailCampaigns.name, input.name),
          ))
          .orderBy(desc(emailCampaigns.createdAt))
          .limit(1);
        
        return created[0];
      }),

    previewAudience: protectedProcedure
      .input(z.object({
        orgId: z.number(),
        listIds: z.array(z.number()).optional(),
        courseIds: z.array(z.number()).optional(),
      }))
      .query(async ({ input, ctx }) => {
        await requireOrgAdmin(ctx.user.id, ctx.user.role, input.orgId);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        const recipients = await resolveOrgRecipients(db, input.orgId, {
          listIds: input.listIds,
          courseIds: input.courseIds,
        });
        
        return { count: recipients.length, recipients };
      }),

    send: protectedProcedure
      .input(z.object({
        campaignId: z.number(),
        orgId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        await requireOrgAdmin(ctx.user.id, ctx.user.role, input.orgId);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        const campaign = await db
          .select()
          .from(emailCampaigns)
          .where(eq(emailCampaigns.id, input.campaignId))
          .limit(1);
        
        if (!campaign.length) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
        }
        
        const org = await db
          .select()
          .from(organizations)
          .where(eq(organizations.id, input.orgId))
          .limit(1);
        
        if (!org.length) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
        }

        // ── Two-tier email model: campaigns require org's own SendGrid key ──────
        if (!org[0].ownSendGridKeyEncrypted) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "sendgrid_key_required",
          });
        }

        const recipients = await resolveOrgRecipients(db, input.orgId, {});

        // Build unsubscribe set — include org-specific AND platform-wide (orgId IS NULL) unsubscribes
        const unsubRows = await db
          .select({ email: emailUnsubscribes.email })
          .from(emailUnsubscribes)
          .where(
            sql`(${emailUnsubscribes.orgId} = ${input.orgId} OR ${emailUnsubscribes.orgId} IS NULL)`
          );
        const unsubEmails = new Set(unsubRows.map((r: { email: string }) => r.email.toLowerCase()));

        // Clear previous recipient rows (idempotent re-send)
        await db.delete(emailCampaignRecipients).where(eq(emailCampaignRecipients.campaignId, input.campaignId));

        // Mark as sending
        await db.update(emailCampaigns)
          .set({ status: "sending", updatedAt: new Date() })
          .where(eq(emailCampaigns.id, input.campaignId));

        // Send emails and track per-recipient rows
        let sentCount = 0;
        let failedCount = 0;
        for (const recipient of recipients) {
          if (unsubEmails.has(recipient.email.toLowerCase())) continue;
          let ok = false;
          let errorMsg: string | null = null;
          let recipientRowId: number | null = null;
          try {
            const unsubscribeToken = await ensureUnsubscribeToken(db, recipient.id);
            // Insert per-recipient row FIRST so the final organization-branded HTML can include tracking URLs.
            const insertResult = await db.insert(emailCampaignRecipients).values({
              campaignId: input.campaignId,
              userId: recipient.id,
              email: recipient.email,
              status: "pending",
              sentAt: null,
              errorMessage: null,
            });
            recipientRowId = (insertResult[0] as any).insertId as number;
            const finalHtml = composeCampaignEmailHtml(
              campaign[0].htmlBody,
              org[0],
              input.campaignId,
              recipientRowId,
              unsubscribeToken,
            );
            await sendOrgEmail(
              {
                to: recipient.email,
                subject: campaign[0].subject,
                html: finalHtml,
                text: campaign[0].textBody || undefined,
              },
              {
                ownSendGridKeyEncrypted: org[0].ownSendGridKeyEncrypted,
                customSenderName: org[0].customSenderName,
                customSenderEmail: org[0].customSenderEmail,
              },
            );
            ok = true;
            sentCount++;
            // Update tracking row to sent
            await db.update(emailCampaignRecipients)
              .set({ status: "sent", sentAt: new Date(), errorMessage: null })
              .where(eq(emailCampaignRecipients.id, recipientRowId));
          } catch (err: any) {
            errorMsg = err?.message ?? "Send failed";
            failedCount++;
            console.error(`Failed to send email to ${recipient.email}:`, err);
          }
          // Update or insert failed tracking row
          if (!ok) {
            if (recipientRowId !== null) {
              await db.update(emailCampaignRecipients)
                .set({ status: "failed", errorMessage: errorMsg })
                .where(eq(emailCampaignRecipients.id, recipientRowId));
            } else {
              // Fallback: insert a failed row if we never got to insert above
              await db.insert(emailCampaignRecipients).values({
                campaignId: input.campaignId,
                userId: recipient.id,
                email: recipient.email,
                status: "failed",
                sentAt: null,
                errorMessage: errorMsg,
              });
            }
          }
        }
        
        // Update campaign status with final counts
        await db
          .update(emailCampaigns)
          .set({
            status: "sent",
            sentCount,
            failedCount,
            recipientCount: recipients.length,
            sentAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(emailCampaigns.id, input.campaignId));
        
        return { success: true, sentCount, failedCount };
      }),

    schedule: protectedProcedure
      .input(z.object({
        campaignId: z.number(),
        orgId: z.number(),
        scheduledFor: z.date(),
      }))
      .mutation(async ({ input, ctx }) => {
        await requireOrgAdmin(ctx.user.id, ctx.user.role, input.orgId);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        // ── Two-tier email model: campaigns require org's own SendGrid key ──────
        const [orgForKey] = await db
          .select({ ownSendGridKeyEncrypted: organizations.ownSendGridKeyEncrypted })
          .from(organizations)
          .where(eq(organizations.id, input.orgId))
          .limit(1);
        if (!orgForKey?.ownSendGridKeyEncrypted) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "sendgrid_key_required",
          });
        }

        await db
          .update(emailCampaigns)
          .set({
            status: "scheduled",
            scheduledAt: input.scheduledFor,
            updatedAt: new Date(),
          })
          .where(eq(emailCampaigns.id, input.campaignId));
        
        return { success: true };
      }),

    cancel: protectedProcedure
      .input(z.object({ campaignId: z.number(), orgId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await requireOrgAdmin(ctx.user.id, ctx.user.role, input.orgId);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        await db
          .update(emailCampaigns)
          .set({ status: "draft", updatedAt: new Date() })
          .where(eq(emailCampaigns.id, input.campaignId));
        
        return { success: true };
      }),

    /** Deep analytics for a single campaign */
    analytics: protectedProcedure
      .input(z.object({ campaignId: z.number(), orgId: z.number() }))
      .query(async ({ input, ctx }) => {
        await requireOrgAdmin(ctx.user.id, ctx.user.role, input.orgId);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const [campaign] = await db
          .select()
          .from(emailCampaigns)
          .where(and(eq(emailCampaigns.id, input.campaignId), eq(emailCampaigns.orgId, input.orgId)))
          .limit(1);

        if (!campaign) throw new TRPCError({ code: "NOT_FOUND" });

        const recipientRows = await db
          .select()
          .from(emailCampaignRecipients)
          .where(eq(emailCampaignRecipients.campaignId, input.campaignId))
          .orderBy(desc(emailCampaignRecipients.sentAt));

        const totalSent = recipientRows.filter((r: any) => r.status === "sent").length;
        const totalFailed = recipientRows.filter((r: any) => r.status === "failed").length;
        const totalOpened = recipientRows.filter((r: any) => r.openedAt != null).length;
        const totalClicked = recipientRows.filter((r: any) => r.clickedAt != null).length;
        const totalBounced = recipientRows.filter((r: any) => r.status === "bounced").length;

        return {
          campaign,
          summary: {
            totalRecipients: campaign.recipientCount ?? 0,
            totalSent,
            totalFailed,
            totalBounced,
            totalOpened,
            totalClicked,
            openRate: totalSent > 0 ? Math.round((totalOpened / totalSent) * 1000) / 10 : 0,
            clickRate: totalSent > 0 ? Math.round((totalClicked / totalSent) * 1000) / 10 : 0,
            clickToOpenRate: totalOpened > 0 ? Math.round((totalClicked / totalOpened) * 1000) / 10 : 0,
          },
          recipients: recipientRows,
        };
      }),
  }),

  // ── Campaign Recipients (tracking) ───────────────────────────────────────────
  
  recipients: router({
    list: protectedProcedure
      .input(z.object({ campaignId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        
        return db
          .select()
          .from(emailCampaignRecipients)
          .where(eq(emailCampaignRecipients.campaignId, input.campaignId))
          .orderBy(desc(emailCampaignRecipients.sentAt));
      }),
  }),

  // ── Unsubscribe (public — no auth required) ──────────────────────────────────

  unsubscribe: router({
    /** Process an unsubscribe token click from an email link */
    confirm: publicProcedure
      .input(z.object({ token: z.string() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        // Find the user by their unsubscribe token
        const [user] = await db
          .select({ id: users.id, email: users.email })
          .from(users)
          .where(eq(users.unsubscribeToken, input.token))
          .limit(1);

        if (!user || !user.email) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Invalid or expired unsubscribe link." });
        }

        // Record the unsubscribe (org-level — null orgId means all orgs)
        const existing = await db
          .select({ id: emailUnsubscribes.id })
          .from(emailUnsubscribes)
          .where(and(
            eq(emailUnsubscribes.email, user.email),
            isNull(emailUnsubscribes.orgId),
          ))
          .limit(1);

        if (!existing.length) {
          await db.insert(emailUnsubscribes).values({
            userId: user.id,
            email: user.email,
            orgId: null,
            reason: "user_clicked_link",
          });
        }

        // Add to SendGrid global suppression (best-effort)
        addToSendGridGlobalUnsubscribes([user.email]).catch(() => {});

        return { success: true, email: user.email };
      }),

    /** Re-subscribe (undo unsubscribe) */
    resubscribe: publicProcedure
      .input(z.object({ token: z.string() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const [user] = await db
          .select({ id: users.id, email: users.email })
          .from(users)
          .where(eq(users.unsubscribeToken, input.token))
          .limit(1);

        if (!user || !user.email) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Invalid unsubscribe link." });
        }

        await db
          .delete(emailUnsubscribes)
          .where(and(
            eq(emailUnsubscribes.email, user.email),
            isNull(emailUnsubscribes.orgId),
          ));

        // Remove from SendGrid global suppression (best-effort)
        removeFromSendGridGlobalUnsubscribes(user.email).catch(() => {});

        return { success: true, email: user.email };
      }),
  }),

  // ── Org Email Settings ────────────────────────────────────────────────────────

  emailSettings: router({
    /** Get org email settings */
    get: protectedProcedure
      .input(z.object({ orgId: z.number() }))
      .query(async ({ input, ctx }) => {
        await requireOrgAdmin(ctx.user.id, ctx.user.role, input.orgId);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const [org] = await db
          .select({
            customSenderName: organizations.customSenderName,
            customSenderEmail: organizations.customSenderEmail,
            hasOwnSendGridKey: organizations.ownSendGridKeyEncrypted,
          })
          .from(organizations)
          .where(eq(organizations.id, input.orgId))
          .limit(1);

        if (!org) throw new TRPCError({ code: "NOT_FOUND" });

        return {
          customSenderName: org.customSenderName ?? "",
          customSenderEmail: org.customSenderEmail ?? "",
          hasOwnSendGridKey: !!org.hasOwnSendGridKey,
        };
      }),

    /** Update org email settings */
    update: protectedProcedure
      .input(z.object({
        orgId: z.number(),
        customSenderName: z.string().max(255).optional(),
        customSenderEmail: z.string().email().max(320).optional().or(z.literal("")),
        ownSendGridKey: z.string().optional(), // plain text key — will be encrypted on save
        clearOwnSendGridKey: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await requireOrgAdmin(ctx.user.id, ctx.user.role, input.orgId);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const updates: Record<string, unknown> = { updatedAt: new Date() };

        if (input.customSenderName !== undefined) updates.customSenderName = input.customSenderName || null;
        if (input.customSenderEmail !== undefined) updates.customSenderEmail = input.customSenderEmail || null;
        if (input.clearOwnSendGridKey) updates.ownSendGridKeyEncrypted = null;
        if (input.ownSendGridKey) updates.ownSendGridKeyEncrypted = encryptOrgKey(input.ownSendGridKey);

        await db.update(organizations).set(updates).where(eq(organizations.id, input.orgId));

        return { success: true };
      }),
  }),
});
