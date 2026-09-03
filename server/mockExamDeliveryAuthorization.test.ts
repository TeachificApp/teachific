import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const fixture = vi.hoisted(() => ({ plan: "starter", status: "active" }));
const activeOrgId = 77;

vi.mock("./db", () => ({
  getDb: async () => {
    const row = {
      id: 12,
      orgId: activeOrgId,
      userId: 9,
      mockExamEnabled: true,
      isPublished: true,
      visibility: "published",
      shareToken: "published-mock-exam",
      instructions: "[]",
      title: "Mock exam",
      plan: fixture.plan,
      status: fixture.status,
    };
    const result = [row];
    const queryResult = {
      limit: async () => result,
      then: (resolve: (value: typeof result) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
    };
    return {
      select: () => ({ from: () => ({ where: () => queryResult }) }),
      update: () => ({ set: () => ({ where: async () => [{ affectedRows: 1 }] }) }),
    };
  },
  getOrgIdForUserWithFallback: async () => activeOrgId,
  requireOrgAdmin: async () => activeOrgId,
}));

const { appRouter } = await import("./routers");

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 9,
      openId: "pro-gated-mock-exam-admin",
      email: "admin@example.test",
      name: "Organization administrator",
      loginMethod: "manus",
      role: "org_admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

describe("Course360 mock-exam plan and delivery enforcement", () => {
  it("rejects cloud-save enablement and publication for a non-Pro organization", async () => {
    fixture.plan = "starter";
    fixture.status = "active";
    const caller = appRouter.createCaller(createAdminContext());

    await expect(caller.quizMaker.saveQuiz({
      quizId: 12,
      title: "Mock exam",
      questionsJson: "[]",
      settingsJson: JSON.stringify({ mockExamEnabled: true }),
    })).rejects.toThrow("Mock exams are available on Pro and Enterprise plans");
    await expect(caller.quizMaker.publishQuiz({ quizId: 12 }))
      .rejects.toThrow("Mock exams are available on Pro and Enterprise plans");
  });

  it("does not expose mock-exam mode from public delivery after subscription access becomes inactive", async () => {
    fixture.plan = "pro";
    fixture.status = "past_due";
    const caller = appRouter.createCaller(createAdminContext());

    const quiz = await caller.quizMaker.getPublishedQuiz({ shareToken: "published-mock-exam" });
    expect(quiz.mockExamEnabled).toBe(false);
  });

  it("exposes mock-exam mode only for an active Pro-or-higher organization", async () => {
    fixture.plan = "enterprise";
    fixture.status = "active";
    const caller = appRouter.createCaller(createAdminContext());

    const quiz = await caller.quizMaker.getPublishedQuiz({ shareToken: "published-mock-exam" });
    expect(quiz.mockExamEnabled).toBe(true);
  });
});
