import { getOrgBaseUrl } from "./orgUrl";

/** Build a learner free-preview URL from the owning organization's trusted domain. */
export function getFreePreviewCourseUrl(
  organization: {
    slug: string;
    customDomain?: string | null;
    domainVerificationStatus?: string | null;
  },
  courseSlug: string,
  accessToken: string,
): string {
  const url = new URL(`${getOrgBaseUrl(
    organization.slug,
    organization.customDomain,
    organization.domainVerificationStatus,
  )}/courses/${encodeURIComponent(courseSlug)}`);
  url.searchParams.set("preview_token", accessToken);
  return url.toString();
}
