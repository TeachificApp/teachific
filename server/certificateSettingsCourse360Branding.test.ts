import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/pages/lms/CertificateSettingsTab.tsx"),
  "utf8",
);

describe("Course360 certificate settings branding", () => {
  it("uses Course360 and organization-neutral display copy with the persisted attribution field", () => {
    expect(source).toContain("Course360 platform attribution");
    expect(source).toContain("This certificate is issued by your organization");
    expect(source).not.toContain("Teachific branding");
    expect(source).not.toContain("Teachific branded");
    expect(source).not.toContain("issued by Teachific");
    expect(source).toContain("showPlatformAttribution");
    expect(source).toContain("trpc.lms.certificateTemplates.list");
    expect(source).not.toContain("showTeachificBranding");
  });
});
