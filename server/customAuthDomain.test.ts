import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { serializeAuthSessionCookies, serializeCookie } from "./customAuthRouter";
import { getCanonicalMagicLinkVerificationUrl } from "../client/src/lib/magicLinkRouting";

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

  it("issues clean domain, Lax, and host-only session variants for direct sign-in", () => {
    const cookies = serializeAuthSessionCookies("fresh-token", requestFor("academy.course360.app"));
    expect(cookies).toHaveLength(6);
    expect(cookies.some((cookie) => cookie.includes("teachific_session=fresh-token") && cookie.includes("Domain=.course360.app"))).toBe(true);
    expect(cookies.some((cookie) => cookie.includes("teachific_session_lax=fresh-token") && cookie.includes("SameSite=Lax"))).toBe(true);
    expect(cookies.some((cookie) => cookie.includes("teachific_session_host=fresh-token") && !cookie.includes("Domain="))).toBe(true);
    expect(cookies.filter((cookie) => cookie.includes("Max-Age=0"))).toHaveLength(3);
  });

  it("moves legacy Teachific magic links to the canonical host before redemption", () => {
    expect(getCanonicalMagicLinkVerificationUrl("teachific.app", "token 1"))
      .toBe("https://course360.app/magic-link/verify?token=token%201");
    expect(getCanonicalMagicLinkVerificationUrl("academy.teachific.app", "abc"))
      .toBe("https://course360.app/magic-link/verify?token=abc");
    expect(getCanonicalMagicLinkVerificationUrl("academy.course360.app", "abc")).toBeNull();
    expect(getCanonicalMagicLinkVerificationUrl("courses.example.org", "abc")).toBeNull();
  });

  it("uses the validated account-access resolver and Course360 copy for resend, reset, and magic-link emails", () => {
    expect(customAuthSource).toContain("input(z.object({ email: z.string().email(), redirectTo: z.string().optional(), origin: z.string().url().optional() }))");
    expect(customAuthSource).toContain("const baseUrl = await resolveAccountAccessBaseUrl(");
    expect(customAuthSource).toContain("Verify your Course360 email address");
    expect(customAuthSource).toContain("Reset your Course360 password");
    expect(customAuthSource).toContain("Your Course360 sign-in link");
    expect(customAuthSource).not.toContain("Reset your Teachific password");
    expect(customAuthSource).not.toContain("Your Teachific sign-in link");
  });
});
