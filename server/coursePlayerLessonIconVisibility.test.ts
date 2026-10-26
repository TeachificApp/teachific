import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const schema = fs.readFileSync(path.resolve(process.cwd(), "drizzle/schema.ts"), "utf8");
const router = fs.readFileSync(path.resolve(process.cwd(), "server/routers/lmsCourseBuilderRouter.ts"), "utf8");
const builder = fs.readFileSync(path.resolve(process.cwd(), "client/src/pages/lms/CourseBuilderPage.tsx"), "utf8");
const player = fs.readFileSync(path.resolve(process.cwd(), "client/src/pages/lms/CoursePlayer.tsx"), "utf8");
const migration = fs.readFileSync(path.resolve(process.cwd(), "drizzle/0099_lms_course_lesson_icons.sql"), "utf8");

describe("Course Player lesson icon visibility", () => {
  it("keeps the course setting default-on and persists it through the active LMS course contract", () => {
    expect(schema).toContain('showLessonIcons: boolean("show_lesson_icons").default(true).notNull()');
    expect(router).toContain("showLessonIcons: z.boolean().optional()");
    expect(router).toContain("await assertCourseOwnership(ctx, input.id);");
    expect(migration).toContain("ADD COLUMN `show_lesson_icons` boolean NOT NULL DEFAULT true");
    expect(migration).not.toMatch(/\b(DROP|DELETE|TRUNCATE)\b/i);
  });

  it("offers an administrator control and sends the same preference from both course settings saves", () => {
    expect(builder).toContain('id="show-lesson-icons-switch"');
    expect(builder).toContain("Show lesson status icons");
    expect((builder.match(/showLessonIcons,/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("honors the preference in both mobile and desktop lesson navigation", () => {
    expect((player.match(/const showLessonIcons = course\.showLessonIcons !== false;/g) ?? []).length).toBe(2);
    expect((player.match(/showLessonIcons && <LessonIcon/g) ?? []).length).toBe(2);
    expect((player.match(/\{showLessonIcons && \(/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});
