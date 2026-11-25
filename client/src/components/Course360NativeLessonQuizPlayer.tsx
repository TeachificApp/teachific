import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Clock, Loader2, Trophy } from "lucide-react";
import { Course360NativeLessonQuizControls } from "./Course360NativeLessonQuizControls";
import { filterVisibleDependentQuestions } from "@shared/quizQuestionDependency";

type Props = { quizId: number; sourceLessonId?: number; courseSlug?: string; authorPreview?: boolean; showHeader?: boolean; onComplete?: (score: number, passed: boolean) => void; quizInfo: any };
export default function Course360NativeLessonQuizPlayer({ quizId, sourceLessonId, courseSlug, authorPreview = false, showHeader = true, onComplete, quizInfo }: Props) {
  const input = useMemo(() => ({ quizId, sourceLessonId: sourceLessonId!, courseSlug: courseSlug!, authorPreview }), [quizId, sourceLessonId, courseSlug, authorPreview]);
  const latest = trpc.quiz.getNativeCourseAttempt.useQuery({ ...input, attemptId: quizInfo.latestAttemptId ?? 1 }, { enabled: !!quizInfo.latestAttemptId && !!courseSlug && !!sourceLessonId, retry: false });
  const start = trpc.quiz.startNativeCourseAttempt.useMutation();
  const save = trpc.quiz.saveNativeCourseAnswers.useMutation();
  const submit = trpc.quiz.submitNativeCourseAttempt.useMutation();
  const [attempt, setAttempt] = useState<any>(null), [answers, setAnswers] = useState<Record<string, any>>({}), [index, setIndex] = useState(0), [result, setResult] = useState<any>(null), [error, setError] = useState<string | null>(null), [remaining, setRemaining] = useState<number | null>(null), [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  const revision = useRef(0), submitting = useRef(false), answerRef = useRef(answers), savedRef = useRef("{}"), queue = useRef<Promise<any>>(Promise.resolve()), lastNotified = useRef<number | null>(null), activeAttempt = useRef<number | null>(null);
  const isSubmitted = !!result || !!attempt?.result;
  const visible = useMemo(() => filterVisibleDependentQuestions(attempt?.questions ?? [], answers), [attempt?.questions, answers]);
  const question = visible[index];
  const persist = useCallback((current: Record<string, any>) => {
    const frozen = JSON.parse(JSON.stringify(current)), serial = JSON.stringify(frozen), id = activeAttempt.current;
    const task = queue.current.then(async () => {
      if (!id || activeAttempt.current !== id || savedRef.current === serial) return;
      const response = await save.mutateAsync({ ...input, attemptId: id, answers: frozen, expectedAnswerRevision: revision.current });
      revision.current = response.answerRevision; savedRef.current = serial;
    });
    queue.current = task.catch(() => {}); return task;
  }, [input, save.mutateAsync]);
  useEffect(() => {
    if (!attempt || isSubmitted || submitting.current || remaining === 0) return;
    const timer = setTimeout(() => { void persist(answers).catch((e: any) => setError(e.message ?? "Unable to save answers.")); }, 600);
    return () => clearTimeout(timer);
  }, [answers, attempt, isSubmitted, persist, remaining]);
  useEffect(() => {
    if (!attempt?.deadlineAt || isSubmitted) { setRemaining(null); return; }
    const tick = () => setRemaining(Math.max(0, Math.ceil((attempt.deadlineAt - Date.now()) / 1000)));
    tick(); const timer = setInterval(tick, 1000); return () => clearInterval(timer);
  }, [attempt?.deadlineAt, isSubmitted]);
  useEffect(() => { if (index >= visible.length && visible.length) setIndex(visible.length - 1); }, [visible.length, index]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; activeAttempt.current = null; }; }, []);
  const acceptStart = (response: any) => {
    if (!mounted.current) return;
    activeAttempt.current = response.attemptId; setAttempt(response); setAnswers(response.answers); answerRef.current = response.answers; revision.current = response.answerRevision; savedRef.current = JSON.stringify(response.answers); setResult(response.result); setIndex(0); setError(null);
  };
  const startAttempt = async () => { setError(null); try { acceptStart(await start.mutateAsync(input)); } catch (e: any) { setError(e.message ?? "Unable to start quiz."); } };
  const finish = async (savedOnly = false) => {
    if (!attempt || submitting.current || isSubmitted) return;
    submitting.current = true; setBusy(true); setError(null);
    try {
      if (!savedOnly) await persist(answerRef.current);
      else await queue.current;
      const response = await submit.mutateAsync({ ...input, attemptId: attempt.attemptId, answers: savedOnly ? {} : answerRef.current, expectedAnswerRevision: revision.current, submitSavedOnly: savedOnly });
      if (!mounted.current || activeAttempt.current !== attempt.attemptId) return;
      setResult(response);
      // Author/lesson previews and pending manual grades never advance learner completion.
      if (response.canCompleteLesson && response.gradingStatus === "graded" && !authorPreview && lastNotified.current !== response.attemptId) { lastNotified.current = response.attemptId; onComplete?.(response.score, response.passed); }
    } catch (e: any) { setError(e.message ?? "Unable to submit quiz."); } finally { submitting.current = false; setBusy(false); }
  };
  const updateAnswer = (value: any) => { const next = { ...answerRef.current, [question.id]: value }; answerRef.current = next; setAnswers(next); };
  const changeQuestion = async (next: number) => { setBusy(true); try { await persist(answerRef.current); setIndex(next); setError(null); } catch (e: any) { setError(e.message); } finally { setBusy(false); } };
  const header = showHeader && <div className="bg-[var(--org-primary)] px-5 py-4"><div className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-white/80" /><h3 className="text-base font-semibold text-white">{quizInfo.title}</h3><Badge variant="secondary" className="ml-auto border-0 bg-white/20 text-xs text-white">{quizInfo.type === "mock_exam" ? "Mock Exam" : "Quiz"}</Badge></div></div>;
  const errorBlock = error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>;
  if (!courseSlug || !sourceLessonId) return <p className="text-sm text-gray-500">Open this native quiz from its assigned course lesson.</p>;
  if (!attempt) return <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">{header}<div className="px-5 py-5">{errorBlock}{latest.error && <p role="alert" className="mb-3 text-sm text-red-700">{latest.error.message}</p>}{quizInfo.description && <p className="mb-4 text-sm text-gray-600">{quizInfo.description}</p>}<div className="mb-5 flex flex-wrap gap-4 text-sm text-gray-600"><span>{quizInfo.questionCount} questions</span>{quizInfo.timeLimitMinutes && <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{quizInfo.timeLimitMinutes} min limit</span>}<span className="flex items-center gap-1.5"><Trophy className="h-3.5 w-3.5" />Pass at {quizInfo.passingScore}%</span></div>{quizInfo.latestAttemptId && <Button variant="outline" className="mb-4 mr-3" onClick={() => { if (latest.data) acceptStart(latest.data); }} disabled={!latest.data}>View latest result</Button>}{quizInfo.canAttempt ? <Button onClick={startAttempt} disabled={start.isPending} className="bg-[var(--org-primary)] text-white">{start.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{quizInfo.attemptCount ? "Resume / Retake Quiz" : "Start Quiz"}</Button> : <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">{quizInfo.awaitingReview ? "Awaiting instructor review." : "You have reached the maximum number of attempts for this quiz."}</p>}</div></div>;
  if (result) return <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">{header}<div className="px-5 py-5">{errorBlock}{result.gradingStatus === "pending_manual" ? <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-4"><h4 className="font-semibold text-amber-800">Awaiting instructor review</h4><p className="mt-1 text-sm text-amber-700">Your answers are saved. This quiz is not complete and cannot award course completion or a certificate until review is released.</p><p className="mt-2 text-sm text-amber-700">Automatically graded points so far: {result.earnedPoints} / {result.totalPoints}</p></div> : <><h4 className="mb-3 font-semibold">{result.passed ? "Quiz Passed!" : "Quiz Complete"}</h4><p className="mb-2 text-3xl font-bold text-[var(--org-primary)]">{result.score}%</p><Progress value={result.score} /><p className="mt-3 text-sm text-gray-600">{result.earnedPoints} / {result.totalPoints} points · {result.correctAnswers}/{result.totalQuestions} correct</p>{!result.canCompleteLesson && (authorPreview || attempt.result) && <p className="mt-3 text-xs text-gray-500">Saved result; preview attempts do not advance course completion.</p>}{quizInfo.allowRetakes && <Button className="mt-4" variant="outline" onClick={startAttempt} disabled={start.isPending}>Retake Quiz</Button>}</>}</div></div>;
  return <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">{header}<div className="px-5 py-5">{errorBlock}<div className="mb-4 flex items-center justify-between text-xs text-gray-500"><span>Question {index + 1} of {visible.length}</span>{remaining !== null && <span role="timer">{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</span>}</div>{remaining === 0 && <p role="status" className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Time expired. Submit your server-saved answers; new answers are no longer accepted.</p>}{question && <Course360NativeLessonQuizControls question={question} answer={answers[String(question.id)]} onAnswer={updateAnswer} disabled={busy || remaining === 0} />}<div className="mt-5 flex flex-wrap justify-between gap-2"><Button variant="outline" size="sm" onClick={() => changeQuestion(index - 1)} disabled={index === 0 || busy || remaining === 0}>Prev</Button><div className="flex gap-2">{index < visible.length - 1 && <Button size="sm" onClick={() => changeQuestion(index + 1)} disabled={busy || remaining === 0}>Save & Next</Button>}<Button size="sm" className="bg-[var(--org-primary)] text-white" onClick={() => finish(remaining === 0)} disabled={busy || submit.isPending}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{remaining === 0 ? "Submit saved answers" : quizInfo.type === "mock_exam" ? "Submit exam" : "Finish Quiz"}</Button></div></div><p className="mt-3 text-xs text-gray-500">Answers save while you work. Grading is performed securely when you submit.</p></div></div>;
}
