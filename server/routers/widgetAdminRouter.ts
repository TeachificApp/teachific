/**
 * widgetAdminRouter — CRUD for embeddable content widgets.
 */
import { z } from "zod";
import { eq, asc, desc, and, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb, requireOrgAdmin } from "../db";
import {
  embedWidgets,
  lmsCourses,
  lmsQuizzes,
  digitalProducts,
  digitalBundles,
  webinars,
  workshops,
  memberships,
  physicalProducts,
  communityHubs,
} from "../../drizzle/schema";

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const widgetItemSchema = z.object({
  type: z.enum(["course", "quiz", "download", "bundle", "webinar", "membership", "physical", "workshop", "community"]),
  id: z.number().int().positive(),
});

const widgetFormSchema = z.object({
  name: z.string().min(1).max(200),
  title: z.string().max(200).default(""),
  subtitle: z.string().max(1000).optional(),
  layout: z.enum(["grid", "carousel", "list"]).default("grid"),
  theme: z.enum(["light", "dark", "brand"]).default("light"),
  cardStyle: z.enum(["standard", "compact", "minimal"]).default("standard"),
  showPrice: z.boolean().default(true),
  showEnrollButton: z.boolean().default(true),
  showCourseDetails: z.boolean().default(false),
  buttonText: z.string().max(100).default("Enroll Now"),
  buttonUrl: z.string().max(500).default(""),
  maxCards: z.number().int().min(1).max(100).default(6),
  items: z.array(widgetItemSchema).default([]),
  isActive: z.boolean().default(true),
});

const widgetOrgInputSchema = z.object({ orgId: z.number().int().positive() });
const widgetScopedFormSchema = widgetFormSchema.extend({ orgId: z.number().int().positive() });

// ─── Helper ───────────────────────────────────────────────────────────────────

async function resolveWidgetOrg(ctx: { user: { id: number; role: string } }, orgId: number) {
  await requireOrgAdmin(ctx.user.id, ctx.user.role, orgId);
  return orgId;
}

function generateToken(): string {
  return nanoid(32);
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const widgetAdminRouter = router({

  /** List all widgets for the current org */
  list: protectedProcedure.input(widgetOrgInputSchema).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const orgId = await resolveWidgetOrg(ctx, input.orgId);

    const rows = await db
      .select()
      .from(embedWidgets)
      .where(eq(embedWidgets.orgId, orgId))
      .orderBy(desc(embedWidgets.createdAt));

    return rows.map(r => ({
      ...r,
      items: (() => { try { return JSON.parse(r.itemsJson || "[]"); } catch { return []; } })(),
    }));
  }),

  /** Get a single widget by id */
  getById: protectedProcedure
    .input(widgetOrgInputSchema.extend({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const orgId = await resolveWidgetOrg(ctx, input.orgId);

      const [row] = await db
        .select()
        .from(embedWidgets)
        .where(and(eq(embedWidgets.id, input.id), eq(embedWidgets.orgId, orgId)))
        .limit(1);

      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Widget not found" });
      return {
        ...row,
        items: (() => { try { return JSON.parse(row.itemsJson || "[]"); } catch { return []; } })(),
      };
    }),

  /** Get a widget by its public token — used by the public WidgetRenderer page */
  getByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [row] = await db
        .select()
        .from(embedWidgets)
        .where(and(eq(embedWidgets.token, input.token), eq(embedWidgets.isActive, true)))
        .limit(1);

      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Widget not found or inactive" });

      // Increment view count (fire-and-forget)
      db.update(embedWidgets)
        .set({ viewCount: row.viewCount + 1 })
        .where(eq(embedWidgets.id, row.id))
        .catch(() => {});

      // Resolve items to full content objects
      let items: Array<{ type: string; id: number }> = [];
      try { items = JSON.parse(row.itemsJson || "[]"); } catch {}

      const resolvedItems = await resolveWidgetItems(db, items, row.orgId);

      return {
        id: row.id,
        orgId: row.orgId,
        token: row.token,
        name: row.name,
        title: row.title,
        subtitle: row.subtitle,
        layout: row.layout,
        theme: row.theme,
        cardStyle: row.cardStyle,
        showPrice: row.showPrice,
        showEnrollButton: row.showEnrollButton,
        showCourseDetails: row.showCourseDetails,
        buttonText: row.buttonText,
        buttonUrl: row.buttonUrl,
        maxCards: row.maxCards,
        items: resolvedItems,
      };
    }),

  /** Create a new widget */
  create: protectedProcedure
    .input(widgetScopedFormSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const orgId = await resolveWidgetOrg(ctx, input.orgId);

      const token = generateToken();
      const [result] = await db.insert(embedWidgets).values({
        orgId,
        token,
        name: input.name,
        title: input.title,
        subtitle: input.subtitle ?? null,
        layout: input.layout,
        theme: input.theme,
        cardStyle: input.cardStyle,
        showPrice: input.showPrice,
        showEnrollButton: input.showEnrollButton,
        showCourseDetails: input.showCourseDetails,
        buttonText: input.buttonText,
        buttonUrl: input.buttonUrl,
        maxCards: input.maxCards,
        itemsJson: JSON.stringify(input.items),
        isActive: input.isActive,
      });

      const insertId = (result as any).insertId;
      const [created] = await db.select().from(embedWidgets).where(eq(embedWidgets.id, insertId)).limit(1);
      return {
        ...created!,
        items: (() => { try { return JSON.parse(created!.itemsJson || "[]"); } catch { return []; } })(),
      };
    }),

  /** Update an existing widget */
  update: protectedProcedure
    .input(widgetScopedFormSchema.extend({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const orgId = await resolveWidgetOrg(ctx, input.orgId);

      const [existing] = await db
        .select({ id: embedWidgets.id })
        .from(embedWidgets)
        .where(and(eq(embedWidgets.id, input.id), eq(embedWidgets.orgId, orgId)))
        .limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Widget not found" });

      await db.update(embedWidgets).set({
        name: input.name,
        title: input.title,
        subtitle: input.subtitle ?? null,
        layout: input.layout,
        theme: input.theme,
        cardStyle: input.cardStyle,
        showPrice: input.showPrice,
        showEnrollButton: input.showEnrollButton,
        showCourseDetails: input.showCourseDetails,
        buttonText: input.buttonText,
        buttonUrl: input.buttonUrl,
        maxCards: input.maxCards,
        itemsJson: JSON.stringify(input.items),
        isActive: input.isActive,
      }).where(eq(embedWidgets.id, input.id));

      return { success: true };
    }),

  /** Delete a widget */
  delete: protectedProcedure
    .input(widgetOrgInputSchema.extend({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const orgId = await resolveWidgetOrg(ctx, input.orgId);

      const [existing] = await db
        .select({ id: embedWidgets.id })
        .from(embedWidgets)
        .where(and(eq(embedWidgets.id, input.id), eq(embedWidgets.orgId, orgId)))
        .limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      await db.delete(embedWidgets).where(eq(embedWidgets.id, input.id));
      return { success: true };
    }),

  /** Regenerate the public token for a widget */
  regenerateToken: protectedProcedure
    .input(widgetOrgInputSchema.extend({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const orgId = await resolveWidgetOrg(ctx, input.orgId);

      const [existing] = await db
        .select({ id: embedWidgets.id })
        .from(embedWidgets)
        .where(and(eq(embedWidgets.id, input.id), eq(embedWidgets.orgId, orgId)))
        .limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const newToken = generateToken();
      await db.update(embedWidgets).set({ token: newToken }).where(eq(embedWidgets.id, input.id));
      return { token: newToken };
    }),

  /**
   * List all content items for the widget content picker.
   * Returns a flat list of { id, type, title, coverImageUrl, slug? }
   */
  listAllContent: protectedProcedure.input(widgetOrgInputSchema).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const orgId = await resolveWidgetOrg(ctx, input.orgId);

    const results: Array<{
      id: number;
      type: string;
      title: string;
      coverImageUrl: string | null;
      slug: string | null;
    }> = [];

    // Courses
    const courses = await db
      .select({ id: lmsCourses.id, title: lmsCourses.title, coverImageUrl: lmsCourses.coverImageUrl, slug: lmsCourses.slug })
      .from(lmsCourses)
      .where(eq(lmsCourses.orgId, orgId))
      .orderBy(asc(lmsCourses.title));
    courses.forEach(c => results.push({ ...c, type: "course", coverImageUrl: c.coverImageUrl ?? null }));

    // Quizzes
    const quizzes = await db
      .select({ id: lmsQuizzes.id, title: lmsQuizzes.title })
      .from(lmsQuizzes)
      .where(eq(lmsQuizzes.orgId, orgId))
      .orderBy(asc(lmsQuizzes.title));
    quizzes.forEach(q => results.push({ id: q.id, type: "quiz", title: q.title, coverImageUrl: null, slug: null }));

    // Digital downloads
    const downloads = await db
      .select({ id: digitalProducts.id, title: digitalProducts.title, thumbnailUrl: digitalProducts.thumbnailUrl, slug: digitalProducts.slug })
      .from(digitalProducts)
      .where(eq(digitalProducts.orgId, orgId))
      .orderBy(asc(digitalProducts.title));
    downloads.forEach(d => results.push({ id: d.id, type: "download", title: d.title, coverImageUrl: d.thumbnailUrl ?? null, slug: d.slug }));

    // Digital bundles
    const dbundles = await db
      .select({ id: digitalBundles.id, title: digitalBundles.title, thumbnailUrl: digitalBundles.thumbnailUrl, slug: digitalBundles.slug })
      .from(digitalBundles)
      .where((digitalBundles as any).orgId ? eq((digitalBundles as any).orgId, orgId) : eq(digitalBundles.id, digitalBundles.id))
      .orderBy(asc(digitalBundles.title));
    dbundles.forEach(b => results.push({ id: b.id, type: "bundle", title: b.title, coverImageUrl: b.thumbnailUrl ?? null, slug: b.slug }));

    // Webinars
    const wbs = await db
      .select({ id: webinars.id, title: webinars.title, thumbnailUrl: webinars.thumbnailUrl, slug: webinars.slug })
      .from(webinars)
      .where(eq(webinars.orgId, orgId))
      .orderBy(asc(webinars.title));
    wbs.forEach(w => results.push({ id: w.id, type: "webinar", title: w.title, coverImageUrl: w.thumbnailUrl ?? null, slug: w.slug }));

    // Workshops
    const wks = await db
      .select({ id: workshops.id, title: workshops.title, coverImageUrl: workshops.coverImageUrl, slug: workshops.slug })
      .from(workshops)
      .where(eq(workshops.orgId, orgId))
      .orderBy(asc(workshops.title));
    wks.forEach(w => results.push({ id: w.id, type: "workshop", title: w.title, coverImageUrl: w.coverImageUrl ?? null, slug: w.slug }));

    // Memberships
    const mems = await db
      .select({ id: memberships.id, name: memberships.name })
      .from(memberships)
      .where(eq(memberships.orgId, orgId))
      .orderBy(asc(memberships.name));
    mems.forEach(m => results.push({ id: m.id, type: "membership", title: m.name, coverImageUrl: null, slug: null }));

    // Physical products
    const phys = await db
      .select({ id: physicalProducts.id, title: physicalProducts.title, thumbnailUrl: physicalProducts.thumbnailUrl, slug: physicalProducts.slug })
      .from(physicalProducts)
      .where(eq(physicalProducts.orgId, orgId))
      .orderBy(asc(physicalProducts.title));
    phys.forEach(p => results.push({ id: p.id, type: "physical", title: p.title, coverImageUrl: p.thumbnailUrl ?? null, slug: p.slug }));

    // Communities
    const comms = await db
      .select({ id: communityHubs.id, name: communityHubs.name, coverImageUrl: communityHubs.coverImageUrl, slug: communityHubs.slug })
      .from(communityHubs)
      .where(eq(communityHubs.orgId, orgId))
      .orderBy(asc(communityHubs.name));
    comms.forEach(c => results.push({ id: c.id, type: "community", title: c.name, coverImageUrl: c.coverImageUrl ?? null, slug: c.slug }));

    return results;
  }),
});

// ─── Resolve widget items to full content objects ─────────────────────────────

async function resolveWidgetItems(
  db: any,
  items: Array<{ type: string; id: number }>,
  orgId: number
): Promise<Array<{
  type: string;
  id: number;
  title: string;
  subtitle: string | null;
  coverImageUrl: string | null;
  slug: string | null;
  price: string | null;
  isFree: boolean;
  currency: string | null;
  url: string | null;
}>> {
  if (items.length === 0) return [];

  const byType = items.reduce<Record<string, number[]>>((acc, i) => {
    (acc[i.type] ??= []).push(i.id);
    return acc;
  }, {});

  const resolved: Array<{
    type: string; id: number; title: string; subtitle: string | null;
    coverImageUrl: string | null; slug: string | null; price: string | null;
    isFree: boolean; currency: string | null; url: string | null;
  }> = [];

  if (byType.course?.length) {
    const rows = await db
      .select({
        id: lmsCourses.id, title: lmsCourses.title, subtitle: lmsCourses.subtitle,
        coverImageUrl: lmsCourses.coverImageUrl, thumbnailUrl: lmsCourses.thumbnailUrl,
        slug: lmsCourses.slug, price: lmsCourses.price, isFree: lmsCourses.isFree, currency: lmsCourses.currency,
      })
      .from(lmsCourses)
      .where(and(eq(lmsCourses.orgId, orgId), inArray(lmsCourses.id, byType.course)));
    rows.forEach((r: any) => resolved.push({
      type: "course", id: r.id, title: r.title, subtitle: r.subtitle ?? null,
      coverImageUrl: r.coverImageUrl ?? r.thumbnailUrl ?? null, slug: r.slug,
      price: r.price?.toString() ?? null, isFree: !!r.isFree, currency: r.currency ?? "usd", url: `/courses/${r.slug}`,
    }));
  }

  if (byType.quiz?.length) {
    const rows = await db
      .select({ id: lmsQuizzes.id, title: lmsQuizzes.title })
      .from(lmsQuizzes)
      .where(and(eq(lmsQuizzes.orgId, orgId), inArray(lmsQuizzes.id, byType.quiz)));
    rows.forEach((r: any) => resolved.push({
      type: "quiz", id: r.id, title: r.title, subtitle: null,
      coverImageUrl: null, slug: null, price: null, isFree: true, currency: null, url: null,
    }));
  }

  if (byType.download?.length) {
    const rows = await db
      .select({ id: digitalProducts.id, title: digitalProducts.title, thumbnailUrl: digitalProducts.thumbnailUrl, slug: digitalProducts.slug })
      .from(digitalProducts)
      .where(and(eq(digitalProducts.orgId, orgId), inArray(digitalProducts.id, byType.download)));
    rows.forEach((r: any) => resolved.push({
      type: "download", id: r.id, title: r.title, subtitle: null,
      coverImageUrl: r.thumbnailUrl ?? null, slug: r.slug, price: null, isFree: false, currency: null, url: `/downloads/${r.slug}`,
    }));
  }

  if (byType.webinar?.length) {
    const rows = await db
      .select({ id: webinars.id, title: webinars.title, thumbnailUrl: webinars.thumbnailUrl, slug: webinars.slug })
      .from(webinars)
      .where(and(eq(webinars.orgId, orgId), inArray(webinars.id, byType.webinar)));
    rows.forEach((r: any) => resolved.push({
      type: "webinar", id: r.id, title: r.title, subtitle: null,
      coverImageUrl: r.thumbnailUrl ?? null, slug: r.slug, price: null, isFree: false, currency: null, url: `/webinars/${r.slug}`,
    }));
  }

  if (byType.workshop?.length) {
    const rows = await db
      .select({ id: workshops.id, title: workshops.title, coverImageUrl: workshops.coverImageUrl, slug: workshops.slug, price: workshops.price, isFree: workshops.isFree, currency: workshops.currency })
      .from(workshops)
      .where(and(eq(workshops.orgId, orgId), inArray(workshops.id, byType.workshop)));
    rows.forEach((r: any) => resolved.push({
      type: "workshop", id: r.id, title: r.title, subtitle: null,
      coverImageUrl: r.coverImageUrl ?? null, slug: r.slug, price: r.price?.toString() ?? null, isFree: !!r.isFree, currency: r.currency ?? "usd", url: `/workshops/${r.slug}`,
    }));
  }

  if (byType.membership?.length) {
    const rows = await db
      .select({ id: memberships.id, name: memberships.name, price: memberships.price })
      .from(memberships)
      .where(and(eq(memberships.orgId, orgId), inArray(memberships.id, byType.membership)));
    rows.forEach((r: any) => resolved.push({
      type: "membership", id: r.id, title: r.name, subtitle: null,
      coverImageUrl: null, slug: null, price: r.price?.toString() ?? null, isFree: false, currency: "usd", url: null,
    }));
  }

  if (byType.physical?.length) {
    const rows = await db
      .select({ id: physicalProducts.id, title: physicalProducts.title, thumbnailUrl: physicalProducts.thumbnailUrl, slug: physicalProducts.slug, price: physicalProducts.price })
      .from(physicalProducts)
      .where(and(eq(physicalProducts.orgId, orgId), inArray(physicalProducts.id, byType.physical)));
    rows.forEach((r: any) => resolved.push({
      type: "physical", id: r.id, title: r.title, subtitle: null,
      coverImageUrl: r.thumbnailUrl ?? null, slug: r.slug, price: r.price?.toString() ?? null, isFree: false, currency: "usd", url: `/products/${r.slug}`,
    }));
  }

  if (byType.community?.length) {
    const rows = await db
      .select({ id: communityHubs.id, name: communityHubs.name, coverImageUrl: communityHubs.coverImageUrl, slug: communityHubs.slug })
      .from(communityHubs)
      .where(and(eq(communityHubs.orgId, orgId), inArray(communityHubs.id, byType.community)));
    rows.forEach((r: any) => resolved.push({
      type: "community", id: r.id, title: r.name, subtitle: null,
      coverImageUrl: r.coverImageUrl ?? null, slug: r.slug, price: null, isFree: false, currency: null, url: `/community/${r.slug}`,
    }));
  }

  // Preserve original item order
  const orderMap = new Map(items.map((item, idx) => [`${item.type}:${item.id}`, idx]));
  resolved.sort((a, b) => {
    const ai = orderMap.get(`${a.type}:${a.id}`) ?? 9999;
    const bi = orderMap.get(`${b.type}:${b.id}`) ?? 9999;
    return ai - bi;
  });

  return resolved.slice(0, 100);
}
