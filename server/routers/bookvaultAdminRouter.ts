/**
 * Bookvault admin tRPC router
 * Covers: connection status, title catalog, product linking, order fulfillment
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, isNotNull, desc } from "drizzle-orm";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import {
  testConnection,
  listTitles,
  getTitleByIsbn,
  getOrder,
  isBookvaultConfigured,
  normalizeIsbn,
} from "../bookvault";
import { fulfillBookvaultOrder } from "../lib/fulfillBookvaultOrder";
import { physicalProducts, physicalProductOrders, users } from "../../drizzle/schema";

function assertAdmin(role: string | undefined) {
  if (role !== "admin" && role !== "platform_admin") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
}

export const bookvaultAdminRouter = router({
  /** Check whether the API key is configured and the connection is live */
  getConnectionStatus: protectedProcedure.query(async ({ ctx }) => {
    assertAdmin((ctx.user as { role?: string }).role);
    if (!isBookvaultConfigured()) {
      return {
        configured: false,
        connected: false,
        error: "BOOKVAULT_API_KEY is not configured",
      };
    }
    try {
      const { account } = await testConnection();
      return {
        configured: true,
        connected: true,
        accountName: account.CompanyName ?? account.Name ?? "Bookvault Account",
      };
    } catch (err) {
      return {
        configured: true,
        connected: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }),

  /** Test the connection manually */
  testConnection: protectedProcedure.mutation(async ({ ctx }) => {
    assertAdmin((ctx.user as { role?: string }).role);
    if (!isBookvaultConfigured()) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "BOOKVAULT_API_KEY is not configured" });
    }
    return testConnection();
  }),

  /** List all titles in the Bookvault catalog */
  listTitles: protectedProcedure.query(async ({ ctx }) => {
    assertAdmin((ctx.user as { role?: string }).role);
    if (!isBookvaultConfigured()) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "BOOKVAULT_API_KEY is not configured" });
    }
    return listTitles();
  }),

  /** Look up a single title by ISBN */
  getTitleByIsbn: protectedProcedure
    .input(z.object({ isbn: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      assertAdmin((ctx.user as { role?: string }).role);
      if (!isBookvaultConfigured()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "BOOKVAULT_API_KEY is not configured" });
      }
      const title = await getTitleByIsbn(input.isbn);
      if (!title) throw new TRPCError({ code: "NOT_FOUND", message: "ISBN not found in Bookvault catalog" });
      return title;
    }),

  /** List physical products that have Bookvault enabled */
  listLinkedProducts: protectedProcedure.query(async ({ ctx }) => {
    assertAdmin((ctx.user as { role?: string }).role);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const rows = await db
      .select({
        id: physicalProducts.id,
        slug: physicalProducts.slug,
        title: physicalProducts.title,
        thumbnailUrl: physicalProducts.thumbnailUrl,
        status: physicalProducts.status,
        bookvaultEnabled: physicalProducts.bookvaultEnabled,
        bookvaultIsbn: physicalProducts.bookvaultIsbn,
      })
      .from(physicalProducts)
      .where(eq(physicalProducts.bookvaultEnabled, true));
    return rows;
  }),

  /** Enable/disable Bookvault on a physical product and set the ISBN */
  updateProductLink: protectedProcedure
    .input(z.object({
      productId: z.number(),
      bookvaultEnabled: z.boolean(),
      bookvaultIsbn: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin((ctx.user as { role?: string }).role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const isbn = input.bookvaultIsbn ? normalizeIsbn(input.bookvaultIsbn) : null;
      await db.update(physicalProducts).set({
        bookvaultEnabled: input.bookvaultEnabled,
        bookvaultIsbn: isbn ?? undefined,
      }).where(eq(physicalProducts.id, input.productId));
      return { success: true };
    }),

  /** List orders that have Bookvault fulfillment data */
  listOrders: protectedProcedure
    .input(z.object({
      page: z.number().default(1),
      limit: z.number().default(50),
      status: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      assertAdmin((ctx.user as { role?: string }).role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const offset = (input.page - 1) * input.limit;
      const rows = await db
        .select({
          order: physicalProductOrders,
          product: {
            id: physicalProducts.id,
            title: physicalProducts.title,
            bookvaultIsbn: physicalProducts.bookvaultIsbn,
          },
          user: {
            id: users.id,
            name: users.name,
            email: users.email,
          },
        })
        .from(physicalProductOrders)
        .innerJoin(physicalProducts, eq(physicalProductOrders.productId, physicalProducts.id))
        .innerJoin(users, eq(physicalProductOrders.userId, users.id))
        .where(eq(physicalProducts.bookvaultEnabled, true))
        .orderBy(desc(physicalProductOrders.orderedAt))
        .limit(input.limit)
        .offset(offset);
      return rows;
    }),

  /** Submit a single order to Bookvault */
  fulfillOrder: protectedProcedure
    .input(z.object({
      orderId: z.number(),
      force: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin((ctx.user as { role?: string }).role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return fulfillBookvaultOrder(db, input.orderId, { force: input.force });
    }),

  /** Refresh the Bookvault status for a specific order */
  refreshOrderStatus: protectedProcedure
    .input(z.object({ orderId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin((ctx.user as { role?: string }).role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db
        .select({ bookvaultDocRef: physicalProductOrders.bookvaultDocRef, bookvaultPodRef: physicalProductOrders.bookvaultPodRef })
        .from(physicalProductOrders)
        .where(eq(physicalProductOrders.id, input.orderId))
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      if (!row.bookvaultDocRef && !row.bookvaultPodRef) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Order has not been submitted to Bookvault yet" });
      }
      const result = await getOrder({
        docRef: row.bookvaultDocRef ?? undefined,
        podRef: row.bookvaultPodRef ?? undefined,
      });
      if (result) {
        await db.update(physicalProductOrders).set({
          bookvaultStatus: result.Status ?? undefined,
          bookvaultPodRef: result.PodRef ?? row.bookvaultPodRef ?? undefined,
        }).where(eq(physicalProductOrders.id, input.orderId));
      }
      return result;
    }),
});
