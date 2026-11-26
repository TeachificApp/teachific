import React, { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import type { getNativeQuizReviewAttempt, listNativeQuizReviewAttempts, mutateNativeQuizReview } from "../../../../server/lib/course360NativeQuizReviewRuntime";
type Detail = Awaited<ReturnType<typeof getNativeQuizReviewAttempt>>;
type Queue = Awaited<ReturnType<typeof listNativeQuizReviewAttempts>>;
type MutationInput = Parameters<typeof mutateNativeQuizReview>[1];
type PendingOperation = { action: "grade" | "release"; input: MutationInput };
export type Course360NativeQuizReviewPanelProps = { orgId: number; quizId?: number };
const opId = () => globalThis.crypto.randomUUID().replaceAll("-", "_");
/** Mount in the Quiz author shell with its server-resolved orgId. Props are consistency hints, not authority. */
export function Course360NativeQuizReviewPanel(props: Course360NativeQuizReviewPanelProps) {
  return <ReviewPanel key={`${props.orgId}:${props.quizId ?? "all"}`} {...props} />;
}
function ReviewPanel({ orgId, quizId }: Course360NativeQuizReviewPanelProps) {
  const list = trpc.quiz.listNativeQuizReviewAttempts.useMutation();
  const get = trpc.quiz.getNativeQuizReviewAttempt.useMutation();
  const grade = trpc.quiz.gradeNativeQuizReviewQuestion.useMutation();
  const release = trpc.quiz.releaseNativeQuizReviewAttempt.useMutation();
  const [open, setOpen] = useState(false), [queue, setQueue] = useState<Queue | null>(null), [detail, setDetail] = useState<Detail | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { points: string; feedback: string }>>({});
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [confirm, setConfirm] = useState(false);
  const [retry, setRetry] = useState<PendingOperation | null>(null);
  const alive = useRef(true), serial = useRef(0), lock = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; serial.current++; }; }, []);
  const scope = { orgId, ...(quizId === undefined ? {} : { quizId }) };
  function showDetail(value: Detail) {
    setDetail(value); setConfirm(false);
    setDrafts(Object.fromEntries(value.questions.map(q => [q.id, { points: q.review == null ? "" : String(q.review.points), feedback: q.review?.feedback ?? "" }])));
  }
  async function request(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try { await action(); } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : "Review request failed. Reload or retry your saved request."); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  function loadQueue(cursor?: number) {
    if (lock.current) return;
    const token = ++serial.current;
    void request(async () => {
      const value = await list.mutateAsync({ ...scope, limit: 50, ...(cursor === undefined ? {} : { cursor }) });
      if (alive.current && token === serial.current) setQueue(previous => cursor === undefined || previous === null ? value : { ...value, items: [...previous.items, ...value.items] });
    });
  }
  function loadDetail(attemptId: number) {
    if (lock.current) return;
    const token = ++serial.current;
    void request(async () => {
      const value = await get.mutateAsync({ ...scope, attemptId });
      if (alive.current && token === serial.current) { showDetail(value); setRetry(null); }
    });
  }
  function perform(operation: PendingOperation) {
    if (lock.current) return;
    const token = ++serial.current;
    setRetry(operation);
    void request(async () => {
      const value = operation.action === "grade" ? await grade.mutateAsync(operation.input as MutationInput & { questionId: string; points: number; feedback: string }) : await release.mutateAsync(operation.input);
      if (!alive.current || token !== serial.current) return;
      setDetail(value); setRetry(null); setConfirm(false);
      // Retain unrelated unsaved question drafts; use the server grade for the saved question only.
      if (operation.action === "grade") {
        const saved = value.questions.find(q => q.id === operation.input.questionId)?.review;
        if (saved) setDrafts(previous => ({ ...previous, [operation.input.questionId!]: { points: String(saved.points), feedback: saved.feedback } }));
      }
      setQueue(previous => previous ? { ...previous, items: value.releasedAt ? previous.items.filter(item => item.attemptId !== value.attemptId) : previous.items.map(item => item.attemptId === value.attemptId ? { ...item, reviewRevision: value.reviewRevision, reviewedQuestionCount: value.questions.filter(q => q.review !== null).length, readyToRelease: value.readyToRelease } : item) } : previous);
    });
  }
  function saveQuestion(id: string, max: number) {
    if (!detail) return;
    const draft = drafts[id], points = Number(draft?.points);
    if (!draft || draft.points.trim() === "" || !Number.isFinite(points) || points < 0 || points > max) { setError(`Enter points between 0 and ${max} for this question.`); return; }
    perform({ action: "grade", input: { ...scope, attemptId: detail.attemptId, expectedReviewRevision: detail.reviewRevision, operationId: opId(), questionId: id, points, feedback: draft.feedback } });
  }
  function close() { serial.current++; setOpen(false); }
  return <>
    <Button variant="outline" onClick={() => { setOpen(true); if (!queue) loadQueue(); }}>Review enrolled quizzes</Button>
    {open && <section role="dialog" aria-modal="true" aria-label="Native enrolled quiz review" className="fixed inset-4 z-50 overflow-auto rounded-xl border bg-background p-6 text-foreground shadow-xl md:inset-x-[10%]">
      <div className="flex items-center justify-between gap-4"><div><h2 className="text-xl font-semibold">Instructor review</h2><p className="text-sm text-muted-foreground">School-owned enrolled native attempts only. Grading does not release a result.</p></div><Button variant="outline" onClick={close}>Close review</Button></div>
      {error && <p role="alert" className="my-3 text-destructive">{error}</p>}
      {busy && <p role="status">Loading or saving review…</p>}
      <div className="my-4 flex gap-2"><Button variant="outline" disabled={busy} onClick={() => loadQueue()}>Refresh queue</Button>{detail && <Button variant="outline" disabled={busy} onClick={() => loadDetail(detail.attemptId)}>Reload saved review</Button>}{retry && <Button variant="outline" disabled={busy} onClick={() => perform(retry)}>Retry exact request</Button>}</div>
      <div className="grid gap-6 md:grid-cols-[minmax(220px,1fr)_2fr]">
        <aside aria-label="Pending attempts">
          <h3 className="mb-2 font-semibold">Awaiting review or release</h3>
          {queue && queue.items.length === 0 && <p>No pending attempts in this page of the queue.</p>}
          <ul className="space-y-2">{queue?.items.map(item => <li key={item.attemptId}><Button variant="outline" className="h-auto w-full justify-start whitespace-normal text-left" disabled={busy} onClick={() => loadDetail(item.attemptId)}><span>{item.quizTitle} — learner #{item.learnerId}<br />{item.courseTitle} · attempt #{item.attemptId}<br />{item.reviewedQuestionCount}/{item.manualQuestionCount} reviewed{item.readyToRelease ? " · Ready to release" : ""}</span></Button></li>)}</ul>
          {queue?.nextCursor != null && <Button variant="outline" disabled={busy} onClick={() => loadQueue(queue.nextCursor!)}>Load more attempts</Button>}
        </aside>
        <main aria-label="Attempt review">
          {!detail && <p>Select an attempt to inspect its frozen questions and learner answers.</p>}
          {detail && <>
            <h3 className="font-semibold">{detail.quizTitle} — attempt #{detail.attemptId}</h3>
            <p className="text-sm">Review revision {detail.reviewRevision} · {detail.releasedAt ? "Result explicitly released" : "Awaiting instructor review / explicit release"}</p>
            {detail.questions.map(q => <fieldset key={q.id} disabled={busy || !!detail.releasedAt} className="my-4 rounded-lg border p-4">
              <legend className="px-2 font-medium">{String(q.stem)}</legend>
              <p>Maximum points: {q.maxPoints}</p>
              {q.rubric != null && <p className="whitespace-pre-wrap">Frozen rubric: {typeof q.rubric === "string" ? q.rubric : JSON.stringify(q.rubric)}</p>}
              {q.sampleAnswer != null && <p className="whitespace-pre-wrap">Frozen model answer: {typeof q.sampleAnswer === "string" ? q.sampleAnswer : JSON.stringify(q.sampleAnswer)}</p>}
              <p className="mt-2 font-medium">Learner answer</p><pre className="whitespace-pre-wrap break-words rounded bg-muted p-3">{typeof q.answer === "string" ? q.answer : JSON.stringify(q.answer)}</pre>
              <label className="mt-3 block">Points for {q.id}<input aria-label={`Points for ${q.id}`} className="ml-2 w-24 rounded border bg-background p-2" type="number" min="0" max={q.maxPoints} step="any" value={drafts[q.id]?.points ?? ""} onChange={e => setDrafts(previous => ({ ...previous, [q.id]: { ...previous[q.id], points: e.target.value } }))} /></label>
              <label className="mt-3 block">Feedback for {q.id}<textarea aria-label={`Feedback for ${q.id}`} maxLength={4000} className="block w-full rounded border bg-background p-2" value={drafts[q.id]?.feedback ?? ""} onChange={e => setDrafts(previous => ({ ...previous, [q.id]: { ...previous[q.id], feedback: e.target.value } }))} /></label>
              <p className="my-2 text-sm">{q.review ? `Saved ${q.review.points} points by reviewer #${q.review.reviewer.userId}` : "Not yet reviewed"}</p>
              <Button disabled={busy || !!detail.releasedAt} onClick={() => saveQuestion(q.id, q.maxPoints)}>Save grade for {q.id}</Button>
            </fieldset>)}
            {detail.draftResult && !detail.releasedAt && <p>Server draft: {detail.draftResult.earnedPoints} / {detail.draftResult.totalPoints} points ({detail.draftResult.scorePercent}%). {detail.draftResult.passed ? "Passing" : "Not passing"} — still not released.</p>}
            {detail.releasedResult && <p role="status">Released result: {detail.releasedResult.earnedPoints} / {detail.releasedResult.totalPoints} points ({detail.releasedResult.scorePercent}%). {detail.releasedResult.passed ? "Passed" : "Not passed"}. Learner completion remains a separate action.</p>}
            {!detail.releasedAt && <div className="mt-4 rounded-lg border p-4"><label><input type="checkbox" checked={confirm} disabled={busy || !detail.readyToRelease} onChange={e => setConfirm(e.target.checked)} /> I have reviewed the saved grades and want to release this final result.</label><Button className="mt-3 block" disabled={busy || !confirm || !detail.readyToRelease} onClick={() => perform({ action: "release", input: { ...scope, attemptId: detail.attemptId, expectedReviewRevision: detail.reviewRevision, operationId: opId() } })}>Release final result</Button></div>}
            <details className="mt-4"><summary>Review audit ({detail.audit.length})</summary><ul>{detail.audit.map((entry: any) => <li key={entry.operationId}>Revision {entry.revision}: {entry.action} by reviewer #{entry.reviewer.userId} in school #{entry.reviewer.orgId} at {new Date(entry.at).toLocaleString()}</li>)}</ul></details>
          </>}
        </main>
      </div>
    </section>}
  </>;
}
