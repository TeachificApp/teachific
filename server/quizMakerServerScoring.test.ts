import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  inserted: [] as any[],
  completedAttempts: 0,
  quiz: {
    id: 44,
    orgId: 9,
    shareToken: "published-quiz-token",
    isPublished: true,
    visibility: "published",
    passingScore: 70,
    maxAttempts: null as number | null,
    instructions: JSON.stringify([
      {
        id: "q1",
        type: "mcq",
        points: 2,
        data: {
          choices: [
            { id: "a", text: "Correct", correct: true },
            { id: "b", text: "Incorrect", correct: false },
          ],
        },
      },
      { id: "q2", type: "tf", points: 3, data: { correct: false } },
    ]),
  },
}));

vi.mock("./db", () => ({
  getDb: async () => ({
    select: (selection?: Record<string, unknown>) => ({
      from: () => ({
        where: async () => Object.prototype.hasOwnProperty.call(selection ?? {}, "count")
          ? [{ count: fixture.completedAttempts }]
          : [fixture.quiz],
      }),
    }),
    insert: () => ({
      values: async (values: any) => {
        fixture.inserted.push(values);
        return [{ insertId: fixture.inserted.length }];
      },
    }),
  }),
  getOrgIdForUserWithFallback: vi.fn(),
  requireOrgAdmin: vi.fn(),
}));

import { quizMakerRouter } from "./quizMakerRouter";

describe("Course360 public Quiz Creator server scoring", () => {
  beforeEach(() => {
    fixture.inserted.splice(0);
    fixture.completedAttempts = 0;
    fixture.quiz.maxAttempts = null;
    fixture.quiz.visibility = "published";
  });

  it("derives earned points, total points, percentage, and pass status from saved quiz questions", async () => {
    const caller = quizMakerRouter.createCaller({ user: null } as any);
    await expect(caller.submitAttempt({
      shareToken: fixture.quiz.shareToken,
      takerEmail: "learner@example.test",
      timeTakenSeconds: 12,
      answersJson: JSON.stringify({ q1: ["a"], q2: false }),
    })).resolves.toMatchObject({
      earnedPoints: 5,
      totalPoints: 5,
      scorePercent: 100,
      passed: true,
    });

    expect(fixture.inserted).toHaveLength(1);
    expect(fixture.inserted[0]).toMatchObject({
      quizId: fixture.quiz.id,
      earnedPoints: 5,
      totalPoints: 5,
      scorePercent: "100",
      passed: true,
      legacyScoreRaw: 5,
      legacyScorePct: 100,
      legacyTotalPoints: 5,
      legacyIsPassed: true,
    });
  });

  it("ignores forged legacy score fields and records the score supported by the answers", async () => {
    const caller = quizMakerRouter.createCaller({ user: null } as any);
    await caller.submitAttempt({
      shareToken: fixture.quiz.shareToken,
      answersJson: JSON.stringify({ q1: ["b"], q2: true }),
      score: 999_999,
      totalPoints: 1,
      passed: true,
    } as any);

    expect(fixture.inserted[0]).toMatchObject({
      earnedPoints: 0,
      totalPoints: 5,
      scorePercent: "0",
      passed: false,
      legacyIsPassed: false,
    });
  });

  it("rejects malformed answer JSON before an attempt is persisted", async () => {
    const caller = quizMakerRouter.createCaller({ user: null } as any);
    await expect(caller.submitAttempt({
      shareToken: fixture.quiz.shareToken,
      answersJson: "not-json",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(fixture.inserted).toHaveLength(0);
  });

  it("does not expose or accept attempts for a private quiz through a share credential", async () => {
    fixture.quiz.visibility = "private";
    const caller = quizMakerRouter.createCaller({ user: null } as any);
    await expect(caller.getPublishedQuiz({ shareToken: fixture.quiz.shareToken })).rejects.toThrow("Quiz not found or not published");
    await expect(caller.getQuizBranding({ shareToken: fixture.quiz.shareToken })).resolves.toBeNull();
    await expect(caller.submitAttempt({
      shareToken: fixture.quiz.shareToken,
      answersJson: JSON.stringify({ q1: ["a"], q2: false }),
    })).rejects.toThrow("Quiz not found or not published");
    expect(fixture.inserted).toHaveLength(0);
  });

  it("rejects malformed conditional visibility before changing a saved quiz", async () => {
    const caller = quizMakerRouter.createCaller({ user: { id: 5, role: "org_admin" } } as any);
    await expect(caller.saveQuiz({
      quizId: fixture.quiz.id,
      title: "Conditional quiz",
      questionsJson: JSON.stringify([
        { id: "child", type: "tf", showWhen: { parentQuestionId: "missing", expectedAnswer: "true" } },
      ]),
    })).rejects.toThrow("A conditional question must reference an earlier question");
    expect(fixture.inserted).toHaveLength(0);
  });

  it("requires an email identity and enforces configured max attempts for public share links", async () => {
    fixture.quiz.maxAttempts = 1;
    const caller = quizMakerRouter.createCaller({ user: null } as any);
    await expect(caller.submitAttempt({
      shareToken: fixture.quiz.shareToken,
      answersJson: JSON.stringify({ q1: ["a"], q2: false }),
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });

    fixture.completedAttempts = 1;
    await expect(caller.submitAttempt({
      shareToken: fixture.quiz.shareToken,
      takerEmail: "learner@example.test",
      answersJson: JSON.stringify({ q1: ["a"], q2: false }),
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(fixture.inserted).toHaveLength(0);
  });
});
