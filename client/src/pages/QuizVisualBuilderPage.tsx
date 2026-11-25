import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { EditorToolbar } from "@/quiz-creator/components/EditorToolbar";
import { QuestionList } from "@/quiz-creator/components/QuestionList";
import { QuestionEditor } from "@/quiz-creator/components/QuestionEditor";
import { QuizSettings } from "@/quiz-creator/components/QuizSettings";
import { QuizPreview } from "@/quiz-creator/components/QuizPreview";
import { CloudQuizBrowser } from "@/quiz-creator/components/CloudQuizBrowser";
import { SlideViewEditor } from "@/quiz-creator/components/SlideViewEditor";
import BrandingPanel from "@/quiz-creator/components/BrandingPanel";
import QuizAnalyticsPanel from "@/quiz-creator/components/QuizAnalyticsPanel";
import { useQuizStore } from "@/quiz-creator/store/quizStore";
import { ArrowLeft, BarChart3, Eye, ListChecks, Loader2, Palette, PanelsTopLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { QuizFile } from "@/quiz-creator/types/quiz";

import { LicenseManager } from "@/quiz-creator/components/LicenseManager";
import { ShareDialog } from "@/quiz-creator/components/ShareDialog";
import { QuizDraftRecoveryRuntime } from "@/quiz-creator/components/QuizDraftRecoveryRuntime";
import { useQuizCurrentCloudSave } from "@/quiz-creator/lib/useQuizCurrentCloudSave";
import { retainQuizDraft } from "@/quiz-creator/lib/quizDraftJournalRuntime";
import { useAuth } from "@/hooks/useAuth";
import { useOrgScope } from "@/hooks/useOrgScope";
import { toast } from "sonner";

type SidePanel = "none" | "branding" | "analytics";

/**
 * Course360 visual workspace for a saved, organization-owned standalone quiz.
 * Ownership and role validation remain server-enforced by quizMaker.getQuiz.
 */
export default function QuizVisualBuilderPage() {
  const { user } = useAuth(), { orgId } = useOrgScope();
  const params = useParams<{ quizId: string }>();
  const [, navigate] = useLocation();
  const quizId = Number(params.quizId);
  const { loadQuiz, activeQuestionId, quiz, updateMeta } = useQuizStore();
  const { saveCurrent } = useQuizCurrentCloudSave();
  const [showLicense, setShowLicense] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const exportScorm = trpc.quizMaker.exportScorm.useMutation({ onSuccess: result => window.open(result.downloadUrl, "_blank"), onError: error => toast.error(error.message) });
  const handleExport = async (format: "scorm12" | "scorm2004") => { try { const id = await saveCurrent(); exportScorm.mutate({ quizId: id, format }); } catch (error) { toast.error((error as Error).message); } };
  const [showSettings, setShowSettings] = useState(false);
  const [showCloud, setShowCloud] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [sidePanel, setSidePanel] = useState<SidePanel>("none");

  const { data, isLoading, error } = trpc.quizMaker.getQuiz.useQuery(
    { quizId },
    { enabled: Number.isFinite(quizId) && quizId > 0 },
  );

  useEffect(() => {
    if (data?.id === quizId && data.builderConfig && ((useQuizStore.getState().quiz.meta as any).cloudId !== quizId || !useQuizStore.getState().isDirty)) {
      const current = useQuizStore.getState();
      if (current.isDirty && user?.id && orgId) void retainQuizDraft(`user-${user.id}:school-${orgId}`, current.quiz);
      loadQuiz(data.builderConfig as QuizFile, data.title);
    }
  }, [data, loadQuiz, quizId, user?.id, orgId]);

  if (error || (!isLoading && !data)) return <div role="alert" className="p-6">{error?.message || "Quiz not found in the selected school."}<Button onClick={() => navigate("/quiz-creator")}>Back to Quiz Creator</Button></div>;

  if (isLoading || !data || (quiz.meta as any).cloudId !== quizId) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const viewMode = quiz.meta.editorViewMode ?? "form";

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-muted/40">
      <EditorToolbar onPreview={() => setShowPreview(true)} onSettings={() => setShowSettings(true)} onCloudOpen={() => setShowCloud(true)} onLicense={() => setShowLicense(true)} onPublish={() => setShowShare(true)} />
      <QuizDraftRecoveryRuntime />
      <div className="flex items-center gap-2 border-b bg-background px-4 py-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/quiz-creator")}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Course360 Quiz Creator
        </Button>
        <div className="min-w-0 flex-1 truncate text-sm font-medium">{data?.title ?? "Quiz workspace"}</div>
        <div className="hidden items-center rounded-lg border bg-muted/40 p-0.5 sm:flex">
          <Button variant={viewMode === "form" ? "secondary" : "ghost"} size="sm" onClick={() => updateMeta({ editorViewMode: "form" })}>
            <ListChecks className="mr-1 h-4 w-4" /> Form
          </Button>
          <Button variant={viewMode === "slides" ? "secondary" : "ghost"} size="sm" onClick={() => updateMeta({ editorViewMode: "slides" })}>
            <PanelsTopLeft className="mr-1 h-4 w-4" /> Slides
          </Button>
        </div>
        <Button variant="ghost" size="sm" disabled={exportScorm.isPending} onClick={() => handleExport("scorm12")}>SCORM 1.2</Button>
        <Button variant="ghost" size="sm" disabled={exportScorm.isPending} onClick={() => handleExport("scorm2004")}>SCORM 2004</Button>
        <Button variant="ghost" size="sm" disabled={!activeQuestionId} onClick={() => setShowPreview(true)}>
          <Eye className="mr-1 h-4 w-4" /> Preview
        </Button>
        <Button variant={sidePanel === "branding" ? "secondary" : "ghost"} size="sm" onClick={() => setSidePanel(sidePanel === "branding" ? "none" : "branding")}>
          <Palette className="mr-1 h-4 w-4" /> Design
        </Button>
        <Button variant={sidePanel === "analytics" ? "secondary" : "ghost"} size="sm" onClick={() => setSidePanel(sidePanel === "analytics" ? "none" : "analytics")}>
          <BarChart3 className="mr-1 h-4 w-4" /> Analytics
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <QuestionList />
        {viewMode === "slides" ? <SlideViewEditor /> : <QuestionEditor />}
        {sidePanel !== "none" && (
          <aside className="w-[380px] shrink-0 overflow-y-auto border-l bg-background">
            {sidePanel === "branding" ? <BrandingPanel quizId={quizId} /> : <QuizAnalyticsPanel quizId={quizId} />}
          </aside>
        )}
      </div>
      {showSettings && <QuizSettings onClose={() => setShowSettings(false)} canUseMockExams={Boolean(data?.mockExamEntitlement)} />}
      {showCloud && <CloudQuizBrowser onClose={() => setShowCloud(false)} />}
      {showLicense && <LicenseManager onClose={() => setShowLicense(false)} />}
      {showShare && <ShareDialog open onClose={() => setShowShare(false)} quizId={quizId} />}
      {showPreview && <QuizPreview onClose={() => setShowPreview(false)} />}
    </div>
  );
}
