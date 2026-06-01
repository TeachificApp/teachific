import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Clock, Download, Plus, Star, Trash2, Upload, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function QuizzesPage() {
  const [, setLocation] = useLocation();
  const { data: myOrgs } = trpc.orgs.myOrgs.useQuery();
  const orgId = myOrgs?.[0]?.id ?? 0;
  const { data: quizzes, isLoading, refetch } = trpc.quizzes.list.useQuery({ orgId }, { enabled: !!orgId });
  const deleteQuiz = trpc.quizzes.delete.useMutation({ onSuccess: () => { toast.success("Quiz deleted"); refetch(); } });

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xls,.xlsx";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/quiz/import/preview", { method: "POST", body: fd });
      const data = await res.json();
      if (data.questions) {
        toast.success(`Imported ${data.questions.length} questions — open Quiz Builder to save`);
        setLocation("/quizzes/new?import=1");
      } else {
        toast.error("Import failed: " + (data.error ?? "Unknown error"));
      }
    };
    input.click();
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quizzes</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{quizzes?.length ?? 0} quizzes total</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleImport} className="gap-2"><Upload className="h-4 w-4" />Import Excel</Button>
          <Button onClick={() => setLocation("/quizzes/new")} className="gap-2"><Plus className="h-4 w-4" />Create Quiz</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>)}</div>
      ) : !quizzes || quizzes.length === 0 ? (
        <Card className="shadow-sm border-border/60">
          <CardContent className="py-16 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="font-medium text-muted-foreground">No quizzes yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Create a quiz manually or import from Excel</p>
            <div className="flex gap-3 justify-center mt-4">
              <Button size="sm" variant="outline" onClick={handleImport} className="gap-2"><Upload className="h-3.5 w-3.5" />Import Excel</Button>
              <Button size="sm" onClick={() => setLocation("/quizzes/new")} className="gap-2"><Plus className="h-3.5 w-3.5" />Create Quiz</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {quizzes.map((quiz) => (
            <Card key={quiz.id} className="shadow-sm border-border/60 hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                    <BookOpen className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold">{quiz.title}</h3>
                        {quiz.description && <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{quiz.description}</p>}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="sm" variant="outline" onClick={() => setLocation(`/quizzes/${quiz.id}/play`)}>Play</Button>
                        <Button size="sm" variant="outline" onClick={() => setLocation(`/quizzes/${quiz.id}`)}>Edit</Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteQuiz.mutate({ id: quiz.id })}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" />{(quiz as any).questionCount ?? 0} questions</span>
                      {quiz.passingScore && <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5" />Pass: {quiz.passingScore}%</span>}
                      {quiz.timeLimit && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{quiz.timeLimit} min</span>}
                      {quiz.maxAttempts && <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />Max {quiz.maxAttempts} attempts</span>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="shadow-sm border-border/60 bg-muted/30">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Export Quiz Template</p>
              <p className="text-xs text-muted-foreground">Download the Excel template to create questions offline</p>
            </div>
            <Button variant="outline" size="sm" asChild className="gap-2">
              <a href="/api/quiz/template" download="QuizTemplate.xlsx"><Download className="h-3.5 w-3.5" />Download Template</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
