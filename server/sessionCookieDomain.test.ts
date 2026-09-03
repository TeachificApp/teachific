import { describe, expect, it } from "vitest";
import { getPlatformSessionCookieDomain, getSessionCookieOptions } from "./_core/cookies";

describe("Course360 session cookie domains", () => {
  it("shares a session across the Course360 platform root and organization subdomains", () => {
    expect(getPlatformSessionCookieDomain("course360.app")).toBe(".course360.app");
    expect(getPlatformSessionCookieDomain("academy.course360.app")).toBe(".course360.app");
    expect(getSessionCookieOptions({
      hostname: "academy.course360.app",
      protocol: "https",
      headers: {},
    } as never)).toMatchObject({ domain: ".course360.app", secure: true, sameSite: "none" });
  });

  it("keeps legacy platform-domain session sharing for existing organization subdomains", () => {
    expect(getPlatformSessionCookieDomain("academy.teachific.app")).toBe(".teachific.app");
  });

  it("does not assign a shared platform cookie domain to a custom organization domain or localhost", () => {
    expect(getPlatformSessionCookieDomain("learn.example-academy.org")).toBeUndefined();
    expect(getPlatformSessionCookieDomain("localhost")).toBeUndefined();
    expect(getSessionCookieOptions({
      hostname: "learn.example-academy.org",
      protocol: "https",
      headers: {},
    } as never)).not.toHaveProperty("domain");
  });
});
