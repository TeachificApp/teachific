/**
 * CertificateTemplatesAdmin.tsx
 * Admin UI for managing LMS certificate PDF templates and viewing issued certificates.
 * Uses trpc.lmsAdmin.* procedures backed by lmsCertificateTemplates table.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Award, Star, Download, Eye, ExternalLink } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface CertTemplate {
  id: number;
  name: string;
  description?: string | null;
  backgroundImageUrl?: string | null;
  backgroundColorHex?: string | null;
  logoUrl?: string | null;
  titleText?: string | null;
  subtitleText?: string | null;
  bodyText?: string | null;
  signatureText?: string | null;
  signatureTitleText?: string | null;
  footerText?: string | null;
  primaryColorHex?: string | null;
  accentColorHex?: string | null;
  textColorHex?: string | null;
  fontFamily?: string | null;
  showBorder?: boolean | null;
  borderColorHex?: string | null;
  borderWidth?: number | null;
  layout?: "classic" | "modern" | "minimal" | null;
  isDefault?: boolean | null;
  createdAt?: Date | string | null;
}

type TemplateFormData = Omit<CertTemplate, "id" | "createdAt">;

const DEFAULT_FORM: TemplateFormData = {
  name: "",
  description: "",
  backgroundImageUrl: null,
  backgroundColorHex: "#f0fbfc",
  logoUrl: null,
  titleText: "Certificate of Completion",
  subtitleText: null,
  bodyText: null,
  signatureText: null,
  signatureTitleText: null,
  footerText: "www.course360.app  ·  © Course360™",
  primaryColorHex: "#189aa1",
  accentColorHex: "#c9a84c",
  textColorHex: "#0e1e2e",
  fontFamily: "Helvetica",
  showBorder: true,
  borderColorHex: "#189aa1",
  borderWidth: 3,
  layout: "classic",
  isDefault: false,
};

// ── TemplateEditor sub-component ─────────────────────────────────────────────

function TemplateEditor({
  initial,
  onSave,
  onCancel,
  isSaving,
  templateId,
}: {
  initial: Partial<CertTemplate>;
  onSave: (data: TemplateFormData) => void;
  onCancel: () => void;
  isSaving: boolean;
  templateId?: number;
}) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState<TemplateFormData>({
    ...DEFAULT_FORM,
    ...initial,
  });
  const [isPreviewing, setIsPreviewing] = useState(false);

  const set = (key: keyof TemplateFormData, value: any) =>
    setForm(f => ({ ...f, [key]: value }));

  const previewMut = trpc.lmsAdmin.previewCertificateTemplate.useMutation({
    onSuccess: ({ url }) => {
      window.open(url, "_blank");
      setIsPreviewing(false);
    },
    onError: (e) => {
      toast.error(`Preview failed: ${e.message}`);
      setIsPreviewing(false);
    },
  });

  const handlePreview = () => {
    setIsPreviewing(true);
    previewMut.mutate({ templateId });
  };

  return (
    <div className="space-y-4 max-h-[72vh] overflow-y-auto pr-1">
      {/* Basic info */}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Template Name *</Label>
          <Input
            value={form.name}
            onChange={e => set("name", e.target.value)}
            placeholder="e.g. Classic Teal"
          />
        </div>
        <div className="col-span-2">
          <Label>Description</Label>
          <Textarea
            value={form.description ?? ""}
            onChange={e => set("description", e.target.value)}
            rows={2}
            placeholder="Brief description of this template"
          />
        </div>
      </div>

      {/* Layout & Branding */}
      <div className="border rounded-lg p-3 space-y-3">
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Layout & Branding</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Layout Style</Label>
            <Select value={form.layout ?? "classic"} onValueChange={v => set("layout", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="classic">Classic (centered, header band)</SelectItem>
                <SelectItem value="modern">Modern (left accent bar)</SelectItem>
                <SelectItem value="minimal">Minimal (clean lines)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Background Color</Label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={form.backgroundColorHex ?? "#f0fbfc"}
                onChange={e => set("backgroundColorHex", e.target.value)}
                className="w-10 h-9 rounded border cursor-pointer"
              />
              <Input
                value={form.backgroundColorHex ?? ""}
                onChange={e => set("backgroundColorHex", e.target.value)}
                className="font-mono text-sm"
              />
            </div>
          </div>
          <div>
            <Label>Logo URL</Label>
            <Input
              value={form.logoUrl ?? ""}
              onChange={e => set("logoUrl", e.target.value || null)}
              placeholder="https://..."
            />
          </div>
          <div>
            <Label>Background Image URL</Label>
            <Input
              value={form.backgroundImageUrl ?? ""}
              onChange={e => set("backgroundImageUrl", e.target.value || null)}
              placeholder="https://..."
            />
          </div>
        </div>
      </div>

      {/* Certificate Text */}
      <div className="border rounded-lg p-3 space-y-3">
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Certificate Text</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Title</Label>
            <Input
              value={form.titleText ?? ""}
              onChange={e => set("titleText", e.target.value || null)}
              placeholder="Certificate of Completion"
            />
          </div>
          <div>
            <Label>Subtitle</Label>
            <Input
              value={form.subtitleText ?? ""}
              onChange={e => set("subtitleText", e.target.value || null)}
              placeholder="This certifies that"
            />
          </div>
          <div className="col-span-2">
            <Label>Body Text (optional)</Label>
            <Textarea
              value={form.bodyText ?? ""}
              onChange={e => set("bodyText", e.target.value || null)}
              rows={2}
              placeholder="has successfully completed..."
            />
          </div>
        </div>
      </div>

      {/* Colors & Typography */}
      <div className="border rounded-lg p-3 space-y-3">
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Colors & Typography</p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>Primary Color</Label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={form.primaryColorHex ?? "#189aa1"}
                onChange={e => set("primaryColorHex", e.target.value)}
                className="w-10 h-9 rounded border cursor-pointer"
              />
              <Input
                value={form.primaryColorHex ?? ""}
                onChange={e => set("primaryColorHex", e.target.value)}
                className="font-mono text-sm"
              />
            </div>
          </div>
          <div>
            <Label>Accent Color</Label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={form.accentColorHex ?? "#c9a84c"}
                onChange={e => set("accentColorHex", e.target.value)}
                className="w-10 h-9 rounded border cursor-pointer"
              />
              <Input
                value={form.accentColorHex ?? ""}
                onChange={e => set("accentColorHex", e.target.value)}
                className="font-mono text-sm"
              />
            </div>
          </div>
          <div>
            <Label>Text Color</Label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={form.textColorHex ?? "#0e1e2e"}
                onChange={e => set("textColorHex", e.target.value)}
                className="w-10 h-9 rounded border cursor-pointer"
              />
              <Input
                value={form.textColorHex ?? ""}
                onChange={e => set("textColorHex", e.target.value)}
                className="font-mono text-sm"
              />
            </div>
          </div>
        </div>
        <div>
          <Label>Font Family</Label>
          <Select value={form.fontFamily ?? "Helvetica"} onValueChange={v => set("fontFamily", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Helvetica">Helvetica (default)</SelectItem>
              <SelectItem value="Times-Roman">Times Roman</SelectItem>
              <SelectItem value="Courier">Courier</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Border */}
      <div className="border rounded-lg p-3 space-y-3">
        <div className="flex items-center gap-3">
          <Switch
            checked={form.showBorder ?? true}
            onCheckedChange={v => set("showBorder", v)}
            id="showBorder"
          />
          <Label htmlFor="showBorder" className="font-semibold">Show Border</Label>
        </div>
        {form.showBorder && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Border Color</Label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={form.borderColorHex ?? "#189aa1"}
                  onChange={e => set("borderColorHex", e.target.value)}
                  className="w-10 h-9 rounded border cursor-pointer"
                />
                <Input
                  value={form.borderColorHex ?? ""}
                  onChange={e => set("borderColorHex", e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
            </div>
            <div>
              <Label>Border Width (px)</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={form.borderWidth ?? 3}
                onChange={e => set("borderWidth", parseInt(e.target.value) || 3)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Signature */}
      <div className="border rounded-lg p-3 space-y-3">
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Signature</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Signature Name</Label>
            <Input
              value={form.signatureText ?? ""}
              onChange={e => set("signatureText", e.target.value || null)}
              placeholder="e.g. Lara Williams, RVT, RDMS"
            />
          </div>
          <div>
            <Label>Signature Title</Label>
            <Input
              value={form.signatureTitleText ?? ""}
              onChange={e => set("signatureTitleText", e.target.value || null)}
              placeholder="e.g. Founder, Course360™"
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border rounded-lg p-3 space-y-3">
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Footer</p>
        <div>
          <Label>Footer Text</Label>
          <Input
            value={form.footerText ?? ""}
            onChange={e => set("footerText", e.target.value || null)}
            placeholder="www.course360.app  ·  © Course360™"
          />
        </div>
      </div>

      {/* Default toggle */}
      <div className="flex items-center gap-2">
        <Switch
          checked={form.isDefault ?? false}
          onCheckedChange={v => set("isDefault", v)}
          id="isDefault"
        />
        <Label htmlFor="isDefault">Set as Default Template</Label>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center pt-2">
        <Button
          variant="outline"
          onClick={handlePreview}
          disabled={isPreviewing || isSaving}
          className="text-xs"
        >
          <Eye className="w-3 h-3 mr-1" />
          {isPreviewing ? "Generating…" : "Preview PDF"}
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isSaving}>Cancel</Button>
          <Button onClick={() => onSave(form)} disabled={isSaving || !form.name.trim()}>
            {isSaving ? "Saving…" : "Save Template"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CertificateTemplatesAdmin() {
  const utils = trpc.useUtils();

  const { data: templates = [], isLoading } = trpc.lmsAdmin.listCertificateTemplates.useQuery();
  const { data: issuedCerts = [], isLoading: certsLoading } = trpc.lmsAdmin.listIssuedCertificates.useQuery({});

  const [showCreate, setShowCreate] = useState(false);
  const [editTemplate, setEditTemplate] = useState<CertTemplate | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const createMut = trpc.lmsAdmin.createCertificateTemplate.useMutation({
    onSuccess: () => {
      utils.lmsAdmin.listCertificateTemplates.invalidate();
      setShowCreate(false);
      toast.success("Template created");
    },
    onError: (e) => toast.error(`Error: ${e.message}`),
  });

  const updateMut = trpc.lmsAdmin.updateCertificateTemplate.useMutation({
    onSuccess: () => {
      utils.lmsAdmin.listCertificateTemplates.invalidate();
      setEditTemplate(null);
      toast.success("Template updated");
    },
    onError: (e) => toast.error(`Error: ${e.message}`),
  });

  const deleteMut = trpc.lmsAdmin.deleteCertificateTemplate.useMutation({
    onSuccess: () => {
      utils.lmsAdmin.listCertificateTemplates.invalidate();
      setDeleteId(null);
      toast.success("Template deleted");
    },
    onError: (e) => toast.error(`Error: ${e.message}`),
  });

  const setDefaultMut = trpc.lmsAdmin.updateCertificateTemplate.useMutation({
    onSuccess: () => utils.lmsAdmin.listCertificateTemplates.invalidate(),
    onError: (e) => toast.error(`Error: ${e.message}`),
  });

  return (
    <div className="space-y-6">
      <Tabs defaultValue="templates">
        <TabsList>
          <TabsTrigger value="templates">
            <Award className="w-4 h-4 mr-1" />Templates
          </TabsTrigger>
          <TabsTrigger value="issued">
            <Download className="w-4 h-4 mr-1" />Issued Certificates
          </TabsTrigger>
        </TabsList>

        {/* ── Templates Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="templates" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Certificate Templates</h3>
              <p className="text-sm text-muted-foreground">
                Design templates used when generating completion certificate PDFs.
              </p>
            </div>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4 mr-1" /> New Template
            </Button>
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading templates…</div>
          ) : (templates as CertTemplate[]).length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Award className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-muted-foreground">No certificate templates yet.</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Create a template to customise the look of issued certificates.
                </p>
                <Button className="mt-4" onClick={() => setShowCreate(true)}>
                  <Plus className="w-4 h-4 mr-1" /> Create First Template
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {(templates as CertTemplate[]).map((t) => (
                <Card key={t.id} className="relative">
                  {t.isDefault && (
                    <div className="absolute top-2 right-2">
                      <Badge className="bg-amber-500 text-white text-xs">
                        <Star className="w-3 h-3 mr-1 inline" />Default
                      </Badge>
                    </div>
                  )}
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{t.name}</CardTitle>
                    {t.description && (
                      <p className="text-xs text-muted-foreground">{t.description}</p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Color swatches */}
                    <div className="flex gap-2 items-center">
                      <div
                        className="w-6 h-6 rounded-full border"
                        style={{ background: t.primaryColorHex ?? "#189aa1" }}
                        title="Primary"
                      />
                      <div
                        className="w-6 h-6 rounded-full border"
                        style={{ background: t.accentColorHex ?? "#c9a84c" }}
                        title="Accent"
                      />
                      <div
                        className="w-6 h-6 rounded-full border"
                        style={{ background: t.textColorHex ?? "#0e1e2e" }}
                        title="Text"
                      />
                      <span className="text-xs text-muted-foreground ml-1 capitalize">
                        {t.layout ?? "classic"}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {t.signatureText && <div>Signature: {t.signatureText}</div>}
                      {t.fontFamily && <div>Font: {t.fontFamily}</div>}
                    </div>
                    <div className="flex gap-2 pt-1 flex-wrap">
                      {!t.isDefault && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => setDefaultMut.mutate({ id: t.id, isDefault: true })}
                          disabled={setDefaultMut.isPending}
                        >
                          <Star className="w-3 h-3 mr-1" />Set Default
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditTemplate(t)}
                      >
                        <Edit className="w-3 h-3 mr-1" />Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(t.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Issued Certificates Tab ────────────────────────────────────────── */}
        <TabsContent value="issued" className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Issued Certificates</h3>
            <p className="text-sm text-muted-foreground">
              All certificates generated for learners in your organisation.
            </p>
          </div>

          {certsLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading…</div>
          ) : (issuedCerts as any[]).length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Award className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-muted-foreground">No certificates issued yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2">Certificate #</th>
                    <th className="text-left px-4 py-2">User ID</th>
                    <th className="text-left px-4 py-2">Course ID</th>
                    <th className="text-left px-4 py-2">Issued</th>
                    <th className="text-left px-4 py-2">PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {(issuedCerts as any[]).map((c) => (
                    <tr key={c.id} className="border-t hover:bg-muted/20">
                      <td className="px-4 py-2 font-mono text-xs">{c.certificateNumber}</td>
                      <td className="px-4 py-2 text-muted-foreground">{c.userId ?? "—"}</td>
                      <td className="px-4 py-2 text-muted-foreground">{c.courseId ?? "—"}</td>
                      <td className="px-4 py-2 text-muted-foreground text-xs">
                        {c.issuedAt ? new Date(c.issuedAt).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-2">
                        {c.certificateUrl ? (
                          <a href={c.certificateUrl} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="outline" className="text-xs">
                              <ExternalLink className="w-3 h-3 mr-1" />View PDF
                            </Button>
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Create Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Certificate Template</DialogTitle>
          </DialogHeader>
          <TemplateEditor
            initial={{}}
            onSave={(data) => createMut.mutate(data as any)}
            onCancel={() => setShowCreate(false)}
            isSaving={createMut.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ────────────────────────────────────────────────────── */}
      {editTemplate && (
        <Dialog open={!!editTemplate} onOpenChange={() => setEditTemplate(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Template: {editTemplate.name}</DialogTitle>
            </DialogHeader>
            <TemplateEditor
              initial={editTemplate}
              templateId={editTemplate.id}
              onSave={(data) => updateMut.mutate({ id: editTemplate.id, ...data } as any)}
              onCancel={() => setEditTemplate(null)}
              isSaving={updateMut.isPending}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* ── Delete Confirm ─────────────────────────────────────────────────── */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this certificate template? Any courses using it will
            revert to the default template.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && deleteMut.mutate({ id: deleteId })}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
