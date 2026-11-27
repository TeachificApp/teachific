import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Video, VideoOff, Mic, MicOff, Monitor, Circle, Square,
  Pause, Play, Download, Trash2, Settings, Camera,
  CheckCircle, Loader2, Clock, Library, FileText, Upload,
  Scissors, Subtitles, Save, Plus, X, Edit2, ChevronRight,
  Film, Wand2, ArrowLeft, Headphones, Volume2, Sparkles,
  Music, SlidersHorizontal, Type, Zap, AlignCenter, Link, Globe,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useOrgScope } from "@/hooks/useOrgScope";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useLocation } from "wouter";
import { useUploadQueue } from "@/contexts/UploadQueueContext";
import { StudioCaptureSession } from "@/lib/studioCaptureSession";
import { studioLocalRecording, useStudioRecordingLibrary, type StudioLocalRecording } from "@/lib/studioCapturePersistence";
import { readStudioTranscript, transcriptWords, literalReplace, fillerWordIds, deletedStudioRegions, segmentsFromStudioWords, serializeStudioSubtitles, makeStudioTranscriptEnvelope, downloadStudioBlob, normalizeStudioMediaList, validStudioClip, type StudioTranscriptWord } from "@/lib/studioCaptionDocument";

// ─── Types ───────────────────────────────────────────────────────────────────

type RecordMode = "screen" | "camera" | "screen+camera";
type RecordState = "idle" | "countdown" | "recording" | "paused" | "stopped";
type StudioTab = "record" | "upload" | "edit" | "audio";

interface TranscriptSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

interface ClipSelection {
  id: string;
  label: string;
  startSec: number;
  endSec: number;
  savedId?: number;
}

interface MediaItem {
  id: number;
  url: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  durationSeconds?: number | null;
  captionsUrl?: string | null;
  transcriptJson?: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ─── CC Style System ─────────────────────────────────────────────────────────

interface CCStyle {
  textColor: string;       // hex
  bgColor: string;         // hex
  bgOpacity: number;       // 0-1
  bold: boolean;
  italic: boolean;
  shadow: boolean;
  fontSize: number;        // px, 14-40
  emojiEnabled: boolean;
  fontFamily: string;
}

const CC_DEFAULT_STYLE: CCStyle = {
  textColor: "#ffffff",
  bgColor: "#000000",
  bgOpacity: 0.75,
  bold: true,
  italic: false,
  shadow: true,
  fontSize: 22,
  emojiEnabled: false,
  fontFamily: "Arial",
};

const CC_PRESETS: { id: string; label: string; emoji: string; style: Partial<CCStyle> }[] = [
  { id: "classic",  label: "Classic",  emoji: "📺", style: { textColor: "#ffffff", bgColor: "#000000", bgOpacity: 0.75, bold: true,  italic: false, shadow: false, fontSize: 22 } },
  { id: "neon",     label: "Neon",     emoji: "⚡", style: { textColor: "#00ffcc", bgColor: "#000000", bgOpacity: 0.8,  bold: true,  italic: false, shadow: true,  fontSize: 22 } },
  { id: "karaoke",  label: "Karaoke",  emoji: "🎤", style: { textColor: "#ffee00", bgColor: "#1a0050", bgOpacity: 0.85, bold: true,  italic: false, shadow: true,  fontSize: 24 } },
  { id: "tiktok",   label: "TikTok",   emoji: "🎵", style: { textColor: "#ffffff", bgColor: "#fe2c55", bgOpacity: 0.9,  bold: true,  italic: false, shadow: false, fontSize: 24 } },
  { id: "fire",     label: "Fire",     emoji: "🔥", style: { textColor: "#ff6b00", bgColor: "#1a0000", bgOpacity: 0.85, bold: true,  italic: true,  shadow: true,  fontSize: 24 } },
  { id: "minimal",  label: "Minimal",  emoji: "🤍", style: { textColor: "#ffffff", bgColor: "#000000", bgOpacity: 0.0,  bold: false, italic: false, shadow: true,  fontSize: 18 } },
  { id: "purple",   label: "Purple",   emoji: "💜", style: { textColor: "#ffffff", bgColor: "#6d28d9", bgOpacity: 0.85, bold: true,  italic: false, shadow: false, fontSize: 22 } },
  { id: "white",    label: "White",    emoji: "🌟", style: { textColor: "#000000", bgColor: "#ffffff", bgOpacity: 0.9,  bold: true,  italic: false, shadow: false, fontSize: 22 } },
];

// Emoji keyword map for auto-insert
const EMOJI_MAP: [RegExp, string][] = [
  [/\b(happy|happiness|joy|joyful|excited|excite)\b/i, "😊"],
  [/\b(love|loving|heart|adore)\b/i, "❤️"],
  [/\b(fire|hot|amazing|incredible|insane|crazy)\b/i, "🔥"],
  [/\b(laugh|funny|haha|lol|hilarious)\b/i, "😂"],
  [/\b(think|thinking|idea|brain|smart|clever)\b/i, "💡"],
  [/\b(money|cash|dollar|profit|revenue|earn)\b/i, "💰"],
  [/\b(star|stars|great|excellent|perfect|awesome)\b/i, "⭐"],
  [/\b(music|song|sing|singing|beat|rhythm)\b/i, "🎵"],
  [/\b(learn|learning|study|education|school|teach)\b/i, "📚"],
  [/\b(win|winning|winner|success|succeed|champion)\b/i, "🏆"],
  [/\b(time|clock|schedule|deadline|today|now)\b/i, "⏰"],
  [/\b(world|global|international|everywhere)\b/i, "🌍"],
  [/\b(phone|call|mobile|text|message)\b/i, "📱"],
  [/\b(computer|laptop|tech|technology|digital|software)\b/i, "💻"],
  [/\b(team|together|community|group|people|everyone)\b/i, "👥"],
  [/\b(grow|growth|increase|improve|better|progress)\b/i, "📈"],
  [/\b(problem|issue|challenge|difficult|hard|tough)\b/i, "⚠️"],
  [/\b(check|done|complete|finished|ready)\b/i, "✅"],
  [/\b(new|launch|release|announce|introducing)\b/i, "🚀"],
  [/\b(question|ask|wonder|curious|why|how)\b/i, "❓"],
];

function applyEmojiMap(text: string): string {
  let result = text;
  for (const [re, emoji] of EMOJI_MAP) {
    result = result.replace(re, (m) => `${m} ${emoji}`);
  }
  return result;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── VideoEditor Sub-component ───────────────────────────────────────────────

function VideoEditor({ item, orgId, onSaved, onDirtyChange }: { item: MediaItem; orgId: number; onSaved?: () => void; onDirtyChange?: (dirty: boolean) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const transcriptPanelRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(item.durationSeconds ?? 0);
  const [isPlaying, setIsPlaying] = useState(false);
  const originalDocument = useRef(readStudioTranscript(item.transcriptJson));
  const [showCaptions, setShowCaptions] = useState(originalDocument.current.studioEdit?.showCaptions ?? true);
  const [ccStyle, setCCStyle] = useState<CCStyle>({ ...CC_DEFAULT_STYLE, ...originalDocument.current.studioEdit?.captionStyle });
  const [presetId, setPresetId] = useState(originalDocument.current.studioEdit?.presetId ?? "classic");
  const revisionRef = useRef(originalDocument.current.studioEdit?.revision ?? 0);
  const dirtyRef = useRef(false);
  const setDirty = (dirty: boolean) => { dirtyRef.current = dirty; onDirtyChange?.(dirty); };
  const mountedRef = useRef(true);
  const requestRef = useRef(0);
  const [history, setHistory] = useState<StudioTranscriptWord[][]>([]);
  const [redoHistory, setRedoHistory] = useState<StudioTranscriptWord[][]>([]);
  const previewClipEndRef = useRef<number | null>(null);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; requestRef.current++; }; }, []);
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (dirtyRef.current) { event.preventDefault(); event.returnValue = "Caption edits are not saved."; } }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, []);
  const [showStylePanel, setShowStylePanel] = useState(false);
  // Word-level transcript (Opus Clip style)
  type TranscriptWord = StudioTranscriptWord;
  const [words, setWords] = useState<TranscriptWord[]>(() => transcriptWords(originalDocument.current));
  const editWords = (transform: (previous: TranscriptWord[]) => TranscriptWord[]) => {
    setHistory(previous => [...previous.slice(-49), words]); setRedoHistory([]);
    setWords(transform(words)); setDirty(true); revisionRef.current++;
  };
  const undoWords = () => {
    const previous = history[history.length - 1]; if (!previous) return;
    setRedoHistory(redos => [...redos, words]); setWords(previous); setFindResults([]); setHistory(history.slice(0, -1)); setDirty(true); revisionRef.current++;
  };
  const redoWords = () => {
    const next = redoHistory[redoHistory.length - 1]; if (!next) return;
    setHistory(previous => [...previous, words]); setWords(next); setFindResults([]); setRedoHistory(redoHistory.slice(0, -1)); setDirty(true); revisionRef.current++;
  };
  const [segments, setSegments] = useState<TranscriptSegment[]>(() => {
    if (item.transcriptJson) {
      try {
        const parsed = JSON.parse(item.transcriptJson);
        return parsed.segments ?? (Array.isArray(parsed) ? parsed : []);
      } catch { return []; }
    }
    return [];
  });
  const [captionsUrl, setCaptionsUrl] = useState(item.captionsUrl ?? null);
  const [clips, setClips] = useState<ClipSelection[]>([]);
  const [clipStart, setClipStart] = useState<number | null>(null);
  const [clipEnd, setClipEnd] = useState<number | null>(null);
  const [clipLabel, setClipLabel] = useState("Highlight");
  const [generatingCaptions, setGeneratingCaptions] = useState(false);
  const [savingCaptions, setSavingCaptions] = useState(false);
  const [savingClip, setSavingClip] = useState(false);
  const [downloadingFull, setDownloadingFull] = useState(false);
  const [autoGeneratingClips, setAutoGeneratingClips] = useState(false);
  const [downloadingClipId, setDownloadingClipId] = useState<string | null>(null);
  // Find & Replace state
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [findResults, setFindResults] = useState<number[]>([]);
  const [findIndex, setFindIndex] = useState(0);
  // Filler words
  const FILLER_WORDS = ["uh", "um", "uhm", "hmm", "like", "you know", "so", "right", "basically", "actually", "literally", "i mean"];
  const [fillerCount, setFillerCount] = useState(0);
  // Video source mode
  const [videoSourceMode, setVideoSourceMode] = useState<"current" | "upload" | "url" | "record">("current");
  const [urlInput, setUrlInput] = useState("");
  const [downloadingUrl, setDownloadingUrl] = useState(false);

  const generateCaptionsMutation = trpc.lms.media.generateCaptions.useMutation();
  const updateCaptionsMutation = trpc.lms.media.updateCaptions.useMutation();
  const saveClipMutation = trpc.lms.media.saveClip.useMutation();
  const importVideoMutation = trpc.lms.media.importFromUrl.useMutation();
  const listClipsQuery = trpc.lms.media.listClips.useQuery(
    { orgId, mediaItemId: item.id },
    { enabled: !!item.id }
  );
  const deleteClipMutation = trpc.lms.media.deleteClip.useMutation();
  const renderEditedVideoMutation = trpc.lms.media.renderEditedVideo.useMutation();
  const generateHighlightsMutation = trpc.lms.media.generateHighlights.useMutation();

  const hasAutoTriggeredRef = useRef(false);
  useEffect(() => {
    if (dirtyRef.current || !item.transcriptJson) return;
    const incoming = readStudioTranscript(item.transcriptJson);
    const incomingRevision = Number(incoming.studio?.revision ?? 0);
    const currentRevision = Number(originalDocument.current.studio?.revision ?? 0);
    if (incomingRevision > currentRevision) {
      originalDocument.current = incoming; setWords(transcriptWords(incoming)); setSegments(incoming.segments ?? []);
      setCCStyle({ ...CC_DEFAULT_STYLE, ...incoming.studioEdit?.captionStyle });
      setShowCaptions(incoming.studioEdit?.showCaptions ?? true); setPresetId(incoming.studioEdit?.presetId ?? "classic");
      revisionRef.current = Number(incoming.studioEdit?.revision ?? revisionRef.current);
    }
  }, [item.transcriptJson]);
  const applyGeneratedTranscript = (result: any) => {
    const document = { ...originalDocument.current, ...result };
    revisionRef.current = Number(document.studioEdit?.revision ?? revisionRef.current);
    setWords(transcriptWords(document)); setSegments(result.segments ?? []); setCaptionsUrl(result.captionsUrl);
    originalDocument.current = document; setHistory([]); setRedoHistory([]); setDirty(false);
  };
  useEffect(() => {
    if (!item.transcriptJson && !hasAutoTriggeredRef.current && item.id) {
      hasAutoTriggeredRef.current = true;
      const request = ++requestRef.current; const revision = revisionRef.current;
      setGeneratingCaptions(true);
      generateCaptionsMutation.mutateAsync({ orgId, mediaItemId: item.id })
        .then(result => { if (mountedRef.current && request === requestRef.current && revision === revisionRef.current) { applyGeneratedTranscript(result); onSaved?.(); } })
        .catch(error => { if (mountedRef.current) toast.error("Auto-transcription failed: " + error.message); })
        .finally(() => { if (mountedRef.current) setGeneratingCaptions(false); });
    }
  }, [item.id]);

  // Load saved clips from DB
  useEffect(() => {
    if (listClipsQuery.data) {
      setClips(previous => [...listClipsQuery.data.map((c: any) => ({
        id: `db-${c.id}`, label: c.label, startSec: c.startSec, endSec: c.endSec, savedId: c.id,
      })), ...previous.filter(clip => !clip.savedId)]);
    }
  }, [listClipsQuery.data]);

  const fillerIds = fillerWordIds(words, FILLER_WORDS);
  useEffect(() => { setFillerCount(fillerIds.size); }, [words]);
  useEffect(() => { setFindResults([]); setFindIndex(0); }, [findText]);

  // Video event handlers
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const t = videoRef.current.currentTime;
    if (previewClipEndRef.current !== null && t >= previewClipEndRef.current) {
      videoRef.current.pause(); videoRef.current.currentTime = previewClipEndRef.current; setCurrentTime(previewClipEndRef.current); setIsPlaying(false); previewClipEndRef.current = null; return;
    }
    setCurrentTime(t);
    // Skip deleted word regions during playback
    if (isPlaying && words.length > 0) {
      const deletedRegions = getDeletedRegions();
      for (const region of deletedRegions) {
        if (t >= region.start && t < region.end) {
          videoRef.current.currentTime = region.end;
          return;
        }
      }
    }
  };
  const handleLoadedMetadata = () => { if (videoRef.current && Number.isFinite(videoRef.current.duration)) setDuration(videoRef.current.duration); };
  const handlePlayPause = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) { videoRef.current.play(); setIsPlaying(true); }
    else { videoRef.current.pause(); setIsPlaying(false); }
  };
  const seekTo = (sec: number) => { previewClipEndRef.current = null; if (videoRef.current) { videoRef.current.currentTime = sec; setCurrentTime(sec); } };

  const getDeletedRegions = useCallback(() => deletedStudioRegions(words), [words]);

  // Active word for CC overlay
  const activeWord = words.find((w) => !w.deleted && currentTime >= w.start && currentTime <= w.end);
  // Get current caption line (group of ~5 words around active word)
  const getCaptionLine = useCallback(() => {
    if (!activeWord) return "";
    const visibleWords = words.filter((w) => !w.deleted);
    const idx = visibleWords.findIndex((w) => w.id === activeWord.id);
    if (idx === -1) return activeWord.word;
    const start = Math.max(0, idx - 2);
    const end = Math.min(visibleWords.length, idx + 3);
    return visibleWords.slice(start, end).map((w) => w.word).join(" ");
  }, [activeWord, words]);

  const handleGenerateCaptions = async () => {
    if (dirtyRef.current && !window.confirm("Regenerate the transcript? Unsaved caption edits will be replaced.")) return;
    const request = ++requestRef.current; const revision = revisionRef.current;
    setGeneratingCaptions(true);
    try {
      const result = await generateCaptionsMutation.mutateAsync({ orgId, mediaItemId: item.id });
      if (!mountedRef.current || request !== requestRef.current || revision !== revisionRef.current) return;
      applyGeneratedTranscript(result); toast.success("Captions generated successfully"); onSaved?.();
    } catch (error: any) { if (mountedRef.current) toast.error(error.message ?? "Failed to generate captions"); }
    finally { if (mountedRef.current) setGeneratingCaptions(false); }
  };

  const persistCaptions = async () => {
    if (!words.length) return revisionRef.current;
    const newSegments = segmentsFromStudioWords(words);
    const revision = revisionRef.current;
    const persistedRevision = Number(originalDocument.current.studioEdit?.revision ?? -1);
    const nextRevision = Math.max(revision, persistedRevision + 1);
    const transcriptJson = makeStudioTranscriptEnvelope(originalDocument.current, words, newSegments,
      { version: 1, sourceMediaItemId: item.id, revision: nextRevision, captionStyle: ccStyle, showCaptions, presetId }, duration);
    const input = { mediaItemId: item.id, orgId, words, segments: newSegments,
      captionsVtt: serializeStudioSubtitles(newSegments, "vtt"),
      language: originalDocument.current.language ?? "en", ...(duration > 0 && Number.isFinite(duration) ? { duration } : {}), transcriptJson,
      expectedRevision: Number(originalDocument.current.studio?.revision ?? 0) };
    const result = await updateCaptionsMutation.mutateAsync(input);
    if (mountedRef.current && revision === revisionRef.current) {
      originalDocument.current = readStudioTranscript((result as any).transcriptJson ?? transcriptJson);
      revisionRef.current = nextRevision; setCaptionsUrl(result.captionsUrl); setSegments(newSegments); setDirty(false);
      return nextRevision;
    }
    // Local changes made during persistence must not be exported as if they were saved.
    return revision;
  };
  const handleSaveCaptions = async () => {
    setSavingCaptions(true);
    try { await persistCaptions(); if (mountedRef.current) { toast.success("Captions saved"); onSaved?.(); } }
    catch (error: any) { toast.error(error.message ?? "Failed to save captions"); }
    finally { if (mountedRef.current) setSavingCaptions(false); }
  };

  // Word-level operations
  const toggleWordDeleted = (wordId: number) => {
    editWords((prev) => prev.map((w) => w.id === wordId ? { ...w, deleted: !w.deleted } : w));
  };
  const deleteWordRange = (startId: number, endId: number) => {
    const startIdx = words.findIndex((w) => w.id === startId);
    const endIdx = words.findIndex((w) => w.id === endId);
    if (startIdx === -1 || endIdx === -1) return;
    const [lo, hi] = startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
    editWords((prev) => prev.map((w, i) => i >= lo && i <= hi ? { ...w, deleted: true } : w));
  };
  const restoreAllDeleted = () => {
    editWords((prev) => prev.map((w) => ({ ...w, deleted: false })));
    toast.success("All deleted words restored");
  };

  // Find & Replace
  const handleFind = () => {
    if (!findText.trim()) { setFindResults([]); return; }
    const results = words
      .filter((w) => !w.deleted && w.word.toLowerCase().includes(findText.toLowerCase()))
      .map((w) => w.id);
    setFindResults(results);
    setFindIndex(0);
    if (results.length === 0) toast.info("No matches found");
  };
  const handleReplaceOne = () => {
    if (findResults.length === 0) return;
    const targetId = findResults[findIndex];
    editWords((prev) => prev.map((w) => w.id === targetId ? { ...w, word: literalReplace(w.word, findText, replaceText, false) } : w));
    // Move to next result
    const newResults = findResults.filter((id) => id !== targetId);
    setFindResults(newResults);
    if (findIndex >= newResults.length) setFindIndex(Math.max(0, newResults.length - 1));
    toast.success("Replaced 1 occurrence");
  };
  const handleReplaceAll = () => {
    if (!findText.trim()) return;
    let count = 0;
    editWords((prev) => prev.map((w) => {
      if (!w.deleted && w.word.toLowerCase().includes(findText.toLowerCase())) {
        count++;
        return { ...w, word: literalReplace(w.word, findText, replaceText, true) };
      }
      return w;
    }));
    setFindResults([]);
    toast.success(`Replaced ${count} occurrence${count !== 1 ? "s" : ""}`);
  };
  const handleDeleteAllOccurrences = () => {
    if (!findText.trim()) return;
    let count = 0;
    editWords((prev) => prev.map((w) => {
      if (!w.deleted && w.word.toLowerCase().includes(findText.toLowerCase())) {
        count++;
        return { ...w, deleted: true };
      }
      return w;
    }));
    setFindResults([]);
    toast.success(`Deleted ${count} occurrence${count !== 1 ? "s" : ""}`);
  };

  const handleRemoveFillers = () => {
    const ids = fillerWordIds(words, FILLER_WORDS);
    editWords(previous => previous.map(word => ids.has(word.id) ? { ...word, deleted: true } : word));
    toast.success(`Removed ${ids.size} filler words`);
  };

  // Clip handlers (preserved from original)
  const handleAutoGenerateClips = async () => {
    setAutoGeneratingClips(true);
    try {
      if (dirtyRef.current) await persistCaptions();
      const result = await generateHighlightsMutation.mutateAsync({ mediaItemId: item.id });
      if (!mountedRef.current) return;
      const generated = result.clips.filter(clip => validStudioClip(clip.startSec, clip.endSec, duration)).map((clip, i) => ({ ...clip, id: `auto-${crypto.randomUUID()}-${i}` }));
      if (!generated.length) throw new Error("No valid highlights returned. Try a recording with more transcript material.");
      setClips(previous => [...previous, ...generated]); toast.success(`Generated ${generated.length} highlight clips`);
      if (generated.length < 10) toast.info("This source returned fewer than ten valid highlights; no empty clips were fabricated.");
    } catch (error: any) { toast.error(error.message ?? "Failed to generate highlights"); }
    finally { if (mountedRef.current) setAutoGeneratingClips(false); }
  };
  const handleAddClip = () => {
    const start = clipStart ?? 0;
    const end = clipEnd ?? duration;
    if (!validStudioClip(start, end, duration)) { toast.error("Clip must be within the source duration, with end after start"); return; }
    setClips((prev) => [...prev, { id: `local-${Date.now()}`, label: clipLabel || "Highlight", startSec: start, endSec: end }]);
    setClipStart(null); setClipEnd(null); setClipLabel("Highlight");
  };
  const handleSaveClip = async (clip: ClipSelection) => {
    if (clip.savedId) { toast.info("Already saved"); return; }
    setSavingClip(true);
    try {
      const saved = await saveClipMutation.mutateAsync({ orgId, mediaItemId: item.id, label: clip.label, startSec: clip.startSec, endSec: clip.endSec });
      setClips((prev) => prev.map((c) => c.id === clip.id ? { ...c, savedId: (saved as any)?.id } : c));
      toast.success("Clip saved"); onSaved?.();
    } catch (err: any) { toast.error(err?.message ?? "Failed to save clip"); }
    finally { setSavingClip(false); }
  };
  const handleDeleteClip = async (clip: ClipSelection) => {
    if (clip.savedId) { try { await deleteClipMutation.mutateAsync({ id: clip.savedId, orgId }); } catch (error: any) { toast.error(error.message ?? "Could not delete clip"); return; } }
    setClips((prev) => prev.filter((c) => c.id !== clip.id));
  };
  const downloadOutput = (result: { url: string; mimeType: string }, filename: string) => {
    if (!result.url || !result.mimeType) throw new Error("Export did not return a rendered media output");
    const extension = result.mimeType.includes("mp4") ? "mp4" : result.mimeType.includes("webm") ? "webm" : "bin";
    const anchor = document.createElement("a"); anchor.href = result.url; anchor.download = `${filename.replace(/\.[^.]+$/, "")}.${extension}`; anchor.target = "_blank"; anchor.rel = "noopener noreferrer"; anchor.click();
  };
  const handleDownloadClip = async (clip: ClipSelection) => {
    if (!validStudioClip(clip.startSec, clip.endSec, duration)) { toast.error("Invalid clip boundaries"); return; }
    setDownloadingClipId(clip.id);
    try {
      const revision = await persistCaptions();
      if (revision !== revisionRef.current) throw new Error("Edits changed while saving. Retry export with the latest edits.");
      const result = await renderEditedVideoMutation.mutateAsync({ mediaItemId: item.id, startSec: clip.startSec, endSec: clip.endSec, burnCaptions: showCaptions });
      if (mountedRef.current && revision === revisionRef.current) { downloadOutput(result, clip.label.replace(/[^a-z0-9]/gi, "-")); toast.success("Clip exported"); }
    } catch (error: any) { toast.error(error.message ?? "Failed to export clip"); }
    finally { if (mountedRef.current) setDownloadingClipId(null); }
  };
  const handleDownloadFull = async () => {
    setDownloadingFull(true);
    try {
      const revision = await persistCaptions();
      if (revision !== revisionRef.current) throw new Error("Edits changed while saving. Retry export with the latest edits.");
      const result = await renderEditedVideoMutation.mutateAsync({ mediaItemId: item.id, burnCaptions: showCaptions });
      if (mountedRef.current && revision === revisionRef.current) { downloadOutput(result, item.filename); toast.success("Edited video exported"); }
    } catch (error: any) { toast.error(error.message ?? "Failed to export edited video"); }
    finally { if (mountedRef.current) setDownloadingFull(false); }
  };
  const handleDownloadOriginal = () => { const anchor = document.createElement("a"); anchor.href = item.url; anchor.download = item.filename; anchor.click(); };
  const handleDownloadCaptions = (format: "srt" | "vtt" = "vtt", editedTimeline = false) => {
    if (!words.length) { if (format === "vtt" && captionsUrl) { const anchor = document.createElement("a"); anchor.href = captionsUrl; anchor.download = item.filename.replace(/\.[^.]+$/, "") + ".vtt"; anchor.click(); } else toast.error("No captions available"); return; }
    downloadStudioBlob(serializeStudioSubtitles(segmentsFromStudioWords(words, editedTimeline), format), `${item.filename.replace(/\.[^.]+$/, "")}${editedTimeline ? "-edited" : ""}.${format}`, format === "srt" ? "application/x-subrip;charset=utf-8" : "text/vtt;charset=utf-8");
  };
  const previewClip = (clip: ClipSelection) => {
    if (!validStudioClip(clip.startSec, clip.endSec, duration)) return;
    seekTo(clip.startSec); previewClipEndRef.current = clip.endSec;
    void videoRef.current?.play().catch(() => toast.error("Could not play clip preview"));
  };
  const setClipStartToCurrent = () => setClipStart(parseFloat(currentTime.toFixed(2)));
  const setClipEndToCurrent = () => setClipEnd(parseFloat(currentTime.toFixed(2)));

  // URL download handler
  const handleDownloadFromUrl = async () => {
    if (!urlInput.trim()) { toast.error("Enter a video URL"); return; }
    setDownloadingUrl(true);
    try {
      await importVideoMutation.mutateAsync({ orgId, url: urlInput.trim() });
      toast.success("Video downloaded and saved to media library");
      setVideoSourceMode("current");
      onSaved?.();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to download video from URL");
    } finally {
      setDownloadingUrl(false);
    }
  };

  // CC overlay style
  const ccOverlayStyle: React.CSSProperties = {
    fontFamily: ccStyle.fontFamily, fontSize: ccStyle.fontSize, fontWeight: ccStyle.bold ? "bold" : "normal", fontStyle: ccStyle.italic ? "italic" : "normal",
    color: ccStyle.textColor, backgroundColor: hexToRgba(ccStyle.bgColor, ccStyle.bgOpacity),
    textShadow: ccStyle.shadow ? "0 1px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.7)" : "none",
    padding: "4px 14px", borderRadius: "6px", maxWidth: "90%", textAlign: "center" as const, lineHeight: 1.3, letterSpacing: "0.01em", transition: "all 0.15s ease",
  };
  const patchCCStyle = (patch: Partial<CCStyle>) => { setDirty(true); revisionRef.current++; setCCStyle((prev) => ({ ...prev, ...patch })); };

  // Deleted word count
  const deletedCount = words.filter((w) => w.deleted).length;
  const totalWords = words.length;

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto">
      {/* Video Source Selector */}
      <div className="flex items-center gap-2 px-1">
        <span className="text-xs font-medium text-muted-foreground">Source:</span>
        <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-0.5">
          <button onClick={() => setVideoSourceMode("current")} className={cn("px-2.5 py-1 rounded-md text-xs font-medium transition-all", videoSourceMode === "current" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
            Current
          </button>
          <button onClick={() => setVideoSourceMode("upload")} className={cn("px-2.5 py-1 rounded-md text-xs font-medium transition-all", videoSourceMode === "upload" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
            <Upload className="h-3 w-3 inline mr-1" />Upload
          </button>
          <button onClick={() => setVideoSourceMode("url")} className={cn("px-2.5 py-1 rounded-md text-xs font-medium transition-all", videoSourceMode === "url" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
            🔗 URL
          </button>
          <button onClick={() => setVideoSourceMode("record")} className={cn("px-2.5 py-1 rounded-md text-xs font-medium transition-all", videoSourceMode === "record" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
            <Circle className="h-3 w-3 inline mr-1 text-red-500" />Record
          </button>
        </div>
      </div>

      {/* URL Input */}
      {videoSourceMode === "url" && (
        <div className="flex items-center gap-2 px-1">
          <Input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="Paste video URL (mp4, webm, etc.)" className="flex-1 h-8 text-xs" />
          <Button size="sm" className="h-8 text-xs" onClick={handleDownloadFromUrl} disabled={downloadingUrl}>
            {downloadingUrl ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Download className="h-3 w-3 mr-1" />}
            Download & Import
          </Button>
        </div>
      )}

      {/* Upload prompt */}
      {videoSourceMode === "upload" && (
        <div className="border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center gap-3 text-center">
          <Upload className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Upload a video file</p>
          <p className="text-xs text-muted-foreground">Use the Upload tab to add a video to your media library, then select it here</p>
          <Button size="sm" variant="outline" onClick={() => setVideoSourceMode("current")}>
            <ArrowLeft className="h-3 w-3 mr-1" /> Back to current video
          </Button>
        </div>
      )}

      {/* Record prompt */}
      {videoSourceMode === "record" && (
        <div className="border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center gap-3 text-center">
          <Video className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Record a new video</p>
          <p className="text-xs text-muted-foreground">Switch to the Record tab to capture a new video, then come back to edit it</p>
          <Button size="sm" variant="outline" onClick={() => setVideoSourceMode("current")}>
            <ArrowLeft className="h-3 w-3 mr-1" /> Back to current video
          </Button>
        </div>
      )}

      {/* Main editor (shown when current video is loaded) */}
      {videoSourceMode === "current" && (
        <>
          {/* Video player */}
          <div className="relative bg-black rounded-xl overflow-hidden aspect-video w-full">
            <video
              ref={videoRef}
              src={item.url}
              className="w-full h-full object-contain"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
            />
            {/* CC overlay */}
            {showCaptions && activeWord && (
              <div className="absolute bottom-12 left-0 right-0 flex justify-center pointer-events-none px-4">
                <span style={ccOverlayStyle}>
                  {ccStyle.emojiEnabled ? applyEmojiMap(getCaptionLine()) : getCaptionLine()}
                </span>
              </div>
            )}
            {/* CC toggle */}
            {words.length > 0 && (
              <button onClick={() => { setDirty(true); revisionRef.current++; setShowCaptions((v) => !v); }} className={cn("absolute bottom-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all", showCaptions ? "bg-primary text-primary-foreground" : "bg-black/60 text-white/70 hover:bg-black/80")}>
                <Subtitles className="h-3 w-3" /> {showCaptions ? "CC On" : "CC Off"}
              </button>
            )}
            {/* CC Style button */}
            {words.length > 0 && (
              <button onClick={() => setShowStylePanel((v) => !v)} className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-black/60 text-white/70 hover:bg-black/80 transition-all">
                <Type className="h-3 w-3" /> CC Style
              </button>
            )}
          </div>

          {/* Playback controls */}
          <div className="flex items-center gap-3 px-1">
            <Button size="icon" variant="outline" className="h-8 w-8" onClick={handlePlayPause}>
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <div className="flex-1 relative h-2 bg-muted rounded-full cursor-pointer group" onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = (e.clientX - rect.left) / rect.width;
              seekTo(pct * duration);
            }}>
              {/* Deleted regions shown as red */}
              {getDeletedRegions().map((r, i) => (
                <div key={i} className="absolute top-0 h-full bg-red-400/40 rounded-full" style={{ left: `${(r.start / duration) * 100}%`, width: `${((r.end - r.start) / duration) * 100}%` }} />
              ))}
              <div className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all" style={{ width: `${(currentTime / Math.max(duration, 1)) * 100}%` }} />
              <div className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 bg-primary rounded-full border-2 border-background shadow-sm transition-all" style={{ left: `${(currentTime / Math.max(duration, 1)) * 100}%`, transform: "translate(-50%, -50%)" }} />
            </div>
            <span className="text-xs font-mono text-muted-foreground shrink-0">{formatTime(currentTime)} / {formatTime(duration)}</span>
          </div>

          {/* CC Style Panel */}
          {showStylePanel && (
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border">
                <div className="flex items-center gap-2">
                  <Type className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">Caption Style</span>
                </div>
                <button onClick={() => setShowStylePanel(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
              </div>
              <div className="p-4 flex flex-col gap-5">
                {/* Presets */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Presets</p>
                  <div className="flex flex-wrap gap-2">
                    {CC_PRESETS.map((preset) => (
                      <button key={preset.id} onClick={() => { setPresetId(preset.id); patchCCStyle({ ...CC_DEFAULT_STYLE, ...preset.style }); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:border-primary hover:bg-primary/5 transition-all" style={{ color: preset.style.textColor, backgroundColor: hexToRgba(preset.style.bgColor ?? "#000000", preset.style.bgOpacity ?? 0.8) }}>
                        <span>{preset.emoji}</span><span>{preset.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div><Label className="text-xs" htmlFor="studio-caption-font">Font Family</Label><Select value={ccStyle.fontFamily} onValueChange={fontFamily => patchCCStyle({ fontFamily })}><SelectTrigger id="studio-caption-font"><SelectValue /></SelectTrigger><SelectContent>{["Arial", "Verdana", "Georgia", "Times New Roman", "Courier New"].map(font => <SelectItem key={font} value={font}>{font}</SelectItem>)}</SelectContent></Select></div>
                {/* Colors */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Text Color</p>
                    <div className="flex flex-wrap gap-1.5">
                      {["#ffffff","#000000","#ffee00","#00ffcc","#ff6b00","#fe2c55","#a78bfa","#34d399"].map((c) => (
                        <button key={c} onClick={() => patchCCStyle({ textColor: c })} className={cn("h-6 w-6 rounded-full border-2 transition-all", ccStyle.textColor === c ? "border-primary scale-110" : "border-transparent hover:scale-105")} style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Background</p>
                    <div className="flex flex-wrap gap-1.5">
                      {["#000000","#1a0050","#1a0000","#0a2540","#ffffff","#6d28d9","#fe2c55","#065f46"].map((c) => (
                        <button key={c} onClick={() => patchCCStyle({ bgColor: c })} className={cn("h-6 w-6 rounded-full border-2 transition-all", ccStyle.bgColor === c ? "border-primary scale-110" : "border-transparent hover:scale-105")} style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                </div>
                {/* Size & opacity */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Font Size: {ccStyle.fontSize}px</p>
                    <Slider value={[ccStyle.fontSize]} onValueChange={([v]) => patchCCStyle({ fontSize: v })} min={14} max={40} step={1} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">BG Opacity: {Math.round(ccStyle.bgOpacity * 100)}%</p>
                    <Slider value={[ccStyle.bgOpacity * 100]} onValueChange={([v]) => patchCCStyle({ bgOpacity: v / 100 })} min={0} max={100} step={5} />
                  </div>
                </div>
                {/* Toggles */}
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => patchCCStyle({ bold: !ccStyle.bold })} className={cn("px-3 py-1.5 rounded-lg border text-xs font-medium transition-all", ccStyle.bold ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50")}>Bold</button>
                  <button onClick={() => patchCCStyle({ italic: !ccStyle.italic })} className={cn("px-3 py-1.5 rounded-lg border text-xs font-medium transition-all", ccStyle.italic ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50")}>Italic</button>
                  <button onClick={() => patchCCStyle({ shadow: !ccStyle.shadow })} className={cn("px-3 py-1.5 rounded-lg border text-xs font-medium transition-all", ccStyle.shadow ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50")}>Shadow</button>
                  <button onClick={() => patchCCStyle({ emojiEnabled: !ccStyle.emojiEnabled })} className={cn("px-3 py-1.5 rounded-lg border text-xs font-medium transition-all", ccStyle.emojiEnabled ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50")}>Auto Emoji</button>
                </div>
              </div>
            </div>
          )}

          {/* Script Panel (Opus Clip style) */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Script Editor</span>
                {words.length > 0 && (
                  <Badge variant="secondary" className="text-xs">{totalWords - deletedCount} / {totalWords} words</Badge>
                )}
                {deletedCount > 0 && (
                  <Badge variant="destructive" className="text-xs">{deletedCount} cut</Badge>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={undoWords} disabled={!history.length}>Undo</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={redoWords} disabled={!redoHistory.length}>Redo</Button>
                {fillerCount > 0 && (
                  <Button size="sm" variant="outline" className="h-7 text-xs text-orange-600 border-orange-300" onClick={handleRemoveFillers} title="Remove filler words (uh, um, like, you know...)">
                    <Sparkles className="h-3 w-3 mr-1" /> Clean Fillers ({fillerCount})
                  </Button>
                )}
                {deletedCount > 0 && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={restoreAllDeleted} title="Restore all deleted words">
                    Restore All
                  </Button>
                )}
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowFindReplace((v) => !v)} title="Find & Replace">
                  <Edit2 className="h-3 w-3 mr-1" /> Find
                </Button>
                {words.length > 0 && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleSaveCaptions} disabled={savingCaptions}>
                    {savingCaptions ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />} Save
                  </Button>
                )}
                {captionsUrl && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleDownloadCaptions()}>
                    <Download className="h-3 w-3 mr-1" /> VTT
                  </Button>
                )}
                <Button size="sm" className="h-7 text-xs" onClick={handleGenerateCaptions} disabled={generatingCaptions}>
                  {generatingCaptions ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Generating...</> : <><Wand2 className="h-3 w-3 mr-1" /> {words.length > 0 ? "Regenerate" : "Generate Script"}</>}
                </Button>
              </div>
            </div>

            {/* Find & Replace bar */}
            {showFindReplace && (
              <div className="px-4 py-2.5 bg-muted/20 border-b border-border flex flex-wrap items-center gap-2">
                <Input value={findText} onChange={(e) => setFindText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleFind()} placeholder="Find word..." className="h-7 text-xs w-32" />
                <Input value={replaceText} onChange={(e) => setReplaceText(e.target.value)} placeholder="Replace with..." className="h-7 text-xs w-32" />
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleFind}>Find</Button>
                {findResults.length > 0 && (
                  <>
                    <span className="text-xs text-muted-foreground">{findIndex + 1}/{findResults.length}</span>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleReplaceOne}>Replace</Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleReplaceAll}>Replace All</Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs text-destructive border-destructive/30" onClick={handleDeleteAllOccurrences}>Delete All</Button>
                  </>
                )}
                <button className="ml-auto text-muted-foreground hover:text-foreground" onClick={() => { setShowFindReplace(false); setFindResults([]); }}>
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* Word-level transcript (Opus Clip style) */}
            <div ref={transcriptPanelRef} className="max-h-80 overflow-y-auto p-4">
              {words.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3 text-muted-foreground">
                  <Subtitles className="h-8 w-8 opacity-30" />
                  <p className="text-sm">No script yet</p>
                  <p className="text-xs text-center max-w-48">Click "Generate Script" to auto-transcribe this video using AI</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-x-1 gap-y-1.5 leading-relaxed">
                  {words.map((w) => {
                    const isActive = !w.deleted && currentTime >= w.start && currentTime <= w.end;
                    const isFiller = fillerIds.has(w.id);
                    const isFound = findResults.includes(w.id);
                    const isCurrentFind = findResults[findIndex] === w.id;
                    return (
                      <button
                        key={w.id}
                        onClick={() => {
                          if (w.deleted) { toggleWordDeleted(w.id); }
                          else { seekTo(w.start); if (videoRef.current?.paused) { videoRef.current.play(); setIsPlaying(true); } }
                        }}
                        onContextMenu={(e) => { e.preventDefault(); toggleWordDeleted(w.id); }}
                        className={cn(
                          "px-1 py-0.5 rounded text-sm transition-all cursor-pointer select-none",
                          w.deleted
                            ? "line-through text-muted-foreground/40 bg-red-100/50 dark:bg-red-900/20 hover:bg-red-200/60"
                            : isActive
                              ? "bg-primary/20 text-primary font-semibold ring-1 ring-primary/40"
                              : isCurrentFind
                                ? "bg-yellow-300/80 text-yellow-900 font-medium"
                                : isFound
                                  ? "bg-yellow-200/50 text-yellow-800"
                                  : isFiller
                                    ? "text-orange-500/80 hover:bg-orange-100/50 dark:hover:bg-orange-900/20"
                                    : "hover:bg-muted/60 text-foreground"
                        )}
                        title={w.deleted ? "Click to restore" : `${formatTime(w.start)} — Right-click to cut`}
                      >
                        {w.word}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {words.length > 0 && (
              <div className="px-4 py-2 border-t border-border bg-muted/10 flex items-center gap-3">
                <p className="text-xs text-muted-foreground">Click word to seek · Right-click to cut · Cut words are skipped during playback</p>
                {fillerCount > 0 && <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">{fillerCount} fillers detected</Badge>}
              </div>
            )}
          </div>

          {/* Clips panel */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border">
              <div className="flex items-center gap-2">
                <Scissors className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Highlight Clips</span>
                {clips.length > 0 && <Badge variant="secondary" className="text-xs">{clips.length} clips</Badge>}
              </div>
              {words.length >= 20 && (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleAutoGenerateClips} disabled={autoGeneratingClips}>
                  {autoGeneratingClips ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Generating...</> : <><Zap className="h-3 w-3 mr-1" /> Auto-generate 10</>}
                </Button>
              )}
            </div>
            {/* Clip creator */}
            <div className="p-4 border-b border-border bg-muted/10">
              <p className="text-xs text-muted-foreground mb-3">Mark start/end at current playhead, then add a clip</p>
              <div className="flex items-center gap-2 mb-2">
                <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={setClipStartToCurrent}>
                  Start: {clipStart !== null ? formatTime(clipStart) : "—"} <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={setClipEndToCurrent}>
                  End: {clipEnd !== null ? formatTime(clipEnd) : "—"} <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Input value={clipLabel} onChange={(e) => setClipLabel(e.target.value)} placeholder="Clip label" className="h-7 text-xs flex-1" />
                <Button size="sm" className="h-7 text-xs shrink-0" onClick={handleAddClip} disabled={clipStart === null && clipEnd === null}>
                  <Plus className="h-3 w-3 mr-1" /> Add Clip
                </Button>
              </div>
            </div>
            {/* Clips list */}
            <div className="max-h-52 overflow-y-auto">
              {clips.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
                  <Film className="h-7 w-7 opacity-30" />
                  <p className="text-sm">No clips yet</p>
                  <p className="text-xs text-center max-w-44">Use the controls above to mark highlights</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {clips.map((clip) => (
                    <div key={clip.id} className="flex items-center gap-2 px-4 py-2.5 group hover:bg-muted/30 transition-colors">
                      <button className="flex-1 text-left" onClick={() => previewClip(clip)}>
                        <p className="text-xs font-medium truncate max-w-[140px]">{clip.label}</p>
                        <p className="text-xs text-muted-foreground font-mono">{formatTime(clip.startSec)} → {formatTime(clip.endSec)} <span className="ml-1.5 text-muted-foreground/60">({formatTime(clip.endSec - clip.startSec)})</span></p>
                      </button>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleDownloadClip(clip)} disabled={downloadingClipId === clip.id} title="Download clip">
                          {downloadingClipId === clip.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                        </Button>
                        {!clip.savedId && (
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-primary" onClick={() => handleSaveClip(clip)} disabled={savingClip} title="Save to Library">
                            {savingClip ? <Loader2 className="h-3 w-3 animate-spin" /> : <Library className="h-3 w-3" />}
                          </Button>
                        )}
                        {clip.savedId && <CheckCircle className="h-4 w-4 text-teal-500" />}
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => handleDeleteClip(clip)} title="Delete clip">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Download actions */}
          <div className="flex items-center gap-3 pt-2 border-t border-border">
            <Button variant="outline" onClick={handleDownloadFull} disabled={downloadingFull} className="flex items-center gap-2">
              <Download className="h-4 w-4" /> Download Full Video
            </Button>
            {captionsUrl && (
              <Button variant="outline" onClick={() => handleDownloadCaptions()} className="flex items-center gap-2">
                <Subtitles className="h-4 w-4" /> Download Captions (.vtt)
              </Button>
            )}
            <Button variant="outline" onClick={handleDownloadOriginal}>Download Original</Button>
            {words.length > 0 && <><Button variant="outline" onClick={() => handleDownloadCaptions("srt")}>SRT (source timing)</Button><Button variant="outline" onClick={() => handleDownloadCaptions("srt", true)}>SRT (edited timing)</Button></>}
            <span className="text-xs text-muted-foreground ml-auto">{formatFileSize(item.fileSize)} · {item.mimeType}</span>
          </div>
        </>
      )}
    </div>
  );
}


// ─── RecordTab Sub-component ─────────────────────────────────────────────────

function RecordTab({ orgId, onSaved }: { orgId: number; onSaved: (item: MediaItem) => void }) {
  const [mode, setMode] = useState<RecordMode>("screen+camera");
  const [recordState, setRecordState] = useState<RecordState>("idle");
  const [countdown, setCountdown] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [recordings, setRecordings] = useState<StudioLocalRecording[]>([]);
  const [cameraPos, setCameraPos] = useState({ x: 20, y: 20 });
  const [isDraggingCamera, setIsDraggingCamera] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [cameraSize, setCameraSize] = useState(160);
  const [showSettings, setShowSettings] = useState(false);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState("");
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState("");
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedOutput, setSelectedOutput] = useState("");
  const [videoQuality, setVideoQuality] = useState<"720p" | "1080p" | "4k">("1080p");
  const [frameRate, setFrameRate] = useState<"24" | "30" | "60">("30");
  const [captureDetails, setCaptureDetails] = useState("");
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<StudioCaptureSession | null>(null);
  const liveRef = useRef(true);
  const recordStateRef = useRef(recordState); recordStateRef.current = recordState;
  const pipRef = useRef({ cameraPos, cameraSize }); pipRef.current = { cameraPos, cameraSize };
  const urlsRef = useRef(new Set<string>());
  const saveMediaItem = trpc.lms.media.saveMediaItem.useMutation();
  const library = useStudioRecordingLibrary(orgId, input => saveMediaItem.mutateAsync(input), onSaved);
  const libraryRef = useRef(library); libraryRef.current = library;
  const savedItems = library.savedItems;
  const autoSaving = library.hasPending;
  const isRecording = recordState === "recording" || recordState === "paused";
  const busy = isRecording || recordState === "countdown";
  const qualityDimensions = { "720p": { w: 1280, h: 720 }, "1080p": { w: 1920, h: 1080 }, "4k": { w: 3840, h: 2160 } };

  useEffect(() => {
    const devices = navigator.mediaDevices;
    if (!devices?.enumerateDevices) return;
    const refresh = () => devices.enumerateDevices().then(all => {
      setAudioDevices(all.filter(d => d.kind === "audioinput" && d.deviceId));
      setVideoDevices(all.filter(d => d.kind === "videoinput" && d.deviceId));
      setOutputDevices(all.filter(d => d.kind === "audiooutput" && d.deviceId));
    }).catch(() => {});
    refresh(); devices.addEventListener("devicechange", refresh);
    return () => devices.removeEventListener("devicechange", refresh);
  }, []);
  useEffect(() => {
    const el = previewRef.current as any;
    if (el?.setSinkId) el.setSinkId(selectedOutput || "").catch(() => {});
  }, [selectedOutput, recordings]);
  useEffect(() => {
    let cancelled = false; let acquired: MediaStream | null = null;
    if (mode !== "screen" && cameraEnabled && navigator.mediaDevices?.getUserMedia) {
      const { w, h } = qualityDimensions[videoQuality];
      navigator.mediaDevices.getUserMedia({ video: { width: { ideal: w }, height: { ideal: h }, frameRate: { ideal: Number(frameRate) }, ...(selectedCamera ? { deviceId: { exact: selectedCamera } } : {}) }, audio: false })
        .then(stream => {
          if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
          acquired = stream; cameraStreamRef.current = stream;
          if (cameraVideoRef.current) cameraVideoRef.current.srcObject = stream;
        }).catch(() => { if (!cancelled) { toast.error("Could not access camera"); setCameraEnabled(false); } });
    }
    return () => { cancelled = true; acquired?.getTracks().forEach(t => t.stop()); if (cameraStreamRef.current === acquired) cameraStreamRef.current = null; };
  }, [mode, cameraEnabled, selectedCamera, videoQuality, frameRate]);
  useEffect(() => { if (cameraVideoRef.current) cameraVideoRef.current.srcObject = cameraStreamRef.current; }, [mode, recordState]);
  useEffect(() => { sessionRef.current?.setMicEnabled(micEnabled); }, [micEnabled]);
  useEffect(() => {
    liveRef.current = true;
    return () => { liveRef.current = false; sessionRef.current?.dispose(); urlsRef.current.forEach(url => URL.revokeObjectURL(url)); };
  }, [orgId]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (["countdown", "recording", "paused"].includes(recordStateRef.current) || libraryRef.current.hasPending) { event.preventDefault(); event.returnValue = "Recording or saving is still active."; }
    };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, []);
  const startCountdown = async () => {
    if (busy || orgId <= 0) { if (orgId <= 0) toast.error("Select an active school before recording"); return; }
    if (mode === "camera" && !cameraEnabled) { toast.error("Enable the camera before camera-only recording"); return; }
    sessionRef.current?.dispose();
    const { w, h } = qualityDimensions[videoQuality];
    setRecordState("countdown"); setCountdown(3);
    const session = new StudioCaptureSession({ mode: mode === "screen+camera" && !cameraEnabled ? "screen" : mode,
      width: w, height: h, frameRate: Number(frameRate), cameraStream: cameraStreamRef.current,
      cameraDeviceId: selectedCamera, micDeviceId: selectedMic, micEnabled,
      pip: () => { const rect = containerRef.current?.getBoundingClientRect(); const p = pipRef.current;
        return { x: p.cameraPos.x, y: p.cameraPos.y, size: p.cameraSize, width: rect?.width || 960, height: rect?.height || 540 }; },
      onScreen: stream => { if (screenVideoRef.current) screenVideoRef.current.srcObject = stream; },
      onState: state => { if (liveRef.current) setRecordState(state); },
      onCountdown: value => { if (liveRef.current) setCountdown(value); },
      onElapsed: seconds => { if (liveRef.current) setElapsed(seconds); },
      onWarning: message => toast.warning(message), onError: error => toast.error(error.message),
      onResult: result => {
        const rec = studioLocalRecording(result);
        if (liveRef.current) {
          urlsRef.current.add(rec.url); setRecordings(previous => [rec, ...previous]);
          setCaptureDetails(`${result.width}×${result.height} · ${result.frameRate} fps · ${result.mimeType}`);
        } else URL.revokeObjectURL(rec.url);
        libraryRef.current.save(rec);
      },
    });
    sessionRef.current = session; await session.start();
  };
  const pauseRecording = () => sessionRef.current?.pause();
  const resumeRecording = () => sessionRef.current?.resume();
  const stopRecording = () => sessionRef.current?.stop();
  const cancelCountdown = () => sessionRef.current?.cancel();
  const handleSaveToLibrary = (rec: StudioLocalRecording) => library.save(rec);

  const handleCameraMouseDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDraggingCamera(true);
    setDragOffset({ x: e.clientX - cameraPos.x, y: e.clientY - cameraPos.y });
  };
  useEffect(() => {
    if (!isDraggingCamera) return;
    const PADDING = 12;
    const onMove = (e: PointerEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      setCameraPos({
        x: Math.max(0, Math.min(rect.width - cameraSize, e.clientX - dragOffset.x)),
        y: Math.max(0, Math.min(rect.height - cameraSize, e.clientY - dragOffset.y)),
      });
    };
    const onUp = () => {
      setIsDraggingCamera(false);
      // Snap to nearest corner
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const cx = cameraPos.x + cameraSize / 2;
      const cy = cameraPos.y + cameraSize / 2;
      const snapX = cx < rect.width / 2 ? Math.min(PADDING, Math.max(0, rect.width - cameraSize)) : Math.max(0, rect.width - cameraSize - PADDING);
      const snapY = cy < rect.height / 2 ? Math.min(PADDING, Math.max(0, rect.height - cameraSize)) : Math.max(0, rect.height - cameraSize - PADDING);
      setCameraPos({ x: snapX, y: snapY });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, [isDraggingCamera, dragOffset, cameraSize, cameraPos]);

  // Switching to the captured browser tab/window must not stop capture.
  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Main recording area */}
      <div className="flex-1 flex flex-col gap-4 p-6 overflow-y-auto">
        {/* Mode selector */}
        {!isRecording && recordState !== "countdown" && (
          <div className="flex items-center gap-3 flex-wrap">
            {(["screen+camera", "screen", "camera"] as RecordMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all",
                  mode === m ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50 text-muted-foreground"
                )}
              >
                {m === "screen+camera" && <><Monitor className="h-4 w-4" /><Camera className="h-4 w-4" /> Screen + Camera</>}
                {m === "screen" && <><Monitor className="h-4 w-4" /> Screen Only</>}
                {m === "camera" && <><Camera className="h-4 w-4" /> Camera Only</>}
              </button>
            ))}
          </div>
        )}

        {/* Preview area */}
        <div ref={containerRef} className="relative bg-black rounded-2xl overflow-hidden aspect-video w-full max-w-4xl mx-auto">
          {/* Screen feed — only shown when actually recording/sharing screen */}
          {(mode === "screen" || mode === "screen+camera") && (
            <video ref={screenVideoRef} autoPlay muted playsInline className="w-full h-full object-contain" />
          )}
          {/* Camera-only mode: always full-size — use objectFit:fill to eliminate black bars from any aspect ratio */}
          {mode === "camera" && (
            <video ref={cameraVideoRef} autoPlay muted playsInline
              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
                objectFit: "fill", display: "block", transform: "scaleX(-1)" }} />
          )}
          {/* Screen+Camera: show camera full-size in idle/stopped (no screen yet), bubble when recording */}
          {mode === "screen+camera" && cameraEnabled && !isRecording && recordState !== "countdown" && (
            <video ref={cameraVideoRef} autoPlay muted playsInline
              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
                objectFit: "fill", display: "block", transform: "scaleX(-1)" }} />
          )}
          {mode === "screen+camera" && cameraEnabled && (isRecording || recordState === "countdown") && (
            <div
              className="absolute rounded-full overflow-hidden border-2 border-white shadow-lg cursor-move select-none"
              style={{ left: cameraPos.x, top: cameraPos.y, width: cameraSize, height: cameraSize, touchAction: "none" }}
              onPointerDown={handleCameraMouseDown}
              role="button" tabIndex={0} aria-label="Camera picture-in-picture position"
              onKeyDown={event => { const delta = event.shiftKey ? 20 : 5; const directions: Record<string, { x: number; y: number }> = { ArrowLeft: { x: -delta, y: 0 }, ArrowRight: { x: delta, y: 0 }, ArrowUp: { x: 0, y: -delta }, ArrowDown: { x: 0, y: delta } }; const direction = directions[event.key]; if (direction) { event.preventDefault(); const rect = containerRef.current?.getBoundingClientRect(); setCameraPos(p => ({ x: Math.max(0, Math.min((rect?.width || 960) - cameraSize, p.x + direction.x)), y: Math.max(0, Math.min((rect?.height || 540) - cameraSize, p.y + direction.y)) })); } }}
            >
              <video ref={cameraVideoRef} autoPlay muted playsInline
                style={{ transform: "scaleX(-1)", width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </div>
          )}
          {/* Subtle ready badge when camera is live but not yet recording */}
          {recordState === "idle" && mode !== "screen" && cameraEnabled && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-sm">
              <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-white/80 text-xs font-medium">Camera ready — click Start Recording</span>
            </div>
          )}
          {/* Show idle placeholder only when no live camera feed is visible */}
          {recordState === "idle" && (mode === "screen" || !cameraEnabled) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60">
              <div className="h-16 w-16 rounded-full bg-white/10 flex items-center justify-center">
                {mode === "screen" ? <Monitor className="h-8 w-8 text-white/60" /> : <Video className="h-8 w-8 text-white/60" />}
              </div>
              <p className="text-white/60 text-sm">Click Start Recording to begin</p>
            </div>
          )}
          {recordState === "countdown" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70">
              <div className="text-8xl font-bold text-white animate-pulse">{countdown}</div>
            </div>
          )}
          {isRecording && (
            <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 rounded-full px-3 py-1.5">
              <div className={cn("h-2.5 w-2.5 rounded-full bg-red-500", recordState === "recording" && "animate-pulse")} />
              <span className="text-white text-sm font-mono">{formatTime(elapsed)}</span>
              {recordState === "paused" && <Badge variant="outline" className="text-yellow-400 border-yellow-400 text-[10px]">PAUSED</Badge>}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Button variant="outline" size="icon" className={cn("h-11 w-11 rounded-full", !micEnabled && "border-destructive text-destructive")}
            onClick={() => setMicEnabled((v) => !v)} title={micEnabled ? "Mute microphone" : "Unmute microphone"}>
            {micEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </Button>
          {mode !== "screen" && (
            <Button variant="outline" size="icon" className={cn("h-11 w-11 rounded-full", !cameraEnabled && "border-destructive text-destructive")}
              onClick={() => setCameraEnabled((v) => !v)} disabled={busy}>
              {cameraEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </Button>
          )}
          {recordState === "idle" && (
            <Button size="lg" className="h-14 w-14 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30" onClick={startCountdown}>
              <Circle className="h-6 w-6 fill-current" />
            </Button>
          )}
          {recordState === "countdown" && (
            <Button size="lg" variant="outline" className="h-14 w-14 rounded-full" onClick={cancelCountdown}>
              <Square className="h-5 w-5" />
            </Button>
          )}
          {recordState === "recording" && (
            <>
              <Button size="lg" variant="outline" className="h-14 w-14 rounded-full" onClick={pauseRecording}>
                <Pause className="h-5 w-5" />
              </Button>
              <Button size="lg" className="h-14 w-14 rounded-full bg-red-500 hover:bg-red-600 text-white" onClick={stopRecording}>
                <Square className="h-5 w-5 fill-current" />
              </Button>
            </>
          )}
          {recordState === "paused" && (
            <>
              <Button size="lg" className="h-14 w-14 rounded-full bg-green-500 hover:bg-green-600 text-white" onClick={resumeRecording}>
                <Play className="h-5 w-5 fill-current" />
              </Button>
              <Button size="lg" className="h-14 w-14 rounded-full bg-red-500 hover:bg-red-600 text-white" onClick={stopRecording}>
                <Square className="h-5 w-5 fill-current" />
              </Button>
            </>
          )}
          {recordState === "stopped" && (
            <div className="flex flex-col items-center gap-2">
              {autoSaving && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Auto-saving to Media Library...
                </div>
              )}
              <Button size="lg" className="h-14 px-6 rounded-full bg-primary text-primary-foreground"
                onClick={() => { setRecordState("idle"); setElapsed(0); if (screenVideoRef.current) screenVideoRef.current.srcObject = null; }}>
                <Circle className="h-5 w-5 fill-current mr-2" /> Record Again
              </Button>
            </div>
          )}
        </div>

        {mode === "screen+camera" && !isRecording && (
          <div className="flex items-center gap-3 max-w-xs mx-auto w-full">
            <Camera className="h-4 w-4 text-muted-foreground shrink-0" />
            <Slider value={[cameraSize]} onValueChange={([v]) => setCameraSize(v)} min={80} max={280} step={20} className="flex-1" />
            <span className="text-xs text-muted-foreground w-12 text-right">{cameraSize}px</span>
          </div>
        )}
      </div>

      {/* Right panel */}
      <div className="w-80 border-l border-border flex flex-col overflow-hidden">
        {showSettings && (
          <div className="p-4 border-b border-border flex flex-col gap-3 overflow-y-auto max-h-[60vh]">
            <h3 className="font-semibold text-sm flex items-center gap-1.5"><Settings className="h-3.5 w-3.5" /> Recording Settings</h3>

            {/* Camera */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Camera className="h-3 w-3" /> Camera</label>
              <Select disabled={busy} value={selectedCamera || "__default__"} onValueChange={(v) => setSelectedCamera(v === "__default__" ? "" : v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Default camera" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default__">Default camera</SelectItem>
                  {videoDevices.map((d) => <SelectItem key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(0, 8)}`}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Video Quality */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Monitor className="h-3 w-3" /> Video Quality</label>
              <Select disabled={busy} value={videoQuality} onValueChange={(v) => setVideoQuality(v as "720p" | "1080p" | "4k")}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="720p">720p HD</SelectItem>
                  <SelectItem value="1080p">1080p Full HD</SelectItem>
                  <SelectItem value="4k">4K Ultra HD</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Frame Rate */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Film className="h-3 w-3" /> Frame Rate</label>
              <Select disabled={busy} value={frameRate} onValueChange={(v) => setFrameRate(v as "24" | "30" | "60")}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="24">24 fps — Cinematic</SelectItem>
                  <SelectItem value="30">30 fps — Standard</SelectItem>
                  <SelectItem value="60">60 fps — Smooth</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Microphone */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Mic className="h-3 w-3" /> Microphone</label>
              <Select disabled={busy} value={selectedMic || "__default__"} onValueChange={(v) => setSelectedMic(v === "__default__" ? "" : v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Default microphone" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default__">Default microphone</SelectItem>
                  {audioDevices.map((d) => <SelectItem key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0, 8)}`}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Speaker / Output */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Volume2 className="h-3 w-3" /> Speaker / Output</label>
              {outputDevices.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Output device selection not supported in this browser</p>
              ) : (
                <Select value={selectedOutput || "__default__"} onValueChange={(v) => setSelectedOutput(v === "__default__" ? "" : v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Default speaker" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__default__">Default speaker</SelectItem>
                    {outputDevices.map((d) => <SelectItem key={d.deviceId} value={d.deviceId}>{d.label || `Speaker ${d.deviceId.slice(0, 8)}`}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Current settings summary */}
            <div className="rounded-lg bg-muted/40 px-3 py-2 flex flex-col gap-1">
              <p className="text-xs font-medium text-muted-foreground">Active settings</p>
              <p className="text-xs text-foreground">{videoQuality.toUpperCase()} · {frameRate} fps (requested)</p>
              {captureDetails && <p className="text-xs text-foreground">Captured: {captureDetails}</p>}
              {busy && <p className="text-xs text-muted-foreground">Device and quality changes apply to the next recording.</p>}
            </div>
          </div>
        )}

        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-sm">Recordings ({recordings.length})</h3>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowSettings((s) => !s)}>
            <Settings className="h-3.5 w-3.5 mr-1" /> Settings
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {recordings.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm gap-2">
              <Video className="h-8 w-8 opacity-30" />
              <p>No recordings yet</p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {recordings.map((rec, idx) => (
                <div key={rec.id} className="p-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{rec.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {formatTime(rec.duration)}
                        </span>
                        <span className="text-xs text-muted-foreground">{formatFileSize(rec.size)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { const a = document.createElement("a"); a.href = rec.url; a.download = rec.name; a.click(); }} title="Download">
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className={cn("h-7 w-7", savedItems[rec.id] ? "text-teal-500" : "")}
                        onClick={() => handleSaveToLibrary(rec)}
                        disabled={library.status(rec.id)?.status === "uploading" || library.status(rec.id)?.status === "saving" || library.status(rec.id)?.status === "queued" || !!savedItems[rec.id]}
                        title={savedItems[rec.id] ? "Saved to Library" : "Save to Media Library"}
                      >
                        {library.status(rec.id)?.status === "uploading" || library.status(rec.id)?.status === "saving" || library.status(rec.id)?.status === "queued" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Library className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                  {idx === 0 && recordState === "stopped" && (
                    <video ref={previewRef} src={rec.url} controls className="mt-2 w-full rounded-lg aspect-video bg-black" />
                  )}
                  {library.status(rec.id)?.status === "error" && <Button variant="outline" size="sm" className="mt-2 text-xs" onClick={() => library.save(rec)}>Retry save: {library.status(rec.id)?.errorMessage}</Button>}
                  {savedItems[rec.id] && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-teal-600">
                      <CheckCircle className="h-3 w-3" />
                      Saved — click Edit tab to add captions &amp; clips
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── UploadTab Sub-component ─────────────────────────────────────────────────
function UploadTab({ orgId, onSaved }: { orgId: number; onSaved: (item: MediaItem) => void }) {
  const [dragOver, setDragOver] = useState(false);
  const [uploadedItems, setUploadedItems] = useState<MediaItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveMediaItem = trpc.lms.media.saveMediaItem.useMutation();
  const { enqueue } = useUploadQueue();
  const [importUrl, setImportUrl] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const importFromUrl = trpc.lms.media.importFromUrl.useMutation();

  const handleImportFromUrl = async () => {
    const url = importUrl.trim();
    if (!url) return;
    setImportLoading(true);
    try {
      const saved = await importFromUrl.mutateAsync({ orgId, url });
      if (saved) {
        const item: MediaItem = {
          id: (saved as any).id,
          url: (saved as any).url,
          filename: (saved as any).filename ?? "Imported video",
          mimeType: (saved as any).mimeType ?? "video/mp4",
          fileSize: (saved as any).fileSize ?? 0,
          durationSeconds: (saved as any).durationSeconds,
        };
        setUploadedItems((prev) => [item, ...prev]);
        toast.success(`Video imported from URL`);
        onSaved(item);
        setImportUrl("");
      }
    } catch (err: any) {
      const message = err?.message || "Failed to import video";
      toast.error(message);
    } finally {
      setImportLoading(false);
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const maxSize = 3 * 1024 * 1024 * 1024; // 3 GB
    let queued = 0;
    Array.from(files).forEach((file) => {
      if (file.size > maxSize) {
        toast.error(`"${file.name}" is too large — maximum 3 GB`);
        return;
      }
      enqueue({
        file,
        orgId,
        folder: "lms-media",
        onComplete: async (result) => {
          if (!result) return;
          try {
            const saved = await saveMediaItem.mutateAsync({
              orgId,
              fileName: result.fileName,
              mimeType: result.fileType || file.type || "video/mp4",
              fileSize: result.fileSize,
              fileKey: result.key,
              url: result.url,
              source: "direct",
              tags: ["upload"],
            });
            const item: MediaItem = {
              id: (saved as any).id,
              url: result.url,
              filename: result.fileName,
              mimeType: result.fileType || file.type || "video/mp4",
              fileSize: result.fileSize,
            };
            setUploadedItems((prev) => [item, ...prev]);
            toast.success(`"${result.fileName}" uploaded to Media Library`);
            onSaved(item);
          } catch (err: any) {
            toast.error(`Failed to save "${result.fileName}": ${err?.message ?? "Unknown error"}`);
            throw err;
          }
        },
        onError: (message) => {
          toast.error(`Upload failed: ${message}`);
        },
      });
      queued++;
    });
    if (queued > 0) {
      toast.info(
        queued === 1
          ? `"${Array.from(files).find(f => f.size <= 3 * 1024 * 1024 * 1024)?.name}" added to upload queue`
          : `${queued} files added to upload queue`
      );
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl mx-auto w-full">
      <div>
        <h2 className="text-lg font-semibold">Upload Video</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Upload one or more videos — they will be processed in the background so you can keep working
        </p>
      </div>
      {/* Drop zone */}
      <div
        className={cn(
          "border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center gap-4 transition-all cursor-pointer",
          dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
        )}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,audio/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
          <Upload className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">Drop videos here or click to browse</p>
          <p className="text-xs text-muted-foreground mt-1">
            MP4, MOV, WebM, AVI, MKV, MP3, WAV · Max 3 GB · Multiple files supported
          </p>
        </div>
      </div>
      {/* ── Import from URL ───────────────────────────────────────────── */}
      <div className="border border-border rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Globe className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Import from URL</h3>
            <p className="text-xs text-muted-foreground">
              Paste a link from Facebook, LinkedIn, YouTube, or any webpage with video
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="https://www.facebook.com/video/..."
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && importUrl.trim() && !importLoading) {
                  handleImportFromUrl();
                }
              }}
              className="pl-9"
              disabled={importLoading}
            />
          </div>
          <Button
            onClick={handleImportFromUrl}
            disabled={!importUrl.trim() || importLoading}
            className="shrink-0 gap-2"
          >
            {importLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Importing\u2026
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Import
              </>
            )}
          </Button>
        </div>
        {importLoading && (
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            Extracting and downloading video — this may take a minute for large files…
          </p>
        )}
      </div>
      {/* Completed items this session */}
      {uploadedItems.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Uploaded this session</h3>
          {uploadedItems.map((item) => (
            <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/20">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Film className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.filename}</p>
                <p className="text-xs text-muted-foreground">{item.mimeType}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <CheckCircle className="h-4 w-4 text-teal-500" />
                <span className="text-xs text-teal-600">Saved</span>
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Switch to the <strong>Edit</strong> tab to add captions and create highlight clips
          </p>
        </div>
      )}
    </div>
  );
}

// ─── EditTab Sub-component ───────────────────────────────────────────────────

function EditTab({ orgId, initialItem }: { orgId: number; initialItem?: MediaItem }) {
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(initialItem ?? null);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const dirtyEditorRef = useRef(false);
  const initialItemIdRef = useRef(initialItem?.id);

  const listMediaQuery = trpc.forms.media.list.useQuery(
    { orgId, pageSize: 200 },
    { enabled: !!orgId }
  );

  useEffect(() => {
    if (listMediaQuery.data) {
      const allItems = listMediaQuery.data.items ?? [];
      const videoItems = allItems.filter(
        (item) => item.mimeType?.startsWith("video/") || item.mimeType?.startsWith("audio/")
      ) as MediaItem[];
      setMediaItems(videoItems);
      // Keep selectedItem in sync with latest data (e.g. after transcription completes)
      setSelectedItem(prev => {
        if (!prev) return prev;
        const updated = videoItems.find(i => i.id === prev.id);
        return updated ?? prev;
      });
    }
  }, [listMediaQuery.data]);
  useEffect(() => {
    if (initialItem && initialItem.id !== initialItemIdRef.current) {
      initialItemIdRef.current = initialItem.id;
      if (!dirtyEditorRef.current || window.confirm("Switch to the new recording? Unsaved caption edits will be discarded.")) { dirtyEditorRef.current = false; setSelectedItem(initialItem); }
    }
  }, [initialItem]);

  if (selectedItem) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-3 border-b border-border shrink-0">
          <Button variant="ghost" size="sm" className="h-7 gap-1.5" onClick={() => { if (!dirtyEditorRef.current || window.confirm("Leave the editor? Unsaved caption edits will be discarded.")) { dirtyEditorRef.current = false; setSelectedItem(null); } }}>
            <ArrowLeft className="h-3.5 w-3.5" /> Back to library
          </Button>
          <div className="h-4 w-px bg-border" />
          <p className="text-sm font-medium truncate">{selectedItem.filename}</p>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <VideoEditor key={`${orgId}-${selectedItem.id}`} item={selectedItem} orgId={orgId} onDirtyChange={dirty => { dirtyEditorRef.current = dirty; }} onSaved={() => listMediaQuery.refetch()} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h2 className="text-lg font-semibold">Edit Video</h2>
        <p className="text-sm text-muted-foreground mt-1">Select a video from your Media Library to add captions, edit the transcript, and create highlight clips</p>
      </div>

      {listMediaQuery.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : mediaItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <Film className="h-12 w-12 opacity-20" />
          <p className="text-sm font-medium">No videos in your Media Library</p>
          <p className="text-xs text-center max-w-64">Record a new video or upload one using the Record or Upload tabs, then come back here to edit it</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {mediaItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedItem(item)}
              className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/50 hover:bg-muted/30 transition-all text-left group"
            >
              <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center shrink-0 relative overflow-hidden">
                {item.mimeType?.startsWith("video/") ? (
                  <video src={item.url} className="w-full h-full object-cover" muted />
                ) : (
                  <Mic className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{item.filename}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground">{formatFileSize(item.fileSize)}</span>
                  {(item as any).captionsUrl && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">CC</Badge>
                  )}
                  {(item as any).transcriptJson && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Transcript</Badge>
                  )}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── AudioTab Sub-component ─────────────────────────────────────────────────

type AudioSubTab = "record" | "upload";

function AudioTab({ orgId, onSaved }: { orgId: number; onSaved?: (item: MediaItem) => void }) {
  const [subTab, setSubTab] = useState<AudioSubTab>("record");

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tab bar */}
      <div className="flex items-center gap-0 px-6 border-b border-border bg-muted/20 shrink-0">
        {(["record", "upload"] as AudioSubTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors",
              subTab === t
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "record" && <><Mic className="h-3 w-3" /> Record Audio</>}
            {t === "upload" && <><Upload className="h-3 w-3" /> Upload Audio</>}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        <div hidden={subTab !== "record"} className="h-full"><RecordAudioSubTab key={orgId} orgId={orgId} onSaved={onSaved} /></div>
        {subTab === "upload" && <UploadAudioSubTab orgId={orgId} onSaved={onSaved} />}
      </div>
    </div>
  );
}

// ── Record Audio ─────────────────────────────────────────────────────────────

function RecordAudioSubTab({ orgId, onSaved }: { orgId: number; onSaved?: (item: MediaItem) => void }) {
  const [recordState, setRecordState] = useState<RecordState>("idle");
  const [countdown, setCountdown] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [recordings, setRecordings] = useState<StudioLocalRecording[]>([]);
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioInput, setSelectedAudioInput] = useState("");
  const [selectedAudioOutput, setSelectedAudioOutput] = useState("");
  const [sampleRate, setSampleRate] = useState<"44100" | "48000">("48000");
  const [audioQuality, setAudioQuality] = useState<"standard" | "high">("high");
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef(0);
  const sessionRef = useRef<StudioCaptureSession | null>(null);
  const liveRef = useRef(true); const urlsRef = useRef(new Set<string>());
  const saveMediaItem = trpc.lms.media.saveMediaItem.useMutation();
  const library = useStudioRecordingLibrary(orgId, input => saveMediaItem.mutateAsync(input), onSaved);
  const libraryRef = useRef(library); libraryRef.current = library;
  const savedItems = library.savedItems;
  const isRecording = recordState === "recording";
  const busy = isRecording || recordState === "paused" || recordState === "countdown";
  const busyRef = useRef(busy); busyRef.current = busy;
  useEffect(() => {
    const devices = navigator.mediaDevices; if (!devices?.enumerateDevices) return;
    const refresh = () => devices.enumerateDevices().then(all => {
      setAudioInputDevices(all.filter(d => d.kind === "audioinput" && d.deviceId));
      setAudioOutputDevices(all.filter(d => d.kind === "audiooutput" && d.deviceId));
    }).catch(() => {});
    refresh(); devices.addEventListener("devicechange", refresh); return () => devices.removeEventListener("devicechange", refresh);
  }, []);
  useEffect(() => {
    liveRef.current = true;
    return () => { liveRef.current = false; sessionRef.current?.dispose(); cancelAnimationFrame(animFrameRef.current); urlsRef.current.forEach(url => URL.revokeObjectURL(url)); };
  }, [orgId]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (busyRef.current || libraryRef.current.hasPending) { event.preventDefault(); event.returnValue = "Recording or saving is still active."; } };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, []);
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "hsl(var(--primary))";
    ctx.beginPath();
    const sliceWidth = canvas.width / bufferLength;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * canvas.height) / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
    animFrameRef.current = requestAnimationFrame(drawWaveform);
  }, []);


  const startCountdown = async () => {
    if (busy || orgId <= 0) { if (orgId <= 0) toast.error("Select an active school before recording"); return; }
    sessionRef.current?.dispose(); setRecordState("countdown"); setCountdown(3);
    const session = new StudioCaptureSession({ mode: "audio", micDeviceId: selectedAudioInput,
      sampleRate: Number(sampleRate), highQualityAudio: audioQuality === "high",
      onState: state => { if (liveRef.current) setRecordState(state); },
      onCountdown: value => { if (liveRef.current) setCountdown(value); },
      onElapsed: value => { if (liveRef.current) setElapsed(value); },
      onAnalyser: analyser => { analyserRef.current = analyser; if (analyser) animFrameRef.current = requestAnimationFrame(drawWaveform); else cancelAnimationFrame(animFrameRef.current); },
      onError: error => toast.error(error.message),
      onResult: result => { const rec = studioLocalRecording(result, true); if (liveRef.current) { urlsRef.current.add(rec.url); setRecordings(previous => [rec, ...previous]); } else URL.revokeObjectURL(rec.url); libraryRef.current.save(rec); },
    });
    sessionRef.current = session; await session.start();
  };
  const pauseRecording = () => { sessionRef.current?.pause(); cancelAnimationFrame(animFrameRef.current); };
  const resumeRecording = () => { sessionRef.current?.resume(); animFrameRef.current = requestAnimationFrame(drawWaveform); };
  const stopRecording = () => sessionRef.current?.stop();
  const cancelCountdown = () => sessionRef.current?.cancel();
  const handleSaveToLibrary = (rec: StudioLocalRecording) => library.save(rec);

  return (
    <div className="flex gap-0 h-full">
      {/* Main recording area */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
        <div className="flex flex-col items-center gap-2">
          <h2 className="text-lg font-semibold">Record Audio</h2>
          <p className="text-sm text-muted-foreground">Record your microphone directly to the Media Library</p>
        </div>

        {/* Waveform canvas */}
        <div className="w-full max-w-md h-24 rounded-2xl border border-border bg-muted/30 overflow-hidden relative">
          <canvas ref={canvasRef} className="w-full h-full" width={600} height={96} />
          {!isRecording && recordState !== "paused" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex items-end gap-0.5 h-8">
                {Array.from({ length: 24 }).map((_, i) => (
                  <div key={i} className="w-1 rounded-full bg-muted-foreground/20" style={{ height: `${20 + Math.sin(i * 0.8) * 15}px` }} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Timer */}
        {(isRecording || recordState === "paused") && (
          <div className="flex items-center gap-2">
            <div className={cn("h-2.5 w-2.5 rounded-full", isRecording ? "bg-red-500 animate-pulse" : "bg-yellow-500")} />
            <span className="text-2xl font-mono font-bold tabular-nums">{formatTime(elapsed)}</span>
            {recordState === "paused" && <span className="text-sm text-muted-foreground">(paused)</span>}
          </div>
        )}

        {/* Countdown overlay */}
        {recordState === "countdown" && (
          <div className="text-6xl font-bold text-primary animate-pulse">{countdown}</div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-center gap-3">
          {recordState === "idle" && (
            <Button size="lg" className="h-14 w-14 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30" onClick={startCountdown}>
              <Mic className="h-6 w-6" />
            </Button>
          )}
          {recordState === "countdown" && (
            <Button size="lg" variant="outline" className="h-14 w-14 rounded-full" onClick={cancelCountdown}>
              <Square className="h-5 w-5" />
            </Button>
          )}
          {recordState === "recording" && (
            <>
              <Button size="lg" variant="outline" className="h-14 w-14 rounded-full" onClick={pauseRecording}>
                <Pause className="h-5 w-5" />
              </Button>
              <Button size="lg" className="h-14 w-14 rounded-full bg-red-500 hover:bg-red-600 text-white" onClick={stopRecording}>
                <Square className="h-5 w-5 fill-current" />
              </Button>
            </>
          )}
          {recordState === "paused" && (
            <>
              <Button size="lg" className="h-14 w-14 rounded-full bg-green-500 hover:bg-green-600 text-white" onClick={resumeRecording}>
                <Play className="h-5 w-5 fill-current" />
              </Button>
              <Button size="lg" className="h-14 w-14 rounded-full bg-red-500 hover:bg-red-600 text-white" onClick={stopRecording}>
                <Square className="h-5 w-5 fill-current" />
              </Button>
            </>
          )}
          {recordState === "stopped" && (
            <Button size="lg" className="h-14 px-6 rounded-full bg-primary text-primary-foreground" onClick={() => { setRecordState("idle"); setElapsed(0); }}>
              <Mic className="h-5 w-5 mr-2" /> Record Again
            </Button>
          )}
        </div>
      </div>

      {/* Recordings list + settings */}
      <div className="w-72 border-l border-border flex flex-col overflow-hidden">
        {showAudioSettings && (
          <div className="p-4 border-b border-border flex flex-col gap-3 overflow-y-auto max-h-[60vh]">
            <h3 className="font-semibold text-sm flex items-center gap-1.5"><Settings className="h-3.5 w-3.5" /> Audio Settings</h3>

            {/* Microphone */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Mic className="h-3 w-3" /> Microphone</label>
              <Select disabled={busy} value={selectedAudioInput || "__default__"} onValueChange={(v) => setSelectedAudioInput(v === "__default__" ? "" : v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Default microphone" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default__">Default microphone</SelectItem>
                  {audioInputDevices.map((d) => <SelectItem key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0, 8)}`}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Speaker / Output */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Volume2 className="h-3 w-3" /> Speaker / Output</label>
              {audioOutputDevices.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Output device selection not supported in this browser</p>
              ) : (
                <Select value={selectedAudioOutput || "__default__"} onValueChange={(v) => setSelectedAudioOutput(v === "__default__" ? "" : v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Default speaker" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__default__">Default speaker</SelectItem>
                    {audioOutputDevices.map((d) => <SelectItem key={d.deviceId} value={d.deviceId}>{d.label || `Speaker ${d.deviceId.slice(0, 8)}`}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Sample Rate */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><SlidersHorizontal className="h-3 w-3" /> Sample Rate</label>
              <Select disabled={busy} value={sampleRate} onValueChange={(v) => setSampleRate(v as "44100" | "48000")}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="44100">44.1 kHz — CD Quality</SelectItem>
                  <SelectItem value="48000">48 kHz — Studio Quality</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Audio Quality */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Headphones className="h-3 w-3" /> Audio Quality</label>
              <Select disabled={busy} value={audioQuality} onValueChange={(v) => setAudioQuality(v as "standard" | "high")}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard — Echo cancellation only</SelectItem>
                  <SelectItem value="high">High — Noise suppression + AGC</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Active settings summary */}
            <div className="rounded-lg bg-muted/40 px-3 py-2 flex flex-col gap-1">
              <p className="text-xs font-medium text-muted-foreground">Active settings</p>
              <p className="text-xs text-foreground">{parseInt(sampleRate, 10) / 1000} kHz · {audioQuality === "high" ? "High quality" : "Standard"}</p>
            </div>
          </div>
        )}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-sm">Recordings ({recordings.length})</h3>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowAudioSettings((s) => !s)}>
            <Settings className="h-3.5 w-3.5 mr-1" /> Settings
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {recordings.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm gap-2">
              <Headphones className="h-8 w-8 opacity-30" />
              <p>No recordings yet</p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {recordings.map((rec, idx) => (
                <div key={rec.id} className="p-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{rec.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {formatTime(rec.duration)}
                        </span>
                        <span className="text-xs text-muted-foreground">{formatFileSize(rec.size)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { const a = document.createElement("a"); a.href = rec.url; a.download = rec.name; a.click(); }}>
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className={cn("h-7 w-7", savedItems[rec.id] ? "text-teal-500" : "")}
                        onClick={() => handleSaveToLibrary(rec)}
                        disabled={library.status(rec.id)?.status === "uploading" || library.status(rec.id)?.status === "saving" || library.status(rec.id)?.status === "queued" || !!savedItems[rec.id]}
                      >
                        {library.status(rec.id)?.status === "uploading" || library.status(rec.id)?.status === "saving" || library.status(rec.id)?.status === "queued" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Library className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                  {library.status(rec.id)?.status === "error" && <Button variant="outline" size="sm" className="mt-2 text-xs" onClick={() => library.save(rec)}>Retry save: {library.status(rec.id)?.errorMessage}</Button>}
                  <audio
                    src={rec.url}
                    controls
                    className="w-full mt-2 h-8"
                    ref={(el) => {
                      if (el && selectedAudioOutput && typeof (el as any).setSinkId === "function") {
                        (el as any).setSinkId(selectedAudioOutput).catch(() => {});
                      }
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Upload Audio ──────────────────────────────────────────────────────────────
function UploadAudioSubTab({ orgId, onSaved }: { orgId: number; onSaved?: (item: MediaItem) => void }) {
  const [dragOver, setDragOver] = useState(false);
  const [uploadedItems, setUploadedItems] = useState<MediaItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveMediaItem = trpc.lms.media.saveMediaItem.useMutation();
  const { enqueue } = useUploadQueue();

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const maxSize = 3 * 1024 * 1024 * 1024; // 3 GB
    let queued = 0;
    Array.from(files).forEach((file) => {
      if (file.size > maxSize) { toast.error(`"${file.name}" is too large — maximum 3 GB`); return; }
      if (!file.type.startsWith("audio/")) { toast.error(`"${file.name}" is not an audio file`); return; }
      enqueue({
        file,
        orgId,
        folder: "lms-media",
        onComplete: async (result) => {
          if (!result) return;
          try {
            const saved = await saveMediaItem.mutateAsync({
              orgId,
              fileName: result.fileName,
              mimeType: result.fileType || file.type || "audio/mpeg",
              fileSize: result.fileSize,
              fileKey: result.key,
              url: result.url,
              source: "direct",
              tags: ["audio", "upload"],
            });
            const item: MediaItem = { id: (saved as any).id, url: result.url, filename: result.fileName, mimeType: result.fileType || file.type, fileSize: result.fileSize };
            setUploadedItems((prev) => [item, ...prev]);
            toast.success(`"${result.fileName}" uploaded to Media Library`);
            onSaved?.(item);
          } catch (err: any) {
            toast.error(`Failed to save "${result.fileName}": ${err?.message ?? "Unknown error"}`);
            throw err;
          }
        },
        onError: (message) => { toast.error(`Upload failed: ${message}`); },
      });
      queued++;
    });
    if (queued > 0) {
      toast.info(queued === 1 ? `"${files[0].name}" added to upload queue` : `${queued} audio files added to upload queue`);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl mx-auto w-full">
      <div>
        <h2 className="text-lg font-semibold">Upload Audio</h2>
        <p className="text-sm text-muted-foreground mt-1">Upload audio files — they are queued and processed in the background</p>
      </div>
      <div
        className={cn(
          "border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center gap-4 transition-all cursor-pointer",
          dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
        )}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input ref={fileInputRef} type="file" accept="audio/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
        <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
          <Music className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">Drop audio files here or click to browse</p>
          <p className="text-xs text-muted-foreground mt-1">MP3, WAV, M4A, OGG, WebM · Max 3 GB · Multiple files supported</p>
        </div>
      </div>
      {uploadedItems.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Uploaded this session</h3>
          {uploadedItems.map((item) => (
            <div key={item.id} className="flex flex-col gap-2 p-3 rounded-xl border border-border bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Music className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.filename}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(item.fileSize)}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <CheckCircle className="h-4 w-4 text-teal-500" />
                  <span className="text-xs text-teal-600">Saved</span>
                </div>
              </div>
              <audio src={item.url} controls className="w-full h-8" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
// ─── Main RecordEditPage ──────────────────────────────────────────────────────

export default function RecordEditPage() {
  const [activeTab, setActiveTab] = useState<StudioTab>("record");
  const [visitedTabs, setVisitedTabs] = useState<StudioTab[]>(["record"]);
  const [lastSavedItem, setLastSavedItem] = useState<MediaItem | undefined>(undefined);
  const { user } = useAuth();
  const { orgId } = useOrgScope();
  const { isBuilder, isPro, isLoading: planLoading } = usePlanLimits();
  const { data: studioCapability, isLoading: capabilityLoading, error: capabilityError, refetch: refetchCapability } = trpc.billing.getStudioSubscription.useQuery(undefined, {
    enabled: !!user, retry: false, refetchInterval: 30_000, refetchOnWindowFocus: true,
  });
  // Browser school IDs are consistency hints only; no privileged role or fallback school bypass.
  const captureAllowed = !capabilityLoading && !capabilityError && orgId > 0 && studioCapability?.orgId === orgId && studioCapability.isActive;

  const handleItemSaved = useCallback((item: MediaItem) => {
    setLastSavedItem(item);
  }, []);

  const handleUploadSaved = useCallback((item: MediaItem) => {
    handleItemSaved(item);
  }, [handleItemSaved]);

  const TABS: { id: StudioTab; label: string; icon: React.ElementType }[] = [
    { id: "record", label: "Record Video", icon: Circle },
    { id: "upload", label: "Upload Video", icon: Upload },
    { id: "edit", label: "Edit Video", icon: Scissors },
    { id: "audio", label: "Audio", icon: Headphones },
  ];

  const [, setLocation] = useLocation();
  const { data: studioVersion } = trpc.platformAdmin.getLatestAppVersion.useQuery({ product: "studio" });

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">Course360™ Studio™</h1>
          </div>
          <p className="text-sm text-muted-foreground">Record, edit, and publish professional video and audio content</p>
        </div>
        {lastSavedItem && (
          <div className="flex items-center gap-2 text-sm text-teal-600">
            <CheckCircle className="h-4 w-4" />
            <span>Saved to Media Library</span>
          </div>
        )}
      </div>



      {/* Tab bar */}
      <div className="flex items-center gap-0 px-6 border-b border-border bg-background shrink-0">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setVisitedTabs(previous => previous.includes(tab.id) ? previous : [...previous, tab.id]); }}
              className={cn(
                "flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-auto">
        {(activeTab === "record" || activeTab === "audio") && capabilityLoading ? (
          <div role="status" className="flex h-full items-center justify-center gap-2 p-10"><Loader2 className="h-5 w-5 animate-spin" /> Checking selected-school Studio access…</div>
        ) : (activeTab === "record" || activeTab === "audio") && capabilityError ? (
          <div role="alert" className="p-10">{capabilityError.message}<Button variant="outline" onClick={() => refetchCapability()}>Retry Studio access</Button></div>
        ) : (activeTab === "record" || activeTab === "audio") && !captureAllowed ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 p-10 text-center">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow-lg">
              <Video className="h-8 w-8 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold mb-2">Builder Plan Required</h2>
              <p className="text-muted-foreground max-w-md">
                Browser-based recording is available on the <strong>Builder plan</strong> and above.
                Upgrade to start recording video and audio directly in your browser.
              </p>
              <p className="text-sm text-muted-foreground mt-2">{studioCapability?.reason ?? "Select the saved active school with authorized Studio Web access. Standalone Studio Web or Bundle access is also supported."}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                className="gap-2 bg-[#0e8a96] hover:bg-[#0a6e78] text-white"
                onClick={() => setLocation("/settings/billing")}
              >
                <Zap className="h-4 w-4" />
                Upgrade to Builder
              </Button>
            </div>
          </div>
        ) : (
          <>
            {captureAllowed && visitedTabs.includes("record") && (
              <div hidden={activeTab !== "record"} className="h-full"><RecordTab key={orgId} orgId={orgId} onSaved={handleItemSaved} /></div>
            )}
            {visitedTabs.includes("upload") && (
              <div hidden={activeTab !== "upload"} className="h-full"><UploadTab key={orgId} orgId={orgId} onSaved={handleUploadSaved} /></div>
            )}
            {visitedTabs.includes("edit") && (
              <div hidden={activeTab !== "edit"} className="h-full"><EditTab key={orgId} orgId={orgId} initialItem={lastSavedItem} /></div>
            )}
            {captureAllowed && visitedTabs.includes("audio") && (
              <div hidden={activeTab !== "audio"} className="h-full"><AudioTab key={orgId} orgId={orgId} onSaved={handleItemSaved} /></div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
