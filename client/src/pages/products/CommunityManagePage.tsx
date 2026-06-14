import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useOrgScope } from "@/hooks/useOrgScope";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  ArrowLeft, Settings, Layers, Users, Shield, Mail, ExternalLink,
  Plus, Trash2, Edit2, GripVertical, X, Check, Ban, ImageIcon,
  Clock, UserCheck, UserX, ChevronUp, ChevronDown
} from "lucide-react";

export default function CommunityManagePage() {
  const { hubId: hubIdStr } = useParams<{ hubId: string }>();
  const hubId = parseInt(hubIdStr ?? "0", 10);
  const [, navigate] = useLocation();
  const { orgId, ready } = useOrgScope();
  const utils = trpc.useUtils();

  // Hub data
  const { data: hub, isLoading: hubLoading } = trpc.community.getHubById.useQuery(
    { hubId },
    { enabled: !!hubId }
  );

  // Spaces (Channels)
  const { data: spaces = [] } = trpc.community.listSpacesByHubId.useQuery(
    { hubId },
    { enabled: !!hubId }
  );

  // Members
  const { data: members = [] } = trpc.community.listAllMembersByHub.useQuery(
    { hubId },
    { enabled: !!hubId }
  );

  // Pending Members
  const { data: pendingMembers = [] } = trpc.community.listPendingMembers.useQuery(
    { hubId },
    { enabled: !!hubId }
  );

  // Admin Profiles
  const { data: adminProfiles = [] } = trpc.community.listAdminProfiles.useQuery(
    { hubId },
    { enabled: !!hubId }
  );

  // Invites
  const { data: invites = [] } = trpc.community.listInvitesByHub.useQuery(
    { hubId },
    { enabled: !!hubId }
  );

  // Moderation
  const { data: modQueue = [] } = trpc.community.getModerationQueue.useQuery(
    { orgId: orgId! },
    { enabled: !!orgId }
  );

  // Mutations
  const updateHub = trpc.community.updateHubById.useMutation({
    onSuccess: () => {
      utils.community.getHubById.invalidate({ hubId });
      toast.success("Hub settings saved");
    },
    onError: (e) => toast.error(e.message),
  });

  const createSpace = trpc.community.createSpaceForHub.useMutation({
    onSuccess: () => {
      utils.community.listSpacesByHubId.invalidate({ hubId });
      toast.success("Channel created");
      setSpaceDialog(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateSpace = trpc.community.updateSpace.useMutation({
    onSuccess: () => {
      utils.community.listSpacesByHubId.invalidate({ hubId });
      toast.success("Channel updated");
      setSpaceDialog(false);
      setEditingSpace(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteSpace = trpc.community.deleteSpace.useMutation({
    onSuccess: () => {
      utils.community.listSpacesByHubId.invalidate({ hubId });
      toast.success("Channel archived");
    },
    onError: (e) => toast.error(e.message),
  });

  const reorderSpaces = trpc.community.reorderSpaces.useMutation({
    onSuccess: () => {
      utils.community.listSpacesByHubId.invalidate({ hubId });
      toast.success("Order saved");
    },
    onError: (e) => toast.error(e.message),
  });

  const banMember = trpc.community.banMember.useMutation({
    onSuccess: () => {
      utils.community.listAllMembersByHub.invalidate({ hubId });
      toast.success("Member banned");
    },
    onError: (e) => toast.error(e.message),
  });

  const approveMember = trpc.community.approveMember.useMutation({
    onSuccess: () => {
      utils.community.listPendingMembers.invalidate({ hubId });
      utils.community.listAllMembersByHub.invalidate({ hubId });
      toast.success("Member updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const createAdminProfile = trpc.community.createAdminProfile.useMutation({
    onSuccess: () => {
      utils.community.listAdminProfiles.invalidate({ hubId });
      toast.success("Admin profile created");
      setProfileDialog(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateAdminProfile = trpc.community.updateAdminProfile.useMutation({
    onSuccess: () => {
      utils.community.listAdminProfiles.invalidate({ hubId });
      toast.success("Admin profile updated");
      setProfileDialog(false);
      setEditingProfile(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteAdminProfile = trpc.community.deleteAdminProfile.useMutation({
    onSuccess: () => {
      utils.community.listAdminProfiles.invalidate({ hubId });
      toast.success("Admin profile deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const deletePost = trpc.community.deletePost.useMutation({
    onSuccess: () => {
      utils.community.getModerationQueue.invalidate({ orgId: orgId! });
      toast.success("Post removed");
    },
    onError: (e) => toast.error(e.message),
  });

  const restorePost = trpc.community.updatePost.useMutation({
    onSuccess: () => {
      utils.community.getModerationQueue.invalidate({ orgId: orgId! });
      toast.success("Post restored");
    },
    onError: (e) => toast.error(e.message),
  });

  const createInvite = trpc.community.createInvite.useMutation({
    onSuccess: () => {
      utils.community.listInvitesByHub.invalidate({ hubId });
      toast.success("Invite sent");
      setInviteEmail("");
      setInviteSpaceId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const revokeInvite = trpc.community.revokeInvite.useMutation({
    onSuccess: () => {
      utils.community.listInvitesByHub.invalidate({ hubId });
      toast.success("Invite revoked");
    },
    onError: (e) => toast.error(e.message),
  });

  // Hub settings form state
  const [hubName, setHubName] = useState("");
  const [hubTagline, setHubTagline] = useState("");
  const [hubDescription, setHubDescription] = useState("");
  const [hubEnabled, setHubEnabled] = useState(true);
  const [hubSettingsInit, setHubSettingsInit] = useState(false);

  if (hub && !hubSettingsInit) {
    setHubName(hub.name ?? "");
    setHubTagline(hub.tagline ?? "");
    setHubDescription(hub.description ?? "");
    setHubEnabled(hub.isEnabled ?? true);
    setHubSettingsInit(true);
  }

  // Space/Channel dialog state
  const [spaceDialog, setSpaceDialog] = useState(false);
  const [editingSpace, setEditingSpace] = useState<any>(null);
  const [spaceName, setSpaceName] = useState("");
  const [spaceDescription, setSpaceDescription] = useState("");
  const [spaceEmoji, setSpaceEmoji] = useState("💬");
  const [spaceAccessType, setSpaceAccessType] = useState<"open" | "invite_only" | "course_enrollment" | "purchase">("open");
  const [spaceCoverImageUrl, setSpaceCoverImageUrl] = useState("");
  const [spaceCoverUploading, setSpaceCoverUploading] = useState(false);

  // Admin Profile dialog state
  const [profileDialog, setProfileDialog] = useState(false);
  const [editingProfile, setEditingProfile] = useState<any>(null);
  const [profileName, setProfileName] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState("");

  // Invite state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSpaceId, setInviteSpaceId] = useState<number | null>(null);

  // Sort order state
  const [sortOrderList, setSortOrderList] = useState<any[]>([]);
  const [sortInitialized, setSortInitialized] = useState(false);
  if (spaces.length > 0 && !sortInitialized) {
    setSortOrderList([...spaces]);
    setSortInitialized(true);
  }

  const openNewSpace = () => {
    setEditingSpace(null);
    setSpaceName("");
    setSpaceDescription("");
    setSpaceEmoji("💬");
    setSpaceAccessType("open");
    setSpaceCoverImageUrl("");
    setSpaceDialog(true);
  };

  const openEditSpace = (space: any) => {
    setEditingSpace(space);
    setSpaceName(space.name ?? "");
    setSpaceDescription(space.description ?? "");
    setSpaceEmoji(space.emoji ?? "💬");
    setSpaceAccessType(space.accessType ?? "open");
    setSpaceCoverImageUrl(space.coverImageUrl ?? "");
    setSpaceDialog(true);
  };

  const openNewProfile = () => {
    setEditingProfile(null);
    setProfileName("");
    setProfileBio("");
    setProfileAvatarUrl("");
    setProfileDialog(true);
  };

  const openEditProfile = (profile: any) => {
    setEditingProfile(profile);
    setProfileName(profile.name ?? "");
    setProfileBio(profile.bio ?? "");
    setProfileAvatarUrl(profile.avatarUrl ?? "");
    setProfileDialog(true);
  };

  const handleSpaceCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5 MB"); return; }
    setSpaceCoverUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "community-covers");
      const res = await fetch("/api/media/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (json.url) setSpaceCoverImageUrl(json.url);
      else toast.error("Upload failed");
    } catch { toast.error("Upload failed"); }
    finally { setSpaceCoverUploading(false); }
  };

  const handleSaveSpace = () => {
    if (!spaceName.trim()) return toast.error("Channel name is required");
    if (editingSpace) {
      updateSpace.mutate({
        spaceId: editingSpace.id,
        name: spaceName,
        description: spaceDescription,
        emoji: spaceEmoji,
        accessType: spaceAccessType,
        coverImageUrl: spaceCoverImageUrl || undefined,
      });
    } else {
      createSpace.mutate({
        hubId,
        orgId: orgId!,
        name: spaceName,
        description: spaceDescription,
        emoji: spaceEmoji,
        accessType: spaceAccessType,
        coverImageUrl: spaceCoverImageUrl || undefined,
      });
    }
  };

  const handleSaveProfile = () => {
    if (!profileName.trim()) return toast.error("Profile name is required");
    if (editingProfile) {
      updateAdminProfile.mutate({
        id: editingProfile.id,
        name: profileName,
        bio: profileBio || undefined,
        avatarUrl: profileAvatarUrl || undefined,
      });
    } else {
      createAdminProfile.mutate({
        hubId,
        name: profileName,
        bio: profileBio || undefined,
        avatarUrl: profileAvatarUrl || undefined,
      });
    }
  };

  const moveSpaceUp = (index: number) => {
    if (index === 0) return;
    const newList = [...sortOrderList];
    [newList[index - 1], newList[index]] = [newList[index], newList[index - 1]];
    setSortOrderList(newList);
  };

  const moveSpaceDown = (index: number) => {
    if (index >= sortOrderList.length - 1) return;
    const newList = [...sortOrderList];
    [newList[index], newList[index + 1]] = [newList[index + 1], newList[index]];
    setSortOrderList(newList);
  };

  const saveSortOrder = () => {
    reorderSpaces.mutate({ spaceIds: sortOrderList.map((s) => s.id) });
  };

  if (hubLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!hub) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Community hub not found.
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/products/community")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{hub.name}</h1>
            {hub.tagline && <p className="text-sm text-muted-foreground">{hub.tagline}</p>}
          </div>
          <Badge variant={hub.isEnabled ? "default" : "secondary"}>
            {hub.isEnabled ? "Active" : "Disabled"}
          </Badge>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate(`/community/${hubId}`)}
          className="gap-2"
        >
          <ExternalLink className="h-4 w-4" />
          Enter Community
        </Button>
      </div>

      <Tabs defaultValue="settings">
        <TabsList className="flex w-full overflow-x-auto">
          <TabsTrigger value="settings" className="gap-1.5">
            <Settings className="h-3.5 w-3.5" /> Settings
          </TabsTrigger>
          <TabsTrigger value="channels" className="gap-1.5">
            <Layers className="h-3.5 w-3.5" /> Channels
          </TabsTrigger>
          <TabsTrigger value="sort-order" className="gap-1.5">
            <GripVertical className="h-3.5 w-3.5" /> Sort Order
          </TabsTrigger>
          <TabsTrigger value="members" className="gap-1.5">
            <Users className="h-3.5 w-3.5" /> Members
          </TabsTrigger>
          <TabsTrigger value="pending" className="gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Pending
            {pendingMembers.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 min-w-5 text-xs px-1">
                {pendingMembers.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="admin-profiles" className="gap-1.5">
            <UserCheck className="h-3.5 w-3.5" /> Admin Profiles
          </TabsTrigger>
          <TabsTrigger value="moderation" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" /> Moderation
          </TabsTrigger>
        </TabsList>

        {/* ── Hub Settings ── */}
        <TabsContent value="settings" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Hub Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Community Name</Label>
                  <Input value={hubName} onChange={(e) => setHubName(e.target.value)} placeholder="My Community" />
                </div>
                <div className="space-y-2">
                  <Label>Tagline</Label>
                  <Input value={hubTagline} onChange={(e) => setHubTagline(e.target.value)} placeholder="Short description" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={hubDescription}
                  onChange={(e) => setHubDescription(e.target.value)}
                  placeholder="Tell members what this community is about..."
                  rows={3}
                />
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={hubEnabled}
                  onCheckedChange={setHubEnabled}
                  id="hub-enabled"
                />
                <Label htmlFor="hub-enabled">Community is active and visible to members</Label>
              </div>
              <Button
                onClick={() =>
                  updateHub.mutate({
                    hubId,
                    name: hubName,
                    tagline: hubTagline,
                    description: hubDescription,
                    isEnabled: hubEnabled,
                  })
                }
                disabled={updateHub.isPending}
              >
                {updateHub.isPending ? "Saving…" : "Save Settings"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Channels (formerly Spaces) ── */}
        <TabsContent value="channels" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Channels</h3>
              <p className="text-sm text-muted-foreground">Organize your community into topic-based channels</p>
            </div>
            <Button onClick={openNewSpace} className="gap-2">
              <Plus className="h-4 w-4" /> New Channel
            </Button>
          </div>

          {spaces.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Layers className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No channels yet</p>
                <p className="text-sm">Create your first channel to organize community discussions</p>
                <Button className="mt-4" onClick={openNewSpace}>Create Channel</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {spaces.map((space) => (
                <Card key={space.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="py-3 px-4 flex items-center gap-3">
                    <span className="text-xl">{space.emoji}</span>
                    {(space as any).coverImageUrl && (
                      <img src={(space as any).coverImageUrl} alt="" className="h-8 w-12 object-cover rounded" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{space.name}</p>
                      {space.description && (
                        <p className="text-xs text-muted-foreground truncate">{space.description}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs capitalize">
                      {space.accessType?.replace("_", " ")}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditSpace(space)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm("Archive this channel?")) deleteSpace.mutate({ spaceId: space.id });
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Sort Order ── */}
        <TabsContent value="sort-order" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Channel Sort Order</h3>
              <p className="text-sm text-muted-foreground">Drag channels to reorder how they appear to members</p>
            </div>
            <Button
              onClick={saveSortOrder}
              disabled={reorderSpaces.isPending}
            >
              {reorderSpaces.isPending ? "Saving…" : "Save Order"}
            </Button>
          </div>

          {sortOrderList.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <GripVertical className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No channels to reorder</p>
                <p className="text-sm">Create channels first, then come back to arrange them</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-1">
              {sortOrderList.map((space, index) => (
                <Card key={space.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="py-2.5 px-4 flex items-center gap-3">
                    <div className="flex flex-col gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => moveSpaceUp(index)}
                        disabled={index === 0}
                      >
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => moveSpaceDown(index)}
                        disabled={index >= sortOrderList.length - 1}
                      >
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </div>
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <span className="text-lg">{space.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{space.name}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">#{index + 1}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Members ── */}
        <TabsContent value="members" className="space-y-4 mt-4">
          <div>
            <h3 className="font-semibold">Members</h3>
            <p className="text-sm text-muted-foreground">{members.length} total members across all channels</p>
          </div>

          {members.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No members yet</p>
                <p className="text-sm">Members will appear here once they join your community channels</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <Card key={member.id}>
                  <CardContent className="py-3 px-4 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                      {member.userId.toString().slice(-2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">User #{member.userId}</p>
                      <p className="text-xs text-muted-foreground">
                        Joined {new Date(member.joinedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant={member.role === "moderator" ? "default" : "secondary"} className="text-xs">
                      {member.role}
                    </Badge>
                    {!member.isBanned && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive gap-1"
                        onClick={() => {
                          if (confirm("Ban this member?"))
                            banMember.mutate({ spaceId: member.spaceId, userId: member.userId });
                        }}
                      >
                        <Ban className="h-3.5 w-3.5" /> Ban
                      </Button>
                    )}
                    {member.isBanned && (
                      <Badge variant="destructive" className="text-xs">Banned</Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Pending ── */}
        <TabsContent value="pending" className="space-y-4 mt-4">
          <div>
            <h3 className="font-semibold">Pending Approvals</h3>
            <p className="text-sm text-muted-foreground">
              {pendingMembers.length} member{pendingMembers.length !== 1 ? "s" : ""} awaiting approval
            </p>
          </div>

          {pendingMembers.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Clock className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No pending requests</p>
                <p className="text-sm">All membership requests have been processed</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {pendingMembers.map((member: any) => (
                <Card key={member.id} className="border-amber-200 bg-amber-50/30">
                  <CardContent className="py-3 px-4 flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      {member.userAvatar && <AvatarImage src={member.userAvatar} />}
                      <AvatarFallback className="text-xs">
                        {(member.userName ?? "U").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{member.userName ?? "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">{member.userEmail}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Requested {new Date(member.joinedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 text-green-700 border-green-300 hover:bg-green-50"
                        onClick={() => approveMember.mutate({ memberId: member.id, action: "approve" })}
                        disabled={approveMember.isPending}
                      >
                        <UserCheck className="h-3.5 w-3.5" /> Approve
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/5"
                        onClick={() => approveMember.mutate({ memberId: member.id, action: "reject" })}
                        disabled={approveMember.isPending}
                      >
                        <UserX className="h-3.5 w-3.5" /> Reject
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Admin Profiles ── */}
        <TabsContent value="admin-profiles" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Admin Profiles</h3>
              <p className="text-sm text-muted-foreground">Manage admin and moderator profiles that appear in the community</p>
            </div>
            <Button onClick={openNewProfile} className="gap-2">
              <Plus className="h-4 w-4" /> New Profile
            </Button>
          </div>

          {adminProfiles.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <UserCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No admin profiles yet</p>
                <p className="text-sm">Create admin profiles to identify moderators and admins in the community</p>
                <Button className="mt-4" onClick={openNewProfile}>Create Profile</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {adminProfiles.map((profile: any) => (
                <Card key={profile.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="py-3 px-4 flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      {profile.avatarUrl && <AvatarImage src={profile.avatarUrl} />}
                      <AvatarFallback className="text-sm font-medium">
                        {profile.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{profile.name}</p>
                      {profile.bio && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{profile.bio}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditProfile(profile)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm("Delete this admin profile?"))
                            deleteAdminProfile.mutate({ id: profile.id });
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Moderation ── */}
        <TabsContent value="moderation" className="space-y-4 mt-4">
          <div>
            <h3 className="font-semibold">Moderation Queue</h3>
            <p className="text-sm text-muted-foreground">
              {modQueue.length} post{modQueue.length !== 1 ? "s" : ""} pending review
            </p>
          </div>

          {modQueue.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Shield className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Queue is clear</p>
                <p className="text-sm">No posts are currently flagged for review</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {modQueue.map((post) => (
                <Card key={post.id} className="border-orange-200 bg-orange-50/30">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {(post as any).title && <p className="font-medium text-sm">{(post as any).title}</p>}
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{post.content}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Posted {new Date(post.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1 text-green-700 border-green-300 hover:bg-green-50"
                          onClick={() => restorePost.mutate({ postId: post.id, isHidden: false })}
                        >
                          <Check className="h-3.5 w-3.5" /> Restore
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/5"
                          onClick={() => {
                            if (confirm("Permanently delete this post?"))
                              deletePost.mutate({ postId: post.id });
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Channel Dialog */}
      <Dialog open={spaceDialog} onOpenChange={setSpaceDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSpace ? "Edit Channel" : "Create Channel"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label>Emoji</Label>
                <Input
                  value={spaceEmoji}
                  onChange={(e) => setSpaceEmoji(e.target.value)}
                  className="text-center text-xl"
                  maxLength={2}
                />
              </div>
              <div className="col-span-3 space-y-1.5">
                <Label>Channel Name</Label>
                <Input
                  value={spaceName}
                  onChange={(e) => setSpaceName(e.target.value)}
                  placeholder="e.g. General Discussion"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={spaceDescription}
                onChange={(e) => setSpaceDescription(e.target.value)}
                placeholder="What is this channel for?"
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cover Image</Label>
              <div className="flex items-center gap-3">
                {spaceCoverImageUrl ? (
                  <div className="relative">
                    <img src={spaceCoverImageUrl} alt="Cover" className="h-16 w-24 object-cover rounded-lg border" />
                    <button
                      type="button"
                      className="absolute -top-1.5 -right-1.5 bg-destructive text-white rounded-full h-4 w-4 flex items-center justify-center text-xs leading-none"
                      onClick={() => setSpaceCoverImageUrl("")}
                    >&times;</button>
                  </div>
                ) : (
                  <div className="h-16 w-24 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground">
                    <ImageIcon className="h-5 w-5" />
                  </div>
                )}
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={handleSpaceCoverUpload} />
                  <Button type="button" variant="outline" size="sm" disabled={spaceCoverUploading} asChild>
                    <span>{spaceCoverUploading ? "Uploading..." : "Upload Image"}</span>
                  </Button>
                </label>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Access Type</Label>
              <Select value={spaceAccessType} onValueChange={(v: any) => setSpaceAccessType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open — anyone can join</SelectItem>
                  <SelectItem value="invite_only">Invite Only</SelectItem>
                  <SelectItem value="course_enrollment">Course Enrollment required</SelectItem>
                  <SelectItem value="purchase">Purchase required</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSpaceDialog(false)}>Cancel</Button>
            <Button
              onClick={handleSaveSpace}
              disabled={createSpace.isPending || updateSpace.isPending}
            >
              {editingSpace ? "Save Changes" : "Create Channel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin Profile Dialog */}
      <Dialog open={profileDialog} onOpenChange={setProfileDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingProfile ? "Edit Admin Profile" : "Create Admin Profile"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Display Name</Label>
              <Input
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="e.g. Community Manager"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Bio</Label>
              <Textarea
                value={profileBio}
                onChange={(e) => setProfileBio(e.target.value)}
                placeholder="Short description of this admin role..."
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Avatar URL</Label>
              <Input
                value={profileAvatarUrl}
                onChange={(e) => setProfileAvatarUrl(e.target.value)}
                placeholder="https://..."
              />
              {profileAvatarUrl && (
                <Avatar className="h-12 w-12 mt-2">
                  <AvatarImage src={profileAvatarUrl} />
                  <AvatarFallback>{profileName.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProfileDialog(false)}>Cancel</Button>
            <Button
              onClick={handleSaveProfile}
              disabled={createAdminProfile.isPending || updateAdminProfile.isPending}
            >
              {editingProfile ? "Save Changes" : "Create Profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
