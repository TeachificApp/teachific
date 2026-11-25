/** Owner-approved USD catalog, November 25, 2026. Canonical amounts are dollars. */
export const COURSE360_PRICES = {
  starter: { name: "Course360 Starter", monthly: 39.97, annual: 399.97 },
  builder: { name: "Course360 Builder", monthly: 99.97, annual: 999.97 },
  pro: { name: "Course360 Pro", monthly: 199.97, annual: 1999.97 },
  studio_web: { name: "Course360 Studio™ Web", monthly: 39.97, annual: 299.97 },
  studio_desktop: { name: "Course360 Studio™ Desktop", monthly: 49.97, annual: 399.97 },
  studio_bundle: { name: "Course360 Studio™ Bundle", monthly: 69.97, annual: 599.97 },
  creator_web: { name: "Course360 Creator™ Web", monthly: 99.97, annual: 899.97 },
  creator_desktop: { name: "Course360 Creator™ Desktop", monthly: 119.97, annual: 999.97 },
  creator_bundle: { name: "Course360 Creator™ Bundle", monthly: 149.97, annual: 1299.97 },
  quiz_creator_web: { name: "Course360 Quiz Creator™ Web", monthly: 39.97, annual: 299.97 },
  quiz_creator_desktop: { name: "Course360 Quiz Creator™ Desktop", monthly: 49.97, annual: 399.97 },
  quiz_creator_bundle: { name: "Course360 Quiz Creator™ Bundle", monthly: 69.97, annual: 599.97 },
} as const;

export type Course360PriceKey = keyof typeof COURSE360_PRICES;

/** Stripe and retained minor-unit API compatibility boundary; never use for stored product prices. */
export function course360StripeCents(dollars: number): number {
  if (!Number.isFinite(dollars) || dollars < 0 || dollars.toFixed(2) !== String(dollars)) {
    // String removes trailing zeros; accepting fewer than two decimals is intentional.
    if (!Number.isFinite(dollars) || dollars < 0 || Number(dollars.toFixed(2)) !== dollars)
      throw new Error("USD amount must be finite, nonnegative, and have at most two decimal places");
  }
  const cents = Math.round(dollars * 100);
  if (!Number.isSafeInteger(cents)) throw new Error("USD amount exceeds supported Stripe range");
  return cents;
}

export function course360AnnualSavings(key: Course360PriceKey) {
  const price = COURSE360_PRICES[key];
  const monthlyYearCents = course360StripeCents(price.monthly) * 12;
  const annualCents = course360StripeCents(price.annual);
  return {
    amount: (monthlyYearCents - annualCents) / 100,
    percent: ((monthlyYearCents - annualCents) / monthlyYearCents) * 100,
    effectiveMonthly: price.annual / 12,
  };
}
