import { useEffect, useRef, useState } from "react";
import { useUploadQueue } from "@/contexts/UploadQueueContext";
import { studioRecordingExtension, type StudioCaptureResult } from "./studioCaptureSession";
export interface StudioLocalRecording extends StudioCaptureResult { url: string; name: string; size: number }
export interface StudioSavedMedia { id: number; url: string; filename: string; mimeType: string; fileSize: number; durationSeconds?: number | null }
export function studioLocalRecording(result: StudioCaptureResult, audioOnly = false): StudioLocalRecording {
  return { ...result, url: URL.createObjectURL(result.blob), size: result.blob.size,
    name: `${audioOnly ? "audio" : "Recording"}-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-")}-${result.id.slice(0, 8)}.${studioRecordingExtension(result.mimeType)}` };
}
/** Browser-memory recovery only. No silent IndexedDB/localStorage copy of private media. */
export function useStudioRecordingLibrary(orgId: number, persist: (input: any) => Promise<any>, onSaved?: (item: StudioSavedMedia) => void) {
  const queue = useUploadQueue();
  const [savedItems, setSavedItems] = useState<Record<string, StudioSavedMedia>>({});
  const savedRef = useRef<Record<string, StudioSavedMedia>>({});
  const queueIds = useRef(new Map<string, string>());
  const liveRef = useRef(true); const persistRef = useRef(persist); const savedCallbackRef = useRef(onSaved);
  persistRef.current = persist; savedCallbackRef.current = onSaved;
  useEffect(() => { liveRef.current = true; return () => { liveRef.current = false; }; }, []);
  const save = (recording: StudioLocalRecording) => {
    if (savedRef.current[recording.id]) return;
    const previousId = queueIds.current.get(recording.id);
    if (previousId) { queue.retry(previousId); return; }
    if (!Number.isInteger(orgId) || orgId <= 0) throw new Error("Select an active school before saving a recording.");
    const file = new File([recording.blob], recording.name, { type: recording.mimeType });
    const queueId = queue.enqueue({ file, orgId, folder: "lms-media", onComplete: async result => {
      if (!result?.key || !result.url) throw new Error("No stored recording returned");
      // A persisted success is remembered before notification; retries never repeat a completed save.
      if (savedRef.current[recording.id]) return;
      const saved = await persistRef.current({ orgId, fileName: recording.name, mimeType: recording.mimeType,
        fileSize: result.fileSize, fileKey: result.key, url: result.url, durationSeconds: recording.duration,
        tags: recording.mimeType.startsWith("audio/") ? ["audio", "recording"] : ["recording"], source: "direct" });
      if (!Number.isInteger(saved?.id) || saved.id <= 0) throw new Error("Recording metadata was not persisted");
      const item: StudioSavedMedia = { id: saved.id, url: result.url, filename: recording.name,
        mimeType: recording.mimeType, fileSize: result.fileSize, durationSeconds: recording.duration };
      savedRef.current[recording.id] = item;
      if (liveRef.current) { setSavedItems(previous => ({ ...previous, [recording.id]: item })); savedCallbackRef.current?.(item); }
    } });
    queueIds.current.set(recording.id, queueId);
  };
  const status = (id: string) => queue.items.find(item => item.id === queueIds.current.get(id));
  return { save, savedItems, status, hasPending: queue.items.some(item => [...queueIds.current.values()].includes(item.id) && !["done", "error"].includes(item.status)) };
}
