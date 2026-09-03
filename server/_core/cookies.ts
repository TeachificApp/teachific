import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const PLATFORM_COOKIE_DOMAINS = ["course360.app", "teachific.app"] as const;

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

/**
 * Return a cookie domain only for approved platform roots and their direct
 * organization subdomains. Custom organization domains remain host-only.
 */
export function getPlatformSessionCookieDomain(hostname: string): string | undefined {
  const normalized = hostname.trim().toLowerCase().replace(/\.$/, "");
  for (const rootDomain of PLATFORM_COOKIE_DOMAINS) {
    if (normalized === rootDomain || normalized === `www.${rootDomain}` || normalized.endsWith(`.${rootDomain}`)) {
      return `.${rootDomain}`;
    }
  }
  return undefined;
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  // const hostname = req.hostname;
  // const shouldSetDomain =
  //   hostname &&
  //   !LOCAL_HOSTS.has(hostname) &&
  //   !isIpAddress(hostname) &&
  //   hostname !== "127.0.0.1" &&
  //   hostname !== "::1";

  // In production, share platform sessions across each approved platform's
  // organization subdomains while keeping custom organization domains isolated.
  const hostname = req.hostname ?? "";
  const domain = getPlatformSessionCookieDomain(hostname);

  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req),
    ...(domain ? { domain } : {}),
  };
}
