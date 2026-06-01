import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useOrgScope } from "@/hooks/useOrgScope";
import { useOrgPlan } from "@/hooks/useOrgPlan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
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
  Plus,
  Search,
  LayoutGrid,
  LayoutList,
  MoreVertical,
  Share2,
  Settings,
  ExternalLink,
  Trash2,
  Globe,
  Gem,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

export default function CommunityPage() {
  const [, navigate] = useLocation();
  const { orgId, ready } = useOrgScope();
  const { limits, plan } = useOrgPlan(orgId);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [newName, setNewName] = useState("");
  const [newTagline, setNewTagline] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const { data: hubs = [], refetch } = trpc.community.listHubs.useQuery(
    { orgId: orgId! },
    { enabled: ready }
  );

  const createHub = trpc.community.createHub.useMutation({
    onSuccess: () => {
      toast.success("Community created");
      setCreateOpen(false);
      setNewName("");
      setNewTagline("");
      setNewDesc("");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteHub = trpc.community.deleteHub.useMutation({
    onSuccess: () => {
      toast.success("Community deleted");
      setDeleteTarget(null);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const maxCommunities = limits.maxCommunities;
  const atLimit = maxCommunities !== null && hubs.length >= maxCommunities;
  const canCreate = maxCommunities === null || hubs.length < maxCommunities;

  const filtered = hubs.filter((h) =>
    !search || h.name.toLowerCase().includes(search.toLowerCase())
  );

  function handleShare(hub: (typeof hubs)[0]) {
    const url = `${window.location.origin}/community/${hub.slug}`;
    navigator.clipboard.writeText(url).then(() => toast.success("Link copied to clipboard"));
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Communities</h1>
        <Button
          onClick={() => {
            if (!canCreate) {
              toast.error(
                maxCommunities === 0
                  ? "Communities are not available on your current plan. Please upgrade."
                  : "You've reached the communities limit on your current plan. Upgrade to create more."
              );
              return;
            }
            setCreateOpen(true);
          }}
          className="bg-primary hover:bg-primary/90 text-white gap-2"
        >
          <Plus className="h-4 w-4" />
          New community
        </Button>
      </div>

      {/* Search + view toggle */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white border-gray-300 text-slate-900"
          />
        </div>
        <div className="ml-auto flex items-center gap-0 border border-gray-200 rounded-md overflow-hidden">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-2 ${viewMode === "grid" ? "bg-slate-800 text-white" : "bg-white text-slate-600 hover:bg-gray-50"}`}
            title="Grid view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-2 ${viewMode === "list" ? "bg-slate-800 text-white" : "bg-white text-slate-600 hover:bg-gray-50"}`}
            title="List view"
          >
            <LayoutList className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Community list */}
      {!ready ? (
        <div className="text-slate-500 text-sm py-8 text-center">Loading...</div>
      ) : filtered.length === 0 && hubs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Globe className="h-12 w-12 text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-1">No communities yet</h3>
          <p className="text-slate-500 text-sm mb-4">Create your first community to connect with your learners.</p>
          {canCreate && (
            <Button onClick={() => setCreateOpen(true)} className="bg-primary hover:bg-primary/90 text-white gap-2">
              <Plus className="h-4 w-4" /> Create community
            </Button>
          )}
        </div>
      ) : viewMode === "list" ? (
        <div className="flex flex-col gap-2">
          {filtered.map((hub) => (
            <div
              key={hub.id}
              className="flex items-center gap-4 bg-white border border-gray-200 rounded-lg p-3 hover:border-primary/30 transition-colors"
            >
              <div
                className="w-16 h-16 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex-shrink-0 overflow-hidden"
                style={hub.coverImageUrl ? { backgroundImage: `url(${hub.coverImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : {}}
              >
                {!hub.coverImageUrl && (
                  <div className="w-full h-full flex items-center justify-center">
                    <Globe className="h-7 w-7 text-white/80" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 truncate">{hub.name}</p>
                {hub.tagline && <p className="text-xs text-slate-500 truncate">{hub.tagline}</p>}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-gray-300 text-slate-700 hidden sm:flex"
                onClick={() => handleShare(hub)}
              >
                <Share2 className="h-3.5 w-3.5" />
                Share
              </Button>
              <Badge
                className={hub.isEnabled ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-600 border-gray-200"}
                variant="outline"
              >
                {hub.isEnabled ? "Published" : "Draft"}
              </Badge>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-white border-gray-200">
                  <DropdownMenuItem className="text-slate-700 cursor-pointer" onClick={() => navigate(`/products/community/${hub.id}/manage`)}>
                    <Settings className="h-4 w-4 mr-2" /> Manage
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-slate-700 cursor-pointer" onClick={() => navigate(`/community/${hub.slug}`)}>
                    <ExternalLink className="h-4 w-4 mr-2" /> View community
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-slate-700 cursor-pointer" onClick={() => handleShare(hub)}>
                    <Share2 className="h-4 w-4 mr-2" /> Copy link
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-red-600 cursor-pointer" onClick={() => setDeleteTarget({ id: hub.id, name: hub.name })}>
                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((hub) => (
            <div key={hub.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-primary/30 hover:shadow-sm transition-all">
              <div
                className="h-28 bg-gradient-to-br from-primary to-primary/80"
                style={hub.coverImageUrl ? { backgroundImage: `url(${hub.coverImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : {}}
              />
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{hub.name}</p>
                    {hub.tagline && <p className="text-xs text-slate-500 truncate mt-0.5">{hub.tagline}</p>}
                  </div>
                  <Badge className={hub.isEnabled ? "bg-emerald-50 text-emerald-700 border-emerald-200 flex-shrink-0" : "bg-gray-100 text-gray-600 border-gray-200 flex-shrink-0"} variant="outline">
                    {hub.isEnabled ? "Published" : "Draft"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Button size="sm" className="flex-1 bg-primary hover:bg-primary/90 text-white gap-1.5" onClick={() => navigate(`/products/community/${hub.id}/manage`)}>
                    <Settings className="h-3.5 w-3.5" /> Manage
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8 border-gray-300 text-slate-600" onClick={() => handleShare(hub)} title="Copy link">
                    <Share2 className="h-3.5 w-3.5" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500"><MoreVertical className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-white border-gray-200">
                      <DropdownMenuItem className="text-slate-700 cursor-pointer" onClick={() => navigate(`/community/${hub.slug}`)}>  
                        <ExternalLink className="h-4 w-4 mr-2" /> View community
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-600 cursor-pointer" onClick={() => setDeleteTarget({ id: hub.id, name: hub.name })}>
                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upgrade prompt when at limit */}
      {atLimit && maxCommunities !== null && maxCommunities > 0 && (
        <div className="flex items-center gap-4 border-2 border-dashed border-purple-200 rounded-xl p-4 bg-purple-50/40">
          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
            <Plus className="h-5 w-5 text-purple-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Gem className="h-3.5 w-3.5 text-purple-500" />
              <span className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Upgrade</span>
            </div>
            <p className="font-semibold text-slate-800 text-sm">Expand your impact with more communities</p>
            <p className="text-xs text-slate-500 mt-0.5">
              You've reached the communities limit on your current plan. Additional communities are available on the{" "}
              {plan === "starter" ? "Builder" : plan === "builder" ? "Pro" : "Enterprise"} plan. Upgrade today to access.
            </p>
          </div>
          <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5 flex-shrink-0" onClick={() => toast.info("Contact your platform admin to upgrade your plan.")}>
            Upgrade <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Create community dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-white border-gray-200 text-slate-900 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-teal-500" />
              New Community
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              Create a new community hub for your learners to connect and collaborate.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-slate-800">Community Name <span className="text-red-500">*</span></Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Online Learning Community" className="bg-white border-gray-300 text-slate-900" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-800">Tagline</Label>
              <Input value={newTagline} onChange={(e) => setNewTagline(e.target.value)} placeholder="A short description of your community" className="bg-white border-gray-300 text-slate-900" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-800">Description</Label>
              <Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Tell learners what this community is about..." className="bg-white border-gray-300 text-slate-900" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="border-gray-300 text-slate-700">Cancel</Button>
            <Button
              onClick={() => {
                if (!newName.trim()) { toast.error("Community name is required"); return; }
                if (!orgId) return;
                createHub.mutate({ orgId, name: newName.trim(), tagline: newTagline || undefined, description: newDesc || undefined });
              }}
              disabled={createHub.isPending || !newName.trim()}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              {createHub.isPending ? "Creating..." : "Create Community"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-white border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-900">Delete community?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500">
              This will permanently delete <strong>{deleteTarget?.name}</strong> and all its spaces, posts, and members. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-300 text-slate-700">Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={() => deleteTarget && deleteHub.mutate({ hubId: deleteTarget.id })}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
