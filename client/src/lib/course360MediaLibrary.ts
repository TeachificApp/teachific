export type Course360LibraryTab = "library" | "record-edit" | "quizzes" | "flashcards";

/**
 * Library management belongs to the main Course360 account. This URL carries
 * no org ID: persisted server context, not a navigation hint, owns the media.
 * Local/managed previews retain their same-origin library route for QA.
 */
export function getCourse360MediaLibraryHref(
  tab: Course360LibraryTab = "library",
  hostname = typeof window === "undefined" ? "course360.app" : window.location.hostname,
): string {
  const host = hostname.toLowerCase();
  const sameOrigin = host === "course360.app" || host === "www.course360.app" ||
    host === "localhost" || host === "127.0.0.1" || host === "[::1]" ||
    /\.manus\.(space|computer)$/.test(host) || /\.up\.railway\.app$/.test(host);
  const path = `/media-library#${tab}`;
  return sameOrigin ? path : `https://course360.app${path}`;
}

/** The shared table stores tags as JSON; old callers may already hold arrays. */
export function parseCourse360MediaTags(value: unknown): string[] {
  let tags = value;
  if (typeof tags === "string") {
    try { tags = JSON.parse(tags); } catch { return []; }
  }
  return Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === "string") : [];
}
