import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useOrgScope } from "@/hooks/useOrgScope";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  BookOpen, ChevronLeft, Copy, Database, Download, ExternalLink, FileArchive,
  GitBranch, Globe, Link2, Loader2, Lock, Play, RefreshCw, Save, Settings, Shield, User, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";

type LmsShellSettings = {
  shellTitle?: string;
  logoUrl?: string;
  theme?: "light" | "dark";
  showProgress?: boolean;
  showCompletion?: boolean;
  showSessionStatus?: boolean;
  showFooter?: boolean;
  showSidebar?: boolean;
  allowNotes?: boolean;
};

function parseLmsShellSettings(value: unknown): LmsShellSettings {
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed as LmsShellSettings : {};
  } catch {
    return {};
  }
}

// ── Dynamic Embed Integration Builder ────────────────────────────────────────
const ALL_PARAMS = [
  { key: "learner_name",  label: "Learner Name",   token: "{{learner_name}}",  desc: "Full name of the learner",        example: "Jane Smith" },
  { key: "learner_email", label: "Learner Email",  token: "{{learner_email}}", desc: "Email address for session tracking", example: "jane@example.com" },
  { key: "learner_id",    label: "Learner ID",     token: "{{learner_id}}",    desc: "Employee, student, or user ID",   example: "EMP-12345" },
  { key: "learner_group", label: "Group / Cohort", token: "{{learner_group}}", desc: "Team, class, or cohort name",     example: "Cohort-2026-Q1" },
  { key: "custom_data",   label: "Custom Data",    token: "{{custom_data}}",   desc: "Any extra key=value metadata",    example: "dept=cardio" },
  { key: "utm_source",    label: "UTM Source",     token: "{{utm_source}}",    desc: "Traffic source (e.g. email)",     example: "lms" },
  { key: "utm_medium",    label: "UTM Medium",     token: "{{utm_medium}}",    desc: "Marketing medium",               example: "course" },
  { key: "utm_campaign",  label: "UTM Campaign",   token: "{{utm_campaign}}",  desc: "Campaign or course name",        example: "onboarding-2026" },
] as const;

type ParamKey = typeof ALL_PARAMS[number]["key"];

function EmbedIntegrationBuilder({ baseUrl }: { baseUrl: string }) {
  const [enabled, setEnabled] = useState<Set<ParamKey>>(() => new Set<ParamKey>(["learner_name", "learner_email", "learner_id"]));
  const [testValues, setTestValues] = useState<Record<ParamKey, string>>(
    Object.fromEntries(ALL_PARAMS.map((p) => [p.key, ""])) as Record<ParamKey, string>
  );
  const [activeTab, setActiveTab] = useState<"js" | "iframe" | "server">("js");
  const [showTest, setShowTest] = useState(false);

  const toggleParam = (key: ParamKey) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // Template URL — uses {{token}} placeholders for enabled params
  const templateUrl = useMemo(() => {
    const url = new URL(baseUrl);
    for (const p of ALL_PARAMS) {
      if (enabled.has(p.key)) url.searchParams.set(p.key, p.token);
    }
    return url.toString();
  }, [baseUrl, enabled]);

  // Live preview URL — substitutes test values (or keeps placeholder if blank)
  const previewUrl = useMemo(() => {
    const url = new URL(baseUrl);
    for (const p of ALL_PARAMS) {
      if (!enabled.has(p.key)) continue;
      const val = testValues[p.key].trim();
      url.searchParams.set(p.key, val || p.token);
    }
    return url.toString();
  }, [baseUrl, enabled, testValues]);

  const enabledParams = ALL_PARAMS.filter((p) => enabled.has(p.key));

  // Code snippets
  const jsVarLines = enabledParams.map((p) => `  const ${p.key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())} = getCurrentUser().${p.key}; // replace with your variable`).join("\n");
  const jsReplaceLines = enabledParams.map((p) => `    .replace('${p.token}', encodeURIComponent(${p.key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())}))`).join("\n");

  const jsSnippet = enabledParams.length === 0 ? `// Enable at least one parameter above` : `// 1. Store the template URL (copy from above)
const TEMPLATE_URL = '${templateUrl}';

// 2. Replace placeholders with your app's dynamic variables
function buildLearnerUrl() {
${jsVarLines}

  return TEMPLATE_URL
${jsReplaceLines};
}

// 3. Set the iframe src
document.getElementById('teachific-frame').src = buildLearnerUrl();`;

  const jsUrl = templateUrl.replace(/{{/g, '${user.').replace(/}}/g, '}');
  const BT = String.fromCharCode(96); // backtick — avoids nested template literal parse errors
  const iframeSnippet = enabledParams.length === 0
    ? '<iframe src="' + baseUrl + '" width="100%" height="600" frameborder="0" allowfullscreen></iframe>'
    : [
        '<!-- Replace each {{token}} with your platform\'s variable syntax -->',
        '<!-- Example shown with generic JS template literals -->',
        '<script>',
        '  const url = ' + BT + jsUrl + BT + ';',
        '  document.write(' + BT + '<iframe src="${url}" width="100%" height="600" frameborder="0" allowfullscreen></iframe>' + BT + ');',
        '</script>',
      ].join('\n');

  const serverSnippet = enabledParams.length === 0
    ? '# Enable at least one parameter above'
    : [
        '# Python / Django example',
        'from urllib.parse import urlencode, quote_plus',
        '',
        "base = '" + baseUrl + "'",
        'params = {',
        ...enabledParams.map((p) => "    '" + p.key + "': request.user." + p.key.replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase()) + ",  # your user object field"),
        '}',
        "embed_url = base + '?' + urlencode(params, quote_via=quote_plus)",
        '',
        '# Pass embed_url to your template:',
        '# <iframe src="{{ embed_url }}" ...></iframe>',
        '',
        '# Node.js / Express example:',
        '# const params = new URLSearchParams({',
        ...enabledParams.map((p) => '#   ' + p.key + ': req.user.' + p.key + ','),
        '# });',
        '# const embedUrl = `' + baseUrl + '?${params}`;',
      ].join('\n');

  return (
    <div className="space-y-5 pt-1 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Step 1: Select params */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Step 1 — Choose which variables to pass</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ALL_PARAMS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => toggleParam(p.key)}
              className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition-colors ${
                enabled.has(p.key)
                  ? "border-primary/60 bg-primary/5 text-foreground"
                  : "border-border/50 bg-muted/30 text-muted-foreground hover:border-border"
              }`}
            >
              <div className={`mt-0.5 h-4 w-4 shrink-0 rounded border flex items-center justify-center ${
                enabled.has(p.key) ? "bg-primary border-primary" : "border-muted-foreground/40"
              }`}>
                {enabled.has(p.key) && <svg viewBox="0 0 10 8" className="h-2.5 w-2.5 fill-primary-foreground"><path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium leading-tight">{p.label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{p.desc}</p>
                <code className="text-[10px] text-primary/80 mt-0.5 block">{p.token}</code>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Step 2: Template URL */}
      {enabledParams.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Step 2 — Template URL (copy this into your code)</p>
          <div className="flex gap-2">
            <Input readOnly value={templateUrl} className="font-mono text-[11px] h-8" />
            <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => { navigator.clipboard.writeText(templateUrl); toast.success("Template URL copied!"); }}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            Your server or frontend replaces each <code className="text-primary/80">&#123;&#123;token&#125;&#125;</code> with the learner's actual value before setting the iframe <code className="text-primary/80">src</code>.
          </p>
        </div>
      )}

      {/* Step 3: Code snippets */}
      {enabledParams.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Step 3 — Integration code</p>
          <div className="flex gap-1 mb-2">
            {(["js", "iframe", "server"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setActiveTab(t)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  activeTab === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}>
                {t === "js" ? "JavaScript" : t === "iframe" ? "iframe HTML" : "Server-side"}
              </button>
            ))}
          </div>
          <div className="relative">
            <pre className="bg-muted rounded-lg p-3 text-[11px] leading-relaxed overflow-x-auto whitespace-pre font-mono max-h-56">
              {activeTab === "js" ? jsSnippet : activeTab === "iframe" ? iframeSnippet : serverSnippet}
            </pre>
            <Button variant="ghost" size="sm" className="absolute top-2 right-2 h-6 px-2 text-[10px]"
              onClick={() => {
                const txt = activeTab === "js" ? jsSnippet : activeTab === "iframe" ? iframeSnippet : serverSnippet;
                navigator.clipboard.writeText(txt);
                toast.success("Code copied!");
              }}>
              <Copy className="h-3 w-3 mr-1" />Copy
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Live test */}
      {enabledParams.length > 0 && (
        <div>
          <button type="button" onClick={() => setShowTest((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors">
            <svg viewBox="0 0 16 16" className={`h-3.5 w-3.5 transition-transform ${showTest ? "rotate-90" : ""}`} fill="currentColor">
              <path d="M6 4l4 4-4 4"/>
            </svg>
            Step 4 — Test with sample values
          </button>
          {showTest && (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {enabledParams.map((p) => (
                  <div key={p.key} className="space-y-0.5">
                    <Label className="text-[11px] font-medium">{p.label}</Label>
                    <Input
                      value={testValues[p.key]}
                      onChange={(e) => setTestValues((v) => ({ ...v, [p.key]: e.target.value }))}
                      placeholder={p.example}
                      className="h-7 text-xs"
                    />
                  </div>
                ))}
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground mb-1">Preview URL (unfilled tokens remain as placeholders):</p>
                <div className="flex gap-2">
                  <Input readOnly value={previewUrl} className="font-mono text-[11px] h-7" />
                  <Button variant="outline" size="icon" className="h-7 w-7 shrink-0" onClick={() => { navigator.clipboard.writeText(previewUrl); toast.success("Copied!"); }}>
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-7 w-7 shrink-0" asChild>
                    <a href={previewUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3" /></a>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Save to Question Bank Dialog ────────────────────────────────────────────
type BankPreviewQuestion = {
  questionType: string;
  stem: string;
  dataJson: string;
  points?: number;
  difficulty?: string;
  explanation?: string;
  tags?: string;
};
type BankPreviewResult = {
  source: string;
  questions: BankPreviewQuestion[];
  totalRows: number;
  validCount: number;
  errorCount: number;
  warnings: string[];
  mediaUploaded?: number;
};

const QTYPE_LABELS: Record<string, string> = {
  mcq: "Multiple Choice", tf: "True / False", short_answer: "Short Answer",
  long_answer: "Essay", matching: "Matching", multiple_select: "Multiple Select",
  ordering: "Ordering", numeric: "Numeric", fill_blank: "Fill in the Blank",
};

function SaveToBankDialog({ open, onClose, packageTitle, originalZipKey }: {
  open: boolean; onClose: () => void;
  packageTitle: string; originalZipKey?: string | null;
}) {
  const { orgId, ready } = useOrgScope();
  const [step, setStep] = useState<"idle" | "loading" | "preview" | "importing" | "done">("idle");
  const [preview, setPreview] = useState<BankPreviewResult | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [targetFolderId, setTargetFolderId] = useState<string>("none");
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: folders } = trpc.questionBank.listFolders.useQuery(
    { orgId: orgId! }, { enabled: !!orgId && ready }
  );
  const bulkImport = trpc.questionBank.bulkImport.useMutation();

  useEffect(() => {
    if (open) {
      setStep("idle"); setPreview(null); setSelectedIndices(new Set());
      setTargetFolderId("none"); setImportResult(null); setError(null);
    }
  }, [open]);

  const handleExtract = useCallback(async () => {
    if (!orgId || !originalZipKey) return;
    setStep("loading"); setError(null);
    try {
      const res = await fetch("/api/quiz/bank-import/extract-from-package", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ packageKey: originalZipKey, orgId: String(orgId) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Extraction failed");
      if (!data.questions || data.questions.length === 0) throw new Error("No questions were found in this package.");
      setPreview(data);
      setSelectedIndices(new Set(data.questions.map((_: unknown, i: number) => i)));
      setStep("preview");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Extraction failed");
      setStep("idle");
    }
  }, [orgId, originalZipKey]);

  const handleImport = async () => {
    if (!preview || !orgId || selectedIndices.size === 0) return;
    setStep("importing");
    try {
      const questions = preview.questions.filter((_, i) => selectedIndices.has(i));
      const folderId = targetFolderId === "none" ? null : parseInt(targetFolderId, 10);
      const result = await bulkImport.mutateAsync({ orgId, folderId, questions });
      setImportResult({ imported: result.imported, skipped: result.skipped });
      setStep("done");
      toast.success(`${result.imported} question${result.imported !== 1 ? "s" : ""} imported to Question Bank`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Import failed");
      setStep("preview");
    }
  };

  const toggleAll = () => {
    if (!preview) return;
    setSelectedIndices(
      selectedIndices.size === preview.questions.length
        ? new Set()
        : new Set(preview.questions.map((_, i) => i))
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Save to Question Bank
          </DialogTitle>
          <DialogDescription>
            Extract questions from <span className="font-medium text-foreground">{packageTitle}</span> and add them to your Question Bank.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {step === "idle" && !originalZipKey && (
            <div className="text-center py-8 space-y-2">
              <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
              <p className="text-sm font-medium">No original ZIP available</p>
              <p className="text-xs text-muted-foreground">This package does not have an original ZIP stored. Only packages uploaded with the original .zip or .quiz file can be extracted.</p>
            </div>
          )}
          {step === "idle" && originalZipKey && (
            <div className="text-center py-8 space-y-3">
              <Database className="h-10 w-10 text-primary/60 mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Extract questions from this package</p>
                <p className="text-xs text-muted-foreground">Supports iSpring, Teachific .quiz, QTI XML, and XLSX formats inside the ZIP.</p>
              </div>
              <Button onClick={handleExtract} className="gap-2"><Database className="h-4 w-4" />Extract Questions</Button>
            </div>
          )}
          {step === "loading" && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Downloading and parsing package…</p>
            </div>
          )}
          {step === "preview" && preview && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{preview.questions.length} questions found</Badge>
                {(preview.mediaUploaded ?? 0) > 0 && <Badge variant="outline">{preview.mediaUploaded} media files uploaded</Badge>}
                {preview.warnings.length > 0 && <Badge variant="outline" className="text-amber-600 border-amber-400">{preview.warnings.length} warnings</Badge>}
              </div>
              <div className="flex items-center gap-3">
                <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                <Label className="text-sm whitespace-nowrap">Destination Folder</Label>
                <Select value={targetFolderId} onValueChange={setTargetFolderId}>
                  <SelectTrigger className="flex-1 max-w-xs"><SelectValue placeholder="No folder (unfiled)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— No folder (unfiled) —</SelectItem>
                    {(folders ?? []).map((f: { id: number; name: string }) => (
                      <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{selectedIndices.size} / {preview.questions.length}</span>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b">
                  <span className="text-xs font-medium">Questions Preview</span>
                  <button type="button" onClick={toggleAll} className="text-xs text-primary hover:underline">
                    {selectedIndices.size === preview.questions.length ? "Deselect All" : "Select All"}
                  </button>
                </div>
                <div className="divide-y max-h-64 overflow-y-auto">
                  {preview.questions.map((q, i) => {
                    const isHtml = /<[a-z][\s\S]*>/i.test(q.stem);
                    return (
                      <div key={i}
                        className={`flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors ${selectedIndices.has(i) ? "bg-primary/5" : ""}`}
                        onClick={() => setSelectedIndices((prev) => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; })}>
                        <div className={`mt-0.5 h-4 w-4 shrink-0 rounded border flex items-center justify-center ${selectedIndices.has(i) ? "bg-primary border-primary" : "border-muted-foreground/40"}`}>
                          {selectedIndices.has(i) && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5">{QTYPE_LABELS[q.questionType] ?? q.questionType}</Badge>
                            {q.difficulty && <span className="text-[10px] text-muted-foreground">{q.difficulty}</span>}
                          </div>
                          {isHtml
                            ? <div className="text-xs line-clamp-2 [&_img]:max-h-8 [&_img]:inline" dangerouslySetInnerHTML={{ __html: q.stem }} />
                            : <p className="text-xs line-clamp-2">{q.stem}</p>
                          }
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          {step === "importing" && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Importing questions…</p>
            </div>
          )}
          {step === "done" && importResult && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <div className="h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-green-600 dark:text-green-400" />
              </div>
              <div className="text-center space-y-1">
                <p className="font-semibold">{importResult.imported} question{importResult.imported !== 1 ? "s" : ""} imported</p>
                {importResult.skipped > 0 && <p className="text-xs text-amber-600">{importResult.skipped} skipped due to errors</p>}
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="pt-2">
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("idle")}>Back</Button>
              <Button onClick={handleImport} disabled={selectedIndices.size === 0} className="gap-2">
                <Database className="h-4 w-4" />Import {selectedIndices.size} Question{selectedIndices.size !== 1 ? "s" : ""}
              </Button>
            </>
          )}
          {(step === "idle" || step === "done") && (
            <Button variant="outline" onClick={onClose}>{step === "done" ? "Close" : "Cancel"}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Upload New Version Component ────────────────────────────────────────────
function UploadNewVersion({ packageId, onSuccess }: { packageId: number; onSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [changelog, setChangelog] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; phase: string } | null>(null);
  const utils = trpc.useUtils();
  const { user } = useAuth();
  // Only site_owner and site_admin can upload files over 3 GB
  const canUploadLarge = user?.role === "site_owner" || user?.role === "site_admin";
  const FILE_SIZE_LIMIT = 3 * 1024 * 1024 * 1024; // 3 GB

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);

    const CHUNK_SIZE = 1 * 1024 * 1024; // 1 MB per chunk
    const PARALLEL = 1; // sequential — prevents connection contention that causes server-side abort
    const MAX_RETRIES = 5;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const changelogText = changelog || `Version upload ${new Date().toLocaleDateString()}`;

    const abort = () => { setUploading(false); setProgress(null); };

    // Track per-chunk bytes uploaded for accurate overall progress
    const chunkProgress = new Array(totalChunks).fill(0);

    const uploadChunk = (i: number, uploadId: string): Promise<void> =>
      new Promise<void>((resolve, reject) => {
        const start = i * CHUNK_SIZE;
        const chunk = file.slice(start, start + CHUNK_SIZE);
        const form = new FormData();
        form.append("chunk", chunk, file.name);
        form.append("chunkIndex", String(i));

        const xhr = new XMLHttpRequest();
        xhr.timeout = 0; // no timeout — let the server decide when to abort
        xhr.open("POST", `/api/chunked/version/${packageId}/chunk/${uploadId}`);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            chunkProgress[i] = e.loaded;
            const bytesDone = chunkProgress.reduce((a, b) => a + b, 0);
            const pct = Math.min(99, Math.round((bytesDone / file.size) * 100));
            setProgress({ done: pct, total: 100, phase: "uploading" });
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            chunkProgress[i] = chunk.size; // mark complete
            resolve();
          } else {
            let msg = `Chunk ${i + 1} failed (${xhr.status})`;
            try { msg = JSON.parse(xhr.responseText).error ?? msg; } catch { /* ignore */ }
            reject(new Error(msg));
          }
        };
        xhr.onerror = () => reject(new Error(`Network error on chunk ${i + 1}`));
        xhr.ontimeout = () => reject(new Error(`Timeout on chunk ${i + 1}`));
        xhr.send(form);
      });

    const uploadChunkWithRetry = async (i: number, uploadId: string): Promise<void> => {
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          await uploadChunk(i, uploadId);
          return;
        } catch (err) {
          if (attempt === MAX_RETRIES) throw err;
          // Exponential backoff: 2s, 4s, 8s, 16s, 32s
          await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempt)));
        }
      }
    };

    try {
      // ── Step 1: Initiate chunked session ──────────────────────────────────
      setProgress({ done: 0, total: 100, phase: "uploading" });
      const initRes = await fetch(`/api/chunked/version/${packageId}/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totalChunks, filename: file.name, totalBytes: file.size }),
      });
      if (!initRes.ok) throw new Error((await initRes.json().catch(() => ({}))).error ?? "Failed to start upload");
      const { uploadId } = await initRes.json();

      // ── Step 2: Upload chunks PARALLEL (3 at a time) with per-chunk retry ─
      for (let i = 0; i < totalChunks; i += PARALLEL) {
        const batch = [];
        for (let j = i; j < Math.min(i + PARALLEL, totalChunks); j++) {
          batch.push(uploadChunkWithRetry(j, uploadId));
        }
        await Promise.all(batch);
      }

      // ── Step 3: Finalize — server assembles chunks and starts processing ──
      setProgress({ done: 0, total: 1, phase: "reading" });

      // Open SSE stream before finalize so we don't miss early events
      const evtSource = new EventSource(`/api/upload/progress/${packageId}`);
      evtSource.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          setProgress({ done: data.done ?? 0, total: data.total ?? 1, phase: data.phase ?? "processing" });
          if (data.phase === "ready" || data.phase === "error") {
            evtSource.close();
            setUploading(false);
            if (data.phase === "ready") {
              toast.success("New version uploaded successfully!");
              setFile(null);
              setChangelog("");
              utils.versions.list.invalidate({ packageId });
              utils.packages.get.invalidate({ id: packageId });
              onSuccess();
            } else {
              toast.error("Version upload failed. Please try again.");
            }
            setProgress(null);
          }
        } catch { /* ignore parse errors */ }
      };
      evtSource.onerror = () => { evtSource.close(); abort(); };

      const finalRes = await fetch(`/api/chunked/version/${packageId}/finalize/${uploadId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changelog: changelogText }),
      });
      if (!finalRes.ok) {
        evtSource.close();
        throw new Error((await finalRes.json().catch(() => ({}))).error ?? "Finalize failed");
      }
      // SSE will handle the rest — no further action needed here
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
      abort();
    }
  };

  const phaseLabel = (phase: string, done: number, total: number): string => {
    if (phase === "uploading" && total === 100) return `Uploading... ${done}%`;
    const labels: Record<string, string> = {
      uploading: "Uploading...",
      reading: "Reading ZIP...",
      extracting: "Extracting files...",
      finalizing: "Finalizing...",
      ready: "Done!",
      error: "Error",
    };
    return labels[phase] ?? phase;
  };

  return (
    <Card className="shadow-sm border-border/60">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-primary" />
          Upload New Version
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Replace the content while keeping the same embed URL and share links. All existing sessions and analytics are preserved.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="text-xs mb-1 block">New ZIP file</Label>
          <input
            type="file"
            accept=".zip"
            disabled={uploading}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer disabled:opacity-50"
          />
          {file && (
            <div className="mt-1 space-y-1">
              <p className="text-xs text-muted-foreground">{file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)</p>
              {!canUploadLarge && file.size > FILE_SIZE_LIMIT && (
                <p className="text-xs text-destructive font-medium">File size is restricted to 3 GB.</p>
              )}
            </div>
          )}
        </div>
        <div>
          <Label className="text-xs mb-1 block">Changelog <span className="text-muted-foreground">(optional)</span></Label>
          <Input
            value={changelog}
            onChange={(e) => setChangelog(e.target.value)}
            placeholder="What changed in this version?"
            disabled={uploading}
            className="text-sm h-8"
          />
        </div>
        {progress && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{phaseLabel(progress.phase, progress.done, progress.total)}</span>
              <span>{progress.phase !== "uploading" && progress.total > 1 ? `${progress.done} / ${progress.total} files` : ""}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: progress.total > 0 ? `${Math.round((progress.done / progress.total) * 100)}%` : "0%" }}
              />
            </div>
          </div>
        )}
        <Button
          onClick={handleUpload}
          disabled={!file || uploading || (!canUploadLarge && !!file && file.size > FILE_SIZE_LIMIT)}
          size="sm"
          className="w-full"
        >
          {uploading ? (
            <><RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" />Processing...</>
          ) : (
            <><RefreshCw className="h-3.5 w-3.5 mr-2" />Upload New Version</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function FileDetailPage() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const packageId = Number(params.id);
  const { orgId, ready: orgReady } = useOrgScope();

  const { data: pkg, isLoading, refetch } = trpc.packages.getManaged.useQuery(
    { id: packageId, orgId: orgId ?? undefined },
    { enabled: !!orgId && orgReady }
  );
  const { data: versions } = trpc.versions.list.useQuery({ packageId });
  const { data: perms } = trpc.permissions.getManaged.useQuery({ packageId });
  const { data: analytics } = trpc.analytics.byPackage.useQuery({ packageId });

  const utils = trpc.useUtils();
  const updatePkg = trpc.packages.update.useMutation({ onSuccess: () => { toast.success("Saved"); refetch(); } });
  const updatePerms = trpc.permissions.update.useMutation({ onSuccess: () => toast.success("Permissions saved") });
  const generateToken = trpc.permissions.generateShareToken.useMutation();
  const restoreVersion = trpc.versions.restore.useMutation({
    onSuccess: () => {
      toast.success("Version restored successfully");
      refetch();
      utils.versions.list.invalidate({ packageId });
    },
    onError: () => toast.error("Failed to restore version"),
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [autoFullscreenMobile, setAutoFullscreenMobile] = useState(false);
  const [displayMode, setDisplayMode] = useState<"native" | "lms_shell" | "quiz">("native");
  const [lmsShellSettings, setLmsShellSettings] = useState<LmsShellSettings>({});
  const [allowDownload, setAllowDownload] = useState(false);
  const [maxPlays, setMaxPlays] = useState("");
  const [shareToken, setShareToken] = useState("");
  const [saveToBankOpen, setSaveToBankOpen] = useState(false);

  useEffect(() => {
    if (!pkg) return;
    const packageRecord = pkg as any;
    setTitle(pkg.title);
    setDescription(pkg.description ?? "");
    setIsPublic(pkg.isPublic ?? false);
    setAutoFullscreenMobile(packageRecord.autoFullscreenMobile ?? false);
    setDisplayMode(packageRecord.displayMode ?? "native");
    setLmsShellSettings(parseLmsShellSettings(packageRecord.lmsShellConfig));
  }, [pkg]);
  useEffect(() => {
    if (perms) {
      setAllowDownload(perms.allowDownload ?? false);
      setMaxPlays(perms.maxTotalPlays ? String(perms.maxTotalPlays) : "");
      setShareToken(perms.shareToken ?? "");
    }
  }, [perms]);

  const baseEmbedUrl = `${window.location.origin}/embed/${packageId}`;
  const shareUrl = shareToken ? `${baseEmbedUrl}?token=${shareToken}` : "";
  const savePackageSettings = () => updatePkg.mutate({
    id: packageId,
    title,
    description,
    isPublic,
    autoFullscreenMobile,
    displayMode,
    lmsShellConfig: JSON.stringify(lmsShellSettings),
  });

  if (isLoading) return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" />
    </div>
  );

  if (!pkg) return (
    <div className="p-6 text-center">
      <p className="text-muted-foreground">Package not found</p>
      <Button variant="outline" className="mt-4" onClick={() => setLocation("/files")}>Back to Files</Button>
    </div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/files")}><ChevronLeft className="h-4 w-4" /></Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{pkg.title}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${pkg.status === "ready" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{pkg.status}</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${pkg.isPublic ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{pkg.isPublic ? <><Globe className="h-3 w-3" />Public</> : <><Lock className="h-3 w-3" />Private</>}</span>
            <span className="text-xs text-muted-foreground">{pkg.contentType}</span>
            {pkg.scormVersion !== "none" && <span className="text-xs text-muted-foreground">SCORM {pkg.scormVersion}</span>}
          </div>
        </div>
        <Button onClick={() => setLocation(`/play/${packageId}`)} className="gap-2"><Play className="h-4 w-4" />Preview</Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Plays", value: pkg.totalPlayCount ?? 0, icon: Play },
          { label: "Downloads", value: pkg.totalDownloadCount ?? 0, icon: Download },
          { label: "Versions", value: versions?.length ?? 1, icon: GitBranch },
          { label: "Assets", value: (analytics as any)?.assetCount ?? "—", icon: FileArchive },
        ].map((s) => (
          <Card key={s.label} className="shadow-sm border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-xl font-bold mt-0.5">{s.value}</p></div>
                <s.icon className="h-5 w-5 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="details">
        <TabsList className="grid grid-cols-4 w-full max-w-lg">
          <TabsTrigger value="details"><Settings className="h-3.5 w-3.5 mr-1.5" />Details</TabsTrigger>
          <TabsTrigger value="permissions"><Shield className="h-3.5 w-3.5 mr-1.5" />Permissions</TabsTrigger>
          <TabsTrigger value="sharing"><Globe className="h-3.5 w-3.5 mr-1.5" />Sharing</TabsTrigger>
          <TabsTrigger value="versions"><GitBranch className="h-3.5 w-3.5 mr-1.5" />Versions</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4">
          <Card className="shadow-sm border-border/60">
            <CardHeader><CardTitle className="text-sm">Package Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <textarea className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              {pkg.scormVersion !== "none" && (
                <div className="p-3 rounded-lg bg-muted/50 space-y-1 text-sm">
                  <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">SCORM Metadata</p>
                  <p><span className="text-muted-foreground">Version:</span> {pkg.scormVersion}</p>
                  {pkg.scormEntryPoint && <p><span className="text-muted-foreground">Entry:</span> <code className="text-xs bg-muted px-1 rounded">{pkg.scormEntryPoint}</code></p>}
                </div>
              )}
              <div className="space-y-2">
                <Label>Access Control</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setIsPublic(false); updatePkg.mutate({ id: packageId, title, description, isPublic: false }); }}
                    className={`flex flex-col items-start gap-1.5 rounded-lg border-2 p-3 text-left transition-all ${
                      !isPublic
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border bg-background text-muted-foreground hover:border-border/80 hover:text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-medium text-sm">
                      <Lock className="h-4 w-4 shrink-0" />
                      Private
                    </div>
                    <p className="text-xs leading-snug opacity-80">Only signed-in users can view</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsPublic(true); updatePkg.mutate({ id: packageId, title, description, isPublic: true }); }}
                    className={`flex flex-col items-start gap-1.5 rounded-lg border-2 p-3 text-left transition-all ${
                      isPublic
                        ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400"
                        : "border-border bg-background text-muted-foreground hover:border-border/80 hover:text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-medium text-sm">
                      <Globe className="h-4 w-4 shrink-0" />
                      Public
                    </div>
                    <p className="text-xs leading-snug opacity-80">Anyone with the link can view</p>
                  </button>
                </div>
              </div>
              {/* Mobile Playback Settings */}
              <div className="space-y-2">
                <Label>Mobile Playback</Label>
                <div
                  className={`flex items-center justify-between rounded-lg border-2 p-3 transition-all cursor-pointer ${
                    autoFullscreenMobile
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background hover:border-border/80"
                  }`}
                  onClick={() => {
                    const next = !autoFullscreenMobile;
                    setAutoFullscreenMobile(next);
                    updatePkg.mutate({ id: packageId, title, description, isPublic, autoFullscreenMobile: next });
                  }}
                >
                  <div className="space-y-0.5">
                    <p className={`text-sm font-medium ${ autoFullscreenMobile ? "text-primary" : "text-foreground" }`}>Auto-fullscreen on mobile</p>
                    <p className="text-xs text-muted-foreground">Automatically enter fullscreen when opened on a mobile device</p>
                  </div>
                  <div className={`h-5 w-9 rounded-full transition-colors shrink-0 ${ autoFullscreenMobile ? "bg-primary" : "bg-muted-foreground/30" }`}>
                    <div className={`h-4 w-4 rounded-full bg-white shadow transition-transform mt-0.5 ${ autoFullscreenMobile ? "translate-x-4 ml-0.5" : "translate-x-0.5" }`} />
                  </div>
                </div>
              </div>
              <div className="space-y-3 rounded-lg border border-border/70 p-4">
                <div>
                  <Label>Display Mode</Label>
                  <p className="mt-1 text-xs text-muted-foreground">Choose how learners experience this organization-owned package.</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {([
                    ["native", "Native", "Play the imported package exactly as supplied."],
                    ["lms_shell", "LMS Shell", "Wrap the package in your configured learner shell."],
                    ["quiz", "Quiz", "Deliver extracted questions through the quiz experience."],
                  ] as const).map(([value, label, helper]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setDisplayMode(value)}
                      className={`rounded-lg border-2 p-3 text-left transition-colors ${displayMode === value ? "border-primary bg-primary/5 text-primary" : "border-border bg-background text-muted-foreground hover:border-border/80 hover:text-foreground"}`}
                    >
                      <span className="block text-sm font-medium">{label}</span>
                      <span className="mt-1 block text-xs leading-snug opacity-80">{helper}</span>
                    </button>
                  ))}
                </div>
              </div>
              {displayMode === "lms_shell" && (
                <div className="space-y-4 rounded-lg border border-primary/25 bg-primary/[0.03] p-4">
                  <div>
                    <Label>LMS Shell Settings</Label>
                    <p className="mt-1 text-xs text-muted-foreground">These settings apply only to this package in the active organization.</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="shell-title">Learner shell title</Label>
                      <Input id="shell-title" value={lmsShellSettings.shellTitle ?? ""} placeholder="Learning Portal" onChange={(event) => setLmsShellSettings((current) => ({ ...current, shellTitle: event.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="shell-logo">Logo URL</Label>
                      <Input id="shell-logo" value={lmsShellSettings.logoUrl ?? ""} placeholder="https://…" onChange={(event) => setLmsShellSettings((current) => ({ ...current, logoUrl: event.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Shell theme</Label>
                      <Select value={lmsShellSettings.theme ?? "dark"} onValueChange={(theme: "light" | "dark") => setLmsShellSettings((current) => ({ ...current, theme }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="dark">Dark</SelectItem><SelectItem value="light">Light</SelectItem></SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {([
                      ["showProgress", "Show progress", "Display learner progress in the shell header."],
                      ["showCompletion", "Show completion badge", "Show the completion status when available."],
                      ["showSessionStatus", "Show session status", "Show session information in the footer."],
                      ["showFooter", "Show footer", "Show the organization-owned learner shell footer."],
                      ["showSidebar", "Show sidebar", "Show package context alongside learner content."],
                      ["allowNotes", "Enable learner notes", "Let learners retain browser-local notes for this package."],
                    ] as const).map(([key, label, helper]) => (
                      <div key={key} className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-background p-3">
                        <div><p className="text-sm font-medium">{label}</p><p className="text-xs text-muted-foreground">{helper}</p></div>
                        <Switch checked={lmsShellSettings[key] ?? true} onCheckedChange={(checked) => setLmsShellSettings((current) => ({ ...current, [key]: checked }))} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {pkg.originalZipUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a href={pkg.originalZipUrl} download target="_blank" rel="noreferrer"><Download className="h-3.5 w-3.5 mr-1.5" />Download Original ZIP</a>
                </Button>
              )}
              {(pkg as any).originalZipKey && (
                <Button variant="outline" size="sm" onClick={() => setSaveToBankOpen(true)} className="gap-2">
                  <Database className="h-3.5 w-3.5" />Save to Question Bank
                </Button>
              )}
              <Button onClick={savePackageSettings} disabled={updatePkg.isPending} className="gap-2">
                <Save className="h-3.5 w-3.5" />{updatePkg.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions" className="mt-4">
          <Card className="shadow-sm border-border/60">
            <CardHeader><CardTitle className="text-sm">Access Permissions</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between">
                <div><p className="text-sm font-medium">Allow Download</p><p className="text-xs text-muted-foreground">Let users download the original ZIP file</p></div>
                <Switch checked={allowDownload} onCheckedChange={setAllowDownload} />
              </div>
              <div className="space-y-1.5">
                <Label>Max Total Plays</Label>
                <Input type="number" placeholder="Unlimited" value={maxPlays} onChange={(e) => setMaxPlays(e.target.value)} className="max-w-xs" />
                <p className="text-xs text-muted-foreground">Leave blank for unlimited plays</p>
              </div>
              <Button onClick={() => updatePerms.mutate({ packageId, allowDownload, maxTotalPlays: maxPlays ? Number(maxPlays) : undefined })} disabled={updatePerms.isPending} className="gap-2">
                <Lock className="h-3.5 w-3.5" />{updatePerms.isPending ? "Saving..." : "Save Permissions"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sharing" className="mt-4 space-y-4">
          {/* Basic share links */}
          <Card className="shadow-sm border-border/60">
            <CardHeader><CardTitle className="text-sm">Share & Embed</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div>
                <p className="text-sm font-medium mb-2">Direct Play Link</p>
                <div className="flex gap-2">
                  <Input readOnly value={baseEmbedUrl} className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(baseEmbedUrl); toast.success("Copied!"); }}><Copy className="h-4 w-4" /></Button>
                  <Button variant="outline" size="icon" asChild><a href={`/embed/${packageId}`} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a></Button>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Token-Protected Share Link</p>
                {shareToken ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input readOnly value={shareUrl} className="font-mono text-xs" />
                      <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success("Copied!"); }}><Copy className="h-4 w-4" /></Button>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => generateToken.mutateAsync({ packageId, expiresInDays: 30 }).then((r) => setShareToken(r.token))} className="gap-1.5">
                      <RefreshCw className="h-3.5 w-3.5" />Regenerate
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" onClick={() => generateToken.mutateAsync({ packageId, expiresInDays: 30 }).then((r) => { setShareToken(r.token); toast.success("Share link generated"); })} className="gap-2">
                    <Link2 className="h-4 w-4" />Generate Share Link
                  </Button>
                )}
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Embed Code</p>
                <div className="relative">
                  <pre className="bg-muted rounded-lg p-3 text-xs overflow-x-auto whitespace-pre-wrap">{`<iframe src="${baseEmbedUrl}" width="100%" height="600" frameborder="0" allowfullscreen></iframe>`}</pre>
                  <Button variant="ghost" size="sm" className="absolute top-2 right-2" onClick={() => { navigator.clipboard.writeText(`<iframe src="${baseEmbedUrl}" width="100%" height="600" frameborder="0" allowfullscreen></iframe>`); toast.success("Copied!"); }}><Copy className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* URL Parameter Builder */}
          <Card className="shadow-sm border-border/60">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Dynamic Embed Integration
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Choose which variables to pass from your platform. Copy the template URL or ready-made code snippet and substitute the placeholders with your site's dynamic values.
              </p>
            </CardHeader>
            <CardContent>
              <EmbedIntegrationBuilder baseUrl={baseEmbedUrl} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="versions" className="mt-4 space-y-4">
          {/* Upload New Version */}
          <UploadNewVersion packageId={packageId} onSuccess={() => refetch()} />

          {/* Version History */}
          <Card className="shadow-sm border-border/60">
            <CardHeader><CardTitle className="text-sm">Version History</CardTitle></CardHeader>
            <CardContent>
              {!versions || versions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No version history available yet.</p>
              ) : (
                <div className="space-y-2">
                  {versions.map((v: any) => {
                    const isCurrent = v.id === pkg?.currentVersionId;
                    // Days remaining before auto-deletion (30 days after replacedAt)
                    const daysLeft = v.replacedAt
                      ? Math.ceil((new Date(v.replacedAt).getTime() + 30 * 24 * 60 * 60 * 1000 - Date.now()) / (1000 * 60 * 60 * 24))
                      : null;
                    const isExpired = daysLeft !== null && daysLeft <= 0;
                    return (
                      <div key={v.id} className={`flex items-start gap-3 p-3 rounded-lg border ${isCurrent ? "border-primary/40 bg-primary/5" : "border-border/60"}${isExpired ? " opacity-50" : ""}` }>
                        <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${isCurrent ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                          {v.versionNumber}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium">{v.versionLabel ?? `Version ${v.versionNumber}`}</p>
                            {isCurrent && <Badge variant="secondary" className="text-xs">Current</Badge>}
                            {daysLeft !== null && !isExpired && (
                              <Badge variant="outline" className="text-xs text-amber-600 border-amber-400">
                                Auto-delete in {daysLeft}d
                              </Badge>
                            )}
                            {isExpired && (
                              <Badge variant="outline" className="text-xs text-destructive border-destructive/50">Pending deletion</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {v.changelog && <span className="mr-2">{v.changelog}</span>}
                            {new Date(v.createdAt).toLocaleString()}
                          </p>
                          {v.fileCount > 0 && (
                            <p className="text-xs text-muted-foreground">{v.fileCount} files · {v.entryPoint}</p>
                          )}
                        </div>
                        {!isCurrent && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="shrink-0 text-xs h-7"
                            onClick={() => restoreVersion.mutate({ packageId, versionId: v.id })}
                            disabled={restoreVersion.isPending}
                          >
                            Restore
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <SaveToBankDialog
        open={saveToBankOpen}
        onClose={() => setSaveToBankOpen(false)}
        packageTitle={pkg.title}
        originalZipKey={(pkg as any).originalZipKey}
      />
    </div>
  );
}
