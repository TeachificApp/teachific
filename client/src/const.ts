export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Returns the internal Teachific login page.
// All unauthenticated redirects across the app use this helper.
export const getLoginUrl = (returnPath?: string) => {
  if (returnPath) {
    return `/login?returnPath=${encodeURIComponent(returnPath)}`;
  }
  return "/login";
};
