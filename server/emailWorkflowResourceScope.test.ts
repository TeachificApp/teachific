import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("email workflow resource targeting", () => {
  const router = read("server/routers/emailWorkflowRouter.ts");
  const engine = read("server/lib/emailWorkflowEngine.ts");
  const workspace = read("client/src/pages/marketing/EmailWorkflowPage.tsx");

  it("derives every selectable trigger resource from the active organization", () => {
    expect(router).toContain("listTriggerResources: protectedProcedure");
    expect(router).toContain("eq(generalFormTemplates.orgId, orgId)");
    expect(router).toContain("eq(lmsCourses.orgId, orgId)");
    expect(router).toContain("eq(emailCampaigns.orgId, orgId)");
    expect(router).toContain('eq(emailCampaigns.status, "sent")');
  });

  it("rejects forms, courses, and campaigns that do not belong to the active organization", () => {
    expect(router).toContain('message: "Selected form does not belong to the active organization."');
    expect(router).toContain('message: "Selected course does not belong to the active organization."');
    expect(router).toContain('message: "Selected campaign does not belong to the active organization."');
    expect(router).toContain("await validateWorkflowResources(db, orgId, input.triggerType, input.triggerResourceId, input.steps)");
  });

  it("matches course-targeted rules against the server-derived course payload instead of unrelated lesson or enrollment identifiers", () => {
    expect(engine).toContain("function matchesWorkflowResource(");
    expect(engine).toContain('Number(payload.courseId) === workflow.triggerResourceId');
    expect(engine).toContain("if (!matchesWorkflowResource(workflow, input.sourceId, input.payload ?? {})) continue;");
  });

  it("makes resource-scoped rule creation clear in the organization automation workspace", () => {
    expect(workspace).toContain("trpc.emailWorkflow.listTriggerResources.useQuery");
    expect(workspace).toContain("Limit to one {selector.label}");
    expect(workspace).toContain("Any course in this organization");
    expect(workspace).toContain("Any sent campaign in this organization");
  });
});
