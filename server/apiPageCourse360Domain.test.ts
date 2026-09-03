import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/pages/integrations/ApiPage.tsx"),
  "utf8",
);

describe("Course360 API documentation guidance", () => {
  it("uses the Course360 platform API base URL rather than the retired platform domain", () => {
    expect(source).toContain("https://course360.app/api/v1");
    expect(source).not.toContain("https://teachific.app/api/v1");
  });
});
