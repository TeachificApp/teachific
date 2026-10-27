import { useParams, useLocation } from "wouter";
import { getOrgBaseUrl } from "@/lib/orgUrl";
import { getSubdomain } from "@/hooks/useSubdomain";
import SchoolMemberLayout from "@/components/SchoolMemberLayout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import {
  BookOpen, CheckCircle, Clock, Play, Search, GraduationCap,
  ArrowRight, RotateCcw,
} from "lucide-react";

export default function SchoolMyCoursesPage() {
  const params = useParams<{ orgSlug?: string }>();
  // On subdomain routes (/my-courses), orgSlug param is absent — fall back to current subdomain
  const orgSlug = params?.orgSlug ?? getSubdomain() ?? undefined;
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "in_progress" | "completed" | "not_started">("all");
  // This is a consistency hint for local /school/:slug routes and never an
  // authority. The router derives the organization from the signed-in session
  // and rejects a mismatch with this tenant route.
  const enrollmentQueryInput = useMemo(() => orgSlug ? { orgSlug } : undefined, [orgSlug]);

  const { data: enrollments, isLoading } = trpc.lms.dashboard.enrolledCourses.useQuery(enrollmentQueryInput, {
    enabled: !!user,
  });

  const filtered = useMemo(() => {
    if (!enrollments) return [];
    return enrollments.filter((e) => {
      const matchSearch = !search || e.title.toLowerCase().includes(search.toLowerCase());
      const isCompleted = !!e.completedAt;
      const isStarted = !!e.lastAccessedAt;
      const matchFilter =
        filter === "all" ||
        (filter === "completed" && isCompleted) ||
        (filter === "in_progress" && !isCompleted && isStarted) ||
        (filter === "not_started" && !isStarted);
      return matchSearch && matchFilter;
    });
  }, [enrollments, search, filter]);

  const stats = useMemo(() => {
    if (!enrollments) return { total: 0, completed: 0, inProgress: 0 };
    return {
      total: enrollments.length,
      completed: enrollments.filter((e) => !!e.completedAt).length,
      inProgress: enrollments.filter((e) => !e.completedAt && !!e.lastAccessedAt).length,
    };
  }, [enrollments]);

  const FILTERS = [
    { value: "all", label: `All (${stats.total})` },
    { value: "in_progress", label: `In Progress (${stats.inProgress})` },
    { value: "completed", label: `Completed (${stats.completed})` },
    { value: "not_started", label: `Not Started (${stats.total - stats.completed - stats.inProgress})` },
  ] as const;

  return (
    <SchoolMemberLayout orgSlug={orgSlug}>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">My Courses</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track your learning progress and continue where you left off.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Enrolled", value: stats.total, icon: BookOpen },
            { label: "In Progress", value: stats.inProgress, icon: Play },
            { label: "Completed", value: stats.completed, icon: CheckCircle },
          ].map((s) => (
            <Card key={s.label} className="border-border/60">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <s.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search + filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search courses..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filter === f.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Course grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-xl border border-border overflow-hidden">
                <Skeleton className="aspect-video w-full" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-2 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <GraduationCap className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">{enrollments?.length === 0 ? "No courses yet" : "No courses match your filter"}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {enrollments?.length === 0
                  ? "Browse the course catalog to get started."
                  : "Try a different filter or search term."}
              </p>
            </div>
            {enrollments?.length === 0 && (
              <Button onClick={() => { window.location.href = orgSlug ? getOrgBaseUrl(orgSlug) : "/school"; }} variant="outline" size="sm">
                Browse Courses
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((enrollment) => {
              const pct = enrollment.progressPct ?? 0;
              const isCompleted = !!enrollment.completedAt;
              const isStarted = !!enrollment.lastAccessedAt;
              const continueUrl = enrollment.lastLessonId
                ? `/learn/${enrollment.courseId}/lesson/${enrollment.lastLessonId}`
                : `/learn/${enrollment.courseId}`;
              return (
                <Card
                  key={enrollment.enrollmentId}
                  className="shadow-sm border-border/60 overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
                  onClick={() => setLocation(continueUrl)}
                >
                  <div className="relative h-36 bg-gradient-to-br from-primary/20 to-primary/5 overflow-hidden">
                    {enrollment.thumbnailUrl ? (
                      <img src={enrollment.thumbnailUrl} alt={enrollment.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <BookOpen className="h-10 w-10 text-primary/40" />
                      </div>
                    )}
                    {isCompleted && (
                      <div className="absolute top-2 right-2 bg-emerald-500 text-white rounded-full p-1">
                        <CheckCircle className="h-4 w-4" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <div className="h-10 w-10 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                        {isCompleted ? <RotateCcw className="h-4 w-4 text-gray-700" /> : <Play className="h-4 w-4 text-gray-700 ml-0.5" />}
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-4 space-y-3">
                    <div>
                      <h3 className="font-semibold text-sm line-clamp-2 leading-snug">{enrollment.title}</h3>
                      <div className="flex items-center gap-2 mt-1.5">
                        {isCompleted ? (
                          <Badge variant="default" className="text-xs bg-emerald-500 hover:bg-emerald-600 gap-1"><CheckCircle className="h-3 w-3" /> Completed</Badge>
                        ) : isStarted ? (
                          <Badge variant="secondary" className="text-xs gap-1"><Play className="h-3 w-3" /> In Progress</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">Not Started</Badge>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{Math.round(pct)}% complete</span>
                        {enrollment.lastAccessedAt && (
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(enrollment.lastAccessedAt).toLocaleDateString()}</span>
                        )}
                      </div>
                      <Progress value={pct} className="h-1.5" />
                    </div>
                    <Button
                      size="sm"
                      variant={isCompleted ? "outline" : "default"}
                      className="w-full gap-1.5"
                      onClick={(e) => { e.stopPropagation(); setLocation(continueUrl); }}
                    >
                      {isCompleted ? <><RotateCcw className="h-3.5 w-3.5" /> Review</> : isStarted ? <><ArrowRight className="h-3.5 w-3.5" /> Continue</> : <><Play className="h-3.5 w-3.5" /> Start</>}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </SchoolMemberLayout>
  );
}
