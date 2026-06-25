/**
 * CustomVideoPlayer — Thinkific/Wistia-style HTML5 video player
 *
 * Design:
 *  - Full-width, full-height container (caller sets dimensions)
 *  - Big centered play button overlay when paused
 *  - Solid-color controls bar at the bottom (playerColor prop)
 *  - White icons throughout
 *  - Progress bar: track = darkened playerColor, fill = white, scrubber = white circle
 *  - Auto-hide controls after 3s of inactivity while playing
 *  - Settings menu: playback speed
 *  - Volume slider on hover/click
 *  - Keyboard shortcuts: Space=play/pause, ←/→=seek 10s, ↑/↓=volume, M=mute, F=fullscreen
 *  - onEnded callback for lesson completion tracking
 */

import { useCallback, useEffect, useRef, useState } from "react";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Darken a hex color by a fraction (0–1) */
function darkenHex(hex: string, amount: number): string {
  const c = hex.replace("#", "");
  const r = Math.max(0, parseInt(c.substring(0, 2), 16) - Math.round(255 * amount));
  const g = Math.max(0, parseInt(c.substring(2, 4), 16) - Math.round(255 * amount));
  const b = Math.max(0, parseInt(c.substring(4, 6), 16) - Math.round(255 * amount));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" fill="white" width="18" height="18">
    <polygon points="5,3 19,12 5,21" />
  </svg>
);

const PauseIcon = () => (
  <svg viewBox="0 0 24 24" fill="white" width="18" height="18">
    <rect x="5" y="3" width="4" height="18" rx="1" />
    <rect x="15" y="3" width="4" height="18" rx="1" />
  </svg>
);

const VolumeHighIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </svg>
);

const VolumeMuteIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <line x1="23" y1="9" x2="17" y2="15" />
    <line x1="17" y1="9" x2="23" y2="15" />
  </svg>
);

const VolumeLowIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
  </svg>
);

const SettingsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const FullscreenIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
  </svg>
);

const ExitFullscreenIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
  </svg>
);

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CustomVideoPlayerProps {
  /** Direct video URL (.mp4, .webm, .mov, etc.) */
  src: string;
  /** Controls bar background color (default: #00b4b4) */
  playerColor?: string;
  /** Poster image shown before play */
  poster?: string;
  /** Auto-play on mount */
  autoPlay?: boolean;
  /** Start muted */
  muted?: boolean;
  /** Loop the video */
  loop?: boolean;
  /** Called when video ends */
  onEnded?: () => void;
  /** Called with current time periodically (every ~5s) */
  onProgress?: (currentTime: number, duration: number) => void;
  /** Resume from this time (seconds) */
  startTime?: number;
  /** Additional className on the wrapper */
  className?: string;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

// ── Component ─────────────────────────────────────────────────────────────────

export function CustomVideoPlayer({
  src,
  playerColor = "#00b4b4",
  poster,
  autoPlay = false,
  muted: initialMuted = false,
  loop = false,
  onEnded,
  onProgress,
  startTime = 0,
  className = "",
}: CustomVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(initialMuted);
  const [speed, setSpeed] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const [seeking, setSeeking] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const trackColor = darkenHex(playerColor, 0.15);

  // ── Playback control ──────────────────────────────────────────────────────

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, []);

  // ── Controls visibility ───────────────────────────────────────────────────

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (videoRef.current && !videoRef.current.paused) {
      hideTimerRef.current = setTimeout(() => {
        if (!showSettings && !showVolume) setShowControls(false);
      }, 3000);
    }
  }, [showSettings, showVolume]);

  // ── Progress bar seeking ──────────────────────────────────────────────────

  const seekTo = useCallback((clientX: number) => {
    const bar = progressRef.current;
    const v = videoRef.current;
    if (!bar || !v || !duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    v.currentTime = ratio * duration;
    setCurrentTime(ratio * duration);
  }, [duration]);

  const handleProgressMouseDown = useCallback((e: React.MouseEvent) => {
    setSeeking(true);
    seekTo(e.clientX);
  }, [seekTo]);

  useEffect(() => {
    if (!seeking) return;
    const onMove = (e: MouseEvent) => seekTo(e.clientX);
    const onUp = () => setSeeking(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [seeking, seekTo]);

  // ── Volume ────────────────────────────────────────────────────────────────

  const handleVolumeChange = useCallback((val: number) => {
    const v = videoRef.current;
    if (!v) return;
    const clamped = Math.max(0, Math.min(1, val));
    v.volume = clamped;
    v.muted = clamped === 0;
    setVolume(clamped);
    setMuted(clamped === 0);
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (!v.muted && v.volume === 0) {
      v.volume = 0.5;
      setVolume(0.5);
    }
  }, []);

  // ── Speed ─────────────────────────────────────────────────────────────────

  const setPlaybackSpeed = useCallback((s: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = s;
    setSpeed(s);
    setShowSettings(false);
  }, []);

  // ── Fullscreen ────────────────────────────────────────────────────────────

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const v = videoRef.current;
      if (!v) return;
      // Don't intercept when typing in inputs
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) return;
      // Only intercept when our player is in the DOM
      if (!containerRef.current?.contains(document.activeElement) && document.activeElement !== document.body) return;
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          v.currentTime = Math.max(0, v.currentTime - 10);
          break;
        case "ArrowRight":
          e.preventDefault();
          v.currentTime = Math.min(v.duration || 0, v.currentTime + 10);
          break;
        case "ArrowUp":
          e.preventDefault();
          handleVolumeChange(volume + 0.1);
          break;
        case "ArrowDown":
          e.preventDefault();
          handleVolumeChange(volume - 0.1);
          break;
        case "m":
        case "M":
          toggleMute();
          break;
        case "f":
        case "F":
          toggleFullscreen();
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [togglePlay, handleVolumeChange, toggleMute, toggleFullscreen, volume]);

  // ── Video event listeners ─────────────────────────────────────────────────

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onPlay = () => { setPlaying(true); setHasStarted(true); resetHideTimer(); };
    const onPause = () => { setPlaying(false); setShowControls(true); if (hideTimerRef.current) clearTimeout(hideTimerRef.current); };
    const onTimeUpdate = () => {
      setCurrentTime(v.currentTime);
      // Update buffered
      if (v.buffered.length > 0) setBuffered(v.buffered.end(v.buffered.length - 1));
      // Progress callback every ~5s
      if (onProgress && Math.floor(v.currentTime) % 5 === 0) onProgress(v.currentTime, v.duration);
    };
    const onDurationChange = () => setDuration(v.duration || 0);
    const onVolumeChange = () => { setVolume(v.volume); setMuted(v.muted); };
    const onEnded_ = () => { setPlaying(false); setShowControls(true); onEnded?.(); };
    const onLoadedMetadata = () => {
      setDuration(v.duration || 0);
      if (startTime > 0) v.currentTime = startTime;
    };

    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("timeupdate", onTimeUpdate);
    v.addEventListener("durationchange", onDurationChange);
    v.addEventListener("volumechange", onVolumeChange);
    v.addEventListener("ended", onEnded_);
    v.addEventListener("loadedmetadata", onLoadedMetadata);

    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("timeupdate", onTimeUpdate);
      v.removeEventListener("durationchange", onDurationChange);
      v.removeEventListener("volumechange", onVolumeChange);
      v.removeEventListener("ended", onEnded_);
      v.removeEventListener("loadedmetadata", onLoadedMetadata);
    };
  }, [onEnded, onProgress, resetHideTimer, startTime]);

  // ── Derived values ────────────────────────────────────────────────────────

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;

  const VolumeIcon = muted || volume === 0 ? VolumeMuteIcon : volume < 0.5 ? VolumeLowIcon : VolumeHighIcon;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full bg-black overflow-hidden select-none outline-none ${className}`}
      tabIndex={0}
      onMouseMove={resetHideTimer}
      onMouseLeave={() => { if (playing && !showSettings && !showVolume) setShowControls(false); }}
      onClick={(e) => {
        // Click on the video area (not controls) toggles play
        if ((e.target as HTMLElement).closest("[data-controls]")) return;
        togglePlay();
        resetHideTimer();
      }}
    >
      {/* ── Video element ── */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        autoPlay={autoPlay}
        muted={muted}
        loop={loop}
        playsInline
        className="w-full h-full object-contain"
        style={{ display: "block" }}
        preload="metadata"
      />

      {/* ── Big centered play button overlay (shown when paused) ── */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-200"
        style={{ opacity: playing ? 0 : 1 }}
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center shadow-2xl pointer-events-auto cursor-pointer transition-transform duration-150 hover:scale-110 active:scale-95"
          style={{ backgroundColor: "rgba(0,0,0,0.55)", border: `3px solid ${playerColor}` }}
          onClick={(e) => { e.stopPropagation(); togglePlay(); }}
        >
          <svg viewBox="0 0 24 24" fill={playerColor} width="28" height="28" style={{ marginLeft: 4 }}>
            <polygon points="5,3 19,12 5,21" />
          </svg>
        </div>
      </div>

      {/* ── Controls bar ── */}
      <div
        data-controls
        className="absolute bottom-0 left-0 right-0 transition-opacity duration-300"
        style={{
          opacity: showControls ? 1 : 0,
          pointerEvents: showControls ? "auto" : "none",
          backgroundColor: playerColor,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bar */}
        <div
          ref={progressRef}
          className="relative h-1 cursor-pointer group"
          style={{ backgroundColor: trackColor }}
          onMouseDown={handleProgressMouseDown}
        >
          {/* Buffered */}
          <div
            className="absolute top-0 left-0 h-full pointer-events-none"
            style={{ width: `${bufferedPct}%`, backgroundColor: "rgba(255,255,255,0.3)" }}
          />
          {/* Played */}
          <div
            className="absolute top-0 left-0 h-full pointer-events-none"
            style={{ width: `${progressPct}%`, backgroundColor: "white" }}
          />
          {/* Scrubber handle */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow pointer-events-none transition-transform group-hover:scale-125"
            style={{ left: `${progressPct}%`, transform: `translateX(-50%) translateY(-50%)` }}
          />
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-2 px-3 h-10">
          {/* Play/Pause */}
          <button
            className="flex items-center justify-center w-7 h-7 rounded hover:bg-white/20 transition-colors flex-shrink-0"
            onClick={togglePlay}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>

          {/* Time */}
          <span className="text-white text-xs font-mono tabular-nums flex-shrink-0 min-w-[80px]">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Volume */}
          <div
            className="relative flex items-center gap-1"
            onMouseEnter={() => setShowVolume(true)}
            onMouseLeave={() => setShowVolume(false)}
          >
            {showVolume && (
              <div className="absolute bottom-full right-0 mb-2 flex flex-col items-center gap-1 p-2 rounded"
                style={{ backgroundColor: playerColor }}>
                <span className="text-white text-[10px] font-mono">{Math.round(volume * 100)}%</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={muted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="h-20 cursor-pointer"
                  style={{
                    writingMode: "vertical-lr",
                    direction: "rtl",
                    appearance: "slider-vertical" as any,
                    WebkitAppearance: "slider-vertical",
                    accentColor: "white",
                  }}
                />
              </div>
            )}
            <button
              className="flex items-center justify-center w-7 h-7 rounded hover:bg-white/20 transition-colors flex-shrink-0"
              onClick={toggleMute}
              aria-label={muted ? "Unmute" : "Mute"}
            >
              <VolumeIcon />
            </button>
          </div>

          {/* Settings (speed) */}
          <div className="relative">
            {showSettings && (
              <div
                className="absolute bottom-full right-0 mb-2 rounded overflow-hidden shadow-lg z-50"
                style={{ backgroundColor: playerColor }}
              >
                <div className="px-3 py-1.5 text-white text-[10px] font-semibold uppercase tracking-wide border-b border-white/20">
                  Speed
                </div>
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setPlaybackSpeed(s)}
                    className="block w-full text-left px-4 py-1.5 text-white text-xs hover:bg-white/20 transition-colors"
                    style={{ fontWeight: s === speed ? 700 : 400 }}
                  >
                    {s === 1 ? "Normal" : `${s}×`}
                    {s === speed && <span className="ml-2">✓</span>}
                  </button>
                ))}
              </div>
            )}
            <button
              className="flex items-center justify-center w-7 h-7 rounded hover:bg-white/20 transition-colors flex-shrink-0"
              onClick={() => { setShowSettings((p) => !p); setShowVolume(false); }}
              aria-label="Settings"
            >
              <SettingsIcon />
            </button>
          </div>

          {/* Fullscreen */}
          <button
            className="flex items-center justify-center w-7 h-7 rounded hover:bg-white/20 transition-colors flex-shrink-0"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {fullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CustomVideoPlayer;
