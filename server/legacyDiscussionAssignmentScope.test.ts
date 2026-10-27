import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { TRPCError } from "@trpc/server";

const getUserById = vi.hoisted(() => vi.fn());
const getOrgIdForUserWithFallback = vi.hoisted(() => vi.fn());
const requireOrgAdmin = vi.hoisted(() => vi.fn());
const getDiscussionsByOrg = vi.hoisted(() => vi.fn());
const getDiscussionById = vi.hoisted(() => vi.fn());
const createDiscussion = vi.hoisted(() => vi.fn());
const updateDiscussion = vi.hoisted(() => vi.fn());
const deleteDiscussion = vi.hoisted(() => vi.fn());
const getRepliesByDiscussion = vi.hoisted(() => vi.fn());
const createDiscussionReply = vi.hoisted(() => vi.fn());
const getAssignmentsByOrg = vi.hoisted(() => vi.fn());
const getAssignmentById = vi.hoisted(() => vi.fn());
const createAssignment = vi.hoisted(() => vi.fn());
const updateAssignment = vi.hoisted(() => vi.fn());
const deleteAssignment = vi.hoisted(() => vi.fn());
const getSubmissionsByAssignment = vi.hoisted(() => vi.fn());
const getSubmissionById = vi.hoisted(() => vi.fn());
const gradeSubmission = vi.hoisted(() => vi.fn());
const getCourseById = vi.hoisted(() => vi.fn());
const getEnrollment = vi.hoisted(() => vi.fn());

vi.mock("./db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./db")>()),
  getUserById,
  getOrgIdForUserWithFallback,
  requireOrgAdmin,
}));

vi.mock("./lmsDb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./lmsDb")>()),
  getDiscussionsByOrg,
  getDiscussionById,
  createDiscussion,
  updateDiscussion,
  deleteDiscussion,
  getRepliesByDiscussion,
  createDiscussionReply,
  getAssignmentsByOrg,
  getAssignmentById,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  getSubmissionsByAssignment,
  getSubmissionById,
  gradeSubmission,
  getCourseById,
  getEnrollment,
}));

const { lmsRouter } = await import("./lmsRouter");

function caller(role = "org_admin") {
  return lmsRouter.createCaller({
    user: { id: 101, role, email: "admin@example.test", name: "Alex Admin" },
    req: { hostname: "academy.course360.app", headers: { host: "academy.course360.app" }, socket: {} },
  } as any);
}

function currentDiscussion() {
  return {
    id: 91,
    orgId: 7,
    courseId: 41,
    title: "Current school discussion",
    authorId: 101,
    status: "open",
    isPinned: false,
  };
}

function currentAssignment() {
  return {
    id: 92,
    orgId: 7,
    courseId: 41,
    title: "Current school assignment",
    maxScore: 100,
    status: "draft",
  };
}

describe("Course360 legacy Discussions and Assignments active-organization scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserById.mockResolvedValue({ id: 101, role: "org_admin" });
    getOrgIdForUserWithFallback.mockResolvedValue(7);
    requireOrgAdmin.mockImplementation(async (_userId: number, role: string) => {
      if (role === "user") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Organization admin access required" });
      }
    });
    getCourseById.mockResolvedValue({ id: 41, orgId: 7, title: "Current school course" });
    getEnrollment.mockResolvedValue({ id: 501, courseId: 41, userId: 101, orgId: 7, isActive: true });

    getDiscussionsByOrg.mockResolvedValue([currentDiscussion()]);
    getDiscussionById.mockResolvedValue(currentDiscussion());
    createDiscussion.mockResolvedValue(currentDiscussion());
    updateDiscussion.mockResolvedValue(currentDiscussion());
    getRepliesByDiscussion.mockResolvedValue([]);
    createDiscussionReply.mockResolvedValue({ id: 701, discussionId: 91, authorId: 101 });

    getAssignmentsByOrg.mockResolvedValue([currentAssignment()]);
    getAssignmentById.mockResolvedValue(currentAssignment());
    createAssignment.mockResolvedValue(currentAssignment());
    updateAssignment.mockResolvedValue(currentAssignment());
    getSubmissionsByAssignment.mockResolvedValue([{ id: 801, assignmentId: 92, userName: "Learner" }]);
    getSubmissionById.mockResolvedValue({ id: 801, assignmentId: 92, userId: 201 });
    gradeSubmission.mockResolvedValue({ id: 801, assignmentId: 92, status: "graded" });
  });

  it("uses only the server-resolved active organization for retained administration lists and creates", async () => {
    await expect(caller().discussions.list({ orgId: 7, courseId: 41 })).resolves.toEqual([
      expect.objectContaining({ id: 91, orgId: 7 }),
    ]);
    await expect(caller().assignments.list({ orgId: 7 })).resolves.toEqual([
      expect.objectContaining({ id: 92, orgId: 7 }),
    ]);

    await expect(caller().discussions.create({ orgId: 7, courseId: 41, title: "Question" }))
      .resolves.toEqual(expect.objectContaining({ orgId: 7 }));
    await expect(caller().assignments.create({ orgId: 7, courseId: 41, title: "Work", maxScore: 75 }))
      .resolves.toEqual(expect.objectContaining({ orgId: 7 }));

    expect(getDiscussionsByOrg).toHaveBeenCalledWith(7, 41);
    expect(getAssignmentsByOrg).toHaveBeenCalledWith(7);
    expect(createDiscussion).toHaveBeenCalledWith(expect.objectContaining({ orgId: 7, courseId: 41, authorId: 101 }));
    expect(createAssignment).toHaveBeenCalledWith(expect.objectContaining({ orgId: 7, courseId: 41, maxScore: 75 }));

    await expect(caller().discussions.list({ orgId: 8 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller().assignments.create({ orgId: 8, title: "Other school" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects foreign raw discussion and assignment identifiers before scoped persistence runs", async () => {
    getDiscussionById.mockResolvedValue({ ...currentDiscussion(), orgId: 8 });
    await expect(caller().discussions.get({ id: 91 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller().discussions.update({ id: 91, data: { title: "Changed" } })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller().discussions.delete({ id: 91 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller().discussions.reply({ discussionId: 91, body: "Reply" })).rejects.toMatchObject({ code: "FORBIDDEN" });

    getAssignmentById.mockResolvedValue({ ...currentAssignment(), orgId: 8 });
    await expect(caller().assignments.get({ id: 92 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller().assignments.update({ id: 92, data: { title: "Changed" } })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller().assignments.delete({ id: 92 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller().assignments.submissions({ assignmentId: 92 })).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(updateDiscussion).not.toHaveBeenCalled();
    expect(deleteDiscussion).not.toHaveBeenCalled();
    expect(createDiscussionReply).not.toHaveBeenCalled();
    expect(updateAssignment).not.toHaveBeenCalled();
    expect(deleteAssignment).not.toHaveBeenCalled();
    expect(getSubmissionsByAssignment).not.toHaveBeenCalled();
  });

  it("validates cross-school course references and uses strict ownership-safe update shapes", async () => {
    getCourseById.mockResolvedValue({ id: 41, orgId: 8, title: "Other school course" });
    await expect(caller().discussions.create({ orgId: 7, courseId: 41, title: "Question" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller().assignments.update({ id: 92, data: { courseId: 41 } })).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(caller().discussions.update({ id: 91, data: { orgId: 8 } } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller().assignments.update({ id: 92, data: { orgId: 8 } } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });

    getCourseById.mockResolvedValue({ id: 41, orgId: 7, title: "Current school course" });
    await caller().discussions.update({ id: 91, data: { status: "resolved", isPinned: true } });
    await caller().assignments.update({ id: 92, data: { title: "Updated", maxScore: 90, allowTextSubmission: false } });

    expect(updateDiscussion).toHaveBeenCalledWith(91, 7, { status: "resolved", isPinned: true });
    expect(updateAssignment).toHaveBeenCalledWith(92, 7, { title: "Updated", maxScore: 90, allowTextSubmission: false });
  });

  it("keeps reply cleanup, assignment submissions, deletion, and grading tied to the owning organization", async () => {
    await caller().discussions.get({ id: 91 });
    await caller().discussions.reply({ discussionId: 91, body: "Instructor reply" });
    await caller().discussions.delete({ id: 91 });
    await caller().assignments.get({ id: 92 });
    await caller().assignments.submissions({ assignmentId: 92 });
    await caller().assignments.delete({ id: 92 });
    await caller().assignments.grade({ submissionId: 801, grade: "A", score: 95, feedback: "Great work" });

    expect(getRepliesByDiscussion).toHaveBeenCalledWith(91, 7);
    expect(createDiscussionReply).toHaveBeenCalledWith(expect.objectContaining({ discussionId: 91, isInstructorReply: true }), 7);
    expect(deleteDiscussion).toHaveBeenCalledWith(91, 7);
    expect(getSubmissionsByAssignment).toHaveBeenCalledWith(92, 7);
    expect(deleteAssignment).toHaveBeenCalledWith(92, 7);
    expect(gradeSubmission).toHaveBeenCalledWith(801, 92, 7, "A", 95, "Great work");

    getSubmissionById.mockResolvedValue({ id: 802, assignmentId: 92, userId: 201 });
    getAssignmentById.mockResolvedValue({ ...currentAssignment(), orgId: 8 });
    await expect(caller().assignments.grade({ submissionId: 802, grade: "A", score: 95, feedback: null }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows learner discussions only through an enrollment-checked course delivery path", async () => {
    const learner = caller("user");
    await expect(learner.discussions.learnerList({ courseId: 41 })).resolves.toEqual([
      expect.objectContaining({ id: 91, orgId: 7 }),
    ]);
    await learner.discussions.learnerCreate({ courseId: 41, title: "Learner question", body: "Could you clarify this?" });

    expect(getEnrollment).toHaveBeenCalledWith(41, 101);
    expect(getDiscussionsByOrg).toHaveBeenCalledWith(7, 41);
    expect(createDiscussion).toHaveBeenCalledWith(expect.objectContaining({ orgId: 7, courseId: 41, authorId: 101 }));

    getEnrollment.mockResolvedValue(undefined);
    await expect(learner.discussions.learnerList({ courseId: 41 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(learner.discussions.learnerCreate({ courseId: 41, title: "Spoof", authorId: 999 } as any))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("uses strict contracts, scoped persistence helpers, and learner-safe client calls", () => {
    const routerSource = readFileSync(new URL("./lmsRouter.ts", import.meta.url), "utf8");
    const dbSource = readFileSync(new URL("./lmsDb.ts", import.meta.url), "utf8");
    const playerSource = readFileSync(new URL("../client/src/pages/lms/CoursePlayerPage.tsx", import.meta.url), "utf8");
    const overviewSource = readFileSync(new URL("../client/src/pages/lms/CourseOverviewPage.tsx", import.meta.url), "utf8");
    const discussionsSource = routerSource.slice(routerSource.indexOf("discussions: router({"), routerSource.indexOf("// ── Assignments"));
    const assignmentsSource = routerSource.slice(routerSource.indexOf("assignments: router({"), routerSource.indexOf("// ── Notes"));

    expect(routerSource).toContain("async function requireActiveLegacyDiscussionOrg");
    expect(routerSource).toContain("async function requireActiveLegacyAssignmentOrg");
    expect(discussionsSource).toContain("data: legacyDiscussionUpdateSchema");
    expect(assignmentsSource).toContain("data: legacyAssignmentUpdateSchema");
    expect(discussionsSource).toContain("learnerList: protectedProcedure");
    expect(discussionsSource).toContain("learnerCreate: protectedProcedure");
    expect(discussionsSource).not.toContain("z.record(z.string(), z.unknown())");
    expect(assignmentsSource).not.toContain("z.record(z.string(), z.unknown())");
    expect(dbSource).toContain("updateDiscussion(id: number, orgId: number");
    expect(dbSource).toContain("deleteDiscussion(id: number, orgId: number");
    expect(dbSource).toContain("updateAssignment(id: number, orgId: number");
    expect(dbSource).toContain("deleteAssignment(id: number, orgId: number");
    expect(dbSource).toContain("EXISTS (SELECT 1 FROM ${discussions}");
    expect(dbSource).toContain("EXISTS (SELECT 1 FROM ${assignments}");
    expect(playerSource).toContain("trpc.lms.discussions.learnerList.useQuery");
    expect(playerSource).toContain("trpc.lms.discussions.learnerCreate.useMutation");
    expect(overviewSource).toContain("trpc.lms.discussions.learnerList.useQuery");
    expect(overviewSource).toContain("trpc.lms.discussions.learnerCreate.useMutation");
  });
});
