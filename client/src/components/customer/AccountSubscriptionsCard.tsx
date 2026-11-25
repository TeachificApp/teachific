import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, Loader2 } from "lucide-react";
import { formatStoredDollars } from "@shared/customerSubscriptionBilling";
import { SubscriptionCancellationIndicator } from "./SubscriptionCancellationIndicator";

export function AccountSubscriptionsCard() {
  const query = trpc.adminUser.mySubscriptions.useQuery(undefined, { retry: false, staleTime: 30_000 });
  const rows = query.data ? [
    ...query.data.memberships.map(row => ({ ...row, key: `membership-${row.id}` })),
    ...query.data.savedPlans.map(row => ({ ...row, key: `plan-${row.id}`, stripeSubscriptionId: null, subscriptionBilling: null })),
    ...query.data.content.map(row => ({ ...row, key: `course-${row.id}`, price: null, billingInterval: null })),
  ] : [];
  return <Card>
    <CardHeader><CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-4 w-4 text-teal-600" />My Subscriptions</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <p className="text-xs text-muted-foreground">Subscriptions and membership access for your selected school.</p>
      {query.isLoading && <p role="status" className="text-sm flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Loading subscriptions…</p>}
      {query.error && <div role="alert" className="text-sm text-amber-700"><p>{query.error.message}</p><Button variant="outline" size="sm" className="mt-2" onClick={() => query.refetch()}>Try again</Button></div>}
      {!query.isLoading && !query.error && rows.length === 0 && <p className="text-sm text-muted-foreground">No subscriptions for this school.</p>}
      {rows.map(row => <div key={row.key} className="rounded-lg border p-3 space-y-1">
        <p className="font-medium text-sm">{row.title}</p>
        <p className="text-xs text-muted-foreground">Access status: {row.status}{row.price != null ? ` · ${formatStoredDollars(row.price, query.data?.currency)} / ${row.billingInterval}` : ""}</p>
        {row.accessExpiresAt && <p className="text-xs text-muted-foreground">Access expiry: {new Date(row.accessExpiresAt).toLocaleDateString()}</p>}
        <SubscriptionCancellationIndicator subscriptionId={row.stripeSubscriptionId} snapshot={row.subscriptionBilling} accessExpiresAt={row.accessExpiresAt} />
        {!row.stripeSubscriptionId && <p className="text-xs text-muted-foreground">Saved access record; billing renewal is not verified. Contact your school for billing changes.</p>}
      </div>)}
      <p className="text-xs text-muted-foreground">For cancellation or billing changes, contact your school. This page does not cancel subscriptions or issue refunds.</p>
    </CardContent>
  </Card>;
}
