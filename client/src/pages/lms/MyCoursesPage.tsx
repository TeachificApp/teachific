import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import { useState, useMemo } from "react";
import {
  BookOpen, CheckCircle, Clock, Play, Search, GraduationCap,
  ArrowRight, Trophy, RotateCcw, Receipt, Printer, CheckCircle2,
  XCircle, ShoppingBag,
} from "lucide-react";

// ─── Receipt Modal ─────────────────────────────────────────────────────────────

type InvoiceRow = {
  id: number;
  invoiceNumber: string | null;
  productType: string;
  productTitle: string;
  buyerName: string | null;
  buyerEmail: string | null;
  amountPaid: number;
  currency: string;
  status: string;
  isManual: boolean | null;
  createdAt: number;
  orgName: string | null;
  orgLogoUrl: string | null;
  notes: string | null;
};

function ReceiptModal({ invoice, onClose }: { invoice: InvoiceRow; onClose: () => void }) {
  const fmt = (n: number, cur: string) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: cur.toUpperCase() }).format(n);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white text-slate-900 rounded-xl shadow-2xl w-full max-w-md p-8 space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            {invoice.orgLogoUrl && (
              <img src={invoice.orgLogoUrl} alt="" className="h-8 mb-2 object-contain" />
            )}
            <h2 className="text-xl font-bold text-slate-900">Receipt</h2>
            {invoice.invoiceNumber && (
              <p className="text-xs text-slate-500 mt-0.5">#{invoice.invoiceNumber}</p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        {/* Details */}
        <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
          <div className="px-4 py-3 flex justify-between text-sm">
            <span className="text-slate-500">Product</span>
            <span className="font-medium text-right max-w-[60%]">{invoice.productTitle}</span>
          </div>
          <div className="px-4 py-3 flex justify-between text-sm">
            <span className="text-slate-500">Type</span>
            <span className="capitalize">{invoice.productType}</span>
          </div>
          {invoice.buyerName && (
            <div className="px-4 py-3 flex justify-between text-sm">
              <span className="text-slate-500">Buyer</span>
              <span>{invoice.buyerName}</span>
            </div>
          )}
          {invoice.buyerEmail && (
            <div className="px-4 py-3 flex justify-between text-sm">
              <span className="text-slate-500">Email</span>
              <span className="text-right break-all">{invoice.buyerEmail}</span>
            </div>
          )}
          <div className="px-4 py-3 flex justify-between text-sm">
            <span className="text-slate-500">Date</span>
            <span>
              {new Date(invoice.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>
          <div className="px-4 py-3 flex justify-between text-sm font-semibold">
            <span>Amount Paid</span>
            <span className="text-green-700">{fmt(invoice.amountPaid, invoice.currency)}</span>
          </div>
          {invoice.notes && (
            <div className="px-4 py-3 text-sm">
              <span className="text-slate-500 block mb-1">Notes</span>
              <span className="text-slate-700">{invoice.notes}</span>
            </div>
          )}
        </div>
        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => window.print()}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            <Printer className="h-4 w-4" /> Print
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Purchases Tab ─────────────────────────────────────────────────────────────

const STATUS_ICONS: Record<string, React.ReactNode> = {
  paid: <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />,
  pending: <Clock className="h-3.5 w-3.5 text-amber-500" />,
  refunded: <XCircle className="h-3.5 w-3.5 text-slate-400" />,
};

function PurchasesTab() {
  const [receiptInvoice, setReceiptInvoice] = useState<InvoiceRow | null>(null);
  const { data, isLoading } = trpc.invoices.list.useQuery({ pageSize: 100 });

  const fmt = (n: number, cur: string) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: cur.toUpperCase() }).format(n);

  if (isLoading) {
    return (
      <div className="space-y-3 pt-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  const invoices = data?.invoices ?? [];

  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <ShoppingBag className="h-12 w-12 text-muted-foreground/40 mb-3" />
        <p className="text-base font-medium text-muted-foreground">No purchases yet</p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Your purchase history will appear here after you buy a course or download.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {invoices.map((inv) => (
        <div
          key={inv.id}
          className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 hover:bg-muted/20 transition-colors"
        >
          <div className="shrink-0 mt-0.5">{STATUS_ICONS[inv.status] ?? STATUS_ICONS.pending}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{inv.productTitle}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(Number(inv.createdAt)).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}{" "}
              · <span className="capitalize">{inv.productType}</span>
            </p>
          </div>
          <div className="text-right shrink-0 flex flex-col items-end gap-1">
            <p className="text-sm font-semibold">{fmt(Number(inv.amountPaid), inv.currency)}</p>
            <button
              onClick={() =>
                setReceiptInvoice({
                  ...inv,
                  amountPaid: Number(inv.amountPaid),
                  createdAt: Number(inv.createdAt),
                  orgLogoUrl: null,
                })
              }
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <Receipt className="h-3 w-3" /> Receipt
            </button>
          </div>
        </div>
      ))}
      {receiptInvoice && (
        <ReceiptModal invoice={receiptInvoice} onClose={() => setReceiptInvoice(null)} />
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function MyCoursesPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "in_progress" | "completed" | "not_started">("all");
  const [activeTab, setActiveTab] = useState<"courses" | "purchases">("courses");

  const { data: enrollments, isLoading } = trpc.lms.dashboard.enrolledCourses.useQuery(undefined, {
    enabled: !!user,
  });

  const filtered = useMemo(() => {
    if (!enrollments) return [];
    return enrollments.filter((e) => {
      const matchSearch = !search || e.title.toLowerCase().includes(search.toLowerCase());
      const isCompleted = !!e.completedAt;
      const isStarted = !!e.lastAccessedAt;
      const matchFilter =
        filter === "all" ||
        (filter === "completed" && isCompleted) ||
        (filter === "in_progress" && !isCompleted && isStarted) ||
        (filter === "not_started" && !isStarted);
      return matchSearch && matchFilter;
    });
  }, [enrollments, search, filter]);

  const stats = useMemo(() => {
    if (!enrollments) return { total: 0, completed: 0, inProgress: 0 };
    return {
      total: enrollments.length,
      completed: enrollments.filter((e) => !!e.completedAt).length,
      inProgress: enrollments.filter((e) => !e.completedAt && !!e.lastAccessedAt).length,
    };
  }, [enrollments]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-7xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-primary" />
          My Dashboard
        </h1>
        <p className="text-muted-foreground mt-0.5 text-sm">
          Manage your courses, subscriptions, and purchase history.
        </p>
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-border/60 gap-0">
        {[
          { key: "courses", label: "My Courses", icon: BookOpen },
          { key: "purchases", label: "Purchases", icon: ShoppingBag },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as "courses" | "purchases")}
            className={`relative flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors
              ${activeTab === key
                ? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary"
                : "text-muted-foreground hover:text-foreground"
              }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "courses" && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Enrolled", value: stats.total, icon: BookOpen, color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400" },
              { label: "In Progress", value: stats.inProgress, icon: Play, color: "text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400" },
              { label: "Completed", value: stats.completed, icon: Trophy, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400" },
            ].map((s) => (
              <Card key={s.label} className="shadow-sm border-border/60">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${s.color}`}>
                    <s.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Search + Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search your courses..."
                className="pl-9"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {(["all", "in_progress", "completed", "not_started"] as const).map((f) => (
                <Button
                  key={f}
                  variant={filter === f ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter(f)}
                  className="capitalize"
                >
                  {f === "all" ? "All" : f === "in_progress" ? "In Progress" : f === "completed" ? "Completed" : "Not Started"}
                </Button>
              ))}
            </div>
          </div>

          {/* Course Grid */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-base font-medium text-muted-foreground">
                {enrollments?.length === 0 ? "No courses enrolled yet" : "No courses match your filter"}
              </p>
              {enrollments?.length === 0 && (
                <p className="text-sm text-muted-foreground/70 mt-1">Browse available courses to get started</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((enrollment) => {
                const pct = enrollment.progressPct ?? 0;
                const isCompleted = !!enrollment.completedAt;
                const isStarted = !!enrollment.lastAccessedAt;
                const continueUrl = enrollment.lastLessonId
                  ? `/learn/${enrollment.courseId}/lesson/${enrollment.lastLessonId}`
                  : `/learn/${enrollment.courseId}`;
                return (
                  <Card
                    key={enrollment.enrollmentId}
                    className="shadow-sm border-border/60 overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
                    onClick={() => setLocation(continueUrl)}
                  >
                    {/* Thumbnail */}
                    <div className="relative h-36 bg-gradient-to-br from-primary/20 to-primary/5 overflow-hidden">
                      {enrollment.thumbnailUrl ? (
                        <img
                          src={enrollment.thumbnailUrl}
                          alt={enrollment.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <BookOpen className="h-10 w-10 text-primary/40" />
                        </div>
                      )}
                      {isCompleted && (
                        <div className="absolute top-2 right-2 bg-emerald-500 text-white rounded-full p-1">
                          <CheckCircle className="h-4 w-4" />
                        </div>
                      )}
                      {/* Play overlay */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <div className="h-10 w-10 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                          {isCompleted ? (
                            <RotateCcw className="h-4 w-4 text-gray-700" />
                          ) : (
                            <Play className="h-4 w-4 text-gray-700 ml-0.5" />
                          )}
                        </div>
                      </div>
                    </div>

                    <CardContent className="p-4 space-y-3">
                      <div>
                        <h3 className="font-semibold text-sm line-clamp-2 leading-snug">{enrollment.title}</h3>
                        <div className="flex items-center gap-2 mt-1.5">
                          {isCompleted ? (
                            <Badge variant="default" className="text-xs bg-emerald-500 hover:bg-emerald-600 gap-1">
                              <CheckCircle className="h-3 w-3" /> Completed
                            </Badge>
                          ) : isStarted ? (
                            <Badge variant="secondary" className="text-xs gap-1">
                              <Play className="h-3 w-3" /> In Progress
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">Not Started</Badge>
                          )}
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{Math.round(pct)}% complete</span>
                          {enrollment.lastAccessedAt && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(enrollment.lastAccessedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <Progress value={pct} className="h-1.5" />
                      </div>

                      <Button
                        size="sm"
                        variant={isCompleted ? "outline" : "default"}
                        className="w-full gap-1.5"
                        onClick={(e) => { e.stopPropagation(); setLocation(continueUrl); }}
                      >
                        {isCompleted ? (
                          <><RotateCcw className="h-3.5 w-3.5" /> Review Course</>
                        ) : isStarted ? (
                          <><ArrowRight className="h-3.5 w-3.5" /> Continue</>
                        ) : (
                          <><Play className="h-3.5 w-3.5" /> Start Course</>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeTab === "purchases" && <PurchasesTab />}
    </div>
  );
}
