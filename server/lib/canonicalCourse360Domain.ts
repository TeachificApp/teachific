const LEGACY_PLATFORM_HOSTS = new Set([
  "teachific.app",
  "www.teachific.app",
  "app.teachific.app",
]);

const NON_CANONICAL_CURRENT_HOSTS = new Set(["www.course360.app"]);

const RESERVED_SUBDOMAINS = new Set([
  "www", "learn", "app", "api", "admin", "mail", "status", "help", "cdn",
  "assets", "static", "media", "support", "docs",
]);

function normalizeHostname(hostname: string | null | undefined): string | null {
  const normalized = hostname?.trim().toLowerCase().replace(/\.$/, "") ?? "";
  return normalized && /^[a-z0-9.-]+$/.test(normalized) ? normalized : null;
}

/**
 * Converts only retired Course360 platform hostnames to their canonical
 * course360.app equivalent. Verified organization custom domains never enter
 * this mapping, and malformed hosts fail closed.
 */
export function getCanonicalCourse360Url(
  hostname: string | null | undefined,
  pathAndQuery = "/",
): string | null {
  const normalizedHost = normalizeHostname(hostname);
  if (!normalizedHost) return null;
  const suffix = pathAndQuery.startsWith("/") ? pathAndQuery : `/${pathAndQuery}`;

  if (LEGACY_PLATFORM_HOSTS.has(normalizedHost) || NON_CANONICAL_CURRENT_HOSTS.has(normalizedHost)) {
    return `https://course360.app${suffix}`;
  }

  if (!normalizedHost.endsWith(".teachific.app")) return null;
  const subdomain = normalizedHost.slice(0, -".teachific.app".length);
  if (!subdomain || subdomain.includes(".") || RESERVED_SUBDOMAINS.has(subdomain)) {
    return `https://course360.app${suffix}`;
  }
  return `https://${subdomain}.course360.app${suffix}`;
}

/** Convert legacy checkout origins to their canonical Course360 origin. */
export function canonicalizeCourse360Origin(origin: string): string | null {
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:") return null;
    return getCanonicalCourse360Url(url.hostname, "/")?.replace(/\/$/, "") ?? null;
  } catch {
    return null;
  }
}
