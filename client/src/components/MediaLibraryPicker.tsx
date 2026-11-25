import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Upload, Image, Film, FileText, X, Check, Tag, Search } from "lucide-react";
import { toast } from "sonner";
import { parseCourse360MediaTags } from "@/lib/course360MediaLibrary";

export type MediaItem = {
  id: number;
  url: string;
  filename: string;
  mimeType: string;
  tags: string[];
  fileSize: number;
  createdAt: Date;
};

interface MediaLibraryPickerProps {
  orgId: number;
  onSelect: (item: MediaItem) => void;
  accept?: "image" | "video" | "all";
  trigger?: React.ReactNode;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function MediaIcon({ mimeType, className }: { mimeType: string; className?: string }) {
  if (mimeType.startsWith("image/")) return <Image className={className} />;
  if (mimeType.startsWith("video/")) return <Film className={className} />;
  return <FileText className={className} />;
}

export function MediaLibraryPicker({ orgId, onSelect, accept = "all", trigger }: MediaLibraryPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "image" | "video" | "document">("all");
  const [tagFilter, setTagFilter] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [newTagInput, setNewTagInput] = useState<Record<number, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: mediaResult, refetch } = trpc.forms.media.list.useQuery(
    { orgId },
    { enabled: open }
  );
  // Retain old array fixtures while honoring the actual paginated server API.
  const rawItems = Array.isArray(mediaResult) ? mediaResult : mediaResult?.items ?? [];
  const mediaItems = rawItems.map((item: any) => ({ ...item, tags: parseCourse360MediaTags(item.tags) })) as MediaItem[];
  const uploadMutation = trpc.forms.media.upload.useMutation({
    onSuccess: () => { refetch(); setUploading(false); toast.success("File uploaded to media library"); },
    onError: (e) => { setUploading(false); toast.error(e.message); },
  });
  const updateTagsMutation = trpc.forms.media.updateTags.useMutation({
    onSuccess: () => refetch(),
  });
  const deleteMutation = trpc.forms.media.delete.useMutation({
    onSuccess: () => { refetch(); toast.success("File deleted"); },
  });

  const items = (mediaItems as MediaItem[]).filter((item) => {
    const matchesSearch = !search || item.filename.toLowerCase().includes(search.toLowerCase());
    const matchesType =
      typeFilter === "all" ||
      (typeFilter === "image" && item.mimeType.startsWith("image/")) ||
      (typeFilter === "video" && item.mimeType.startsWith("video/")) ||
      (typeFilter === "document" && !item.mimeType.startsWith("image/") && !item.mimeType.startsWith("video/"));
    const matchesTag = !tagFilter || item.tags?.includes(tagFilter);
    return matchesSearch && matchesType && matchesTag;
  });

  const allTags = Array.from(new Set((mediaItems as MediaItem[]).flatMap((i) => i.tags ?? [])));

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadMutation.mutate({
        orgId,
        filename: file.name,
        mimeType: file.type,
        base64,
        fileSize: file.size,
        tags: [],
      } as any);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSelect = () => {
    const item = (mediaItems as MediaItem[]).find((i) => i.id === selected);
    if (item) {
      onSelect(item);
      setOpen(false);
      setSelected(null);
    }
  };

  const addTag = (itemId: number) => {
    const tag = newTagInput[itemId]?.trim();
    if (!tag) return;
    const item = (mediaItems as MediaItem[]).find((i) => i.id === itemId);
    if (!item) return;
    const newTags = [...(item.tags ?? []), tag];
    updateTagsMutation.mutate({ id: itemId, tags: newTags });
    setNewTagInput((prev) => ({ ...prev, [itemId]: "" }));
  };

  const removeTag = (itemId: number, tag: string) => {
    const item = (mediaItems as MediaItem[]).find((i) => i.id === itemId);
    if (!item) return;
    updateTagsMutation.mutate({ id: itemId, tags: (item.tags ?? []).filter((t) => t !== tag) });
  };

  const acceptAttr =
    accept === "image" ? "image/*" : accept === "video" ? "video/*" : "image/*,video/*,application/pdf,.doc,.docx";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-1.5">
            <Image className="h-3.5 w-3.5" />
            Media Library
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-0 shrink-0">
          <DialogTitle>Media Library</DialogTitle>
        </DialogHeader>

        {/* Toolbar */}
        <div className="px-6 py-3 border-b border-border flex items-center gap-3 flex-wrap shrink-0">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search files..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
            <SelectTrigger className="h-8 text-xs w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="image">Images</SelectItem>
              <SelectItem value="video">Videos</SelectItem>
              <SelectItem value="document">Documents</SelectItem>
            </SelectContent>
          </Select>
          {allTags.length > 0 && (
            <Select value={tagFilter || "all"} onValueChange={(v) => setTagFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="h-8 text-xs w-36">
                <SelectValue placeholder="All tags" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tags</SelectItem>
                {allTags.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 h-8 text-xs"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Upload
          </Button>
          <input ref={fileInputRef} type="file" accept={acceptAttr} className="hidden" onChange={handleFileUpload} />
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <Image className="h-12 w-12 opacity-30" />
              <p className="text-sm">No files yet. Upload your first file above.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {items.map((item) => {
                const isSelected = selected === item.id;
                return (
                  <div
                    key={item.id}
                    className={`group relative border rounded-lg overflow-hidden cursor-pointer transition-all ${
                      isSelected ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50"
                    }`}
                    onClick={() => setSelected(isSelected ? null : item.id)}
                  >
                    {/* Thumbnail */}
                    <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                      {item.mimeType.startsWith("image/") ? (
                        <img src={item.url} alt={item.filename} className="w-full h-full object-cover" />
                      ) : (
                        <MediaIcon mimeType={item.mimeType} className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>

                    {/* Selected check */}
                    {isSelected && (
                      <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                        <Check className="h-3 w-3" />
                      </div>
                    )}

                    {/* Delete button */}
                    <button
                      className="absolute top-1 left-1 bg-background/80 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => { e.stopPropagation(); deleteMutation.mutate({ id: item.id }); }}
                    >
                      <X className="h-3 w-3 text-destructive" />
                    </button>

                    {/* Info */}
                    <div className="p-2">
                      <p className="text-xs font-medium truncate">{item.filename}</p>
                      <p className="text-xs text-muted-foreground">{formatBytes(item.fileSize ?? 0)}</p>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-0.5 mt-1">
                        {(item.tags ?? []).map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="text-[10px] px-1 py-0 gap-0.5 cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); removeTag(item.id, tag); }}
                          >
                            {tag} <X className="h-2 w-2" />
                          </Badge>
                        ))}
                      </div>

                      {/* Add tag */}
                      <div
                        className="flex gap-1 mt-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Input
                          placeholder="+ tag"
                          value={newTagInput[item.id] ?? ""}
                          onChange={(e) => setNewTagInput((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") addTag(item.id); }}
                          className="h-5 text-[10px] px-1.5"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 w-5 p-0"
                          onClick={() => addTag(item.id)}
                        >
                          <Tag className="h-2.5 w-2.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between shrink-0">
          <span className="text-sm text-muted-foreground">{items.length} file{items.length !== 1 ? "s" : ""}</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSelect} disabled={!selected}>
              Insert Selected
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
