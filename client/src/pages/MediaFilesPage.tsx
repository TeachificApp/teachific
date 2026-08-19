/**
 * MediaFilesPage — unified media asset browser with folder sidebar,
 * checkbox selection, bulk delete, bulk move, inline rename, and copy URL.
 */
import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useOrgScope } from "@/hooks/useOrgScope";
import { chunkedMediaUpload } from "@/lib/chunkedMediaUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CheckSquare, File, FileArchive, FileText, Film, FolderOpen, FolderPlus,
  Image, Link2, Loader2, MoreVertical, Pencil, Search, Square, Trash2, Upload, X,
} from "lucide-react";
import { toast } from "sonner";

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCEPTED_TYPES = [
  "image/*", "video/*", "audio/*",
  "application/pdf", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip", "application/x-zip-compressed",
  ".doc", ".docx", ".zip",
].join(",");

const MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024 * 1024;

type TypeFilter = "all" | "image" | "video" | "audio" | "document" | "archive";

const TYPE_TABS: { id: TypeFilter; label: string }[] = [
  { id: "all", label: "All Files" },
  { id: "image", label: "Images" },
  { id: "video", label: "Video" },
  { id: "audio", label: "Audio" },
  { id: "document", label: "Documents" },
  { id: "archive", label: "Archives" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function getMimeCategory(mimeType: string): TypeFilter {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (
    mimeType === "application/pdf" ||
    mimeType === "application/msword" ||
    mimeType.includes("wordprocessingml") ||
    mimeType.includes("officedocument")
  ) return "document";
  if (mimeType.includes("zip") || mimeType === "application/x-zip-compressed") return "archive";
  return "all";
}

function FileTypeIcon({ mimeType, className }: { mimeType: string; className?: string }) {
  const cat = getMimeCategory(mimeType);
  if (cat === "image") return <Image className={className} />;
  if (cat === "video") return <Film className={className} />;
  if (cat === "audio") return <File className={className} />;
  if (cat === "document") return <FileText className={className} />;
  if (cat === "archive") return <FileArchive className={className} />;
  return <File className={className} />;
}

function FileTypeBadge({ mimeType }: { mimeType: string }) {
  const cat = getMimeCategory(mimeType);
  const map: Record<TypeFilter, { label: string; cls: string }> = {
    image: { label: "Image", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
    video: { label: "Video", cls: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
    audio: { label: "Audio", cls: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300" },
    document: { label: "Doc", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
    archive: { label: "ZIP", cls: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
    all: { label: "File", cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  };
  const info = map[cat];
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${info.cls}`}>
      {info.label}
    </span>
  );
}

// ─── Upload Queue Item ────────────────────────────────────────────────────────

interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
  resultUrl?: string;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MediaFilesPage() {
  const { user } = useAuth();
  const { orgId } = useOrgScope();
  const utils = trpc.useUtils();

  // Filters
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<number | null | undefined>(undefined); // undefined = all, null = root

  // Upload
  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Selection
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  // Dialogs
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [moveToFolderOpen, setMoveToFolderOpen] = useState(false);
  const [moveTargetFolderId, setMoveTargetFolderId] = useState<number | null>(null);

  // Folder management
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderDialogMode, setFolderDialogMode] = useState<"create" | "rename">("create");
  const [folderDialogTarget, setFolderDialogTarget] = useState<{ id: number; name: string } | null>(null);
  const [folderName, setFolderName] = useState("");
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<{ id: number; name: string } | null>(null);

  // ─── Queries ──────────────────────────────────────────────────────────────

  const { data: foldersData, refetch: refetchFolders } = trpc.lms.media.listFolders.useQuery(
    { orgId },
    { enabled: orgId > 0 }
  );
  const folders: { id: number; orgId: number; name: string; count: number; createdAt: Date; updatedAt: Date }[] = (foldersData as { folders: { id: number; orgId: number; name: string; count: number; createdAt: Date; updatedAt: Date }[]; rootCount: number } | undefined)?.folders ?? [];

  const { data: mediaData, isLoading } = trpc.lms.media.listOrgMedia.useQuery(
    { orgId, typeFilter, search: search || undefined, folderId: selectedFolderId },
    { enabled: orgId > 0 }
  );
  const items = mediaData?.items ?? [];
  const total = mediaData?.total ?? 0;

  // ─── Mutations ────────────────────────────────────────────────────────────

  const saveMediaItem = trpc.lms.media.saveMediaItem.useMutation();

  const deleteMediaItem = trpc.lms.media.deleteOrgMedia.useMutation({
    onSuccess: () => {
      utils.lms.media.listOrgMedia.invalidate();
      toast.success("File deleted");
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const bulkDeleteMut = trpc.lms.media.bulkDelete.useMutation({
    onSuccess: (res) => {
      utils.lms.media.listOrgMedia.invalidate();
      refetchFolders();
      toast.success(`${res.deleted} file${res.deleted !== 1 ? "s" : ""} deleted`);
      setSelected(new Set());
      setSelectMode(false);
      setBulkDeleteOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const bulkMoveMut = trpc.lms.media.bulkMoveToFolder.useMutation({
    onSuccess: (res) => {
      utils.lms.media.listOrgMedia.invalidate();
      refetchFolders();
      toast.success(`${res.moved} file${res.moved !== 1 ? "s" : ""} moved`);
      setSelected(new Set());
      setSelectMode(false);
      setMoveToFolderOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const createFolderMut = trpc.lms.media.createFolder.useMutation({
    onSuccess: () => {
      refetchFolders();
      setFolderDialogOpen(false);
      toast.success("Folder created");
    },
    onError: (e) => toast.error(e.message),
  });

  const renameFolderMut = trpc.lms.media.renameFolder.useMutation({
    onSuccess: () => {
      refetchFolders();
      setFolderDialogOpen(false);
      toast.success("Folder renamed");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteFolderMut = trpc.lms.media.deleteFolder.useMutation({
    onSuccess: () => {
      refetchFolders();
      utils.lms.media.listOrgMedia.invalidate();
      if (selectedFolderId === deleteFolderTarget?.id) setSelectedFolderId(undefined);
      setDeleteFolderTarget(null);
      toast.success("Folder deleted — files moved to All Files");
    },
    onError: (e) => toast.error(e.message),
  });

  // ─── Upload Logic ──────────────────────────────────────────────────────────

  const uploadFile = useCallback(async (file: File) => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error(`${file.name} exceeds the 3 GB limit`);
      return;
    }
    const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setUploads((prev) => [...prev, { id: uid, file, progress: 0, status: "uploading" }]);
    try {
      const result = await chunkedMediaUpload({
        file, orgId, folder: "lms-media",
        onProgress: (pct) => setUploads((prev) => prev.map((u) => u.id === uid ? { ...u, progress: pct } : u)),
      });
      await saveMediaItem.mutateAsync({
        orgId,
        fileName: result.fileName,
        mimeType: file.type,
        fileSize: result.fileSize,
        fileKey: result.key,
        url: result.url,
        source: "direct",
        folderId: typeof selectedFolderId === "number" ? selectedFolderId : undefined,
      });

      setUploads((prev) => prev.map((u) => u.id === uid ? { ...u, progress: 100, status: "done", resultUrl: result.url } : u));
      utils.lms.media.listOrgMedia.invalidate();
      refetchFolders();
      toast.success(`${file.name} uploaded`);
    } catch (err: any) {
      setUploads((prev) => prev.map((u) => u.id === uid ? { ...u, status: "error", error: err.message } : u));
      toast.error(`Failed to upload ${file.name}: ${err.message}`);
    }
  }, [orgId, saveMediaItem, utils, selectedFolderId]);

  const handleFiles = useCallback((files: FileList | File[]) => {
    Array.from(files).forEach(uploadFile);
  }, [uploadFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  // ─── Selection helpers ─────────────────────────────────────────────────────

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(items.map((i) => i.id)));
  }

  function clearSelection() {
    setSelected(new Set());
    setSelectMode(false);
  }

  const activeUploads = uploads.filter((u) => u.status === "uploading" || u.status === "pending");

  // ─── Folder sidebar label ─────────────────────────────────────────────────

  function folderLabel() {
    if (selectedFolderId === undefined) return "All Files";
    if (selectedFolderId === null) return "Uncategorised";
    return folders.find((f: { id: number; name: string }) => f.id === selectedFolderId)?.name ?? "Folder";
  }

  return (
    <div className="flex h-full min-h-0">
      {/* ── Folder Sidebar ── */}
      <aside className="w-48 shrink-0 border-r border-border/60 flex flex-col bg-muted/20 overflow-y-auto">
        <div className="flex items-center justify-between px-3 pt-4 pb-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Folders</span>
          <button
            type="button"
            title="New folder"
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => { setFolderDialogMode("create"); setFolderName(""); setFolderDialogTarget(null); setFolderDialogOpen(true); }}
          >
            <FolderPlus className="h-4 w-4" />
          </button>
        </div>

        {/* All Files */}
        <button
          type="button"
          onClick={() => setSelectedFolderId(undefined)}
          className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md mx-1 transition-colors ${
            selectedFolderId === undefined
              ? "bg-primary/10 text-primary font-medium"
              : "hover:bg-accent/50 text-foreground"
          }`}
        >
          <FileArchive className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">All Files</span>
          <span className="text-xs text-muted-foreground">{total}</span>
        </button>

        {/* Folder list */}
        {folders.map((folder: { id: number; name: string; count: number }) => (
          <div
            key={folder.id}
            className={`group flex items-center gap-2 px-3 py-1.5 text-sm rounded-md mx-1 transition-colors cursor-pointer ${
              selectedFolderId === folder.id
                ? "bg-primary/10 text-primary font-medium"
                : "hover:bg-accent/50 text-foreground"
            }`}
            onClick={() => setSelectedFolderId(folder.id)}
          >
            <FolderOpen className="h-4 w-4 shrink-0" />
            <span className="flex-1 truncate">{folder.name}</span>
            <span className="text-xs text-muted-foreground">{folder.count ?? 0}</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-accent transition-all"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="text-sm">
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation();
                  setFolderDialogMode("rename");
                  setFolderDialogTarget(folder);
                  setFolderName(folder.name);
                  setFolderDialogOpen(true);
                }}>
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />Rename
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={(e) => { e.stopPropagation(); setDeleteFolderTarget(folder); }}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />Delete folder
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}

        {folders.length === 0 && orgId > 0 && (
          <p className="text-xs text-muted-foreground px-3 pt-1 pb-4 italic">
            No folders yet. Click + to create one.
          </p>
        )}
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        {/* Type filter tabs */}
        <div className="flex items-center gap-0 px-4 border-b border-border bg-background shrink-0 overflow-x-auto">
          {TYPE_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTypeFilter(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                typeFilter === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search files..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>

          {/* Bulk action toolbar */}
          {selectMode && selected.size > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{selected.size} selected</span>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                onClick={() => { setMoveTargetFolderId(null); setMoveToFolderOpen(true); }}
              >
                <FolderOpen className="h-3.5 w-3.5" />Move to Folder
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-destructive hover:text-destructive border-destructive/30"
                onClick={() => setBulkDeleteOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />Delete
              </Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={clearSelection}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {items.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5"
                  onClick={() => { setSelectMode(true); }}
                >
                  <CheckSquare className="h-3.5 w-3.5" />Select
                </Button>
              )}
              <Button
                size="sm"
                className="gap-1.5 h-8 shrink-0"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" />Upload Files
              </Button>
            </div>
          )}

          {selectMode && selected.size === 0 && (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={selectAll}>
                <CheckSquare className="h-3.5 w-3.5" />Select All
              </Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={clearSelection}>
                <X className="h-3.5 w-3.5" />Cancel
              </Button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
        </div>

        {/* Active uploads */}
        {activeUploads.length > 0 && (
          <div className="px-4 py-3 border-b border-border space-y-2 shrink-0 bg-muted/30">
            {activeUploads.map((u) => (
              <div key={u.id} className="flex items-center gap-3 text-sm">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
                <span className="flex-1 truncate text-muted-foreground">{u.file.name}</span>
                <span className="text-xs text-muted-foreground w-8 text-right">{u.progress}%</span>
                <Progress value={u.progress} className="w-24 h-1.5" />
              </div>
            ))}
          </div>
        )}

        {/* Drop zone + file grid */}
        <div
          className={`flex-1 min-h-0 overflow-auto p-4 transition-colors ${isDragging ? "bg-primary/5 border-2 border-dashed border-primary/40 rounded-lg" : ""}`}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
        >
          {isDragging && (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-primary pointer-events-none">
              <Upload className="h-10 w-10 opacity-60" />
              <p className="text-sm font-medium">Drop files to upload</p>
            </div>
          )}

          {!isDragging && isLoading && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="aspect-square rounded-lg" />
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          )}

          {!isDragging && !isLoading && items.length === 0 && (
            <div
              className="flex flex-col items-center justify-center h-64 gap-4 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                <Upload className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="font-medium text-sm">
                  {search || typeFilter !== "all" ? "No files match your filters" : `Drop files here or click to upload into "${folderLabel()}"`}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Images, video, audio, PDF, Word, ZIP — up to 3 GB each
                </p>
              </div>
              {!search && typeFilter === "all" && (
                <Button size="sm" variant="outline" className="gap-1.5">
                  <Upload className="h-3.5 w-3.5" />Choose Files
                </Button>
              )}
            </div>
          )}

          {!isDragging && !isLoading && items.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">{total} file{total !== 1 ? "s" : ""} in <strong>{folderLabel()}</strong></p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {items.map((item) => (
                  <MediaFileCard
                    key={item.id}
                    item={item}
                    orgId={orgId}
                    selectMode={selectMode}
                    isSelected={selected.has(item.id)}
                    onToggleSelect={() => toggleSelect(item.id)}
                    onDelete={() => setDeleteTarget(item.id)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Delete single file ── */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete File</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the file from your media library. Any courses or pages that reference this file will lose the link. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMediaItem.mutate({ orgId, id: deleteTarget })}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Bulk delete ── */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} File{selected.size !== 1 ? "s" : ""}</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected files from your media library. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              disabled={bulkDeleteMut.isPending}
              onClick={() => bulkDeleteMut.mutate({ orgId, ids: Array.from(selected) })}
            >
              {bulkDeleteMut.isPending ? "Deleting…" : `Delete ${selected.size} File${selected.size !== 1 ? "s" : ""}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Bulk move to folder ── */}
      <Dialog open={moveToFolderOpen} onOpenChange={setMoveToFolderOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Move {selected.size} File{selected.size !== 1 ? "s" : ""} to Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Destination folder</Label>
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              value={moveTargetFolderId ?? ""}
              onChange={(e) => setMoveTargetFolderId(e.target.value === "" ? null : Number(e.target.value))}
            >
              <option value="">— Uncategorised (no folder) —</option>
              {folders.map((f: { id: number; name: string }) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveToFolderOpen(false)}>Cancel</Button>
            <Button
              disabled={bulkMoveMut.isPending}
              onClick={() => bulkMoveMut.mutate({ orgId, ids: Array.from(selected), folderId: moveTargetFolderId })}
            >
              {bulkMoveMut.isPending ? "Moving…" : "Move"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create / Rename folder ── */}
      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{folderDialogMode === "create" ? "New Folder" : "Rename Folder"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="media-folder-name">Folder name</Label>
            <Input
              id="media-folder-name"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="e.g. Course Videos"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (folderDialogMode === "create") createFolderMut.mutate({ orgId, name: folderName.trim() });
                  else if (folderDialogTarget) renameFolderMut.mutate({ orgId, id: folderDialogTarget.id, name: folderName.trim() });
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={!folderName.trim() || createFolderMut.isPending || renameFolderMut.isPending}
              onClick={() => {
                if (folderDialogMode === "create") createFolderMut.mutate({ orgId, name: folderName.trim() });
                else if (folderDialogTarget) renameFolderMut.mutate({ orgId, id: folderDialogTarget.id, name: folderName.trim() });
              }}
            >
              {folderDialogMode === "create" ? "Create" : "Rename"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete folder ── */}
      <AlertDialog open={deleteFolderTarget !== null} onOpenChange={(o) => !o && setDeleteFolderTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Folder</AlertDialogTitle>
            <AlertDialogDescription>
              The folder <strong>"{deleteFolderTarget?.name}"</strong> will be deleted. All files inside will be moved to "All Files" (uncategorised). No files will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteFolderTarget && deleteFolderMut.mutate({ orgId, id: deleteFolderTarget.id })}
            >
              Delete Folder
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── File Card ────────────────────────────────────────────────────────────────

function MediaFileCard({
  item,
  orgId,
  selectMode,
  isSelected,
  onToggleSelect,
  onDelete,
}: {
  item: {
    id: number;
    filename: string;
    mimeType: string;
    fileSize: number;
    url: string;
    createdAt: Date;
  };
  orgId: number;
  selectMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onDelete: () => void;
}) {
  const utils = trpc.useUtils();
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(item.filename);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const isImage = item.mimeType.startsWith("image/");
  const isVideo = item.mimeType.startsWith("video/");

  const renameMutation = trpc.lms.media.renameOrgMedia.useMutation({
    onSuccess: () => {
      utils.lms.media.listOrgMedia.invalidate();
      setIsRenaming(false);
      toast.success("File renamed");
    },
    onError: (e) => {
      toast.error(e.message);
      setIsRenaming(false);
    },
  });

  function startRename() {
    setRenameValue(item.filename);
    setIsRenaming(true);
    setTimeout(() => renameInputRef.current?.select(), 30);
  }

  function commitRename() {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === item.filename) { setIsRenaming(false); return; }
    renameMutation.mutate({ orgId, id: item.id, filename: trimmed });
  }

  return (
    <div
      className={`group relative border rounded-lg overflow-hidden bg-card transition-all hover:shadow-sm cursor-pointer ${
        isSelected ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/40"
      }`}
      onClick={selectMode ? onToggleSelect : undefined}
    >
      {/* Thumbnail */}
      <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
        {isImage ? (
          <img src={item.url} alt={item.filename} className="w-full h-full object-cover" loading="lazy" />
        ) : isVideo ? (
          <video src={item.url} className="w-full h-full object-cover" muted preload="metadata" />
        ) : (
          <div className="flex flex-col items-center gap-2 p-4">
            <FileTypeIcon mimeType={item.mimeType} className="h-10 w-10 text-muted-foreground/60" />
            <FileTypeBadge mimeType={item.mimeType} />
          </div>
        )}
      </div>

      {/* Selection checkbox */}
      {(selectMode || isSelected) && (
        <div className="absolute top-1.5 left-1.5">
          <button
            className={`h-6 w-6 rounded flex items-center justify-center transition-colors ${
              isSelected
                ? "bg-primary text-primary-foreground"
                : "bg-background/90 border border-border hover:border-primary"
            }`}
            onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
          >
            {isSelected
              ? <CheckSquare className="h-3.5 w-3.5" />
              : <Square className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
        </div>
      )}

      {/* Copy URL button */}
      {!selectMode && (
        <div className="absolute top-1.5 left-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            className="h-6 w-6 rounded-full bg-background/90 border border-border flex items-center justify-center shadow-sm hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
            title="Copy CDN URL"
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(item.url)
                .then(() => toast.success("URL copied to clipboard", { description: item.filename }))
                .catch(() => toast.error("Failed to copy URL"));
            }}
          >
            <Link2 className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Actions menu */}
      {!selectMode && (
        <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-6 w-6 rounded-full bg-background/90 border border-border flex items-center justify-center shadow-sm hover:bg-background">
                <MoreVertical className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-sm">
              <DropdownMenuItem
                onClick={() => {
                  navigator.clipboard.writeText(item.url)
                    .then(() => toast.success("URL copied to clipboard", { description: item.filename }))
                    .catch(() => toast.error("Failed to copy URL"));
                }}
              >
                <Link2 className="h-3.5 w-3.5 mr-1.5" />Copy URL
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={item.url} target="_blank" rel="noopener noreferrer">Open in new tab</a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={item.url} download={item.filename}>Download</a>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={startRename}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" />Rename
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Info */}
      <div className="p-2.5">
        {isRenaming ? (
          <input
            ref={renameInputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") setIsRenaming(false);
            }}
            className="w-full text-xs font-medium bg-background border border-primary rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-primary"
            autoFocus
          />
        ) : (
          <p
            className="text-xs font-medium truncate leading-tight cursor-pointer hover:text-primary transition-colors"
            title={`${item.filename} — double-click to rename`}
            onDoubleClick={startRename}
          >
            {item.filename}
          </p>
        )}
        <p className="text-[10px] text-muted-foreground mt-0.5">{formatBytes(item.fileSize)}</p>
      </div>
    </div>
  );
}
