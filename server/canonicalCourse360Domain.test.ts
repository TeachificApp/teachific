import { describe, expect, it } from "vitest";
import {
  canonicalizeCourse360Origin,
  getCanonicalCourse360Url,
} from "./lib/canonicalCourse360Domain";

describe("canonical Course360 platform domains", () => {
  it("redirects retired roots and organization subdomains while preserving paths and queries", () => {
    expect(getCanonicalCourse360Url("teachific.app", "/courses/foundations?preview=1"))
      .toBe("https://course360.app/courses/foundations?preview=1");
    expect(getCanonicalCourse360Url("academy.teachific.app", "/courses/foundations"))
      .toBe("https://academy.course360.app/courses/foundations");
    expect(getCanonicalCourse360Url("www.course360.app", "/pricing"))
      .toBe("https://course360.app/pricing");
  });

  it("does not redirect Course360, custom organization, or malformed hosts", () => {
    expect(getCanonicalCourse360Url("academy.course360.app", "/courses/foundations")).toBeNull();
    expect(getCanonicalCourse360Url("learn.example-academy.org", "/courses/foundations")).toBeNull();
    expect(getCanonicalCourse360Url("course360.app.attacker.example", "/")).toBeNull();
    expect(getCanonicalCourse360Url("academy.teachific.app.evil.example", "/")).toBeNull();
  });

  it("normalizes legacy checkout origins without opening an arbitrary redirect", () => {
    expect(canonicalizeCourse360Origin("https://academy.teachific.app"))
      .toBe("https://academy.course360.app");
    expect(canonicalizeCourse360Origin("https://teachific.app"))
      .toBe("https://course360.app");
    expect(canonicalizeCourse360Origin("http://teachific.app")).toBeNull();
    expect(canonicalizeCourse360Origin("not a url")).toBeNull();
  });
});
