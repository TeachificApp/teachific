import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the database module
vi.mock("./db", () => {
  // In-memory store for quizzes
  let quizIdCounter = 0;
  const quizzesStore: any[] = [];

  return {
    requireOrgAdmin: () => Promise.resolve(1),
    getDb: () => {
      // Return a mock db object with chainable query methods
      const mockDb = {
        select: () => ({
          from: (table: any) => ({
            where: (condition: any) => ({
              orderBy: (order: any) => {
                // listQuizzes: return quizzes for user
                return Promise.resolve(quizzesStore.filter((q) => !q._deleted));
              },
              // For single select (getQuiz, etc.)
              then: undefined,
            }),
            orderBy: (order: any) => Promise.resolve(quizzesStore.filter((q) => !q._deleted)),
          }),
        }),
        insert: (table: any) => ({
          values: (data: any) => {
            quizIdCounter++;
            const row = { ...data, id: quizIdCounter };
            quizzesStore.push(row);
            return Promise.resolve([{ insertId: quizIdCounter }]);
          },
        }),
        update: (table: any) => ({
          set: (data: any) => ({
            where: (condition: any) => {
              // Simple mock update
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
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createAnonContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("quizMaker router", () => {
  describe("saveQuiz", () => {
    it("creates a new quiz when no quizId is provided", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.quizMaker.saveQuiz({
        title: "Test Quiz",
        description: "A test quiz",
        questionsJson: JSON.stringify([
          {
            id: "q1",
            type: "mcq",
            order: 1,
            points: 1,
            required: true,
            stem: "What is 2+2?",
            data: {
              choices: [
                { id: "c1", text: "4", correct: true },
                { id: "c2", text: "5", correct: false },
              ],
              multiSelect: false,
            },
          },
        ]),
        settingsJson: JSON.stringify({ passingScore: 70 }),
      });

      expect(result).toHaveProperty("id");
      expect(typeof result.id).toBe("number");
    });

    it("requires a title", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.quizMaker.saveQuiz({
          title: "",
          questionsJson: "[]",
        })
      ).rejects.toThrow();
    });

    it("requires questionsJson", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        (caller.quizMaker.saveQuiz as any)({
          title: "Test",
        })
      ).rejects.toThrow();
    });
  });

  describe("listQuizzes", () => {
    it("requires authentication", async () => {
      const ctx = createAnonContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.quizMaker.listQuizzes()).rejects.toThrow();
    });

    it("returns an array when authenticated", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.quizMaker.listQuizzes();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("deleteQuiz", () => {
    it("requires authentication", async () => {
      const ctx = createAnonContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.quizMaker.deleteQuiz({ quizId: 1 })
      ).rejects.toThrow();
    });
  });

  describe("input validation", () => {
    it("saveQuiz rejects title longer than 500 chars", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.quizMaker.saveQuiz({
          title: "x".repeat(501),
          questionsJson: "[]",
        })
      ).rejects.toThrow();
    });

    it("saveQuiz accepts valid input with optional fields", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.quizMaker.saveQuiz({
        title: "Minimal Quiz",
        questionsJson: "[]",
      });

      expect(result).toHaveProperty("id");
    });
  });
});
