import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/pages/lms/SchoolProfilePage.tsx"),
  "utf8",
);

describe("Course360 School Profile support fallback", () => {
  it("uses the Course360 support address and leaves school-administrator guidance intact", () => {
    expect(source).toContain("Contact your school administrator");
    expect(source).toContain("mailto:support@course360.app");
    expect(source).toContain("Course360 support");
    expect(source).not.toContain("support@teachific.app");
    expect(source).not.toContain("Teachific support");
  });
});
