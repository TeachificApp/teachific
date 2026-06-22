/**
 * CheckoutPageEditor — generic checkout page configurator.
 * Works for ALL content types: course | download | physical_product | webinar | membership | membership_plan
 *
 * Props:
 *   contentType  — one of the CONTENT_TYPES enum values
 *   contentId    — numeric DB id of the content entity
 *   orgId        — org the content belongs to
 *   primaryColor — default primary color from the content (pre-fills color picker)
 *   accentColor  — default accent color
 */
import React, { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Shield,
  Lock,
  Star,
  Check,
  Award,
  RefreshCw,
  Zap,
  GripVertical,
  Plus,
  Trash2,
  Save,
  Download,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ContentType =
  | "course"
  | "download"
  | "physical_product"
  | "webinar"
  | "membership"
  | "membership_plan"
  | "bundle";

export interface TrustBadge {
  id: string;
  icon: "shield" | "lock" | "star" | "check" | "award" | "refresh" | "zap";
  label: string;
  enabled: boolean;
}

export interface CheckoutPageConfig {
  header: {
    enabled: boolean;
    headline?: string;
    subheadline?: string;
    bgColor?: string;
    bgImageUrl?: string;
  };
  contentInfo: {
    enabled: boolean;
    showCoverImage?: boolean;
    showDescription?: boolean;
    showInstructor?: boolean;
    showLessonCount?: boolean;
    showSubtitle?: boolean;
  };
  trustBadges: {
    enabled: boolean;
    badges: TrustBadge[];
  };
  paymentForm: {
    enabled: boolean;
    submitButtonText?: string;
    showPromoCode?: boolean;
  };
  footer: {
    enabled: boolean;
    text?: string;
    links?: Array<{ label: string; url: string }>;
  };
  sectionsOrder: string[];
  primaryColor?: string;
  accentColor?: string;
  bgColor?: string;
}

const BADGE_ICONS: Record<string, React.ReactNode> = {
  shield:  <Shield className="w-4 h-4" />,
  lock:    <Lock className="w-4 h-4" />,
  star:    <Star className="w-4 h-4" />,
  check:   <Check className="w-4 h-4" />,
  award:   <Award className="w-4 h-4" />,
  refresh: <RefreshCw className="w-4 h-4" />,
  zap:     <Zap className="w-4 h-4" />,
};

const ICON_OPTIONS = ["shield", "lock", "star", "check", "award", "refresh", "zap"] as const;

const DEFAULT_CONFIG: CheckoutPageConfig = {
  header: { enabled: true, headline: "", subheadline: "" },
  contentInfo: {
    enabled: true,
    showCoverImage: true,
    showDescription: true,
    showInstructor: true,
    showLessonCount: true,
    showSubtitle: true,
  },
  trustBadges: {
    enabled: true,
    badges: [
      { id: "secure",    icon: "lock",   label: "Secure Checkout",  enabled: true },
      { id: "guarantee", icon: "shield", label: "30-Day Guarantee", enabled: true },
      { id: "instant",   icon: "zap",    label: "Instant Access",   enabled: true },
    ],
  },
  paymentForm: { enabled: true, submitButtonText: "Buy Now", showPromoCode: true },
  footer: { enabled: true, text: "" },
  sectionsOrder: ["header", "contentInfo", "trustBadges", "paymentForm", "footer"],
};

const SECTION_LABELS: Record<string, string> = {
  header:      "Header Banner",
  contentInfo: "Content Info",
  trustBadges: "Trust Badges",
  paymentForm: "Payment Form",
  footer:      "Footer",
};

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  course:           "Course",
  download:         "Digital Download",
  physical_product: "Physical Product",
  webinar:          "Webinar",
  membership:       "Membership",
  membership_plan:  "Membership Plan",
  bundle:           "Bundle",
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface CheckoutPageEditorProps {
  contentType: ContentType;
  contentId: number;
  orgId: number;
  primaryColor?: string;
  accentColor?: string;
  contentSlug?: string;
}

// ─── Section accordion wrapper ────────────────────────────────────────────────

function SectionCard({
  title,
  enabled,
  onToggle,
  children,
}: {
  title: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Card className="border border-border">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Badge variant={enabled ? "default" : "secondary"} className="text-xs">
              {enabled ? "Visible" : "Hidden"}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={enabled} onCheckedChange={onToggle} />
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(o => !o)}>
              {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      {open && enabled && (
        <CardContent className="pt-0 pb-4 px-4 space-y-3">
          {children}
        </CardContent>
      )}
    </Card>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CheckoutPageEditor({
  contentType,
  contentId,
  orgId,
  primaryColor: defaultPrimary = "#179ca3",
  accentColor: defaultAccent = "#0d9488",
  contentSlug,
}: CheckoutPageEditorProps) {
  const [config, setConfig] = useState<CheckoutPageConfig>(DEFAULT_CONFIG);
  const [dirty, setDirty] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [importTemplateOpen, setImportTemplateOpen] = useState(false);

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: savedConfig, isLoading } = trpc.lmsCheckoutAdmin.getCheckoutPageConfig.useQuery(
    { contentType, contentId },
    { enabled: contentId > 0 }
  );

  const { data: templates = [] } = trpc.lmsCheckoutAdmin.listCheckoutTemplates.useQuery(
    { orgId },
    { enabled: orgId > 0 }
  );

  const utils = trpc.useUtils();

  // ── Mutations ─────────────────────────────────────────────────────────────
  const saveMutation = trpc.lmsCheckoutAdmin.saveCheckoutPageConfig.useMutation({
    onSuccess: () => {
      toast.success("Checkout page saved");
      setDirty(false);
      utils.lmsCheckoutAdmin.getCheckoutPageConfig.invalidate({ contentType, contentId });
    },
    onError: (e) => toast.error("Failed to save: " + e.message),
  });

  const saveTemplateMutation = trpc.lmsCheckoutAdmin.saveCheckoutTemplate.useMutation({
    onSuccess: () => {
      toast.success("Template saved");
      setSaveTemplateOpen(false);
      setTemplateName("");
      utils.lmsCheckoutAdmin.listCheckoutTemplates.invalidate({ orgId });
    },
    onError: (e) => toast.error("Failed to save template: " + e.message),
  });

  const deleteTemplateMutation = trpc.lmsCheckoutAdmin.deleteCheckoutTemplate.useMutation({
    onSuccess: () => {
      toast.success("Template deleted");
      utils.lmsCheckoutAdmin.listCheckoutTemplates.invalidate({ orgId });
    },
  });

  const importTemplateMutation = trpc.lmsCheckoutAdmin.importCheckoutTemplate.useMutation({
    onSuccess: (data) => {
      if (data.config) setConfig(data.config as CheckoutPageConfig);
      toast.success("Template imported");
      setImportTemplateOpen(false);
      setDirty(true);
    },
    onError: (e) => toast.error("Failed to import template: " + e.message),
  });

  // ── Sync saved config ─────────────────────────────────────────────────────
  useEffect(() => {
    if (savedConfig) {
      setConfig({
        ...DEFAULT_CONFIG,
        ...(savedConfig as any),
        primaryColor: (savedConfig as any).primaryColor ?? defaultPrimary,
        accentColor:  (savedConfig as any).accentColor  ?? defaultAccent,
      });
    } else if (!isLoading) {
      setConfig(prev => ({
        ...prev,
        primaryColor: defaultPrimary,
        accentColor:  defaultAccent,
      }));
    }
  }, [savedConfig, isLoading, defaultPrimary, defaultAccent]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const update = useCallback((fn: (c: CheckoutPageConfig) => CheckoutPageConfig) => {
    setConfig(fn);
    setDirty(true);
  }, []);

  const handleSave = () => {
    saveMutation.mutate({
      contentType,
      contentId,
      orgId,
      header:       config.header,
      contentInfo:  config.contentInfo,
      trustBadges:  config.trustBadges,
      paymentForm:  config.paymentForm,
      footer:       config.footer,
      sectionsOrder: config.sectionsOrder,
      primaryColor: config.primaryColor,
      accentColor:  config.accentColor,
      bgColor:      config.bgColor,
    });
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim()) return;
    saveTemplateMutation.mutate({
      name: templateName.trim(),
      orgId,
      header:       config.header,
      contentInfo:  config.contentInfo,
      trustBadges:  config.trustBadges,
      paymentForm:  config.paymentForm,
      footer:       config.footer,
      sectionsOrder: config.sectionsOrder,
    });
  };

  const handleImportTemplate = (templateId: number) => {
    importTemplateMutation.mutate({ contentType, contentId, orgId, templateId });
  };

  const addBadge = () => {
    update(c => ({
      ...c,
      trustBadges: {
        ...c.trustBadges,
        badges: [
          ...c.trustBadges.badges,
          { id: Date.now().toString(), icon: "check", label: "New Badge", enabled: true },
        ],
      },
    }));
  };

  const updateBadge = (idx: number, patch: Partial<TrustBadge>) => {
    update(c => ({
      ...c,
      trustBadges: {
        ...c.trustBadges,
        badges: c.trustBadges.badges.map((b, i) => i === idx ? { ...b, ...patch } : b),
      },
    }));
  };

  const removeBadge = (idx: number) => {
    update(c => ({
      ...c,
      trustBadges: {
        ...c.trustBadges,
        badges: c.trustBadges.badges.filter((_, i) => i !== idx),
      },
    }));
  };

  const checkoutUrl = contentSlug
    ? `${window.location.origin}/checkout/${contentType}/${contentSlug}`
    : null;

  if (isLoading) {
    return <div className="p-6 text-muted-foreground text-sm">Loading checkout config…</div>;
  }

  return (
    <div className="space-y-5">
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-base font-semibold">
            Checkout Page — {CONTENT_TYPE_LABELS[contentType]}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Customise the hosted checkout page shown to buyers.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {checkoutUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { navigator.clipboard.writeText(checkoutUrl); toast.success("Checkout link copied!"); }}
            >
              <Copy className="w-3.5 h-3.5 mr-1.5" />
              Copy Checkout Link
            </Button>
          )}
          {checkoutUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={checkoutUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                Preview
              </a>
            </Button>
          )}

          {/* Save as template */}
          <Dialog open={saveTemplateOpen} onOpenChange={setSaveTemplateOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Save className="w-3.5 h-3.5 mr-1.5" />
                Save as Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Save as Template</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <Label>Template Name</Label>
                <Input
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)}
                  placeholder="e.g. Dark Minimal"
                />
                <Button
                  className="w-full"
                  onClick={handleSaveTemplate}
                  disabled={!templateName.trim() || saveTemplateMutation.isPending}
                >
                  {saveTemplateMutation.isPending ? "Saving…" : "Save Template"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Import template */}
          <Dialog open={importTemplateOpen} onOpenChange={setImportTemplateOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Import Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Import Template</DialogTitle>
              </DialogHeader>
              {templates.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No saved templates yet.</p>
              ) : (
                <div className="space-y-2 pt-2 max-h-72 overflow-y-auto">
                  {templates.map((t: any) => (
                    <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50">
                      <div>
                        <p className="text-sm font-medium">{t.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(t.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleImportTemplate(t.id)}
                          disabled={importTemplateMutation.isPending}
                        >
                          Import
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteTemplateMutation.mutate({ templateId: t.id })}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </DialogContent>
          </Dialog>

          <Button
            size="sm"
            onClick={handleSave}
            disabled={!dirty || saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving…" : dirty ? "Save Changes" : "Saved"}
          </Button>
        </div>
      </div>

      {/* ── Global Colors ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-medium">Global Colors</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 pb-4 px-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Primary Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={config.primaryColor ?? defaultPrimary}
                  onChange={e => update(c => ({ ...c, primaryColor: e.target.value }))}
                  className="w-8 h-8 rounded cursor-pointer border border-border"
                />
                <Input
                  value={config.primaryColor ?? defaultPrimary}
                  onChange={e => update(c => ({ ...c, primaryColor: e.target.value }))}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Accent Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={config.accentColor ?? defaultAccent}
                  onChange={e => update(c => ({ ...c, accentColor: e.target.value }))}
                  className="w-8 h-8 rounded cursor-pointer border border-border"
                />
                <Input
                  value={config.accentColor ?? defaultAccent}
                  onChange={e => update(c => ({ ...c, accentColor: e.target.value }))}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Background Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={config.bgColor ?? "#ffffff"}
                  onChange={e => update(c => ({ ...c, bgColor: e.target.value }))}
                  className="w-8 h-8 rounded cursor-pointer border border-border"
                />
                <Input
                  value={config.bgColor ?? "#ffffff"}
                  onChange={e => update(c => ({ ...c, bgColor: e.target.value }))}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Sections ────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
          Page Sections
        </p>

        {/* Header */}
        <SectionCard
          title={SECTION_LABELS.header}
          enabled={config.header.enabled}
          onToggle={v => update(c => ({ ...c, header: { ...c.header, enabled: v } }))}
        >
          <div className="space-y-2">
            <div>
              <Label className="text-xs">Headline</Label>
              <Input
                value={config.header.headline ?? ""}
                onChange={e => update(c => ({ ...c, header: { ...c.header, headline: e.target.value } }))}
                placeholder="e.g. Enroll in this course today"
                className="mt-1 h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Sub-headline</Label>
              <Input
                value={config.header.subheadline ?? ""}
                onChange={e => update(c => ({ ...c, header: { ...c.header, subheadline: e.target.value } }))}
                placeholder="e.g. Limited time offer"
                className="mt-1 h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Header Background Color</Label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="color"
                  value={config.header.bgColor ?? config.primaryColor ?? defaultPrimary}
                  onChange={e => update(c => ({ ...c, header: { ...c.header, bgColor: e.target.value } }))}
                  className="w-8 h-8 rounded cursor-pointer border border-border"
                />
                <Input
                  value={config.header.bgColor ?? ""}
                  onChange={e => update(c => ({ ...c, header: { ...c.header, bgColor: e.target.value } }))}
                  placeholder="inherit from primary"
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Content Info */}
        <SectionCard
          title={SECTION_LABELS.contentInfo}
          enabled={config.contentInfo.enabled}
          onToggle={v => update(c => ({ ...c, contentInfo: { ...c.contentInfo, enabled: v } }))}
        >
          <div className="grid grid-cols-2 gap-2">
            {[
              ["showCoverImage",  "Cover Image"],
              ["showSubtitle",    "Subtitle"],
              ["showDescription", "Description"],
              ["showInstructor",  "Instructor"],
              ["showLessonCount", "Lesson Count"],
            ].map(([key, label]) => (
              <div key={key} className="flex items-center gap-2">
                <Switch
                  checked={(config.contentInfo as any)[key] ?? true}
                  onCheckedChange={v => update(c => ({ ...c, contentInfo: { ...c.contentInfo, [key]: v } }))}
                  className="scale-90"
                />
                <Label className="text-xs">{label}</Label>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Trust Badges */}
        <SectionCard
          title={SECTION_LABELS.trustBadges}
          enabled={config.trustBadges.enabled}
          onToggle={v => update(c => ({ ...c, trustBadges: { ...c.trustBadges, enabled: v } }))}
        >
          <div className="space-y-2">
            {config.trustBadges.badges.map((badge, idx) => (
              <div key={badge.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/40">
                <Switch
                  checked={badge.enabled}
                  onCheckedChange={v => updateBadge(idx, { enabled: v })}
                  className="scale-90 shrink-0"
                />
                <Select
                  value={badge.icon}
                  onValueChange={v => updateBadge(idx, { icon: v as any })}
                >
                  <SelectTrigger className="w-24 h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ICON_OPTIONS.map(icon => (
                      <SelectItem key={icon} value={icon}>
                        <span className="flex items-center gap-1.5">
                          {BADGE_ICONS[icon]}
                          <span className="capitalize">{icon}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={badge.label}
                  onChange={e => updateBadge(idx, { label: e.target.value })}
                  className="h-7 text-xs flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                  onClick={() => removeBadge(idx)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addBadge} className="w-full mt-1">
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add Badge
            </Button>
          </div>
        </SectionCard>

        {/* Payment Form */}
        <SectionCard
          title={SECTION_LABELS.paymentForm}
          enabled={config.paymentForm.enabled}
          onToggle={v => update(c => ({ ...c, paymentForm: { ...c.paymentForm, enabled: v } }))}
        >
          <div className="space-y-2">
            <div>
              <Label className="text-xs">Submit Button Text</Label>
              <Input
                value={config.paymentForm.submitButtonText ?? "Buy Now"}
                onChange={e => update(c => ({ ...c, paymentForm: { ...c.paymentForm, submitButtonText: e.target.value } }))}
                className="mt-1 h-8 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={config.paymentForm.showPromoCode ?? true}
                onCheckedChange={v => update(c => ({ ...c, paymentForm: { ...c.paymentForm, showPromoCode: v } }))}
                className="scale-90"
              />
              <Label className="text-xs">Show Promo Code Field</Label>
            </div>
          </div>
        </SectionCard>

        {/* Footer */}
        <SectionCard
          title={SECTION_LABELS.footer}
          enabled={config.footer.enabled}
          onToggle={v => update(c => ({ ...c, footer: { ...c.footer, enabled: v } }))}
        >
          <div>
            <Label className="text-xs">Footer Text</Label>
            <Textarea
              value={config.footer.text ?? ""}
              onChange={e => update(c => ({ ...c, footer: { ...c.footer, text: e.target.value } }))}
              placeholder="e.g. © 2025 Your Company. All rights reserved."
              rows={2}
              className="mt-1 text-sm"
            />
          </div>
        </SectionCard>
      </div>

      {/* ── Save button (bottom) ─────────────────────────────────────────── */}
      <div className="flex justify-end pt-2">
        <Button
          onClick={handleSave}
          disabled={!dirty || saveMutation.isPending}
          className="min-w-32"
        >
          {saveMutation.isPending ? "Saving…" : dirty ? "Save Changes" : "Saved"}
        </Button>
      </div>
    </div>
  );
}
