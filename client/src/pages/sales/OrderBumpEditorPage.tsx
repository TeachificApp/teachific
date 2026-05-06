import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, Eye, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";
import { WysiwygPageBuilder } from "@/components/WysiwygPageBuilder";
import { useOrgScope } from "@/hooks/useOrgScope";

export default function OrderBumpEditorPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();
  const bumpId = Number(params.id);
  const { orgId, ready } = useOrgScope();

  const bumpQuery = trpc.lms.orderBumps.get.useQuery(
    { id: bumpId },
    { enabled: !!bumpId }
  );

  const statsQuery = trpc.lms.orderBumps.stats.useQuery(
    { bumpId },
    { enabled: !!bumpId }
  );

  const coursesQuery = trpc.lms.courses.list.useQuery(
    { orgId: orgId! },
    { enabled: !!orgId && ready }
  );
  const downloadsQuery = trpc.lms.downloads.listProducts.useQuery(
    { orgId: orgId! },
    { enabled: !!orgId && ready }
  );

  const updateMutation = trpc.lms.orderBumps.update.useMutation({
    onSuccess: () => {
      toast.success("Order bump saved");
      bumpQuery.refetch();
    },
  });

  const bump = bumpQuery.data;
  const courses = coursesQuery.data ?? [];
  const downloads = downloadsQuery.data ?? [];
  const stats = statsQuery.data;

  // Form state
  const [name, setName] = useState("");
  const [triggerProductType, setTriggerProductType] = useState<"course" | "download" | "quiz">("course");
  const [triggerProductId, setTriggerProductId] = useState<number | null>(null);
  const [bumpProductType, setBumpProductType] = useState<"course" | "download" | "quiz">("course");
  const [bumpProductId, setBumpProductId] = useState<number | null>(null);
  const [placement, setPlacement] = useState<"before_checkout" | "during_checkout" | "after_checkout">("during_checkout");
  const [headline, setHeadline] = useState("");
  const [description, setDescription] = useState("");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountedPrice, setDiscountedPrice] = useState("");
  const [buttonText, setButtonText] = useState("Add to Order");
  const [declineText, setDeclineText] = useState("No thanks");
  const [isActive, setIsActive] = useState(true);
  const [landingPageJson, setLandingPageJson] = useState<any[]>([]);

  useEffect(() => {
    if (bump) {
      setName(bump.name);
      setTriggerProductType(bump.triggerProductType as any);
      setTriggerProductId(bump.triggerProductId);
      setBumpProductType(bump.bumpProductType as any);
      setBumpProductId(bump.bumpProductId);
      setPlacement(bump.placement as any);
      setHeadline(bump.headline ?? "");
      setDescription(bump.description ?? "");
      setDiscountPercent(bump.discountPercent ?? 0);
      setDiscountedPrice(bump.discountedPrice ?? "");
      setButtonText(bump.buttonText ?? "Add to Order");
      setDeclineText(bump.declineText ?? "No thanks");
      setIsActive(bump.isActive);
      setLandingPageJson(bump.landingPageJson ? (bump.landingPageJson as any[]) : []);
    }
  }, [bump]);

  const getProducts = (type: string) => {
    if (type === "course") return courses.map((c: any) => ({ id: c.id, name: c.title }));
    if (type === "download") return downloads.map((d: any) => ({ id: d.id, name: d.name }));
    return [];
  };

  const handleSave = () => {
    updateMutation.mutate({
      id: bumpId,
      name,
      triggerProductType,
      triggerProductId: triggerProductId!,
      bumpProductType,
      bumpProductId: bumpProductId!,
      placement,
      headline: headline || undefined,
      description: description || undefined,
      discountPercent: discountPercent || undefined,
      discountedPrice: discountedPrice || undefined,
      buttonText,
      declineText,
      isActive,
      landingPageJson,
    });
  };

  if (!bump && bumpQuery.isLoading) {
    return <div className="p-6 text-center text-muted-foreground">Loading...</div>;
  }

  if (!bump) {
    return <div className="p-6 text-center text-muted-foreground">Order bump not found</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/sales/order-bumps")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <h1 className="text-xl font-bold">{name || "Edit Order Bump"}</h1>
          <Badge variant={isActive ? "default" : "secondary"}>
            {isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 mr-4">
            <Label htmlFor="active-toggle" className="text-sm">Active</Label>
            <Switch id="active-toggle" checked={isActive} onCheckedChange={setIsActive} />
          </div>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            <Save className="w-4 h-4 mr-2" />
            {updateMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total Views</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold text-green-600">{stats.accepted}</p>
              <p className="text-xs text-muted-foreground">Accepted</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold text-red-500">{stats.declined}</p>
              <p className="text-xs text-muted-foreground">Declined</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{stats.rate}%</p>
              <p className="text-xs text-muted-foreground">Conversion Rate</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="landing-page">Landing Page</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-6 mt-4">
          <Card>
            <CardHeader><CardTitle>Bump Configuration</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Name (internal)</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
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
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
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
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
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
                    <SelectItem value="before_checkout">Before Checkout (interstitial page before payment)</SelectItem>
                    <SelectItem value="during_checkout">During Checkout (shown on the payment page)</SelectItem>
                    <SelectItem value="after_checkout">After Checkout (redirect after successful payment)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {placement === "before_checkout" && "Customer sees the offer page before being redirected to Stripe checkout."}
                  {placement === "during_checkout" && "Offer is displayed as a checkbox/card on the Stripe checkout page."}
                  {placement === "after_checkout" && "Customer is redirected to the offer page after completing payment."}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Offer Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Headline</Label>
                <Input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Wait! Special one-time offer..." />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe why they should add this..." rows={3} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Discount %</Label>
                  <Input type="number" min={0} max={100} value={discountPercent} onChange={(e) => setDiscountPercent(Number(e.target.value))} />
                </div>
                <div>
                  <Label>Or Fixed Price</Label>
                  <Input value={discountedPrice} onChange={(e) => setDiscountedPrice(e.target.value)} placeholder="e.g., $19.99" />
                </div>
                <div>
                  <Label>Button Text</Label>
                  <Input value={buttonText} onChange={(e) => setButtonText(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Decline Text</Label>
                <Input value={declineText} onChange={(e) => setDeclineText(e.target.value)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="landing-page" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Bump Landing Page</CardTitle>
              <p className="text-sm text-muted-foreground">
                Design the page customers see when the order bump is presented. 
                This is used for "Before Checkout" and "After Checkout" placements.
              </p>
            </CardHeader>
            <CardContent>
              <WysiwygPageBuilder
                initialBlocks={landingPageJson}
                onChange={(blocks: any[]) => setLandingPageJson(blocks)}
                onSave={(blocks: any[]) => {
                  setLandingPageJson(blocks);
                  toast.success("Landing page saved");
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
