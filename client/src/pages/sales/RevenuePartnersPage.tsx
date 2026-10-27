import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useOrgScope } from "@/hooks/useOrgScope";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Handshake, Plus, MoreVertical, Edit, Trash2 } from "lucide-react";

export default function RevenuePartnersPage() {
  const { orgId, ready } = useOrgScope();
  const utils = trpc.useUtils();
  const { data: partners, isLoading } = trpc.lms.revenuePartners.list.useQuery({ orgId: orgId! }, { enabled: ready && !!orgId });
  const createMut = trpc.lms.revenuePartners.create.useMutation({
    onSuccess: () => { utils.lms.revenuePartners.list.invalidate(); toast.success("Partner added"); setCreateOpen(false); resetForm(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.lms.revenuePartners.update.useMutation({
    onSuccess: () => { utils.lms.revenuePartners.list.invalidate(); toast.success("Updated"); setEditOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.lms.revenuePartners.delete.useMutation({
    onSuccess: () => { utils.lms.revenuePartners.list.invalidate(); toast.success("Deleted"); },
    onError: (e) => toast.error(e.message),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [shareType, setShareType] = useState<"percentage"|"fixed">("percentage"); const [shareValue, setShareValue] = useState(""); const [appliesTo, setAppliesTo] = useState<"all"|"specific">("all"); const [isActive, setIsActive] = useState(true);
  const resetForm = () => { setName(""); setEmail(""); setShareType("percentage"); setShareValue(""); setAppliesTo("all"); setIsActive(true); };
  const openEdit = (p: any) => { setEditId(p.id); setName(p.name ?? ""); setEmail(p.email ?? ""); setShareType(p.shareType ?? "percentage"); setShareValue(String(p.shareValue ?? "")); setAppliesTo(p.appliesTo ?? "all"); setIsActive(p.isActive !== false); setEditOpen(true); };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold flex items-center gap-2"><Handshake className="h-6 w-6 text-primary" />Revenue Partners</h1><p className="text-muted-foreground mt-0.5">Share revenue with co-instructors and content partners</p></div>
        <Button className="gap-2" onClick={() => { resetForm(); setCreateOpen(true); }}><Plus className="h-4 w-4" />Add Partner</Button>
      </div>

      {isLoading ? <div className="grid gap-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
        : !partners?.length ? (
          <Card><CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <Handshake className="h-12 w-12 text-muted-foreground/40" />
            <p className="text-muted-foreground">No revenue partners yet. Add your first partner.</p>
            <Button onClick={() => { resetForm(); setCreateOpen(true); }}><Plus className="h-4 w-4 mr-2" />Add Partner</Button>
          </CardContent></Card>
        ) : (
          <Card><CardContent className="p-0">
            <div className="divide-y">
              {partners.map((p: any) => (
                <div key={p.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2"><span className="font-medium text-sm">{p.name}</span><Badge variant={p.isActive !== false ? "default" : "outline"} className="text-xs">{p.isActive !== false ? "Active" : "Inactive"}</Badge></div>
                    {p.email && <p className="text-xs text-muted-foreground">{p.email}</p>}
                    <p className="text-xs text-muted-foreground">{p.shareType === "percentage" ? `${p.shareValue}% revenue share` : `$${p.shareValue} per sale`} · Applies to: {p.appliesTo === "all" ? "All courses" : "Specific courses"}</p>
                  </div>
                  <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(p)}><Edit className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { if (confirm("Delete?")) deleteMut.mutate({ id: p.id }); }} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          </CardContent></Card>
        )}

      {[{ open: createOpen, setOpen: setCreateOpen, title: "Add Revenue Partner", onSave: () => { if (!name.trim()) { toast.error("Name required"); return; } createMut.mutate({ orgId: orgId!, name, email, shareType, shareValue: shareValue ? parseFloat(shareValue) : undefined, appliesTo }); }, isPending: createMut.isPending, btnLabel: "Add Partner" },
        { open: editOpen, setOpen: setEditOpen, title: "Edit Revenue Partner", onSave: () => { if (!editId) return; updateMut.mutate({ id: editId, data: { name, email, shareType, shareValue: shareValue ? parseFloat(shareValue) : undefined, appliesTo, isActive } }); }, isPending: updateMut.isPending, btnLabel: "Save Changes" }
      ].map(({ open, setOpen, title, onSave, isPending, btnLabel }) => (
        <Dialog key={title} open={open} onOpenChange={setOpen}>
          <DialogContent><DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2"><Label>Name *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Jane Doe" /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@example.com" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Share Type</Label>
                  <Select value={shareType} onValueChange={(v) => setShareType(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="percentage">Percentage</SelectItem><SelectItem value="fixed">Fixed Amount</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Value {shareType === "percentage" ? "(%)" : "($)"}</Label><Input type="number" min="0" value={shareValue} onChange={e => setShareValue(e.target.value)} /></div>
              </div>
              <div className="space-y-2"><Label>Applies To</Label>
                <Select value={appliesTo} onValueChange={(v) => setAppliesTo(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="all">All Courses</SelectItem><SelectItem value="specific">Specific Courses</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between"><Label>Active</Label><Switch checked={isActive} onCheckedChange={setIsActive} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={onSave} disabled={isPending}>{isPending ? "Saving..." : btnLabel}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ))}
    </div>
  );
}
