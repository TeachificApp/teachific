import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Course360 analytics PDF branding", () => {
  it("uses the Course360 platform title in the PDF footer without changing export mechanics", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "client/src/lib/exportAnalyticsPdf.ts"),
      "utf8",
    );

    expect(source).toContain('pdf.text("Course360™ Analytics", PAGE_MARGIN, y)');
    expect(source).not.toContain("Teachific™ Analytics");
    expect(source).toContain("export async function exportAnalyticsPdf");
    expect(source).toContain("html2canvas(el");
  });
});
