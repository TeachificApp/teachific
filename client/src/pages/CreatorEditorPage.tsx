import { useState, useRef, useCallback, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ChevronLeft,
  Plus,
  Trash2,
  Download,
  Save,
  Play,
  Type,
  Image as ImageIcon,
  Square,
  Circle,
  Minus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Underline,
  MoreVertical,
  Copy,
  Layers,
  Settings,
  Upload,
  FileCode,
  FileArchive,
  Globe,
  ChevronUp,
  ChevronDown,
  Palette,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import { getCourse360MediaLibraryHref } from "@/lib/course360MediaLibrary";
import { useOrgScope } from "@/hooks/useOrgScope";
import { readCreatorDocument, createCreatorAssessment, CREATOR_ASSESSMENT_TYPES, type CreatorBlock, type CreatorDocument } from "@shared/course360CreatorModel";
import { CREATOR_LAYOUTS, seedCreatorLayout } from "@shared/course360CreatorLayouts";
import { CreatorSaveQueue } from "@shared/course360CreatorSaveQueue";
import { CreatorBlockView } from "@/components/creator/CreatorBlockView";
import { CreatorInspector } from "@/components/creator/CreatorInspector";
import { CreatorProjectSettings } from "@/components/creator/CreatorProjectSettings";
import { CreatorAiPptxControls } from "@/components/creator/CreatorAiPptxControls";

// ─── Types ────────────────────────────────────────────────────────────────────
type Block = CreatorBlock;
type SlideData = CreatorDocument;

// ─── Canvas dimensions ────────────────────────────────────────────────────────
const CANVAS_W = 1000;
const CANVAS_H = 563;

// ─── Background presets ───────────────────────────────────────────────────────
const BG_PRESETS = [
  "#0f172a", "#1e1b4b", "#0c1a2e", "#111827", "#1a0a2e",
  "#0d2a1a", "#1a1a1a", "#2d1b00", "#0a1628", "#1a0a0a",
];

// ─── Block defaults ───────────────────────────────────────────────────────────
function newBlock(type: Block["type"]): Block {
  const id = `block-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  switch (type) {
    case "text":
      return { id, type, x: 100, y: 100, width: 600, height: 80, content: "Click to edit text", style: { fontSize: 24, color: "#ffffff", textAlign: "left" } };
    case "image":
      return { id, type, x: 200, y: 150, width: 300, height: 200, src: "", style: {} };
    case "shape":
      return { id, type, x: 300, y: 200, width: 200, height: 120, content: "", style: { backgroundColor: "#24abbc", borderRadius: 8 } };
    case "video":
    case "audio":
      return { id, type, x: 100, y: 120, width: 800, height: type === "video" ? 360 : 80, src: "", style: {} };
    case "assessment":
      return { id, type, x: 60, y: 60, width: 880, height: 440, assessment: createCreatorAssessment("multiple_choice"), style: { fontSize: 22 } };
    case "interaction":
      return { id, type, x: 60, y: 100, width: 880, height: 360, interaction: { kind: "tabs", items: [{ id: "one", title: "First item", content: "Edit the first item's details" }, { id: "two", title: "Second item", content: "Edit the second item's details" }] }, style: { fontSize: 22 } };
    case "button":
      return { id, type, x: 350, y: 250, width: 200, height: 50, content: "Click Me", style: { backgroundColor: "#24abbc", color: "#ffffff", fontSize: 16, borderRadius: 8, textAlign: "center" } };
    default:
      return { id, type: "text", x: 100, y: 100, width: 400, height: 60, content: "Text", style: {} };
  }
}

// ─── Main Editor ──────────────────────────────────────────────────────────────
export default function CreatorEditorPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = parseInt(params.projectId || "0");
  const [, navigate] = useLocation();
  const { orgId } = useOrgScope();

  // Project & slides data
  const { data: project, isLoading: projectLoading, error: projectError } = trpc.authoring.getProject.useQuery({ id: projectId });
  const { data: slides = [], isLoading: slidesLoading } = trpc.authoring.listSlides.useQuery({ projectId });

  let settings: Record<string, any> = {}; try { settings = JSON.parse(project?.settingsJson || "{}"); } catch { /* do not rewrite saved settings */ }
  const CANVAS_W = Math.max(320, Math.min(4000, Number(settings.width) || 1000));
  const CANVAS_H = Math.max(240, Math.min(4000, Number(settings.height) || 563));
  const utils = trpc.useUtils();

  // Local state
  const [activeSlideId, setActiveSlideId] = useState<number | null>(null);
  const [slideContent, setSlideContent] = useState<SlideData>({ blocks: [] });
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportFormat, setExportFormat] = useState<"scorm12" | "scorm2004" | "html5">("scorm12");
  const [isExporting, setIsExporting] = useState(false);
  const [saveToMediaLibrary, setSaveToMediaLibrary] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [projectTitle, setProjectTitle] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [slideBackground, setSlideBackground] = useState("#0f172a");
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [slideTitle, setSlideTitle] = useState("");
  const [editingSlideTitle, setEditingSlideTitle] = useState(false);
  const [readError, setReadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [nextSlideId, setNextSlideId] = useState<number | null>(null);
  const [canvasScale, setCanvasScale] = useState(1);
  const [slideNotes, setSlideNotes] = useState("");
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const drafts = useRef(new Map<number, { document: SlideData; background: string; title: string; nextSlideId: number | null; notes: string }>());
  const bases = useRef(new Map<number, string>());
  const notesBases = useRef(new Map<number, string>());
  const activeRef = useRef<number | null>(null);
  const switchRequest = useRef(0);
  const dirtyRef = useRef(false);
  const titleInitialized = useRef(false);
  const exportLock = useRef(false);
  const previewQuery = trpc.authoring.previewPackage.useQuery({ projectId }, { enabled: false });

  const canvasRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);

  // Mutations
  const addSlideMutation = trpc.authoring.addSlide.useMutation({
    onSuccess: () => utils.authoring.listSlides.invalidate({ projectId }),
    onError: (e) => toast.error(e.message),
  });

  const deleteSlideMutation = trpc.authoring.deleteSlide.useMutation({
    onSuccess: () => utils.authoring.listSlides.invalidate({ projectId }),
    onError: (e) => toast.error(e.message),
  });

  const updateSlideMutation = trpc.authoring.updateSlide.useMutation({
    onError: (e) => toast.error(e.message),
  });

  const updateProjectMutation = trpc.authoring.updateProject.useMutation({
    onSuccess: () => utils.authoring.getProject.invalidate({ id: projectId }),
    onError: (e) => toast.error(e.message),
  });

  const exportMutation = trpc.authoring.exportPackage.useMutation({
    onSuccess: (data) => {
      setIsExporting(false);
      setShowExportDialog(false);
      // Trigger download
      const a = document.createElement("a");
      a.href = data.url;
      a.download = `${project?.title || "course"}-${data.format}.zip`;
      a.click();
      toast.success(data.mediaItemId ? "Package exported and saved to your organization's Course360 Media Library." : "Package exported successfully!");
    },
    onError: (e) => {
      setIsExporting(false);
      toast.error(e.message);
    },
  });

  type SavePayload = { id: number; contentJson: string; background: string; title: string; nextSlideId: number | null; notes?: string };
  const mutationRef = useRef(updateSlideMutation); mutationRef.current = updateSlideMutation;
  const saveQueue = useRef<CreatorSaveQueue<SavePayload> | null>(null);
  if (!saveQueue.current) saveQueue.current = new CreatorSaveQueue(async payload => {
    await mutationRef.current.mutateAsync({ ...payload, ...(bases.current.has(payload.id) ? { expectedContentJson: bases.current.get(payload.id)! } : {}) });
    bases.current.set(payload.id, payload.contentJson);
    if (payload.notes !== undefined) notesBases.current.set(payload.id, payload.notes);
    utils.authoring.listSlides.setData({ projectId }, old => old?.map(s => Number(s.id) === payload.id ? { ...s, ...payload } : s));
  });
  useEffect(() => {
    activeRef.current = activeSlideId;
    if (activeSlideId && !readError) {
      drafts.current.set(activeSlideId, { document: slideContent, background: slideBackground, title: slideTitle, nextSlideId, notes: slideNotes });
      dirtyRef.current = JSON.stringify(slideContent) !== bases.current.get(activeSlideId) || slideNotes !== notesBases.current.get(activeSlideId);
    }
  }, [activeSlideId, slideContent, slideBackground, slideTitle, nextSlideId, slideNotes, readError]);
  useEffect(() => { const prevent = (event: BeforeUnloadEvent) => { if (dirtyRef.current || saveQueue.current?.hasPending) { event.preventDefault(); event.returnValue = ""; } }; window.addEventListener("beforeunload", prevent); return () => window.removeEventListener("beforeunload", prevent); }, []);
  useEffect(() => {
    const fit = () => { const host = canvasHostRef.current; if (host) setCanvasScale(Math.max(.1, Math.min(1, (host.clientWidth - 64) / CANVAS_W, (host.clientHeight - 64) / CANVAS_H))); };
    fit(); const observer = typeof ResizeObserver === "function" ? new ResizeObserver(fit) : null; if (canvasHostRef.current) observer?.observe(canvasHostRef.current); window.addEventListener("resize", fit); return () => { observer?.disconnect(); window.removeEventListener("resize", fit); };
  }, [projectLoading, slidesLoading, CANVAS_W, CANVAS_H]);

  // Init active slide when slides load
  useEffect(() => {
    if (slides.length > 0 && activeSlideId === null) {
      const first = slides[0];
      setActiveSlideId(Number(first.id));
      loadSlide(first);
    }
  }, [slides]);

  useEffect(() => {
    if (project && !titleInitialized.current) { setProjectTitle(project.title); titleInitialized.current = true; }
  }, [project]);

  function loadSlide(slide: (typeof slides)[0]) {
    const id = Number(slide.id);
    try {
      const draft = drafts.current.get(id);
      if (!bases.current.has(id)) bases.current.set(id, slide.contentJson || "");
      if (!notesBases.current.has(id)) notesBases.current.set(id, slide.notes || "");
      setSlideContent(draft?.document || readCreatorDocument(slide.contentJson));
      setSlideBackground(draft?.background || slide.background || "#0f172a");
      setSlideTitle(draft?.title || slide.title);
      setNextSlideId(draft ? draft.nextSlideId : slide.nextSlideId ?? null);
      setSlideNotes(draft ? draft.notes : slide.notes || "");
      setReadError("");
    } catch (error) { setReadError(error instanceof Error ? error.message : "This saved slide cannot be safely edited. Original data retained."); }
    setSelectedBlockId(null); setEditingBlockId(null);
  }
  async function switchSlide(slide: (typeof slides)[0]) {
    if (Number(slide.id) === activeSlideId) { switchRequest.current++; return; }
    const request = ++switchRequest.current;
    try {
      if (activeSlideId !== null && !readError) await saveCurrentSlide(activeSlideId, false);
      if (request !== switchRequest.current) return;
      setActiveSlideId(Number(slide.id)); loadSlide(slide);
    } catch { /* Save errors retain active selection and drafts. */ }
  }
  async function saveCurrentSlide(slideId: number, showToast = true) {
    if (readError) { toast.error(readError); throw new Error(readError); }
    setIsSaving(true);
    const snapshot = { id: slideId, contentJson: JSON.stringify(slideContent), background: slideBackground, title: slideTitle, nextSlideId, ...(slideNotes !== notesBases.current.get(slideId) ? { notes: slideNotes } : {}) };
    try {
      if (saveQueue.current?.error) await saveQueue.current.retry();
      await saveQueue.current!.enqueue(snapshot);
      setSaveError(""); dirtyRef.current = JSON.stringify(drafts.current.get(slideId)?.document) !== snapshot.contentJson || drafts.current.get(slideId)?.notes !== notesBases.current.get(slideId);
      if (showToast) toast.success("Saved");
    } catch (error) { setSaveError(error instanceof Error ? error.message : "Save failed; your draft is retained."); throw error; }
    finally { setIsSaving(false); }
  }
  async function previewCourse() {
    try { if (activeSlideId) await saveCurrentSlide(activeSlideId, false); const result = await previewQuery.refetch(); if (!result.data) throw result.error || new Error("Preview unavailable"); setPreviewHtml(result.data.html); setShowPreview(true); } catch (error) { toast.error(error instanceof Error ? error.message : "Preview unavailable; draft retained."); }
  }
  async function addSlide(afterIndex?: number) {
    try { if (activeSlideId) await saveCurrentSlide(activeSlideId, false); await addSlideMutation.mutateAsync({ projectId, afterIndex }); } catch { /* retained */ }
  }
  async function removeSlide(slide: (typeof slides)[0]) {
    if (slides.length <= 1) { toast.error("Cannot delete the only slide"); return; }
    try { await deleteSlideMutation.mutateAsync({ id: Number(slide.id) }); drafts.current.delete(Number(slide.id)); bases.current.delete(Number(slide.id)); if (Number(slide.id) === activeSlideId) { const other = slides.find(s => Number(s.id) !== Number(slide.id)); if (other) { setActiveSlideId(Number(other.id)); loadSlide(other); } } } catch { /* failed delete never changes local selection */ }
  }

  // ── Block manipulation ────────────────────────────────────────────────────

  function addBlock(type: Block["type"]) {
    const block = newBlock(type);
    setSlideContent((prev) => ({ ...prev, blocks: [...prev.blocks, block] }));
    setSelectedBlockId(block.id);
  }

  function updateBlock(id: string, updates: Partial<Block>) {
    setSlideContent((prev) => ({
      ...prev, blocks: prev.blocks.map((b) => (b.id === id ? { ...b, ...updates, ...(updates.content !== undefined ? { contentMode: "plain" } : {}) } : b)),
    }));
  }

  function updateBlockStyle(id: string, styleUpdates: Partial<Block["style"]>) {
    setSlideContent((prev) => ({
      ...prev, blocks: prev.blocks.map((b) =>
        b.id === id ? { ...b, style: { ...b.style, ...styleUpdates } } : b
      ),
    }));
  }

  function deleteBlock(id: string) {
    setSlideContent((prev) => ({ ...prev, blocks: prev.blocks.filter((b) => b.id !== id) }));
    setSelectedBlockId(null);
  }

  function duplicateBlock(id: string) {
    const block = slideContent.blocks.find((b) => b.id === id);
    if (!block) return;
    const newB = { ...block, id: `block-${Date.now()}`, x: block.x + 20, y: block.y + 20 };
    setSlideContent((prev) => ({ ...prev, blocks: [...prev.blocks, newB] }));
    setSelectedBlockId(newB.id);
  }

  // ── Drag ─────────────────────────────────────────────────────────────────

  function getCanvasScale() {
    if (!canvasRef.current) return 1;
    return canvasRef.current.getBoundingClientRect().width / CANVAS_W;
  }

  function handleBlockMouseDown(e: React.MouseEvent | React.PointerEvent, blockId: string) {
    if (editingBlockId === blockId) return;
    e.preventDefault(); e.stopPropagation();
    setSelectedBlockId(blockId);
    const block = slideContent.blocks.find((b) => b.id === blockId);
    if (!block) return;
    const scale = getCanvasScale();
    setDragOffset({
      x: e.clientX / scale - block.x,
      y: e.clientY / scale - block.y,
    });
    setIsDragging(true);
    const moveEvent = "pointerId" in e ? "pointermove" : "mousemove"; const upEvent = "pointerId" in e ? "pointerup" : "mouseup";
    if ("pointerId" in e) e.currentTarget.setPointerCapture?.(e.pointerId);
    const startX = e.clientX, startY = e.clientY, x = block.x, y = block.y;
    const move = (ev: MouseEvent) => updateBlock(blockId, { x: Math.max(0, Math.min(CANVAS_W - 20, x + (ev.clientX - startX) / scale)), y: Math.max(0, Math.min(CANVAS_H - 20, y + (ev.clientY - startY) / scale)) });
    const up = () => { setIsDragging(false); window.removeEventListener(moveEvent, move as EventListener); window.removeEventListener(upEvent, up); };
    window.addEventListener(moveEvent, move as EventListener); window.addEventListener(upEvent, up);
  }

  function handleCanvasMouseMove(e: React.MouseEvent) {
    if (!isDragging || !selectedBlockId) return;
    const scale = getCanvasScale();
    const x = Math.max(0, Math.min(CANVAS_W - 20, e.clientX / scale - dragOffset.x));
    const y = Math.max(0, Math.min(CANVAS_H - 20, e.clientY / scale - dragOffset.y));
    updateBlock(selectedBlockId, { x, y });
  }

  function handleCanvasMouseUp() {
    setIsDragging(false);
  }

  function handleCanvasClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement) === canvasRef.current) {
      setSelectedBlockId(null);
      setEditingBlockId(null);
    }
  }

  // ── Resize ────────────────────────────────────────────────────────────────

  function handleResizeMouseDown(e: React.MouseEvent | React.PointerEvent, blockId: string) {
    e.stopPropagation();
    e.preventDefault();
    const block = slideContent.blocks.find((b) => b.id === blockId);
    if (!block) return;
    setIsResizing(true);
    setSelectedBlockId(blockId);
    setResizeStart({ x: e.clientX, y: e.clientY, w: block.width, h: block.height });
    const scale = getCanvasScale();
    const moveEvent = "pointerId" in e ? "pointermove" : "mousemove"; const upEvent = "pointerId" in e ? "pointerup" : "mouseup";
    if ("pointerId" in e) e.currentTarget.setPointerCapture?.(e.pointerId);
    const onMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - e.clientX) / scale;
      const dy = (ev.clientY - e.clientY) / scale;
      updateBlock(blockId, {
        width: Math.max(40, block.width + dx),
        height: Math.max(20, block.height + dy),
      });
    };
    const onUp = () => {
      setIsResizing(false);
      window.removeEventListener(moveEvent, onMove as EventListener);
      window.removeEventListener(upEvent, onUp);
    };
    window.addEventListener(moveEvent, onMove as EventListener);
    window.addEventListener(upEvent, onUp);
  }

  const selectedBlock = slideContent.blocks.find((b) => b.id === selectedBlockId) ?? null;
  const activeSlide = slides.find((s) => Number(s.id) === activeSlideId) ?? null;

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "s" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (activeSlideId) void saveCurrentSlide(activeSlideId).catch(() => {}); return; }
      const target = e.target as HTMLElement | null;
      if (editingBlockId || target?.closest("input,textarea,select,[contenteditable=true],[role=dialog]")) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedBlockId) { e.preventDefault(); deleteBlock(selectedBlockId); }
      if (e.key === "Escape") { setSelectedBlockId(null); setEditingBlockId(null); }
      if (selectedBlockId && ["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key)) {
        e.preventDefault(); const b = slideContent.blocks.find(b => b.id === selectedBlockId); const step = e.shiftKey ? 10 : 1;
        if (b) updateBlock(b.id, { x: b.x + (e.key === "ArrowRight" ? step : e.key === "ArrowLeft" ? -step : 0), y: b.y + (e.key === "ArrowDown" ? step : e.key === "ArrowUp" ? -step : 0) });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedBlockId, editingBlockId, activeSlideId, slideContent, slideBackground, slideTitle, slideNotes]);

  if (projectLoading || slidesLoading) {
    return (
      <div className="h-screen bg-[#0a0f1e] flex items-center justify-center">
        <div className="text-white/50">Loading editor...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="h-screen bg-[#0a0f1e] flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/50 mb-4">{projectError?.message || "Project not found"}</p><a className="text-[#4ad9e0]" href="/billing">Billing and access recovery</a>
          <Link href="/creator">
            <Button variant="ghost" className="text-[#4ad9e0]">← Back to Projects</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="h-screen bg-[#0a0f1e] text-white flex flex-col overflow-hidden">
        {/* ── Top Bar ─────────────────────────────────────────────────────────── */}
        <div className="h-12 border-b border-white/10 bg-[#0d1117] flex items-center px-4 gap-3 shrink-0">
          <Link href="/creator" onClick={e => { if (dirtyRef.current || saveQueue.current?.hasPending) { if (!window.confirm("You have unsaved changes. Leave the editor without saving?")) e.preventDefault(); } }}>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white/60 hover:text-white">
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </Link>

          {/* Project title */}
          {editingTitle ? (
            <Input
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              onBlur={() => {
                setEditingTitle(false);
                if (projectTitle.trim()) {
                  updateProjectMutation.mutate({ id: projectId, title: projectTitle.trim() });
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setEditingTitle(false);
                  if (projectTitle.trim()) {
                    updateProjectMutation.mutate({ id: projectId, title: projectTitle.trim() });
                  }
                }
              }}
              className="h-7 w-48 bg-white/10 border-[#24abbc] text-white text-sm"
              autoFocus
            />
          ) : (
            <button
              onClick={() => setEditingTitle(true)}
              className="text-sm font-semibold text-white hover:text-[#4ad9e0] transition-colors"
            >
              {projectTitle}
            </button>
          )}

          <div className="flex-1" />

          {/* Save indicator */}
          {isSaving && <span className="text-xs text-white/40">Saving...</span>}

          {/* Actions */}
          <a href={getCourse360MediaLibraryHref()} target="_blank" rel="noopener noreferrer" className="text-xs text-[#4ad9e0] hover:underline">Media Library</a>
          <CreatorAiPptxControls orgId={orgId} projectId={projectId} title={projectTitle} description={project.description} beforeExport={async () => { if (activeSlideId) await saveCurrentSlide(activeSlideId, false); }} onApplied={id => { void utils.authoring.listSlides.invalidate({ projectId }); if (id !== projectId) navigate(`/creator/${id}`); }} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-white/60 hover:text-white"
                onClick={() => activeSlideId && void saveCurrentSlide(activeSlideId).catch(() => {})}
                disabled={isSaving}
              >
                <Save className="w-4 h-4 mr-1.5" />
                Save
              </Button>
            </TooltipTrigger>
            <TooltipContent>Save (Ctrl+S)</TooltipContent>
          </Tooltip>

          <Button size="sm" variant="ghost" onClick={previewCourse} disabled={isSaving || !!readError}><Play className="mr-1 h-4 w-4" />Preview</Button>
          <Button
            size="sm"
            className="h-8 bg-[#24abbc] hover:bg-[#4ad9e0] text-white font-semibold"
            onClick={() => setShowExportDialog(true)}
          >
            <Download className="w-4 h-4 mr-1.5" />
            Export
          </Button>
        </div>

        {(readError || saveError) && <div role="alert" className="bg-red-950 px-4 py-2 text-sm">{readError || saveError} Your original saved data and local draft have not been discarded.</div>}
        <div className="flex flex-1 overflow-hidden">
          {/* ── Slide Panel (left) ────────────────────────────────────────────── */}
          <div className="w-52 border-r border-white/10 bg-[#0d1117] flex flex-col overflow-hidden shrink-0">
            <div className="p-3 border-b border-white/10 flex items-center justify-between">
              <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Slides</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-white/50 hover:text-white"
                    onClick={() => addSlide(activeSlide?.slideIndex)}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add slide</TooltipContent>
              </Tooltip>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {slides.map((slide, idx) => (
                <div
                  key={slide.id}
                  onClick={() => switchSlide(slide)}
                  className={`group relative rounded-lg cursor-pointer border transition-all ${
                    Number(slide.id) === activeSlideId
                      ? "border-[#24abbc] bg-[#24abbc]/10"
                      : "border-white/10 bg-white/5 hover:border-white/20"
                  }`}
                >
                  {/* Thumbnail */}
                  <div
                    className="h-20 rounded-t-lg flex items-center justify-center text-white/20 text-xs"
                    style={{ background: slide.background || "#0f172a" }}
                  >
                    <Layers className="w-5 h-5 opacity-30" />
                  </div>
                  {/* Label */}
                  <div className="px-2 py-1.5 flex items-center justify-between">
                    <span className="text-[11px] text-white/60 truncate flex-1">{idx + 1}. {slide.title}</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-white/30 hover:text-white opacity-0 group-hover:opacity-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="w-3 h-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-[#111827] border-white/10 text-white text-sm">
                        <DropdownMenuItem
                          className="hover:bg-white/10 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            void addSlide(slide.slideIndex);
                          }}
                        >
                          <Plus className="w-3.5 h-3.5 mr-2" /> Add After
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-white/10" />
                        <DropdownMenuItem
                          className="text-red-400 hover:bg-red-500/10 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            void removeSlide(slide);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Canvas Area (center) ──────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Block toolbar */}
            <div className="min-h-10 border-b border-white/10 bg-[#0d1117] flex flex-wrap items-center px-4 gap-1 shrink-0">
              {/* Add blocks */}
              {[
                { type: "text" as const, icon: <Type className="w-3.5 h-3.5" />, label: "Text" },
                { type: "image" as const, icon: <ImageIcon className="w-3.5 h-3.5" />, label: "Image" },
                { type: "shape" as const, icon: <Square className="w-3.5 h-3.5" />, label: "Shape" },
                { type: "video" as const, icon: <Play className="w-3.5 h-3.5" />, label: "Video" },
                { type: "audio" as const, icon: <Play className="w-3.5 h-3.5" />, label: "Audio" },
                { type: "button" as const, icon: <Circle className="w-3.5 h-3.5" />, label: "Button" },
              ].map(({ type, icon, label }) => (
                <Tooltip key={type}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-white/60 hover:text-white hover:bg-white/10 text-xs gap-1.5"
                      onClick={() => addBlock(type)}
                    >
                      {icon}
                      {label}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Add {label}</TooltipContent>
                </Tooltip>
              ))}

              <select aria-label="Add assessment" className="h-7 w-28 bg-[#12324a] text-xs" value="" onChange={e => { if (!e.target.value) return; const b = newBlock("assessment"); b.assessment = createCreatorAssessment(e.target.value as any); setSlideContent(prev => ({ ...prev, blocks: [...prev.blocks, b] })); setSelectedBlockId(b.id); }}><option value="">Assessment</option>{CREATOR_ASSESSMENT_TYPES.map(t => <option key={t} value={t}>{t.replaceAll("_", " ")}</option>)}</select>
              <select aria-label="Add interaction" className="h-7 w-28 bg-[#12324a] text-xs" value="" onChange={e => { if (!e.target.value) return; const b = newBlock("interaction"); b.interaction!.kind = e.target.value as any; setSlideContent(prev => ({ ...prev, blocks: [...prev.blocks, b] })); setSelectedBlockId(b.id); }}><option value="">Interaction</option>{["tabs","accordion","timeline","flip_cards","matching_drag"].map(t => <option key={t} value={t}>{t.replaceAll("_", " ")}</option>)}</select>
              <select aria-label="Append layout recipe" className="h-7 w-28 bg-[#12324a] text-xs" value="" onChange={e => { if (!e.target.value) return; const seed = seedCreatorLayout(e.target.value); const stamp = Date.now(); setSlideContent(prev => ({ ...prev, blocks: [...prev.blocks, ...seed.blocks.map((b,i) => ({ ...b, x: b.x * CANVAS_W / 1000, y: b.y * CANVAS_H / 563, width: b.width * CANVAS_W / 1000, height: b.height * CANVAS_H / 563, id: `layout-${stamp}-${i}` }))] })); toast.success("Layout added without replacing your existing blocks"); }}><option value="">Layouts ({CREATOR_LAYOUTS.length})</option>{CREATOR_LAYOUTS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
              <div className="w-px h-5 bg-white/10 mx-1" />

              {/* Background color */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setShowBgPicker(!showBgPicker)}
                    className="h-7 px-2 rounded flex items-center gap-1.5 text-xs text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <div
                      className="w-4 h-4 rounded border border-white/20"
                      style={{ background: slideBackground }}
                    />
                    Background
                  </button>
                </TooltipTrigger>
                <TooltipContent>Slide background</TooltipContent>
              </Tooltip>

              {/* Slide title edit */}
              <div className="w-px h-5 bg-white/10 mx-1" />
              {editingSlideTitle ? (
                <Input
                  value={slideTitle}
                  onChange={(e) => setSlideTitle(e.target.value)}
                  onBlur={() => setEditingSlideTitle(false)}
                  onKeyDown={(e) => e.key === "Enter" && setEditingSlideTitle(false)}
                  className="h-7 w-40 bg-white/10 border-[#24abbc] text-white text-xs"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => setEditingSlideTitle(true)}
                  className="text-xs text-white/40 hover:text-white/70 transition-colors px-2"
                >
                  {slideTitle || "Untitled Slide"}
                </button>
              )}

              <div className="flex-1" />

              {/* Selected block tools */}
              {selectedBlock && selectedBlock.type === "text" && (
                <div className="flex items-center gap-0.5">
                  {[
                    { icon: <Bold className="w-3 h-3" />, style: "fontWeight", on: "bold", off: "normal", label: "Bold" },
                    { icon: <Italic className="w-3 h-3" />, style: "fontStyle", on: "italic", off: "normal", label: "Italic" },
                    { icon: <Underline className="w-3 h-3" />, style: "textDecoration", on: "underline", off: "none", label: "Underline" },
                  ].map(({ icon, style, on, off, label }) => (
                    <Tooltip key={style}>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-7 w-7 ${(selectedBlock.style as Record<string, string>)?.[style] === on ? "bg-white/20 text-white" : "text-white/50 hover:text-white"}`}
                          onClick={() =>
                            updateBlockStyle(selectedBlock.id, {
                              [style]: (selectedBlock.style as Record<string, string>)?.[style] === on ? off : on,
                            } as Partial<Block["style"]>)
                          }
                        >
                          {icon}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{label}</TooltipContent>
                    </Tooltip>
                  ))}
                  <div className="w-px h-5 bg-white/10 mx-0.5" />
                  {[
                    { icon: <AlignLeft className="w-3 h-3" />, align: "left" },
                    { icon: <AlignCenter className="w-3 h-3" />, align: "center" },
                    { icon: <AlignRight className="w-3 h-3" />, align: "right" },
                  ].map(({ icon, align }) => (
                    <Button
                      key={align}
                      variant="ghost"
                      size="icon"
                      className={`h-7 w-7 ${selectedBlock.style?.textAlign === align ? "bg-white/20 text-white" : "text-white/50 hover:text-white"}`}
                      onClick={() => updateBlockStyle(selectedBlock.id, { textAlign: align })}
                    >
                      {icon}
                    </Button>
                  ))}
                  <div className="w-px h-5 bg-white/10 mx-0.5" />
                  {/* Font size */}
                  <select
                    value={selectedBlock.style?.fontSize || 18}
                    onChange={(e) => updateBlockStyle(selectedBlock.id, { fontSize: parseInt(e.target.value) })}
                    className="h-7 bg-white/10 border-none text-white text-xs rounded px-1 w-16"
                  >
                    {[10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72].map((s) => (
                      <option key={s} value={s} className="bg-[#111827]">{s}px</option>
                    ))}
                  </select>
                  {/* Text color */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <label className="cursor-pointer h-7 w-7 flex items-center justify-center rounded hover:bg-white/10">
                        <div
                          className="w-4 h-4 rounded border border-white/20"
                          style={{ background: selectedBlock.style?.color || "#ffffff" }}
                        />
                        <input
                          type="color"
                          value={selectedBlock.style?.color || "#ffffff"}
                          onChange={(e) => updateBlockStyle(selectedBlock.id, { color: e.target.value })}
                          className="sr-only"
                        />
                      </label>
                    </TooltipTrigger>
                    <TooltipContent>Text color</TooltipContent>
                  </Tooltip>
                </div>
              )}

              {selectedBlock && (
                <>
                  <div className="w-px h-5 bg-white/10 mx-1" />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-white/50 hover:text-white"
                        onClick={() => duplicateBlock(selectedBlock.id)}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Duplicate</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-400/70 hover:text-red-400"
                        onClick={() => deleteBlock(selectedBlock.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete (Del)</TooltipContent>
                  </Tooltip>
                </>
              )}
            </div>

            {/* Background color picker dropdown */}
            {showBgPicker && (
              <div className="absolute z-50 mt-10 ml-4 bg-[#111827] border border-white/10 rounded-xl p-3 shadow-2xl">
                <p className="text-xs text-white/50 mb-2">Slide Background</p>
                <div className="flex flex-wrap gap-2 w-48">
                  {BG_PRESETS.map((color) => (
                    <button
                      key={color}
                      onClick={() => { setSlideBackground(color); setShowBgPicker(false); }}
                      className={`w-8 h-8 rounded-lg border-2 transition-all ${slideBackground === color ? "border-[#4ad9e0]" : "border-transparent"}`}
                      style={{ background: color }}
                    />
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <label className="text-xs text-white/50">Custom:</label>
                  <input
                    type="color"
                    value={slideBackground}
                    onChange={(e) => setSlideBackground(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer bg-transparent border-none"
                  />
                </div>
              </div>
            )}

            {/* Canvas */}
            <div
              ref={canvasHostRef}
              className="flex-1 overflow-auto bg-[#070d1a] flex items-center justify-center p-8"
              onClick={() => setShowBgPicker(false)}
            >
              <div
                style={{
                  width: CANVAS_W,
                  height: CANVAS_H,
                  transform: `scale(${canvasScale})`,
                  transformOrigin: "top left",
                }}
                className="relative shadow-2xl shadow-black/60 rounded-lg overflow-hidden"
              >
                <div
                  ref={canvasRef}
                  style={{ width: CANVAS_W, height: CANVAS_H, background: slideBackground }}
                  className="relative select-none"
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onClick={handleCanvasClick}
                >
                  {!readError && slideContent.blocks.map((block) => (
                    <BlockElement
                      key={block.id}
                      block={block}
                      isSelected={selectedBlockId === block.id}
                      isEditing={editingBlockId === block.id}
                      onMouseDown={(e) => handleBlockMouseDown(e, block.id)}
                      onDoubleClick={() => {
                        if (block.type === "text" || block.type === "button") {
                          setEditingBlockId(block.id);
                        }
                      }}
                      onContentChange={(content) => updateBlock(block.id, { content })}
                      onBlur={() => setEditingBlockId(null)}
                      onResizeMouseDown={(e) => handleResizeMouseDown(e, block.id)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Properties Panel (right) ──────────────────────────────────────── */}
          <div className="w-56 border-l border-white/10 bg-[#0d1117] flex flex-col overflow-y-auto shrink-0">
            <div className="p-3 border-b border-white/10">
              <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Properties</span>
            </div>

            {selectedBlock ? (
              <div className="p-3 space-y-4">
                <CreatorInspector block={selectedBlock} orgId={orgId ?? undefined} slides={slides.filter(s => Number(s.id) !== activeSlideId).map(s => ({ id: Number(s.id), title: s.title }))} update={updates => updateBlock(selectedBlock.id, updates)} />
                {/* Position & Size */}
                <div>
                  <p className="text-[11px] text-white/40 mb-2 uppercase tracking-wider">Position & Size</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { label: "X", key: "x" as const },
                      { label: "Y", key: "y" as const },
                      { label: "W", key: "width" as const },
                      { label: "H", key: "height" as const },
                    ].map(({ label, key }) => (
                      <div key={key}>
                        <label className="text-[10px] text-white/30 block mb-0.5">{label}</label>
                        <Input
                          type="number"
                          value={Math.round(selectedBlock[key] as number)}
                          onChange={(e) => updateBlock(selectedBlock.id, { [key]: parseInt(e.target.value) || 0 })}
                          className="h-7 bg-white/5 border-white/10 text-white text-xs"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Fill / BG color */}
                {(selectedBlock.type === "shape" || selectedBlock.type === "button") && (
                  <div>
                    <p className="text-[11px] text-white/40 mb-2 uppercase tracking-wider">Fill Color</p>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <div
                        className="w-8 h-8 rounded border border-white/20"
                        style={{ background: selectedBlock.style?.backgroundColor || "#24abbc" }}
                      />
                      <input
                        type="color"
                        value={selectedBlock.style?.backgroundColor || "#24abbc"}
                        onChange={(e) => updateBlockStyle(selectedBlock.id, { backgroundColor: e.target.value })}
                        className="sr-only"
                      />
                      <span className="text-xs text-white/50">{selectedBlock.style?.backgroundColor || "#24abbc"}</span>
                    </label>
                  </div>
                )}

                {/* Border radius */}
                {(selectedBlock.type === "shape" || selectedBlock.type === "button") && (
                  <div>
                    <p className="text-[11px] text-white/40 mb-2 uppercase tracking-wider">Border Radius</p>
                    <Input
                      type="number"
                      value={selectedBlock.style?.borderRadius || 0}
                      onChange={(e) => updateBlockStyle(selectedBlock.id, { borderRadius: parseInt(e.target.value) || 0 })}
                      className="h-7 bg-white/5 border-white/10 text-white text-xs"
                    />
                  </div>
                )}

                {/* Opacity */}
                <div>
                  <p className="text-[11px] text-white/40 mb-2 uppercase tracking-wider">Opacity</p>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    value={Math.round((selectedBlock.style?.opacity ?? 1) * 100)}
                    onChange={(e) => updateBlockStyle(selectedBlock.id, { opacity: parseInt(e.target.value) / 100 })}
                    className="w-full accent-[#24abbc]"
                  />
                  <span className="text-xs text-white/40">{Math.round((selectedBlock.style?.opacity ?? 1) * 100)}%</span>
                </div>
              </div>
            ) : (
              <div className="p-3 space-y-4">
                <CreatorProjectSettings raw={project.settingsJson} orgId={orgId ?? undefined} save={raw => updateProjectMutation.mutateAsync({ id: projectId, settingsJson: raw })} />
                <div>
                  <p className="text-[11px] text-white/40 mb-2 uppercase tracking-wider">Slide Info</p>
                  <p className="text-xs text-white/60">
                    {slides.findIndex((s) => Number(s.id) === activeSlideId) + 1} of {slides.length} slides
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-white/40 mb-2 uppercase tracking-wider">Blocks</p>
                  <p className="text-xs text-white/60">{slideContent.blocks.length} block{slideContent.blocks.length !== 1 ? "s" : ""}</p>
                </div>
                <label className="block text-xs">Next-slide branch<select aria-label="Next slide branch" className="mt-1 w-full rounded bg-[#12324a] p-1" value={nextSlideId ?? ""} onChange={e => setNextSlideId(e.target.value ? Number(e.target.value) : null)}><option value="">Sequential</option>{slides.filter(s => Number(s.id) !== activeSlideId).map(s => <option key={s.id} value={Number(s.id)}>{s.title}</option>)}</select></label>
                <div className="text-xs text-white/30 leading-relaxed">
                  Click a block to select it, double-click to edit text.
                </div>
              </div>
            )}
            <label className="block p-3 text-xs text-white/70">Slide notes / editable narration script<textarea aria-label="Creator slide notes" maxLength={200000} value={slideNotes} onChange={e => { setSlideNotes(e.target.value); dirtyRef.current = true; }} className="mt-1 block w-full min-h-24 bg-white/5 rounded p-2" /></label>
          </div>
        </div>

        {/* ── Export Dialog ─────────────────────────────────────────────────────── */}
        <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
          <DialogContent className="bg-[#111827] border-white/10 text-white max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">Export Course Package</DialogTitle><DialogDescription className="text-xs text-white/60">Export your saved draft; this does not create a school delivery record.</DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <p className="text-sm text-white/60">
                Choose an export format. The package will be downloaded as a ZIP file ready to upload to any LMS.
              </p>

              {[
                { value: "scorm12" as const, label: "SCORM 1.2", desc: "Most widely supported — works with Moodle, Blackboard, TalentLMS, and most legacy LMSes", icon: <FileArchive className="w-5 h-5" /> },
                { value: "scorm2004" as const, label: "SCORM 2004", desc: "Advanced tracking — supports sequencing, branching, and richer reporting", icon: <FileCode className="w-5 h-5" /> },
                { value: "html5" as const, label: "HTML5 / Web", desc: "Standalone web package — host anywhere, no LMS required", icon: <Globe className="w-5 h-5" /> },
              ].map(({ value, label, desc, icon }) => (
                <button
                  key={value}
                  onClick={() => setExportFormat(value)}
                  className={`w-full rounded-xl border p-3 text-left flex items-start gap-3 transition-all ${
                    exportFormat === value
                      ? "border-[#24abbc] bg-[#24abbc]/10"
                      : "border-white/10 bg-white/5 hover:border-white/20"
                  }`}
                >
                  <div className={`mt-0.5 ${exportFormat === value ? "text-[#4ad9e0]" : "text-white/40"}`}>{icon}</div>
                  <div>
                    <p className="text-sm font-semibold text-white">{label}</p>
                    <p className="text-xs text-white/40 mt-0.5">{desc}</p>
                  </div>
                </button>
              ))}
              <label className="flex items-start gap-2 text-sm text-white/80">
                <input type="checkbox" checked={saveToMediaLibrary} onChange={(event) => setSaveToMediaLibrary(event.target.checked)} disabled={isExporting} className="mt-1 accent-[#24abbc]" />
                <span>Also save to my organization's Course360 Media Library<span className="block text-xs text-white/40 mt-1">Uses your main Course360 account's library and storage allowance, not Studio storage.</span></span>
              </label>
            </div>

            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setShowExportDialog(false)}
                className="text-white/60 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (exportLock.current) return; exportLock.current = true; setIsExporting(true);
                  try { if (activeSlideId) await saveCurrentSlide(activeSlideId, false); await exportMutation.mutateAsync({ projectId, format: exportFormat, saveToMediaLibrary }); }
                  catch { setIsExporting(false); } finally { exportLock.current = false; }
                }}
                disabled={isExporting}
                className="bg-[#24abbc] hover:bg-[#4ad9e0] text-white font-semibold"
              >
                {isExporting ? "Exporting..." : "Export Package"}
                <Download className="ml-2 w-4 h-4" />
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={showPreview} onOpenChange={setShowPreview}><DialogContent className="h-[85vh] max-w-6xl bg-[#071a2b] text-white"><DialogHeader><DialogTitle>Exact learner runtime preview</DialogTitle><DialogDescription className="text-xs text-white/60">The same packaged runtime, controls, scoring, branching and watermark rules as exports. Preview does not publish.</DialogDescription></DialogHeader><iframe title="Creator learner preview" sandbox="allow-scripts allow-popups" srcDoc={previewHtml} className="h-full w-full border-0" /></DialogContent></Dialog>
      </div>
    </TooltipProvider>
  );
}

// ─── Block Element — shared renderer under preserved editor selection/resize shell ───
function BlockElement({ block, isSelected, isEditing, onMouseDown, onDoubleClick, onContentChange, onBlur, onResizeMouseDown }: {
  block: Block; isSelected: boolean; isEditing: boolean; onMouseDown: (e: React.MouseEvent | React.PointerEvent) => void; onDoubleClick: () => void; onContentChange: (content: string) => void; onBlur: () => void; onResizeMouseDown: (e: React.MouseEvent | React.PointerEvent) => void;
}) {
  return <div data-creator-editor-block={block.id} style={{ position: "absolute", left: block.x, top: block.y, width: block.width, height: block.height, cursor: isEditing ? "text" : "move", touchAction: "none", outline: isSelected ? "2px solid #24abbc" : "none", outlineOffset: 1, zIndex: Number(block.style?.zIndex) || 1 }} onPointerDown={e => { if (e.pointerType !== "mouse") onMouseDown(e); }} onMouseDown={onMouseDown} onDoubleClick={onDoubleClick}>
    {isEditing && (block.type === "text" || block.type === "button") ? <textarea aria-label="Edit block text" autoFocus value={block.content || ""} onChange={e => onContentChange(e.target.value)} onBlur={onBlur} style={{ width: "100%", height: "100%", background: "#12324a", color: "white", border: 0, fontSize: Number(block.style?.fontSize) || 18 }} /> : <div style={{ width: "100%", height: "100%", pointerEvents: "none" }}><CreatorBlockView block={block} /></div>}
    {isSelected && <div aria-label="Resize selected block" style={{ position: "absolute", bottom: -4, right: -4, width: 12, height: 12, background: "#24abbc", cursor: "se-resize", borderRadius: 2 }} onPointerDown={e => { if (e.pointerType !== "mouse") onResizeMouseDown(e); }} onMouseDown={onResizeMouseDown} />}
  </div>;
}
