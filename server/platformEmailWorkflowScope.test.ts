import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("platform email workflow scope", () => {
  const source = readFileSync(resolve(process.cwd(), "server/routers/platformEmailWorkflowRouter.ts"), "utf8");
  const engine = readFileSync(resolve(process.cwd(), "server/lib/emailWorkflowEngine.ts"), "utf8");
  const orgRouter = readFileSync(resolve(process.cwd(), "server/routers/emailWorkflowRouter.ts"), "utf8");
  it("requires site administration and an explicit target organization", () => {
    expect(source).toContain("site_owner");
    expect(source).toContain("site_admin");
    expect(source).toContain("managedByPlatform: true");
    expect(source).toContain("orgId: z.number().int().positive()");
  });
  it("keeps platform workflows hidden from organization administration while allowing safe delivery", () => {
    expect(orgRouter).toContain("eq(emailWorkflows.managedByPlatform, false)");
    expect(engine).toContain("workflow.managedByPlatform");
    expect(engine).toContain("execution.orgId");
  });
  it("supports platform-wide activity rules while preserving the event organization for delivery", () => {
    expect(source).toContain("listPlatformWide");
    expect(source).toContain("savePlatformWide");
    expect(source).toContain("isPlatformWide: true");
    expect(source).toContain("orgId: 0");
    expect(engine).toContain("eq(emailWorkflows.isPlatformWide, true)");
    expect(engine).toContain("const stepScopeOrgId = workflow.isPlatformWide ? 0 : input.orgId");
  });
});
