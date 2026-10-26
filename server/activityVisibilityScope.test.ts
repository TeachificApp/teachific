import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (relativePath: string) => readFileSync(resolve(root, relativePath), "utf8");

describe("organization-scoped activity reporting", () => {
  it("binds organization administrators to their active organization while allowing platform oversight by selected organization", () => {
    const source = read("server/lmsRouter.ts");
    expect(source).toContain("async function requireActivityReportOrg");
    expect(source).toContain("Activity reports must use the active organization.");
    expect(source).toContain("isPlatformAdministrator(ctx.user.role) && requestedOrgId !== undefined");
    expect(source).toContain("await requireOrgAdmin(ctx.user.id, ctx.user.role, orgId)");
  });

  it("server-derives activity event tenant context and validates claimed course, lesson, and quiz context", () => {
    const source = read("server/lmsRouter.ts");
    expect(source).toContain("async function requireActivityWriteOrg");
    expect(source).toContain("Activity events must use the active organization.");
    expect(source).toContain("async function resolveActivityEventContext");
    expect(source).toContain("eq(lmsCourses.orgId, orgId)");
    expect(source).toContain("Lesson does not belong to the supplied course.");
    expect(source).toContain("eq(lmsQuizzes.orgId, orgId)");
    expect(source).toContain("events: z.array(activityEventInput).min(1).max(50)");
  });

  it("keeps report query filters, exact totals, and member/course selectors in one active-organization contract", () => {
    const source = read("server/lmsRouter.ts");
    expect(source).toContain("countActivityEventsByOrg(orgId, options)");
    expect(source).toContain("allOrganizations: z.boolean().optional()");
    expect(source).toContain("Platform administrator access is required for an all-organization activity report.");
    expect(source).toContain("getActivityEventsAcrossOrganizations(options)");
    expect(source).toContain("memberList: protectedProcedure");
    expect(source).toContain("courseList: protectedProcedure");
    expect(source).toContain("eventType: z.enum(ACTIVITY_EVENT_TYPES).optional()");
    expect(source).toContain("dateFrom: z.string().date().optional()");
    expect(source).toContain("offset: z.number().int().min(0).default(0)");

    const dbSource = read("server/lmsDb.ts");
    expect(dbSource).toContain("eq(memberActivityEvents.orgId, orgId)");
    expect(dbSource).toContain("countActivityEventsByOrg");
    expect(dbSource).toContain("getActivityEventsAcrossOrganizations");
    expect(dbSource).toContain("countActivityEventsAcrossOrganizations");
    expect(dbSource).toContain("innerJoin(users, eq(orgMembers.userId, users.id))");
  });

  it("does not expose cross-organization member activity or unscoped account login history to org administrators", () => {
    const source = read("server/routers/adminUserRouter.ts");
    expect(source).toContain("eq(memberActivityEvents.orgId, orgId)");
    expect(source).toContain("Organization administrators cannot view account-wide login history.");
    expect(source).toContain("totalPages: Math.max(1, Math.ceil(total / input.pageSize))");
  });

  it("uses the activity tracker only for an active enrolled course and targets the secure endpoint", () => {
    const player = read("client/src/pages/lms/CoursePlayer.tsx");
    expect(player).toContain("useActivityTracker({");
    expect(player).toContain("enabled: !!data?.enrollment && !!data?.course?.orgId && !data?.isAdminPreview");

    const tracker = read("client/src/hooks/useActivityTracker.ts");
    expect(tracker).toContain("trpc.lms.activity.log.useMutation()");
    expect(tracker).not.toContain("lms.activity.ingest");
    expect(tracker).not.toContain("sendBeacon");
  });

  it("pins organization administrators to their active organization in the report UI while retaining a platform selector", () => {
    const source = read("client/src/pages/lms/StudentLogReportsPage.tsx");
    expect(source).toContain("const { orgId: selectedOrgId, orgs, ready, setSelectedOrgId } = useOrgScope()");
    expect(source).toContain("isPlatformAdmin ? (");
    expect(source).toContain("<option value=\"all\">All organizations</option>");
    expect(source).toContain("allOrganizations: allOrganizations || undefined");
    expect(source).toContain("trpc.lms.activity.memberList.useQuery");
    expect(source).toContain("trpc.lms.activity.courseList.useQuery");
    expect(source).toContain("activityFeed?.total ?? 0");
  });

  it("adds the reviewed organization-first activity indexes without destructive SQL", () => {
    const migration = read("drizzle/0100_member_activity_event_scope_indexes.sql");
    expect(migration).toContain("member_activity_events_org_created_at_idx");
    expect(migration).toContain("member_activity_events_org_user_created_at_idx");
    expect(migration).not.toMatch(/\b(DROP|DELETE|TRUNCATE|UPDATE|INSERT)\b/i);
  });
});
