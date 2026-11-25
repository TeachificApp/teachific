import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { funnels, funnelSteps, pageBuilderPages } from "../../drizzle/schema";
import { funnel360DraftRequests, funnel360PageLearnSettings } from "./funnel360Tables";
import { assertFunnel360Destination } from "./funnel360Scope";
import { buildFunnelAiBlocks, funnelAiDraftSchema, type FunnelAiDraft } from "../../shared/funnelAi";
import type { getDb } from "../db";
type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export function funnel360InsertedId(result: unknown): number {
  const id = (result as Array<{ insertId?: unknown }>)?.[0]?.insertId;
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0)
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Draft creation incomplete. Nothing was saved." });
  return id;
}
function duplicateKey(error: unknown): boolean {
  const seen = new Set<unknown>();
  while (error && typeof error === "object" && !seen.has(error)) {
    seen.add(error);
    const value = error as { code?: string; errno?: number; cause?: unknown };
    if (value.code === "ER_DUP_ENTRY" || value.errno === 1062) return true;
    error = value.cause;
  }
  return false;
}
export async function createReviewedFunnelAiDraft(db: Db, orgId: number, actorId: number, requestId: string, rawDraft: FunnelAiDraft, baseUrl: string) {
  const draft = funnelAiDraftSchema.parse(rawDraft);
  const finalDestination = assertFunnel360Destination(draft.ctaUrl, baseUrl);
  const payloadHash = digest(JSON.stringify(draft));
  const token = digest(`${orgId}:${actorId}:${requestId}`).slice(0, 24);
  const slug = `ai-${token}`;
  const replay = async () => {
    const [existing] = await db.select().from(funnel360DraftRequests)
      .where(and(eq(funnel360DraftRequests.orgId, orgId), eq(funnel360DraftRequests.requestId, requestId))).limit(1);
    if (!existing) return null;
    if (existing.actorId !== actorId || existing.payloadHash !== payloadHash)
      throw new TRPCError({ code: "CONFLICT", message: "This request belongs to a different draft. Change content with a new request ID." });
    if (!existing.funnelId || !existing.pageIdsJson)
      throw new TRPCError({ code: "CONFLICT", message: "Draft creation is incomplete; contact support." });
    const [funnel] = await db.select().from(funnels).where(and(eq(funnels.id, existing.funnelId), eq(funnels.orgId, orgId))).limit(1);
    if (!funnel) throw new TRPCError({ code: "CONFLICT", message: "The draft was removed. Start a new draft instead of replaying this request." });
    const pageIds: number[] = JSON.parse(existing.pageIdsJson);
    if (pageIds.length !== draft.pages.length || pageIds.some(id => !Number.isSafeInteger(id) || id <= 0))
      throw new TRPCError({ code: "CONFLICT", message: "The previous draft is incomplete." });
    const pages = await db.select({ id: pageBuilderPages.id }).from(pageBuilderPages)
      .where(and(eq(pageBuilderPages.orgId, orgId), inArray(pageBuilderPages.id, pageIds)));
    if (pages.length !== pageIds.length)
      throw new TRPCError({ code: "CONFLICT", message: "The previously created pages changed. Open the draft instead of replaying creation." });
    return { id: funnel.id, slug: funnel.slug, pageIds };
  };
  const existing = await replay();
  if (existing) return existing;
  try {
    return await db.transaction(async tx => {
      // Durable request reservation and all content insertions share one transaction.
      await tx.insert(funnel360DraftRequests).values({ orgId, actorId, requestId, payloadHash });
      const id = funnel360InsertedId(await tx.insert(funnels).values({
        orgId, name: draft.name, description: draft.description, slug, isActive: false,
      }));
      const pageSlugs = draft.pages.map((_, i) => `${slug}-step-${i + 1}`);
      const pageIds: number[] = [];
      for (const [i, page] of draft.pages.entries()) {
        const destination = i < draft.pages.length - 1 ? `${baseUrl}/funnel/${slug}/${pageSlugs[i + 1]}` : finalDestination;
        const pageId = funnel360InsertedId(await tx.insert(pageBuilderPages).values({
          orgId, title: page.title, slug: pageSlugs[i],
          pageType: "custom", // Copy-only checkout never starts a transaction.
          blocksJson: JSON.stringify(buildFunnelAiBlocks(page, `ai_${token}_${i + 1}`, destination)),
          metaTitle: page.seoTitle, metaDescription: page.seoDescription, isPublished: false,
        }));
        pageIds.push(pageId);
        await tx.insert(funnel360PageLearnSettings).values({ orgId, pageId, seoKeywords: page.seoKeywords });
        const stepType = page.pageType === "checkout" ? "order" : page.pageType;
        funnel360InsertedId(await tx.insert(funnelSteps).values({
          funnelId: id, pageId, name: page.title, slug: pageSlugs[i], stepType, sortOrder: i,
        }));
      }
      await tx.update(funnel360DraftRequests).set({ funnelId: id, pageIdsJson: JSON.stringify(pageIds) })
        .where(and(eq(funnel360DraftRequests.orgId, orgId), eq(funnel360DraftRequests.requestId, requestId)));
      return { id, slug, pageIds };
    });
  } catch (error) {
    if (duplicateKey(error)) { const winner = await replay(); if (winner) return winner; }
    throw error;
  }
}
