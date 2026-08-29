import { beforeEach, describe, expect, it, vi } from "vitest";

const selectResults: any[][] = [];
let authorizeStaff = false;

const query = () => ({
  from: () => ({
    where: () => ({
      limit: async () => selectResults.shift() ?? [],
    }),
  }),
});

vi.mock("../db", () => ({
  getDb: vi.fn(async () => ({ select: vi.fn(query) })),
  requireOrgAdmin: vi.fn(async () => {
    if (!authorizeStaff) throw new Error("Not an organization administrator");
  }),
}));

import { resolveEmbeddedLearnerQuizAccess } from "./quizRouter";

const learnerContext = { user: { id: 17, role: "user" } };
const quiz = {
  id: 41,
  orgId: 9,
  title: "Assessment",
  description: null,
  timeLimitSeconds: null,
  maxAttempts: null,
  passScorePercent: 70,
  quizType: "assessment",
  showExplanations: true,
  showCorrectAnswers: true,
  isPublished: true,
  visibility: "published",
};
const linkedLesson = {
  id: 88,
  courseId: 19,
  standaloneQuizId: 41,
  type: "quiz",
  previewMode: "none",
  isPreview: false,
};
const owningCourse = { id: 19, orgId: 9, slug: "safe-course" };
const activeEnrollment = { status: "active", enrollmentType: "full", accessExpiresAt: null };

function queueAccessRows(overrides: { quiz?: any[]; lesson?: any[]; course?: any[]; enrollment?: any[] } = {}) {
  selectResults.push(
    overrides.quiz ?? [quiz],
    overrides.lesson ?? [linkedLesson],
    overrides.course ?? [owningCourse],
    overrides.enrollment ?? [activeEnrollment],
  );
}

describe("embedded Quiz Creator course access", () => {
  beforeEach(() => {
    selectResults.splice(0);
    authorizeStaff = false;
  });

  it("allows an enrolled learner only through the assigned course lesson", async () => {
    queueAccessRows();
    await expect(resolveEmbeddedLearnerQuizAccess(learnerContext, {
      quizId: 41,
      courseSlug: "safe-course",
      sourceLessonId: 88,
      authorPreview: false,
    })).resolves.toMatchObject({ quiz: { id: 41, orgId: 9 }, course: owningCourse, lesson: linkedLesson, isStaffPreview: false });
  });

  it("allows published preview lessons but not unpublished learner quizzes", async () => {
    queueAccessRows({ lesson: [{ ...linkedLesson, previewMode: "preview" }], enrollment: [] });
    await expect(resolveEmbeddedLearnerQuizAccess(learnerContext, {
      quizId: 41, courseSlug: "safe-course", sourceLessonId: 88, authorPreview: false,
    })).resolves.toMatchObject({ isStaffPreview: false });

    queueAccessRows({ quiz: [{ ...quiz, isPublished: false, visibility: "draft" }], lesson: [{ ...linkedLesson, previewMode: "preview" }], enrollment: [] });
    await expect(resolveEmbeddedLearnerQuizAccess(learnerContext, {
      quizId: 41, courseSlug: "safe-course", sourceLessonId: 88, authorPreview: false,
    })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("allows an owning-organization staff member to preview a draft and retains exam compatibility", async () => {
    authorizeStaff = true;
    queueAccessRows({ quiz: [{ ...quiz, isPublished: false, visibility: "draft" }], lesson: [{ ...linkedLesson, type: "exam" }] });
    await expect(resolveEmbeddedLearnerQuizAccess({ user: { id: 3, role: "org_admin" } }, {
      quizId: 41, courseSlug: "safe-course", sourceLessonId: 88, authorPreview: false,
    })).resolves.toMatchObject({ isStaffPreview: true, lesson: { type: "exam" } });
  });

  it("rejects cross-course and cross-organization linkage before granting learner access", async () => {
    queueAccessRows({ course: [] });
    await expect(resolveEmbeddedLearnerQuizAccess(learnerContext, {
      quizId: 41, courseSlug: "safe-course", sourceLessonId: 88, authorPreview: false,
    })).rejects.toMatchObject({ code: "FORBIDDEN" });

    queueAccessRows({ course: [{ ...owningCourse, orgId: 77 }] });
    await expect(resolveEmbeddedLearnerQuizAccess(learnerContext, {
      quizId: 41, courseSlug: "safe-course", sourceLessonId: 88, authorPreview: false,
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
