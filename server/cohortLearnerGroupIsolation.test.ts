import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  cohortAdminContentWhere,
  cohortLearnerContentWhere,
  cohortLearnerGroupScope,
  selectCurrentCohortGroupId,
} from "./lib/cohortGroupScope";
import {
  lmsCohortAssignments,
  lmsCohortRecordings,
  lmsCohortSessions,
} from "../drizzle/schema";

const learnerRouterSource = readFileSync(new URL("./routers/lmsRouter.ts", import.meta.url), "utf8");
const cohortAdminSource = readFileSync(new URL("./routers/lmsCohortAdminRouter.ts", import.meta.url), "utf8");

function procedureSource(source: string, name: string) {
  const start = source.indexOf(`${name}: protectedProcedure`);
  const end = source.indexOf("\n  /**", start + 1);
  return source.slice(start, end === -1 ? undefined : end);
}

describe("cohort learner group isolation", () => {
  it("builds conditions for shared-only and shared-plus-assigned-group learner content", () => {
    expect(cohortLearnerGroupScope(lmsCohortRecordings.cohortGroupId, null)).toBeTruthy();
    expect(cohortLearnerGroupScope(lmsCohortRecordings.cohortGroupId, 52_001)).toBeTruthy();
    expect(cohortLearnerContentWhere(
      lmsCohortSessions.courseId,
      lmsCohortSessions.cohortGroupId,
      63_001,
      52_001,
    )).toBeTruthy();
    expect(cohortLearnerContentWhere(
      lmsCohortAssignments.courseId,
      lmsCohortAssignments.cohortGroupId,
      63_001,
      null,
    )).toBeTruthy();
    expect(cohortAdminContentWhere(
      lmsCohortRecordings.courseId,
      lmsCohortRecordings.cohortGroupId,
      63_001,
      52_001,
    )).toBeTruthy();
  });

  it("selects one deterministic current cohort for an administrator preview", () => {
    expect(selectCurrentCohortGroupId([
      { id: 52_001, startDate: "2026-10-01T00:00:00.000Z", endDate: "2026-11-30T23:59:59.000Z", status: "active" },
      { id: 52_002, startDate: "2027-01-10T00:00:00.000Z", endDate: "2027-03-30T23:59:59.000Z", status: "open" },
    ], new Date("2026-10-19T12:00:00.000Z"))).toBe(52_001);
  });

  it("uses the shared learner filter for sessions, assignments, and recordings", () => {
    const schedule = procedureSource(learnerRouterSource, "getCohortSchedule");
    expect(schedule).toContain("cohortLearnerContentWhere(");
    expect(schedule).toContain("selectCurrentCohortGroupId(groups)");
    expect(schedule).toContain('eq(lmsCohortSessions.status, "published")');
    expect(schedule).toContain("inArray(lmsCohortSubmissions.assignmentId, assignmentIds)");
    expect(schedule).not.toContain("eq(lmsCohortSessions.cohortGroupId, groupId)");
  });

  it("does not allow direct assignment retrieval, submission, or upload across a cohort group", () => {
    for (const procedure of ["submitCohortAssignment", "uploadSubmissionFile", "getAssignmentDetail"]) {
      expect(procedureSource(learnerRouterSource, procedure)).toContain("requireLearnerCohortAssignmentAccess(ctx, assignment)");
    }
    expect(learnerRouterSource).toContain("eq(lmsCohortGroupEnrollments.cohortGroupId, assignment.cohortGroupId)");
    expect(learnerRouterSource).toContain("getOrgIdForUserWithFallback(ctx.user.id, ctx.user.role)");
    expect(learnerRouterSource).toContain("eq(lmsCourses.orgId, activeOrgId)");
  });

  it("keeps cohort notices and selected-group editor lists within the intended audience", () => {
    expect(cohortAdminSource).toContain("getCohortNotificationRecipients(input.courseId, input.cohortGroupId)");
    expect(cohortAdminSource).toContain("eq(lmsCohortGroupEnrollments.cohortGroupId, cohortGroupId)");
    expect(cohortAdminSource).toContain("activeEnrollmentCondition()");
    expect(cohortAdminSource).toContain("cohortAdminContentWhere(");
    expect(cohortAdminSource).toContain("assertCohortGroupOwnership(ctx, input.cohortGroupId, input.courseId)");
  });
});
