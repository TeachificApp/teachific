import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SITE_PAGE_DOMAINS } from "../shared/sitePagesConstants";

const adminSource = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/pages/admin/SitePagesAdmin.tsx"),
  "utf8",
);

describe("Course360 Site Pages platform domains", () => {
  it("exposes only the canonical Course360 platform domain for new page administration", () => {
    expect(SITE_PAGE_DOMAINS.map((domain) => domain.value)).toEqual(["course360.app"]);
    expect(SITE_PAGE_DOMAINS.map((domain) => domain.value)).not.toContain("teachific.app");
  });

  it("defaults administration to the Course360 platform domain and omits clinical sidebar guidance", () => {
    expect(adminSource).toContain('?? "course360.app"');
    expect(adminSource).toContain("Course360 platform domain");
    expect(adminSource).not.toContain("live clinical");
  });
});
