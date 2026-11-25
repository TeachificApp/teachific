import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useOrgScope } from "@/hooks/useOrgScope";
import { useQuizStore } from "../store/quizStore";
import { listQuizDrafts, retainQuizDraft, type QuizDraftRecord } from "../lib/quizDraftJournalRuntime";
export function QuizDraftRecoveryRuntime() {
  const { user } = useAuth(), { orgId } = useOrgScope(), { quiz, isDirty, loadQuiz } = useQuizStore();
  const [drafts, setDrafts] = useState<QuizDraftRecord[]>([]), [open, setOpen] = useState(false), [error, setError] = useState("");
  const scope = user?.id && orgId ? `user-${user.id}:school-${orgId}` : "";
  useEffect(() => { if (!scope) { setDrafts([]); return; } listQuizDrafts(scope).then(setDrafts).catch(() => setError("Local draft recovery unavailable")); }, [scope, open]);
  useEffect(() => { if (!scope || !isDirty) return; const timer = setTimeout(() => { retainQuizDraft(scope, quiz).then(() => setError("")).catch(() => setError("Draft could not be retained; use Save as .quiz")); }, 500); return () => { clearTimeout(timer); void retainQuizDraft(scope, quiz).catch(() => {}); }; }, [scope, quiz, isDirty]);
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (!useQuizStore.getState().isDirty) return; event.preventDefault(); event.returnValue = ""; }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, []);
  return <div className="border-b bg-background px-4 py-1 text-xs"><button type="button" className="text-teal-700 underline" onClick={() => setOpen(!open)}>Recover local draft</button><span className="ml-3 text-muted-foreground">{error || (isDirty ? "Edits retained locally; cloud save remains manual." : "Manual file and cloud saves remain available.")}</span>{open && <div className="py-2">{drafts.length === 0 ? <p>No drafts for this signed-in account and selected school.</p> : drafts.map(draft => <button type="button" key={draft.key} className="mr-2 rounded border p-2" onClick={() => { if (isDirty && !confirm("Replace this workspace with the retained draft? Current dirty edits are also retained.")) return; if (scope && isDirty) void retainQuizDraft(scope, quiz); loadQuiz(draft.quiz, "Recovered draft"); useQuizStore.setState({ isDirty: true }); setOpen(false); }}>{draft.quiz.meta.title} · {new Date(draft.savedAt).toLocaleString()}</button>)}</div>}</div>;
}
