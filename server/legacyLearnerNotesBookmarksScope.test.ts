import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";

const getUserById = vi.hoisted(() => vi.fn());
const getOrgIdForUserWithFallback = vi.hoisted(() => vi.fn());
const getCourseById = vi.hoisted(() => vi.fn());
const getEnrollment = vi.hoisted(() => vi.fn());
const getLessonById = vi.hoisted(() => vi.fn());
const getNotesByLesson = vi.hoisted(() => vi.fn());
const getNotesByCourse = vi.hoisted(() => vi.fn());
const getNoteById = vi.hoisted(() => vi.fn());
const createNote = vi.hoisted(() => vi.fn());
const updateNote = vi.hoisted(() => vi.fn());
const deleteNote = vi.hoisted(() => vi.fn());
const getBookmarksByCourse = vi.hoisted(() => vi.fn());
const getBookmark = vi.hoisted(() => vi.fn());
const getBookmarkById = vi.hoisted(() => vi.fn());
const createBookmark = vi.hoisted(() => vi.fn());
const deleteBookmark = vi.hoisted(() => vi.fn());

vi.mock("./db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./db")>()),
  getUserById,
  getOrgIdForUserWithFallback,
}));
vi.mock("./lmsDb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./lmsDb")>()),
  getCourseById,
  getEnrollment,
  getLessonById,
  getNotesByLesson,
  getNotesByCourse,
  getNoteById,
  createNote,
  updateNote,
  deleteNote,
  getBookmarksByCourse,
  getBookmark,
  getBookmarkById,
  createBookmark,
  deleteBookmark,
}));

const { lmsRouter } = await import("./lmsRouter");
const caller = () => lmsRouter.createCaller({
  user: { id: 101, role: "user", email: "learner@example.test" },
  req: { headers: {}, socket: {} },
} as any);

const course = { id: 41, orgId: 7, title: "Current course" };
const enrollment = { id: 501, userId: 101, courseId: 41, orgId: 7, isActive: true };
const lesson = { id: 61, courseId: 41, title: "Current lesson" };

describe("Course360 retained learner notes and bookmarks scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserById.mockResolvedValue({ id: 101, role: "user" });
    getOrgIdForUserWithFallback.mockResolvedValue(7);
    getCourseById.mockResolvedValue(course);
    getEnrollment.mockResolvedValue(enrollment);
    getLessonById.mockResolvedValue(lesson);
    getNotesByLesson.mockResolvedValue([]);
    getNotesByCourse.mockResolvedValue([]);
    createNote.mockResolvedValue({ id: 71, ...lesson, enrollmentId: 501, userId: 101 });
    getNoteById.mockResolvedValue({ id: 71, userId: 101, courseId: 41, lessonId: 61, enrollmentId: 501 });
    updateNote.mockResolvedValue({ id: 71, content: "Updated" });
    getBookmarksByCourse.mockResolvedValue([]);
    getBookmark.mockResolvedValue(null);
    getBookmarkById.mockResolvedValue({ id: 81, userId: 101, courseId: 41, lessonId: 61, enrollmentId: 501 });
    createBookmark.mockResolvedValue({ id: 81, userId: 101, courseId: 41, lessonId: 61, enrollmentId: 501 });
  });

  it("derives note and bookmark queries and writes from the current active enrollment", async () => {
    await caller().notes.byLesson({ courseId: 41, lessonId: 61 });
    await caller().notes.byCourse({ courseId: 41 });
    await caller().notes.create({ courseId: 41, lessonId: 61, content: "Private note" });
    await caller().bookmarks.byCourse({ courseId: 41 });
    await caller().bookmarks.toggle({ courseId: 41, lessonId: 61 });

    expect(getNotesByLesson).toHaveBeenCalledWith(101, 41, 61, 501);
    expect(getNotesByCourse).toHaveBeenCalledWith(101, 41, 501);
    expect(createNote).toHaveBeenCalledWith(expect.objectContaining({ userId: 101, courseId: 41, lessonId: 61, enrollmentId: 501 }));
    expect(getBookmarksByCourse).toHaveBeenCalledWith(101, 41, 501);
    expect(createBookmark).toHaveBeenCalledWith(expect.objectContaining({ userId: 101, courseId: 41, lessonId: 61, enrollmentId: 501 }));
  });

  it("rejects other-school courses, forged enrollment IDs, and lessons outside the course", async () => {
    getCourseById.mockResolvedValue({ ...course, orgId: 8 });
    await expect(caller().notes.byCourse({ courseId: 41 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    getCourseById.mockResolvedValue(course);
    await expect(caller().notes.create({ courseId: 41, lessonId: 61, content: "Spoof", enrollmentId: 999 } as any))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    getLessonById.mockResolvedValue({ ...lesson, courseId: 42 });
    await expect(caller().bookmarks.toggle({ courseId: 41, lessonId: 61 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects inactive or mismatched enrollments and scopes existing private records before changes", async () => {
    getEnrollment.mockResolvedValue(null);
    await expect(caller().notes.byCourse({ courseId: 41 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    getEnrollment.mockResolvedValue(enrollment);
    getNoteById.mockResolvedValue({ id: 71, userId: 101, courseId: 41, lessonId: 61, enrollmentId: 999 });
    await expect(caller().notes.update({ id: 71, content: "Update" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(updateNote).not.toHaveBeenCalled();
    getBookmark.mockResolvedValue({ id: 81, userId: 101, courseId: 41, lessonId: 61, enrollmentId: 501 });
    await caller().bookmarks.toggle({ courseId: 41, lessonId: 61 });
    expect(deleteBookmark).toHaveBeenCalledWith(81, 101, 41, 501);
  });

  it("uses strict contracts, scoped persistence, and the player-supported bookmark toggle", async () => {
    const { readFileSync } = await import("node:fs");
    const routerSource = readFileSync(new URL("./lmsRouter.ts", import.meta.url), "utf8");
    const dbSource = readFileSync(new URL("./lmsDb.ts", import.meta.url), "utf8");
    const playerSource = readFileSync(new URL("../client/src/pages/lms/CoursePlayerPage.tsx", import.meta.url), "utf8");
    const notes = routerSource.slice(routerSource.indexOf("notes: router({"), routerSource.indexOf("// ── Bookmarks"));
    const bookmarks = routerSource.slice(routerSource.indexOf("bookmarks: router({"), routerSource.indexOf("// ── Dashboard"));
    expect(routerSource).toContain("async function requireLegacyLearnerPrivateCourseAccess");
    expect(notes).toContain("requireLegacyLearnerPrivateCourseAccess(ctx, input.courseId, input.lessonId)");
    expect(bookmarks).toContain("toggle: protectedProcedure");
    expect(notes).not.toContain("enrollmentId: z.number()");
    expect(bookmarks).not.toContain("enrollmentId: z.number()");
    expect(dbSource).toContain("getNotesByLesson(userId: number, courseId: number, lessonId: number, enrollmentId: number)");
    expect(dbSource).toContain("getBookmarksByCourse(userId: number, courseId: number, enrollmentId: number)");
    expect(playerSource).toContain("trpc.lms.bookmarks.toggle.useMutation");
    expect(playerSource).toContain("toggleBookmark.mutate({ courseId, lessonId: currentLesson.id })");
  });
});
