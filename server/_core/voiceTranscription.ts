/**
 * Voice transcription helper using OpenAI speech-to-text.
 *
 * Frontend implementation guide:
 * 1. Capture audio using MediaRecorder API
 * 2. Upload audio to storage (e.g., S3) to get URL
 * 3. Call transcription with the URL
 * 
 * Example usage:
 * ```tsx
 * // Frontend component
 * const transcribeMutation = trpc.voice.transcribe.useMutation({
 *   onSuccess: (data) => {
 *     console.log(data.text); // Full transcription
 *     console.log(data.language); // Detected language
 *     console.log(data.segments); // Timestamped segments
 *   }
 * });
 * 
 * // After uploading audio to storage
 * transcribeMutation.mutate({
 *   audioUrl: uploadedAudioUrl,
 *   language: 'en', // optional
 *   prompt: 'Transcribe the meeting' // optional
 * });
 * ```
 */
import { ENV } from "./env";
import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const execFileAsync = promisify(execFile);

/**
 * Try to extract audio from a video file using FFmpeg (optional — graceful fallback if unavailable).
 * Returns a Buffer of the extracted MP3 audio, or null if FFmpeg is unavailable or fails.
 */
async function tryExtractAudioFromVideo(videoBuffer: Buffer, inputMime: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    const ext = inputMime.includes("mp4") ? ".mp4" : inputMime.includes("webm") ? ".webm" : ".video";
    const tmpIn = path.join(os.tmpdir(), `transcribe-in-${Date.now()}${ext}`);
    const tmpOut = path.join(os.tmpdir(), `transcribe-out-${Date.now()}.mp3`);
    await fs.promises.writeFile(tmpIn, videoBuffer);
    await execFileAsync("ffmpeg", ["-y", "-i", tmpIn, "-vn", "-acodec", "libmp3lame", "-q:a", "4", tmpOut]);
    const audioBuffer = await fs.promises.readFile(tmpOut);
    await fs.promises.unlink(tmpIn).catch(() => {});
    await fs.promises.unlink(tmpOut).catch(() => {});
    return { buffer: audioBuffer, mimeType: "audio/mpeg" };
  } catch {
    // FFmpeg unavailable or failed — caller will fall back to direct submission
    return null;
  }
}

export type TranscribeOptions = {
  audioUrl: string; // URL to the audio file (e.g., S3 URL)
  language?: string; // Optional: specify language code (e.g., "en", "es", "zh")
  prompt?: string; // Optional: custom prompt for the transcription
  wordTimestamps?: boolean; // Optional: request word-level timestamps
};

// Word-level timestamp from Whisper API
export type WhisperWord = {
  word: string;
  start: number;
  end: number;
};

// Native Whisper API segment format
export type WhisperSegment = {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
};

// Native Whisper API response format
export type WhisperResponse = {
  task: "transcribe";
  language: string;
  duration: number;
  text: string;
  segments: WhisperSegment[];
  words?: WhisperWord[]; // Present when wordTimestamps option is used
};

export type TranscriptionResponse = WhisperResponse; // Return native Whisper API response directly

export type TranscriptionError = {
  error: string;
  code: "FILE_TOO_LARGE" | "INVALID_FORMAT" | "TRANSCRIPTION_FAILED" | "UPLOAD_FAILED" | "SERVICE_ERROR";
  details?: string;
};

/**
 * Normalize MIME type for Whisper API submission.
 * Whisper accepts: flac, m4a, mp3, mp4, mpeg, mpga, oga, ogg, wav, webm
 * Key fix: video/webm → audio/webm (same container, Whisper handles it fine)
 * Key fix: video/mp4 → audio/mp4 (same container, Whisper handles it fine)
 */
function normalizeAudioMime(mimeType: string): { mime: string; ext: string } {
  // Whisper-supported MIME types and their extensions
  const supported: Record<string, string> = {
    "audio/webm": "webm",
    "audio/mp4": "mp4",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/wave": "wav",
    "audio/ogg": "ogg",
    "audio/oga": "oga",
    "audio/flac": "flac",
    "audio/m4a": "m4a",
    "audio/mpga": "mpga",
  };

  // Direct match
  if (supported[mimeType]) {
    return { mime: mimeType, ext: supported[mimeType] };
  }

  // video/webm → audio/webm (webm container with audio track — Whisper supports this)
  if (mimeType === "video/webm") {
    return { mime: "audio/webm", ext: "webm" };
  }

  // video/mp4 → audio/mp4
  if (mimeType === "video/mp4" || mimeType === "video/mpeg") {
    return { mime: "audio/mp4", ext: "mp4" };
  }

  // Default fallback: treat as webm (most browser recordings are webm)
  return { mime: "audio/webm", ext: "webm" };
}

/**
 * Transcribe audio to text using the internal Speech-to-Text service
 * 
 * @param options - Audio data and metadata
 * @returns Transcription result or error
 */
export async function transcribeAudio(
  options: TranscribeOptions
): Promise<TranscriptionResponse | TranscriptionError> {
  try {
    if (!ENV.openAiApiKey) {
      return {
        error: "Voice transcription service authentication is missing",
        code: "SERVICE_ERROR",
        details: "OPENAI_API_KEY is not set"
      };
    }

    // Step 1: Download audio/video from URL
    let audioBuffer: Buffer;
    let mimeType: string;
    try {
      const response = await fetch(options.audioUrl);
      if (!response.ok) {
        return {
          error: "Failed to download audio file",
          code: "INVALID_FORMAT",
          details: `HTTP ${response.status}: ${response.statusText}`
        };
      }
      
      audioBuffer = Buffer.from(await response.arrayBuffer());
      // Normalize content-type: strip charset params
      const rawContentType = response.headers.get('content-type') || 'audio/webm';
      mimeType = rawContentType.split(';')[0].trim();
    } catch (error) {
      return {
        error: "Failed to fetch audio file",
        code: "SERVICE_ERROR",
        details: error instanceof Error ? error.message : "Unknown error"
      };
    }

    // Step 2: Prepare audio for Whisper API
    // Strategy:
    //   A) If FFmpeg is available AND file is large (>16MB): extract MP3 to reduce size
    //   B) If FFmpeg is available AND file is video: optionally extract for cleaner audio
    //   C) If FFmpeg is unavailable OR file is small: send directly with normalized MIME type
    //      (video/webm → audio/webm, video/mp4 → audio/mp4 — Whisper handles these fine)
    const sizeMB = audioBuffer.length / (1024 * 1024);
    const isVideo = mimeType.startsWith("video/");

    if (sizeMB > 16) {
      // File exceeds 16MB — try FFmpeg extraction to compress
      const extracted = await tryExtractAudioFromVideo(audioBuffer, mimeType);
      if (extracted) {
        audioBuffer = extracted.buffer;
        mimeType = extracted.mimeType;
        console.log(`[transcribeAudio] FFmpeg extracted audio: ${(audioBuffer.length / 1024 / 1024).toFixed(1)}MB MP3`);
      } else {
        // FFmpeg unavailable — try sending directly anyway (Whisper may handle it)
        console.warn(`[transcribeAudio] File is ${sizeMB.toFixed(1)}MB and FFmpeg unavailable — sending directly`);
      }
    } else if (isVideo) {
      // Video file under 16MB — try FFmpeg first for cleaner audio, but fall back gracefully
      const extracted = await tryExtractAudioFromVideo(audioBuffer, mimeType);
      if (extracted) {
        audioBuffer = extracted.buffer;
        mimeType = extracted.mimeType;
        console.log(`[transcribeAudio] FFmpeg extracted audio from video`);
      } else {
        // FFmpeg unavailable — normalize MIME type and send video container directly
        // Whisper supports webm and mp4 containers natively
        console.log(`[transcribeAudio] FFmpeg unavailable — sending ${mimeType} directly to Whisper`);
      }
    }

    // Step 3: Normalize MIME type for Whisper API compatibility
    const { mime: finalMime, ext: finalExt } = normalizeAudioMime(mimeType);
    const filename = `audio.${finalExt}`;

    console.log(`[transcribeAudio] Sending to Whisper: ${filename} (${finalMime}), size=${(audioBuffer.length / 1024 / 1024).toFixed(2)}MB`);

    // Step 4: Create FormData for multipart upload to Whisper API
    const formData = new FormData();
    const audioBlob = new Blob([new Uint8Array(audioBuffer)], { type: finalMime });
    formData.append("file", audioBlob, filename);
    formData.append("model", ENV.openAiTranscriptionModel);
    formData.append("response_format", "verbose_json");
    
    const prompt = options.prompt || (
      options.language 
        ? `Transcribe the user's voice to text, the user's working language is ${getLanguageName(options.language)}`
        : "Transcribe the user's voice to text"
    );
    formData.append("prompt", prompt);

    if (options.language) {
      formData.append("language", options.language);
    }
    if (options.wordTimestamps) {
      formData.append("timestamp_granularities[]", "word");
      formData.append("timestamp_granularities[]", "segment");
    }

    // Step 5: Call OpenAI transcription
    const fullUrl = "https://api.openai.com/v1/audio/transcriptions";

    const response = await fetch(fullUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${ENV.openAiApiKey}`,
        "Accept-Encoding": "identity",
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return {
        error: "Transcription service request failed",
        code: "TRANSCRIPTION_FAILED",
        details: `${response.status} ${response.statusText}${errorText ? `: ${errorText}` : ""}`
      };
    }

    // Step 6: Parse and return the transcription result
    const whisperResponse = await response.json() as WhisperResponse;
    
    if (!whisperResponse.text || typeof whisperResponse.text !== 'string') {
      return {
        error: "Invalid transcription response",
        code: "SERVICE_ERROR",
        details: "Transcription service returned an invalid response format"
      };
    }

    return whisperResponse;

  } catch (error) {
    return {
      error: "Voice transcription failed",
      code: "SERVICE_ERROR",
      details: error instanceof Error ? error.message : "An unexpected error occurred"
    };
  }
}

/**
 * Helper function to get full language name from ISO code
 */
function getLanguageName(langCode: string): string {
  const langMap: Record<string, string> = {
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'ja': 'Japanese',
    'ko': 'Korean',
    'zh': 'Chinese',
    'ar': 'Arabic',
    'hi': 'Hindi',
    'nl': 'Dutch',
    'pl': 'Polish',
    'tr': 'Turkish',
    'sv': 'Swedish',
    'da': 'Danish',
    'no': 'Norwegian',
    'fi': 'Finnish',
  };
  
  return langMap[langCode] || langCode;
}
