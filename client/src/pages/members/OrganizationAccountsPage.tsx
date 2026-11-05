import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, Building2, CheckCircle2, Clock, RefreshCw, Search, ShieldCheck } from "lucide-react";
import type { OrgAccountSummary } from "../../../../../shared/orgAccountStatus";

type StatusFilter = "all" | "trialing" | "active" | "attention" | "other";
function dateTime(value: number | null) {
  return value == null ? "Not recorded" : new Date(value).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
function TrialDetails({ account }: { account: OrgAccountSummary }) {
  const inTrial = account.status === "trialing" || account.status === "trial_ended";
  if (!inTrial) return <span className="text-xs text-muted-foreground">{account.trialEndsAt ? `Previous trial ended ${dateTime(account.trialEndsAt)}` : "No trial recorded"}</span>;
  return <div className="space-y-1.5 min-w-[220px]">
    <p className="text-sm font-medium">{account.status === "trial_ended" ? "Trial ended" : account.trialDay != null ? `Day ${account.trialDay} of ${account.trialLengthDays}` : "Trial dates incomplete"}
      {account.status === "trialing" && account.hoursRemaining != null && <span className="text-muted-foreground font-normal"> · {account.hoursRemaining <= 24 ? `${account.hoursRemaining}h` : `${account.daysRemaining} days`} left</span>}
    </p>
    {account.trialProgressPercent != null && <Progress value={account.trialProgressPercent} className="h-1.5" aria-label="Trial time elapsed" />}
    <p className="text-xs text-muted-foreground">Started: {dateTime(account.trialStartedAt)}</p>
    <p className="text-xs text-muted-foreground">Ends: {dateTime(account.trialEndsAt)}</p>
    {account.trialDateSource === "recorded_billing_period" && <p className="text-xs text-amber-700">Older record: based on its saved billing period.</p>}
  </div>;
}
function AccountStatus({ account }: { account: OrgAccountSummary }) {
  const danger = ["past_due", "unpaid", "trial_ended", "suspended"].includes(account.status);
  return <div className="space-y-1.5">
    <Badge variant="outline" className={danger ? "border-amber-400/50 bg-amber-500/10 text-amber-700" : account.status === "trialing" || account.status === "active" ? "border-primary/30 bg-primary/10 text-primary" : "text-muted-foreground"}>{account.statusLabel}</Badge>
    {account.cancelAtPeriodEnd && <p className="text-xs text-amber-700">Cancellation scheduled · will not auto-renew</p>}
  </div>;
}

export default function OrganizationAccountsPage() {
  const { user, loading } = useAuth();
  const allowed = user?.role === "site_owner" || user?.role === "site_admin";
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const query = trpc.orgAccounts.list.useQuery({ search, status, page, pageSize: 25 }, { enabled: allowed, staleTime: 30_000, refetchInterval: 60_000 });
  const report = query.data;
  if (loading) return <div className="p-6"><Skeleton className="h-24 w-full" /></div>;
  if (!allowed) return <div className="p-6"><h1 className="text-xl font-semibold">Platform administrator access required</h1><p className="text-muted-foreground mt-2">Organization account and trial reporting is available only to Course360 platform admins.</p></div>;
  return <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><Link href="/members/users" className="text-sm text-primary hover:underline">Members</Link><h1 className="text-2xl font-bold mt-1">Organization Accounts</h1><p className="text-sm text-muted-foreground mt-1">Track school-owner accounts, subscription status, and progress through their free trial.</p></div>
      <Button variant="outline" size="sm" disabled={query.isFetching} onClick={() => query.refetch()} className="gap-2"><RefreshCw className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />Refresh</Button>
    </div>
    <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm"><ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" /><p><strong>Platform oversight:</strong> this view includes all organization accounts, independent of the selected school. School student lists remain separate and organization-scoped.</p></div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[
        { label: "In free trial", value: report?.summary.trialing, icon: Clock, filter: "trialing" as const, note: "Currently within trial" },
        { label: "Ending within 3 days", value: report?.summary.endingSoon, icon: AlertCircle, filter: "trialing" as const, note: "Trials nearest renewal appear first" },
        { label: "Active accounts", value: report?.summary.active, icon: CheckCircle2, filter: "active" as const, note: `${report?.summary.activeSubscriptions ?? 0} Stripe subscriptions; other access labeled separately` },
        { label: "Needs attention", value: report?.summary.attention, icon: Building2, filter: "attention" as const, note: "Ended trials or payment issues" },
      ].map(({ label, value, icon: Icon, filter, note }) => <Card key={label}><CardContent className="p-4"><button className="text-left w-full rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => { setStatus(filter); setPage(1); }}><div className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="h-4 w-4 text-primary" />{label}</div><p className="text-2xl font-bold mt-2">{value ?? "—"}</p><p className="text-xs text-muted-foreground mt-1">{note}</p></button></CardContent></Card>)}
    </div>
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1 max-w-lg"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Search organization accounts" className="pl-9" placeholder="Search organization, owner, or email…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></div>
      <Select value={status} onValueChange={value => { setStatus(value as StatusFilter); setPage(1); }}><SelectTrigger className="w-full sm:w-56" aria-label="Account status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All organization accounts</SelectItem><SelectItem value="trialing">In free trial</SelectItem><SelectItem value="active">Active accounts</SelectItem><SelectItem value="attention">Needs attention</SelectItem><SelectItem value="other">Other account statuses</SelectItem></SelectContent></Select>
    </div>
    {query.error ? <div role="alert" className="rounded-lg border border-destructive/30 p-4 text-sm"><p className="font-medium">Unable to load organization accounts</p><p className="text-muted-foreground mt-1">{query.error.message}</p><Button variant="outline" size="sm" className="mt-3" onClick={() => query.refetch()}>Try again</Button></div> : <>
      <div className="rounded-lg border overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Organization / Owner</TableHead><TableHead>Plan</TableHead><TableHead>Account status</TableHead><TableHead>Trial progress</TableHead><TableHead>Next billing boundary</TableHead></TableRow></TableHeader><TableBody>
        {query.isLoading ? Array.from({ length: 4 }, (_, i) => <TableRow key={i}>{Array.from({ length: 5 }, (_, j) => <TableCell key={j}><Skeleton className="h-10 w-full" /></TableCell>)}</TableRow>) : !report?.accounts.length ? <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">{status === "trialing" ? "No organization accounts are currently recorded in a free trial." : "No organization accounts match these filters."}</TableCell></TableRow> : report.accounts.map(account => <TableRow key={account.orgId}>
          <TableCell><p className="font-medium">{account.orgName}</p><p className="text-xs text-muted-foreground">{account.orgSlug} · Org #{account.orgId}</p><p className="text-sm mt-2">{account.ownerName ?? "Owner name not recorded"}</p><p className="text-xs text-muted-foreground break-all">{account.ownerEmail ?? "Owner email not recorded"}</p></TableCell>
          <TableCell className="capitalize">{account.plan ?? "Not assigned"}</TableCell>
          <TableCell><AccountStatus account={account} /></TableCell>
          <TableCell><TrialDetails account={account} /></TableCell>
          <TableCell className="text-xs"><p>{account.status === "trialing" || account.status === "trial_ended" ? dateTime(account.trialEndsAt) : account.status === "active" ? dateTime(account.currentPeriodEnd) : "Not applicable"}</p><p className="text-muted-foreground mt-1">{account.cancelAtPeriodEnd ? "Scheduled cancellation; no automatic renewal" : account.status === "trialing" ? "Automatic billing after trial unless cancelled" : account.status === "active" ? "Recorded subscription period end" : ""}</p></TableCell>
        </TableRow>)}
      </TableBody></Table></div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><p className="text-muted-foreground">{report?.total ?? 0} accounts · Page {report?.page ?? 1} of {report?.pageCount ?? 1}</p><div className="flex gap-2"><Button size="sm" variant="outline" disabled={!report || report.page <= 1 || query.isFetching} onClick={() => setPage(Math.max(1, (report?.page ?? 1) - 1))}>Previous</Button><Button size="sm" variant="outline" disabled={!report || report.page >= report.pageCount || query.isFetching} onClick={() => setPage((report?.page ?? 1) + 1)}>Next</Button></div></div>
    </>}
    <p className="text-xs text-muted-foreground">Based on saved billing records{report ? ` · Report loaded ${dateTime(report.asOf)}` : ""}. An active subscription is not proof of a successful charge. Admin-assigned and legacy access are identified separately; missing trial dates are never guessed.</p>
  </div>;
}
