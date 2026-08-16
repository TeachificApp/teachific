import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Users, Search, Video, FileDown, TrendingUp, Clock, CheckCircle, UserCheck
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useOrgScope } from "@/hooks/useOrgScope";

export default function WebinarReportsPage() {
  const { orgId } = useOrgScope();

  const [webinarFilter, setWebinarFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: webinars } = trpc.lms.webinars.list.useQuery(
    { orgId: orgId! },
    { enabled: !!orgId }
  );

  const selectedWebinarId = webinarFilter !== "all" ? parseInt(webinarFilter) : webinars?.[0]?.id;

  const { data: registrations, isLoading } = trpc.lms.webinars.getRegistrations.useQuery(
    { webinarId: selectedWebinarId! },
    { enabled: !!selectedWebinarId }
  );

  const { data: stats } = trpc.lms.webinars.getStats.useQuery(
    { webinarId: selectedWebinarId! },
    { enabled: !!selectedWebinarId }
  );

  const filtered = useMemo(() => {
    if (!registrations) return [];
    if (!search) return registrations;
    const q = search.toLowerCase();
    return registrations.filter(r =>
      r.email?.toLowerCase().includes(q) ||
      r.firstName?.toLowerCase().includes(q) ||
      r.lastName?.toLowerCase().includes(q)
    );
  }, [registrations, search]);

  const attendanceRate = useMemo(() => {
    if (!registrations?.length) return 0;
    const attended = registrations.filter(r => r.attended).length;
    return Math.round((attended / registrations.length) * 100);
  }, [registrations]);

  const conversionRate = useMemo(() => {
    if (!registrations?.length) return 0;
    const converted = registrations.filter(r => r.convertedAt).length;
    return Math.round((converted / registrations.length) * 100);
  }, [registrations]);

  const exportCSV = () => {
    if (!filtered.length) { toast.error("No registrations to export"); return; }
    const headers = ["First Name", "Last Name", "Email", "Registered", "Attended", "Watched (s)", "Converted", "Date"];
    const rows = filtered.map(r => [
      r.firstName ?? "",
      r.lastName ?? "",
      r.email ?? "",
      "Yes",
      r.attended ? "Yes" : "No",
      r.watchedSeconds ?? 0,
      r.convertedAt ? "Yes" : "No",
      r.registeredAt ? new Date(r.registeredAt).toLocaleDateString() : "",
    ]);
    const csv = [headers, ...rows].map(row => row.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "webinar-registrations.csv"; a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported");
  };

  const selectedWebinar = webinars?.find(w => w.id === selectedWebinarId);

  return (
    <div className="lms-org-theme p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Webinar Reports</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Track registrations, attendance, and conversions</p>
        </div>
        <Button variant="outline" className="gap-2 self-start" onClick={exportCSV}>
          <FileDown className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Webinar Selector */}
      <div className="max-w-sm">
        <Select value={webinarFilter} onValueChange={setWebinarFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Select webinar" />
          </SelectTrigger>
          <SelectContent>
            {(webinars ?? []).map(w => (
              <SelectItem key={w.id} value={String(w.id)}>{w.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedWebinar && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex items-center gap-3">
            <Video className="h-5 w-5 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{selectedWebinar.title}</p>
              <p className="text-xs text-muted-foreground">
                {selectedWebinar.scheduledAt
                  ? new Date(selectedWebinar.scheduledAt).toLocaleString()
                  : "On-demand"
                }
              </p>
            </div>
            <Badge variant="outline" className="capitalize flex-shrink-0">
              {selectedWebinar.isPublished ? "Published" : "Draft"}
            </Badge>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-lg font-bold">{registrations?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Registered</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
              <UserCheck className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-lg font-bold">{registrations?.filter(r => r.attended).length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Attended</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold">{attendanceRate}%</p>
              <p className="text-xs text-muted-foreground">Attendance Rate</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[color:color-mix(in_srgb,var(--org-primary)_12%,transparent)] flex items-center justify-center flex-shrink-0">
              <CheckCircle className="h-5 w-5 text-[var(--org-primary)]" />
            </div>
            <div>
              <p className="text-lg font-bold">{conversionRate}%</p>
              <p className="text-xs text-muted-foreground">Conversion Rate</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Funnel Bar */}
      {registrations && registrations.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Funnel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "Registered", value: registrations.length, color: "bg-blue-500" },
              { label: "Attended", value: registrations.filter(r => r.attended).length, color: "bg-green-500" },
              { label: "Converted", value: registrations.filter(r => r.convertedAt).length, color: "bg-[var(--org-primary)]" },
            ].map(({ label, value, color }) => (
              <div key={label} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium">{value} ({registrations.length > 0 ? Math.round((value / registrations.length) * 100) : 0}%)</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full ${color} rounded-full transition-all`}
                    style={{ width: `${registrations.length > 0 ? (value / registrations.length) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search registrants..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Registrations */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : !selectedWebinarId ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Video className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Select a webinar to view registrations</p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No registrations yet</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {filtered.map((r, i) => (
              <Card key={i}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{[r.firstName, r.lastName].filter(Boolean).join(" ") || "Anonymous"}</p>
                      <p className="text-xs text-muted-foreground">{r.email}</p>
                    </div>
                    <div className="flex gap-1">
                      {r.attended && <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full">Attended</span>}
                      {r.convertedAt && <span className="text-xs bg-[color:color-mix(in_srgb,var(--org-primary)_12%,transparent)] text-[var(--org-primary)] px-2 py-0.5 rounded-full">Converted</span>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Watched: {r.watchedSeconds ?? 0}s</span>
                    <span>{r.registeredAt ? new Date(r.registeredAt).toLocaleDateString() : "—"}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {/* Desktop table */}
          <div className="hidden sm:block rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Attended</TableHead>
                  <TableHead>Watched</TableHead>
                  <TableHead>Converted</TableHead>
                  <TableHead>Registered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium text-sm">{[r.firstName, r.lastName].filter(Boolean).join(" ") || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.email}</TableCell>
                    <TableCell>
                      {r.attended
                        ? <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full">Yes</span>
                        : <span className="text-xs text-muted-foreground">No</span>
                      }
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.watchedSeconds ? `${Math.floor(r.watchedSeconds / 60)}m ${r.watchedSeconds % 60}s` : "—"}
                    </TableCell>
                    <TableCell>
                      {r.convertedAt
                        ? <span className="text-xs bg-[color:color-mix(in_srgb,var(--org-primary)_12%,transparent)] text-[var(--org-primary)] px-2 py-0.5 rounded-full">Yes</span>
                        : <span className="text-xs text-muted-foreground">No</span>
                      }
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                          {r.registeredAt ? new Date(r.registeredAt).toLocaleDateString() : "—"}
                        </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
