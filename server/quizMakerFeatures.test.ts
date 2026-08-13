import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock db
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
};

const chainable = (result: any) => {
  const chain: any = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    set: () => chain,
    values: () => chain,
    then: (resolve: any) => resolve(result),
  };
  return chain;
};

vi.mock("./db", () => ({
  requireOrgAdmin: vi.fn().mockResolvedValue(1),
  getDb: () => Promise.resolve(mockDb),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://s3.example.com/export.zip" }),
}));

vi.mock("./scormGenerator", () => ({
  generateScormPackage: vi.fn().mockResolvedValue(Buffer.from("fake-zip")),
}));

describe("Quiz Attempt Tracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submitAttempt stores attempt for a published quiz", async () => {
    mockDb.select.mockReturnValue(
      chainable([{ id: 1, orgId: 5, isPublished: true, shareToken: "abc123" }])
    );
    mockDb.insert.mockReturnValue(
      chainable([{ insertId: 42 }])
    );

    const ctx = { user: null } as unknown as TrpcContext;
    const caller = appRouter.createCaller(ctx);
    const result = await caller.quizMaker.submitAttempt({
      shareToken: "abc123",
      takerName: "John",
      takerEmail: "john@example.com",
      score: 8,
      totalPoints: 10,
      passed: true,
      timeTakenSeconds: 120,
      answersJson: JSON.stringify([{ q: 1, a: "Paris" }]),
    });

    expect(result.attemptId).toBe(42);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("submitAttempt rejects for unpublished quiz", async () => {
    mockDb.select.mockReturnValue(chainable([]));

    const ctx = { user: null } as unknown as TrpcContext;
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.quizMaker.submitAttempt({
        shareToken: "invalid",
        score: 5,
        totalPoints: 10,
        passed: false,
        answersJson: "[]",
      })
    ).rejects.toThrow("Quiz not found or not published");
  });

  it("getAttempts returns paginated attempts for quiz owner", async () => {
    mockDb.select
      .mockReturnValueOnce(chainable([{ id: 1, userId: 10, orgId: 5 }])) // org-owned quiz access check
      .mockReturnValueOnce(
        chainable([
          { id: 1, takerName: "Alice", scorePct: 90, isPassed: true, startedAt: new Date() },
          { id: 2, takerName: "Bob", scorePct: 60, isPassed: false, startedAt: new Date() },
        ])
      );

    const ctx = { user: { id: 10 } } as unknown as TrpcContext;
    const caller = appRouter.createCaller(ctx);
    const result = await caller.quizMaker.getAttempts({ quizId: 1, limit: 10, offset: 0 });

    expect(result.total).toBe(2);
    expect(result.attempts).toHaveLength(2);
  });

  it("getQuizAnalytics returns summary stats", async () => {
    mockDb.select
      .mockReturnValueOnce(chainable([{ id: 1, userId: 10, orgId: 5 }])) // org-owned quiz access
      .mockReturnValueOnce(
        chainable([
          { scorePct: 90, isPassed: true, timeTakenSeconds: 60 },
          { scorePct: 70, isPassed: true, timeTakenSeconds: 120 },
          { scorePct: 40, isPassed: false, timeTakenSeconds: 90 },
        ])
      );

    const ctx = { user: { id: 10 } } as unknown as TrpcContext;
    const caller = appRouter.createCaller(ctx);
    const result = await caller.quizMaker.getQuizAnalytics({ quizId: 1 });

    expect(result.totalAttempts).toBe(3);
    expect(result.passRate).toBeCloseTo(66.7, 0);
    expect(result.averageScore).toBeCloseTo(66.7, 0);
    expect(result.averageTime).toBe(90);
    expect(result.scoreDistribution).toHaveLength(10);
  });
});

describe("Quiz Branding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updateBranding saves branding settings", async () => {
    mockDb.select.mockReturnValue(chainable([{ id: 1, userId: 10, orgId: 5 }]));
    mockDb.update.mockReturnValue(chainable(undefined));

    const ctx = { user: { id: 10 } } as unknown as TrpcContext;
    const caller = appRouter.createCaller(ctx);
    const result = await caller.quizMaker.updateBranding({
      quizId: 1,
      brandPrimaryColor: "#ff0000",
      brandBgColor: "#ffffff",
      brandFontFamily: "Inter",
      completionMessage: "Great job!",
    });

    expect(result.success).toBe(true);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("getQuizBranding returns branding for published quiz", async () => {
    mockDb.select.mockReturnValue(
      chainable([{
        brandPrimaryColor: "#ff0000",
        brandBgColor: "#ffffff",
        brandLogoUrl: "https://example.com/logo.png",
        brandFontFamily: "Inter",
        completionMessage: "Well done!",
      }])
    );

    const ctx = { user: null } as unknown as TrpcContext;
    const caller = appRouter.createCaller(ctx);
    const result = await caller.quizMaker.getQuizBranding({ shareToken: "abc123" });

    expect(result).not.toBeNull();
    expect(result!.brandPrimaryColor).toBe("#ff0000");
    expect(result!.completionMessage).toBe("Well done!");
  });

  it("getQuizBranding returns null for non-existent quiz", async () => {
    mockDb.select.mockReturnValue(chainable([]));

    const ctx = { user: null } as unknown as TrpcContext;
    const caller = appRouter.createCaller(ctx);
    const result = await caller.quizMaker.getQuizBranding({ shareToken: "invalid" });

    expect(result).toBeNull();
  });
});

describe("SCORM Export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exportScorm generates a SCORM 1.2 package and uploads to S3", async () => {
    mockDb.select.mockReturnValue(
      chainable([{
        id: 1,
        userId: 10,
        orgId: 5,
        title: "Test Quiz",
        description: "A test",
        instructions: JSON.stringify([{ id: "q1", type: "multiple_choice", stem: "Q1" }]),
        passingScore: 70,
        timeLimit: null,
        shuffleQuestions: false,
      }])
    );

    const ctx = { user: { id: 10 } } as unknown as TrpcContext;
    const caller = appRouter.createCaller(ctx);
    const result = await caller.quizMaker.exportScorm({ quizId: 1, format: "scorm12" });

    expect(result.downloadUrl).toBe("https://s3.example.com/export.zip");
  });

  it("exportScorm rejects quiz with no questions", async () => {
    mockDb.select.mockReturnValue(
      chainable([{
        id: 1,
        userId: 10,
        orgId: 5,
        title: "Empty Quiz",
        description: "",
        instructions: JSON.stringify([]),
        passingScore: 70,
        timeLimit: null,
        shuffleQuestions: false,
      }])
    );

    const ctx = { user: { id: 10 } } as unknown as TrpcContext;
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.quizMaker.exportScorm({ quizId: 1, format: "scorm12" })
    ).rejects.toThrow("Quiz has no questions");
  });

  it("exportScorm supports SCORM 2004 format", async () => {
    mockDb.select.mockReturnValue(
      chainable([{
        id: 1,
        userId: 10,
        orgId: 5,
        title: "Test Quiz",
        description: "A test",
        instructions: JSON.stringify([{ id: "q1", type: "multiple_choice", stem: "Q1" }]),
        passingScore: 80,
        timeLimit: 30,
        shuffleQuestions: true,
      }])
    );

    const ctx = { user: { id: 10 } } as unknown as TrpcContext;
    const caller = appRouter.createCaller(ctx);
    const result = await caller.quizMaker.exportScorm({ quizId: 1, format: "scorm2004" });

    expect(result.downloadUrl).toBe("https://s3.example.com/export.zip");
  });
});

describe("Question-Level Analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getQuestionAnalytics returns per-question stats with option breakdown", async () => {
    const questionsJson = JSON.stringify([
      {
        id: "q1",
        type: "mcq",
        stem: "What is 2+2?",
        points: 1,
        data: {
          choices: [
            { id: "a", text: "3", correct: false },
            { id: "b", text: "4", correct: true },
            { id: "c", text: "5", correct: false },
          ],
          multiSelect: false,
        },
      },
      {
        id: "q2",
        type: "tf",
        stem: "The sky is blue",
        points: 1,
        data: { correct: true },
      },
    ]);

    // Mock: first call = quiz ownership, second call = attempts
    mockDb.select
      .mockReturnValueOnce(chainable([{ id: 1, userId: 10, orgId: 5, instructions: questionsJson }]))
      .mockReturnValueOnce(
        chainable([
          { answersJson: JSON.stringify({ q1: ["b"], q2: true }) },   // correct, correct
          { answersJson: JSON.stringify({ q1: ["a"], q2: true }) },   // incorrect, correct
          { answersJson: JSON.stringify({ q1: ["b"], q2: false }) },  // correct, incorrect
        ])
      );

    const ctx = { user: { id: 10 } } as unknown as TrpcContext;
    const caller = appRouter.createCaller(ctx);
    const result = await caller.quizMaker.getQuestionAnalytics({ quizId: 1 });

    expect(result.questions).toHaveLength(2);

    // Q1: 2 correct, 1 incorrect
    const q1 = result.questions[0];
    expect(q1.id).toBe("q1");
    expect(q1.stem).toBe("What is 2+2?");
    expect(q1.correctCount).toBe(2);
    expect(q1.incorrectCount).toBe(1);
    expect(q1.correctRate).toBeCloseTo(66.7, 0);
    expect(q1.totalResponses).toBe(3);
    // Option breakdown
    expect(q1.optionBreakdown).toHaveLength(3);
    const optB = q1.optionBreakdown.find((o: any) => o.optionId === "b");
    expect(optB!.count).toBe(2);
    expect(optB!.isCorrect).toBe(true);
    const optA = q1.optionBreakdown.find((o: any) => o.optionId === "a");
    expect(optA!.count).toBe(1);
    expect(optA!.isCorrect).toBe(false);

    // Q2: 2 correct, 1 incorrect
    const q2 = result.questions[1];
    expect(q2.id).toBe("q2");
    expect(q2.type).toBe("tf");
    expect(q2.correctCount).toBe(2);
    expect(q2.incorrectCount).toBe(1);
    expect(q2.optionBreakdown).toHaveLength(2);
    const trueOpt = q2.optionBreakdown.find((o: any) => o.optionId === "true");
    expect(trueOpt!.count).toBe(2);
    expect(trueOpt!.isCorrect).toBe(true);
  });

  it("getQuestionAnalytics returns empty stats when no attempts", async () => {
    const questionsJson = JSON.stringify([
      { id: "q1", type: "mcq", stem: "Test Q", points: 1, data: { choices: [{ id: "a", text: "A", correct: true }] } },
    ]);

    mockDb.select
      .mockReturnValueOnce(chainable([{ id: 1, userId: 10, orgId: 5, instructions: questionsJson }]))
      .mockReturnValueOnce(chainable([]));

    const ctx = { user: { id: 10 } } as unknown as TrpcContext;
    const caller = appRouter.createCaller(ctx);
    const result = await caller.quizMaker.getQuestionAnalytics({ quizId: 1 });

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].totalResponses).toBe(0);
    expect(result.questions[0].correctRate).toBe(0);
    expect(result.questions[0].optionBreakdown).toHaveLength(0);
  });

  it("getQuestionAnalytics returns empty when quiz has no questions", async () => {
    mockDb.select
      .mockReturnValueOnce(chainable([{ id: 1, userId: 10, orgId: 5, instructions: JSON.stringify([]) }]));

    const ctx = { user: { id: 10 } } as unknown as TrpcContext;
    const caller = appRouter.createCaller(ctx);
    const result = await caller.quizMaker.getQuestionAnalytics({ quizId: 1 });

    expect(result.questions).toHaveLength(0);
  });

  it("getQuestionAnalytics handles malformed answersJson gracefully", async () => {
    const questionsJson = JSON.stringify([
      { id: "q1", type: "mcq", stem: "Q1", points: 1, data: { choices: [{ id: "a", text: "A", correct: true }] } },
    ]);

    mockDb.select
      .mockReturnValueOnce(chainable([{ id: 1, userId: 10, orgId: 5, instructions: questionsJson }]))
      .mockReturnValueOnce(
        chainable([
          { answersJson: "invalid json{{{" },
          { answersJson: JSON.stringify({ q1: ["a"] }) },
        ])
      );

    const ctx = { user: { id: 10 } } as unknown as TrpcContext;
    const caller = appRouter.createCaller(ctx);
    const result = await caller.quizMaker.getQuestionAnalytics({ quizId: 1 });

    // Should still process the valid attempt
    expect(result.questions[0].totalResponses).toBe(1);
    expect(result.questions[0].correctCount).toBe(1);
  });

  it("getQuestionAnalytics rejects for non-owner", async () => {
    mockDb.select.mockReturnValue(chainable([{ id: 1, userId: 10, orgId: 0 }]));

    const ctx = { user: { id: 999 } } as unknown as TrpcContext;
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.quizMaker.getQuestionAnalytics({ quizId: 1 })
    ).rejects.toThrow("You do not have access to this quiz");
  });
});
