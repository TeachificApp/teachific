import { trpc } from "@/lib/trpc";
import UploadPage from "./UploadPage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent,
  DropdownMenuSubTrigger, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  ChevronDown, ChevronRight, Download, File, FileArchive, FileText, Film,
  Folder, FolderInput, FolderOpen, FolderPlus, GripVertical, Image,
  Link2, Loader2, MoreVertical, Pencil, Play, Plus, RefreshCw, Search,
  Settings, Trash2, Upload,
} from "lucide-react";
import { useState, useMemo, useCallback, useRef } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useOrgScope } from "@/hooks/useOrgScope";
import { chunkedMediaUpload } from "@/lib/chunkedMediaUpload";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ─── Types ────────────────────────────────────────────────────────────────────
type UnifiedTypeFilter = "all" | "scorm" | "html" | "image" | "video" | "audio" | "document" | "zip";
type SortKey = "title" | "date" | "plays" | "size";

interface FolderItem {
  id: number;
  orgId: number;
  ownerId: number;
  parentId: number | null;
  name: string;
  color: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const TYPE_FILTERS: { id: UnifiedTypeFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "scorm", label: "SCORM" },
  { id: "html", label: "HTML" },
  { id: "image", label: "Images" },
  { id: "video", label: "Video" },
  { id: "audio", label: "Audio" },
  { id: "document", label: "Documents" },
  { id: "zip", label: "ZIP" },
];

// All file types accepted by the unified upload button
const ALL_ACCEPTED = [
  ".zip", ".html", ".htm",
  "image/*", "video/*", "audio/*",
  "application/pdf", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc", ".docx",
].join(",");

function formatBytes(bytes: number) {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function getMimeCategory(mimeType: string): "image" | "video" | "audio" | "document" | "zip" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.includes("zip") || mimeType === "application/x-zip-compressed") return "zip";
  return "document";
}

function MediaFileTypeIcon({ mimeType, className }: { mimeType: string; className?: string }) {
  const cat = getMimeCategory(mimeType);
  if (cat === "image") return <Image className={className} />;
  if (cat === "video") return <Film className={className} />;
  if (cat === "audio") return <File className={className} />;
  if (cat === "zip") return <FileArchive className={className} />;
  return <FileText className={className} />;
}

function ContentTypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    scorm: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    articulate: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    ispring: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    html: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    unknown: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };
  const labels: Record<string, string> = { scorm: "SCORM", articulate: "Articulate", ispring: "iSpring", html: "HTML", unknown: "Unknown" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[type] ?? map.unknown}`}>{labels[type] ?? type}</span>;
}

function MediaTypeBadge({ mimeType }: { mimeType: string }) {
  const cat = getMimeCategory(mimeType);
  const map: Record<string, { label: string; cls: string }> = {
    image: { label: "Image", cls: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300" },
    video: { label: "Video", cls: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
    audio: { label: "Audio", cls: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300" },
    document: { label: "Doc", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    zip: { label: "ZIP", cls: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  };
  const info = map[cat] ?? { label: "File", cls: "bg-gray-100 text-gray-600" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${info.cls}`}>{info.label}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; class: string }> = {
    ready: { label: "Ready", class: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
    processing: { label: "Processing", class: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    error: { label: "Error", class: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
    uploading: { label: "Uploading", class: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  };
  const info = map[status] ?? { label: status, class: "bg-gray-100 text-gray-600" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${info.class}`}>{info.label}</span>;
}

// ─── Sortable Folder Row ──────────────────────────────────────────────────────
function SortableFolderNode({
  folder, allFolders, selectedFolderId, dragOverFolderId,
  onSelect, onCreateChild, onRename, onDelete, depth = 0,
}: {
  folder: FolderItem; allFolders: FolderItem[]; selectedFolderId: number | null;
  dragOverFolderId: number | null; onSelect: (id: number | null) => void;
  onCreateChild: (parentId: number) => void; onRename: (folder: FolderItem) => void;
  onDelete: (folder: FolderItem) => void; depth?: number;
}) {
  const children = allFolders.filter((f) => f.parentId === folder.id).sort((a, b) => a.sortOrder - b.sortOrder);
  const [open, setOpen] = useState(true);
  const isSelected = selectedFolderId === folder.id;
  const isDragTarget = dragOverFolderId === folder.id;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `folder-${folder.id}` });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={`group flex items-center gap-1 rounded-md px-2 py-1.5 cursor-pointer transition-colors text-sm ${
          isDragTarget ? "bg-primary/20 ring-1 ring-primary/40"
            : isSelected ? "bg-primary/10 text-primary font-medium"
            : "hover:bg-accent/50 text-foreground"
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => onSelect(folder.id)}
      >
        <button type="button" className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" {...attributes} {...listeners} onClick={(e) => e.stopPropagation()}>
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        {children.length > 0 ? (
          <button type="button" className="shrink-0 text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}>
            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : <span className="w-3.5 shrink-0" />}
        {open && children.length > 0 ? <FolderOpen className="h-4 w-4 shrink-0 text-primary/70" /> : <Folder className={`h-4 w-4 shrink-0 ${isDragTarget ? "text-primary" : "text-muted-foreground"}`} />}
        <span className="flex-1 truncate">{folder.name}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-accent transition-opacity" onClick={(e) => e.stopPropagation()}>
              <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onCreateChild(folder.id); }}><FolderPlus className="mr-2 h-4 w-4" />New Subfolder</DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRename(folder); }}><Pencil className="mr-2 h-4 w-4" />Rename</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(folder); }}><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {open && children.length > 0 && (
        <div>
          {children.map((child) => (
            <SortableFolderNode key={child.id} folder={child} allFolders={allFolders} selectedFolderId={selectedFolderId} dragOverFolderId={dragOverFolderId} onSelect={onSelect} onCreateChild={onCreateChild} onRename={onRename} onDelete={onDelete} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Package Row ──────────────────────────────────────────────────────────────
function PackageRow({ pkg, folders, onNavigate, onDelete, onMove }: {
  pkg: any; folders: FolderItem[]; onNavigate: (path: string) => void;
  onDelete: (id: number) => void; onMove: (packageId: number, folderId: number | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `pkg-${pkg.id}` });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 };
  return (
    <div ref={setNodeRef} style={style} className={`flex sm:grid sm:grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-4 px-5 py-4 hover:bg-accent/20 transition-colors ${isDragging ? "bg-accent/30" : ""}`}>
      <button type="button" className="hidden sm:flex cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground transition-colors shrink-0" {...attributes} {...listeners} title="Drag to move to folder">
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-3 min-w-0 cursor-pointer flex-1" onClick={() => onNavigate(`/files/${pkg.id}`)}>
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <FileArchive className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{pkg.title}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-muted-foreground">{formatBytes(pkg.originalZipSize ?? 0)}</span>
            {pkg.scormVersion !== "none" && <span className="text-xs text-muted-foreground">&bull; SCORM {pkg.scormVersion}</span>}
            <span className="text-xs text-muted-foreground">&bull; {new Date(pkg.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
      <div className="hidden sm:flex justify-center"><ContentTypeBadge type={pkg.contentType} /></div>
      <div className="hidden sm:flex justify-center"><StatusBadge status={pkg.status} /></div>
      <div className="hidden sm:flex items-center justify-center gap-1 text-sm text-muted-foreground">
        <Play className="h-3.5 w-3.5" />{pkg.totalPlayCount ?? 0}
      </div>
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => onNavigate(`/play/${pkg.id}`)}><Play className="mr-2 h-4 w-4" />Preview</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onNavigate(`/files/${pkg.id}`)}><Settings className="mr-2 h-4 w-4" />Manage</DropdownMenuItem>
            {pkg.originalZipUrl && (
              <DropdownMenuItem asChild>
                <a href={pkg.originalZipUrl} download target="_blank" rel="noreferrer"><Download className="mr-2 h-4 w-4" />Download ZIP</a>
              </DropdownMenuItem>
            )}
            {folders.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger><FolderInput className="mr-2 h-4 w-4" />Move to Folder</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-44 max-h-64 overflow-y-auto">
                    <DropdownMenuItem onClick={() => onMove(pkg.id, null)}><Folder className="mr-2 h-4 w-4 opacity-50" />Uncategorized</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {folders.map((f) => (
                      <DropdownMenuItem key={f.id} onClick={() => onMove(pkg.id, f.id)}><Folder className="mr-2 h-4 w-4 text-primary/70" /><span className="truncate">{f.name}</span></DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(pkg.id)}><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ─── Media Item Row ───────────────────────────────────────────────────────────
function MediaRow({ item, folders, onDelete, onMove, onReplace }: {
  item: any;
  folders: FolderItem[];
  onDelete: (id: number) => void;
  onMove: (mediaId: number, folderId: number | null) => void;
  onReplace: (item: any) => void;
}) {
  return (
    <div className="flex sm:grid sm:grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4 px-5 py-4 hover:bg-accent/20 transition-colors">
      <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
        {item.mimeType.startsWith("image/") ? (
          <img src={item.url} alt={item.filename} className="h-9 w-9 rounded-lg object-cover" loading="lazy" />
        ) : item.mimeType.startsWith("video/") ? (
          <video src={item.url} className="h-9 w-9 rounded-lg object-cover" muted preload="metadata" />
        ) : (
          <MediaFileTypeIcon mimeType={item.mimeType} className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{item.filename}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground">{formatBytes(item.fileSize)}</span>
          <span className="text-xs text-muted-foreground">&bull; {new Date(item.createdAt).toLocaleDateString()}</span>
          {item.folderId && folders.find((f) => f.id === item.folderId) && (
            <span className="text-xs text-muted-foreground">&bull; <Folder className="h-3 w-3 inline mr-0.5" />{folders.find((f) => f.id === item.folderId)?.name}</span>
          )}
        </div>
      </div>
      <div className="hidden sm:flex justify-center"><MediaTypeBadge mimeType={item.mimeType} /></div>
      <div className="hidden sm:flex justify-center">
        <button
          className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-accent transition-colors"
          title="Copy CDN URL"
          onClick={() => navigator.clipboard.writeText(item.url).then(() => toast.success("URL copied")).catch(() => toast.error("Failed to copy URL"))}
        >
          <Link2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(item.url).then(() => toast.success("URL copied")).catch(() => {})}><Link2 className="mr-2 h-4 w-4" />Copy URL</DropdownMenuItem>
            <DropdownMenuItem asChild><a href={item.url} target="_blank" rel="noopener noreferrer">Open in new tab</a></DropdownMenuItem>
            <DropdownMenuItem asChild><a href={item.url} download={item.filename}>Download</a></DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onReplace(item)}>
              <RefreshCw className="mr-2 h-4 w-4" />Replace File
            </DropdownMenuItem>
            {folders.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger><FolderInput className="mr-2 h-4 w-4" />Move to Folder</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-44 max-h-64 overflow-y-auto">
                    <DropdownMenuItem onClick={() => onMove(item.id, null)}><Folder className="mr-2 h-4 w-4 opacity-50" />Uncategorized</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {folders.map((f) => (
                      <DropdownMenuItem key={f.id} onClick={() => onMove(item.id, f.id)}><Folder className="mr-2 h-4 w-4 text-primary/70" /><span className="truncate">{f.name}</span></DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(item.id)}><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ─── Upload Queue Item ────────────────────────────────────────────────────────
interface UploadQueueItem {
  id: string; file: File; progress: number;
  status: "pending" | "uploading" | "done" | "error"; error?: string;
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function FilesPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { activeOrg } = useOrgScope();
  const utils = trpc.useUtils();

  // ── State ──────────────────────────────────────────────────────────────────
  const [typeFilter, setTypeFilter] = useState<UnifiedTypeFilter>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  // Upload state
  const [showScormDialog, setShowScormDialog] = useState(false);
  const [pendingZipFile, setPendingZipFile] = useState<File | undefined>(undefined);
  const [mediaUploads, setMediaUploads] = useState<UploadQueueItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Folder dialog
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderDialogMode, setFolderDialogMode] = useState<"create" | "rename">("create");
  const [folderDialogParentId, setFolderDialogParentId] = useState<number | null>(null);
  const [folderDialogTarget, setFolderDialogTarget] = useState<FolderItem | null>(null);
  const [folderName, setFolderName] = useState("");
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<FolderItem | null>(null);
  // Delete
  const [deletePackageId, setDeletePackageId] = useState<number | null>(null);
  const [deleteMediaId, setDeleteMediaId] = useState<number | null>(null);
  // Replace File state
  const [replaceTarget, setReplaceTarget] = useState<any | null>(null);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [replaceProgress, setReplaceProgress] = useState(0);
  const [replaceUploading, setReplaceUploading] = useState(false);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);
  // DnD
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<number | null>(null);
  const [localFolderOrder, setLocalFolderOrder] = useState<number[] | null>(null);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: packages, isLoading: pkgsLoading, refetch: refetchPkgs } = trpc.packages.list.useQuery(
    activeOrg?.id ? { orgId: activeOrg.id } : undefined,
  );
  const { data: myOrgs } = trpc.orgs.myOrgs.useQuery();
  const orgId = activeOrg?.id ?? myOrgs?.[0]?.id ?? 0;
  const { data: foldersRaw = [], refetch: refetchFolders } = trpc.folders.list.useQuery({ orgId }, { enabled: orgId > 0 });
  const { data: mediaData, isLoading: mediaLoading, refetch: refetchMedia } = trpc.lms.media.listOrgMedia.useQuery(
    { orgId, typeFilter: "all", pageSize: 200 },
    { enabled: orgId > 0 }
  );
  const mediaItems = mediaData?.items ?? [];

  // ── Folder helpers ─────────────────────────────────────────────────────────
  const folders: FolderItem[] = useMemo(() => {
    const raw = foldersRaw as FolderItem[];
    if (!localFolderOrder) return [...raw].sort((a, b) => a.sortOrder - b.sortOrder);
    return localFolderOrder.map((id) => raw.find((f) => f.id === id)).filter(Boolean) as FolderItem[];
  }, [foldersRaw, localFolderOrder]);

  const rootFolders = folders.filter((f) => f.parentId === null);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const deletePackageMut = trpc.packages.delete.useMutation({
    onSuccess: () => { toast.success("Package deleted"); refetchPkgs(); setDeletePackageId(null); },
    onError: (e) => toast.error("Delete failed: " + e.message),
  });
  const deleteMediaMut = trpc.lms.media.deleteOrgMedia.useMutation({
    onSuccess: () => { toast.success("File deleted"); refetchMedia(); setDeleteMediaId(null); },
    onError: (e) => toast.error("Delete failed: " + e.message),
  });
  const saveMediaItem = trpc.lms.media.saveMediaItem.useMutation();
  const createFolderMut = trpc.folders.create.useMutation({
    onSuccess: () => { toast.success("Folder created"); refetchFolders(); setFolderDialogOpen(false); },
    onError: (e) => toast.error("Failed to create folder: " + e.message),
  });
  const renameFolderMut = trpc.folders.rename.useMutation({
    onSuccess: () => { toast.success("Folder renamed"); refetchFolders(); setFolderDialogOpen(false); },
    onError: (e) => toast.error("Failed to rename folder: " + e.message),
  });
  const deleteFolderMut = trpc.folders.delete.useMutation({
    onSuccess: () => {
      toast.success("Folder deleted");
      refetchFolders(); refetchPkgs();
      if (selectedFolderId === deleteFolderTarget?.id) setSelectedFolderId(null);
      setDeleteFolderTarget(null);
    },
    onError: (e) => toast.error("Failed to delete folder: " + e.message),
  });
  const movePackageMut = trpc.folders.movePackage.useMutation({
    onSuccess: () => { toast.success("Package moved"); refetchPkgs(); },
    onError: (e) => toast.error("Failed to move package: " + e.message),
  });
  const reorderFoldersMut = trpc.folders.reorder.useMutation({
    onError: (e) => { toast.error("Failed to save folder order: " + e.message); setLocalFolderOrder(null); refetchFolders(); },
  });
  const moveMediaToFolderMut = trpc.lms.media.bulkMoveToFolder.useMutation({
    onSuccess: () => { toast.success("File moved"); refetchMedia(); },
    onError: (e) => toast.error("Failed to move file: " + e.message),
  });

  // ── Folder dialog ──────────────────────────────────────────────────────────
  const openCreateFolder = useCallback((parentId: number | null = null) => {
    setFolderDialogMode("create"); setFolderDialogParentId(parentId);
    setFolderDialogTarget(null); setFolderName(""); setFolderDialogOpen(true);
  }, []);
  const openRenameFolder = useCallback((folder: FolderItem) => {
    setFolderDialogMode("rename"); setFolderDialogTarget(folder);
    setFolderName(folder.name); setFolderDialogOpen(true);
  }, []);
  const handleFolderDialogSubmit = useCallback(() => {
    if (!folderName.trim()) return;
    if (folderDialogMode === "create") {
      createFolderMut.mutate({ orgId, name: folderName.trim(), parentId: folderDialogParentId ?? undefined });
    } else if (folderDialogTarget) {
      renameFolderMut.mutate({ id: folderDialogTarget.id, name: folderName.trim() });
    }
  }, [folderDialogMode, folderName, folderDialogParentId, folderDialogTarget, orgId]);

  // ── Media upload logic ─────────────────────────────────────────────────────
  const uploadMediaFile = useCallback(async (file: File) => {
    if (file.size > 3 * 1024 * 1024 * 1024) { toast.error(`${file.name} exceeds 3 GB`); return; }
    const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setMediaUploads((prev) => [...prev, { id: uid, file, progress: 0, status: "uploading" }]);
    try {
      const result = await chunkedMediaUpload({
        file, orgId, folder: "lms-media",
        onProgress: (pct) => setMediaUploads((prev) => prev.map((u) => u.id === uid ? { ...u, progress: pct } : u)),
      });
      await saveMediaItem.mutateAsync({
        orgId, fileName: result.fileName, mimeType: file.type,
        fileSize: result.fileSize, fileKey: result.key, url: result.url, source: "direct",
      });
      setMediaUploads((prev) => prev.map((u) => u.id === uid ? { ...u, progress: 100, status: "done" } : u));
      utils.lms.media.listOrgMedia.invalidate();
      refetchMedia();
      toast.success(`${file.name} uploaded`);
    } catch (err: any) {
      setMediaUploads((prev) => prev.map((u) => u.id === uid ? { ...u, status: "error", error: err.message } : u));
      toast.error(`Failed to upload ${file.name}: ${err.message}`);
    }
  }, [orgId, saveMediaItem, utils, refetchMedia]);

  // ── Replace File logic ─────────────────────────────────────────────────────
  const handleReplaceFileSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setReplaceFile(file);
    // Reset input so the same file can be re-selected if needed
    e.target.value = "";
  }, []);

  const handleReplaceConfirm = useCallback(async () => {
    if (!replaceTarget || !replaceFile) return;
    setReplaceUploading(true);
    setReplaceProgress(0);
    try {
      const formData = new FormData();
      formData.append("file", replaceFile);
      formData.append("mediaItemId", String(replaceTarget.id));
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setReplaceProgress(Math.round((e.loaded / e.total) * 95));
        };
        xhr.onload = () => {
          if (xhr.status === 200) { setReplaceProgress(100); resolve(); }
          else {
            try { reject(new Error(JSON.parse(xhr.responseText)?.error ?? "Replace failed")); }
            catch { reject(new Error(`Replace failed (HTTP ${xhr.status})`)); }
          }
        };
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.open("POST", "/api/media-upload/replace");
        xhr.send(formData);
      });
      utils.lms.media.listOrgMedia.invalidate();
      refetchMedia();
      toast.success(`"${replaceTarget.filename}" replaced — URL unchanged`);
      setReplaceTarget(null);
      setReplaceFile(null);
    } catch (err: any) {
      toast.error(`Replace failed: ${err.message}`);
    } finally {
      setReplaceUploading(false);
    }
  }, [replaceTarget, replaceFile, utils, refetchMedia]);

  // ── Unified upload handler ─────────────────────────────────────────────────
  const handleFilesPicked = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const zipFiles: File[] = [];
    const mediaFiles: File[] = [];
    Array.from(files).forEach((f) => {
      const name = f.name.toLowerCase();
      if (name.endsWith(".zip")) zipFiles.push(f);
      else mediaFiles.push(f);
    });
    if (zipFiles.length > 0) {
      setPendingZipFile(zipFiles[0]);
      setShowScormDialog(true);
      if (zipFiles.length > 1) toast.info(`Only one ZIP can be uploaded at a time. Opening the first: ${zipFiles[0].name}`);
    }
    mediaFiles.forEach((f) => uploadMediaFile(f));
  }, [uploadMediaFile]);

  // ── Unified type filter applied to both packages and media ─────────────────
  const activeMediaUploads = mediaUploads.filter((u) => u.status === "uploading");

  const filteredPackages = useMemo(() => {
    let list = packages ?? [];
    if (typeFilter === "scorm") list = list.filter((p) => p.contentType === "scorm" || p.contentType === "articulate" || p.contentType === "ispring");
    else if (typeFilter === "html") list = list.filter((p) => p.contentType === "html" || p.contentType === "unknown");
    else if (!["all", "image", "video", "audio", "document", "zip"].includes(typeFilter)) list = [];
    if (typeof selectedFolderId === "number") list = list.filter((p) => (p as any).folderId === selectedFolderId);
    if (search) list = list.filter((p) => p.title.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [packages, typeFilter, selectedFolderId, search]);

  const filteredMedia = useMemo(() => {
    let list = mediaItems;
    if (typeFilter === "image") list = list.filter((m) => m.mimeType.startsWith("image/"));
    else if (typeFilter === "video") list = list.filter((m) => m.mimeType.startsWith("video/"));
    else if (typeFilter === "audio") list = list.filter((m) => m.mimeType.startsWith("audio/"));
    else if (typeFilter === "document") list = list.filter((m) => {
      const t = m.mimeType;
      return t === "application/pdf" || t === "application/msword" || t.includes("wordprocessingml") || t.includes("officedocument");
    });
    else if (typeFilter === "zip") list = list.filter((m) => m.mimeType.includes("zip"));
    else if (typeFilter === "scorm" || typeFilter === "html") list = [];
    if (typeof selectedFolderId === "number") list = list.filter((m) => (m as any).folderId === selectedFolderId);
    if (search) list = list.filter((m) => m.filename.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [mediaItems, typeFilter, selectedFolderId, search]);

  type UnifiedItem = { kind: "package"; data: any } | { kind: "media"; data: any };
  const unifiedItems: UnifiedItem[] = useMemo(() => {
    const pkgs: UnifiedItem[] = filteredPackages.map((p) => ({ kind: "package", data: p }));
    const media: UnifiedItem[] = filteredMedia.map((m) => ({ kind: "media", data: m }));
    const combined = [...pkgs, ...media];
    return combined.sort((a, b) => {
      const aDate = new Date(a.kind === "package" ? a.data.createdAt : a.data.createdAt).getTime();
      const bDate = new Date(b.kind === "package" ? b.data.createdAt : b.data.createdAt).getTime();
      if (sortKey === "date") return bDate - aDate;
      if (sortKey === "title") {
        const aTitle = a.kind === "package" ? a.data.title : a.data.filename;
        const bTitle = b.kind === "package" ? b.data.title : b.data.filename;
        return aTitle.localeCompare(bTitle);
      }
      if (sortKey === "size") {
        const aSize = a.kind === "package" ? (a.data.originalZipSize ?? 0) : (a.data.fileSize ?? 0);
        const bSize = b.kind === "package" ? (b.data.originalZipSize ?? 0) : (b.data.fileSize ?? 0);
        return bSize - aSize;
      }
      if (sortKey === "plays") {
        const aPlays = a.kind === "package" ? (a.data.totalPlayCount ?? 0) : 0;
        const bPlays = b.kind === "package" ? (b.data.totalPlayCount ?? 0) : 0;
        return bPlays - aPlays;
      }
      return bDate - aDate;
    });
  }, [filteredPackages, filteredMedia, sortKey]);

  const isLoading = pkgsLoading || mediaLoading;

  const selectedFolderName = useMemo(() => {
    if (selectedFolderId === null) return "Media Library";
    return folders.find((f) => f.id === selectedFolderId)?.name ?? "Folder";
  }, [selectedFolderId, folders]);

  // ── DnD ────────────────────────────────────────────────────────────────────
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const folderSortableIds = rootFolders.map((f) => `folder-${f.id}`);
  const pkgSortableIds = filteredPackages.map((p) => `pkg-${p.id}`);

  const handleDragStart = (event: DragStartEvent) => setActiveDragId(String(event.active.id));
  const handleDragOver = (event: DragOverEvent) => {
    const over = String(event.over?.id ?? "");
    if (over.startsWith("folder-")) setDragOverFolderId(Number(over.replace("folder-", "")));
    else setDragOverFolderId(null);
  };
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null); setDragOverFolderId(null);
    const active = String(event.active.id); const over = String(event.over?.id ?? "");
    if (!over) return;
    if (active.startsWith("pkg-") && over.startsWith("folder-")) {
      const pkgId = Number(active.replace("pkg-", ""));
      const folderId = Number(over.replace("folder-", ""));
      movePackageMut.mutate({ packageId: pkgId, folderId });
      return;
    }
    if (active.startsWith("folder-") && over.startsWith("folder-")) {
      const activeFolder = Number(active.replace("folder-", ""));
      const overFolder = Number(over.replace("folder-", ""));
      if (activeFolder === overFolder) return;
      const activeFolderObj = folders.find((f) => f.id === activeFolder);
      const overFolderObj = folders.find((f) => f.id === overFolder);
      if (!activeFolderObj || !overFolderObj) return;
      if (activeFolderObj.parentId !== overFolderObj.parentId) return;
      const rootFolderIds = folders.filter((f) => f.parentId === activeFolderObj.parentId).map((f) => f.id);
      const oldIndex = rootFolderIds.indexOf(activeFolder);
      const newIndex = rootFolderIds.indexOf(overFolder);
      if (oldIndex === -1 || newIndex === -1) return;
      const newOrder = arrayMove(rootFolderIds, oldIndex, newIndex);
      setLocalFolderOrder(newOrder.concat(folders.filter((f) => !newOrder.includes(f.id)).map((f) => f.id)));
      reorderFoldersMut.mutate({ orderedIds: newOrder });
    }
  };

  const activePkg = activeDragId?.startsWith("pkg-") ? (packages ?? []).find((p) => p.id === Number(activeDragId.replace("pkg-", ""))) : null;
  const activeFolder = activeDragId?.startsWith("folder-") ? folders.find((f) => f.id === Number(activeDragId.replace("folder-", ""))) : null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
      <div className="flex flex-col md:flex-row h-full min-h-0 p-4 sm:p-6 max-w-7xl mx-auto w-full">
        {/* ── Folder Sidebar ── */}
        <aside className="md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-border/60 flex flex-col bg-muted/20 md:overflow-y-auto">
          <div className="flex items-center justify-between px-3 pt-4 pb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Folders</span>
            <button type="button" title="New folder" className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" onClick={() => openCreateFolder(null)}>
              <FolderPlus className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md mx-1 transition-colors ${selectedFolderId === null ? "bg-primary/10 text-primary font-medium" : "hover:bg-accent/50 text-foreground"}`}
            onClick={() => setSelectedFolderId(null)}
          >
            <FileArchive className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">All Files</span>
            <span className="text-xs text-muted-foreground">{(packages?.length ?? 0) + mediaItems.length}</span>
          </button>
          {rootFolders.length > 0 && (
            <div className="mt-1 px-1 pb-4">
              <SortableContext items={folderSortableIds} strategy={verticalListSortingStrategy}>
                {rootFolders.map((folder) => (
                  <SortableFolderNode key={folder.id} folder={folder} allFolders={folders} selectedFolderId={selectedFolderId} dragOverFolderId={dragOverFolderId} onSelect={(id) => setSelectedFolderId(id)} onCreateChild={(parentId) => openCreateFolder(parentId)} onRename={openRenameFolder} onDelete={(f) => setDeleteFolderTarget(f)} />
                ))}
              </SortableContext>
            </div>
          )}
          {rootFolders.length === 0 && orgId > 0 && (
            <p className="text-xs text-muted-foreground px-3 pt-2 pb-4 italic">No folders yet. Click + to create one.</p>
          )}
        </aside>

        {/* ── Main Content ── */}
        <div className="flex-1 min-w-0 overflow-y-auto p-6 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{selectedFolderName}</h1>
              <p className="text-muted-foreground text-sm mt-0.5">{unifiedItems.length} item{unifiedItems.length !== 1 ? "s" : ""}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => fileInputRef.current?.click()} className="gap-2">
                <Plus className="h-4 w-4" />Upload Content
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept={ALL_ACCEPTED}
                multiple
                className="hidden"
                onChange={(e) => handleFilesPicked(e.target.files)}
                onClick={(e) => { (e.target as HTMLInputElement).value = ""; }}
              />
            </div>
          </div>

          {/* Active media uploads */}
          {activeMediaUploads.length > 0 && (
            <div className="space-y-2">
              {activeMediaUploads.map((u) => (
                <div key={u.id} className="flex items-center gap-3 bg-muted/40 rounded-lg px-4 py-2.5 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                  <span className="flex-1 truncate text-muted-foreground">{u.file.name}</span>
                  <span className="text-xs text-muted-foreground">{u.progress}%</span>
                </div>
              ))}
            </div>
          )}

          {/* Type filter + sort */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex gap-1 p-1 bg-muted/40 rounded-lg border border-border/50 overflow-x-auto shrink-0">
              {TYPE_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setTypeFilter(f.id)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${typeFilter === f.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
              <select className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
                <option value="date">Newest First</option>
                <option value="title">Title A-Z</option>
                <option value="plays">Most Played</option>
                <option value="size">Largest</option>
              </select>
            </div>
          </div>

          {/* Drag hint */}
          {activeDragId?.startsWith("pkg-") && (
            <div className="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary/70 text-center">
              Drag onto a folder in the sidebar to move this package
            </div>
          )}

          {/* Items list */}
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="shadow-sm"><CardContent className="p-4"><Skeleton className="h-14 w-full" /></CardContent></Card>
            ))}</div>
          ) : unifiedItems.length === 0 ? (
            <Card className="shadow-sm border-border/60">
              <CardContent className="py-16 text-center">
                <FileArchive className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="font-medium text-muted-foreground">
                  {search || typeFilter !== "all" ? "No items match your filters" : selectedFolderId !== null ? "This folder is empty" : "No content yet"}
                </p>
                {!search && typeFilter === "all" && selectedFolderId === null && (
                  <Button size="sm" className="mt-4 gap-2" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-3.5 w-3.5" />Upload your first file
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-sm border-border/60 overflow-hidden">
              <div className="divide-y divide-border/50">
                <div className="hidden sm:grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-5 py-2.5 bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <span className="w-9" />
                  <span>Name</span>
                  <span className="text-center">Type</span>
                  <span className="text-center">Actions</span>
                  <span className="text-right">Menu</span>
                </div>
                <SortableContext items={pkgSortableIds} strategy={verticalListSortingStrategy}>
                  {unifiedItems.map((item) =>
                    item.kind === "package" ? (
                      <PackageRow
                        key={`pkg-${item.data.id}`}
                        pkg={item.data}
                        folders={folders}
                        onNavigate={setLocation}
                        onDelete={(id) => setDeletePackageId(id)}
                        onMove={(packageId, folderId) => movePackageMut.mutate({ packageId, folderId })}
                      />
                    ) : (
                      <MediaRow
                        key={`media-${item.data.id}`}
                        item={item.data}
                        folders={folders}
                        onDelete={(id) => setDeleteMediaId(id)}
                        onMove={(mediaId, folderId) => moveMediaToFolderMut.mutate({ orgId, ids: [mediaId], folderId })}
                        onReplace={(item) => {
                          setReplaceTarget(item);
                          setReplaceFile(null);
                          setReplaceProgress(0);
                          // Trigger file picker
                          setTimeout(() => replaceFileInputRef.current?.click(), 50);
                        }}
                      />
                    )
                  )}
                </SortableContext>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Hidden file input for Replace File */}
      <input
        ref={replaceFileInputRef}
        type="file"
        accept={ALL_ACCEPTED}
        className="hidden"
        onChange={handleReplaceFileSelected}
      />

      {/* DragOverlay */}
      <DragOverlay>
        {activePkg && (
          <div className="flex items-center gap-3 bg-background border border-border rounded-lg px-4 py-3 shadow-xl opacity-90 w-72">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><FileArchive className="h-4 w-4 text-primary" /></div>
            <p className="text-sm font-medium truncate">{activePkg.title}</p>
          </div>
        )}
        {activeFolder && (
          <div className="flex items-center gap-2 bg-background border border-border rounded-md px-3 py-2 shadow-xl opacity-90 w-48">
            <Folder className="h-4 w-4 text-primary/70 shrink-0" />
            <span className="text-sm truncate">{activeFolder.name}</span>
          </div>
        )}
      </DragOverlay>

      {/* ── Replace File Confirmation Dialog ── */}
      <Dialog
        open={replaceTarget !== null && replaceFile !== null}
        onOpenChange={(o) => { if (!o && !replaceUploading) { setReplaceTarget(null); setReplaceFile(null); } }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              Replace File
            </DialogTitle>
            <DialogDescription>
              The original CDN URL will remain unchanged — all existing embeds and links will continue to work.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Current file */}
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Current file</p>
              <p className="text-sm font-medium truncate">{replaceTarget?.filename}</p>
              <p className="text-xs text-muted-foreground">{formatBytes(replaceTarget?.fileSize ?? 0)} &bull; {replaceTarget?.mimeType}</p>
            </div>

            {/* Arrow */}
            <div className="flex items-center justify-center">
              <div className="flex flex-col items-center gap-1 text-muted-foreground">
                <div className="h-px w-24 bg-border" />
                <span className="text-xs">will be replaced by</span>
                <div className="h-px w-24 bg-border" />
              </div>
            </div>

            {/* New file */}
            {replaceFile && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1">
                <p className="text-xs font-semibold text-primary uppercase tracking-wider">New file</p>
                <p className="text-sm font-medium truncate">{replaceFile.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(replaceFile.size)} &bull; {replaceFile.type || "unknown type"}</p>
              </div>
            )}

            {/* Progress bar */}
            {replaceUploading && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Uploading…</span>
                  <span>{replaceProgress}%</span>
                </div>
                <Progress value={replaceProgress} className="h-1.5" />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setReplaceTarget(null); setReplaceFile(null); }} disabled={replaceUploading}>
              Cancel
            </Button>
            <Button
              onClick={handleReplaceConfirm}
              disabled={!replaceFile || replaceUploading}
              className="gap-2"
            >
              {replaceUploading ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Uploading…</>
              ) : (
                <><RefreshCw className="h-4 w-4" />Replace File</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Folder Create/Rename Dialog ── */}
      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{folderDialogMode === "create" ? (folderDialogParentId ? "New Subfolder" : "New Folder") : "Rename Folder"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="folder-name">Folder name</Label>
              <Input id="folder-name" value={folderName} onChange={(e) => setFolderName(e.target.value)} placeholder="e.g. Cardiology Courses" onKeyDown={(e) => { if (e.key === "Enter") handleFolderDialogSubmit(); }} autoFocus />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleFolderDialogSubmit} disabled={!folderName.trim() || createFolderMut.isPending || renameFolderMut.isPending}>
              {folderDialogMode === "create" ? "Create" : "Rename"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Package Dialog ── */}
      <AlertDialog open={deletePackageId !== null} onOpenChange={(o) => !o && setDeletePackageId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Package</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the package and all its versions. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deletePackageId && deletePackageMut.mutate({ id: deletePackageId })}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete Media Dialog ── */}
      <AlertDialog open={deleteMediaId !== null} onOpenChange={(o) => !o && setDeleteMediaId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete File</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove the file from your media library. Any references to this file will be broken. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleteMediaId && deleteMediaMut.mutate({ orgId, id: deleteMediaId })}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete Folder Dialog ── */}
      <AlertDialog open={deleteFolderTarget !== null} onOpenChange={(o) => !o && setDeleteFolderTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Folder</AlertDialogTitle>
            <AlertDialogDescription>The folder <strong>"{deleteFolderTarget?.name}"</strong> will be deleted. Any subfolders will be promoted to its parent level, and all packages inside will be moved to Uncategorized. No content will be lost.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleteFolderTarget && deleteFolderMut.mutate({ id: deleteFolderTarget.id })}>Delete Folder</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── SCORM Upload Dialog ── */}
      <Dialog open={showScormDialog} onOpenChange={(o) => { if (!o) { setShowScormDialog(false); setPendingZipFile(undefined); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
          <UploadPage
            initialFile={pendingZipFile}
            onClose={() => { setShowScormDialog(false); setPendingZipFile(undefined); refetchPkgs(); }}
            onSuccess={() => { refetchPkgs(); }}
          />
        </DialogContent>
      </Dialog>
    </DndContext>
  );
}
