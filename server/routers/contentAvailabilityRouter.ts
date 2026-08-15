import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  bundles,
  contentAvailability,
  contentWaitlistEntries,
  digitalProducts,
  lmsCohortGroups,
  lmsCourses,
  lmsQuizzes,
  membershipPlans,
  webinars,
  workshopInstances,
  workshops,
} from "../../drizzle/schema";
import { getDb, requireOrgAdmin } from "../db";
import { sendEmailViaOrg } from "../_core/email";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";

const productTypeSchema = z.enum([
  "course",
  "cohort",
  "workshop",
  "workshop_instance",
  "webinar",
  "download",
  "bundle",
  "membership",
  "quiz",
]);

const availabilityStatusSchema = z.enum(["open", "waitlist", "presale", "enrollment_closed"]);
type ProductType = z.infer<typeof productTypeSchema>;

type AvailabilityTarget = {
  id: number;
  orgId: number;
  title: string;
  parentProductId: number | null;
};

/** Resolve a target and its owner before every availability or waitlist operation. */
async function getTarget(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, productType: ProductType, productId: number): Promise<AvailabilityTarget | null> {
  switch (productType) {
    case "course": {
      const [row] = await db.select({ id: lmsCourses.id, orgId: lmsCourses.orgId, title: lmsCourses.title })
        .from(lmsCourses).where(eq(lmsCourses.id, productId)).limit(1);
      return row ? { ...row, parentProductId: null } : null;
    }
    case "cohort": {
      const [row] = await db.select({ id: lmsCohortGroups.id, orgId: lmsCohortGroups.orgId, title: lmsCohortGroups.name, parentProductId: lmsCohortGroups.courseId })
        .from(lmsCohortGroups).where(eq(lmsCohortGroups.id, productId)).limit(1);
      return row ?? null;
    }
    case "workshop": {
      const [row] = await db.select({ id: workshops.id, orgId: workshops.orgId, title: workshops.title })
        .from(workshops).where(eq(workshops.id, productId)).limit(1);
      return row ? { ...row, parentProductId: null } : null;
    }
    case "workshop_instance": {
      const [row] = await db.select({ id: workshopInstances.id, workshopId: workshopInstances.workshopId, title: workshopInstances.title })
        .from(workshopInstances).where(eq(workshopInstances.id, productId)).limit(1);
      if (!row) return null;
      const [workshop] = await db.select({ orgId: workshops.orgId }).from(workshops).where(eq(workshops.id, row.workshopId)).limit(1);
      return workshop ? { id: row.id, orgId: workshop.orgId, title: row.title, parentProductId: row.workshopId } : null;
    }
    case "webinar": {
      const [row] = await db.select({ id: webinars.id, orgId: webinars.orgId, title: webinars.title })
        .from(webinars).where(eq(webinars.id, productId)).limit(1);
      return row ? { ...row, parentProductId: null } : null;
    }
    case "download": {
      const [row] = await db.select({ id: digitalProducts.id, orgId: digitalProducts.orgId, title: digitalProducts.title })
        .from(digitalProducts).where(eq(digitalProducts.id, productId)).limit(1);
      return row ? { ...row, parentProductId: null } : null;
    }
    case "bundle": {
      const [row] = await db.select({ id: bundles.id, orgId: bundles.orgId, title: bundles.title })
        .from(bundles).where(eq(bundles.id, productId)).limit(1);
      return row ? { ...row, parentProductId: null } : null;
    }
    case "membership": {
      const [row] = await db.select({ id: membershipPlans.id, orgId: membershipPlans.orgId, title: membershipPlans.title })
        .from(membershipPlans).where(eq(membershipPlans.id, productId)).limit(1);
      return row ? { ...row, parentProductId: null } : null;
    }
    case "quiz": {
      const [row] = await db.select({ id: lmsQuizzes.id, orgId: lmsQuizzes.orgId, title: lmsQuizzes.title, parentProductId: lmsQuizzes.courseId })
        .from(lmsQuizzes).where(eq(lmsQuizzes.id, productId)).limit(1);
      return row ?? null;
    }
  }
}

function requireTarget(target: AvailabilityTarget | null): asserts target is AvailabilityTarget {
  if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "The selected content is not available." });
}

export const contentAvailabilityRouter = router({
  /** Public availability lookup for a product landing page. */
  getAvailability: publicProcedure
    .input(z.object({ productType: productTypeSchema, productId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const target = await getTarget(db, input.productType, input.productId);
      requireTarget(target);
      const [availability] = await db.select().from(contentAvailability).where(and(
        eq(contentAvailability.orgId, target.orgId),
        eq(contentAvailability.productType, input.productType),
        eq(contentAvailability.productId, input.productId),
      )).limit(1);
      return {
        orgId: target.orgId,
        productTitle: target.title,
        parentProductId: target.parentProductId,
        status: availability?.status ?? "open",
        presaleHeading: availability?.presaleHeading ?? null,
        presaleBody: availability?.presaleBody ?? null,
        presaleMediaUrl: availability?.presaleMediaUrl ?? null,
        presaleCtaLabel: availability?.presaleCtaLabel ?? null,
        presaleCtaUrl: availability?.presaleCtaUrl ?? null,
      };
    }),

  /** Public capture endpoint. The server verifies the active org from the target. */
  joinWaitlist: publicProcedure
    .input(z.object({
      productType: productTypeSchema,
      productId: z.number().int().positive(),
      name: z.string().trim().min(1).max(255),
      email: z.string().trim().email().max(320),
      userId: z.number().int().positive().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const target = await getTarget(db, input.productType, input.productId);
      requireTarget(target);
      const [availability] = await db.select({ status: contentAvailability.status }).from(contentAvailability).where(and(
        eq(contentAvailability.orgId, target.orgId),
        eq(contentAvailability.productType, input.productType),
        eq(contentAvailability.productId, input.productId),
      )).limit(1);
      if (availability?.status !== "waitlist") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This content is not accepting waitlist registrations." });
      }
      const email = input.email.toLowerCase();
      const [existing] = await db.select({ id: contentWaitlistEntries.id }).from(contentWaitlistEntries).where(and(
        eq(contentWaitlistEntries.orgId, target.orgId),
        eq(contentWaitlistEntries.productType, input.productType),
        eq(contentWaitlistEntries.productId, input.productId),
        eq(contentWaitlistEntries.email, email),
      )).limit(1);
      if (existing) return { success: true, alreadyJoined: true, title: target.title };
      await db.insert(contentWaitlistEntries).values({
        orgId: target.orgId,
        productType: input.productType,
        productId: input.productId,
        parentProductId: target.parentProductId,
        userId: input.userId ?? null,
        name: input.name,
        email,
      });
      return { success: true, alreadyJoined: false, title: target.title };
    }),

  /** Org-admin availability editor. Platform admins may supply an orgId, all others are checked against the target owner. */
  setAvailability: protectedProcedure
    .input(z.object({
      productType: productTypeSchema,
      productId: z.number().int().positive(),
      status: availabilityStatusSchema,
      presaleHeading: z.string().trim().max(255).nullable().optional(),
      presaleBody: z.string().max(10000).nullable().optional(),
      presaleMediaUrl: z.string().url().max(2048).nullable().optional(),
      presaleCtaLabel: z.string().trim().max(255).nullable().optional(),
      presaleCtaUrl: z.string().url().max(2048).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const target = await getTarget(db, input.productType, input.productId);
      requireTarget(target);
      await requireOrgAdmin(ctx.user.id, ctx.user.role, target.orgId);
      const values = {
        status: input.status,
        presaleHeading: input.presaleHeading ?? null,
        presaleBody: input.presaleBody ?? null,
        presaleMediaUrl: input.presaleMediaUrl ?? null,
        presaleCtaLabel: input.presaleCtaLabel ?? null,
        presaleCtaUrl: input.presaleCtaUrl ?? null,
      };
      const [existing] = await db.select({ id: contentAvailability.id }).from(contentAvailability).where(and(
        eq(contentAvailability.orgId, target.orgId),
        eq(contentAvailability.productType, input.productType),
        eq(contentAvailability.productId, input.productId),
      )).limit(1);
      if (existing) await db.update(contentAvailability).set(values).where(eq(contentAvailability.id, existing.id));
      else await db.insert(contentAvailability).values({ orgId: target.orgId, productType: input.productType, productId: input.productId, ...values });
      return { success: true, orgId: target.orgId, status: input.status };
    }),

  /** Org-level dashboard data. Requires the caller to be an administrator of the returned org. */
  listWaitlistEntries: protectedProcedure
    .input(z.object({
      orgId: z.number().int().positive().optional(),
      productType: productTypeSchema.optional(),
      productId: z.number().int().positive().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const orgId = await requireOrgAdmin(ctx.user.id, ctx.user.role, input?.orgId);
      const conditions = [eq(contentWaitlistEntries.orgId, orgId)];
      if (input?.productType) conditions.push(eq(contentWaitlistEntries.productType, input.productType));
      if (input?.productId) conditions.push(eq(contentWaitlistEntries.productId, input.productId));
      return db.select().from(contentWaitlistEntries).where(and(...conditions)).orderBy(desc(contentWaitlistEntries.createdAt));
    }),

  /** An explicit org-admin notification action; no waitlist email is ever sent automatically. */
  notifyEnrollmentOpen: protectedProcedure
    .input(z.object({
      productType: productTypeSchema,
      productId: z.number().int().positive(),
      entryIds: z.array(z.number().int().positive()).min(1),
      subject: z.string().trim().min(1).max(500),
      messageHtml: z.string().trim().min(1).max(50000),
      enrollmentUrl: z.string().url().max(2048),
      accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const target = await getTarget(db, input.productType, input.productId);
      requireTarget(target);
      await requireOrgAdmin(ctx.user.id, ctx.user.role, target.orgId);
      const entries = await db.select().from(contentWaitlistEntries).where(and(
        eq(contentWaitlistEntries.orgId, target.orgId),
        eq(contentWaitlistEntries.productType, input.productType),
        eq(contentWaitlistEntries.productId, input.productId),
      ));
      const selected = entries.filter((entry) => input.entryIds.includes(entry.id));
      const color = input.accentColor ?? "#189aa1";
      let sent = 0;
      for (const entry of selected) {
        const ok = await sendEmailViaOrg({
          to: { name: entry.name, email: entry.email },
          subject: input.subject,
          htmlBody: `${input.messageHtml}<p style="margin-top:24px"><a href="${input.enrollmentUrl}" style="display:inline-block;padding:12px 18px;background:${color};color:#ffffff;border-radius:6px;text-decoration:none;font-weight:600">Enroll now</a></p>`,
        }, target.orgId);
        if (ok) sent++;
      }
      if (selected.length) {
        await db.update(contentWaitlistEntries).set({ notifiedAt: new Date() }).where(and(
          eq(contentWaitlistEntries.orgId, target.orgId),
          eq(contentWaitlistEntries.productType, input.productType),
          eq(contentWaitlistEntries.productId, input.productId),
        ));
      }
      return { success: true, sent, selected: selected.length };
    }),
});
