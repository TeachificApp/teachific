import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink, PlayCircle } from "lucide-react";
import { useRoute, useLocation } from "wouter";

function getReplaySource(url: string): { kind: "video" | "iframe"; src: string } {
  if (/\.(mp4|webm|ogg|mov)([?#]|$)/i.test(url)) return { kind: "video", src: url };
  const youtube = url.match(/(?:[?&]v=|youtu\.be\/|youtube\.com\/(?:shorts\/|embed\/))([-\w]+)/);
  if (youtube) return { kind: "iframe", src: `https://www.youtube.com/embed/${youtube[1]}?rel=0` };
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return { kind: "iframe", src: `https://player.vimeo.com/video/${vimeo[1]}` };
  return { kind: "iframe", src: url };
}

export default function CohortReplay() {
  const [, params] = useRoute("/cohort/:courseId/replay/:recordingId");
  const [, navigate] = useLocation();
  const courseId = Number(params?.courseId ?? 0);
  const recordingId = Number(params?.recordingId ?? 0);
  const { data, isLoading, error } = trpc.lmsLearner.getCohortSchedule.useQuery(
    { courseId },
    { enabled: Number.isInteger(courseId) && courseId > 0 },
  );

  const recording = data?.recordings?.find((item: any) => item.id === recordingId) as any;
  const recordingUrl = recording?.videoUrl || recording?.recordingUrl || "";
  const replay = recordingUrl ? getReplaySource(recordingUrl) : null;

  if (isLoading) {
    return <div className="min-h-screen grid place-items-center bg-slate-950"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--org-primary)] border-t-transparent" /></div>;
  }

  if (error || !recording) {
    return (
      <main className="min-h-screen grid place-items-center bg-slate-950 p-6 text-center text-white">
        <div className="max-w-md space-y-4">
          <PlayCircle className="mx-auto h-10 w-10 text-[var(--org-primary)]" />
          <h1 className="text-xl font-semibold">Replay unavailable</h1>
          <p className="text-sm text-slate-300">This replay is unavailable, unpublished, or not assigned to your cohort.</p>
          <Button onClick={() => navigate(`/cohort/${courseId}`)} className="org-primary-button"><ArrowLeft className="mr-2 h-4 w-4" />Back to cohort</Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="flex items-center gap-3 border-b border-white/10 bg-slate-900 px-4 py-3">
        <Button variant="ghost" size="sm" className="text-slate-200 hover:bg-white/10 hover:text-white" onClick={() => navigate(`/cohort/${courseId}`)}><ArrowLeft className="mr-1 h-4 w-4" />Back</Button>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{recording.title}</p><p className="truncate text-xs text-slate-400">{data?.course?.title}</p></div>
        {recordingUrl && <a href={recordingUrl} target="_blank" rel="noopener noreferrer"><Button variant="ghost" size="icon" className="text-slate-200 hover:bg-white/10 hover:text-white" aria-label="Open replay in a new tab"><ExternalLink className="h-4 w-4" /></Button></a>}
      </header>
      <section className="mx-auto max-w-6xl p-4 sm:p-6">
        {replay ? (
          <div className="aspect-video overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl">
            {replay.kind === "video" ? <video src={replay.src} controls autoPlay className="h-full w-full" /> : <iframe src={replay.src} title={recording.title} className="h-full w-full border-0" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />}
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-slate-900 p-8 text-center text-sm text-slate-300">A replay file has not been attached yet.</div>
        )}
        {recording.description && <p className="mx-auto mt-5 max-w-4xl whitespace-pre-wrap text-sm leading-6 text-slate-300">{recording.description}</p>}
      </section>
    </main>
  );
}
