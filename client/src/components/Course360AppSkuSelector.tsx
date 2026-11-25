import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { course360AppPurchasePrice, course360AppPurchaseLoginPath, readCourse360AppPurchaseIntent, type Course360PurchaseApp, type Course360PurchaseTier } from "@shared/course360AppPurchaseIntent";
import { formatCourse360Dollars } from "@shared/course360PriceDisplay";
import { Course360AppBillingRecovery } from "./Course360AppBillingRecovery";

/** Additional SKU panel; existing marketing cards/copy/amounts remain untouched. */
export function Course360AppSkuSelector({ app }: { app: Course360PurchaseApp }) {
  const { user } = useAuth();
  const [initial] = useState(() => readCourse360AppPurchaseIntent(app, window.location.search));
  const [tier, setTier] = useState<Course360PurchaseTier>(initial?.tier ?? "desktop");
  const [interval, setInterval] = useState<"monthly" | "annual">(initial?.interval ?? "monthly");
  const [busy, setBusy] = useState(false);
  const studio = trpc.billing.createStudioSingleCheckout.useMutation();
  const creator = trpc.billing.createCreatorSingleCheckout.useMutation();
  const quiz = trpc.billing.createQuizCreatorCheckout.useMutation();
  const intent = { app, tier, interval };
  async function purchase() {
    if (!user) { window.location.assign(course360AppPurchaseLoginPath(intent)); return; }
    setBusy(true);
    try {
      const input = { accessTier: tier, interval, origin: window.location.origin };
      const result = app === "studio" ? await studio.mutateAsync(input) : app === "creator" ? await creator.mutateAsync(input) : await quiz.mutateAsync(input);
      if (!result.checkoutUrl) throw new Error("Secure app checkout did not return a URL.");
      window.location.assign(result.checkoutUrl);
    } catch (error) { toast.error(error instanceof Error ? error.message : "App checkout is unavailable."); }
    finally { setBusy(false); }
  }
  return <section className="rounded-2xl border border-teal-400/30 bg-white/5 p-6 space-y-4 text-white" aria-label="Choose app access">
    <h3 className="text-lg font-semibold">Choose Web, Desktop, or Web + Desktop</h3>
    <div className="flex flex-wrap gap-4 items-end">
      <label className="space-y-1">App access
        <select className="block rounded-lg bg-slate-900 border border-white/30 p-2 text-white" value={tier} onChange={event => setTier(event.target.value as Course360PurchaseTier)}>
          <option value="web">Web</option><option value="desktop">Desktop</option><option value="bundle">Bundle — Web + Desktop</option>
        </select>
      </label>
      <label className="space-y-1">Billing interval
        <select className="block rounded-lg bg-slate-900 border border-white/30 p-2 text-white" value={interval} onChange={event => setInterval(event.target.value as "monthly" | "annual")}>
          <option value="monthly">Monthly</option><option value="annual">Annual</option>
        </select>
      </label>
      <p className="font-semibold py-2">{formatCourse360Dollars(course360AppPurchasePrice(intent))}/{interval === "monthly" ? "month" : "year"}</p>
      <Button className="bg-teal-700 hover:bg-teal-800 text-white" disabled={busy} onClick={purchase}>{busy ? "Opening checkout…" : user ? "Continue with selected app access" : "Sign in to continue with selected app access"}</Button>
    </div>
    {initial && <p role="status" className="text-sm text-teal-200">Your selected app access and billing interval have been restored. Review them before continuing.</p>}
    <Course360AppBillingRecovery app={app} />
  </section>;
}
