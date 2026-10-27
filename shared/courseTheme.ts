export type CourseThemeInput = {
  inheritOrganizationTheme?: boolean | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  gradientFrom?: string | null;
  gradientTo?: string | null;
  gradientDirection?: string | null;
  playerColor?: string | null;
  playerTheme?: "light" | "dark" | string | null;
};

export type OrganizationThemeInput = {
  primaryColor?: string | null;
  accentColor?: string | null;
  buttonColor?: string | null;
  studentPrimaryColor?: string | null;
  studentAccentColor?: string | null;
  studentTheme?: "light" | "dark" | string | null;
} | null | undefined;

export type ResolvedCourseTheme = {
  source: "organization" | "course";
  primaryColor: string;
  accentColor: string;
  gradientFrom: string | null;
  gradientTo: string | null;
  gradientDirection: string;
  playerColor: string;
  playerTheme: "light" | "dark";
};

export const COURSE360_DEFAULT_COURSE_THEME = {
  primaryColor: "#179ca3",
  accentColor: "#0d9488",
  gradientFrom: "#179ca3",
  gradientTo: "#0d9488",
  gradientDirection: "135deg",
  playerColor: "#00b4b4",
  playerTheme: "light" as const,
};

/**
 * Produces display-only learner palette values. Stored course colors are never
 * changed when an organization theme is selected, so an author can return to
 * an explicit course override at any time without recreating its palette.
 */
export function resolveCourseTheme(
  course: CourseThemeInput | null | undefined,
  organizationTheme?: OrganizationThemeInput,
): ResolvedCourseTheme {
  const inheritOrganizationTheme = course?.inheritOrganizationTheme === true;

  if (inheritOrganizationTheme) {
    const primaryColor = organizationTheme?.studentPrimaryColor
      ?? organizationTheme?.buttonColor
      ?? organizationTheme?.primaryColor
      ?? COURSE360_DEFAULT_COURSE_THEME.primaryColor;
    const accentColor = organizationTheme?.studentAccentColor
      ?? organizationTheme?.accentColor
      ?? primaryColor;
    const studentTheme = organizationTheme?.studentTheme;

    return {
      source: "organization",
      primaryColor,
      accentColor,
      gradientFrom: null,
      gradientTo: null,
      gradientDirection: COURSE360_DEFAULT_COURSE_THEME.gradientDirection,
      playerColor: primaryColor,
      playerTheme: studentTheme === "dark" ? "dark" : "light",
    };
  }

  const primaryColor = course?.primaryColor ?? COURSE360_DEFAULT_COURSE_THEME.primaryColor;
  const accentColor = course?.accentColor ?? COURSE360_DEFAULT_COURSE_THEME.accentColor;
  const gradientFrom = course?.gradientFrom ?? null;
  const gradientTo = course?.gradientTo ?? null;
  const playerTheme = course?.playerTheme === "dark" ? "dark" : "light";

  return {
    source: "course",
    primaryColor,
    accentColor,
    gradientFrom,
    gradientTo,
    gradientDirection: course?.gradientDirection ?? COURSE360_DEFAULT_COURSE_THEME.gradientDirection,
    playerColor: course?.playerColor ?? primaryColor,
    playerTheme,
  };
}
