/**
 * Shared brand definitions used by both server and client.
 * Course360 platform display configuration. Legacy brand keys are retained only
 * because established router contracts still accept them internally.
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

function isRetiredPlatformValue(value: string | undefined): boolean {
  return Boolean(value && /teachific/i.test(value));
}

export function getCourse360PlatformEmailIdentity() {
  const configuredSenderEmail = process.env.SENDGRID_FROM_EMAIL?.trim();
  const configuredSenderName = process.env.SENDGRID_FROM_NAME?.trim();
  return {
    senderEmail: configuredSenderEmail && !isRetiredPlatformValue(configuredSenderEmail)
      ? configuredSenderEmail
      : "noreply@course360.app",
    senderName: configuredSenderName && !isRetiredPlatformValue(configuredSenderName)
      ? configuredSenderName
      : "Course360™",
  };
}

export function getCourse360PlatformAppUrl() {
  const configuredAppUrl = process.env.VITE_SITE_URL?.trim();
  return configuredAppUrl && !isRetiredPlatformValue(configuredAppUrl) && !/manus\.im/i.test(configuredAppUrl)
    ? configuredAppUrl
    : "https://course360.app";
}

export function getBrandDisplayConfig(_mode?: BrandMode): BrandDisplayConfig {
  const platformEmail = getCourse360PlatformEmailIdentity();
  return {
    brandMode: "teachific",
    displayName: "Course360™",
    shortName: "Course360",
    tagline: "Online Learning & Coaching Platform",
    senderEmail: platformEmail.senderEmail,
    senderName: platformEmail.senderName,
    supportEmail: "support@course360.app",
    websiteUrl: "https://www.course360.app",
    appUrl: getCourse360PlatformAppUrl(),
    logoUrl: "",
    primaryColor: "#189aa1",
    darkColor: "#0e1e2e",
    accentColor: "#4ad9e0",
  };
}

// Compatibility stub required by existing ported router contracts.
export const BRAND_DOMAINS: Record<string, Brand> = {};
