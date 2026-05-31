/**
 * funnelsRouter — Org-level funnel management
 *
 * Procedures:
 *   list              — list funnels for org
 *   create            — create new funnel
 *   update            — update funnel
 *   delete            — delete funnel
 *   pages.list        — list pages in funnel
 *   pages.create      — create funnel page
 *   pages.update      — update funnel page
 *   pages.delete      — delete funnel page
 *   leads.list        — list leads captured by funnel
 *   leads.create      — create lead (public)
 *   products.list     — list products in funnel
 *   products.add      — add product to funnel
 *   products.remove   — remove product from funnel
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, and, desc, isNull } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import {
  funnels,
  funnelPages,
  funnelLeads,
  funnelPurchases,
  organizations,
} from "../drizzle/schema";
import { nanoid } from "nanoid";

// ─── Funnels Router ───────────────────────────────────────────────────────────

export const funnelsRouter = router({
  // ── Funnel Management ──────────────────────────────────────────────────────

  list: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      
      return db
        .select()
        .from(funnels)
        .where(eq(funnels.orgId, input.orgId))
        .orderBy(desc(funnels.createdAt));
    }),

  create: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      name: z.string().min(1),
      description: z.string().optional(),
      type: z.enum(["webinar", "product", "lead_capture", "survey"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      
      const slug = `${input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${nanoid(6)}`;
      
      await db.insert(funnels).values({
        orgId: input.orgId,
        name: input.name,
        slug,
        description: input.description ?? null,
        type: input.type ?? "lead_capture",
        status: "draft",
        leadCount: 0,
        conversionCount: 0,
        conversionRate: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      const created = await db
        .select()
        .from(funnels)
        .where(eq(funnels.slug, slug))
        .limit(1);
      
      return created[0];
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      description: z.string().optional(),
      type: z.enum(["webinar", "product", "lead_capture", "survey"]).optional(),
      status: z.enum(["draft", "published", "archived"]).optional(),
      customDomain: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      
      const { id, ...updates } = input;
      await db
        .update(funnels)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(funnels.id, id));
      
      return db.select().from(funnels).where(eq(funnels.id, id)).limit(1);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      
      // Delete related data
      await db.delete(funnelPages).where(eq(funnelPages.funnelId, input.id));
      await db.delete(funnelLeads).where(eq(funnelLeads.funnelId, input.id));
      await db.delete(funnelProducts).where(eq(funnelProducts.funnelId, input.id));
      await db.delete(funnels).where(eq(funnels.id, input.id));
      
      return { success: true };
    }),

  // ── Funnel Pages ───────────────────────────────────────────────────────────

  pages: router({
    list: protectedProcedure
      .input(z.object({ funnelId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        
        return db
          .select()
          .from(funnelPages)
          .where(eq(funnelPages.funnelId, input.funnelId))
          .orderBy(desc(funnelPages.order));
      }),

    create: protectedProcedure
      .input(z.object({
        funnelId: z.number(),
        name: z.string().min(1),
        type: z.enum(["landing", "product", "checkout", "thank_you"]),
        order: z.number().default(0),
        htmlContent: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        const slug = `${input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${nanoid(6)}`;
        
        await db.insert(funnelPages).values({
          funnelId: input.funnelId,
          name: input.name,
          slug,
          type: input.type,
          order: input.order,
          htmlContent: input.htmlContent ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        
        const created = await db
          .select()
          .from(funnelPages)
          .where(eq(funnelPages.slug, slug))
          .limit(1);
        
        return created[0];
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        type: z.enum(["landing", "product", "checkout", "thank_you"]).optional(),
        order: z.number().optional(),
        htmlContent: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        const { id, ...updates } = input;
        await db
          .update(funnelPages)
          .set({ ...updates, updatedAt: new Date() })
          .where(eq(funnelPages.id, id));
        
        return db.select().from(funnelPages).where(eq(funnelPages.id, id)).limit(1);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        await db.delete(funnelPages).where(eq(funnelPages.id, input.id));
        return { success: true };
      }),
  }),

  // ── Funnel Leads ───────────────────────────────────────────────────────────

  leads: router({
    list: protectedProcedure
      .input(z.object({ funnelId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        
        return db
          .select()
          .from(funnelLeads)
          .where(eq(funnelLeads.funnelId, input.funnelId))
          .orderBy(desc(funnelLeads.createdAt));
      }),

    create: publicProcedure
      .input(z.object({
        funnelId: z.number(),
        email: z.string().email(),
        name: z.string().optional(),
        phone: z.string().optional(),
        customData: z.record(z.any()).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        const leadId = `LEAD-${nanoid(10).toUpperCase()}`;
        
        await db.insert(funnelLeads).values({
          funnelId: input.funnelId,
          leadId,
          email: input.email,
          name: input.name ?? null,
          phone: input.phone ?? null,
          customData: input.customData ? JSON.stringify(input.customData) : null,
          status: "new",
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        
        return { success: true, leadId };
      }),
  }),

  // ── Funnel Purchases ──────────────────────────────────────────────────────

  purchases: router({
    list: protectedProcedure
      .input(z.object({ funnelId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        
        return db
          .select()
          .from(funnelPurchases)
          .where(eq(funnelPurchases.funnelId, input.funnelId))
          .orderBy(desc(funnelPurchases.createdAt));
      }),
  }),
});
