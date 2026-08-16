import { trpc } from "@/lib/trpc";
import { useOrgScope } from "@/hooks/useOrgScope";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TrendingUp,
  Users,
  BookOpen,
  GraduationCap,
  DollarSign,
  BarChart3,
  Activity,
  Download,
  Video,
  ChevronRight,
} from "lucide-react";
import { useLocation } from "wouter";

export default function LmsAnalyticsPage() {
  const [, navigate] = useLocation();
  const { orgId, ready } = useOrgScope();

  const { data: analytics, isLoading } = trpc.lms.analytics.summary.useQuery(
    { orgId: orgId! },
    { enabled: ready }
  );

  const stats = [
    {
      label: "Total Courses",
      value: (analytics as any)?.totalCourses ?? 0,
      icon: BookOpen,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Total Students",
      value: (analytics as any)?.totalStudents ?? 0,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-500/10",
    },
    {
      label: "Total Enrollments",
      value: (analytics as any)?.totalEnrollments ?? 0,
      icon: TrendingUp,
      color: "text-indigo-600",
      bg: "bg-indigo-500/10",
    },
    {
      label: "Completions",
      value: (analytics as any)?.totalCompletions ?? 0,
      icon: GraduationCap,
      color: "text-green-600",
      bg: "bg-green-500/10",
    },
    {
      label: "Completion Rate",
      value: `${(analytics as any)?.completionRate ?? 0}%`,
      icon: BarChart3,
      color: "text-amber-600",
      bg: "bg-amber-500/10",
    },
    {
      label: "Revenue",
      value: `$${((analytics as any)?.totalRevenue ?? 0).toFixed(2)}`,
      icon: DollarSign,
      color: "text-emerald-600",
      bg: "bg-emerald-500/10",
    },
  ];

  const reportLinks = [
    {
      title: "Student Activity Log",
      description: "Track lesson views, completions, quiz attempts, and downloads per student.",
      icon: Activity,
      color: "text-[var(--org-primary)]",
      bg: "bg-[color:color-mix(in_srgb,var(--org-primary)_10%,transparent)]",
      path: "/lms/activity",
    },
    {
      title: "Digital Downloads Reports",
      description: "Monitor sales, revenue, and download counts for your digital products.",
      icon: Download,
      color: "text-sky-600",
      bg: "bg-sky-500/10",
      path: "/admin/downloads/reports",
    },
    {
      title: "Webinar Reports",
      description: "View registration counts, attendance rates, and replay engagement.",
      icon: Video,
      color: "text-rose-600",
      bg: "bg-rose-500/10",
      path: "/lms/webinars/reports",
    },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Overview of your school's performance
          </p>
        </div>

      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {isLoading
          ? [...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-10 w-10 rounded-lg mb-3" />
                  <Skeleton className="h-6 w-16 mb-1" />
                  <Skeleton className="h-3 w-24" />
                </CardContent>
              </Card>
            ))
          : stats.map((stat) => (
              <Card key={stat.label}>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className={`h-10 w-10 rounded-lg ${stat.bg} flex items-center justify-center shrink-0`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Enrollment trends placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Enrollment Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
            Detailed charts coming soon
          </div>
        </CardContent>
      </Card>

      {/* Reports Hub */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Reports</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {reportLinks.map((r) => (
            <Card
              key={r.path}
              className="cursor-pointer hover:shadow-md transition-shadow group"
              onClick={() => navigate(r.path)}
            >
              <CardContent className="p-5 flex flex-col gap-3">
                <div className={`h-10 w-10 rounded-lg ${r.bg} flex items-center justify-center`}>
                  <r.icon className={`h-5 w-5 ${r.color}`} />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{r.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{r.description}</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-primary font-medium group-hover:gap-2 transition-all">
                  View Report <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
