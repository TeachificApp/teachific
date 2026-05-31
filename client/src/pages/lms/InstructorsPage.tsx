import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Search,
  Settings2,
  BookOpen,
  BarChart3,
  UserPlus,
  Loader2,
  Eye,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { getSubdomain } from "@/hooks/useSubdomain";

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    pending_review: { label: "Pending", variant: "outline" },
    approved: { label: "Approved", variant: "default" },
    rejected: { label: "Rejected", variant: "destructive" },
    pending: { label: "Pending", variant: "outline" },
  };
  const cfg = map[status] ?? { label: status, variant: "secondary" };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

// ─── Analytics permissions editor ────────────────────────────────────────────
function AnalyticsPermissionsDialog({
  orgId,
  instructor,
  onClose,
}: {
  orgId: number;
  instructor: any;
  onClose: () => void;
}) {
  const [perms, setPerms] = useState({
    canSeeRevenue: instructor.analyticsPerms?.canSeeRevenue ?? false,
    canSeeStudentNames: instructor.analyticsPerms?.canSeeStudentNames ?? false,
    canSeeEnrollmentCount: instructor.analyticsPerms?.canSeeEnrollmentCount ?? true,
    canSeeCompletionRate: instructor.analyticsPerms?.canSeeCompletionRate ?? true,
    canSeeQuizScores: instructor.analyticsPerms?.canSeeQuizScores ?? true,
    canSeeLessonProgress: instructor.analyticsPerms?.canSeeLessonProgress ?? false,
    canSeeRevenueBreakdown: instructor.analyticsPerms?.canSeeRevenueBreakdown ?? false,
    canSeeStudentEmails: instructor.analyticsPerms?.canSeeStudentEmails ?? false,
  });
  const [saving, setSaving] = useState(false);
  const updatePerms = trpc.instructorDashboard.adminUpdateAnalyticsPermissions.useMutation();
  const utils = trpc.useUtils();

  const handleSave = async () => {
    setSaving(true);
    try {
      await updatePerms.mutateAsync({ orgId, instructorId: instructor.id, ...perms });
      toast.success("Analytics permissions updated");
      utils.instructorDashboard.adminListInstructors.invalidate();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const permLabels: Record<string, string> = {
    canSeeRevenue: "View revenue totals",
    canSeeStudentNames: "View student names",
    canSeeEnrollmentCount: "View enrollment counts",
    canSeeCompletionRate: "View completion rates",
    canSeeQuizScores: "View quiz scores",
    canSeeLessonProgress: "View lesson-level progress",
    canSeeRevenueBreakdown: "View revenue breakdown",
    canSeeStudentEmails: "View student email addresses",
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Analytics Permissions</DialogTitle>
          <DialogDescription>
            Control what data <strong>{instructor.displayName || "this instructor"}</strong> can see in their portal.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {Object.entries(perms).map(([key, val]) => (
            <div key={key} className="flex items-center justify-between">
              <Label className="text-sm font-normal">{permLabels[key] ?? key}</Label>
              <Switch
                checked={val}
                onCheckedChange={(v) => setPerms((p) => ({ ...p, [key]: v }))}
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Course assignment dialog ─────────────────────────────────────────────────
function CourseAssignmentDialog({
  orgId,
  instructor,
  onClose,
}: {
  orgId: number;
  instructor: any;
  onClose: () => void;
}) {
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [role, setRole] = useState<"primary" | "secondary">("primary");
  const [canSelfPublish, setCanSelfPublish] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [saving, setSaving] = useState(false);
  const utils = trpc.useUtils();

  const { data: allCourses } = trpc.instructorDashboard.adminListCourses.useQuery({ orgId });
  const { data: assignedCourses, refetch } = trpc.instructorDashboard.adminGetInstructorCourses.useQuery({
    orgId,
    instructorId: instructor.id,
  });

  const assignCourse = trpc.instructorDashboard.adminAssignCourse.useMutation();
  const unassignCourse = trpc.instructorDashboard.adminUnassignCourse.useMutation();
  const setCoursePerm = trpc.instructorDashboard.adminSetCoursePermission.useMutation();

  const handleAssign = async () => {
    if (!selectedCourseId) return;
    setSaving(true);
    try {
      await assignCourse.mutateAsync({
        orgId,
        instructorId: instructor.id,
        courseId: parseInt(selectedCourseId),
        role,
      });
      await setCoursePerm.mutateAsync({
        orgId,
        instructorId: instructor.id,
        courseId: parseInt(selectedCourseId),
        canSelfPublish,
        requiresLessonApproval: requiresApproval,
      });
      toast.success("Course assigned successfully");
      refetch();
      setSelectedCourseId("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUnassign = async (courseId: number) => {
    try {
      await unassignCourse.mutateAsync({ orgId, instructorId: instructor.id, courseId });
      toast.success("Course unassigned");
      refetch();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const assignedIds = new Set((assignedCourses ?? []).map((c: any) => c.id));
  const availableCourses = (allCourses ?? []).filter((c: any) => !assignedIds.has(c.id));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Course Assignments</DialogTitle>
          <DialogDescription>
            Manage course assignments for <strong>{instructor.displayName || "this instructor"}</strong>.
          </DialogDescription>
        </DialogHeader>

        {/* Currently assigned */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assigned Courses</Label>
          {(assignedCourses ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No courses assigned yet.</p>
          ) : (
            <div className="space-y-1">
              {(assignedCourses ?? []).map((c: any) => (
                <div key={c.id} className="flex items-center justify-between bg-muted/40 rounded px-3 py-2 text-sm">
                  <span>{c.title}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{c.assignmentRole}</Badge>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-destructive hover:text-destructive"
                      onClick={() => handleUnassign(c.id)}>Remove</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add new assignment */}
        <div className="border-t pt-4 space-y-3">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add Course</Label>
          <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a course..." />
            </SelectTrigger>
            <SelectContent>
              {availableCourses.map((c: any) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedCourseId && (
            <div className="space-y-3 bg-muted/30 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as any)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primary">Primary</SelectItem>
                    <SelectItem value="secondary">Secondary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Can self-publish</Label>
                  <p className="text-xs text-muted-foreground">Instructor can publish lessons without approval</p>
                </div>
                <Switch checked={canSelfPublish} onCheckedChange={setCanSelfPublish} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Requires lesson approval</Label>
                  <p className="text-xs text-muted-foreground">Admin must approve before lessons go live</p>
                </div>
                <Switch checked={requiresApproval} onCheckedChange={setRequiresApproval} />
              </div>
              <Button onClick={handleAssign} disabled={saving} className="w-full">
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Assign Course
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add instructor dialog ────────────────────────────────────────────────────
function AddInstructorDialog({ orgId, onClose }: { orgId: number; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [commission, setCommission] = useState("20");
  const [saving, setSaving] = useState(false);
  const utils = trpc.useUtils();

  const { data: searchResults } = trpc.instructorDashboard.adminSearchUsers.useQuery(
    { orgId, query },
    { enabled: query.length >= 2 }
  );
  const addInstructor = trpc.instructorDashboard.adminAddInstructor.useMutation();

  const handleAdd = async (userId: number, name: string) => {
    setSaving(true);
    try {
      const result = await addInstructor.mutateAsync({
        orgId,
        userId,
        commissionPercentage: parseFloat(commission) || 20,
      });
      if (result.alreadyExists) {
        toast.success(`${name} is already an instructor`);
      } else {
        toast.success(`${name} added as instructor`);
      }
      utils.instructorDashboard.adminListInstructors.invalidate();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Instructor</DialogTitle>
          <DialogDescription>Search for a user to add as an instructor in this organization.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Search users</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Name or email..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Default commission %</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={commission}
              onChange={(e) => setCommission(e.target.value)}
              placeholder="20"
            />
          </div>
          {(searchResults ?? []).length > 0 && (
            <div className="border rounded-lg divide-y">
              {(searchResults ?? []).map((u: any) => (
                <div key={u.id} className="flex items-center justify-between px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{u.name}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  <Button size="sm" onClick={() => handleAdd(u.id, u.name)} disabled={saving}>
                    Add
                  </Button>
                </div>
              ))}
            </div>
          )}
          {query.length >= 2 && (searchResults ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">No users found</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function InstructorsPage() {
  const { user } = useAuth();
  const subdomain = getSubdomain() ?? undefined;
  const { data: orgCtx } = trpc.orgs.myContext.useQuery(
    { subdomain },
    { enabled: !!user }
  );
  const orgId = orgCtx?.orgId;

  const [activeTab, setActiveTab] = useState("instructors");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [analyticsTarget, setAnalyticsTarget] = useState<any>(null);
  const [coursesTarget, setCoursesTarget] = useState<any>(null);
  const [submissionFilter, setSubmissionFilter] = useState<"pending_review" | "approved" | "rejected">("pending_review");
  const [publishFilter, setPublishFilter] = useState<"pending" | "approved" | "rejected">("pending");
  const [reviewingSubmission, setReviewingSubmission] = useState<any>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewingPublish, setReviewingPublish] = useState<any>(null);

  const { data: instructors, isLoading: loadingInstructors, refetch: refetchInstructors } =
    trpc.instructorDashboard.adminListInstructors.useQuery(
      { orgId: orgId! },
      { enabled: !!orgId }
    );

  const { data: pendingLessons, refetch: refetchLessons } =
    trpc.instructorDashboard.adminListPendingLessons.useQuery(
      { orgId: orgId!, status: submissionFilter },
      { enabled: !!orgId }
    );

  const { data: publishRequests, refetch: refetchPublish } =
    trpc.instructorDashboard.adminListPublishRequests.useQuery(
      { orgId: orgId!, status: publishFilter },
      { enabled: !!orgId }
    );

  const reviewLesson = trpc.instructorDashboard.adminReviewLesson.useMutation();
  const reviewPublish = trpc.instructorDashboard.adminReviewPublishRequest.useMutation();
  const toggleStatus = trpc.instructorDashboard.adminToggleInstructorStatus.useMutation();
  const setApproval = trpc.instructorDashboard.adminSetInstructorApproval.useMutation();

  const handleReviewLesson = async (decision: "approved" | "rejected") => {
    if (!reviewingSubmission || !orgId) return;
    try {
      await reviewLesson.mutateAsync({
        orgId,
        submissionId: reviewingSubmission.id,
        decision,
        reviewNote: reviewNote || undefined,
      });
      toast.success(decision === "approved" ? "Lesson approved and published" : "Lesson rejected");
      setReviewingSubmission(null);
      setReviewNote("");
      refetchLessons();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleReviewPublish = async (decision: "approved" | "rejected") => {
    if (!reviewingPublish || !orgId) return;
    try {
      await reviewPublish.mutateAsync({
        orgId,
        requestId: reviewingPublish.id,
        decision,
        reviewNote: reviewNote || undefined,
      });
      toast.success(decision === "approved" ? "Course publish approved" : "Publish request rejected");
      setReviewingPublish(null);
      setReviewNote("");
      refetchPublish();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (!orgId) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const pendingCount = (pendingLessons ?? []).filter((l: any) => l.status === "pending_review").length;
  const pendingPublishCount = (publishRequests ?? []).filter((r: any) => r.status === "pending").length;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Instructor Management</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage instructors, course assignments, approval workflows, and analytics permissions.
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <UserPlus className="w-4 h-4 mr-2" />
          Add Instructor
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="instructors">
            <BookOpen className="w-4 h-4 mr-1.5" />
            Instructors
          </TabsTrigger>
          <TabsTrigger value="lesson-review">
            Lesson Review
            {pendingCount > 0 && (
              <Badge className="ml-1.5 h-5 px-1.5 text-xs">{pendingCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="publish-requests">
            Publish Requests
            {pendingPublishCount > 0 && (
              <Badge className="ml-1.5 h-5 px-1.5 text-xs">{pendingPublishCount}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Instructors tab ── */}
        <TabsContent value="instructors" className="mt-4">
          {loadingInstructors ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (instructors ?? []).length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
                <BookOpen className="w-12 h-12 text-muted-foreground/40" />
                <div className="text-center">
                  <p className="font-medium">No instructors yet</p>
                  <p className="text-sm text-muted-foreground">Add users as instructors to assign them courses.</p>
                </div>
                <Button onClick={() => setShowAddDialog(true)}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add First Instructor
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Instructor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Approval Required</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(instructors ?? []).map((inst: any) => (
                    <TableRow key={inst.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{inst.displayName || inst.userName || "Unnamed"}</p>
                          <p className="text-xs text-muted-foreground">{inst.userEmail}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={inst.isActive ? "default" : "secondary"}>
                          {inst.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={inst.requiresLessonApproval ?? true}
                          onCheckedChange={async (v) => {
                            try {
                              await setApproval.mutateAsync({
                                orgId,
                                instructorId: inst.id,
                                requiresLessonApproval: v,
                              });
                              toast.success("Approval setting updated");
                              refetchInstructors();
                            } catch (e: any) {
                              toast.error(e.message);
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{inst.commissionPercentage ?? 20}%</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setCoursesTarget(inst)}
                          >
                            <BookOpen className="w-3.5 h-3.5 mr-1" />
                            Courses
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setAnalyticsTarget(inst)}
                          >
                            <BarChart3 className="w-3.5 h-3.5 mr-1" />
                            Analytics
                          </Button>
                          <Button
                            size="sm"
                            variant={inst.isActive ? "ghost" : "outline"}
                            onClick={async () => {
                              try {
                                await toggleStatus.mutateAsync({
                                  orgId,
                                  instructorId: inst.id,
                                  isActive: !inst.isActive,
                                });
                                toast.success(inst.isActive ? "Instructor deactivated" : "Instructor reactivated");
                                refetchInstructors();
                              } catch (e: any) {
                                toast.error(e.message);
                              }
                            }}
                          >
                            {inst.isActive ? "Deactivate" : "Reactivate"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ── Lesson Review tab ── */}
        <TabsContent value="lesson-review" className="mt-4 space-y-4">
          <div className="flex items-center gap-2">
            <Select value={submissionFilter} onValueChange={(v) => setSubmissionFilter(v as any)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending_review">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(pendingLessons ?? []).length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
                <CheckCircle2 className="w-10 h-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No {submissionFilter.replace("_", " ")} submissions</p>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lesson</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Instructor</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(pendingLessons ?? []).map((sub: any) => (
                    <TableRow key={sub.id}>
                      <TableCell className="font-medium">{sub.lessonTitle ?? "Untitled"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{sub.courseTitle ?? "—"}</TableCell>
                      <TableCell className="text-sm">{sub.instructorName ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell><StatusBadge status={sub.status} /></TableCell>
                      <TableCell className="text-right">
                        {sub.status === "pending_review" && (
                          <Button
                            size="sm"
                            onClick={() => { setReviewingSubmission(sub); setReviewNote(""); }}
                          >
                            Review
                          </Button>
                        )}
                        {sub.reviewNote && (
                          <span className="text-xs text-muted-foreground ml-2">{sub.reviewNote}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ── Publish Requests tab ── */}
        <TabsContent value="publish-requests" className="mt-4 space-y-4">
          <div className="flex items-center gap-2">
            <Select value={publishFilter} onValueChange={(v) => setPublishFilter(v as any)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(publishRequests ?? []).length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
                <CheckCircle2 className="w-10 h-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No {publishFilter} publish requests</p>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course</TableHead>
                    <TableHead>Instructor</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(publishRequests ?? []).map((req: any) => (
                    <TableRow key={req.id}>
                      <TableCell className="font-medium">{req.courseTitle ?? "Untitled"}</TableCell>
                      <TableCell className="text-sm">{req.instructorName ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {req.requestedAt ? new Date(req.requestedAt).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{req.note ?? "—"}</TableCell>
                      <TableCell><StatusBadge status={req.status} /></TableCell>
                      <TableCell className="text-right">
                        {req.status === "pending" && (
                          <Button
                            size="sm"
                            onClick={() => { setReviewingPublish(req); setReviewNote(""); }}
                          >
                            Review
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Dialogs ── */}
      {showAddDialog && (
        <AddInstructorDialog orgId={orgId} onClose={() => setShowAddDialog(false)} />
      )}
      {analyticsTarget && (
        <AnalyticsPermissionsDialog
          orgId={orgId}
          instructor={analyticsTarget}
          onClose={() => setAnalyticsTarget(null)}
        />
      )}
      {coursesTarget && (
        <CourseAssignmentDialog
          orgId={orgId}
          instructor={coursesTarget}
          onClose={() => setCoursesTarget(null)}
        />
      )}

      {/* Lesson review dialog */}
      {reviewingSubmission && (
        <Dialog open onOpenChange={() => setReviewingSubmission(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Review Lesson Submission</DialogTitle>
              <DialogDescription>
                <strong>{reviewingSubmission.lessonTitle}</strong> — submitted by {reviewingSubmission.instructorName}
              </DialogDescription>
            </DialogHeader>
            {reviewingSubmission.note && (
              <div className="bg-muted/40 rounded p-3 text-sm">
                <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1">Instructor Note</p>
                <p>{reviewingSubmission.note}</p>
              </div>
            )}
            <div className="space-y-1">
              <Label>Review note (optional)</Label>
              <Input
                placeholder="Feedback for the instructor..."
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
              />
            </div>
            <DialogFooter className="gap-2">
              <Button variant="destructive" onClick={() => handleReviewLesson("rejected")}>
                <XCircle className="w-4 h-4 mr-1" />
                Reject
              </Button>
              <Button onClick={() => handleReviewLesson("approved")}>
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Approve & Publish
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Publish request review dialog */}
      {reviewingPublish && (
        <Dialog open onOpenChange={() => setReviewingPublish(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Review Publish Request</DialogTitle>
              <DialogDescription>
                <strong>{reviewingPublish.courseTitle}</strong> — requested by {reviewingPublish.instructorName}
              </DialogDescription>
            </DialogHeader>
            {reviewingPublish.note && (
              <div className="bg-muted/40 rounded p-3 text-sm">
                <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1">Instructor Note</p>
                <p>{reviewingPublish.note}</p>
              </div>
            )}
            <div className="space-y-1">
              <Label>Review note (optional)</Label>
              <Input
                placeholder="Feedback for the instructor..."
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
              />
            </div>
            <DialogFooter className="gap-2">
              <Button variant="destructive" onClick={() => handleReviewPublish("rejected")}>
                <XCircle className="w-4 h-4 mr-1" />
                Reject
              </Button>
              <Button onClick={() => handleReviewPublish("approved")}>
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Approve & Publish Course
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
