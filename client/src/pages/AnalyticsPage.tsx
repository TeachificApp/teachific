import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  Activity, BarChart3, BookOpen, CheckCircle2, Clock,
  Download, FileArchive, Play, TrendingUp, Users, Search,
  ChevronDown, ChevronUp, ExternalLink,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useOrgScope } from "@/hooks/useOrgScope";

const COLORS = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

function StatCard({
  title, value, sub, icon: Icon, colorClass = "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
}: { title: string; value: string | number; sub?: string; icon: React.ElementType; colorClass?: string }) {
  return (
    <Card className="shadow-sm border-border/60">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Learner Sessions Table ────────────────────────────────────────────────────
function LearnerSessionsTable({ packageId, packageTitle }: { packageId: number; packageTitle: string }) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<"startedAt" | "learnerName" | "completionStatus" | "scoreRaw">("startedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data: sessions, isLoading } = trpc.sessions.listByPackage.useQuery(
    { packageId, limit: 500 },
    { enabled: !!packageId }
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return (sessions ?? []).filter((s: any) =>
      !q ||
      (s.learnerName ?? "").toLowerCase().includes(q) ||
      (s.learnerEmail ?? "").toLowerCase().includes(q) ||
      (s.learnerId ?? "").toLowerCase().includes(q) ||
      (s.learnerGroup ?? "").toLowerCase().includes(q)
    );
  }, [sessions, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a: any, b: any) => {
      let av = a[sortField] ?? "";
      let bv = b[sortField] ?? "";
      if (sortField === "startedAt") { av = new Date(av).getTime(); bv = new Date(bv).getTime(); }
      if (sortField === "scoreRaw") { av = av ?? -1; bv = bv ?? -1; }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filtered, sortField, sortDir]);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return null;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3 inline ml-0.5" /> : <ChevronDown className="h-3 w-3 inline ml-0.5" />;
  };

  const completionBadge = (status: string) => {
    const map: Record<string, string> = {
      completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
      passed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
      failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      incomplete: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      not_attempted: "bg-muted text-muted-foreground",
    };
    return map[status] ?? "bg-muted text-muted-foreground";
  };

  const handleExportCSV = () => {
    const rows = [
      ["Learner Name", "Email", "ID", "Group", "Started", "Duration (min)", "Status", "Score", "UTM Source", "UTM Campaign"],
      ...sorted.map((s: any) => [
        s.learnerName ?? "",
        s.learnerEmail ?? "",
        s.learnerId ?? "",
        s.learnerGroup ?? "",
        s.startedAt ? new Date(s.startedAt).toLocaleString() : "",
        s.durationSeconds ? Math.round(s.durationSeconds / 60) : "",
        s.completionStatus ?? "",
        s.scoreRaw != null ? s.scoreRaw : "",
        s.utmSource ?? "",
        s.utmCampaign ?? "",
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${packageTitle.replace(/\s+/g, "-")}-learners.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search learners..."
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Button size="sm" variant="outline" onClick={handleExportCSV} className="gap-1.5 text-xs h-8">
          <Download className="h-3.5 w-3.5" />Export CSV
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">{sorted.length} sessions</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort("learnerName")}>
                Learner <SortIcon field="learnerName" />
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Group</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort("startedAt")}>
                Started <SortIcon field="startedAt" />
              </th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground">Duration</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort("completionStatus")}>
                Status <SortIcon field="completionStatus" />
              </th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort("scoreRaw")}>
                Score <SortIcon field="scoreRaw" />
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">UTM</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={7} className="px-4 py-2"><Skeleton className="h-7 w-full" /></td></tr>
              ))
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground text-sm">
                  {search ? "No sessions match your search" : "No sessions recorded yet"}
                </td>
              </tr>
            ) : (
              sorted.map((s: any) => (
                <tr key={s.id} className="hover:bg-accent/20 transition-colors">
                  <td className="px-4 py-2.5">
                    <div>
                      <p className="font-medium text-sm">{s.learnerName || <span className="text-muted-foreground italic">Anonymous</span>}</p>
                      {s.learnerEmail && <p className="text-xs text-muted-foreground">{s.learnerEmail}</p>}
                      {s.learnerId && <p className="text-xs text-muted-foreground font-mono">ID: {s.learnerId}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{s.learnerGroup || "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    {s.startedAt ? new Date(s.startedAt).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-center text-xs">
                    {s.durationSeconds ? `${Math.round(s.durationSeconds / 60)}m` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${completionBadge(s.completionStatus ?? "not_attempted")}`}>
                      {(s.completionStatus ?? "not_attempted").replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center text-xs font-medium">
                    {s.scoreRaw != null ? (s.scoreMax ? `${s.scoreRaw}/${s.scoreMax}` : s.scoreRaw) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {[s.utmSource, s.utmMedium, s.utmCampaign].filter(Boolean).join(" / ") || "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [, setLocation] = useLocation();
  const { activeOrg } = useOrgScope();
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);

  const { data: summary, isLoading: summaryLoading } = trpc.analytics.summary.useQuery({});
  const { data: packages, isLoading: pkgsLoading } = trpc.packages.list.useQuery(
    activeOrg?.id ? { orgId: activeOrg.id } : undefined,
  );
  const { data: pkgAnalytics } = trpc.analytics.byPackage.useQuery(
    { packageId: selectedPackageId! },
    { enabled: !!selectedPackageId }
  );

  const isLoading = summaryLoading || pkgsLoading;

  const topPackages = useMemo(() => {
    return [...(packages ?? [])].sort((a, b) => (b.totalPlayCount ?? 0) - (a.totalPlayCount ?? 0)).slice(0, 10);
  }, [packages]);

  const playsChartData = useMemo(() => {
    return topPackages.map((p) => ({
      name: p.title.length > 18 ? p.title.slice(0, 18) + "…" : p.title,
      plays: p.totalPlayCount ?? 0,
      downloads: p.totalDownloadCount ?? 0,
    }));
  }, [topPackages]);

  const contentTypeData = useMemo(() => {
    const counts: Record<string, number> = {};
    (packages ?? []).forEach((p) => {
      counts[p.contentType] = (counts[p.contentType] ?? 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [packages]);

  const completionRate = (summary as any)?.completionRate ?? 0;
  const totalPlays = (summary as any)?.totalPlays ?? 0;
  const totalDownloads = (summary as any)?.totalDownloads ?? 0;
  const avgDuration = (summary as any)?.avgDurationSeconds ?? 0;

  const handleExportCSV = () => {
    const rows = [
      ["Title", "Content Type", "SCORM Version", "Plays", "Downloads", "Uploaded"],
      ...(packages ?? []).map((p) => [
        p.title,
        p.contentType,
        p.scormVersion,
        p.totalPlayCount ?? 0,
        p.totalDownloadCount ?? 0,
        new Date(p.createdAt).toLocaleDateString(),
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "teachific-analytics.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedPackage = packages?.find((p) => p.id === selectedPackageId);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Content engagement, usage statistics, and learner progress</p>
        </div>
        <Button variant="outline" onClick={handleExportCSV} className="gap-2">
          <Download className="h-4 w-4" />Export CSV
        </Button>
      </div>

      {/* Summary Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Packages"
            value={packages?.length ?? 0}
            sub={`${(packages ?? []).filter((p) => p.status === "ready").length} ready`}
            icon={FileArchive}
            colorClass="bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
          />
          <StatCard
            title="Total Plays"
            value={totalPlays.toLocaleString()}
            sub="all time"
            icon={Play}
            colorClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
          />
          <StatCard
            title="Total Downloads"
            value={totalDownloads.toLocaleString()}
            icon={Download}
            colorClass="bg-[color:color-mix(in_srgb,var(--org-primary)_12%,transparent)] text-[var(--org-primary)]"
          />
          <StatCard
            title="Completion Rate"
            value={`${completionRate}%`}
            sub={avgDuration > 0 ? `Avg ${Math.round(avgDuration / 60)}m per session` : undefined}
            icon={CheckCircle2}
            colorClass="bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400"
          />
        </div>
      )}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" />Overview</TabsTrigger>
          <TabsTrigger value="content" className="gap-1.5"><FileArchive className="h-3.5 w-3.5" />Content</TabsTrigger>
          <TabsTrigger value="learners" className="gap-1.5"><Users className="h-3.5 w-3.5" />Learners</TabsTrigger>
          <TabsTrigger value="quizzes" className="gap-1.5"><BookOpen className="h-3.5 w-3.5" />Quizzes</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-5 space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="shadow-sm border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />Top Content by Plays
                </CardTitle>
              </CardHeader>
              <CardContent>
                {playsChartData.length === 0 ? (
                  <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={playsChartData} margin={{ left: -20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="plays" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Plays" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />Downloads vs Plays
                </CardTitle>
              </CardHeader>
              <CardContent>
                {playsChartData.length === 0 ? (
                  <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={playsChartData} margin={{ left: -20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="plays" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Plays" />
                      <Bar dataKey="downloads" fill="#10b981" radius={[4, 4, 0, 0]} name="Downloads" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card className="shadow-sm border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileArchive className="h-4 w-4 text-blue-500" />Content Types
                </CardTitle>
              </CardHeader>
              <CardContent>
                {contentTypeData.length === 0 ? (
                  <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={contentTypeData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={4} dataKey="value">
                        {contentTypeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                      <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border/60 lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-500" />Recent Content
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(packages ?? []).slice(0, 6).map((pkg) => (
                    <div key={pkg.id} className="flex items-center gap-3 py-1.5">
                      <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <FileArchive className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{pkg.title}</p>
                        <p className="text-xs text-muted-foreground">{new Date(pkg.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                        <span className="flex items-center gap-1"><Play className="h-3 w-3" />{pkg.totalPlayCount ?? 0}</span>
                        <span className="flex items-center gap-1"><Download className="h-3 w-3" />{pkg.totalDownloadCount ?? 0}</span>
                      </div>
                    </div>
                  ))}
                  {(!packages || packages.length === 0) && (
                    <p className="text-sm text-muted-foreground py-4 text-center">No content uploaded yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Content Tab */}
        <TabsContent value="content" className="mt-5">
          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">All Content Performance</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/30">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Package</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">SCORM</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Plays</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Downloads</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {pkgsLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i}><td colSpan={7} className="px-5 py-3"><Skeleton className="h-8 w-full" /></td></tr>
                      ))
                    ) : (packages ?? []).length === 0 ? (
                      <tr><td colSpan={7} className="px-5 py-12 text-center text-muted-foreground">No packages uploaded yet</td></tr>
                    ) : (
                      (packages ?? []).map((pkg) => (
                        <tr key={pkg.id} className="hover:bg-accent/20 transition-colors">
                          <td className="px-5 py-3">
                            <div>
                              <p className="font-medium">{pkg.title}</p>
                              <p className="text-xs text-muted-foreground">{new Date(pkg.createdAt).toLocaleDateString()}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant="secondary" className="text-xs">{pkg.contentType}</Badge>
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                            {pkg.scormVersion !== "none" ? pkg.scormVersion : "—"}
                          </td>
                          <td className="px-4 py-3 text-center font-medium">{pkg.totalPlayCount ?? 0}</td>
                          <td className="px-4 py-3 text-center font-medium">{pkg.totalDownloadCount ?? 0}</td>
                          <td className="px-4 py-3 text-center">
                            <Badge className={`text-xs ${
                              pkg.status === "ready" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                              pkg.status === "processing" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                              "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            }`}>{pkg.status}</Badge>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setLocation(`/play/${pkg.id}`)}>
                                <Play className="h-3 w-3 mr-1" />Play
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setLocation(`/files/${pkg.id}`)}>
                                Manage
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Learners Tab */}
        <TabsContent value="learners" className="mt-5 space-y-4">
          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />Learner Sessions
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Per-session breakdown with learner tracking data captured from URL parameters.
                Select a content package to view its learner sessions.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Select Content Package</label>
                <select
                  className="w-full max-w-md h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  value={selectedPackageId ?? ""}
                  onChange={(e) => setSelectedPackageId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">— Choose a package —</option>
                  {(packages ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.totalPlayCount ?? 0} plays)
                    </option>
                  ))}
                </select>
              </div>

              {selectedPackageId && selectedPackage ? (
                <>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{selectedPackage.title}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs gap-1"
                      onClick={() => setLocation(`/files/${selectedPackageId}`)}
                    >
                      <ExternalLink className="h-3 w-3" />Manage
                    </Button>
                  </div>
                  <LearnerSessionsTable packageId={selectedPackageId} packageTitle={selectedPackage.title} />
                </>
              ) : (
                <div className="py-10 text-center text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium text-sm">Select a package to view learner sessions</p>
                  <p className="text-xs mt-1 max-w-sm mx-auto">
                    Learner data is captured when users access content via URLs with tracking parameters
                    (learner_name, learner_email, learner_id, etc.)
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Quizzes Tab */}
        <TabsContent value="quizzes" className="mt-5">
          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-[var(--org-primary)]" />Quiz Performance
                </CardTitle>
                <Button size="sm" variant="outline" onClick={() => setLocation("/quizzes")} className="gap-1.5 text-xs">
                  <BookOpen className="h-3.5 w-3.5" />Manage Quizzes
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="py-8 text-center text-muted-foreground">
                <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Quiz analytics coming soon</p>
                <p className="text-xs mt-1">Per-question stats, pass rates, and attempt history will appear here</p>
                <Button size="sm" variant="outline" className="mt-4" onClick={() => setLocation("/quizzes/new")}>
                  <BookOpen className="h-3.5 w-3.5 mr-1.5" />Create Your First Quiz
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
