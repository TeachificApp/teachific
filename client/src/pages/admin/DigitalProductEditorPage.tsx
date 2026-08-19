import { useState, useEffect, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { getOrgShopUrl } from "@/lib/orgUrl";
import { useOrgScope } from "@/hooks/useOrgScope";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Block } from "@/components/WysiwygPageBuilder";
import CheckoutPageEditor from "@/components/CheckoutPageEditor";
import {
  ChevronLeft,
  Upload,
  Plus,
  Save,
  Eye,
  ExternalLink,
  Copy,
  Check,
  FileText,
  Video,
  Image as ImageIcon,
  File,
  DollarSign,
  Globe,
  Shield,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── File type icon ────────────────────────────────────────────────────────────
function FileTypeIcon({ type }: { type?: string | null }) {
  if (!type) return <File className="w-5 h-5" />;
  if (type.includes("pdf")) return <FileText className="w-5 h-5 text-red-500" />;
  if (type.includes("video")) return <Video className="w-5 h-5 text-blue-500" />;
  if (type.includes("image")) return <ImageIcon className="w-5 h-5 text-green-500" />;
  return <File className="w-5 h-5 text-muted-foreground" />;
}

// ─── Price row editor ──────────────────────────────────────────────────────────
interface PriceForm {
  id?: number;
  label: string;
  type: "one_time" | "payment_plan";
  amount: string;
  currency: string;
  installments?: number | null;
  installmentAmount?: string | null;
  intervalDays?: number | null;
  isActive: boolean;
}

function PriceEditor({
  price,
  onChange,
  onDelete,
}: {
  price: PriceForm;
  onChange: (p: PriceForm) => void;
  onDelete: () => void;
}) {
  return (
    <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={price.type === "one_time" ? "default" : "secondary"}>
            {price.type === "one_time" ? "Single Payment" : "Payment Plan"}
          </Badge>
          <Switch
            checked={price.isActive}
            onCheckedChange={(v) => onChange({ ...price, isActive: v })}
          />
          <span className="text-xs text-muted-foreground">{price.isActive ? "Active" : "Inactive"}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive hover:text-destructive">
          Remove
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Label</Label>
          <Input value={price.label} onChange={(e) => onChange({ ...price, label: e.target.value })} placeholder="Full Access" />
        </div>
        <div>
          <Label className="text-xs">Type</Label>
          <select
            className="w-full h-9 px-3 text-sm border rounded-md bg-background"
            value={price.type}
            onChange={(e) => onChange({ ...price, type: e.target.value as any })}
          >
            <option value="one_time">One-time</option>
            <option value="payment_plan">Payment Plan</option>
          </select>
        </div>
        <div>
          <Label className="text-xs">Price ({price.currency})</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={price.amount}
            onChange={(e) => onChange({ ...price, amount: e.target.value })}
            placeholder="29.99"
          />
        </div>
      </div>

      {price.type === "payment_plan" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Installments</Label>
            <Input
              type="number"
              min="2"
              value={price.installments ?? ""}
              onChange={(e) => onChange({ ...price, installments: e.target.value ? Number(e.target.value) : null })}
              placeholder="3"
            />
          </div>
          <div>
            <Label className="text-xs">Amount per installment</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={price.installmentAmount ?? ""}
              onChange={(e) => onChange({ ...price, installmentAmount: e.target.value || null })}
              placeholder="10.00"
            />
          </div>
          <div>
            <Label className="text-xs">Interval (days)</Label>
            <Input
              type="number"
              min="1"
              value={price.intervalDays ?? ""}
              onChange={(e) => onChange({ ...price, intervalDays: e.target.value ? Number(e.target.value) : null })}
              placeholder="30"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab definitions ──────────────────────────────────────────────────────────
type TabId = "details" | "pricing" | "sales_page" | "access" | "checkout_page";

const tabs = [
  { id: "details" as const, label: "Details & File", icon: Package },
  { id: "pricing" as const, label: "Pricing", icon: DollarSign },
  { id: "sales_page" as const, label: "Sales Page", icon: Globe },
  { id: "access" as const, label: "Access Controls", icon: Shield },
  { id: "checkout_page" as const, label: "Checkout Page", icon: Globe },
];

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function DigitalProductEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const isNew = id === "new";
  const productId = isNew ? null : Number(id);
  const [activeTab, setActiveTab] = useState<TabId>("details");
  const { orgId, orgs } = useOrgScope();
  const { data: product, refetch } = trpc.lms.downloads.getProduct.useQuery(
    { id: productId! },
    { enabled: !!productId }
  );
  const { data: prices, refetch: refetchPrices } = trpc.lms.downloads.listPrices.useQuery(
    { productId: productId! },
    { enabled: !!productId }
  );

  // Form state
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [fileUrl, setFileUrl] = useState("");
  const [fileKey, setFileKey] = useState("");
  const [fileType, setFileType] = useState("");
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [fileName, setFileName] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [defaultAccessDays, setDefaultAccessDays] = useState<number | null>(null);
  const [defaultMaxDownloads, setDefaultMaxDownloads] = useState<number | null>(null);
  const [enrollmentClosed, setEnrollmentClosed] = useState(false);
  const [salesPageBlocks, setSalesPageBlocks] = useState<Block[]>([]);
  // Checkout purchase terms override
  const [purchaseTermsAgreement, setPurchaseTermsAgreement] = useState("");
  const [purchaseTermsLink1Label, setPurchaseTermsLink1Label] = useState("");
  const [purchaseTermsLink1Url, setPurchaseTermsLink1Url] = useState("");
  const [purchaseTermsLink2Label, setPurchaseTermsLink2Label] = useState("");
  const [purchaseTermsLink2Url, setPurchaseTermsLink2Url] = useState("");
  const [priceList, setPriceList] = useState<PriceForm[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [copied, setCopied] = useState(false);

  // Populate form from loaded product
  useEffect(() => {
    if (product) {
      setTitle(product.title);
      setSlug(product.slug);
      setDescription(product.description ?? "");
      setIsPublished(product.isPublished ?? false);
      setFileUrl(product.fileUrl ?? "");
      setFileKey(product.fileKey ?? "");
      setFileType(product.fileType ?? "");
      setFileSize(product.fileSize ?? null);
      setFileName(product.fileUrl?.split("/").pop() ?? "");
      setThumbnailUrl(product.thumbnailUrl ?? "");
      setDefaultAccessDays(product.defaultAccessDays ?? null);
      setDefaultMaxDownloads(product.defaultMaxDownloads ?? null);
      setEnrollmentClosed((product as any).enrollmentClosed ?? false);
      setPurchaseTermsAgreement((product as any).purchaseTermsAgreement ?? "");
      setPurchaseTermsLink1Label((product as any).purchaseTermsLink1Label ?? "");
      setPurchaseTermsLink1Url((product as any).purchaseTermsLink1Url ?? "");
      setPurchaseTermsLink2Label((product as any).purchaseTermsLink2Label ?? "");
      setPurchaseTermsLink2Url((product as any).purchaseTermsLink2Url ?? "");
      try {
        const blocks = product.salesPageBlocksJson
          ? JSON.parse(product.salesPageBlocksJson as string)
          : [];
        setSalesPageBlocks(Array.isArray(blocks) ? blocks : []);
      } catch {
        setSalesPageBlocks([]);
      }
    }
  }, [product]);

  useEffect(() => {
    if (prices) {
      setPriceList(
        prices.map((p) => ({
          id: p.id,
          label: p.label,
          type: p.type as "one_time" | "payment_plan",
          amount: p.amount,
          currency: p.currency ?? "USD",
          installments: p.installments ?? null,
          installmentAmount: p.installmentAmount ?? null,
          intervalDays: p.intervalDays ?? null,
          isActive: p.isActive ?? true,
        }))
      );
    }
  }, [prices]);

  // Auto-generate slug from title
  useEffect(() => {
    if (isNew && title && !slug) {
      setSlug(
        title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
      );
    }
  }, [title, isNew, slug]);

  const createProduct = trpc.lms.downloads.createProduct.useMutation();
  const updateProduct = trpc.lms.downloads.updateProduct.useMutation();
  const upsertPrice = trpc.lms.downloads.upsertPrice.useMutation();
  const deletePrice = trpc.lms.downloads.deletePrice.useMutation();

  const handleFileUpload = useCallback(
    async (file: File) => {
      const effectiveOrgId = orgId ?? product?.orgId;
      if (!effectiveOrgId) {
        toast.error("Organization not found");
        return;
      }
      setUploading(true);
      setUploadProgress(0);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("orgId", String(effectiveOrgId));
        formData.append("folder", "downloads");
        const xhr = new XMLHttpRequest();
        const result = await new Promise<{ key: string; url: string }>((resolve, reject) => {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
          };
          xhr.onload = () => {
            if (xhr.status < 300) {
              try { resolve(JSON.parse(xhr.responseText)); }
              catch { reject(new Error("Invalid response from server")); }
            } else {
              reject(new Error(`Upload failed: ${xhr.status}`));
            }
          };
          xhr.onerror = () => reject(new Error("Upload failed"));
          xhr.open("POST", "/api/media-upload");
          xhr.withCredentials = true;
          xhr.send(formData);
        });
        setFileUrl(result.url);
        setFileKey(result.key);
        setFileType(file.type);
        setFileSize(file.size);
        setFileName(file.name);
        toast.success("File uploaded successfully");
      } catch (e: any) {
        toast.error(e.message ?? "Upload failed");
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
    },
    [orgId, product?.orgId]
  );

  const handleSave = async () => {
    if (!title.trim()) { toast.error("Title is required"); return; }
    if (!slug.trim()) { toast.error("Slug is required"); return; }
    if (!fileUrl && isNew) { toast.error("Please upload a file first"); return; }

    try {
      let savedProductId = productId;

      if (isNew) {
        const created = await createProduct.mutateAsync({
          orgId: orgId!,
          title,
          slug,
          description,
          fileUrl,
          fileKey,
          fileType,
          fileSize: fileSize ?? undefined,
          thumbnailUrl: thumbnailUrl || undefined,
          defaultAccessDays,
          defaultMaxDownloads,
          enrollmentClosed,
        });
        savedProductId = (created as any).id;
        for (const p of priceList) {
          await upsertPrice.mutateAsync({ ...p, productId: savedProductId! });
        }
        toast.success("Product created");
        navigate(`/admin/downloads/${savedProductId}`);
      } else {
        await updateProduct.mutateAsync({
          id: productId!,
          title,
          slug,
          description,
          fileUrl: fileUrl || undefined,
          fileKey: fileKey || undefined,
          fileType: fileType || undefined,
          fileSize: fileSize ?? undefined,
          thumbnailUrl: thumbnailUrl || undefined,
          salesPageBlocksJson: salesPageBlocks,
          isPublished,
          defaultAccessDays,
          defaultMaxDownloads,
          enrollmentClosed,
          purchaseTermsAgreement: purchaseTermsAgreement.trim() || null,
          purchaseTermsLink1Label: purchaseTermsLink1Label.trim() || null,
          purchaseTermsLink1Url: purchaseTermsLink1Url.trim() || null,
          purchaseTermsLink2Label: purchaseTermsLink2Label.trim() || null,
          purchaseTermsLink2Url: purchaseTermsLink2Url.trim() || null,
        });
        for (const p of priceList) {
          await upsertPrice.mutateAsync({ ...p, productId: productId! });
        }
        refetch();
        refetchPrices();
        toast.success("Product saved");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    }
  };

  const addPrice = () => {
    setPriceList((prev) => [
      ...prev,
      { label: "Full Access", type: "one_time", amount: "0.00", currency: "USD", isActive: true },
    ]);
  };

  const removePrice = async (idx: number) => {
    const p = priceList[idx];
    if (p.id && productId) {
      await deletePrice.mutateAsync({ id: p.id, productId });
    }
    setPriceList((prev) => prev.filter((_, i) => i !== idx));
  };

  const org = orgs.find((candidate: any) => candidate.id === orgId);
  const shopUrl = org && slug
    ? getOrgShopUrl(org.slug, slug, org.customDomain, org.domainVerificationStatus)
    : `${window.location.origin}/shop/${slug}`;

  const copyShopUrl = () => {
    navigator.clipboard.writeText(shopUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Loading state
  if (!isNew && !product) {
    return (
      <div className="flex flex-col h-full p-6 gap-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin/downloads")}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold leading-tight">
                {isNew ? "New Digital Product" : (title || "Edit Product")}
              </h1>
              {!isNew && (
                <Badge
                  variant="outline"
                  className={
                    isPublished
                      ? "text-green-600 border-green-300 bg-green-50 dark:bg-green-900/20"
                      : "text-yellow-600 border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20"
                  }
                >
                  {isPublished ? "Published" : "Draft"}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && (
            <>
              <Button variant="outline" size="sm" onClick={copyShopUrl} className="gap-1.5">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied!" : "Copy Sales URL"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => window.open(shopUrl, "_blank")}
              >
                <Eye className="h-3.5 w-3.5" />
                Preview
              </Button>
            </>
          )}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={createProduct.isPending || updateProduct.isPending}
            className="gap-1.5"
          >
            <Save className="h-3.5 w-3.5" />
            {isNew ? "Create" : "Save"}
          </Button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-0 px-2 sm:px-6 border-b border-border bg-background overflow-x-auto scrollbar-none">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === "details" && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Product Title *</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Ultimate Study Guide" />
              </div>
              <div className="space-y-2">
                <Label>Slug (URL path) *</Label>
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                  placeholder="ultimate-study-guide"
                />
                <p className="text-xs text-muted-foreground">
                  Sales page: <span className="font-mono">/shop/{slug || "your-slug"}</span>
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Describe what buyers will receive…"
              />
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <Label>Product File *</Label>
              {fileUrl ? (
                <div className="border rounded-lg p-4 flex items-center gap-3">
                  <FileTypeIcon type={fileType} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{fileName || fileUrl.split("/").pop()}</p>
                    <p className="text-xs text-muted-foreground">
                      {fileType} · {fileSize ? `${(fileSize / (1024 * 1024)).toFixed(1)} MB` : ""}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFileUrl("");
                      setFileKey("");
                      setFileType("");
                      setFileSize(null);
                      setFileName("");
                    }}
                  >
                    Replace
                  </Button>
                </div>
              ) : (
                <label
                  className={cn(
                    "flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-10 cursor-pointer transition-colors",
                    uploading ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
                  )}
                >
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.mp4,.mov,.avi,.jpg,.jpeg,.png,.gif,.webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                    }}
                    disabled={uploading}
                  />
                  <Upload className="w-8 h-8 text-muted-foreground mb-3" />
                  <p className="font-medium">
                    {uploading ? `Uploading… ${uploadProgress}%` : "Click to upload or drag & drop"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF, Word, Excel, PowerPoint, ZIP, Video, Image
                  </p>
                  {uploading && (
                    <div className="w-full max-w-xs mt-3 bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  )}
                </label>
              )}
            </div>

            {/* Thumbnail */}
            <div className="space-y-2">
              <Label>Thumbnail Image URL (optional)</Label>
              <Input
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
                placeholder="https://…"
              />
              {thumbnailUrl && (
                <img src={thumbnailUrl} alt="Thumbnail" className="w-32 h-20 object-cover rounded border" />
              )}
            </div>

            {/* Visibility */}
            {!isNew && (
              <div className="p-4 border rounded-lg space-y-2">
                <Label className="text-sm font-medium">Visibility</Label>
                <select
                  className="w-full h-9 px-3 text-sm border rounded-md bg-background"
                  value={isPublished ? "published" : "draft"}
                  onChange={(e) => setIsPublished(e.target.value === "published" || e.target.value === "hidden")}
                >
                  <option value="draft">Draft — Not visible to anyone</option>
                  <option value="published">Published — Visible in public directory</option>
                  <option value="hidden">Hidden — Accessible via URL only</option>
                  <option value="private">Private — Email invite only</option>
                  <option value="archived">Archived — No longer available</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  {isPublished
                    ? "Sales page is live and buyers can purchase."
                    : "Sales page is hidden from public."}
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === "pricing" && (
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Pricing Options</h3>
                <p className="text-sm text-muted-foreground">
                  Add one or more pricing options. Buyers choose at checkout.
                </p>
              </div>
              <Button variant="outline" onClick={addPrice}>
                <Plus className="w-4 h-4 mr-2" />
                Add Price
              </Button>
            </div>

            {priceList.length === 0 ? (
              <div className="border border-dashed rounded-lg p-8 text-center">
                <p className="text-muted-foreground text-sm">No pricing options yet. Add at least one price.</p>
                <Button variant="outline" className="mt-3" onClick={addPrice}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Price
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {priceList.map((price, idx) => (
                  <PriceEditor
                    key={idx}
                    price={price}
                    onChange={(updated) =>
                      setPriceList((prev) => prev.map((p, i) => (i === idx ? updated : p)))
                    }
                    onDelete={() => removePrice(idx)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "sales_page" && (
          <div className="max-w-3xl mx-auto">
            <div className="border border-border rounded-xl p-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Product Sales Page</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Design a custom landing page for your digital product. This page is shown at{" "}
                  <span className="font-mono text-xs">/shop/{slug || "your-slug"}</span>.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  className="gap-2"
                  onClick={() => {
                    if (!productId) { toast.error("Save the product first before editing the sales page"); return; }
                    navigate(`/admin/downloads/${productId}/page-builder`);
                  }}
                >
                  <ExternalLink className="h-4 w-4" />
                  Open Sales Page Builder
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => window.open(shopUrl, "_blank")}
                >
                  <Eye className="h-4 w-4" />
                  Preview Sales Page
                </Button>
              </div>
              {salesPageBlocks.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {salesPageBlocks.length} block{salesPageBlocks.length !== 1 ? "s" : ""} configured on this sales page
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                The sales page builder opens in full-screen mode. Your changes are saved automatically.
              </p>
            </div>
          </div>
        )}

        {activeTab === "access" && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="download-enrollment-closed" className="font-medium text-amber-900">Enrollment Closed</Label>
                  <p className="mt-1 text-sm text-amber-800">Prevent new purchases while current learners retain their existing access.</p>
                </div>
                <Switch id="download-enrollment-closed" checked={enrollmentClosed} onCheckedChange={setEnrollmentClosed} />
              </div>
            </div>
            <div>
              <h3 className="font-semibold mb-1">Default Access Controls</h3>
              <p className="text-sm text-muted-foreground">
                These limits apply to all orders unless overridden per order. Leave blank for unlimited.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Access Duration (days)</Label>
                <Input
                  type="number"
                  min="1"
                  value={defaultAccessDays ?? ""}
                  onChange={(e) => setDefaultAccessDays(e.target.value ? Number(e.target.value) : null)}
                  placeholder="Leave blank for unlimited"
                />
                <p className="text-xs text-muted-foreground">
                  After purchase, the download link will expire after this many days.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Maximum Downloads</Label>
                <Input
                  type="number"
                  min="1"
                  value={defaultMaxDownloads ?? ""}
                  onChange={(e) => setDefaultMaxDownloads(e.target.value ? Number(e.target.value) : null)}
                  placeholder="Leave blank for unlimited"
                />
                <p className="text-xs text-muted-foreground">
                  Limit how many times a buyer can download the file.
                </p>
              </div>
            </div>

            {/* ── Checkout Terms Override ─────────────────────────────── */}
            <div className="border border-border rounded-lg p-4 space-y-4 bg-muted/20">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" /> Checkout Terms Override
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Override the checkout agreement checkbox for this product. Leave blank to use the org-level default.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Agreement sentence</Label>
                <Textarea
                  value={purchaseTermsAgreement}
                  onChange={e => setPurchaseTermsAgreement(e.target.value)}
                  placeholder="e.g. I have reviewed and agree to the"
                  rows={3}
                  maxLength={2048}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground">Text before the links. Supports basic HTML (&lt;strong&gt;, &lt;em&gt;, &lt;a&gt;).</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Link 1 label</Label>
                  <Input value={purchaseTermsLink1Label} onChange={e => setPurchaseTermsLink1Label(e.target.value)} placeholder="e.g. Terms of Service" className="text-sm h-8" maxLength={255} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Link 1 URL</Label>
                  <Input value={purchaseTermsLink1Url} onChange={e => setPurchaseTermsLink1Url(e.target.value)} placeholder="https://example.com/terms" className="text-sm h-8" maxLength={1024} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Link 2 label</Label>
                  <Input value={purchaseTermsLink2Label} onChange={e => setPurchaseTermsLink2Label(e.target.value)} placeholder="e.g. Privacy Policy" className="text-sm h-8" maxLength={255} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Link 2 URL</Label>
                  <Input value={purchaseTermsLink2Url} onChange={e => setPurchaseTermsLink2Url(e.target.value)} placeholder="https://example.com/privacy" className="text-sm h-8" maxLength={1024} />
                </div>
              </div>
            </div>

            <div className="p-4 bg-muted/40 rounded-lg space-y-2">
              <p className="text-sm font-medium">How access controls work:</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Each buyer receives a unique, secure download link via email after purchase.</li>
                <li>The link is validated against the access duration and download count limits.</li>
                <li>Expired or exhausted links show a clear error message to the buyer.</li>
                <li>Admins can manually revoke or extend access from the Orders report.</li>
              </ul>
            </div>
          </div>
        )}
        {activeTab === "checkout_page" && product && (
          <div className="max-w-3xl mx-auto">
            <CheckoutPageEditor
              contentType="download"
              contentId={product.id}
              orgId={product.orgId ?? 1}
              contentSlug={product.slug}
            />
          </div>
        )}
      </div>
    </div>
  );
}
