import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useOrgScope } from "@/hooks/useOrgScope";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { GitBranch, Plus, MoreVertical, Pencil, Trash2, ArrowRight, Zap } from "lucide-react";
import { FunnelAiCreateDialog } from "@/components/FunnelAiCreateDialog";

export default function FunnelsPage() {
  const { orgId, ready } = useOrgScope();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const { data: funnels, isLoading } = trpc.funnel360.list.useQuery(
    { expectedOrgId: orgId! },
    { enabled: ready && !!orgId }
  );

  const createFunnel = trpc.funnel360.create.useMutation({
    onSuccess: (funnel) => {
      utils.funnel360.list.invalidate({ expectedOrgId: orgId! });
      setShowCreate(false);
      setName("");
      toast.success("Funnel created");
      if (funnel?.id) setLocation(`/marketing/funnels/${funnel.id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteFunnel = trpc.funnel360.delete.useMutation({
    onSuccess: () => {
      utils.funnel360.list.invalidate({ expectedOrgId: orgId! });
      toast.success("Funnel deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [showAi, setShowAi] = useState(false);

  const totalVisitors = (funnels ?? []).reduce((s, f) => s + f.totalVisitors, 0);
  const totalConversions = (funnels ?? []).reduce((s, f) => s + f.totalConversions, 0);

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><GitBranch className="h-6 w-6 text-primary" />Funnels</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">Build multi-step conversion funnels with landing pages and automated follow-ups</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" disabled={!ready} onClick={() => setShowAi(true)}>AI Generate</Button>
        <Button className="gap-2" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" />New Funnel</Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[{ l: "Funnels", v: (funnels ?? []).length }, { l: "Total Visitors", v: totalVisitors }, { l: "Total Conversions", v: totalConversions }].map(s => (
          <Card key={s.l}><CardContent className="pt-6"><p className="text-sm text-muted-foreground">{s.l}</p><p className="text-3xl font-bold">{s.v}</p></CardContent></Card>
        ))}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
      ) : !funnels || funnels.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center"><Zap className="h-7 w-7 text-primary" /></div>
          <div><p className="font-semibold text-lg">No funnels yet</p><p className="text-muted-foreground text-sm mt-1">Create your first funnel to start converting visitors into students</p></div>
          <Button onClick={() => setShowCreate(true)} className="gap-2"><Plus className="h-4 w-4" />Create First Funnel</Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {funnels.map(f => {
            const convRate = f.totalVisitors > 0 ? Math.round((f.totalConversions / f.totalVisitors) * 100) : 0;
            return (
              <Card key={f.id} className={`transition-shadow hover:shadow-md cursor-pointer ${!f.isActive ? "opacity-60" : ""}`} onClick={() => setLocation(`/marketing/funnels/${f.id}`)}>
                <CardContent className="py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{f.name}</p>
                    <p className="text-xs text-muted-foreground">{f.totalVisitors} visitors · {f.totalConversions} conversions{f.totalVisitors > 0 ? ` (${convRate}%)` : ""}</p>
                    {f.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{f.description}</p>}
                  </div>
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <Badge variant={f.isActive ? "default" : "secondary"} className="text-xs">{f.isActive ? "Active" : "Paused"}</Badge>
                    <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={e => { e.stopPropagation(); setLocation(`/marketing/funnels/${f.id}`); }}>Open<ArrowRight className="h-3 w-3" /></Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setLocation(`/marketing/funnels/${f.id}`)}><Pencil className="h-3.5 w-3.5 mr-2" />Edit Funnel</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => { if (confirm(`Delete "${f.name}"?`)) deleteFunnel.mutate({ id: f.id }); }}><Trash2 className="h-3.5 w-3.5 mr-2" />Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent><DialogHeader><DialogTitle>New Funnel</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>Funnel Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Course Launch Funnel" autoFocus onKeyDown={e => { if (e.key === "Enter" && name.trim()) createFunnel.mutate({ expectedOrgId: orgId!, name }); }} /></div>
            <p className="text-xs text-muted-foreground">After creating the funnel, use the funnel builder to add landing pages, opt-in forms, and follow-up sequences.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={() => { if (!name.trim()) { toast.error("Name required"); return; } createFunnel.mutate({ expectedOrgId: orgId!, name }); }} disabled={createFunnel.isPending}>{createFunnel.isPending ? "Creating…" : "Create Funnel"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {showAi && <FunnelAiCreateDialog onClose={() => setShowAi(false)} onCreated={id => {
        setShowAi(false);
        toast.success("Unpublished draft created");
        setLocation(`/marketing/funnels/${id}`);
      }} />}
    </div>
  );
}
