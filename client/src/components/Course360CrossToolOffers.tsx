import { useRef, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { COURSE360_CROSS_TOOL_OFFERS } from "@shared/course360CrossToolOffers";
import { formatCourse360Dollars } from "@shared/course360PriceDisplay";

export type Course360CrossToolOfferKey = keyof typeof COURSE360_CROSS_TOOL_OFFERS;
export type Course360CrossToolSelection = {
  offerKey: Course360CrossToolOfferKey;
  interval: "monthly" | "annual";
};

/** Parent adapter must derive readiness from billing.getCrossToolOffers, never URL hints.
 * This view deliberately knows no backend checkout input or payment-success contract. */
export type Course360CrossToolOffersProps = {
  readiness?: Partial<Record<Course360CrossToolOfferKey, { monthly: boolean; annual: boolean }>>;
  catalogStatus?: "loading" | "ready" | "error";
  catalogError?: string;
  onRetryCatalog?: () => void;
  onCheckout?: (selection: Course360CrossToolSelection) => Promise<void>;
};

export function Course360CrossToolOffers({ readiness, catalogStatus = "loading", catalogError, onRetryCatalog, onCheckout }: Course360CrossToolOffersProps) {
  const [interval, setInterval] = useState<Course360CrossToolSelection["interval"]>("monthly");
  const [pendingOffer, setPendingOffer] = useState<Course360CrossToolOfferKey | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const checkoutLock = useRef(false);
  const ready = (key: Course360CrossToolOfferKey) => catalogStatus === "ready" && readiness?.[key]?.[interval] === true && !!onCheckout;

  const startCheckout = async (offerKey: Course360CrossToolOfferKey) => {
    if (!ready(offerKey) || checkoutLock.current || !onCheckout) return;
    checkoutLock.current = true;
    setCheckoutError(null);
    setPendingOffer(offerKey);
    try {
      await onCheckout({ offerKey, interval });
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Unable to open secure checkout. Please try again.");
    } finally {
      checkoutLock.current = false;
      setPendingOffer(null);
    }
  };

  return (
    <section id="school-creator-packages" aria-labelledby="cross-tool-heading" className="scroll-mt-20 py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-10">
          <p className="text-sm font-bold uppercase tracking-widest c360-text mb-4">One family · Two connected workflows</p>
          <h2 id="cross-tool-heading" className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 mb-5">Run Your School + Create Content</h2>
          <p className="text-lg text-slate-600 leading-relaxed">Pair your LMS Learning Delivery Platform with Creator Web interactive authoring.
            Choose the school plan that fits your organization, with a separate creation workspace for your learning content.</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div role="group" aria-label="Package billing interval" className="inline-flex self-start gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
            {(["monthly", "annual"] as const).map(value => <button key={value} type="button" disabled={pendingOffer !== null} aria-pressed={interval === value} onClick={() => { setInterval(value); setCheckoutError(null); }} className={`rounded-lg px-5 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 c360-focus-outline disabled:opacity-60 ${interval === value ? "c360-action text-white" : "text-slate-700 hover:bg-white"}`}>{value === "monthly" ? "Monthly" : "Annual"}</button>)}
          </div>
          <p className="text-sm text-slate-600">USD · {interval === "annual" ? "Full yearly amount billed upfront, not monthly installments." : "Monthly subscription billing."}</p>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {(Object.keys(COURSE360_CROSS_TOOL_OFFERS) as Course360CrossToolOfferKey[]).map(offerKey => {
            const offer = COURSE360_CROSS_TOOL_OFFERS[offerKey];
            const available = ready(offerKey);
            const isPending = pendingOffer === offerKey;
            return <article key={offerKey} aria-labelledby={`${offerKey}-heading`} className={`rounded-2xl border p-7 sm:p-9 ${offer.schoolPlan === "pro" ? "c360-border c360-soft-subtle" : "border-slate-200 bg-slate-50"}`}>
              <p className="text-sm font-semibold c360-text mb-3">School delivery + interactive authoring</p>
              <h3 id={`${offerKey}-heading`} className="text-2xl font-bold text-slate-900 mb-5">{offer.name}</h3>
              <p className="text-4xl font-extrabold tracking-tight text-slate-900">{formatCourse360Dollars(offer[interval])}<span className="text-sm font-normal tracking-normal text-slate-600"> / {interval === "annual" ? "year" : "month"}</span></p>
              <p className="text-sm text-slate-600 mt-3 mb-6">{interval === "annual" ? `${formatCourse360Dollars(offer.annual)} charged at once each year; not billed monthly.` : `${formatCourse360Dollars(offer.monthly)} billed each month.`}</p>
              <ul className="space-y-3 text-sm text-slate-700 mb-7">
                {[
                  `${offer.schoolPlan === "pro" ? "Pro" : "Builder"} LMS school plan with its existing features and limits`,
                  "Creator Web interactive course authoring",
                  "Organization-owned catalog, enrollments, and learning reports",
                  offer.schoolPlan === "pro" ? "Pro-only white-label branding" : "Custom domain; white-label branding requires Pro",
                ].map(feature => <li key={feature} className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 c360-text" aria-hidden="true" />{feature}</li>)}
              </ul>
              <button type="button" aria-label={`Continue with ${offer.name}`} disabled={!available || pendingOffer !== null} onClick={() => void startCheckout(offerKey)} aria-describedby={`${offerKey}-availability`} className="inline-flex w-full items-center justify-center gap-2 rounded-xl c360-action px-5 py-3 text-sm font-bold text-white c360-hover-action disabled:bg-slate-200 disabled:text-slate-600 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 c360-focus-outline">
                {isPending ? <><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Opening secure checkout…</> : <>Continue with {offer.name}<ArrowRight className="h-4 w-4" aria-hidden="true" /></>}
              </button>
              <p id={`${offerKey}-availability`} className="text-sm text-slate-600 mt-3">{isPending ? "Please wait while secure checkout opens." : available ? "Review the selected package and billing schedule in secure checkout." : "Checkout unavailable until this package and billing interval are confirmed ready."}</p>
            </article>;
          })}
        </div>
        {catalogStatus === "loading" && <p role="status" className="text-sm text-slate-600 mt-5">Package checkout availability has not yet been confirmed.</p>}
        {catalogStatus === "error" && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p>{catalogError || "Unable to check package availability. No checkout has been started."}</p>{onRetryCatalog && <button type="button" className="mt-2 underline font-semibold" onClick={onRetryCatalog}>Retry package availability</button>}</div>}
        {pendingOffer && <p role="status" className="text-sm c360-text mt-5">Opening secure checkout for {COURSE360_CROSS_TOOL_OFFERS[pendingOffer].name}…</p>}
        {checkoutError && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{checkoutError}</p>}
        <p className="text-sm text-slate-600 mt-7 leading-relaxed max-w-4xl">These packages include Creator Web, not Creator Desktop or automatic access to every standalone tool.
          Existing Builder and Pro school-plan benefits, including Studio Web, remain included. Standalone Studio and Quiz Creator plans remain available separately. Your main school library stays organization-owned.
          A card is required at checkout for the 14-day trial; the selected subscription renews afterward unless cancelled before renewal.
          Annual renewals charge the full annual amount at once.</p>
      </div>
    </section>
  );
}
