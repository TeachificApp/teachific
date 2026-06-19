import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useOrgScope } from "@/hooks/useOrgScope";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Users, Plus, MoreVertical, Edit, Trash2, UserPlus, GraduationCap,
  Mail, Phone, Briefcase, Package, Send, ChevronDown, ChevronUp,
  UserCheck, AlertCircle, Link, Upload, Copy, Check, Download
} from "lucide-react";

export default function GroupsPage() {
  const [, setLocation] = useLocation();
  const { orgId, ready } = useOrgScope();
  const utils = trpc.useUtils();
  const { data: groups, isLoading } = trpc.lms.groups.list.useQuery(
    { orgId: orgId! }, { enabled: ready && !!orgId }
  );
  const { data: courses } = trpc.lms.courses.list.useQuery(
    { orgId: orgId! }, { enabled: ready && !!orgId }
  );

  const createMut = trpc.lms.groups.create.useMutation({
    onSuccess: () => { utils.lms.groups.list.invalidate(); toast.success("Group created"); setCreateOpen(false); resetForm(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.lms.groups.update.useMutation({
    onSuccess: () => { utils.lms.groups.list.invalidate(); toast.success("Group updated"); setEditOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.lms.groups.delete.useMutation({
    onSuccess: () => { utils.lms.groups.list.invalidate(); toast.success("Group deleted"); },
    onError: (e) => toast.error(e.message),
  });
  const addMemberMut = trpc.lms.groups.addMember.useMutation({
    onSuccess: () => { utils.lms.groups.list.invalidate(); toast.success("Member added"); setAddMemberOpen(false); setMemberEmail(""); setMemberName(""); },
    onError: (e) => toast.error(e.message),
  });
  const removeMemberMut = trpc.lms.groups.removeMember.useMutation({
    onSuccess: () => { utils.lms.groups.list.invalidate(); toast.success("Member removed"); },
    onError: (e) => toast.error(e.message),
  });
  const bulkEnrollMut = trpc.lms.groups.bulkEnroll.useMutation({
    onSuccess: (res) => {
      toast.success(`Enrolled ${res.enrolled} member${res.enrolled !== 1 ? "s" : ""}${res.skipped > 0 ? ` (${res.skipped} already enrolled)` : ""}`);
      setBulkEnrollOpen(false); setBulkCourseId(""); setBulkEnrollGroupId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [bulkEnrollOpen, setBulkEnrollOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [csvImportGroupId, setCsvImportGroupId] = useState<number | null>(null);
  const [csvText, setCsvText] = useState("");
  const [csvResults, setCsvResults] = useState<any | null>(null);
  const [inviteLinkOpen, setInviteLinkOpen] = useState(false);
  const [inviteLinkGroupId, setInviteLinkGroupId] = useState<number | null>(null);
  const [inviteLink, setInviteLink] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [addMemberGroupId, setAddMemberGroupId] = useState<number | null>(null);
  const [bulkEnrollGroupId, setBulkEnrollGroupId] = useState<number | null>(null);
  const [viewMembersGroup, setViewMembersGroup] = useState<any | null>(null);
  const [bulkCourseId, setBulkCourseId] = useState("");

  const [name, setName] = useState("");
  const [managerName, setManagerName] = useState("");
  const [managerTitle, setManagerTitle] = useState("");
  const [managerEmail, setManagerEmail] = useState("");
  const [managerPhone, setManagerPhone] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [seats, setSeats] = useState("10");
  const [notes, setNotes] = useState("");
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(false);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberName, setMemberName] = useState("");
  const [showProductPicker, setShowProductPicker] = useState(false);

  const resetForm = () => {
    setName(""); setManagerName(""); setManagerTitle(""); setManagerEmail("");
    setManagerPhone(""); setSelectedProductIds([]); setSeats("10"); setNotes("");
    setSendWelcomeEmail(false); setShowProductPicker(false);
  };

  const handleCreate = () => {
    if (!name.trim()) { toast.error("Group name is required"); return; }
    if (sendWelcomeEmail && !managerEmail.trim()) { toast.error("Manager email required to send welcome email"); return; }
    createMut.mutate({
      orgId: orgId!, name,
      managerName: managerName || undefined,
      managerTitle: managerTitle || undefined,
      managerEmail: managerEmail || undefined,
      managerPhone: managerPhone || undefined,
      productIds: selectedProductIds.length > 0 ? selectedProductIds : undefined,
      seats: parseInt(seats) || 10,
      notes: notes || undefined,
      sendWelcomeEmail,
    });
  };

  const openEdit = (g: any) => {
    setEditId(g.id); setName(g.name); setManagerName(g.managerName ?? "");
    setManagerTitle(g.managerTitle ?? ""); setManagerEmail(g.managerEmail ?? "");
    setManagerPhone(g.managerPhone ?? "");
    let pids: number[] = [];
    try { if (g.productIds) pids = JSON.parse(g.productIds); } catch {}
    setSelectedProductIds(pids);
    setSeats(String(g.seats)); setNotes(g.notes ?? ""); setSendWelcomeEmail(false);
    setShowProductPicker(false); setEditOpen(true);
  };

  const handleUpdate = () => {
    if (!editId || !name.trim()) return;
    if (sendWelcomeEmail && !managerEmail.trim()) { toast.error("Manager email required to send welcome email"); return; }
    updateMut.mutate({
      id: editId, name,
      managerName: managerName || undefined,
      managerTitle: managerTitle || undefined,
      managerEmail: managerEmail || null,
      managerPhone: managerPhone || null,
      productIds: selectedProductIds.length > 0 ? selectedProductIds : null,
      seats: parseInt(seats) || 10,
      notes: notes || undefined,
      sendWelcomeEmail,
    });
  };

  const toggleProduct = (id: number) =>
    setSelectedProductIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const csvImportMut = trpc.lms.groups.bulkImportCSV.useMutation({
    onSuccess: (res) => {
      setCsvResults(res);
      utils.lms.groups.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const generateInviteMut = trpc.lms.groups.generateInviteLink.useMutation({
    onSuccess: (res) => {
      const link = `${window.location.origin}/join-group?token=${res.token}`;
      setInviteLink(link);
    },
    onError: (e) => toast.error(e.message),
  });

  const openCsvImport = (groupId: number) => {
    setCsvImportGroupId(groupId); setCsvText(""); setCsvResults(null); setCsvImportOpen(true);
  };
  const handleCsvImport = () => {
    if (!csvImportGroupId || !csvText.trim()) { toast.error("Paste CSV data first"); return; }
    csvImportMut.mutate({ groupId: csvImportGroupId, csvData: csvText });
  };
  const openInviteLink = (groupId: number) => {
    setInviteLinkGroupId(groupId); setInviteLink(""); setCopiedLink(false); setInviteLinkOpen(true);
    generateInviteMut.mutate({ groupId });
  };
  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink).then(() => { setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000); });
  };
  const downloadCsvTemplate = () => {
    const csv = "name,email\nJane Doe,jane@example.com\nJohn Smith,john@example.com";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "group_import_template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const totalSeats = groups?.reduce((s, g) => s + g.seats, 0) ?? 0;
  const usedSeats = groups?.reduce((s, g) => s + g.usedSeats, 0) ?? 0;

  const FormFields = () => (
    <div className="space-y-5 py-2 pr-2">
      <div className="space-y-2">
        <Label>Group Name <span className="text-destructive">*</span></Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Q1 Cohort - Acme Corp" />
      </div>
      <div className="space-y-2">
        <Label>Number of Seats</Label>
        <Input type="number" min="1" value={seats} onChange={e => setSeats(e.target.value)} />
      </div>
      <Separator />
      <div>
        <p className="text-sm font-semibold mb-3 flex items-center gap-1.5">
          <UserCheck className="h-4 w-4 text-primary" />Group Manager
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Full Name</Label>
            <Input value={managerName} onChange={e => setManagerName(e.target.value)} placeholder="Jane Smith" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1"><Briefcase className="h-3 w-3" />Title / Role</Label>
            <Input value={managerTitle} onChange={e => setManagerTitle(e.target.value)} placeholder="Training Manager" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1"><Mail className="h-3 w-3" />Email</Label>
            <Input type="email" value={managerEmail} onChange={e => setManagerEmail(e.target.value)} placeholder="jane@company.com" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1"><Phone className="h-3 w-3" />Phone</Label>
            <Input value={managerPhone} onChange={e => setManagerPhone(e.target.value)} placeholder="+1 555 000 0000" />
          </div>
        </div>
        <div className="flex items-center justify-between mt-3 p-3 rounded-lg bg-muted/50 border">
          <div>
            <p className="text-sm font-medium flex items-center gap-1.5"><Send className="h-3.5 w-3.5 text-primary" />Send Welcome Email</p>
            <p className="text-xs text-muted-foreground">Notify the manager of their assignment</p>
          </div>
          <Switch checked={sendWelcomeEmail} onCheckedChange={setSendWelcomeEmail} />
        </div>
        {sendWelcomeEmail && !managerEmail && (
          <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
            <AlertCircle className="h-3 w-3" />Manager email required to send welcome email
          </p>
        )}
      </div>
      <Separator />
      <div>
        <button type="button" className="flex items-center justify-between w-full text-sm font-semibold" onClick={() => setShowProductPicker(v => !v)}>
          <span className="flex items-center gap-1.5">
            <Package className="h-4 w-4 text-primary" />Assign Courses / Products
            {selectedProductIds.length > 0 && <Badge variant="secondary" className="text-xs">{selectedProductIds.length}</Badge>}
          </span>
          {showProductPicker ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {showProductPicker && (
          <div className="mt-2 border rounded-lg divide-y max-h-48 overflow-y-auto">
            {!(courses as any[])?.length ? (
              <p className="text-xs text-muted-foreground p-3">No courses available yet.</p>
            ) : (courses as any[]).map((c: any) => (
              <label key={c.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer">
                <Checkbox checked={selectedProductIds.includes(c.id)} onCheckedChange={() => toggleProduct(c.id)} />
                <span className="text-sm">{c.title}</span>
              </label>
            ))}
          </div>
        )}
      </div>
      <Separator />
      <div className="space-y-2">
        <Label>Internal Notes</Label>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes about this group..." rows={2} />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="h-6 w-6 text-primary" />Groups</h1>
          <p className="text-muted-foreground mt-0.5">Manage group seat registrations and bulk course enrollments</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setLocation("/members/group-manager")}>
            <UserCheck className="h-4 w-4" /> Group Manager Portal
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New Group
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Total Groups</p><p className="text-3xl font-bold">{groups?.length ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Total Seats</p><p className="text-3xl font-bold">{totalSeats}</p></CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">Seats Used</p>
          <p className="text-3xl font-bold">{usedSeats}</p>
          {totalSeats > 0 && <Progress value={(usedSeats / totalSeats) * 100} className="mt-2 h-1.5" />}
        </CardContent></Card>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : !(groups as any[])?.length ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-16 gap-3">
          <Users className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-muted-foreground">No groups yet. Create your first group to get started.</p>
          <Button onClick={() => { resetForm(); setCreateOpen(true); }}>Create Group</Button>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {(groups as any[]).map((g: any) => (
            <Card key={g.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-base">{g.name}</h3>
                      {g.welcomeEmailSent && (
                        <Badge variant="outline" className="text-xs gap-1 text-green-600 border-green-200">
                          <Mail className="h-3 w-3" />Welcome sent
                        </Badge>
                      )}
                    </div>
                    {(g.managerName || g.managerEmail) && (
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {g.managerName && (
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <UserCheck className="h-3.5 w-3.5" />{g.managerName}
                            {g.managerTitle && <span className="text-xs"> - {g.managerTitle}</span>}
                          </span>
                        )}
                        {g.managerEmail && (
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3.5 w-3.5" />{g.managerEmail}
                          </span>
                        )}
                        {g.managerPhone && (
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3.5 w-3.5" />{g.managerPhone}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-sm text-muted-foreground">{g.usedSeats}/{g.seats} seats used</span>
                      <Progress value={g.seats > 0 ? (g.usedSeats / g.seats) * 100 : 0} className="h-1.5 w-24" />
                      {g.usedSeats >= g.seats && <Badge variant="destructive" className="text-xs">Full</Badge>}
                    </div>
                    {(() => {
                      try {
                        if (!g.productIds) return null;
                        const ids: number[] = JSON.parse(g.productIds);
                        if (!ids.length) return null;
                        const names = ids.map((id: number) => (courses as any[])?.find((c: any) => c.id === id)?.title).filter(Boolean);
                        return names.length > 0 ? (
                          <div className="flex items-center gap-1 mt-1 flex-wrap">
                            <Package className="h-3.5 w-3.5 text-muted-foreground" />
                            {names.map((n: string, i: number) => <Badge key={i} variant="secondary" className="text-xs">{n}</Badge>)}
                          </div>
                        ) : null;
                      } catch { return null; }
                    })()}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"><MoreVertical className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(g)}><Edit className="h-4 w-4 mr-2" />Edit Group</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setViewMembersGroup(g); setMembersOpen(true); }}>
                        <Users className="h-4 w-4 mr-2" />View Members ({g.usedSeats})
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setAddMemberGroupId(g.id); setAddMemberOpen(true); }}>
                        <UserPlus className="h-4 w-4 mr-2" />Add Member
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setBulkEnrollGroupId(g.id); setBulkEnrollOpen(true); }}>
                        <GraduationCap className="h-4 w-4 mr-2" />Bulk Enroll
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openCsvImport(g.id)}>
                        <Upload className="h-4 w-4 mr-2" />Import CSV
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openInviteLink(g.id)}>
                        <Link className="h-4 w-4 mr-2" />Invite Link
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => setDeleteConfirmId(g.id)}>
                        <Trash2 className="h-4 w-4 mr-2" />Delete Group
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" />Create New Group</DialogTitle>
            <DialogDescription>Set up a group with seat allocations and assign a manager.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh] pr-1"><FormFields /></ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createMut.isPending}>{createMut.isPending ? "Creating..." : "Create Group"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Edit className="h-5 w-5 text-primary" />Edit Group</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh] pr-1"><FormFields /></ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={updateMut.isPending}>{updateMut.isPending ? "Saving..." : "Save Changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={membersOpen} onOpenChange={setMembersOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" />{viewMembersGroup?.name} - Members</DialogTitle>
            <DialogDescription>{viewMembersGroup?.usedSeats ?? 0} of {viewMembersGroup?.seats ?? 0} seats used</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-80">
            {!viewMembersGroup?.members?.length ? (
              <div className="flex flex-col items-center py-8 gap-2 text-muted-foreground">
                <Users className="h-8 w-8 opacity-30" /><p className="text-sm">No members yet</p>
              </div>
            ) : (
              <div className="divide-y">
                {viewMembersGroup.members.map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between py-2.5 px-1">
                    <div>
                      <p className="text-sm font-medium">{m.name || m.email}</p>
                      {m.name && <p className="text-xs text-muted-foreground">{m.email}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={m.status === "active" ? "default" : "secondary"} className="text-xs">{m.status}</Badge>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => removeMemberMut.mutate({ memberId: m.id })} disabled={removeMemberMut.isPending}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => { if (viewMembersGroup) { setAddMemberGroupId(viewMembersGroup.id); setMembersOpen(false); setAddMemberOpen(true); } }}>
              <UserPlus className="h-4 w-4 mr-2" />Add Member
            </Button>
            <Button onClick={() => setMembersOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Member to Group</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>Email <span className="text-destructive">*</span></Label><Input type="email" value={memberEmail} onChange={e => setMemberEmail(e.target.value)} placeholder="member@example.com" /></div>
            <div className="space-y-2"><Label>Name</Label><Input value={memberName} onChange={e => setMemberName(e.target.value)} placeholder="Optional" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMemberOpen(false)}>Cancel</Button>
            <Button onClick={() => { if (!memberEmail.trim() || !addMemberGroupId) return; addMemberMut.mutate({ groupId: addMemberGroupId, email: memberEmail, name: memberName || undefined }); }} disabled={addMemberMut.isPending}>
              {addMemberMut.isPending ? "Adding..." : "Add Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkEnrollOpen} onOpenChange={(open) => { setBulkEnrollOpen(open); if (!open) { setBulkCourseId(""); setBulkEnrollGroupId(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><GraduationCap className="h-5 w-5" />Bulk Enroll Group in Course</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">All active members will be enrolled. Already-enrolled members are skipped automatically.</p>
            <div className="space-y-2">
              <Label>Select Course <span className="text-destructive">*</span></Label>
              <Select value={bulkCourseId} onValueChange={setBulkCourseId}>
                <SelectTrigger><SelectValue placeholder="Choose a course..." /></SelectTrigger>
                <SelectContent>
                  {((courses as any[]) || []).map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkEnrollOpen(false)}>Cancel</Button>
            <Button onClick={() => { if (!bulkEnrollGroupId || !bulkCourseId) { toast.error("Please select a course"); return; } bulkEnrollMut.mutate({ groupId: bulkEnrollGroupId, courseId: parseInt(bulkCourseId) }); }} disabled={bulkEnrollMut.isPending || !bulkCourseId}>
              {bulkEnrollMut.isPending ? "Enrolling..." : "Enroll All Members"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import Dialog */}
      <Dialog open={csvImportOpen} onOpenChange={(open) => { setCsvImportOpen(open); if (!open) { setCsvResults(null); setCsvText(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Upload className="h-5 w-5 text-primary" />Bulk Import Members via CSV</DialogTitle>
            <DialogDescription>Paste CSV data with name and email columns. One member per row.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!csvResults ? (
              <>
                <div className="flex justify-between items-center">
                  <Label>CSV Data (name, email)</Label>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={downloadCsvTemplate}>
                    <Download className="h-3 w-3" />Download Template
                  </Button>
                </div>
                <Textarea
                  value={csvText}
                  onChange={e => setCsvText(e.target.value)}
                  placeholder={`name,email\nJane Doe,jane@example.com\nJohn Smith,john@example.com`}
                  rows={8}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">Tip: Copy directly from Excel or Google Sheets. The first row is treated as a header and skipped automatically.</p>
              </>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-center">
                    <p className="text-2xl font-bold text-green-700">{csvResults.added}</p>
                    <p className="text-xs text-green-600 mt-0.5">Added</p>
                  </div>
                  <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3 text-center">
                    <p className="text-2xl font-bold text-yellow-700">{csvResults.skipped}</p>
                    <p className="text-xs text-yellow-600 mt-0.5">Skipped (existing)</p>
                  </div>
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-center">
                    <p className="text-2xl font-bold text-red-700">{csvResults.errors?.length ?? 0}</p>
                    <p className="text-xs text-red-600 mt-0.5">Errors</p>
                  </div>
                </div>
                {csvResults.errors?.length > 0 && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                    <p className="text-xs font-semibold text-red-700 mb-1">Row errors:</p>
                    <ul className="text-xs text-red-600 space-y-0.5">
                      {csvResults.errors.map((e: string, i: number) => <li key={i}>• {e}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            {!csvResults ? (
              <>
                <Button variant="outline" onClick={() => setCsvImportOpen(false)}>Cancel</Button>
                <Button onClick={handleCsvImport} disabled={csvImportMut.isPending || !csvText.trim()}>
                  {csvImportMut.isPending ? "Importing..." : "Import Members"}
                </Button>
              </>
            ) : (
              <Button onClick={() => setCsvImportOpen(false)}>Done</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Link Dialog */}
      <Dialog open={inviteLinkOpen} onOpenChange={setInviteLinkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Link className="h-5 w-5 text-primary" />Group Invite Link</DialogTitle>
            <DialogDescription>Share this link with members so they can self-register and join the group.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {generateInviteMut.isPending ? (
              <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground">
                <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Generating link...</span>
              </div>
            ) : inviteLink ? (
              <>
                <div className="flex gap-2">
                  <Input value={inviteLink} readOnly className="font-mono text-xs flex-1" />
                  <Button variant="outline" size="icon" onClick={copyInviteLink} className="shrink-0">
                    {copiedLink ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">This link expires in 30 days. Generating a new link will invalidate the old one.</p>
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                  <p className="text-xs text-blue-700"><strong>How it works:</strong> When a user clicks this link, they will be prompted to log in or create an account, then automatically added to this group.</p>
                </div>
              </>
            ) : null}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => openInviteLink(inviteLinkGroupId!)} disabled={generateInviteMut.isPending}>
              Regenerate Link
            </Button>
            <Button onClick={() => setInviteLinkOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Group?</DialogTitle>
            <DialogDescription>This will permanently delete the group and all seat assignments. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { if (deleteConfirmId) { deleteMut.mutate({ id: deleteConfirmId }); setDeleteConfirmId(null); } }} disabled={deleteMut.isPending}>
              {deleteMut.isPending ? "Deleting..." : "Delete Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
