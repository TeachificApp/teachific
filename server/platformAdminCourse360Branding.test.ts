import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/pages/admin/PlatformAdminPage.tsx"),
  "utf8",
);

describe("Course360 Platform Admin sitemap branding", () => {
  it("uses the Course360 platform URL and labels without changing Creative Tools routes", () => {
    expect(source).toContain('const BASE = "https://course360.app"');
    expect(source).toContain("live links to course360.app");
    expect(source).toContain("Course360 Quiz Creator™ Dashboard");
    expect(source).toContain('path: "/quiz-creator-app"');
    expect(source).toContain('path: "/quiz-creator-pro"');
    expect(source).not.toContain("Teachific QuizMaker™ Dashboard");
  });
});
