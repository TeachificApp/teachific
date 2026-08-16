import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Activity,
  Search,
  Download,
  RefreshCw,
  User,
  BookOpen,
  Clock,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import { toast } from "sonner";

const EVENT_TYPES = [
  "page_view", "page_exit", "session_start", "session_heartbeat", "session_end",
  "video_play", "video_pause", "video_seek", "video_complete", "video_progress",
  "lesson_start", "lesson_complete", "quiz_start", "quiz_submit",
  "download", "link_click", "button_click", "search", "enrollment", "course_complete",
] as const;

const EVENT_COLORS: Record<string, string> = {
  lesson_start: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  lesson_complete: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  quiz_start: "bg-[color:color-mix(in_srgb,var(--org-primary)_15%,transparent)] text-[var(--org-primary)]",
  quiz_submit: "bg-[color:color-mix(in_srgb,var(--org-primary)_15%,transparent)] text-[var(--org-primary)]",
  enrollment: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  course_complete: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  video_play: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  video_complete: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  download: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
  page_view: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  session_start: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  session_end: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

function OrgPicker({ value, onChange }: { value: number | null; onChange: (id: number | null) => void }) {
  const { data: orgs } = trpc.orgs.list.useQuery();
  return (
    <div className="space-y-1.5">
      <Label>Organization</Label>
      <select
        className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      >
        <option value="">Select an organization…</option>
        {orgs?.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
    </div>
  );
}

const PAGE_SIZE = 50;

export default function StudentLogReportsPage() {
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | undefined>(undefined);
  const [selectedCourseId, setSelectedCourseId] = useState<number | undefined>(undefined);
  const [selectedEventType, setSelectedEventType] = useState<string | undefined>(undefined);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");

  // Fetch members for filter
  const { data: members } = trpc.lms.activity.memberList.useQuery(
    { orgId: selectedOrgId! },
    { enabled: !!selectedOrgId }
  );

  // Fetch courses for filter
  const { data: courses } = trpc.lms.courses.list.useQuery(
    { orgId: selectedOrgId! },
    { enabled: !!selectedOrgId }
  );

  // Fetch activity events
  const { data: events, isLoading, refetch } = trpc.lms.activity.list.useQuery(
    {
      orgId: selectedOrgId!,
      userId: selectedUserId,
      courseId: selectedCourseId,
      eventType: selectedEventType,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      limit: PAGE_SIZE,
      offset,
    },
    { enabled: !!selectedOrgId }
  );

  // Filter by search (client-side on the current page)
  const filtered = useMemo(() => {
    if (!events || !search.trim()) return events ?? [];
    const q = search.toLowerCase();
    return events.filter((e: any) =>
      e.pageTitle?.toLowerCase().includes(q) ||
      e.pageUrl?.toLowerCase().includes(q) ||
      e.eventType?.toLowerCase().includes(q) ||
      String(e.userId).includes(q)
    );
  }, [events, search]);

  function resetFilters() {
    setSelectedUserId(undefined);
    setSelectedCourseId(undefined);
    setSelectedEventType(undefined);
    setDateFrom("");
    setDateTo("");
    setOffset(0);
    setSearch("");
  }

  function exportCsv() {
    if (!filtered.length) {
      toast.error("No data to export");
      return;
    }
    const headers = ["Timestamp", "Event Type", "User ID", "Course ID", "Lesson ID", "Page Title", "Page URL", "Duration (ms)"];
    const rows = filtered.map((e: any) => [
      new Date(e.createdAt).toISOString(),
      e.eventType,
      e.userId,
      e.courseId ?? "",
      e.lessonId ?? "",
      e.pageTitle ?? "",
      e.pageUrl ?? "",
      e.durationMs ?? "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activity-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  }

  // Summary stats
  const totalEvents = filtered.length;
  const uniqueUsers = new Set(filtered.map((e: any) => e.userId)).size;
  const completions = filtered.filter((e: any) => e.eventType === "lesson_complete" || e.eventType === "course_complete").length;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Student Activity Log
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Track and filter all learner activity events across your organization
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1.5" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-1.5" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Org Picker */}
      <OrgPicker value={selectedOrgId} onChange={(id) => { setSelectedOrgId(id); resetFilters(); }} />

      {selectedOrgId && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Activity className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalEvents}</p>
                  <p className="text-xs text-muted-foreground">Events (this page)</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                  <User className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{uniqueUsers}</p>
                  <p className="text-xs text-muted-foreground">Unique Students</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                  <BookOpen className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{completions}</p>
                  <p className="text-xs text-muted-foreground">Completions</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4" /> Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Student filter */}
                <div className="space-y-1.5">
                  <Label>Student</Label>
                  <Select
                    value={selectedUserId?.toString() ?? "all"}
                    onValueChange={(v) => { setSelectedUserId(v === "all" ? undefined : Number(v)); setOffset(0); }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All students" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All students</SelectItem>
                      {(members ?? []).map((m: any) => (
                        <SelectItem key={m.id} value={String(m.id)}>
                          {m.name || m.email || `User #${m.id}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Course filter */}
                <div className="space-y-1.5">
                  <Label>Course</Label>
                  <Select
                    value={selectedCourseId?.toString() ?? "all"}
                    onValueChange={(v) => { setSelectedCourseId(v === "all" ? undefined : Number(v)); setOffset(0); }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All courses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All courses</SelectItem>
                      {(courses ?? []).map((c: any) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Event type filter */}
                <div className="space-y-1.5">
                  <Label>Event Type</Label>
                  <Select
                    value={selectedEventType ?? "all"}
                    onValueChange={(v) => { setSelectedEventType(v === "all" ? undefined : v); setOffset(0); }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All event types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All event types</SelectItem>
                      {EVENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date from */}
                <div className="space-y-1.5">
                  <Label>From Date</Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => { setDateFrom(e.target.value); setOffset(0); }}
                  />
                </div>

                {/* Date to */}
                <div className="space-y-1.5">
                  <Label>To Date</Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => { setDateTo(e.target.value); setOffset(0); }}
                  />
                </div>

                {/* Search */}
                <div className="space-y-1.5">
                  <Label>Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search page, URL..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  Clear Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Events Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading activity…
            </div>
          ) : filtered.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center">
                <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-30" />
                <h3 className="font-semibold mb-1">No activity found</h3>
                <p className="text-sm text-muted-foreground">
                  No events match your current filters. Try adjusting the date range or event type.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="sm:hidden space-y-3">
                {filtered.map((e: any) => (
                  <Card key={e.id}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <Badge
                          className={`text-xs font-medium ${EVENT_COLORS[e.eventType] ?? "bg-gray-100 text-gray-700"}`}
                        >
                          {e.eventType.replace(/_/g, " ")}
                        </Badge>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(e.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        {e.pageTitle && <p className="text-sm font-medium truncate">{e.pageTitle}</p>}
                        {e.pageUrl && <p className="text-xs text-muted-foreground truncate">{e.pageUrl}</p>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" /> User #{e.userId}
                        </span>
                        {e.courseId && (
                          <span className="flex items-center gap-1">
                            <BookOpen className="h-3 w-3" /> Course #{e.courseId}
                          </span>
                        )}
                        {e.durationMs && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {Math.round(e.durationMs / 1000)}s
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden sm:block border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>Page / Content</TableHead>
                      <TableHead>Duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((e: any) => (
                      <TableRow key={e.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(e.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`text-xs font-medium ${EVENT_COLORS[e.eventType] ?? "bg-gray-100 text-gray-700"}`}
                          >
                            {e.eventType.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {members?.find((m: any) => m.id === e.userId)?.name ?? `User #${e.userId}`}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {e.courseId
                            ? courses?.find((c: any) => c.id === e.courseId)?.title ?? `Course #${e.courseId}`
                            : "—"}
                        </TableCell>
                        <TableCell className="max-w-xs">
                          {e.pageTitle && (
                            <p className="text-sm font-medium truncate">{e.pageTitle}</p>
                          )}
                          {e.pageUrl && (
                            <p className="text-xs text-muted-foreground truncate">{e.pageUrl}</p>
                          )}
                          {!e.pageTitle && !e.pageUrl && <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {e.durationMs ? `${Math.round(e.durationMs / 1000)}s` : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  Showing {offset + 1}–{offset + filtered.length} events
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={offset === 0}
                    onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={(events?.length ?? 0) < PAGE_SIZE}
                    onClick={() => setOffset(offset + PAGE_SIZE)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
