import { useState } from "react";
import { useLocation } from "wouter";
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
import { CreditCard, Plus, MoreVertical, Edit, Trash2, Users } from "lucide-react";

export default function MembershipsPage() {
  const { orgId, ready } = useOrgScope();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { data: memberships, isLoading } = trpc.lms.memberships.list.useQuery({ orgId: orgId! }, { enabled: ready && !!orgId });
  const createMut = trpc.lms.memberships.create.useMutation({
    onSuccess: (data) => { utils.lms.memberships.list.invalidate(); toast.success("Membership created"); setCreateOpen(false); resetForm(); if (data?.id) navigate(`/products/memberships/${data.id}/edit`); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.lms.memberships.update.useMutation({
    onSuccess: () => { utils.lms.memberships.list.invalidate(); toast.success("Updated"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.lms.memberships.delete.useMutation({
    onSuccess: () => { utils.lms.memberships.list.invalidate(); toast.success("Deleted"); },
    onError: (e) => toast.error(e.message),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState(""); const [description, setDescription] = useState(""); const [price, setPrice] = useState(""); const [interval, setInterval] = useState<"monthly"|"yearly"|"one_time">("monthly"); const [trialDays, setTrialDays] = useState("0");

  const resetForm = () => { setName(""); setDescription(""); setPrice(""); setInterval("monthly"); setTrialDays("0"); };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold flex items-center gap-2"><CreditCard className="h-6 w-6 text-primary" />Memberships</h1><p className="text-muted-foreground mt-0.5">Create recurring membership plans for your school</p></div>
        <Button className="gap-2" onClick={() => { resetForm(); setCreateOpen(true); }}><Plus className="h-4 w-4" />New Membership</Button>
      </div>
      {isLoading ? <div className="grid gap-4 sm:grid-cols-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}</div>
        : !memberships?.length ? (
          <Card><CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <CreditCard className="h-12 w-12 text-muted-foreground/40" />
            <p className="text-muted-foreground">No membership plans yet.</p>
            <Button onClick={() => { resetForm(); setCreateOpen(true); }}><Plus className="h-4 w-4 mr-2" />Create Membership</Button>
          </CardContent></Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {memberships.map(m => (
              <Card key={m.id} className={`cursor-pointer hover:border-primary/40 transition-colors ${m.isActive ? "" : "opacity-60"}`} onClick={() => navigate(`/products/memberships/${m.id}/edit`)}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div><CardTitle className="text-base">{m.name}</CardTitle><Badge variant={m.isActive ? "default" : "secondary"} className="text-xs mt-1">{m.isActive ? "Active" : "Inactive"}</Badge></div>
                    <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={e => e.stopPropagation()}><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/products/memberships/${m.id}/edit`); }}><Edit className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); updateMut.mutate({ id: m.id, isActive: !m.isActive }); }}>{m.isActive ? "Deactivate" : "Activate"}</DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); if (confirm("Delete?")) deleteMut.mutate({ id: m.id }); }} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">${m.price}<span className="text-sm font-normal text-muted-foreground">/{m.billingInterval === "one_time" ? "once" : m.billingInterval === "monthly" ? "mo" : "yr"}</span></p>
                  {m.description && <p className="text-sm text-muted-foreground mt-1">{m.description}</p>}
                  <div className="flex items-center gap-2 mt-3"><Users className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-sm">{m.memberCount} members</span></div>
                  {(m.trialDays ?? 0) > 0 && <p className="text-xs text-muted-foreground mt-1">{m.trialDays}-day free trial</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent><DialogHeader><DialogTitle>New Membership Plan</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>Name *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Pro Membership" /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Price ($) *</Label><Input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="29.99" /></div>
              <div className="space-y-2"><Label>Billing</Label>
                <Select value={interval} onValueChange={v => setInterval(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="yearly">Yearly</SelectItem><SelectItem value="one_time">One Time</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>Trial Days</Label><Input type="number" min="0" value={trialDays} onChange={e => setTrialDays(e.target.value)} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button onClick={() => { if (!name.trim() || !price) { toast.error("Name and price required"); return; } createMut.mutate({ orgId: orgId!, name, description: description || undefined, price: parseFloat(price), billingInterval: interval, trialDays: parseInt(trialDays) || 0 }); }} disabled={createMut.isPending}>{createMut.isPending ? "Creating..." : "Create"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
