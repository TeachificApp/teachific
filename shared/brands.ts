/**
 * Shared brand definitions used by both server and client.
 * Course360 platform — single-brand, org-scoped.
 */

export type Brand = "teachific";
export type BrandMode = "teachific";

export const ALL_BRANDS: Brand[] = ["teachific"];

/** Detect the base brand from hostname — always returns "teachific" */
export function detectBrandFromHostname(_hostname: string): Brand {
  return "teachific";
}

/** Detect the brand mode from hostname — always returns "teachific" */
export function detectBrandMode(_hostname: string): BrandMode {
  return "teachific";
}

/** Brand display config for emails and UI */
export interface BrandDisplayConfig {
  brandMode: BrandMode;
  displayName: string;
  shortName: string;
  tagline: string;
  senderEmail: string;
  senderName: string;
  supportEmail: string;
  websiteUrl: string;
  appUrl: string;
  logoUrl: string;
  primaryColor: string;
  darkColor: string;
  accentColor: string;
}

export function getBrandDisplayConfig(_mode?: BrandMode): BrandDisplayConfig {
  return {
    brandMode: "teachific",
    displayName: "Course360™",
    shortName: "Course360",
    tagline: "Online Learning & Coaching Platform",
    senderEmail: process.env.SENDGRID_FROM_EMAIL || "noreply@course360.app",
    senderName: process.env.SENDGRID_FROM_NAME || "Course360™",
    supportEmail: "support@course360.app",
    websiteUrl: "https://www.course360.app",
    appUrl: process.env.VITE_OAUTH_PORTAL_URL || "https://app.course360.app",
    logoUrl: "",
    primaryColor: "#189aa1",
    darkColor: "#0e1e2e",
    accentColor: "#4ad9e0",
  };
}
