import type Stripe from "stripe";
import {
  COURSE360_CROSS_TOOL_OFFERS,
  type Course360CrossToolOfferKey,
  type Course360CrossToolInterval,
} from "../../shared/course360CrossToolOffers";
import { course360StripeCents } from "../../shared/course360Pricing";
import { getStripe, getPlatformPaymentReadiness } from "../stripePlans";
import { course360PaymentLedgerReady } from "./course360PaymentLedger";
import { getCourse360PaymentBootstrapStatus } from "./course360PaymentBootstrap";
import { course360CrossToolPriceId } from "./course360CrossToolVerifiedCatalog";
import { isCourse360CrossToolOnboardingConfigured } from "./course360CrossToolOnboardingReadiness";

export const COURSE360_CROSS_TOOL_FAMILY = "course360_cross_tool_v1";
export function crossToolPriceIds(env: NodeJS.ProcessEnv = process.env) {
  return Object.fromEntries(
    Object.keys(COURSE360_CROSS_TOOL_OFFERS).flatMap(key =>
      ["monthly", "annual"].map(interval => [
        `${key}_${interval}`,
        course360CrossToolPriceId(env, key as Course360CrossToolOfferKey, interval as Course360CrossToolInterval),
      ])
    )
  ) as Record<string, string>;
}
export function assertCourse360CrossToolPrice(
  price: Stripe.Price,
  offer: Course360CrossToolOfferKey,
  interval: Course360CrossToolInterval,
  expectedId: string,
  livemode: boolean
) {
  const spec = COURSE360_CROSS_TOOL_OFFERS[offer];
  if (
    !spec ||
    !/^price_[A-Za-z0-9_]+$/.test(expectedId) ||
    price.id !== expectedId ||
    price.livemode !== livemode ||
    !price.active ||
    price.type !== "recurring" ||
    price.currency !== "usd" ||
    price.unit_amount !== course360StripeCents(spec[interval]) ||
    (price.unit_amount_decimal != null &&
      Number(price.unit_amount_decimal) !==
        course360StripeCents(spec[interval])) ||
    price.recurring?.interval !== (interval === "annual" ? "year" : "month") ||
    price.recurring.interval_count !== 1 ||
    price.recurring.usage_type !== "licensed" ||
    price.billing_scheme !== "per_unit" ||
    price.transform_quantity ||
    price.metadata?.course360_family !== COURSE360_CROSS_TOOL_FAMILY ||
    price.metadata?.cross_tool_offer !== offer ||
    price.metadata?.school_plan !== spec.schoolPlan ||
    price.metadata?.creator_mode !== "web"
  )
    throw new Error(
      "Cross-tool price does not match the approved immutable catalog"
    );
}
let cache:
  | { fingerprint: string; until: number; ids: Record<string, string> }
  | undefined;
/** Read-only checks, never create products/prices or advertise unverified Checkout availability. */
export async function getCourse360CrossToolCatalog() {
  const provisioningReady =
    course360PaymentLedgerReady() &&
    getCourse360PaymentBootstrapStatus().state === "ready" &&
    getPlatformPaymentReadiness().ready;
  const base = { offers: COURSE360_CROSS_TOOL_OFFERS, provisioningReady };
  if (!provisioningReady)
    return {
      ...base,
      ready: false,
      catalogReady: false,
      reason: "Durable payment provisioning is not ready.",
    };
  if (!isCourse360CrossToolOnboardingConfigured())
    return {
      ...base,
      ready: false,
      catalogReady: false,
      reason: "Package account setup email is not configured.",
    };
  const ids = crossToolPriceIds();
  const fingerprint = JSON.stringify(ids);
  if (
    Object.values(ids).some(id => !/^price_[A-Za-z0-9_]+$/.test(id)) ||
    new Set(Object.values(ids)).size !== 4
  )
    return {
      ...base,
      ready: false,
      catalogReady: false,
      reason: "Cross-tool Stripe catalog is not configured.",
    };
  if (cache?.fingerprint === fingerprint && cache.until > Date.now())
    return { ...base, ready: true, catalogReady: true, reason: null };
  try {
    const stripe = getStripe();
    for (const offer of Object.keys(
      COURSE360_CROSS_TOOL_OFFERS
    ) as Course360CrossToolOfferKey[])
      for (const interval of ["monthly", "annual"] as const) {
        const id = ids[`${offer}_${interval}`];
        const price = await stripe.prices.retrieve(
          id,
          {},
          { timeout: 12000, maxNetworkRetries: 0 }
        );
        assertCourse360CrossToolPrice(price, offer, interval, id, true);
        const product =
          typeof price.product === "string"
            ? await stripe.products.retrieve(
                price.product,
                {},
                { timeout: 12000, maxNetworkRetries: 0 }
              )
            : price.product;
        if (!product || "deleted" in product || !product.active)
          throw new Error("Cross-tool product is unavailable");
      }
    cache = { fingerprint, until: Date.now() + 60000, ids };
    return { ...base, ready: true, catalogReady: true, reason: null };
  } catch {
    cache = undefined;
    return {
      ...base,
      ready: false,
      catalogReady: false,
      reason:
        "Cross-tool Stripe catalog verification is unavailable or failed.",
    };
  }
}
export function course360CrossToolConfiguredPrice(
  offer: Course360CrossToolOfferKey,
  interval: Course360CrossToolInterval
) {
  return crossToolPriceIds()[`${offer}_${interval}`];
}
