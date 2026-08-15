import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useOrgScope } from "@/hooks/useOrgScope";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3,
  BookOpen,
  Clock,
  Download,
  FileArchive,
  Play,
  Plus,
  TrendingUp,
  Upload,
} from "lucide-react";
import { useLocation } from "wouter";
import { useMemo } from "react";

function StatCard({
  title,
  value,
  icon: Icon,
  sub,
  color = "blue",
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  sub?: string;
  color?: "blue" | "green" | "purple" | "amber";
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
    green: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400",
    purple: "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400",
  };
  return (
    <Card className="shadow-sm border-border/60">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${colors[color]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ContentTypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; class: string }> = {
    scorm: { label: "SCORM", class: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
    articulate: { label: "Articulate", class: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
    ispring: { label: "iSpring", class: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
    html: { label: "HTML", class: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
    unknown: { label: "Unknown", class: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  };
  const info = map[type] ?? map.unknown;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${info.class}`}>
      {info.label}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ready: "bg-emerald-500",
    processing: "bg-amber-500 animate-pulse",
    error: "bg-red-500",
    uploading: "bg-blue-500 animate-pulse",
  };
  return <span className={`inline-block h-2 w-2 rounded-full ${colors[status] ?? "bg-gray-400"}`} />;
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { activeOrg } = useOrgScope();

  const { data: packages, isLoading: pkgLoading } = trpc.packages.list.useQuery(
    activeOrg?.id ? { orgId: activeOrg.id } : undefined,
  );
  const { data: analytics } = trpc.analytics.summary.useQuery({});
  const { data: myOrgs } = trpc.orgs.myOrgs.useQuery();

  const stats = useMemo(() => {
    const total = packages?.length ?? 0;
    const ready = packages?.filter((p) => p.status === "ready").length ?? 0;
    const totalPlays = packages?.reduce((s, p) => s + (p.totalPlayCount ?? 0), 0) ?? 0;
    const totalDownloads = packages?.reduce((s, p) => s + (p.totalDownloadCount ?? 0), 0) ?? 0;
    return { total, ready, totalPlays, totalDownloads };
  }, [packages]);

  const recentPackages = useMemo(() => {
    return [...(packages ?? [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8);
  }, [packages]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Welcome back, {user?.name?.split(" ")[0] ?? "there"}
          </p>
        </div>
        <Button onClick={() => setLocation("/upload")} className="gap-2">
          <Plus className="h-4 w-4" />
          Upload Content
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {pkgLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="shadow-sm">
              <CardContent className="p-5">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <StatCard title="Total Packages" value={stats.total} icon={FileArchive} sub={`${stats.ready} ready`} color="blue" />
            <StatCard title="Total Plays" value={stats.totalPlays.toLocaleString()} icon={Play} color="green" />
            <StatCard title="Downloads" value={stats.totalDownloads.toLocaleString()} icon={Download} color="purple" />
            <StatCard title="Organizations" value={myOrgs?.length ?? 0} icon={BarChart3} color="amber" />
          </>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Upload SCORM", icon: Upload, path: "/upload", color: "text-blue-600" },
          { label: "Create Quiz", icon: BookOpen, path: "/quizzes/new", color: "text-purple-600" },
          { label: "View Analytics", icon: TrendingUp, path: "/analytics", color: "text-green-600" },
          { label: "Manage Files", icon: FileArchive, path: "/files", color: "text-amber-600" },
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

      {/* Recent Files */}
      <Card className="shadow-sm border-border/60">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">Recent Content</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setLocation("/files")} className="text-xs text-muted-foreground">
            View all
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {pkgLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : recentPackages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileArchive className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No content uploaded yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Upload your first SCORM or HTML package to get started</p>
              <Button size="sm" className="mt-4 gap-2" onClick={() => setLocation("/upload")}>
                <Upload className="h-3.5 w-3.5" />
                Upload Content
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {recentPackages.map((pkg) => (
                <div
                  key={pkg.id}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-accent/30 transition-colors cursor-pointer"
                  onClick={() => setLocation(`/files/${pkg.id}`)}
                >
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileArchive className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{pkg.title}</p>
                      <StatusDot status={pkg.status} />
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <ContentTypeBadge type={pkg.contentType} />
                      {pkg.scormVersion !== "none" && (
                        <span className="text-xs text-muted-foreground">SCORM {pkg.scormVersion}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                    <span className="flex items-center gap-1">
                      <Play className="h-3 w-3" />
                      {pkg.totalPlayCount ?? 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(pkg.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
