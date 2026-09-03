import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const routerSource = fs.readFileSync(
  path.resolve(process.cwd(), "server/routers.ts"),
  "utf8",
);

describe("legacy email-auth router quarantine", () => {
  it("keeps supported custom authentication registered and removes the unused legacy namespace", () => {
    expect(routerSource).toContain('import { customAuthRouter } from "./customAuthRouter";');
    expect(routerSource).toContain("customAuth: customAuthRouter,");
    expect(routerSource).not.toContain('import { emailAuthRouter } from "./routers/emailAuthRouter";');
    expect(routerSource).not.toContain("emailAuth: emailAuthRouter,");
  });
});
