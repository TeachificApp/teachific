import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  PlayCircle,
  FileText,
  HelpCircle,
  Video,
  BookOpen,
  ArrowLeft,
  Clock,
  Award,
  Users,
  Lock,
  Globe,
  Twitter,
  Linkedin,
  Megaphone,
  MessageSquare,
  Paperclip,
  Pin,
  ExternalLink,
  Download,
} from "lucide-react";

function getLessonIcon(type: string) {
  switch (type) {
    case "video": return <Video className="w-4 h-4" />;
    case "quiz": return <HelpCircle className="w-4 h-4" />;
    case "text": return <FileText className="w-4 h-4" />;
    case "scorm": return <BookOpen className="w-4 h-4" />;
    default: return <PlayCircle className="w-4 h-4" />;
  }
}

function getLessonStatus(lessonId: number, lessonProgress: any[]) {
  const p = lessonProgress.find((lp: any) => lp.lessonId === lessonId);
  return p?.status ?? "not_started";
}

function LessonProgressIcon({ status }: { status: string }) {
  if (status === "completed") return <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />;
  if (status === "in_progress") return <PlayCircle className="w-4 h-4 text-teal-500 flex-shrink-0" />;
  return <Circle className="w-4 h-4 text-muted-foreground flex-shrink-0" />;
}

export default function CourseOverviewPage() {
  const params = useParams<{ courseId: string }>();
  const courseId = Number(params.courseId);
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const { data: course, isLoading: courseLoading } = trpc.lms.courses.get.useQuery(
    { id: courseId },
    { enabled: !!courseId }
  );
  const { data: curriculum, isLoading: curriculumLoading } = trpc.lms.curriculum.get.useQuery(
    { courseId },
    { enabled: !!courseId }
  );
  const { data: progressData } = trpc.lms.enrollments.progress.useQuery(
    { courseId },
    { enabled: !!courseId && !!user }
  );
  const { data: theme } = trpc.lms.themes.get.useQuery(
    { orgId: course?.orgId ?? 0 },
    { enabled: !!course?.orgId }
  );

  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]));
  const [activeTab, setActiveTab] = useState<"curriculum" | "announcements" | "discussions" | "resources">("curriculum");
  const [newDiscussionText, setNewDiscussionText] = useState("");

  const { data: announcements } = trpc.lms.announcements.list.useQuery(
    { courseId },
    { enabled: !!courseId && activeTab === "announcements" }
  );
  const { data: discussions } = trpc.lms.discussions.list.useQuery(
    { courseId, orgId: course?.orgId ?? 0 },
    { enabled: !!courseId && activeTab === "discussions" && !!course }
  );
  const { data: resources } = trpc.lms.resources.list.useQuery(
    { courseId },
    { enabled: !!courseId && activeTab === "resources" }
  );
  const utils = trpc.useUtils();
  const createDiscussion = trpc.lms.discussions.create.useMutation({
    onSuccess: () => {
      setNewDiscussionText("");
      utils.lms.discussions.list.invalidate({ courseId, orgId: course?.orgId ?? 0 });
    },
  });

  const enrollment = progressData?.enrollment;
  const lessonProgress = progressData?.lessonProgress ?? [];
  const completionPct = enrollment?.progressPct ?? 0;

  const allLessons = (curriculum ?? []).flatMap((s: any) => s.lessons ?? []);
  const totalLessons = allLessons.length;
  const completedLessons = lessonProgress.filter((lp: any) => lp.status === "completed").length;

  // Find next lesson to continue
  const nextLesson = (() => {
    for (const section of (curriculum ?? [])) {
      for (const lesson of (section.lessons ?? [])) {
        const status = getLessonStatus(lesson.id, lessonProgress);
        if (status !== "completed") return { lesson, section };
      }
    }
    // All done — return first lesson for review
    const firstSection = (curriculum ?? [])[0];
    const firstLesson = firstSection?.lessons?.[0];
    return firstLesson ? { lesson: firstLesson, section: firstSection } : null;
  })();

  const primaryColor = theme?.primaryColor ?? "#0d9488";

  const toggleSection = (idx: number) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleStartLesson = (lessonId: number) => {
    setLocation(`/learn/${courseId}?lesson=${lessonId}`);
  };

  const handleStartCourse = () => {
    if (nextLesson) {
      setLocation(`/learn/${courseId}?lesson=${nextLesson.lesson.id}`);
    } else {
      setLocation(`/learn/${courseId}`);
    }
  };

  if (courseLoading || curriculumLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Course not found.</p>
      </div>
    );
  }

  const whatYouLearn: string[] = (() => {
    try { return JSON.parse(course.whatYouLearn ?? "[]"); } catch { return []; }
  })();

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <button
            onClick={() => setLocation(`/learn/${courseId}`)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Player
          </button>
          <h1 className="font-semibold text-sm truncate flex-1 text-center">{course.title}</h1>
          <Button
            size="sm"
            style={{ backgroundColor: primaryColor }}
            className="text-white hover:opacity-90 shrink-0"
            onClick={handleStartCourse}
          >
            {completionPct === 100 ? "Review Course" : completionPct > 0 ? "Continue" : "Start Course"}
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: main content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Tab navigation */}
            <div className="flex gap-1 border-b border-border">
              {(["curriculum", "announcements", "discussions", "resources"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                    activeTab === tab
                      ? "border-teal-500 text-teal-600"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab === "announcements" && <Megaphone className="w-3.5 h-3.5 inline mr-1.5" />}
                  {tab === "discussions" && <MessageSquare className="w-3.5 h-3.5 inline mr-1.5" />}
                  {tab === "resources" && <Paperclip className="w-3.5 h-3.5 inline mr-1.5" />}
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* Announcements tab */}
            {activeTab === "announcements" && (
              <div className="space-y-4">
                {!announcements || announcements.length === 0 ? (
                  <div className="rounded-xl border border-border bg-card p-12 text-center">
                    <Megaphone className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No announcements yet.</p>
                  </div>
                ) : (
                  (announcements as any[]).map((a: any) => (
                    <div key={a.id} className="rounded-xl border border-border bg-card p-5">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          {a.isPinned && <Pin className="w-3.5 h-3.5 text-teal-500" />}
                          <h4 className="font-semibold">{a.title}</h4>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(a.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {a.body && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{a.body}</p>}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Discussions tab */}
            {activeTab === "discussions" && (
              <div className="space-y-4">
                {user && (
                  <div className="rounded-xl border border-border bg-card p-4">
                    <Textarea
                      placeholder="Start a discussion or ask a question..."
                      value={newDiscussionText}
                      onChange={(e) => setNewDiscussionText(e.target.value)}
                      rows={3}
                      className="mb-3 resize-none"
                    />
                    <Button
                      size="sm"
                      disabled={!newDiscussionText.trim() || createDiscussion.isPending}
                      onClick={() => {
                        if (!newDiscussionText.trim() || !course) return;
                        createDiscussion.mutate({
                          courseId,
                          orgId: course.orgId,
                          title: newDiscussionText.slice(0, 80),
                          body: newDiscussionText,
                          authorId: user.id,
                        });
                      }}
                    >
                      Post
                    </Button>
                  </div>
                )}
                {!discussions || (discussions as any[]).length === 0 ? (
                  <div className="rounded-xl border border-border bg-card p-12 text-center">
                    <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No discussions yet. Be the first to start one!</p>
                  </div>
                ) : (
                  (discussions as any[]).map((d: any) => (
                    <div key={d.id} className="rounded-xl border border-border bg-card p-5">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="font-semibold text-sm">{d.title}</h4>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(d.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {d.body && <p className="text-sm text-muted-foreground line-clamp-2">{d.body}</p>}
                      <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                        <span>{d.replyCount ?? 0} replies</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Resources tab */}
            {activeTab === "resources" && (
              <div className="space-y-3">
                {!resources || (resources as any[]).length === 0 ? (
                  <div className="rounded-xl border border-border bg-card p-12 text-center">
                    <Paperclip className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No resources have been added to this course yet.</p>
                  </div>
                ) : (
                  (resources as any[]).map((r: any) => (
                    <div key={r.id} className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center flex-shrink-0">
                        {r.fileUrl ? <Download className="w-5 h-5 text-teal-600" /> : <ExternalLink className="w-5 h-5 text-teal-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{r.title}</p>
                        {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                        {r.fileName && <p className="text-xs text-muted-foreground">{r.fileName}</p>}
                      </div>
                      <a
                        href={r.fileUrl ?? r.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-teal-600 hover:text-teal-700 text-sm font-medium flex-shrink-0"
                      >
                        {r.fileUrl ? "Download" : "Open"}
                      </a>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Curriculum tab (default) */}
            {activeTab !== "curriculum" ? null : <>

            {/* Hero card */}
            <div className="rounded-xl border border-border overflow-hidden bg-card">
              {course.thumbnailUrl && (
                <div className="relative aspect-video bg-muted">
                  <img src={course.thumbnailUrl} alt={course.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <button
                      onClick={handleStartCourse}
                      className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
                    >
                      <PlayCircle className="w-8 h-8" style={{ color: primaryColor }} />
                    </button>
                  </div>
                </div>
              )}
              <div className="p-6">
                <h2 className="text-2xl font-bold mb-2">{course.title}</h2>
                {course.shortDescription && (
                  <p className="text-muted-foreground mb-4">{course.shortDescription}</p>
                )}
                {/* Next lesson card */}
                {nextLesson && (
                  <div
                    className="rounded-lg border-2 p-4 flex items-center justify-between gap-4 cursor-pointer hover:opacity-90 transition-opacity"
                    style={{ borderColor: primaryColor + "40", backgroundColor: primaryColor + "08" }}
                    onClick={() => handleStartLesson(nextLesson.lesson.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0"
                        style={{ backgroundColor: primaryColor }}
                      >
                        {getLessonIcon(nextLesson.lesson.lessonType ?? "video")}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground mb-0.5">
                          {completionPct > 0 && completionPct < 100 ? "Continue where you left off" : completionPct === 100 ? "Review first lesson" : "Start here"}
                        </p>
                        <p className="font-medium text-sm truncate">{nextLesson.lesson.title}</p>
                        <p className="text-xs text-muted-foreground">{nextLesson.section.title}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 flex-shrink-0" style={{ color: primaryColor }} />
                  </div>
                )}
              </div>
            </div>

            {/* What you'll learn */}
            {whatYouLearn.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="font-semibold text-lg mb-4">What you'll learn</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {whatYouLearn.map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: primaryColor }} />
                      <span className="text-sm">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Course curriculum */}
            {(curriculum ?? []).length > 0 && (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                  <h3 className="font-semibold text-lg">Course Curriculum</h3>
                  <span className="text-sm text-muted-foreground">
                    {totalLessons} lessons · {completedLessons} completed
                  </span>
                </div>
                <div className="divide-y divide-border">
                  {(curriculum ?? []).map((section: any, si: number) => {
                    const sectionLessons = section.lessons ?? [];
                    const sectionCompleted = sectionLessons.filter(
                      (l: any) => getLessonStatus(l.id, lessonProgress) === "completed"
                    ).length;
                    const isExpanded = expandedSections.has(si);
                    return (
                      <div key={section.id}>
                        <button
                          className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/30 transition-colors text-left"
                          onClick={() => toggleSection(si)}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            )}
                            <span className="font-medium text-sm">{section.title}</span>
                          </div>
                          <span className="text-xs text-muted-foreground flex-shrink-0 ml-4">
                            {sectionCompleted}/{sectionLessons.length} complete
                          </span>
                        </button>
                        {isExpanded && (
                          <div className="divide-y divide-border/50">
                            {sectionLessons.map((lesson: any) => {
                              const status = getLessonStatus(lesson.id, lessonProgress);
                              const isLocked = course.requireSequential && status === "not_started" &&
                                lessonProgress.some((lp: any) => lp.lessonId !== lesson.id && lp.status !== "completed");
                              return (
                                <button
                                  key={lesson.id}
                                  className="w-full px-6 py-3 flex items-center gap-3 hover:bg-muted/20 transition-colors text-left pl-14"
                                  onClick={() => !isLocked && handleStartLesson(lesson.id)}
                                  disabled={isLocked}
                                >
                                  <LessonProgressIcon status={status} />
                                  <span className="text-muted-foreground flex-shrink-0">
                                    {getLessonIcon(lesson.lessonType ?? "video")}
                                  </span>
                                  <span className={`text-sm flex-1 truncate ${isLocked ? "text-muted-foreground" : ""}`}>
                                    {lesson.title}
                                  </span>
                                  {isLocked && <Lock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
                                  {lesson.estimatedMinutes && (
                                    <span className="text-xs text-muted-foreground flex-shrink-0 flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {lesson.estimatedMinutes}m
                                    </span>
                                  )}
                                  {status !== "completed" && !isLocked && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs flex-shrink-0"
                                      style={{ borderColor: primaryColor + "60", color: primaryColor }}
                                    >
                                      {status === "in_progress" ? "In Progress" : "Start"}
                                    </Badge>
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
              </div>
            )}

            {/* Instructor profile card */}
            {(() => {
              const instructor = (course as any).instructor;
              if (instructor) {
                // Parse social links JSON
                let socialLinks: Record<string, string> = {};
                try { socialLinks = JSON.parse(instructor.socialLinks ?? "{}"); } catch {}
                return (
                  <div className="rounded-xl border border-border bg-card p-6">
                    <h3 className="font-semibold text-lg mb-5">About the Instructor</h3>
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      {instructor.avatarUrl ? (
                        <img
                          src={instructor.avatarUrl}
                          alt={instructor.displayName ?? "Instructor"}
                          className="w-16 h-16 rounded-full object-cover flex-shrink-0 border-2 border-border"
                        />
                      ) : (
                        <div
                          className="w-16 h-16 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xl font-bold"
                          style={{ backgroundColor: primaryColor }}
                        >
                          {(instructor.displayName ?? "I").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-base">{instructor.displayName}</h4>
                        {instructor.title && (
                          <p className="text-sm text-muted-foreground mb-2">{instructor.title}</p>
                        )}
                        {/* Social links */}
                        {(socialLinks.linkedin || socialLinks.twitter || socialLinks.website) && (
                          <div className="flex items-center gap-3 mb-3">
                            {socialLinks.linkedin && (
                              <a
                                href={socialLinks.linkedin}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-foreground transition-colors"
                                title="LinkedIn"
                              >
                                <Linkedin className="w-4 h-4" />
                              </a>
                            )}
                            {socialLinks.twitter && (
                              <a
                                href={socialLinks.twitter}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-foreground transition-colors"
                                title="Twitter / X"
                              >
                                <Twitter className="w-4 h-4" />
                              </a>
                            )}
                            {socialLinks.website && (
                              <a
                                href={socialLinks.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-foreground transition-colors"
                                title="Website"
                              >
                                <Globe className="w-4 h-4" />
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {instructor.bio && (
                      <div
                        className="mt-4 prose prose-sm max-w-none text-foreground"
                        dangerouslySetInnerHTML={{ __html: instructor.bio }}
                      />
                    )}
                  </div>
                );
              }
              // Fallback: show legacy instructorBio field if no linked instructor
              if (course.instructorBio) {
                return (
                  <div className="rounded-xl border border-border bg-card p-6">
                    <h3 className="font-semibold text-lg mb-4">About the Instructor</h3>
                    <div
                      className="prose prose-sm max-w-none text-foreground"
                      dangerouslySetInnerHTML={{ __html: course.instructorBio }}
                    />
                  </div>
                );
              }
                            return null;
            })()}
            </> /* end curriculum tab */}
          </div>
          {/* Right sidebar */}
          <div className="space-y-6">
            {/* Progress card */}
            <div className="rounded-xl border border-border bg-card p-6 sticky top-20">
              <div className="text-center mb-6">
                <div
                  className="text-4xl font-bold mb-1"
                  style={{ color: primaryColor }}
                >
                  {completionPct}%
                </div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Complete</p>
              </div>
              <Progress value={completionPct} className="h-2 mb-6" />
              <Button
                className="w-full text-white hover:opacity-90"
                style={{ backgroundColor: primaryColor }}
                onClick={handleStartCourse}
              >
                {completionPct === 100 ? "Review Course" : completionPct > 0 ? "Continue Learning" : "Start Course"}
              </Button>

              {/* Course stats */}
              <div className="mt-6 space-y-3 border-t border-border pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <BookOpen className="w-4 h-4" />
                  <span>{totalLessons} lessons across {(curriculum ?? []).length} sections</span>
                </div>

                {course.enableCertificate && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Award className="w-4 h-4" />
                    <span>Certificate on completion</span>
                  </div>
                )}
                {course.totalEnrollments > 0 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span>{course.totalEnrollments.toLocaleString()} enrolled</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
