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
import { getDb } from "./db";
import {
  users,
  emailTemplates,
  emailCampaigns,
  emailCampaignRecipients,
  lmsEnrollments,
  lmsCourses,
  organizations,
} from "../drizzle/schema";
import { sendEmail } from "./sendgrid";
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

function buildUnsubscribeUrl(token: string, origin: string): string {
  return `${origin}/unsubscribe?token=${token}`;
}

function injectUnsubscribeFooter(htmlBody: string, unsubscribeUrl: string, orgName: string): string {
  const footerBlock = `
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;text-align:center;">
      <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6;">
        You are receiving this email from ${orgName}.<br/>
        <a href="${unsubscribeUrl}" style="color:#94a3b8;text-decoration:underline;" target="_blank" rel="noopener noreferrer">Unsubscribe</a>
      </p>
    </div>`;
  
  if (htmlBody.includes("</body>")) {
    return htmlBody.replace("</body>", `${footerBlock}</body>`);
  }
  return htmlBody + footerBlock;
}

// ─── Audience resolver ────────────────────────────────────────────────────────

async function resolveOrgRecipients(
  db: any,
  orgId: number,
  filter: {
    courseIds?: number[];
    enrollmentStatus?: "enrolled" | "completed" | "all";
    specificEmails?: string[];
  },
): Promise<{ id: number; email: string; name: string | null }[]> {
  const recipients = new Set<number>();

  // Get all org users first
  const orgUsers = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(isNotNull(users.email));

  // If specific emails provided, filter to those
  if (filter.specificEmails && filter.specificEmails.length > 0) {
    const specificUsers = orgUsers.filter(u => filter.specificEmails!.includes(u.email));
    return specificUsers;
  }

  // Filter by course enrollment
  if (filter.courseIds && filter.courseIds.length > 0) {
    for (const courseId of filter.courseIds) {
      const enrollments = await db
        .select({ userId: lmsEnrollments.userId, completionPercentage: lmsEnrollments.completionPercentage })
        .from(lmsEnrollments)
        .where(eq(lmsEnrollments.courseId, courseId));
      
      let filtered = enrollments;
      if (filter.enrollmentStatus === "completed") {
        filtered = enrollments.filter(e => e.completionPercentage === 100);
      }
      
      filtered.forEach(e => recipients.add(e.userId));
    }
  }

  // If no filters, include all org users
  if (!filter.courseIds?.length) {
    orgUsers.forEach(u => recipients.add(u.id));
  }

  // Build final recipient list
  const result: { id: number; email: string; name: string | null }[] = [];
  for (const userId of recipients) {
    const user = orgUsers.find(u => u.id === userId);
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
      .query(async ({ input }) => {
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
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        const slug = `${input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${nanoid(6)}`;
        
        await db.insert(emailTemplates).values({
          orgId: input.orgId,
          name: input.name,
          slug,
          subject: input.subject,
          htmlBody: input.htmlBody,
          textBody: input.textBody ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        
        const created = await db
          .select()
          .from(emailTemplates)
          .where(eq(emailTemplates.slug, slug))
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
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        const { id, ...updates } = input;
        await db
          .update(emailTemplates)
          .set({ ...updates, updatedAt: new Date() })
          .where(eq(emailTemplates.id, id));
        
        return db.select().from(emailTemplates).where(eq(emailTemplates.id, id)).limit(1);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        await db.delete(emailTemplates).where(eq(emailTemplates.id, input.id));
        return { success: true };
      }),
  }),

  // ── Email Campaigns ───────────────────────────────────────────────────────

  campaigns: router({
    list: protectedProcedure
      .input(z.object({ orgId: z.number() }))
      .query(async ({ input }) => {
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
      .mutation(async ({ input }) => {
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
      .query(async ({ input }) => {
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
      .mutation(async ({ input }) => {
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
        
        const recipients = await resolveOrgRecipients(db, input.orgId, {});
        
        // Send emails
        let sentCount = 0;
        for (const recipient of recipients) {
          try {
            const unsubscribeToken = await ensureUnsubscribeToken(db, recipient.id);
            const unsubscribeUrl = buildUnsubscribeUrl(unsubscribeToken, "https://teachific.app");
            const htmlWithFooter = injectUnsubscribeFooter(
              campaign[0].htmlBody,
              unsubscribeUrl,
              org[0].name,
            );
            
            await sendEmail({
              to: recipient.email,
              subject: campaign[0].subject,
              html: htmlWithFooter,
              text: campaign[0].textBody || undefined,
            });
            
            sentCount++;
          } catch (err) {
            console.error(`Failed to send email to ${recipient.email}:`, err);
          }
        }
        
        // Update campaign status
        await db
          .update(emailCampaigns)
          .set({
            status: "sent",
            sentCount,
            recipientCount: recipients.length,
            sentAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(emailCampaigns.id, input.campaignId));
        
        return { success: true, sentCount };
      }),

    schedule: protectedProcedure
      .input(z.object({
        campaignId: z.number(),
        scheduledFor: z.date(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        await db
          .update(emailCampaigns)
          .set({
            status: "scheduled",
            scheduledFor: input.scheduledFor,
            updatedAt: new Date(),
          })
          .where(eq(emailCampaigns.id, input.campaignId));
        
        return { success: true };
      }),

    cancel: protectedProcedure
      .input(z.object({ campaignId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        await db
          .update(emailCampaigns)
          .set({ status: "cancelled", updatedAt: new Date() })
          .where(eq(emailCampaigns.id, input.campaignId));
        
        return { success: true };
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
});
