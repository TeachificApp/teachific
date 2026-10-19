import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ArrowLeft, CheckCircle2, Clock3, RotateCcw, Target, XCircle } from "lucide-react";

function formatDuration(totalSeconds: number | null | undefined) {
  if (!totalSeconds || totalSeconds <= 0) return null;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function parseSelectedChoices(value: unknown) {
  if (Array.isArray(value)) return value.map(Number).filter(Number.isFinite);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(Number).filter(Number.isFinite) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export default function CourseQuizResultsPage() {
  const { slug, quizId, lessonId, attemptId } = useParams<{
    slug: string;
    quizId: string;
    lessonId: string;
    attemptId: string;
  }>();
  const [, navigate] = useLocation();
  const quizIdNumber = Number(quizId);
  const lessonIdNumber = Number(lessonId);
  const attemptIdNumber = Number(attemptId);
  const coursePath = `/courses/${encodeURIComponent(slug ?? "")}/player?lesson=${lessonIdNumber}`;
  const validRoute = Boolean(slug && Number.isInteger(quizIdNumber) && Number.isInteger(lessonIdNumber) && Number.isInteger(attemptIdNumber));
  const { data, isLoading, error } = trpc.quiz.getLearnerAttemptResult.useQuery(
    {
      quizId: quizIdNumber,
      courseSlug: slug ?? "",
      sourceLessonId: lessonIdNumber,
      attemptId: attemptIdNumber,
    },
    { enabled: validRoute },
  );

  if (isLoading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Skeleton className="mb-5 h-8 w-32" />
        <Skeleton className="mb-5 h-72 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </main>
    );
  }

  if (!validRoute || error || !data) {
    return (
      <main className="mx-auto flex min-h-[55vh] max-w-lg flex-col items-center justify-center px-4 text-center">
        <AlertCircle className="mb-4 h-11 w-11 text-amber-500" />
        <h1 className="text-xl font-semibold text-slate-900">Quiz result unavailable</h1>
        <p className="mt-2 text-sm text-slate-600">This result may no longer be available through this course lesson.</p>
        <Button className="mt-6" variant="outline" onClick={() => navigate(coursePath)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Return to course
        </Button>
      </main>
    );
  }

  const score = Number(data.attempt.scorePercent ?? 0);
  const passed = Boolean(data.attempt.passed);
  const duration = formatDuration(data.attempt.timeSpentSeconds);
  const canReview = Array.isArray(data.review) && data.review.length > 0;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <Button variant="ghost" size="sm" className="mb-5 -ml-2" onClick={() => navigate(coursePath)}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to course
        </Button>

        <Card className={`overflow-hidden border-2 ${passed ? "border-emerald-200" : "border-rose-200"}`}>
          <div className={passed ? "bg-emerald-600 px-6 py-6 text-white" : "bg-rose-600 px-6 py-6 text-white"}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-white/80">Course quiz result</p>
                <h1 className="mt-1 text-2xl font-bold">{data.quiz.title}</h1>
              </div>
              <Badge className="border-0 bg-white/20 px-3 py-1 text-white hover:bg-white/20">
                Attempt {data.attempt.attemptNumber}
              </Badge>
            </div>
          </div>
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
              <div className={`flex h-32 w-32 shrink-0 flex-col items-center justify-center rounded-full border-8 ${passed ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-rose-100 bg-rose-50 text-rose-700"}`}>
                <span className="text-3xl font-bold">{Math.round(score)}%</span>
                <span className="mt-0.5 text-xs font-semibold uppercase tracking-wide">{passed ? "Passed" : "Complete"}</span>
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-semibold text-slate-900">{passed ? "Well done — you passed." : "Your attempt is complete."}</h2>
                <p className="mt-1.5 text-sm text-slate-600">
                  {passed
                    ? "Your result has been recorded for this course lesson."
                    : `A score of ${data.quiz.passScorePercent}% is required to pass.`}
                </p>
                <div className="mt-5 grid grid-cols-2 gap-3 text-left sm:grid-cols-3">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-lg font-semibold text-slate-900">{data.attempt.earnedPoints}/{data.attempt.totalPoints}</p>
                    <p className="text-xs text-slate-500">Points</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-lg font-semibold text-slate-900">{data.quiz.passScorePercent}%</p>
                    <p className="text-xs text-slate-500">Pass score</p>
                  </div>
                  {duration && <div className="rounded-lg bg-slate-50 p-3">
                    <p className="flex items-center gap-1 text-lg font-semibold text-slate-900"><Clock3 className="h-4 w-4" />{duration}</p>
                    <p className="text-xs text-slate-500">Time taken</p>
                  </div>}
                </div>
              </div>
            </div>
            <div className="mt-7">
              <div className="mb-2 flex items-center justify-between text-sm"><span className="text-slate-600">Your score</span><span className="font-semibold text-slate-900">{Math.round(score)}%</span></div>
              <Progress value={score} className="h-2.5" />
            </div>
          </CardContent>
        </Card>

        {canReview && (
          <section className="mt-8">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-900"><Target className="h-5 w-5 text-[var(--org-primary)]" /> Review</h2>
            <div className="space-y-3">
              {data.review!.map((item, index) => {
                const selected = new Set(parseSelectedChoices(item.selectedChoiceIds));
                return (
                  <Card key={item.questionId} className={`border-l-4 ${item.isCorrect ? "border-l-emerald-500" : "border-l-rose-500"}`}>
                    <CardContent className="p-5">
                      <div className="flex items-start gap-3">
                        {item.isCorrect ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-slate-900"><span className="mr-1 text-slate-500">{index + 1}.</span>{item.question}</p>
                          {item.choices.length > 0 && (
                            <div className="mt-3 space-y-1.5">
                              {item.choices.map((choice) => {
                                const selectedChoice = selected.has(choice.id);
                                const className = choice.isCorrect
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                  : selectedChoice ? "border-rose-200 bg-rose-50 text-rose-800" : "border-slate-200 bg-white text-slate-600";
                                return <div className={`rounded-md border px-3 py-2 text-sm ${className}`} key={choice.id}>{choice.text}</div>;
                              })}
                            </div>
                          )}
                          {item.explanation && <p className="mt-3 rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-900"><span className="font-semibold">Explanation: </span>{item.explanation}</p>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <Button onClick={() => navigate(coursePath)}><ArrowLeft className="mr-2 h-4 w-4" /> Return to course</Button>
          {!passed && data.quiz.maxAttempts !== 1 && <Button variant="outline" onClick={() => navigate(coursePath)}><RotateCcw className="mr-2 h-4 w-4" /> Try again</Button>}
        </div>
      </div>
    </main>
  );
}
