import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { UserDetailPanel, type UserRow } from "@/components/UserDetailPanel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import {
  Users, Search, Edit, Trash2, Plus, X, BookOpen,
  User as UserIcon, Shield, Building2, Eye, EyeOff,
  CheckSquare, Square, ChevronDown,
} from "lucide-react";
import { useState, useMemo } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ROLE_LABELS: Record<string, string> = {
  site_owner: "Owner",
  site_admin: "Platform Admin",
  org_super_admin: "Org Super Admin",
  org_admin: "Org Admin",
  member: "Org Member",
  user: "Org Member",
};

const ROLE_COLORS: Record<string, string> = {
  site_owner: "bg-[color:color-mix(in_srgb,var(--org-primary)_18%,transparent)] text-[var(--org-primary)] border-[color:color-mix(in_srgb,var(--org-primary)_35%,transparent)]",
  site_admin: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  org_super_admin: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  org_admin: "bg-[color:color-mix(in_srgb,var(--org-primary)_12%,transparent)] text-[var(--org-primary)] border-[color:color-mix(in_srgb,var(--org-primary)_28%,transparent)]",
  member: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  user: "bg-slate-500/20 text-slate-300 border-slate-500/30",
};

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const isOwner = currentUser?.role === "site_owner";
  const isPlatformAdmin = currentUser?.role === "site_owner" || currentUser?.role === "site_admin";

  const utils = trpc.useUtils();
  const { data: users, refetch: refetchUsers } = trpc.users.listWithOrg.useQuery();
  const { data: orgs } = trpc.orgs.list.useQuery();

  const [search, setSearch] = useState("");
  const [orgFilter, setOrgFilter] = useState<string>("all");
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "", email: "", password: "",
    role: "member" as "site_admin" | "org_super_admin" | "org_admin" | "member",
    orgId: "" as string,
    memberSubRole: "basic_member" as "basic_member" | "instructor" | "group_manager" | "group_member",
  });
  const [showPassword, setShowPassword] = useState(false);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkOrgId, setBulkOrgId] = useState<string>("");
  const [bulkRole, setBulkRole] = useState<string>("member");
  const [bulkCourseOrgId, setBulkCourseOrgId] = useState<string>("");
  const [bulkCourseId, setBulkCourseId] = useState<string>("");
  const [bulkActionOpen, setBulkActionOpen] = useState<"assign_org" | "change_role" | "enroll" | null>(null);

  const { data: bulkCourses } = trpc.lms.courses.list.useQuery(
    { orgId: Number(bulkCourseOrgId) },
    { enabled: !!bulkCourseOrgId }
  );

  const bulkUpdate = trpc.users.bulkUpdate.useMutation({
    onSuccess: (res) => {
      toast.success(`Updated ${res.updated} users`);
      setSelectedIds(new Set());
      setBulkActionOpen(null);
      refetchUsers();
    },
    onError: (e) => toast.error(e.message),
  });

  const bulkEnroll = trpc.users.bulkEnroll.useMutation({
    onSuccess: (res) => {
      toast.success(`Enrolled ${res.enrolled} users`);
      setSelectedIds(new Set());
      setBulkActionOpen(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const createUser = trpc.users.create.useMutation({
    onSuccess: () => {
      toast.success("User created successfully");
      setAddOpen(false);
      setAddForm({ name: "", email: "", password: "", role: "member", orgId: "", memberSubRole: "basic_member" });
      refetchUsers();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteUserMutation = trpc.users.delete.useMutation({
    onSuccess: () => { toast.success("User deleted"); setDeleteTarget(null); setEditUser(null); refetchUsers(); },
    onError: (e) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    if (!users) return [];
    let list = users as UserRow[];
    if (orgFilter !== "all") {
      if (orgFilter === "none") {
        list = list.filter((u) => !u.orgId);
      } else {
        list = list.filter((u) => u.orgId?.toString() === orgFilter);
      }
    }
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter((u) =>
      (u.name ?? "").toLowerCase().includes(q) ||
      (u.email ?? "").toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q) ||
      (u.orgName ?? "").toLowerCase().includes(q)
    );
  }, [users, search, orgFilter]);

  const allSelected = filtered.length > 0 && filtered.every((u) => selectedIds.has(u.id));
  const someSelected = filtered.some((u) => selectedIds.has(u.id));

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((u) => u.id)));
    }
  }

  function toggleOne(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleAddUser() {
    if (!addForm.name || !addForm.email || !addForm.password) {
      toast.error("Name, email, and password are required");
      return;
    }
    createUser.mutate({
      name: addForm.name,
      email: addForm.email,
      password: addForm.password,
      role: addForm.role,
      orgId: addForm.orgId ? Number(addForm.orgId) : undefined,
    });
  }

  function handleBulkAssignOrg() {
    if (!bulkOrgId) { toast.error("Select an organization"); return; }
    bulkUpdate.mutate({
      userIds: Array.from(selectedIds),
      orgId: Number(bulkOrgId),
      orgRole: bulkRole as any,
    });
  }

  function handleBulkChangeRole() {
    bulkUpdate.mutate({
      userIds: Array.from(selectedIds),
      role: bulkRole as any,
    });
  }

  function handleBulkEnroll() {
    if (!bulkCourseId) { toast.error("Select a course"); return; }
    if (!bulkCourseOrgId) { toast.error("Select an organization"); return; }
    bulkEnroll.mutate({
      userIds: Array.from(selectedIds),
      courseId: Number(bulkCourseId),
      orgId: Number(bulkCourseOrgId),
    });
  }

  const selectedCount = selectedIds.size;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> Users
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">{users?.length ?? 0} registered users</p>
        </div>
        <Button className="gap-2" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /> Add User
        </Button>
      </div>

      {/* Search + Org Filter */}
      <div className="flex gap-2 flex-col sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, role, or organization..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {isPlatformAdmin && (
          <Select value={orgFilter} onValueChange={setOrgFilter}>
            <SelectTrigger className="w-full sm:w-52">
              <SelectValue placeholder="Filter by org..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Organizations</SelectItem>
              <SelectItem value="none">No Organization</SelectItem>
              {orgs?.map((o) => (
                <SelectItem key={o.id} value={o.id.toString()}>{o.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Bulk Action Toolbar */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/10 border border-primary/30 rounded-lg">
          <span className="text-sm font-medium text-primary">{selectedCount} selected</span>
          <div className="flex-1" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5 bg-background">
                Bulk Actions <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => setBulkActionOpen("assign_org")}>
                <Building2 className="h-4 w-4 mr-2" /> Assign to Organization
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setBulkActionOpen("change_role")}>
                <Shield className="h-4 w-4 mr-2" /> Change Platform Role
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setBulkActionOpen("enroll")}>
                <BookOpen className="h-4 w-4 mr-2" /> Enroll in Course
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setSelectedIds(new Set())}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Users Table */}
      <div className="rounded-xl border border-border/60 overflow-hidden shadow-sm">
        {/* Header row */}
        <div className={`hidden sm:grid gap-4 px-5 py-2.5 bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider ${isPlatformAdmin ? "grid-cols-[32px_1fr_160px_auto_auto_auto_auto]" : "grid-cols-[32px_1fr_auto_auto_auto_auto]"}`}>
          <Checkbox
            checked={allSelected}
            onCheckedChange={toggleAll}
            aria-label="Select all"
            className="mt-0.5"
          />
          <span>User</span>
          {isPlatformAdmin && <span>Organization</span>}
          <span>Role</span>
          <span>Method</span>
          <span>Joined</span>
          <span></span>
        </div>

        {filtered.length === 0 ? (
          <div className="px-5 py-10 text-center text-muted-foreground text-sm">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
            No users found
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {filtered.map((u) => {
              const isSelected = selectedIds.has(u.id);
              return (
                <div key={u.id} className={`transition-colors ${isSelected ? "bg-primary/5" : "hover:bg-muted/20"}`}>
                  {/* Desktop row */}
                  <div className={`hidden sm:grid gap-4 px-5 py-3 items-center ${isPlatformAdmin ? "grid-cols-[32px_1fr_160px_auto_auto_auto_auto]" : "grid-cols-[32px_1fr_auto_auto_auto_auto]"}`}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleOne(u.id)}
                      aria-label={`Select ${u.name ?? u.email}`}
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{u.name ?? <span className="text-muted-foreground italic">No name</span>}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email ?? "—"}</p>
                    </div>
                    {isPlatformAdmin && (
                      <span className="text-xs text-muted-foreground truncate">
                        {u.orgName ?? <span className="italic opacity-50">—</span>}
                      </span>
                    )}
                    <Badge className={`text-xs border ${ROLE_COLORS[u.role] ?? ROLE_COLORS.user}`}>{ROLE_LABELS[u.role] ?? u.role}</Badge>
                    <span className="text-xs text-muted-foreground capitalize">{u.loginMethod ?? "—"}</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(u.createdAt).toLocaleDateString()}</span>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setEditUser(u as UserRow)}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {/* Mobile card */}
                  <div className="sm:hidden flex items-center gap-3 px-4 py-3">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleOne(u.id)}
                      aria-label={`Select ${u.name ?? u.email}`}
                      className="shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{u.name ?? <span className="text-muted-foreground italic">No name</span>}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email ?? "—"}</p>
                      {isPlatformAdmin && u.orgName && (
                        <p className="text-xs text-muted-foreground truncate">{u.orgName}</p>
                      )}
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <Badge className={`text-xs border ${ROLE_COLORS[u.role] ?? ROLE_COLORS.user}`}>{ROLE_LABELS[u.role] ?? u.role}</Badge>
                        <span className="text-xs text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0" onClick={() => setEditUser(u as UserRow)}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bulk Action — Assign to Org */}
      <Dialog open={bulkActionOpen === "assign_org"} onOpenChange={(o) => { if (!o) setBulkActionOpen(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" /> Assign {selectedCount} Users to Organization
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Organization</Label>
              <Select value={bulkOrgId} onValueChange={setBulkOrgId}>
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
            <div className="space-y-1.5">
              <Label>Org Role</Label>
              <Select value={bulkRole} onValueChange={setBulkRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Org Member</SelectItem>
                  <SelectItem value="org_admin">Org Admin</SelectItem>
                  <SelectItem value="org_super_admin">Org Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkActionOpen(null)}>Cancel</Button>
            <Button onClick={handleBulkAssignOrg} disabled={bulkUpdate.isPending}>
              {bulkUpdate.isPending ? "Assigning..." : `Assign ${selectedCount} Users`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Action — Change Platform Role */}
      <Dialog open={bulkActionOpen === "change_role"} onOpenChange={(o) => { if (!o) setBulkActionOpen(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" /> Change Role for {selectedCount} Users
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>New Platform Role</Label>
              <Select value={bulkRole} onValueChange={setBulkRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Org Member</SelectItem>
                  <SelectItem value="org_admin">Org Admin</SelectItem>
                  <SelectItem value="org_super_admin">Org Super Admin</SelectItem>
                  {isOwner && <SelectItem value="site_admin">Platform Admin</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkActionOpen(null)}>Cancel</Button>
            <Button onClick={handleBulkChangeRole} disabled={bulkUpdate.isPending}>
              {bulkUpdate.isPending ? "Updating..." : `Update ${selectedCount} Users`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Action — Enroll in Course */}
      <Dialog open={bulkActionOpen === "enroll"} onOpenChange={(o) => { if (!o) setBulkActionOpen(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" /> Enroll {selectedCount} Users in Course
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Organization</Label>
              <Select value={bulkCourseOrgId} onValueChange={(v) => { setBulkCourseOrgId(v); setBulkCourseId(""); }}>
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
            {bulkCourseOrgId && (
              <div className="space-y-1.5">
                <Label>Course</Label>
                <Select value={bulkCourseId} onValueChange={setBulkCourseId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select course..." />
                  </SelectTrigger>
                  <SelectContent>
                    {bulkCourses?.map((c: any) => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkActionOpen(null)}>Cancel</Button>
            <Button onClick={handleBulkEnroll} disabled={bulkEnroll.isPending || !bulkCourseId}>
              {bulkEnroll.isPending ? "Enrolling..." : `Enroll ${selectedCount} Users`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add User Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserIcon className="h-5 w-5 text-primary" /> Add New User
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Full Name <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Jane Smith"
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                autoCorrect="off"
                autoCapitalize="words"
                spellCheck={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email Address <span className="text-destructive">*</span></Label>
              <Input
                type="email"
                placeholder="jane@example.com"
                value={addForm.email}
                onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Temporary Password <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Min. 6 characters"
                  value={addForm.password}
                  onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={addForm.role} onValueChange={(v) => setAddForm((f) => ({ ...f, role: v as any }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Org Member</SelectItem>
                    <SelectItem value="org_admin">Org Admin</SelectItem>
                    <SelectItem value="org_super_admin">Org Super Admin</SelectItem>
                    {isOwner && <SelectItem value="site_admin">Platform Admin</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              {isPlatformAdmin && (
                <div className="space-y-1.5">
                  <Label>Organization</Label>
                  <Select value={addForm.orgId} onValueChange={(v) => setAddForm((f) => ({ ...f, orgId: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {orgs?.map((o) => (
                        <SelectItem key={o.id} value={o.id.toString()}>{o.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAddUser} disabled={createUser.isPending} className="gap-2">
              <Plus className="h-4 w-4" />
              {createUser.isPending ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Detail Panel */}
      <UserDetailPanel
        user={editUser}
        open={!!editUser}
        onClose={() => setEditUser(null)}
        isPlatformAdmin={isPlatformAdmin}
        isOwner={isOwner}
        onUserUpdated={() => { utils.users.invalidate(); refetchUsers(); }}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete <strong>{deleteTarget?.name ?? deleteTarget?.email ?? "this user"}</strong>?
              This will remove all their data, enrollments, and progress. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteUserMutation.mutate({ userId: deleteTarget.id })}
            >
              {deleteUserMutation.isPending ? "Deleting..." : "Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
