/**
 * Org-scoped branding for Teachific.
 * Brand detection has been removed — this is a single-brand multi-tenant platform.
 * Org-specific branding (name, logo, domain) is fetched from the database at runtime.
 */
export type Brand = "teachific";
export interface BrandConfig {
  brand: Brand;
  name: string;
  shortName: string;
  tagline: string;
  primaryColor: string;
  accentColor: string;
  domain: string;
  logoText: string;
}

const TEACHIFIC_CONFIG: BrandConfig = {
  brand: "teachific",
  name: "Teachific™",
  shortName: "Teachific",
  tagline: "SCORM & LMS Hosting Platform",
  primaryColor: "#189aa1",
  accentColor: "#4ad9e0",
  domain: "teachific.app",
  logoText: "Teachific™",
};

/** Always returns the Teachific platform config */
export function detectBrand(): Brand {
  return "teachific";
}

/** Get the platform brand config */
export function getBrandConfig(): BrandConfig {
  return TEACHIFIC_CONFIG;
}

/** Hook to get brand info */
export function useBrand(): BrandConfig {
  return TEACHIFIC_CONFIG;
}
