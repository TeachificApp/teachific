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

// ─── Types ────────────────────────────────────────────────────────────────────
interface Block {
  id: string;
  type: "text" | "image" | "shape" | "button";
  x: number;
  y: number;
  width: number;
  height: number;
  content?: string;
  src?: string;
  style?: {
    fontSize?: number;
    fontWeight?: string;
    fontStyle?: string;
    textDecoration?: string;
    color?: string;
    textAlign?: string;
    backgroundColor?: string;
    borderRadius?: number;
    opacity?: number;
  };
}

interface SlideData {
  blocks: Block[];
}

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

  // Project & slides data
  const { data: project, isLoading: projectLoading } = trpc.authoring.getProject.useQuery({ id: projectId });
  const { data: slides = [], isLoading: slidesLoading } = trpc.authoring.listSlides.useQuery({ projectId });

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

  // Init active slide when slides load
  useEffect(() => {
    if (slides.length > 0 && activeSlideId === null) {
      const first = slides[0];
      setActiveSlideId(Number(first.id));
      loadSlide(first);
    }
  }, [slides]);

  useEffect(() => {
    if (project) setProjectTitle(project.title);
  }, [project]);

  function loadSlide(slide: (typeof slides)[0]) {
    try {
      const parsed = JSON.parse(slide.contentJson || "{}");
      setSlideContent({ blocks: parsed.blocks || [] });
    } catch {
      setSlideContent({ blocks: [] });
    }
    setSlideBackground(slide.background || "#0f172a");
    setSlideTitle(slide.title);
    setSelectedBlockId(null);
    setEditingBlockId(null);
  }

  function switchSlide(slide: (typeof slides)[0]) {
    // Auto-save current slide before switching
    if (activeSlideId !== null) {
      saveCurrentSlide(activeSlideId, false);
    }
    setActiveSlideId(Number(slide.id));
    loadSlide(slide);
  }

  async function saveCurrentSlide(slideId: number, showToast = true) {
    setIsSaving(true);
    try {
      await updateSlideMutation.mutateAsync({
        id: slideId,
        contentJson: JSON.stringify(slideContent),
        background: slideBackground,
        title: slideTitle,
      });
      if (showToast) toast.success("Saved");
    } finally {
      setIsSaving(false);
    }
  }

  // ── Block manipulation ────────────────────────────────────────────────────

  function addBlock(type: Block["type"]) {
    const block = newBlock(type);
    setSlideContent((prev) => ({ blocks: [...prev.blocks, block] }));
    setSelectedBlockId(block.id);
  }

  function updateBlock(id: string, updates: Partial<Block>) {
    setSlideContent((prev) => ({
      blocks: prev.blocks.map((b) => (b.id === id ? { ...b, ...updates } : b)),
    }));
  }

  function updateBlockStyle(id: string, styleUpdates: Partial<Block["style"]>) {
    setSlideContent((prev) => ({
      blocks: prev.blocks.map((b) =>
        b.id === id ? { ...b, style: { ...b.style, ...styleUpdates } } : b
      ),
    }));
  }

  function deleteBlock(id: string) {
    setSlideContent((prev) => ({ blocks: prev.blocks.filter((b) => b.id !== id) }));
    setSelectedBlockId(null);
  }

  function duplicateBlock(id: string) {
    const block = slideContent.blocks.find((b) => b.id === id);
    if (!block) return;
    const newB = { ...block, id: `block-${Date.now()}`, x: block.x + 20, y: block.y + 20 };
    setSlideContent((prev) => ({ blocks: [...prev.blocks, newB] }));
    setSelectedBlockId(newB.id);
  }

  // ── Drag ─────────────────────────────────────────────────────────────────

  function getCanvasScale() {
    if (!canvasRef.current) return 1;
    return canvasRef.current.getBoundingClientRect().width / CANVAS_W;
  }

  function handleBlockMouseDown(e: React.MouseEvent, blockId: string) {
    if (editingBlockId === blockId) return;
    e.stopPropagation();
    setSelectedBlockId(blockId);
    const block = slideContent.blocks.find((b) => b.id === blockId);
    if (!block) return;
    const scale = getCanvasScale();
    setDragOffset({
      x: e.clientX / scale - block.x,
      y: e.clientY / scale - block.y,
    });
    setIsDragging(true);
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

  function handleResizeMouseDown(e: React.MouseEvent, blockId: string) {
    e.stopPropagation();
    e.preventDefault();
    const block = slideContent.blocks.find((b) => b.id === blockId);
    if (!block) return;
    setIsResizing(true);
    setSelectedBlockId(blockId);
    setResizeStart({ x: e.clientX, y: e.clientY, w: block.width, h: block.height });
    const scale = getCanvasScale();
    const onMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - e.clientX) / scale;
      const dy = (ev.clientY - e.clientY) / scale;
      updateBlock(blockId, {
        width: Math.max(40, resizeStart.w + dx),
        height: Math.max(20, resizeStart.h + dy),
      });
    };
    const onUp = () => {
      setIsResizing(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  const selectedBlock = slideContent.blocks.find((b) => b.id === selectedBlockId) ?? null;
  const activeSlide = slides.find((s) => Number(s.id) === activeSlideId) ?? null;

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (editingBlockId) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedBlockId) {
        deleteBlock(selectedBlockId);
      }
      if (e.key === "Escape") {
        setSelectedBlockId(null);
        setEditingBlockId(null);
      }
      if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (activeSlideId) saveCurrentSlide(activeSlideId);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedBlockId, editingBlockId, activeSlideId, slideContent, slideBackground, slideTitle]);

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
          <p className="text-white/50 mb-4">Project not found</p>
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
          <Link href="/creator">
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-white/60 hover:text-white"
                onClick={() => activeSlideId && saveCurrentSlide(activeSlideId)}
                disabled={isSaving}
              >
                <Save className="w-4 h-4 mr-1.5" />
                Save
              </Button>
            </TooltipTrigger>
            <TooltipContent>Save (Ctrl+S)</TooltipContent>
          </Tooltip>

          <Button
            size="sm"
            className="h-8 bg-[#24abbc] hover:bg-[#4ad9e0] text-white font-semibold"
            onClick={() => setShowExportDialog(true)}
          >
            <Download className="w-4 h-4 mr-1.5" />
            Export
          </Button>
        </div>

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
                    onClick={() => {
                      if (activeSlideId) saveCurrentSlide(activeSlideId, false);
                      addSlideMutation.mutate({
                        projectId,
                        afterIndex: activeSlide ? activeSlide.slideIndex : undefined,
                      });
                    }}
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
                            if (activeSlideId) saveCurrentSlide(activeSlideId, false);
                            addSlideMutation.mutate({ projectId, afterIndex: slide.slideIndex });
                          }}
                        >
                          <Plus className="w-3.5 h-3.5 mr-2" /> Add After
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-white/10" />
                        <DropdownMenuItem
                          className="text-red-400 hover:bg-red-500/10 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (slides.length <= 1) {
                              toast.error("Cannot delete the only slide");
                              return;
                            }
                            deleteSlideMutation.mutate({ id: Number(slide.id) });
                            if (Number(slide.id) === activeSlideId) {
                              const other = slides.find((s) => Number(s.id) !== Number(slide.id));
                              if (other) {
                                setActiveSlideId(Number(other.id));
                                loadSlide(other);
                              }
                            }
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
            <div className="h-10 border-b border-white/10 bg-[#0d1117] flex items-center px-4 gap-1 shrink-0">
              {/* Add blocks */}
              {[
                { type: "text" as const, icon: <Type className="w-3.5 h-3.5" />, label: "Text" },
                { type: "image" as const, icon: <ImageIcon className="w-3.5 h-3.5" />, label: "Image" },
                { type: "shape" as const, icon: <Square className="w-3.5 h-3.5" />, label: "Shape" },
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
              className="flex-1 overflow-auto bg-[#070d1a] flex items-center justify-center p-8"
              onClick={() => setShowBgPicker(false)}
            >
              <div
                style={{
                  width: CANVAS_W,
                  height: CANVAS_H,
                  transform: `scale(${Math.min(1, (window.innerWidth - 300) / CANVAS_W)})`,
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
                  {slideContent.blocks.map((block) => (
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
                <div className="text-xs text-white/30 leading-relaxed">
                  Click a block to select it, double-click to edit text.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Export Dialog ─────────────────────────────────────────────────────── */}
        <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
          <DialogContent className="bg-[#111827] border-white/10 text-white max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">Export Course Package</DialogTitle>
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
                  if (activeSlideId) await saveCurrentSlide(activeSlideId, false);
                  setIsExporting(true);
                  exportMutation.mutate({ projectId, format: exportFormat, saveToMediaLibrary });
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
      </div>
    </TooltipProvider>
  );
}

// ─── Block Element ────────────────────────────────────────────────────────────
function BlockElement({
  block,
  isSelected,
  isEditing,
  onMouseDown,
  onDoubleClick,
  onContentChange,
  onBlur,
  onResizeMouseDown,
}: {
  block: Block;
  isSelected: boolean;
  isEditing: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
  onContentChange: (content: string) => void;
  onBlur: () => void;
  onResizeMouseDown: (e: React.MouseEvent) => void;
}) {
  const baseStyle: React.CSSProperties = {
    position: "absolute",
    left: block.x,
    top: block.y,
    width: block.width,
    height: block.height,
    cursor: isEditing ? "text" : "move",
    userSelect: isEditing ? "text" : "none",
    opacity: block.style?.opacity ?? 1,
    outline: isSelected ? "2px solid #24abbc" : "none",
    outlineOffset: "1px",
  };

  if (block.type === "text") {
    return (
      <div
        style={{
          ...baseStyle,
          fontSize: block.style?.fontSize || 18,
          fontWeight: block.style?.fontWeight || "normal",
          fontStyle: block.style?.fontStyle || "normal",
          textDecoration: block.style?.textDecoration || "none",
          color: block.style?.color || "#ffffff",
          textAlign: (block.style?.textAlign as React.CSSProperties["textAlign"]) || "left",
          padding: "4px 8px",
          overflow: "hidden",
          wordBreak: "break-word",
        }}
        onMouseDown={onMouseDown}
        onDoubleClick={onDoubleClick}
      >
        {isEditing ? (
          <div
            contentEditable
            suppressContentEditableWarning
            onInput={(e) => onContentChange((e.target as HTMLElement).innerText)}
            onBlur={onBlur}
            style={{ outline: "none", minHeight: "1em" }}
            autoFocus
            dangerouslySetInnerHTML={{ __html: block.content || "" }}
          />
        ) : (
          block.content || <span style={{ opacity: 0.3 }}>Click to edit text</span>
        )}
        {isSelected && (
          <div
            style={{ position: "absolute", bottom: -4, right: -4, width: 10, height: 10, background: "#24abbc", cursor: "se-resize", borderRadius: 2 }}
            onMouseDown={onResizeMouseDown}
          />
        )}
      </div>
    );
  }

  if (block.type === "shape") {
    return (
      <div
        style={{
          ...baseStyle,
          background: block.style?.backgroundColor || "#24abbc",
          borderRadius: block.style?.borderRadius || 0,
        }}
        onMouseDown={onMouseDown}
      >
        {isSelected && (
          <div
            style={{ position: "absolute", bottom: -4, right: -4, width: 10, height: 10, background: "#24abbc", cursor: "se-resize", borderRadius: 2 }}
            onMouseDown={onResizeMouseDown}
          />
        )}
      </div>
    );
  }

  if (block.type === "button") {
    return (
      <div
        style={{
          ...baseStyle,
          background: block.style?.backgroundColor || "#24abbc",
          borderRadius: block.style?.borderRadius || 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: block.style?.color || "#ffffff",
          fontSize: block.style?.fontSize || 16,
          fontWeight: "600",
          padding: "4px 12px",
        }}
        onMouseDown={onMouseDown}
        onDoubleClick={onDoubleClick}
      >
        {isEditing ? (
          <div
            contentEditable
            suppressContentEditableWarning
            onInput={(e) => onContentChange((e.target as HTMLElement).innerText)}
            onBlur={onBlur}
            style={{ outline: "none" }}
            autoFocus
            dangerouslySetInnerHTML={{ __html: block.content || "" }}
          />
        ) : (
          block.content || "Button"
        )}
        {isSelected && (
          <div
            style={{ position: "absolute", bottom: -4, right: -4, width: 10, height: 10, background: "#24abbc", cursor: "se-resize", borderRadius: 2 }}
            onMouseDown={onResizeMouseDown}
          />
        )}
      </div>
    );
  }

  if (block.type === "image") {
    return (
      <div
        style={{ ...baseStyle, border: "2px dashed rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8 }}
        onMouseDown={onMouseDown}
      >
        <ImageIcon className="w-8 h-8 text-white/20" />
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Image placeholder</span>
        {isSelected && (
          <div
            style={{ position: "absolute", bottom: -4, right: -4, width: 10, height: 10, background: "#24abbc", cursor: "se-resize", borderRadius: 2 }}
            onMouseDown={onResizeMouseDown}
          />
        )}
      </div>
    );
  }

  return null;
}
