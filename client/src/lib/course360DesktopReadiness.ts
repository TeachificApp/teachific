/** Missing/invalid metadata never opens an empty tab; this is not artifact verification. */
export function course360DesktopDownloadUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
