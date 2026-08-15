import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useOrgScope } from "@/hooks/useOrgScope";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertCircle, CheckCircle2, ChevronRight, FileArchive,
  Layers, Loader2, Monitor, Play, Upload, X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type DisplayMode = "native" | "lms_shell" | "quiz";
type Step = "select" | "configure" | "uploading" | "done";

interface UploadPageProps {
  /** When provided, renders as embedded content (no breadcrumb header). Called when user closes/cancels. */
  onClose?: () => void;
  /** Called after a successful upload so the parent can refresh its list. */
  onSuccess?: (packageId: number) => void;
  /** Pre-seed a ZIP file so the dialog opens directly on the configure step. */
  initialFile?: File;
}

const DISPLAY_MODES: Array<{ id: DisplayMode; label: string; desc: string; icon: React.ElementType }> = [
  {
    id: "native",
    label: "Native Format",
    desc: "Play exactly as created by the authoring tool (Articulate, iSpring, etc.). Preserves all original interactivity and styling.",
    icon: Monitor,
  },
  {
    id: "lms_shell",
    label: "LMS Presentation Shell",
    desc: "Wrap the content in the internal LMS player with navigation controls, progress tracking, and branded interface.",
    icon: Layers,
  },
  {
    id: "quiz",
    label: "Import as Quiz",
    desc: "Extract questions from the content and import them into the internal quiz engine for full control over scoring and attempts.",
    icon: Play,
  },
];

export default function UploadPage({ onClose, onSuccess, initialFile }: UploadPageProps = {}) {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { orgId: activeOrgId } = useOrgScope();
  const utils = trpc.useUtils();

  // Fetch user's orgs
  const { data: myOrgs, isLoading: orgsLoading } = trpc.orgs.myOrgs.useQuery(undefined, {
    enabled: !!user,
  });

  // Auto-provision default org if user has none
  const ensureDefault = trpc.orgs.ensureDefault.useMutation({
    onSuccess: () => {
      utils.orgs.myOrgs.invalidate();
    },
  });

  useEffect(() => {
    if (!orgsLoading && myOrgs && myOrgs.length === 0 && !ensureDefault.isPending) {
      ensureDefault.mutate();
    }
  }, [orgsLoading, myOrgs]);

  const [step, setStep] = useState<Step>(initialFile ? "configure" : "select");
  const [file, setFile] = useState<File | null>(initialFile ?? null);
  const [isDragging, setIsDragging] = useState(false);
  const [title, setTitle] = useState(initialFile ? initialFile.name.replace(/\.zip$/i, "").replace(/[-_]/g, " ") : "");
  const [description, setDescription] = useState("");
  const [displayMode, setDisplayMode] = useState<DisplayMode>("native");
  const [selectedOrgId, setSelectedOrgId] = useState<number>(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [packageId, setPackageId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadedBytes, setUploadedBytes] = useState(0);
  const [progressPhase, setProgressPhase] = useState<string>("uploading");
  const [extractDone, setExtractDone] = useState(0);
  const [extractTotal, setExtractTotal] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sseRef = useRef<EventSource | null>(null);

  const analyzePackage = trpc.packages.analyze.useMutation();

  // Resolve the effective org ID: prefer explicit selection, then active organization context.
  const effectiveOrgId = selectedOrgId || activeOrgId;

  const handleFileSelect = useCallback((selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith(".zip")) {
      toast.error("Only ZIP files are supported");
      return;
    }
    if (selectedFile.size > 3 * 1024 * 1024 * 1024) {
      toast.error("File size must be under 3 GB");
      return;
    }
    setFile(selectedFile);
    setTitle(selectedFile.name.replace(/\.zip$/i, "").replace(/[-_]/g, " "));
    setStep("configure");
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFileSelect(dropped);
  }, [handleFileSelect]);

  const handleUpload = async () => {
    if (!file || !title.trim()) { toast.error("Please provide a title"); return; }
    if (!effectiveOrgId) {
      toast.error("No workspace found. Please wait a moment and try again.");
      return;
    }
    if (!user) { toast.error("You must be logged in"); return; }

    setStep("uploading");
    setUploadProgress(5);
    setUploadedBytes(0);
    setProgressPhase("uploading");
    setExtractDone(0);
    setExtractTotal(0);
    setError(null);

    try {
      // ── Chunked upload — splits file into 5 MB pieces to bypass proxy timeout ──
      const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB per chunk
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

      // 1. Initiate upload session
      const initRes = await fetch("/api/chunked/package/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          totalChunks,
          filename: file.name,
          totalBytes: file.size,
          orgId: effectiveOrgId,
          uploadedBy: user.id,
          title,
          displayMode,
          lmsShellConfig: undefined,
        }),
      });
      if (!initRes.ok) {
        const err = await initRes.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to initiate upload");
      }
      const { uploadId } = await initRes.json();

      // 2. Upload each chunk
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);
        const chunkForm = new FormData();
        chunkForm.append("chunk", chunk, file.name);
        chunkForm.append("chunkIndex", String(i));
        const chunkRes = await fetch(`/api/chunked/package/chunk/${uploadId}`, {
          method: "POST",
          credentials: "include",
          body: chunkForm,
        });
        if (!chunkRes.ok) {
          const err = await chunkRes.json().catch(() => ({}));
          throw new Error(err.error ?? `Chunk ${i} upload failed`);
        }
        setUploadedBytes(end);
        // Upload phase = 5% → 60%
        setUploadProgress(5 + Math.round(((i + 1) / totalChunks) * 55));
      }

      // 3. Finalize — server assembles chunks and starts processing
      const finalRes = await fetch(`/api/chunked/package/finalize/${uploadId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      if (!finalRes.ok) {
        const err = await finalRes.json().catch(() => ({}));
        throw new Error(err.error ?? "Finalize failed");
      }
      const result: { packageId: number } = await finalRes.json();

      setPackageId(result.packageId);
      setUploadProgress(62);
      setProgressPhase("extracting");

      // Connect to SSE stream for real-time extraction progress
      const sse = new EventSource(`/api/upload/progress/${result.packageId}`);
      sseRef.current = sse;
      sse.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data) as { done: number; total: number; phase: string };
          setProgressPhase(data.phase);
          setExtractDone(data.done);
          setExtractTotal(data.total);
          if (data.phase === "ready") {
            setUploadProgress(100);
            sse.close();
            if (pollRef.current) clearInterval(pollRef.current);
            setStep("done");
            analyzePackage.mutate({ packageId: result.packageId, fileList: [] });
          } else if (data.phase === "error") {
            sse.close();
            if (pollRef.current) clearInterval(pollRef.current);
            setError("Processing failed");
            setStep("configure");
          } else if (data.total > 0) {
            // Extract/upload phase = 62% → 97%
            setUploadProgress(62 + Math.round((data.done / data.total) * 35));
          }
        } catch { /* ignore */ }
      };
      sse.onerror = () => {
        // SSE disconnected — fall back to polling
        sse.close();
      };

      // Polling fallback in case SSE is blocked
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/upload/status/${result.packageId}`);
          const status = await res.json();
          if (status.status === "ready") {
            setUploadProgress(100);
            clearInterval(pollRef.current!);
            sseRef.current?.close();
            setStep("done");
            analyzePackage.mutate({ packageId: result.packageId, fileList: [] });
          } else if (status.status === "error") {
            clearInterval(pollRef.current!);
            sseRef.current?.close();
            setError(status.processingError ?? "Processing failed");
            setStep("configure");
          }
        } catch { /* ignore */ }
      }, 5000);
    } catch (err: unknown) {
      setError(String(err));
      setStep("configure");
      toast.error("Upload failed: " + String(err));
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const resetForm = () => {
    setFile(null); setTitle(""); setDescription(""); setDisplayMode("native");
    setPackageId(null); setUploadProgress(0); setError(null); setStep("select");
  };

  // Notify parent when upload completes
  useEffect(() => {
    if (step === "done" && packageId && onSuccess) {
      onSuccess(packageId);
    }
  }, [step, packageId]);

  // Show a loading state while provisioning the default org
  const isProvisioningOrg = orgsLoading || ensureDefault.isPending;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {!onClose && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button onClick={() => setLocation("/")} className="hover:text-foreground transition-colors">Dashboard</button>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">Upload Content</span>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Upload Content Package</h1>
        <p className="text-muted-foreground text-sm mt-1">Upload SCORM, Articulate, iSpring, or HTML ZIP packages</p>
      </div>

      {/* Provisioning spinner */}
      {isProvisioningOrg && (
        <Card className="shadow-sm border-border/60">
          <CardContent className="p-6 flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
            Setting up your workspace&hellip;
          </CardContent>
        </Card>
      )}

      {/* Workspace badge — shown when org is resolved */}
      {!isProvisioningOrg && effectiveOrgId && myOrgs && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Workspace:</span>
          <Badge variant="secondary" className="text-xs">
            {myOrgs.find((o) => o.id === effectiveOrgId)?.name ?? "My Workspace"}
          </Badge>
          {myOrgs.length > 1 && (
            <select
              className="ml-2 h-7 rounded-md border border-input bg-background px-2 text-xs"
              value={selectedOrgId || ""}
              onChange={(e) => setSelectedOrgId(Number(e.target.value))}
            >
              {myOrgs.map((org) => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Step 1: Select File */}
      {step === "select" && !isProvisioningOrg && (
        <Card className="shadow-sm border-border/60">
          <CardContent className="p-8">
            <div
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer ${
                isDragging ? "border-primary bg-primary/5" : "border-border/60 hover:border-primary/50 hover:bg-accent/30"
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input ref={fileInputRef} type="file" accept=".zip" className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />
              <div className="flex flex-col items-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Upload className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <p className="text-base font-semibold">Drop your ZIP file here</p>
                  <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {["SCORM 1.2", "SCORM 2004", "Articulate", "iSpring", "HTML5"].map((t) => (
                    <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Maximum file size: 3 GB</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Configure */}
      {step === "configure" && file && (
        <div className="space-y-5">
          <Card className="shadow-sm border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <FileArchive className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8"
                  onClick={() => { setFile(null); setStep("select"); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Package Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Introduction to Data Science" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="desc">Description</Label>
                <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of this content..." rows={3} />
              </div>
              {/* Only show org selector when user belongs to multiple orgs */}
              {myOrgs && myOrgs.length > 1 && (
                <div className="space-y-1.5">
                  <Label>Workspace</Label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                    value={selectedOrgId || myOrgs[0]?.id || ""}
                    onChange={(e) => setSelectedOrgId(Number(e.target.value))}
                  >
                    {myOrgs.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
                  </select>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Display Mode</CardTitle>
              <p className="text-xs text-muted-foreground">Choose how this content will be presented to learners</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {DISPLAY_MODES.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setDisplayMode(mode.id)}
                  className={`w-full flex items-start gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                    displayMode === mode.id
                      ? "border-primary bg-primary/5"
                      : "border-border/60 hover:border-primary/30 hover:bg-accent/30"
                  }`}
                >
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                    displayMode === mode.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    <mode.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{mode.label}</p>
                      {displayMode === mode.id && <Badge className="text-xs h-4 px-1.5">Selected</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{mode.desc}</p>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => { setFile(null); setStep("select"); }}>Back</Button>
            <Button
              onClick={handleUpload}
              disabled={!title.trim() || !effectiveOrgId}
              className="flex-1 gap-2"
            >
              <Upload className="h-4 w-4" />Upload Package
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Uploading */}
      {step === "uploading" && (
        <Card className="shadow-sm border-border/60">
          <CardContent className="p-8 text-center space-y-6">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
            <div>
              <p className="font-semibold text-lg">
                {progressPhase === "uploading" ? "Uploading to storage..." :
                 progressPhase === "reading" ? "Reading ZIP contents..." :
                 progressPhase === "extracting" ? "Extracting files..." :
                 progressPhase === "uploading" ? "Uploading files to CDN..." :
                 progressPhase === "finalizing" ? "Finalizing package..." :
                 "Processing..."}
              </p>
              {/* File size + bytes uploaded */}
              {file && progressPhase === "uploading" && uploadedBytes > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  {formatSize(uploadedBytes)} / {formatSize(file.size)} transferred
                </p>
              )}
              {/* Extraction file count */}
              {extractTotal > 0 && progressPhase !== "uploading" && (
                <p className="text-sm text-muted-foreground mt-1">
                  {extractDone} / {extractTotal} files processed
                </p>
              )}
              {/* File size info always visible */}
              {file && (
                <p className="text-xs text-muted-foreground mt-1">
                  Package size: <span className="font-medium">{formatSize(file.size)}</span>
                  {file.size > 100 * 1024 * 1024 && " — large files may take several minutes"}
                </p>
              )}
            </div>
            <Progress value={uploadProgress} className="h-2.5" />
            <p className="text-xs font-medium text-primary">{uploadProgress}%</p>
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              {["Upload", "Extract", "CDN Upload", "Ready"].map((s, i) => (
                <span key={s} className="flex items-center gap-2">
                  {i > 0 && <ChevronRight className="h-3 w-3" />}
                  <span className={uploadProgress >= [5, 62, 75, 100][i] ? "text-primary font-medium" : ""}>{s}</span>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Done */}
      {step === "done" && packageId && (
        <Card className="shadow-sm border-border/60">
          <CardContent className="p-8 text-center space-y-6">
            <div className="h-16 w-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="font-bold text-xl">Upload Complete!</p>
              <p className="text-sm text-muted-foreground mt-1">
                <span className="font-medium">{title}</span> has been uploaded and processed successfully.
              </p>
              {analyzePackage.isPending && (
                <p className="text-xs text-muted-foreground mt-2 flex items-center justify-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />AI analysis running in background...
                </p>
              )}
            </div>
            <div className="flex gap-3 justify-center flex-wrap">
              {onClose ? (
                <Button variant="outline" onClick={onClose}>Back to Library</Button>
              ) : (
                <Button variant="outline" onClick={() => setLocation("/files")}>View All Files</Button>
              )}
              <Button onClick={() => onClose ? onClose() : setLocation(`/files/${packageId}`)}>Manage Package</Button>
              <Button variant="outline" onClick={() => setLocation(`/play/${packageId}`)}>
                <Play className="h-4 w-4 mr-1.5" />Preview
              </Button>
              <Button variant="ghost" onClick={resetForm}>Upload Another</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
