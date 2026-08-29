import { useMemo, useState } from "react";
import { useQuizStore } from "../store/quizStore";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { QuizQuestion, QuestionType } from "../types/quiz";
import { GripVertical, Plus, CheckSquare, ToggleLeft, Shuffle, MapPin, AlignLeft, MessageSquare, Image, ArrowDownUp, Move, Type, ChevronDown, Hash, BarChart3, FileText, Replace, Search, X } from "lucide-react";
import { trpc } from "@/lib/trpc";

const TYPE_ICONS: Record<QuestionType, React.ReactNode> = {
  mcq: <CheckSquare className="w-3.5 h-3.5" />,
  tf: <ToggleLeft className="w-3.5 h-3.5" />,
  matching: <Shuffle className="w-3.5 h-3.5" />,
  hotspot: <MapPin className="w-3.5 h-3.5" />,
  fill_blank: <AlignLeft className="w-3.5 h-3.5" />,
  short_answer: <MessageSquare className="w-3.5 h-3.5" />,
  image_choice: <Image className="w-3.5 h-3.5" />,
  ordering: <ArrowDownUp className="w-3.5 h-3.5" />,
  drag_drop: <Move className="w-3.5 h-3.5" />,
  drag_words: <Type className="w-3.5 h-3.5" />,
  dropdown: <ChevronDown className="w-3.5 h-3.5" />,
  numeric: <Hash className="w-3.5 h-3.5" />,
  likert: <BarChart3 className="w-3.5 h-3.5" />,
  essay: <FileText className="w-3.5 h-3.5" />,
};

const TYPE_LABELS: Record<QuestionType, string> = {
  mcq: "Multiple Choice",
  tf: "True / False",
  matching: "Matching",
  hotspot: "Hotspot",
  fill_blank: "Fill in the Blank",
  short_answer: "Short Answer",
  image_choice: "Image Choice",
  ordering: "Sequence / Ordering",
  drag_drop: "Drag & Drop",
  drag_words: "Drag the Words",
  dropdown: "Select from Lists",
  numeric: "Numeric",
  likert: "Likert Scale",
  essay: "Essay",
};

const QUESTION_TYPES: QuestionType[] = [
  "mcq", "tf", "matching", "ordering", "fill_blank", "drag_words", "dropdown",
  "hotspot", "drag_drop", "image_choice", "short_answer", "numeric", "likert", "essay",
];

function SortableQuestionItem({ question, isActive, onClick, groupColor }: { question: QuizQuestion; isActive: boolean; onClick: () => void; groupColor?: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: question.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all group ${
        isActive ? "bg-teal-500/10 border border-teal-400/30" : "hover:bg-gray-50 border border-transparent"
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="p-0.5 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>
      {/* Group color dot */}
      {groupColor && (
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-white shadow-sm"
          style={{ backgroundColor: groupColor }}
          title="Group indicator"
        />
      )}
      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
        isActive ? "bg-teal-500 text-white" : "bg-gray-100 text-gray-500"
      }`}>
        {question.order}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className={`${isActive ? "text-teal-600" : "text-gray-400"}`}>
            {TYPE_ICONS[question.type]}
          </span>
          <span className="text-xs text-gray-400">{TYPE_LABELS[question.type]}</span>
        </div>
        <p className="text-sm text-gray-700 truncate">
          {question.stem || <span className="text-gray-400 italic">Untitled question</span>}
        </p>
      </div>
      <span className="text-xs text-gray-400 shrink-0">{question.points}pt</span>
    </div>
  );
}

export function QuestionList() {
  const { quiz, activeQuestionId, setActiveQuestion, addQuestion, reorderQuestions, loadQuiz } = useQuizStore();
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [search, setSearch] = useState("");
  const [showReplace, setShowReplace] = useState(false);
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const findAndReplace = trpc.quizMaker.findAndReplaceText.useMutation({
    onSuccess: (result) => {
      loadQuiz({ ...quiz, questions: result.questions as QuizQuestion[] }, quiz.meta.title);
      setFindText("");
      setReplaceText("");
      setSearch("");
      window.alert(result.replacementCount > 0
        ? `${result.replacementCount} replacement${result.replacementCount === 1 ? "" : "s"} applied to this quiz.`
        : "No exact matches were found in this quiz.");
    },
    onError: (error) => window.alert(error.message),
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = quiz.questions.findIndex((q) => q.id === active.id);
    const newIndex = quiz.questions.findIndex((q) => q.id === over.id);
    reorderQuestions(oldIndex, newIndex);
  };

  const totalPoints = quiz.questions.reduce((sum, q) => sum + q.points, 0);
  const normalizedSearch = search.trim().toLowerCase();
  const filteredQuestions = useMemo(() => normalizedSearch
    ? quiz.questions.filter((question) => JSON.stringify({
      stem: question.stem,
      stemHtml: question.stemHtml,
      explanation: question.explanation,
      explanationHtml: question.explanationHtml,
      feedback: question.feedback,
      data: question.data,
    }).toLowerCase().includes(normalizedSearch))
    : quiz.questions, [quiz.questions, normalizedSearch]);

  const handleFindAndReplace = () => {
    const quizId = Number((quiz.meta as { cloudId?: number }).cloudId);
    if (!quizId) {
      window.alert("Save this quiz to Teachific before using find and replace.");
      return;
    }
    if (!findText.trim()) {
      window.alert("Enter the exact word or phrase to find.");
      return;
    }
    if (!window.confirm(`Replace every exact occurrence of “${findText}” with “${replaceText}” in this saved quiz? This cannot be undone automatically.`)) return;
    findAndReplace.mutate({ quizId, find: findText, replace: replaceText });
  };

  return (
    <div className="w-72 shrink-0 border-r border-gray-100 flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">
            Questions <span className="text-gray-400 font-normal">({quiz.questions.length})</span>
          </span>
          <span className="text-xs text-gray-400">{totalPoints} pts total</span>
        </div>
        <div className="mt-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search question text"
              className="h-8 w-full rounded-lg border border-gray-200 bg-white pl-8 pr-8 text-xs text-gray-800 outline-none focus:border-[var(--org-primary)] focus:ring-1 focus:ring-[var(--org-primary)]"
            />
            {search && <button type="button" onClick={() => setSearch("")} aria-label="Clear question search" className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"><X className="h-3.5 w-3.5" /></button>}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[11px] text-gray-500">{normalizedSearch ? `${filteredQuestions.length} matching` : "Search saved question content"}</span>
            <button type="button" onClick={() => setShowReplace((current) => !current)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--org-primary)] hover:brightness-75">
              <Replace className="h-3.5 w-3.5" /> Find &amp; replace
            </button>
          </div>
          {showReplace && (
            <div className="mt-2 space-y-2 rounded-lg border border-[color:color-mix(in_srgb,var(--org-primary)_28%,transparent)] bg-[color:color-mix(in_srgb,var(--org-primary)_9%,transparent)] p-2.5">
              <input value={findText} onChange={(event) => setFindText(event.target.value)} placeholder="Find exact word or phrase" className="h-8 w-full rounded border border-[color:color-mix(in_srgb,var(--org-primary)_32%,transparent)] bg-white px-2 text-xs text-gray-900 outline-none focus:ring-1 focus:ring-[var(--org-primary)]" />
              <input value={replaceText} onChange={(event) => setReplaceText(event.target.value)} placeholder="Replace with" className="h-8 w-full rounded border border-[color:color-mix(in_srgb,var(--org-primary)_32%,transparent)] bg-white px-2 text-xs text-gray-900 outline-none focus:ring-1 focus:ring-[var(--org-primary)]" />
              <p className="text-[11px] leading-relaxed text-gray-600">Changes are applied only to this saved quiz. Question Bank records remain unchanged.</p>
              <button type="button" disabled={!findText.trim() || findAndReplace.isPending} onClick={handleFindAndReplace} className="org-primary-button w-full rounded px-2 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50">
                {findAndReplace.isPending ? "Replacing…" : "Replace in this quiz"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Question list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {quiz.questions.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-3xl mb-2">📋</div>
            <p className="text-sm">No questions yet</p>
            <p className="text-xs mt-1">Click "Add Question" to start</p>
          </div>
        ) : normalizedSearch && filteredQuestions.length === 0 ? (
          <div className="px-4 py-12 text-center text-xs text-gray-500">No saved question content matches this search.</div>
        ) : normalizedSearch ? (
          <div className="space-y-1">
            {filteredQuestions.map((q) => {
              const group = q.groupId ? (quiz.meta.groups || []).find((item) => item.id === q.groupId) : undefined;
              return <SortableQuestionItem key={q.id} question={q} isActive={q.id === activeQuestionId} onClick={() => setActiveQuestion(q.id)} groupColor={group?.color} />;
            })}
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={quiz.questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
              {quiz.questions.map((q) => {
                const group = q.groupId ? (quiz.meta.groups || []).find((g) => g.id === q.groupId) : undefined;
                return (
                  <SortableQuestionItem
                    key={q.id}
                    question={q}
                    isActive={q.id === activeQuestionId}
                    onClick={() => setActiveQuestion(q.id)}
                    groupColor={group?.color}
                  />
                );
              })}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Add question */}
      <div className="p-3 border-t border-gray-100 relative">
        <button
          onClick={() => setShowTypePicker((v) => !v)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-95"
          style={{ background: "linear-gradient(135deg, #24abbc, #0d8a9a)" }}
        >
          <Plus className="w-4 h-4" />
          Add Question
        </button>

        {showTypePicker && (
          <div className="absolute bottom-full left-3 right-3 mb-2 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden z-10">
            <div className="px-3 py-2 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Choose question type</p>
            </div>
            {QUESTION_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => { addQuestion(type); setShowTypePicker(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
              >
                <span className="text-teal-500">{TYPE_ICONS[type]}</span>
                <span className="text-sm text-gray-700">{TYPE_LABELS[type]}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
