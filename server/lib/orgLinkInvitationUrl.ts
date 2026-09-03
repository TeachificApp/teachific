import { getOrgBaseUrl } from "./orgUrl";

export function getOrgLinkInvitationUrl(
  organization: {
    slug: string;
    customDomain?: string | null;
    domainVerificationStatus?: string | null;
  },
  token: string,
): string {
  const baseUrl = getOrgBaseUrl(
    organization.slug,
    organization.customDomain,
    organization.domainVerificationStatus,
  );
  return `${baseUrl}/org-link/accept?token=${encodeURIComponent(token)}`;
}
