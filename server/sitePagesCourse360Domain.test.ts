import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SITE_PAGE_DOMAINS } from "../shared/sitePagesConstants";

const adminSource = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/pages/admin/SitePagesAdmin.tsx"),
  "utf8",
);

describe("Course360 Site Pages platform domains", () => {
  it("makes Course360 platform domains available without removing legacy record access", () => {
    expect(SITE_PAGE_DOMAINS.slice(0, 2).map((domain) => domain.value)).toEqual([
      "course360.app",
      "www.course360.app",
    ]);
    expect(SITE_PAGE_DOMAINS.map((domain) => domain.value)).toContain("teachific.app");
    expect(SITE_PAGE_DOMAINS.find((domain) => domain.value === "teachific.app")?.label).toContain("Legacy");
  });

  it("defaults administration to the Course360 platform domain and omits clinical sidebar guidance", () => {
    expect(adminSource).toContain('?? "course360.app"');
    expect(adminSource).toContain("Course360 platform domain");
    expect(adminSource).not.toContain("live clinical");
  });
});
