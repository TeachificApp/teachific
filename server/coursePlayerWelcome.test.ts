import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routerSource = readFileSync(new URL("./routers/lmsRouter.ts", import.meta.url), "utf8");
const playerSource = readFileSync(new URL("../client/src/pages/lms/CoursePlayer.tsx", import.meta.url), "utf8");

describe("Course360 learner welcome panel", () => {
  it("returns only active linked instructors from the learner course organization", () => {
    const start = routerSource.indexOf("getCoursePlayer: protectedProcedure");
    const end = routerSource.indexOf("/** Get a single lesson", start);
    const playerProcedure = routerSource.slice(start, end);

    expect(playerProcedure).toContain("eq(lmsCourseInstructors.orgId, course.orgId)");
    expect(playerProcedure).toContain("eq(lmsInstructors.orgId, course.orgId)");
    expect(playerProcedure).toContain("eq(lmsInstructors.isActive, true)");
    expect(playerProcedure).toContain("inArray(lmsInstructors.id, instructorIds)");
    expect(playerProcedure).toContain("name: instructor.name?.trim() || \"Instructor\"");
    expect(playerProcedure).toContain("avatarUrl: instructor.avatarUrl");
    expect(playerProcedure).not.toContain("let instructors: typeof lmsInstructors.$inferSelect[] = []");
  });

  it("shows a first-start welcome only to enrolled learners and preserves existing preview delivery", () => {
    expect(playerSource).toContain('const [showCourseWelcome, setShowCourseWelcome] = useState(false);');
    expect(playerSource).toContain('localStorage.getItem(`course360:course-welcome:${courseId}`) !== "1"');
    expect(playerSource).toContain("if (!courseId || !data?.enrollment || data.isAdminPreview) return;");
    expect(playerSource).toContain('localStorage.setItem(`course360:course-welcome:${course.id}`, "1")');
    expect(playerSource).toContain("Welcome to {course.title}");
    expect(playerSource).toContain("Meet your instructor");
    expect(playerSource).toContain("Start Learning");
    expect(playerSource).toContain("Complete the required course work to unlock your certificate of completion.");
    expect(playerSource).toContain("replace(/<[^>]*>/g, \" \")");
  });
});
