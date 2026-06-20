import { useState, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  ChevronLeft,
  Trash2,
  Eye,
  Download,
  BarChart2,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  BookOpen,
  Star,
  MoreVertical,
} from "lucide-react";

type SubmissionStatus = "pending" | "reviewed" | "approved" | "rejected";

const STATUS_CONFIG: Record<SubmissionStatus, { label: string; color: string; icon: any }> = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400", icon: Clock },
  reviewed: { label: "Reviewed", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", icon: BookOpen },
  approved: { label: "Approved", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", icon: XCircle },
};

function StatusBadge({ status }: { status: SubmissionStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function ScoreBadge({ total, max }: { total: number; max: number }) {
  const pct = max > 0 ? Math.round((total / max) * 100) : 0;
  const color = pct >= 80 ? "text-green-600" : pct >= 60 ? "text-yellow-600" : "text-red-600";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${color}`}>
      <Star className="h-3 w-3" />
      {total}/{max}
      <span className="text-muted-foreground font-normal">({pct}%)</span>
    </span>
  );
}

export default function FormResponsesPage() {
  const params = useParams<{ id: string }>();
  const formId = parseInt(params.id ?? "0");
  const [, setLocation] = useLocation();

  const [viewSubmission, setViewSubmission] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | SubmissionStatus>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: formData, isLoading: formLoading } = trpc.forms.get.useQuery(
    { id: formId },
    { enabled: !!formId }
  );

  const { data: submissions, isLoading: subsLoading, refetch } = trpc.forms.submissions.list.useQuery(
    { formId },
    { enabled: !!formId }
  );

  const deleteMutation = trpc.forms.submissions.delete.useMutation({
    onSuccess: () => { toast.success("Response deleted"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const updateStatusMutation = trpc.forms.updateSubmissionStatus.useMutation({
    onSuccess: () => { refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const fields = formData?.fields ?? [];
  const hasScoring = fields.some((f: any) => f.scoreWeight > 0);

  // Filtered submissions
  const filtered = useMemo(() => {
    if (!submissions) return [];
    return submissions.filter((sub: any) => {
      if (statusFilter !== "all" && sub.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchEmail = sub.respondentEmail?.toLowerCase().includes(q);
        const matchName = sub.respondentName?.toLowerCase().includes(q);
        if (!matchEmail && !matchName) return false;
      }
      if (dateFrom) {
        const from = new Date(dateFrom);
        if (new Date(sub.submittedAt) < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (new Date(sub.submittedAt) > to) return false;
      }
      return true;
    });
  }, [submissions, statusFilter, search, dateFrom, dateTo]);

  // Aggregate stats
  const stats = useMemo(() => {
    if (!submissions) return null;
    const total = submissions.length;
    const reviewed = submissions.filter((s: any) => s.status !== "pending").length;
    const approved = submissions.filter((s: any) => s.status === "approved").length;
    const withScore = submissions.filter((s: any) => s.scoreMax > 0);
    const avgScore = withScore.length > 0
      ? Math.round(withScore.reduce((acc: number, s: any) => acc + Math.round((s.scoreTotal / s.scoreMax) * 100), 0) / withScore.length)
      : null;
    return { total, reviewed, approved, avgScore };
  }, [submissions]);

  const getFieldLabel = (fieldId: string) => {
    return fields.find((f: any) => String(f.id) === fieldId)?.label ?? `Field #${fieldId}`;
  };

  const exportCsv = () => {
    if (!submissions || submissions.length === 0) return;
    const headers = ["Submitted At", "Respondent Email", "Respondent Name", "Status",
      ...(hasScoring ? ["Score", "Max Score"] : []),
      ...fields.map((f: any) => f.label)];
    const rows = submissions.map((s: any) => {
      const answers = JSON.parse(s.answers ?? "{}");
      return [
        new Date(s.submittedAt).toLocaleString(),
        s.respondentEmail ?? "",
        s.respondentName ?? "",
        s.status ?? "pending",
        ...(hasScoring ? [s.scoreTotal ?? "", s.scoreMax ?? ""] : []),
        ...fields.map((f: any) => {
          const val = answers[f.id];
          return Array.isArray(val) ? val.join("; ") : String(val ?? "");
        }),
      ];
    });
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${formData?.title ?? "form"}-responses.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isLoading = formLoading || subsLoading;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation(`/lms/forms/${formId}`)}
            className="gap-1.5 text-muted-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Builder
          </Button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-primary" />
              Responses
            </h1>
            {formData && (
              <p className="text-sm text-muted-foreground">{formData.title}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm">
            {submissions?.length ?? 0} response{(submissions?.length ?? 0) !== 1 ? "s" : ""}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={exportCsv}
            disabled={!submissions || submissions.length === 0}
            className="gap-1.5"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Aggregate stats bar */}
      {stats && stats.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total Responses", value: stats.total, color: "text-foreground" },
            { label: "Reviewed", value: `${stats.reviewed} / ${stats.total}`, color: "text-blue-600" },
            { label: "Approved", value: stats.approved, color: "text-green-600" },
            ...(stats.avgScore !== null ? [{ label: "Avg Score", value: `${stats.avgScore}%`, color: "text-orange-600" }] : []),
          ].map((s, i) => (
            <Card key={i} className="border-border/50">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={`text-xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      {!isLoading && (submissions?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search respondent..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="h-8 w-36 text-sm">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-8 w-36 text-sm"
            title="From date"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-8 w-36 text-sm"
            title="To date"
          />
        </div>
      )}

      {isLoading ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </CardContent>
        </Card>
      ) : !submissions || submissions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <BarChart2 className="h-12 w-12 text-muted-foreground/40" />
          <p className="font-medium">No responses yet</p>
          <p className="text-sm text-muted-foreground">
            Responses will appear here once people submit the form.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <Search className="h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium">No responses match your filters</p>
          <Button variant="outline" size="sm" onClick={() => { setSearch(""); setStatusFilter("all"); setDateFrom(""); setDateTo(""); }}>
            Clear filters
          </Button>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-36">Submitted</TableHead>
                  <TableHead>Respondent</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                  {hasScoring && <TableHead className="w-28">Score</TableHead>}
                  {fields.slice(0, 2).map((f: any) => (
                    <TableHead key={f.id} className="max-w-[160px]">
                      <span className="truncate block">{f.label}</span>
                    </TableHead>
                  ))}
                  <TableHead className="w-20 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((sub: any) => {
                  const answers = JSON.parse(sub.answers ?? "{}");
                  const subStatus: SubmissionStatus = sub.status ?? "pending";
                  return (
                    <TableRow key={sub.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(sub.submittedAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs">
                        {sub.respondentEmail ?? sub.respondentName ?? (
                          <span className="text-muted-foreground italic">Anonymous</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={subStatus} />
                      </TableCell>
                      {hasScoring && (
                        <TableCell>
                          {sub.scoreMax > 0 ? (
                            <ScoreBadge total={sub.scoreTotal ?? 0} max={sub.scoreMax} />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      )}
                      {fields.slice(0, 2).map((f: any) => {
                        const val = answers[f.id];
                        const display = Array.isArray(val) ? val.join(", ") : String(val ?? "");
                        return (
                          <TableCell key={f.id} className="text-xs max-w-[160px]">
                            <span className="truncate block">{display || <span className="text-muted-foreground">—</span>}</span>
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setViewSubmission(sub)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreVertical className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {(["pending", "reviewed", "approved", "rejected"] as SubmissionStatus[]).map((s) => (
                                <DropdownMenuItem
                                  key={s}
                                  disabled={subStatus === s || updateStatusMutation.isPending}
                                  onClick={() => updateStatusMutation.mutate({ submissionId: sub.id, status: s })}
                                >
                                  <span className={`w-2 h-2 rounded-full mr-2 inline-block ${
                                    s === "approved" ? "bg-green-500" :
                                    s === "rejected" ? "bg-red-500" :
                                    s === "reviewed" ? "bg-blue-500" : "bg-yellow-500"
                                  }`} />
                                  Mark as {STATUS_CONFIG[s].label}
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => {
                                  if (confirm("Delete this response?")) {
                                    deleteMutation.mutate({ id: sub.id });
                                  }
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* View submission dialog */}
      <Dialog open={!!viewSubmission} onOpenChange={() => setViewSubmission(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Response Details</DialogTitle>
          </DialogHeader>
          {viewSubmission && (() => {
            const subStatus: SubmissionStatus = viewSubmission.status ?? "pending";
            const answers = JSON.parse(viewSubmission.answers ?? "{}");
            return (
              <div className="space-y-4">
                {/* Meta row */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pb-2 border-b border-border">
                  <span>Submitted {new Date(viewSubmission.submittedAt).toLocaleString()}</span>
                  {viewSubmission.respondentEmail && <span>· {viewSubmission.respondentEmail}</span>}
                  <StatusBadge status={subStatus} />
                  {viewSubmission.scoreMax > 0 && (
                    <ScoreBadge total={viewSubmission.scoreTotal ?? 0} max={viewSubmission.scoreMax} />
                  )}
                </div>

                {/* Status changer */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground w-16 shrink-0">Status</span>
                  <Select
                    value={subStatus}
                    onValueChange={(v) => {
                      updateStatusMutation.mutate({ submissionId: viewSubmission.id, status: v as SubmissionStatus });
                      setViewSubmission({ ...viewSubmission, status: v });
                    }}
                  >
                    <SelectTrigger className="h-7 text-xs w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["pending", "reviewed", "approved", "rejected"] as SubmissionStatus[]).map((s) => (
                        <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Score breakdown */}
                {viewSubmission.scoreMax > 0 && (
                  <div className="bg-muted/40 rounded-lg p-3 space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Score Breakdown</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${Math.round((viewSubmission.scoreTotal / viewSubmission.scoreMax) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold">
                        {viewSubmission.scoreTotal}/{viewSubmission.scoreMax} ({Math.round((viewSubmission.scoreTotal / viewSubmission.scoreMax) * 100)}%)
                      </span>
                    </div>
                  </div>
                )}

                {/* Answers */}
                {fields.map((f: any) => {
                  const val = answers[f.id];
                  const display = Array.isArray(val) ? val.join(", ") : String(val ?? "");
                  return (
                    <div key={f.id} className="space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground">{f.label}</p>
                      <p className="text-sm">{display || <span className="text-muted-foreground italic">No answer</span>}</p>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
