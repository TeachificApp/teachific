import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, ArrowUpDown, BarChart3, Zap } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useOrgScope } from "@/hooks/useOrgScope";

export default function OrderBumpsPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { orgId, ready } = useOrgScope();

  const bumpsQuery = trpc.lms.orderBumps.list.useQuery(
    { orgId: orgId! },
    { enabled: !!orgId && ready }
  );

  const [showCreate, setShowCreate] = useState(false);
  const [editingBump, setEditingBump] = useState<any>(null);

  // Products for selection
  const coursesQuery = trpc.lms.courses.list.useQuery(
    { orgId: orgId! },
    { enabled: !!orgId && ready }
  );
  const downloadsQuery = trpc.lms.downloads.listProducts.useQuery(
    { orgId: orgId! },
    { enabled: !!orgId && ready }
  );

  const createMutation = trpc.lms.orderBumps.create.useMutation({
    onSuccess: () => {
      toast.success("Order bump created");
      bumpsQuery.refetch();
      setShowCreate(false);
    },
  });

  const updateMutation = trpc.lms.orderBumps.update.useMutation({
    onSuccess: () => {
      toast.success("Order bump updated");
      bumpsQuery.refetch();
      setEditingBump(null);
    },
  });

  const deleteMutation = trpc.lms.orderBumps.delete.useMutation({
    onSuccess: () => {
      toast.success("Order bump deleted");
      bumpsQuery.refetch();
    },
  });

  const bumps = bumpsQuery.data ?? [];
  const courses = coursesQuery.data ?? [];
  const downloads = downloadsQuery.data ?? [];

  const getProductName = (type: string, id: number) => {
    if (type === "course") return courses.find((c: any) => c.id === id)?.title ?? `Course #${id}`;
    if (type === "download") return downloads.find((d: any) => d.id === id)?.title ?? `Download #${id}`;
    return `Quiz #${id}`;
  };

  const placementLabels: Record<string, string> = {
    before_checkout: "Before Checkout",
    during_checkout: "During Checkout",
    after_checkout: "After Checkout",
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Order Bumps</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Upsell and cross-sell offers shown to customers during the purchase flow
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" /> Create Order Bump
        </Button>
      </div>

      {bumps.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Zap className="w-12 h-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold">No Order Bumps Yet</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-md">
              Order bumps are upsell offers shown when a customer purchases a product. 
              They can appear before, during, or after checkout to increase average order value.
            </p>
            <Button className="mt-6" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4 mr-2" /> Create Your First Order Bump
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {bumps.map((bump: any) => (
            <Card key={bump.id} className={!bump.isActive ? "opacity-60" : ""}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">{bump.name}</h3>
                    <Badge variant={bump.isActive ? "default" : "secondary"}>
                      {bump.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <Badge variant="outline">
                      {placementLabels[bump.placement] ?? bump.placement}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    When buying <strong>{getProductName(bump.triggerProductType, bump.triggerProductId)}</strong>
                    {" → "}offer <strong>{getProductName(bump.bumpProductType, bump.bumpProductId)}</strong>
                    {bump.discountPercent ? ` (${bump.discountPercent}% off)` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/sales/order-bumps/${bump.id}`)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm("Delete this order bump?")) {
                        deleteMutation.mutate({ id: bump.id });
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <CreateOrderBumpDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        orgId={orgId!}
        courses={courses}
        downloads={downloads}
        onSubmit={(data) => createMutation.mutate(data)}
        loading={createMutation.isPending}
      />
    </div>
  );
}

function CreateOrderBumpDialog({
  open,
  onClose,
  orgId,
  courses,
  downloads,
  onSubmit,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  orgId: number;
  courses: any[];
  downloads: any[];
  onSubmit: (data: any) => void;
  loading: boolean;
}) {
  const [name, setName] = useState("");
  const [triggerProductType, setTriggerProductType] = useState<"course" | "download" | "quiz">("course");
  const [triggerProductId, setTriggerProductId] = useState<number | null>(null);
  const [bumpProductType, setBumpProductType] = useState<"course" | "download" | "quiz">("course");
  const [bumpProductId, setBumpProductId] = useState<number | null>(null);
  const [placement, setPlacement] = useState<"before_checkout" | "during_checkout" | "after_checkout">("during_checkout");
  const [headline, setHeadline] = useState("");
  const [description, setDescription] = useState("");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [buttonText, setButtonText] = useState("Add to Order");
  const [declineText, setDeclineText] = useState("No thanks");

  const getProducts = (type: string) => {
    if (type === "course") return courses.map((c: any) => ({ id: c.id, name: c.title }));
    if (type === "download") return downloads.map((d: any) => ({ id: d.id, name: d.name }));
    return [];
  };

  const handleSubmit = () => {
    if (!name || !triggerProductId || !bumpProductId) return;
    onSubmit({
      orgId,
      name,
      triggerProductType,
      triggerProductId,
      bumpProductType,
      bumpProductId,
      placement,
      headline: headline || undefined,
      description: description || undefined,
      discountPercent: discountPercent || undefined,
      buttonText,
      declineText,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Order Bump</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name (internal)</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Upsell Advanced Course" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Trigger Product Type</Label>
              <Select value={triggerProductType} onValueChange={(v: any) => { setTriggerProductType(v); setTriggerProductId(null); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="course">Course</SelectItem>
                  <SelectItem value="download">Download</SelectItem>
                  <SelectItem value="quiz">Quiz</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Trigger Product</Label>
              <Select value={triggerProductId?.toString() ?? ""} onValueChange={(v) => setTriggerProductId(Number(v))}>
                <SelectTrigger><SelectValue placeholder="Select product..." /></SelectTrigger>
                <SelectContent>
                  {getProducts(triggerProductType).map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Bump Product Type</Label>
              <Select value={bumpProductType} onValueChange={(v: any) => { setBumpProductType(v); setBumpProductId(null); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="course">Course</SelectItem>
                  <SelectItem value="download">Download</SelectItem>
                  <SelectItem value="quiz">Quiz</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Bump Product (offer)</Label>
              <Select value={bumpProductId?.toString() ?? ""} onValueChange={(v) => setBumpProductId(Number(v))}>
                <SelectTrigger><SelectValue placeholder="Select product..." /></SelectTrigger>
                <SelectContent>
                  {getProducts(bumpProductType).map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Placement</Label>
            <Select value={placement} onValueChange={(v: any) => setPlacement(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="before_checkout">Before Checkout (interstitial page)</SelectItem>
                <SelectItem value="during_checkout">During Checkout (on payment page)</SelectItem>
                <SelectItem value="after_checkout">After Checkout (redirect/thank you page)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Headline</Label>
            <Input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Wait! Special one-time offer..." />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the offer..." rows={3} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Discount %</Label>
              <Input type="number" min={0} max={100} value={discountPercent} onChange={(e) => setDiscountPercent(Number(e.target.value))} />
            </div>
            <div>
              <Label>Button Text</Label>
              <Input value={buttonText} onChange={(e) => setButtonText(e.target.value)} />
            </div>
            <div>
              <Label>Decline Text</Label>
              <Input value={declineText} onChange={(e) => setDeclineText(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading || !name || !triggerProductId || !bumpProductId}>
            {loading ? "Creating..." : "Create Order Bump"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
