import { trpc } from "@/lib/trpc";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { OrgThemeProvider } from "@/contexts/OrgThemeContext";
import { useEffect } from "react";

interface SubdomainThemeProviderProps {
  subdomain: string;
  children: React.ReactNode;
}

/**
 * Fetches the org's theme and applies it to all learner-facing pages:
 *  - studentTheme (light/dark) → ThemeProvider
 *  - student-facing primary, accent, button, and button-text colors → CSS custom properties
 *    injected via OrgThemeProvider so every child can use var(--org-primary) etc.
 *
 * Defaults to Course360 teal (#189aa1) if no theme is set.
 */
export function SubdomainThemeProvider({ subdomain, children }: SubdomainThemeProviderProps) {
  const { data: theme } = trpc.lms.publicSchool.themeBySlug.useQuery(
    { slug: subdomain },
    { staleTime: 5 * 60 * 1000 }
  );

  const studentTheme = (theme?.studentTheme as "light" | "dark") ?? "light";
  // Learner views deliberately prefer the student-facing palette. The general
  // branding fields remain a backwards-compatible fallback for older schools.
  const studentPrimaryColor = theme?.studentPrimaryColor ?? theme?.primaryColor ?? "#189aa1";
  const studentAccentColor = theme?.studentAccentColor ?? theme?.accentColor ?? "#4ad9e0";
  const buttonColor = (theme as any)?.buttonColor ?? studentPrimaryColor;
  const buttonTextColor = (theme as any)?.buttonTextColor ?? "#ffffff";

  useEffect(() => {
    if (!theme) return;
    const title = (theme as any).seoTitle || (theme as any).orgName;
    if (title) document.title = title;

    const setMeta = (name: string, content?: string | null, property = false) => {
      if (!content) return;
      const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`;
      let meta = document.head.querySelector(selector) as HTMLMetaElement | null;
      if (!meta) {
        meta = document.createElement("meta");
        if (property) meta.setAttribute("property", name);
        else meta.setAttribute("name", name);
        document.head.appendChild(meta);
      }
      meta.content = content;
    };

    const seoTitle = (theme as any).seoTitle || (theme as any).orgName;
    const seoDescription = (theme as any).seoDescription;
    setMeta("description", seoDescription);
    setMeta("keywords", (theme as any).seoKeywords);
    setMeta("og:title", seoTitle, true);
    setMeta("og:description", seoDescription, true);
    setMeta("og:image", (theme as any).seoOgImage, true);
  }, [theme]);

  return (
    <ThemeProvider defaultTheme={studentTheme}>
      <OrgThemeProvider
        theme={theme ? {
          primaryColor: studentPrimaryColor,
          accentColor: studentAccentColor,
          buttonColor,
          buttonTextColor,
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
