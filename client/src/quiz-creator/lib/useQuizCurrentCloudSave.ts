import { useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useQuizStore } from "../store/quizStore";

/** Capture actual current state, never a stale rendered quiz. Never mark later edits saved. */
export function useQuizCurrentCloudSave() {
  const mutation = trpc.quizMaker.saveQuiz.useMutation(), utils = trpc.useUtils(), inflight = useRef<Promise<number> | null>(null);
  const saveCurrent = async (): Promise<number> => {
    if (inflight.current) return inflight.current;
    const work = async () => {
      const state = useQuizStore.getState(), snapshot = JSON.parse(JSON.stringify(state.quiz)), signature = JSON.stringify(state.quiz);
      const result = await mutation.mutateAsync({ quizId: snapshot.meta.cloudId || undefined, title: snapshot.meta.title, description: snapshot.meta.description || "", questionsJson: JSON.stringify(snapshot.questions), settingsJson: JSON.stringify(snapshot.meta), expectedRevision: snapshot.meta.nativeRevision });
      const current = useQuizStore.getState();
      if (current.quiz.meta.id !== snapshot.meta.id) throw new Error("The workspace changed while saving. Reopen this quiz before exporting.");
      const unchanged = JSON.stringify(current.quiz) === signature;
      useQuizStore.setState({ quiz: { ...current.quiz, meta: { ...current.quiz.meta, cloudId: result.id, nativeRevision: result.revision } } as any, isDirty: !unchanged });
      await utils.quizMaker.listQuizzes.invalidate();
      if (!unchanged) throw new Error("New edits were made while saving. They are retained; save again before export or publish.");
      useQuizStore.getState().markSaved(snapshot.meta.title + " (cloud)");
      return result.id;
    };
    inflight.current = work();
    try { return await inflight.current; } finally { inflight.current = null; }
  };
  return { saveCurrent, isSaving: mutation.isPending };
}
