const MAIN_APP_PATH = /^\/(?:studio(?:-pro)?|creator(?:-pro)?|quiz-creator(?:-app|-pro)?|media-library)(?:\/|$)/;
/** Navigation only: never selects a school, creates a grant, or proves payment. */
export function getCourse360MainAppReturnUrl(returnPath: string, currentOrigin: string): string | null {
  if (!returnPath.startsWith("/") || returnPath.startsWith("//") || /\\|%5c|%2f|[\u0000-\u001f]/i.test(returnPath)) return null;
  try {
    const destination = new URL(returnPath, "https://course360.app");
    if (destination.origin !== "https://course360.app" || !MAIN_APP_PATH.test(destination.pathname)) return null;
    const current = new URL(currentOrigin);
    const local = current.hostname === "localhost" || current.hostname === "127.0.0.1";
    const preview = /\.(?:manus\.computer|manus\.space)$/.test(current.hostname);
    const main = current.hostname === "course360.app" || current.hostname === "www.course360.app";
    const preserveOrigin = (local && ["http:", "https:"].includes(current.protocol)) || ((main || preview) && current.protocol === "https:");
    const origin = preserveOrigin ? current.origin : "https://course360.app";
    return `${origin}${destination.pathname}${destination.search}${destination.hash}`;
  } catch { return null; }
}
