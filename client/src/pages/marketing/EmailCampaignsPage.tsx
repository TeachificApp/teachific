import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useOrgScope } from "@/hooks/useOrgScope";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Mail, Plus, MoreVertical, Edit, Trash2, Send, Copy } from "lucide-react";

const STATUS_VARIANT: Record<string, any> = { draft: "outline", scheduled: "secondary", sending: "default", sent: "default", failed: "destructive" };

export default function EmailCampaignsPage() {
  const { orgId, ready } = useOrgScope();
  const utils = trpc.useUtils();
  const { data: campaigns, isLoading } = trpc.lms.emailMarketing.list.useQuery({ orgId: orgId! }, { enabled: ready && !!orgId });
  const { data: stats } = trpc.lms.emailMarketing.stats.useQuery({ orgId: orgId! }, { enabled: ready && !!orgId });

  const createMut = trpc.lms.emailMarketing.create.useMutation({
    onSuccess: () => { utils.lms.emailMarketing.list.invalidate(); toast.success("Campaign created"); setCreateOpen(false); resetForm(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.lms.emailMarketing.update.useMutation({
    onSuccess: () => { utils.lms.emailMarketing.list.invalidate(); toast.success("Updated"); setEditOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const sendMut = trpc.lms.emailMarketing.send.useMutation({
    onSuccess: (res) => {
      toast.success(`Sent to ${res.sentCount} recipient${res.sentCount !== 1 ? "s" : ""}${res.failedCount > 0 ? ` (${res.failedCount} failed)` : ""}`);
      utils.lms.emailMarketing.list.invalidate();
      utils.lms.emailMarketing.stats.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.lms.emailMarketing.delete.useMutation({
    onSuccess: () => { utils.lms.emailMarketing.list.invalidate(); toast.success("Deleted"); },
    onError: (e) => toast.error(e.message),
  });
  const duplicateMut = trpc.lms.emailMarketing.duplicate.useMutation({
    onSuccess: () => { utils.lms.emailMarketing.list.invalidate(); toast.success("Campaign duplicated as draft"); },
    onError: (e) => toast.error(e.message),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [name, setName] = useState(""); const [subject, setSubject] = useState(""); const [htmlBody, setHtmlBody] = useState(""); const [textBody, setTextBody] = useState("");

  const resetForm = () => { setName(""); setSubject(""); setHtmlBody(""); setTextBody(""); };
  const openEdit = (c: any) => { setEditId(c.id); setName(c.name); setSubject(c.subject); setHtmlBody(c.htmlBody ?? ""); setTextBody(c.textBody ?? ""); setEditOpen(true); };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold flex items-center gap-2"><Mail className="h-6 w-6 text-primary" />Email Campaigns</h1><p className="text-muted-foreground mt-0.5">Create and send email campaigns to your learners</p></div>
        <Button className="gap-2" onClick={() => { resetForm(); setCreateOpen(true); }}><Plus className="h-4 w-4" />New Campaign</Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[{ l: "Total Campaigns", v: stats?.totalCampaigns ?? 0 }, { l: "Sent", v: stats?.totalSent ?? 0 }, { l: "Total Opens", v: stats?.totalOpens ?? 0 }, { l: "Open Rate", v: stats?.openRate ? `${stats.openRate.toFixed(1)}%` : "—" }].map(s => (
          <Card key={s.l}><CardContent className="pt-6"><p className="text-sm text-muted-foreground">{s.l}</p><p className="text-2xl font-bold">{s.v}</p></CardContent></Card>
        ))}
      </div>

      {isLoading ? <div className="grid gap-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
        : !campaigns?.length ? (
          <Card><CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <Mail className="h-12 w-12 text-muted-foreground/40" />
            <p className="text-muted-foreground">No campaigns yet. Create your first email campaign.</p>
            <Button onClick={() => { resetForm(); setCreateOpen(true); }}><Plus className="h-4 w-4 mr-2" />Create Campaign</Button>
          </CardContent></Card>
        ) : (
          <Card><CardContent className="p-0">
            <div className="divide-y">
              {campaigns.map(c => (
                <div key={c.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2"><span className="font-medium text-sm">{c.name}</span><Badge variant={STATUS_VARIANT[c.status ?? "draft"]} className="text-xs">{c.status ?? "draft"}</Badge></div>
                    <p className="text-xs text-muted-foreground">{c.subject}</p>
                    {c.status === "sent" && <p className="text-xs text-muted-foreground">{c.sentCount ?? 0} sent · {c.openCount ?? 0} opens · {c.clickCount ?? 0} clicks</p>}
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">{new Date(c.createdAt).toLocaleDateString()}</div>
                  <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(c)}><Edit className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
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
                      <DropdownMenuItem onClick={() => duplicateMut.mutate({ id: c.id })} disabled={duplicateMut.isPending}><Copy className="h-4 w-4 mr-2" />Duplicate</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { if (confirm("Delete?")) deleteMut.mutate({ id: c.id }); }} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          </CardContent></Card>
        )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>New Email Campaign</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>Campaign Name *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="April Newsletter" /></div>
            <div className="space-y-2"><Label>Subject Line *</Label><Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="New courses this month!" /></div>
            <Tabs defaultValue="html">
              <TabsList><TabsTrigger value="html">HTML Body</TabsTrigger><TabsTrigger value="text">Plain Text</TabsTrigger></TabsList>
              <TabsContent value="html"><Textarea value={htmlBody} onChange={e => setHtmlBody(e.target.value)} rows={8} placeholder="<p>Hello {{first_name}},</p>" className="font-mono text-xs" /></TabsContent>
              <TabsContent value="text"><Textarea value={textBody} onChange={e => setTextBody(e.target.value)} rows={8} placeholder="Hello {{first_name}}, ..." /></TabsContent>
            </Tabs>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => { if (!name.trim() || !subject.trim()) { toast.error("Name and subject required"); return; } createMut.mutate({ orgId: orgId!, name, subject, htmlBody: htmlBody || "<p></p>", textBody: textBody || undefined }); }} disabled={createMut.isPending}>{createMut.isPending ? "Creating..." : "Create Campaign"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Edit Campaign</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>Campaign Name *</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
            <div className="space-y-2"><Label>Subject Line *</Label><Input value={subject} onChange={e => setSubject(e.target.value)} /></div>
            <Tabs defaultValue="html">
              <TabsList><TabsTrigger value="html">HTML Body</TabsTrigger><TabsTrigger value="text">Plain Text</TabsTrigger></TabsList>
              <TabsContent value="html"><Textarea value={htmlBody} onChange={e => setHtmlBody(e.target.value)} rows={8} className="font-mono text-xs" /></TabsContent>
              <TabsContent value="text"><Textarea value={textBody} onChange={e => setTextBody(e.target.value)} rows={8} /></TabsContent>
            </Tabs>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={() => { if (!editId) return; updateMut.mutate({ id: editId, name, subject, htmlBody, textBody: textBody || undefined }); }} disabled={updateMut.isPending}>{updateMut.isPending ? "Saving..." : "Save Changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
