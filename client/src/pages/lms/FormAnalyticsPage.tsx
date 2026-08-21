import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";
import {
  ChevronLeft,
  Users,
  CheckCircle2,
  Clock,
  TrendingDown,
  Download,
  BarChart2,
  AlertTriangle,
} from "lucide-react";

export default function FormAnalyticsPage() {
  const params = useParams<{ id: string }>();
  const formId = parseInt(params.id ?? "0");
  const [, setLocation] = useLocation();
  const [days, setDays] = useState(30);

  const { data: formData, isLoading: formLoading } = trpc.forms.get.useQuery(
    { id: formId },
    { enabled: !!formId }
  );

  const { data: summary, isLoading: summaryLoading } = trpc.forms.analytics.summary.useQuery(
    { formId },
    { enabled: !!formId }
  );

  const { data: fieldDropoff, isLoading: dropoffLoading } = trpc.forms.analytics.fieldDropoff.useQuery(
    { formId },
    { enabled: !!formId }
  );

  const { data: timeSeries, isLoading: timeLoading } = trpc.forms.analytics.timeSeries.useQuery(
    { formId, days },
    { enabled: !!formId }
  );

  const fields = formData?.fields ?? [];

  // Build drop-off funnel data
  const funnelData = fields
    .filter((f: any) => !["section_break", "statement"].includes(f.type))
    .map((f: any) => {
      const views = fieldDropoff?.viewCounts?.[f.id] ?? 0;
      const drops = fieldDropoff?.dropCounts?.[f.id] ?? 0;
      return {
        name: (f.label || `Field ${f.id}`).slice(0, 24),
        views,
        drops,
        answerRate: views > 0 ? Math.round(((views - drops) / views) * 100) : 0,
      };
    });

  const exportCSV = () => {
    if (!funnelData.length) return;
    const header = "Field,Views,Drop-offs,Answer Rate\n";
    const rows = funnelData.map((r) => `"${r.name}",${r.views},${r.drops},${r.answerRate}%`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `form-analytics-${formId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isLoading = formLoading || summaryLoading || dropoffLoading || timeLoading;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() => setLocation(`/lms/forms/${formId}`)}
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Builder
          </Button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-[var(--org-primary)]" />
              Form Analytics
            </h1>
            {formData && (
              <p className="text-sm text-muted-foreground">{formData.title}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(days)} onValueChange={(v) => setDays(parseInt(v))}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={exportCSV}>
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total Starts</p>
                  <p className="text-3xl font-bold mt-1">{summary?.total ?? 0}</p>
                </div>
                <div className="h-9 w-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Users className="h-4.5 w-4.5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Completions</p>
                  <p className="text-3xl font-bold mt-1">{summary?.completed ?? 0}</p>
                </div>
                <div className="h-9 w-9 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle2 className="h-4.5 w-4.5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Completion Rate</p>
                  <p className="text-3xl font-bold mt-1">{summary?.completionRate ?? 0}%</p>
                  <div className="mt-2 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--org-primary)] rounded-full transition-all"
                      style={{ width: `${summary?.completionRate ?? 0}%` }}
                    />
                  </div>
                </div>
                <div className="h-9 w-9 rounded-full bg-[color:color-mix(in_srgb,var(--org-primary)_12%,transparent)] flex items-center justify-center">
                  <TrendingDown className="h-4.5 w-4.5 text-[var(--org-primary)]" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Avg. Time</p>
                  <p className="text-3xl font-bold mt-1">
                    {summary?.avgDuration
                      ? summary.avgDuration < 60
                        ? `${summary.avgDuration}s`
                        : `${Math.round(summary.avgDuration / 60)}m`
                      : "—"}
                  </p>
                </div>
                <div className="h-9 w-9 rounded-full bg-[color:color-mix(in_srgb,var(--org-primary)_12%,transparent)] flex items-center justify-center">
                  <Clock className="h-4.5 w-4.5 text-[var(--org-primary)]" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Top drop-off field alert */}
      {summary?.topDropFieldId && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          <span className="text-amber-800 dark:text-amber-300">
            <strong>Highest drop-off:</strong>{" "}
            {fields.find((f: any) => f.id === summary.topDropFieldId)?.label || `Field #${summary.topDropFieldId}`}
            {" "}— consider simplifying or reordering this question.
          </span>
        </div>
      )}

      {/* Time Series Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Starts vs. Completions Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          {timeLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (timeSeries?.length ?? 0) === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={timeSeries} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => v.slice(5)}
                />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  labelFormatter={(v) => `Date: ${v}`}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="starts" stroke="#3b82f6" strokeWidth={2} dot={false} name="Starts" />
                <Line type="monotone" dataKey="completions" stroke="#10b981" strokeWidth={2} dot={false} name="Completions" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Drop-off Funnel */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Field Drop-off Funnel</CardTitle>
          <p className="text-xs text-muted-foreground">How many respondents viewed each field vs. dropped off at that point.</p>
        </CardHeader>
        <CardContent>
          {dropoffLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : funnelData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No field data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, funnelData.length * 44)}>
              <BarChart
                layout="vertical"
                data={funnelData}
                margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={140} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(value, name) => [value, name === "views" ? "Views" : "Drop-offs"]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="views" fill="#3b82f6" name="Views" radius={[0, 3, 3, 0]} />
                <Bar dataKey="drops" fill="#f87171" name="Drop-offs" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Per-field table */}
      {funnelData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Per-Field Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left p-3 font-medium">Field</th>
                    <th className="text-right p-3 font-medium">Views</th>
                    <th className="text-right p-3 font-medium">Drop-offs</th>
                    <th className="text-right p-3 font-medium">Answer Rate</th>
                    <th className="text-right p-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {funnelData.map((row, i) => (
                    <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="p-3 font-medium max-w-[200px] truncate">{row.name}</td>
                      <td className="p-3 text-right">{row.views}</td>
                      <td className="p-3 text-right text-red-500">{row.drops}</td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${row.answerRate}%`,
                                backgroundColor: row.answerRate >= 80 ? "#10b981" : row.answerRate >= 50 ? "#f59e0b" : "#ef4444",
                              }}
                            />
                          </div>
                          <span>{row.answerRate}%</span>
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        {row.answerRate >= 80 ? (
                          <Badge variant="outline" className="text-green-600 border-green-300 text-xs">Good</Badge>
                        ) : row.answerRate >= 50 ? (
                          <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">Fair</Badge>
                        ) : (
                          <Badge variant="outline" className="text-red-600 border-red-300 text-xs">High Drop-off</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
