import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const appSource = fs.readFileSync(path.resolve(process.cwd(), "client/src/App.tsx"), "utf8");

describe("Course360 magic-link routing", () => {
  it("keeps nested verification paths outside the dashboard authentication gate", () => {
    expect(appSource).toContain('Route path="/magic-link/verify" component={MagicLinkVerifyPage}');
    expect(appSource).toContain('AUTH_PATHS.some((p) => path === p || path.startsWith(`${p}/`))');
    expect(appSource).not.toContain('AUTH_PATHS.some((p) => path === p || path.startsWith(p + "?"))');
  });
});
