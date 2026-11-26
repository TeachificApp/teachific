import { isCourse360PlatformRoot } from "./platformRoot";

/** Entry selection only; never proof of identity, payment, membership or permission. */
export function isCourse360AccountSetupEntry(location: Pick<Location, "hostname" | "pathname">): boolean {
  return location.pathname === "/account-setup"
    && isCourse360PlatformRoot({ hostname: location.hostname, pathname: "/" });
}
