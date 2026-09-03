const PLATFORM_ROOT_HOSTS = new Set([
  "course360.app",
  "www.course360.app",
  "teachific.app",
  "www.teachific.app",
  "localhost",
  "127.0.0.1",
]);

export function isCourse360PlatformRoot(location: Pick<Location, "hostname" | "pathname">): boolean {
  if (location.pathname !== "/") return false;

  const hostname = location.hostname.toLowerCase();
  return PLATFORM_ROOT_HOSTS.has(hostname)
    || hostname.endsWith(".manus.space")
    || hostname.endsWith(".manus.computer");
}
