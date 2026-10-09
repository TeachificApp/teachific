import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "server/routers/lmsEnrollmentAdminRouter.ts"),
  "utf8",
);

function procedureSlice(name: string, nextName: string) {
  const start = source.indexOf(name);
  const end = source.indexOf(nextName, start);
  return source.slice(start, end);
}

describe("Course360 quick AI draft organization scope", () => {
  it("requires an active paid organization before generating a quick draft", () => {
    const generation = procedureSlice("aiGenerateCourse: protectedProcedure", "aiCommitCourse: protectedProcedure");
    expect(generation).toContain("await requireAiCourseGeneratorPlan(ctx)");
    expect(generation).toContain("expert instructional designer for Course360");
    expect(generation).not.toContain("ultrasound/echocardiography");
    expect(generation).not.toContain("Teachific™");
  });

  it("requires active organization alignment before committing a quick draft", () => {
    const commit = procedureSlice("aiCommitCourse: protectedProcedure", "importMediaAssetAsLesson: protectedProcedure");
    expect(commit).toContain("const activeOrgId = await requireAiCourseGeneratorPlan(ctx)");
    expect(commit).toContain("if (course.orgId !== activeOrgId)");
    expect(commit).toContain("orgId: course.orgId");
  });
});
