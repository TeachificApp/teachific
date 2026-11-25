export type StudioCaptureMode = "screen" | "camera" | "screen+camera" | "audio";
export type StudioCaptureState = "idle" | "countdown" | "recording" | "paused" | "stopped";
export interface StudioCaptureResult {
  id: string; blob: Blob; mimeType: string; duration: number;
  width?: number; height?: number; frameRate?: number;
}
export interface StudioCaptureOptions {
  mode: StudioCaptureMode; width?: number; height?: number; frameRate?: number;
  cameraStream?: MediaStream | null; cameraDeviceId?: string; micDeviceId?: string;
  micEnabled?: boolean; sampleRate?: number; highQualityAudio?: boolean;
  pip?: () => { x: number; y: number; size: number; width: number; height: number };
  onScreen?: (stream: MediaStream) => void;
  onState?: (state: StudioCaptureState) => void;
  onCountdown?: (seconds: number) => void; onElapsed?: (seconds: number) => void;
  onAnalyser?: (analyser: AnalyserNode | null) => void;
  onWarning?: (message: string) => void; onResult: (result: StudioCaptureResult) => void;
  onError?: (error: Error) => void;
}
export interface StudioCaptureDependencies {
  devices: MediaDevices; Recorder: typeof MediaRecorder; Stream: typeof MediaStream;
  Audio: typeof AudioContext; document: Document; now: () => number;
  setInterval: typeof setInterval; clearInterval: typeof clearInterval;
  id: () => string;
}
function browserDependencies(): StudioCaptureDependencies {
  return {
    devices: navigator.mediaDevices, Recorder: window.MediaRecorder, Stream: window.MediaStream,
    Audio: window.AudioContext || (window as any).webkitAudioContext, document,
    now: () => performance.now(), setInterval, clearInterval,
    id: () => crypto.randomUUID(),
  };
}
export function selectStudioCodec(Recorder: typeof MediaRecorder, audioOnly: boolean): string | undefined {
  const candidates = audioOnly
    ? ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus", "audio/webm"]
    : ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/mp4", "video/webm"];
  return candidates.find(mime => Recorder.isTypeSupported?.(mime));
}
export function studioRecordingExtension(mime: string): string {
  return mime.includes("mp4") ? (mime.startsWith("audio/") ? "m4a" : "mp4") : mime.includes("ogg") ? "ogg" : "webm";
}
/** Monotonic active-media clock; wall time while paused is never included. */
export class StudioMediaClock {
  private accumulated = 0; private started: number | null = null;
  constructor(private now: () => number) {}
  resume() { if (this.started === null) this.started = this.now(); }
  pause() { if (this.started !== null) { this.accumulated += this.now() - this.started; this.started = null; } }
  seconds() { return Math.max(0, (this.accumulated + (this.started === null ? 0 : this.now() - this.started)) / 1000); }
}
/** All resources belong to one session; a cancelled asynchronous permission request cannot resurrect it. */
export class StudioCaptureSession {
  private deps: StudioCaptureDependencies;
  private streams: MediaStream[] = []; private videos: HTMLVideoElement[] = [];
  private audio: AudioContext | null = null; private nodes: AudioNode[] = [];
  private mic: MediaStream | null = null; private recorder: MediaRecorder | null = null;
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private drawTimer: ReturnType<typeof setInterval> | null = null;
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private cancelled = false; private finalized = false; private chunks: Blob[] = [];
  private clock: StudioMediaClock; private output: MediaStream | null = null;
  private width?: number; private height?: number; private fps?: number;
  private endListeners: Array<{ track: MediaStreamTrack; listener: () => void }> = [];
  constructor(private options: StudioCaptureOptions, dependencies?: StudioCaptureDependencies) {
    this.deps = dependencies ?? browserDependencies(); this.clock = new StudioMediaClock(this.deps.now);
  }
  private own(stream: MediaStream): MediaStream {
    if (this.cancelled) { stream.getTracks().forEach(track => track.stop()); throw new Error("Capture cancelled"); }
    this.streams.push(stream); return stream;
  }
  private async video(stream: MediaStream) {
    const video = this.deps.document.createElement("video");
    video.muted = true; video.playsInline = true; video.srcObject = stream; this.videos.push(video);
    await video.play(); return video;
  }
  async start(countdownSeconds = 3): Promise<void> {
    try {
      if (!this.deps.devices?.getUserMedia || !this.deps.Recorder || !this.deps.Stream) throw new Error("Browser recording is not supported. Use a secure context and a supported browser.");
      const o = this.options;
      const requested = { width: { ideal: o.width ?? 1920 }, height: { ideal: o.height ?? 1080 }, frameRate: { ideal: o.frameRate ?? 30 } };
      let screen: MediaStream | null = null; let camera: MediaStream | null = null;
      if (o.mode === "screen" || o.mode === "screen+camera") {
        if (!this.deps.devices.getDisplayMedia) throw new Error("Screen capture is not supported in this browser.");
        // The first await is getDisplayMedia, preserving the start-button user activation.
        screen = this.own(await this.deps.devices.getDisplayMedia({ video: requested, audio: true }));
        o.onScreen?.(screen);
        const track = screen.getVideoTracks()[0];
        if (!track) throw new Error("Screen capture did not provide a video track.");
        const listener = () => this.stop(); track.addEventListener("ended", listener); this.endListeners.push({ track, listener });
      }
      if (o.mode === "camera" || o.mode === "screen+camera") {
        const existing = o.cameraStream?.getVideoTracks().find(t => t.readyState === "live");
        camera = this.own(existing ? new this.deps.Stream([existing.clone()]) : await this.deps.devices.getUserMedia({
          video: { ...requested, ...(o.cameraDeviceId ? { deviceId: { exact: o.cameraDeviceId } } : {}) }, audio: false,
        }));
        if (!camera.getVideoTracks().length) throw new Error("Camera capture did not provide a video track.");
      }
      try {
        this.mic = this.own(await this.deps.devices.getUserMedia({ audio: {
          ...(o.micDeviceId ? { deviceId: { exact: o.micDeviceId } } : {}),
          ...(o.sampleRate ? { sampleRate: { ideal: o.sampleRate } } : {}),
          echoCancellation: true, noiseSuppression: o.highQualityAudio !== false, autoGainControl: o.highQualityAudio !== false,
        }, video: false }));
        this.setMicEnabled(o.micEnabled !== false);
      } catch (error) {
        if (this.cancelled || o.mode === "audio") throw error;
        o.onWarning?.("Microphone unavailable; system audio will still be recorded when provided by the browser.");
      }
      if (this.cancelled) return;
      const outputTracks: MediaStreamTrack[] = [];
      if (o.mode !== "audio") {
        const primary = screen ?? camera;
        if (!primary) throw new Error("No video source available.");
        const settings = primary.getVideoTracks()[0].getSettings();
        const main = await this.video(primary);
        const cam = screen && camera ? await this.video(camera) : null;
        const nativeWidth = settings.width || main.videoWidth || o.width || 1920;
        const nativeHeight = settings.height || main.videoHeight || o.height || 1080;
        const scale = Math.min(1, (o.width ?? nativeWidth) / nativeWidth, (o.height ?? nativeHeight) / nativeHeight);
        this.width = Math.max(2, Math.floor(nativeWidth * scale / 2) * 2);
        this.height = Math.max(2, Math.floor(nativeHeight * scale / 2) * 2);
        this.fps = Math.min(o.frameRate ?? 30, settings.frameRate || o.frameRate || 30);
        const canvas = this.deps.document.createElement("canvas"); canvas.width = this.width; canvas.height = this.height;
        if (!canvas.captureStream) throw new Error("Canvas recording is not supported in this browser.");
        const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Canvas compositing is unavailable.");
        const draw = () => {
          ctx.fillStyle = "#000000"; ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(main, 0, 0, canvas.width, canvas.height);
          if (cam) {
            const p = o.pip?.() ?? { x: 20, y: 20, size: 160, width: 960, height: 540 };
            const scaleX = canvas.width / Math.max(1, p.width); const scaleY = canvas.height / Math.max(1, p.height);
            const size = Math.min(canvas.width, canvas.height, p.size * Math.min(scaleX, scaleY));
            const x = Math.max(0, Math.min(canvas.width - size, p.x * scaleX));
            const y = Math.max(0, Math.min(canvas.height - size, p.y * scaleY));
            const vw = cam.videoWidth || size; const vh = cam.videoHeight || size; const side = Math.min(vw, vh);
            ctx.save(); ctx.beginPath(); ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2); ctx.clip();
            ctx.translate(x + size, y); ctx.scale(-1, 1);
            ctx.drawImage(cam, (vw - side) / 2, (vh - side) / 2, side, side, 0, 0, size, size); ctx.restore();
          }
        };
        draw(); this.drawTimer = this.deps.setInterval(draw, 1000 / this.fps);
        outputTracks.push(...this.own(canvas.captureStream(this.fps)).getVideoTracks());
        if ((o.width && nativeWidth < o.width) || (o.frameRate && (settings.frameRate ?? o.frameRate) < o.frameRate)) o.onWarning?.(`Source reports ${nativeWidth}×${nativeHeight} at ${settings.frameRate ?? "unknown"} fps; capture is not upscaled.`);
      }
      const audioStreams = [screen, this.mic].filter((s): s is MediaStream => !!s?.getAudioTracks().length);
      if (audioStreams.length) {
        if (!this.deps.Audio) throw new Error("Audio mixing is not supported in this browser.");
        this.audio = new this.deps.Audio();
        const destination = this.audio.createMediaStreamDestination(); this.nodes.push(destination);
        for (const stream of audioStreams) {
          const source = this.audio.createMediaStreamSource(new this.deps.Stream(stream.getAudioTracks()));
          // Headroom avoids clipping when system and mic are both loud. Never route live mic to speakers.
          const gain = this.audio.createGain(); gain.gain.value = audioStreams.length > 1 ? 0.5 : 1;
          source.connect(gain); gain.connect(destination); this.nodes.push(source, gain);
          if (stream === this.mic && o.onAnalyser) { const analyser = this.audio.createAnalyser(); source.connect(analyser); this.nodes.push(analyser); o.onAnalyser(analyser); }
        }
        await this.audio.resume(); outputTracks.push(...this.own(destination.stream).getAudioTracks().slice(0, 1));
      }
      if (this.cancelled) { this.cleanup(); return; }
      this.output = new this.deps.Stream(outputTracks);
      const mimeType = selectStudioCodec(this.deps.Recorder, o.mode === "audio");
      this.recorder = new this.deps.Recorder(this.output, {
        ...(mimeType ? { mimeType } : {}),
        ...(o.mode !== "audio" ? { videoBitsPerSecond: Math.round((this.width ?? 1920) * (this.height ?? 1080) * (this.fps ?? 30) * 0.12) } : {}),
        audioBitsPerSecond: o.highQualityAudio === false ? 128000 : 256000,
      });
      this.recorder.ondataavailable = event => { if (event.data.size) this.chunks.push(event.data); };
      this.recorder.onstop = () => this.finish();
      this.recorder.onerror = event => { o.onError?.((event as any).error ?? new Error("Recording failed")); this.stop(); };
      let remaining = countdownSeconds; o.onState?.("countdown"); o.onCountdown?.(remaining);
      const begin = () => {
        if (this.cancelled) return;
        this.recorder!.start(250); this.clock.resume(); o.onElapsed?.(0); o.onState?.("recording");
        this.clockTimer = this.deps.setInterval(() => o.onElapsed?.(this.clock.seconds()), 250);
      };
      if (remaining <= 0) begin();
      else this.countdownTimer = this.deps.setInterval(() => {
        remaining--; o.onCountdown?.(remaining);
        if (remaining <= 0) { this.deps.clearInterval(this.countdownTimer!); this.countdownTimer = null; try { begin(); } catch (error) { this.fail(error); } }
      }, 1000);
    } catch (error) { this.fail(error); }
  }
  setMicEnabled(enabled: boolean) { this.mic?.getAudioTracks().forEach(track => { track.enabled = enabled; }); }
  pause() { if (this.recorder?.state === "recording") { this.recorder.pause(); this.clock.pause(); this.options.onElapsed?.(this.clock.seconds()); this.options.onState?.("paused"); } }
  resume() { if (this.recorder?.state === "paused") { this.recorder.resume(); this.clock.resume(); this.options.onState?.("recording"); } }
  stop() {
    this.clock.pause();
    if (this.recorder && this.recorder.state !== "inactive") { this.recorder.stop(); }
    else { this.cancel(); }
  }
  cancel() { this.cancelled = true; this.cleanup(); this.options.onState?.("idle"); }
  /** Unmount stops active recording (onstop still persists result); countdown only cancels. */
  dispose() { if (this.recorder?.state !== "inactive" && this.recorder) this.stop(); else this.cancel(); }
  private finish() {
    if (this.finalized) return; this.finalized = true; this.clock.pause();
    const mimeType = this.recorder?.mimeType || this.chunks[0]?.type || (this.options.mode === "audio" ? "audio/webm" : "video/webm");
    const blob = new Blob(this.chunks, { type: mimeType }); this.cleanup();
    this.options.onState?.("stopped");
    if (blob.size) this.options.onResult({ id: this.deps.id(), blob, mimeType, duration: this.clock.seconds(), width: this.width, height: this.height, frameRate: this.fps });
    else this.options.onError?.(new Error("Recording produced no media bytes."));
  }
  private fail(error: unknown) { this.cleanup(); this.options.onState?.("idle"); if (!this.cancelled) this.options.onError?.(error instanceof Error ? error : new Error(String(error))); }
  private cleanup() {
    for (const timer of [this.countdownTimer, this.drawTimer, this.clockTimer]) if (timer !== null) this.deps.clearInterval(timer);
    this.countdownTimer = this.drawTimer = this.clockTimer = null;
    for (const { track, listener } of this.endListeners) track.removeEventListener("ended", listener); this.endListeners = [];
    this.streams.forEach(stream => stream.getTracks().forEach(track => track.stop())); this.streams = [];
    this.videos.forEach(video => { video.pause(); video.srcObject = null; }); this.videos = [];
    this.options.onAnalyser?.(null); this.nodes.forEach(node => node.disconnect()); this.nodes = [];
    if (this.audio) { void this.audio.close().catch(() => {}); this.audio = null; }
  }
}
