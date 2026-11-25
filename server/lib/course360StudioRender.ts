import { TRPCError } from "@trpc/server";
import { spawn } from "node:child_process";
import { mkdtemp, rm, stat, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { downloadStudioSource, STUDIO_INPUT_BYTES, STUDIO_OUTPUT_BYTES } from "./course360StudioStorage";
import { parseStudioTranscript, studioRetainedRanges, remapStudioTranscript, serializeStudioAss, type StudioTranscript } from "./course360StudioTimeline";

export const STUDIO_DEADLINE_MS = 150_000;
export const STUDIO_MAX_DURATION_SEC = 120;
let active = false;
export async function withStudioProcessing<T>(work: (signal: AbortSignal) => Promise<T>) {
  if (active) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Studio processing is busy on this instance. Retry shortly." });
  if (process.memoryUsage().rss > 256 * 1024 * 1024) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This instance has insufficient memory for Studio processing. Retry on a fresh instance." });
  active = true;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STUDIO_DEADLINE_MS);
  try { return await work(controller.signal); }
  finally { clearTimeout(timer); active = false; }
}

/** No shell, no remote protocols, one thread, hard process/output/deadline limits. */
export async function runStudioProcess(binary: "ffmpeg" | "ffprobe", args: string[], signal: AbortSignal, cwd?: string) {
  signal.throwIfAborted();
  return await new Promise<string>((resolve, reject) => {
    // Shared libraries reserve virtual address space; RSS, not the virtual cap,
    // is the deployment memory budget. The watchdog bounds actual resident use.
    const child = spawn("prlimit", ["--as=1073741824", "--data=268435456", "--stack=1048576", "--cpu=110", `--fsize=${STUDIO_OUTPUT_BYTES}`, "--nofile=64", "--", binary, "-cpucount", "1", ...args], {
      cwd, stdio: ["ignore", "pipe", "pipe"], signal, env: { PATH: process.env.PATH, LANG: "C.UTF-8", HOME: cwd ?? tmpdir(), OPENBLAS_NUM_THREADS: "1", OMP_NUM_THREADS: "1" },
    });
    let stdout = "", stderr = "", overflow = false;
    child.stdout.on("data", chunk => { stdout += chunk; if (Buffer.byteLength(stdout) > 128_000) { overflow = true; child.kill("SIGKILL"); } });
    child.stderr.on("data", chunk => { stderr = (stderr + chunk).slice(-4000); });
    const memoryTimer = setInterval(async () => {
      if (!child.pid) return;
      try {
        const status = await readFile(`/proc/${child.pid}/status`, "utf8");
        const rssKiB = Number(status.match(/^VmRSS:\s+(\d+)/m)?.[1] ?? 0);
        if (rssKiB > 160 * 1024 || process.memoryUsage().rss + rssKiB * 1024 > 440 * 1024 * 1024) child.kill("SIGKILL");
      } catch { /* Process may already have exited. */ }
    }, 50);
    const timer = setTimeout(() => child.kill("SIGKILL"), binary === "ffprobe" ? 10_000 : 110_000);
    const abort = () => child.kill("SIGKILL");
    signal.addEventListener("abort", abort, { once: true });
    child.once("error", () => { /* close follows spawn/abort errors */ });
    child.once("close", code => {
      clearTimeout(timer); clearInterval(memoryTimer); signal.removeEventListener("abort", abort);
      if (code === 0 && !overflow && !signal.aborted) resolve(stdout);
      else reject(new TRPCError({ code: signal.aborted ? "TIMEOUT" : "PRECONDITION_FAILED", message: `${binary} processing failed or exceeded the bounded runtime. Verify ffmpeg/ffprobe, prlimit, H.264/AAC and libass/fonts are installed, or use a shorter supported source.` }));
      // Do not expose paths, source URLs, caption content or process diagnostics.
      void stderr;
    });
  });
}
export type StudioProbe = { duration: number; width: number; height: number; fps: number; hasAudio: boolean; videoCodec?: string; audioCodec?: string; format: string };
export async function probeStudioFile(path: string, signal: AbortSignal): Promise<StudioProbe> {
  const raw = await runStudioProcess("ffprobe", ["-v", "error", "-protocol_whitelist", "file,pipe", "-format_whitelist", "mov,matroska,webm,mp3,wav,ogg,flac", "-threads", "1", "-show_format", "-show_streams", "-of", "json", path], signal);
  const data = JSON.parse(raw);
  const video = data.streams?.find((s: any) => s.codec_type === "video");
  const audio = data.streams?.find((s: any) => s.codec_type === "audio");
  const duration = Number(data.format?.duration);
  const ratio = String(video?.avg_frame_rate ?? "0/1").split("/").map(Number);
  const fps = ratio[1] ? ratio[0] / ratio[1] : 0;
  if (!Number.isFinite(duration) || duration <= 0) throw new TRPCError({ code: "BAD_REQUEST", message: "The source has no finite trusted duration." });
  return { duration, width: Number(video?.width ?? 0), height: Number(video?.height ?? 0), fps, hasAudio: !!audio, videoCodec: video?.codec_name, audioCodec: audio?.codec_name, format: String(data.format?.format_name ?? "") };
}

export async function withStudioSource<T>(fileKey: string, signal: AbortSignal, work: (source: string, probe: StudioProbe, directory: string) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "course360-studio-"));
  try {
    const source = join(directory, "source.media");
    await downloadStudioSource(fileKey, source, signal);
    const probe = await probeStudioFile(source, signal);
    return await work(source, probe, directory);
  } finally { await rm(directory, { recursive: true, force: true }); }
}

/** Exposed for real local byte acceptance tests; production paths always use withStudioSource. */
export async function renderStudioLocal(source: string, directory: string, transcript: StudioTranscript, options: { startSec?: number; endSec?: number; burnCaptions?: boolean; watermark?: boolean }, signal: AbortSignal) {
  if ((await stat(source)).size > STUDIO_INPUT_BYTES) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Studio source exceeds 8 MiB." });
  const probe = await probeStudioFile(source, signal);
  if (!probe.width || !probe.height || probe.width > 1920 || probe.height > 1080 || !Number.isFinite(probe.fps) || probe.fps > 60) throw new TRPCError({ code: "BAD_REQUEST", message: "The bounded renderer supports video sources up to 1920×1080 and 60 fps. 4K processing needs a larger runtime." });
  const start = options.startSec ?? 0, end = options.endSec ?? probe.duration;
  if (end - start > STUDIO_MAX_DURATION_SEC) throw new TRPCError({ code: "BAD_REQUEST", message: "The bounded renderer exports at most 120 source seconds per request. Choose a shorter range." });
  const ranges = studioRetainedRanges(transcript, start, end, probe.duration);
  const remapped = remapStudioTranscript(transcript, ranges);
  const expected = ranges.reduce((sum, range) => sum + range.endSec - range.startSec, 0);
  if (expected < 0.1) throw new TRPCError({ code: "BAD_REQUEST", message: "The remaining export must contain at least 0.1 seconds of footage." });
  const width = Math.max(2, Math.floor(Math.min(1280 / probe.width, 720 / probe.height, 1) * probe.width / 2) * 2);
  const height = Math.max(2, Math.floor(width / probe.width * probe.height / 2) * 2);
  const filters: string[] = [];
  for (const [i, range] of ranges.entries()) {
    filters.push(`[0:v:0]trim=start=${range.startSec}:end=${range.endSec},setpts=PTS-STARTPTS,scale=${width}:${height},setsar=1[v${i}]`);
    if (probe.hasAudio) filters.push(`[0:a:0]atrim=start=${range.startSec}:end=${range.endSec},asetpts=PTS-STARTPTS[a${i}]`);
  }
  filters.push(`${ranges.map((_, i) => `[v${i}]${probe.hasAudio ? `[a${i}]` : ""}`).join("")}concat=n=${ranges.length}:v=1:a=${probe.hasAudio ? 1 : 0}[joined]${probe.hasAudio ? "[audio]" : ""}`);
  let outputVideo = "[joined]";
  if (options.burnCaptions) {
    if (!remapped.words.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Generate or save a timed transcript before burning captions." });
    await writeFile(join(directory, "captions.ass"), serializeStudioAss(remapped, width, height), { mode: 0o600 });
    filters.push("[joined]ass=filename=captions.ass[captioned]"); outputVideo = "[captioned]";
  }
  if (options.watermark) {
    const watermarkTranscript = { words: [], segments: [{ id: 0, start: 0, end: expected, text: "Course360 Studio • Trial" }],
      studioEdit: { captionStyle: { fontSize: 18, bgOpacity: .5, bold: true }, showCaptions: true } };
    await writeFile(join(directory, "watermark.ass"), serializeStudioAss(watermarkTranscript, width, height).replace(",2,20,20,20,1", ",9,20,20,20,1"), { mode: 0o600 });
    filters.push(`${outputVideo}ass=filename=watermark.ass[watermarked]`); outputVideo = "[watermarked]";
  }
  await writeFile(join(directory, "filters.txt"), filters.join(";\n"), { mode: 0o600 });
  const output = join(directory, "derivative.mp4");
  const args = ["-nostdin", "-v", "error", "-y", "-protocol_whitelist", "file,pipe", "-format_whitelist", "mov,matroska,webm", "-max_alloc", "33554432", "-threads", "1", "-filter_threads", "1", "-filter_complex_threads", "1", "-i", source,
    "-filter_complex_script", "filters.txt", "-map", outputVideo];
  if (probe.hasAudio) args.push("-map", "[audio]", "-c:a", "aac", "-b:a", "96k", "-ac", "2");
  args.push("-c:v", "libx264", "-threads", "1", "-preset", "ultrafast", "-crf", "24", "-pix_fmt", "yuv420p", "-r", "30", "-maxrate", "800k", "-bufsize", "1600k", "-movflags", "+faststart", "-map_metadata", "-1", "-fs", String(STUDIO_OUTPUT_BYTES), output);
  await runStudioProcess("ffmpeg", args, signal, directory);
  const result = await probeStudioFile(output, signal);
  const size = (await stat(output)).size;
  if (result.videoCodec !== "h264" || (probe.hasAudio && result.audioCodec !== "aac") || !result.format.includes("mp4") || Math.abs(result.duration - expected) > .15 || size <= 0 || size >= STUDIO_OUTPUT_BYTES) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The output did not pass duration/container/codec/size verification; no successful export was registered." });
  return { output, size, probe: result, transcript: remapped, sourceProbe: probe, ranges };
}

export async function extractStudioAudio(source: string, directory: string, signal: AbortSignal) {
  const probe = await probeStudioFile(source, signal);
  if (!probe.hasAudio || probe.duration > STUDIO_MAX_DURATION_SEC) throw new TRPCError({ code: "BAD_REQUEST", message: "Bounded transcription requires audio and at most 120 source seconds. Split longer recordings before retrying." });
  const output = join(directory, "speech.mp3");
  await runStudioProcess("ffmpeg", ["-nostdin", "-v", "error", "-protocol_whitelist", "file,pipe", "-format_whitelist", "mov,matroska,webm,mp3,wav,ogg,flac", "-threads", "1", "-i", source, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "libmp3lame", "-b:a", "32k", "-threads", "1", output], signal, directory);
  const bytes = await readFile(output);
  if (bytes.length > 1_048_576) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "The extracted speech exceeds the bounded provider limit." });
  return { bytes, duration: probe.duration };
}
