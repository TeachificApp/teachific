import { beforeEach, describe, expect, it, vi } from "vitest";
import { lmsLearnerRouter } from "./routers/lmsRouter";

const getDb = vi.hoisted(() => vi.fn());
const getOrgIdForUserWithFallback = vi.hoisted(() => vi.fn());
const getActiveEnrollment = vi.hoisted(() => vi.fn());

vi.mock("./db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./db")>()),
  getDb,
  getOrgIdForUserWithFallback,
}));
vi.mock("./lib/enrollmentAccess", () => ({ getActiveEnrollment }));

function queuedDb(results: unknown[][]) {
  const next = () => results.shift() ?? [];
  return {
    select: vi.fn(() => {
      const chain: any = {
        from: () => chain,
        where: () => chain,
        limit: () => Promise.resolve(next()),
        orderBy: () => Promise.resolve(next()),
        then: (resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(next()).then(resolve, reject),
      };
      return chain;
    }),
  };
}

describe("Course360 learner Course Player delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOrgIdForUserWithFallback.mockResolvedValue(7);
    getActiveEnrollment.mockResolvedValue({
      id: 301,
      userId: 101,
      courseId: 41,
      orgId: 7,
      enrollmentType: "full",
      enrolledAt: new Date("2026-09-01T00:00:00.000Z"),
      progressPercent: "0.00",
    });
  });

  it("uses the server-resolved active organization and retains section-owned published lessons", async () => {
    getDb.mockResolvedValue(queuedDb([
      [{ id: 41, orgId: 7, slug: "course-41", isFree: true }],
      [{ id: 501, courseId: 41, title: "Section one", position: 0 }],
      [
        { id: 601, courseId: 41, sectionId: null, title: "Top-level", lessonStatus: "published", position: 0 },
        { id: 602, courseId: null, sectionId: 501, title: "Section-owned", lessonStatus: "published", position: 0 },
      ],
      [],
      [],
    ]));

    const caller = lmsLearnerRouter.createCaller({
      user: { id: 101, role: "org_admin", email: "admin@example.test" },
      req: { headers: {}, socket: {} },
    } as any);
    const result = await caller.getCoursePlayer({ slug: "course-41", orgId: 999 } as any);

    expect(getOrgIdForUserWithFallback).toHaveBeenCalledWith(101, "org_admin");
    expect(getActiveEnrollment).toHaveBeenCalledWith(expect.anything(), 101, 41);
    expect(result.topLevelLessons.map((lesson: any) => lesson.id)).toEqual([601]);
    expect(result.sections).toEqual([expect.objectContaining({
      id: 501,
      lessons: [expect.objectContaining({ id: 602, title: "Section-owned" })],
    })]);
  });

  it("keeps the Course Player free of caller-controlled organization scope and routes interactive media through protected SCORM playback", async () => {
    const { readFileSync } = await import("node:fs");
    const routerSource = readFileSync(new URL("./routers/lmsRouter.ts", import.meta.url), "utf8");
    const playerSource = readFileSync(new URL("../client/src/pages/lms/CoursePlayer.tsx", import.meta.url), "utf8");
    const start = routerSource.indexOf("getCoursePlayer: protectedProcedure");
    const procedure = routerSource.slice(start, routerSource.indexOf("/** Get a single lesson", start));

    expect(procedure).toContain("const activeOrgId = await getOrgIdForUserWithFallback(ctx.user.id, ctx.user.role)");
    expect(procedure).toContain("eq(lmsCourses.orgId, activeOrgId)");
    expect(procedure).toContain("const lessonScope = sectionIds.length > 0");
    expect(procedure).toContain("inArray(lmsLessons.sectionId, sectionIds)");
    expect(procedure).not.toContain("input.orgId");
    expect(playerSource).toContain("resolveLessonMediaScormUrl");
    expect(playerSource).toContain("<MediaEmbedIframe");
    expect(playerSource).toContain("showLessonLevelScorm");
    expect(playerSource).not.toMatch(/read[ -]?aloud|text[ -]?to[ -]?speech|speechSynthesis/i);
  });
});
