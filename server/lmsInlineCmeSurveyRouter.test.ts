import { describe, beforeEach, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { lmsCourses, lmsEnrollments, lmsInlineQuizAttempts, lmsInlineQuizResponses, lmsLessons, organizations } from "../drizzle/schema";

const mockState = vi.hoisted(() => ({
  db: null as any,
  activeOrgId: 1,
}));

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getDb: vi.fn(async () => mockState.db),
    getOrgIdForUserWithFallback: vi.fn(async () => mockState.activeOrgId),
  };
});

const { lmsLearnerRouter } = await import("./routers/lmsRouter");

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 44,
    openId: "inline-cme-test-user",
    email: "learner@example.test",
    name: "Learner",
    loginMethod: "test",
    role: "member",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return { user, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

function lessonSurveyBlocks() {
  return JSON.stringify([{
    id: "feedback-block",
    type: "lesson_quiz",
    data: {
      isSurvey: true,
      requireSurveyCompletion: true,
      questions: [{ id: "recommend", type: "survey_choice", question: "Recommend this course?", surveyRequired: true, options: ["Yes", "No"] }],
    },
  }]);
}

function createDb({ activeOrg = 1, cmeEnabled = true, completedAttempts = [] as string[] } = {}) {
  const writes: Array<{ table: unknown; values: unknown }> = [];
  const recordWrite = (table: unknown, values: unknown) => { writes.push({ table, values }); };
  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          limit: async () => {
            if (table === lmsCourses) return [{ id: 7, orgId: 1 }];
            if (table === organizations) return [{ cmeEnabled }];
            if (table === lmsEnrollments) return [{ id: 14, orgId: 1, courseId: 7 }];
            if (table === lmsLessons) return [{ id: 21, courseId: 7, sectionId: null, contentBlocks: lessonSurveyBlocks() }];
            return [];
          },
        }),
      }),
    }),
    transaction: async (callback: (tx: any) => Promise<unknown>) => callback({
      insert: (table: unknown) => ({
        values: (values: unknown) => {
          recordWrite(table, values);
          return table === lmsInlineQuizAttempts
            ? { $returningId: async () => [{ id: 91 }] }
            : Promise.resolve(undefined);
        },
      }),
    }),
  };
  // The completion guard uses a non-limited attempt query; specialize it without
  // weakening the submission-path mocks above.
  (db.select as any) = () => ({
    from: (table: unknown) => ({
      where: () => ({
        limit: async () => {
          if (table === lmsCourses) return [{ id: 7, orgId: 1 }];
          if (table === organizations) return [{ cmeEnabled }];
          if (table === lmsEnrollments) return [{ id: 14, orgId: 1, courseId: 7 }];
          if (table === lmsLessons) return [{ id: 21, courseId: 7, sectionId: null, contentBlocks: lessonSurveyBlocks() }];
          return [];
        },
        then: undefined,
      }),
    }),
  });
  // Drizzle queries are awaitable after where() when no .limit() is used.
  const originalSelect = db.select;
  (db.select as any) = () => ({
    from: (table: unknown) => ({
      where: () => {
        const result: any = {
          limit: async () => {
            if (table === lmsCourses) return [{ id: 7, orgId: 1 }];
            if (table === organizations) return [{ cmeEnabled }];
            if (table === lmsEnrollments) return [{ id: 14, orgId: 1, courseId: 7 }];
            if (table === lmsLessons) return [{ id: 21, courseId: 7, sectionId: null, contentBlocks: lessonSurveyBlocks() }];
            return [];
          },
        };
        if (table === lmsInlineQuizAttempts) {
          const rows = completedAttempts.map((quizBlockId) => ({ quizBlockId }));
          result.then = (resolve: (value: unknown) => unknown) => Promise.resolve(rows).then(resolve);
        }
        return result;
      },
    }),
  });
  return { db, writes, activeOrg };
}

describe("Course360 inline CME survey learner procedures", () => {
  beforeEach(() => {
    mockState.activeOrgId = 1;
    mockState.db = null;
  });

  it("rejects an inline survey submission when the authenticated learner's active organization differs from the course", async () => {
    const fixture = createDb();
    mockState.db = fixture.db;
    mockState.activeOrgId = 2;
    const caller = lmsLearnerRouter.createCaller(createContext());
    await expect(caller.submitInlineLessonQuiz({
      courseSlug: "course-a", lessonId: 21, quizBlockId: "feedback-block",
      responses: [{ questionKey: "recommend", answerValue: "Yes" }],
    })).rejects.toMatchObject({ message: "This course is not available in the active organization" });
    expect(fixture.writes).toEqual([]);
  });

  it("accepts an authorized active-organization learner survey and persists only server-owned snapshots with organization ownership", async () => {
    const fixture = createDb();
    mockState.db = fixture.db;
    const caller = lmsLearnerRouter.createCaller(createContext());
    const result = await caller.submitInlineLessonQuiz({
      courseSlug: "course-a", lessonId: 21, quizBlockId: "feedback-block",
      responses: [{ questionKey: "recommend", answerValue: "Yes" }],
    });
    expect(result).toMatchObject({ attemptId: 91, passed: true, requiresSurveyCompletion: true, surveyCompleted: true });
    expect(fixture.writes).toEqual([
      expect.objectContaining({ table: lmsInlineQuizAttempts, values: expect.objectContaining({ orgId: 1, userId: 44, enrollmentId: 14, courseId: 7, lessonId: 21, quizBlockId: "feedback-block" }) }),
      expect.objectContaining({ table: lmsInlineQuizResponses, values: [expect.objectContaining({ orgId: 1, attemptId: 91, questionKey: "recommend", questionText: "Recommend this course?", questionType: "survey_choice", answerValue: "Yes" })] }),
    ]);
  });

  it("rejects direct lesson completion when an enabled CME survey has no completed authorized attempt", async () => {
    const fixture = createDb();
    mockState.db = fixture.db;
    const caller = lmsLearnerRouter.createCaller(createContext());
    await expect(caller.markLessonComplete({ courseSlug: "course-a", lessonId: 21 }))
      .rejects.toMatchObject({ message: "Please complete the required survey before marking this lesson complete" });
  });
});
