import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const schemaSource = readFileSync(resolve(root, "drizzle/schema.ts"), "utf8");
const routerSource = readFileSync(resolve(root, "server/routers/lmsRouter.ts"), "utf8");
const playerSource = readFileSync(resolve(root, "client/src/pages/lms/CoursePlayer.tsx"), "utf8");
const migrationSource = readFileSync(resolve(root, "drizzle/0006_windy_talkback.sql"), "utf8");

describe("Course360 lesson progress concurrency", () => {
  it("uses a durable enrollment-and-lesson unique key", () => {
    expect(schemaSource).toContain('uniqueIndex("lms_lesson_progress_enrollment_lesson_unique").on(table.enrollmentId, table.lessonId)');
    expect(migrationSource).toContain("UNIQUE(`enrollment_id`,`lesson_id`)");
  });

  it("records opened lessons only through active organization, course, and enrollment checks", () => {
    const openSlice = routerSource.slice(
      routerSource.indexOf("recordLessonOpened: protectedProcedure"),
      routerSource.indexOf("markLessonComplete: protectedProcedure"),
    );
    expect(openSlice).toContain("getOrgIdForUserWithFallback");
    expect(openSlice).toContain('"This course is not available in the active organization"');
    expect(openSlice).toContain('"Lesson does not belong to this course"');
    expect(openSlice).toContain("getActiveEnrollment");
    expect(openSlice).toContain("onDuplicateKeyUpdate");
    expect(openSlice).toContain("orgId: course.orgId");
  });

  it("keeps the first completion timestamp and atomically increments quiz attempts", () => {
    const completionSlice = routerSource.slice(
      routerSource.indexOf("markLessonComplete: protectedProcedure"),
      routerSource.indexOf("/** Submit quiz answers */"),
    );
    const quizSlice = routerSource.slice(
      routerSource.indexOf("submitQuiz: protectedProcedure"),
      routerSource.indexOf("/** Enroll in a free course */"),
    );
    expect(completionSlice).toContain("COALESCE(${lmsLessonProgress.completedAt}, VALUES(${lmsLessonProgress.completedAt}))");
    expect(quizSlice).toContain("onDuplicateKeyUpdate");
    expect(quizSlice).toContain("attempts: sql`${lmsLessonProgress.attempts} + 1`");
    expect(quizSlice).toContain("getActiveEnrollment");
  });

  it("persists first lesson views from the learner player without marking them complete", () => {
    expect(playerSource).toContain("trpc.lmsLearner.recordLessonOpened.useMutation");
    expect(playerSource).toContain("recordLessonOpened.mutate({ lessonId: selectedLessonId, courseSlug: slug })");
    expect(playerSource).toContain("data?.enrollment?.id");
    expect(playerSource).toContain("optimisticOpened");
  });
});
