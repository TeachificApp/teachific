import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useOrgScope } from "@/hooks/useOrgScope";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  Mail, Plus, MoreVertical, Edit, Trash2, Send, Copy,
  BarChart2, Users, Eye, MousePointerClick, AlertTriangle,
  CheckCircle2, XCircle, Clock, TrendingUp, ArrowLeft,
} from "lucide-react";

const STATUS_VARIANT: Record<string, any> = {
  draft: "outline",
  scheduled: "secondary",
  sending: "default",
  sent: "default",
  failed: "destructive",
};

const STATUS_COLORS: Record<string, string> = {
  sent: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  bounced: "bg-orange-100 text-orange-700",
  opened: "bg-blue-100 text-blue-700",
  clicked: "bg-purple-100 text-purple-700",
};

// ── Analytics Modal ────────────────────────────────────────────────────────────

function CampaignAnalyticsModal({
  campaignId,
  onClose,
}: {
  campaignId: number;
  onClose: () => void;
}) {
  const [recipientSearch, setRecipientSearch] = useState("");

  const { data, isLoading } = trpc.lms.emailMarketing.analytics.useQuery(
    { id: campaignId },
    { enabled: !!campaignId },
  );

  const filteredRecipients = useMemo(() => {
    if (!data?.recipients) return [];
    const q = recipientSearch.toLowerCase();
    if (!q) return data.recipients;
    return data.recipients.filter(
      (r: any) => r.email?.toLowerCase().includes(q),
    );
  }, [data?.recipients, recipientSearch]);

  const s = data?.summary;

  const funnelBars = s
    ? [
        { label: "Delivered", value: s.totalSent, color: "bg-blue-500", pct: 100 },
        { label: "Opened", value: s.totalOpened, color: "bg-green-500", pct: s.totalSent > 0 ? (s.totalOpened / s.totalSent) * 100 : 0 },
        { label: "Clicked", value: s.totalClicked, color: "bg-purple-500", pct: s.totalSent > 0 ? (s.totalClicked / s.totalSent) * 100 : 0 },
        { label: "Failed", value: s.totalFailed, color: "bg-red-400", pct: s.totalSent > 0 ? (s.totalFailed / s.totalSent) * 100 : 0 },
      ]
    : [];

  function recipientStatusLabel(r: any) {
    if (r.clickedAt) return "clicked";
    if (r.openedAt) return "opened";
    return r.status ?? "sent";
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <DialogTitle className="text-lg">
                {data?.campaign?.name ?? "Campaign Analytics"}
              </DialogTitle>
              {data?.campaign?.subject && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Subject: {data.campaign.subject}
                </p>
              )}
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : !data ? (
          <p className="py-8 text-center text-muted-foreground">No analytics data available.</p>
        ) : (
          <div className="space-y-6 py-2">
            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: "Recipients", value: s!.totalRecipients, icon: Users, color: "text-blue-600" },
                { label: "Delivered", value: s!.totalSent, icon: CheckCircle2, color: "text-green-600" },
                { label: "Opens", value: s!.totalOpened, icon: Eye, color: "text-sky-600" },
                { label: "Clicks", value: s!.totalClicked, icon: MousePointerClick, color: "text-purple-600" },
                { label: "Failed", value: s!.totalFailed, icon: XCircle, color: "text-red-500" },
                { label: "Bounced", value: s!.totalBounced, icon: AlertTriangle, color: "text-orange-500" },
              ].map(({ label, value, icon: Icon, color }) => (
                <Card key={label}>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon className={`h-3.5 w-3.5 ${color}`} />
                      <p className="text-xs text-muted-foreground">{label}</p>
                    </div>
                    <p className="text-xl font-bold">{value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Rate cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: "Open Rate", value: `${s!.openRate}%`, sub: "of delivered emails opened", icon: TrendingUp, color: "text-green-600" },
                { label: "Click Rate", value: `${s!.clickRate}%`, sub: "of delivered emails clicked", icon: MousePointerClick, color: "text-purple-600" },
                { label: "Click-to-Open Rate", value: `${s!.clickToOpenRate}%`, sub: "of opens that resulted in a click", icon: BarChart2, color: "text-sky-600" },
              ].map(({ label, value, sub, icon: Icon, color }) => (
                <Card key={label}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className={`h-4 w-4 ${color}`} />
                      <p className="text-sm font-medium">{label}</p>
                    </div>
                    <p className="text-3xl font-bold">{value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{sub}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Funnel bar chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Engagement Funnel</CardTitle>
                <CardDescription className="text-xs">Percentage of delivered emails at each stage</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {funnelBars.map(({ label, value, color, pct }) => (
                  <div key={label} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium">{label}</span>
                      <span className="text-muted-foreground">{value} ({pct.toFixed(1)}%)</span>
                    </div>
                    <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${color}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Per-recipient table */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-sm">Recipients</CardTitle>
                    <CardDescription className="text-xs">
                      {data.recipients.length} recipient{data.recipients.length !== 1 ? "s" : ""}
                    </CardDescription>
                  </div>
                  <Input
                    placeholder="Search by email..."
                    value={recipientSearch}
                    onChange={(e) => setRecipientSearch(e.target.value)}
                    className="max-w-xs h-8 text-xs"
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {filteredRecipients.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-8">
                    {recipientSearch ? "No recipients match your search." : "No recipient data yet. Send the campaign first."}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Email</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs">Sent</TableHead>
                          <TableHead className="text-xs">Opened</TableHead>
                          <TableHead className="text-xs">Clicked</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRecipients.map((r: any) => {
                          const statusKey = recipientStatusLabel(r);
                          return (
                            <TableRow key={r.id}>
                              <TableCell className="text-xs font-mono">{r.email}</TableCell>
                              <TableCell>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[statusKey] ?? "bg-gray-100 text-gray-700"}`}>
                                  {statusKey}
                                </span>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {r.sentAt ? new Date(r.sentAt).toLocaleString() : "—"}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {r.openedAt ? (
                                  <span className="flex items-center gap-1 text-green-700">
                                    <Eye className="h-3 w-3" />
                                    {new Date(r.openedAt).toLocaleString()}
                                  </span>
                                ) : "—"}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {r.clickedAt ? (
                                  <span className="flex items-center gap-1 text-purple-700">
                                    <MousePointerClick className="h-3 w-3" />
                                    {new Date(r.clickedAt).toLocaleString()}
                                  </span>
                                ) : "—"}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sent at */}
            {data.campaign?.sentAt && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Campaign sent {new Date(data.campaign.sentAt).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function EmailCampaignsPage() {
  const { orgId, ready } = useOrgScope();
  const utils = trpc.useUtils();
  const { data: campaigns, isLoading } = trpc.lms.emailMarketing.list.useQuery(
    { orgId: orgId! },
    { enabled: ready && !!orgId },
  );
  const { data: stats } = trpc.lms.emailMarketing.stats.useQuery(
    { orgId: orgId! },
    { enabled: ready && !!orgId },
  );

  const createMut = trpc.lms.emailMarketing.create.useMutation({
    onSuccess: () => {
      utils.lms.emailMarketing.list.invalidate();
      toast.success("Campaign created");
      setCreateOpen(false);
      resetForm();
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.lms.emailMarketing.update.useMutation({
    onSuccess: () => {
      utils.lms.emailMarketing.list.invalidate();
      toast.success("Updated");
      setEditOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const sendMut = trpc.lms.emailMarketing.send.useMutation({
    onSuccess: (res) => {
      toast.success(
        `Sent to ${res.sentCount} recipient${res.sentCount !== 1 ? "s" : ""}${res.failedCount > 0 ? ` (${res.failedCount} failed)` : ""}`,
      );
      utils.lms.emailMarketing.list.invalidate();
      utils.lms.emailMarketing.stats.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.lms.emailMarketing.delete.useMutation({
    onSuccess: () => {
      utils.lms.emailMarketing.list.invalidate();
      toast.success("Deleted");
    },
    onError: (e) => toast.error(e.message),
  });
  const duplicateMut = trpc.lms.emailMarketing.duplicate.useMutation({
    onSuccess: () => {
      utils.lms.emailMarketing.list.invalidate();
      toast.success("Campaign duplicated as draft");
    },
    onError: (e) => toast.error(e.message),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [analyticsId, setAnalyticsId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [textBody, setTextBody] = useState("");

  const resetForm = () => {
    setName(""); setSubject(""); setHtmlBody(""); setTextBody("");
  };
  const openEdit = (c: any) => {
    setEditId(c.id);
    setName(c.name);
    setSubject(c.subject);
    setHtmlBody(c.htmlBody ?? "");
    setTextBody(c.textBody ?? "");
    setEditOpen(true);
  };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Mail className="h-6 w-6 text-primary" />
            Email Campaigns
          </h1>
          <p className="text-muted-foreground mt-0.5">Create and send email campaigns to your learners</p>
        </div>
        <Button className="gap-2" onClick={() => { resetForm(); setCreateOpen(true); }}>
          <Plus className="h-4 w-4" />New Campaign
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { l: "Total Campaigns", v: stats?.totalCampaigns ?? 0 },
          { l: "Sent", v: stats?.totalSent ?? 0 },
          { l: "Total Opens", v: stats?.totalOpens ?? 0 },
          { l: "Open Rate", v: stats?.openRate ? `${stats.openRate.toFixed(1)}%` : "—" },
        ].map((s) => (
          <Card key={s.l}>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{s.l}</p>
              <p className="text-2xl font-bold">{s.v}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Campaign list */}
      {isLoading ? (
        <div className="grid gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : !campaigns?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <Mail className="h-12 w-12 text-muted-foreground/40" />
            <p className="text-muted-foreground">No campaigns yet. Create your first email campaign.</p>
            <Button onClick={() => { resetForm(); setCreateOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />Create Campaign
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {campaigns.map((c) => (
                <div key={c.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{c.name}</span>
                      <Badge variant={STATUS_VARIANT[c.status ?? "draft"]} className="text-xs capitalize">
                        {c.status ?? "draft"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{c.subject}</p>
                    {c.status === "sent" && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {c.sentCount ?? 0} sent · {c.openCount ?? 0} opens · {c.clickCount ?? 0} clicks
                      </p>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </div>
                  {/* Analytics icon button for sent campaigns */}
                  {c.status === "sent" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-primary"
                      title="View analytics"
                      onClick={() => setAnalyticsId(c.id)}
                    >
                      <BarChart2 className="h-4 w-4" />
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(c)}>
                        <Edit className="h-4 w-4 mr-2" />Edit
                      </DropdownMenuItem>
                      {c.status === "draft" && (
                        <DropdownMenuItem
                          onClick={() => {
                            if (confirm(`Send "${c.name}" to all org members now?`)) {
                              sendMut.mutate({ id: c.id, audience: "all_members" });
                            }
                          }}
                          disabled={sendMut.isPending}
                        >
                          <Send className="h-4 w-4 mr-2" />Send Now
                        </DropdownMenuItem>
                      )}
                      {c.status === "sent" && (
                        <DropdownMenuItem onClick={() => setAnalyticsId(c.id)}>
                          <BarChart2 className="h-4 w-4 mr-2" />View Analytics
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => duplicateMut.mutate({ id: c.id })}
                        disabled={duplicateMut.isPending}
                      >
                        <Copy className="h-4 w-4 mr-2" />Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => { if (confirm("Delete this campaign?")) deleteMut.mutate({ id: c.id }); }}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analytics modal */}
      {analyticsId !== null && (
        <CampaignAnalyticsModal
          campaignId={analyticsId}
          onClose={() => setAnalyticsId(null)}
        />
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>New Email Campaign</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Campaign Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="April Newsletter" />
            </div>
            <div className="space-y-2">
              <Label>Subject Line *</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="New courses this month!" />
            </div>
            <Tabs defaultValue="html">
              <TabsList>
                <TabsTrigger value="html">HTML Body</TabsTrigger>
                <TabsTrigger value="text">Plain Text</TabsTrigger>
              </TabsList>
              <TabsContent value="html">
                <Textarea
                  value={htmlBody}
                  onChange={(e) => setHtmlBody(e.target.value)}
                  rows={8}
                  placeholder="<p>Hello {{first_name}},</p>"
                  className="font-mono text-xs"
                />
              </TabsContent>
              <TabsContent value="text">
                <Textarea
                  value={textBody}
                  onChange={(e) => setTextBody(e.target.value)}
                  rows={8}
                  placeholder="Hello {{first_name}}, ..."
                />
              </TabsContent>
            </Tabs>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!name.trim() || !subject.trim()) { toast.error("Name and subject required"); return; }
                createMut.mutate({ orgId: orgId!, name, subject, htmlBody: htmlBody || "<p></p>", textBody: textBody || undefined });
              }}
              disabled={createMut.isPending}
            >
              {createMut.isPending ? "Creating..." : "Create Campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Edit Campaign</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Campaign Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Subject Line *</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <Tabs defaultValue="html">
              <TabsList>
                <TabsTrigger value="html">HTML Body</TabsTrigger>
                <TabsTrigger value="text">Plain Text</TabsTrigger>
              </TabsList>
              <TabsContent value="html">
                <Textarea value={htmlBody} onChange={(e) => setHtmlBody(e.target.value)} rows={8} className="font-mono text-xs" />
              </TabsContent>
              <TabsContent value="text">
                <Textarea value={textBody} onChange={(e) => setTextBody(e.target.value)} rows={8} />
              </TabsContent>
            </Tabs>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!editId) return;
                updateMut.mutate({ id: editId, name, subject, htmlBody, textBody: textBody || undefined });
              }}
              disabled={updateMut.isPending}
            >
              {updateMut.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
