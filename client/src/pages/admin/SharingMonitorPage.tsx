/**
 * SharingMonitorPage — IP sharing abuse monitor
 *
 * Platform admins: see all flagged users across all orgs, full IP timeline per user
 * Org admins: see flagged users within their own org only
 *
 * Multi-tier scoping:
 *  - site_admin / site_owner → platform-wide view
 *  - org_admin / org_super_admin → org-scoped view (their members only)
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Wifi,
  WifiOff,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Search,
  RefreshCw,
  Eye,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Monitor,
  User,
  Building2,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
import { useLocation } from "wouter";

// ─── Types ────────────────────────────────────────────────────────────────────

type FlagStatus = "flagged" | "confirmed" | "dismissed" | "warned";

interface FlaggedUser {
  id: number;
  userId: number;
  userName: string | null;
  userEmail: string | null;
  orgId: number | null;
  orgName: string | null;
  status: FlagStatus;
  distinctIpCount: number;
  ipAddresses: string | null;
  detectionReason: string | null;
  alertSentAt: Date | null;
  reviewedAt: Date | null;
  notes: string | null;
  createdAt: Date;
}

interface IpTimelineEntry {
  ipAddress: string;
  contentType: string;
  contentId: number | null;
  contentTitle: string | null;
  accessedAt: Date;
  userAgent: string | null;
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<FlagStatus, { label: string; color: string; icon: React.ElementType }> = {
  flagged: { label: "Flagged", color: "border-orange-400/50 bg-orange-500/10 text-orange-400", icon: ShieldAlert },
  confirmed: { label: "Confirmed Abuse", color: "border-red-400/50 bg-red-500/10 text-red-400", icon: ShieldX },
  warned: { label: "Warned", color: "border-yellow-400/50 bg-yellow-500/10 text-yellow-400", icon: AlertTriangle },
  dismissed: { label: "Dismissed", color: "border-green-400/50 bg-green-500/10 text-green-400", icon: ShieldCheck },
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SharingMonitorPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const isPlatformAdmin = user?.role === "site_admin" || user?.role === "site_owner";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FlagStatus | "all">("all");
  const [selectedFlag, setSelectedFlag] = useState<FlaggedUser | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // Fetch flagged users (backend scopes by role automatically)
  const { data, isLoading, refetch } = trpc.ipSharing.getFlags.useQuery({
    status: statusFilter as "flagged" | "confirmed" | "dismissed" | "warned" | "all",
  });

  // Fetch IP timeline for selected user
  const { data: timeline, isLoading: timelineLoading } = trpc.ipSharing.getIpTimeline.useQuery(
    { userId: selectedFlag?.userId ?? 0 },
    { enabled: !!selectedFlag }
  );

  // Review mutation
  const reviewMutation = trpc.ipSharing.updateFlag.useMutation({
    onSuccess: () => {
      toast.success("Flag updated");
      setSelectedFlag(null);
      setReviewNotes("");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const flaggedUsers = data?.flags ?? [];
  // Compute stats from the returned flags list (getFlags returns { flags, total })
  const stats = {
    total: data?.total ?? 0,
    confirmed: flaggedUsers.filter((f) => f.status === "confirmed").length,
    warned: flaggedUsers.filter((f) => f.status === "warned").length,
    dismissed: flaggedUsers.filter((f) => f.status === "dismissed").length,
  };

  const toggleRow = (id: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-orange-400" />
            IP Sharing Monitor
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isPlatformAdmin
              ? "Platform-wide detection of account sharing and credential abuse"
              : "Monitor IP sharing activity within your organization"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2 shrink-0">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Flagged", value: stats.total, icon: ShieldAlert, color: "text-orange-400" },
            { label: "Confirmed Abuse", value: stats.confirmed, icon: ShieldX, color: "text-red-400" },
            { label: "Warned", value: stats.warned, icon: AlertTriangle, color: "text-yellow-400" },
            { label: "Dismissed", value: stats.dismissed, icon: ShieldCheck, color: "text-green-400" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-lg border border-border/50 bg-card px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Icon className={`h-3.5 w-3.5 ${color}`} />
                {label}
              </div>
              <p className="text-2xl font-bold">{value ?? 0}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or IP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as FlagStatus | "all")}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="flagged">Flagged</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="warned">Warned</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : flaggedUsers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/50 px-6 py-12 text-center">
          <ShieldCheck className="h-10 w-10 mx-auto mb-3 text-green-400/60" />
          <p className="text-base font-medium">No flagged users</p>
          <p className="text-sm text-muted-foreground mt-1">
            {statusFilter !== "all" ? "Try changing the status filter." : "No sharing abuse detected yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {flaggedUsers.map((flag) => {
            const cfg = STATUS_CONFIG[flag.status as FlagStatus] ?? STATUS_CONFIG.flagged;
            const StatusIcon = cfg.icon;
            const isExpanded = expandedRows.has(flag.id);
            const ips: string[] = flag.ipAddresses ? (() => { try { return JSON.parse(flag.ipAddresses); } catch { return [flag.ipAddresses]; } })() : [];

            return (
              <div key={flag.id} className="rounded-lg border border-border/50 bg-card overflow-hidden">
                {/* Row header */}
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* User info */}
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-primary text-xs font-semibold">
                      {(flag.userName ?? flag.userEmail ?? "?")[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium truncate">{flag.userName ?? flag.userEmail ?? `User #${flag.userId}`}</p>
                      <Badge className={`text-[10px] border px-1.5 py-0 ${cfg.color}`}>
                        <StatusIcon className="h-2.5 w-2.5 mr-1" />
                        {cfg.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {flag.userEmail && (
                        <span className="text-xs text-muted-foreground">{flag.userEmail}</span>
                      )}
                      {isPlatformAdmin && flag.orgName && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Building2 className="h-3 w-3" /> {flag.orgName}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Wifi className="h-3 w-3" />
                        {flag.distinctIpCount} distinct IP{flag.distinctIpCount !== 1 ? "s" : ""}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(flag.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 text-xs"
                      onClick={() => { setSelectedFlag(flag as FlaggedUser); setReviewNotes(flag.notes ?? ""); }}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Review
                    </Button>
                    <button
                      onClick={() => toggleRow(flag.id)}
                      className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted/50 text-muted-foreground"
                    >
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Expanded IP list */}
                {isExpanded && (
                  <div className="border-t border-border/40 px-4 py-3 bg-muted/20 space-y-2">
                    {flag.detectionReason && (
                      <div className="flex items-start gap-2 text-xs">
                        <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">{flag.detectionReason}</span>
                      </div>
                    )}
                    {ips.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Detected IPs:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {ips.map((ip) => (
                            <code key={ip} className="text-[11px] font-mono bg-muted px-2 py-0.5 rounded border border-border/50">
                              {ip}
                            </code>
                          ))}
                        </div>
                      </div>
                    )}
                    {flag.notes && (
                      <div className="flex items-start gap-2 text-xs">
                        <Shield className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                        <span className="text-muted-foreground italic">{flag.notes}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Review Dialog */}
      {selectedFlag && (
        <Dialog open onOpenChange={() => setSelectedFlag(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-orange-400" />
                Review: {selectedFlag.userName ?? selectedFlag.userEmail ?? `User #${selectedFlag.userId}`}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-5">
              {/* User summary */}
              <div className="rounded-lg bg-muted/30 px-4 py-3 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{selectedFlag.userName ?? "—"}</span>
                  <span className="text-muted-foreground">{selectedFlag.userEmail}</span>
                </div>
                {isPlatformAdmin && selectedFlag.orgName && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="h-4 w-4" />
                    {selectedFlag.orgName}
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                  <span className="text-orange-400 font-medium">{selectedFlag.distinctIpCount} distinct IPs</span>
                  {selectedFlag.detectionReason && (
                    <span className="text-muted-foreground text-xs">— {selectedFlag.detectionReason}</span>
                  )}
                </div>
              </div>

              {/* IP Timeline */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Access Timeline
                </h3>
                {timelineLoading ? (
                  <div className="space-y-1.5">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="h-10 rounded bg-muted/30 animate-pulse" />
                    ))}
                  </div>
                ) : (timeline?.logs ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No access logs found.</p>
                ) : (
                  <div className="space-y-1 max-h-[280px] overflow-y-auto rounded-lg border border-border/50 divide-y divide-border/30">
                    {(timeline?.logs ?? []).map((entry: IpTimelineEntry, i: number) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-2 text-xs hover:bg-muted/20">
                        <code className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded shrink-0 w-[130px] truncate">
                          {entry.ipAddress}
                        </code>
                        <span className="text-muted-foreground shrink-0 capitalize">{entry.contentType}</span>
                        {entry.contentTitle && (
                          <span className="truncate text-muted-foreground flex-1">{entry.contentTitle}</span>
                        )}
                        <span className="text-muted-foreground shrink-0">
                          {new Date(entry.accessedAt).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Review notes */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Review Notes</label>
                <textarea
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  rows={3}
                  placeholder="Add notes about this case..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                />
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-green-400/40 text-green-400 hover:bg-green-500/10"
                  disabled={reviewMutation.isPending}
                  onClick={() => reviewMutation.mutate({ flagId: selectedFlag.id, status: "dismissed" as const, notes: reviewNotes })}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Dismiss (False Positive)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-yellow-400/40 text-yellow-400 hover:bg-yellow-500/10"
                  disabled={reviewMutation.isPending}
                  onClick={() => reviewMutation.mutate({ flagId: selectedFlag.id, status: "warned" as const, notes: reviewNotes })}
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Send Warning
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-red-400/40 text-red-400 hover:bg-red-500/10"
                  disabled={reviewMutation.isPending}
                  onClick={() => reviewMutation.mutate({ flagId: selectedFlag.id, status: "confirmed" as const, notes: reviewNotes })}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Confirm Abuse
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  onClick={() => setSelectedFlag(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
