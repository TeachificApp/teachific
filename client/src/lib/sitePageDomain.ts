/**
 * Resolve the site_pages / site_nav_menus domain key for the current host.
 */
import { SITE_PAGE_DOMAINS, type SitePageDomain } from "@shared/sitePagesConstants";
import {
  isLearnDomain,
  isMembersDomain,
  isAccreditationDomain,
  isMarketingStagingDomain,
} from "@/hooks/useSubdomain";

const DOMAIN_VALUES = new Set<string>(SITE_PAGE_DOMAINS.map((d) => d.value));

export function getSitePageDomain(): SitePageDomain | string {
  const host = window.location.hostname.toLowerCase();

  if (DOMAIN_VALUES.has(host)) {
    return host as SitePageDomain;
  }

  if (isLearnDomain()) return "teachific.app/learn";
  if (isMembersDomain()) return window.location.hostname;
  if (isAccreditationDomain()) return window.location.hostname;
  if (host === "app.teachific.net") return "app.teachific.net";
  if (isMarketingStagingDomain()) return "teachific.app";

  if (host === "teachific.app" || host.startsWith("app.")) {
    return "teachific.app";
  }

  if (host === "localhost" || host.endsWith(".localhost")) {
    const params = new URLSearchParams(window.location.search);
    const forced = params.get("siteDomain");
    if (forced && DOMAIN_VALUES.has(forced)) return forced;
    if (isLearnDomain()) return "teachific.app/learn";
    return "teachific.app";
  }

  return host;
}
