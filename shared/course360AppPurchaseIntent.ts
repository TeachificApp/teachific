import { COURSE360_PRICES } from "./course360Pricing";
export type Course360PurchaseApp = "studio" | "creator" | "quiz_creator";
export type Course360PurchaseTier = "web" | "desktop" | "bundle";
export type Course360PurchaseIntent = { app: Course360PurchaseApp; tier: Course360PurchaseTier; interval: "monthly" | "annual" };
export function course360AppPurchasePrice(intent: Course360PurchaseIntent) {
  return COURSE360_PRICES[`${intent.app}_${intent.tier}`][intent.interval];
}
export function course360AppPurchasePath(intent: Course360PurchaseIntent) {
  const page = intent.app === "quiz_creator" ? "quiz-creator" : intent.app;
  return `/${page}-pro?${new URLSearchParams({ purchaseApp: intent.app, accessTier: intent.tier, interval: intent.interval })}`;
}
export function course360AppPurchaseLoginPath(intent: Course360PurchaseIntent) {
  return `/login?returnPath=${encodeURIComponent(course360AppPurchasePath(intent))}`;
}
export function readCourse360AppPurchaseIntent(app: Course360PurchaseApp, search: string): Course360PurchaseIntent | null {
  const params = new URLSearchParams(search);
  const tier = params.get("accessTier"), interval = params.get("interval");
  if (params.get("purchaseApp") !== app || !["web", "desktop", "bundle"].includes(tier ?? "") || !["monthly", "annual"].includes(interval ?? "")) return null;
  return { app, tier: tier as Course360PurchaseTier, interval: interval as "monthly" | "annual" };
}
