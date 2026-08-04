/**
 * orgUrl.ts — Server-side org URL helpers
 *
 * Mirrors client/src/lib/orgUrl.ts so server code (emails, webhooks, etc.)
 * always builds URLs scoped to the org's own subdomain or custom domain
 * instead of hardcoding learn.teachific.com.
 */

/**
 * Returns the base URL for an org.
 * Priority:
 *  1. Verified custom domain
 *  2. {slug}.teachific.app
 */
export function getOrgBaseUrl(
  slug: string,
  customDomain?: string | null,
  domainVerificationStatus?: string | null,
): string {
  if (customDomain && domainVerificationStatus === "verified") {
    if (customDomain.startsWith("http://") || customDomain.startsWith("https://")) {
      return customDomain.replace(/\/$/, "");
    }
    return `https://${customDomain}`;
  }
  return `https://${slug}.teachific.app`;
}

/** Returns the full URL for a course page on the org's subdomain. */
export function getOrgCourseUrl(
  slug: string,
  courseSlug: string | number,
  customDomain?: string | null,
  domainVerificationStatus?: string | null,
): string {
  return `${getOrgBaseUrl(slug, customDomain, domainVerificationStatus)}/courses/${courseSlug}`;
}

/** Returns the full URL for the course player on the org's subdomain. */
export function getOrgCoursePlayerUrl(
  slug: string,
  courseSlug: string | number,
  customDomain?: string | null,
  domainVerificationStatus?: string | null,
): string {
  return `${getOrgBaseUrl(slug, customDomain, domainVerificationStatus)}/learn/${courseSlug}`;
}

/** Returns the full URL for the my-courses dashboard on the org's subdomain. */
export function getOrgMyCoursesUrl(
  slug: string,
  customDomain?: string | null,
  domainVerificationStatus?: string | null,
): string {
  return `${getOrgBaseUrl(slug, customDomain, domainVerificationStatus)}/my-courses`;
}

/** Returns the full URL for the my-downloads page on the org's subdomain. */
export function getOrgMyDownloadsUrl(
  slug: string,
  customDomain?: string | null,
  domainVerificationStatus?: string | null,
): string {
  return `${getOrgBaseUrl(slug, customDomain, domainVerificationStatus)}/my-downloads`;
}

/** Returns the full URL for a digital download on the org's subdomain. */
export function getOrgDownloadUrl(
  slug: string,
  productSlug: string,
  customDomain?: string | null,
  domainVerificationStatus?: string | null,
): string {
  return `${getOrgBaseUrl(slug, customDomain, domainVerificationStatus)}/downloads/${productSlug}/files`;
}

/** Returns the full URL for a bundle on the org's subdomain. */
export function getOrgBundleUrl(
  slug: string,
  bundleSlug: string,
  customDomain?: string | null,
  domainVerificationStatus?: string | null,
): string {
  return `${getOrgBaseUrl(slug, customDomain, domainVerificationStatus)}/downloads/bundle/${bundleSlug}`;
}

/** Returns the auth/access auto-login URL on the org's subdomain. */
export function buildOrgAccessUrl(
  orgBaseUrl: string,
  destination: string,
  accessToken?: string | null,
): string {
  if (!accessToken) return destination;
  const encoded = encodeURIComponent(destination);
  return `${orgBaseUrl}/auth/access?token=${accessToken}&next=${encoded}`;
}
