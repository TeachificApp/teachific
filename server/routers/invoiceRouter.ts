/**
 * Invoice / Transaction Router
 *
 * Access tiers:
 *   - Platform admin (site_owner / site_admin): can list/view all orgs
 *   - Org admin (org_super_admin / org_admin): scoped to their own org
 *   - Student / member: can list/view their own invoices only
 *
 * Manual invoices created by org admins are written to org_invoices and
 * count toward the org's total revenue and purchase count.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc, sql, like, or, isNull } from "drizzle-orm";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { orgInvoices, orgMembers, organizations, users, orgPaymentSettings } from "../../drizzle/schema";
import { sendEmailViaOrg } from "../_core/email";
import { buildFunnelPurchaseConfirmationEmail } from "../_core/email";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PLATFORM_ADMIN_ROLES = ["site_owner", "site_admin"] as const;
const ORG_ADMIN_ROLES = ["org_super_admin", "org_admin"] as const;

function isPlatformAdmin(role: string) {
  return (PLATFORM_ADMIN_ROLES as readonly string[]).includes(role);
}

/** Resolve the orgId the caller is an admin of (or throw FORBIDDEN). */
async function resolveOrgAdminId(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  userId: number,
  requestedOrgId?: number
): Promise<number> {
  if (requestedOrgId) {
    const [m] = await db
      .select({ role: orgMembers.role })
      .from(orgMembers)
      .where(and(eq(orgMembers.userId, userId), eq(orgMembers.orgId, requestedOrgId)))
      .limit(1);
    if (!m || !(ORG_ADMIN_ROLES as readonly string[]).includes(m.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Not an admin of this org" });
    }
    return requestedOrgId;
  }
  // Default: first org where user is an admin
  const [m] = await db
    .select({ orgId: orgMembers.orgId })
    .from(orgMembers)
    .where(and(eq(orgMembers.userId, userId)))
    .limit(1);
  if (!m) throw new TRPCError({ code: "FORBIDDEN", message: "No org found for user" });
  return m.orgId;
}

/** Generate the next invoice number for an org (reads + increments nextInvoiceNumber). */
async function generateInvoiceNumber(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  orgId: number
): Promise<string> {
  const [settings] = await db
    .select({ invoicePrefix: orgPaymentSettings.invoicePrefix, nextInvoiceNumber: orgPaymentSettings.nextInvoiceNumber })
    .from(orgPaymentSettings)
    .where(eq(orgPaymentSettings.orgId, orgId))
    .limit(1);
  const prefix = settings?.invoicePrefix?.trim() || "";
  const num = settings?.nextInvoiceNumber ?? 1;
  const invoiceNum = prefix
    ? `${prefix}-${String(num).padStart(5, "0")}`
    : String(num).padStart(5, "0");
  // Increment (fire-and-forget)
  db.update(orgPaymentSettings)
    .set({ nextInvoiceNumber: num + 1 })
    .where(eq(orgPaymentSettings.orgId, orgId))
    .catch(() => {});
  return invoiceNum;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const invoiceRouter = router({
  /**
   * List invoices/transactions.
   *
   * Platform admins can pass orgId to scope to one org, or omit to see all.
   * Org admins always see their own org only.
   * Students see their own invoices only.
   */
  list: protectedProcedure
    .input(
      z.object({
        orgId: z.number().int().positive().optional(),
        search: z.string().max(200).optional(),
        status: z.enum(["all", "paid", "pending", "refunded"]).default("all"),
        productType: z.enum(["all", "course", "download", "bundle", "membership", "manual"]).default("all"),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { page, pageSize, search, status, productType } = input;
      const offset = (page - 1) * pageSize;

      const isPlatAdmin = isPlatformAdmin(ctx.user.role);
      const isOrgAdmin = (ORG_ADMIN_ROLES as readonly string[]).includes(ctx.user.role);

      // Build WHERE conditions
      const conditions: ReturnType<typeof eq>[] = [];

      if (isPlatAdmin) {
        // Platform admin: optionally scope to one org
        if (input.orgId) conditions.push(eq(orgInvoices.orgId, input.orgId));
      } else if (isOrgAdmin) {
        // Org admin: resolve their org
        const orgId = await resolveOrgAdminId(db, ctx.user.id, input.orgId);
        conditions.push(eq(orgInvoices.orgId, orgId));
      } else {
        // Student: own invoices only
        conditions.push(eq(orgInvoices.userId, ctx.user.id));
      }

      if (status !== "all") conditions.push(eq(orgInvoices.status, status));
      if (productType !== "all") conditions.push(eq(orgInvoices.productType, productType));

      const whereClause = conditions.length > 0
        ? and(...conditions)
        : undefined;

      // Apply search filter (buyer name/email or product title or invoice number)
      const buildQuery = (withSearch: boolean) => {
        const base = db
          .select({
            id: orgInvoices.id,
            orgId: orgInvoices.orgId,
            userId: orgInvoices.userId,
            invoiceNumber: orgInvoices.invoiceNumber,
            productType: orgInvoices.productType,
            productId: orgInvoices.productId,
            productTitle: orgInvoices.productTitle,
            buyerName: orgInvoices.buyerName,
            buyerEmail: orgInvoices.buyerEmail,
            amountPaid: orgInvoices.amountPaid,
            currency: orgInvoices.currency,
            status: orgInvoices.status,
            stripePaymentIntentId: orgInvoices.stripePaymentIntentId,
            notes: orgInvoices.notes,
            isManual: orgInvoices.isManual,
            createdAt: orgInvoices.createdAt,
            orgName: organizations.name,
          })
          .from(orgInvoices)
          .leftJoin(organizations, eq(orgInvoices.orgId, organizations.id));

        if (whereClause) base.where(whereClause);
        return base;
      };

      // Count total
      const [{ total }] = await db
        .select({ total: sql<number>`count(*)` })
        .from(orgInvoices)
        .where(whereClause ?? sql`1=1`);

      // Revenue total
      const [{ totalRevenue }] = await db
        .select({ totalRevenue: sql<number>`COALESCE(SUM(amount_paid), 0)` })
        .from(orgInvoices)
        .where(and(whereClause ?? sql`1=1`, eq(orgInvoices.status, "paid")));

      const rows = await db
        .select({
          id: orgInvoices.id,
          orgId: orgInvoices.orgId,
          userId: orgInvoices.userId,
          invoiceNumber: orgInvoices.invoiceNumber,
          productType: orgInvoices.productType,
          productId: orgInvoices.productId,
          productTitle: orgInvoices.productTitle,
          buyerName: orgInvoices.buyerName,
          buyerEmail: orgInvoices.buyerEmail,
          amountPaid: orgInvoices.amountPaid,
          currency: orgInvoices.currency,
          status: orgInvoices.status,
          stripePaymentIntentId: orgInvoices.stripePaymentIntentId,
          notes: orgInvoices.notes,
          isManual: orgInvoices.isManual,
          createdAt: orgInvoices.createdAt,
          orgName: organizations.name,
        })
        .from(orgInvoices)
        .leftJoin(organizations, eq(orgInvoices.orgId, organizations.id))
        .where(
          search
            ? and(
                whereClause ?? sql`1=1`,
                or(
                  like(orgInvoices.buyerEmail, `%${search}%`),
                  like(orgInvoices.buyerName, `%${search}%`),
                  like(orgInvoices.productTitle, `%${search}%`),
                  like(orgInvoices.invoiceNumber, `%${search}%`)
                )
              )
            : whereClause ?? sql`1=1`
        )
        .orderBy(desc(orgInvoices.createdAt))
        .limit(pageSize)
        .offset(offset);

      return {
        invoices: rows,
        total: Number(total),
        totalRevenue: Number(totalRevenue),
        page,
        pageSize,
        totalPages: Math.ceil(Number(total) / pageSize),
      };
    }),

  /** Get a single invoice by ID. */
  get: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [invoice] = await db
        .select({
          id: orgInvoices.id,
          orgId: orgInvoices.orgId,
          userId: orgInvoices.userId,
          invoiceNumber: orgInvoices.invoiceNumber,
          productType: orgInvoices.productType,
          productId: orgInvoices.productId,
          productTitle: orgInvoices.productTitle,
          buyerName: orgInvoices.buyerName,
          buyerEmail: orgInvoices.buyerEmail,
          amountPaid: orgInvoices.amountPaid,
          currency: orgInvoices.currency,
          status: orgInvoices.status,
          stripePaymentIntentId: orgInvoices.stripePaymentIntentId,
          stripeCheckoutSessionId: orgInvoices.stripeCheckoutSessionId,
          notes: orgInvoices.notes,
          isManual: orgInvoices.isManual,
          createdAt: orgInvoices.createdAt,
          orgName: organizations.name,
          orgLogoUrl: organizations.logoUrl,
        })
        .from(orgInvoices)
        .leftJoin(organizations, eq(orgInvoices.orgId, organizations.id))
        .where(eq(orgInvoices.id, input.id))
        .limit(1);

      if (!invoice) throw new TRPCError({ code: "NOT_FOUND" });

      const isPlatAdmin = isPlatformAdmin(ctx.user.role);
      const isOrgAdmin = (ORG_ADMIN_ROLES as readonly string[]).includes(ctx.user.role);

      // Access check
      if (!isPlatAdmin) {
        if (isOrgAdmin) {
          await resolveOrgAdminId(db, ctx.user.id, invoice.orgId);
        } else {
          if (invoice.userId !== ctx.user.id) {
            throw new TRPCError({ code: "FORBIDDEN" });
          }
        }
      }

      return invoice;
    }),

  /**
   * Manually create an invoice (org admin or platform admin only).
   * These are counted in purchase totals and revenue.
   */
  createManual: protectedProcedure
    .input(
      z.object({
        orgId: z.number().int().positive(),
        productTitle: z.string().min(1).max(512),
        productType: z.enum(["course", "download", "bundle", "membership", "manual"]).default("manual"),
        productId: z.number().int().positive().optional(),
        buyerName: z.string().max(255).optional(),
        buyerEmail: z.string().email().max(320).optional(),
        amountPaid: z.number().min(0).default(0),
        currency: z.string().length(3).default("usd"),
        status: z.enum(["paid", "pending", "refunded"]).default("paid"),
        notes: z.string().max(2000).optional(),
        sendEmail: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const isPlatAdmin = isPlatformAdmin(ctx.user.role);
      const isOrgAdmin = (ORG_ADMIN_ROLES as readonly string[]).includes(ctx.user.role);

      if (!isPlatAdmin && !isOrgAdmin) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can create manual invoices" });
      }

      // Verify org admin access
      if (!isPlatAdmin) {
        await resolveOrgAdminId(db, ctx.user.id, input.orgId);
      }

      const invoiceNumber = await generateInvoiceNumber(db, input.orgId);

      const [inserted] = await db.insert(orgInvoices).values({
        orgId: input.orgId,
        userId: null,
        invoiceNumber,
        productType: input.productType,
        productId: input.productId ?? null,
        productTitle: input.productTitle,
        buyerName: input.buyerName ?? null,
        buyerEmail: input.buyerEmail ?? null,
        amountPaid: String(input.amountPaid),
        currency: input.currency.toLowerCase(),
        status: input.status,
        notes: input.notes ?? null,
        isManual: true,
      });

      // Optionally send a receipt email to the buyer
      if (input.sendEmail && input.buyerEmail) {
        const { subject, htmlBody, previewText } = buildFunnelPurchaseConfirmationEmail({
          firstName: (input.buyerName ?? input.buyerEmail).split(" ")[0],
          productName: input.productTitle,
          amountPaid: input.amountPaid,
          loginUrl: `https://teachific.app`,
        });
        await sendEmailViaOrg(
          {
            to: { name: input.buyerName ?? input.buyerEmail, email: input.buyerEmail },
            subject,
            htmlBody,
            previewText,
          },
          input.orgId
        ).catch(() => {});
      }

      return { success: true, invoiceNumber };
    }),

  /**
   * Resend receipt email for an existing invoice.
   * Org admin or platform admin only.
   */
  resend: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [invoice] = await db
        .select()
        .from(orgInvoices)
        .where(eq(orgInvoices.id, input.id))
        .limit(1);

      if (!invoice) throw new TRPCError({ code: "NOT_FOUND" });

      const isPlatAdmin = isPlatformAdmin(ctx.user.role);
      const isOrgAdmin = (ORG_ADMIN_ROLES as readonly string[]).includes(ctx.user.role);

      if (!isPlatAdmin && !isOrgAdmin) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (!isPlatAdmin) {
        await resolveOrgAdminId(db, ctx.user.id, invoice.orgId);
      }

      if (!invoice.buyerEmail) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No buyer email on this invoice" });
      }

      const { subject, htmlBody, previewText } = buildFunnelPurchaseConfirmationEmail({
        firstName: (invoice.buyerName ?? invoice.buyerEmail).split(" ")[0],
        productName: invoice.productTitle,
        amountPaid: Number(invoice.amountPaid),
        loginUrl: `https://teachific.app`,
      });

      await sendEmailViaOrg(
        {
          to: { name: invoice.buyerName ?? invoice.buyerEmail, email: invoice.buyerEmail },
          subject,
          htmlBody,
          previewText,
        },
        invoice.orgId
      );

      return { success: true };
    }),

  /**
   * Update invoice status (org admin or platform admin only).
   */
  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        status: z.enum(["paid", "pending", "refunded"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [invoice] = await db
        .select({ orgId: orgInvoices.orgId })
        .from(orgInvoices)
        .where(eq(orgInvoices.id, input.id))
        .limit(1);

      if (!invoice) throw new TRPCError({ code: "NOT_FOUND" });

      const isPlatAdmin = isPlatformAdmin(ctx.user.role);
      const isOrgAdmin = (ORG_ADMIN_ROLES as readonly string[]).includes(ctx.user.role);

      if (!isPlatAdmin && !isOrgAdmin) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (!isPlatAdmin) {
        await resolveOrgAdminId(db, ctx.user.id, invoice.orgId);
      }

      await db
        .update(orgInvoices)
        .set({ status: input.status })
        .where(eq(orgInvoices.id, input.id));

      return { success: true };
    }),

  /**
   * List transactions for a specific user — used by admin Transactions tab in UserDetailPanel.
   * Platform admins and org admins only.
   */
  listByUser: protectedProcedure
    .input(
      z.object({
        targetUserId: z.number().int().positive(),
        orgId: z.number().int().positive().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const isPlatAdmin = isPlatformAdmin(ctx.user.role);
      const isOrgAdmin = (ORG_ADMIN_ROLES as readonly string[]).includes(ctx.user.role);
      if (!isPlatAdmin && !isOrgAdmin) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const conditions: ReturnType<typeof eq>[] = [
        eq(orgInvoices.userId, input.targetUserId),
      ];
      if (!isPlatAdmin && isOrgAdmin) {
        const orgId = await resolveOrgAdminId(db, ctx.user.id, input.orgId);
        conditions.push(eq(orgInvoices.orgId, orgId));
      } else if (input.orgId) {
        conditions.push(eq(orgInvoices.orgId, input.orgId));
      }
      const rows = await db
        .select({
          id: orgInvoices.id,
          orgId: orgInvoices.orgId,
          userId: orgInvoices.userId,
          invoiceNumber: orgInvoices.invoiceNumber,
          productType: orgInvoices.productType,
          productId: orgInvoices.productId,
          productTitle: orgInvoices.productTitle,
          buyerName: orgInvoices.buyerName,
          buyerEmail: orgInvoices.buyerEmail,
          amountPaid: orgInvoices.amountPaid,
          currency: orgInvoices.currency,
          status: orgInvoices.status,
          stripePaymentIntentId: orgInvoices.stripePaymentIntentId,
          notes: orgInvoices.notes,
          isManual: orgInvoices.isManual,
          createdAt: orgInvoices.createdAt,
          orgName: organizations.name,
          orgLogoUrl: organizations.logoUrl,
        })
        .from(orgInvoices)
        .leftJoin(organizations, eq(orgInvoices.orgId, organizations.id))
        .where(and(...conditions))
        .orderBy(desc(orgInvoices.createdAt))
        .limit(200);
      return rows.map((r) => ({
        ...r,
        amountPaid: Number(r.amountPaid),
        createdAt: Number(r.createdAt),
      }));
    }),

  /**
   * Get transaction summary stats for an org.
   * Includes total count, total revenue, and breakdown by product type.
   */
  getStats: protectedProcedure
    .input(z.object({ orgId: z.number().int().positive().optional() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const isPlatAdmin = isPlatformAdmin(ctx.user.role);
      const isOrgAdmin = (ORG_ADMIN_ROLES as readonly string[]).includes(ctx.user.role);

      let orgId: number | undefined;
      if (isPlatAdmin) {
        orgId = input.orgId;
      } else if (isOrgAdmin) {
        orgId = await resolveOrgAdminId(db, ctx.user.id, input.orgId);
      } else {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const whereClause = orgId
        ? and(eq(orgInvoices.orgId, orgId), eq(orgInvoices.status, "paid"))
        : eq(orgInvoices.status, "paid");

      const [{ totalCount, totalRevenue }] = await db
        .select({
          totalCount: sql<number>`count(*)`,
          totalRevenue: sql<number>`COALESCE(SUM(amount_paid), 0)`,
        })
        .from(orgInvoices)
        .where(whereClause);

      const byType = await db
        .select({
          productType: orgInvoices.productType,
          count: sql<number>`count(*)`,
          revenue: sql<number>`COALESCE(SUM(amount_paid), 0)`,
        })
        .from(orgInvoices)
        .where(whereClause)
        .groupBy(orgInvoices.productType);

      return {
        totalCount: Number(totalCount),
        totalRevenue: Number(totalRevenue),
        byType: byType.map((r) => ({
          productType: r.productType,
          count: Number(r.count),
          revenue: Number(r.revenue),
        })),
      };
    }),
});
