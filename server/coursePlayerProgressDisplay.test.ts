import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const schema = fs.readFileSync(path.resolve(process.cwd(), "drizzle/schema.ts"), "utf8");
const router = fs.readFileSync(path.resolve(process.cwd(), "server/routers/lmsCourseBuilderRouter.ts"), "utf8");
const builder = fs.readFileSync(path.resolve(process.cwd(), "client/src/pages/lms/CourseBuilderPage.tsx"), "utf8");
const player = fs.readFileSync(path.resolve(process.cwd(), "client/src/pages/lms/CoursePlayer.tsx"), "utf8");

describe("Course player progress display settings", () => {
  it("persists a default-on numeric progress preference for LMS courses", () => {
    expect(schema).toContain('showProgressPercent: boolean("show_progress_percent").default(true).notNull()');
    expect(router).toContain("showProgressPercent: z.boolean().optional()");
    expect(builder).toContain("const [showProgressPercent, setShowProgressPercent]");
    expect(builder).toContain("showProgressPercent,");
  });

  it("allows the numeric percentage to be hidden without removing the progress bar", () => {
    expect(builder).toContain('id="show-progress-percent-switch"');
    expect(builder).toContain("disabled={hideProgress}");
    expect(player).toContain("!course.hideProgress");
    expect(player).toContain("course.showProgressPercent !== false");
  });
});
