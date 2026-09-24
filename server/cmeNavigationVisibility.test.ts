import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const layoutSource = readFileSync(new URL("../client/src/components/DashboardLayout.tsx", import.meta.url), "utf8");
const cmeRouterSource = readFileSync(new URL("./routers/cmeActivityFormRouter.ts", import.meta.url), "utf8");

describe("CME navigation entitlement", () => {
  it("hides the CME Management link for organizations without CME enabled while preserving platform administration", () => {
    expect(layoutSource).toContain('sub.path === "/lms/cme" && !isAdmin && !orgCtx?.cmeEnabled');
  });

  it("enforces the organization CME feature flag in the CME activity router", () => {
    expect(cmeRouterSource).toContain("organizations.cmeEnabled");
    expect(cmeRouterSource).toContain("CME processing is not enabled");
  });
});
