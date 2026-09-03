import { Image as ImageIcon, Layers3, Plus } from "lucide-react";
import { useQuizStore } from "../store/quizStore";
import { QuestionEditor } from "./QuestionEditor";
import { Button } from "@/components/ui/button";

/**
 * Course360's iSpring-style visual workspace. It presents each question as a
 * slide card while reusing the standard QuestionEditor for full authoring.
 */
export function SlideViewEditor() {
  const { quiz, activeQuestionId, setActiveQuestion, addQuestion } = useQuizStore();
  const activeQuestion = quiz.questions.find((question) => question.id === activeQuestionId);

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-slate-100/70">
      <section className="shrink-0 border-b bg-white px-5 py-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Layers3 className="h-4 w-4 text-primary" /> Slide storyboard
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">Choose a slide to edit its question, media, feedback, and branching rules.</p>
          </div>
          <Button size="sm" onClick={() => addQuestion("mcq")}>
            <Plus className="mr-1 h-4 w-4" /> Add slide
          </Button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {quiz.questions.length === 0 ? (
            <button
              type="button"
              onClick={() => addQuestion("mcq")}
              className="flex h-32 w-48 shrink-0 flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 text-sm font-medium text-primary transition hover:bg-primary/10"
            >
              <Plus className="mb-1 h-5 w-5" /> Create first slide
            </button>
          ) : quiz.questions.map((question) => {
            const selected = question.id === activeQuestionId;
            return (
              <button
                key={question.id}
                type="button"
                onClick={() => setActiveQuestion(question.id)}
                className={`relative h-32 w-48 shrink-0 overflow-hidden rounded-xl border text-left transition ${selected ? "border-primary ring-2 ring-primary/25" : "border-slate-200 hover:border-primary/50"}`}
              >
                {question.image?.url ? (
                  <img src={question.image.url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-white to-slate-100" />
                )}
                <div className="relative flex h-full flex-col p-3">
                  <span className="mb-2 text-[10px] font-bold uppercase tracking-wider text-primary">Slide {question.order}</span>
                  <span className="line-clamp-3 text-sm font-medium text-slate-800">{question.stem || "Untitled question"}</span>
                  <span className="mt-auto flex items-center gap-1 text-[11px] text-slate-500">
                    <ImageIcon className="h-3 w-3" /> {question.type.replace(/_/g, " ")}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>
      <section className="min-h-0 flex-1 overflow-y-auto bg-white">
        {activeQuestion ? <QuestionEditor /> : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Select a slide to begin editing.</div>}
      </section>
    </main>
  );
}
