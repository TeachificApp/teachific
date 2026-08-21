import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Video, VideoOff, Mic, MicOff, Monitor, Circle, Square,
  Pause, Play, Download, Trash2, Settings, Camera, ChevronDown,
  CheckCircle, Loader2, Clock, Library, FileText,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useOrgScope } from "@/hooks/useOrgScope";

type RecordMode = "screen" | "camera" | "screen+camera";
type RecordState = "idle" | "countdown" | "recording" | "paused" | "stopped";

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function RecordPage() {
  const [mode, setMode] = useState<RecordMode>("screen+camera");
  const [recordState, setRecordState] = useState<RecordState>("idle");
  const [countdown, setCountdown] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [recordings, setRecordings] = useState<{ url: string; name: string; size: number; duration: number }[]>([]);
  const [cameraPos, setCameraPos] = useState({ x: 20, y: 20 });
  const [isDraggingCamera, setIsDraggingCamera] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [cameraSize, setCameraSize] = useState(160);
  const [showSettings, setShowSettings] = useState(false);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState<string>("");
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const [transcribingIdx, setTranscribingIdx] = useState<number | null>(null);
  const [transcripts, setTranscripts] = useState<Record<number, string>>({});
  const [savedToLibrary, setSavedToLibrary] = useState<Record<number, boolean>>({});

  const { user } = useAuth();
  const { orgId } = useOrgScope();
  const getUploadUrl = trpc.lms.media.getUploadUrl.useMutation();
  const saveRecording = trpc.lms.media.saveRecording.useMutation();
  const transcribeMutation = trpc.lms.media.transcribe.useMutation();

  const handleSaveToLibrary = async (rec: typeof recordings[0], idx: number) => {
    if (!user || !orgId) { toast.error("Select an organization before saving a recording."); return; }
    setSavingIdx(idx);
    try {
      // Fetch the blob from the object URL
      const blob = await fetch(rec.url).then(r => r.blob());
      const ext = rec.name.split(".").pop() ?? "webm";
      const contentType = blob.type || `video/${ext}`;
      // Get a pre-signed upload URL
      const { key, fileUrl, uploadUrl } = await getUploadUrl.mutateAsync({
        orgId,
        fileName: rec.name,
        contentType,
      });
      // Upload the blob to S3
      await fetch(uploadUrl, {
        method: "PUT",
        body: blob,
        headers: { "Content-Type": contentType },
      });
      // Save metadata to media library
      await saveRecording.mutateAsync({
        orgId,
        filename: rec.name,
        mimeType: contentType,
        fileSize: blob.size,
        fileKey: key,
        url: fileUrl,
        durationSeconds: rec.duration,
      });
      setSavedToLibrary(prev => ({ ...prev, [idx]: true }));
      toast.success("Saved to Media Library");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save recording");
    } finally {
      setSavingIdx(null);
    }
  };

  const handleTranscribe = async (rec: typeof recordings[0], idx: number) => {
    if (!user || !orgId) { toast.error("Select an organization before transcribing a recording."); return; }
    setTranscribingIdx(idx);
    try {
      // First save to library to get a public URL
      const blob = await fetch(rec.url).then(r => r.blob());
      const ext = rec.name.split(".").pop() ?? "webm";
      const contentType = blob.type || `video/${ext}`;
      const { key, fileUrl, uploadUrl } = await getUploadUrl.mutateAsync({
        orgId,
        fileName: rec.name,
        contentType,
      });
      await fetch(uploadUrl, {
        method: "PUT",
        body: blob,
        headers: { "Content-Type": contentType },
      });
      const result = await transcribeMutation.mutateAsync({
        orgId,
        fileUrl,
      });
      setTranscripts(prev => ({ ...prev, [idx]: result.text }));
      toast.success("Transcript generated");
    } catch (err: any) {
      toast.error(err?.message ?? "Transcription failed");
    } finally {
      setTranscribingIdx(null);
    }
  };

  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load devices on mount
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      setAudioDevices(devices.filter((d) => d.kind === "audioinput"));
      setVideoDevices(devices.filter((d) => d.kind === "videoinput"));
    }).catch(() => {});
  }, []);

  // Start camera preview
  useEffect(() => {
    if (mode !== "screen" && cameraEnabled) {
      const constraints: MediaStreamConstraints = {
        video: selectedCamera ? { deviceId: selectedCamera } : true,
        audio: false,
      };
      navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
        cameraStreamRef.current = stream;
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream;
        }
      }).catch(() => {
        toast.error("Could not access camera");
        setCameraEnabled(false);
      });
    }
    return () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((t) => t.stop());
        cameraStreamRef.current = null;
      }
    };
  }, [mode, cameraEnabled, selectedCamera]);

  const startRecording = useCallback(async () => {
    try {
      const streams: MediaStream[] = [];

      // Get screen stream
      if (mode === "screen" || mode === "screen+camera") {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: 30 },
          audio: true,
        });
        screenStreamRef.current = screenStream;
        streams.push(screenStream);
        if (screenVideoRef.current) {
          screenVideoRef.current.srcObject = screenStream;
        }
      }

      // Get mic audio
      if (micEnabled) {
        const audioConstraints: MediaStreamConstraints = {
          audio: selectedMic ? { deviceId: selectedMic } : true,
          video: false,
        };
        try {
          const micStream = await navigator.mediaDevices.getUserMedia(audioConstraints);
          streams.push(micStream);
        } catch {
          toast.warning("Could not access microphone — recording without audio");
        }
      }

      // Combine tracks
      const combinedTracks: MediaStreamTrack[] = [];
      streams.forEach((s) => s.getTracks().forEach((t) => combinedTracks.push(t)));
      const combined = new MediaStream(combinedTracks);

      // Set up MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : "video/webm";
      const recorder = new MediaRecorder(combined, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const name = `Recording-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-")}.webm`;
        setRecordings((prev) => [{ url, name, size: blob.size, duration: elapsed }, ...prev]);
        if (previewRef.current) {
          previewRef.current.src = url;
        }
        setRecordState("stopped");
        // Stop all tracks
        streams.forEach((s) => s.getTracks().forEach((t) => t.stop()));
      };

      // Handle screen share stop (user clicks browser stop button)
      if (screenStreamRef.current) {
        screenStreamRef.current.getVideoTracks()[0]?.addEventListener("ended", () => {
          stopRecording();
        });
      }

      recorder.start(1000);
      setRecordState("recording");
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } catch (err: any) {
      if (err.name !== "NotAllowedError") {
        toast.error("Could not start recording: " + err.message);
      }
      setRecordState("idle");
    }
  }, [mode, micEnabled, selectedMic, elapsed]);

  const startCountdown = useCallback(async () => {
    setRecordState("countdown");
    setCountdown(3);
    let c = 3;
    const interval = setInterval(() => {
      c -= 1;
      setCountdown(c);
      if (c <= 0) {
        clearInterval(interval);
        startRecording();
      }
    }, 1000);
  }, [startRecording]);

  const pauseRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.pause();
      setRecordState("paused");
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current?.state === "paused") {
      mediaRecorderRef.current.resume();
      setRecordState("recording");
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    }
  };

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
  }, []);

  // Camera bubble drag
  const handleCameraMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingCamera(true);
    setDragOffset({ x: e.clientX - cameraPos.x, y: e.clientY - cameraPos.y });
  };

  useEffect(() => {
    if (!isDraggingCamera) return;
    const onMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const maxX = rect.width - cameraSize;
      const maxY = rect.height - cameraSize;
      setCameraPos({
        x: Math.max(0, Math.min(maxX, e.clientX - dragOffset.x)),
        y: Math.max(0, Math.min(maxY, e.clientY - dragOffset.y)),
      });
    };
    const onUp = () => setIsDraggingCamera(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDraggingCamera, dragOffset, cameraSize]);

  const downloadRecording = (rec: typeof recordings[0]) => {
    const a = document.createElement("a");
    a.href = rec.url;
    a.download = rec.name;
    a.click();
  };

  const deleteRecording = (idx: number) => {
    setRecordings((prev) => {
      URL.revokeObjectURL(prev[idx].url);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const isRecording = recordState === "recording" || recordState === "paused";

  return (
    <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h1 className="text-xl font-bold">Record</h1>
            <p className="text-sm text-muted-foreground">Screen + camera recording for your courses</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowSettings((s) => !s)}>
              <Settings className="h-4 w-4 mr-1.5" /> Settings
            </Button>
          </div>
        </div>

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
                      mode === m
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/50 text-muted-foreground"
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
            <div
              ref={containerRef}
              className="relative bg-black rounded-2xl overflow-hidden aspect-video w-full max-w-4xl mx-auto"
            >
              {/* Screen preview */}
              {(mode === "screen" || mode === "screen+camera") && (
                <video
                  ref={screenVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-contain"
                />
              )}

              {/* Camera only mode */}
              {mode === "camera" && (
                <video
                  ref={cameraVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover scale-x-[-1]"
                />
              )}

              {/* Camera bubble overlay (screen+camera mode) */}
              {mode === "screen+camera" && cameraEnabled && (
                <div
                  className="absolute rounded-full overflow-hidden border-2 border-white shadow-lg cursor-move select-none"
                  style={{
                    left: cameraPos.x,
                    top: cameraPos.y,
                    width: cameraSize,
                    height: cameraSize,
                  }}
                  onMouseDown={handleCameraMouseDown}
                >
                  <video
                    ref={cameraVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                </div>
              )}

              {/* Idle placeholder */}
              {recordState === "idle" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60">
                  <div className="h-16 w-16 rounded-full bg-white/10 flex items-center justify-center">
                    <Video className="h-8 w-8 text-white/60" />
                  </div>
                  <p className="text-white/60 text-sm">Click Start Recording to begin</p>
                </div>
              )}

              {/* Countdown overlay */}
              {recordState === "countdown" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                  <div className="text-8xl font-bold text-white animate-pulse">{countdown}</div>
                </div>
              )}

              {/* Recording indicator */}
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
              {/* Mic toggle */}
              <Button
                variant="outline"
                size="icon"
                className={cn("h-11 w-11 rounded-full", !micEnabled && "border-destructive text-destructive")}
                onClick={() => setMicEnabled((v) => !v)}
                disabled={isRecording}
                title={micEnabled ? "Mute microphone" : "Unmute microphone"}
              >
                {micEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </Button>

              {/* Camera toggle */}
              {mode !== "screen" && (
                <Button
                  variant="outline"
                  size="icon"
                  className={cn("h-11 w-11 rounded-full", !cameraEnabled && "border-destructive text-destructive")}
                  onClick={() => setCameraEnabled((v) => !v)}
                  disabled={isRecording}
                  title={cameraEnabled ? "Turn off camera" : "Turn on camera"}
                >
                  {cameraEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                </Button>
              )}

              {/* Main action button */}
              {recordState === "idle" && (
                <Button
                  size="lg"
                  className="h-14 w-14 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30"
                  onClick={startCountdown}
                  title="Start recording"
                >
                  <Circle className="h-6 w-6 fill-current" />
                </Button>
              )}

              {recordState === "countdown" && (
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 w-14 rounded-full"
                  onClick={() => setRecordState("idle")}
                >
                  <Square className="h-5 w-5" />
                </Button>
              )}

              {recordState === "recording" && (
                <>
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-14 w-14 rounded-full"
                    onClick={pauseRecording}
                    title="Pause"
                  >
                    <Pause className="h-5 w-5" />
                  </Button>
                  <Button
                    size="lg"
                    className="h-14 w-14 rounded-full bg-red-500 hover:bg-red-600 text-white"
                    onClick={stopRecording}
                    title="Stop recording"
                  >
                    <Square className="h-5 w-5 fill-current" />
                  </Button>
                </>
              )}

              {recordState === "paused" && (
                <>
                  <Button
                    size="lg"
                    className="h-14 w-14 rounded-full bg-green-500 hover:bg-green-600 text-white"
                    onClick={resumeRecording}
                    title="Resume"
                  >
                    <Play className="h-5 w-5 fill-current" />
                  </Button>
                  <Button
                    size="lg"
                    className="h-14 w-14 rounded-full bg-red-500 hover:bg-red-600 text-white"
                    onClick={stopRecording}
                    title="Stop recording"
                  >
                    <Square className="h-5 w-5 fill-current" />
                  </Button>
                </>
              )}

              {recordState === "stopped" && (
                <Button
                  size="lg"
                  className="h-14 px-6 rounded-full bg-primary text-primary-foreground"
                  onClick={() => {
                    setRecordState("idle");
                    setElapsed(0);
                    if (screenVideoRef.current) screenVideoRef.current.srcObject = null;
                  }}
                >
                  <Circle className="h-5 w-5 fill-current mr-2" /> Record Again
                </Button>
              )}
            </div>

            {/* Camera size slider (screen+camera mode) */}
            {mode === "screen+camera" && !isRecording && (
              <div className="flex items-center gap-3 max-w-xs mx-auto w-full">
                <Camera className="h-4 w-4 text-muted-foreground shrink-0" />
                <Slider
                  value={[cameraSize]}
                  onValueChange={([v]) => setCameraSize(v)}
                  min={80}
                  max={280}
                  step={20}
                  className="flex-1"
                />
                <span className="text-xs text-muted-foreground w-12 text-right">{cameraSize}px</span>
              </div>
            )}
          </div>

          {/* Right panel: settings + recordings */}
          <div className="w-80 border-l border-border flex flex-col overflow-hidden">
            {/* Settings panel */}
            {showSettings && (
              <div className="p-4 border-b border-border flex flex-col gap-3">
                <h3 className="font-semibold text-sm">Settings</h3>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-muted-foreground">Microphone</label>
                  <Select value={selectedMic || "__default__"} onValueChange={(v) => setSelectedMic(v === "__default__" ? "" : v)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Default microphone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__default__">Default microphone</SelectItem>
                      {audioDevices.map((d) => (
                        <SelectItem key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0, 8)}`}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-muted-foreground">Camera</label>
                  <Select value={selectedCamera || "__default__"} onValueChange={(v) => setSelectedCamera(v === "__default__" ? "" : v)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Default camera" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__default__">Default camera</SelectItem>
                      {videoDevices.map((d) => (
                        <SelectItem key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(0, 8)}`}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Recordings list */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 border-b border-border">
                <h3 className="font-semibold text-sm">Recordings ({recordings.length})</h3>
              </div>
              {recordings.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm gap-2">
                  <Video className="h-8 w-8 opacity-30" />
                  <p>No recordings yet</p>
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-border">
                  {recordings.map((rec, idx) => (
                    <div key={idx} className="p-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{rec.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {formatTime(rec.duration)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {(rec.size / 1024 / 1024).toFixed(1)} MB
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => downloadRecording(rec)}
                            title="Download"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn("h-7 w-7", savedToLibrary[idx] ? "text-teal-500" : "")}
                            onClick={() => handleSaveToLibrary(rec, idx)}
                            disabled={savingIdx === idx || savedToLibrary[idx]}
                            title={savedToLibrary[idx] ? "Saved to Library" : "Save to Media Library"}
                          >
                            {savingIdx === idx ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Library className="h-3.5 w-3.5" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleTranscribe(rec, idx)}
                            disabled={transcribingIdx === idx}
                            title="Generate Transcript"
                          >
                            {transcribingIdx === idx ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => deleteRecording(idx)}
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      {idx === 0 && recordState === "stopped" && (
                        <video
                          ref={previewRef}
                          controls
                          className="mt-2 w-full rounded-lg aspect-video bg-black"
                        />
                      )}
                      {transcripts[idx] && (
                        <div className="mt-2 p-2 rounded-lg bg-muted/50 border border-border">
                          <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                            <FileText className="h-3 w-3" /> Transcript
                          </p>
                          <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{transcripts[idx]}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
    </div>
  );
}
