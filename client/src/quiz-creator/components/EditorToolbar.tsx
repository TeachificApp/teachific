import { useState } from "react";
import { useQuizStore } from "../store/quizStore";
import { downloadQuiz, openQuizFile } from "../lib/quizFile";
import {
  Save, FolderOpen, Play, Settings, Key, ChevronDown,
  FileText, Plus, CloudUpload, Cloud, Globe, FileArchive, Database,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useOrgScope } from "@/hooks/useOrgScope";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScormImportDialog } from "./ScormImportDialog";
import type { QuizFile } from "../types/quiz";

interface Props {
  onPreview: () => void;
  onSettings: () => void;
  onLicense: () => void;
  onCloudOpen?: () => void;
  onPublish?: () => void;
  isPublished?: boolean;
}

export function EditorToolbar({ onPreview, onSettings, onLicense, onCloudOpen, onPublish, isPublished }: Props) {
  const { quiz, isDirty, markSaved, loadQuiz, newQuiz, license } = useQuizStore();
  const [saving, setSaving] = useState(false);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [cloudSaving, setCloudSaving] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [questionBankDialogOpen, setQuestionBankDialogOpen] = useState(false);
  const [targetBankId, setTargetBankId] = useState("");
  const [targetFolderId, setTargetFolderId] = useState("");
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const { user } = useAuth();
  const { orgId } = useOrgScope();
  const saveToCloud = trpc.quizMaker.saveQuiz.useMutation();
  const { data: questionBanks = [] } = trpc.quizBank.listBanks.useQuery(
    { orgId: Number(orgId) },
    { enabled: questionBankDialogOpen && Boolean(orgId) }
  );
  const { data: questionBankTags = [] } = trpc.quizBank.listTags.useQuery(
    { orgId: Number(orgId) },
    { enabled: questionBankDialogOpen && Boolean(orgId) }
  );
  const { data: questionBankFolders = [] } = trpc.quizBank.listFolders.useQuery(
    { bankId: Number(targetBankId) },
    { enabled: questionBankDialogOpen && Boolean(targetBankId) }
  );
  const exportToQuestionBank = trpc.quizMaker.exportToQuestionBank.useMutation();
  const utils = trpc.useUtils();

  const handleCloudSave = async () => {
    setCloudSaving(true);
    setFileMenuOpen(false);
    try {
      const result = await saveToCloud.mutateAsync({
        title: quiz.meta.title,
        description: quiz.meta.description || "",
        questionsJson: JSON.stringify(quiz.questions),
        settingsJson: JSON.stringify(quiz.meta),
        quizId: (quiz.meta as any).cloudId || undefined,
      });
      useQuizStore.getState().updateMeta({ cloudId: result.id } as any);
      utils.quizMaker.listQuizzes.invalidate();
      markSaved(quiz.meta.title + " (cloud)");
    } catch (err) {
      alert("Cloud save failed: " + (err as Error).message);
    } finally {
      setCloudSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const filename = await downloadQuiz(quiz, license.licenseKey);
      markSaved(filename);
    } catch (e) {
      alert("Failed to save: " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleOpen = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".quiz";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const loaded = await openQuizFile(file, license.licenseKey);
        loadQuiz(loaded, file.name);
      } catch (err) {
        alert("Could not open file: " + (err as Error).message);
      }
    };
    input.click();
    setFileMenuOpen(false);
  };

  const handleOpenImportDialog = () => {
    setFileMenuOpen(false);
    setImportDialogOpen(true);
  };

  const handleImportComplete = (quiz: QuizFile, fileName: string) => {
    loadQuiz(quiz, fileName);
  };

  const openQuestionBankExport = () => {
    if (!(quiz.meta as any).cloudId) {
      alert("Save this quiz to the cloud before exporting questions to a Question Bank.");
      return;
    }
    setSelectedQuestionIds(quiz.questions.map((question) => question.id));
    setSelectedTagIds([]);
    setTargetBankId("");
    setTargetFolderId("");
    setFileMenuOpen(false);
    setQuestionBankDialogOpen(true);
  };

  const handleQuestionBankExport = async () => {
    const quizId = (quiz.meta as any).cloudId as number | undefined;
    if (!quizId || !targetBankId || selectedQuestionIds.length === 0) return;
    try {
      const result = await exportToQuestionBank.mutateAsync({
        quizId,
        targetBankId: Number(targetBankId),
        folderId: targetFolderId ? Number(targetFolderId) : undefined,
        questionIds: selectedQuestionIds,
        tagIds: selectedTagIds,
      });
      const summary = [
        result.exportedCount > 0 ? `${result.exportedCount} new question${result.exportedCount === 1 ? "" : "s"} added` : "",
        result.updatedCount > 0 ? `${result.updatedCount} existing question${result.updatedCount === 1 ? "" : "s"} synchronized` : "",
      ].filter(Boolean).join(" and ");
      alert(`${summary || "No questions changed"}. Question media and supported native settings are retained.`);
      setQuestionBankDialogOpen(false);
    } catch (err) {
      alert("Question Bank export failed: " + (err as Error).message);
    }
  };

  const tierBadge = {
    free: { label: "Free", color: "bg-gray-100 text-gray-600" },
    pro: { label: "Pro", color: "bg-teal-100 text-teal-700" },
    enterprise: { label: "Enterprise", color: "bg-purple-100 text-purple-700" },
  }[license.tier];

  return (
    <>
      <header
        className="h-14 flex items-center px-4 gap-3 border-b border-white/10 shrink-0"
        style={{ background: "linear-gradient(135deg, #0d1f3c 0%, #1a3356 100%)" }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 mr-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#24abbc" }}>
            <FileText className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="text-white font-bold text-sm">Teach</span>
            <span className="font-bold text-sm" style={{ color: "#24abbc" }}>ific</span>
            <span className="text-white/60 text-xs ml-1">QuizMaker</span>
          </div>
        </div>

        {/* Quiz title */}
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={quiz.meta.title}
            onChange={(e) => useQuizStore.getState().updateMeta({ title: e.target.value })}
            className="bg-transparent text-white text-sm font-medium placeholder-white/40 border-none outline-none w-full max-w-xs"
            placeholder="Untitled Quiz"
          />
          {isDirty && <span className="text-white/40 text-xs ml-2">● unsaved</span>}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* File menu */}
          <div className="relative">
            <button
              onClick={() => setFileMenuOpen((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 text-sm transition-colors"
            >
              File
              <ChevronDown className="w-3 h-3" />
            </button>
            {fileMenuOpen && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden z-20 w-52">
                <button
                  onClick={() => { newQuiz(); setFileMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-sm text-gray-700"
                >
                  <Plus className="w-4 h-4 text-gray-400" /> New Quiz
                </button>
                <button
                  onClick={handleOpen}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-sm text-gray-700"
                >
                  <FolderOpen className="w-4 h-4 text-gray-400" /> Open .quiz
                </button>
                <div className="border-t border-gray-100" />
                <button
                  onClick={handleOpenImportDialog}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-sm text-gray-700"
                >
                  <FileArchive className="w-4 h-4 text-teal-500" /> Import SCORM / iSpring…
                </button>
                <div className="border-t border-gray-100" />
                <button
                  onClick={() => { handleSave(); setFileMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-sm text-gray-700"
                >
                  <Save className="w-4 h-4 text-gray-400" /> Save as .quiz
                </button>
                {user && (
                  <>
                    <div className="border-t border-gray-100" />
                    <button
                      onClick={handleCloudSave}
                      disabled={cloudSaving}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-sm text-gray-700 disabled:opacity-50"
                    >
                      <CloudUpload className="w-4 h-4 text-teal-500" /> {cloudSaving ? "Saving..." : "Save to Cloud"}
                    </button>
                    <button
                      onClick={() => { onCloudOpen?.(); setFileMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-sm text-gray-700"
                    >
                      <Cloud className="w-4 h-4 text-teal-500" /> Open from Cloud
                    </button>
                    <button
                      onClick={openQuestionBankExport}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-sm text-gray-700"
                    >
                      <Database className="w-4 h-4 text-[var(--org-primary)]" /> Sync questions to Bank
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 text-sm transition-colors disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? "Saving..." : "Save"}
          </button>

          <div className="w-px h-5 bg-white/20" />

          <button
            onClick={onPreview}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white transition-all"
            style={{ background: "#24abbc" }}
          >
            <Play className="w-3.5 h-3.5" />
            Preview
          </button>

          {user && (
            <button
              onClick={onPublish}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                isPublished
                  ? "bg-green-500/20 text-green-300 hover:bg-green-500/30"
                  : "bg-white/10 text-white/80 hover:text-white hover:bg-white/15"
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              {isPublished ? "Published" : "Publish"}
            </button>
          )}

          <div className="w-px h-5 bg-white/20" />

          <button
            onClick={onSettings}
            className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            title="Quiz settings"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            onClick={onLicense}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors"
            style={{ background: "rgba(255,255,255,0.08)" }}
            title="License"
          >
            <Key className="w-3 h-3 text-white/60" />
            <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${tierBadge.color}`}>
              {tierBadge.label}
            </span>
          </button>
        </div>
      </header>

      {/* SCORM / iSpring import dialog */}
      <ScormImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImportComplete={handleImportComplete}
      />

      <Dialog open={questionBankDialogOpen} onOpenChange={setQuestionBankDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Export Quiz Questions to Question Bank</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Choose a Question Bank in the active organization and the questions to synchronize. Existing questions from this saved quiz are updated rather than duplicated; question media, choices, ordering, and matching data are retained when supported.</p>
            <label className="grid gap-1.5 text-sm font-medium">
              Target Question Bank
              <select
                value={targetBankId}
                onChange={(event) => { setTargetBankId(event.target.value); setTargetFolderId(""); }}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select a Question Bank</option>
                {questionBanks.map((bank) => <option key={bank.id} value={bank.id}>{bank.name}</option>)}
              </select>
            </label>
            {targetBankId && questionBankFolders.length > 0 && (
              <label className="grid gap-1.5 text-sm font-medium">
                Question Bank folder <span className="font-normal text-muted-foreground">(optional)</span>
                <select value={targetFolderId} onChange={(event) => setTargetFolderId(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">No folder</option>
                  {questionBankFolders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
                </select>
              </label>
            )}
            <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border p-3">
              {quiz.questions.map((question, index) => {
                const checked = selectedQuestionIds.includes(question.id);
                return <label key={question.id} className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => setSelectedQuestionIds((current) => event.target.checked ? [...current, question.id] : current.filter((id) => id !== question.id))}
                    className="mt-0.5 accent-[var(--org-primary)]"
                  />
                  <span><strong>Q{index + 1}.</strong> {question.stem || "Untitled question"}</span>
                </label>;
              })}
            </div>
            {questionBankTags.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Apply Question Bank tags <span className="font-normal text-muted-foreground">(optional)</span></p>
                <div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto">
                  {questionBankTags.map((tag) => {
                    const selected = selectedTagIds.includes(tag.id);
                    return <button
                      key={tag.id}
                      type="button"
                      onClick={() => setSelectedTagIds((current) => selected ? current.filter((id) => id !== tag.id) : [...current, tag.id])}
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${selected ? "border-[var(--org-primary)] bg-[color:color-mix(in_srgb,var(--org-primary)_10%,transparent)] text-[var(--org-primary)]" : "border-gray-200 bg-white text-gray-600 hover:border-[var(--org-primary)]"}`}
                    >
                      {tag.name}
                    </button>;
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <button type="button" onClick={() => setQuestionBankDialogOpen(false)} className="rounded-md border px-4 py-2 text-sm">Cancel</button>
            <button
              type="button"
              onClick={handleQuestionBankExport}
              disabled={!targetBankId || selectedQuestionIds.length === 0 || exportToQuestionBank.isPending}
              className="org-primary-button rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {exportToQuestionBank.isPending ? "Synchronizing..." : "Sync selected questions"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
