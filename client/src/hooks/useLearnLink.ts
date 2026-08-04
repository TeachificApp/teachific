/**
 * useLearnLink — Org-scoped navigation helper
 *
 * Returns a `navigateToLearn(path)` function that:
 *  1. Issues a short-lived SSO token from the server
 *  2. Appends ?sso=TOKEN to the org's own subdomain URL
 *  3. Opens the URL (in the same tab by default, or a new tab for admin previews)
 *
 * If the user is not logged in, navigates without a token (they'll see the login page).
 * If no orgSlug is provided, falls back to the current origin.
 */
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getOrgBaseUrl } from "@/lib/orgUrl";

export function getOrgLearnUrl(
  path: string,
  orgSlug: string | null | undefined,
  orgCustomDomain?: string | null,
  orgDomainVerificationStatus?: string | null,
  ssoToken?: string,
): string {
  const base = orgSlug
    ? getOrgBaseUrl(orgSlug, orgCustomDomain, orgDomainVerificationStatus)
    : window.location.origin;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = base + normalizedPath;
  if (!ssoToken) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}sso=${encodeURIComponent(ssoToken)}`;
}

/** @deprecated Use getOrgLearnUrl instead */
export function getLearnUrl(path: string, ssoToken?: string): string {
  return getOrgLearnUrl(path, null, null, null, ssoToken);
}

export function useLearnLink(
  orgSlug?: string | null,
  orgCustomDomain?: string | null,
  orgDomainVerificationStatus?: string | null,
) {
  const { user } = useAuth();
  const issueToken = trpc.sso.issueToken.useMutation();
  /**
   * Navigate to an org path with SSO passthrough.
   * @param path  e.g. "/my-courses" or "/courses/my-course/player"
   * @param newTab  open in a new tab (default: false)
   */
  async function navigateToLearn(path: string, newTab = false) {
    let url = getOrgLearnUrl(path, orgSlug, orgCustomDomain, orgDomainVerificationStatus);
    if (user) {
      try {
        const { token } = await issueToken.mutateAsync();
        url = getOrgLearnUrl(path, orgSlug, orgCustomDomain, orgDomainVerificationStatus, token);
      } catch {
        // If token issuance fails, navigate without SSO — user may need to log in
      }
    }
    if (newTab) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      window.location.href = url;
    }
  }
  /** Alias that always opens in a new tab — for admin preview buttons */
  async function openLearnLink(path: string) {
    return navigateToLearn(path, true);
  }
  return { navigateToLearn, openLearnLink, isLoading: issueToken.isPending };
}
