import { TRPCError } from "@trpc/server";
import { getPublicRequestHostname, normalizePublicHostname } from "./publicOrgRequestScope";

type RequestLike = {
  headers?: Record<string, string | string[] | undefined>;
  hostname?: string;
};

type QuizOrganization = {
  id: number;
  slug: string;
  customDomain?: string | null;
  domainVerificationStatus?: string | null;
};

function isLocalOrPreviewHost(hostname: string | null): boolean {
  return !hostname
    || hostname === "localhost"
    || hostname === "127.0.0.1"
    || hostname.endsWith(".manus.computer")
    || hostname.endsWith(".manus.space")
    || hostname.endsWith(".up.railway.app");
}

/**
 * Platform-root quiz links remain readable only as a compatibility path for
 * previously shared credentials. New links are always generated for the
 * owning organization through getOrgQuizUrl().
 */
function isPlatformHost(hostname: string): boolean {
  return hostname === "course360.app" || hostname === "www.course360.app";
}

/**
 * Ensures a public QuizMaker credential is never delivered through another
 * organization's Course360 subdomain or verified custom learner domain.
 * Local and preview hosts are intentionally accepted so the same public route
 * remains testable without production DNS; they must never be emitted in a
 * generated share URL.
 */
export function assertPublicQuizDeliveryHost(
  req: RequestLike | null | undefined,
  organization: QuizOrganization,
): void {
  const hostname = getPublicRequestHostname(req);
  if (isLocalOrPreviewHost(hostname) || (hostname && isPlatformHost(hostname))) {
    return;
  }

  const expectedSubdomain = `${organization.slug.toLowerCase()}.course360.app`;
  const verifiedCustomDomain = organization.domainVerificationStatus === "verified"
    ? normalizePublicHostname(organization.customDomain)
    : null;

  if (hostname === expectedSubdomain || (verifiedCustomDomain && hostname === verifiedCustomDomain)) {
    return;
  }

  // Public callers receive a not-found response so a valid quiz credential
  // cannot reveal that it belongs to another organization.
  throw new TRPCError({
    code: "NOT_FOUND",
    message: "Quiz not found or not published",
  });
}
