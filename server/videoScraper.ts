/**
 * Video scraper — extracts and downloads videos from arbitrary web page URLs.
 * Pure Node.js implementation (no yt-dlp, ffmpeg, or python required).
 *
 * Strategy order:
 *   1. Direct video URL — if the URL itself points to a video file, download it.
 *   2. YouTube — uses @distube/ytdl-core (pure JS) for YouTube/YouTube Shorts.
 *   3. HTML meta-tag fallback — parses og:video, og:video:url, twitter:player:stream,
 *      and <video>/<source> tags for direct .mp4 links.
 *
 * The caller receives a local temp file path + metadata; it's responsible for uploading
 * to S3 and cleaning up the temp file.
 */

import fs from "fs";
import path from "path";
import os from "os";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { nanoid } from "nanoid";
import ytdl from "@distube/ytdl-core";

export interface ScrapedVideo {
  filePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  durationSeconds: number | null;
  title: string;
  sourceUrl: string;
}

// ── YouTube strategy ────────────────────────────────────────────────────────

function isYouTubeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    return (
      host === "youtube.com" ||
      host === "youtu.be" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com"
    );
  } catch {
    return false;
  }
}

async function scrapeFromYouTube(url: string): Promise<ScrapedVideo> {
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "vid-import-"));

  try {
    // Get video info first
    const info = await ytdl.getInfo(url);
    const title = info.videoDetails.title || "YouTube Video";
    const duration = parseInt(info.videoDetails.lengthSeconds, 10) || null;

    // Choose best format: prefer mp4 with both audio+video, max 1080p
    const format = ytdl.chooseFormat(info.formats, {
      quality: "highest",
      filter: (f) => f.container === "mp4" && f.hasAudio && f.hasVideo,
    }) || ytdl.chooseFormat(info.formats, {
      quality: "highest",
      filter: "audioandvideo",
    });

    if (!format) {
      throw new Error("No suitable video format found for this YouTube video");
    }

    const ext = format.container === "webm" ? ".webm" : ".mp4";
    const safeTitle = title.replace(/[^a-zA-Z0-9 _-]/g, "").slice(0, 80).trim() || "video";
    const fileName = `${safeTitle}-${nanoid(6)}${ext}`;
    const filePath = path.join(tmpDir, fileName);

    // Download the video stream to a temp file
    const videoStream = ytdl.downloadFromInfo(info, { format });
    const writeStream = fs.createWriteStream(filePath);
    await pipeline(videoStream, writeStream);

    const stat = await fs.promises.stat(filePath);
    const mimeType = ext === ".webm" ? "video/webm" : "video/mp4";

    return {
      filePath,
      fileName,
      mimeType,
      fileSize: stat.size,
      durationSeconds: duration,
      title,
      sourceUrl: url,
    };
  } catch (err: any) {
    await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    throw new Error(`YouTube download failed: ${err.message}`);
  }
}

// ── Direct video download ───────────────────────────────────────────────────

async function downloadDirectVideo(videoUrl: string, sourceUrl: string): Promise<ScrapedVideo> {
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "vid-import-"));

  try {
    const res = await fetch(videoUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": sourceUrl,
      },
      redirect: "follow",
      signal: AbortSignal.timeout(5 * 60 * 1000), // 5 min timeout for large files
    });

    if (!res.ok) throw new Error(`Failed to download video: ${res.status} ${res.statusText}`);
    if (!res.body) throw new Error("No response body");

    const contentType = res.headers.get("content-type") || "video/mp4";
    const ext = contentType.includes("webm") ? ".webm" : contentType.includes("mov") ? ".mov" : ".mp4";
    const fileName = `imported-${nanoid(8)}${ext}`;
    const filePath = path.join(tmpDir, fileName);

    // Stream response body to file (avoids buffering entire file in RAM)
    const nodeStream = Readable.fromWeb(res.body as any);
    const writeStream = fs.createWriteStream(filePath);
    await pipeline(nodeStream, writeStream);

    const stat = await fs.promises.stat(filePath);

    // Extract a title from the page URL
    let title = "Imported Video";
    try {
      const parsed = new URL(sourceUrl);
      const pathParts = parsed.pathname.split("/").filter(Boolean);
      title = pathParts.length > 0
        ? decodeURIComponent(pathParts[pathParts.length - 1]).replace(/\.[^.]+$/, "").replace(/[-_]/g, " ")
        : parsed.hostname.replace(/^www\./, "");
    } catch { /* keep default */ }

    return {
      filePath,
      fileName,
      mimeType: contentType.split(";")[0].trim(),
      fileSize: stat.size,
      durationSeconds: null, // No ffprobe available; duration can be determined client-side
      title,
      sourceUrl,
    };
  } catch (err) {
    await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    throw err;
  }
}

// ── HTML meta-tag fallback ──────────────────────────────────────────────────

async function scrapeWithMetaTags(url: string): Promise<ScrapedVideo> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) throw new Error(`Failed to fetch page: ${res.status} ${res.statusText}`);
  const html = await res.text();

  // Extract video URLs from meta tags and video elements
  const videoUrls: string[] = [];

  // og:video, og:video:url, og:video:secure_url
  const ogVideoRe = /<meta\s+(?:property|name)=["']og:video(?::(?:secure_)?url)?["']\s+content=["']([^"']+)["']/gi;
  let match;
  while ((match = ogVideoRe.exec(html)) !== null) {
    if (match[1] && isVideoUrl(match[1])) videoUrls.push(match[1]);
  }

  // twitter:player:stream
  const twitterRe = /<meta\s+(?:property|name)=["']twitter:player:stream["']\s+content=["']([^"']+)["']/gi;
  while ((match = twitterRe.exec(html)) !== null) {
    if (match[1]) videoUrls.push(match[1]);
  }

  // <video src="..."> and <source src="...">
  const videoSrcRe = /<(?:video|source)\s[^>]*src=["']([^"']+)["']/gi;
  while ((match = videoSrcRe.exec(html)) !== null) {
    if (match[1] && isVideoUrl(match[1])) videoUrls.push(match[1]);
  }

  if (videoUrls.length === 0) {
    throw new Error(
      "No downloadable video found on this page. " +
      "This site may require authentication or use a format that isn't directly accessible. " +
      "Try a direct video URL (.mp4, .webm, .mov) instead."
    );
  }

  // Try downloading the first valid video URL
  const videoUrl = resolveUrl(videoUrls[0], url);
  return await downloadDirectVideo(videoUrl, url);
}

function isVideoUrl(url: string): boolean {
  const videoExtensions = /\.(mp4|webm|mov|avi|mkv|m4v|ogv|3gp)(\?|$)/i;
  return videoExtensions.test(url);
}

function resolveUrl(videoUrl: string, pageUrl: string): string {
  if (videoUrl.startsWith("http://") || videoUrl.startsWith("https://")) return videoUrl;
  if (videoUrl.startsWith("//")) return "https:" + videoUrl;
  try {
    return new URL(videoUrl, pageUrl).href;
  } catch {
    return videoUrl;
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function scrapeVideoFromUrl(url: string): Promise<ScrapedVideo> {
  // Validate URL
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("URL must use http or https");
    }
  } catch (err: any) {
    throw new Error(`Invalid URL: ${err.message}`);
  }

  // If the URL points directly to a video file, download it immediately
  if (isVideoUrl(url)) {
    console.log(`[videoScraper] Direct video URL detected, downloading: ${url}`);
    return await downloadDirectVideo(url, url);
  }

  // Try YouTube-specific handler
  if (isYouTubeUrl(url)) {
    try {
      console.log(`[videoScraper] YouTube URL detected, using ytdl-core: ${url}`);
      return await scrapeFromYouTube(url);
    } catch (err: any) {
      console.warn(`[videoScraper] YouTube download failed: ${err.message}`);
      // Don't fall through for YouTube — the error is specific enough
      throw err;
    }
  }

  // Fall back to HTML meta-tag scraping (works for pages with og:video, etc.)
  console.log(`[videoScraper] Trying HTML meta-tag scraping for: ${url}`);
  return await scrapeWithMetaTags(url);
}

/**
 * Clean up temp files after upload to S3 is complete.
 * The filePath's parent directory is the tmpDir created by mkdtemp.
 */
export async function cleanupScrapedVideo(filePath: string): Promise<void> {
  const dir = path.dirname(filePath);
  if (dir.includes("vid-import-")) {
    await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
