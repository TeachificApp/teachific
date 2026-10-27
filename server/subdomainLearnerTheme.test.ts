import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const providerSource = readFileSync(
  new URL("../client/src/components/SubdomainThemeProvider.tsx", import.meta.url),
  "utf8",
);
const themeContextSource = readFileSync(
  new URL("../client/src/contexts/ThemeContext.tsx", import.meta.url),
  "utf8",
);
const playerSource = readFileSync(
  new URL("../client/src/pages/lms/CoursePlayer.tsx", import.meta.url),
  "utf8",
);

describe("Course360 organization learner theme delivery", () => {
  it("uses the saved learner palette before legacy general-brand values", () => {
    expect(providerSource).toContain(
      'const studentPrimaryColor = theme?.studentPrimaryColor ?? theme?.primaryColor ?? "#189aa1";',
    );
    expect(providerSource).toContain(
      'const studentAccentColor = theme?.studentAccentColor ?? theme?.accentColor ?? "#4ad9e0";',
    );
    expect(providerSource).toContain("const buttonColor = (theme as any)?.buttonColor ?? studentPrimaryColor;");
    expect(providerSource).toContain("primaryColor: studentPrimaryColor");
    expect(providerSource).toContain("accentColor: studentAccentColor");
  });

  it("applies a resolved school light/dark theme after asynchronous loading", () => {
    expect(themeContextSource).toContain("if (!switchable) setTheme(defaultTheme);");
    expect(themeContextSource).toContain("}, [defaultTheme, switchable]);");
    expect(themeContextSource).toContain('root.classList.add("dark")');
  });

  it("retains an authored course player color as the first visual override", () => {
    expect(playerSource).toContain('const primaryColor = course.primaryColor ?? "var(--org-primary)";');
    expect(playerSource).toContain('const accentColor = course.accentColor ?? "var(--org-accent)";');
  });
});
