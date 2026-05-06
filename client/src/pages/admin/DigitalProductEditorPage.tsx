import { useState, useEffect, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { getOrgShopUrl } from "@/lib/orgUrl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WysiwygPageBuilder as PageBuilder } from "@/components/WysiwygPageBuilder";
import type { Block } from "@/components/WysiwygPageBuilder";
import {
  ArrowLeft,
  Upload,
  Trash2,
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
        <Button variant="ghost" size="icon" onClick={onDelete} className="text-destructive hover:text-destructive">
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Label (shown to buyer)</Label>
          <Input
            value={price.label}
            onChange={(e) => onChange({ ...price, label: e.target.value })}
            placeholder="e.g. Full Access"
          />
        </div>
        <div>
          <Label className="text-xs">Type</Label>
          <select
            className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
            value={price.type}
            onChange={(e) => onChange({ ...price, type: e.target.value as "one_time" | "payment_plan" })}
          >
            <option value="one_time">Single Payment</option>
            <option value="payment_plan">Payment Plan</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Amount (USD)</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={price.amount}
            onChange={(e) => onChange({ ...price, amount: e.target.value })}
            placeholder="29.99"
          />
        </div>
        <div>
          <Label className="text-xs">Currency</Label>
          <Input
            value={price.currency}
            onChange={(e) => onChange({ ...price, currency: e.target.value })}
            placeholder="USD"
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

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function DigitalProductEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const isNew = id === "new";
  const productId = isNew ? null : Number(id);

  // Get orgId from URL query params for new products
  const orgId = isNew
    ? Number(new URLSearchParams(window.location.search).get("orgId") ?? "0")
    : undefined;

  const { data: myOrgs } = trpc.orgs.myOrgs.useQuery();
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
  const [salesPageBlocks, setSalesPageBlocks] = useState<Block[]>([]);
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

  // No longer using presigned PUT — uploads go through /api/media-upload server proxy
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
        });
        savedProductId = (created as any).id;
        // Save prices
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
        });
        // Save prices
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

  const org = myOrgs?.[0];
  const shopUrl = org && slug
    ? getOrgShopUrl(org.slug, slug, org.customDomain, org.domainVerificationStatus)
    : `${window.location.origin}/shop/${slug}`;

  const copyShopUrl = () => {
    navigator.clipboard.writeText(shopUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="container py-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/downloads")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{isNew ? "New Digital Product" : (title || "Edit Product")}</h1>
            {!isNew && (
              <p className="text-sm text-muted-foreground">
                <Badge variant={isPublished ? "default" : "secondary"} className="mr-2">
                  {isPublished ? "Published" : "Draft"}
                </Badge>
                Last saved automatically
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && (
            <>
              <Button variant="outline" size="sm" onClick={copyShopUrl}>
                {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                {copied ? "Copied!" : "Copy Sales URL"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(shopUrl, "_blank")}
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                Preview as Customer
              </Button>
            </>
          )}
          <Button onClick={handleSave} disabled={createProduct.isPending || updateProduct.isPending}>
            <Save className="w-4 h-4 mr-2" />
            {isNew ? "Create Product" : "Save Changes"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="details">
        <TabsList className="mb-6">
          <TabsTrigger value="details">Details & File</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="sales-page">Sales Page</TabsTrigger>
          <TabsTrigger value="access">Access Controls</TabsTrigger>
        </TabsList>

        {/* ── Details & File ─────────────────────────────────────────────── */}
        <TabsContent value="details" className="space-y-6">
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
        </TabsContent>

        {/* ── Pricing ────────────────────────────────────────────────────── */}
        <TabsContent value="pricing" className="space-y-4">
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
        </TabsContent>

        {/* ── Sales Page ─────────────────────────────────────────────────── */}
        <TabsContent value="sales-page">
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold">Sales Page Builder</h3>
              <p className="text-sm text-muted-foreground">
                Design your product sales page with drag-and-drop blocks. This page will be shown at{" "}
                <span className="font-mono text-xs">/shop/{slug || "your-slug"}</span>.
              </p>
            </div>
            <Button
              className="gap-2 bg-teal-600 hover:bg-teal-700 text-white"
              onClick={() => {
                if (!productId) { toast.error("Save the product first before editing the sales page"); return; }
                navigate(`/admin/downloads/${productId}/page-builder`);
              }}
            >
              <ExternalLink className="h-4 w-4" />
              Open Full-Screen Page Editor
            </Button>
            {salesPageBlocks.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {salesPageBlocks.length} block{salesPageBlocks.length !== 1 ? "s" : ""} configured on this sales page
              </p>
            )}
          </div>
        </TabsContent>

        {/* ── Access Controls ────────────────────────────────────────────── */}
        <TabsContent value="access" className="space-y-6">
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

          <div className="p-4 bg-muted/40 rounded-lg space-y-2">
            <p className="text-sm font-medium">How access controls work:</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Each buyer receives a unique, secure download link via email after purchase.</li>
              <li>The link is validated against the access duration and download count limits.</li>
              <li>Expired or exhausted links show a clear error message to the buyer.</li>
              <li>Admins can manually revoke or extend access from the Orders report.</li>
            </ul>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
