import type { Course360CrossToolOfferKey, Course360CrossToolInterval } from "../../shared/course360CrossToolOffers";

/** Public resource IDs independently created/retrieved on 2026-11-25 for the
 * bootstrap-verified Course360 Stripe account. These are NOT credentials.
 * No prices/products are created by startup, rendering, or this configuration.
 * Existing environment configuration is never rewritten. Development/test
 * requires explicit price IDs and cannot silently adopt the live catalog. */
export const COURSE360_CROSS_TOOL_VERIFIED_LIVE_PRICE_IDS = Object.freeze({
  builder_creator_web_monthly: "price_1Ufq1V1uhi9xlcrH8HUQDskZ",
  builder_creator_web_annual: "price_1Ufq1V1uhi9xlcrH1MySuQsP",
  pro_creator_web_monthly: "price_1Ufq1W1uhi9xlcrHqGPa6AnF",
  pro_creator_web_annual: "price_1Ufq1W1uhi9xlcrHWu0gk6fd",
});

export function course360CrossToolPriceId(
  env: NodeJS.ProcessEnv,
  offer: Course360CrossToolOfferKey,
  interval: Course360CrossToolInterval,
): string {
  const variable = `COURSE360_CROSS_TOOL_${offer.toUpperCase()}_${interval.toUpperCase()}_PRICE_ID`;
  // A provided blank/invalid override intentionally fails closed in the normal
  // live price validator; it never falls back to another account or catalog.
  if (env[variable] !== undefined) return env[variable]!.trim();
  if (env.NODE_ENV !== "production") return "";
  return COURSE360_CROSS_TOOL_VERIFIED_LIVE_PRICE_IDS[`${offer}_${interval}`];
}
