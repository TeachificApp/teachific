import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("Course360 active upgrade surfaces", () => {
  it("routes active layout subscription navigation to the supported billing page", () => {
    const layoutSource = readSource("client/src/components/Layout.tsx");

    expect(layoutSource).toContain('{ path: "/billing", label: "Plans & Billing", icon: Crown }');
    expect(layoutSource).toContain('href="/billing"');
    expect(layoutSource).not.toContain('href="/premium"');
    expect(layoutSource).not.toContain('{ path: "/premium", label: "Premium Access"');
  });

  it("keeps the supported upgrade dialog source-neutral and on the billing settings route", () => {
    const dialogSource = readSource("client/src/components/UpgradePromptDialog.tsx");

    expect(dialogSource).toContain('window.location.href = "/settings/billing"');
    expect(dialogSource).not.toMatch(/sonographer|scancoach|pocus|flashcard|soundbytes|specialty navigator/i);
  });
});
