import React from "react";
import { FileText, Loader2, Upload, X } from "lucide-react";

export type AiSourceReviewFile = { url: string; mimeType: string; name: string; storageKey?: string };

export function AiSourceFileReview({ sourceFiles, isUploading, onFiles, onRemove, description, allowPowerPointSources = false }: {
  sourceFiles: AiSourceReviewFile[];
  isUploading: boolean;
  onFiles: (files: File[]) => void;
  onRemove: (index: number) => void;
  description: string;
  allowPowerPointSources?: boolean;
}) {
  const accept = allowPowerPointSources ? ".pdf,.ppt,.pptx,.jpg,.jpeg,.png,.webp,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,image/jpeg,image/png,image/webp" : "application/pdf,image/jpeg,image/png,image/webp";
  const chooseFiles = (files: File[]) => { if (!isUploading && sourceFiles.length < 3) onFiles(files); };
  return <div className="rounded-lg border border-dashed border-[color:var(--org-primary)] bg-white p-3" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); chooseFiles(Array.from(event.dataTransfer.files)); }}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><p className="text-sm font-medium text-[color:var(--org-primary)]">{allowPowerPointSources ? "Source PDFs, PowerPoint or images (optional)" : "Source PDFs or images (optional)"}</p><p className="text-xs text-gray-500">{description}</p></div>
      <label className="cursor-pointer"><input type="file" multiple accept={accept} disabled={isUploading || sourceFiles.length >= 3} className="hidden" onChange={event => { chooseFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = ""; }} /><span className="inline-flex items-center rounded-md border border-[color:var(--org-primary)] px-3 py-2 text-xs font-medium text-[color:var(--org-primary)] hover:bg-[color:var(--org-primary)]/10">{isUploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}{isUploading ? "Uploading…" : "Add source files"}</span></label>
    </div>
    {sourceFiles.length > 0 && <div className="mt-2 space-y-1" aria-label="Source review">{sourceFiles.map((source, index) => <div key={`${source.url}-${index}`} className="flex items-center gap-2 rounded bg-[color:var(--org-primary)]/10 px-2 py-1.5 text-xs text-[color:var(--org-primary)]"><FileText className="h-3.5 w-3.5" /><span className="truncate">{source.name}</span><span>Ready</span><button type="button" disabled={isUploading} onClick={() => onRemove(index)} className="ml-auto text-red-600 hover:text-red-700" aria-label={`Remove ${source.name}`}><X className="h-3.5 w-3.5" /></button></div>)}</div>}
  </div>;
}
