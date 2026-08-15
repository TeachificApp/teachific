import { useState, useMemo, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { getSubdomain } from "@/hooks/useSubdomain";
import { toast } from "sonner";
import {
  Search, Users, BookOpen, TrendingUp, Download, UserPlus,
  ChevronDown, ChevronUp, MoreVertical, Eye, EyeOff, Plus, Upload, FileSpreadsheet, AlertCircle, CheckCircle2
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";

export default function MembersPage() {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<"name" | "enrollments" | "progress" | "joined">("joined");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [enrollEmail, setEnrollEmail] = useState("");
  const [enrollCourseId, setEnrollCourseId] = useState<string>("");

  // Add Member dialog state
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "", email: "", password: "",
    role: "user" as "org_super_admin" | "org_admin" | "user",
    memberSubRole: "basic_member" as "basic_member" | "instructor" | "group_manager" | "group_member",
    courseIds: [] as number[],
  });
  const [showAddPassword, setShowAddPassword] = useState(false);

  // Bulk import state
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [bulkPreview, setBulkPreview] = useState<Array<{name: string; email: string; password?: string; role: "org_admin" | "user"}>>([]);
  const [bulkFileName, setBulkFileName] = useState("");
  const [bulkParseError, setBulkParseError] = useState("");
  const [bulkResult, setBulkResult] = useState<{created: number; updated: number; failed: number; errors: string[]; total: number} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: orgs } = trpc.orgs.myOrgs.useQuery();
  const currentSubdomain = getSubdomain() ?? undefined;
  const { data: orgCtx } = trpc.orgs.myContext.useQuery({ subdomain: currentSubdomain });
  const orgId = orgCtx?.org?.id ?? orgs?.[0]?.id;

  const { data: members, isLoading, refetch } = trpc.lms.members.listWithEnrollments.useQuery(
    { orgId: orgId! },
    { enabled: !!orgId }
  );

  const { data: courses } = trpc.lms.courses.list.useQuery(
    { orgId: orgId! },
    { enabled: !!orgId }
  );

  const bulkImport = trpc.lms.members.bulkImport.useMutation({
    onSuccess: (result) => {
      setBulkResult(result);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleBulkFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkFileName(file.name);
    setBulkParseError("");
    setBulkPreview([]);
    setBulkResult(null);
    try {
      const text = await file.text();
      // Parse CSV
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { setBulkParseError("File must have a header row and at least one data row."); return; }
      const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/[^a-z]/g, ""));
      const nameIdx = headers.findIndex(h => h.includes("name"));
      const emailIdx = headers.findIndex(h => h.includes("email"));
      const passIdx = headers.findIndex(h => h.includes("pass"));
      const roleIdx = headers.findIndex(h => h.includes("role"));
      if (nameIdx < 0 || emailIdx < 0) { setBulkParseError("CSV must have 'name' and 'email' columns."); return; }
      const rows = lines.slice(1).map(line => {
        const cols = line.split(",").map(c => c.trim().replace(/^"|"$/g, ""));
        return {
          name: cols[nameIdx] ?? "",
          email: cols[emailIdx] ?? "",
          password: passIdx >= 0 && cols[passIdx] ? cols[passIdx] : "Teachific@123",
          role: (roleIdx >= 0 && cols[roleIdx]?.toLowerCase().includes("admin") ? "org_admin" : "user") as "org_admin" | "user",
        };
      }).filter(r => r.name && r.email);
      if (!rows.length) { setBulkParseError("No valid rows found."); return; }
      setBulkPreview(rows);
    } catch {
      setBulkParseError("Failed to parse file. Please use a valid CSV.");
    }
  };

  // Reset password state
  const [resetPwdMember, setResetPwdMember] = useState<{ userId: number; name?: string | null; email?: string | null } | null>(null);
  const [resetPwdValue, setResetPwdValue] = useState("");
  const [resetPwdConfirm, setResetPwdConfirm] = useState("");
  const resetPasswordMutation = trpc.orgs.members.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("Password reset successfully");
      setResetPwdMember(null);
      setResetPwdValue("");
      setResetPwdConfirm("");
    },
    onError: (err) => toast.error(err.message),
  });

  const createAndAdd = trpc.lms.members.createAndAdd.useMutation({
    onSuccess: () => {
      toast.success("Member added successfully");
      setAddMemberOpen(false);
      setAddForm({ name: "", email: "", password: "", role: "user", memberSubRole: "basic_member", courseIds: [] });
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const manualEnroll = trpc.lms.members.manualEnroll.useMutation({
    onSuccess: () => {
      toast.success("Enrolled successfully");
      setEnrollDialogOpen(false);
      setEnrollEmail("");
      setEnrollCourseId("");
      refetch();
    },
    onError: (err) => {
      toast.error("Enrollment failed", { description: err.message });
    },
  });

  const totalMembers = members?.length ?? 0;
  const totalEnrollments = members?.reduce((s, m) => s + m.totalEnrollments, 0) ?? 0;
  const avgProgress = members && members.length > 0
    ? Math.round(members.reduce((s, m) => s + m.avgProgress, 0) / members.length)
    : 0;

  const filtered = useMemo(() => {
    let list = members ?? [];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(m =>
        m.name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q)
      );
    }
    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") cmp = (a.name ?? "").localeCompare(b.name ?? "");
      else if (sortField === "enrollments") cmp = a.totalEnrollments - b.totalEnrollments;
      else if (sortField === "progress") cmp = a.avgProgress - b.avgProgress;
      else if (sortField === "joined") cmp = new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [members, search, sortField, sortDir]);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) =>
    sortField !== field ? null :
      sortDir === "asc" ? <ChevronUp className="h-3 w-3 ml-1 inline" /> : <ChevronDown className="h-3 w-3 ml-1 inline" />;

  const exportCSV = () => {
    const rows = [
      ["Name", "Email", "Role", "Enrollments", "Completed", "Avg Progress %", "Joined"],
      ...(members ?? []).map(m => [
        m.name ?? "",
        m.email ?? "",
        m.role,
        m.totalEnrollments,
        m.completedCourses,
        m.avgProgress,
        new Date(m.joinedAt).toLocaleDateString(),
      ]),
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "members.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Members</h1>
          <p className="text-sm text-muted-foreground mt-0.5">View and manage students enrolled in your courses</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setBulkImportOpen(true); setBulkPreview([]); setBulkFileName(""); setBulkParseError(""); setBulkResult(null); }} className="gap-1.5">
            <Upload className="h-4 w-4" /> Bulk Import
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEnrollDialogOpen(true)} className="gap-1.5">
            <UserPlus className="h-4 w-4" /> Enroll Existing
          </Button>
          <Button size="sm" onClick={() => setAddMemberOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add Member
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: Users, label: "Total Members", value: totalMembers, color: "text-primary", bg: "bg-primary/10" },
          { icon: BookOpen, label: "Total Enrollments", value: totalEnrollments, color: "text-blue-600", bg: "bg-blue-500/10" },
          { icon: TrendingUp, label: "Avg Progress", value: `${avgProgress}%`, color: "text-green-600", bg: "bg-green-500/10" },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`h-10 w-10 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button className="flex items-center font-medium" onClick={() => toggleSort("name")}>
                  Member <SortIcon field="name" />
                </button>
              </TableHead>
              <TableHead>Role</TableHead>
              <TableHead>
                <button className="flex items-center font-medium" onClick={() => toggleSort("enrollments")}>
                  Enrollments <SortIcon field="enrollments" />
                </button>
              </TableHead>
              <TableHead>
                <button className="flex items-center font-medium" onClick={() => toggleSort("progress")}>
                  Avg Progress <SortIcon field="progress" />
                </button>
              </TableHead>
              <TableHead>Completed</TableHead>
              <TableHead>
                <button className="flex items-center font-medium" onClick={() => toggleSort("joined")}>
                  Joined <SortIcon field="joined" />
                </button>
              </TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  {search ? "No members match your search." : "No members yet. Students who enroll will appear here."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((m) => (
                <TableRow key={m.userId}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {(m.name ?? m.email ?? "?")[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{m.name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{m.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={m.role === "org_admin" || m.role === "org_super_admin" ? "default" : "secondary"} className="text-xs">
                      {m.role === "org_super_admin" ? "Org Super Admin" : m.role === "org_admin" ? "Admin" : "Student"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{m.totalEnrollments}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 min-w-[100px]">
                      <Progress value={m.avgProgress} className="h-1.5 flex-1" />
                      <span className="text-xs text-muted-foreground w-8 text-right">{m.avgProgress}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{m.completedCourses} / {m.totalEnrollments}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(m.joinedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEnrollEmail(m.email ?? ""); setEnrollDialogOpen(true); }}>
                          Enroll in Course
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setResetPwdMember({ userId: m.userId, name: m.name, email: m.email }); setResetPwdValue(""); setResetPwdConfirm(""); }}>
                          Reset Password
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden flex flex-col gap-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {search ? "No members match your search." : "No members yet."}
            </CardContent>
          </Card>
        ) : (
          filtered.map((m) => (
            <Card key={m.userId}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <AvatarFallback className="text-sm bg-primary/10 text-primary">
                        {(m.name ?? m.email ?? "?")[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{m.name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={m.role === "org_admin" || m.role === "org_super_admin" ? "default" : "secondary"} className="text-xs">
                          {m.role === "org_super_admin" ? "Org Super Admin" : m.role === "org_admin" ? "Admin" : "Student"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(m.joinedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setEnrollEmail(m.email ?? ""); setEnrollDialogOpen(true); }}>
                        Enroll in Course
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setResetPwdMember({ userId: m.userId, name: m.name, email: m.email }); setResetPwdValue(""); setResetPwdConfirm(""); }}>
                        Reset Password
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="bg-muted/50 rounded-md p-2">
                    <p className="text-sm font-bold">{m.totalEnrollments}</p>
                    <p className="text-xs text-muted-foreground">Enrolled</p>
                  </div>
                  <div className="bg-muted/50 rounded-md p-2">
                    <p className="text-sm font-bold">{m.completedCourses}</p>
                    <p className="text-xs text-muted-foreground">Completed</p>
                  </div>
                  <div className="bg-muted/50 rounded-md p-2">
                    <p className="text-sm font-bold">{m.avgProgress}%</p>
                    <p className="text-xs text-muted-foreground">Progress</p>
                  </div>
                </div>
                {m.totalEnrollments > 0 && <Progress value={m.avgProgress} className="h-1.5 mt-2" />}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetPwdMember} onOpenChange={(o) => { if (!o) { setResetPwdMember(null); setResetPwdValue(""); setResetPwdConfirm(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Set a new password for <strong>{resetPwdMember?.name ?? resetPwdMember?.email ?? "this member"}</strong>.
            </p>
            <div className="space-y-1.5">
              <Label>New Password</Label>
              <Input
                type="password"
                placeholder="Enter new password…"
                value={resetPwdValue}
                onChange={(e) => setResetPwdValue(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Confirm Password</Label>
              <Input
                type="password"
                placeholder="Confirm new password…"
                value={resetPwdConfirm}
                onChange={(e) => setResetPwdConfirm(e.target.value)}
                className={resetPwdValue && resetPwdConfirm && resetPwdValue !== resetPwdConfirm ? "border-destructive" : ""}
                autoComplete="new-password"
              />
              {resetPwdValue && resetPwdConfirm && resetPwdValue !== resetPwdConfirm && (
                <p className="text-xs text-destructive">Passwords do not match</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetPwdMember(null); setResetPwdValue(""); setResetPwdConfirm(""); }}>Cancel</Button>
            <Button
              onClick={() => {
                if (!resetPwdMember || !orgId) return;
                if (resetPwdValue.length < 6) { toast.error("Password must be at least 6 characters"); return; }
                if (resetPwdValue !== resetPwdConfirm) { toast.error("Passwords do not match"); return; }
                resetPasswordMutation.mutate({ orgId, userId: resetPwdMember.userId, newPassword: resetPwdValue });
              }}
              disabled={resetPasswordMutation.isPending || !resetPwdValue || !resetPwdConfirm || resetPwdValue !== resetPwdConfirm}
            >
              {resetPasswordMutation.isPending ? "Resetting…" : "Reset Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Enroll Dialog */}
      <Dialog open={enrollDialogOpen} onOpenChange={setEnrollDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enroll Student in Course</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="enroll-email">Student Email</Label>
              <Input
                id="enroll-email"
                type="email"
                placeholder="student@example.com"
                value={enrollEmail}
                onChange={(e) => setEnrollEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                The student must already have a Teachific account with this email.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Course</Label>
              <Select value={enrollCourseId} onValueChange={setEnrollCourseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a course..." />
                </SelectTrigger>
                <SelectContent>
                  {(courses ?? []).map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnrollDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={!enrollEmail || !enrollCourseId || manualEnroll.isPending}
              onClick={() => {
                if (!orgId || !enrollCourseId) return;
                manualEnroll.mutate({ orgId, courseId: Number(enrollCourseId), email: enrollEmail });
              }}
            >
              {manualEnroll.isPending ? "Enrolling..." : "Enroll"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" /> Add New Member
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 flex flex-col gap-1.5">
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
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label>Email Address <span className="text-destructive">*</span></Label>
                <Input
                  type="email"
                  placeholder="jane@example.com"
                  value={addForm.email}
                  onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label>Temporary Password <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Input
                    type={showAddPassword ? "text" : "password"}
                    placeholder="Min. 6 characters"
                    value={addForm.password}
                    onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowAddPassword((v) => !v)}
                  >
                    {showAddPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Role</Label>
                <Select value={addForm.role} onValueChange={(v) => setAddForm((f) => ({ ...f, role: v as any }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Student</SelectItem>
                    <SelectItem value="org_admin">Org Admin</SelectItem>
                    <SelectItem value="org_super_admin">Org Super Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {addForm.role === "user" && (
                <div className="flex flex-col gap-1.5">
                  <Label>Member access</Label>
                  <Select value={addForm.memberSubRole} onValueChange={(v) => setAddForm((f) => ({ ...f, memberSubRole: v as typeof f.memberSubRole }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic_member">Member</SelectItem>
                      <SelectItem value="instructor">Instructor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {courses && courses.length > 0 && (
              <div className="flex flex-col gap-2">
                <Label>Enroll in Courses (optional)</Label>
                <div className="rounded-lg border border-border/60 divide-y divide-border/40 max-h-48 overflow-y-auto">
                  {courses.map((c) => (
                    <label key={c.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/30">
                      <Checkbox
                        checked={addForm.courseIds.includes(c.id)}
                        onCheckedChange={(checked) =>
                          setAddForm((f) => ({
                            ...f,
                            courseIds: checked
                              ? [...f.courseIds, c.id]
                              : f.courseIds.filter((id) => id !== c.id),
                          }))
                        }
                      />
                      <span className="text-sm">{c.title}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMemberOpen(false)}>Cancel</Button>
            <Button
              disabled={!addForm.name || !addForm.email || !addForm.password || createAndAdd.isPending || !orgId}
              onClick={() => {
                if (!orgId) return;
                createAndAdd.mutate({
                  orgId,
                  name: addForm.name,
                  email: addForm.email,
                  password: addForm.password,
                  role: addForm.role,
                  memberSubRole: addForm.memberSubRole,
                  courseIds: addForm.courseIds.length > 0 ? addForm.courseIds : undefined,
                });
              }}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              {createAndAdd.isPending ? "Adding..." : "Add Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Import Dialog */}
      <Dialog open={bulkImportOpen} onOpenChange={setBulkImportOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Bulk Import Members
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!bulkResult ? (
              <>
                <div className="rounded-lg border-2 border-dashed border-border p-6 text-center space-y-3">
                  <FileSpreadsheet className="h-10 w-10 text-muted-foreground mx-auto" />
                  <div>
                    <p className="text-sm font-medium">Upload a CSV file</p>
                    <p className="text-xs text-muted-foreground mt-1">Required columns: <code className="bg-muted px-1 rounded">name</code>, <code className="bg-muted px-1 rounded">email</code>. Optional: <code className="bg-muted px-1 rounded">password</code>, <code className="bg-muted px-1 rounded">role</code></p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleBulkFileChange}
                    className="hidden"
                  />
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-2">
                    <Upload className="h-4 w-4" /> Choose CSV File
                  </Button>
                  {bulkFileName && <p className="text-xs text-muted-foreground">{bulkFileName}</p>}
                </div>
                {bulkParseError && (
                  <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-lg p-3">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {bulkParseError}
                  </div>
                )}
                {bulkPreview.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">{bulkPreview.length} members ready to import</p>
                    <div className="max-h-48 overflow-y-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Name</TableHead>
                            <TableHead className="text-xs">Email</TableHead>
                            <TableHead className="text-xs">Role</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bulkPreview.slice(0, 50).map((m, i) => (
                            <TableRow key={i}>
                              <TableCell className="text-xs py-1.5">{m.name}</TableCell>
                              <TableCell className="text-xs py-1.5">{m.email}</TableCell>
                              <TableCell className="text-xs py-1.5">
                                <Badge variant={m.role === "org_admin" || m.role === "org_super_admin" ? "default" : "secondary"} className="text-xs">{m.role === "org_super_admin" ? "Org Super Admin" : m.role === "org_admin" ? "Admin" : "Member"}</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                          {bulkPreview.length > 50 && (
                            <TableRow><TableCell colSpan={3} className="text-xs text-center text-muted-foreground py-2">...and {bulkPreview.length - 50} more</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    <p className="text-xs text-muted-foreground">Default password: <code className="bg-muted px-1 rounded">Teachific@123</code> (if not specified in CSV)</p>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-950/30 rounded-lg p-3">
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Import Complete</p>
                    <p className="text-xs">{bulkResult.created} created · {bulkResult.updated} updated · {bulkResult.failed} failed out of {bulkResult.total} total</p>
                  </div>
                </div>
                {bulkResult.errors.length > 0 && (
                  <div className="max-h-32 overflow-y-auto rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-1">
                    {bulkResult.errors.map((e, i) => (
                      <p key={i} className="text-xs text-destructive">{e}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkImportOpen(false)}>Close</Button>
            {!bulkResult && bulkPreview.length > 0 && (
              <Button
                onClick={() => orgId && bulkImport.mutate({ orgId, members: bulkPreview })}
                disabled={bulkImport.isPending}
                className="gap-2"
              >
                {bulkImport.isPending ? "Importing..." : <><Upload className="h-4 w-4" /> Import {bulkPreview.length} Members</>}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
