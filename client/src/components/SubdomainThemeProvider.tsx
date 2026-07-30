import { trpc } from "@/lib/trpc";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { OrgThemeProvider } from "@/contexts/OrgThemeContext";

interface SubdomainThemeProviderProps {
  subdomain: string;
  children: React.ReactNode;
}

/**
 * Fetches the org's theme and applies it to all learner-facing pages:
 *  - studentTheme (light/dark) → ThemeProvider
 *  - primaryColor, accentColor, buttonColor, buttonTextColor → CSS custom properties
 *    injected via OrgThemeProvider so every child can use var(--org-primary) etc.
 *
 * Defaults to Teachific teal (#189aa1) if no theme is set.
 */
export function SubdomainThemeProvider({ subdomain, children }: SubdomainThemeProviderProps) {
  const { data: theme } = trpc.lms.publicSchool.themeBySlug.useQuery(
    { slug: subdomain },
    { staleTime: 5 * 60 * 1000 }
  );

  const studentTheme = (theme?.studentTheme as "light" | "dark") ?? "light";

  return (
    <ThemeProvider defaultTheme={studentTheme}>
      <OrgThemeProvider
        theme={theme ? {
          primaryColor: theme.primaryColor ?? "#189aa1",
          accentColor: theme.accentColor ?? "#4ad9e0",
          buttonColor: (theme as any).buttonColor ?? theme.primaryColor ?? "#189aa1",
          buttonTextColor: (theme as any).buttonTextColor ?? "#ffffff",
          studentTheme: theme.studentTheme as "light" | "dark" | undefined,
          fontFamily: theme.fontFamily ?? undefined,
          adminLogoUrl: theme.adminLogoUrl ?? undefined,
          faviconUrl: theme.faviconUrl ?? undefined,
          customCss: theme.customCss ?? undefined,
        } : null}
        global
      >
        {children}
      </OrgThemeProvider>
    </ThemeProvider>
  );
}
