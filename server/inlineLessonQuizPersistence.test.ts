import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ensureInlineLessonQuizSchema,
  INLINE_LESSON_QUIZ_SCHEMA_CONTRACT,
  resetInlineLessonQuizSchemaAssuranceForTests,
} from "./lib/ensureInlineLessonQuizSchema";

describe("Course360 inline lesson survey schema assurance", () => {
  beforeEach(() => {
    resetInlineLessonQuizSchemaAssuranceForTests();
  });

  it("assures only Course360 organization- and enrollment-owned tables once per process", async () => {
    const execute = vi.fn(async () => []);
    const db = { execute } as any;

    await Promise.all([
      ensureInlineLessonQuizSchema(db),
      ensureInlineLessonQuizSchema(db),
    ]);

    expect(execute).toHaveBeenCalledTimes(2);
    const statements = execute.mock.calls.map(([statement]) => String((statement as any).queryChunks?.[0]?.value ?? statement)).join("\n");
    expect(statements).toContain("lms_inline_quiz_attempts");
    expect(statements).toContain("orgId");
    expect(statements).toContain("enrollment_id");
    expect(statements).toContain("lms_inline_quiz_responses");
    expect(INLINE_LESSON_QUIZ_SCHEMA_CONTRACT.requiredAttemptColumns).toContain("enrollment_id");
  });

  it("clears a failed assurance promise so a healthy later request can retry", async () => {
    const failedDb = { execute: vi.fn(async () => { throw new Error("temporary database outage"); }) } as any;
    await expect(ensureInlineLessonQuizSchema(failedDb)).rejects.toThrow("temporary database outage");

    const healthyDb = { execute: vi.fn(async () => []) } as any;
    await expect(ensureInlineLessonQuizSchema(healthyDb)).resolves.toBeUndefined();
    expect(healthyDb.execute).toHaveBeenCalledTimes(2);
  });
});
