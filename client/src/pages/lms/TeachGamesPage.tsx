import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Gamepad2, Plus, Play, Save, Trash2, ChevronLeft, Users, Clock3, CircleHelp, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type GameStatus = "draft" | "published" | "archived";

const initialGame = { title: "", description: "", category: "General", timeLimitSeconds: 20 };
const initialQuestion = { question: "", options: ["", ""], correctAnswer: 0, explanation: "", mediaUrl: "", mediaType: "", timeLimitSeconds: "", points: 100 };

function statusLabel(status: GameStatus) {
  if (status === "published") return "Published";
  if (status === "archived") return "Archived";
  return "Draft";
}

export default function TeachGamesPage() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [gameDraft, setGameDraft] = useState(initialGame);
  const [questionDraft, setQuestionDraft] = useState(initialQuestion);
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
  const [joinCode, setJoinCode] = useState<string | null>(null);

  const { data: games, isLoading } = trpc.teachGames.listGames.useQuery({ status: "all" });
  const { data: gameData, isLoading: isGameLoading } = trpc.teachGames.getGame.useQuery(
    { gameId: selectedGameId ?? 0 },
    { enabled: selectedGameId !== null },
  );

  const createGame = trpc.teachGames.createGame.useMutation({
    onSuccess: ({ gameId }) => {
      utils.teachGames.listGames.invalidate();
      setSelectedGameId(gameId);
      setShowCreate(false);
      setGameDraft(initialGame);
      toast.success("Teach game created");
    },
    onError: (error) => toast.error(error.message),
  });
  const updateGame = trpc.teachGames.updateGame.useMutation({
    onSuccess: () => {
      utils.teachGames.getGame.invalidate();
      utils.teachGames.listGames.invalidate();
      toast.success("Teach game saved");
    },
    onError: (error) => toast.error(error.message),
  });
  const deleteGame = trpc.teachGames.deleteGame.useMutation({
    onSuccess: () => {
      utils.teachGames.listGames.invalidate();
      setSelectedGameId(null);
      toast.success("Teach game deleted");
    },
    onError: (error) => toast.error(error.message),
  });
  const saveQuestion = trpc.teachGames.upsertQuestion.useMutation({
    onSuccess: () => {
      utils.teachGames.getGame.invalidate();
      setQuestionDraft(initialQuestion);
      setEditingQuestionId(null);
      toast.success("Question saved");
    },
    onError: (error) => toast.error(error.message),
  });
  const deleteQuestion = trpc.teachGames.deleteQuestion.useMutation({
    onSuccess: () => {
      utils.teachGames.getGame.invalidate();
      toast.success("Question deleted");
    },
    onError: (error) => toast.error(error.message),
  });
  const createSession = trpc.teachGames.createSession.useMutation({
    onSuccess: ({ sessionId, joinCode: createdJoinCode }) => {
      setJoinCode(createdJoinCode);
      toast.success("Live Teach game lobby created");
      navigate(`/teach-games/host/${sessionId}`);
    },
    onError: (error) => toast.error(error.message),
  });

  const selectedGame = gameData?.game;
  const questions = gameData?.questions ?? [];
  const canHost = Boolean(selectedGame && questions.length > 0);
  const questionOptions = useMemo(() => questionDraft.options.map((value, index) => ({ index, value })), [questionDraft.options]);

  useEffect(() => {
    if (!selectedGame) return;
    setGameDraft({
      title: selectedGame.title,
      description: selectedGame.description ?? "",
      category: selectedGame.category,
      timeLimitSeconds: selectedGame.timeLimitSeconds,
    });
  }, [selectedGame?.id]);

  const beginQuestionEdit = (question: typeof questions[number]) => {
    const parsedOptions = JSON.parse(question.options) as string[];
    setEditingQuestionId(question.id);
    setQuestionDraft({
      question: question.question,
      options: parsedOptions,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation ?? "",
      mediaUrl: question.mediaUrl ?? "",
      mediaType: question.mediaType ?? "",
      timeLimitSeconds: question.timeLimitSeconds ? String(question.timeLimitSeconds) : "",
      points: question.points,
    });
  };

  if (selectedGameId !== null) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button onClick={() => { setSelectedGameId(null); setJoinCode(null); }} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-[var(--org-primary)]">
            <ChevronLeft className="h-4 w-4" /> All Teach Games
          </button>
          {selectedGame && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-[color-mix(in_srgb,var(--org-primary)_35%,transparent)] bg-[color-mix(in_srgb,var(--org-primary)_10%,transparent)] text-[var(--org-primary)]">
                {statusLabel(selectedGame.status)}
              </Badge>
              <Button variant="outline" size="sm" onClick={() => updateGame.mutate({ gameId: selectedGame.id, status: selectedGame.status === "published" ? "draft" : "published" })}>
                {selectedGame.status === "published" ? "Unpublish" : "Publish"}
              </Button>
              <Button size="sm" className="org-primary-button" disabled={!canHost || createSession.isPending} onClick={() => createSession.mutate({ gameId: selectedGame.id })}>
                <Play className="mr-1.5 h-4 w-4" /> Host live game
              </Button>
            </div>
          )}
        </div>

        {isGameLoading || !selectedGame ? (
          <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">Loading Teach game…</CardContent></Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Gamepad2 className="h-5 w-5 text-[var(--org-primary)]" /> Game details</CardTitle>
                <CardDescription>These settings and questions belong only to the selected organization.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2"><Label htmlFor="teach-game-title">Title</Label><Input id="teach-game-title" value={gameDraft.title} onChange={(event) => setGameDraft((draft) => ({ ...draft, title: event.target.value }))} /></div>
                <div className="space-y-2"><Label htmlFor="teach-game-category">Category</Label><Input id="teach-game-category" value={gameDraft.category} onChange={(event) => setGameDraft((draft) => ({ ...draft, category: event.target.value }))} /></div>
                <div className="space-y-2"><Label htmlFor="teach-game-timer">Default question time (seconds)</Label><Input id="teach-game-timer" type="number" min={5} max={600} value={gameDraft.timeLimitSeconds} onChange={(event) => setGameDraft((draft) => ({ ...draft, timeLimitSeconds: Number(event.target.value) || 20 }))} /></div>
                <div className="space-y-2 md:col-span-2"><Label htmlFor="teach-game-description">Description</Label><Textarea id="teach-game-description" value={gameDraft.description} onChange={(event) => setGameDraft((draft) => ({ ...draft, description: event.target.value }))} /></div>
                <div className="flex flex-wrap items-center justify-between gap-3 md:col-span-2">
                  <p className="text-sm text-muted-foreground">{questions.length} question{questions.length === 1 ? "" : "s"} available for play.</p>
                  <div className="flex gap-2">
                    <Button variant="outline" className="text-destructive hover:bg-destructive/10" onClick={() => { if (window.confirm("Delete this Teach game and all of its questions and session records?")) deleteGame.mutate({ gameId: selectedGame.id }); }}><Trash2 className="mr-1.5 h-4 w-4" /> Delete</Button>
                    <Button className="org-primary-button" disabled={updateGame.isPending || !gameDraft.title.trim()} onClick={() => updateGame.mutate({ gameId: selectedGame.id, ...gameDraft })}><Save className="mr-1.5 h-4 w-4" /> Save details</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><CircleHelp className="h-5 w-5 text-[var(--org-primary)]" /> Questions</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {!questions.length ? <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Add questions to make this Teach game ready to host.</p> : questions.map((question, index) => (
                    <div key={question.id} className="rounded-xl border p-4 transition-colors hover:border-[color-mix(in_srgb,var(--org-primary)_35%,transparent)]">
                      <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-[var(--org-primary)]">Question {index + 1}</p><p className="mt-1 font-medium">{question.question}</p><p className="mt-1 text-xs text-muted-foreground">{question.points} points · {question.timeLimitSeconds ?? selectedGame.timeLimitSeconds} seconds</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => beginQuestionEdit(question)}>Edit</Button><Button size="icon" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => { if (window.confirm("Delete this question?")) deleteQuestion.mutate({ gameId: selectedGame.id, questionId: question.id }); }}><Trash2 className="h-4 w-4" /></Button></div></div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="h-fit">
                <CardHeader><CardTitle>{editingQuestionId ? "Edit question" : "Add question"}</CardTitle><CardDescription>Options and media can be changed before publishing the game.</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2"><Label>Question</Label><Textarea value={questionDraft.question} onChange={(event) => setQuestionDraft((draft) => ({ ...draft, question: event.target.value }))} placeholder="Enter a question" /></div>
                  <div className="space-y-2"><Label>Answer options</Label>{questionOptions.map(({ index, value }) => <div key={index} className="flex items-center gap-2"><input type="radio" aria-label={`Correct answer option ${index + 1}`} checked={questionDraft.correctAnswer === index} onChange={() => setQuestionDraft((draft) => ({ ...draft, correctAnswer: index }))} className="accent-[var(--org-primary)]" /><Input value={value} placeholder={`Option ${index + 1}`} onChange={(event) => setQuestionDraft((draft) => ({ ...draft, options: draft.options.map((option, optionIndex) => optionIndex === index ? event.target.value : option) }))} /></div>)}</div>
                  <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label>Points</Label><Input type="number" min={10} value={questionDraft.points} onChange={(event) => setQuestionDraft((draft) => ({ ...draft, points: Number(event.target.value) || 100 }))} /></div><div className="space-y-2"><Label>Time override</Label><Input type="number" min={5} placeholder="Default" value={questionDraft.timeLimitSeconds} onChange={(event) => setQuestionDraft((draft) => ({ ...draft, timeLimitSeconds: event.target.value }))} /></div></div>
                  <div className="grid gap-3 sm:grid-cols-[1fr_140px]"><div className="space-y-2"><Label>Media URL (optional)</Label><Input type="url" value={questionDraft.mediaUrl} placeholder="https://…" onChange={(event) => setQuestionDraft((draft) => ({ ...draft, mediaUrl: event.target.value }))} /></div><div className="space-y-2"><Label>Media type</Label><select value={questionDraft.mediaType} onChange={(event) => setQuestionDraft((draft) => ({ ...draft, mediaType: event.target.value }))} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">None</option><option value="image">Image</option><option value="video">Video</option><option value="gif">GIF</option></select></div></div>
                  <div className="space-y-2"><Label>Explanation (optional)</Label><Textarea value={questionDraft.explanation} onChange={(event) => setQuestionDraft((draft) => ({ ...draft, explanation: event.target.value }))} /></div>
                  <div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={() => { setQuestionDraft(initialQuestion); setEditingQuestionId(null); }}>Clear</Button><Button className="flex-1 org-primary-button" disabled={saveQuestion.isPending || !questionDraft.question.trim() || questionDraft.options.some((option) => !option.trim())} onClick={() => saveQuestion.mutate({ gameId: selectedGame.id, questionId: editingQuestionId ?? undefined, question: questionDraft.question, options: questionDraft.options, correctAnswer: questionDraft.correctAnswer, explanation: questionDraft.explanation || undefined, mediaUrl: questionDraft.mediaUrl || undefined, mediaType: questionDraft.mediaType ? questionDraft.mediaType as "image" | "video" | "gif" : undefined, timeLimitSeconds: questionDraft.timeLimitSeconds ? Number(questionDraft.timeLimitSeconds) : undefined, points: questionDraft.points, sortOrder: editingQuestionId ? (questions.find((question) => question.id === editingQuestionId)?.sortOrder ?? 0) : questions.length })}>{editingQuestionId ? "Save question" : "Add question"}</Button></div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
        {joinCode && <p className="sr-only">Live game join code: {joinCode}</p>}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><Link href="/lms/manage" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-[var(--org-primary)]"><ChevronLeft className="h-4 w-4" /> LMS Management</Link><h1 className="mt-2 text-2xl font-bold tracking-tight">Teach Games</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Create and host live knowledge games for the currently selected organization.</p></div><Button className="org-primary-button" onClick={() => setShowCreate(true)}><Plus className="mr-1.5 h-4 w-4" /> New game</Button></div>
      {showCreate && <Card className="border-[color-mix(in_srgb,var(--org-primary)_35%,transparent)]"><CardHeader><CardTitle>New Teach Game</CardTitle><CardDescription>A draft is created in the active organization and remains private until you publish it.</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><div className="space-y-2 md:col-span-2"><Label>Title</Label><Input autoFocus value={gameDraft.title} onChange={(event) => setGameDraft((draft) => ({ ...draft, title: event.target.value }))} placeholder="Game title" /></div><div className="space-y-2"><Label>Category</Label><Input value={gameDraft.category} onChange={(event) => setGameDraft((draft) => ({ ...draft, category: event.target.value }))} /></div><div className="space-y-2"><Label>Question time (seconds)</Label><Input type="number" min={5} max={600} value={gameDraft.timeLimitSeconds} onChange={(event) => setGameDraft((draft) => ({ ...draft, timeLimitSeconds: Number(event.target.value) || 20 }))} /></div><div className="space-y-2 md:col-span-2"><Label>Description</Label><Textarea value={gameDraft.description} onChange={(event) => setGameDraft((draft) => ({ ...draft, description: event.target.value }))} /></div><div className="flex justify-end gap-2 md:col-span-2"><Button variant="outline" onClick={() => { setShowCreate(false); setGameDraft(initialGame); }}>Cancel</Button><Button className="org-primary-button" disabled={createGame.isPending || !gameDraft.title.trim()} onClick={() => createGame.mutate(gameDraft)}>Create draft</Button></div></CardContent></Card>}
      {isLoading ? <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">Loading Teach games…</CardContent></Card> : !games?.length ? <Card><CardContent className="py-16 text-center"><Gamepad2 className="mx-auto h-10 w-10 text-[var(--org-primary)]" /><h2 className="mt-4 font-semibold">No Teach games yet</h2><p className="mt-1 text-sm text-muted-foreground">Start a new game to build an organization-owned live activity.</p></CardContent></Card> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{games.map((game) => <Card key={game.id} className="group transition-all hover:border-[color-mix(in_srgb,var(--org-primary)_35%,transparent)] hover:shadow-sm"><CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><Gamepad2 className="h-5 w-5 text-[var(--org-primary)]" /><Badge variant="outline" className="capitalize">{statusLabel(game.status)}</Badge></div><CardTitle className="pt-3 text-lg">{game.title}</CardTitle><CardDescription className="line-clamp-2">{game.description || "No description provided."}</CardDescription></CardHeader><CardContent className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><CircleHelp className="h-3.5 w-3.5" /> {game.questionCount} questions</span><span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" /> {game.timeLimitSeconds}s</span><Button size="sm" variant="outline" onClick={() => setSelectedGameId(game.id)}>Manage</Button></CardContent></Card>)}</div>}
      <Card className="bg-[color-mix(in_srgb,var(--org-primary)_6%,transparent)]"><CardContent className="flex flex-wrap items-center gap-3 py-4 text-sm text-muted-foreground"><Users className="h-4 w-4 text-[var(--org-primary)]" /> Live hosts, questions, sessions, participant scores, and answer records are separated by the selected organization.</CardContent></Card>
    </div>
  );
}
