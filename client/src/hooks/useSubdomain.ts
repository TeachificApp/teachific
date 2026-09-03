/**
 * useSubdomain
 *
 * Detects whether the app is running on an org-specific subdomain
 * (e.g. myorg.course360.app) and returns the subdomain slug.
 *
 * Returns null when running on the root domain (course360.app, www.course360.app,
 * localhost, Railway preview URLs, or any Manus preview URL).
 */

const ROOT_DOMAINS = new Set([
  "course360.app",
  "www.course360.app",
  "app.course360.app",
  "api.course360.app",
  "admin.course360.app",
  "localhost",
  "127.0.0.1",
]);

// Manus preview domains follow the pattern: *.manus.space or *.manus.computer
const MANUS_PREVIEW_PATTERN = /\.manus\.(space|computer)$/;

// Railway preview domains follow the pattern: *.up.railway.app
const RAILWAY_PREVIEW_PATTERN = /\.up\.railway\.app$/;

// Any domain that is NOT course360.app (or a subdomain of it) should be treated
// as a root domain — this covers Railway URLs, custom domains not yet mapped, etc.
function isCourse360Subdomain(hostname: string): boolean {
  // Must end with .course360.app and have something before it
  return hostname.endsWith(".course360.app") && hostname !== "course360.app" && hostname !== "www.course360.app";
}

export function getSubdomain(): string | null {
  const hostname = window.location.hostname;

  // Never treat root domains or Manus/Railway preview URLs as subdomains
  if (ROOT_DOMAINS.has(hostname)) return null;
  if (MANUS_PREVIEW_PATTERN.test(hostname)) return null;
  if (RAILWAY_PREVIEW_PATTERN.test(hostname)) return null;

  // Only treat as a subdomain if it's actually a subdomain of course360.app
  if (!isCourse360Subdomain(hostname)) return null;

  // Extract the subdomain part: "myorg" from "myorg.course360.app"
  const sub = hostname.replace(/\.course360\.app$/, "");

  // Exclude reserved platform subdomains that should never be treated as org slugs
  const RESERVED_SUBDOMAINS = new Set([
    "www", "learn", "app", "api", "admin", "mail", "status", "help",
    "cdn", "assets", "static", "media", "support", "docs",
  ]);
  if (RESERVED_SUBDOMAINS.has(sub)) return null;

  // Subdomain must be a simple slug (no dots)
  if (sub.includes(".")) return null;

  return sub;
}

export function useSubdomain(): string | null {
  // This is a pure synchronous read — no need for useState/useEffect
  return getSubdomain();
}

/**
 * Returns true if the current environment supports real subdomains
 * (i.e. we're on course360.app, not localhost or a preview URL).
 */
export function supportsSubdomains(): boolean {
  const hostname = window.location.hostname;
  return (
    hostname === "course360.app" ||
    hostname === "www.course360.app" ||
    isCourse360Subdomain(hostname)
  );
}

/**
 * Builds the full URL for an org's subdomain.
 * On course360.app: returns https://slug.course360.app/path
 * On localhost/preview: returns /school/slug/path (fallback, no real subdomain)
 */
export function getOrgSubdomainUrl(slug: string, path = ""): string {
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  const port = window.location.port;

  // On localhost, Manus preview, or Railway preview — use /school/:slug fallback
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    MANUS_PREVIEW_PATTERN.test(hostname) ||
    RAILWAY_PREVIEW_PATTERN.test(hostname)
  ) {
    const portSuffix = port ? `:${port}` : "";
    return `${protocol}//${hostname}${portSuffix}/school/${slug}${path}`;
  }

  // On root domain (course360.app or www.course360.app), build the subdomain URL
  return `${protocol}//${slug}.course360.app${path}`;
}

/**
 * Returns the correct absolute admin URL for a given path.
 * On Teachific, all admin paths stay relative (no subdomain routing needed).
 */
export function getAdminUrl(path: string): string {
  return path;
}

// Stub domain helpers for UA-specific domain checks (not applicable in Teachific)
export function isLearnDomain(): boolean { return false; }
export function isMembersDomain(): boolean { return false; }
export function isAccreditationDomain(): boolean { return false; }
export function isCombinedBrandingDomain(): boolean { return false; }
export function isMarketingStagingDomain(): boolean { return false; }
