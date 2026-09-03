import { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useOrgScope } from "@/hooks/useOrgScope";
import { ProductSwitcher } from "@/components/ProductSwitcher";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Copy,
  Trash2,
  FileDown,
  Layers,
  BookOpen,
  Clock,
  Globe,
  Lock,
  ChevronRight,
  Sparkles,
  LayoutTemplate,
  Play,
  Zap,
  Crown,
  Check,
  Timer,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

// ─── Template options ─────────────────────────────────────────────────────────
const TEMPLATES = [
  { id: "blank", label: "Blank Course", desc: "Start from scratch", icon: "⬜" },
  { id: "training", label: "Training Module", desc: "5-slide professional layout", icon: "🎓" },
  { id: "quiz", label: "Quiz Course", desc: "Assessment-focused", icon: "✅" },
  { id: "scenario", label: "Branching Scenario", desc: "Decision-tree learning", icon: "🌿" },
  { id: "microlearn", label: "Micro-Learning", desc: "3-minute bite-sized course", icon: "⚡" },
  { id: "onboarding", label: "Onboarding", desc: "Employee onboarding flow", icon: "🤝" },
];

export default function CreatorDashboardPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { orgId } = useOrgScope();

  const [search, setSearch] = useState("");
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("blank");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeInterval, setUpgradeInterval] = useState<"monthly" | "annual">("monthly");
  const activePage = "projects" as const;

  const utils = trpc.useUtils();

  const { data: projects = [], isLoading } = trpc.authoring.listProjects.useQuery({ orgId: orgId! }, { enabled: !!orgId });
  const { data: roleData } = trpc.authoring.getMyCreatorRole.useQuery();

  const createProject = trpc.authoring.createProject.useMutation({
    onSuccess: (data) => {
      utils.authoring.listProjects.invalidate();
      setShowNewDialog(false);
      setNewTitle("");
      navigate(`/creator/${data.id}`);
      toast.success("Project created!");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteProject = trpc.authoring.deleteProject.useMutation({
    onSuccess: () => {
      utils.authoring.listProjects.invalidate();
      setDeleteId(null);
      toast.success("Project deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const duplicateProject = trpc.authoring.duplicateProject.useMutation({
    onSuccess: (data) => {
      utils.authoring.listProjects.invalidate();
      toast.success("Project duplicated");
    },
    onError: (e) => toast.error(e.message),
  });

  const filtered = projects.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    if (!orgId) { toast.error("Select an organization before creating a project"); return; }
    createProject.mutate({ title: newTitle.trim(), orgId });
  };

  const showWatermarkBanner = roleData && !roleData.isPaid;

  // Trial countdown
  const trialDaysLeft = roleData?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(roleData.trialEndsAt).getTime() - Date.now()) / 86400000))
    : null;
  const isInTrial = roleData?.isInTrial ?? false;

  const createCreatorSingleCheckout = trpc.billing.createCreatorSingleCheckout.useMutation({
    onSuccess: (data) => {
      if (data.checkoutUrl) window.open(data.checkoutUrl, "_blank");
      toast.success("Redirecting to checkout...");
      setShowUpgradeModal(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const CREATOR_PLAN_FEATURES = [
    "Unlimited SCORM projects",
    "SCORM 1.2 & 2004 export",
    "HTML5 & xAPI export",
    "AI course generation",
    "Branching scenarios",
    "Custom branding & no watermarks",
    "Advanced quiz types",
    "Priority support",
  ];

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white">
      {showWatermarkBanner && (
        <div className="bg-[#24abbc] text-white text-sm font-medium flex items-center justify-center gap-3 px-4 py-2">
          {isInTrial && trialDaysLeft !== null && (
            <span className="flex items-center gap-1.5">
              <Timer className="w-3.5 h-3.5" />
              <strong>{trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""} left in trial</strong>
            </span>
          )}
          <span>Your exports include a <strong>Created with Course360™</strong> watermark on the free/trial plan.</span>
          <button
            onClick={() => setShowUpgradeModal(true)}
            className="underline underline-offset-2 cursor-pointer hover:text-[#4ad9e0] transition-colors"
          >Upgrade to remove →</button>
        </div>
      )}
      {/* ── Top nav ──────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0f1e]/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/creator-pro">
              <span className="text-lg font-bold tracking-tight">
                <span className="text-white">Teachific</span>
                <span className="text-[#4ad9e0]">Creator</span>
                <sup className="text-[10px] text-[#4ad9e0] ml-0.5">™</sup>
              </span>
            </Link>
            <div className="hidden md:flex items-center gap-4 text-sm text-white/60">
              <span className="text-white font-medium">My Projects</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isInTrial && trialDaysLeft !== null && (
              <div className="hidden md:flex items-center gap-1.5 text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full px-3 py-1">
                <Timer className="w-3 h-3" />
                <span>{trialDaysLeft}d trial left</span>
              </div>
            )}
            {showWatermarkBanner && (
              <Button
                variant="outline"
                size="sm"
                className="hidden md:flex text-xs border-[#24abbc]/50 text-[#4ad9e0] hover:bg-[#24abbc]/10"
                onClick={() => setShowUpgradeModal(true)}
              >
                <Crown className="w-3 h-3 mr-1.5" />
                Upgrade
              </Button>
            )}
            <ProductSwitcher current="studio" variant="topbar" />
            <Button
              size="sm"
              className="bg-[#24abbc] hover:bg-[#4ad9e0] text-white font-semibold"
              onClick={() => setShowNewDialog(true)}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              New Project
            </Button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-10">
        {activePage === "projects" && (<>
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-white">My Projects</h1>
            <p className="text-white/50 mt-1 text-sm">
              {projects.length} project{projects.length !== 1 ? "s" : ""} · Build interactive eLearning courses
            </p>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <Input
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#24abbc]"
            />
          </div>
        </div>

        {/* ── Empty state ─────────────────────────────────────────────────────── */}
        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 rounded-2xl bg-[#24abbc]/20 flex items-center justify-center mb-6">
              <Layers className="w-10 h-10 text-[#4ad9e0]" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              {search ? "No projects found" : "Start Your First Course"}
            </h2>
            <p className="text-white/50 max-w-sm mb-8">
              {search
                ? "Try a different search term."
                : "Create interactive SCORM courses, quizzes, and branching scenarios right in your browser."}
            </p>
            {!search && (
              <Button
                className="bg-[#24abbc] hover:bg-[#4ad9e0] text-white font-semibold"
                onClick={() => setShowNewDialog(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Project
              </Button>
            )}
          </div>
        )}

        {/* ── Loading ──────────────────────────────────────────────────────────── */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-48 rounded-2xl bg-white/5 animate-pulse" />
            ))}
          </div>
        )}

        {/* ── Project grid ─────────────────────────────────────────────────────── */}
        {!isLoading && filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* New project card */}
            <button
              onClick={() => setShowNewDialog(true)}
              className="group h-48 rounded-2xl border-2 border-dashed border-white/15 hover:border-[#24abbc]/60 bg-white/3 hover:bg-[#24abbc]/5 transition-all flex flex-col items-center justify-center gap-3 text-white/40 hover:text-[#4ad9e0]"
            >
              <div className="w-12 h-12 rounded-xl bg-white/5 group-hover:bg-[#24abbc]/20 flex items-center justify-center transition-colors">
                <Plus className="w-6 h-6" />
              </div>
              <span className="text-sm font-medium">New Project</span>
            </button>

            {filtered.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={() => navigate(`/creator/${project.id}`)}
                onDuplicate={() => duplicateProject.mutate({ id: Number(project.id) })}
                onDelete={() => setDeleteId(Number(project.id))}
              />
            ))}
          </div>
        )}
        </>)}
      </div>

      {/* ── New Project Dialog ───────────────────────────────────────────────── */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="bg-[#111827] border-white/10 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Create New Project</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div>
              <label className="text-sm text-white/60 mb-2 block">Project Title</label>
              <Input
                placeholder="e.g. Onboarding for New Hires"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#24abbc]"
                autoFocus
              />
            </div>

            <div>
              <label className="text-sm text-white/60 mb-3 block">Choose a Template</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTemplate(t.id)}
                    className={`rounded-xl border p-3 text-left transition-all ${
                      selectedTemplate === t.id
                        ? "border-[#24abbc] bg-[#24abbc]/10"
                        : "border-white/10 bg-white/5 hover:border-white/20"
                    }`}
                  >
                    <div className="text-2xl mb-1.5">{t.icon}</div>
                    <p className="text-sm font-semibold text-white">{t.label}</p>
                    <p className="text-xs text-white/40 mt-0.5">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowNewDialog(false)}
              className="text-white/60 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newTitle.trim() || createProject.isPending}
              className="bg-[#24abbc] hover:bg-[#4ad9e0] text-white font-semibold"
            >
              {createProject.isPending ? "Creating..." : "Create Project"}
              <ChevronRight className="ml-1 w-4 h-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Upgrade Modal ─────────────────────────────────────────────────────── */}
      <Dialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
        <DialogContent className="bg-[#0d1627] border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <Crown className="w-6 h-6 text-[#4ad9e0]" />
              Upgrade Course360 Creator™
            </DialogTitle>
            <p className="text-white/50 text-sm mt-1">Remove watermarks, unlock AI tools, and export without limits.</p>
          </DialogHeader>
          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-1 bg-white/5 rounded-full p-1 w-fit mx-auto">
            <button
              onClick={() => setUpgradeInterval("monthly")}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                upgradeInterval === "monthly" ? "bg-[#24abbc] text-white" : "text-white/50 hover:text-white"
              }`}
            >Monthly</button>
            <button
              onClick={() => setUpgradeInterval("annual")}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                upgradeInterval === "annual" ? "bg-[#24abbc] text-white" : "text-white/50 hover:text-white"
              }`}
            >
              Annual
              <span className="ml-1.5 text-[10px] bg-amber-500/20 text-amber-300 rounded px-1 py-0.5">Save $405</span>
            </button>
          </div>
          {/* Single plan card */}
          <div className="rounded-xl border border-[#24abbc] bg-[#24abbc]/10 p-6 mt-2">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold text-white text-xl">Course360 Creator™</p>
                <p className="text-white/50 text-sm mt-0.5">Full access, all features</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-extrabold text-[#4ad9e0]">
                  ${upgradeInterval === "monthly" ? "117" : "83"}
                  <span className="text-sm font-normal text-white/40">/mo</span>
                </p>
                {upgradeInterval === "annual" && (
                  <p className="text-xs text-white/40">$999/yr billed annually</p>
                )}
              </div>
            </div>
            <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
              {CREATOR_PLAN_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-1.5 text-xs text-white/70">
                  <Check className="w-3 h-3 text-[#4ad9e0] mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-white/5 rounded-lg p-3 text-xs text-white/50 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400 shrink-0" />
            <span>14-day free trial included. Cancel anytime. Test card: 4242 4242 4242 4242.</span>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowUpgradeModal(false)} className="text-white/60 hover:text-white">
              Cancel
            </Button>
            <Button
              onClick={() => createCreatorSingleCheckout.mutate({
                interval: upgradeInterval,
                origin: window.location.origin,
              })}
              disabled={createCreatorSingleCheckout.isPending}
              className="bg-[#24abbc] hover:bg-[#4ad9e0] text-white font-semibold"
            >
              {createCreatorSingleCheckout.isPending ? "Redirecting..." : "Start Free Trial"}
              <ChevronRight className="ml-1 w-4 h-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
            {/* ── Delete Confirm Dialog ────────────────────────────────────────────── */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="bg-[#111827] border-white/10 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Project?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-white/60 py-2">
            This will permanently delete the project and all its slides. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleteId(null)}
              className="text-white/60 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId !== null && deleteProject.mutate({ id: deleteId })}
              disabled={deleteProject.isPending}
            >
              {deleteProject.isPending ? "Deleting..." : "Delete Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Project Card ─────────────────────────────────────────────────────────────
function ProjectCard({
  project,
  onOpen,
  onDuplicate,
  onDelete,
}: {
  project: {
    id: number | bigint;
    title: string;
    status: "draft" | "published";
    lastPublishedFormat: "scorm12" | "scorm2004" | "html5" | null;
    updatedAt: Date;
  };
  onOpen: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const formatLabel: Record<string, string> = {
    scorm12: "SCORM 1.2",
    scorm2004: "SCORM 2004",
    html5: "HTML5",
  };

  return (
    <div className="group relative rounded-2xl border border-white/10 bg-white/5 hover:border-[#24abbc]/40 hover:bg-white/8 transition-all overflow-hidden">
      {/* Thumbnail area */}
      <div
        className="h-28 bg-gradient-to-br from-[#0d2a3a] to-[#0a1628] flex items-center justify-center cursor-pointer"
        onClick={onOpen}
      >
        <div className="w-16 h-10 bg-white/10 rounded-lg flex items-center justify-center">
          <Layers className="w-6 h-6 text-[#4ad9e0]/60" />
        </div>
        <div className="absolute inset-0 bg-[#24abbc]/0 group-hover:bg-[#24abbc]/5 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="bg-[#24abbc] rounded-full p-2">
            <Play className="w-4 h-4 text-white fill-white" />
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3
              className="font-semibold text-white text-sm truncate cursor-pointer hover:text-[#4ad9e0] transition-colors"
              onClick={onOpen}
            >
              {project.title}
            </h3>
            <div className="flex items-center gap-2 mt-1.5">
              <Badge
                className={`text-[10px] px-1.5 py-0 ${
                  project.status === "published"
                    ? "bg-green-500/20 text-green-400 border-green-500/30"
                    : "bg-white/10 text-white/50 border-white/10"
                }`}
              >
                {project.status === "published" ? (
                  <><Globe className="w-2.5 h-2.5 mr-1" />Published</>
                ) : (
                  <><Lock className="w-2.5 h-2.5 mr-1" />Draft</>
                )}
              </Badge>
              {project.lastPublishedFormat && (
                <Badge className="text-[10px] px-1.5 py-0 bg-[#24abbc]/20 text-[#4ad9e0] border-[#24abbc]/30">
                  {formatLabel[project.lastPublishedFormat]}
                </Badge>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white/40 hover:text-white hover:bg-white/10 shrink-0"
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="bg-[#111827] border-white/10 text-white"
            >
              <DropdownMenuItem onClick={onOpen} className="hover:bg-white/10 cursor-pointer">
                <Pencil className="w-4 h-4 mr-2" /> Open Editor
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate} className="hover:bg-white/10 cursor-pointer">
                <Copy className="w-4 h-4 mr-2" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem
                onClick={onDelete}
                className="text-red-400 hover:bg-red-500/10 cursor-pointer"
              >
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <p className="text-[11px] text-white/30 mt-2 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Updated {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
}
