import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LessonBannerEditor, { BannerConfig } from "./LessonBannerEditor";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import RichTextEditor from "@/components/RichTextEditor";
import {
  Video,
  FileText,
  HelpCircle,
  FileArchive,
  Music,
  Download,
  Eye,
  Edit,
  CheckCircle,
  Users,
  Clock,
  Lock,
  Unlock,
  Upload,
  Link,
  Plus,
  Trash2,
  X,
  Sparkles,
  FolderOpen,
  Search,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Lesson {
  id: number;
  title: string;
  lessonType: string;
  contentJson?: string | null;
  videoUrl?: string | null;
  videoProvider?: string | null;
  packageId?: number | null;
  quizId?: number | null;
  isFreePreview?: boolean | null;
  isPublished?: boolean | null;
  durationSeconds?: number | null;
  downloadUrl?: string | null;
  downloadFileName?: string | null;
  pdfUrl?: string | null;
  audioUrl?: string | null;
  webLinkUrl?: string | null;
  richTextAddOn?: string | null;
  liveSessionJson?: string | null;
  // Prerequisite / gating
  isPrerequisite?: boolean | null;
  requiresCompletion?: boolean | null;
  passingScore?: number | null;
  allowSkip?: boolean | null;
  estimatedMinutes?: number | null;
  // Drip
  dripDays?: number | null;
  dripDate?: Date | string | null;
  dripType?: string | null;
}

interface LessonEditorSheetProps {
  lesson: Lesson | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  orgId: number;
  courseTitle?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const LESSON_TYPE_META: Record<string, { label: string; icon: any; color: string }> = {
  video: { label: "Video", icon: Video, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  text: { label: "Text / Rich Content", icon: FileText, color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  scorm: { label: "SCORM / HTML5", icon: FileArchive, color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  quiz: { label: "Quiz", icon: HelpCircle, color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  flashcard: { label: "Flashcards", icon: FileText, color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  exam: { label: "Exam", icon: CheckCircle, color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  pdf: { label: "PDF", icon: FileText, color: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" },
  audio: { label: "Audio", icon: Music, color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" },
  assignment: { label: "Assignment", icon: Edit, color: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400" },
  download: { label: "Download", icon: Download, color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400" },
  weblink: { label: "Web Link / Embed", icon: Eye, color: "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400" },
  zoom: { label: "Zoom / Live Session", icon: Users, color: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400" },
};

function formatSeconds(s: number | null | undefined): string {
  if (!s) return "";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function parseSeconds(val: string): number | undefined {
  if (!val) return undefined;
  const parts = val.split(":");
  if (parts.length === 2) {
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  }
  return parseInt(val) || undefined;
}

// ─── Flashcard editor ────────────────────────────────────────────────────────

function FlashcardEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [cards, setCards] = useState<{ front: string; back: string }[]>(() => {
    try {
      const parsed = JSON.parse(value || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const update = useCallback(
    (newCards: { front: string; back: string }[]) => {
      setCards(newCards);
      onChange(JSON.stringify(newCards));
    },
    [onChange]
  );

  const addCard = () => update([...cards, { front: "", back: "" }]);
  const removeCard = (i: number) => update(cards.filter((_, idx) => idx !== i));
  const updateCard = (i: number, field: "front" | "back", val: string) => {
    const next = cards.map((c, idx) => (idx === i ? { ...c, [field]: val } : c));
    update(next);
  };

  return (
    <div className="flex flex-col gap-3">
      {cards.map((card, i) => (
        <div key={i} className="border border-border rounded-lg p-3 flex flex-col gap-2 relative">
          <button
            type="button"
            onClick={() => removeCard(i)}
            className="absolute top-2 right-2 text-muted-foreground hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <div>
            <Label className="text-xs text-muted-foreground">Front</Label>
            <Textarea
              value={card.front}
              onChange={(e) => updateCard(i, "front", e.target.value)}
              placeholder="Question or term..."
              rows={2}
              className="mt-1 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Back</Label>
            <Textarea
              value={card.back}
              onChange={(e) => updateCard(i, "back", e.target.value)}
              placeholder="Answer or definition..."
              rows={2}
              className="mt-1 text-sm"
            />
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addCard} className="gap-1.5 self-start">
        <Plus className="h-3.5 w-3.5" />
        Add Card
      </Button>
      <p className="text-xs text-muted-foreground">{cards.length} card{cards.length !== 1 ? "s" : ""}</p>
    </div>
  );
}

// ─── Media Library Picker Modal ─────────────────────────────────────────────

function MediaLibraryPickerModal({
  open,
  onClose,
  onSelect,
  orgId,
  accept,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string, filename: string) => void;
  orgId: number;
  accept: string; // e.g. "audio/*", "video/*", ".pdf", "*"
}) {
  const [search, setSearch] = useState("");

  // Derive type filter from accept string
  const typeFilter: string = (() => {
    if (accept.startsWith("audio")) return "audio";
    if (accept.startsWith("video")) return "video";
    if (accept.includes("pdf")) return "document";
    if (accept.startsWith("image")) return "image";
    return "all";
  })();

  const { data: mediaItems = [], isLoading } = trpc.lms.media.listOrgMedia.useQuery(
    { orgId },
    { enabled: open && orgId > 0 }
  );

  const items = mediaItems.filter((item) => {
    const matchesType =
      typeFilter === "all" ||
      (typeFilter === "audio" && item.mimeType.startsWith("audio/")) ||
      (typeFilter === "video" && item.mimeType.startsWith("video/")) ||
      (typeFilter === "image" && item.mimeType.startsWith("image/")) ||
      (typeFilter === "document" && (item.mimeType === "application/pdf" || item.mimeType.includes("word") || item.mimeType.includes("presentation")));
    const matchesSearch = !search || item.filename.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pick from Media Library</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search files..."
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-border rounded-md bg-background outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
        <ScrollArea className="h-80">
          {isLoading && (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              Loading media...
            </div>
          )}
          {!isLoading && items.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
              <FolderOpen className="h-8 w-8 opacity-40" />
              <p className="text-sm">
                {search ? "No files match your search" : "No media files uploaded yet"}
              </p>
            </div>
          )}
          {!isLoading && items.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 pr-2">
              {items.map((item) => {
                const isImg = item.mimeType.startsWith("image/");
                const isVid = item.mimeType.startsWith("video/");
                return (
                  <button
                    key={item.id}
                    onClick={() => { onSelect(item.url, item.filename); onClose(); }}
                    className="group flex flex-col border border-border rounded-lg overflow-hidden hover:border-primary/60 hover:shadow-sm transition-all text-left"
                  >
                    <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                      {isImg ? (
                        <img src={item.url} alt={item.filename} className="w-full h-full object-cover" loading="lazy" />
                      ) : isVid ? (
                        <video src={item.url} className="w-full h-full object-cover" muted preload="metadata" />
                      ) : (
                        <div className="flex flex-col items-center gap-1 p-2">
                          <FileText className="h-8 w-8 text-muted-foreground/60" />
                          <span className="text-[9px] text-muted-foreground uppercase">
                            {item.mimeType.split("/").pop()?.split(".").pop() ?? "file"}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="p-1.5">
                      <p className="text-[10px] font-medium truncate" title={item.filename}>
                        {item.filename}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── File upload helper ───────────────────────────────────────────────────────

function FileUploadField({
  label,
  value,
  onChange,
  accept,
  orgId,
  contentType,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  accept: string;
  orgId: number;
  contentType: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setProgress(0);
    try {
      // Chunked upload — 5 MB pieces to bypass proxy timeout on large video/audio files
      const CHUNK_SIZE = 5 * 1024 * 1024;
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      const folder = contentType.startsWith("video") ? "lms-video" : "lms-media";

      // 1. Initiate
      const initRes = await fetch("/api/chunked/media/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ totalChunks, filename: file.name, totalBytes: file.size, orgId, folder, contentType }),
      });
      if (!initRes.ok) {
        const err = await initRes.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to initiate upload");
      }
      const { uploadId } = await initRes.json();

      // 2. Upload chunks
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunkForm = new FormData();
        chunkForm.append("chunk", file.slice(start, end), file.name);
        chunkForm.append("chunkIndex", String(i));
        const chunkRes = await fetch(`/api/chunked/media/chunk/${uploadId}`, {
          method: "POST",
          credentials: "include",
          body: chunkForm,
        });
        if (!chunkRes.ok) {
          const err = await chunkRes.json().catch(() => ({}));
          throw new Error(err.error ?? `Chunk ${i} failed`);
        }
        setProgress(Math.round(((i + 1) / totalChunks) * 100));
      }

      // 3. Finalize
      const finalRes = await fetch(`/api/chunked/media/finalize/${uploadId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      if (!finalRes.ok) {
        const err = await finalRes.json().catch(() => ({}));
        throw new Error(err.error ?? "Finalize failed");
      }
      const data = await finalRes.json();
      const url: string = data.url;

      onChange(url);
      toast.success("File uploaded successfully");
    } catch (err: any) {
      toast.error("Upload failed: " + (err.message ?? "Unknown error"));
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Paste URL or upload file..."
          className="flex-1"
        />
        <label className="cursor-pointer">
          <input
            type="file"
            accept={accept}
            className="hidden"
            onChange={handleFile}
            disabled={uploading}
          />
          <Button type="button" variant="outline" size="sm" disabled={uploading} asChild>
            <span>
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              {uploading ? (progress > 0 ? `${progress}%` : "Uploading...") : "Upload"}
            </span>
          </Button>
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPickerOpen(true)}
          title="Pick from Media Library"
        >
          <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
          Library
        </Button>
      </div>
      {uploading && progress > 0 && (
        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-primary h-1.5 rounded-full transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      <MediaLibraryPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(url) => { onChange(url); toast.success("File inserted from media library"); }}
        orgId={orgId}
        accept={accept}
      />
    </div>
  );
}

// ─── Lesson type content editors ─────────────────────────────────────────────

function VideoEditor({
  form,
  set,
  orgId,
}: {
  form: any;
  set: (k: string, v: any) => void;
  orgId: number;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label>Video Provider</Label>
        <Select value={form.videoProvider ?? "youtube"} onValueChange={(v) => set("videoProvider", v)}>
          <SelectTrigger className="mt-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="youtube">YouTube</SelectItem>
            <SelectItem value="vimeo">Vimeo</SelectItem>
            <SelectItem value="wistia">Wistia</SelectItem>
            <SelectItem value="upload">Direct Upload / URL</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>
          {form.videoProvider === "youtube"
            ? "YouTube URL or Video ID"
            : form.videoProvider === "vimeo"
            ? "Vimeo URL or Video ID"
            : form.videoProvider === "wistia"
            ? "Wistia Video URL"
            : "Video URL"}
        </Label>
        <Input
          value={form.videoUrl ?? ""}
          onChange={(e) => set("videoUrl", e.target.value)}
          placeholder={
            form.videoProvider === "youtube"
              ? "https://www.youtube.com/watch?v=..."
              : form.videoProvider === "vimeo"
              ? "https://vimeo.com/..."
              : form.videoProvider === "wistia"
              ? "https://fast.wistia.net/embed/iframe/..."
              : "https://..."
          }
          className="mt-1.5"
        />
        {(form.videoProvider === "youtube" || form.videoProvider === "vimeo") && (
          <p className="text-xs text-muted-foreground mt-1">
            Paste the full URL or just the video ID
          </p>
        )}
      </div>
      {form.videoUrl && (form.videoProvider === "youtube" || !form.videoProvider) && (
        <VideoPreview url={form.videoUrl} provider={form.videoProvider ?? "youtube"} />
      )}
      {form.videoUrl && form.videoProvider === "vimeo" && (
        <VideoPreview url={form.videoUrl} provider="vimeo" />
      )}
    </div>
  );
}

function VideoPreview({ url, provider }: { url: string; provider: string }) {
  const getEmbedUrl = () => {
    if (provider === "youtube") {
      const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      const id = match?.[1] ?? url;
      return `https://www.youtube.com/embed/${id}`;
    }
    if (provider === "vimeo") {
      const match = url.match(/vimeo\.com\/(\d+)/);
      const id = match?.[1] ?? url;
      return `https://player.vimeo.com/video/${id}`;
    }
    return url;
  };

  return (
    <div className="rounded-lg overflow-hidden border border-border aspect-video bg-black">
      <iframe
        src={getEmbedUrl()}
        className="w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}

function TextEditor({ form, set, lessonTitle, courseTitle }: { form: any; set: (k: string, v: any) => void; lessonTitle?: string; courseTitle?: string }) {
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiType, setAiType] = useState<"text" | "outline" | "summary" | "quiz_questions">("text");
  const [aiPreview, setAiPreview] = useState("");
  const generateContent = trpc.lms.ai.generateLessonContent.useMutation({
    onSuccess: (data) => { setAiPreview(data.content); },
    onError: (e) => { toast.error(e.message); },
  });
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label>Content</Label>
        <button
          type="button"
          onClick={() => setAiOpen(true)}
          className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
        >
          <Sparkles className="h-3.5 w-3.5" />
          AI Generate
        </button>
      </div>
      <RichTextEditor
        value={form.contentJson ?? ""}
        onChange={(v) => set("contentJson", v)}
        placeholder="Write your lesson content here..."
        minHeight={300}
      />
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              AI Content Generator
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {(["text", "outline", "summary", "quiz_questions"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setAiType(t)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    aiType === t ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
                  }`}
                >
                  {t === "quiz_questions" ? "Quiz Questions" : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Additional context (optional)</Label>
              <Textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g. Focus on beginner-friendly explanations with real-world examples..."
                rows={2}
              />
            </div>
            {aiPreview && (
              <div className="border border-border rounded-lg p-4 bg-muted/30 max-h-64 overflow-y-auto">
                <p className="text-xs text-muted-foreground mb-2 font-medium">Preview</p>
                <div className="text-sm prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: aiPreview }} />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            {aiPreview && (
              <Button
                variant="outline"
                onClick={() => {
                  set("contentJson", aiPreview);
                  setAiOpen(false);
                  setAiPreview("");
                  toast.success("Content inserted!");
                }}
              >
                Insert Content
              </Button>
            )}
            <Button
              onClick={() => generateContent.mutate({ lessonTitle: `${lessonTitle ?? "Lesson"}${aiPrompt ? ` — ${aiPrompt}` : ""}`, courseTitle, format: aiType })}
              disabled={generateContent.isPending}
            >
              {generateContent.isPending ? "Generating..." : (aiPreview ? "Regenerate" : "Generate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AudioEditor({
  form,
  set,
  orgId,
}: {
  form: any;
  set: (k: string, v: any) => void;
  orgId: number;
}) {
  return (
    <div className="flex flex-col gap-4">
      <FileUploadField
        label="Audio File"
        value={form.audioUrl ?? ""}
        onChange={(v) => set("audioUrl", v)}
        accept="audio/*"
        orgId={orgId}
        contentType="audio/mpeg"
      />
      {form.audioUrl && (
        <audio controls className="w-full mt-1">
          <source src={form.audioUrl} />
        </audio>
      )}
    </div>
  );
}

function PdfEditor({
  form,
  set,
  orgId,
}: {
  form: any;
  set: (k: string, v: any) => void;
  orgId: number;
}) {
  return (
    <div className="flex flex-col gap-4">
      <FileUploadField
        label="PDF File"
        value={form.pdfUrl ?? ""}
        onChange={(v) => set("pdfUrl", v)}
        accept=".pdf"
        orgId={orgId}
        contentType="application/pdf"
      />
      {form.pdfUrl && (
        <a href={form.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">
          Preview PDF
        </a>
      )}
    </div>
  );
}

function ScormEditor({
  form,
  set,
  orgId,
}: {
  form: any;
  set: (k: string, v: any) => void;
  orgId: number;
}) {
  const { data: orgs } = trpc.orgs.myOrgs.useQuery();
  const { data: packages } = trpc.packages.list.useQuery({ orgId });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label>Select Content Package</Label>
        <Select
          value={form.packageId ? String(form.packageId) : ""}
          onValueChange={(v) => set("packageId", parseInt(v))}
        >
          <SelectTrigger className="mt-1.5">
            <SelectValue placeholder="Choose a SCORM / HTML5 package..." />
          </SelectTrigger>
          <SelectContent>
            {packages?.map((pkg) => (
              <SelectItem key={pkg.id} value={String(pkg.id)}>
                {pkg.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-1">
          Upload SCORM/HTML5 packages via{" "}
          <a href="/upload" className="text-primary underline">
            Upload Content
          </a>
        </p>
      </div>
    </div>
  );
}

function WebLinkEditor({ form, set }: { form: any; set: (k: string, v: any) => void }) {
  const [embedMode, setEmbedMode] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label>URL</Label>
        <Input
          value={form.webLinkUrl ?? ""}
          onChange={(e) => set("webLinkUrl", e.target.value)}
          placeholder="https://..."
          className="mt-1.5"
        />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Embed in iframe</p>
          <p className="text-xs text-muted-foreground">Show the page inside the course player</p>
        </div>
        <Switch checked={embedMode} onCheckedChange={setEmbedMode} />
      </div>
      {embedMode && form.webLinkUrl && (
        <div className="rounded-lg overflow-hidden border border-border" style={{ height: 300 }}>
          <iframe src={form.webLinkUrl} className="w-full h-full" />
        </div>
      )}
    </div>
  );
}

function DownloadEditor({
  form,
  set,
  orgId,
}: {
  form: any;
  set: (k: string, v: any) => void;
  orgId: number;
}) {
  return (
    <div className="flex flex-col gap-4">
      <FileUploadField
        label="File to Download"
        value={form.downloadUrl ?? ""}
        onChange={(v) => set("downloadUrl", v)}
        accept="*"
        orgId={orgId}
        contentType="application/octet-stream"
      />
      <div>
        <Label>Display File Name</Label>
        <Input
          value={form.downloadFileName ?? ""}
          onChange={(e) => set("downloadFileName", e.target.value)}
          placeholder="e.g. Course Workbook.pdf"
          className="mt-1.5"
        />
      </div>
    </div>
  );
}

function QuizEditor({
  form,
  set,
  orgId,
}: {
  form: any;
  set: (k: string, v: any) => void;
  orgId: number;
}) {
  const { data: quizzes } = trpc.quizzes.list.useQuery({ orgId });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label>Select Quiz</Label>
        <Select
          value={form.quizId ? String(form.quizId) : ""}
          onValueChange={(v) => set("quizId", parseInt(v))}
        >
          <SelectTrigger className="mt-1.5">
            <SelectValue placeholder="Choose a quiz..." />
          </SelectTrigger>
          <SelectContent>
            {quizzes?.map((q) => (
              <SelectItem key={q.id} value={String(q.id)}>
                {q.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-1">
          Create quizzes in the{" "}
          <a href="/quizzes" className="text-primary underline">
            Quizzes
          </a>{" "}
          section
        </p>
      </div>
    </div>
  );
}

function ExamEditor({
  form,
  set,
  orgId,
}: {
  form: any;
  set: (k: string, v: any) => void;
  orgId: number;
}) {
  const { data: quizzes } = trpc.quizzes.list.useQuery({ orgId });
  const liveJson = (() => {
    try {
      return JSON.parse(form.liveSessionJson || "{}");
    } catch {
      return {};
    }
  })();
  const setLive = (k: string, v: any) => {
    set("liveSessionJson", JSON.stringify({ ...liveJson, [k]: v }));
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label>Select Quiz / Question Bank</Label>
        <Select
          value={form.quizId ? String(form.quizId) : ""}
          onValueChange={(v) => set("quizId", parseInt(v))}
        >
          <SelectTrigger className="mt-1.5">
            <SelectValue placeholder="Choose a quiz..." />
          </SelectTrigger>
          <SelectContent>
            {quizzes?.map((q) => (
              <SelectItem key={q.id} value={String(q.id)}>
                {q.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Time Limit (minutes)</Label>
          <Input
            type="number"
            value={liveJson.timeLimit ?? ""}
            onChange={(e) => setLive("timeLimit", parseInt(e.target.value) || undefined)}
            placeholder="No limit"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label>Passing Score (%)</Label>
          <Input
            type="number"
            value={liveJson.passingScore ?? ""}
            onChange={(e) => setLive("passingScore", parseInt(e.target.value) || undefined)}
            placeholder="e.g. 70"
            className="mt-1.5"
          />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Shuffle questions</p>
        </div>
        <Switch
          checked={liveJson.shuffleQuestions ?? false}
          onCheckedChange={(v) => setLive("shuffleQuestions", v)}
        />
      </div>
    </div>
  );
}

function AssignmentEditor({ form, set }: { form: any; set: (k: string, v: any) => void }) {
  const liveJson = (() => {
    try {
      return JSON.parse(form.liveSessionJson || "{}");
    } catch {
      return {};
    }
  })();
  const setLive = (k: string, v: any) => {
    set("liveSessionJson", JSON.stringify({ ...liveJson, [k]: v }));
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label>Assignment Instructions</Label>
        <RichTextEditor
          value={form.contentJson ?? ""}
          onChange={(v) => set("contentJson", v)}
          placeholder="Describe the assignment..."
          minHeight={200}
        />
      </div>
      <div>
        <Label>Submission Type</Label>
        <Select
          value={liveJson.submissionType ?? "text"}
          onValueChange={(v) => setLive("submissionType", v)}
        >
          <SelectTrigger className="mt-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="text">Text response</SelectItem>
            <SelectItem value="file">File upload</SelectItem>
            <SelectItem value="link">URL / link</SelectItem>
            <SelectItem value="any">Any (text, file, or link)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Due Date (optional)</Label>
        <Input
          type="date"
          value={liveJson.dueDate ?? ""}
          onChange={(e) => setLive("dueDate", e.target.value)}
          className="mt-1.5"
        />
      </div>
    </div>
  );
}

function ZoomEditor({ form, set }: { form: any; set: (k: string, v: any) => void }) {
  const liveJson = (() => {
    try {
      return JSON.parse(form.liveSessionJson || "{}");
    } catch {
      return {};
    }
  })();
  const setLive = (k: string, v: any) => {
    set("liveSessionJson", JSON.stringify({ ...liveJson, [k]: v }));
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label>Platform</Label>
        <Select
          value={liveJson.platform ?? "zoom"}
          onValueChange={(v) => setLive("platform", v)}
        >
          <SelectTrigger className="mt-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="zoom">Zoom</SelectItem>
            <SelectItem value="teams">Microsoft Teams</SelectItem>
            <SelectItem value="meet">Google Meet</SelectItem>
            <SelectItem value="webex">Cisco Webex</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Meeting URL</Label>
        <Input
          value={liveJson.meetingUrl ?? ""}
          onChange={(e) => setLive("meetingUrl", e.target.value)}
          placeholder="https://zoom.us/j/..."
          className="mt-1.5"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Date & Time</Label>
          <Input
            type="datetime-local"
            value={liveJson.scheduledAt ?? ""}
            onChange={(e) => setLive("scheduledAt", e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label>Duration (minutes)</Label>
          <Input
            type="number"
            value={liveJson.durationMinutes ?? ""}
            onChange={(e) => setLive("durationMinutes", parseInt(e.target.value) || undefined)}
            placeholder="60"
            className="mt-1.5"
          />
        </div>
      </div>
      <div>
        <Label>Recurrence</Label>
        <Select
          value={liveJson.recurrence ?? "none"}
          onValueChange={(v) => setLive("recurrence", v)}
        >
          <SelectTrigger className="mt-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No recurrence (one-time)</SelectItem>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="biweekly">Bi-weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Meeting ID / Passcode (optional)</Label>
        <Input
          value={liveJson.meetingId ?? ""}
          onChange={(e) => setLive("meetingId", e.target.value)}
          placeholder="Meeting ID or passcode for students"
          className="mt-1.5"
        />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LessonEditorSheet({
  lesson,
  open,
  onClose,
  onSaved,
  orgId,
  courseTitle,
}: LessonEditorSheetProps) {
  const utils = trpc.useUtils();

  const [form, setForm] = useState<any>({});
  const [durationInput, setDurationInput] = useState("");

  useEffect(() => {
    if (lesson) {
      setForm({
        title: lesson.title ?? "",
        lessonType: lesson.lessonType ?? "text",
        contentJson: lesson.contentJson ?? "",
        videoUrl: lesson.videoUrl ?? "",
        videoProvider: lesson.videoProvider ?? "youtube",
        packageId: lesson.packageId ?? null,
        quizId: lesson.quizId ?? null,
        isFreePreview: lesson.isFreePreview ?? false,
        isPublished: lesson.isPublished ?? false,
        durationSeconds: lesson.durationSeconds ?? null,
        downloadUrl: lesson.downloadUrl ?? "",
        downloadFileName: lesson.downloadFileName ?? "",
        pdfUrl: lesson.pdfUrl ?? "",
        audioUrl: lesson.audioUrl ?? "",
        webLinkUrl: lesson.webLinkUrl ?? "",
        richTextAddOn: lesson.richTextAddOn ?? "",
        liveSessionJson: lesson.liveSessionJson ?? "{}",
        // Prerequisite / gating
        isPrerequisite: lesson.isPrerequisite ?? false,
        requiresCompletion: lesson.requiresCompletion ?? true,
        passingScore: lesson.passingScore ?? null,
        allowSkip: lesson.allowSkip ?? false,
        estimatedMinutes: lesson.estimatedMinutes ?? null,
        // Drip
        dripDays: lesson.dripDays ?? null,
        dripDate: lesson.dripDate ? new Date(lesson.dripDate).toISOString().split("T")[0] : "",
        dripType: lesson.dripType ?? "immediate",
      });
      setDurationInput(lesson.durationSeconds ? formatSeconds(lesson.durationSeconds) : "");
    }
  }, [lesson]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const updateLesson = trpc.lms.curriculum.updateLesson.useMutation({
    onSuccess: () => {
      utils.lms.curriculum.get.invalidate();
      toast.success("Lesson saved");
      onSaved();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSave = () => {
    if (!lesson) return;
    const durationSeconds = parseSeconds(durationInput);
    const rawPayload = {
      id: lesson.id,
      ...form,
      durationSeconds: durationSeconds ?? form.durationSeconds,
    };
    // Strip null values — server expects undefined (omit) for optional numeric fields
    const payload = Object.fromEntries(
      Object.entries(rawPayload).filter(([, v]) => v !== null)
    ) as typeof rawPayload;
    updateLesson.mutate(payload);
  };

  if (!lesson) return null;

  const meta = LESSON_TYPE_META[lesson.lessonType] ?? LESSON_TYPE_META.text;
  const Icon = meta.icon;

  const renderContentEditor = () => {
    switch (form.lessonType) {
      case "video":
        return <VideoEditor form={form} set={set} orgId={orgId} />;
      case "text":
        return <TextEditor form={form} set={set} lessonTitle={lesson.title} courseTitle={courseTitle} />;
      case "audio":
        return <AudioEditor form={form} set={set} orgId={orgId} />;
      case "pdf":
        return <PdfEditor form={form} set={set} orgId={orgId} />;
      case "scorm":
        return <ScormEditor form={form} set={set} orgId={orgId} />;
      case "weblink":
        return <WebLinkEditor form={form} set={set} />;
      case "download":
        return <DownloadEditor form={form} set={set} orgId={orgId} />;
      case "quiz":
        return <QuizEditor form={form} set={set} orgId={orgId} />;
      case "flashcard":
        return (
          <FlashcardEditor
            value={form.contentJson ?? "[]"}
            onChange={(v) => set("contentJson", v)}
          />
        );
      case "exam":
        return <ExamEditor form={form} set={set} orgId={orgId} />;
      case "assignment":
        return <AssignmentEditor form={form} set={set} />;
      case "zoom":
        return <ZoomEditor form={form} set={set} />;
      default:
        return <TextEditor form={form} set={set} lessonTitle={lesson.title} courseTitle={courseTitle} />;
    }
  };

  const showRichTextAddOn = !["text", "assignment", "flashcard"].includes(form.lessonType);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[85vw] flex flex-col p-0 overflow-hidden">
        <SheetHeader className="px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${meta.color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-base leading-tight truncate">{form.title || "Untitled Lesson"}</SheetTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{meta.label}</p>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          <Tabs defaultValue="content" className="flex flex-col h-full">
            <TabsList className="mx-6 mt-4 mb-0 self-start">
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
              {showRichTextAddOn && <TabsTrigger value="addon">Rich Text Add-on</TabsTrigger>}
              <TabsTrigger value="banners">Banners</TabsTrigger>
            </TabsList>

            <TabsContent value="content" className="flex-1 px-6 py-4 flex flex-col gap-4 mt-0">
              {/* Title */}
              <div>
                <Label>Lesson Title</Label>
                <Input
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <Separator />
              {/* Type-specific content */}
              {renderContentEditor()}
            </TabsContent>

            <TabsContent value="settings" className="flex-1 px-6 py-4 flex flex-col gap-5 mt-0">
              {/* Published */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Published</p>
                  <p className="text-xs text-muted-foreground">Visible to enrolled students</p>
                </div>
                <Switch
                  checked={form.isPublished ?? false}
                  onCheckedChange={(v) => set("isPublished", v)}
                />
              </div>
              <Separator />
              {/* Free preview */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <Unlock className="h-3.5 w-3.5 text-green-500" />
                    Free Preview
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Accessible without enrollment (great for marketing)
                  </p>
                </div>
                <Switch
                  checked={form.isFreePreview ?? false}
                  onCheckedChange={(v) => set("isFreePreview", v)}
                />
              </div>
              <Separator />
              {/* ── Prerequisite / Gating ── */}
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4 flex flex-col gap-4">
                <div className="flex items-start gap-2">
                  <Lock className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Course Prerequisite</p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                      When enabled, all lessons <strong>below</strong> this one are locked until this lesson is completed.
                      Students must finish this lesson before they can access subsequent lessons.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Mark as Prerequisite Gate</p>
                    <p className="text-xs text-muted-foreground">Locks lessons below until this is completed</p>
                  </div>
                  <Switch
                    checked={form.isPrerequisite ?? false}
                    onCheckedChange={(v) => set("isPrerequisite", v)}
                  />
                </div>
                {form.isPrerequisite && (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Requires Full Completion</p>
                        <p className="text-xs text-muted-foreground">Must be fully completed (not just opened)</p>
                      </div>
                      <Switch
                        checked={form.requiresCompletion ?? true}
                        onCheckedChange={(v) => set("requiresCompletion", v)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Allow Skip</p>
                        <p className="text-xs text-muted-foreground">Students can skip this lesson without completing it</p>
                      </div>
                      <Switch
                        checked={form.allowSkip ?? false}
                        onCheckedChange={(v) => set("allowSkip", v)}
                      />
                    </div>
                    {(form.lessonType === "quiz" || form.lessonType === "exam") && (
                      <div>
                        <Label className="text-sm">Minimum Passing Score (%)</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={form.passingScore ?? ""}
                          onChange={(e) => set("passingScore", e.target.value ? parseInt(e.target.value) : null)}
                          placeholder="e.g. 70 (leave blank for any score)"
                          className="mt-1.5"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Students must score at least this % to unlock the next lesson
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
              <Separator />
              {/* Duration */}
              <div>
                <Label className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Duration
                </Label>
                <Input
                  value={durationInput}
                  onChange={(e) => setDurationInput(e.target.value)}
                  placeholder="m:ss or seconds (e.g. 5:30 or 330)"
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Shown in the course sidebar next to the lesson title
                </p>
              </div>
              <div>
                <Label className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  Estimated Time (minutes)
                </Label>
                <Input
                  type="number"
                  min={1}
                  value={form.estimatedMinutes ?? ""}
                  onChange={(e) => set("estimatedMinutes", e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="e.g. 15"
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Displayed in the course outline as estimated reading/watch time
                </p>
              </div>
              <Separator />
              {/* Drip */}
              <div>
                <Label>Drip Schedule</Label>
                <Select
                  value={form.dripType ?? "immediate"}
                  onValueChange={(v) => set("dripType", v)}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">Available immediately</SelectItem>
                    <SelectItem value="days_after_enrollment">Days after enrollment</SelectItem>
                    <SelectItem value="specific_date">Specific date</SelectItem>
                  </SelectContent>
                </Select>
                {form.dripType === "days_after_enrollment" && (
                  <Input
                    type="number"
                    value={form.dripDays ?? ""}
                    onChange={(e) => set("dripDays", parseInt(e.target.value) || 0)}
                    placeholder="Number of days"
                    className="mt-2"
                  />
                )}
                {form.dripType === "specific_date" && (
                  <Input
                    type="date"
                    value={form.dripDate ?? ""}
                    onChange={(e) => set("dripDate", e.target.value)}
                    className="mt-2"
                  />
                )}
              </div>
            </TabsContent>

            {showRichTextAddOn && (
              <TabsContent value="addon" className="flex-1 px-6 py-4 flex flex-col gap-4 mt-0">
                <p className="text-sm text-muted-foreground">
                  Add supplementary rich text content below the main lesson content (e.g., notes,
                  transcripts, additional resources).
                </p>
                <RichTextEditor
                  value={form.richTextAddOn ?? ""}
                  onChange={(v) => set("richTextAddOn", v)}
                  placeholder="Add notes, transcripts, or supplementary content..."
                  minHeight={250}
                />
              </TabsContent>
            )}

            <TabsContent value="banners" className="flex-1 overflow-y-auto mt-0">
              <LessonBannerEditor
                lessonId={lesson?.id ?? 0}
                orgId={orgId}
                startBanner={{
                  enabled: form.startBannerEnabled ?? false,
                  position: form.startBannerPosition ?? "top",
                  message: form.startBannerMessage ?? "",
                  imageUrl: form.startBannerImageUrl ?? "",
                  sound: form.startBannerSound ?? "none",
                  customSoundUrl: form.startBannerCustomSoundUrl ?? "",
                  confetti: form.startBannerConfetti ?? false,
                  confettiStyle: (form.startBannerConfettiStyle ?? "burst") as any,
                  durationMs: form.startBannerDurationMs ?? 5000,
                }}
                completeBanner={{
                  enabled: form.completeBannerEnabled ?? false,
                  position: form.completeBannerPosition ?? "bottom",
                  message: form.completeBannerMessage ?? "",
                  imageUrl: form.completeBannerImageUrl ?? "",
                  sound: form.completeBannerSound ?? "none",
                  customSoundUrl: form.completeBannerCustomSoundUrl ?? "",
                  confetti: form.completeBannerConfetti ?? false,
                  confettiStyle: (form.completeBannerConfettiStyle ?? "burst") as any,
                  durationMs: form.completeBannerDurationMs ?? 5000,
                }}
                onSave={(start: BannerConfig, complete: BannerConfig) => {
                  setForm((f: any) => ({
                    ...f,
                    startBannerEnabled: start.enabled,
                    startBannerPosition: start.position,
                    startBannerMessage: start.message,
                    startBannerImageUrl: start.imageUrl,
                    startBannerSound: start.sound,
                    startBannerCustomSoundUrl: start.customSoundUrl,
                    startBannerConfetti: start.confetti,
                    startBannerConfettiStyle: start.confettiStyle,
                    startBannerDurationMs: start.durationMs,
                    completeBannerEnabled: complete.enabled,
                    completeBannerPosition: complete.position,
                    completeBannerMessage: complete.message,
                    completeBannerImageUrl: complete.imageUrl,
                    completeBannerSound: complete.sound,
                    completeBannerCustomSoundUrl: complete.customSoundUrl,
                    completeBannerConfetti: complete.confetti,
                    completeBannerConfettiStyle: complete.confettiStyle,
                    completeBannerDurationMs: complete.durationMs,
                  }));
                  toast.success("Banner settings updated — click Save Lesson to persist");
                }}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between flex-shrink-0 bg-background">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateLesson.isPending}>
            {updateLesson.isPending ? "Saving..." : "Save Lesson"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default LessonEditorSheet;
