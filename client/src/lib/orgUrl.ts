/**
 * orgUrl.ts — Shared utilities for building org-specific URLs.
 *
 * All org content (forms, courses, shop, webinars, quizzes, custom pages)
 * must be served from the org's subdomain (e.g. https://allaboutultrasound.teachific.app/)
 * or custom domain, NOT from the root domain with the org slug in the path.
 *
 * This ensures custom domain / whitelabel support works correctly: if an org uses
 * their own domain, all their content URLs automatically resolve to that domain.
 */

const MANUS_PREVIEW_PATTERN = /\.manus\.(space|computer)$/;
const RAILWAY_PREVIEW_PATTERN = /\.up\.railway\.app$/;

/**
 * Org info type used by URL helpers.
 * Pass the org object from trpc.orgs.myOrgs or trpc.orgs.myContext.
 */
export interface OrgUrlInfo {
  slug: string;
  customDomain?: string | null;
  domainVerificationStatus?: string | null;
}

/**
 * Returns the base URL for an org's content.
 *
 * - On teachific.app (production): returns `https://{slug}.teachific.app`
 *   or `https://{customDomain}` if the org has a verified custom domain.
 * - On localhost / Manus preview / Railway preview: returns a path-based
 *   fallback `/school/{slug}` so development still works.
 *
 * @param slug                   The org's subdomain slug (e.g. "allaboutultrasound")
 * @param customDomain           Optional custom domain (e.g. "courses.example.com")
 * @param domainVerificationStatus  Optional verification status; only "verified" domains are used
 */
export function getOrgBaseUrl(
  slug: string,
  customDomain?: string | null,
  domainVerificationStatus?: string | null
): string {
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  const port = window.location.port;

  // On localhost or preview environments, use path-based fallback
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    MANUS_PREVIEW_PATTERN.test(hostname) ||
    RAILWAY_PREVIEW_PATTERN.test(hostname)
  ) {
    const portSuffix = port ? `:${port}` : "";
    return `${protocol}//${hostname}${portSuffix}/school/${slug}`;
  }

  // If the org has a verified custom domain, use it
  if (customDomain && domainVerificationStatus === "verified") {
    // Ensure the custom domain has a protocol
    if (customDomain.startsWith("http://") || customDomain.startsWith("https://")) {
      return customDomain.replace(/\/$/, "");
    }
    return `https://${customDomain}`;
  }

  // On production teachific.app, use subdomain format
  return `${protocol}//${slug}.teachific.app`;
}

/**
 * Convenience overload that accepts an OrgUrlInfo object.
 */
export function getOrgBaseUrlFromOrg(org: OrgUrlInfo): string {
  return getOrgBaseUrl(org.slug, org.customDomain, org.domainVerificationStatus);
}

/**
 * Returns the full URL for a form on an org's subdomain.
 * Forms are served at `{orgBaseUrl}/forms/{formSlug}`.
 */
export function getOrgFormUrl(
  slug: string,
  formSlug: string,
  customDomain?: string | null,
  domainVerificationStatus?: string | null
): string {
  return `${getOrgBaseUrl(slug, customDomain, domainVerificationStatus)}/forms/${formSlug}`;
}

/**
 * Returns the full URL for a course sales page on an org's subdomain.
 * Courses are served at `{orgBaseUrl}/courses/{courseId}`.
 */
export function getOrgCourseUrl(
  slug: string,
  courseId: number | string,
  customDomain?: string | null,
  domainVerificationStatus?: string | null
): string {
  return `${getOrgBaseUrl(slug, customDomain, domainVerificationStatus)}/courses/${courseId}`;
}

/**
 * Returns the full URL for the course player (learn) on an org's subdomain.
 * Course player is served at `{orgBaseUrl}/learn/{courseId}`.
 */
export function getOrgCoursePlayerUrl(
  slug: string,
  courseId: number | string,
  customDomain?: string | null,
  domainVerificationStatus?: string | null
): string {
  return `${getOrgBaseUrl(slug, customDomain, domainVerificationStatus)}/learn/${courseId}`;
}

/**
 * Returns the full URL for a digital product (shop) on an org's subdomain.
 * Shop pages are served at `{orgBaseUrl}/shop/{productSlug}`.
 */
export function getOrgShopUrl(
  slug: string,
  productSlug: string,
  customDomain?: string | null,
  domainVerificationStatus?: string | null
): string {
  return `${getOrgBaseUrl(slug, customDomain, domainVerificationStatus)}/shop/${productSlug}`;
}

/**
 * Returns the full URL for a webinar registration page on an org's subdomain.
 * Webinars are served at `{orgBaseUrl}/webinar/{webinarSlug}/register`.
 */
export function getOrgWebinarUrl(
  slug: string,
  webinarSlug: string,
  customDomain?: string | null,
  domainVerificationStatus?: string | null
): string {
  return `${getOrgBaseUrl(slug, customDomain, domainVerificationStatus)}/webinar/${webinarSlug}/register`;
}

/**
 * Returns the full URL for a webinar watch page on an org's subdomain.
 */
export function getOrgWebinarWatchUrl(
  slug: string,
  webinarSlug: string,
  customDomain?: string | null,
  domainVerificationStatus?: string | null
): string {
  return `${getOrgBaseUrl(slug, customDomain, domainVerificationStatus)}/webinar/${webinarSlug}/watch`;
}

/**
 * Returns the full URL for a published quiz on an org's subdomain.
 * Quizzes are served at `{orgBaseUrl}/quiz/{shareToken}`.
 */
export function getOrgQuizUrl(
  slug: string,
  shareToken: string,
  customDomain?: string | null,
  domainVerificationStatus?: string | null
): string {
  return `${getOrgBaseUrl(slug, customDomain, domainVerificationStatus)}/quiz/${shareToken}`;
}

/**
 * Returns the full URL for a custom page on an org's subdomain.
 * Custom pages are served at `{orgBaseUrl}/p/{pageSlug}`.
 */
export function getOrgCustomPageUrl(
  slug: string,
  pageSlug: string,
  customDomain?: string | null,
  domainVerificationStatus?: string | null
): string {
  return `${getOrgBaseUrl(slug, customDomain, domainVerificationStatus)}/p/${pageSlug}`;
}

/**
 * Returns the full URL for a course thank-you page on an org's subdomain.
 * Thank-you pages are served at `{orgBaseUrl}/courses/{courseId}/thank-you`.
 */
export function getOrgThankYouUrl(
  slug: string,
  courseId: number | string,
  customDomain?: string | null,
  domainVerificationStatus?: string | null
): string {
  return `${getOrgBaseUrl(slug, customDomain, domainVerificationStatus)}/courses/${courseId}/thank-you`;
}

/**
 * Returns true if the current page is already on the given org's subdomain.
 * Used to decide whether to use relative paths or full subdomain URLs.
 */
export function isOnOrgSubdomain(slug: string): boolean {
  const hostname = window.location.hostname;
  return (
    hostname === `${slug}.teachific.app` ||
    // Also true if we're on the fallback /school/:slug path on localhost
    (
      (hostname === "localhost" || hostname === "127.0.0.1") &&
      window.location.pathname.startsWith(`/school/${slug}`)
    )
  );
}
