import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getSubdomain } from "@/hooks/useSubdomain";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import {
  Users, BookOpen, TrendingUp, DollarSign, Activity,
  ArrowRight, GraduationCap, Clock, CheckCircle, Plus,
  BarChart3, UserPlus,
} from "lucide-react";

function StatCard({
  title, value, sub, icon: Icon, color, trend,
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
  trend?: string;
}) {
  return (
    <Card className="shadow-sm border-border/60">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-2xl font-bold mt-1 truncate">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
            {trend && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> {trend}
              </p>
            )}
          </div>
          <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ml-3 ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniBarChart({ data }: { data: { date: string; enrollments: number; revenue: number }[] }) {
  if (!data || data.length === 0) return (
    <div className="flex items-center justify-center h-24 text-xs text-muted-foreground">No data yet</div>
  );
  const maxEnrollments = Math.max(...data.map((d) => d.enrollments), 1);
  // Show last 14 bars max
  const visible = data.slice(-14);
  return (
    <div className="flex items-end gap-1 h-20 w-full">
      {visible.map((d, i) => {
        const h = Math.max(4, Math.round((d.enrollments / maxEnrollments) * 72));
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
            <div
              className="w-full rounded-sm bg-primary/70 hover:bg-primary transition-colors cursor-default"
              style={{ height: `${h}px` }}
            />
            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-xs px-1.5 py-0.5 rounded shadow-md opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10">
              {d.date}: {d.enrollments} enrollments
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function LmsDashboardPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [days] = useState(30);

  const currentSubdomain = getSubdomain() ?? undefined;
  const { data: orgCtx, isLoading: orgLoading } = trpc.orgs.myContext.useQuery(
    { subdomain: currentSubdomain },
    { enabled: !!user }
  );

  const orgId = orgCtx?.org?.id;

  // Redirect regular members (non-admins) to their courses page
  useEffect(() => {
    if (!orgLoading && orgCtx) {
      const isAdmin =
        user?.role === "site_owner" ||
        user?.role === "site_admin" ||
        user?.role === "org_super_admin" ||
        orgCtx.role === "org_admin";
      if (!isAdmin) setLocation("/lms/my-courses");
    }
  }, [orgCtx, orgLoading, user, setLocation]);

  const { data: metrics, isLoading: metricsLoading } = trpc.lms.dashboard.metrics.useQuery(
    { orgId: orgId!, days },
    { enabled: !!orgId }
  );

  const { data: chartData, isLoading: chartLoading } = trpc.lms.dashboard.chartData.useQuery(
    { orgId: orgId!, days, groupBy: "day" },
    { enabled: !!orgId }
  );

  const { data: recentActivity, isLoading: activityLoading } = trpc.lms.dashboard.recentActivity.useQuery(
    { orgId: orgId!, limit: 8 },
    { enabled: !!orgId }
  );

  const { data: recentCourses, isLoading: coursesLoading } = trpc.lms.dashboard.recentCourses.useQuery(
    { orgId: orgId!, limit: 6 },
    { enabled: !!orgId }
  );

  const chartDataTyped = useMemo(
    () => (chartData ?? []).map((d) => ({
      date: d.date ?? "",
      enrollments: Number(d.enrollments ?? 0),
      revenue: Number(d.revenue ?? 0),
    })),
    [chartData]
  );

  const isLoading = orgLoading || metricsLoading;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-7xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const org = orgCtx?.org;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {org?.name ?? "Dashboard"}
          </h1>
          <p className="text-muted-foreground mt-0.5 text-sm">Last {days} days overview</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setLocation("/lms/members")}>
            <UserPlus className="h-3.5 w-3.5" /> Add Member
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setLocation("/lms/courses?create=1")}>
            <Plus className="h-3.5 w-3.5" /> New Course
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          title="Revenue"
          value={`$${(metrics?.revenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sub={`${days} days`}
          icon={DollarSign}
          color="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
        />
        <StatCard
          title="Enrollments"
          value={(metrics?.registrations ?? 0).toLocaleString()}
          sub={`${days} days`}
          icon={GraduationCap}
          color="bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
        />
        <StatCard
          title="Active Members"
          value={(metrics?.activeMembers ?? 0).toLocaleString()}
          sub="all time"
          icon={Users}
          color="bg-[color:color-mix(in_srgb,var(--org-primary)_10%,transparent)] text-[var(--org-primary)]"
        />
        <StatCard
          title="Paid Sales"
          value={(metrics?.sales ?? 0).toLocaleString()}
          sub={`${days} days`}
          icon={TrendingUp}
          color="bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400"
        />
      </div>

      {/* Enrollment Chart */}
      <Card className="shadow-sm border-border/60">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" /> Enrollment Activity
          </CardTitle>
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setLocation("/lms/analytics")}>
            Full Analytics <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          {chartLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <MiniBarChart data={chartDataTyped} />
          )}
          <p className="text-xs text-muted-foreground mt-2">Daily enrollments — last {days} days</p>
        </CardContent>
      </Card>

      {/* Two-column: Recent Activity + Recent Courses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card className="shadow-sm border-border/60">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Recent Enrollments
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setLocation("/lms/activity")}>
              View all <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {activityLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : !recentActivity || recentActivity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <Users className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No enrollments yet</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Enrollments will appear here as students join courses</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {recentActivity.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/20 transition-colors">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <UserPlus className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.userName || item.userEmail}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.courseName}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {Number(item.price) > 0 && (
                        <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          ${Number(item.price).toFixed(2)}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Courses */}
        <Card className="shadow-sm border-border/60">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" /> Recent Courses
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setLocation("/lms/courses")}>
              View all <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {coursesLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : !recentCourses || recentCourses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <BookOpen className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No courses yet</p>
                <Button size="sm" className="mt-3 gap-1.5" onClick={() => setLocation("/lms/courses?create=1")}>
                  <Plus className="h-3.5 w-3.5" /> Create First Course
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {recentCourses.map((course) => (
                  <div
                    key={course.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-accent/20 transition-colors cursor-pointer"
                    onClick={() => setLocation(`/lms/courses/${course.id}`)}
                  >
                    {course.thumbnailUrl ? (
                      <img
                        src={course.thumbnailUrl}
                        alt={course.title}
                        className="h-10 w-14 rounded object-cover shrink-0"
                      />
                    ) : (
                      <div className="h-10 w-14 rounded bg-primary/10 flex items-center justify-center shrink-0">
                        <BookOpen className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{course.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge
                          variant={course.status === "published" ? "default" : "secondary"}
                          className="text-xs px-1.5 py-0 h-4"
                        >
                          {course.status === "published" ? (
                            <><CheckCircle className="h-2.5 w-2.5 mr-1" />Published</>
                          ) : course.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(course.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="shadow-sm border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "New Course", icon: Plus, path: "/lms/courses?create=1", color: "text-primary" },
              { label: "Add Member", icon: UserPlus, path: "/lms/members", color: "text-blue-600" },
              { label: "Analytics", icon: BarChart3, path: "/lms/analytics", color: "text-[var(--org-primary)]" },
              { label: "Activity Log", icon: Activity, path: "/lms/activity", color: "text-amber-600" },
            ].map((action) => (
              <button
                key={action.path}
                onClick={() => setLocation(action.path)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border/60 bg-card hover:bg-accent/50 transition-all hover:shadow-sm text-center"
              >
                <action.icon className={`h-6 w-6 ${action.color}`} />
                <span className="text-xs font-medium text-foreground">{action.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
