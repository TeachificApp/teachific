import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/pages/lms/CourseBuilderPage.tsx"),
  "utf8",
);

describe("Course360 Course Builder domain guidance", () => {
  it("uses Course360 organization-domain examples and retains verified custom-domain guidance", () => {
    expect(source).toContain("https://your-school.course360.app/courses/...");
    expect(source).toContain("yourslug.course360.app/courses/course-slug");
    expect(source).toContain("yourslug.course360.app/funnel-slug/page-slug");
    expect(source).toContain("yourslug.course360.app/downloads/download-slug");
    expect(source).toContain("yourslug.course360.app/products/product-slug");
    expect(source).toContain("yourslug.course360.app/forms/form-slug");
    expect(source).toContain("verified custom domain");
    expect(source).not.toContain("yourslug.teachific.app");
    expect(source).not.toContain("your-school.teachific.app");
  });
});
