import { useId, useRef, useState, type FormEvent } from "react";
import { trpc } from "@/lib/trpc";
import { COURSE360_CROSS_TOOL_OFFERS } from "@shared/course360CrossToolOffers";
import { formatCourse360Dollars } from "@shared/course360PriceDisplay";
import { formatCourse360BrandName } from "@shared/course360DisplayBrand";
import { Course360CrossToolOffers, type Course360CrossToolSelection } from "./Course360CrossToolOffers";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Checkout delivery is navigation, never evidence of payment or permission. */
export function isCourse360StripeCheckoutUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.trim() !== value || /[\u0000-\u0020\\]/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "checkout.stripe.com" &&
      !url.username && !url.password && (!url.port || url.port === "443");
  } catch {
    return false;
  }
}

export type Course360CrossToolCheckoutProps = {
  /** Testable delivery boundary; production uses the browser's full-page navigation. */
  navigateToCheckout?: (url: string) => void;
};

export function Course360CrossToolCheckout({ navigateToCheckout = url => window.location.assign(url) }: Course360CrossToolCheckoutProps = {}) {
  const catalog = trpc.billing.getCrossToolOffers.useQuery(undefined, {
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 60_000,
  });
  const checkout = trpc.billing.createCrossToolCheckout.useMutation();
  const [selection, setSelection] = useState<Course360CrossToolSelection | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submissionLock = useRef(false);
  const opener = useRef<HTMLElement | null>(null);
  const identityId = useId();
  const authoritativeReady = (data: typeof catalog.data) => data?.ready === true &&
    data.catalogReady === true && data.provisioningReady === true;
  const ready = authoritativeReady(catalog.data) && !catalog.isLoading && !catalog.isFetching && !catalog.error;
  // Event handlers must use the latest result, including readiness lost while the dialog is open.
  const latestReady = useRef(ready);
  latestReady.current = ready;
  const latestAuthority = useRef(false);
  latestAuthority.current = authoritativeReady(catalog.data) && !catalog.error && !catalog.isLoading;
  const catalogStatus = catalog.isLoading || (catalog.isFetching && !catalog.data) ? "loading" :
    catalog.error || (!ready && !catalog.isFetching) ? "error" : "ready";
  const catalogMessage = catalog.error ? "Unable to check package availability. Please retry; no checkout has been started." :
    catalog.data?.reason || "Package checkout is not ready. Please retry package availability.";
  const readiness = {
    builder_creator_web: { monthly: ready, annual: ready },
    pro_creator_web: { monthly: ready, annual: ready },
  };
  const retryCatalog = () => { void catalog.refetch(); };
  const choosePackage = async (chosen: Course360CrossToolSelection) => {
    if (!latestReady.current || submissionLock.current) return;
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelection({ ...chosen });
    setName(""); setEmail(""); setTermsAccepted(false); setError(null);
  };
  const closeDialog = () => {
    if (submissionLock.current) return;
    setSelection(null); setTermsAccepted(false); setError(null);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submissionLock.current || !selection || !latestReady.current) return;
    const trimmedName = name.trim(), trimmedEmail = email.trim();
    if (!trimmedName || trimmedName.length > 100 || trimmedEmail.length > 320 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail) || !termsAccepted) {
      setError("Enter your name and a valid email, then accept the selected trial and renewal terms.");
      return;
    }
    submissionLock.current = true;
    setPending(true); setError(null);
    let navigationStarted = false;
    try {
      // Even an apparently ready dialog must obtain a fresh server result before creating Checkout.
      // The mutation independently rechecks durable provisioning and the immutable price catalog.
      const fresh = await catalog.refetch();
      if (fresh.error || !authoritativeReady(fresh.data) || !latestAuthority.current) {
        throw new Error("Package availability changed. Retry package availability before continuing.");
      }
      const result = await checkout.mutateAsync({
        target: "new_school",
        offer: selection.offerKey,
        interval: selection.interval,
        name: trimmedName,
        email: trimmedEmail,
        origin: window.location.origin,
      });
      if (!isCourse360StripeCheckoutUrl(result.url)) {
        throw new Error("Secure checkout returned an unsafe destination. No navigation occurred. Please try again.");
      }
      navigateToCheckout(result.url);
      navigationStarted = true;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to open secure checkout. Please try again.");
    } finally {
      // Successful full-page delivery stays locked until this page unloads.
      if (!navigationStarted) {
        submissionLock.current = false;
        setPending(false);
      }
    }
  };
  const offer = selection ? COURSE360_CROSS_TOOL_OFFERS[selection.offerKey] : null;
  const annual = selection?.interval === "annual";
  const validIdentity = name.trim().length > 0 && name.trim().length <= 100 && email.trim().length <= 320 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const renewal = offer ? `${formatCourse360Dollars(offer[annual ? "annual" : "monthly"])} USD ${annual ? "each year, billed all at once (not monthly installments)" : "each month"}` : "";

  return <>
    <Course360CrossToolOffers readiness={readiness} catalogStatus={catalogStatus} catalogError={catalogMessage}
      onRetryCatalog={retryCatalog} onCheckout={choosePackage} />
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10 text-sm text-slate-700">
      <p>Already have a school? <a className="font-semibold c360-text underline focus-visible:outline focus-visible:outline-2 c360-focus-outline" href="/billing">Manage your existing school's billing</a> for a reviewed package change. Public package checkout creates a separate new school; it does not upgrade an existing school.</p>
    </div>
    <Dialog open={selection !== null} onOpenChange={open => { if (!open) closeDialog(); }}>
      <DialogContent className="bg-white text-slate-900 c360-aqua-border max-h-[90dvh] overflow-y-auto" showCloseButton={!pending}
        onOpenAutoFocus={event => { event.preventDefault(); document.getElementById(`${identityId}-name`)?.focus(); }}
        onCloseAutoFocus={event => { event.preventDefault(); opener.current?.focus(); }}
        onEscapeKeyDown={event => { if (submissionLock.current) event.preventDefault(); }}
        onInteractOutside={event => { if (submissionLock.current) event.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-900">Review your new-school package</DialogTitle>
          <DialogDescription className="text-slate-700">{offer ? formatCourse360BrandName(offer.name) : null} · {annual ? "Annual" : "Monthly"} billing</DialogDescription>
        </DialogHeader>
        <div className="rounded-xl border c360-aqua-border c360-soft p-4 text-sm text-slate-800 space-y-2">
          <p>This checkout creates a separate new school and its own subscription. It does not change or upgrade an existing school.</p>
          <p>Your normal {offer?.schoolPlan === "pro" ? "Pro" : "Builder"} school benefits remain included. This package adds Creator Web, not Creator Desktop or standalone Quiz Creator access.</p>
          <p>A card is required at Stripe Checkout for the 14-day trial. After the trial, your subscription automatically renews at <strong>{renewal}</strong> unless you cancel before renewal.</p>
          <p>No account or password is requested here. Complete secure checkout first; school and account setup follow verified checkout.</p>
        </div>
        <form onSubmit={event => void submit(event)} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor={`${identityId}-name`} className="text-sm font-semibold">Your name</label>
            <input id={`${identityId}-name`} name="name" autoComplete="name" required maxLength={100} disabled={pending}
              value={name} onChange={event => setName(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 focus-visible:outline focus-visible:outline-2 c360-focus-outline" />
          </div>
          <div className="space-y-1">
            <label htmlFor={`${identityId}-email`} className="text-sm font-semibold">Email address</label>
            <input id={`${identityId}-email`} name="email" type="email" autoComplete="email" required maxLength={320} disabled={pending}
              value={email} onChange={event => setEmail(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 focus-visible:outline focus-visible:outline-2 c360-focus-outline" />
          </div>
          <label className="flex items-start gap-3 text-sm leading-relaxed" htmlFor={`${identityId}-terms`}>
            <input id={`${identityId}-terms`} type="checkbox" required checked={termsAccepted} disabled={pending}
              onChange={event => setTermsAccepted(event.target.checked)} className="mt-1 c360-accent focus-visible:outline focus-visible:outline-2 c360-focus-outline" />
            <span>I agree to create a separate new school and accept the card-required 14-day trial with automatic renewal at {renewal}, unless cancelled before renewal.</span>
          </label>
          {!ready && <div role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            <p>{catalog.isFetching ? "Checking current package availability…" : "Package checkout is no longer confirmed ready. Recheck availability to continue."}</p>
            <button type="button" disabled={pending || catalog.isFetching} onClick={retryCatalog} className="mt-2 font-semibold underline">Retry package availability</button>
          </div>}
          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          {pending && <p role="status" className="text-sm c360-text">Checking availability and opening secure Stripe Checkout…</p>}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
            <button type="button" disabled={pending} onClick={closeDialog} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 c360-focus-outline disabled:opacity-60">Cancel / back to packages</button>
            <button type="submit" disabled={pending || !ready || !validIdentity || !termsAccepted}
              className="rounded-lg c360-action px-4 py-2 text-sm font-semibold text-white c360-hover-action disabled:bg-slate-200 disabled:text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 c360-focus-outline">
              {pending ? "Opening secure checkout…" : error ? "Retry secure checkout" : "Continue to secure Stripe Checkout"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}
