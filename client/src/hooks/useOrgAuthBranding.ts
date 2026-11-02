/**
 * useOrgAuthBranding
 *
 * Fetches org branding for the current subdomain so auth pages
 * (login, register, forgot-password, reset-password, verify-email)
 * can be white-labeled per school.
 *
 * Returns null branding when on the root domain (course360.app),
 * so pages fall back to the default Course360 look.
 */
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { getSubdomain } from "@/hooks/useSubdomain";

export interface OrgAuthBranding {
  orgId: number;
  orgName: string;
  orgSlug: string;
  logoUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  buttonColor: string | null;
  buttonTextColor: string | null;
  pageBgColor: string | null;
  headingFont: string | null;
  bodyFont: string | null;
}

export interface UseOrgAuthBrandingResult {
  branding: OrgAuthBranding | null;
  isLoading: boolean;
  /** Resolved primary color — falls back to Course360 teal */
  primary: string;
  /** Resolved button text color — falls back to white */
  buttonText: string;
  /** Resolved page background — falls back to white */
  pageBg: string;
  /** Resolved org name — falls back to "Course360" */
  displayName: string;
}

const DEFAULT_PRIMARY = "#24abbc";
const DEFAULT_BUTTON_TEXT = "#ffffff";
const DEFAULT_PAGE_BG = "#ffffff";

export function useOrgAuthBranding(): UseOrgAuthBrandingResult {
  const subdomain = useMemo(() => getSubdomain(), []);

  const { data, isLoading } = trpc.resolveBySubdomain.useQuery(
    { subdomain: subdomain ?? "" },
    {
      enabled: !!subdomain,
      staleTime: 5 * 60 * 1000, // 5 min
      retry: false,
    }
  );

  const branding: OrgAuthBranding | null = data
    ? {
        orgId: data.orgId,
        orgName: data.orgName,
        orgSlug: data.orgSlug,
        logoUrl: data.logoUrl ?? null,
        primaryColor: data.primaryColor ?? null,
        accentColor: data.accentColor ?? null,
        buttonColor: data.buttonColor ?? null,
        buttonTextColor: data.buttonTextColor ?? null,
        pageBgColor: data.pageBgColor ?? null,
        headingFont: data.headingFont ?? null,
        bodyFont: data.bodyFont ?? null,
      }
    : null;

  return {
    branding,
    isLoading: !!subdomain && isLoading,
    primary: branding?.primaryColor ?? DEFAULT_PRIMARY,
    buttonText: branding?.buttonTextColor ?? DEFAULT_BUTTON_TEXT,
    pageBg: branding?.pageBgColor ?? DEFAULT_PAGE_BG,
    displayName: branding?.orgName ?? "Course360",
  };
}
