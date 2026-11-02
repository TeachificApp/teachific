import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { ThemeProvider } from "@/contexts/ThemeContext";

interface SubdomainThemeProviderProps {
  subdomain: string;
  children: React.ReactNode;
}

/**
 * Fetches the org's studentTheme preference and applies it to all learner-facing pages.
 * Defaults to "light" (Course360 teal) if no theme is set.
 */
export function SubdomainThemeProvider({ subdomain, children }: SubdomainThemeProviderProps) {
  const { data: theme } = trpc.lms.publicSchool.themeBySlug.useQuery(
    { slug: subdomain },
    { staleTime: 5 * 60 * 1000 }
  );

  const studentTheme = (theme?.studentTheme as "light" | "dark") ?? "light";

  return (
    <ThemeProvider defaultTheme={studentTheme}>
      {children}
    </ThemeProvider>
  );
}
