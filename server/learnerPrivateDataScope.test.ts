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
        innerJoin: () => chain,
        where: () => chain,
        limit: () => Promise.resolve(next()),
        orderBy: () => Promise.resolve(next()),
        then: (resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(next()).then(resolve, reject),
      };
      return chain;
    }),
  };
}

function caller() {
  return lmsLearnerRouter.createCaller({
    user: { id: 101, role: "org_admin", email: "learner@example.test" },
    req: { headers: {}, socket: {} },
  } as any);
}

describe("Course360 learner-private data organization isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOrgIdForUserWithFallback.mockResolvedValue(7);
    getActiveEnrollment.mockResolvedValue({ id: 301, userId: 101, courseId: 41, enrollmentType: "full" });
  });

  it("returns a learner certificate only after resolving the course in the active organization", async () => {
    getDb.mockResolvedValue(queuedDb([
      [{ id: 41, orgId: 7, slug: "course-41" }],
      [{ id: 901, courseId: 41, userId: 101, orgId: 7, certificateUrl: "https://files.example.test/certificate.pdf" }],
    ]));

    await expect(caller().getCourseCertificate({ courseSlug: "course-41" })).resolves.toEqual(expect.objectContaining({
      id: 901,
      orgId: 7,
      courseId: 41,
    }));
    expect(getOrgIdForUserWithFallback).toHaveBeenCalledWith(101, "org_admin");
  });

  it("does not reveal a certificate for a course in another organization", async () => {
    getDb.mockResolvedValue(queuedDb([
      [{ id: 41, orgId: 9, slug: "course-41" }],
    ]));

    await expect(caller().getCourseCertificate({ courseSlug: "course-41" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("requires an active enrollment before exposing notes or bookmarks", async () => {
    getActiveEnrollment.mockResolvedValue(null);
    getDb.mockResolvedValue(queuedDb([
      [{ id: 41, orgId: 7, slug: "course-41" }],
    ]));

    await expect(caller().getCourseNotes({ courseSlug: "course-41" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(getActiveEnrollment).toHaveBeenCalledWith(expect.anything(), 101, 41);
  });

  it("keeps quiz status, notes, and bookmarks bound to an active course and its own lessons", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(new URL("./routers/lmsRouter.ts", import.meta.url), "utf8");
    const privateDataStart = source.indexOf("// ── Certificates");
    const privateDataEnd = source.indexOf("/** Get course overview page data", privateDataStart);
    const privateData = source.slice(privateDataStart, privateDataEnd);

    expect(privateData).toContain("requireActiveOrganizationCourse(db, ctx.user.id, ctx.user.role, input.courseSlug)");
    expect(privateData).toContain("requireLessonBelongsToCourse(db, input.lessonId, course.id)");
    expect(privateData).toContain("getActiveEnrollment(db, ctx.user.id, course.id)");
    expect(privateData).toContain("eq(lmsCertificates.orgId, course.orgId)");
    expect(privateData).toContain("requireActiveOrganizationCourseById(db, ctx.user.id, ctx.user.role, note.courseId)");
  });
});
