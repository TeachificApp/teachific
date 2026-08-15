import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrgTheme } from "@/contexts/OrgThemeContext";
import { useOrgScope } from "@/hooks/useOrgScope";
import {
  BookOpen, CheckCircle2, ChevronLeft, Clock, Download,
  ExternalLink, Maximize2, Minimize2, Play, Shield, X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";

// ─── SCORM API Bridge injected into the iframe via postMessage ───────────────
const SCORM_API_SCRIPT = `
(function() {
  var _data = {};
  var _initialized = false;
  var _finished = false;

  function post(type, payload) {
    window.parent.postMessage({ source: 'scorm-api', type: type, payload: payload }, '*');
  }

  // SCORM 1.2 API
  window.API = {
    LMSInitialize: function() { _initialized = true; post('initialize', {}); return 'true'; },
    LMSFinish: function() { _finished = true; post('finish', { data: _data }); return 'true'; },
    LMSGetValue: function(k) { return _data[k] || ''; },
    LMSSetValue: function(k, v) { _data[k] = v; post('setValue', { key: k, value: v }); return 'true'; },
    LMSCommit: function() { post('commit', { data: _data }); return 'true'; },
    LMSGetLastError: function() { return '0'; },
    LMSGetErrorString: function() { return ''; },
    LMSGetDiagnostic: function() { return ''; },
  };

  // SCORM 2004 API
  window.API_1484_11 = {
    Initialize: function() { _initialized = true; post('initialize', {}); return 'true'; },
    Terminate: function() { _finished = true; post('finish', { data: _data }); return 'true'; },
    GetValue: function(k) { return _data[k] || ''; },
    SetValue: function(k, v) { _data[k] = v; post('setValue', { key: k, value: v }); return 'true'; },
    Commit: function() { post('commit', { data: _data }); return 'true'; },
    GetLastError: function() { return '0'; },
    GetErrorString: function() { return ''; },
    GetDiagnostic: function() { return ''; },
  };
})();
`;

type ScormData = Record<string, string>;

type LmsShellConfig = {
  shellTitle?: string;
  organizationName?: string;
  logoUrl?: string;
  theme?: "light" | "dark";
  showProgress?: boolean;
  showCompletionBadge?: boolean;
  showSessionStatus?: boolean;
  showFooter?: boolean;
  showSidebar?: boolean;
  allowNotes?: boolean;
};

function parseLmsShellConfig(raw: string | null | undefined): LmsShellConfig {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return {
      shellTitle: typeof parsed.shellTitle === "string" ? parsed.shellTitle : undefined,
      organizationName: typeof parsed.organizationName === "string" ? parsed.organizationName : undefined,
      logoUrl: typeof parsed.logoUrl === "string" ? parsed.logoUrl : undefined,
      theme: parsed.theme === "light" || parsed.theme === "dark" ? parsed.theme : undefined,
      showProgress: typeof parsed.showProgress === "boolean" ? parsed.showProgress : undefined,
      showCompletionBadge: typeof parsed.showCompletionBadge === "boolean" ? parsed.showCompletionBadge : undefined,
      showSessionStatus: typeof parsed.showSessionStatus === "boolean" ? parsed.showSessionStatus : undefined,
      showFooter: typeof parsed.showFooter === "boolean" ? parsed.showFooter : undefined,
      showSidebar: typeof parsed.showSidebar === "boolean" ? parsed.showSidebar : undefined,
      allowNotes: typeof parsed.allowNotes === "boolean" ? parsed.allowNotes : undefined,
    };
  } catch {
    return {};
  }
}

export default function PlayerPage() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const packageId = Number(params.id);
  const orgTheme = useOrgTheme();
  const { orgId } = useOrgScope();

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mobileBannerDismissed, setMobileBannerDismissed] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [scormData, setScormData] = useState<ScormData>({});
  const [completionStatus, setCompletionStatus] = useState<string>("not_started");
  const [scorePercent, setScorePercent] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [started, setStarted] = useState(false);
  const [learnerNotes, setLearnerNotes] = useState("");
  const startedAt = useRef<number>(Date.now());
  const sessionTokenRef = useRef<string | null>(null);

  const { data: pkg, isLoading } = trpc.packages.get.useQuery({ id: packageId, orgId: orgId ?? undefined });
  const { data: perms } = trpc.permissions.get.useQuery({ packageId });
  const startSession = trpc.sessions.start.useMutation();
  const endSession = trpc.sessions.end.useMutation();
  const saveScorm = trpc.scorm.setData.useMutation();
  const trackDownload = trpc.analytics.trackDownload.useMutation();
  const packageShellConfig = parseLmsShellConfig((pkg as any)?.lmsShellConfig);
  const notesAllowed = packageShellConfig.allowNotes === true;

  // Start session when package is ready
  useEffect(() => {
    if (pkg?.status === "ready") {
      startSession.mutateAsync({ packageId })
        .then((r) => { setSessionToken(r.sessionToken); sessionTokenRef.current = r.sessionToken; setStarted(true); startedAt.current = Date.now(); })
        .catch(() => {});
    }
    return () => {
      if (sessionTokenRef.current) {
        endSession.mutate({ sessionToken: sessionTokenRef.current, completionStatus: "incomplete" });
      }
    };
  }, [pkg?.status]);

  // Elapsed timer
  useEffect(() => {
    if (!started) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [started]);

  useEffect(() => {
    if (!notesAllowed) return;
    setLearnerNotes(window.localStorage.getItem(`teachific-package-notes-${packageId}`) ?? "");
  }, [notesAllowed, packageId]);

  const updateLearnerNotes = (value: string) => {
    setLearnerNotes(value);
    window.localStorage.setItem(`teachific-package-notes-${packageId}`, value);
  };

  // Listen for SCORM API messages from iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!e.data || e.data.source !== 'scorm-api') return;
      const { type, payload } = e.data;

      if (type === 'setValue') {
        const { key, value } = payload;
        setScormData((prev) => ({ ...prev, [key]: value }));

        // Parse completion and score
        if (key === 'cmi.core.lesson_status' || key === 'cmi.completion_status') {
          setCompletionStatus(value);
        }
        if (key === 'cmi.core.score.raw' || key === 'cmi.score.raw') {
          const max = scormData['cmi.core.score.max'] || scormData['cmi.score.max'] || '100';
          setScorePercent(Math.round((parseFloat(value) / parseFloat(max)) * 100));
        }
        if (key === 'cmi.core.score.scaled' || key === 'cmi.score.scaled') {
          setScorePercent(Math.round(parseFloat(value) * 100));
        }

        // Persist to server
        if (sessionTokenRef.current) {
          // Batch SCORM data into structured fields
          const updates: Record<string, unknown> = { sessionToken: sessionTokenRef.current };
          if (key.includes('suspend_data')) updates.suspendData = value;
          else if (key.includes('lesson_status') || key.includes('completion_status')) updates.lessonStatus = value;
          else if (key.includes('lesson_location') || key.includes('location')) updates.lessonLocation = value;
          else if (key.includes('score.raw') || key.includes('score.scaled')) updates.score = parseFloat(value) || undefined;
          else if (key.includes('total_time') || key.includes('session_time')) updates.totalTime = value;
          if (Object.keys(updates).length > 1) saveScorm.mutate(updates as any);
        }
      }

      if (type === 'finish') {
        const status = payload.data?.['cmi.core.lesson_status'] || payload.data?.['cmi.completion_status'] || 'completed';
        setCompletionStatus(status);
        if (sessionTokenRef.current) {
          endSession.mutate({ sessionToken: sessionTokenRef.current, completionStatus: status });
          sessionTokenRef.current = null;
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [scormData]);

  // Inject SCORM API into iframe after load
  const handleIframeLoad = useCallback(() => {
    try {
      const iframe = iframeRef.current;
      if (!iframe?.contentWindow) return;
      const script = iframe.contentDocument?.createElement('script');
      if (script) {
        script.textContent = SCORM_API_SCRIPT;
        iframe.contentDocument?.head?.appendChild(script);
      }
    } catch {
      // Cross-origin: SCORM API injected via postMessage bridge
    }
  }, []);

  const handleDownload = () => {
    if (!perms?.allowDownload) { toast.error("Download is not permitted for this content"); return; }
    if (pkg?.originalZipUrl) {
      trackDownload.mutate({ packageId });
      window.open(pkg.originalZipUrl, "_blank");
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Auto-fullscreen on mobile when the setting is enabled
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  useEffect(() => {
    if (!pkg) return;
    if (!(pkg as any).autoFullscreenMobile) return;
    if (!isMobile) return;
    if (document.fullscreenElement) return;
    const timer = setTimeout(() => {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
        setMobileBannerDismissed(true);
      }).catch(() => {});
    }, 600);
    return () => clearTimeout(timer);
  }, [pkg]);

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: string) => {
    if (status === 'completed' || status === 'passed') return 'bg-emerald-500';
    if (status === 'failed') return 'bg-red-500';
    if (status === 'incomplete') return 'bg-amber-500';
    return 'bg-gray-500';
  };

  if (isLoading) return (
    <div className="flex flex-col h-screen bg-background">
      <div className="h-12 border-b border-border flex items-center px-4 gap-3">
        <Skeleton className="h-6 w-48" />
      </div>
      <Skeleton className="flex-1 m-4 rounded-lg" />
    </div>
  );

  if (!pkg) return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <p className="text-muted-foreground">Content not found</p>
        <Button variant="outline" className="mt-4" onClick={() => setLocation("/files")}>Back to Files</Button>
      </div>
    </div>
  );

  const isLmsShell = pkg.displayMode === "lms_shell";
  const shellConfig = packageShellConfig;
  const shellTitle = shellConfig.shellTitle?.trim() || shellConfig.organizationName?.trim() || "Learning Portal";
  const shellLogoUrl = shellConfig.logoUrl?.trim() || orgTheme.adminLogoUrl?.trim() || null;
  const lmsShellTheme = shellConfig.theme ?? "dark";
  const isLightLmsShell = lmsShellTheme === "light";
  const showProgress = shellConfig.showProgress !== false;
  const showCompletionBadge = shellConfig.showCompletionBadge !== false;
  const showSessionStatus = shellConfig.showSessionStatus !== false;
  const showFooter = shellConfig.showFooter !== false;
  const showSidebar = shellConfig.showSidebar !== false;
  const allowNotes = notesAllowed;
  // Always use the /entry redirect — it resolves the correct S3 URL regardless of subfolder nesting
  // Include the currentVersionId as a cache-buster so mobile browsers always load the latest version
  const playerUrl = pkg.status === "ready"
    ? `/api/content/${packageId}/entry?v=${(pkg as any).currentVersionId ?? 0}`
    : null;

  // ─── Native Player ──────────────────────────────────────────────────────────
  if (!isLmsShell) {
    return (
      <div className="flex flex-col h-screen bg-gray-950">
        {/* Minimal toolbar */}
        <div className="h-12 bg-gray-900 border-b border-gray-800 flex items-center px-4 gap-3 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-white" onClick={() => setLocation("/files")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{pkg.title}</p>
          </div>
          {started && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Clock className="h-3.5 w-3.5" />
              <span>{formatElapsed(elapsed)}</span>
              {completionStatus !== 'not_started' && (
                <span className={`h-2 w-2 rounded-full ${getStatusColor(completionStatus)}`} title={completionStatus} />
              )}
            </div>
          )}
          <div className="flex items-center gap-1">
            {perms?.allowDownload && pkg.originalZipUrl && (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-white" onClick={handleDownload}>
                <Download className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-white" onClick={() => window.open(`/play/${packageId}`, "_blank")}>
              <ExternalLink className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-white sm:text-gray-400 sm:hover:text-white sm:bg-transparent text-teal-400 bg-teal-500/20 hover:bg-teal-500/30 hover:text-teal-300" onClick={toggleFullscreen}>
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Mobile fullscreen prompt */}
        {!mobileBannerDismissed && !isFullscreen && (
          <div className="sm:hidden shrink-0 flex items-center gap-3 px-4 py-2.5 bg-primary/15 border-b border-primary/30">
            <Maximize2 className="h-4 w-4 text-primary shrink-0" />
            <p className="flex-1 text-xs text-primary font-medium leading-snug">
              Best displayed in full screen on mobile devices
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => { toggleFullscreen(); setMobileBannerDismissed(true); }}
                className="text-xs font-semibold text-primary underline underline-offset-2"
              >
                Full Screen
              </button>
              <button
                onClick={() => setMobileBannerDismissed(true)}
                className="text-xs text-primary/70 hover:text-primary"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 relative overflow-hidden">
          {playerUrl ? (
            <iframe
              ref={iframeRef}
              src={playerUrl}
              className="w-full h-full border-0"
              title={pkg.title}
              allow="fullscreen"
              onLoad={handleIframeLoad}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center space-y-3">
                <Play className="h-12 w-12 mx-auto opacity-30" />
                <p className="text-lg font-medium">No entry point found</p>
                <p className="text-sm">This package may still be processing</p>
                {pkg.originalZipUrl && (
                  <Button variant="outline" className="mt-2" asChild>
                    <a href={pkg.originalZipUrl} download target="_blank" rel="noreferrer">
                      <Download className="h-4 w-4 mr-2" />Download ZIP
                    </a>
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── LMS Shell Player ───────────────────────────────────────────────────────
  return (
    <div className={`flex flex-col h-screen ${isLightLmsShell ? "bg-gray-100" : "bg-gray-950"}`}>
      {/* LMS branded header */}
      <div className={`${isLightLmsShell ? "bg-white border-b border-gray-200" : "bg-gray-900 border-b border-gray-800"} shrink-0`}>
        <div className="flex items-center px-4 h-14 gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-white shrink-0" onClick={() => setLocation("/files")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 shrink-0">
            {shellLogoUrl ? (
              <img src={shellLogoUrl} alt={shellTitle} className="h-7 w-7 rounded-lg object-contain bg-white" />
            ) : (
              <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
                <BookOpen className="h-4 w-4 text-primary-foreground" />
              </div>
            )}
            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider hidden sm:block" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{shellTitle}</span>
          </div>
          <div className={`h-5 w-px hidden sm:block ${isLightLmsShell ? "bg-gray-200" : "bg-gray-700"}`} />
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold truncate ${isLightLmsShell ? "text-gray-900" : "text-white"}`}>{pkg.title}</p>
            {pkg.description && <p className={`text-xs truncate hidden sm:block ${isLightLmsShell ? "text-gray-500" : "text-gray-400"}`}>{pkg.description}</p>}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {showSessionStatus && started && (
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <Clock className="h-3.5 w-3.5" />
                <span>{formatElapsed(elapsed)}</span>
              </div>
            )}
            {scorePercent !== null && (
              <Badge variant="secondary" className={`text-xs ${isLightLmsShell ? "bg-gray-100 text-gray-700" : "bg-gray-800 text-gray-200"}`}>
                Score: {scorePercent}%
              </Badge>
            )}
            {showCompletionBadge && completionStatus !== 'not_started' && (
              <Badge className={`text-xs text-white ${
                completionStatus === 'completed' || completionStatus === 'passed' ? 'bg-emerald-600' :
                completionStatus === 'failed' ? 'bg-red-600' : 'bg-amber-600'
              }`}>
                {completionStatus === 'completed' || completionStatus === 'passed' ? (
                  <><CheckCircle2 className="h-3 w-3 mr-1" />{completionStatus}</>
                ) : completionStatus}
              </Badge>
            )}
            {perms?.allowDownload && pkg.originalZipUrl && (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-white" onClick={handleDownload} title="Download">
                <Download className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-white sm:text-gray-400 sm:hover:text-white sm:bg-transparent text-teal-400 bg-teal-500/20 hover:bg-teal-500/30 hover:text-teal-300" onClick={toggleFullscreen}>
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        {showProgress && (completionStatus === 'incomplete' || completionStatus === 'completed' || completionStatus === 'passed') && (
          <div className="px-4 pb-2">
            <Progress
              value={completionStatus === 'completed' || completionStatus === 'passed' ? 100 : scorePercent ?? 30}
              className="h-1 bg-gray-800"
            />
          </div>
        )}
      </div>

      {/* Mobile fullscreen prompt — LMS shell mode */}
      {!mobileBannerDismissed && !isFullscreen && (
        <div className="sm:hidden shrink-0 flex items-center gap-3 px-4 py-2.5 bg-primary/15 border-b border-primary/30">
          <Maximize2 className="h-4 w-4 text-primary shrink-0" />
          <p className="flex-1 text-xs text-primary font-medium leading-snug">
            Best displayed in full screen on mobile devices
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => { toggleFullscreen(); setMobileBannerDismissed(true); }}
              className="text-xs font-semibold text-primary underline underline-offset-2"
            >
              Full Screen
            </button>
            <button
              onClick={() => setMobileBannerDismissed(true)}
              className="text-xs text-primary/70 hover:text-primary"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {showSidebar && (
          <aside className={`hidden md:flex w-56 shrink-0 flex-col border-r p-4 ${isLightLmsShell ? "border-gray-200 bg-white text-gray-900" : "border-gray-800 bg-gray-900 text-gray-100"}`}>
            <p className={`text-[11px] font-semibold uppercase tracking-wider ${isLightLmsShell ? "text-gray-500" : "text-gray-400"}`}>Package overview</p>
            <p className="mt-3 text-sm font-medium leading-snug">{pkg.title}</p>
            {pkg.description && <p className={`mt-2 text-xs leading-relaxed ${isLightLmsShell ? "text-gray-500" : "text-gray-400"}`}>{pkg.description}</p>}
            <div className={`mt-5 rounded-md border p-3 text-xs ${isLightLmsShell ? "border-gray-200 bg-gray-50 text-gray-600" : "border-gray-800 bg-gray-950/40 text-gray-300"}`}>
              <p className="font-medium">Learner status</p>
              <p className="mt-1 capitalize">{completionStatus.replaceAll("_", " ")}</p>
            </div>
          </aside>
        )}
        <div className="flex-1 relative min-w-0 overflow-hidden">
          {playerUrl ? (
            <iframe
              ref={iframeRef}
              src={playerUrl}
              className="w-full h-full border-0"
              title={pkg.title}
              allow="fullscreen"
              onLoad={handleIframeLoad}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center space-y-3">
                <Shield className="h-12 w-12 mx-auto opacity-20" />
                <p className="text-lg font-medium">No entry point found</p>
                <p className="text-sm opacity-70">This package may still be processing or has no HTML entry point</p>
                {pkg.status === 'processing' && <p className="text-xs text-amber-400">Package is still being processed. Please check back shortly.</p>}
                {pkg.originalZipUrl && (
                  <Button variant="outline" className="mt-2 border-gray-700 text-gray-300 hover:bg-gray-800" asChild>
                    <a href={pkg.originalZipUrl} download target="_blank" rel="noreferrer"><Download className="h-4 w-4 mr-2" />Download ZIP</a>
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
        {allowNotes && (
          <aside className={`hidden lg:flex w-72 shrink-0 flex-col border-l p-4 ${isLightLmsShell ? "border-gray-200 bg-white" : "border-gray-800 bg-gray-900"}`}>
            <Label htmlFor="learner-package-notes" className={isLightLmsShell ? "text-gray-900" : "text-gray-100"}>My notes</Label>
            <p className={`mt-1 text-xs ${isLightLmsShell ? "text-gray-500" : "text-gray-400"}`}>Notes are retained in this browser for this package.</p>
            <textarea id="learner-package-notes" value={learnerNotes} onChange={(event) => updateLearnerNotes(event.target.value)} placeholder="Write notes while you learn…" className={`mt-3 min-h-0 flex-1 resize-none rounded-md border p-3 text-sm outline-none focus:ring-2 focus:ring-primary ${isLightLmsShell ? "border-gray-200 bg-gray-50 text-gray-900" : "border-gray-800 bg-gray-950 text-gray-100"}`} />
          </aside>
        )}
      </div>

      {/* LMS footer status bar */}
      {showFooter && <div className={`${isLightLmsShell ? "bg-white border-t border-gray-200" : "bg-gray-900 border-t border-gray-800"} px-4 py-2 flex items-center justify-between shrink-0`}>
        <div className={`flex items-center gap-3 text-xs ${isLightLmsShell ? "text-gray-500" : "text-gray-500"}`}>
          {showSessionStatus && <span className="flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${started ? 'bg-emerald-500' : 'bg-gray-600'}`} />
            {started ? 'Session active' : 'Initializing...'}
          </span>}
          {pkg.scormVersion !== 'none' && (
            <span>SCORM {pkg.scormVersion}</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <X className="h-3 w-3 cursor-pointer hover:text-gray-300" onClick={() => setLocation("/files")} />
        </div>
      </div>}
    </div>
  );
}
