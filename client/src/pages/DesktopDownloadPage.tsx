import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Monitor,
  Apple,
  Download,
  ArrowLeft,
  Lock,
  CheckCircle,
  ExternalLink,
  Loader2,
  AlertTriangle,
} from "lucide-react";

type AppKey = "creator" | "studio" | "quizCreator";

const APP_META: Record<AppKey, {
  name: string;
  tagline: string;
  backPath: string;
  backLabel: string;
  upgradePath: string;
  color: string;
  bgGradient: string;
}> = {
  creator: {
    name: "Course360 Creator™",
    tagline: "Build stunning slide-based courses and export to SCORM",
    backPath: "/creator",
    backLabel: "Back to Creator Dashboard",
    upgradePath: "/creator-pro",
    color: "text-teal-600",
    bgGradient: "from-teal-50 to-white",
  },
  studio: {
    name: "Course360 Studio™",
    tagline: "Record, edit, and publish professional video lessons",
    backPath: "/studio",
    backLabel: "Back to Studio Dashboard",
    upgradePath: "/studio-pro",
    color: "text-violet-600",
    bgGradient: "from-violet-50 to-white",
  },
  quizCreator: {
    name: "Course360 Quiz Creator™",
    tagline: "Create interactive quizzes and assessments",
    backPath: "/quiz-creator-app",
    backLabel: "Back to QuizMaker Dashboard",
    upgradePath: "/quiz-creator-pro",
    color: "text-orange-600",
    bgGradient: "from-orange-50 to-white",
  },
};

const SYSTEM_REQUIREMENTS = [
  { label: "Windows", value: "Windows 10 or later (64-bit)" },
  { label: "macOS", value: "macOS 11 Big Sur or later" },
  { label: "RAM", value: "4 GB minimum, 8 GB recommended" },
  { label: "Storage", value: "500 MB free disk space" },
  { label: "Internet", value: "Required for login and sync" },
];

export default function DesktopDownloadPage({ app }: { app: AppKey }) {
  const meta = APP_META[app];
  const [downloading, setDownloading] = useState<"windows" | "mac" | null>(null);

  const { data, isLoading, error } = trpc.billing.getDesktopDownloads.useQuery({ app });

  const handleDownload = (platform: "windows" | "mac", url: string) => {
    setDownloading(platform);
    window.open(url, "_blank");
    setTimeout(() => setDownloading(null), 3000);
  };

  return (
    <div className={`min-h-screen bg-gradient-to-b ${meta.bgGradient}`}>
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        {/* Back link */}
        <Link href={meta.backPath}>
          <a className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors">
            <ArrowLeft className="w-4 h-4" /> {meta.backLabel}
          </a>
        </Link>

        {/* Header */}
        <div className="space-y-2">
          <h1 className={`text-3xl font-bold ${meta.color}`}>{meta.name}</h1>
          <p className="text-slate-600 text-lg">{meta.tagline}</p>
          <Badge variant="outline" className="border-slate-300 text-slate-600 text-xs">
            Desktop App — v{data?.version ?? "1.0.0"}
          </Badge>
        </div>

        {/* Download card */}
        {isLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </CardContent>
          </Card>
        ) : error || !data ? (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-6 flex items-start gap-4">
              <Lock className="w-8 h-8 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-3">
                <div>
                  <p className="font-semibold text-amber-900 text-lg">Pro or Enterprise Plan Required</p>
                  <p className="text-amber-800 text-sm mt-1">
                    The {meta.name} desktop app is available on <strong>Pro and Enterprise</strong> Teachific plans, or as a standalone purchase.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href="/settings/billing">
                    <Button className="bg-amber-600 hover:bg-amber-700 text-white gap-2">
                      Upgrade Plan <ExternalLink className="w-4 h-4" />
                    </Button>
                  </Link>
                  <Link href="/apps">
                    <Button variant="outline" className="border-amber-400 text-amber-800 hover:bg-amber-100 gap-2">
                      Buy Standalone App
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Download buttons */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-slate-900 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  You're ready to download
                </CardTitle>
                <CardDescription>
                  Choose your operating system below. The installer will open in a new tab.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Windows */}
                  <button
                    onClick={() => handleDownload("windows", data.windows ?? "")}
                    className="flex items-center gap-4 p-4 rounded-xl border-2 border-slate-200 hover:border-teal-400 hover:bg-teal-50/50 transition-all text-left group"
                  >
                    <div className="p-3 rounded-lg bg-blue-100 shrink-0">
                      <Monitor className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 group-hover:text-teal-700">Download for Windows</p>
                      <p className="text-xs text-slate-500 mt-0.5">.zip archive · Windows 10+ · Extract to install</p>
                    </div>
                    {downloading === "windows" ? (
                      <Loader2 className="w-4 h-4 animate-spin text-teal-500 shrink-0" />
                    ) : (
                      <Download className="w-4 h-4 text-slate-400 group-hover:text-teal-500 shrink-0" />
                    )}
                  </button>

                  {/* macOS */}
                  <button
                    onClick={() => data.mac ? handleDownload("mac", data.mac) : undefined}
                    disabled={!data.mac}
                    className="flex items-center gap-4 p-4 rounded-xl border-2 border-slate-200 hover:border-teal-400 hover:bg-teal-50/50 transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="p-3 rounded-lg bg-slate-100 shrink-0">
                      <Apple className="w-6 h-6 text-slate-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 group-hover:text-teal-700">Download for macOS</p>
                      <p className="text-xs text-slate-500 mt-0.5">.dmg installer · macOS 11+ · Coming soon</p>
                    </div>
                    {downloading === "mac" ? (
                      <Loader2 className="w-4 h-4 animate-spin text-teal-500 shrink-0" />
                    ) : (
                      <Download className="w-4 h-4 text-slate-400 group-hover:text-teal-500 shrink-0" />
                    )}
                  </button>
                </div>

                <p className="text-xs text-slate-400 text-center pt-1">
                  Having trouble? Contact{" "}
                  <a
                    href="mailto:support@teachific.app"
                    className="underline hover:text-slate-600"
                  >
                    support@teachific.app
                  </a>
                </p>
              </CardContent>
            </Card>

            {/* Installation steps */}
            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-slate-900 text-base">Installation Steps</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3">
                  {[
                    { step: "1", title: "Download the installer", desc: "Click the button above for your operating system." },
                    { step: "2", title: "Run the installer", desc: "Windows: extract the .zip file, then double-click the .exe installer and follow the prompts. macOS: open the .dmg, drag the app to Applications." },
                    { step: "3", title: "Launch and sign in", desc: `Open ${meta.name} and sign in with your Teachific account to activate.` },
                    { step: "4", title: "Start creating", desc: "Your subscription is automatically verified — no extra steps needed." },
                  ].map(({ step, title, desc }) => (
                    <li key={step} className="flex items-start gap-3">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-teal-100 text-teal-700 text-xs font-bold shrink-0 mt-0.5">
                        {step}
                      </span>
                      <div>
                        <p className="font-medium text-slate-800 text-sm">{title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </>
        )}

        {/* System requirements */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-slate-900 text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> System Requirements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <tbody>
                {SYSTEM_REQUIREMENTS.map(({ label, value }) => (
                  <tr key={label} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-4 font-medium text-slate-600 w-24">{label}</td>
                    <td className="py-2 text-slate-800">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
