import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { EmbedSnippetPanel } from "@/components/EmbedSnippetPanel";
import CheckoutPageEditor from "@/components/CheckoutPageEditor";
import { toast } from "sonner";
import {
  ChevronLeft, Save, Package, BookOpen, DollarSign, Settings,
  Loader2, Tag, BarChart2, Users, Plus, Trash2, Image, Globe,
} from "lucide-react";

export default function BundleEditorPage() {
  const { id } = useParams<{ id: string }>();
  const bundleId = parseInt(id ?? "0");
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const { data: bundle, isLoading } = trpc.lms.bundles.get.useQuery({ id: bundleId }, { enabled: !!bundleId });
  const { data: courses } = trpc.lms.courses.list.useQuery();
  const updateMut = trpc.lms.bundles.update.useMutation({
    onSuccess: () => { utils.lms.bundles.get.invalidate({ id: bundleId }); toast.success("Bundle saved!"); },
    onError: (e) => toast.error(e.message),
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [enrollmentClosed, setEnrollmentClosed] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [selectedCourseIds, setSelectedCourseIds] = useState<number[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (bundle) {
      setName(bundle.name ?? "");
      setDescription(bundle.description ?? "");
      setPrice(String(bundle.price ?? 0));
      setSalePrice(String(bundle.salePrice ?? ""));
      setIsActive(bundle.isActive !== false);
      setEnrollmentClosed((bundle as any).enrollmentClosed ?? false);
      setThumbnailUrl(bundle.thumbnailUrl ?? "");
      try {
        const ids = JSON.parse(bundle.courseIds ?? "[]");
        setSelectedCourseIds(Array.isArray(ids) ? ids : []);
      } catch {
        setSelectedCourseIds([]);
      }
    }
  }, [bundle]);

  const markDirty = () => setDirty(true);

  const handleSave = () => {
    updateMut.mutate({
      id: bundleId,
      data: {
        name,
        description: description || null,
        price: parseFloat(price) || 0,
        salePrice: salePrice ? parseFloat(salePrice) : null,
        isActive,
        enrollmentClosed,
        thumbnailUrl: thumbnailUrl || null,
        courseIds: JSON.stringify(selectedCourseIds),
      },
    });
    setDirty(false);
  };

  const toggleCourse = (courseId: number) => {
    setSelectedCourseIds((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]
    );
    markDirty();
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
        <p>Bundle not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/products/bundles")}>
          Back to Bundles
        </Button>
      </div>
    );
  }

  const selectedCourses = (courses ?? []).filter((c: any) => selectedCourseIds.includes(c.id));
  const totalValue = selectedCourses.reduce((sum: number, c: any) => sum + Number(c.price ?? 0), 0);
  const savings = totalValue - (parseFloat(price) || 0);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/products/bundles")}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{bundle.name}</h1>
          <p className="text-sm text-muted-foreground">{selectedCourseIds.length} course{selectedCourseIds.length !== 1 ? "s" : ""} bundled</p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && <Badge variant="outline" className="text-amber-600 border-amber-300">Unsaved changes</Badge>}
          <Button onClick={handleSave} disabled={updateMut.isPending}>
            {updateMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save
          </Button>
        </div>
      </div>

      <Tabs defaultValue="courses">
        <TabsList className="mb-6">
          <TabsTrigger value="courses"><BookOpen className="w-4 h-4 mr-2" />Courses</TabsTrigger>
          <TabsTrigger value="details"><Settings className="w-4 h-4 mr-2" />Details</TabsTrigger>
          <TabsTrigger value="pricing"><DollarSign className="w-4 h-4 mr-2" />Pricing</TabsTrigger>
          <TabsTrigger value="analytics"><BarChart2 className="w-4 h-4 mr-2" />Analytics</TabsTrigger>
          <TabsTrigger value="checkout_page"><Globe className="w-4 h-4 mr-2" />Checkout Page</TabsTrigger>
          <TabsTrigger value="embed">Embed</TabsTrigger>
        </TabsList>

        {/* ── Courses Tab ── */}
        <TabsContent value="courses">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Select Courses</CardTitle>
              </CardHeader>
              <CardContent>
                {!courses || courses.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No courses available.</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {(courses as any[]).map((course) => (
                      <label
                        key={course.id}
                        className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                      >
                        <Checkbox
                          checked={selectedCourseIds.includes(course.id)}
                          onCheckedChange={() => toggleCourse(course.id)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{course.title}</div>
                          {course.price > 0 && (
                            <div className="text-xs text-muted-foreground">${Number(course.price).toFixed(2)}</div>
                          )}
                        </div>
                        <Badge variant="outline" className="text-xs flex-shrink-0">
                          {course.status ?? "draft"}
                        </Badge>
                      </label>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Bundle Summary</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedCourses.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No courses selected yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedCourses.map((c: any) => (
                      <div key={c.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <span className="text-sm font-medium truncate flex-1">{c.title}</span>
                        <span className="text-sm text-muted-foreground ml-2">${Number(c.price ?? 0).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="pt-2 space-y-1">
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Total individual value</span>
                        <span>${totalValue.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-semibold">
                        <span>Bundle price</span>
                        <span>${(parseFloat(price) || 0).toFixed(2)}</span>
                      </div>
                      {savings > 0 && (
                        <div className="flex justify-between text-sm text-green-600">
                          <span>Customer saves</span>
                          <span>${savings.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Details Tab ── */}
        <TabsContent value="details">
          <Card className="mb-6 border-amber-200 bg-amber-50">
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <div>
                <Label htmlFor="bundle-enrollment-closed" className="font-medium text-amber-900">Enrollment Closed</Label>
                <p className="mt-1 text-sm text-amber-800">Prevent new bundle purchases while retaining access for current learners.</p>
              </div>
              <Switch id="bundle-enrollment-closed" checked={enrollmentClosed} onCheckedChange={(value) => { setEnrollmentClosed(value); markDirty(); }} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <Label>Bundle Name</Label>
                <Input value={name} onChange={(e) => { setName(e.target.value); markDirty(); }} />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea rows={4} value={description} onChange={(e) => { setDescription(e.target.value); markDirty(); }} placeholder="Describe what students get in this bundle..." />
              </div>
              <div>
                <Label>Thumbnail URL</Label>
                <Input value={thumbnailUrl} onChange={(e) => { setThumbnailUrl(e.target.value); markDirty(); }} placeholder="https://..." />
                {thumbnailUrl && (
                  <img src={thumbnailUrl} alt="thumbnail" className="mt-2 w-32 h-20 object-cover rounded border" />
                )}
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={isActive} onCheckedChange={(v) => { setIsActive(v); markDirty(); }} id="bundle-active" />
                <Label htmlFor="bundle-active">Active (visible to students)</Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Pricing Tab ── */}
        <TabsContent value="pricing">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Bundle Price (USD)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">$</span>
                    <Input
                      type="number" min="0" step="0.01"
                      className="pl-7"
                      value={price}
                      onChange={(e) => { setPrice(e.target.value); markDirty(); }}
                    />
                  </div>
                </div>
                <div>
                  <Label>Sale Price (optional)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">$</span>
                    <Input
                      type="number" min="0" step="0.01"
                      className="pl-7"
                      value={salePrice}
                      onChange={(e) => { setSalePrice(e.target.value); markDirty(); }}
                      placeholder="Leave blank for no sale"
                    />
                  </div>
                </div>
              </div>
              {totalValue > 0 && (
                <div className="p-4 rounded-lg bg-muted/50 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Individual course total</span>
                    <span>${totalValue.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>Bundle price</span>
                    <span>${(parseFloat(price) || 0).toFixed(2)}</span>
                  </div>
                  {savings > 0 && (
                    <div className="flex justify-between text-green-600 font-medium">
                      <span>Savings</span>
                      <span>${savings.toFixed(2)} ({Math.round((savings / totalValue) * 100)}% off)</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Analytics Tab ── */}
        <TabsContent value="analytics">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: "Total Enrollments", value: bundle.totalEnrollments ?? 0, icon: Users },
              { label: "Courses in Bundle", value: selectedCourseIds.length, icon: BookOpen },
              { label: "Bundle Price", value: `$${(parseFloat(price) || 0).toFixed(2)}`, icon: DollarSign },
            ].map(({ label, value, icon: Icon }) => (
              <Card key={label}>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <div className="text-xl font-bold">{value}</div>
                      <div className="text-xs text-muted-foreground">{label}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        {/* ── Checkout Page Tab ── */}
        <TabsContent value="checkout_page">
          <div className="max-w-3xl mx-auto">
            <CheckoutPageEditor
              contentType="bundle"
              contentId={bundle.id}
              orgId={(bundle as any).orgId ?? 1}
              contentSlug={String(bundle.id)}
            />
          </div>
        </TabsContent>
        {/* ── Embed Tab ── */}
        <TabsContent value="embed">
          <div className="max-w-2xl space-y-2">
            <h3 className="text-base font-semibold">Embed this Bundle</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Copy the snippet below to embed this bundle on any external website.
            </p>
            <EmbedSnippetPanel
              contentUrl={`/bundles/${bundleId}`}
              title={bundle.name ?? "Bundle"}
              defaultHeight={600}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
