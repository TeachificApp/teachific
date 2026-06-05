/**
 * UploadQueueContext
 *
 * Provides a global background upload queue for TeachificStudio.
 * Files are uploaded in 5 MB chunks to avoid proxy timeout limits.
 * Files are processed one at a time (sequential) so the storage endpoint
 * is never flooded. Users can navigate away and uploads continue.
 *
 * Chunked upload flow (mirrors SCORM package upload):
 *   POST /api/chunked/media/initiate   → { uploadId }
 *   POST /api/chunked/media/chunk/:uploadId  (repeat per 5 MB chunk)
 *   POST /api/chunked/media/finalize/:uploadId → { key, url, fileName, fileSize, fileType }
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type UploadStatus = "queued" | "uploading" | "saving" | "done" | "error";

export interface UploadQueueItem {
  id: string;
  file: File;
  orgId: number;
  folder: string;
  /** 0–100 */
  progress: number;
  phase: "uploading" | "saving";
  status: UploadStatus;
  errorMessage?: string;
  /** Populated on success */
  result?: {
    key: string;
    url: string;
    fileName: string;
    fileSize: number;
    fileType: string;
  };
}

export interface EnqueueOptions {
  file: File;
  orgId: number;
  folder?: string;
  onComplete?: (result: UploadQueueItem["result"]) => void;
  onError?: (message: string) => void;
}

interface UploadQueueContextValue {
  items: UploadQueueItem[];
  enqueue: (opts: EnqueueOptions) => string; // returns item id
  remove: (id: string) => void;
  clearDone: () => void;
  isVisible: boolean;
  setVisible: (v: boolean) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const UploadQueueContext = createContext<UploadQueueContextValue | null>(null);

// ─── Constants ────────────────────────────────────────────────────────────────

const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB per chunk

// ─── Provider ─────────────────────────────────────────────────────────────────

let idCounter = 0;
function nextId() {
  return `uq-${Date.now()}-${++idCounter}`;
}

export function UploadQueueProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<UploadQueueItem[]>([]);
  const [isVisible, setVisible] = useState(false);
  const processingRef = useRef(false);

  const callbacksRef = useRef<
    Map<string, { onComplete?: EnqueueOptions["onComplete"]; onError?: EnqueueOptions["onError"] }>
  >(new Map());

  // ── Helpers ──────────────────────────────────────────────────────────────

  const updateItem = useCallback(
    (id: string, patch: Partial<UploadQueueItem>) => {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
      );
    },
    []
  );

  // ── Upload a single chunk ─────────────────────────────────────────────────

  async function uploadChunk(uploadId: string, chunkBlob: Blob, chunkIndex: number): Promise<void> {
    const formData = new FormData();
    formData.append("chunk", chunkBlob, `chunk-${chunkIndex}`);
    formData.append("chunkIndex", String(chunkIndex));

    const res = await fetch(`/api/chunked/media/chunk/${uploadId}`, {
      method: "POST",
      body: formData,
      credentials: "include",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(body.error ?? `Chunk ${chunkIndex} upload failed: ${res.status}`);
    }
  }

  // ── Core upload logic for a single item ──────────────────────────────────

  const uploadOne = useCallback(
    async (item: UploadQueueItem) => {
      updateItem(item.id, { status: "uploading", progress: 0, phase: "uploading" });

      const { file, orgId, folder } = item;
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

      try {
        // 1. Initiate chunked session
        const initiateRes = await fetch("/api/chunked/media/initiate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            totalChunks,
            filename: file.name,
            orgId,
            folder,
            contentType: file.type || "application/octet-stream",
          }),
        });
        if (!initiateRes.ok) {
          const body = await initiateRes.json().catch(() => ({ error: `HTTP ${initiateRes.status}` }));
          throw new Error(body.error ?? "Failed to initiate upload");
        }
        const { uploadId } = await initiateRes.json();

        // 2. Upload chunks sequentially, updating progress as we go
        for (let i = 0; i < totalChunks; i++) {
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunkBlob = file.slice(start, end);
          await uploadChunk(uploadId, chunkBlob, i);
          // Scale chunk progress to 0–90% (finalize takes the last 10%)
          const chunkProgress = Math.round(((i + 1) / totalChunks) * 90);
          updateItem(item.id, { progress: chunkProgress, phase: "uploading" });
        }

        // 3. Finalize — server assembles chunks and streams to storage
        updateItem(item.id, { status: "saving", phase: "saving", progress: 92 });
        const finalizeRes = await fetch(`/api/chunked/media/finalize/${uploadId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({}),
        });
        if (!finalizeRes.ok) {
          const body = await finalizeRes.json().catch(() => ({ error: `HTTP ${finalizeRes.status}` }));
          throw new Error(body.error ?? "Finalize failed");
        }
        const result = await finalizeRes.json();

        updateItem(item.id, { status: "done", progress: 100, result });
        callbacksRef.current.get(item.id)?.onComplete?.(result);
      } catch (err: any) {
        const msg = err?.message ?? "Upload failed";
        updateItem(item.id, { status: "error", errorMessage: msg });
        callbacksRef.current.get(item.id)?.onError?.(msg);
      } finally {
        callbacksRef.current.delete(item.id);
      }
    },
    [updateItem]
  );

  // ── Sequential processor ──────────────────────────────────────────────────

  useEffect(() => {
    const runNext = async () => {
      if (processingRef.current) return;

      const queued = items.find((i) => i.status === "queued");
      if (!queued) return;

      processingRef.current = true;
      await uploadOne(queued);
      processingRef.current = false;
    };

    runNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  // ── Public API ────────────────────────────────────────────────────────────

  const enqueue = useCallback(
    (opts: EnqueueOptions): string => {
      const id = nextId();
      const newItem: UploadQueueItem = {
        id,
        file: opts.file,
        orgId: opts.orgId,
        folder: opts.folder ?? "lms-media",
        progress: 0,
        phase: "uploading",
        status: "queued",
      };
      callbacksRef.current.set(id, {
        onComplete: opts.onComplete,
        onError: opts.onError,
      });
      setItems((prev) => [...prev, newItem]);
      setVisible(true);
      return id;
    },
    []
  );

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    callbacksRef.current.delete(id);
  }, []);

  const clearDone = useCallback(() => {
    setItems((prev) => prev.filter((i) => i.status !== "done" && i.status !== "error"));
  }, []);

  return (
    <UploadQueueContext.Provider
      value={{ items, enqueue, remove, clearDone, isVisible, setVisible }}
    >
      {children}
    </UploadQueueContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useUploadQueue(): UploadQueueContextValue {
  const ctx = useContext(UploadQueueContext);
  if (!ctx) {
    throw new Error("useUploadQueue must be used inside <UploadQueueProvider>");
  }
  return ctx;
}
