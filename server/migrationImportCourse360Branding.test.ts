import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const importPages = [
  "KajabiImportPage.tsx",
  "TeachableImportPage.tsx",
  "ThinkificImportPage.tsx",
].map((filename) => fs.readFileSync(
  path.resolve(process.cwd(), "client/src/pages/integrations", filename),
  "utf8",
));

describe("Course360 migration import branding", () => {
  it("uses Course360 as the destination while retaining the named source providers", () => {
    for (const source of importPages) {
      expect(source).toContain("Course360");
      expect(source).not.toMatch(/into Teachific|as Teachific|data into Teachific/);
    }
  });
});
