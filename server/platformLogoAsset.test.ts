import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const assetSource = readFileSync(new URL("../client/src/config/platformBrand.ts", import.meta.url), "utf8");
const landingSource = readFileSync(new URL("../client/src/pages/LandingPage.tsx", import.meta.url), "utf8");
const dashboardSource = readFileSync(new URL("../client/src/components/DashboardLayout.tsx", import.meta.url), "utf8");
const learnerSource = readFileSync(new URL("../client/src/components/StudentLayout.tsx", import.meta.url), "utf8");
const loadingSource = readFileSync(new URL("../client/src/components/LoadingScreen.tsx", import.meta.url), "utf8");
const documentHeadSource = readFileSync(new URL("../client/index.html", import.meta.url), "utf8");

describe("Course360 platform logo asset", () => {
  it("uses the supplied shared logo across platform fallback surfaces", () => {
    expect(assetSource).toContain('"/manus-storage/LOGO_d33d81b9.png"');
    expect(landingSource).toContain("COURSE360_PLATFORM_LOGO_URL");
    expect(dashboardSource).toContain("COURSE360_PLATFORM_LOGO_URL");
    expect(learnerSource).toContain("COURSE360_PLATFORM_LOGO_URL");
    expect(loadingSource).toContain("COURSE360_PLATFORM_LOGO_URL");
    expect(loadingSource).not.toContain('>teach<');
  });

  it("preserves organization logo precedence over the platform fallback in the dashboard", () => {
    expect(dashboardSource).toContain("const activeOrgLogoUrl = (activeOrg as any)?.adminLogoUrl ?? (activeOrg as any)?.logoUrl;");
    expect(dashboardSource).toContain("activeOrgLogoUrl || COURSE360_PLATFORM_LOGO_URL");
  });

  it("uses the supplied Course360 banner in the public home hero", () => {
    expect(assetSource).toContain('"/manus-storage/ae44eebf-60e8-49dc-9668-bf7efff10b21_9b95b498.png"');
    expect(landingSource).toContain("COURSE360_HOME_BANNER_URL");
    expect(landingSource).toContain("COURSE360_HOME_BANNER_ALT");
    expect(landingSource).not.toContain("Dashboard preview mockup");
    expect(landingSource.indexOf("src={COURSE360_HOME_BANNER_URL}")).toBeLessThan(landingSource.indexOf("Course tools for online educators"));
  });

  it("uses the supplied square logo for platform browser and device icons", () => {
    expect(documentHeadSource).toContain('rel="icon" type="image/png" href="/manus-storage/LOGO_d33d81b9.png"');
    expect(documentHeadSource).toContain('rel="apple-touch-icon" sizes="180x180" href="/manus-storage/LOGO_d33d81b9.png"');
    expect(documentHeadSource).not.toContain("course360-logo_4b20a5ab.png");
  });
});
