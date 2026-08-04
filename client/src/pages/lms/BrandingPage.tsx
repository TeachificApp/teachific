import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Check, Upload, X, Loader2, Image as ImageIcon, Palette, Type, Globe, Mail } from "lucide-react";

const PRESET_COLORS = [
  { name: "Teal", value: "#189aa1" },
  { name: "Aqua", value: "#4ad9e0" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Indigo", value: "#6366f1" },
  { name: "Purple", value: "#8b5cf6" },
  { name: "Pink", value: "#ec4899" },
  { name: "Rose", value: "#f43f5e" },
  { name: "Orange", value: "#f97316" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Green", value: "#22c55e" },
  { name: "Emerald", value: "#10b981" },
  { name: "Slate", value: "#64748b" },
];

const FONT_OPTIONS = [
  { value: "Inter", label: "Inter (Default)" },
  { value: "Plus Jakarta Sans", label: "Plus Jakarta Sans" },
  { value: "DM Sans", label: "DM Sans" },
  { value: "Nunito", label: "Nunito" },
  { value: "Poppins", label: "Poppins" },
  { value: "Lato", label: "Lato" },
  { value: "Open Sans", label: "Open Sans" },
  { value: "Roboto", label: "Roboto" },
  { value: "Source Sans 3", label: "Source Sans 3" },
];

function ColorSwatch({
  color,
  selected,
  onClick,
}: {
  color: { name: string; value: string };
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={color.name}
      className="relative h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{
        backgroundColor: color.value,
        borderColor: selected ? color.value : "transparent",
        boxShadow: selected ? `0 0 0 2px white, 0 0 0 4px ${color.value}` : undefined,
      }}
    >
      {selected && (
        <Check className="h-3.5 w-3.5 text-white absolute inset-0 m-auto drop-shadow" />
      )}
    </button>
  );
}

function ColorField({
  label,
  description,
  value,
  onChange,
  presets = PRESET_COLORS,
}: {
  label: string;
  description?: string;
  value: string;
  onChange: (v: string) => void;
  presets?: typeof PRESET_COLORS;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <Label className="text-sm font-medium">{label}</Label>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {presets.map((c) => (
          <ColorSwatch key={c.value} color={c} selected={value === c.value} onClick={() => onChange(c.value)} />
        ))}
      </div>
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg border border-border shrink-0" style={{ backgroundColor: value || "#ccc" }} />
        <div className="flex-1">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="#189aa1"
            className="h-8 font-mono text-sm"
          />
        </div>
        <input
          type="color"
          value={value || "#189aa1"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-9 rounded-lg border border-border cursor-pointer p-0.5 bg-transparent"
          title="Pick color"
        />
      </div>
    </div>
  );
}

function ImageUploader({
  value,
  onChange,
  orgId,
  label,
  hint,
  accept = "image/png,image/jpeg,image/svg+xml,image/webp",
  maxMb = 2,
}: {
  value: string;
  onChange: (url: string) => void;
  orgId: number;
  label?: string;
  hint?: string;
  accept?: string;
  maxMb?: number;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > maxMb * 1024 * 1024) {
      toast.error(`File must be under ${maxMb} MB`);
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("orgId", String(orgId));
      formData.append("folder", "branding");
      const res = await fetch("/api/media-upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error ?? "Upload failed");
      }
      const { url } = await res.json();
      onChange(url);
      toast.success("Uploaded successfully");
    } catch (err: any) {
      toast.error("Upload failed: " + (err.message ?? "Unknown error"));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex items-start gap-4">
      <div className="relative h-20 w-44 rounded-lg border border-border bg-muted/40 overflow-hidden flex items-center justify-center shrink-0">
        {value ? (
          <>
            <img src={value} alt={label ?? "Image"} className="max-h-full max-w-full object-contain p-2" />
            <button
              onClick={() => onChange("")}
              className="absolute top-1 right-1 h-5 w-5 rounded-full bg-destructive/80 text-white flex items-center justify-center hover:bg-destructive transition-colors"
              title="Remove"
            >
              <X className="h-3 w-3" />
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground/50">
            <ImageIcon className="h-6 w-6" />
            <span className="text-xs">No image</span>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="gap-2"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? "Uploading…" : `Upload ${label ?? "Image"}`}
        </Button>
        <p className="text-xs text-muted-foreground">PNG, JPG, SVG — max {maxMb} MB</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        {value && (
          <p className="text-xs text-muted-foreground truncate max-w-[200px]" title={value}>
            {value.split("/").pop()}
          </p>
        )}
      </div>
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleFile} />
    </div>
  );
}

type EmailBranding = {
  logoUrl?: string;
  primaryColor?: string;
  footerText?: string;
  senderName?: string;
  useOrgLogo?: boolean;
};

export default function BrandingPage() {
  const { data: orgs } = trpc.orgs.myOrgs.useQuery();
  const orgId = orgs?.[0]?.id;

  const { data: theme, isLoading } = trpc.lms.themes.get.useQuery(
    { orgId: orgId! },
    { enabled: !!orgId }
  );

  const [form, setForm] = useState({
    primaryColor: "#189aa1",
    accentColor: "#4ad9e0",
    buttonColor: "",
    buttonTextColor: "",
    pageBgColor: "",
    fontFamily: "Inter",
    schoolName: "",
    adminLogoUrl: "",
    faviconUrl: "",
    customCss: "",
    studentPrimaryColor: "#189aa1",
    studentAccentColor: "#4ad9e0",
    studentTheme: "light" as "light" | "dark",
  });

  const [emailBranding, setEmailBranding] = useState<EmailBranding>({
    useOrgLogo: true,
    primaryColor: "",
    senderName: "",
    footerText: "",
  });

  useEffect(() => {
    if (theme) {
      setForm({
        primaryColor: theme.primaryColor ?? "#189aa1",
        accentColor: theme.accentColor ?? "#4ad9e0",
        buttonColor: (theme as any).buttonColor ?? "",
        buttonTextColor: (theme as any).buttonTextColor ?? "",
        pageBgColor: (theme as any).pageBgColor ?? "",
        fontFamily: theme.fontFamily ?? "Inter",
        schoolName: theme.schoolName ?? "",
        adminLogoUrl: theme.adminLogoUrl ?? "",
        faviconUrl: (theme as any).faviconUrl ?? "",
        customCss: theme.customCss ?? "",
        studentPrimaryColor: theme.studentPrimaryColor ?? "#189aa1",
        studentAccentColor: theme.studentAccentColor ?? "#4ad9e0",
        studentTheme: (theme.studentTheme ?? "light") as "light" | "dark",
      });
      if (theme.emailBranding) {
        try {
          const parsed = typeof theme.emailBranding === "string"
            ? JSON.parse(theme.emailBranding)
            : theme.emailBranding;
          setEmailBranding({ useOrgLogo: true, primaryColor: "", senderName: "", footerText: "", ...parsed });
        } catch {}
      }
    }
  }, [theme]);

  const updateTheme = trpc.lms.themes.update.useMutation({
    onSuccess: () => toast.success("Branding saved"),
    onError: (e) => toast.error(e.message),
  });

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const setEmail = (k: keyof EmailBranding, v: any) => setEmailBranding((f) => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!orgId) return;
    updateTheme.mutate({
      orgId,
      ...form,
      emailBranding: JSON.stringify(emailBranding),
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 flex flex-col gap-4 max-w-3xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  const effectivePrimary = form.studentPrimaryColor || form.primaryColor;

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Branding &amp; Appearance</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Customize the look and feel of your student school, course player, landing pages, and emails
        </p>
      </div>

      <Tabs defaultValue="identity">
        <div className="overflow-x-auto pb-1">
          <TabsList className="flex w-max min-w-full sm:grid sm:grid-cols-4 sm:w-full mb-4">
            <TabsTrigger value="identity" className="gap-1.5"><Globe className="h-3.5 w-3.5" />Identity</TabsTrigger>
            <TabsTrigger value="colors" className="gap-1.5"><Palette className="h-3.5 w-3.5" />Colors &amp; Fonts</TabsTrigger>
            <TabsTrigger value="email" className="gap-1.5"><Mail className="h-3.5 w-3.5" />Email &amp; Invoices</TabsTrigger>
            <TabsTrigger value="advanced" className="gap-1.5"><Type className="h-3.5 w-3.5" />Advanced</TabsTrigger>
          </TabsList>
        </div>

        {/* ── Identity ── */}
        <TabsContent value="identity" className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">School Name</CardTitle>
              <CardDescription>Displayed in the student-facing header, emails, course player, and invoices</CardDescription>
            </CardHeader>
            <CardContent>
              <Input
                value={form.schoolName}
                onChange={(e) => set("schoolName", e.target.value)}
                placeholder="e.g. Acme Training Academy"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">School Logo</CardTitle>
              <CardDescription>Shown in the student school header, course player, landing pages, and email footers. If no logo is set, the School Name text is used instead.</CardDescription>
            </CardHeader>
            <CardContent>
              {orgId ? (
                <ImageUploader
                  value={form.adminLogoUrl}
                  onChange={(url) => set("adminLogoUrl", url)}
                  orgId={orgId}
                  label="Logo"
                  hint="Recommended: transparent background, 200×60 px min"
                />
              ) : (
                <p className="text-sm text-muted-foreground">Loading…</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Favicon</CardTitle>
              <CardDescription>The small icon shown in browser tabs and bookmarks for your school's subdomain. Use a square image (32×32 or 64×64 px recommended).</CardDescription>
            </CardHeader>
            <CardContent>
              {orgId ? (
                <ImageUploader
                  value={form.faviconUrl}
                  onChange={(url) => set("faviconUrl", url)}
                  orgId={orgId}
                  label="Favicon"
                  hint="Recommended: 32×32 or 64×64 px, PNG or ICO"
                  accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/jpeg,image/svg+xml"
                />
              ) : (
                <p className="text-sm text-muted-foreground">Loading…</p>
              )}
            </CardContent>
          </Card>

          {/* Live preview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">School Header Preview</CardTitle>
              <CardDescription>How your school header will appear to students</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className="rounded-xl border border-border overflow-hidden"
                style={{ fontFamily: form.fontFamily }}
              >
                <div
                  className="flex items-center gap-3 px-4 h-14 border-b border-border/50"
                  style={{ backgroundColor: effectivePrimary + "18" }}
                >
                  {form.adminLogoUrl ? (
                    <img src={form.adminLogoUrl} alt="Logo" className="h-8 max-w-[130px] object-contain" />
                  ) : (
                    <span
                      className="text-base font-bold tracking-tight"
                      style={{ color: effectivePrimary }}
                    >
                      {form.schoolName || "Your School Name"}
                    </span>
                  )}
                  <div className="flex-1" />
                  <button
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                    style={{ backgroundColor: form.buttonColor || effectivePrimary }}
                  >
                    My Courses
                  </button>
                </div>
                <div className="p-4 bg-background flex gap-3" style={{ backgroundColor: form.pageBgColor || undefined }}>
                  <div
                    className="h-14 w-20 rounded-lg shrink-0"
                    style={{ backgroundColor: effectivePrimary + "28" }}
                  />
                  <div className="flex flex-col gap-1.5 flex-1">
                    <div className="h-3 w-32 rounded bg-foreground/20" />
                    <div className="h-2.5 w-full rounded bg-foreground/10" />
                    <div className="h-1.5 w-full rounded-full bg-muted mt-1">
                      <div
                        className="h-1.5 rounded-full w-2/3"
                        style={{ backgroundColor: effectivePrimary }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Colors & Fonts ── */}
        <TabsContent value="colors" className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Primary Color</CardTitle>
              <CardDescription>Used for buttons, active states, progress bars, and CTAs across the student school and course player</CardDescription>
            </CardHeader>
            <CardContent>
              <ColorField
                label="Student Primary Color"
                value={form.studentPrimaryColor}
                onChange={(v) => { set("studentPrimaryColor", v); set("primaryColor", v); }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Accent Color</CardTitle>
              <CardDescription>Secondary highlight used in badges, tags, and decorative elements</CardDescription>
            </CardHeader>
            <CardContent>
              <ColorField
                label="Accent Color"
                value={form.studentAccentColor}
                onChange={(v) => { set("studentAccentColor", v); set("accentColor", v); }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Button Color</CardTitle>
              <CardDescription>Override the color used for primary action buttons. Leave blank to use the Primary Color.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ColorField
                label="Button Background"
                value={form.buttonColor}
                onChange={(v) => set("buttonColor", v)}
              />
              <div className="flex items-center gap-3 pt-2 border-t border-border/50">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground mb-1 block">Button Text Color (optional)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={form.buttonTextColor}
                      onChange={(e) => set("buttonTextColor", e.target.value)}
                      placeholder="#ffffff"
                      className="h-8 font-mono text-sm"
                    />
                    <input
                      type="color"
                      value={form.buttonTextColor || "#ffffff"}
                      onChange={(e) => set("buttonTextColor", e.target.value)}
                      className="h-9 w-9 rounded-lg border border-border cursor-pointer p-0.5 bg-transparent"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Page Background</CardTitle>
              <CardDescription>Override the background color for student-facing pages. Leave blank to use the theme default.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg border border-border shrink-0" style={{ backgroundColor: form.pageBgColor || "#f8fafc" }} />
                <Input
                  value={form.pageBgColor}
                  onChange={(e) => set("pageBgColor", e.target.value)}
                  placeholder="#f8fafc"
                  className="h-8 font-mono text-sm"
                />
                <input
                  type="color"
                  value={form.pageBgColor || "#f8fafc"}
                  onChange={(e) => set("pageBgColor", e.target.value)}
                  className="h-9 w-9 rounded-lg border border-border cursor-pointer p-0.5 bg-transparent"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">School Theme</CardTitle>
              <CardDescription>Choose a light or dark background for your student school pages</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {(["light", "dark"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => set("studentTheme", mode)}
                    className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
                      form.studentTheme === mode
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/40"
                    }`}
                  >
                    <div
                      className={`w-full h-16 rounded-lg border flex flex-col gap-1 p-2 overflow-hidden ${
                        mode === "light" ? "bg-white border-border" : "bg-gray-900 border-gray-700"
                      }`}
                    >
                      <div className={`h-2 w-3/4 rounded ${mode === "light" ? "bg-gray-200" : "bg-gray-700"}`} />
                      <div className={`h-2 w-1/2 rounded ${mode === "light" ? "bg-gray-100" : "bg-gray-800"}`} />
                      <div className="mt-1 h-3 w-1/3 rounded" style={{ backgroundColor: effectivePrimary }} />
                    </div>
                    <span className="text-sm font-medium capitalize">{mode}</span>
                    {form.studentTheme === mode && (
                      <span className="text-xs text-primary font-semibold">Active</span>
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Typography</CardTitle>
              <CardDescription>Font family used in the student school, course player, and landing pages</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={form.fontFamily} onValueChange={(v) => set("fontFamily", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_OPTIONS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      <span style={{ fontFamily: f.value }}>{f.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-3 text-sm text-muted-foreground" style={{ fontFamily: form.fontFamily }}>
                Preview: The quick brown fox jumps over the lazy dog.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Email & Invoices ── */}
        <TabsContent value="email" className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Email Sender Name</CardTitle>
              <CardDescription>The "From" name shown in enrollment confirmation emails, reminders, and announcements sent to students</CardDescription>
            </CardHeader>
            <CardContent>
              <Input
                value={emailBranding.senderName ?? ""}
                onChange={(e) => setEmail("senderName", e.target.value)}
                placeholder={form.schoolName || "e.g. Acme Training Academy"}
              />
              <p className="text-xs text-muted-foreground mt-1.5">Leave blank to use your School Name</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Email Logo</CardTitle>
              <CardDescription>Logo shown at the top of all outgoing emails. Defaults to your School Logo if not set.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <Switch
                  id="email-use-org-logo"
                  checked={emailBranding.useOrgLogo !== false}
                  onCheckedChange={(v) => setEmail("useOrgLogo", v)}
                />
                <Label htmlFor="email-use-org-logo" className="text-sm">Use School Logo for emails</Label>
              </div>
              {emailBranding.useOrgLogo === false && orgId && (
                <ImageUploader
                  value={emailBranding.logoUrl ?? ""}
                  onChange={(url) => setEmail("logoUrl", url)}
                  orgId={orgId}
                  label="Email Logo"
                  hint="Recommended: 200×60 px, PNG with transparent background"
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Email Accent Color</CardTitle>
              <CardDescription>Color used for buttons and highlights in outgoing emails and invoice headers. Defaults to your Primary Color.</CardDescription>
            </CardHeader>
            <CardContent>
              <ColorField
                label="Email Accent Color"
                value={emailBranding.primaryColor ?? ""}
                onChange={(v) => setEmail("primaryColor", v)}
              />
              <p className="text-xs text-muted-foreground mt-2">Leave blank to use your Primary Color</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Email Footer Text</CardTitle>
              <CardDescription>Custom text shown at the bottom of all outgoing emails (e.g., address, unsubscribe notice, legal disclaimer)</CardDescription>
            </CardHeader>
            <CardContent>
              <textarea
                value={emailBranding.footerText ?? ""}
                onChange={(e) => setEmail("footerText", e.target.value)}
                placeholder="e.g. © 2025 Acme Training Academy · 123 Main St, Springfield · Unsubscribe"
                className="w-full h-24 text-sm bg-muted/30 border border-border rounded-lg p-3 resize-y focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invoice Branding</CardTitle>
              <CardDescription>Your School Logo and School Name are automatically used on invoices and receipts. The Email Accent Color is used for invoice headers.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-border bg-muted/20 p-4 flex flex-col gap-3">
                <div
                  className="h-10 rounded-md flex items-center px-4"
                  style={{ backgroundColor: emailBranding.primaryColor || effectivePrimary }}
                >
                  {form.adminLogoUrl ? (
                    <img src={form.adminLogoUrl} alt="Logo" className="h-6 object-contain" />
                  ) : (
                    <span className="text-white font-semibold text-sm">{form.schoolName || "Your School"}</span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 px-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Invoice #1001</span>
                    <span>Jan 1, 2025</span>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex justify-between text-xs">
                    <span>Course: Introduction to…</span>
                    <span className="font-semibold">$99.00</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Preview of how your invoices will appear to students</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Advanced CSS ── */}
        <TabsContent value="advanced" className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Custom CSS</CardTitle>
              <CardDescription>
                Inject custom CSS into the student school pages. Scoped to{" "}
                <code className="bg-muted px-1 rounded text-xs">.school-scope</code> — use with care.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <textarea
                value={form.customCss}
                onChange={(e) => set("customCss", e.target.value)}
                placeholder={"/* Your custom CSS here */\n.school-scope .hero-title { font-size: 2.5rem; }"}
                className="w-full h-48 font-mono text-xs bg-muted/30 border border-border rounded-lg p-3 resize-y focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateTheme.isPending} className="gap-2 min-w-[120px]">
          {updateTheme.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          Save Branding
        </Button>
      </div>
    </div>
  );
}
