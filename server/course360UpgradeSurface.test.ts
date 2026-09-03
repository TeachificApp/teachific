import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("Course360 active upgrade surfaces", () => {
  it("routes active layout subscription navigation to the supported billing page", () => {
    const layoutSource = readSource("client/src/components/Layout.tsx");
    const brandNavSource = readSource("client/src/config/brandNav.ts");

    expect(layoutSource).toContain('href="/billing"');
    expect(layoutSource).not.toContain('href="/premium"');
    expect(layoutSource).not.toContain('{ path: "/premium", label: "Premium Access"');
    expect(layoutSource).not.toContain("BASE_NAV_GROUPS");
    expect(layoutSource).not.toContain("Learn Fetal Echo");
    expect(layoutSource).not.toContain("Clinical Calculators");
    expect(layoutSource).toContain("getBrandNavConfig(brandConfig.brand)");
    expect(brandNavSource).toContain('{ path: "/courses", label: "Courses", icon: BookOpen }');
    expect(brandNavSource).toContain('{ path: "/quizzes", label: "Quizzes", icon: ClipboardCheck }');
  });

  it("keeps the supported upgrade dialog source-neutral and on the billing settings route", () => {
    const dialogSource = readSource("client/src/components/UpgradePromptDialog.tsx");

    expect(dialogSource).toContain('window.location.href = "/settings/billing"');
    expect(dialogSource).not.toMatch(/sonographer|scancoach|pocus|flashcard|soundbytes|specialty navigator/i);
  });
});
