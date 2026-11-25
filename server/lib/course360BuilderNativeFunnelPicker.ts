import { and, asc, eq, inArray } from "drizzle-orm";
import { funnels, funnelSteps, pageBuilderPages } from "../../drizzle/schema";

/** Native steps reference page_builder_pages; never interpret those IDs as funnel_pages IDs. */
export async function readCourse360BuilderNativeFunnels(db: any, orgId: number, funnelId?: number) {
  const rows = await db.select().from(funnels).where(and(
    eq(funnels.orgId, orgId), funnelId === undefined ? undefined : eq(funnels.id, funnelId),
  )).orderBy(asc(funnels.name), asc(funnels.id));
  if (!rows.length) return [];
  const steps = await db.select().from(funnelSteps).where(inArray(funnelSteps.funnelId, rows.map((row: any) => row.id)))
    .orderBy(asc(funnelSteps.sortOrder), asc(funnelSteps.id));
  const pageIds = [...new Set<number>(steps.flatMap((step: any) => step.pageId ? [step.pageId] : []))];
  const pages = pageIds.length ? await db.select().from(pageBuilderPages).where(and(
    eq(pageBuilderPages.orgId, orgId), inArray(pageBuilderPages.id, pageIds),
  )) : [];
  const pageMap = new Map<number, any>(pages.map((page: any) => [page.id, page]));
  return rows.map((funnel: any) => ({
    ...funnel, orgId, status: funnel.isActive ? "active" : "draft",
    pages: steps.filter((step: any) => step.funnelId === funnel.id).flatMap((step: any) => {
      const page = pageMap.get(step.pageId);
      if (!page || page.orgId !== orgId) return [];
      return [{
        id: page.id, orgId, funnelId: funnel.id, stepId: step.id, pageFamily: "page_builder_pages" as const,
        title: page.title || step.name, slug: page.slug || step.slug,
        pageType: step.stepType === "order" ? "checkout" : step.stepType,
        blocks: page.blocksJson, sortOrder: step.sortOrder, isActive: page.isPublished,
      }];
    }),
  }));
}
