import { useState } from "react";
import { X, Cloud, Trash2, Clock } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useOrgScope } from "@/hooks/useOrgScope";
import { useLocation } from "wouter";
import { useQuizStore } from "../store/quizStore";

interface Props {
  onClose: () => void;
}

export function CloudQuizBrowser({ onClose }: Props) {
  const { orgId } = useOrgScope();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<"creator" | "lesson" | "results">("creator");
  const [resultQuizId, setResultQuizId] = useState("all");
  const [resultQuizType, setResultQuizType] = useState("all");
  const [resultEmail, setResultEmail] = useState("");
  const { data: quizzes, isLoading } = trpc.quizMaker.listQuizzes.useQuery();
  const { data: lessonQuizzes, isLoading: lessonQuizzesLoading } = trpc.lms.quiz.listOrgQuizzes.useQuery({ orgId }, { enabled: !!orgId });
  const resultInput = useMemo(() => ({
    orgId,
    quizId: resultQuizId === "all" ? undefined : Number(resultQuizId),
    quizType: resultQuizType === "all" ? undefined : resultQuizType as "assessment" | "practice" | "survey" | "exam",
    learnerEmail: resultEmail.trim() || undefined,
  }), [orgId, resultQuizId, resultQuizType, resultEmail]);
  const { data: resultData, isLoading: resultsLoading } = trpc.quizMaker.listOrgAttemptResults.useQuery(resultInput, { enabled: !!orgId && activeTab === "results" });
  const deleteQuizMutation = trpc.quizMaker.deleteQuiz.useMutation();
  const utils = trpc.useUtils();
  const { loadQuiz } = useQuizStore();
  const [opening, setOpening] = useState<number | null>(null);

  const handleOpen = async (quiz: any) => {
    setOpening(quiz.id);
    try {
      // The questions are stored as JSON in the instructions field
      const questionsJson = quiz.instructions || "[]";
      const questions = JSON.parse(questionsJson);
      const quizFile = {
        meta: {
          id: crypto.randomUUID(),
          title: quiz.title,
          description: quiz.description || "",
          author: "",
          authorEmail: "",
          createdAt: quiz.createdAt?.toISOString?.() || new Date().toISOString(),
          updatedAt: quiz.updatedAt?.toISOString?.() || new Date().toISOString(),
          version: 1,
          licenseKey: null,
          teachificOrgId: orgId ?? null,
          tags: [],
          passingScore: quiz.passingScore || 70,
          timeLimit: quiz.timeLimit || null,
          shuffleQuestions: quiz.shuffleQuestions || false,
          shuffleAnswers: quiz.shuffleAnswers || false,
          showFeedback: "immediate" as const,
          allowRetry: true,
          maxAttempts: quiz.maxAttempts || 0,
          cloudId: quiz.id,
        },
        questions,
      };
      loadQuiz(quizFile as any, quiz.title + " (cloud)");
      onClose();
    } catch (err) {
      alert("Failed to open quiz: " + (err as Error).message);
    } finally {
      setOpening(null);
    }
  };

  const handleDelete = async (quizId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this quiz from the cloud? This cannot be undone.")) return;
    try {
      await deleteQuizMutation.mutateAsync({ quizId });
      utils.quizMaker.listQuizzes.invalidate();
    } catch (err) {
      alert("Failed to delete: " + (err as Error).message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[color:color-mix(in_srgb,var(--org-primary)_12%,transparent)]">
              <Cloud className="w-5 h-5 text-[var(--org-primary)]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">My Cloud Quizzes</h2>
              <p className="text-xs text-gray-500">Select a quiz to open in the editor</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="flex gap-1 border-b border-gray-100 px-4 pt-3">
          <button onClick={() => setActiveTab("creator")} className={`rounded-t-lg px-3 py-2 text-xs font-medium transition-colors ${activeTab === "creator" ? "bg-[color:color-mix(in_srgb,var(--org-primary)_10%,transparent)] text-[var(--org-primary)]" : "text-gray-500 hover:bg-gray-50"}`}>Quiz Creator</button>
          <button onClick={() => setActiveTab("lesson")} className={`rounded-t-lg px-3 py-2 text-xs font-medium transition-colors ${activeTab === "lesson" ? "bg-[color:color-mix(in_srgb,var(--org-primary)_10%,transparent)] text-[var(--org-primary)]" : "text-gray-500 hover:bg-gray-50"}`}>Course Lesson Quizzes</button>
          <button onClick={() => setActiveTab("results")} className={`rounded-t-lg px-3 py-2 text-xs font-medium transition-colors ${activeTab === "results" ? "bg-[color:color-mix(in_srgb,var(--org-primary)_10%,transparent)] text-[var(--org-primary)]" : "text-gray-500 hover:bg-gray-50"}`}>Results</button>
        </div>

        {/* Body */}
        <div className="p-4 max-h-96 overflow-y-auto">
          {activeTab === "creator" && (isLoading ? (
            <div className="text-center py-12 text-gray-400">Loading...</div>
          ) : !quizzes || quizzes.length === 0 ? (
            <div className="text-center py-12">
              <Cloud className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No cloud quizzes yet</p>
              <p className="text-gray-400 text-xs mt-1">Use File → Save to Cloud to save your first quiz</p>
            </div>
          ) : (
            <div className="space-y-2">
              {quizzes.map((q: any) => (
                <button
                  key={q.id}
                  onClick={() => handleOpen(q)}
                  disabled={opening === q.id}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-[color:color-mix(in_srgb,var(--org-primary)_40%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--org-primary)_6%,transparent)] transition-all text-left group disabled:opacity-50"
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-[color:color-mix(in_srgb,var(--org-primary)_12%,transparent)]">
                    <span className="text-sm font-bold text-[var(--org-primary)]">Q</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm truncate">{q.title}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Clock className="w-3 h-3 text-gray-300" />
                      <span className="text-xs text-gray-400">
                        {new Date(q.updatedAt).toLocaleDateString()}
                      </span>
                      {q.description && (
                        <span className="text-xs text-gray-400 truncate">— {q.description}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDelete(q.id, e)}
                    className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 transition-all"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </button>
              ))}
            </div>
          ))}
          {activeTab === "lesson" && (lessonQuizzesLoading ? (
            <div className="text-center py-12 text-gray-400">Loading course quizzes...</div>
          ) : !lessonQuizzes || lessonQuizzes.length === 0 ? (
            <div className="text-center py-12">
              <Cloud className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No lesson quizzes in this organization yet</p>
              <p className="text-gray-400 text-xs mt-1">Create a quiz lesson within a course to manage it here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {lessonQuizzes.map((quiz: any) => (
                <button
                  key={quiz.id}
                  onClick={() => { onClose(); navigate(`/lms/courses/${quiz.courseId}/curriculum`); }}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-[color:color-mix(in_srgb,var(--org-primary)_40%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--org-primary)_6%,transparent)] transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-[color:color-mix(in_srgb,var(--org-primary)_12%,transparent)]">
                    <span className="text-sm font-bold text-[var(--org-primary)]">L</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm truncate">{quiz.title}</h3>
                    <p className="mt-0.5 text-xs text-gray-400 truncate">{quiz.courseTitle} · Passing score {quiz.passingScore}%</p>
                  </div>
                </button>
              ))}
            </div>
          ))}
          {activeTab === "results" && (resultsLoading ? (
            <div className="text-center py-12 text-gray-400">Loading results...</div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <select value={resultQuizId} onChange={(event) => setResultQuizId(event.target.value)} className="h-9 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700">
                  <option value="all">All Quiz Creator quizzes</option>
                  {quizzes?.map((quiz: any) => <option key={quiz.id} value={quiz.id}>{quiz.title}</option>)}
                </select>
                <select value={resultQuizType} onChange={(event) => setResultQuizType(event.target.value)} className="h-9 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700">
                  <option value="all">All types</option>
                  <option value="assessment">Assessment</option>
                  <option value="practice">Practice</option>
                  <option value="survey">Survey</option>
                  <option value="exam">Exam</option>
                </select>
                <input value={resultEmail} onChange={(event) => setResultEmail(event.target.value)} type="email" placeholder="Filter by learner email" className="h-9 rounded-md border border-gray-200 px-2 text-xs text-gray-700" />
              </div>
              {!resultData || resultData.results.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-500">No matching completed quiz attempts.</div>
              ) : (
                <div className="space-y-2">
                  {resultData.results.map((result: any) => (
                    <div key={result.id} className="flex items-center gap-3 rounded-xl border border-gray-100 p-3">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${result.passed ? "bg-[color:color-mix(in_srgb,var(--org-primary)_10%,transparent)] text-[var(--org-primary)]" : "bg-amber-50 text-amber-700"}`}>{Math.round(result.scorePercent)}%</div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-900">{result.quizTitle}</p>
                        <p className="truncate text-xs text-gray-400">{result.learnerEmail || "Guest learner"} · {result.passed ? "Passed" : "Not passed"}</p>
                      </div>
                      <span className="text-xs text-gray-400">{result.completedAt ? new Date(result.completedAt).toLocaleDateString() : "In progress"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
