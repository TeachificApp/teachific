import { useMemo } from "react";
import { useLocation, useParams } from "wouter";
import { Copy, Gamepad2, Play, SkipForward, Square, Users, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function TeachGameHostPage() {
  const [, navigate] = useLocation();
  const { sessionId: sessionIdParam } = useParams<{ sessionId: string }>();
  const sessionId = Number(sessionIdParam);
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.teachGames.getSession.useQuery({ sessionId }, { enabled: Number.isFinite(sessionId) && sessionId > 0, refetchInterval: 1_000 });
  const startSession = trpc.teachGames.startSession.useMutation({ onSuccess: () => utils.teachGames.getSession.invalidate(), onError: (error) => toast.error(error.message) });
  const advanceSession = trpc.teachGames.advanceSession.useMutation({ onSuccess: () => utils.teachGames.getSession.invalidate(), onError: (error) => toast.error(error.message) });
  const endSession = trpc.teachGames.endSession.useMutation({ onSuccess: () => { utils.teachGames.getSession.invalidate(); toast.success("Teach game ended"); }, onError: (error) => toast.error(error.message) });
  const snapshot = useMemo(() => {
    try { return data?.session?.gameSnapshot ? JSON.parse(data.session.gameSnapshot) as { game?: any; questions?: any[] } : null; } catch { return null; }
  }, [data?.session?.gameSnapshot]);
  const currentQuestion = snapshot?.questions?.[data?.session?.currentQuestionIndex ?? 0];
  const joinUrl = typeof window === "undefined" || !data ? "" : `${window.location.origin}/teach-games/join/${data.session.joinCode}`;

  if (isLoading || !data) return <div className="flex min-h-80 items-center justify-center text-sm text-muted-foreground">Loading live Teach game…</div>;
  const { session, participants } = data;
  const canAdvance = session.status === "active";

  return <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><button onClick={() => navigate("/lms/teach-games")} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-[var(--org-primary)]"><ChevronLeft className="h-4 w-4" /> Teach Games</button><Badge variant="outline" className="capitalize">{session.status}</Badge></div>
    <Card className="border-[color-mix(in_srgb,var(--org-primary)_35%,transparent)]"><CardHeader><CardTitle className="flex items-center gap-2"><Gamepad2 className="h-5 w-5 text-[var(--org-primary)]" /> {snapshot?.game?.title ?? "Teach Game"}</CardTitle><CardDescription>Host controls and scores are available only within the active organization.</CardDescription></CardHeader><CardContent className="grid gap-5 md:grid-cols-[1fr_auto]"><div><p className="text-sm text-muted-foreground">Participants join at the link below using this session code.</p><div className="mt-3 flex flex-wrap items-center gap-2"><code className="rounded-lg bg-[color-mix(in_srgb,var(--org-primary)_10%,transparent)] px-4 py-2 text-xl font-bold tracking-[0.2em] text-[var(--org-primary)]">{session.joinCode}</code><Button variant="outline" size="sm" onClick={async () => { await navigator.clipboard.writeText(joinUrl); toast.success("Join link copied"); }}><Copy className="mr-1.5 h-4 w-4" /> Copy join link</Button></div></div><div className="flex flex-wrap items-center gap-2"><Button className="org-primary-button" disabled={session.status !== "lobby" || startSession.isPending} onClick={() => startSession.mutate({ sessionId })}><Play className="mr-1.5 h-4 w-4" /> Start</Button><Button variant="outline" disabled={!canAdvance || advanceSession.isPending} onClick={() => advanceSession.mutate({ sessionId })}><SkipForward className="mr-1.5 h-4 w-4" /> {currentQuestion && (data.session.currentQuestionIndex ?? 0) + 1 >= (snapshot?.questions?.length ?? 0) ? "Finish" : "Next"}</Button><Button variant="outline" className="text-destructive hover:bg-destructive/10" disabled={session.status === "ended" || endSession.isPending} onClick={() => endSession.mutate({ sessionId })}><Square className="mr-1.5 h-4 w-4" /> End</Button></div></CardContent></Card>
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]"><Card><CardHeader><CardTitle>Current game state</CardTitle></CardHeader><CardContent>{session.status === "lobby" ? <p className="text-sm text-muted-foreground">The game lobby is open. Start when participants are ready.</p> : session.status === "ended" ? <p className="text-sm text-muted-foreground">The session has ended. Final scores are listed alongside.</p> : currentQuestion ? <div className="space-y-3"><p className="text-xs font-semibold text-[var(--org-primary)]">Question {(session.currentQuestionIndex ?? 0) + 1} of {snapshot?.questions?.length ?? 0}</p><h2 className="text-xl font-semibold">{currentQuestion.question}</h2><div className="grid gap-2 sm:grid-cols-2">{JSON.parse(currentQuestion.options).map((option: string, index: number) => <div key={index} className="rounded-lg border p-3 text-sm"><span className="mr-2 font-semibold text-[var(--org-primary)]">{String.fromCharCode(65 + index)}.</span>{option}</div>)}</div></div> : <p className="text-sm text-muted-foreground">Waiting for the game state…</p>}</CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-[var(--org-primary)]" /> Participants</CardTitle><CardDescription>{participants.length} participant{participants.length === 1 ? "" : "s"}</CardDescription></CardHeader><CardContent className="space-y-2">{!participants.length ? <p className="text-sm text-muted-foreground">No participants have joined yet.</p> : participants.map((participant, index) => <div key={participant.id} className="flex items-center justify-between rounded-lg border px-3 py-2"><span className="text-sm"><span className="mr-2 text-muted-foreground">{index + 1}</span>{participant.displayName}</span><strong className="text-sm text-[var(--org-primary)]">{participant.totalScore}</strong></div>)}</CardContent></Card></div>
  </div>;
}
