import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useOrgScope } from "@/hooks/useOrgScope";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Users, BookOpen, Brain, TrendingUp, Download, Filter } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";
import { toast } from "sonner";

function StatCard({ title, value, subtitle, icon: Icon }: { title: string; value: string | number; subtitle?: string; icon: any }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{title}</p>
            <p className="text-xl font-bold">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function OrgAnalyticsPage() {
  const { orgId, ready } = useOrgScope();
  const [tab, setTab] = useState("overview");
  const [period, setPeriod] = useState("30");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [groupBy, setGroupBy] = useState<"day" | "week" | "month">("week");

  const dateFrom = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - parseInt(period));
    return d.toISOString();
  }, [period]);

  const groupsQuery = trpc.lms.groups.list.useQuery(
    { orgId: orgId! },
    { enabled: ready && !!orgId }
  );

  const byGroupQuery = trpc.lms.analytics.byGroup.useQuery(
    { orgId: orgId!, groupId: groupFilter !== "all" ? parseInt(groupFilter) : undefined, dateFrom },
    { enabled: ready && !!orgId }
  );

  const courseAnalyticsQuery = trpc.lms.analytics.courseAnalytics.useQuery(
    { orgId: orgId!, dateFrom, groupBy },
    { enabled: ready && !!orgId }
  );

  const quizAnalyticsQuery = trpc.lms.analytics.quizAnalytics.useQuery(
    { orgId: orgId!, dateFrom, groupBy },
    { enabled: ready && !!orgId }
  );

  const coursesQuery = trpc.lms.courses.list.useQuery(
    { orgId: orgId! },
    { enabled: ready && !!orgId }
  );

  const groups = groupsQuery.data ?? [];
  const groupData = byGroupQuery.data ?? [];
  const courseAnalytics = courseAnalyticsQuery.data;
  const quizAnalytics = quizAnalyticsQuery.data;
  const coursesList = coursesQuery.data ?? [];

  const exportCsv = (data: any[], filename: string) => {
    if (!data.length) { toast.info("No data to export"); return; }
    const headers = Object.keys(data[0]);
    const csv = [headers.join(","), ...data.map(row => headers.map(h => JSON.stringify(row[h] ?? "")).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  if (!ready || !orgId) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            Organization Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Course and quiz performance by organization groups</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Select value={groupFilter} onValueChange={setGroupFilter}>
            <SelectTrigger className="w-[160px]">
              <Filter className="w-3.5 h-3.5 mr-1" />
              <SelectValue placeholder="All Groups" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Groups</SelectItem>
              {groups.map((g: any) => (
                <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={groupBy} onValueChange={(v: any) => setGroupBy(v)}>
            <SelectTrigger className="w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Daily</SelectItem>
              <SelectItem value="week">Weekly</SelectItem>
              <SelectItem value="month">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="courses">Courses</TabsTrigger>
          <TabsTrigger value="quizzes">Quizzes</TabsTrigger>
          <TabsTrigger value="groups">By Group</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="Total Enrollments" value={courseAnalytics?.summary.totalEnrollments ?? 0} icon={BookOpen} />
            <StatCard title="Completions" value={courseAnalytics?.summary.completions ?? 0} subtitle={`${courseAnalytics?.summary.completionRate ?? 0}% rate`} icon={TrendingUp} />
            <StatCard title="Quiz Attempts" value={quizAnalytics?.summary.totalAttempts ?? 0} icon={Brain} />
            <StatCard title="Avg Quiz Score" value={`${quizAnalytics?.summary.avgScore ?? 0}%`} subtitle={`${quizAnalytics?.summary.passRate ?? 0}% pass rate`} icon={BarChart3} />
          </div>

          {/* Combined timeline */}
          {courseAnalytics?.timeline && courseAnalytics.timeline.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Enrollment Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={courseAnalytics.timeline}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="enrollments" stroke="#6366f1" name="Enrollments" strokeWidth={2} />
                    <Line type="monotone" dataKey="completions" stroke="#22c55e" name="Completions" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Courses Tab */}
        <TabsContent value="courses" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="Total Enrollments" value={courseAnalytics?.summary.totalEnrollments ?? 0} icon={BookOpen} />
            <StatCard title="Completions" value={courseAnalytics?.summary.completions ?? 0} icon={TrendingUp} />
            <StatCard title="Avg Progress" value={`${courseAnalytics?.summary.avgProgress ?? 0}%`} icon={BarChart3} />
            <StatCard title="Revenue" value={`$${(courseAnalytics?.summary.totalRevenue ?? 0).toFixed(2)}`} icon={TrendingUp} />
          </div>

          {/* Per-course breakdown */}
          {courseAnalytics?.perCourse && courseAnalytics.perCourse.length > 0 && (
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">Per-Course Breakdown</CardTitle>
                <button
                  onClick={() => exportCsv(courseAnalytics.perCourse.map((c: any) => ({
                    Course: coursesList.find((co: any) => co.id === c.courseId)?.title ?? `Course #${c.courseId}`,
                    Enrollments: c.enrollments,
                    Completions: c.completions,
                    "Avg Progress": c.avgProgress,
                    Revenue: c.revenue,
                  })), "course-analytics.csv")}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <Download className="w-3 h-3" /> Export CSV
                </button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 font-medium">Course</th>
                        <th className="pb-2 font-medium text-right">Enrollments</th>
                        <th className="pb-2 font-medium text-right">Completions</th>
                        <th className="pb-2 font-medium text-right">Avg Progress</th>
                        <th className="pb-2 font-medium text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {courseAnalytics.perCourse.map((c: any) => (
                        <tr key={c.courseId} className="border-b last:border-0">
                          <td className="py-2">{coursesList.find((co: any) => co.id === c.courseId)?.title ?? `Course #${c.courseId}`}</td>
                          <td className="py-2 text-right">{c.enrollments}</td>
                          <td className="py-2 text-right">{c.completions}</td>
                          <td className="py-2 text-right">{Number(c.avgProgress).toFixed(1)}%</td>
                          <td className="py-2 text-right">${Number(c.revenue).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Timeline chart */}
          {courseAnalytics?.timeline && courseAnalytics.timeline.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Enrollment Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={courseAnalytics.timeline}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="enrollments" fill="#6366f1" name="Enrollments" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="completions" fill="#22c55e" name="Completions" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Quizzes Tab */}
        <TabsContent value="quizzes" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="Total Attempts" value={quizAnalytics?.summary.totalAttempts ?? 0} icon={Brain} />
            <StatCard title="Avg Score" value={`${quizAnalytics?.summary.avgScore ?? 0}%`} icon={BarChart3} />
            <StatCard title="Pass Rate" value={`${quizAnalytics?.summary.passRate ?? 0}%`} icon={TrendingUp} />
            <StatCard title="Avg Time" value={`${Math.round((quizAnalytics?.summary.avgTime ?? 0) / 60)}m`} icon={Users} />
          </div>

          {/* Per-quiz breakdown */}
          {quizAnalytics?.perQuiz && quizAnalytics.perQuiz.length > 0 && (
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">Per-Quiz Breakdown</CardTitle>
                <button
                  onClick={() => exportCsv(quizAnalytics.perQuiz.map((q: any) => ({
                    "Quiz ID": q.quizId,
                    Attempts: q.attempts,
                    "Avg Score": q.avgScore,
                    Passed: q.passed,
                    "Avg Time (s)": q.avgTime,
                  })), "quiz-analytics.csv")}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <Download className="w-3 h-3" /> Export CSV
                </button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 font-medium">Quiz</th>
                        <th className="pb-2 font-medium text-right">Attempts</th>
                        <th className="pb-2 font-medium text-right">Avg Score</th>
                        <th className="pb-2 font-medium text-right">Pass Rate</th>
                        <th className="pb-2 font-medium text-right">Avg Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quizAnalytics.perQuiz.map((q: any) => {
                        const passRate = Number(q.attempts) > 0 ? Math.round((Number(q.passed) / Number(q.attempts)) * 100) : 0;
                        return (
                          <tr key={q.quizId} className="border-b last:border-0">
                            <td className="py-2">Quiz #{q.quizId}</td>
                            <td className="py-2 text-right">{q.attempts}</td>
                            <td className="py-2 text-right">{Number(q.avgScore).toFixed(1)}%</td>
                            <td className="py-2 text-right">{passRate}%</td>
                            <td className="py-2 text-right">{Math.round(Number(q.avgTime) / 60)}m</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Timeline chart */}
          {quizAnalytics?.timeline && quizAnalytics.timeline.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Quiz Activity Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={quizAnalytics.timeline}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="attempts" stroke="#6366f1" name="Attempts" strokeWidth={2} />
                    <Line type="monotone" dataKey="avgScore" stroke="#f97316" name="Avg Score %" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* By Group Tab */}
        <TabsContent value="groups" className="space-y-6">
          {groupData.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No groups found</p>
                <p className="text-sm mt-1">Create groups in Members &gt; Groups to see analytics by group.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Group comparison chart */}
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-medium">Group Comparison</CardTitle>
                  <button
                    onClick={() => exportCsv(groupData.map((g: any) => ({
                      Group: g.groupName,
                      Members: g.memberCount,
                      Enrollments: g.courseMetrics.enrollments,
                      "Course Completions": g.courseMetrics.completions,
                      "Avg Progress": g.courseMetrics.avgProgress,
                      "Quiz Attempts": g.quizMetrics.attempts,
                      "Avg Quiz Score": g.quizMetrics.avgScore,
                      "Quiz Pass Rate": g.quizMetrics.passRate,
                    })), "group-analytics.csv")}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" /> Export CSV
                  </button>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={groupData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis dataKey="groupName" type="category" width={120} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="courseMetrics.enrollments" fill="#6366f1" name="Enrollments" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="courseMetrics.completions" fill="#22c55e" name="Completions" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="quizMetrics.attempts" fill="#f97316" name="Quiz Attempts" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Group table */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Detailed Group Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="pb-2 font-medium">Group</th>
                          <th className="pb-2 font-medium text-right">Members</th>
                          <th className="pb-2 font-medium text-right">Enrollments</th>
                          <th className="pb-2 font-medium text-right">Completions</th>
                          <th className="pb-2 font-medium text-right">Avg Progress</th>
                          <th className="pb-2 font-medium text-right">Quiz Attempts</th>
                          <th className="pb-2 font-medium text-right">Avg Score</th>
                          <th className="pb-2 font-medium text-right">Pass Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupData.map((g: any) => (
                          <tr key={g.groupId} className="border-b last:border-0">
                            <td className="py-2 font-medium">{g.groupName}</td>
                            <td className="py-2 text-right">{g.memberCount}</td>
                            <td className="py-2 text-right">{g.courseMetrics.enrollments}</td>
                            <td className="py-2 text-right">{g.courseMetrics.completions}</td>
                            <td className="py-2 text-right">{g.courseMetrics.avgProgress}%</td>
                            <td className="py-2 text-right">{g.quizMetrics.attempts}</td>
                            <td className="py-2 text-right">{g.quizMetrics.avgScore}%</td>
                            <td className="py-2 text-right">{g.quizMetrics.passRate}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
