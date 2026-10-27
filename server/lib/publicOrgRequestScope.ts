import { and, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { organizations } from "../../drizzle/schema";
import type * as schema from "../../drizzle/schema";

export type PublicOrgScope = {
  id: number;
  slug: string;
  source: "custom_domain" | "course360_subdomain" | "platform" | "legacy_hint";
};

type RequestLike = {
  headers?: Record<string, string | string[] | undefined>;
  hostname?: string;
};

// The Worker proxies Course360 organization subdomains to this hosted origin.
// A forwarded hostname is never browser authority: Cloudflare adds CF-Worker
// to Worker fetch() subrequests and identifies the zone that created them.
const COURSE360_WORKER_ORIGIN_HOST = "scormhost-fjxmsdmk.manus.space";
const COURSE360_WORKER_ZONE = "course360.app";

function firstHeaderValue(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  return raw.split(",")[0]?.trim() || null;
}

/** Normalize a configured domain or request host without allowing a path or port. */
export function normalizePublicHostname(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value.includes("://") ? value : `https://${value}`);
    return parsed.hostname.toLowerCase().replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

/**
 * Obtain the request hostname. Direct request hosts remain authoritative. The
 * Course360 Worker is the sole exception: when the hosted origin receives a
 * Cloudflare-identified Worker subrequest from this zone, its dedicated
 * original-host header is safe to use for public tenant resolution.
 */
export function getPublicRequestHostname(req: RequestLike | null | undefined): string | null {
  const directHostname = normalizePublicHostname(req?.hostname ?? firstHeaderValue(req?.headers?.host));
  const workerZone = normalizePublicHostname(firstHeaderValue(req?.headers?.["cf-worker"]));
  const workerOriginalHostname = normalizePublicHostname(firstHeaderValue(req?.headers?.["x-course360-original-host"]));

  if (
    directHostname === COURSE360_WORKER_ORIGIN_HOST
    && workerZone === COURSE360_WORKER_ZONE
    && workerOriginalHostname
    && isCourse360Subdomain(workerOriginalHostname)
  ) {
    return workerOriginalHostname;
  }

  return directHostname;
}

function isCourse360Subdomain(hostname: string): boolean {
  return hostname.endsWith(".course360.app") && hostname.split(".").length === 3;
}

function isPlatformHost(hostname: string | null): boolean {
  if (!hostname) return true;
  return [
    "course360.app",
    "www.course360.app",
    "teachific.app", // Compatibility deployment host; never use as a generated URL.
    "www.teachific.app",
    "localhost",
    "127.0.0.1",
  ].includes(hostname) || hostname.endsWith(".manus.computer") || hostname.endsWith(".manus.space");
}

/**
 * Resolve public LMS catalog scope from a verified custom learner domain or an
 * organization Course360 subdomain. A legacy orgSlug hint is honored only for
 * platform-host requests and is never allowed to override an organization host.
 */
export async function resolvePublicOrganizationScope(
  db: MySql2Database<typeof schema>,
  req: RequestLike | null | undefined,
  legacyOrgSlug?: string,
): Promise<PublicOrgScope | null> {
  const hostname = getPublicRequestHostname(req);

  if (hostname && isCourse360Subdomain(hostname)) {
    const slug = hostname.slice(0, -".course360.app".length);
    const [org] = await db.select({ id: organizations.id, slug: organizations.slug })
      .from(organizations)
      .where(and(eq(organizations.slug, slug), eq(organizations.isActive, true)))
      .limit(1);
    return org ? { ...org, source: "course360_subdomain" } : null;
  }

  if (hostname && !isPlatformHost(hostname)) {
    const candidates = [hostname, `https://${hostname}`];
    const [org] = await db.select({ id: organizations.id, slug: organizations.slug })
      .from(organizations)
      .where(and(
        eq(organizations.domainVerificationStatus, "verified"),
        eq(organizations.customDomain, candidates[0]),
        eq(organizations.isActive, true),
      ))
      .limit(1);
    if (org) return { ...org, source: "custom_domain" };

    // Older organization records may include an https:// prefix. This retains
    // verified custom-domain compatibility without treating a caller hint as
    // authority on a custom host.
    const [legacyOrg] = await db.select({ id: organizations.id, slug: organizations.slug })
      .from(organizations)
      .where(and(
        eq(organizations.domainVerificationStatus, "verified"),
        eq(organizations.customDomain, candidates[1]),
        eq(organizations.isActive, true),
      ))
      .limit(1);
    return legacyOrg ? { ...legacyOrg, source: "custom_domain" } : null;
  }

  if (legacyOrgSlug?.trim()) {
    const [org] = await db.select({ id: organizations.id, slug: organizations.slug })
      .from(organizations)
      .where(and(
        eq(organizations.slug, legacyOrgSlug.trim().toLowerCase()),
        eq(organizations.isActive, true),
      ))
      .limit(1);
    return org ? { ...org, source: "legacy_hint" } : null;
  }

  const [primary] = await db.select({ id: organizations.id, slug: organizations.slug })
    .from(organizations)
    .where(and(eq(organizations.isPrimary, true), eq(organizations.isActive, true)))
    .limit(1);
  return primary ? { ...primary, source: "platform" } : null;
}
