import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Building2,
  ChevronDown,
  GraduationCap,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  Globe,
  FileText,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────
type TeamCourse = {
  id: number;
  courseId: number | null;
  seats: number | null;
  courseTitle: string | null;
  courseSlug: string | null;
};

type SeatRecord = {
  id: number;
  groupId: number;
  email: string;
  memberName: string | null;
  status: string;
  assignedAt: Date | null;
  enrollmentId: number | null;
  acceptedAt: Date | null;
  userId: number | null;
};

type Team = {
  id: number;
  name: string;
  orgName: string | null;
  adminEmail: string | null;
  adminPhone: string | null;
  website: string | null;
  notes: string | null;
  teamAdminId: number | null;
  seats: number;
  courseId: number | null;
  courses: TeamCourse[];
  totalSeats: number;
  activeSeats: number;
  pendingSeats: number;
  seatList: SeatRecord[];
  teamAdmin: { id: number; name: string | null; email: string } | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function statusBadge(status: string) {
  if (status === "active") return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-xs">{status}</Badge>;
  if (status === "pending") return <Badge variant="outline" className="text-amber-600 border-amber-400/50 text-xs">{status}</Badge>;
  return <Badge variant="secondary" className="text-xs">{status}</Badge>;
}

// ─── Create / Edit Team Dialog ────────────────────────────────────────────────
function TeamFormDialog({
  open,
  onOpenChange,
  team,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  team?: Team;
  onSuccess: () => void;
}) {
  const isEdit = !!team;
  const [name, setName] = useState(team?.name ?? "");
  const [orgName, setOrgName] = useState(team?.orgName ?? "");
  const [adminEmail, setAdminEmail] = useState(team?.adminEmail ?? "");
  const [adminPhone, setAdminPhone] = useState(team?.adminPhone ?? "");
  const [website, setWebsite] = useState(team?.website ?? "");
  const [notes, setNotes] = useState(team?.notes ?? "");

  const createMut = trpc.teams.createTeam.useMutation({
    onSuccess: () => { toast.success("Team created"); onSuccess(); onOpenChange(false); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.teams.updateTeam.useMutation({
    onSuccess: () => { toast.success("Team updated"); onSuccess(); onOpenChange(false); },
    onError: (e) => toast.error(e.message),
  });

  function handleSubmit() {
    if (!name.trim()) { toast.error("Team name is required"); return; }
    if (isEdit && team) {
      updateMut.mutate({ id: team.id, name, orgName: orgName || null, adminEmail: adminEmail || null, adminPhone: adminPhone || null, website: website || null, notes: notes || null });
    } else {
      createMut.mutate({ name, orgName: orgName || undefined, adminEmail: adminEmail || undefined, adminPhone: adminPhone || undefined, website: website || undefined, notes: notes || undefined });
    }
  }

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Team" : "Create New Team"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update team details and contact information." : "Create a team to manage group enrollments and seat assignments."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Team Name <span className="text-destructive">*</span></Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Acme Corp Team" />
          </div>
          <div className="space-y-1.5">
            <Label>Organization Name</Label>
            <Input value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="Parent organization (optional)" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Admin Email</Label>
              <Input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} placeholder="admin@company.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Admin Phone</Label>
              <Input value={adminPhone} onChange={e => setAdminPhone(e.target.value)} placeholder="+1 555 000 0000" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Website</Label>
            <Input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://company.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Internal notes about this team..." rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? (isEdit ? "Saving..." : "Creating...") : (isEdit ? "Save Changes" : "Create Team")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Team Detail Panel ────────────────────────────────────────────────────────
function TeamDetailDialog({
  team,
  open,
  onOpenChange,
  onRefresh,
}: {
  team: Team;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onRefresh: () => void;
}) {
  const utils = trpc.useUtils();
  const [assignEmail, setAssignEmail] = useState("");
  const [addCourseId, setAddCourseId] = useState("");

  const { data: allCourses } = trpc.lms.courses.list.useQuery({ orgId: 0 });

  const assignSeatMut = trpc.teams.assignSeat.useMutation({
    onSuccess: () => { toast.success("Seat assigned"); setAssignEmail(""); onRefresh(); utils.teams.listTeams.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const revokeSeatMut = trpc.teams.revokeSeat.useMutation({
    onSuccess: () => { toast.success("Seat revoked"); onRefresh(); utils.teams.listTeams.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const addCourseMut = trpc.teams.addCourseToTeam.useMutation({
    onSuccess: () => { toast.success("Course added"); setAddCourseId(""); onRefresh(); utils.teams.listTeams.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const removeCourseMut = trpc.teams.removeCourseFromTeam.useMutation({
    onSuccess: () => { toast.success("Course removed"); onRefresh(); utils.teams.listTeams.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const availableCourses = (allCourses ?? []).filter(
    (c: any) => !team.courses.some(tc => tc.courseId === c.id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {team.name}
          </DialogTitle>
          {team.orgName && <DialogDescription>{team.orgName}</DialogDescription>}
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-6 pr-2">
            {/* Meta info */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border bg-muted/30 p-3 text-center">
                <div className="text-2xl font-bold text-foreground">{team.totalSeats}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Total Seats</div>
              </div>
              <div className="rounded-lg border bg-emerald-500/5 p-3 text-center">
                <div className="text-2xl font-bold text-emerald-600">{team.activeSeats}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Active</div>
              </div>
              <div className="rounded-lg border bg-amber-500/5 p-3 text-center">
                <div className="text-2xl font-bold text-amber-600">{team.pendingSeats}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Pending</div>
              </div>
            </div>

            {/* Contact info */}
            {(team.adminEmail || team.adminPhone || team.website) && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Contact</h4>
                <div className="space-y-1.5 text-sm">
                  {team.adminEmail && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" />{team.adminEmail}
                    </div>
                  )}
                  {team.adminPhone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />{team.adminPhone}
                    </div>
                  )}
                  {team.website && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Globe className="h-3.5 w-3.5" />
                      <a href={team.website} target="_blank" rel="noopener noreferrer" className="hover:underline">{team.website}</a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Courses */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <BookOpen className="h-4 w-4" />Course Allocations
              </h4>
              {team.courses.length === 0 ? (
                <p className="text-sm text-muted-foreground">No courses assigned to this team yet.</p>
              ) : (
                <div className="space-y-2">
                  {team.courses.map(tc => (
                    <div key={tc.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <GraduationCap className="h-4 w-4 text-primary" />
                        <span>{tc.courseTitle ?? `Course #${tc.courseId}`}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">{tc.seats ?? 0} seats</Badge>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => removeCourseMut.mutate({ groupCourseId: tc.id })}
                          disabled={removeCourseMut.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* Add course */}
              <div className="flex gap-2">
                <select
                  className="flex-1 h-9 rounded-md border bg-background px-3 text-sm"
                  value={addCourseId}
                  onChange={e => setAddCourseId(e.target.value)}
                >
                  <option value="">Select a course to add...</option>
                  {availableCourses.map((c: any) => (
                    <option key={c.id} value={String(c.id)}>{c.title}</option>
                  ))}
                </select>
                <Button
                  size="sm"
                  onClick={() => {
                    if (!addCourseId) return;
                    addCourseMut.mutate({ groupId: team.id, courseId: parseInt(addCourseId), seats: 0 });
                  }}
                  disabled={!addCourseId || addCourseMut.isPending}
                >
                  <Plus className="h-4 w-4 mr-1" />Add
                </Button>
              </div>
            </div>

            <Separator />

            {/* Seat assignment */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <UserPlus className="h-4 w-4" />Assign Seat
              </h4>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="learner@example.com"
                  value={assignEmail}
                  onChange={e => setAssignEmail(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && assignEmail) assignSeatMut.mutate({ groupId: team.id, email: assignEmail }); }}
                  className="flex-1"
                />
                <Button
                  size="sm"
                  onClick={() => { if (assignEmail) assignSeatMut.mutate({ groupId: team.id, email: assignEmail }); }}
                  disabled={!assignEmail || assignSeatMut.isPending}
                >
                  {assignSeatMut.isPending ? "Assigning..." : "Assign"}
                </Button>
              </div>
            </div>

            {/* Seat list */}
            {team.seatList.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Seat Roster ({team.seatList.length})</h4>
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Assigned</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {team.seatList.map(seat => (
                        <TableRow key={seat.id}>
                          <TableCell className="text-sm">{seat.email}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{seat.memberName ?? "—"}</TableCell>
                          <TableCell>{statusBadge(seat.status)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {seat.assignedAt ? new Date(seat.assignedAt).toLocaleDateString() : "—"}
                          </TableCell>
                          <TableCell>
                            {seat.status !== "revoked" && (
                              <Button
                                variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => revokeSeatMut.mutate({ seatId: seat.id })}
                                disabled={revokeSeatMut.isPending}
                              >
                                <UserMinus className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Notes */}
            {team.notes && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2"><FileText className="h-4 w-4" />Notes</h4>
                <p className="text-sm text-muted-foreground rounded-md bg-muted/40 p-3">{team.notes}</p>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TeamsPage() {
  const utils = trpc.useUtils();
  const { data: teams, isLoading } = trpc.teams.listTeams.useQuery();

  const [createOpen, setCreateOpen] = useState(false);
  const [editTeam, setEditTeam] = useState<Team | null>(null);
  const [detailTeam, setDetailTeam] = useState<Team | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const deleteMut = trpc.teams.deleteTeam.useMutation({
    onSuccess: () => { toast.success("Team deleted"); utils.teams.listTeams.invalidate(); setDeleteId(null); },
    onError: (e) => toast.error(e.message),
  });

  function refresh() { utils.teams.listTeams.invalidate(); }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Teams</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage group enrollments and seat assignments for organizations.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />New Team
        </Button>
      </div>

      {/* Stats bar */}
      {teams && teams.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2"><Users className="h-5 w-5 text-primary" /></div>
              <div>
                <div className="text-2xl font-bold">{teams.length}</div>
                <div className="text-xs text-muted-foreground">Total Teams</div>
              </div>
            </div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-500/10 p-2"><UserCheck className="h-5 w-5 text-emerald-600" /></div>
              <div>
                <div className="text-2xl font-bold">{teams.reduce((a, t) => a + t.activeSeats, 0)}</div>
                <div className="text-xs text-muted-foreground">Active Seats</div>
              </div>
            </div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-500/10 p-2"><Mail className="h-5 w-5 text-amber-600" /></div>
              <div>
                <div className="text-2xl font-bold">{teams.reduce((a, t) => a + t.pendingSeats, 0)}</div>
                <div className="text-xs text-muted-foreground">Pending Invites</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Teams list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">Loading teams...</div>
      ) : !teams || teams.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="rounded-full bg-muted p-6 mb-4">
            <Users className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-1">No teams yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">
            Create your first team to manage group enrollments. Teams allow you to assign course seats to organizations or companies.
          </p>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />Create First Team
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Team</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Courses</TableHead>
                <TableHead>Seats</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(teams as Team[]).map(team => (
                <TableRow
                  key={team.id}
                  className="cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setDetailTeam(team)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-primary/10 p-2 flex-shrink-0">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">{team.name}</div>
                        {team.teamAdmin && (
                          <div className="text-xs text-muted-foreground">Admin: {team.teamAdmin.name ?? team.teamAdmin.email}</div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {team.orgName ? (
                      <div className="flex items-center gap-1.5 text-sm">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        {team.orgName}
                      </div>
                    ) : <span className="text-muted-foreground text-sm">—</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {team.courses.length === 0 ? (
                        <span className="text-muted-foreground text-sm">—</span>
                      ) : team.courses.slice(0, 2).map(tc => (
                        <Badge key={tc.id} variant="secondary" className="text-xs">
                          {tc.courseTitle ?? `Course #${tc.courseId}`}
                        </Badge>
                      ))}
                      {team.courses.length > 2 && (
                        <Badge variant="outline" className="text-xs">+{team.courses.length - 2} more</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-emerald-600">{team.activeSeats}</span>
                      <span className="text-muted-foreground">active</span>
                      {team.pendingSeats > 0 && (
                        <>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-amber-600">{team.pendingSeats}</span>
                          <span className="text-muted-foreground">pending</span>
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {team.adminEmail ? (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3" />{team.adminEmail}
                      </div>
                    ) : <span className="text-muted-foreground text-sm">—</span>}
                  </TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setDetailTeam(team)}>
                          <Users className="h-4 w-4 mr-2" />Manage Seats
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setEditTeam(team); }}>
                          Edit Details
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteId(team.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />Delete Team
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create dialog */}
      <TeamFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={refresh}
      />

      {/* Edit dialog */}
      {editTeam && (
        <TeamFormDialog
          open={!!editTeam}
          onOpenChange={(v) => { if (!v) setEditTeam(null); }}
          team={editTeam}
          onSuccess={refresh}
        />
      )}

      {/* Detail dialog */}
      {detailTeam && (
        <TeamDetailDialog
          team={detailTeam}
          open={!!detailTeam}
          onOpenChange={(v) => { if (!v) setDetailTeam(null); }}
          onRefresh={refresh}
        />
      )}

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Team?</DialogTitle>
            <DialogDescription>
              This will permanently delete the team and all seat assignments. Enrolled learners will keep their enrollments. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => { if (deleteId) deleteMut.mutate({ groupId: deleteId }); }}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending ? "Deleting..." : "Delete Team"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
