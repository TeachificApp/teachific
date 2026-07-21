import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Layers, Plus, Globe, Lock, Loader2, Trash2, DollarSign, Tag, Edit2 } from "lucide-react";
import { toast } from "sonner";

const PRICING_TYPE_LABELS: Record<string, string> = {
  free: "Free",
  one_time: "One-time purchase",
  subscription_included: "Included with subscription",
  private_access: "Private (invite only)",
};

export default function ManageBlueprintsPage() {
  const { user } = useAuth();
  const isPlatformAdmin = user?.role === "site_owner" || user?.role === "site_admin";

  const [createOpen, setCreateOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [selectedBpId, setSelectedBpId] = useState<number | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "course",
    isPublic: false,
    previewImageUrl: "",
  });

  const [pricingForm, setPricingForm] = useState({
    pricingType: "free" as "free" | "one_time" | "subscription_included" | "private_access",
    price: "",
    currency: "USD",
  });

  const { data: adminData, isLoading, refetch } = trpc.blueprints.adminList.useQuery(
    { page: 1, pageSize: 100 },
    { enabled: isPlatformAdmin }
  );
  const blueprints = adminData?.blueprints ?? [];

  const createMutation = trpc.blueprints.create.useMutation({
    onSuccess: () => {
      toast.success("Blueprint created! You can now add resources and publish it.");
      setCreateOpen(false);
      setForm({ title: "", description: "", category: "course", isPublic: false, previewImageUrl: "" });
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const publishMutation = trpc.blueprints.publish.useMutation({
    onSuccess: () => { toast.success("Blueprint published"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const archiveMutation = trpc.blueprints.setStatus.useMutation({
    onSuccess: () => { toast.success("Blueprint archived"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const updatePricingMutation = trpc.blueprints.update.useMutation({
    onSuccess: () => {
      toast.success("Pricing updated");
      setPricingOpen(false);
      setSelectedBpId(null);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  function openPricingEditor(bp: { id: number; pricingType?: string | null; price?: string | null; currency?: string | null }) {
    setSelectedBpId(bp.id);
    setPricingForm({
      pricingType: (bp.pricingType as any) ?? "free",
      price: bp.price ? String(bp.price) : "",
      currency: bp.currency ?? "USD",
    });
    setPricingOpen(true);
  }

  function savePricing() {
    if (!selectedBpId) return;
    updatePricingMutation.mutate({
      id: selectedBpId,
      pricingType: pricingForm.pricingType,
      price: pricingForm.pricingType === "one_time" && pricingForm.price
        ? parseFloat(pricingForm.price)
        : null,
    });
  }

  if (!isPlatformAdmin) {
    return (
      <div className="container py-20 text-center text-muted-foreground">
        <Lock className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p className="text-lg font-medium">Platform admin access required</p>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-5xl">
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Layers className="w-6 h-6 text-[#24abbc]" />
            <h1 className="text-2xl font-bold">Manage Blueprints</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Create, edit, price, and publish blueprints for the marketplace.
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Blueprint
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Blueprint</DialogTitle>
              <DialogDescription>
                Define the blueprint metadata. You can add resources and set pricing after creation.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label htmlFor="bp-name">Name</Label>
                <Input
                  id="bp-name"
                  placeholder="e.g. Monthly Webinar Launch System"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="bp-desc">Description</Label>
                <Textarea
                  id="bp-desc"
                  placeholder="What does this blueprint include and who is it for?"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="mt-1"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="bp-category">Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
                >
                  <SelectTrigger id="bp-category" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="course">Course</SelectItem>
                    <SelectItem value="webinar">Webinar</SelectItem>
                    <SelectItem value="download">Digital Download</SelectItem>
                    <SelectItem value="membership">Membership</SelectItem>
                    <SelectItem value="bundle">Bundle</SelectItem>
                    <SelectItem value="funnel">Funnel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="bp-image">Preview Image URL (optional)</Label>
                <Input
                  id="bp-image"
                  placeholder="https://..."
                  value={form.previewImageUrl}
                  onChange={(e) => setForm((f) => ({ ...f, previewImageUrl: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Public on Marketplace</Label>
                  <p className="text-xs text-muted-foreground">Visible to all orgs on Builder+ plans</p>
                </div>
                <Switch
                  checked={form.isPublic}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, isPublic: v }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button
                onClick={() => {
                  const slug = form.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                  createMutation.mutate({
                    title: form.title,
                    slug,
                    shortDescription: form.description || undefined,
                    category: form.category,
                    thumbnailUrl: form.previewImageUrl || undefined,
                    visibility: form.isPublic ? "marketplace" : "private",
                  });
                }}
                disabled={!form.title || createMutation.isPending}
              >
                {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Create Blueprint
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Pricing Editor Dialog */}
      <Dialog open={pricingOpen} onOpenChange={setPricingOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-[#24abbc]" />
              Set Blueprint Pricing
            </DialogTitle>
            <DialogDescription>
              Choose how this blueprint is priced for marketplace buyers.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Pricing Type</Label>
              <Select
                value={pricingForm.pricingType}
                onValueChange={(v) => setPricingForm((f) => ({ ...f, pricingType: v as any }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free — anyone on Builder+ can install</SelectItem>
                  <SelectItem value="one_time">One-time purchase — buyer pays once</SelectItem>
                  <SelectItem value="subscription_included">Included with subscription tier</SelectItem>
                  <SelectItem value="private_access">Private — invite only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {pricingForm.pricingType === "one_time" && (
              <>
                <Separator />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="bp-price">Price</Label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <Input
                        id="bp-price"
                        type="number"
                        min="1"
                        step="0.01"
                        placeholder="97.00"
                        value={pricingForm.price}
                        onChange={(e) => setPricingForm((f) => ({ ...f, price: e.target.value }))}
                        className="pl-7"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="bp-currency">Currency</Label>
                    <Select
                      value={pricingForm.currency}
                      onValueChange={(v) => setPricingForm((f) => ({ ...f, currency: v }))}
                    >
                      <SelectTrigger id="bp-currency" className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="GBP">GBP</SelectItem>
                        <SelectItem value="AUD">AUD</SelectItem>
                        <SelectItem value="CAD">CAD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Buyers pay this amount once via Stripe Checkout. Referral commissions apply if the buyer came via a referral link.
                </p>
              </>
            )}

            {pricingForm.pricingType === "free" && (
              <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
                Free blueprints are available to all orgs on Builder or higher plans. Creators can still earn referral commissions when their referral link drives a new subscription.
              </div>
            )}

            {pricingForm.pricingType === "subscription_included" && (
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-700">
                This blueprint will be included automatically for orgs on the qualifying subscription tier. No separate purchase required.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPricingOpen(false)}>Cancel</Button>
            <Button
              onClick={savePricing}
              disabled={
                updatePricingMutation.isPending ||
                (pricingForm.pricingType === "one_time" && !pricingForm.price)
              }
            >
              {updatePricingMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save Pricing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : !blueprints?.length ? (
        <div className="text-center py-20 text-muted-foreground">
          <Layers className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">No blueprints yet</p>
          <p className="text-sm">Create your first blueprint to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {blueprints.map((bp) => {
            const isFree = !bp.pricingType || bp.pricingType === "free";
            const isOneTime = bp.pricingType === "one_time";
            return (
              <Card key={bp.id} className="hover:shadow-sm transition-shadow">
                <CardHeader className="py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-base">{bp.title}</CardTitle>
                          <Badge
                            variant={bp.status === "published" ? "default" : bp.status === "archived" ? "secondary" : "outline"}
                            className="text-xs"
                          >
                            {bp.status}
                          </Badge>
                          {bp.isPublic ? (
                            <Badge variant="outline" className="text-xs border-green-500/30 text-green-600">
                              <Globe className="w-2.5 h-2.5 mr-1" />Public
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              <Lock className="w-2.5 h-2.5 mr-1" />Private
                            </Badge>
                          )}
                          {/* Pricing badge */}
                          {isOneTime && bp.price ? (
                            <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-600">
                              <DollarSign className="w-2.5 h-2.5 mr-1" />${parseFloat(String(bp.price)).toFixed(2)} {bp.currency ?? "USD"}
                            </Badge>
                          ) : isFree ? (
                            <Badge variant="outline" className="text-xs border-teal-500/30 text-teal-600">
                              <Tag className="w-2.5 h-2.5 mr-1" />Free
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              {PRICING_TYPE_LABELS[bp.pricingType ?? "free"] ?? bp.pricingType}
                            </Badge>
                          )}
                        </div>
                        {bp.shortDescription && (
                          <CardDescription className="text-xs mt-0.5 line-clamp-1">{bp.shortDescription}</CardDescription>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Pricing editor button */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openPricingEditor(bp as any)}
                      >
                        <Edit2 className="w-3.5 h-3.5 mr-1" />
                        Pricing
                      </Button>
                      {bp.status === "draft" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => publishMutation.mutate({ blueprintId: bp.id })}
                          disabled={publishMutation.isPending}
                        >
                          <Globe className="w-3.5 h-3.5 mr-1" />
                          Publish
                        </Button>
                      )}
                      {bp.status === "published" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => archiveMutation.mutate({ blueprintId: bp.id, status: "archived" })}
                          disabled={archiveMutation.isPending}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          Archive
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
