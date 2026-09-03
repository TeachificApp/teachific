import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const activeOrgId = 42;
const quizOrgId = 77;

vi.mock("./db", () => ({
  getDb: async () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [{ id: 12, orgId: quizOrgId, userId: 9, mockExamEnabled: true }],
        }),
      }),
    }),
  }),
  getOrgIdForUserWithFallback: async () => activeOrgId,
  requireOrgAdmin: async () => activeOrgId,
}));

const { appRouter } = await import("./routers");

function createMultiOrgAdminContext(): TrpcContext {
  return {
    user: {
      id: 9,
      openId: "mock-exam-multi-org-admin",
      email: "admin@example.test",
      name: "Multi-org administrator",
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

describe("Course360 mock-exam active organization enforcement", () => {
  it("rejects mock-exam enablement for an organization other than the server-resolved active organization", async () => {
    const caller = appRouter.createCaller(createMultiOrgAdminContext());
    await expect(caller.quizMaker.updateQuiz({ quizId: 12, mockExamEnabled: true }))
      .rejects.toThrow("Switch to the quiz organization before managing this Quiz Creator item.");
  });

  it("rejects cloud-save mock-exam enablement and publication for an organization other than the server-resolved active organization", async () => {
    const caller = appRouter.createCaller(createMultiOrgAdminContext());
    await expect(caller.quizMaker.saveQuiz({
      quizId: 12,
      title: "Cross-organization mock exam",
      questionsJson: "[]",
      settingsJson: JSON.stringify({ mockExamEnabled: true }),
    })).rejects.toThrow("Switch to the quiz organization before managing this Quiz Creator item.");
    await expect(caller.quizMaker.publishQuiz({ quizId: 12 }))
      .rejects.toThrow("Switch to the quiz organization before managing this Quiz Creator item.");
  });

  it("rejects direct Quiz Creator management and staff-preview access outside the active organization", async () => {
    const caller = appRouter.createCaller(createMultiOrgAdminContext());
    await expect(caller.quizMaker.getQuiz({ quizId: 12 }))
      .rejects.toThrow("Switch to the quiz organization before managing this Quiz Creator item.");
    await expect(caller.quizMaker.getStaffPreviewQuiz({ quizId: 12 }))
      .rejects.toThrow("Switch to the quiz organization before managing this Quiz Creator item.");
  });
});
