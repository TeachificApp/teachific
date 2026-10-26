import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("email workflow workspace scope", () => {
  const workspace = read("client/src/pages/marketing/EmailWorkflowPage.tsx");
  const app = read("client/src/App.tsx");
  const nav = read("client/src/components/DashboardLayout.tsx");
  const platformRouter = read("server/routers/platformEmailWorkflowRouter.ts");

  it("exposes organization automation authoring only through server-scoped procedures", () => {
    expect(workspace).toContain("trpc.emailWorkflow.getAvailability.useQuery");
    expect(workspace).toContain("trpc.emailWorkflow.listWorkflows.useQuery");
    expect(workspace).toContain("trpc.emailWorkflow.saveWorkflow.useMutation");
    expect(workspace).toContain("trpc.emailWorkflow.deleteWorkflow.useMutation");
    expect(workspace).toContain("Only forms belonging to the current organization are listed");
    expect(workspace).toContain("Email Automations requires Pro or Enterprise");
  });

  it("makes the organization automation workspace reachable through marketing navigation in both dashboard contexts", () => {
    expect(nav).toContain('{ label: "Email Automations", path: "/marketing/email-automations" }');
    expect(app).toContain('path="/marketing/email-automations" component={OrganizationWorkflowWorkspace}');
    expect(app).toContain('path="/marketing/email-automations" component={EmailWorkflowPage}');
  });

  it("keeps platform-wide and selected-organization management on separate explicit server procedures", () => {
    expect(workspace).toContain("trpc.platformEmailWorkflow.listTargetOrganizations.useQuery");
    expect(workspace).toContain("trpc.platformEmailWorkflow.save.useMutation");
    expect(workspace).toContain("trpc.platformEmailWorkflow.savePlatformWide.useMutation");
    expect(workspace).toContain("All active organizations");
    expect(platformRouter).toContain("requireActiveTargetOrganization");
    expect(platformRouter).toContain("validatePlatformWorkflowResources");
    expect(platformRouter).toContain("deletePlatformWide");
    expect(platformRouter).toContain("cancelScheduledExecutions");
  });
});
