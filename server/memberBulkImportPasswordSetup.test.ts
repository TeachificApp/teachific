import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const clientSource = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/pages/lms/MembersPage.tsx"),
  "utf8",
);
const routerSource = fs.readFileSync(
  path.resolve(process.cwd(), "server/routers.ts"),
  "utf8",
);

describe("Course360 bulk member import password setup", () => {
  it("does not populate a predictable password when a CSV password is absent", () => {
    expect(clientSource).toContain('password: passIdx >= 0 && cols[passIdx] ? cols[passIdx] : undefined');
    expect(clientSource).not.toContain("Teachific@123");
    expect(clientSource).toContain("secure, one-time password setup link");
  });

  it("creates a secure server-owned setup token and emails the owning organization route", () => {
    expect(routerSource).toContain("const requiresPasswordSetup = !u.password;");
    expect(routerSource).toContain("const resetToken = requiresPasswordSetup ? nanoid(48) : undefined;");
    expect(routerSource).toContain("emailVerified: !requiresPasswordSetup");
    expect(routerSource).toContain("getOrgBaseUrl(");
    expect(routerSource).toContain("sendEmailViaOrg({");
    expect(routerSource).toContain("/reset-password?token=${encodeURIComponent(resetToken)}");
    expect(routerSource).toContain("setupEmailsSent");
  });
});
