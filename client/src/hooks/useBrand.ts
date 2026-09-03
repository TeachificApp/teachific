/**
 * Org-scoped branding for Course360.
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

const COURSE360_CONFIG: BrandConfig = {
  brand: "teachific",
  name: "Course360™",
  shortName: "Course360",
  tagline: "SCORM & LMS Hosting Platform",
  primaryColor: "#189aa1",
  accentColor: "#4ad9e0",
  domain: "course360.app",
  logoText: "Course360™",
};

/** Always returns the Course360 platform config */
export function detectBrand(): Brand {
  return "teachific";
}

/** Get the platform brand config */
export function getBrandConfig(): BrandConfig {
  return COURSE360_CONFIG;
}

/** Hook to get brand info */
export function useBrand(): BrandConfig {
  return COURSE360_CONFIG;
}
