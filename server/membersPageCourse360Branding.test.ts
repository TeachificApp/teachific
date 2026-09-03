import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/pages/lms/MembersPage.tsx"),
  "utf8",
);

describe("Course360 Members page branding", () => {
  it("uses Course360 in the manual-enrollment account guidance", () => {
    expect(source).toContain("Course360 account");
    expect(source).not.toContain("Teachific account");
  });
});
