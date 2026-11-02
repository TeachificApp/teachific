export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Returns the internal Course360 login page — no Manus/OAuth branding visible.
// All unauthenticated redirects across the app use this helper.
export const getLoginUrl = (returnPath?: string) => {
  if (returnPath) {
    return `/login?returnPath=${encodeURIComponent(returnPath)}`;
  }
  return "/login";
};
