/**
 * UploadQueuePanel
 *
 * A floating, minimizable tray that shows the current upload queue.
 * Renders in the bottom-right corner of the viewport as a global overlay.
 * Auto-hides when there are no items and is minimized.
 */

import { useState } from "react";
import {
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Film,
  Loader2,
  Music,
  Trash2,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUploadQueue, type UploadQueueItem } from "@/contexts/UploadQueueContext";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function ItemIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("audio/")) {
    return <Music className="h-4 w-4 text-primary shrink-0" />;
  }
  return <Film className="h-4 w-4 text-primary shrink-0" />;
}

function StatusIcon({ item }: { item: UploadQueueItem }) {
  switch (item.status) {
    case "queued":
      return <Upload className="h-4 w-4 text-muted-foreground shrink-0" />;
    case "uploading":
    case "saving":
      return <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />;
    case "done":
      return <CheckCircle className="h-4 w-4 text-[var(--org-primary)] shrink-0" />;
    case "error":
      return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
  }
}

function PhaseLabel({ item }: { item: UploadQueueItem }) {
  switch (item.status) {
    case "queued":
      return <span className="text-xs text-muted-foreground">Queued</span>;
    case "uploading":
      return (
        <span className="text-xs text-primary font-medium">
          Uploading… {item.progress}%
        </span>
      );
    case "saving":
      return (
        <span className="text-xs text-primary font-medium">
          Saving to storage… {item.progress}%
        </span>
      );
    case "done":
      return <span className="text-xs text-[var(--org-primary)] font-medium">Complete</span>;
    case "error":
      return (
        <span className="text-xs text-destructive font-medium truncate max-w-[160px]" title={item.errorMessage}>
          {item.errorMessage ?? "Failed"}
        </span>
      );
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function UploadQueuePanel() {
  const { items, remove, clearDone, isVisible, setVisible } = useUploadQueue();
  const [minimized, setMinimized] = useState(false);

  const activeCount = items.filter(
    (i) => i.status === "uploading" || i.status === "saving" || i.status === "queued"
  ).length;
  const doneCount = items.filter((i) => i.status === "done" || i.status === "error").length;

  // Don't render if there's nothing to show
  if (!isVisible || items.length === 0) return null;

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50 w-80 rounded-2xl border border-border bg-card shadow-2xl shadow-black/20 overflow-hidden transition-all",
        "flex flex-col"
      )}
      style={{ maxHeight: minimized ? "56px" : "420px" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-card border-b border-border shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {activeCount > 0 ? (
            <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
          ) : (
            <CheckCircle className="h-4 w-4 text-[var(--org-primary)] shrink-0" />
          )}
          <span className="text-sm font-semibold truncate">
            {activeCount > 0
              ? `Uploading ${activeCount} file${activeCount !== 1 ? "s" : ""}…`
              : `${doneCount} upload${doneCount !== 1 ? "s" : ""} complete`}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {doneCount > 0 && !minimized && (
            <button
              onClick={clearDone}
              className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Clear completed"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={() => setMinimized((v) => !v)}
            className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title={minimized ? "Expand" : "Minimize"}
          >
            {minimized ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
          {activeCount === 0 && (
            <button
              onClick={() => setVisible(false)}
              className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Item list */}
      {!minimized && (
        <div className="overflow-y-auto flex-1">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-1.5 px-4 py-3 border-b border-border last:border-0"
            >
              <div className="flex items-center gap-2">
                <ItemIcon mimeType={item.file.type} />
                <span className="text-sm font-medium truncate flex-1 min-w-0">
                  {item.file.name}
                </span>
                <StatusIcon item={item} />
                {(item.status === "done" || item.status === "error") && (
                  <button
                    onClick={() => remove(item.id)}
                    className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    title="Remove"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Progress bar — only for active items */}
              {(item.status === "uploading" || item.status === "saving") && (
                <div className="w-full bg-muted rounded-full h-1.5 ml-6">
                  <div
                    className="bg-primary h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              )}

              <div className="flex items-center justify-between ml-6">
                <PhaseLabel item={item} />
                <span className="text-xs text-muted-foreground">
                  {formatFileSize(item.file.size)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
