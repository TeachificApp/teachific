const LEGACY_PLATFORM_HOSTS = new Set([
  "teachific.app",
  "www.teachific.app",
]);

/**
 * Old Course360/Teachific mail can still contain links on the retired platform
 * hostname. A cookie issued there cannot be sent to course360.app, so move the
 * token to the canonical host before it is redeemed. Custom organization
 * domains remain untouched because their cookies must remain host-only.
 */
export function getCanonicalMagicLinkVerificationUrl(
  hostname: string,
  token: string,
): string | null {
  const normalizedHost = hostname.trim().toLowerCase();
  const isLegacyHost = LEGACY_PLATFORM_HOSTS.has(normalizedHost)
    || normalizedHost.endsWith(".teachific.app");

  if (!isLegacyHost || !token) return null;
  return `https://course360.app/magic-link/verify?token=${encodeURIComponent(token)}`;
}
