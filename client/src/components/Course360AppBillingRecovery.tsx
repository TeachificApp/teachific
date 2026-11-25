import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Course360PurchaseApp } from "@shared/course360AppPurchaseIntent";

export function Course360AppBillingRecovery({ app }: { app: Course360PurchaseApp }) {
  const { user } = useAuth();
  const [selection, setSelection] = useState("");
  const recovery = trpc.billing.getAppBillingRecovery.useQuery({ product: app }, { enabled: !!user, retry: false });
  const portal = trpc.billing.createAppPortalSession.useMutation({ onSuccess: data => window.location.assign(data.url), onError: error => toast.error(error.message) });
  if (!user) return null;
  const rows = recovery.data?.subscriptions ?? [];
  const selected = rows.length === 1 ? rows[0].subscriptionId : selection;
  return <div className="space-y-2 text-sm" aria-label="App billing recovery">
    {recovery.error && <p role="status">App billing recovery unavailable: {recovery.error.message}</p>}
    {rows.length > 1 && <label className="block">App subscription
      <select className="block rounded border bg-background text-foreground p-2 mt-1" value={selection} onChange={event => setSelection(event.target.value)}>
        <option value="">Choose a subscription</option>
        {rows.map(row => <option key={row.subscriptionId} value={row.subscriptionId}>{row.tier} · {row.status} · {row.subscriptionId}</option>)}
      </select>
    </label>}
    {rows.length > 0 && <Button variant="outline" disabled={!selected || portal.isPending} onClick={() => portal.mutate({ product: app, subscriptionId: selected, returnUrl: window.location.origin })}>
      {portal.isPending ? "Opening billing…" : "Manage this app’s billing"}
    </Button>}
    <a href="/lms" className="inline-block underline underline-offset-2">Select your school</a>
  </div>;
}
