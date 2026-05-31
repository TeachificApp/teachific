import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import UpgradePromptDialog from "@/components/UpgradePromptDialog";
import { useOrgPlan } from "@/hooks/useOrgPlan";
import {
  ChevronLeft, Download, GripVertical, Plus, Save, Trash2, Upload,
  CheckCircle2, Sparkles, Loader2, Info, FileArchive, Eye, Lock,
  Shuffle, Settings2, BarChart2, RefreshCw,
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";

type QuestionType = "multiple_choice" | "true_false" | "multiple_select" | "short_answer" | "essay";
type Choice = { text: string; isCorrect: boolean; feedback?: string };
type Question = {
  id: string;
  type: QuestionType;
  text: string;
  points: number;
  choices: Choice[];
  correctFeedback?: string;
  incorrectFeedback?: string;
};

const QT_LABELS: Record<QuestionType, string> = {
  multiple_choice: "Multiple Choice",
  true_false: "True/False",
  multiple_select: "Multiple Select",
  short_answer: "Short Answer",
  essay: "Essay",
};

function QuestionCard({ q, idx, onChange, onDelete }: {
  q: Question; idx: number; onChange: (q: Question) => void; onDelete: () => void;
}) {
  const addChoice = () => onChange({ ...q, choices: [...q.choices, { text: "", isCorrect: false }] });
  const updateChoice = (i: number, c: Choice) => onChange({ ...q, choices: q.choices.map((x, j) => j === i ? c : x) });
  const removeChoice = (i: number) => onChange({ ...q, choices: q.choices.filter((_, j) => j !== i) });
  const toggleCorrect = (i: number) => {
    if (q.type === "multiple_choice" || q.type === "true_false") {
      onChange({ ...q, choices: q.choices.map((c, j) => ({ ...c, isCorrect: j === i })) });
    } else {
      updateChoice(i, { ...q.choices[i], isCorrect: !q.choices[i].isCorrect });
    }
  };

  return (
    <Card className="shadow-sm border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <GripVertical className="h-4 w-4 text-muted-foreground mt-1 shrink-0 cursor-grab" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-xs shrink-0">{idx + 1}</Badge>
              <select
                className="h-7 rounded border border-input bg-background px-2 text-xs"
                value={q.type}
                onChange={(e) => onChange({
                  ...q,
                  type: e.target.value as QuestionType,
                  choices: e.target.value === "true_false"
                    ? [{ text: "True", isCorrect: true }, { text: "False", isCorrect: false }]
                    : q.choices,
                })}
              >
                {Object.entries(QT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <Input
                type="number"
                value={q.points}
                onChange={(e) => onChange({ ...q, points: Number(e.target.value) })}
                className="h-7 w-16 text-xs"
                placeholder="pts"
              />
              <Button
                variant="ghost" size="icon"
                className="h-7 w-7 ml-auto text-destructive hover:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <textarea
              className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
              value={q.text}
              onChange={(e) => onChange({ ...q, text: e.target.value })}
              placeholder="Question text..."
            />
          </div>
        </div>
      </CardHeader>
      {(q.type === "multiple_choice" || q.type === "true_false" || q.type === "multiple_select") && (
        <CardContent className="pt-0 pl-10 space-y-2">
          {q.choices.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <button
                onClick={() => toggleCorrect(i)}
                className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                  c.isCorrect ? "border-emerald-500 bg-emerald-500" : "border-border"
                }`}
              >
                {c.isCorrect && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
              </button>
              <Input
                value={c.text}
                onChange={(e) => updateChoice(i, { ...c, text: e.target.value })}
                className="h-8 text-sm flex-1"
                placeholder={`Answer ${i + 1}`}
              />
              {q.type !== "true_false" && (
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeChoice(i)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
          {q.type !== "true_false" && (
            <Button variant="ghost" size="sm" onClick={addChoice} className="gap-1.5 text-xs h-7">
              <Plus className="h-3 w-3" />Add Answer
            </Button>
          )}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <Label className="text-xs">Correct Feedback</Label>
              <Input
                value={q.correctFeedback ?? ""}
                onChange={(e) => onChange({ ...q, correctFeedback: e.target.value })}
                className="h-7 text-xs mt-1"
                placeholder="Great job!"
              />
            </div>
            <div>
              <Label className="text-xs">Incorrect Feedback</Label>
              <Input
                value={q.incorrectFeedback ?? ""}
                onChange={(e) => onChange({ ...q, incorrectFeedback: e.target.value })}
                className="h-7 text-xs mt-1"
                placeholder="Try again..."
              />
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default function QuizBuilderPage() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const isNew = !params.id || params.id === "new";
  const quizId = isNew ? null : params.id ? Number(params.id) : null;

  const { data: myOrgs } = trpc.orgs.myOrgs.useQuery();
  const orgId = myOrgs?.[0]?.id ?? 0;
  const { can } = useOrgPlan(orgId || null);

  // Basic settings
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [passingScore, setPassingScore] = useState("70");
  const [timeLimit, setTimeLimit] = useState("");
  const [maxAttempts, setMaxAttempts] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [saving, setSaving] = useState(false);

  // Advanced / rotation settings (fullQuizMaker)
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleAnswers, setShuffleAnswers] = useState(false);
  const [showFeedbackImmediately, setShowFeedbackImmediately] = useState(false);
  const [showCorrectAnswers, setShowCorrectAnswers] = useState(true);

  // AI generation state
  const [aiOpen, setAiOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState("fullQuizMaker");
  const [upgradeFeatureName, setUpgradeFeatureName] = useState("Full QuizMaker");
  const [aiTopic, setAiTopic] = useState("");
  const [aiNumQ, setAiNumQ] = useState(10);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [importInfoOpen, setImportInfoOpen] = useState(false);

  // Load existing quiz data
  const { data: existingQuiz } = trpc.quizzes.get.useQuery(
    { id: quizId! },
    { enabled: !!quizId }
  );

  useEffect(() => {
    if (existingQuiz) {
      setTitle(existingQuiz.title ?? "");
      setDescription(existingQuiz.description ?? "");
      setPassingScore(String(existingQuiz.passingScore ?? 70));
      setTimeLimit(existingQuiz.timeLimit ? String(existingQuiz.timeLimit) : "");
      setMaxAttempts(existingQuiz.maxAttempts ? String(existingQuiz.maxAttempts) : "");
      setShuffleQuestions(!!(existingQuiz as any).shuffleQuestions);
      setShuffleAnswers(!!(existingQuiz as any).shuffleAnswers);
      setShowFeedbackImmediately(!!(existingQuiz as any).showFeedbackImmediately);
      setShowCorrectAnswers((existingQuiz as any).showCorrectAnswers !== false);
      if (existingQuiz.questions) {
        setQuestions(existingQuiz.questions.map((q: any) => ({
          id: String(q.id),
          type: (q.questionType ?? "multiple_choice") as QuestionType,
          text: q.questionText ?? "",
          points: q.points ?? 1,
          choices: (q.choices ?? []).map((c: any) => ({
            text: c.choiceText ?? c.text ?? "",
            isCorrect: !!c.isCorrect,
            feedback: c.feedback,
          })),
          correctFeedback: q.correctFeedback,
          incorrectFeedback: q.incorrectFeedback,
        })));
      }
    }
  }, [existingQuiz]);

  const createQuiz = trpc.quizzes.create.useMutation();
  const updateQuiz = trpc.quizzes.update.useMutation();
  const upsertQuestions = trpc.quizzes.questions.upsert.useMutation();

  const aiGenerateMutation = trpc.lms.ai.generateQuiz.useMutation({
    onSuccess: (result) => {
      if (result?.questions) {
        const imported: Question[] = result.questions.map((q: any) => ({
          id: Math.random().toString(36).slice(2),
          type: (q.type ?? "multiple_choice") as QuestionType,
          text: q.text ?? q.questionText ?? "",
          points: 1,
          choices: (q.choices ?? []).map((c: any) => ({ text: c.text, isCorrect: c.isCorrect })),
        }));
        setQuestions((prev) => [...prev, ...imported]);
        if (!title) setTitle(aiTopic);
        toast.success(`AI generated ${imported.length} questions`);
        setAiOpen(false);
        setAiTopic("");
      }
      setAiGenerating(false);
    },
    onError: (e) => { toast.error(e.message); setAiGenerating(false); },
  });

  const addQuestion = (type: QuestionType = "multiple_choice") => {
    const q: Question = {
      id: Math.random().toString(36).slice(2),
      type,
      text: "",
      points: 1,
      choices: type === "true_false"
        ? [{ text: "True", isCorrect: true }, { text: "False", isCorrect: false }]
        : [{ text: "", isCorrect: true }, { text: "", isCorrect: false }],
    };
    setQuestions([...questions, q]);
  };

  const importXlsMutation = trpc.quizzes.importXls.useMutation();
  const exportXlsQuery = trpc.quizzes.exportXls.useQuery(
    { quizId: quizId ?? 0 },
    { enabled: false }
  );

  const handleExportXls = async () => {
    if (!can("fullQuizMaker")) {
      setUpgradeFeature("fullQuizMaker");
      setUpgradeFeatureName("Full QuizMaker");
      setUpgradeOpen(true);
      return;
    }
    if (!quizId) { toast.error("Save the quiz first before exporting"); return; }
    const toastId = toast.loading("Generating XLSX...");
    try {
      const result = await exportXlsQuery.refetch();
      if (result.data) {
        const { base64, filename } = result.data;
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
        toast.success("XLSX exported", { id: toastId });
      }
    } catch (err: any) {
      toast.error("Export failed: " + err.message, { id: toastId });
    }
  };

  const handleImportExcel = () => {
    if (!can("fullQuizMaker")) {
      setUpgradeFeature("fullQuizMaker");
      setUpgradeFeatureName("Full QuizMaker");
      setUpgradeOpen(true);
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xls,.xlsx,.zip";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const isZip = file.name.toLowerCase().endsWith(".zip");
      const toastId = toast.loading(isZip ? "Extracting ZIP and uploading media..." : "Parsing Excel...");
      try {
        if (!isZip) {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve((reader.result as string).split(",")[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          const result = await importXlsMutation.mutateAsync({ base64 });
          if (result.warnings.length > 0) toast.warning(result.warnings.join("\n"), { id: toastId });
          const imported: Question[] = result.questions.map((q: any) => ({
            id: Math.random().toString(36).slice(2),
            type: (q.questionType ?? "multiple_choice") as QuestionType,
            text: q.questionText ?? "",
            points: q.points ?? 1,
            choices: (q.choices ?? []).map((c: any) => ({ text: c.text, isCorrect: c.isCorrect })),
            correctFeedback: q.explanation,
          }));
          setQuestions([...questions, ...imported]);
          toast.success(`Imported ${imported.length} questions`, { id: toastId });
        } else {
          const fd = new FormData();
          fd.append("file", file);
          const res = await fetch("/api/quiz/import/preview", { method: "POST", body: fd });
          const data = await res.json();
          if (data.questions) {
            const imported: Question[] = data.questions.map((q: any) => ({
              id: Math.random().toString(36).slice(2),
              type: (q.questionType ?? q.type ?? "multiple_choice") as QuestionType,
              text: q.questionText ?? q.text ?? "",
              points: q.points ?? 1,
              choices: (q.choices ?? []).map((c: any) => ({ text: c.choiceText ?? c.text, isCorrect: c.isCorrect, feedback: c.feedback })),
              correctFeedback: q.correctFeedback,
              incorrectFeedback: q.incorrectFeedback,
            }));
            setQuestions([...questions, ...imported]);
            const mediaMsg = data.mediaUploaded > 0 ? ` (${data.mediaUploaded} media files uploaded)` : "";
            toast.success(`Imported ${imported.length} questions${mediaMsg}`, { id: toastId });
          } else {
            toast.error("Import failed: " + (data.error ?? "Unknown error"), { id: toastId });
          }
        }
      } catch (err: any) {
        toast.error("Import failed: " + err.message, { id: toastId });
      }
    };
    input.click();
  };

  const handleSave = async () => {
    if (!title.trim()) { toast.error("Please enter a quiz title"); return; }
    if (!orgId) { toast.error("No organization found"); return; }
    setSaving(true);
    try {
      const settings = {
        title,
        description: description || undefined,
        passingScore: passingScore ? Number(passingScore) : undefined,
        timeLimit: timeLimit ? Number(timeLimit) : undefined,
        maxAttempts: maxAttempts ? Number(maxAttempts) : undefined,
        shuffleQuestions: can("fullQuizMaker") ? shuffleQuestions : false,
        shuffleAnswers: can("fullQuizMaker") ? shuffleAnswers : false,
        showFeedbackImmediately: can("fullQuizMaker") ? showFeedbackImmediately : false,
        showCorrectAnswers: can("fullQuizMaker") ? showCorrectAnswers : true,
      };

      let savedQuizId = quizId;
      if (isNew) {
        const quizResult = await createQuiz.mutateAsync({ orgId, ...settings });
        savedQuizId = (quizResult as any).insertId ?? (quizResult as any).id;
      } else if (quizId) {
        await updateQuiz.mutateAsync({ id: quizId, ...settings });
      }

      if (savedQuizId) {
        await upsertQuestions.mutateAsync({
          quizId: savedQuizId,
          questions: questions.map((q, i) => ({
            sortOrder: i,
            questionType: q.type as any,
            questionText: q.text,
            points: q.points,
            choices: q.choices.map((c, ci) => ({ sortOrder: ci, choiceText: c.text, isCorrect: c.isCorrect })),
          })),
        });
      }

      toast.success(isNew ? "Quiz created successfully!" : "Quiz saved successfully!");
      if (isNew && savedQuizId) setLocation(`/quizzes/${savedQuizId}/edit`);
    } catch (err: any) {
      toast.error("Save failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const gated = (feature: string, featureName: string, fn: () => void) => {
    if (!can(feature as any)) {
      setUpgradeFeature(feature);
      setUpgradeFeatureName(featureName);
      setUpgradeOpen(true);
      return;
    }
    fn();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/media-library#quizzes")}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-bold flex-1">{isNew ? "Create Quiz" : "Edit Quiz"}</h1>

        <Button
          variant="outline"
          className="gap-2"
          onClick={() => gated("aiGeneration", "AI Quiz Generation", () => setAiOpen(true))}
        >
          {!can("aiGeneration") && <Lock className="h-3.5 w-3.5 text-amber-500" />}
          <Sparkles className="h-4 w-4 text-purple-500" />
          AI Generate
        </Button>

        <Button
          variant="outline"
          onClick={handleImportExcel}
          className="gap-2"
        >
          {!can("fullQuizMaker") && <Lock className="h-3.5 w-3.5 text-amber-500" />}
          <Upload className="h-4 w-4" />Import
        </Button>

        {!isNew && (
          <Button variant="outline" onClick={handleExportXls} className="gap-2">
            {!can("fullQuizMaker") && <Lock className="h-3.5 w-3.5 text-amber-500" />}
            <Download className="h-4 w-4" />Export XLS
          </Button>
        )}

        {!isNew && quizId && (
          <>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                if (!can("fullQuizMaker")) {
                  setUpgradeFeature("fullQuizMaker");
                  setUpgradeFeatureName("SCORM Export");
                  setUpgradeOpen(true);
                  return;
                }
                window.open(`/api/quiz/export/scorm/${quizId}`, "_blank");
              }}
            >
              {!can("fullQuizMaker") && <Lock className="h-3.5 w-3.5 text-amber-500" />}
              <FileArchive className="h-4 w-4" />SCORM
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => window.open(`/quizzes/${quizId}/play`, "_blank")}
            >
              <Eye className="h-4 w-4" />Preview
            </Button>
          </>
        )}

        <Button variant="outline" size="icon" onClick={() => setImportInfoOpen(true)} title="Import instructions">
          <Info className="h-4 w-4" />
        </Button>

        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save Quiz"}
        </Button>
      </div>

      {/* Plan upgrade banner */}
      {!can("fullQuizMaker") && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-4 py-3">
          <Lock className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Basic Quiz Builder</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              Upgrade to Builder+ to unlock SCORM/CSV import &amp; export, question rotation, answer shuffling, and advanced feedback settings.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-amber-400 text-amber-700 hover:bg-amber-100 shrink-0"
            onClick={() => { setUpgradeFeature("fullQuizMaker"); setUpgradeFeatureName("Full QuizMaker"); setUpgradeOpen(true); }}
          >
            Upgrade
          </Button>
        </div>
      )}

      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings" className="gap-1.5">
            <Settings2 className="h-3.5 w-3.5" />Settings
          </TabsTrigger>
          <TabsTrigger value="questions" className="gap-1.5">
            Questions ({questions.length})
          </TabsTrigger>
          <TabsTrigger value="rotation" className="gap-1.5">
            {!can("fullQuizMaker") && <Lock className="h-3 w-3 text-amber-500" />}
            <Shuffle className="h-3.5 w-3.5" />Rotation
          </TabsTrigger>
          <TabsTrigger value="scoring" className="gap-1.5">
            <BarChart2 className="h-3.5 w-3.5" />Scoring
          </TabsTrigger>
        </TabsList>

        {/* Settings Tab */}
        <TabsContent value="settings" className="mt-4">
          <Card className="shadow-sm border-border/60">
            <CardContent className="p-5 space-y-4">
              <div className="space-y-1.5">
                <Label>Quiz Title <span className="text-destructive">*</span></Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. OBGYN Board Review Quiz" />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <textarea
                  className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of this quiz..."
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Passing Score (%)</Label>
                  <Input type="number" value={passingScore} onChange={(e) => setPassingScore(e.target.value)} placeholder="70" min={0} max={100} />
                </div>
                <div className="space-y-1.5">
                  <Label>Time Limit (min)</Label>
                  <Input type="number" value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)} placeholder="Unlimited" min={1} />
                </div>
                <div className="space-y-1.5">
                  <Label>Max Attempts</Label>
                  <Input type="number" value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value)} placeholder="Unlimited" min={1} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Questions Tab */}
        <TabsContent value="questions" className="mt-4 space-y-4">
          {questions.length === 0 ? (
            <Card className="shadow-sm border-border/60">
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground mb-4">No questions yet. Add questions manually or import from Excel.</p>
                <div className="flex gap-2 justify-center flex-wrap">
                  {(["multiple_choice", "true_false", "multiple_select", "short_answer"] as QuestionType[]).map((t) => (
                    <Button key={t} variant="outline" size="sm" onClick={() => addQuestion(t)}>
                      <Plus className="h-3.5 w-3.5 mr-1" />{QT_LABELS[t]}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {questions.map((q, i) => (
                <QuestionCard
                  key={q.id} q={q} idx={i}
                  onChange={(updated) => setQuestions(questions.map((x) => x.id === q.id ? updated : x))}
                  onDelete={() => setQuestions(questions.filter((x) => x.id !== q.id))}
                />
              ))}
            </>
          )}
          <div className="flex gap-2 flex-wrap">
            {(["multiple_choice", "true_false", "multiple_select", "short_answer", "essay"] as QuestionType[]).map((t) => (
              <Button key={t} variant="outline" size="sm" onClick={() => addQuestion(t)}>
                <Plus className="h-3.5 w-3.5 mr-1" />{QT_LABELS[t]}
              </Button>
            ))}
          </div>
        </TabsContent>

        {/* Rotation Tab */}
        <TabsContent value="rotation" className="mt-4">
          {!can("fullQuizMaker") ? (
            <Card className="shadow-sm border-border/60">
              <CardContent className="py-12 text-center space-y-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <Lock className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <p className="font-semibold">Question Rotation requires Builder+</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Randomize question order and answer choices on every attempt to prevent cheating.
                  </p>
                </div>
                <Button
                  onClick={() => { setUpgradeFeature("fullQuizMaker"); setUpgradeFeatureName("Full QuizMaker"); setUpgradeOpen(true); }}
                >
                  Upgrade to Builder
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-sm border-border/60">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Rotation &amp; Randomization
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Randomize Question Order</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Questions appear in a different order for each attempt.
                    </p>
                  </div>
                  <Switch checked={shuffleQuestions} onCheckedChange={setShuffleQuestions} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Randomize Answer Order</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Answer choices are shuffled on every attempt.
                    </p>
                  </div>
                  <Switch checked={shuffleAnswers} onCheckedChange={setShuffleAnswers} />
                </div>
                <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Question Pools</p>
                  <p>
                    To draw a random subset of questions from a question bank (e.g. "show 20 of 100 questions"),
                    use the <strong>Question Bank</strong> and attach pools to this quiz via the quiz settings in the course builder.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Scoring Tab */}
        <TabsContent value="scoring" className="mt-4">
          <Card className="shadow-sm border-border/60">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart2 className="h-4 w-4" />
                Feedback &amp; Scoring
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Show Feedback Immediately</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Show correct/incorrect feedback after each question (vs. at the end).
                  </p>
                </div>
                <Switch
                  checked={showFeedbackImmediately}
                  onCheckedChange={(v) => {
                    if (!can("fullQuizMaker")) {
                      setUpgradeFeature("fullQuizMaker"); setUpgradeFeatureName("Full QuizMaker"); setUpgradeOpen(true);
                      return;
                    }
                    setShowFeedbackImmediately(v);
                  }}
                  disabled={!can("fullQuizMaker")}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Show Correct Answers After Completion</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Students can review which answers were correct after finishing.
                  </p>
                </div>
                <Switch
                  checked={showCorrectAnswers}
                  onCheckedChange={(v) => {
                    if (!can("fullQuizMaker")) {
                      setUpgradeFeature("fullQuizMaker"); setUpgradeFeatureName("Full QuizMaker"); setUpgradeOpen(true);
                      return;
                    }
                    setShowCorrectAnswers(v);
                  }}
                  disabled={!can("fullQuizMaker")}
                />
              </div>
              {!can("fullQuizMaker") && (
                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  Feedback settings require Builder+ plan.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* AI Generate Dialog */}
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              AI Quiz Generator
            </DialogTitle>
            <DialogDescription>
              Enter a topic and AI will generate quiz questions with answer choices.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div>
              <Label>Topic or Subject</Label>
              <Textarea
                placeholder="e.g. Workplace Safety Fundamentals"
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                className="mt-1.5 resize-none"
                rows={2}
                autoFocus
              />
            </div>
            <div>
              <Label>Number of Questions</Label>
              <Input
                type="number" min={1} max={50}
                value={aiNumQ}
                onChange={(e) => setAiNumQ(parseInt(e.target.value) || 10)}
                className="mt-1.5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAiOpen(false)} disabled={aiGenerating}>Cancel</Button>
            <Button
              disabled={!aiTopic.trim() || aiGenerating || !orgId}
              onClick={() => {
                if (!orgId) return;
                setAiGenerating(true);
                aiGenerateMutation.mutate({ topic: aiTopic.trim(), numQuestions: aiNumQ });
              }}
              className="gap-2"
            >
              {aiGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {aiGenerating ? "Generating..." : "Generate Questions"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Instructions Dialog */}
      <Dialog open={importInfoOpen} onOpenChange={setImportInfoOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileArchive className="h-5 w-5 text-primary" />Quiz Import Instructions
            </DialogTitle>
            <DialogDescription>How to import questions with media files into Teachific</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
              <p className="font-semibold">Option 1: XLSX Only (no media)</p>
              <p className="text-muted-foreground">Download the template, fill in your questions, and upload the <code className="bg-muted px-1 rounded">.xlsx</code> file directly.</p>
              <Button variant="outline" size="sm" asChild className="gap-2 mt-1">
                <a href="/api/quiz/template/xlsx"><Download className="h-3.5 w-3.5" />Download XLSX Template</a>
              </Button>
            </div>
            <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
              <p className="font-semibold">Option 2: ZIP Bundle (with media)</p>
              <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                <li>Download the ZIP template — it contains a sample Excel file and a <code className="bg-muted px-1 rounded">media/</code> folder.</li>
                <li>Add your media files (images, videos, audio) into the <code className="bg-muted px-1 rounded">media/</code> folder.</li>
                <li>Reference media using relative paths like <code className="bg-muted px-1 rounded">media/my-image.jpg</code> in the Excel file.</li>
                <li>Re-zip and upload the <code className="bg-muted px-1 rounded">.zip</code> file.</li>
              </ol>
              <Button variant="outline" size="sm" asChild className="gap-2 mt-1">
                <a href="/api/quiz/template"><FileArchive className="h-3.5 w-3.5" />Download ZIP Template</a>
              </Button>
            </div>
            <div className="rounded-lg border bg-muted/40 p-4 space-y-1">
              <p className="font-semibold">Question Type Codes</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground text-xs mt-1">
                <span><code className="bg-muted px-1 rounded">MC</code> — Multiple Choice</span>
                <span><code className="bg-muted px-1 rounded">MR</code> — Multiple Response</span>
                <span><code className="bg-muted px-1 rounded">TF</code> — True / False</span>
                <span><code className="bg-muted px-1 rounded">TI</code> — Short Answer</span>
                <span><code className="bg-muted px-1 rounded">ESS</code> — Essay</span>
                <span><code className="bg-muted px-1 rounded">IS</code> — Info Slide</span>
              </div>
              <p className="text-muted-foreground text-xs mt-2">Mark correct answers with an asterisk: <code className="bg-muted px-1 rounded">*Answer text</code></p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setImportInfoOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upgrade Prompt */}
      <UpgradePromptDialog
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        requiredPlan="builder"
        featureName={upgradeFeatureName}
        featureDescription={
          upgradeFeature === "fullQuizMaker"
            ? "Unlock SCORM/CSV import & export, question rotation, answer shuffling, and advanced feedback settings."
            : "Automatically generate quiz questions with answer choices from any topic using AI."
        }
      />
    </div>
  );
}
