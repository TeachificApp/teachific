import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const appSource = fs.readFileSync(path.resolve(process.cwd(), "client/src/App.tsx"), "utf8");

describe("Course360 Learn subdomain labeling", () => {
  it("uses Course360 labels while retaining the administrator-only access branch", () => {
    expect(appSource).toContain("const isCourse360Learn = subdomain === \"learn\"");
    expect(appSource).toContain("const canAccessCourse360Learn");
    expect(appSource).toContain("Course360 Learn is for organization administrators");
    expect(appSource).toContain("Course360 platform tutorials and FAQs");
    expect(appSource).not.toContain("Teachific Learn");
    expect(appSource).not.toContain("isTeachificLearn");
  });
});
