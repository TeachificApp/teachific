import { describe, expect, it } from "vitest";
import { canOpenEmbeddedLearnerQuiz } from "./embeddedLearnerQuizAccess";

describe("embedded learner quiz access", () => {
  const now = new Date("2026-08-29T12:00:00.000Z").getTime();

  it("permits active full learners and blocks free-preview or expired enrollment from protected lessons", () => {
    expect(canOpenEmbeddedLearnerQuiz({ lessonType: "quiz", isStaffPreview: false, isPublished: true, isPreviewLesson: false, enrollmentStatus: "active", enrollmentType: "full", now })).toBe(true);
    expect(canOpenEmbeddedLearnerQuiz({ lessonType: "quiz", isStaffPreview: false, isPublished: true, isPreviewLesson: false, enrollmentStatus: "active", enrollmentType: "free_preview", now })).toBe(false);
    expect(canOpenEmbeddedLearnerQuiz({ lessonType: "quiz", isStaffPreview: false, isPublished: true, isPreviewLesson: false, enrollmentStatus: "active", enrollmentType: "full", accessExpiresAt: new Date(now - 1), now })).toBe(false);
  });

  it("permits published preview lessons and owning-organization staff preview while denying learner access to drafts", () => {
    expect(canOpenEmbeddedLearnerQuiz({ lessonType: "quiz", isStaffPreview: false, isPublished: true, isPreviewLesson: true, now })).toBe(true);
    expect(canOpenEmbeddedLearnerQuiz({ lessonType: "quiz", isStaffPreview: true, isPublished: false, isPreviewLesson: false, now })).toBe(true);
    expect(canOpenEmbeddedLearnerQuiz({ lessonType: "quiz", isStaffPreview: false, isPublished: false, isPreviewLesson: true, now })).toBe(false);
  });

  it("supports linked exam lessons and rejects any unsupported lesson type", () => {
    expect(canOpenEmbeddedLearnerQuiz({ lessonType: "exam", isStaffPreview: false, isPublished: true, isPreviewLesson: false, enrollmentStatus: "completed", enrollmentType: "full", now })).toBe(true);
    expect(canOpenEmbeddedLearnerQuiz({ lessonType: "text", isStaffPreview: true, isPublished: true, isPreviewLesson: true, now })).toBe(false);
  });
});
