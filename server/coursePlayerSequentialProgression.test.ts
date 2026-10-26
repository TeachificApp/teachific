import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("Course360 alternate Course Player sequential progression", () => {
  it("honors the stored course setting without changing prerequisite or drip behavior", () => {
    const source = readFileSync(new URL("../client/src/pages/lms/CoursePlayerPage.tsx", import.meta.url), "utf8");
    const start = source.indexOf("const isLessonLocked");
    const end = source.indexOf("// Format unlock date", start);
    const lockLogic = source.slice(start, end);

    expect(lockLogic).toContain("if (course?.requireSequential)");
    expect(lockLogic).toContain('allLessons.slice(0, idx).some((previous: any) => getLessonStatus(previous.id) !== "completed")');
    expect(lockLogic).toContain("if (lesson?.isDripLocked) return true;");
    expect(lockLogic).toContain("if (!prev.isPrerequisite) continue;");
  });

  it("names the actual blocking prior lesson when sequential progression is enabled", () => {
    const source = readFileSync(new URL("../client/src/pages/lms/CoursePlayerPage.tsx", import.meta.url), "utf8");
    const start = source.indexOf("const handleLessonClick");
    const end = source.indexOf("const handleNextLesson", start);
    const navigation = source.slice(start, end);

    expect(navigation).toContain("course?.requireSequential || (l as any).isPrerequisite");
    expect(navigation).toContain('Complete "${blocker?.title || \'previous lesson\'}" first');
  });
});
