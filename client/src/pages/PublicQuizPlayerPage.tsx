import { useState, useMemo, useRef, useEffect } from "react";
import React from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, RotateCcw, Clock, Award, Flag } from "lucide-react";
import type { QuizQuestion, McqData, TfData, MatchingData, HotspotData, FillBlankData, ShortAnswerData, ImageChoiceData, OrderingData, DragWordsData, DropdownData, NumericData, LikertData, EssayData, ImageLabelingData, BranchRule, DrawConfig } from "@/quiz-creator/types/quiz";
import { DndOrdering, DndDragWords } from "@/quiz-creator/components/DndQuizInteractions";
import { ImageLabelingInteraction } from "@/quiz-creator/components/ImageLabelingInteraction";
import { getMockExamReviewSummary, shouldOpenMockExamReview, toggleMockExamFlag } from "../../../shared/mockExamFlow";
import { gradeImageLabelingAnswer } from "../../../shared/imageLabeling";
import {
  ImageComparisonPlayer,
  DragSortPlayer,
  BranchingPlayer,
  FillBlankPlayer as InteractiveFillBlankPlayer,
  AnnotationPlayer,
  FlashcardPlayer,
} from "@/components/InteractiveQuizQuestions";

type Answer = string | boolean | string[] | Record<string, string>;

// ─── Branching Logic Helper ─────────────────────────────────────────────────

function isAnswerCorrect(q: QuizQuestion, ans: Answer | undefined): boolean {
  if (!ans) return false;
  if (q.type === "mcq" || q.type === "image_choice") {
    const data = q.data as McqData;
    const correctIds = data.choices.filter((c) => c.correct).map((c) => c.id);
    const selected = (ans as string[]) ?? [];
    return JSON.stringify([...correctIds].sort()) === JSON.stringify([...selected].sort());
  } else if (q.type === "tf") {
    return ans === (q.data as TfData).correct;
  } else if (q.type === "matching") {
    const data = q.data as MatchingData;
    const a = (ans as Record<string, string>) ?? {};
    return data.pairs.every((p) => a[p.id] === p.id);
  } else if (q.type === "ordering") {
    const data = q.data as OrderingData;
    const a = (ans as string[]) ?? [];
    return a.length === data.items.length && a.every((id, i) => id === data.items[i].id);
  } else if (q.type === "numeric") {
    const data = q.data as NumericData;
    const a = Number(ans);
    if (data.allowRange && data.rangeMin != null && data.rangeMax != null) return a >= data.rangeMin && a <= data.rangeMax;
    return Math.abs(a - data.correctValue) <= data.tolerance;
  } else if (q.type === "dropdown") {
    const data = q.data as DropdownData;
    const a = (ans as Record<string, string>) ?? {};
    return data.blanks.every((b) => Number(a[b.id]) === b.correctIndex);
  } else if (q.type === "drag_words") {
    const data = q.data as DragWordsData;
    const a = (ans as Record<string, string>) ?? {};
    return data.blanks.every((b) => a[b.id] === b.correctWord);
  } else if (q.type === "fill_blank") {
    const data = q.data as FillBlankData;
    const a = (ans as Record<string, string>) ?? {};
    return data.blanks.every((b) => {
      const userAns = (a[b.id] ?? "").trim();
      return b.acceptedAnswers.some((accepted) => b.caseSensitive ? userAns === accepted : userAns.toLowerCase() === accepted.toLowerCase());
    });
  } else if (q.type === "image_labeling") {
    return gradeImageLabelingAnswer((q.data as ImageLabelingData).targets, ans);
  }
  return false;
}

function evaluateBranchRules(
  rules: BranchRule[] | undefined,
  question: QuizQuestion,
  answer: Answer | undefined,
  cumulativeScore: number,
  totalPoints: number
): { type: "question"; questionId: string } | { type: "end" } | { type: "result" } | { type: "next" } | null {
  if (!rules || rules.length === 0) return null;
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);
  const correct = isAnswerCorrect(question, answer);
  const scorePct = totalPoints > 0 ? Math.round((cumulativeScore / totalPoints) * 100) : 0;

  for (const rule of sorted) {
    let matches = false;
    const cond = rule.condition;
    switch (cond.type) {
      case "correct": matches = correct; break;
      case "incorrect": matches = !correct; break;
      case "choice": {
        const selected = (answer as string[]) ?? [];
        matches = selected.includes((cond as { type: "choice"; choiceId: string }).choiceId);
        break;
      }
      case "score_above": matches = scorePct > (cond as { type: "score_above"; threshold: number }).threshold; break;
      case "score_below": matches = scorePct < (cond as { type: "score_below"; threshold: number }).threshold; break;
      case "always": matches = true; break;
    }
    if (matches) return rule.target;
  }
  return null;
}

interface Branding {
  brandPrimaryColor: string | null;
  brandBgColor: string | null;
  brandLogoUrl: string | null;
  brandFontFamily: string | null;
  completionMessage: string | null;
}

// ─── Question Renderers ──────────────────────────────────────────────────────

function McqQuestion({ q, answer, setAnswer, primaryColor, shuffleChoices }: { q: QuizQuestion; answer: Answer; setAnswer: (a: Answer) => void; primaryColor: string; shuffleChoices?: boolean }) {
  const data = q.data as McqData;
  const choices = useMemo(() => {
    if (shuffleChoices && !q.lockAnswerOrder) {
      return [...data.choices].sort(() => 0.5 - Math.random());
    }
    return data.choices;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.id]);
  const selected = (answer as string[]) ?? [];
  const toggle = (id: string) => {
    if (data.multiSelect) {
      setAnswer(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
    } else {
      setAnswer([id]);
    }
  };
  return (
    <div className="space-y-2">
      {choices.map((c) => (
        <button
          key={c.id}
          onClick={() => toggle(c.id)}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
            selected.includes(c.id) ? "bg-opacity-10" : "border-gray-200 hover:border-gray-300"
          }`}
          style={selected.includes(c.id) ? { borderColor: primaryColor, backgroundColor: `${primaryColor}10` } : undefined}
        >
          <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0`}
            style={selected.includes(c.id) ? { borderColor: primaryColor, backgroundColor: primaryColor } : { borderColor: "#d1d5db" }}
          >
            {selected.includes(c.id) && <span className="w-2 h-2 rounded-full bg-white" />}
          </span>
          <span className="text-sm text-gray-700">{c.text}</span>
        </button>
      ))}
    </div>
  );
}

function TfQuestion({ answer, setAnswer, primaryColor }: { answer: Answer; setAnswer: (a: Answer) => void; primaryColor: string }) {
  return (
    <div className="flex gap-4">
      {[true, false].map((val) => (
        <button
          key={String(val)}
          onClick={() => setAnswer(val)}
          className={`flex-1 py-4 rounded-xl border-2 text-sm font-semibold transition-all ${
            answer === val ? "" : "border-gray-200 text-gray-600 hover:border-gray-300"
          }`}
          style={answer === val ? { borderColor: primaryColor, backgroundColor: `${primaryColor}10`, color: primaryColor } : undefined}
        >
          {val ? "✓ True" : "✗ False"}
        </button>
      ))}
    </div>
  );
}

function MatchingQuestion({ q, answer, setAnswer, primaryColor }: { q: QuizQuestion; answer: Answer; setAnswer: (a: Answer) => void; primaryColor: string }) {
  const data = q.data as MatchingData;
  const ans = (answer as Record<string, string>) ?? {};
  return (
    <div className="space-y-3">
      {data.pairs.map((pair) => (
        <div key={pair.id} className="flex items-center gap-3">
          <div className="flex-1 px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-700 font-medium">
            {pair.premise}
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
          <select
            value={ans[pair.id] ?? ""}
            onChange={(e) => setAnswer({ ...ans, [pair.id]: e.target.value })}
            className="flex-1 px-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2"
            style={{ "--tw-ring-color": `${primaryColor}50` } as any}
          >
            <option value="">Select...</option>
            {data.pairs.map((p) => (
              <option key={p.id} value={p.id}>{p.response}</option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

function HotspotQuestion({ q, answer, setAnswer, primaryColor }: { q: QuizQuestion; answer: Answer; setAnswer: (a: Answer) => void; primaryColor: string }) {
  const data = q.data as HotspotData;
  const selected = (answer as string[]) ?? [];

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;

    const hit = data.regions.find((r) => {
      if (r.shape === "circle" && r.radius != null) {
        const dx = xPct - r.x, dy = yPct - r.y;
        return Math.sqrt(dx * dx + dy * dy) <= r.radius;
      }
      if (r.shape === "rect" && r.width != null && r.height != null) {
        return Math.abs(xPct - r.x) <= r.width / 2 && Math.abs(yPct - r.y) <= r.height / 2;
      }
      return false;
    });

    if (!hit) return;
    if (data.multiSelect) {
      setAnswer(selected.includes(hit.id) ? selected.filter((s) => s !== hit.id) : [...selected, hit.id]);
    } else {
      setAnswer([hit.id]);
    }
  };

  return (
    <div className="relative cursor-pointer rounded-xl overflow-hidden border border-gray-200" onClick={handleClick}>
      <img src={data.imageUrl} alt={data.imageAlt} className="w-full" />
      {data.regions.map((r) => {
        const isSelected = selected.includes(r.id);
        return (
          <div
            key={r.id}
            className={`absolute border-2 transition-all ${isSelected ? "" : "bg-transparent border-transparent hover:bg-white/20"}`}
            style={{
              left: `${r.x}%`,
              top: `${r.y}%`,
              width: r.shape === "circle" ? `${(r.radius ?? 5) * 2}%` : `${r.width ?? 10}%`,
              height: r.shape === "circle" ? `${(r.radius ?? 5) * 2}%` : `${r.height ?? 10}%`,
              transform: "translate(-50%, -50%)",
              borderRadius: r.shape === "circle" ? "50%" : "8px",
              ...(isSelected ? { backgroundColor: `${primaryColor}40`, borderColor: primaryColor } : {}),
            }}
          />
        );
      })}
      <p className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-md">
        Click to select region
      </p>
    </div>
  );
}

function FillBlankQuestion({ q, answer, setAnswer, primaryColor }: { q: QuizQuestion; answer: Answer; setAnswer: (a: Answer) => void; primaryColor: string }) {
  const data = q.data as FillBlankData;
  const ans = (answer as Record<string, string>) ?? {};
  const parts = data.template.split(/(\{\{[^}]+\}\})/g);

  return (
    <div className="text-base text-gray-700 leading-relaxed flex flex-wrap items-center gap-1">
      {parts.map((part, i) => {
        const match = part.match(/^\{\{(.+)\}\}$/);
        if (match) {
          const blankId = match[1];
          return (
            <input
              key={i}
              type="text"
              value={ans[blankId] ?? ""}
              onChange={(e) => setAnswer({ ...ans, [blankId]: e.target.value })}
              placeholder="___"
              className="inline-block w-32 px-2 py-1 border-b-2 rounded text-sm focus:outline-none text-center"
              style={{ borderColor: primaryColor, backgroundColor: `${primaryColor}08` }}
            />
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </div>
  );
}

function ShortAnswerQuestion({ answer, setAnswer, primaryColor }: { answer: Answer; setAnswer: (a: Answer) => void; primaryColor: string }) {
  return (
    <textarea
      value={(answer as string) ?? ""}
      onChange={(e) => setAnswer(e.target.value)}
      rows={4}
      placeholder="Type your answer here..."
      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 resize-none"
      style={{ "--tw-ring-color": `${primaryColor}50` } as any}
    />
  );
}

function ImageChoiceQuestion({ q, answer, setAnswer, primaryColor, shuffleChoices }: { q: QuizQuestion; answer: Answer; setAnswer: (a: Answer) => void; primaryColor: string; shuffleChoices?: boolean }) {
  const data = q.data as ImageChoiceData;
  const choices = useMemo(() => {
    if (shuffleChoices && !q.lockAnswerOrder) {
      return [...data.choices].sort(() => 0.5 - Math.random());
    }
    return data.choices;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.id]);
  const selected = (answer as string[]) ?? [];
  const toggle = (id: string) => {
    if (data.multiSelect) {
      setAnswer(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
    } else {
      setAnswer([id]);
    }
  };
  return (
    <div className="grid grid-cols-2 gap-3">
      {choices.map((c) => (
        <button
          key={c.id}
          onClick={() => toggle(c.id)}
          className={`border-2 rounded-xl overflow-hidden text-left transition-all ${
            selected.includes(c.id) ? "" : "border-gray-200 hover:border-gray-300"
          }`}
          style={selected.includes(c.id) ? { borderColor: primaryColor } : undefined}
        >
          {c.imageUrl && <img src={c.imageUrl} alt={c.label} className="w-full h-28 object-cover" />}
          <div className="p-2 text-xs text-gray-700 text-center">{c.label}</div>
        </button>
      ))}
    </div>
  );
}

// ─── New Question Type Renderers ────────────────────────────────────────────

function OrderingQuestion({ q, answer, setAnswer, primaryColor }: { q: QuizQuestion; answer: Answer; setAnswer: (a: Answer) => void; primaryColor: string }) {
  const data = q.data as OrderingData;
  const [initialized, setInitialized] = useState(false);
  const items = (answer as string[]) ?? [];
  
  // Initialize with shuffled order on first render
  useEffect(() => {
    if (!initialized && !answer) {
      const shuffled = [...data.items.map((i) => i.id)].sort(() => 0.5 - Math.random());
      setAnswer(shuffled);
      setInitialized(true);
    }
  }, [initialized, answer, data.items, setAnswer]);

  if (!items.length) return null;

  return (
    <DndOrdering
      items={data.items}
      currentOrder={items}
      onReorder={setAnswer}
      primaryColor={primaryColor}
    />
  );
}

function NumericQuestion({ answer, setAnswer, primaryColor, data }: { answer: Answer; setAnswer: (a: Answer) => void; primaryColor: string; data: NumericData }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={(answer as string) ?? ""}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Enter a number..."
          className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2"
          style={{ "--tw-ring-color": `${primaryColor}50` } as any}
        />
        {data.unit && <span className="text-sm text-gray-500">{data.unit}</span>}
      </div>
    </div>
  );
}

function DropdownQuestion({ q, answer, setAnswer, primaryColor }: { q: QuizQuestion; answer: Answer; setAnswer: (a: Answer) => void; primaryColor: string }) {
  const data = q.data as DropdownData;
  const selections = (answer as Record<string, string>) ?? {};
  const parts = data.template.split(/\{\{(\w+)\}\}/);
  return (
    <div className="text-sm text-gray-700 leading-relaxed flex flex-wrap items-center gap-1">
      {parts.map((part, i) => {
        const blank = data.blanks.find((b) => b.id === part);
        if (blank) {
          return (
            <select
              key={i}
              value={selections[blank.id] ?? ""}
              onChange={(e) => setAnswer({ ...selections, [blank.id]: e.target.value })}
              className="px-2 py-1 border border-gray-300 rounded text-sm bg-white focus:ring-2"
              style={{ "--tw-ring-color": `${primaryColor}50` } as any}
            >
              <option value="">Select...</option>
              {blank.options.map((opt, oi) => (
                <option key={oi} value={String(oi)}>{opt}</option>
              ))}
            </select>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </div>
  );
}

function DragWordsQuestion({ q, answer, setAnswer, primaryColor }: { q: QuizQuestion; answer: Answer; setAnswer: (a: Answer) => void; primaryColor: string }) {
  const data = q.data as DragWordsData;
  const selections = (answer as Record<string, string>) ?? {};

  return (
    <DndDragWords
      template={data.template}
      blanks={data.blanks}
      distractorWords={data.distractorWords}
      selections={selections}
      onSelectionChange={setAnswer}
      primaryColor={primaryColor}
    />
  );
}

function LikertQuestion({ q, answer, setAnswer, primaryColor }: { q: QuizQuestion; answer: Answer; setAnswer: (a: Answer) => void; primaryColor: string }) {
  const data = q.data as LikertData;
  const selections = (answer as Record<string, string>) ?? {};
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-left py-2 pr-4 text-xs text-gray-500">Statement</th>
            {data.scaleLabels.map((label, i) => (
              <th key={i} className="text-center px-2 py-2 text-xs text-gray-500 whitespace-nowrap">{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.statements.map((stmt) => (
            <tr key={stmt.id} className="border-t border-gray-100">
              <td className="py-3 pr-4 text-gray-700">{stmt.text}</td>
              {data.scaleLabels.map((_, i) => (
                <td key={i} className="text-center px-2 py-3">
                  <input
                    type="radio"
                    name={stmt.id}
                    checked={selections[stmt.id] === String(i)}
                    onChange={() => setAnswer({ ...selections, [stmt.id]: String(i) })}
                    style={{ accentColor: primaryColor }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EssayQuestion({ answer, setAnswer, primaryColor, data }: { answer: Answer; setAnswer: (a: Answer) => void; primaryColor: string; data: EssayData }) {
  const text = (answer as string) ?? "";
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  return (
    <div className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder={data.placeholder || "Write your answer here..."}
        rows={6}
        className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 resize-none"
        style={{ "--tw-ring-color": `${primaryColor}50` } as any}
      />
      <div className="flex items-center gap-3 text-xs text-gray-400">
        <span>{wordCount} words</span>
        {data.minWords && <span>Min: {data.minWords}</span>}
        {data.maxWords && <span>Max: {data.maxWords}</span>}
      </div>
    </div>
  );
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

function calcScore(questions: QuizQuestion[], answers: Record<string, Answer>): number {
  let earned = 0;
  questions.forEach((q) => {
    const ans = answers[q.id];
    if (q.type === "mcq" || q.type === "image_choice") {
      const data = q.data as McqData;
      const correctIds = data.choices.filter((c) => c.correct).map((c) => c.id);
      const selected = (ans as string[]) ?? [];
      if (JSON.stringify([...correctIds].sort()) === JSON.stringify([...selected].sort())) earned += q.points;
    } else if (q.type === "tf") {
      const data = q.data as TfData;
      if (ans === data.correct) earned += q.points;
    } else if (q.type === "matching") {
      const data = q.data as MatchingData;
      const a = (ans as Record<string, string>) ?? {};
      const allCorrect = data.pairs.every((p) => a[p.id] === p.id);
      if (allCorrect) earned += q.points;
    } else if (q.type === "fill_blank") {
      const data = q.data as FillBlankData;
      const a = (ans as Record<string, string>) ?? {};
      const allCorrect = data.blanks.every((b) => {
        const userAns = (a[b.id] ?? "").trim();
        return b.acceptedAnswers.some((accepted) =>
          b.caseSensitive ? userAns === accepted : userAns.toLowerCase() === accepted.toLowerCase()
        );
      });
      if (allCorrect) earned += q.points;
    } else if (q.type === "ordering") {
      const data = q.data as OrderingData;
      const a = (ans as string[]) ?? [];
      if (a.length === data.items.length && a.every((id, i) => id === data.items[i].id)) earned += q.points;
    } else if (q.type === "numeric") {
      const data = q.data as NumericData;
      const a = Number(ans);
      if (data.allowRange && data.rangeMin != null && data.rangeMax != null) {
        if (a >= data.rangeMin && a <= data.rangeMax) earned += q.points;
      } else {
        if (Math.abs(a - data.correctValue) <= data.tolerance) earned += q.points;
      }
    } else if (q.type === "dropdown") {
      const data = q.data as DropdownData;
      const a = (ans as Record<string, string>) ?? {};
      const allCorrect = data.blanks.every((b) => Number(a[b.id]) === b.correctIndex);
      if (allCorrect) earned += q.points;
    } else if (q.type === "drag_words") {
      const data = q.data as DragWordsData;
      const a = (ans as Record<string, string>) ?? {};
      const allCorrect = data.blanks.every((b) => a[b.id] === b.correctWord);
      if (allCorrect) earned += q.points;
    } else if (q.type === "image_labeling") {
      if (gradeImageLabelingAnswer((q.data as ImageLabelingData).targets, ans)) earned += q.points;
    }
    // likert and essay are not auto-graded
  });
  return earned;
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function PublicQuizPlayerPage() {
  const { shareToken, quizId } = useParams<{ shareToken?: string; quizId?: string }>();
  const [location] = useLocation();
  const widgetToken = useMemo(() => new URLSearchParams(window.location.search).get("token") ?? "", [location]);
  const staffPreviewQuizId = Number(quizId);
  const isStaffPreview = Number.isInteger(staffPreviewQuizId) && staffPreviewQuizId > 0;
  const isWidget = Boolean(widgetToken);
  const { data: publicQuiz, isLoading: isPublicLoading, error: publicError } = trpc.quizMaker.getPublishedQuiz.useQuery(
    { shareToken: shareToken || "" },
    { enabled: !!shareToken && !isStaffPreview && !isWidget, retry: false }
  );
  const { data: widgetQuiz, isLoading: isWidgetLoading, error: widgetError } = trpc.quizMaker.getWidgetQuiz.useQuery(
    { widgetToken },
    { enabled: isWidget && !isStaffPreview, retry: false }
  );
  const { data: publicBranding } = trpc.quizMaker.getQuizBranding.useQuery(
    isWidget ? { widgetToken } : { shareToken: shareToken || "" },
    { enabled: (isWidget || !!shareToken) && !isStaffPreview }
  );
  const { data: staffQuiz, isLoading: isStaffLoading, error: staffError } = trpc.quizMaker.getStaffPreviewQuiz.useQuery(
    { quizId: staffPreviewQuizId || 0 },
    { enabled: isStaffPreview, retry: false }
  );
  const quiz = isStaffPreview ? staffQuiz : (isWidget ? widgetQuiz : publicQuiz);
  const branding = isStaffPreview ? staffQuiz?.branding : publicBranding;
  const isLoading = isStaffPreview ? isStaffLoading : (isWidget ? isWidgetLoading : isPublicLoading);
  const error = isStaffPreview ? staffError : (isWidget ? widgetError : publicError);

  const submitAttemptMutation = trpc.quizMaker.submitAttempt.useMutation();

  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [submitted, setSubmitted] = useState(false);
  const [started, setStarted] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<string, true>>({});
  const startTimeRef = useRef<number>(0);

  // Branching state: tracks the path of question IDs visited
  const [questionPath, setQuestionPath] = useState<string[]>([]);

  // Branding colors
  const primaryColor = branding?.brandPrimaryColor || "#24abbc";
  const bgColor = branding?.brandBgColor || null;
  const logoUrl = branding?.brandLogoUrl || null;
  const fontFamily = branding?.brandFontFamily || null;
  const completionMessage = branding?.completionMessage || null;

  const bgGradient = bgColor
    ? `linear-gradient(135deg, ${bgColor}, ${bgColor}dd)`
    : "linear-gradient(135deg, #f9fafb, #e6f7f8)";

  // Shuffle questions once on start, with pool/draw mode support
  const questions = useMemo(() => {
    if (!quiz) return [];
    let qs = quiz.questions as QuizQuestion[];

    // Pool/Draw mode: randomly select a subset of questions from each group
    const drawConfig = (quiz as any).drawConfig as DrawConfig | undefined;
    if (drawConfig?.enabled) {
      const grouped: Record<string, QuizQuestion[]> = {};
      const ungrouped: QuizQuestion[] = [];
      qs.forEach((q) => {
        if (q.groupId) {
          if (!grouped[q.groupId]) grouped[q.groupId] = [];
          grouped[q.groupId].push(q);
        } else {
          ungrouped.push(q);
        }
      });
      const drawn: QuizQuestion[] = [];
      // Draw from each group
      for (const gd of drawConfig.groupDraws) {
        const pool = grouped[gd.groupId] || [];
        const shuffled = [...pool].sort(() => 0.5 - Math.random());
        drawn.push(...shuffled.slice(0, gd.drawCount));
      }
      // Draw ungrouped
      const shuffledUngrouped = [...ungrouped].sort(() => 0.5 - Math.random());
      drawn.push(...shuffledUngrouped.slice(0, drawConfig.ungroupedDrawCount));
      qs = drawn;
    }

    if (quiz.shuffleQuestions) {
      return [...qs].sort(() => 0.5 - Math.random());
    }
    return qs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz, started]);

  // Auto-detect branching: enabled if any question has branchRules defined
  const branchingEnabled = useMemo(() => {
    if (!questions || questions.length === 0) return false;
    return questions.some((qq) => qq.branchRules && qq.branchRules.length > 0);
  }, [questions]);

  // Apply font family
  useEffect(() => {
    if (fontFamily) {
      document.body.style.fontFamily = `"${fontFamily}", -apple-system, BlinkMacSystemFont, sans-serif`;
      // Try to load from Google Fonts
      const link = document.createElement("link");
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}:wght@400;500;600;700&display=swap`;
      link.rel = "stylesheet";
      document.head.appendChild(link);
      return () => {
        document.body.style.fontFamily = "";
        document.head.removeChild(link);
      };
    }
  }, [fontFamily]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: bgGradient }}>
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: primaryColor, borderTopColor: "transparent" }} />
          <p className="text-gray-500 text-sm">Loading quiz...</p>
        </div>
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-red-50">
        <div className="text-center max-w-md mx-4">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Quiz Not Found</h1>
          <p className="text-gray-500 text-sm">{isWidget ? "This widget may have expired, been revoked, or requires access through the correct organization." : "This quiz may have been unpublished or the link is invalid."}</p>
          {isWidget && (error as any)?.data?.code === "UNAUTHORIZED" && (
            <button
              type="button"
              onClick={() => { window.location.href = getLoginUrl(`${window.location.pathname}${window.location.search}`); }}
              className="mt-4 rounded-lg px-4 py-2 text-sm font-semibold text-white"
              style={{ backgroundColor: primaryColor }}
            >
              Sign in to continue
            </button>
          )}
        </div>
      </div>
    );
  }

  const totalPoints = questions.reduce((s, q) => s + q.points, 0);
  const isMockExam = Boolean((quiz as any).mockExamEnabled);
  const mockExamReviewSummary = getMockExamReviewSummary(questions, answers, flaggedQuestions);

  // ─── Start Screen ──────────────────────────────────────────────────────────
  if (!started) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: bgGradient }}>
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-8 text-center">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-14 mx-auto mb-4 object-contain" />
          ) : (
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)` }}>
              <Award className="w-8 h-8 text-white" />
            </div>
          )}
          <h1 className="text-2xl font-bold text-gray-800 mb-2">{quiz.title}</h1>
          {quiz.description && <p className="text-gray-500 text-sm mb-6">{quiz.description}</p>}

          <div className="grid grid-cols-2 gap-3 mb-6 text-sm">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-gray-400 text-xs">Questions</p>
              <p className="font-bold text-gray-800">{questions.length}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-gray-400 text-xs">Total Points</p>
              <p className="font-bold text-gray-800">{totalPoints}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-gray-400 text-xs">Passing Score</p>
              <p className="font-bold text-gray-800">{quiz.passingScore}%</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-gray-400 text-xs">Time Limit</p>
              <p className="font-bold text-gray-800">{quiz.timeLimit ? `${Math.round(quiz.timeLimit / 60)} min` : "None"}</p>
            </div>
          </div>

          <button
            onClick={() => { setStarted(true); startTimeRef.current = Date.now(); }}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)` }}
          >
            Start Quiz
          </button>

          <p className="text-xs text-gray-400 mt-4">
            Powered by <span className="font-semibold">Course360 Quiz Creator</span>
          </p>
        </div>
      </div>
    );
  }

  // ─── Results Screen ────────────────────────────────────────────────────────
  if (submitted) {
    const score = calcScore(questions, answers);
    const pct = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;
    const passed = pct >= (quiz.passingScore ?? 70);
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: bgGradient }}>
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center">
          {logoUrl && <img src={logoUrl} alt="Logo" className="h-10 mx-auto mb-4 object-contain" />}
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4`}
            style={{ backgroundColor: passed ? `${primaryColor}20` : "#fee2e2" }}
          >
            {passed ? <CheckCircle2 className="w-10 h-10" style={{ color: primaryColor }} /> : <XCircle className="w-10 h-10 text-red-500" />}
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-1">
            {completionMessage ? completionMessage : (passed ? "Quiz Passed!" : "Not Quite")}
          </h2>
          <p className="text-gray-500 mb-2">You scored {score}/{totalPoints} points ({pct}%)</p>
          <p className="text-sm text-gray-400 mb-6">Passing score: {quiz.passingScore}%</p>

          {/* Per-question breakdown */}
          {quiz.showCorrectAnswers && (
            <div className="text-left border-t border-gray-100 pt-4 mb-6 max-h-60 overflow-y-auto space-y-2">
              {questions.map((q, i) => {
                const ans = answers[q.id];
                let isCorrect = false;
                if (q.type === "mcq" || q.type === "image_choice") {
                  const data = q.data as McqData;
                  const correctIds = data.choices.filter((c) => c.correct).map((c) => c.id);
                  const selected = (ans as string[]) ?? [];
                  isCorrect = JSON.stringify([...correctIds].sort()) === JSON.stringify([...selected].sort());
                } else if (q.type === "tf") {
                  const data = q.data as TfData;
                  isCorrect = ans === data.correct;
                } else if (q.type === "matching") {
                  const data = q.data as MatchingData;
                  const a = (ans as Record<string, string>) ?? {};
                  isCorrect = data.pairs.every((p) => a[p.id] === p.id);
                } else if (q.type === "image_labeling") {
                  isCorrect = gradeImageLabelingAnswer((q.data as ImageLabelingData).targets, ans);
                }
                return (
                  <div key={q.id} className="flex items-center gap-2 text-sm">
                    {isCorrect ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: primaryColor }} />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                    )}
                    <span className="text-gray-600 truncate">Q{i + 1}: {q.stem}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex gap-3 justify-center">
            <button
            onClick={() => { setSubmitted(false); setReviewing(false); setAnswers({}); setFlaggedQuestions({}); setCurrentIdx(0); startTimeRef.current = Date.now(); }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
            >
              <RotateCcw className="w-4 h-4" /> Retry
            </button>
          </div>

          <p className="text-xs text-gray-400 mt-6">
            Powered by <span className="font-semibold">Course360 Quiz Creator</span>
          </p>
        </div>
      </div>
    );
  }

  // ─── Submit Handler ────────────────────────────────────────────────────────
  const handleSubmit = () => {
    const score = calcScore(questions, answers);
    const pct = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;
    const passed = pct >= (quiz.passingScore ?? 70);
    const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);

    // Submit attempt to backend (fire and forget)
    if (!isStaffPreview) {
      submitAttemptMutation.mutate({
        ...(isWidget ? { widgetToken } : { shareToken: shareToken || "" }),
        score,
        totalPoints,
        passed,
        timeTakenSeconds: timeTaken,
        answersJson: JSON.stringify(answers),
      });
    }

    setSubmitted(true);
  };

  if (isMockExam && reviewing) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: bgGradient }}>
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6">
          <div className="mb-6">
            <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: primaryColor }}>
              <Flag className="h-4 w-4" /> Mock exam review
            </div>
            <h1 className="mt-1 text-2xl font-bold text-gray-800">Review your responses</h1>
            <p className="mt-1 text-sm text-gray-500">{mockExamReviewSummary.answeredCount} of {questions.length} questions answered{mockExamReviewSummary.flaggedCount ? ` · ${mockExamReviewSummary.flaggedCount} flagged` : ""}. Choose a question to review before final scoring.</p>
          </div>
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-8">
            {mockExamReviewSummary.questions.map((question) => {
              return (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => { setCurrentIdx(question.index); setReviewing(false); }}
                  aria-label={`Review question ${question.index + 1}${question.answered ? ", answered" : ", unanswered"}${question.flagged ? ", flagged" : ""}`}
                  className={`relative rounded-lg border px-2 py-2 text-sm font-semibold transition-colors ${question.answered ? "border-[var(--org-primary)] bg-[color:color-mix(in_srgb,var(--org-primary)_12%,white)] text-[var(--org-primary)]" : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"}`}
                  style={question.answered ? ({ "--org-primary": primaryColor } as React.CSSProperties) : undefined}
                >
                  {question.index + 1}
                  {question.flagged && <Flag className="absolute -right-1 -top-1 h-3.5 w-3.5 fill-amber-400 text-amber-500" />}
                </button>
              );
            })}
          </div>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <button type="button" onClick={() => setReviewing(false)} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Continue reviewing</button>
            <button type="button" onClick={handleSubmit} className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)` }}>Submit for final scoring</button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Question Screen ───────────────────────────────────────────────────────
  const q = questions[currentIdx];
  if (!q) return null;

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: bgGradient }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {isStaffPreview && (
          <div className="rounded-t-2xl border-b border-amber-200 bg-amber-50 px-6 py-2 text-center text-xs font-semibold text-amber-900">
            Staff preview — this draft view is available only to authorized organization staff and does not record quiz attempts.
          </div>
        )}
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            {logoUrl && <img src={logoUrl} alt="Logo" className="h-7 object-contain" />}
            <h2 className="text-base font-bold text-gray-800">{quiz.title}</h2>
          </div>
          <div className="flex items-center gap-3">
            {quiz.timeLimit && (
              <span className="flex items-center gap-1 text-sm text-gray-500">
                <Clock className="w-4 h-4" />
              </span>
            )}
            <span className="text-sm text-gray-500">
              {currentIdx + 1} / {questions.length}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <div
            className="h-full transition-all"
            style={{ width: `${((currentIdx + 1) / questions.length) * 100}%`, background: primaryColor }}
          />
        </div>

        {/* Question */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-white px-2 py-0.5 rounded-full" style={{ background: primaryColor }}>
                Q{currentIdx + 1}
              </span>
              <span className="text-xs text-gray-400">{q.points} point{q.points !== 1 ? "s" : ""}</span>
              {isMockExam && (
                <button
                  type="button"
                  onClick={() => setFlaggedQuestions((current) => toggleMockExamFlag(current, q.id))}
                  className={`ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors ${flaggedQuestions[q.id] ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                  aria-pressed={Boolean(flaggedQuestions[q.id])}
                >
                  <Flag className={`h-3.5 w-3.5 ${flaggedQuestions[q.id] ? "fill-amber-400" : ""}`} />
                  {flaggedQuestions[q.id] ? "Flagged" : "Flag question"}
                </button>
              )}
            </div>
            <p className="text-base font-medium text-gray-800">{q.stem || "(No question text)"}</p>
             {q.image && q.type !== "image_labeling" && <img src={q.image.url} alt={q.image.alt} className="mt-3 rounded-xl max-h-48 object-cover" />}
            {q.audio && (
              <div className="mt-3 flex items-center gap-2 p-2 bg-gray-50 rounded-xl">
                <audio src={q.audio.url} controls className="flex-1 h-8" />
              </div>
            )}
            {q.video && (
              <video src={q.video.url} controls className="mt-3 w-full max-h-48 rounded-xl" />
            )}
          </div>
          {q.type === "mcq" && <McqQuestion q={q} answer={answers[q.id]} setAnswer={(a) => setAnswers((p) => ({ ...p, [q.id]: a }))} primaryColor={primaryColor} shuffleChoices={quiz.shuffleAnswers} />}
          {q.type === "tf" && <TfQuestion answer={answers[q.id]} setAnswer={(a) => setAnswers((p) => ({ ...p, [q.id]: a }))} primaryColor={primaryColor} />}
          {q.type === "matching" && <MatchingQuestion q={q} answer={answers[q.id]} setAnswer={(a) => setAnswers((p) => ({ ...p, [q.id]: a }))} primaryColor={primaryColor} />}
          {q.type === "hotspot" && (q.data as HotspotData).imageUrl && <HotspotQuestion q={q} answer={answers[q.id]} setAnswer={(a) => setAnswers((p) => ({ ...p, [q.id]: a }))} primaryColor={primaryColor} />}
          {q.type === "image_labeling" && <ImageLabelingInteraction data={q.data as ImageLabelingData} imageUrl={q.image?.url} imageAlt={q.image?.alt} answer={answers[q.id] as Record<string, string> | undefined} onChange={(a) => setAnswers((p) => ({ ...p, [q.id]: a }))} primaryColor={primaryColor} />}
          {q.type === "fill_blank" && <FillBlankQuestion q={q} answer={answers[q.id]} setAnswer={(a) => setAnswers((p) => ({ ...p, [q.id]: a }))} primaryColor={primaryColor} />}
          {q.type === "short_answer" && <ShortAnswerQuestion answer={answers[q.id]} setAnswer={(a) => setAnswers((p) => ({ ...p, [q.id]: a }))} primaryColor={primaryColor} />}
          {q.type === "image_choice" && <ImageChoiceQuestion q={q} answer={answers[q.id]} setAnswer={(a) => setAnswers((p) => ({ ...p, [q.id]: a }))} primaryColor={primaryColor} shuffleChoices={quiz.shuffleAnswers} />}
          {q.type === "ordering" && <OrderingQuestion q={q} answer={answers[q.id]} setAnswer={(a) => setAnswers((p) => ({ ...p, [q.id]: a }))} primaryColor={primaryColor} />}
          {q.type === "numeric" && <NumericQuestion answer={answers[q.id]} setAnswer={(a) => setAnswers((p) => ({ ...p, [q.id]: a }))} primaryColor={primaryColor} data={q.data as NumericData} />}
          {q.type === "dropdown" && <DropdownQuestion q={q} answer={answers[q.id]} setAnswer={(a) => setAnswers((p) => ({ ...p, [q.id]: a }))} primaryColor={primaryColor} />}
          {q.type === "drag_words" && <DragWordsQuestion q={q} answer={answers[q.id]} setAnswer={(a) => setAnswers((p) => ({ ...p, [q.id]: a }))} primaryColor={primaryColor} />}
          {q.type === "likert" && <LikertQuestion q={q} answer={answers[q.id]} setAnswer={(a) => setAnswers((p) => ({ ...p, [q.id]: a }))} primaryColor={primaryColor} />}
          {q.type === "essay" && <EssayQuestion answer={answers[q.id]} setAnswer={(a) => setAnswers((p) => ({ ...p, [q.id]: a }))} primaryColor={primaryColor} data={q.data as EssayData} />}
          {q.type === "image_comparison" && (
            <ImageComparisonPlayer question={q.data as any} submitted={submitted} />
          )}
          {q.type === "drag_sort" && (
            <DragSortPlayer question={q as any} submitted={submitted} answer={answers[q.id]} onAnswer={(a) => setAnswers((p) => ({ ...p, [q.id]: a }))} />
          )}
          {q.type === "branching" && (
            <BranchingPlayer question={q as any} submitted={submitted} answer={answers[q.id]} onAnswer={(a) => setAnswers((p) => ({ ...p, [q.id]: a }))} />
          )}
          {q.type === "annotation" && (
            <AnnotationPlayer question={q as any} submitted={submitted} answer={answers[q.id]} onAnswer={(a) => setAnswers((p) => ({ ...p, [q.id]: a }))} />
          )}
          {q.type === "flashcard" && (
            <FlashcardPlayer question={q as any} submitted={submitted} />
          )}
        </div>

        {/* Navigation */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <button
            onClick={() => {
              if (branchingEnabled && questionPath.length > 0) {
                // Go back along the branching path
                const newPath = [...questionPath];
                newPath.pop();
                setQuestionPath(newPath);
                const prevId = newPath[newPath.length - 1];
                if (prevId) {
                  const prevIdx = questions.findIndex((qq) => qq.id === prevId);
                  if (prevIdx >= 0) setCurrentIdx(prevIdx);
                } else {
                  setCurrentIdx(0);
                }
              } else {
                setCurrentIdx((i) => Math.max(0, i - 1));
              }
            }}
            disabled={branchingEnabled ? questionPath.length === 0 : currentIdx === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>

          {(() => {
            // Determine if this is the last question (branching or linear)
            const isLastLinear = currentIdx >= questions.length - 1;
            const handleNext = () => {
              if (branchingEnabled) {
                // Evaluate branch rules
                const cumulativeScore = calcScore(
                  questions.filter((qq) => answers[qq.id] !== undefined),
                  answers
                );
                const target = evaluateBranchRules(
                  q.branchRules,
                  q,
                  answers[q.id],
                  cumulativeScore,
                  totalPoints
                );
                // Track the path
                setQuestionPath((p) => [...p, q.id]);

                if (target) {
                  if (target.type === "end" || target.type === "result") {
                    if (shouldOpenMockExamReview(isMockExam, true)) setReviewing(true); else handleSubmit();
                    return;
                  }
                  if (target.type === "question") {
                    const targetIdx = questions.findIndex((qq) => qq.id === target.questionId);
                    if (targetIdx >= 0) { setCurrentIdx(targetIdx); return; }
                  }
                }
                // Default: go to next linear question
                if (currentIdx < questions.length - 1) {
                  setCurrentIdx((i) => i + 1);
                } else {
                  if (shouldOpenMockExamReview(isMockExam, true)) setReviewing(true); else handleSubmit();
                }
              } else {
                setCurrentIdx((i) => i + 1);
              }
            };

            if (branchingEnabled) {
              // In branching mode, always show "Next" (branching may end quiz early)
              return (
                <button
                  onClick={handleNext}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
                  style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)` }}
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              );
            }

            return isLastLinear ? (
              <button
                onClick={() => shouldOpenMockExamReview(isMockExam, isLastLinear) ? setReviewing(true) : handleSubmit()}
                className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all"
                style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)` }}
              >
                {isMockExam ? "Review answers" : "Submit Quiz"}
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
                style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)` }}
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
