import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { getSubdomain } from "@/hooks/useSubdomain";
import { getOrgBaseUrl } from "@/lib/orgUrl";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { RichTextContent } from "@/components/RichTextEditor";
import { BANNER_SOUNDS } from "@/lib/bannerSounds";
import { fireConfetti } from "@/components/lms/LessonBannerEditor";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  CheckCircle2, Circle, PlayCircle, FileText, Headphones,
  FileDown, Link2, Video, BookOpen, ClipboardList, Zap,
  Calendar, Home, Menu, X, Maximize2, Settings,
  RotateCcw, Lock, Clock, Search, StickyNote, Award, Download,
  Bookmark, BookmarkCheck, PenLine, Trash2, Edit3,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

// ─── Lesson Banner ────────────────────────────────────────────────────────────
function playBannerSound(soundId: string) {
  const sound = BANNER_SOUNDS.find((s: { id: string; url: string }) => s.id === soundId);
  if (!sound || !sound.url) return;
  try {
    const audio = new Audio(sound.url);
    audio.volume = 0.6;
    audio.play().catch(() => {});
  } catch {}
}

function LessonBanner({
  message,
  imageUrl,
  position,
  onDismiss,
  primaryColor,
}: {
  message: string;
  imageUrl?: string | null;
  position: "top" | "bottom" | "left";
  onDismiss: () => void;
  primaryColor: string;
}) {
  if (position === "left") {
    return (
      <div
        className="fixed left-4 top-1/2 -translate-y-1/2 z-50 w-72 rounded-2xl shadow-2xl border border-border bg-background p-4 flex flex-col gap-3 animate-in slide-in-from-left-4"
        style={{ borderLeftColor: primaryColor, borderLeftWidth: 4 }}
      >
        {imageUrl && (
          <img src={imageUrl} alt="" className="w-full rounded-lg object-cover max-h-32" />
        )}
        <p className="text-sm font-medium leading-snug">{message}</p>
        <button
          onClick={onDismiss}
          className="self-end text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Dismiss
        </button>
      </div>
    );
  }

  const isTop = position === "top";
  return (
    <div
      className={cn(
        "fixed left-0 right-0 z-50 flex items-center justify-between px-6 py-3 shadow-lg text-white text-sm font-medium",
        isTop ? "top-14 animate-in slide-in-from-top-2" : "bottom-0 animate-in slide-in-from-bottom-2"
      )}
      style={{ backgroundColor: primaryColor }}
    >
      <span>{message}</span>
      <button
        onClick={onDismiss}
        className="ml-4 opacity-80 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Lesson type icon ─────────────────────────────────────────────────────────
function LessonIcon({ type, className }: { type: string; className?: string }) {
  const cls = cn("h-4 w-4 shrink-0", className);
  switch (type) {
    case "video": return <PlayCircle className={cls} />;
    case "audio": return <Headphones className={cls} />;
    case "pdf": return <FileText className={cls} />;
    case "scorm": return <Zap className={cls} />;
    case "quiz": return <ClipboardList className={cls} />;
    case "flashcard": return <BookOpen className={cls} />;
    case "exam": return <ClipboardList className={cls} />;
    case "assignment": return <FileText className={cls} />;
    case "download": return <FileDown className={cls} />;
    case "weblink": return <Link2 className={cls} />;
    case "zoom": case "live": return <Video className={cls} />;
    default: return <FileText className={cls} />;
  }
}

// ─── SCORM API Bridge ─────────────────────────────────────────────────────────
const SCORM_SCRIPT = `(function(){var d={},i=false,f=false;function p(t,pl){window.parent.postMessage({source:'scorm-api',type:t,payload:pl},'*');}window.API={LMSInitialize:function(){i=true;p('initialize',{});return'true';},LMSFinish:function(){f=true;p('finish',{data:d});return'true';},LMSGetValue:function(k){return d[k]||'';},LMSSetValue:function(k,v){d[k]=v;p('setValue',{key:k,value:v});return'true';},LMSCommit:function(){p('commit',{data:d});return'true';},LMSGetLastError:function(){return'0';},LMSGetErrorString:function(){return'';},LMSGetDiagnostic:function(){return'';}};window.API_1484_11={Initialize:function(){i=true;p('initialize',{});return'true';},Terminate:function(){f=true;p('finish',{data:d});return'true';},GetValue:function(k){return d[k]||'';},SetValue:function(k,v){d[k]=v;p('setValue',{key:k,value:v});return'true';},Commit:function(){p('commit',{data:d});return'true';},GetLastError:function(){return'0';},GetErrorString:function(){return'';},GetDiagnostic:function(){return'';}};})();`;

// ─── Flashcard Component ──────────────────────────────────────────────────────
function FlashcardPlayer({ contentJson }: { contentJson?: string | null }) {
  const cards: Array<{ front: string; back: string }> = (() => {
    try { return contentJson ? JSON.parse(contentJson).cards || [] : []; } catch { return []; }
  })();
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  if (cards.length === 0) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">No flashcards available.</div>;
  }

  const card = cards[index];
  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <p className="text-sm text-muted-foreground">{index + 1} / {cards.length}</p>
      <div
        className="w-full max-w-lg min-h-[200px] cursor-pointer select-none"
        style={{ perspective: "1000px" }}
        onClick={() => setFlipped((f) => !f)}
      >
        <div
          className="relative w-full h-full transition-transform duration-500"
          style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 flex items-center justify-center p-8 rounded-2xl border-2 border-border bg-card text-card-foreground text-center text-lg font-medium shadow-md"
            style={{ backfaceVisibility: "hidden" }}
          >
            <RichTextContent html={card.front} />
          </div>
          {/* Back */}
          <div
            className="absolute inset-0 flex items-center justify-center p-8 rounded-2xl border-2 border-primary bg-primary/5 text-center text-lg shadow-md"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <RichTextContent html={card.back} />
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Click card to flip</p>
      <div className="flex gap-3">
        <Button variant="outline" size="sm" disabled={index === 0} onClick={() => { setIndex((i) => i - 1); setFlipped(false); }}>
          <ChevronLeft className="h-4 w-4" /> Previous
        </Button>
        <Button variant="outline" size="sm" disabled={index === cards.length - 1} onClick={() => { setIndex((i) => i + 1); setFlipped(false); }}>
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Quiz/Exam Component ──────────────────────────────────────────────────────
function QuizPlayer({
  contentJson, lessonType, onComplete,
}: {
  contentJson?: string | null;
  lessonType: string;
  onComplete?: (score: number, passed: boolean) => void;
}) {
  const data: { questions?: any[]; passingScore?: number; timeLimit?: number } = (() => {
    try { return contentJson ? JSON.parse(contentJson) : {}; } catch { return {}; }
  })();
  const questions = data.questions || [];
  const passingScore = data.passingScore ?? 70;
  const [answers, setAnswers] = useState<Record<number, string | string[]>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);

  if (questions.length === 0) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">No questions available.</div>;
  }

  const handleSubmit = () => {
    let correct = 0;
    questions.forEach((q: any, i: number) => {
      if (q.type === "multiple" && answers[i] === q.correct) correct++;
      else if (q.type === "truefalse" && answers[i] === q.correct) correct++;
    });
    const pct = Math.round((correct / questions.length) * 100);
    setScore(pct);
    setSubmitted(true);
    onComplete?.(pct, pct >= passingScore);
  };

  if (submitted) {
    const passed = score >= passingScore;
    return (
      <div className="flex flex-col items-center gap-6 py-12">
        <div className={cn("h-24 w-24 rounded-full flex items-center justify-center text-3xl font-bold text-white", passed ? "bg-green-500" : "bg-red-500")}>
          {score}%
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold">{passed ? "Congratulations!" : "Not quite there yet"}</p>
          <p className="text-muted-foreground mt-1">
            {passed ? `You passed with ${score}%` : `You scored ${score}%. Passing score is ${passingScore}%.`}
          </p>
        </div>
        <Button variant="outline" onClick={() => { setAnswers({}); setSubmitted(false); }}>
          <RotateCcw className="h-4 w-4 mr-2" /> Retake
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 py-4">
      {questions.map((q: any, i: number) => (
        <div key={i} className="flex flex-col gap-3">
          <div className="flex gap-2">
            <span className="text-muted-foreground text-sm font-medium shrink-0">{i + 1}.</span>
            <RichTextContent html={q.question} className="flex-1" />
          </div>
          {(q.type === "multiple" || q.type === "truefalse") && (
            <div className="flex flex-col gap-2 pl-6">
              {(q.options || (q.type === "truefalse" ? ["True", "False"] : [])).map((opt: string, j: number) => (
                <label key={j} className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                  answers[i] === opt ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                )}>
                  <input
                    type="radio"
                    name={`q-${i}`}
                    value={opt}
                    checked={answers[i] === opt}
                    onChange={() => setAnswers((a) => ({ ...a, [i]: opt }))}
                    className="accent-primary"
                  />
                  <span className="text-sm">{opt}</span>
                </label>
              ))}
            </div>
          )}
          {q.type === "short" && (
            <textarea
              className="w-full rounded-lg border border-border p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background"
              rows={3}
              placeholder="Your answer..."
              value={(answers[i] as string) || ""}
              onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))}
            />
          )}
        </div>
      ))}
      <Button
        onClick={handleSubmit}
        disabled={Object.keys(answers).length < questions.filter((q: any) => q.type !== "short").length}
        className="self-start"
      >
        Submit {lessonType === "exam" ? "Exam" : "Quiz"}
      </Button>
    </div>
  );
}

// ─── Lesson Content Renderer ──────────────────────────────────────────────────
function LessonContent({
  lesson, primaryColor, onComplete, packageProxyBase, watermark,
}: {
  lesson: any;
  primaryColor: string;
  onComplete?: () => void;
  packageProxyBase: string;
  watermark?: { url: string; opacity: number; size: number; position: string } | null;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Inject SCORM API into SCORM iframes
  useEffect(() => {
    if (lesson.lessonType !== "scorm" || !iframeRef.current) return;
    const iframe = iframeRef.current;
    const inject = () => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc) {
          const script = doc.createElement("script");
          script.text = SCORM_SCRIPT;
          doc.head?.appendChild(script);
        }
      } catch {}
    };
    iframe.addEventListener("load", inject);
    return () => iframe.removeEventListener("load", inject);
  }, [lesson]);

  const richTextAddOn = lesson.richTextAddOn;

  const renderMain = () => {
    switch (lesson.lessonType) {
      case "text":
        return (
          <div className="max-w-3xl mx-auto py-6">
            <RichTextContent html={lesson.contentJson || ""} className="text-base leading-relaxed" />
          </div>
        );

      case "video": {
        const url = lesson.videoUrl || "";
        let embedUrl = url;
        if (url.includes("youtube.com") || url.includes("youtu.be")) {
          const id = url.match(/(?:v=|youtu\.be\/)([^&?]+)/)?.[1];
          embedUrl = id ? `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1` : url;
        } else if (url.includes("vimeo.com")) {
          const id = url.match(/vimeo\.com\/(\d+)/)?.[1];
          embedUrl = id ? `https://player.vimeo.com/video/${id}` : url;
        }
        const wmPos = watermark?.position || "bottom-right";
        const wmStyle: React.CSSProperties = {
          width: `${watermark?.size || 80}px`,
          opacity: (watermark?.opacity || 30) / 100,
          ...(wmPos === "bottom-left" ? { bottom: "12px", left: "12px" } :
            wmPos === "bottom-right" ? { bottom: "12px", right: "12px" } :
            wmPos === "top-left" ? { top: "12px", left: "12px" } :
            wmPos === "top-right" ? { top: "12px", right: "12px" } :
            { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }),
        };
        return (
          <div className="flex flex-col gap-4">
            <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-lg">
              {url ? (
                <iframe src={embedUrl} className="w-full h-full" allowFullScreen allow="autoplay; fullscreen" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/50">
                  <PlayCircle className="h-16 w-16" />
                </div>
              )}
              {watermark?.url && (
                <img
                  src={watermark.url}
                  alt=""
                  className="absolute pointer-events-none select-none"
                  style={wmStyle}
                  draggable={false}
                />
              )}
            </div>
          </div>
        );
      }

      case "audio":
        return (
          <div className="max-w-2xl mx-auto py-8 flex flex-col gap-6 items-center">
            <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center">
              <Headphones className="h-12 w-12" style={{ color: primaryColor }} />
            </div>
            {lesson.audioUrl ? (
              <audio controls className="w-full" src={lesson.audioUrl}>
                Your browser does not support audio playback.
              </audio>
            ) : (
              <p className="text-muted-foreground">No audio file attached.</p>
            )}
          </div>
        );

      case "pdf":
        return (
          <div className="flex flex-col gap-3">
            {lesson.pdfUrl ? (
              <iframe
                src={`${lesson.pdfUrl}#toolbar=1&navpanes=0`}
                className="w-full rounded-xl border border-border shadow"
                style={{ height: "70vh" }}
                title={lesson.title}
              />
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">No PDF attached.</div>
            )}
          </div>
        );

      case "scorm":
        return (
          <div className="flex flex-col gap-3">
            {lesson.packageId ? (
              <iframe
                ref={iframeRef}
                src={`${packageProxyBase}/${lesson.packageId}`}
                className="w-full rounded-xl border border-border shadow"
                style={{ height: "70vh" }}
                title={lesson.title}
                allow="fullscreen"
              />
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">No SCORM package attached.</div>
            )}
          </div>
        );

      case "weblink":
        return (
          <div className="flex flex-col gap-3">
            {lesson.webLinkUrl ? (
              <iframe
                src={lesson.webLinkUrl}
                className="w-full rounded-xl border border-border shadow"
                style={{ height: "70vh" }}
                title={lesson.title}
                allow="fullscreen"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">No URL attached.</div>
            )}
          </div>
        );

      case "download":
        return (
          <div className="max-w-lg mx-auto py-12 flex flex-col items-center gap-6">
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
              <FileDown className="h-10 w-10" style={{ color: primaryColor }} />
            </div>
            <div className="text-center">
              <p className="font-semibold text-lg">{lesson.downloadFileName || lesson.title}</p>
              {lesson.contentJson && (
                <RichTextContent html={lesson.contentJson} className="mt-2 text-muted-foreground text-sm" />
              )}
            </div>
            {lesson.downloadUrl ? (
              <a href={lesson.downloadUrl} download target="_blank" rel="noopener noreferrer">
                <Button style={{ backgroundColor: primaryColor }}>
                  <FileDown className="h-4 w-4 mr-2" /> Download File
                </Button>
              </a>
            ) : (
              <p className="text-muted-foreground text-sm">No file attached.</p>
            )}
          </div>
        );

      case "flashcard":
        return <FlashcardPlayer contentJson={lesson.contentJson} />;

      case "quiz":
      case "exam":
        return (
          <div className="max-w-2xl mx-auto py-4">
            <QuizPlayer
              contentJson={lesson.contentJson}
              lessonType={lesson.lessonType}
              onComplete={(score, passed) => {
                if (passed) onComplete?.();
              }}
            />
          </div>
        );

      case "assignment":
        return (
          <div className="max-w-2xl mx-auto py-6 flex flex-col gap-6">
            {lesson.contentJson && (
              <div className="p-5 rounded-xl border border-border bg-muted/30">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Assignment Instructions</p>
                <RichTextContent html={lesson.contentJson} />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Your Submission</label>
              <textarea
                className="w-full rounded-lg border border-border p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background min-h-[160px]"
                placeholder="Type your response here, or paste a link to your work..."
              />
            </div>
            <Button style={{ backgroundColor: primaryColor }} className="self-start">
              Submit Assignment
            </Button>
          </div>
        );

      case "zoom":
      case "live": {
        const session = (() => {
          try { return lesson.liveSessionJson ? JSON.parse(lesson.liveSessionJson) : null; } catch { return null; }
        })();
        return (
          <div className="max-w-lg mx-auto py-12 flex flex-col items-center gap-6">
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Video className="h-10 w-10" style={{ color: primaryColor }} />
            </div>
            <div className="text-center flex flex-col gap-2">
              <p className="font-semibold text-lg">Live Session</p>
              {session?.platform && (
                <Badge variant="outline" className="capitalize self-center">{session.platform}</Badge>
              )}
              {session?.scheduledAt && (
                <p className="text-muted-foreground text-sm flex items-center gap-1 justify-center">
                  <Calendar className="h-4 w-4" />
                  {new Date(session.scheduledAt).toLocaleString()}
                </p>
              )}
              {session?.duration && (
                <p className="text-muted-foreground text-sm flex items-center gap-1 justify-center">
                  <Clock className="h-4 w-4" />
                  {session.duration} minutes
                </p>
              )}
            </div>
            {session?.meetingUrl ? (
              <a href={session.meetingUrl} target="_blank" rel="noopener noreferrer">
                <Button style={{ backgroundColor: primaryColor }}>
                  <Video className="h-4 w-4 mr-2" /> Join Meeting
                </Button>
              </a>
            ) : (
              <p className="text-muted-foreground text-sm">Meeting link not yet available.</p>
            )}
          </div>
        );
      }

      default:
        return (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            Lesson content not available.
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {renderMain()}
      {/* Rich text add-on section — shown for all lesson types if content exists */}
      {richTextAddOn && (
        <div className="border-t border-border pt-6 mt-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Additional Notes</p>
          <RichTextContent html={richTextAddOn} className="max-w-3xl" />
        </div>
      )}
    </div>
  );
}

// ─── Course Player Page ───────────────────────────────────────────────────────
export default function CoursePlayerPage() {
  const params = useParams<{ courseId: string; lessonId?: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const courseId = parseInt(params.courseId);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Record<number, boolean>>({});
  const [currentLessonId, setCurrentLessonId] = useState<number | null>(
    params.lessonId ? parseInt(params.lessonId) : null
  );
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [notesTab, setNotesTab] = useState<"current" | "all" | "bookmarks">("current");
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");

  const [showCompletion, setShowCompletion] = useState(false);
  const [activeBanner, setActiveBanner] = useState<{
    message: string;
    imageUrl?: string | null;
    position: "top" | "bottom" | "left";
    sound?: string | null;
    customSoundUrl?: string | null;
    confetti?: boolean | null;
    confettiStyle?: string | null;
    durationMs: number;
  } | null>(null);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: course } = trpc.lms.courses.get.useQuery({ id: courseId });
  const { data: curriculum } = trpc.lms.curriculum.get.useQuery({ courseId });
  const { data: progressData } = trpc.lms.enrollments.progress.useQuery({ courseId }, { enabled: !!user });
  const { data: orgs } = trpc.orgs.myOrgs.useQuery();
  const orgId = orgs?.[0]?.id;
  const { data: theme } = trpc.lms.themes.get.useQuery({ orgId: orgId! }, { enabled: !!orgId });

  const updateProgress = trpc.lms.enrollments.updateLessonProgress.useMutation();
  const utils = trpc.useUtils();

  const primaryColor = course?.playerThemeColor || theme?.primaryColor || "#24abbc";

  // Flatten all lessons for prev/next navigation
  const allLessons = (curriculum || []).flatMap((s: any) => s.lessons || []);
  const currentLesson = allLessons.find((l: any) => l.id === currentLessonId) || allLessons[0] || null;
  const currentIndex = allLessons.findIndex((l: any) => l.id === currentLesson?.id);
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

  // DB-backed notes and bookmarks (declared after currentLesson to avoid TDZ error)
  const { data: currentLessonNotes, refetch: refetchLessonNotes } = trpc.lms.notes.byLesson.useQuery(
    { lessonId: currentLesson?.id ?? 0, courseId },
    { enabled: !!currentLesson && notesOpen }
  );
  const { data: allCourseNotes, refetch: refetchAllNotes } = trpc.lms.notes.byCourse.useQuery(
    { courseId },
    { enabled: notesOpen && notesTab === "all" }
  );
  const { data: courseBookmarks, refetch: refetchBookmarks } = trpc.lms.bookmarks.byCourse.useQuery(
    { courseId },
    { enabled: notesOpen }
  );
  const createNote = trpc.lms.notes.create.useMutation({
    onSuccess: () => { refetchLessonNotes(); refetchAllNotes(); setNoteText(""); },
  });
  const updateNoteM = trpc.lms.notes.update.useMutation({
    onSuccess: () => { refetchLessonNotes(); refetchAllNotes(); setEditingNoteId(null); },
  });
  const deleteNoteM = trpc.lms.notes.delete.useMutation({
    onSuccess: () => { refetchLessonNotes(); refetchAllNotes(); },
  });
  const toggleBookmark = trpc.lms.bookmarks.toggle.useMutation({
    onSuccess: () => refetchBookmarks(),
  });
  const isBookmarked = (courseBookmarks ?? []).some((b: any) => b.lessonId === currentLesson?.id);

  // Auto-expand section containing current lesson
  useEffect(() => {
    if (!currentLesson || !curriculum) return;
    const sectionIndex = (curriculum as any[]).findIndex((s: any) =>
      s.lessons?.some((l: any) => l.id === currentLesson.id)
    );
    if (sectionIndex >= 0) {
      setExpandedSections((prev) => ({ ...prev, [sectionIndex]: true }));
    }
  }, [currentLesson?.id, curriculum]);

  // Set first lesson on load
  useEffect(() => {
    if (!currentLessonId && allLessons.length > 0) {
      setCurrentLessonId(allLessons[0].id);
    }
  }, [allLessons.length]);

  const lessonProgress = progressData?.lessonProgress || [];
  const getLessonStatus = (lessonId: number) =>
    lessonProgress.find((p: any) => p.lessonId === lessonId)?.status || "not_started";

  // ── Prerequisite gating ──────────────────────────────────────────────────
  // A lesson is locked if any earlier lesson in the flat list has isPrerequisite=true
  // and that prerequisite lesson has NOT been completed yet.
  const isLessonLocked = (lessonId: number): boolean => {
    const idx = allLessons.findIndex((l: any) => l.id === lessonId);
    if (idx <= 0) return false; // first lesson is never locked
    // Check drip lock
    const lesson = allLessons[idx] as any;
    if (lesson?.isDripLocked) return true;
    // Walk backwards through all lessons before this one
    for (let i = 0; i < idx; i++) {
      const prev = allLessons[i] as any;
      if (!prev.isPrerequisite) continue;
      const prevStatus = getLessonStatus(prev.id);
      if (prevStatus !== "completed") return true; // prerequisite not met
    }
    return false;
  };

  // Format unlock date for display
  const getDripUnlockLabel = (lesson: any): string | null => {
    if (!lesson?.isDripLocked || !lesson?.unlocksAt) return null;
    const unlockDate = new Date(lesson.unlocksAt);
    const now = new Date();
    const diffMs = unlockDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return null;
    if (diffDays === 1) return "Unlocks tomorrow";
    if (diffDays <= 7) return `Unlocks in ${diffDays} days`;
    return `Unlocks ${unlockDate.toLocaleDateString()}`;
  };

  // Show a banner and auto-dismiss after durationMs
  const showBanner = useCallback((banner: typeof activeBanner) => {
    if (!banner) return;
    setActiveBanner(banner);
    // Play sound
    if (banner.sound && banner.sound !== "none") {
      if (banner.sound === "custom" && banner.customSoundUrl) {
        try { const a = new Audio(banner.customSoundUrl); a.volume = 0.6; a.play().catch(() => {}); } catch {}
      } else {
        playBannerSound(banner.sound);
      }
    }
    // Fire confetti cannon
    if (banner.confetti) {
      fireConfetti((banner.confettiStyle as any) || "burst");
    }
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = setTimeout(() => setActiveBanner(null), banner.durationMs || 5000);
  }, []);

  const dismissBanner = useCallback(() => {
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    setActiveBanner(null);
  }, []);

  // Show start banner when lesson changes
  useEffect(() => {
    if (!currentLesson) return;
    dismissBanner();
    if (currentLesson.startBannerEnabled && currentLesson.startBannerMessage) {
      showBanner({
        message: currentLesson.startBannerMessage,
        imageUrl: currentLesson.startBannerImageUrl,
        position: currentLesson.startBannerPosition || "top",
        sound: currentLesson.startBannerSound,
        customSoundUrl: (currentLesson as any).startBannerCustomSoundUrl,
        confetti: (currentLesson as any).startBannerConfetti,
        confettiStyle: (currentLesson as any).startBannerConfettiStyle,
        durationMs: currentLesson.startBannerDurationMs || 5000,
      });
    }
    return () => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, [currentLesson?.id]);

  // Reset note text when lesson changes
  useEffect(() => {
    setNoteText("");
    setEditingNoteId(null);
  }, [currentLesson?.id]);

  const handleComplete = useCallback(async () => {
    if (!currentLesson) return;
    try {
      await updateProgress.mutateAsync({
        courseId,
        lessonId: currentLesson.id,
        status: "completed",
      });
      utils.lms.enrollments.progress.invalidate({ courseId });
      // Show completion banner if configured
      if (currentLesson.completeBannerEnabled && currentLesson.completeBannerMessage) {
        showBanner({
          message: currentLesson.completeBannerMessage,
          imageUrl: currentLesson.completeBannerImageUrl,
          position: currentLesson.completeBannerPosition || "bottom",
          sound: currentLesson.completeBannerSound,
          customSoundUrl: (currentLesson as any).completeBannerCustomSoundUrl,
          confetti: (currentLesson as any).completeBannerConfetti,
          confettiStyle: (currentLesson as any).completeBannerConfettiStyle,
          durationMs: currentLesson.completeBannerDurationMs || 5000,
        });
      } else {
        toast.success("Lesson marked as complete!");
      }
      if (nextLesson) {
        setTimeout(() => setCurrentLessonId(nextLesson.id), 1200);
      } else {
        // Last lesson — show completion screen
        setTimeout(() => setShowCompletion(true), 800);
      }
    } catch {
      toast.error("Failed to update progress.");
    }
  }, [currentLesson, courseId, nextLesson, updateProgress, utils, showBanner]);

  const handleLessonClick = (lessonId: number) => {
    // Block navigation to locked lessons
    if (isLessonLocked(lessonId)) {
      const lockedLesson = allLessons.find((l: any) => l.id === lessonId) as any;
      // Find the blocking prerequisite
      const idx = allLessons.findIndex((l: any) => l.id === lessonId);
      const blocker = allLessons.slice(0, idx).reverse().find((l: any) => (l as any).isPrerequisite && getLessonStatus((l as any).id) !== "completed") as any;
      toast.error(`Complete "${blocker?.title || 'previous lesson'}" first to unlock "${lockedLesson?.title || 'this lesson'}".`);
      return;
    }
    setCurrentLessonId(lessonId);
    // Mark as in_progress if not started
    const status = getLessonStatus(lessonId);
    if (status === "not_started") {
      updateProgress.mutate({ courseId, lessonId, status: "in_progress" });
    }
  };

  const overallProgress = progressData?.enrollment?.progressPct || 0;
  const showCompleteButton = course?.showCompleteButton !== false; // default true
  const showLessonIcons = course?.playerShowLessonIcons !== false; // default true
  const allowNotes = course?.playerAllowNotes === true;

  // Filtered lessons for sidebar search
  const filteredCurriculum = sidebarSearch
    ? (curriculum as any[]).map((s: any) => ({
        ...s,
        lessons: (s.lessons || []).filter((l: any) =>
          l.title.toLowerCase().includes(sidebarSearch.toLowerCase())
        ),
      })).filter((s: any) => s.lessons.length > 0)
    : (curriculum as any[]);

  if (!course || !curriculum) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="h-14 border-b border-border bg-background flex items-center px-4 gap-3">
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="flex flex-1">
          <div className="w-72 border-r border-border p-4 flex flex-col gap-3">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
          </div>
          <div className="flex-1 p-8">
            <Skeleton className="h-8 w-64 mb-6" />
            <Skeleton className="aspect-video w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col" style={{ "--player-color": primaryColor } as React.CSSProperties}>
      {/* Lesson banner overlay */}
      {activeBanner && (
        <LessonBanner
          message={activeBanner.message}
          imageUrl={activeBanner.imageUrl}
          position={activeBanner.position}
          onDismiss={dismissBanner}
          primaryColor={primaryColor}
        />
      )}
      {/* Top bar */}
      <header className="h-14 border-b border-border bg-background flex items-center justify-between px-4 shrink-0 z-30 sticky top-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen((s) => !s)}
            className="h-8 w-8 flex items-center justify-center rounded hover:bg-muted transition-colors"
          >
            <Menu className="h-4 w-4" />
          </button>
          <button
            onClick={() => { const sub = getSubdomain(); window.location.href = sub ? getOrgBaseUrl(sub) : "/school"; }}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Home className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </button>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium truncate max-w-[200px]">{course.title}</span>
        </div>
        <div className="flex items-center gap-3">
          {(course.playerShowProgress !== false) && (
            <div className="hidden sm:flex items-center gap-2">
              <Progress value={overallProgress} className="w-24 h-1.5" />
              {(course.playerShowProgressPercent !== false) && (
                <span className="text-xs text-muted-foreground">{overallProgress}%</span>
              )}
            </div>
          )}
          {prevLesson && (
            <Button variant="outline" size="sm" onClick={() => handleLessonClick(prevLesson.id)}>
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Previous</span>
            </Button>
          )}
          {showCompleteButton && (
            <Button
              size="sm"
              style={{ backgroundColor: primaryColor }}
              className="text-white"
              onClick={handleComplete}
              disabled={updateProgress.isPending}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              {nextLesson ? "Complete & Continue" : "Complete"}
              {nextLesson && <ChevronRight className="h-4 w-4 ml-1" />}
            </Button>
          )}
          {!showCompleteButton && nextLesson && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleLessonClick(nextLesson.id)}
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {allowNotes && (
            <>
              <button
                onClick={() => { setNotesOpen((n) => !n); setNotesTab("current"); }}
                className={cn(
                  "h-8 w-8 flex items-center justify-center rounded transition-colors",
                  notesOpen ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground"
                )}
                title="My Notes"
              >
                <StickyNote className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  if (currentLesson) {
                    toggleBookmark.mutate({ courseId, lessonId: currentLesson.id });
                    toast.success(isBookmarked ? "Bookmark removed" : "Lesson bookmarked!");
                  }
                }}
                className={cn(
                  "h-8 w-8 flex items-center justify-center rounded transition-colors",
                  isBookmarked ? "text-amber-500" : "hover:bg-muted text-muted-foreground"
                )}
                title={isBookmarked ? "Remove bookmark" : "Bookmark this lesson"}
              >
                {isBookmarked ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
              </button>
            </>
          )}
        </div>
      </header>

      {/* Completion screen overlay */}
      {showCompletion && (
        <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-card border border-border rounded-2xl p-8 max-w-md w-full mx-4 flex flex-col items-center gap-6 shadow-2xl">
            <div className="h-20 w-20 rounded-full flex items-center justify-center" style={{ backgroundColor: primaryColor + "20" }}>
              <Award className="h-10 w-10" style={{ color: primaryColor }} />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold">Course Complete!</h2>
              <p className="text-muted-foreground mt-2">Congratulations on completing <strong>{course.title}</strong>.</p>
            </div>
            {(course as any).enableCertificate && (
              <Button style={{ backgroundColor: primaryColor }} className="text-white gap-2">
                <Download className="h-4 w-4" /> Download Certificate
              </Button>
            )}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowCompletion(false)}>Review Course</Button>
              <Button variant="outline" onClick={() => { const sub = getSubdomain(); window.location.href = sub ? getOrgBaseUrl(sub) : "/school"; }}>Back to School</Button>
            </div>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar */}
        <aside
          className={cn(
            "border-r border-border bg-background flex flex-col shrink-0 overflow-y-auto transition-all duration-300",
            sidebarOpen ? "w-72" : "w-0 overflow-hidden"
          )}
        >
          {/* Course title */}
          <div className="p-4 border-b border-border">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Course</p>
            <p className="font-semibold text-sm leading-snug">{course.title}</p>
            {(course.playerShowProgress !== false) && (
              <div className="flex items-center gap-2 mt-2">
                <Progress value={overallProgress} className="flex-1 h-1.5" />
                {(course.playerShowProgressPercent !== false) && (
                  <span className="text-xs text-muted-foreground shrink-0">{overallProgress}%</span>
                )}
              </div>
            )}
          </div>

          {/* Sidebar search */}
          <div className="px-3 py-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search lessons..."
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-muted/50 border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Sections & Lessons */}
          <div className="flex-1 overflow-y-auto py-2">
            {filteredCurriculum.map((section: any, si: number) => {
              const isExpanded = expandedSections[si] !== false; // default expanded
              const sectionCompleted = (section.lessons || []).every(
                (l: any) => getLessonStatus(l.id) === "completed"
              );
              return (
                <div key={section.id}>
                  <button
                    className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"
                    onClick={() => setExpandedSections((s) => ({ ...s, [si]: !isExpanded }))}
                  >
                    {sectionCompleted ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                    ) : (
                      <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium flex-1 leading-snug">{section.title}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {(section.lessons || []).filter((l: any) => getLessonStatus(l.id) === "completed").length}/{(section.lessons || []).length}
                    </span>
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                  </button>
                  {isExpanded && (
                    <div>
                      {(section.lessons || []).map((lesson: any) => {
                        const status = getLessonStatus(lesson.id);
                        const isActive = lesson.id === currentLesson?.id;
                        const locked = isLessonLocked(lesson.id);
                        const dripLabel = getDripUnlockLabel(lesson);
                        return (
                          <button
                            key={lesson.id}
                            className={cn(
                              "w-full flex items-center gap-2.5 px-4 py-2.5 pl-10 text-left transition-colors border-l-2",
                              locked
                                ? "opacity-50 cursor-not-allowed border-l-transparent"
                                : isActive
                                  ? "bg-primary/10 border-l-primary"
                                  : "hover:bg-muted/40 border-l-transparent"
                            )}
                            style={!locked && isActive ? { borderLeftColor: primaryColor, backgroundColor: primaryColor + "15" } : {}}
                            onClick={() => handleLessonClick(lesson.id)}
                          >
                            {locked ? (
                              <Lock className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                            ) : status === "completed" ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                            ) : status === "in_progress" ? (
                              <div className="h-4 w-4 shrink-0 rounded-full border-2 border-primary flex items-center justify-center" style={{ borderColor: primaryColor }}>
                                <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: primaryColor }} />
                              </div>
                            ) : (
                              <Circle className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                            )}
                            {showLessonIcons && (
                              <LessonIcon type={lesson.lessonType} className={locked ? "text-muted-foreground/40" : isActive ? "text-primary" : "text-muted-foreground"} />
                            )}
                            <span className={cn("text-xs flex-1 leading-snug", locked ? "text-muted-foreground/50" : isActive ? "font-medium" : "text-muted-foreground")}>
                              {lesson.title}
                            </span>
                            {locked && (
                              <span className="text-[9px] text-muted-foreground/60 shrink-0 font-medium uppercase tracking-wide">
                                {dripLabel ?? "Locked"}
                              </span>
                            )}
                            {!locked && lesson.isPrerequisite && status !== "completed" && (
                              <span className="text-[9px] text-amber-600 shrink-0 font-medium uppercase tracking-wide">Gate</span>
                            )}
                            {!locked && lesson.isFreePreview && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">Free</Badge>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          {currentLesson ? (
            <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8">
              {/* Lesson header */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <LessonIcon type={currentLesson.lessonType} className="text-muted-foreground" />
                  <span className="text-xs text-muted-foreground capitalize">{currentLesson.lessonType}</span>
                  {currentLesson.isFreePreview && (
                    <Badge variant="outline" className="text-xs">Free Preview</Badge>
                  )}
                  {(currentLesson as any).isPrerequisite && getLessonStatus(currentLesson.id) !== "completed" && (
                    <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-200">Prerequisite</Badge>
                  )}
                </div>
                <h1 className="text-2xl font-bold">{currentLesson.title}</h1>
              </div>

              {/* Locked lesson overlay */}
              {isLessonLocked(currentLesson.id) ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
                    <Lock className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <h2 className="text-xl font-semibold mb-2">This lesson is locked</h2>
                  <p className="text-muted-foreground max-w-sm mb-6">
                    Complete the required prerequisite lesson before you can access this content.
                  </p>
                  {(() => {
                    const idx = allLessons.findIndex((l: any) => l.id === currentLesson.id);
                    const blocker = allLessons.slice(0, idx).reverse().find((l: any) => (l as any).isPrerequisite && getLessonStatus((l as any).id) !== "completed") as any;
                    return blocker ? (
                      <button
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                        style={{ backgroundColor: primaryColor }}
                        onClick={() => handleLessonClick(blocker.id)}
                      >
                        <PlayCircle className="h-4 w-4" />
                        Go to: {blocker.title}
                      </button>
                    ) : null;
                  })()}
                </div>
              ) : null}

              {/* Lesson content (hidden when locked) */}
              {!isLessonLocked(currentLesson.id) && (
                <LessonContent
                  lesson={currentLesson}
                  primaryColor={primaryColor}
                  onComplete={handleComplete}
                  packageProxyBase="/api/embed"
                  watermark={theme?.watermarkImageUrl ? {
                    url: theme.watermarkImageUrl,
                    opacity: theme.watermarkOpacity ?? 30,
                    size: theme.watermarkSize ?? 80,
                    position: theme.watermarkPosition ?? "bottom-right",
                  } : null}
                />
              )}

              {/* Bottom navigation */}
              <div className="flex items-center justify-between mt-10 pt-6 border-t border-border">
                <div>
                  {prevLesson && (
                    <button
                      onClick={() => handleLessonClick(prevLesson.id)}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <div className="text-left">
                        <p className="text-xs">Previous</p>
                        <p className="font-medium truncate max-w-[200px]">{prevLesson.title}</p>
                      </div>
                    </button>
                  )}
                </div>
                <div className="text-right">
                  {nextLesson && (
                    <button
                      onClick={() => {
                        if (showCompleteButton) handleComplete();
                        else handleLessonClick(nextLesson.id);
                      }}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <div className="text-right">
                        <p className="text-xs">Next</p>
                        <p className="font-medium truncate max-w-[200px]">{nextLesson.title}</p>
                      </div>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Select a lesson to begin.
            </div>
          )}
        </main>

        {/* Notes & Bookmarks panel */}
        {allowNotes && notesOpen && (
          <aside className="w-80 border-l border-border bg-background flex flex-col shrink-0 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <StickyNote className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">My Notes</span>
              </div>
              <button onClick={() => setNotesOpen(false)} className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {/* Tab bar */}
            <div className="flex border-b border-border shrink-0">
              {(["current", "all", "bookmarks"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setNotesTab(tab)}
                  className={cn(
                    "flex-1 py-2 text-xs font-medium transition-colors",
                    notesTab === tab ? "border-b-2" : "text-muted-foreground hover:text-foreground"
                  )}
                  style={notesTab === tab ? { borderBottomColor: primaryColor, color: primaryColor } : {}}
                >
                  {tab === "current" ? "This Lesson" : tab === "all" ? "All Notes" : "Bookmarks"}
                </button>
              ))}
            </div>
            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              {/* Current lesson notes */}
              {notesTab === "current" && (
                <div className="p-4 flex flex-col gap-3">
                  <p className="text-xs text-muted-foreground">Notes for: <span className="font-medium text-foreground">{currentLesson?.title ?? "this lesson"}</span></p>
                  {(currentLessonNotes ?? []).map((note: any) => (
                    <div key={note.id} className="bg-muted/40 rounded-lg p-3 text-sm group relative">
                      {editingNoteId === note.id ? (
                        <>
                          <Textarea value={editingNoteText} onChange={(e) => setEditingNoteText(e.target.value)} className="text-sm resize-none min-h-[80px] mb-2" autoFocus />
                          <div className="flex gap-2">
                            <Button size="sm" className="flex-1 h-7 text-xs" style={{ backgroundColor: primaryColor }} onClick={() => updateNoteM.mutate({ id: note.id, content: editingNoteText })}>Save</Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingNoteId(null)}>Cancel</Button>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="whitespace-pre-wrap text-foreground">{note.content}</p>
                          <p className="text-xs text-muted-foreground mt-1">{new Date(note.createdAt).toLocaleDateString()}</p>
                          <div className="absolute top-2 right-2 hidden group-hover:flex gap-1">
                            <button onClick={() => { setEditingNoteId(note.id); setEditingNoteText(note.content); }} className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted">
                              <Edit3 className="h-3 w-3 text-muted-foreground" />
                            </button>
                            <button onClick={() => deleteNoteM.mutate({ id: note.id })} className="h-6 w-6 flex items-center justify-center rounded hover:bg-destructive/10">
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Add a note for this lesson..." className="resize-none text-sm min-h-[100px]" />
                  <Button size="sm" className="w-full" style={{ backgroundColor: primaryColor }} disabled={!noteText.trim() || createNote.isPending}
                    onClick={() => { if (currentLesson && noteText.trim()) createNote.mutate({ courseId, lessonId: currentLesson.id, content: noteText.trim() }); }}
                  >
                    <PenLine className="h-3.5 w-3.5 mr-1.5" /> Add Note
                  </Button>
                </div>
              )}
              {/* All course notes */}
              {notesTab === "all" && (
                <div className="p-4 flex flex-col gap-3">
                  {(allCourseNotes ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-8">No notes yet. Add notes while watching lessons.</p>
                  ) : (allCourseNotes ?? []).map((note: any) => {
                    const lesson = allLessons.find((l: any) => l.id === note.lessonId);
                    return (
                      <div key={note.id} className="bg-muted/40 rounded-lg p-3 text-sm group relative">
                        <p className="text-xs font-medium mb-1 cursor-pointer hover:underline" style={{ color: primaryColor }} onClick={() => { setCurrentLessonId(note.lessonId); setNotesTab("current"); }}>{lesson?.title ?? "Unknown lesson"}</p>
                        <p className="whitespace-pre-wrap text-foreground">{note.content}</p>
                        <p className="text-xs text-muted-foreground mt-1">{new Date(note.createdAt).toLocaleDateString()}</p>
                        <button onClick={() => deleteNoteM.mutate({ id: note.id })} className="absolute top-2 right-2 hidden group-hover:flex h-6 w-6 items-center justify-center rounded hover:bg-destructive/10">
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              {/* Bookmarks */}
              {notesTab === "bookmarks" && (
                <div className="p-4 flex flex-col gap-2">
                  {(courseBookmarks ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-8">No bookmarks yet. Click the bookmark icon in the top bar to bookmark a lesson.</p>
                  ) : (courseBookmarks ?? []).map((bm: any) => {
                    const lesson = allLessons.find((l: any) => l.id === bm.lessonId);
                    return (
                      <button key={bm.id} onClick={() => setCurrentLessonId(bm.lessonId)} className="w-full flex items-center gap-2.5 p-3 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors text-left">
                        <BookmarkCheck className="h-4 w-4 shrink-0 text-amber-500" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{lesson?.title ?? "Unknown lesson"}</p>
                          <p className="text-xs text-muted-foreground">{new Date(bm.createdAt).toLocaleDateString()}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
