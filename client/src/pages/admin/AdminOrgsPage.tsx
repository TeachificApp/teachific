import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Building2, Plus, Users, MoreVertical, Pencil, Trash2, Search, Globe, UserPlus, X, Merge } from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function AdminOrgsPage() {
  const [, setLocation] = useLocation();
  const { data: orgs, refetch } = trpc.orgs.list.useQuery();

  const createOrg = trpc.orgs.create.useMutation({
    onSuccess: () => { toast.success("Organization created"); refetch(); setCreateOpen(false); setName(""); setSlug(""); }
  });
  const updateOrg = trpc.orgs.update.useMutation({
    onSuccess: () => { toast.success("Organization updated"); refetch(); setEditOpen(false); }
  });
  const deleteOrg = trpc.orgs.delete.useMutation({
    onSuccess: () => { toast.success("Organization deleted"); refetch(); setDeleteTarget(null); }
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [editTarget, setEditTarget] = useState<{ id: number; name: string; slug: string; description?: string | null; adminNotes?: string | null } | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [search, setSearch] = useState("");

  // Members panel state
  const [membersOrgId, setMembersOrgId] = useState<number | null>(null);
  const [membersOrgName, setMembersOrgName] = useState("");
  const [addUserId, setAddUserId] = useState("");
  const [addRole, setAddRole] = useState<"org_admin" | "user">("user");

  const { data: members, refetch: refetchMembers } = trpc.orgs.members.list.useQuery(
    { orgId: membersOrgId! },
    { enabled: !!membersOrgId }
  );
  const { data: allUsers } = trpc.users.list.useQuery(undefined, { enabled: !!membersOrgId });

  const addMember = trpc.orgs.members.add.useMutation({
    onSuccess: () => { toast.success("Member added"); refetchMembers(); setAddUserId(""); }
  });
  const removeMember = trpc.orgs.members.remove.useMutation({
    onSuccess: () => { toast.success("Member removed"); refetchMembers(); }
  });

  const filtered = useMemo(() => {
    if (!search) return orgs ?? [];
    const q = search.toLowerCase();
    return (orgs ?? []).filter(o => o.name.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q));
  }, [orgs, search]);

  const openEdit = (org: typeof editTarget) => {
    setEditTarget(org);
    setEditOpen(true);
  };

  const openMembers = (orgId: number, orgName: string) => {
    setMembersOrgId(orgId);
    setMembersOrgName(orgName);
  };

  // Users not yet in this org
  const nonMembers = useMemo(() => {
    if (!allUsers || !members) return allUsers ?? [];
    const memberIds = new Set(members.map(m => m.userId));
    return allUsers.filter(u => !memberIds.has(u.id));
  }, [allUsers, members]);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Organizations</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{orgs?.length ?? 0} organizations</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 self-start sm:self-auto">
              <Plus className="h-4 w-4" /> New Organization
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Organization</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""));
                  }}
                  placeholder="Acme Corp"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Subdomain</Label>
                <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="acme-corp" />
                <p className="text-xs text-muted-foreground">Used in URLs — lowercase letters, numbers, and hyphens only.</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button
                onClick={() => createOrg.mutate({ name, slug })}
                disabled={!name || !slug || createOrg.isPending}
              >
                {createOrg.isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search organizations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Org Cards */}
      <div className="grid gap-3">
        {filtered.length === 0 ? (
          <Card className="shadow-sm border-border/60">
            <CardContent className="py-12 text-center">
              <Building2 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">{search ? "No organizations match your search." : "No organizations yet"}</p>
            </CardContent>
          </Card>
        ) : (
          filtered.map((org) => (
            <Card key={org.id} className="shadow-sm border-border/60">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                    <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{org.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Globe className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <p className="text-xs text-muted-foreground truncate">/{org.slug}</p>
                        </div>
                        {org.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{org.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs h-8"
                          onClick={() => openMembers(org.id, org.name)}
                        >
                          <Users className="h-3.5 w-3.5" /> Manage Members
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit({ id: org.id, name: org.name, slug: org.slug, description: org.description, adminNotes: (org as any).adminNotes })}>
                              <Pencil className="h-4 w-4 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setLocation(`/admin/orgs/merge?source=${org.id}`)}>
                              <Merge className="h-4 w-4 mr-2" /> Merge into another org
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteTarget({ id: org.id, name: org.name })}
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        {(org as any).memberCount ?? 0} members
                      </div>
                      <Badge variant="outline" className="text-xs">
                        ID #{org.id}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Organization</DialogTitle></DialogHeader>
          {editTarget && (
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  value={editTarget.name}
                  onChange={(e) => setEditTarget({ ...editTarget, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Subdomain</Label>
                <Input
                  value={editTarget.slug}
                  onChange={(e) => setEditTarget({ ...editTarget, slug: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Input
                  value={editTarget.description ?? ""}
                  onChange={(e) => setEditTarget({ ...editTarget, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  Private Admin Notes
                  <span className="text-xs text-muted-foreground font-normal">(only visible to platform admins)</span>
                </Label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                  value={editTarget.adminNotes ?? ""}
                  onChange={(e) => setEditTarget({ ...editTarget, adminNotes: e.target.value })}
                  placeholder="Internal notes about this organization (billing, support history, special agreements)..."
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button
              disabled={!editTarget?.name || !editTarget?.slug || updateOrg.isPending}
              onClick={() => {
                if (!editTarget) return;
                updateOrg.mutate({ id: editTarget.id, name: editTarget.name, slug: editTarget.slug, description: editTarget.description ?? undefined });
              }}
            >
              {updateOrg.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Organization</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This will remove all members from the organization. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteOrg.mutate({ id: deleteTarget.id })}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Manage Members Sheet */}
      <Sheet open={!!membersOrgId} onOpenChange={(o) => !o && setMembersOrgId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-[520px] overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle>Members — {membersOrgName}</SheetTitle>
          </SheetHeader>

          {/* Add Member */}
          <div className="border rounded-lg p-4 mb-5 space-y-3 bg-muted/30">
            <p className="text-sm font-medium flex items-center gap-2"><UserPlus className="h-4 w-4" /> Add Member</p>
            <div className="space-y-2">
              <Label className="text-xs">User</Label>
              <Select value={addUserId} onValueChange={setAddUserId}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select user..." />
                </SelectTrigger>
                <SelectContent>
                  {(nonMembers ?? []).map(u => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.name || u.email} {u.email && u.name ? `(${u.email})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Role</Label>
              <Select value={addRole} onValueChange={(v) => setAddRole(v as "org_admin" | "user")}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Member</SelectItem>
                  <SelectItem value="org_admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              disabled={!addUserId || addMember.isPending}
              onClick={() => {
                if (!membersOrgId || !addUserId) return;
                addMember.mutate({ orgId: membersOrgId, userId: Number(addUserId), role: addRole });
              }}
            >
              {addMember.isPending ? "Adding..." : "Add Member"}
            </Button>
          </div>

          {/* Members List */}
          <div className="space-y-2">
            {!members ? (
              <p className="text-sm text-muted-foreground text-center py-6">Loading...</p>
            ) : members.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No members yet.</p>
            ) : (
              members.map((m) => (
                <div key={m.userId} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary flex-shrink-0">
                    {(m.user?.name || m.user?.email || "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.user?.name || m.user?.email || `User #${m.userId}`}</p>
                    {m.user?.email && m.user?.name && (
                      <p className="text-xs text-muted-foreground truncate">{m.user.email}</p>
                    )}
                  </div>
                  <Badge variant={m.role === "org_admin" ? "default" : "secondary"} className="text-xs flex-shrink-0">
                    {m.role === "org_admin" ? "Admin" : "Member"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0"
                    onClick={() => membersOrgId && removeMember.mutate({ orgId: membersOrgId, userId: m.userId })}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
