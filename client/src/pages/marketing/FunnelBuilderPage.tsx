import { useState, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft,
  LayoutDashboard,
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  ChevronRight,
  GripVertical,
  MoreVertical,
  Eye,
  Settings,
  ArrowRight,
  Layers,
  MousePointerClick,
  FileText,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Globe,
  Zap,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Step type metadata ───────────────────────────────────────────────────────

const STEP_TYPES = [
  { value: "landing", label: "Landing Page", icon: Layers, color: "bg-blue-500", desc: "Capture leads or introduce your offer" },
  { value: "sales", label: "Sales Page", icon: TrendingUp, color: "bg-emerald-500", desc: "Present your offer and pricing" },
  { value: "order", label: "Order / Checkout", icon: ShoppingCart, color: "bg-[var(--org-primary)]", desc: "Collect payment from buyers" },
  { value: "upsell", label: "Upsell", icon: TrendingUp, color: "bg-orange-500", desc: "Offer an upgrade after purchase" },
  { value: "downsell", label: "Downsell", icon: TrendingDown, color: "bg-amber-500", desc: "Offer a lower-priced alternative" },
  { value: "thank_you", label: "Thank You", icon: CheckCircle2, color: "bg-teal-500", desc: "Confirm purchase or registration" },
  { value: "webinar", label: "Webinar Registration", icon: Globe, color: "bg-sky-500", desc: "Collect webinar sign-ups" },
  { value: "custom", label: "Custom Page", icon: FileText, color: "bg-slate-500", desc: "Any other page type" },
] as const;

type StepType = typeof STEP_TYPES[number]["value"];

function getStepMeta(type: StepType) {
  return STEP_TYPES.find((s) => s.value === type) ?? STEP_TYPES[STEP_TYPES.length - 1];
}

// ─── Sortable Step Card ───────────────────────────────────────────────────────

function SortableStepCard({
  step,
  index,
  totalSteps,
  onEdit,
  onDelete,
  onOpenPage,
}: {
  step: any;
  index: number;
  totalSteps: number;
  onEdit: (step: any) => void;
  onDelete: (id: number) => void;
  onOpenPage: (step: any) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const meta = getStepMeta(step.stepType as StepType);
  const Icon = meta.icon;
  const convRate = step.visitors > 0 ? Math.round((step.conversions / step.visitors) * 100) : null;

  return (
    <div ref={setNodeRef} style={style} className="flex flex-col items-center">
      {/* Step card */}
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden group">
        {/* Colored header strip */}
        <div className={`${meta.color} h-1.5 w-full`} />
        <div className="p-4 flex items-start gap-3">
          {/* Drag handle */}
          <button
            {...attributes}
            {...listeners}
            className="mt-0.5 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          {/* Icon */}
          <div className={`${meta.color} rounded-lg p-2 shrink-0`}>
            <Icon className="h-4 w-4 text-white" />
          </div>
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Step {index + 1}</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                {meta.label}
              </Badge>
            </div>
            <p className="font-semibold text-sm mt-0.5 truncate">{step.name}</p>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
              <span>{step.visitors} visitors</span>
              {convRate !== null && (
                <span className="text-emerald-600 font-medium">{convRate}% conv.</span>
              )}
            </div>
          </div>
          {/* Actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onOpenPage(step)}>
                <Pencil className="h-3.5 w-3.5 mr-2" />
                {step.pageId ? "Edit Page" : "Create Page"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(step)}>
                <Settings className="h-3.5 w-3.5 mr-2" />
                Step Settings
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(step.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                Delete Step
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {/* Page status bar */}
        <div className="px-4 pb-3 flex items-center justify-between">
          {step.pageId ? (
            <button
              onClick={() => onOpenPage(step)}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <Eye className="h-3 w-3" />
              View / Edit Page
            </button>
          ) : (
            <button
              onClick={() => onOpenPage(step)}
              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
            >
              <Plus className="h-3 w-3" />
              Design this page
            </button>
          )}
          {step.slug && (
            <a
              href={`/p/${step.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
      {/* Arrow connector (not after last step) */}
      {index < totalSteps - 1 && (
        <div className="flex flex-col items-center py-2 text-muted-foreground/40">
          <div className="w-px h-5 bg-border" />
          <ArrowRight className="h-4 w-4 rotate-90" />
          <div className="w-px h-5 bg-border" />
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FunnelBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const funnelId = parseInt(id ?? "0");
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  // Data
  const { data: funnel, isLoading } = trpc.lms.funnels.getWithSteps.useQuery(
    { id: funnelId },
    { enabled: !!funnelId }
  );

  // Local step order (for optimistic DnD)
  const [stepOrder, setStepOrder] = useState<number[] | null>(null);
  const steps: any[] = stepOrder
    ? (funnel?.steps ?? []).slice().sort((a: any, b: any) => stepOrder.indexOf(a.id) - stepOrder.indexOf(b.id))
    : (funnel?.steps ?? []);

  // Mutations
  const createStep = trpc.lms.funnels.createStep.useMutation({
    onSuccess: () => {
      utils.lms.funnels.getWithSteps.invalidate({ id: funnelId });
      setAddOpen(false);
      toast.success("Step added");
    },
    onError: (e) => toast.error(e.message),
  });
  const updateStep = trpc.lms.funnels.updateStep.useMutation({
    onSuccess: () => {
      utils.lms.funnels.getWithSteps.invalidate({ id: funnelId });
      setEditStep(null);
      toast.success("Step updated");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteStep = trpc.lms.funnels.deleteStep.useMutation({
    onSuccess: () => {
      utils.lms.funnels.getWithSteps.invalidate({ id: funnelId });
      toast.success("Step deleted");
    },
    onError: (e) => toast.error(e.message),
  });
  const reorderSteps = trpc.lms.funnels.reorderSteps.useMutation({
    onSuccess: () => utils.lms.funnels.getWithSteps.invalidate({ id: funnelId }),
  });

  // Add step dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", stepType: "landing" as StepType });

  // Edit step dialog
  const [editStep, setEditStep] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ name: "", stepType: "landing" as StepType });

  const openEdit = (step: any) => {
    setEditStep(step);
    setEditForm({ name: step.name, stepType: step.stepType });
  };

  // DnD
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const ids = steps.map((s: any) => s.id);
      const oldIdx = ids.indexOf(active.id as number);
      const newIdx = ids.indexOf(over.id as number);
      const newIds = arrayMove(ids, oldIdx, newIdx);
      setStepOrder(newIds);
      reorderSteps.mutate({ funnelId, stepIds: newIds });
    },
    [steps, funnelId, reorderSteps]
  );

  // Navigate to page builder for a step
  const openPage = (step: any) => {
    if (step.pageId) {
      setLocation(`/lms/pages/${step.pageId}`);
    } else {
      // Create a new page for this step and navigate
      toast.info("Creating a new page for this step…");
      // We'll use the page builder route with funnelStepId param
      setLocation(`/lms/pages/new?funnelStepId=${step.id}&name=${encodeURIComponent(step.name)}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen overflow-hidden bg-background w-screen">
        <div className="h-12 border-b flex items-center px-4 gap-3">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 w-full max-w-sm">
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!funnel) {
    return (
      <div className="flex flex-col h-screen items-center justify-center gap-4">
        <p className="text-muted-foreground">Funnel not found.</p>
        <Button variant="outline" onClick={() => setLocation("/marketing/funnels")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Funnels
        </Button>
      </div>
    );
  }

  const convRate =
    funnel.totalVisitors > 0
      ? Math.round((funnel.totalConversions / funnel.totalVisitors) * 100)
      : 0;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background w-screen">
      {/* ─── Top Bar ─────────────────────────────────────────────────────────── */}
      <div className="h-12 border-b border-border flex items-center justify-between px-3 shrink-0 bg-white z-20 shadow-sm">
        {/* Left */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setLocation("/marketing/funnels")}
            className="h-7 px-2 rounded-lg hover:bg-accent flex items-center gap-1.5 shrink-0 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <LayoutDashboard className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Funnels</span>
          </button>
          <div className="w-px h-5 bg-border shrink-0" />
          <span className="text-sm font-semibold truncate max-w-[200px]">{funnel.name}</span>
          <Badge variant={funnel.isActive ? "default" : "secondary"} className="text-[10px] shrink-0">
            {funnel.isActive ? "Active" : "Paused"}
          </Badge>
        </div>
        {/* Right: stats + add step */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground">
            <span><strong className="text-foreground">{funnel.totalVisitors}</strong> visitors</span>
            <span><strong className="text-foreground">{funnel.totalConversions}</strong> conversions</span>
            <span><strong className="text-emerald-600">{convRate}%</strong> conv. rate</span>
          </div>
          <Button size="sm" className="gap-1.5 h-7 text-xs" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add Step
          </Button>
        </div>
      </div>

      {/* ─── Canvas ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto bg-muted/30">
        <div className="min-h-full flex flex-col items-center py-10 px-4">
          {steps.length === 0 ? (
            <div className="flex flex-col items-center gap-4 mt-20 text-center">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Zap className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-lg">No steps yet</p>
                <p className="text-muted-foreground text-sm mt-1">
                  Add your first step to start building this funnel
                </p>
              </div>
              <Button onClick={() => setAddOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Add First Step
              </Button>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={steps.map((s: any) => s.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col items-center w-full max-w-sm">
                  {steps.map((step: any, idx: number) => (
                    <SortableStepCard
                      key={step.id}
                      step={step}
                      index={idx}
                      totalSteps={steps.length}
                      onEdit={openEdit}
                      onDelete={(id) => {
                        if (confirm("Delete this step?")) deleteStep.mutate({ id });
                      }}
                      onOpenPage={openPage}
                    />
                  ))}
                  {/* Add step button at bottom */}
                  <div className="flex flex-col items-center mt-2">
                    <div className="w-px h-6 bg-border" />
                    <button
                      onClick={() => setAddOpen(true)}
                      className="h-8 w-8 rounded-full border-2 border-dashed border-border hover:border-primary hover:text-primary flex items-center justify-center transition-colors text-muted-foreground"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>

      {/* ─── Add Step Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Funnel Step</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div>
              <Label>Step Name</Label>
              <Input
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Opt-in Page"
                className="mt-1.5"
                autoFocus
              />
            </div>
            <div>
              <Label>Step Type</Label>
              <Select
                value={addForm.stepType}
                onValueChange={(v) => setAddForm((f) => ({ ...f, stepType: v as StepType }))}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STEP_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      <div className="flex flex-col">
                        <span>{t.label}</span>
                        <span className="text-xs text-muted-foreground">{t.desc}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!addForm.name.trim()) { toast.error("Step name is required"); return; }
                createStep.mutate({
                  funnelId,
                  name: addForm.name,
                  stepType: addForm.stepType,
                  sortOrder: steps.length,
                });
              }}
              disabled={createStep.isPending}
            >
              {createStep.isPending ? "Adding…" : "Add Step"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Step Dialog ────────────────────────────────────────────────── */}
      <Dialog open={!!editStep} onOpenChange={(o) => { if (!o) setEditStep(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Step Settings</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div>
              <Label>Step Name</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Step Type</Label>
              <Select
                value={editForm.stepType}
                onValueChange={(v) => setEditForm((f) => ({ ...f, stepType: v as StepType }))}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STEP_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditStep(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!editStep) return;
                updateStep.mutate({ id: editStep.id, name: editForm.name, stepType: editForm.stepType });
              }}
              disabled={updateStep.isPending}
            >
              {updateStep.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
