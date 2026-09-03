import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { serializeCookie } from "./customAuthRouter";

const customAuthSource = fs.readFileSync(path.resolve(process.cwd(), "server/customAuthRouter.ts"), "utf8");

function requestFor(hostname: string) {
  return { hostname, protocol: "https", headers: {} } as never;
}

describe("Course360 custom-auth domain behavior", () => {
  it("shares a primary custom-auth session only across approved Course360 subdomains", () => {
    expect(serializeCookie("teachific_session", "token", 60, requestFor("academy.course360.app")))
      .toContain("Domain=.course360.app");
    expect(serializeCookie("teachific_session", "token", 60, requestFor("academy.teachific.app")))
      .toContain("Domain=.teachific.app");
  });

  it("keeps custom organization authentication cookies host-only", () => {
    const customDomainCookie = serializeCookie("teachific_session", "token", 60, requestFor("learn.example-academy.org"), "none");
    expect(customDomainCookie).not.toContain("Domain=");
    expect(customDomainCookie).toContain("SameSite=None");
    expect(customDomainCookie).toContain("Secure");
  });

  it("uses the validated account-access resolver and Course360 copy for resend, reset, and magic-link emails", () => {
    expect(customAuthSource).toContain("input(z.object({ email: z.string().email(), origin: z.string().url().optional() }))");
    expect(customAuthSource).toContain("const baseUrl = await resolveAccountAccessBaseUrl(");
    expect(customAuthSource).toContain("Verify your Course360 email address");
    expect(customAuthSource).toContain("Reset your Course360 password");
    expect(customAuthSource).toContain("Your Course360 sign-in link");
    expect(customAuthSource).not.toContain("Reset your Teachific password");
    expect(customAuthSource).not.toContain("Your Teachific sign-in link");
  });
});
