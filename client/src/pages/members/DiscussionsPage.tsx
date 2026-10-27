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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { MessageSquare, Plus, MoreVertical, Trash2, Pin, CheckCircle, XCircle, Reply, ChevronDown, ChevronRight } from "lucide-react";

const STATUS_COLORS: Record<string, string> = { open: "secondary", resolved: "default", closed: "outline" };

export default function DiscussionsPage() {
  const { orgId, ready } = useOrgScope();
  const utils = trpc.useUtils();
  const { data: discussions, isLoading } = trpc.lms.discussions.list.useQuery({ orgId: orgId! }, { enabled: ready && !!orgId });
  const createMut = trpc.lms.discussions.create.useMutation({
    onSuccess: () => { utils.lms.discussions.list.invalidate(); toast.success("Discussion created"); setCreateOpen(false); setTitle(""); setBody(""); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.lms.discussions.update.useMutation({
    onSuccess: () => { utils.lms.discussions.list.invalidate(); toast.success("Updated"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.lms.discussions.delete.useMutation({
    onSuccess: () => { utils.lms.discussions.list.invalidate(); toast.success("Deleted"); },
    onError: (e) => toast.error(e.message),
  });
  const replyMut = trpc.lms.discussions.reply.useMutation({
    onSuccess: () => { utils.lms.discussions.list.invalidate(); toast.success("Reply posted"); setReplyBody(""); setReplyId(null); },
    onError: (e) => toast.error(e.message),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState(""); const [body, setBody] = useState("");
  const [replyId, setReplyId] = useState<number | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data: expandedDetail } = trpc.lms.discussions.get.useQuery({ id: expanded! }, { enabled: !!expanded });

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold flex items-center gap-2"><MessageSquare className="h-6 w-6 text-primary" />Discussions</h1><p className="text-muted-foreground mt-0.5">Course Q&A and community discussions</p></div>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" />New Discussion</Button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[{ l: "Total", v: discussions?.length ?? 0 }, { l: "Open", v: discussions?.filter(d => d.status === "open").length ?? 0 }, { l: "Resolved", v: discussions?.filter(d => d.status === "resolved").length ?? 0 }].map(s => (
          <Card key={s.l}><CardContent className="pt-6"><p className="text-sm text-muted-foreground">{s.l}</p><p className="text-3xl font-bold">{s.v}</p></CardContent></Card>
        ))}
      </div>
      {isLoading ? <div className="grid gap-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
        : !discussions?.length ? (
          <Card><CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <MessageSquare className="h-12 w-12 text-muted-foreground/40" />
            <p className="text-muted-foreground">No discussions yet.</p>
            <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-2" />Start Discussion</Button>
          </CardContent></Card>
        ) : (
          <div className="grid gap-3">
            {discussions.map(d => (
              <Card key={d.id} className={d.isPinned ? "border-primary/30" : ""}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {d.isPinned && <Pin className="h-3.5 w-3.5 text-primary shrink-0" />}
                        <button onClick={() => setExpanded(expanded === d.id ? null : d.id)} className="font-medium text-sm hover:text-primary transition-colors text-left">{d.title}</button>
                        <Badge variant={STATUS_COLORS[d.status] as any} className="text-xs">{d.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{d.authorName} · {new Date(d.createdAt).toLocaleDateString()} · {d.replyCount} replies</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="sm" className="gap-1 h-7 text-xs" onClick={() => { setReplyId(d.id); }}>
                          <Reply className="h-3 w-3" />Reply
                        </Button>
                        <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => updateMut.mutate({ id: d.id, data: { isPinned: !d.isPinned } })}><Pin className="h-4 w-4 mr-2" />{d.isPinned ? "Unpin" : "Pin"}</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateMut.mutate({ id: d.id, data: { status: d.status === "open" ? "resolved" : "open" } })}><CheckCircle className="h-4 w-4 mr-2" />{d.status === "open" ? "Mark Resolved" : "Reopen"}</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { if (confirm("Delete?")) deleteMut.mutate({ id: d.id }); }} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  {expanded === d.id && expandedDetail && (
                    <div className="mt-3 pt-3 border-t space-y-3">
                      {expandedDetail.body && <p className="text-sm text-muted-foreground">{expandedDetail.body}</p>}
                      {expandedDetail.replies?.map((r: any) => (
                        <div key={r.id} className={`pl-4 border-l-2 ${r.isInstructorReply ? "border-primary" : "border-muted"}`}>
                          <p className="text-xs font-medium">{r.authorName}{r.isInstructorReply && <span className="text-primary ml-1">(Instructor)</span>}</p>
                          <p className="text-sm">{r.body}</p>
                          <p className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {replyId === d.id && (
                    <div className="mt-3 pt-3 border-t flex gap-2">
                      <Textarea value={replyBody} onChange={e => setReplyBody(e.target.value)} placeholder="Write a reply..." rows={2} className="flex-1" />
                      <div className="flex flex-col gap-1">
                        <Button size="sm" onClick={() => { if (!replyBody.trim()) return; replyMut.mutate({ discussionId: d.id, body: replyBody }); }} disabled={replyMut.isPending}>Post</Button>
                        <Button size="sm" variant="ghost" onClick={() => { setReplyId(null); setReplyBody(""); }}>Cancel</Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent><DialogHeader><DialogTitle>New Discussion</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>Title *</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Question or topic..." /></div>
            <div className="space-y-2"><Label>Body</Label><Textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Describe your question or topic in detail..." rows={4} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button onClick={() => { if (!title.trim()) { toast.error("Title required"); return; } createMut.mutate({ orgId: orgId!, title, body: body || undefined }); }} disabled={createMut.isPending}>{createMut.isPending ? "Posting..." : "Post Discussion"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
