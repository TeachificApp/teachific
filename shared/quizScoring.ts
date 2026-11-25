import { filterVisibleDependentQuestions, type QuizQuestionDependency } from "./quizQuestionDependency";

export type PublicQuizScoringQuestion = {
  id: string | number; type?: string; points?: number; data?: Record<string, any> | null;
  showWhen?: QuizQuestionDependency | null; scoring?: { partialCredit?: boolean; wrongChoicePolicy?: "zero" | "subtract" };
  feedback?: { correct?: string; incorrect?: string; partial?: string }; explanation?: string;
};
export type QuizQuestionGrade = { earnedPoints: number; totalPoints: number; status: "graded" | "pending_manual" | "unscored"; correct: boolean; partial: boolean; feedback: string };
export type PublicQuizAttemptScore = { earnedPoints: number; totalPoints: number; scorePercent: number; pendingManual: boolean; grades: Record<string, QuizQuestionGrade> };

/** Self-contained factory: the SCORM runtime embeds this exact source, never a parallel scoring algorithm. */
export function createNativeQuizGrader() {
  const record = (v: any): Record<string, any> => v && typeof v === "object" && !Array.isArray(v) ? v : {};
  const list = (v: any): any[] => Array.isArray(v) ? v : [];
  const text = (v: any, sensitive = false) => typeof v === "string" ? (sensitive ? v.trim() : v.trim().toLowerCase()) : "";
  const hasNumber = (v: any) => v !== null && v !== undefined && v !== "" && typeof v !== "boolean" && Number.isFinite(Number(v));
  const same = (a: any[], b: any[]) => a.length > 0 && a.length === b.length && new Set(b.map(String)).size === b.length && a.map(String).sort().join("\u0000") === b.map(String).sort().join("\u0000");
  const keywordMatch = (value: any, keywords: any, sensitive = false, mode = "all") => {
    const answer = text(value, sensitive);
    const keys = list(keywords).map(k => text(k, sensitive)).filter(Boolean);
    const hits = keys.map(k => {
      // Literal token/phrase matching; no author-provided regular expressions execute.
      const offset = answer.indexOf(k);
      for (let at = offset; at >= 0; at = answer.indexOf(k, at + 1)) {
        const before = answer[at - 1] || " ", after = answer[at + k.length] || " ";
        if (!/[\p{L}\p{N}_]/u.test(before) && !/[\p{L}\p{N}_]/u.test(after)) return true;
      }
      return false;
    });
    return keys.length > 0 && (mode === "any" ? hits.some(Boolean) : hits.every(Boolean));
  };
  const hit = (region: any, point: any) => {
    if (!hasNumber(point?.x) || !hasNumber(point?.y)) return false;
    const x = Number(point.x), y = Number(point.y);
    if (x < 0 || x > 100 || y < 0 || y > 100) return false;
    if (region.shape === "circle") return hasNumber(region.radius) && region.radius > 0 && (x - region.x) ** 2 + (y - region.y) ** 2 <= region.radius ** 2;
    if (region.shape === "rect") return region.width > 0 && region.height > 0 && Math.abs(x - region.x) <= region.width / 2 && Math.abs(y - region.y) <= region.height / 2;
    const vertices = list(region.points);
    if (region.shape !== "polygon" || vertices.length < 3) return false;
    let inside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      const a = vertices[i], b = vertices[j];
      const cross = (x - a.x) * (b.y - a.y) - (y - a.y) * (b.x - a.x);
      if (Math.abs(cross) < 1e-8 && x >= Math.min(a.x, b.x) && x <= Math.max(a.x, b.x) && y >= Math.min(a.y, b.y) && y <= Math.max(a.y, b.y)) return true;
      if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  };
  function grade(question: any, answer: any): QuizQuestionGrade {
    const data = record(question.data), points = hasNumber(question.points) && Number(question.points) >= 0 ? Number(question.points) : 1;
    const policy = record(question.scoring), partialEnabled = policy.partialCredit === true || data.partialCredit === true;
    let ratio = 0, correct = false, status: QuizQuestionGrade["status"] = "graded", zoneFeedback = "";
    const units = (results: boolean[]) => { correct = results.length > 0 && results.every(Boolean); ratio = correct ? 1 : partialEnabled && results.length > 0 ? results.filter(Boolean).length / results.length : 0; };
    const selection = (options: any[], selected: any[]) => {
      const expected = options.filter(o => o.correct === true).map(o => String(o.id));
      const ids = selected.map(String), valid = new Set(options.map(o => String(o.id)));
      correct = expected.length > 0 && same(expected, ids);
      if (correct) return 1;
      if (!partialEnabled || !expected.length || new Set(ids).size !== ids.length || ids.some(id => !valid.has(id))) return 0;
      const wrong = ids.filter(id => !expected.includes(id)).length;
      if (wrong && policy.wrongChoicePolicy !== "subtract") return 0;
      const weight = (id: string) => { const o = options.find(o => String(o.id) === id); return hasNumber(o?.scoreWeight) && Number(o.scoreWeight) > 0 ? Number(o.scoreWeight) : 1; };
      const possible = expected.reduce((n, id) => n + weight(id), 0);
      return Math.max(0, Math.min(1, (ids.filter(id => expected.includes(id)).reduce((n, id) => n + weight(id), 0) - wrong) / possible));
    };
    switch (question.type) {
      case "mcq": case "image_choice": ratio = selection(list(data.choices), list(answer)); break;
      case "tf": correct = typeof data.correct === "boolean" && answer === data.correct; ratio = correct ? 1 : 0; break;
      case "hotspot": {
        const regions = list(data.regions);
        const clicks = Array.isArray(answer) ? answer : list(record(answer).clicks).length ? answer.clicks : hasNumber(answer?.x) ? [answer] : [];
        // Overlapping regions select every containing region; unknown/outside clicks earn no credit.
        const selected = clicks.flatMap((v: any) => typeof v === "string" ? [v] : regions.filter(r => hit(r, v)).map(r => r.id));
        const ids = [...new Set(selected)];
        const outside = clicks.some((v: any) => typeof v !== "string" && !regions.some(r => hit(r, v)));
        ratio = outside || (!data.multiSelect && ids.length !== 1) ? 0 : selection(regions, ids);
        if (outside) correct = false;
        zoneFeedback = regions.filter(r => ids.includes(r.id)).map(r => r.feedback || "").filter(Boolean).join("\n");
        break;
      }
      case "matching": units(list(data.pairs).map(p => record(answer)[p.id] === p.id)); break;
      case "fill_blank": units(list(data.blanks).map(b => b.gradingMode === "keyword" ? keywordMatch(record(answer)[b.id], b.keywords ?? b.acceptedAnswers, b.caseSensitive, b.keywordMode) : text(record(answer)[b.id], b.caseSensitive).length > 0 && list(b.acceptedAnswers).some(a => text(record(answer)[b.id], b.caseSensitive) === text(a, b.caseSensitive)))); break;
      case "short_answer":
        if (data.autoGrade !== true) { status = "pending_manual"; break; }
        if (!list(data.keywords).filter(Boolean).length && !list(data.acceptedVariants).filter(Boolean).length) { status = "pending_manual"; break; }
        correct = keywordMatch(answer, data.keywords, data.caseSensitive, data.keywordMode) || text(answer, data.caseSensitive).length > 0 && list(data.acceptedVariants).some(v => text(v, data.caseSensitive) === text(answer, data.caseSensitive)); ratio = correct ? 1 : 0; break;
      case "ordering": correct = list(data.items).length > 0 && Array.isArray(answer) && answer.length === data.items.length && answer.every((id, i) => id === data.items[i].id); ratio = correct ? 1 : 0; break;
      case "numeric": correct = hasNumber(answer) && (data.allowRange ? hasNumber(data.rangeMin) && hasNumber(data.rangeMax) && Number(answer) >= Number(data.rangeMin) && Number(answer) <= Number(data.rangeMax) : hasNumber(data.correctValue) && hasNumber(data.tolerance ?? 0) && Number(data.tolerance ?? 0) >= 0 && Math.abs(Number(answer) - Number(data.correctValue)) <= Number(data.tolerance ?? 0)); ratio = correct ? 1 : 0; break;
      case "dropdown": units(list(data.blanks).map(b => hasNumber(record(answer)[b.id]) && Number(record(answer)[b.id]) === Number(b.correctIndex))); break;
      case "drag_words": units(list(data.blanks).map(b => record(answer)[b.id] === b.correctWord)); break;
      case "drag_drop": units(list(data.items).map(i => record(answer)[i.id] === i.targetId)); break;
      case "image_labeling": units(list(data.targets).map(t => record(answer)[t.id] === t.labelId)); break;
      case "essay": status = "pending_manual"; break;
      case "likert": case "image_comparison": case "info_slide": status = "unscored"; break;
      default: status = "pending_manual";
    }
    const earnedPoints = status === "graded" ? points * ratio : 0;
    const partial = ratio > 0 && ratio < 1;
    return { earnedPoints, totalPoints: status === "unscored" ? 0 : points, status, correct, partial, feedback: status !== "graded" ? "" : zoneFeedback || question.feedback?.[partial ? "partial" : correct ? "correct" : "incorrect"] || question.explanation || "" };
  }
  return { grade, hit, keywordMatch };
}
const engine = createNativeQuizGrader();
export const gradeQuizQuestion = engine.grade;
export const hitTestQuizHotspot = engine.hit;
/** Historical exact/all-or-nothing is retained unless an authored policy explicitly opts in. */
export function scoreNativeQuizAttempt(questions: PublicQuizScoringQuestion[], answers: Record<string, unknown>): PublicQuizAttemptScore {
  const grades: Record<string, QuizQuestionGrade> = {};
  for (const question of filterVisibleDependentQuestions(questions, answers)) grades[String(question.id)] = engine.grade(question, answers[String(question.id)]);
  const values = Object.values(grades), totalPoints = values.reduce((n, g) => n + g.totalPoints, 0), earnedPoints = values.reduce((n, g) => n + g.earnedPoints, 0);
  return { earnedPoints, totalPoints, scorePercent: totalPoints > 0 ? Math.round(earnedPoints / totalPoints * 10000) / 100 : 0, pendingManual: values.some(g => g.status === "pending_manual"), grades };
}

/** Retained three-field historical reader; precise native details are available through scoreNativeQuizAttempt. */
export function scorePublicQuizAttempt(questions: PublicQuizScoringQuestion[], answers: Record<string, unknown>): Pick<PublicQuizAttemptScore, "earnedPoints" | "totalPoints" | "scorePercent"> { const { earnedPoints, totalPoints, scorePercent } = scoreNativeQuizAttempt(questions, answers); return { earnedPoints, totalPoints, scorePercent }; }
