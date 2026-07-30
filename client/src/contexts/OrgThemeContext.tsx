import React, { createContext, useContext, useEffect, useRef } from "react";

/**
 * OrgThemeContext
 *
 * Holds the resolved org brand colors and injects them as CSS custom properties
 * on the nearest wrapper element. Components can read raw values via `useOrgTheme()`
 * or use the CSS variables directly in Tailwind/inline styles:
 *
 *   className="bg-[var(--org-primary)] text-[var(--org-button-text)]"
 *   style={{ color: "var(--org-primary)" }}
 *
 * CSS variables injected:
 *   --org-primary       Org's primary brand color (default: #189aa1)
 *   --org-accent        Org's accent color (default: #4ad9e0)
 *   --org-button        Button background color (defaults to --org-primary)
 *   --org-button-text   Button text color (default: #ffffff)
 *   --org-primary-light 10% opacity tint of primary (for hover states, backgrounds)
 *   --primary           Overrides Tailwind's --primary so bg-primary/text-primary use org color
 *   --ring              Overrides Tailwind's --ring so focus rings use org color
 */

export interface OrgThemeColors {
  primaryColor: string;
  accentColor: string;
  buttonColor: string;
  buttonTextColor: string;
  studentTheme?: "light" | "dark";
  fontFamily?: string;
  adminLogoUrl?: string | null;
  faviconUrl?: string | null;
  customCss?: string | null;
}

const DEFAULT_COLORS: OrgThemeColors = {
  primaryColor: "#189aa1",
  accentColor: "#4ad9e0",
  buttonColor: "#189aa1",
  buttonTextColor: "#ffffff",
};

const OrgThemeContext = createContext<OrgThemeColors>(DEFAULT_COLORS);

interface OrgThemeProviderProps {
  children: React.ReactNode;
  theme?: Partial<OrgThemeColors> | null;
  /** If true, injects CSS variables onto document.documentElement instead of a wrapper div */
  global?: boolean;
}

/**
 * Convert a hex color to an OKLCH string suitable for Tailwind 4 CSS variables.
 * Falls back to the hex value itself if conversion fails (browsers accept hex in CSS vars).
 */
function hexToOklchApprox(hex: string): string {
  // We can't do a full gamut-accurate conversion in the browser without a library,
  // but Tailwind 4's @theme inline block maps --color-primary → --primary,
  // and --primary is used as a CSS variable value (not an OKLCH literal) in the
  // @theme block. So we can just set --primary to the hex value directly and
  // Tailwind will use it correctly via var(--primary).
  return hex;
}

/**
 * Injects org CSS variables onto a target element.
 */
function injectOrgCssVars(target: HTMLElement, colors: OrgThemeColors) {
  const p = colors.primaryColor || "#189aa1";
  const a = colors.accentColor || "#4ad9e0";
  const b = colors.buttonColor || p;
  const bt = colors.buttonTextColor || "#ffffff";

  target.style.setProperty("--org-primary", p);
  target.style.setProperty("--org-accent", a);
  target.style.setProperty("--org-button", b);
  target.style.setProperty("--org-button-text", bt);
  // Override Tailwind's --primary so bg-primary / text-primary / ring-primary use org color
  target.style.setProperty("--primary", hexToOklchApprox(p));
  target.style.setProperty("--ring", hexToOklchApprox(p));
  // Sidebar primary also follows org color
  target.style.setProperty("--sidebar-primary", hexToOklchApprox(p));
  target.style.setProperty("--sidebar-ring", hexToOklchApprox(p));
}

/**
 * Removes org CSS variable overrides from a target element.
 */
function removeOrgCssVars(target: HTMLElement) {
  const vars = ["--org-primary", "--org-accent", "--org-button", "--org-button-text", "--primary", "--ring", "--sidebar-primary", "--sidebar-ring"];
  vars.forEach(v => target.style.removeProperty(v));
}

export function OrgThemeProvider({ children, theme, global: isGlobal = false }: OrgThemeProviderProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  const resolvedColors: OrgThemeColors = {
    primaryColor: theme?.primaryColor || DEFAULT_COLORS.primaryColor,
    accentColor: theme?.accentColor || DEFAULT_COLORS.accentColor,
    buttonColor: theme?.buttonColor || theme?.primaryColor || DEFAULT_COLORS.buttonColor,
    buttonTextColor: theme?.buttonTextColor || DEFAULT_COLORS.buttonTextColor,
    studentTheme: theme?.studentTheme,
    fontFamily: theme?.fontFamily,
    adminLogoUrl: theme?.adminLogoUrl,
    faviconUrl: theme?.faviconUrl,
    customCss: theme?.customCss,
  };

  useEffect(() => {
    const target = isGlobal ? document.documentElement : wrapperRef.current;
    if (!target) return;
    injectOrgCssVars(target, resolvedColors);
    return () => {
      if (isGlobal) removeOrgCssVars(document.documentElement);
    };
  }, [resolvedColors.primaryColor, resolvedColors.accentColor, resolvedColors.buttonColor, resolvedColors.buttonTextColor, isGlobal]);

  // Inject custom CSS if provided
  useEffect(() => {
    if (!resolvedColors.customCss) return;
    const styleId = "org-custom-css";
    let el = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = styleId;
      document.head.appendChild(el);
    }
    el.textContent = resolvedColors.customCss;
    return () => {
      const existing = document.getElementById(styleId);
      if (existing) existing.remove();
    };
  }, [resolvedColors.customCss]);

  if (isGlobal) {
    return (
      <OrgThemeContext.Provider value={resolvedColors}>
        {children}
      </OrgThemeContext.Provider>
    );
  }

  return (
    <OrgThemeContext.Provider value={resolvedColors}>
      <div ref={wrapperRef} className="contents">
        {children}
      </div>
    </OrgThemeContext.Provider>
  );
}

/**
 * Hook to read the current org theme colors.
 * Returns default teal colors if no OrgThemeProvider is in the tree.
 */
export function useOrgTheme(): OrgThemeColors {
  return useContext(OrgThemeContext);
}

/**
 * Convenience hook that returns inline style objects for common patterns.
 */
export function useOrgThemeStyles() {
  const { primaryColor, accentColor, buttonColor, buttonTextColor } = useOrgTheme();
  return {
    primaryColor,
    accentColor,
    buttonColor,
    buttonTextColor,
    primaryBg: { backgroundColor: primaryColor },
    primaryText: { color: primaryColor },
    primaryBorder: { borderColor: primaryColor },
    primaryLightBg: { backgroundColor: `${primaryColor}18` },
    primaryLightBorder: { borderColor: `${primaryColor}40` },
    buttonStyle: { backgroundColor: buttonColor, color: buttonTextColor },
    gradientBg: { background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` },
  };
}
