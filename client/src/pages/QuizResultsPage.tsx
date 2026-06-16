import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2, XCircle, Clock, BarChart2, Users, Target,
  ArrowLeft, RotateCcw, AlertCircle, ChevronDown, ChevronUp,
  Loader2, TrendingUp, Award,
} from "lucide-react";

function ScoreRing({ score, passed, size = 120 }: { score: number; passed: boolean; size?: number }) {
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDash = (score / 100) * circumference;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={passed ? "#22c55e" : "#ef4444"} strokeWidth="8"
          strokeDasharray={`${strokeDash} ${circumference}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1s ease" }} />
      </svg>
      <div className="absolute text-center">
        <div className="text-2xl font-bold leading-none">{Math.round(score)}%</div>
        <div className={`text-xs font-medium mt-0.5 ${passed ? "text-green-600" : "text-red-500"}`}>{passed ? "PASSED" : "FAILED"}</div>
      </div>
    </div>
  );
}

function QuestionReviewCard({ question, response, index }: { question: any; response: any; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const isCorrect = response?.isCorrect;
  const selectedIds: number[] = response?.selectedChoiceIds
    ? (typeof response.selectedChoiceIds === "string" ? JSON.parse(response.selectedChoiceIds) : response.selectedChoiceIds)
    : [];
  return (
    <Card className={`border-l-4 ${isCorrect ? "border-l-green-500" : "border-l-red-400"}`}>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start gap-3">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${isCorrect ? "bg-green-100 text-green-600" : "bg-red-100 text-red-500"}`}>
            {isCorrect ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium"><span className="text-muted-foreground mr-1">Q{index + 1}.</span>{question.questionText}</p>
              <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={() => setExpanded(!expanded)}>
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </Button>
            </div>
            {expanded && question.choices && (
              <div className="mt-3 space-y-1.5">
                {question.choices.map((choice: any) => {
                  const isSelected = selectedIds.includes(choice.id);
                  const isCorrectChoice = choice.isCorrect;
                  let cls = "flex items-center gap-2 p-2 rounded text-xs ";
                  if (isSelected && isCorrectChoice) cls += "bg-green-50 text-green-700 border border-green-200";
                  else if (isSelected && !isCorrectChoice) cls += "bg-red-50 text-red-700 border border-red-200";
                  else if (!isSelected && isCorrectChoice) cls += "bg-green-50/50 text-green-600 border border-green-100";
                  else cls += "text-muted-foreground";
                  return (
                    <div key={choice.id} className={cls}>
                      {isSelected && isCorrectChoice && <CheckCircle2 className="w-3 h-3 flex-shrink-0" />}
                      {isSelected && !isCorrectChoice && <XCircle className="w-3 h-3 flex-shrink-0" />}
                      {!isSelected && isCorrectChoice && <CheckCircle2 className="w-3 h-3 flex-shrink-0 opacity-60" />}
                      {!isSelected && !isCorrectChoice && <div className="w-3 h-3 flex-shrink-0" />}
                      <span>{choice.choiceText}</span>
                    </div>
                  );
                })}
                {question.explanation && (
                  <div className="mt-2 p-2 rounded bg-blue-50 text-blue-700 text-xs"><strong>Explanation:</strong> {question.explanation}</div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StudentResultsView({ quizId, attemptId }: { quizId: number; attemptId: number }) {
  const [, navigate] = useLocation();
  const { data, isLoading, error } = trpc.quiz.getAttemptResult.useQuery({ attemptId }, { enabled: !!attemptId });
  if (isLoading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      <p className="text-muted-foreground">Loading your results...</p>
    </div>
  );
  if (error || !data) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <AlertCircle className="w-10 h-10 text-destructive" />
      <p className="text-muted-foreground">Could not load results.</p>
      <Button variant="outline" onClick={() => navigate(-1 as any)}>Go Back</Button>
    </div>
  );
  const { attempt, quiz, responses, resultsWithAnswers } = data as any;
  const score = parseFloat(attempt?.scorePercent ?? "0");
  const passed = attempt?.passed ?? false;
  const earnedPoints = attempt?.earnedPoints ?? 0;
  const totalPoints = attempt?.totalPoints ?? 0;
  const timeSpent = attempt?.timeSpentSeconds;
  const formatTime = (s: number) => { const m = Math.floor(s / 60); const sec = s % 60; return m > 0 ? `${m}m ${sec}s` : `${sec}s`; };
  return (
    <div className="max-w-2xl mx-auto p-6">
      <Button variant="ghost" size="sm" className="mb-4 -ml-2" onClick={() => navigate(-1 as any)}>
        <ArrowLeft className="w-4 h-4 mr-1" /> Back
      </Button>
      <Card className={`mb-6 border-2 ${passed ? "border-green-200 bg-green-50/30" : "border-red-200 bg-red-50/30"}`}>
        <CardContent className="pt-8 pb-6">
          <div className="flex flex-col items-center text-center gap-4">
            <ScoreRing score={score} passed={passed} size={140} />
            <div>
              <h1 className="text-2xl font-bold">{quiz?.title ?? "Quiz Results"}</h1>
              <p className="text-muted-foreground mt-1">{passed ? "Congratulations! You passed." : `You need ${quiz?.passScorePercent ?? 70}% to pass.`}</p>
            </div>
            <div className="grid grid-cols-3 gap-6 w-full max-w-sm">
              <div className="text-center"><div className="text-xl font-bold">{earnedPoints}/{totalPoints}</div><div className="text-xs text-muted-foreground">Points</div></div>
              <div className="text-center"><div className="text-xl font-bold">{attempt?.attemptNumber ?? 1}</div><div className="text-xs text-muted-foreground">Attempt</div></div>
              {timeSpent && <div className="text-center"><div className="text-xl font-bold">{formatTime(timeSpent)}</div><div className="text-xs text-muted-foreground">Time</div></div>}
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="mb-6">
        <CardContent className="pt-5 pb-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Your score</span><span className="font-semibold">{Math.round(score)}%</span></div>
            <Progress value={score} className="h-2.5" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Passing score: {quiz?.passScorePercent ?? 70}%</span>
              <span className={passed ? "text-green-600 font-medium" : "text-red-500 font-medium"}>{passed ? "✓ Passed" : "✗ Failed"}</span>
            </div>
          </div>
        </CardContent>
      </Card>
      {resultsWithAnswers && resultsWithAnswers.length > 0 && (
        <div>
          <h2 className="font-semibold mb-3 flex items-center gap-2"><Target className="w-4 h-4" /> Question Review</h2>
          <div className="space-y-3">
            {resultsWithAnswers.map((item: any, i: number) => (
              <QuestionReviewCard key={item.question?.id ?? i} question={item.question} response={item.response} index={i} />
            ))}
          </div>
        </div>
      )}
      <div className="flex gap-3 mt-6">
        <Button variant="outline" className="flex-1" onClick={() => navigate(-1 as any)}><ArrowLeft className="w-4 h-4 mr-2" /> Back to Course</Button>
        {quiz?.maxAttempts !== 1 && !passed && (
          <Button className="flex-1" onClick={() => navigate(`/quizzes/${quizId}` as any)}><RotateCcw className="w-4 h-4 mr-2" /> Retry Quiz</Button>
        )}
      </div>
    </div>
  );
}

function AdminAnalyticsView({ quizId }: { quizId: number }) {
  const { data: analytics, isLoading } = trpc.quiz.getQuizAnalytics.useQuery({ quizId }, { enabled: !!quizId });
  const { data: allAttempts } = trpc.quiz.listAttempts.useQuery({ quizId }, { enabled: !!quizId });
  const formatTime = (seconds: number) => { if (!seconds) return "—"; const m = Math.floor(seconds / 60); const s = seconds % 60; return m > 0 ? `${m}m ${s}s` : `${s}s`; };
  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!analytics) return <div className="text-center py-10 text-muted-foreground">No analytics data.</div>;
  const a = analytics as any;
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><BarChart2 className="w-5 h-5" /> Quiz Analytics</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Attempts", value: a.totalAttempts, icon: Users },
          { label: "Avg Score", value: `${Math.round(a.avgScore ?? 0)}%`, icon: TrendingUp },
          { label: "Pass Rate", value: `${Math.round(a.passRate ?? 0)}%`, icon: Award },
          { label: "Avg Time", value: formatTime(Math.round(a.avgTimeSeconds ?? 0)), icon: Clock },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}><CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center"><Icon className="w-4 h-4 text-primary" /></div>
              <div><div className="text-xl font-bold">{value}</div><div className="text-xs text-muted-foreground">{label}</div></div>
            </div>
          </CardContent></Card>
        ))}
      </div>
      {a.totalAttempts > 0 && (
        <Card className="mb-6"><CardHeader><CardTitle className="text-base">Pass Rate</CardTitle></CardHeader>
          <CardContent>
            <Progress value={a.passRate ?? 0} className="h-3 mb-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="text-red-500">Failed: {Math.round(100 - (a.passRate ?? 0))}%</span>
              <span className="text-green-600">Passed: {Math.round(a.passRate ?? 0)}%</span>
            </div>
          </CardContent>
        </Card>
      )}
      {a.questions && a.questions.length > 0 && (
        <Card className="mb-6"><CardHeader><CardTitle className="text-base">Question Performance</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {a.questions.map((q: any, i: number) => (
                <div key={q.questionId} className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium flex-1"><span className="text-muted-foreground mr-1">Q{i + 1}.</span>{q.questionText}</p>
                    <Badge variant="outline" className={`text-xs flex-shrink-0 ${q.correctRate >= 70 ? "border-green-300 text-green-700" : q.correctRate >= 40 ? "border-amber-300 text-amber-700" : "border-red-300 text-red-600"}`}>
                      {Math.round(q.correctRate)}% correct
                    </Badge>
                  </div>
                  <Progress value={q.correctRate} className="h-1.5" />
                  <p className="text-xs text-muted-foreground">{q.totalResponses} response{q.totalResponses !== 1 ? "s" : ""}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      {allAttempts && (allAttempts as any[]).length > 0 && (
        <Card><CardHeader><CardTitle className="text-base">Recent Attempts</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead><tr className="border-b">
                <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Attempt</th>
                <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Score</th>
                <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Status</th>
                <th className="text-left py-2 font-medium text-muted-foreground">Date</th>
              </tr></thead>
              <tbody>
                {(allAttempts as any[]).slice(0, 10).map((at) => (
                  <tr key={at.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">#{at.attemptNumber ?? at.id}</td>
                    <td className="py-2 pr-4 font-medium">{at.scorePercent ? `${Math.round(parseFloat(at.scorePercent))}%` : "—"}</td>
                    <td className="py-2 pr-4">
                      {at.status === "completed"
                        ? <Badge variant="outline" className={at.passed ? "border-green-300 text-green-700" : "border-red-300 text-red-600"}>{at.passed ? "Passed" : "Failed"}</Badge>
                        : <Badge variant="outline" className="border-amber-300 text-amber-700">{at.status}</Badge>}
                    </td>
                    <td className="py-2 text-muted-foreground">{at.completedAt ? new Date(at.completedAt).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function QuizResultsPage() {
  const { id, attemptId } = useParams<{ id: string; attemptId: string }>();
  const quizId = parseInt(id ?? "0");
  const attemptIdNum = parseInt(attemptId ?? "0");
  if (!attemptIdNum) return <AdminAnalyticsView quizId={quizId} />;
  return <StudentResultsView quizId={quizId} attemptId={attemptIdNum} />;
}
