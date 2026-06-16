import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useOrgScope } from "@/hooks/useOrgScope";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Package, Plus, MoreVertical, Edit, Trash2, Settings } from "lucide-react";

export default function BundlesPage() {
  const { orgId, ready } = useOrgScope();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { data: bundles, isLoading } = trpc.lms.bundles.list.useQuery({ orgId: orgId! }, { enabled: ready && !!orgId });
  const createMut = trpc.lms.bundles.create.useMutation({
    onSuccess: (newBundle) => {
      utils.lms.bundles.list.invalidate();
      toast.success("Bundle created");
      setCreateOpen(false);
      resetForm();
      if (newBundle?.id) navigate(`/products/bundles/${newBundle.id}/edit`);
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.lms.bundles.delete.useMutation({
    onSuccess: () => { utils.lms.bundles.list.invalidate(); toast.success("Bundle deleted"); },
    onError: (e) => toast.error(e.message),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const resetForm = () => { setName(""); setDescription(""); setPrice(""); };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />Bundles
          </h1>
          <p className="text-muted-foreground mt-0.5">Package multiple courses together at a discounted price</p>
        </div>
        <Button className="gap-2" onClick={() => { resetForm(); setCreateOpen(true); }}>
          <Plus className="h-4 w-4" />New Bundle
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : !bundles?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <Package className="h-12 w-12 text-muted-foreground/40" />
            <p className="text-muted-foreground">No bundles yet. Create your first course bundle.</p>
            <Button onClick={() => { resetForm(); setCreateOpen(true); }}><Plus className="h-4 w-4 mr-2" />Create Bundle</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(bundles as any[]).map((b) => (
            <Card key={b.id} className="relative hover:shadow-md transition-shadow">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm truncate">{b.name}</span>
                      <Badge variant={b.isActive !== false ? "default" : "outline"} className="text-xs shrink-0">
                        {b.isActive !== false ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    {b.description && <p className="text-xs text-muted-foreground line-clamp-2">{b.description}</p>}
                    <p className="text-lg font-bold mt-2">${Number(b.price ?? 0).toFixed(2)}</p>
                    {(() => {
                      try { const ids = JSON.parse(b.courseIds ?? "[]"); return ids.length > 0 ? <p className="text-xs text-muted-foreground">{ids.length} course{ids.length !== 1 ? "s" : ""}</p> : null; } catch { return null; }
                    })()}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"><MoreVertical className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate(`/products/bundles/${b.id}/edit`)}>
                        <Settings className="h-4 w-4 mr-2" />Edit Details
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => { if (confirm("Delete this bundle?")) deleteMut.mutate({ id: b.id }); }}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <Button
                  variant="outline" size="sm" className="w-full mt-3"
                  onClick={() => navigate(`/products/bundles/${b.id}/edit`)}
                >
                  <Edit className="h-3.5 w-3.5 mr-1.5" />Edit Bundle
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Bundle</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Bundle Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Course Mastery Bundle" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Price ($) *</Label>
              <Input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="299.00" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!name.trim() || !price) { toast.error("Name and price required"); return; }
                createMut.mutate({ orgId: orgId!, name, description: description || undefined, price: parseFloat(price) });
              }}
              disabled={createMut.isPending}
            >
              {createMut.isPending ? "Creating..." : "Create Bundle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
