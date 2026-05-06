import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  ChevronLeft, Download, GripVertical, Plus, Save, Trash2, Upload, CheckCircle2, Sparkles, Loader2, Info, FileArchive, Eye,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";

type QuestionType = "multiple_choice" | "true_false" | "multiple_select" | "short_answer" | "essay";
type Choice = { text: string; isCorrect: boolean; feedback?: string };
type Question = { id: string; type: QuestionType; text: string; points: number; choices: Choice[]; correctFeedback?: string; incorrectFeedback?: string };

const QT_LABELS: Record<QuestionType, string> = {
  multiple_choice: "Multiple Choice", true_false: "True/False",
  multiple_select: "Multiple Select", short_answer: "Short Answer", essay: "Essay",
};

function QuestionCard({ q, idx, onChange, onDelete }: { q: Question; idx: number; onChange: (q: Question) => void; onDelete: () => void }) {
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
          <GripVertical className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">{idx + 1}</Badge>
              <select className="h-7 rounded border border-input bg-background px-2 text-xs"
                value={q.type} onChange={(e) => onChange({ ...q, type: e.target.value as QuestionType, choices: e.target.value === "true_false" ? [{ text: "True", isCorrect: true }, { text: "False", isCorrect: false }] : q.choices })}>
                {Object.entries(QT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <Input type="number" value={q.points} onChange={(e) => onChange({ ...q, points: Number(e.target.value) })} className="h-7 w-16 text-xs" placeholder="pts" />
              <Button variant="ghost" size="icon" className="h-7 w-7 ml-auto text-destructive hover:text-destructive" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
            <textarea className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
              value={q.text} onChange={(e) => onChange({ ...q, text: e.target.value })} placeholder="Question text..." />
          </div>
        </div>
      </CardHeader>
      {(q.type === "multiple_choice" || q.type === "true_false" || q.type === "multiple_select") && (
        <CardContent className="pt-0 pl-10 space-y-2">
          {q.choices.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <button onClick={() => toggleCorrect(i)} className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${c.isCorrect ? "border-emerald-500 bg-emerald-500" : "border-border"}`}>
                {c.isCorrect && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
              </button>
              <Input value={c.text} onChange={(e) => updateChoice(i, { ...c, text: e.target.value })} className="h-8 text-sm flex-1" placeholder={`Answer ${i + 1}`} />
              {q.type !== "true_false" && (
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeChoice(i)}><Trash2 className="h-3.5 w-3.5" /></Button>
              )}
            </div>
          ))}
          {q.type !== "true_false" && (
            <Button variant="ghost" size="sm" onClick={addChoice} className="gap-1.5 text-xs h-7"><Plus className="h-3 w-3" />Add Answer</Button>
          )}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div><Label className="text-xs">Correct Feedback</Label><Input value={q.correctFeedback ?? ""} onChange={(e) => onChange({ ...q, correctFeedback: e.target.value })} className="h-7 text-xs mt-1" placeholder="Great job!" /></div>
            <div><Label className="text-xs">Incorrect Feedback</Label><Input value={q.incorrectFeedback ?? ""} onChange={(e) => onChange({ ...q, incorrectFeedback: e.target.value })} className="h-7 text-xs mt-1" placeholder="Try again..." /></div>
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
  const { data: myOrgs } = trpc.orgs.myOrgs.useQuery();
  const orgId = myOrgs?.[0]?.id ?? 0;

  const createQuiz = trpc.quizzes.create.useMutation();
  const upsertQuestions = trpc.quizzes.questions.upsert.useMutation();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [passingScore, setPassingScore] = useState("70");
  const [timeLimit, setTimeLimit] = useState("");
  const [maxAttempts, setMaxAttempts] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [saving, setSaving] = useState(false);

  // AI generation state
  const [aiOpen, setAiOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiNumQ, setAiNumQ] = useState(10);
  const [aiGenerating, setAiGenerating] = useState(false);
  const { can } = useOrgPlan(orgId || null);

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

  const [importInfoOpen, setImportInfoOpen] = useState(false);
  const importXlsMutation = trpc.quizzes.importXls.useMutation();
  const quizId = isNew ? null : params.id ? Number(params.id) : null;
  const exportXlsQuery = trpc.quizzes.exportXls.useQuery(
    { quizId: quizId ?? 0 },
    { enabled: false }
  );

  const handleExportXls = async () => {
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
      const quizResult = await createQuiz.mutateAsync({
        orgId,
        title,
        description: description || undefined,
        passingScore: passingScore ? Number(passingScore) : undefined,
        timeLimit: timeLimit ? Number(timeLimit) : undefined,
        maxAttempts: maxAttempts ? Number(maxAttempts) : undefined,
      });
      const quizId2 = (quizResult as any).insertId ?? (quizResult as any).id;
      await upsertQuestions.mutateAsync({
        quizId: quizId2,
        questions: questions.map((q, i) => ({
          sortOrder: i,
          questionType: q.type as any,
          questionText: q.text,
          points: q.points,
          choices: q.choices.map((c, ci) => ({ sortOrder: ci, choiceText: c.text, isCorrect: c.isCorrect })),
        })),
      });
      toast.success("Quiz saved successfully!");
      setLocation(`/quizzes/${quizId2}`);
    } catch (err: any) {
      toast.error("Save failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/quizzes")}><ChevronLeft className="h-4 w-4" /></Button>
        <h1 className="text-xl font-bold flex-1">{isNew ? "Create Quiz" : "Edit Quiz"}</h1>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => {
            if (!can("aiGeneration")) { setUpgradeOpen(true); return; }
            setAiOpen(true);
          }}
        >
          <Sparkles className="h-4 w-4 text-purple-500" />
          AI Generate
        </Button>
        <Button variant="outline" onClick={handleImportExcel} className="gap-2"><Upload className="h-4 w-4" />Import</Button>
        {!isNew && <Button variant="outline" onClick={handleExportXls} className="gap-2"><Download className="h-4 w-4" />Export XLS</Button>}
        <Button variant="outline" size="icon" onClick={() => setImportInfoOpen(true)} title="Import instructions"><Info className="h-4 w-4" /></Button>
        <Button variant="outline" asChild className="gap-2"><a href="/api/quiz/template"><FileArchive className="h-4 w-4" />Template (ZIP)</a></Button>
        {!isNew && quizId && (
          <Button variant="outline" className="gap-2" onClick={() => window.open(`/quizzes/${quizId}/play`, "_blank")}>
            <Eye className="h-4 w-4" />
            Preview as Student
          </Button>
        )}
        <Button onClick={handleSave} disabled={saving} className="gap-2"><Save className="h-4 w-4" />{saving ? "Saving..." : "Save Quiz"}</Button>
      </div>

      <Tabs defaultValue="settings">
        <TabsList><TabsTrigger value="settings">Settings</TabsTrigger><TabsTrigger value="questions">Questions ({questions.length})</TabsTrigger></TabsList>

        <TabsContent value="settings" className="mt-4">
          <Card className="shadow-sm border-border/60">
            <CardContent className="p-5 space-y-4">
              <div className="space-y-1.5"><Label>Quiz Title <span className="text-destructive">*</span></Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. OBGYN Board Review Quiz" /></div>
              <div className="space-y-1.5"><Label>Description</Label><textarea className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description..." /></div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5"><Label>Passing Score (%)</Label><Input type="number" value={passingScore} onChange={(e) => setPassingScore(e.target.value)} placeholder="70" /></div>
                <div className="space-y-1.5"><Label>Time Limit (min)</Label><Input type="number" value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)} placeholder="Unlimited" /></div>
                <div className="space-y-1.5"><Label>Max Attempts</Label><Input type="number" value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value)} placeholder="Unlimited" /></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="questions" className="mt-4 space-y-4">
          {questions.length === 0 ? (
            <Card className="shadow-sm border-border/60">
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground mb-4">No questions yet. Add questions manually or import from Excel.</p>
                <div className="flex gap-2 justify-center flex-wrap">
                  {(["multiple_choice", "true_false", "multiple_select", "short_answer"] as QuestionType[]).map((t) => (
                    <Button key={t} variant="outline" size="sm" onClick={() => addQuestion(t)}><Plus className="h-3.5 w-3.5 mr-1" />{QT_LABELS[t]}</Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {questions.map((q, i) => (
                <QuestionCard key={q.id} q={q} idx={i}
                  onChange={(updated) => setQuestions(questions.map((x) => x.id === q.id ? updated : x))}
                  onDelete={() => setQuestions(questions.filter((x) => x.id !== q.id))} />
              ))}
            </>
          )}
          <div className="flex gap-2 flex-wrap">
            {(["multiple_choice", "true_false", "multiple_select", "short_answer", "essay"] as QuestionType[]).map((t) => (
              <Button key={t} variant="outline" size="sm" onClick={() => addQuestion(t)}><Plus className="h-3.5 w-3.5 mr-1" />{QT_LABELS[t]}</Button>
            ))}
          </div>
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
                type="number"
                min={1}
                max={50}
                value={aiNumQ}
                onChange={(e) => setAiNumQ(parseInt(e.target.value) || 10)}
                className="mt-1.5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAiOpen(false)} disabled={aiGenerating}>
              Cancel
            </Button>
            <Button
              disabled={!aiTopic.trim() || aiGenerating || !orgId}
              onClick={() => {
                if (!orgId) return;
                setAiGenerating(true);
                aiGenerateMutation.mutate({ topic: aiTopic.trim(), numQuestions: aiNumQ });
              }}
              className="gap-2"
            >
              {aiGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {aiGenerating ? "Generating..." : "Generate Questions"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Instructions Dialog */}
      <Dialog open={importInfoOpen} onOpenChange={setImportInfoOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileArchive className="h-5 w-5 text-primary" />Quiz Import Instructions</DialogTitle>
            <DialogDescription>How to import questions with media files into Teachific</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
              <p className="font-semibold">Option 1: XLSX Only (no media)</p>
              <p className="text-muted-foreground">Download the template, fill in your questions, and upload the <code className="bg-muted px-1 rounded">.xlsx</code> file directly. Leave the Image, Video, and Audio columns blank.</p>
              <Button variant="outline" size="sm" asChild className="gap-2 mt-1">
                <a href="/api/quiz/template/xlsx"><Download className="h-3.5 w-3.5" />Download XLSX Template</a>
              </Button>
            </div>
            <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
              <p className="font-semibold">Option 2: ZIP Bundle (with media)</p>
              <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                <li>Download the ZIP template below — it contains a sample Excel file and a <code className="bg-muted px-1 rounded">media/</code> folder with example images.</li>
                <li>Add your media files (images, videos, audio) into the <code className="bg-muted px-1 rounded">media/</code> folder inside the ZIP.</li>
                <li>In the Excel file, reference media using relative paths like <code className="bg-muted px-1 rounded">media/my-image.jpg</code> in the Image, Video, or Audio columns.</li>
                <li>Re-zip the folder (keeping the same structure) and upload the <code className="bg-muted px-1 rounded">.zip</code> file using the Import button.</li>
              </ol>
              <div className="mt-2 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2 text-amber-800 dark:text-amber-300 text-xs">
                Supported media formats: JPG, PNG, GIF, WebP, SVG (images) · MP4, WebM, MOV (video) · MP3, WAV, OGG, M4A, AAC (audio)
              </div>
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
                <span><code className="bg-muted px-1 rounded">MG</code> — Matching</span>
                <span><code className="bg-muted px-1 rounded">SEQ</code> — Sequence</span>
                <span><code className="bg-muted px-1 rounded">NUMG</code> — Numeric</span>
                <span><code className="bg-muted px-1 rounded">ESS</code> — Essay</span>
                <span><code className="bg-muted px-1 rounded">IS</code> — Info Slide</span>
                <span><code className="bg-muted px-1 rounded">PO / PM / SA</code> — Survey</span>
              </div>
              <p className="text-muted-foreground text-xs mt-2">Mark correct answers with an asterisk prefix: <code className="bg-muted px-1 rounded">*Answer text</code></p>
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
        requiredPlan="starter"
        featureName="AI Quiz Generation"
        featureDescription="Automatically generate quiz questions with answer choices from any topic using AI."
      />
    </div>
  );
}
