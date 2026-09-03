/**
 * DownloadPage — Shared download hub component for Creator, Studio, and QuizMaker.
 * Shows Windows/macOS download buttons, system requirements, and release notes.
 */
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Monitor, Apple, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";

type Product = "creator" | "studio" | "quizcreator";

// CDN icon URLs generated for each app
const PRODUCT_ICONS: Record<Product, string> = {
  creator: "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/fJXMsdmk8vcb8V4GDt37f6/icon-creator-fh5hJUsjdbmWvBAkxZwdUW.png",
  studio: "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/fJXMsdmk8vcb8V4GDt37f6/icon-studio-QfLuZUAyea2tjKNUuBfvDh.png",
  quizcreator: "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/fJXMsdmk8vcb8V4GDt37f6/icon-quizcreator-ewg2xD9EHi2w37hRrSU4Nt.png",
};

const PRODUCT_INFO: Record<Product, {
  name: string;
  tagline: string;
  features: string[];
}> = {
  creator: {
    name: "Course360 Creator™",
    tagline: "Professional course authoring and eLearning content creation",
    features: [
      "Drag-and-drop course builder",
      "SCORM 1.2 & 2004 export",
      "Interactive quizzes and assessments",
      "Video embedding and media library",
      "AI-powered content suggestions",
      "One-click publish to your LMS",
    ],
  },
  studio: {
    name: "Course360 Studio™",
    tagline: "Screen recording, transcription, and video editing for educators",
    features: [
      "Screen, camera, and audio recording",
      "AI transcription with editing",
      "Auto-generate 10 highlight clips",
      "Export to MP4 in HD",
      "Instant video sharing",
      "Direct upload to your LMS",
    ],
  },
  quizcreator: {
    name: "Course360 Quiz Creator™",
    tagline: "Professional quiz and assessment builder with analytics",
    features: [
      "Multiple question types",
      "Branching and adaptive logic",
      "SCORM-compatible export",
      "Real-time analytics dashboard",
      "AI question generation",
      "Certificate of completion",
    ],
  },
};

const SYSTEM_REQUIREMENTS = {
  windows: [
    "Windows 10 or later (64-bit)",
    "4 GB RAM minimum (8 GB recommended)",
    "2 GB available disk space",
    "Internet connection required",
  ],
  mac: [
    "macOS 11 (Big Sur) or later",
    "Apple Silicon (M1/M2) or Intel",
    "4 GB RAM minimum (8 GB recommended)",
    "2 GB available disk space",
  ],
};

interface DownloadPageProps {
  product: Product;
}

export function DownloadPage({ product }: DownloadPageProps) {
  const { data: version, isLoading } = trpc.platformAdmin.getLatestAppVersion.useQuery({ product });
  const info = PRODUCT_INFO[product];
  const iconUrl = PRODUCT_ICONS[product];

  function detectPlatform(): "windows" | "mac" | "unknown" {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("win")) return "windows";
    if (ua.includes("mac")) return "mac";
    return "unknown";
  }

  const platform = detectPlatform();

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-6">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-[#0e8a96] to-[#0a6e78] p-8 text-white">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-5">
            {/* App icon */}
            <img
              src={iconUrl}
              alt={`${info.name} icon`}
              className="w-20 h-20 rounded-2xl shadow-lg shrink-0"
            />
            <div>
              <h1 className="text-2xl font-bold">{info.name}</h1>
              <p className="text-white/80 mt-1 text-sm max-w-md">{info.tagline}</p>
              {version && (
                <Badge className="mt-3 bg-white/20 text-white border-white/30 font-mono">v{version.version}</Badge>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 min-w-[200px]">
            {isLoading ? (
              <div className="h-10 bg-white/20 rounded-lg animate-pulse w-48" />
            ) : version ? (
              <>
                {version.windowsUrl && (
                  <a href={version.windowsUrl} download>
                    <Button
                      className={`w-full gap-2 bg-white text-gray-900 hover:bg-gray-100 ${platform === "windows" ? "ring-2 ring-white/60" : ""}`}
                    >
                      <Monitor className="w-4 h-4" />
                      Download for Windows
                      {platform === "windows" && <Badge className="ml-1 bg-green-100 text-green-800 text-xs">Recommended</Badge>}
                    </Button>
                  </a>
                )}
                {version.macUrl && (
                  <a href={version.macUrl} download>
                    <Button
                      variant="outline"
                      className={`w-full gap-2 border-white/40 text-white hover:bg-white/10 ${platform === "mac" ? "ring-2 ring-white/60" : ""}`}
                    >
                      <Apple className="w-4 h-4" />
                      Download for macOS
                      {platform === "mac" && <Badge className="ml-1 bg-green-100 text-green-800 text-xs">Recommended</Badge>}
                    </Button>
                  </a>
                )}
                {!version.windowsUrl && !version.macUrl && (
                  <div className="flex items-center gap-2 text-white/70 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    Download links coming soon
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 text-white/70 text-sm">
                <AlertCircle className="w-4 h-4" />
                No release available yet
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Features */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#24abbc]" />
              What's Included
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {info.features.map(f => (
                <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                  <CheckCircle className="w-3.5 h-3.5 text-[#24abbc] mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* System Requirements */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Monitor className="w-4 h-4 text-slate-500" />
              System Requirements
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5" /> Windows
              </p>
              <ul className="space-y-1">
                {SYSTEM_REQUIREMENTS.windows.map(r => (
                  <li key={r} className="text-sm text-slate-600 flex items-start gap-1.5">
                    <span className="text-slate-400 mt-0.5">•</span> {r}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Apple className="w-3.5 h-3.5" /> macOS
              </p>
              <ul className="space-y-1">
                {SYSTEM_REQUIREMENTS.mac.map(r => (
                  <li key={r} className="text-sm text-slate-600 flex items-start gap-1.5">
                    <span className="text-slate-400 mt-0.5">•</span> {r}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Release Notes */}
      {version?.releaseNotes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Release Notes — v{version.version}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{version.releaseNotes}</p>
          </CardContent>
        </Card>
      )}

      {/* Installation Help */}
      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="pt-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[#24abbc] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-800">Installation Notes</p>
              <p className="text-sm text-slate-600">
                <strong>Windows:</strong> If Windows SmartScreen shows a warning, click "More info" → "Run anyway". This is normal for new software.
              </p>
              <p className="text-sm text-slate-600">
                <strong>macOS:</strong> If macOS blocks the app, go to System Settings → Privacy & Security → Open Anyway.
              </p>
              <a
                href="https://course360.app/help"
                target="_blank"
                rel="noreferrer"
                className="text-sm text-[#24abbc] hover:underline flex items-center gap-1 mt-2"
              >
                <ExternalLink className="w-3.5 h-3.5" /> View full installation guide
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
