import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Course360 role-guard support fallback", () => {
  it("uses Course360 support in the live access-request feedback paths", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "client/src/components/RoleGuard.tsx"),
      "utf8",
    );

    expect(source).toContain("support@course360.app");
    expect(source).not.toContain("support@teachific.app");
    expect(source).toContain("trpc.system.requestAccess.useMutation");
    expect(source).toContain("the platform administrator has been notified");
  });
});
