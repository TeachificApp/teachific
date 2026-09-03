/**
 * CertificateSettingsTab — org admin panel for managing certificate templates.
 * Allows orgs to customise logo, colors, signature, footer text.
 * White-label toggle is only visible on Pro/Enterprise plans.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Award, Plus, Pencil, Trash2, Star, Upload, Eye } from "lucide-react";
import { toast } from "sonner";

const WHITE_LABEL_PLANS = ["pro", "enterprise"];

interface Props {
  orgId: number;
}

export function CertificateSettingsTab({ orgId }: Props) {
  const utils = trpc.useUtils();
  const { data: templates, isLoading } = trpc.lms.certificates.templates.list.useQuery({ orgId });
  const { data: sub } = trpc.lms.subscription.get.useQuery({ orgId });
  const plan = sub?.plan ?? "free";
  const canWhiteLabel = WHITE_LABEL_PLANS.includes(plan);

  const createMutation = trpc.lms.certificates.templates.create.useMutation({
    onSuccess: () => { utils.lms.certificates.templates.list.invalidate({ orgId }); toast.success("Template created"); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.lms.certificates.templates.update.useMutation({
    onSuccess: () => { utils.lms.certificates.templates.list.invalidate({ orgId }); toast.success("Template saved"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.lms.certificates.templates.delete.useMutation({
    onSuccess: () => { utils.lms.certificates.templates.list.invalidate({ orgId }); toast.success("Template deleted"); },
    onError: (e) => toast.error(e.message),
  });

  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  function openCreate() {
    setEditingTemplate(null);
    setShowDialog(true);
  }
  function openEdit(tpl: any) {
    setEditingTemplate(tpl);
    setShowDialog(true);
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this certificate template?")) return;
    await deleteMutation.mutateAsync({ id });
  }

  async function handleSetDefault(tpl: any) {
    await updateMutation.mutateAsync({ id: tpl.id, isDefault: true });
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Plan notice */}
      {!canWhiteLabel && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-300">
          <Award className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <strong>Course360 platform attribution</strong> appears on certificates for your current plan ({plan}).{" "}
            <span className="font-medium">Upgrade to Pro or Enterprise</span> to remove it and use fully white-labelled certificates.
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Certificate Templates</h3>
          <p className="text-sm text-muted-foreground">
            Customise the design and branding of certificates issued to your students.
          </p>
        </div>
        <Button size="sm" onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          New Template
        </Button>
      </div>

      {/* Template list */}
      {(!templates || templates.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-xl">
          <Award className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="font-medium text-muted-foreground">No certificate templates yet</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Create a template to customise how your certificates look.</p>
          <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Create First Template
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {templates.map((tpl: any) => (
            <Card key={tpl.id} className={`transition-all ${tpl.isDefault ? "border-primary/50 shadow-sm" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Color preview */}
                    <div
                      className="w-10 h-10 rounded-lg shrink-0 border"
                      style={{ background: tpl.primaryColor ?? "#0ea5e9" }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{tpl.name}</span>
                        {tpl.isDefault && (
                          <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
                            <Star className="h-2.5 w-2.5 mr-1" />
                            Default
                          </Badge>
                        )}
                        {tpl.showTeachificBranding && (
                          <Badge variant="outline" className="text-xs">Course360 platform attribution</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {tpl.bgStyle} background
                        {tpl.signatureName ? ` · Signed by ${tpl.signatureName}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!tpl.isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs gap-1"
                        onClick={() => handleSetDefault(tpl)}
                      >
                        <Star className="h-3 w-3" />
                        Set Default
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(tpl)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(tpl.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <TemplateDialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        template={editingTemplate}
        orgId={orgId}
        canWhiteLabel={canWhiteLabel}
        onSave={async (data) => {
          if (editingTemplate) {
            await updateMutation.mutateAsync({ id: editingTemplate.id, ...data });
          } else {
            await createMutation.mutateAsync({ orgId, ...data });
          }
          setShowDialog(false);
        }}
        isSaving={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}

interface TemplateDialogProps {
  open: boolean;
  onClose: () => void;
  template: any | null;
  orgId: number;
  canWhiteLabel: boolean;
  onSave: (data: any) => Promise<void>;
  isSaving: boolean;
}

function TemplateDialog({ open, onClose, template, canWhiteLabel, onSave, isSaving }: TemplateDialogProps) {
  const [form, setForm] = useState(() => ({
    name: template?.name ?? "Default Certificate",
    isDefault: template?.isDefault ?? false,
    logoUrl: template?.logoUrl ?? "",
    primaryColor: template?.primaryColor ?? "#0ea5e9",
    accentColor: template?.accentColor ?? "#0f2942",
    bgStyle: template?.bgStyle ?? "white",
    signatureName: template?.signatureName ?? "",
    signatureTitle: template?.signatureTitle ?? "",
    footerText: template?.footerText ?? "",
    showTeachificBranding: template?.showTeachificBranding ?? !canWhiteLabel,
  }));

  // Reset form when template changes
  useState(() => {
    setForm({
      name: template?.name ?? "Default Certificate",
      isDefault: template?.isDefault ?? false,
      logoUrl: template?.logoUrl ?? "",
      primaryColor: template?.primaryColor ?? "#0ea5e9",
      accentColor: template?.accentColor ?? "#0f2942",
      bgStyle: template?.bgStyle ?? "white",
      signatureName: template?.signatureName ?? "",
      signatureTitle: template?.signatureTitle ?? "",
      footerText: template?.footerText ?? "",
      showTeachificBranding: template?.showTeachificBranding ?? !canWhiteLabel,
    });
  });

  function set(key: string, value: any) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    await onSave({
      ...form,
      logoUrl: form.logoUrl || undefined,
      signatureName: form.signatureName || undefined,
      signatureTitle: form.signatureTitle || undefined,
      footerText: form.footerText || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? "Edit Certificate Template" : "New Certificate Template"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label>Template Name</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Default Certificate" />
          </div>

          {/* Logo URL */}
          <div className="space-y-1.5">
            <Label>Logo URL</Label>
            <Input
              value={form.logoUrl}
              onChange={(e) => set("logoUrl", e.target.value)}
              placeholder="https://... (leave blank to use org logo)"
            />
            <p className="text-xs text-muted-foreground">Paste a direct image URL. Leave blank to use your org's default logo.</p>
          </div>

          {/* Colors */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Primary Color</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={form.primaryColor}
                  onChange={(e) => set("primaryColor", e.target.value)}
                  className="h-9 w-12 rounded border cursor-pointer p-0.5"
                />
                <Input
                  value={form.primaryColor}
                  onChange={(e) => set("primaryColor", e.target.value)}
                  placeholder="#0ea5e9"
                  className="font-mono text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Accent Color</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={form.accentColor}
                  onChange={(e) => set("accentColor", e.target.value)}
                  className="h-9 w-12 rounded border cursor-pointer p-0.5"
                />
                <Input
                  value={form.accentColor}
                  onChange={(e) => set("accentColor", e.target.value)}
                  placeholder="#0f2942"
                  className="font-mono text-sm"
                />
              </div>
            </div>
          </div>

          {/* Background style */}
          <div className="space-y-1.5">
            <Label>Background Style</Label>
            <Select value={form.bgStyle} onValueChange={(v) => set("bgStyle", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="white">White (clean, minimal)</SelectItem>
                <SelectItem value="light">Light grey (subtle)</SelectItem>
                <SelectItem value="gradient">Gradient (uses your colors)</SelectItem>
                <SelectItem value="dark">Dark (bold, dramatic)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Signature */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Signature Name</Label>
              <Input
                value={form.signatureName}
                onChange={(e) => set("signatureName", e.target.value)}
                placeholder="e.g. Jane Smith"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Signature Title</Label>
              <Input
                value={form.signatureTitle}
                onChange={(e) => set("signatureTitle", e.target.value)}
                placeholder="e.g. Director of Education"
              />
            </div>
          </div>

          {/* Footer text */}
          <div className="space-y-1.5">
            <Label>Footer / Credential Text</Label>
            <Textarea
              value={form.footerText}
              onChange={(e) => set("footerText", e.target.value)}
              placeholder="e.g. This certificate is issued by your organization. Add any applicable credential wording."
              rows={2}
            />
          </div>

          {/* White-label toggle (Pro/Enterprise only) */}
          {canWhiteLabel && (
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
              <div>
                <p className="text-sm font-medium">Show Course360 platform attribution</p>
                <p className="text-xs text-muted-foreground">When off, only your org's branding appears on the certificate.</p>
              </div>
              <Switch
                checked={form.showTeachificBranding}
                onCheckedChange={(v) => set("showTeachificBranding", v)}
              />
            </div>
          )}

          {/* Set as default */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
            <div>
              <p className="text-sm font-medium">Set as default template</p>
              <p className="text-xs text-muted-foreground">This template will be used for all new certificates.</p>
            </div>
            <Switch
              checked={form.isDefault}
              onCheckedChange={(v) => set("isDefault", v)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving || !form.name.trim()}>
            {isSaving ? (
              <><div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />Saving...</>
            ) : (
              template ? "Save Changes" : "Create Template"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
