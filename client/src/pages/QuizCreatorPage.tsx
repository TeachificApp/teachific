import { useState } from "react";
import { EditorToolbar } from "@/quiz-creator/components/EditorToolbar";
import { QuestionList } from "@/quiz-creator/components/QuestionList";
import { QuestionEditor } from "@/quiz-creator/components/QuestionEditor";
import { QuizSettings } from "@/quiz-creator/components/QuizSettings";
import { LicenseManager } from "@/quiz-creator/components/LicenseManager";
import { QuizPreview } from "@/quiz-creator/components/QuizPreview";
import { CloudQuizBrowser } from "@/quiz-creator/components/CloudQuizBrowser";
import { ShareDialog } from "@/quiz-creator/components/ShareDialog";
import BrandingPanel from "@/quiz-creator/components/BrandingPanel";
import QuizAnalyticsPanel from "@/quiz-creator/components/QuizAnalyticsPanel";
import { useQuizStore } from "@/quiz-creator/store/quizStore";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Palette, BarChart3, Download, Loader2, X, GitBranch } from "lucide-react";
import { BranchingFlowVisualizer } from "@/quiz-creator/components/BranchingFlowVisualizer";
import { toast } from "sonner";

type RightPanel = null | "branding" | "analytics";

export default function QuizCreatorPage() {
  const [showSettings, setShowSettings] = useState(false);
  const [showLicense, setShowLicense] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showCloudBrowser, setShowCloudBrowser] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [rightPanel, setRightPanel] = useState<RightPanel>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showBranchingViz, setShowBranchingViz] = useState(false);

  const { quiz } = useQuizStore();
  const { user } = useAuth();

  // Get the cloud ID from the quiz meta (set when saving to cloud)
  const cloudId = (quiz.meta as any).cloudId as number | undefined;

  // Query publish status if we have a cloud ID
  const { data: publishStatus } = trpc.quizMaker.getPublishStatus.useQuery(
    { quizId: cloudId! },
    { enabled: !!cloudId && !!user }
  );

  const isPublished = publishStatus?.isPublished ?? false;

  // SCORM export mutation
  const exportScorm = trpc.quizMaker.exportScorm.useMutation({
    onSuccess: (data) => {
      window.open(data.downloadUrl, "_blank");
      toast.success("SCORM package exported! Download started.");
      setShowExportMenu(false);
    },
    onError: (err) => {
      toast.error(err.message || "Export failed");
    },
  });

  const handleExport = (format: "scorm12" | "scorm2004") => {
    if (!cloudId) {
      toast.error("Save your quiz to cloud first before exporting.");
      return;
    }
    exportScorm.mutate({ quizId: cloudId, format });
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <EditorToolbar
        onPreview={() => setShowPreview(true)}
        onSettings={() => setShowSettings(true)}
        onLicense={() => setShowLicense(true)}
        onCloudOpen={() => setShowCloudBrowser(true)}
        onPublish={() => setShowShareDialog(true)}
        isPublished={isPublished}
      />

      <div className="flex flex-1 overflow-hidden">
        <QuestionList />
        <QuestionEditor />

        {/* Right sidebar with panels */}
        <div className="flex">
          {/* Panel toggle buttons */}
          <div className="flex flex-col gap-1 p-1.5 bg-gray-100 border-l border-gray-200">
            <button
              onClick={() => setRightPanel(rightPanel === "branding" ? null : "branding")}
              className={`p-2 rounded-lg transition-colors ${rightPanel === "branding" ? "bg-teal-100 text-teal-700" : "text-gray-500 hover:bg-gray-200"}`}
              title="Branding"
            >
              <Palette className="w-4 h-4" />
            </button>
            <button
              onClick={() => setRightPanel(rightPanel === "analytics" ? null : "analytics")}
              className={`p-2 rounded-lg transition-colors ${rightPanel === "analytics" ? "bg-teal-100 text-teal-700" : "text-gray-500 hover:bg-gray-200"}`}
              title="Analytics"
            >
              <BarChart3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowBranchingViz(true)}
              className={`p-2 rounded-lg transition-colors text-gray-500 hover:bg-gray-200 ${quiz.meta.branchingEnabled ? "text-purple-600" : ""}`}
              title="Branching Flow Visualizer"
            >
              <GitBranch className="w-4 h-4" />
            </button>
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={exportScorm.isPending}
                className={`p-2 rounded-lg transition-colors ${showExportMenu ? "bg-teal-100 text-teal-700" : "text-gray-500 hover:bg-gray-200"}`}
                title="Export SCORM"
              >
                {exportScorm.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              </button>
              {showExportMenu && (
                <div className="absolute right-full top-0 mr-1 bg-white rounded-xl shadow-xl border border-gray-200 py-1 w-44 z-50">
                  <p className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Export As</p>
                  <button
                    onClick={() => handleExport("scorm12")}
                    disabled={exportScorm.isPending}
                    className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    SCORM 1.2 Package
                  </button>
                  <button
                    onClick={() => handleExport("scorm2004")}
                    disabled={exportScorm.isPending}
                    className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    SCORM 2004 Package
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Panel content */}
          {rightPanel && (
            <div className="w-72 bg-white border-l border-gray-200 overflow-y-auto">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wide">
                  {rightPanel === "branding" ? "Branding" : "Analytics"}
                </h3>
                <button onClick={() => setRightPanel(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {rightPanel === "branding" && <BrandingPanel quizId={cloudId ?? null} />}
              {rightPanel === "analytics" && <QuizAnalyticsPanel quizId={cloudId ?? null} />}
            </div>
          )}
        </div>
      </div>

      {showSettings && <QuizSettings onClose={() => setShowSettings(false)} />}
      {showLicense && <LicenseManager onClose={() => setShowLicense(false)} />}
      {showPreview && <QuizPreview onClose={() => setShowPreview(false)} />}
      {showCloudBrowser && <CloudQuizBrowser onClose={() => setShowCloudBrowser(false)} />}
      {showShareDialog && (
        <ShareDialog
          open={showShareDialog}
          onClose={() => setShowShareDialog(false)}
          quizId={cloudId ?? null}
        />
      )}
      {showBranchingViz && <BranchingFlowVisualizer onClose={() => setShowBranchingViz(false)} />}
    </div>
  );
}
