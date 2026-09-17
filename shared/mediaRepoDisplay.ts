/**
 * Resolve organization-authorized SCORM/HTML package display URLs. Interactive
 * packages always use the media repository's SCORM playback route rather than a
 * file download route.
 */
export const SCORM_PACKAGE_MEDIA_TYPES = new Set(["scorm", "zip", "lms"]);
const SCORM_ARCHIVE_EXTENSIONS = /\.(zip|quiz|scorm)$/i;

export function isInteractiveMediaPackage(
  mediaType?: string | null,
  fileName?: string | null,
): boolean {
  const type = (mediaType ?? "").toLowerCase();
  return SCORM_PACKAGE_MEDIA_TYPES.has(type) || SCORM_ARCHIVE_EXTENSIONS.test(fileName ?? "");
}

export function mediaRepoScormUrl(slug: string): string {
  return `/api/media/${encodeURIComponent(slug)}/scorm/`;
}

export function parseMediaRepoSlug(url: string): string | null {
  const pathOnly = url.split("?")[0] ?? url;
  const match = pathOnly.match(/\/(?:api\/)?media\/([^/]+)\/(?:embed|download|scorm|scorm-zip|scorm-launch)\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
}

export type LessonScormSource = {
  type?: string | null;
  embedUrl?: string | null;
  content?: string | null;
};

export type LinkedLessonMediaRef = {
  slug: string;
  mediaType?: string | null;
  fileName?: string | null;
} | null;

function isPlainDocumentAsset(mediaType?: string | null, fileName?: string | null): boolean {
  return mediaType === "document" && !!fileName && !isInteractiveMediaPackage(mediaType, fileName);
}

/**
 * Resolve a lesson's interactive package to the protected SCORM playback URL.
 * The caller retains course-based authorization through MediaEmbedIframe.
 */
export function resolveLessonMediaScormUrl(
  lesson: LessonScormSource,
  linked: LinkedLessonMediaRef,
): string | null {
  const slug = linked?.slug
    ?? (lesson.embedUrl ? parseMediaRepoSlug(lesson.embedUrl) : null)
    ?? (lesson.content ? parseMediaRepoSlug(lesson.content) : null);
  if (!slug) return null;

  if (linked && isInteractiveMediaPackage(linked.mediaType, linked.fileName)) {
    return mediaRepoScormUrl(slug);
  }
  if (lesson.type === "embed") return mediaRepoScormUrl(slug);
  if (lesson.embedUrl && (lesson.embedUrl.includes("/api/media/") || lesson.embedUrl.includes("/media/"))) {
    return mediaRepoScormUrl(slug);
  }
  if (lesson.content && parseMediaRepoSlug(lesson.content)) {
    if (linked?.slug === slug && !isPlainDocumentAsset(linked.mediaType, linked.fileName)) {
      return mediaRepoScormUrl(slug);
    }
    if (lesson.type === "download" && !isPlainDocumentAsset(linked?.mediaType, linked?.fileName)) {
      return mediaRepoScormUrl(slug);
    }
  }
  return null;
}
