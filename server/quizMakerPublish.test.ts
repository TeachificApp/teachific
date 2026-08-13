import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// In-memory store for quizzes
let quizIdCounter = 0;
const quizzesStore: any[] = [];

vi.mock("./db", () => {
  return {
    requireOrgAdmin: () => Promise.resolve(1),
    getDb: () => {
      const mockDb = {
        select: () => ({
          from: (table: any) => ({
            where: (condition: any) => {
              // Return matching quizzes based on the mock store
              // For getPublishStatus and publish/unpublish, return the quiz by ID
              const result = quizzesStore.filter((q) => !q._deleted);
              const promiseLike = {
                orderBy: () => Promise.resolve(result),
                limit: () => Promise.resolve(result),
                then: (resolve: any) => resolve(result),
                [Symbol.toStringTag]: "Promise",
              };
              return promiseLike;
            },
            orderBy: () => Promise.resolve(quizzesStore.filter((q) => !q._deleted)),
          }),
        }),
        insert: (table: any) => ({
          values: (data: any) => {
            quizIdCounter++;
            const row = { ...data, id: quizIdCounter, isPublished: false, shareToken: null, publishedAt: null };
            quizzesStore.push(row);
            return Promise.resolve([{ insertId: quizIdCounter }]);
          },
        }),
        update: (table: any) => ({
          set: (data: any) => ({
            where: (condition: any) => {
              // Apply update to the first quiz in store
              if (quizzesStore.length > 0) {
                Object.assign(quizzesStore[0], data);
              }
              return Promise.resolve([{ affectedRows: 1 }]);
            },
          }),
        }),
        delete: (table: any) => ({
          where: (condition: any) => Promise.resolve([{ affectedRows: 1 }]),
        }),
      };
      return mockDb;
    },
  };
});

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: "test-user-" + userId,
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

function createAnonContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

describe("quizMaker publish procedures", () => {
  beforeEach(() => {
    quizIdCounter = 0;
    quizzesStore.length = 0;
    // Seed a quiz owned by user 1
    quizIdCounter++;
    quizzesStore.push({
      id: 1,
      userId: 1,
      orgId: 1,
      createdBy: 1,
      title: "Test Quiz",
      description: "A test",
      instructions: JSON.stringify([{ id: "q1", type: "mcq", stem: "What?", points: 1, data: { choices: [{ id: "c1", text: "A", correct: true }], multiSelect: false } }]),
      passingScore: 70,
      timeLimit: null,
      maxAttempts: null,
      shuffleQuestions: false,
      shuffleAnswers: false,
      showFeedbackImmediately: true,
      showCorrectAnswers: true,
      isPublished: false,
      shareToken: null,
      publishedAt: null,
    });
  });

  describe("publish", () => {
    it("requires authentication", async () => {
      const ctx = createAnonContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.quizMaker.publish({ quizId: 1 })).rejects.toThrow();
    });

    it("publishes a quiz and returns a shareToken", async () => {
      const ctx = createAuthContext(1);
      const caller = appRouter.createCaller(ctx);
      const result = await caller.quizMaker.publish({ quizId: 1 });
      expect(result).toHaveProperty("shareToken");
      expect(typeof result.shareToken).toBe("string");
      expect(result.shareToken.length).toBe(16);
    });

    it("sets isPublished to true on the quiz", async () => {
      const ctx = createAuthContext(1);
      const caller = appRouter.createCaller(ctx);
      await caller.quizMaker.publish({ quizId: 1 });
      expect(quizzesStore[0].isPublished).toBe(true);
    });

    it("sets publishedAt timestamp", async () => {
      const ctx = createAuthContext(1);
      const caller = appRouter.createCaller(ctx);
      await caller.quizMaker.publish({ quizId: 1 });
      expect(quizzesStore[0].publishedAt).toBeInstanceOf(Date);
    });
  });

  describe("unpublish", () => {
    it("requires authentication", async () => {
      const ctx = createAnonContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.quizMaker.unpublish({ quizId: 1 })).rejects.toThrow();
    });

    it("sets isPublished to false", async () => {
      const ctx = createAuthContext(1);
      const caller = appRouter.createCaller(ctx);
      // First publish
      await caller.quizMaker.publish({ quizId: 1 });
      expect(quizzesStore[0].isPublished).toBe(true);
      // Then unpublish
      await caller.quizMaker.unpublish({ quizId: 1 });
      expect(quizzesStore[0].isPublished).toBe(false);
    });
  });

  describe("getPublishedQuiz", () => {
    it("works without authentication (public procedure)", async () => {
      const ctx = createAnonContext();
      const caller = appRouter.createCaller(ctx);
      // Publish first
      quizzesStore[0].isPublished = true;
      quizzesStore[0].shareToken = "testtoken12345678";

      const result = await caller.quizMaker.getPublishedQuiz({ shareToken: "testtoken12345678" });
      expect(result).toHaveProperty("title", "Test Quiz");
      expect(result).toHaveProperty("questions");
      expect(Array.isArray(result.questions)).toBe(true);
    });

    it("returns quiz settings", async () => {
      const ctx = createAnonContext();
      const caller = appRouter.createCaller(ctx);
      quizzesStore[0].isPublished = true;
      quizzesStore[0].shareToken = "testtoken12345678";

      const result = await caller.quizMaker.getPublishedQuiz({ shareToken: "testtoken12345678" });
      expect(result).toHaveProperty("passingScore", 70);
      expect(result).toHaveProperty("shuffleQuestions", false);
      expect(result).toHaveProperty("showCorrectAnswers", true);
    });

    it("rejects empty shareToken", async () => {
      const ctx = createAnonContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.quizMaker.getPublishedQuiz({ shareToken: "" })).rejects.toThrow();
    });
  });

  describe("getPublishStatus", () => {
    it("requires authentication", async () => {
      const ctx = createAnonContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.quizMaker.getPublishStatus({ quizId: 1 })).rejects.toThrow();
    });

    it("returns publish status for authenticated user", async () => {
      const ctx = createAuthContext(1);
      const caller = appRouter.createCaller(ctx);
      const result = await caller.quizMaker.getPublishStatus({ quizId: 1 });
      expect(result).toHaveProperty("isPublished", false);
      expect(result).toHaveProperty("shareToken", null);
      expect(result).toHaveProperty("publishedAt", null);
    });
  });
});
