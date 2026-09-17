import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  inserted: [] as any[],
  quiz: {
    id: 44,
    orgId: 9,
    shareToken: "published-quiz-token",
    isPublished: true,
    visibility: "published",
    passingScore: 70,
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
    select: () => ({
      from: () => ({
        where: async () => [fixture.quiz],
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
  });

  it("derives earned points, total points, percentage, and pass status from saved quiz questions", async () => {
    const caller = quizMakerRouter.createCaller({ user: null } as any);
    await caller.submitAttempt({
      shareToken: fixture.quiz.shareToken,
      takerEmail: "learner@example.test",
      timeTakenSeconds: 12,
      answersJson: JSON.stringify({ q1: ["a"], q2: false }),
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
});
