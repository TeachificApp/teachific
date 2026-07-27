/**
 * UserDetailPanel — comprehensive tabbed user editor
 * Used by AdminUsersPage (platform admin) and OrgSettings Members tab (org admin)
 *
 * Tabs:
 *  1. Profile  — name, email, platform role, org assignment
 *  2. Security — reset password
 *  3. Enrollments — view/add/revoke course enrollments
 *  4. Subscription — view/edit the org subscription plan for this user
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  User,
  Mail,
  Shield,
  Lock,
  BookOpen,
  CreditCard,
  Building2,
  Plus,
  X,
  Eye,
  EyeOff,
  Trash2,
  Save,
  RefreshCw,
  AlertTriangle,
  Receipt,
  Printer,
  CheckCircle2,
  Clock,
  XCircle,
  Monitor,
  Wifi,
  WifiOff,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserRow {
  id: number;
  name: string | null;
  email: string | null;
  role: string;
  orgId: number | null;
  orgName: string | null;
  loginMethod: string | null;
  createdAt: number | Date;
}

interface UserDetailPanelProps {
  user: UserRow | null;
  open: boolean;
  onClose: () => void;
  /** Whether the viewer is a platform admin (site_admin / site_owner) */
  isPlatformAdmin: boolean;
  /** Whether the viewer is the site owner */
  isOwner: boolean;
  onUserUpdated?: () => void;
}

// ─── Role helpers ─────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  site_owner: "Owner",
  site_admin: "Platform Admin",
  org_super_admin: "Org Super Admin",
  org_admin: "Org Admin",
  member: "Org Member",
  user: "User",
};

const ROLE_COLORS: Record<string, string> = {
  site_owner: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300",
  site_admin: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300",
  org_super_admin: "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300",
  org_admin: "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300",
  member: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300",
};

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  builder: "Builder",
  pro: "Pro",
  enterprise: "Enterprise",
};

const PLAN_COLORS: Record<string, string> = {
  free: "bg-slate-100 text-slate-600 border-slate-200",
  starter: "bg-green-100 text-green-700 border-green-200",
  growth: "bg-blue-100 text-blue-700 border-blue-200",
  professional: "bg-purple-100 text-purple-700 border-purple-200",
  enterprise: "bg-amber-100 text-amber-700 border-amber-200",
};

// ─── Main Component ───────────────────────────────────────────────────────────

export function UserDetailPanel({
  user,
  open,
  onClose,
  isPlatformAdmin,
  isOwner,
  onUserUpdated,
}: UserDetailPanelProps) {
  const { user: currentUser } = useAuth();
  const utils = trpc.useUtils();

  const refresh = () => {
    utils.users.invalidate();
    onUserUpdated?.();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-0">
        {user && (
          <>
            {/* Header */}
            <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/50">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary font-semibold text-sm">
                    {(user.name ?? user.email ?? "?")[0].toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <SheetTitle className="text-base font-semibold truncate">
                    {user.name ?? <span className="text-muted-foreground italic">No name</span>}
                  </SheetTitle>
                  <p className="text-sm text-muted-foreground truncate">{user.email ?? "—"}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <Badge className={`text-xs border ${ROLE_COLORS[user.role] ?? ROLE_COLORS.member}`}>
                      {ROLE_LABELS[user.role] ?? user.role}
                    </Badge>
                    {user.orgName && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Building2 className="h-3 w-3" /> {user.orgName}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </SheetHeader>

            {/* Tabs */}
            <Tabs defaultValue="profile" className="flex-1">
              <TabsList className="w-full rounded-none border-b border-border/50 bg-transparent h-auto p-0 justify-start gap-0">
                {[
                  { value: "profile", label: "Profile", icon: User },
                  { value: "security", label: "Security", icon: Lock },
                  { value: "enrollments", label: "Enrollments", icon: BookOpen },
                  { value: "transactions", label: "Transactions", icon: Receipt },
                  ...(isPlatformAdmin ? [{ value: "subscription", label: "Subscription", icon: CreditCard }] : []),
                ].map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    className="relative px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors data-[state=active]:text-foreground data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-primary flex items-center gap-1.5"
                    onClick={(e) => {
                      const tabs = e.currentTarget.closest('[data-radix-tabs-list]') as HTMLElement | null;
                      if (tabs) {
                        // trigger tab change via data attribute
                      }
                    }}
                    data-radix-collection-item=""
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </TabsList>

              {/* Profile Tab */}
              <TabsContent value="profile" className="p-6 space-y-5 mt-0">
                <ProfileTab user={user} isPlatformAdmin={isPlatformAdmin} isOwner={isOwner} onSaved={refresh} />
              </TabsContent>

              {/* Security Tab */}
              <TabsContent value="security" className="p-6 space-y-5 mt-0">
                <SecurityTab user={user} onSaved={refresh} />
              </TabsContent>

              {/* Enrollments Tab */}
              <TabsContent value="enrollments" className="p-6 space-y-5 mt-0">
                <EnrollmentsTab user={user} isPlatformAdmin={isPlatformAdmin} onSaved={refresh} />
              </TabsContent>

              {/* Transactions Tab */}
              <TabsContent value="transactions" className="p-0 mt-0">
                <TransactionsTab user={user} isPlatformAdmin={isPlatformAdmin} />
              </TabsContent>

              {/* Subscription Tab (platform admin only) */}
              {isPlatformAdmin && (
                <TabsContent value="subscription" className="p-6 space-y-5 mt-0">
                  <SubscriptionTab user={user} onSaved={refresh} />
                </TabsContent>
              )}
            </Tabs>

            {/* Danger Zone */}
            {isOwner && user.role !== "site_owner" && (
              <DangerZone user={user} onDeleted={() => { onClose(); refresh(); }} />
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── Profile Tab ──────────────────────────────────────────────────────────────

function ProfileTab({
  user,
  isPlatformAdmin,
  isOwner,
  onSaved,
}: {
  user: UserRow;
  isPlatformAdmin: boolean;
  isOwner: boolean;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: user.name ?? "",
    email: user.email ?? "",
    role: user.role,
  });
  const [assignOrgId, setAssignOrgId] = useState(user.orgId?.toString() ?? "");
  const [assignOrgRole, setAssignOrgRole] = useState<string>("member");

  const { data: orgs } = trpc.orgs.list.useQuery(undefined, { enabled: isPlatformAdmin });

  const updateUser = trpc.users.update.useMutation({
    onSuccess: () => { toast.success("Profile updated"); onSaved(); },
    onError: (e) => toast.error(e.message),
  });

  const assignToOrg = trpc.users.assignToOrg.useMutation({
    onSuccess: () => { toast.success("Organization assignment updated"); onSaved(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <User className="h-3.5 w-3.5" /> Basic Information
        </h3>

        <div className="space-y-1.5">
          <Label>Display Name</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Full name"
            autoCorrect="off"
            autoCapitalize="words"
            spellCheck={false}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5" /> Email Address
          </Label>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="email@example.com"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" /> Platform Role
          </Label>
          <Select
            value={form.role}
            onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}
            disabled={!isOwner && user.role === "site_owner"}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {isOwner && <SelectItem value="site_owner">Owner</SelectItem>}
              <SelectItem value="site_admin">Platform Admin</SelectItem>
              <SelectItem value="org_super_admin">Org Super Admin</SelectItem>
              <SelectItem value="org_admin">Org Admin</SelectItem>
              <SelectItem value="member">Org Member</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={() => updateUser.mutate({ userId: user.id, name: form.name || undefined, email: form.email || undefined, role: form.role as any })}
          disabled={updateUser.isPending}
          className="w-full gap-2"
        >
          <Save className="h-4 w-4" />
          {updateUser.isPending ? "Saving..." : "Save Profile"}
        </Button>
      </div>

      {/* Organization Assignment */}
      {isPlatformAdmin && (
        <div className="border-t border-border/40 pt-5 space-y-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5" /> Organization Assignment
          </h3>

          {user.orgName && (
            <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
              Currently in: <span className="font-medium">{user.orgName}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Organization</Label>
              <Select value={assignOrgId} onValueChange={setAssignOrgId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select org..." />
                </SelectTrigger>
                <SelectContent>
                  {orgs?.map((o) => (
                    <SelectItem key={o.id} value={o.id.toString()}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Org Role</Label>
              <Select value={assignOrgRole} onValueChange={setAssignOrgRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="org_super_admin">Super Admin</SelectItem>
                  <SelectItem value="org_admin">Admin</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full gap-2"
            disabled={!assignOrgId || assignToOrg.isPending}
            onClick={() => assignToOrg.mutate({ userId: user.id, orgId: Number(assignOrgId), orgRole: assignOrgRole as any })}
          >
            <Building2 className="h-4 w-4" />
            {assignToOrg.isPending ? "Assigning..." : "Assign to Organization"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Security Tab ─────────────────────────────────────────────────────────────

function SecurityTab({ user, onSaved }: { user: UserRow; onSaved: () => void }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const resetPassword = trpc.users.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("Password reset successfully");
      setNewPassword("");
      setConfirmPassword("");
      setConfirmOpen(false);
      onSaved();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleReset = () => {
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setConfirmOpen(true);
  };

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Lock className="h-3.5 w-3.5" /> Reset Password
        </h3>

        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>Setting a new password here will immediately replace the user's current password. The user will need to use this new password on their next login.</span>
        </div>

        <div className="space-y-1.5">
          <Label>New Password</Label>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min. 6 characters"
              className="pr-10"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Confirm New Password</Label>
          <Input
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter new password"
          />
        </div>

        {newPassword && confirmPassword && newPassword !== confirmPassword && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <X className="h-3 w-3" /> Passwords do not match
          </p>
        )}

        <Button
          onClick={handleReset}
          disabled={!newPassword || !confirmPassword || resetPassword.isPending}
          className="w-full gap-2"
          variant="outline"
        >
          <RefreshCw className="h-4 w-4" />
          {resetPassword.isPending ? "Resetting..." : "Reset Password"}
        </Button>
      </div>

      {/* Login method info */}
      {user.loginMethod && user.loginMethod !== "email" && (
        <div className="border-t border-border/40 pt-4">
          <p className="text-sm text-muted-foreground">
            This user signed in via <span className="font-medium capitalize">{user.loginMethod}</span>. 
            Setting a password here will allow them to also log in with email/password.
          </p>
        </div>
      )}

      {/* Confirm dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Password</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reset the password for <strong>{user.name ?? user.email}</strong>?
              They will need to use the new password on their next login.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => resetPassword.mutate({ userId: user.id, newPassword })}
            >
              {resetPassword.isPending ? "Resetting..." : "Reset Password"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Enrollments Tab ──────────────────────────────────────────────────────────

function EnrollmentsTab({
  user,
  isPlatformAdmin,
  onSaved,
}: {
  user: UserRow;
  isPlatformAdmin: boolean;
  onSaved: () => void;
}) {
  const [enrollOrgId, setEnrollOrgId] = useState<number | null>(null);
  const [enrollCourseId, setEnrollCourseId] = useState<number | null>(null);
  const [expandedEnrollId, setExpandedEnrollId] = useState<number | null>(null);

  const { data: enrollments, refetch: refetchEnrollments } = trpc.users.getEnrollments.useQuery({ userId: user.id });
  const { data: ipSummary } = trpc.ipSharing.getEnrollmentIpSummary.useQuery(
    { userId: user.id },
    { enabled: isPlatformAdmin }
  );
  const { data: orgs } = trpc.orgs.list.useQuery(undefined, { enabled: isPlatformAdmin });
  const { data: courses } = trpc.lms.courses.list.useQuery(
    { orgId: enrollOrgId ?? 0 },
    { enabled: !!enrollOrgId }
  );

  const enrollMutation = trpc.users.enrollInCourse.useMutation({
    onSuccess: () => {
      toast.success("Enrolled successfully");
      setEnrollCourseId(null);
      refetchEnrollments();
      onSaved();
    },
    onError: (e) => toast.error(e.message),
  });

  const revokeMutation = trpc.users.revokeEnrollment.useMutation({
    onSuccess: () => { toast.success("Enrollment revoked"); refetchEnrollments(); onSaved(); },
    onError: (e) => toast.error(e.message),
  });

  const activeEnrollments = enrollments?.filter((e) => e.isActive) ?? [];

  // Map courseId → IP summary row
  const ipByCourse = new Map<number, { distinctIpCount: number; lastAccessIp: string | null; accessCount: number; isSuspicious: boolean }>();
  for (const row of ipSummary?.enrollments ?? []) {
    ipByCourse.set(row.courseId, row);
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <BookOpen className="h-3.5 w-3.5" /> Active Enrollments ({activeEnrollments.length})
        </h3>

        {activeEnrollments.length > 0 ? (
          <div className="space-y-2">
            {activeEnrollments.map((e) => {
              const ip = ipByCourse.get(e.courseId);
              const isExpanded = expandedEnrollId === e.id;
              return (
                <div key={e.id} className="rounded-lg border border-border/50 bg-muted/20 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2.5 gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{(e as any).courseTitle ?? `Course #${e.courseId}`}</p>
                      <p className="text-xs text-muted-foreground">
                        {e.progressPct ?? 0}% complete · enrolled {new Date(e.enrolledAt).toLocaleDateString()}
                      </p>
                      {(e as any).orgName && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Building2 className="h-3 w-3" /> {(e as any).orgName}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isPlatformAdmin && ip && (
                        <button
                          onClick={() => setExpandedEnrollId(isExpanded ? null : e.id)}
                          className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-colors ${
                            ip.isSuspicious
                              ? "border-orange-400/50 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20"
                              : "border-border/50 bg-background text-muted-foreground hover:bg-muted/50"
                          }`}
                          title={ip.isSuspicious ? "Suspicious: multiple IPs detected" : "IP access info"}
                        >
                          {ip.isSuspicious ? <WifiOff className="h-3 w-3" /> : <Wifi className="h-3 w-3" />}
                          <span>{ip.distinctIpCount} IP{ip.distinctIpCount !== 1 ? "s" : ""}</span>
                          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => revokeMutation.mutate({ enrollmentId: e.id })}
                        disabled={revokeMutation.isPending}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {isExpanded && ip && (
                    <div className="border-t border-border/40 px-3 py-2.5 bg-muted/30 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs">
                        <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">Distinct IPs:</span>
                        <span className={`font-medium ${ip.isSuspicious ? "text-orange-400" : ""}`}>{ip.distinctIpCount}</span>
                        {ip.isSuspicious && (
                          <Badge variant="outline" className="text-orange-400 border-orange-400/40 text-[10px] py-0">Suspicious</Badge>
                        )}
                      </div>
                      {ip.lastAccessIp && (
                        <div className="flex items-center gap-2 text-xs">
                          <Wifi className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">Last IP:</span>
                          <code className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">{ip.lastAccessIp}</code>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">Total accesses:</span>
                        <span className="font-medium">{ip.accessCount}</span>
                      </div>
                      <a
                        href={`/admin/sharing-monitor?userId=${user.id}`}
                        className="flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                      >
                        <ExternalLink className="h-3 w-3" /> View full IP timeline
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border/50 px-4 py-6 text-center">
            <BookOpen className="h-6 w-6 mx-auto mb-2 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No active enrollments</p>
          </div>
        )}
      </div>

      {/* Enroll in a course */}
      <div className="border-t border-border/40 pt-5 space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Plus className="h-3.5 w-3.5" /> Enroll in a Course
        </h3>

        {isPlatformAdmin && (
          <div className="space-y-1.5">
            <Label>Organization</Label>
            <Select
              value={enrollOrgId?.toString() ?? ""}
              onValueChange={(v) => { setEnrollOrgId(Number(v)); setEnrollCourseId(null); }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select organization..." />
              </SelectTrigger>
              <SelectContent>
                {orgs?.map((o) => (
                  <SelectItem key={o.id} value={o.id.toString()}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {(enrollOrgId || !isPlatformAdmin) && (
          <div className="space-y-1.5">
            <Label>Course</Label>
            <Select
              value={enrollCourseId?.toString() ?? ""}
              onValueChange={(v) => setEnrollCourseId(Number(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select course..." />
              </SelectTrigger>
              <SelectContent>
                {courses?.map((c: { id: number; title: string }) => (
                  <SelectItem key={c.id} value={c.id.toString()}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {enrollCourseId && (enrollOrgId || !isPlatformAdmin) && (
          <Button
            className="w-full gap-2"
            onClick={() => enrollMutation.mutate({
              userId: user.id,
              courseId: enrollCourseId,
              orgId: enrollOrgId ?? (user.orgId ?? 0),
            })}
            disabled={enrollMutation.isPending}
          >
            <Plus className="h-4 w-4" />
            {enrollMutation.isPending ? "Enrolling..." : "Enroll"}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Subscription Tab ─────────────────────────────────────────────────────────

function SubscriptionTab({ user, onSaved }: { user: UserRow; onSaved: () => void }) {
  const { data: sub, refetch } = trpc.users.getUserOrgSubscription.useQuery({ userId: user.id });

  const [form, setForm] = useState({
    plan: "free" as string,
    status: "active" as string,
    customPriceUsd: "",
    customPriceLabel: "",
    adminNotes: "",
  });

  // Sync form when sub loads
  const [synced, setSynced] = useState(false);
  if (sub && !synced) {
    setForm({
      plan: sub.plan ?? "free",
      status: sub.status ?? "active",
      customPriceUsd: sub.customPriceUsd?.toString() ?? "",
      customPriceLabel: sub.customPriceLabel ?? "",
      adminNotes: sub.adminNotes ?? "",
    });
    setSynced(true);
  }

  // Suppress stale reference — expiresAt/notes are not in this schema

  const updateSub = trpc.users.updateUserOrgSubscription.useMutation({
    onSuccess: () => { toast.success("Subscription updated"); refetch(); onSaved(); },
    onError: (e) => toast.error(e.message),
  });

  if (!user.orgId && !sub?.orgId) {
    return (
      <div className="rounded-lg border border-dashed border-border/50 px-4 py-8 text-center">
        <CreditCard className="h-6 w-6 mx-auto mb-2 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">This user is not a member of any organization.</p>
        <p className="text-xs text-muted-foreground mt-1">Assign them to an org first to manage their subscription.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <CreditCard className="h-3.5 w-3.5" /> Organization Subscription
        </h3>

        {sub?.plan && (
          <div className="rounded-lg bg-muted/30 px-3 py-2.5 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Current Plan</span>
            <Badge className={`text-xs border ${PLAN_COLORS[sub.plan] ?? ""}`}>
              {PLAN_LABELS[sub.plan] ?? sub.plan}
            </Badge>
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Plan</Label>
          <Select value={form.plan} onValueChange={(v) => setForm((f) => ({ ...f, plan: v }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="starter">Starter</SelectItem>
              <SelectItem value="growth">Growth</SelectItem>
              <SelectItem value="professional">Professional</SelectItem>
              <SelectItem value="enterprise">Enterprise</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="trialing">Trialing</SelectItem>
              <SelectItem value="past_due">Past Due</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Custom Price (cents)</Label>
            <Input
              type="number"
              placeholder="e.g. 49900"
              value={form.customPriceUsd}
              onChange={(e) => setForm((f) => ({ ...f, customPriceUsd: e.target.value }))}
              min={0}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Price Label</Label>
            <Input
              placeholder="e.g. $499/mo"
              value={form.customPriceLabel}
              onChange={(e) => setForm((f) => ({ ...f, customPriceLabel: e.target.value }))}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Admin Notes</Label>
          <Input
            placeholder="e.g. Annual contract, renewal due..."
            value={form.adminNotes}
            onChange={(e) => setForm((f) => ({ ...f, adminNotes: e.target.value }))}
          />
        </div>

        <Button
          className="w-full gap-2"
          onClick={() => updateSub.mutate({
            userId: user.id,
            plan: form.plan as any,
            status: form.status as any,
            customPriceUsd: form.customPriceUsd ? Number(form.customPriceUsd) : undefined,
            customPriceLabel: form.customPriceLabel || undefined,
            adminNotes: form.adminNotes || undefined,
          })}
          disabled={updateSub.isPending}
        >
          <Save className="h-4 w-4" />
          {updateSub.isPending ? "Saving..." : "Save Subscription"}
        </Button>
      </div>
    </div>
  );
}

// ─── Transactions Tab ───────────────────────────────────────────────────────────

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
  stripePaymentIntentId: string | null;
};

function ReceiptModal({ invoice, onClose }: { invoice: InvoiceRow; onClose: () => void }) {
  const fmt = (n: number, cur: string) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: cur.toUpperCase() }).format(n);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
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
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
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
            <span>{new Date(invoice.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
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

const STATUS_ICONS: Record<string, React.ReactNode> = {
  paid: <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />,
  pending: <Clock className="h-3.5 w-3.5 text-amber-500" />,
  refunded: <XCircle className="h-3.5 w-3.5 text-slate-400" />,
};

function TransactionsTab({ user, isPlatformAdmin }: { user: UserRow; isPlatformAdmin: boolean }) {
  const [receiptInvoice, setReceiptInvoice] = useState<InvoiceRow | null>(null);
  const { data, isLoading } = trpc.invoices.listByUser.useQuery(
    { targetUserId: user.id, orgId: user.orgId ?? undefined },
    { enabled: !!user.id }
  );
  const fmt = (n: number, cur: string) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: cur.toUpperCase() }).format(n);

  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 rounded-lg bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-dashed border-border/50 px-4 py-10 text-center">
          <Receipt className="h-7 w-7 mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No transactions found for this user.</p>
        </div>
      </div>
    );
  }

  const totalPaid = data.filter((r) => r.status === "paid").reduce((s, r) => s + r.amountPaid, 0);

  return (
    <div className="flex flex-col">
      {/* Summary */}
      <div className="px-6 py-3 border-b border-border/40 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{data.length} transaction{data.length !== 1 ? "s" : ""}</span>
        <span className="text-xs font-semibold text-green-700">{fmt(totalPaid, data[0]?.currency ?? "usd")} paid</span>
      </div>
      {/* List */}
      <div className="divide-y divide-border/40">
        {data.map((inv) => (
          <div key={inv.id} className="flex items-center gap-3 px-6 py-3 hover:bg-muted/20 transition-colors">
            <div className="shrink-0 mt-0.5">{STATUS_ICONS[inv.status] ?? STATUS_ICONS.pending}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{inv.productTitle}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(inv.createdAt).toLocaleDateString()} · <span className="capitalize">{inv.productType}</span>
                {inv.isManual && <span className="ml-1 text-amber-600">(manual)</span>}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-semibold">{fmt(inv.amountPaid, inv.currency)}</p>
              <button
                onClick={() => setReceiptInvoice(inv)}
                className="text-xs text-primary hover:underline flex items-center gap-1 ml-auto"
              >
                <Receipt className="h-3 w-3" /> Receipt
              </button>
            </div>
          </div>
        ))}
      </div>
      {receiptInvoice && <ReceiptModal invoice={receiptInvoice} onClose={() => setReceiptInvoice(null)} />}
    </div>
  );
}

// ─── Danger Zone ──────────────────────────────────────────────────────────────

function DangerZone({ user, onDeleted }: { user: UserRow; onDeleted: () => void }) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const deleteUser = trpc.users.delete.useMutation({
    onSuccess: () => { toast.success("User deleted"); onDeleted(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="border-t border-destructive/20 mx-6 mb-6 pt-5 space-y-3">
      <h3 className="text-xs font-semibold text-destructive uppercase tracking-wider flex items-center gap-2">
        <Trash2 className="h-3.5 w-3.5" /> Danger Zone
      </h3>
      <Button
        variant="destructive"
        size="sm"
        className="w-full gap-2"
        onClick={() => setConfirmOpen(true)}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete Account Permanently
      </Button>
      <p className="text-xs text-muted-foreground">
        This will permanently delete the user and all their data. This action cannot be undone.
      </p>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete <strong>{user.name ?? user.email ?? "this user"}</strong>?
              This will remove all their data, enrollments, and progress. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteUser.mutate({ userId: user.id })}
            >
              {deleteUser.isPending ? "Deleting..." : "Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
