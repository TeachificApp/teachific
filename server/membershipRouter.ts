/**
 * membershipRouter — Org-level membership and subscription management
 *
 * Procedures:
 *   plans.list        — list membership plans
 *   plans.create      — create membership plan
 *   plans.update      — update membership plan
 *   plans.delete      — delete membership plan
 *   subscriptions.list — list member subscriptions
 *   subscriptions.create — create subscription
 *   subscriptions.cancel — cancel subscription
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import {
  membershipPlans,
  membershipSubscriptions,
  membershipPlanAccess,
} from "../drizzle/schema";
import { nanoid } from "nanoid";

// ─── Membership Router ─────────────────────────────────────────────────────────

export const membershipRouter = router({
  // ── Plans ──────────────────────────────────────────────────────────────────

  plans: router({
    list: protectedProcedure
      .input(z.object({ orgId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        
        return db
          .select()
          .from(membershipPlans)
          .where(eq(membershipPlans.orgId, input.orgId))
          .orderBy(desc(membershipPlans.createdAt));
      }),

    create: protectedProcedure
      .input(z.object({
        orgId: z.number(),
        name: z.string().min(1),
        description: z.string().optional(),
        price: z.string(), // Store as string to preserve decimal precision
        billingCycle: z.enum(["monthly", "yearly", "lifetime"]),
        trialDays: z.number().default(0),
        maxMembers: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        const planId = nanoid();
        
        await db.insert(membershipPlans).values({
          orgId: input.orgId,
          planId,
          name: input.name,
          description: input.description ?? null,
          price: input.price,
          billingCycle: input.billingCycle,
          trialDays: input.trialDays,
          maxMembers: input.maxMembers ?? null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        
        const created = await db
          .select()
          .from(membershipPlans)
          .where(eq(membershipPlans.planId, planId))
          .limit(1);
        
        return created[0];
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        price: z.string().optional(),
        billingCycle: z.enum(["monthly", "yearly", "lifetime"]).optional(),
        trialDays: z.number().optional(),
        maxMembers: z.number().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        const { id, ...updates } = input;
        await db
          .update(membershipPlans)
          .set({ ...updates, updatedAt: new Date() })
          .where(eq(membershipPlans.id, id));
        
        return db.select().from(membershipPlans).where(eq(membershipPlans.id, id)).limit(1);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        // Delete related access rules
        const plan = await db
          .select()
          .from(membershipPlans)
          .where(eq(membershipPlans.id, input.id))
          .limit(1);
        
        if (plan.length) {
          await db
            .delete(membershipPlanAccess)
            .where(eq(membershipPlanAccess.planId, plan[0].id));
        }
        
        await db.delete(membershipPlans).where(eq(membershipPlans.id, input.id));
        return { success: true };
      }),
  }),

  // ── Subscriptions ──────────────────────────────────────────────────────────

  subscriptions: router({
    list: protectedProcedure
      .input(z.object({ 
        orgId: z.number(),
        userId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        
        let query = db
          .select()
          .from(membershipSubscriptions)
          .where(eq(membershipSubscriptions.orgId, input.orgId));
        
        if (input.userId) {
          query = query.where(eq(membershipSubscriptions.userId, input.userId));
        }
        
        return query.orderBy(desc(membershipSubscriptions.createdAt));
      }),

    create: protectedProcedure
      .input(z.object({
        orgId: z.number(),
        userId: z.number(),
        planId: z.number(),
        stripeSubscriptionId: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        const subscriptionId = nanoid();
        const now = new Date();
        
        // Get plan details for trial calculation
        const plan = await db
          .select()
          .from(membershipPlans)
          .where(eq(membershipPlans.id, input.planId))
          .limit(1);
        
        if (!plan.length) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });
        }
        
        // Calculate trial end date
        const trialEndDate = plan[0].trialDays > 0
          ? new Date(now.getTime() + plan[0].trialDays * 24 * 60 * 60 * 1000)
          : null;
        
        await db.insert(membershipSubscriptions).values({
          orgId: input.orgId,
          subscriptionId,
          userId: input.userId,
          planId: input.planId,
          status: "active",
          stripeSubscriptionId: input.stripeSubscriptionId ?? null,
          trialEndsAt: trialEndDate,
          currentPeriodStart: now,
          currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days default
          createdAt: now,
          updatedAt: now,
        });
        
        const created = await db
          .select()
          .from(membershipSubscriptions)
          .where(eq(membershipSubscriptions.subscriptionId, subscriptionId))
          .limit(1);
        
        return created[0];
      }),

    cancel: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        await db
          .update(membershipSubscriptions)
          .set({ 
            status: "canceled",
            canceledAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(membershipSubscriptions.id, input.id));
        
        return { success: true };
      }),
  }),

  // ── Plan Access Control ────────────────────────────────────────────────────

  access: router({
    list: protectedProcedure
      .input(z.object({ planId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        
        return db
          .select()
          .from(membershipPlanAccess)
          .where(eq(membershipPlanAccess.planId, input.planId));
      }),

    grant: protectedProcedure
      .input(z.object({
        planId: z.number(),
        resourceType: z.enum(["course", "product", "community"]),
        resourceId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        await db.insert(membershipPlanAccess).values({
          planId: input.planId,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          createdAt: new Date(),
        });
        
        return { success: true };
      }),

    revoke: protectedProcedure
      .input(z.object({
        planId: z.number(),
        resourceId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        await db
          .delete(membershipPlanAccess)
          .where(and(
            eq(membershipPlanAccess.planId, input.planId),
            eq(membershipPlanAccess.resourceId, input.resourceId),
          ));
        
        return { success: true };
      }),
  }),
});
