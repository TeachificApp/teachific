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

  if (isLearnDomain()) return "course360.app";
  if (isMembersDomain()) return window.location.hostname;
  if (isAccreditationDomain()) return window.location.hostname;
  if (isMarketingStagingDomain()) return "course360.app";

  if (host === "www.course360.app" || host === "teachific.app" || host === "www.teachific.app" || host.startsWith("app.")) {
    return "course360.app";
  }

  if (host === "localhost" || host.endsWith(".localhost")) {
    const params = new URLSearchParams(window.location.search);
    const forced = params.get("siteDomain");
    if (forced && DOMAIN_VALUES.has(forced)) return forced;
    return "course360.app";
  }

  return host;
}
