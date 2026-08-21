import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useOrgScope } from "@/hooks/useOrgScope";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Award, Plus, MoreVertical, Edit, Trash2, Star, Check } from "lucide-react";

// ─── Base design presets ──────────────────────────────────────────────────────
const BASE_TEMPLATES = [
  {
    id: "classic",
    name: "Classic",
    borderColor: "#0ea5e9",
    bgColor: "#ffffff",
    fontFamily: "Georgia, serif",
    accentColor: "#0ea5e9",
    description: "Traditional blue border with serif typography",
  },
  {
    id: "elegant",
    name: "Elegant",
    borderColor: "#b8860b",
    bgColor: "#fffdf5",
    fontFamily: "Palatino Linotype, serif",
    accentColor: "#b8860b",
    description: "Gold accents on warm ivory background",
  },
  {
    id: "modern",
    name: "Modern",
    borderColor: "#6366f1",
    bgColor: "#f8f8ff",
    fontFamily: "Helvetica Neue, sans-serif",
    accentColor: "#6366f1",
    description: "Clean purple with sans-serif typography",
  },
  {
    id: "minimal",
    name: "Minimal",
    borderColor: "#374151",
    bgColor: "#ffffff",
    fontFamily: "Arial, sans-serif",
    accentColor: "#374151",
    description: "Simple dark border, clean and professional",
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────
interface CertFields {
  title: string;
  subtitle: string;
  bodyText: string;
  signatureName: string;
  signatureTitle: string;
  logoUrl: string;
  borderColor: string;
  bgColor: string;
  accentColor: string;
  fontFamily: string;
}

const DEFAULT_FIELDS: CertFields = {
  title: "Certificate of Completion",
  subtitle: "This certifies that",
  bodyText: "This is to certify that",
  signatureName: "Training Manager",
  signatureTitle: "Head of Learning & Development",
  logoUrl: "",
  borderColor: "#0ea5e9",
  bgColor: "#ffffff",
  accentColor: "#0ea5e9",
  fontFamily: "Georgia, serif",
};

function getOrganizationPrimaryColor() {
  if (typeof window === "undefined") return "#000000";
  return window.getComputedStyle(document.documentElement).getPropertyValue("--org-primary").trim() || "#000000";
}

// ─── HTML builder ─────────────────────────────────────────────────────────────
function buildHtml(fields: CertFields): string {
  return `<div style="width:800px;height:580px;border:8px solid ${fields.borderColor};padding:50px 60px;font-family:${fields.fontFamily};text-align:center;background:${fields.bgColor};box-sizing:border-box;position:relative;">
  ${fields.logoUrl ? `<img src="${fields.logoUrl}" alt="Logo" style="height:48px;object-fit:contain;margin-bottom:12px;" />` : ""}
  <h1 style="color:${fields.accentColor};font-size:32px;margin:0 0 6px;letter-spacing:1px;">${fields.title}</h1>
  <p style="color:#666;font-size:15px;margin:0 0 20px;">${fields.subtitle}</p>
  <div style="border-top:1px solid ${fields.borderColor}33;border-bottom:1px solid ${fields.borderColor}33;padding:18px 0;margin:0 0 20px;">
    <p style="color:#555;font-size:15px;margin:0 0 8px;">${fields.bodyText}</p>
    <h2 style="font-size:30px;margin:8px 0;color:#111;">{{student_name}}</h2>
    <p style="color:#555;font-size:15px;margin:0;">has successfully completed</p>
    <h3 style="font-size:22px;color:#333;margin:10px 0 0;">{{course_name}}</h3>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:24px;">
    <div style="text-align:left;">
      <div style="border-top:1px solid #999;padding-top:6px;min-width:160px;">
        <p style="font-size:13px;color:#555;margin:0;">${fields.signatureName}</p>
        <p style="font-size:11px;color:#888;margin:2px 0 0;">${fields.signatureTitle}</p>
      </div>
    </div>
    <div style="text-align:right;">
      <p style="font-size:13px;color:#888;margin:0;">Date Issued</p>
      <p style="font-size:14px;color:#555;margin:2px 0 0;font-weight:600;">{{date}}</p>
    </div>
  </div>
</div>`;
}

// ─── Template thumbnail ───────────────────────────────────────────────────────
function TemplateThumbnail({
  tpl,
  selected,
  onSelect,
}: {
  tpl: typeof BASE_TEMPLATES[0];
  selected: boolean;
  onSelect: () => void;
}) {
  const sampleHtml = buildHtml({
    ...DEFAULT_FIELDS,
    borderColor: tpl.borderColor,
    bgColor: tpl.bgColor,
    accentColor: tpl.accentColor,
    fontFamily: tpl.fontFamily,
  });
  return (
    <div
      onClick={onSelect}
      className={`cursor-pointer rounded-xl border-2 overflow-hidden transition-all ${
        selected ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50"
      }`}
    >
      <div className="relative bg-gray-50 overflow-hidden" style={{ height: 140 }}>
        <iframe
          srcDoc={`<html><body style="margin:0;padding:0;width:800px;">${sampleHtml}</body></html>`}
          style={{
            width: "800px",
            height: "580px",
            border: "none",
            transform: "scale(0.175)",
            transformOrigin: "top left",
            pointerEvents: "none",
          }}
          title={tpl.name}
        />
        {selected && (
          <div className="absolute top-2 right-2 bg-primary text-white rounded-full p-0.5">
            <Check className="h-3 w-3" />
          </div>
        )}
      </div>
      <div className="p-3 bg-background">
        <p className="font-semibold text-sm">{tpl.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{tpl.description}</p>
      </div>
    </div>
  );
}

// ─── Editor dialog ────────────────────────────────────────────────────────────
function CertificateEditorDialog({
  open,
  onOpenChange,
  initialName = "",
  initialFields,
  onSave,
  isPending,
  dialogTitle,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialName?: string;
  initialFields?: CertFields;
  onSave: (name: string, html: string) => void;
  isPending: boolean;
  dialogTitle: string;
}) {
  const isEdit = !!initialName;
  const [step, setStep] = useState<"pick" | "edit">(isEdit ? "edit" : "pick");
  const [selectedBase, setSelectedBase] = useState<string>(BASE_TEMPLATES[0].id);
  const [name, setName] = useState(initialName);
  const [fields, setFields] = useState<CertFields>(initialFields ?? {
    ...DEFAULT_FIELDS,
    borderColor: getOrganizationPrimaryColor(),
    accentColor: getOrganizationPrimaryColor(),
  });

  const html = useMemo(() => buildHtml(fields), [fields]);

  const setField = (k: keyof CertFields, v: string) =>
    setFields((f) => ({ ...f, [k]: v }));

  const applyBase = (baseId: string) => {
    const base = BASE_TEMPLATES.find((b) => b.id === baseId);
    if (base) {
      setFields((f) => ({
        ...f,
        borderColor: base.borderColor,
        bgColor: base.bgColor,
        accentColor: base.accentColor,
        fontFamily: base.fontFamily,
      }));
    }
  };

  const handleNext = () => {
    applyBase(selectedBase);
    setStep("edit");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>

        {step === "pick" ? (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Choose a base design to start from. You can customise all fields in the next step.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {BASE_TEMPLATES.map((tpl) => (
                <TemplateThumbnail
                  key={tpl.id}
                  tpl={tpl}
                  selected={selectedBase === tpl.id}
                  onSelect={() => setSelectedBase(tpl.id)}
                />
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleNext}>Next: Customise →</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2">
              {/* Left: fields */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Template Name *</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. New Employee Orientation Certificate"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Certificate Title</Label>
                    <Input
                      value={fields.title}
                      onChange={(e) => setField("title", e.target.value)}
                      placeholder="Certificate of Completion"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Subtitle</Label>
                    <Input
                      value={fields.subtitle}
                      onChange={(e) => setField("subtitle", e.target.value)}
                      placeholder="This certifies that"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Signature Name</Label>
                    <Input
                      value={fields.signatureName}
                      onChange={(e) => setField("signatureName", e.target.value)}
                      placeholder="e.g. Alex Johnson"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Signature Title</Label>
                    <Input
                      value={fields.signatureTitle}
                      onChange={(e) => setField("signatureTitle", e.target.value)}
                      placeholder="e.g. Director of Training"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Logo URL (optional)</Label>
                  <Input
                    value={fields.logoUrl}
                    onChange={(e) => setField("logoUrl", e.target.value)}
                    placeholder="https://your-org.com/logo.png"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Border Color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={fields.borderColor}
                        onChange={(e) => setField("borderColor", e.target.value)}
                        className="h-9 w-9 rounded cursor-pointer border"
                      />
                      <Input
                        value={fields.borderColor}
                        onChange={(e) => setField("borderColor", e.target.value)}
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Accent Color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={fields.accentColor}
                        onChange={(e) => setField("accentColor", e.target.value)}
                        className="h-9 w-9 rounded cursor-pointer border"
                      />
                      <Input
                        value={fields.accentColor}
                        onChange={(e) => setField("accentColor", e.target.value)}
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Background</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={fields.bgColor}
                        onChange={(e) => setField("bgColor", e.target.value)}
                        className="h-9 w-9 rounded cursor-pointer border"
                      />
                      <Input
                        value={fields.bgColor}
                        onChange={(e) => setField("bgColor", e.target.value)}
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Font Family</Label>
                  <Select value={fields.fontFamily} onValueChange={(v) => setField("fontFamily", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Georgia, serif">Georgia (Serif)</SelectItem>
                      <SelectItem value="Palatino Linotype, serif">Palatino (Serif)</SelectItem>
                      <SelectItem value="Times New Roman, serif">Times New Roman</SelectItem>
                      <SelectItem value="Helvetica Neue, sans-serif">Helvetica (Sans)</SelectItem>
                      <SelectItem value="Arial, sans-serif">Arial (Sans)</SelectItem>
                      <SelectItem value="Trebuchet MS, sans-serif">Trebuchet (Sans)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-lg bg-muted/50 p-3 space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    Dynamic placeholders — automatically filled when a certificate is issued
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {["{{student_name}}", "{{course_name}}", "{{date}}"].map((p) => (
                      <code key={p} className="text-xs bg-background border rounded px-2 py-0.5">
                        {p}
                      </code>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: live preview */}
              <div className="space-y-2">
                <Label>Live Preview</Label>
                <div
                  className="rounded-xl border overflow-hidden bg-gray-50"
                  style={{ height: 320 }}
                >
                  <iframe
                    srcDoc={`<html><body style="margin:0;padding:0;width:800px;">${html
                      .replace("{{student_name}}", "Jordan Taylor")
                      .replace("{{course_name}}", "New Employee Orientation")
                      .replace("{{date}}", new Date().toLocaleDateString())}</body></html>`}
                    style={{
                      width: "800px",
                      height: "580px",
                      border: "none",
                      transform: "scale(0.4)",
                      transformOrigin: "top left",
                      pointerEvents: "none",
                    }}
                    title="Preview"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Preview uses sample data. Actual certificates will display real learner and course names.
                </p>
              </div>
            </div>

            <DialogFooter className="pt-2">
              {!isEdit && (
                <Button variant="outline" onClick={() => setStep("pick")}>
                  ← Change Design
                </Button>
              )}
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!name.trim()) {
                    toast.error("Template name is required");
                    return;
                  }
                  onSave(name, html);
                }}
                disabled={isPending}
              >
                {isPending ? "Saving..." : "Save Template"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function MemberCertificatesPage() {
  const { orgId, ready } = useOrgScope();
  const utils = trpc.useUtils();

  const { data: templates, isLoading } = trpc.lms.certificateTemplates.list.useQuery(
    { orgId: orgId! },
    { enabled: ready && !!orgId }
  );

  const createMut = trpc.lms.certificateTemplates.create.useMutation({
    onSuccess: () => {
      utils.lms.certificateTemplates.list.invalidate();
      toast.success("Template created");
      setCreateOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMut = trpc.lms.certificateTemplates.update.useMutation({
    onSuccess: () => {
      utils.lms.certificateTemplates.list.invalidate();
      toast.success("Template updated");
      setEditItem(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = trpc.lms.certificateTemplates.delete.useMutation({
    onSuccess: () => {
      utils.lms.certificateTemplates.list.invalidate();
      toast.success("Template deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-7xl mx-auto">


      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Award className="h-6 w-6 text-primary" /> Certificate Templates
          </h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Design and manage completion certificates issued to learners.
          </p>
        </div>
        <Button className="gap-2" onClick={() => setCreateOpen(true)} disabled={!orgId}>
          <Plus className="h-4 w-4" /> New Template
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Templates</p>
            <p className="text-3xl font-bold">{templates?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Default Template</p>
            <p className="text-base font-medium mt-1">
              {templates?.find((t) => t.isDefault)?.name ?? "None set"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Template list */}
      {isLoading ? (
        <div className="grid gap-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : !templates?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <Award className="h-12 w-12 text-muted-foreground/40" />
            <p className="font-medium text-muted-foreground">No certificate templates yet</p>
            <p className="text-sm text-muted-foreground">
              Create your first template to start issuing certificates to learners.
            </p>
            <Button onClick={() => setCreateOpen(true)} disabled={!orgId}>
              <Plus className="h-4 w-4 mr-2" /> Create Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {templates.map((t) => (
            <Card key={t.id}>
              <CardContent className="flex items-center gap-4 py-4">
                <Award className="h-8 w-8 text-primary/60 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{t.name}</span>
                    {t.isDefault && <Badge className="text-xs">Default</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Created {new Date(t.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPreviewHtml(
                        (t.htmlTemplate ?? "")
                          .replace("{{student_name}}", "Jordan Taylor")
                          .replace("{{course_name}}", "New Employee Orientation")
                          .replace("{{date}}", new Date().toLocaleDateString())
                      );
                      setPreviewOpen(true);
                    }}
                  >
                    Preview
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditItem(t)}>
                        <Edit className="h-4 w-4 mr-2" /> Edit
                      </DropdownMenuItem>
                      {!t.isDefault && (
                        <DropdownMenuItem
                          onClick={() => updateMut.mutate({ id: t.id, isDefault: true })}
                        >
                          <Star className="h-4 w-4 mr-2" /> Set as Default
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => {
                          if (confirm("Delete this template?")) deleteMut.mutate({ id: t.id });
                        }}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <CertificateEditorDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        dialogTitle="New Certificate Template"
        onSave={(name, html) =>
          createMut.mutate({ orgId: orgId!, name, htmlTemplate: html, isDefault: false })
        }
        isPending={createMut.isPending}
      />

      {/* Edit dialog */}
      {editItem && (
        <CertificateEditorDialog
          open={!!editItem}
          onOpenChange={(v) => {
            if (!v) setEditItem(null);
          }}
          dialogTitle="Edit Certificate Template"
          initialName={editItem.name}
          initialFields={DEFAULT_FIELDS}
          onSave={(name, html) =>
            updateMut.mutate({ id: editItem.id, name, htmlTemplate: html })
          }
          isPending={updateMut.isPending}
        />
      )}

      {/* Preview dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Certificate Preview</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto max-h-[65vh] rounded-lg border bg-gray-50 p-4">
            <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
          <DialogFooter>
            <Button onClick={() => setPreviewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
