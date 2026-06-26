import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getOrgSubdomainUrl, getSubdomain } from "@/hooks/useSubdomain";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  DollarSign, Users, ShoppingCart, TrendingUp, BookOpen,
  Plus, Clock, CheckCircle2, PlayCircle, MoreVertical,
  ArrowRight, Zap, BarChart2, Activity,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// ─── Metric Card ─────────────────────────────────────────────────────────────
function MetricCard({
  title, value, icon: Icon, trend, color,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: string;
  color: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-3xl font-bold tracking-tight">{value}</p>
            {trend && <p className="text-xs text-muted-foreground">{trend}</p>}
          </div>
          <div className={`p-3 rounded-xl ${color}`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Course Card (for learner view) ──────────────────────────────────────────
function CourseCard({ course }: { course: any }) {
  const [, navigate] = useLocation();
  const progress = course.progressPct ?? 0;
  const isCompleted = !!course.completedAt;
  const isStarted = progress > 0;

  return (
    <Card
      className="group cursor-pointer hover:shadow-md transition-all duration-200 overflow-hidden"
      onClick={() => navigate(`/lms/learn/${course.slug}`)}
    >
      <div className="relative aspect-video bg-muted overflow-hidden">
        {course.thumbnailUrl ? (
          <img
            src={course.thumbnailUrl}
            alt={course.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
            <BookOpen className="h-12 w-12 text-primary/40" />
          </div>
        )}
        {isCompleted && (
          <div className="absolute top-2 right-2">
            <Badge className="bg-green-500 text-white border-0 gap-1">
              <CheckCircle2 className="h-3 w-3" /> Completed
            </Badge>
          </div>
        )}
        {!isCompleted && isStarted && (
          <div className="absolute top-2 right-2">
            <Badge variant="secondary" className="gap-1">
              <PlayCircle className="h-3 w-3" /> In Progress
            </Badge>
          </div>
        )}
      </div>
      <CardContent className="p-4">
        <h3 className="font-semibold text-sm leading-snug line-clamp-2 mb-3">{course.title}</h3>
        {isStarted && !isCompleted && (
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        )}
        {!isStarted && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Enrolled {formatDistanceToNow(new Date(course.enrolledAt), { addSuffix: true })}
          </p>
        )}
        {isCompleted && (
          <p className="text-xs text-green-600 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Completed {formatDistanceToNow(new Date(course.completedAt), { addSuffix: true })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Org Admin Dashboard ──────────────────────────────────────────────────────
function OrgAdminDashboard({ orgId, orgName }: { orgId: number; orgName: string }) {
  const [, navigate] = useLocation();
  const [days, setDays] = useState(30);
  const [groupBy, setGroupBy] = useState<"day" | "week" | "month">("day");

  const { data: metrics, isLoading: metricsLoading } = trpc.lms.dashboard.metrics.useQuery(
    { orgId, days },
    { refetchInterval: 60_000 }
  );
  const { data: chartData, isLoading: chartLoading } = trpc.lms.dashboard.chartData.useQuery(
    { orgId, days, groupBy },
    { refetchInterval: 60_000 }
  );
  const { data: activity, isLoading: activityLoading } = trpc.lms.dashboard.recentActivity.useQuery(
    { orgId, limit: 20 },
    { refetchInterval: 30_000 }
  );
  const { data: recentCourses } = trpc.lms.dashboard.recentCourses.useQuery({ orgId, limit: 6 });

  const formatCurrency = (v: number) =>
    v === 0 ? "$0.00" : `$${v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back 👋
          </h1>
          <p className="text-muted-foreground mt-0.5">{orgName}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate("/lms/courses?create=1")} className="gap-2">
            <Plus className="h-4 w-4" /> Create Course
          </Button>
        </div>
      </div>

      {/* Time range selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Showing:</span>
        {[7, 30, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`text-sm px-3 py-1 rounded-full transition-colors ${
              days === d
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80 text-muted-foreground"
            }`}
          >
            Past {d} days
          </button>
        ))}
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metricsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))
        ) : (
          <>
            <MetricCard
              title="Revenue"
              value={formatCurrency(metrics?.revenue ?? 0)}
              icon={DollarSign}
              trend={`Past ${days} days`}
              color="bg-emerald-500"
            />
            <MetricCard
              title="Registrations"
              value={metrics?.registrations ?? 0}
              icon={Users}
              trend={`Past ${days} days`}
              color="bg-blue-500"
            />
            <MetricCard
              title="Course Sales"
              value={metrics?.sales ?? 0}
              icon={ShoppingCart}
              trend={`Past ${days} days`}
              color="bg-violet-500"
            />
            <MetricCard
              title="Active Members"
              value={metrics?.activeMembers ?? 0}
              icon={Activity}
              color="bg-orange-500"
            />
          </>
        )}
      </div>

      {/* Chart + Activity feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-primary" />
                Revenue & Enrollments
              </CardTitle>
              <div className="flex gap-1">
                {(["day", "week", "month"] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGroupBy(g)}
                    className={`text-xs px-2.5 py-1 rounded-md transition-colors capitalize ${
                      groupBy === g
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-muted/80 text-muted-foreground"
                    }`}
                  >
                    {g === "day" ? "Daily" : g === "week" ? "Weekly" : "Monthly"}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {chartLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData ?? []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: any, name: string) =>
                      name === "revenue" ? [`$${Number(v).toFixed(2)}`, "Revenue"] : [v, "Enrollments"]
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#revenueGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Live activity feed */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Live Feed
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {activityLoading ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : !activity?.length ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-sm gap-2">
                <Zap className="h-8 w-8 opacity-30" />
                <p>No activity yet</p>
                <p className="text-xs text-center">Enrollments will appear here in real time</p>
              </div>
            ) : (
              <div className="flex flex-col gap-0 divide-y divide-border max-h-[300px] overflow-y-auto">
                {activity.map((item: any) => (
                  <div key={item.id} className="py-3 flex flex-col gap-0.5">
                    <p className="text-xs font-medium leading-snug">
                      <span className="text-foreground">{item.userName || item.userEmail}</span>
                      {" enrolled in "}
                      <span className="text-primary">{item.courseName}</span>
                      {item.price > 0 && (
                        <span className="text-muted-foreground"> for ${Number(item.price).toFixed(2)}</span>
                      )}
                      {item.price === 0 && (
                        <span className="text-emerald-600"> for free</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recently edited courses */}
      {recentCourses && recentCourses.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">Recently Edited Courses</h2>
            <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={() => navigate("/lms/courses")}>
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {recentCourses.map((course: any) => (
              <Card
                key={course.id}
                className="group cursor-pointer hover:shadow-md transition-all duration-200 overflow-hidden"
                onClick={() => navigate(`/lms/courses/${course.id}/curriculum`)}
              >
                <div className="relative aspect-video bg-muted overflow-hidden">
                  {course.thumbnailUrl ? (
                    <img
                      src={course.thumbnailUrl}
                      alt={course.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                      <BookOpen className="h-10 w-10 text-primary/30" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                </div>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Course</p>
                  <h3 className="font-semibold text-sm leading-snug line-clamp-2">{course.title}</h3>
                  <div className="flex items-center justify-between mt-2">
                    <Badge
                      variant={course.status === "published" ? "default" : "secondary"}
                      className="text-xs capitalize"
                    >
                      {course.status}
                    </Badge>
                    <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted">
                      <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Member Learner Dashboard ─────────────────────────────────────────────────
function MemberDashboard() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { data: courses, isLoading } = trpc.lms.dashboard.enrolledCourses.useQuery();

  const inProgress = courses?.filter((c: any) => c.progressPct > 0 && !c.completedAt) ?? [];
  const notStarted = courses?.filter((c: any) => c.progressPct === 0 && !c.completedAt) ?? [];
  const completed = courses?.filter((c: any) => !!c.completedAt) ?? [];

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}! 👋
        </h1>
        <p className="text-muted-foreground mt-0.5">Pick up where you left off</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}><CardContent className="p-0"><Skeleton className="aspect-video w-full" /><div className="p-4"><Skeleton className="h-4 w-3/4" /></div></CardContent></Card>
          ))}
        </div>
      ) : !courses?.length ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
            <BookOpen className="h-10 w-10 text-primary/60" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">No courses yet</h2>
            <p className="text-muted-foreground mt-1">You haven't been enrolled in any courses yet.</p>
          </div>
          <Button onClick={() => navigate("/lms/catalog")} className="gap-2">
            <BookOpen className="h-4 w-4" /> Browse Catalog
          </Button>
        </div>
      ) : (
        <>
          {/* In Progress */}
          {inProgress.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <PlayCircle className="h-5 w-5 text-primary" />
                <h2 className="text-base font-semibold">Continue Learning</h2>
                <Badge variant="secondary">{inProgress.length}</Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {inProgress.map((c: any) => <CourseCard key={c.enrollmentId} course={c} />)}
              </div>
            </section>
          )}

          {/* Not Started */}
          {notStarted.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-base font-semibold">Not Started</h2>
                <Badge variant="secondary">{notStarted.length}</Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {notStarted.map((c: any) => <CourseCard key={c.enrollmentId} course={c} />)}
              </div>
            </section>
          )}

          {/* Completed */}
          {completed.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <h2 className="text-base font-semibold">Completed</h2>
                <Badge variant="secondary">{completed.length}</Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {completed.map((c: any) => <CourseCard key={c.enrollmentId} course={c} />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main Home Page ───────────────────────────────────────────────────────────
export default function Home() {
  const { user } = useAuth();
  const currentSubdomain = getSubdomain() ?? undefined;
  const { data: orgCtx, isLoading: orgLoading } = trpc.orgs.myContext.useQuery(
    { subdomain: currentSubdomain },
    { enabled: !!user }
  );
  const { data: myOrgs, isLoading: orgsLoading } = trpc.orgs.myOrgs.useQuery(undefined, {
    enabled: !!user,
  });

  // Root-domain fallbacks. Org users land on their own org subdomain dashboard;
  // Teachific Learn remains a separate explicit menu link.
  useEffect(() => {
    if (!user || orgLoading || orgsLoading) return;
    const role = orgCtx?.role;
    if (role === "site_owner" || role === "site_admin") {
      window.location.replace("/platform-admin");
      return;
    }
    if ((role === "org_admin" || role === "org_super_admin") && orgCtx?.org?.slug) {
      window.location.href = getOrgSubdomainUrl(orgCtx.org.slug, "/lms");
      return;
    }
    if (myOrgs && myOrgs.length === 1 && myOrgs[0].slug) {
      window.location.href = getOrgSubdomainUrl(myOrgs[0].slug);
    }
  }, [user, orgCtx, myOrgs, orgLoading, orgsLoading]);

  if (!user || orgLoading || orgsLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Platform admins are redirected above.
  if (orgCtx?.role === "site_owner" || orgCtx?.role === "site_admin") {
    return <OrgAdminDashboard orgId={orgCtx.org?.id ?? 0} orgName={orgCtx.org?.name ?? "Platform"} />;
  }

  // Org admin (fallback if redirect hasn't fired yet)
  if (orgCtx?.role === "org_admin" && orgCtx?.org) {
    return <OrgAdminDashboard orgId={orgCtx.org.id} orgName={orgCtx.org.name} />;
  }

  // Students with 2+ orgs: show school picker
  if (myOrgs && myOrgs.length > 1) {
    // Inline school picker — import is lazy to avoid circular deps
    const SchoolPickerInline = () => (
      <div className="flex flex-col items-center justify-center py-16 gap-6">
        <h2 className="text-2xl font-bold text-gray-900">Choose Your School</h2>
        <p className="text-gray-500">You have access to multiple schools. Select one to continue.</p>
        <div className="w-full max-w-md space-y-3">
          {myOrgs.map((org) => (
            <button
              key={org.id}
              onClick={() => { window.location.href = getOrgSubdomainUrl(org.slug); }}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-border hover:border-teal-400 hover:shadow-md transition-all text-left group"
            >
              <div className="h-12 w-12 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {(org as any).logoUrl
                  ? <img src={(org as any).logoUrl} alt={org.name} className="h-full w-full object-contain" />
                  : <span className="text-teal-700 font-bold text-lg">{org.name.charAt(0)}</span>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{org.name}</p>
                <p className="text-sm text-gray-400 truncate">{getOrgSubdomainUrl(org.slug).replace(/^https?:\/\//, "")}</p>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-teal-600" />
            </button>
          ))}
        </div>
      </div>
    );
    return <SchoolPickerInline />;
  }

  // Fallback: regular member dashboard (single org, redirect pending)
  return <MemberDashboard />;
}
