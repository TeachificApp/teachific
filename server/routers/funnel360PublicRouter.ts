import { z } from "zod";
import { and, eq, asc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { funnels, funnelSteps, pageBuilderPages, organizations } from "../../drizzle/schema";
import { resolvePublicOrganizationScope } from "../lib/publicOrgRequestScope";
import { funnel360SchoolOrigin } from "../lib/funnel360Scope";
import { funnel360PageLearnSettings } from "../lib/funnel360Tables";

const scope = async (req: any) => {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  const school = await resolvePublicOrganizationScope(db as any, req);
  // Never publish another school's content using the global primary-school fallback.
  if (!school || school.source === "platform" || school.source === "legacy_hint")
    throw new TRPCError({ code: "NOT_FOUND" });
  const [org] = await db.select().from(organizations).where(and(eq(organizations.id, school.id), eq(organizations.isActive, true))).limit(1);
  if (!org) throw new TRPCError({ code: "NOT_FOUND" });
  return { db, orgId: org.id, org, baseUrl: funnel360SchoolOrigin(org) };
};
export const funnel360PublicRouter = router({
  getPage: publicProcedure.input(z.object({ funnelSlug: z.string().min(1).max(200), pageSlug: z.string().min(1).max(200) }).strict()).query(async ({ ctx, input }) => {
    const { db, orgId, org, baseUrl } = await scope(ctx.req);
    const [funnel] = await db.select().from(funnels).where(and(eq(funnels.orgId, orgId), eq(funnels.slug, input.funnelSlug), eq(funnels.isActive, true))).limit(1);
    if (!funnel) throw new TRPCError({ code: "NOT_FOUND" });
    const [step] = await db.select().from(funnelSteps).where(and(eq(funnelSteps.funnelId, funnel.id), eq(funnelSteps.slug, input.pageSlug))).limit(1);
    if (!step?.pageId) throw new TRPCError({ code: "NOT_FOUND" });
    const [page] = await db.select().from(pageBuilderPages).where(and(eq(pageBuilderPages.id, step.pageId), eq(pageBuilderPages.orgId, orgId), eq(pageBuilderPages.isPublished, true))).limit(1);
    if (!page) throw new TRPCError({ code: "NOT_FOUND" });
    const [metadata] = await db.select().from(funnel360PageLearnSettings).where(and(eq(funnel360PageLearnSettings.orgId, orgId), eq(funnel360PageLearnSettings.pageId, page.id))).limit(1);
    return { page, seoKeywords: metadata?.seoKeywords || "", schoolName: org.name, logoUrl: org.logoUrl,
      canonical: `${baseUrl}/funnel/${encodeURIComponent(funnel.slug)}/${encodeURIComponent(step.slug || "")}` };
  }),
  listLearnPages: publicProcedure.query(async ({ ctx }) => {
    const { db, orgId, baseUrl } = await scope(ctx.req);
    return db.select({ id: pageBuilderPages.id, title: pageBuilderPages.title, displayName: funnel360PageLearnSettings.displayName,
      funnelSlug: funnels.slug, pageSlug: funnelSteps.slug }).from(funnel360PageLearnSettings)
      .innerJoin(pageBuilderPages, and(eq(pageBuilderPages.id, funnel360PageLearnSettings.pageId), eq(pageBuilderPages.orgId, orgId)))
      .innerJoin(funnelSteps, eq(funnelSteps.pageId, pageBuilderPages.id))
      .innerJoin(funnels, and(eq(funnels.id, funnelSteps.funnelId), eq(funnels.orgId, orgId)))
      .where(and(eq(funnel360PageLearnSettings.orgId, orgId), eq(funnel360PageLearnSettings.showInLibrary, true), eq(pageBuilderPages.isPublished, true), eq(funnels.isActive, true)))
      .orderBy(asc(funnelSteps.sortOrder)).limit(100)
      .then(rows => rows.map(row => ({ id: row.id, title: row.displayName || row.title,
        href: `${baseUrl}/funnel/${encodeURIComponent(row.funnelSlug)}/${encodeURIComponent(row.pageSlug || "")}`,
        type: "page" as const })));
  }),
});
