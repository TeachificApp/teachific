import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { digitalBundleItems, digitalBundles, digitalProductPrices, digitalProducts, funnelPages, funnels, funnelSteps, lmsCourses, orderBumps, pageBuilderPages } from "../../drizzle/schema";
import { dollarsToStripeCents } from "./checkoutPricing";
import { resolvePublicOrganizationScope } from "./publicOrgRequestScope";

export type EmbeddedTarget = { type: "course" | "quiz" | "download" | "bundle"; id: number; accessDays?: number | null; children?: EmbeddedTarget[] };
export type EmbeddedManifest = {
  version: 2; orgId: number; name: string; productType: EmbeddedTarget["type"]; productId: number;
  amount: string; currency: "usd"; targets: EmbeddedTarget[];
  bumps: Array<{ title: string; price: number; bumpId?: number; productId: number; productType: string }>;
  gateway: { accountId: string | null; livemode: boolean; keyFingerprint: string }; confirmationHash: string;
  buyerId: number | null;
  successUrl: string; workflow: string | null;
};
const bad = (message: string): never => { throw new TRPCError({ code: "BAD_REQUEST", message }); };
export function newEmbeddedProof() { const token = randomBytes(32).toString("hex"); return { token, hash: hashEmbedded(token) }; }
export function hashEmbedded(value: string) { return createHash("sha256").update(value).digest("hex"); }
export function validEmbeddedProof(token: string | undefined, hash: string) {
  if (!token || !/^[a-f0-9]{64}$/.test(hash)) return false;
  return timingSafeEqual(Buffer.from(hashEmbedded(token), "hex"), Buffer.from(hash, "hex"));
}
export function readEmbeddedManifest(raw: string | null): EmbeddedManifest {
  let value: EmbeddedManifest;
  try { value = JSON.parse(raw || "null"); } catch { return bad("Checkout snapshot is unavailable; manual reconciliation required"); }
  if (value?.version !== 2 || !Array.isArray(value.targets) || !value.targets.length || !value.gateway || !value.orgId) return bad("Legacy checkout requires manual reconciliation");
  return value;
}

/** Evaluate the upstream Eastern wall-time enrollment deadline without importing its branding/auth implementation. */
export function embeddedEnrollmentDeadlineOpen(deadline: Date | string | null | undefined, now = new Date()) {
  if (!deadline) return true;
  const date = deadline instanceof Date ? deadline : new Date(deadline);
  if (!Number.isFinite(date.getTime())) return false;
  // Course scheduling stores a timezone-less wall clock. Compare Eastern wall time, including DST.
  const fields = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(now).map(p => [p.type, p.value]));
  const wallNow = Date.UTC(Number(fields.year), Number(fields.month) - 1, Number(fields.day), Number(fields.hour), Number(fields.minute), Number(fields.second), now.getUTCMilliseconds());
  return wallNow < date.getTime();
}

async function catalog(db: any, orgId: number, type: string, id: number | undefined, priceId?: number): Promise<{ target: EmbeddedTarget; cents: number; name: string; workflow: string | null }> {
  if (!id || !Number.isSafeInteger(id)) return bad("A server catalog product is required");
  if (type === "course" || type === "quiz") {
    const [row] = await db.select().from(lmsCourses).where(and(eq(lmsCourses.id, id), eq(lmsCourses.orgId, orgId))).limit(1);
    if (!row || row.orgId !== orgId || !["public", "hidden"].includes(row.status) || row.enrollmentClosed || row.bundleOnly || !embeddedEnrollmentDeadlineOpen(row.enrollmentCloseDate)) return bad("Course is unavailable in this school");
    if (!["free", "one_time"].includes(row.pricingType)) return bad("Recurring and installment products require subscription checkout");
    if ((type === "quiz" && row.type !== "quiz") || (type === "course" && row.type !== "course")) return bad("Product type does not match the catalog");
    if ((row.currency ?? "usd").toLowerCase() !== "usd") return bad("This embedded checkout supports USD only");
    const actions: any[] = [];
    if (row.postPurchaseRedirectUrl) actions.push({ type: "redirect", url: row.postPurchaseRedirectUrl, delaySeconds: 3 });
    if (row.upsellEnabled && row.upsellCourseId) actions.push({ type: "order_bump", orderBumpId: row.upsellCourseId, headline: row.upsellHeadline ?? "" });
    return { target: { type, id, accessDays: row.accessDurationDays }, cents: row.isFree || row.pricingType === "free" ? 0 : dollarsToStripeCents(row.price), name: row.title, workflow: actions.length ? JSON.stringify(actions) : null };
  }
  if (type === "download") {
    const [row] = await db.select().from(digitalProducts).where(and(eq(digitalProducts.id, id), eq(digitalProducts.orgId, orgId))).limit(1);
    if (!row || row.orgId !== orgId || !["published", "hidden"].includes(row.visibility) || row.enrollmentClosed) return bad("Download is unavailable in this school");
    // The real schema stores price in digital_product_prices, not digital_products.
    const prices = await db.select().from(digitalProductPrices).where(and(eq(digitalProductPrices.productId, id), eq(digitalProductPrices.isActive, true)));
    const price = priceId ? prices.find((p: any) => p.id === priceId) : prices.length === 1 ? prices[0] : undefined;
    if (!price || price.productId !== id || !price.isActive || price.type !== "one_time") return bad("Select an active one-time download price");
    if ((price.currency ?? "USD").toLowerCase() !== "usd") return bad("This embedded checkout supports USD only");
    // digitalPurchases has no expiry/download-limit columns; do not sell terms it cannot enforce.
    if (row.defaultAccessDays != null || row.defaultMaxDownloads != null) return bad("Limited downloads require the native download checkout");
    return { target: { type: "download", id }, cents: dollarsToStripeCents(price.amount), name: row.title, workflow: row.afterPurchaseWorkflow ?? null };
  }
  if (type === "bundle") {
    const [row] = await db.select().from(digitalBundles).where(and(eq(digitalBundles.id, id), eq(digitalBundles.orgId, orgId))).limit(1);
    if (!row || row.orgId !== orgId || !["published", "hidden"].includes(row.status)) return bad("Bundle is unavailable in this school");
    if ((row.currency ?? "usd").toLowerCase() !== "usd") return bad("This embedded checkout supports USD only");
    const items = await db.select().from(digitalBundleItems).where(eq(digitalBundleItems.bundleId, id));
    if (!items.length) return bad("Bundle has no downloadable items");
    const children: EmbeddedTarget[] = [];
    for (const item of items) {
      const [product] = await db.select().from(digitalProducts).where(and(eq(digitalProducts.id, item.productId), eq(digitalProducts.orgId, orgId))).limit(1);
      if (!product || product.orgId !== orgId || !["published", "hidden"].includes(product.visibility) || product.enrollmentClosed || product.defaultAccessDays != null || product.defaultMaxDownloads != null) return bad("Bundle contains an unavailable school download");
      children.push({ type: "download", id: item.productId });
    }
    return { target: { type: "bundle", id, children }, cents: dollarsToStripeCents(Number(row.discountPrice) > 0 ? row.discountPrice : row.originalPrice), name: row.title, workflow: row.afterPurchaseWorkflow ?? null };
  }
  return bad("This product requires its native checkout; embedded fulfillment is not supported");
}

function parseBlocks(raw: unknown): any[] {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : Array.isArray(parsed?.blocks) ? parsed.blocks : [];
  } catch { return []; }
}

/** Caller prices/targets are hints only. Published school/page records own the selection. */
export async function resolveEmbeddedSelection(db: any, req: any, input: any) {
  const scope = await resolvePublicOrganizationScope(db, req, input.orgSlug);
  if (!scope || (input.orgId != null && input.orgId !== scope.id)) throw new TRPCError({ code: "FORBIDDEN", message: "Checkout is outside the active school" });
  const orgId = scope.id;
  let block: any;
  if (input.sourceFunnelPageId) {
    const [page] = await db.select().from(funnelPages).where(and(eq(funnelPages.id, input.sourceFunnelPageId), eq(funnelPages.orgId, orgId))).limit(1);
    if (!page || page.orgId !== orgId) return bad("Checkout page is unavailable in this school");
    if (input.sourceFunnelId) {
      const [funnel] = await db.select().from(funnels).where(and(eq(funnels.id, input.sourceFunnelId), eq(funnels.orgId, orgId), eq(funnels.isActive, true))).limit(1);
      const [step] = await db.select().from(funnelSteps).where(and(eq(funnelSteps.funnelId, input.sourceFunnelId), eq(funnelSteps.pageId, page.id))).limit(1);
      if (!funnel || funnel.orgId !== orgId || !funnel.isActive || !step) return bad("Funnel/page association requires schema reconciliation");
    }
    const blocks = parseBlocks(page.content);
    block = input.checkoutBlockId ? blocks.find(b => b.id === input.checkoutBlockId) : blocks.filter(b => ["embedded_checkout", "checkout_form"].includes(b.type)).length === 1 ? blocks.find(b => ["embedded_checkout", "checkout_form"].includes(b.type)) : undefined;
  } else if (input.sourceLandingPageId) {
    const [page] = await db.select().from(pageBuilderPages).where(and(eq(pageBuilderPages.id, input.sourceLandingPageId), eq(pageBuilderPages.orgId, orgId), eq(pageBuilderPages.isPublished, true))).limit(1);
    if (!page || page.orgId !== orgId || !page.isPublished) return bad("Checkout page is unavailable in this school");
    const blocks = parseBlocks(page.blocksJson);
    block = input.checkoutBlockId ? blocks.find(b => b.id === input.checkoutBlockId) : blocks.filter(b => ["embedded_checkout", "checkout_form"].includes(b.type)).length === 1 ? blocks.find(b => ["embedded_checkout", "checkout_form"].includes(b.type)) : undefined;
  }
  if ((input.sourceFunnelPageId || input.sourceLandingPageId) && (!block || !["embedded_checkout", "checkout_form"].includes(block.type))) return bad("Select a saved checkout block");
  if (input.sourceLmsLessonId) return bad("Lesson checkout source requires a school-bound saved block adapter");
  const config = block?.data;
  const selected = config ? config.products?.[input.selectedProductIndex ?? 0] : null;
  if (config && !selected) return bad("Invalid saved product selection");
  const type = selected?.type ?? input.productType;
  const savedId = selected?.productId ?? (type === "course" || type === "quiz" ? config?.lmsCourseId : undefined);
  if (config && !savedId) return bad("Saved checkout product requires a school catalog target");
  if (input.sourceFunnelId && !input.sourceFunnelPageId) return bad("Funnel attribution requires its saved checkout page");
  const id = config ? savedId : input.productId ?? input.lmsCourseId;
  const base = await catalog(db, orgId, type, id, selected?.priceId ?? input.priceId);
  // Client fulfillment aliases cannot substitute a different product.
  for (const hint of [input.fulfillmentCourseId, input.fulfillmentDownloadId, input.fulfillmentQuizId, input.fulfillmentBundleId, input.lmsCourseId, input.productId]) if (hint != null && hint !== id) return bad("Fulfillment target does not match the school product");
  if (input.fulfillmentMembershipId || input.fulfillmentBrand) return bad("Brand and recurring membership grants are not supported here");
  let cents = config ? dollarsToStripeCents(selected.price) : base.cents;
  if (input.productPrice != null && dollarsToStripeCents(input.productPrice) !== cents) return bad("Product price has changed; reload checkout");
  const targets = [base.target];
  const bumps: EmbeddedManifest["bumps"] = [];
  if (config) {
    const indexes: number[] = input.addedBumpIndexes ?? [];
    if (new Set(indexes).size !== indexes.length || input.selectedBumps?.length && input.selectedBumps.length !== indexes.length) return bad("Invalid order bump selection");
    for (const index of indexes) {
      const bump = config.orderBumps?.[index];
      if (!bump) return bad("Invalid saved order bump");
      const resolved = await catalog(db, orgId, bump.productType ?? bump.bumpType ?? bump.type, bump.productId, bump.priceId);
      const amount = dollarsToStripeCents(bump.price);
      cents += amount; targets.push(resolved.target);
      bumps.push({ title: bump.title ?? resolved.name, price: amount / 100, productId: resolved.target.id, productType: resolved.target.type });
    }
  } else {
    const seen = new Set<number>();
    for (const hint of input.selectedBumps ?? []) {
      if (!hint.bumpId || seen.has(hint.bumpId)) return bad("Select an approved school order bump");
      seen.add(hint.bumpId);
      const [bump] = await db.select().from(orderBumps).where(and(eq(orderBumps.id, hint.bumpId), eq(orderBumps.orgId, orgId), eq(orderBumps.isActive, true))).limit(1);
      if (!bump || bump.orgId !== orgId || !bump.isActive || bump.triggerProductType !== type || bump.triggerProductId !== id || bump.bumpMode !== "addon" || bump.pricingOptionId != null || bump.placement !== "during_checkout") return bad("Invalid school order bump");
      const resolved = await catalog(db, orgId, bump.bumpProductType, bump.bumpProductId);
      const amount = bump.discountedPrice != null ? dollarsToStripeCents(bump.discountedPrice) : Math.round(resolved.cents * (1 - (bump.discountPercent ?? 0) / 100));
      if (amount < 0 || (hint.price != null && dollarsToStripeCents(hint.price) !== amount) || (hint.productId != null && hint.productId !== bump.bumpProductId)) return bad("Order bump price or target mismatch");
      cents += amount; targets.push(resolved.target);
      bumps.push({ title: bump.name, price: amount / 100, bumpId: bump.id, productId: bump.bumpProductId, productType: bump.bumpProductType });
    }
    if (input.addedBumpIndexes?.length) return bad("Saved checkout page required for bump indexes");
  }
  const bonuses = config?.additionalAccess ?? [];
  for (const bonus of bonuses) {
    if (bonus.brand) return bad("Brand grants require a native membership checkout");
    targets.push((await catalog(db, orgId, bonus.type, bonus.productId ?? bonus.id, bonus.priceId)).target);
  }
  if (input.additionalAccess?.length && JSON.stringify(input.additionalAccess) !== JSON.stringify(bonuses)) return bad("Unapproved additional access");
  if (input.promoCode) return bad("Discount codes require the organization product checkout");
  return { orgId, name: base.name, productType: base.target.type, productId: base.target.id, cents, targets, bumps, workflow: base.workflow, redirect: config?.successRedirect ?? input.successRedirect };
}

export function embeddedSuccessUrl(origin: string, redirect?: string) {
  const base = new URL(origin);
  if (!["https:", "http:"].includes(base.protocol)) return bad("Invalid checkout origin");
  if (!redirect) return `${base.origin}/?checkout_success=1`;
  if (redirect === "__dashboard__") return `${base.origin}/dashboard?purchase=success`;
  if (redirect.startsWith("__funnel__:")) return new URL(`/${redirect.slice(11)}?success=1`, base).href;
  const result = new URL(redirect, base);
  if (!["https:", "http:"].includes(result.protocol)) return bad("Invalid checkout redirect");
  return result.href;
}
