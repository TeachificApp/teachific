import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const activeOrgId = 42;
const otherBankOrgId = 77;

vi.mock("./db", () => ({
  getDb: async () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [{ orgId: otherBankOrgId }],
        }),
      }),
    }),
  }),
  getOrgIdForUserWithFallback: async () => activeOrgId,
  requireOrgAdmin: async () => activeOrgId,
}));

const { appRouter } = await import("./routers");

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 9,
      openId: "multi-org-admin",
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

describe("quizBank.generateQuestions active organization authorization", () => {
  it("rejects an administrator-owned bank outside the server-resolved active organization before processing the source URL", async () => {
    const caller = appRouter.createCaller(createAdminContext());

    await expect(caller.quizBank.generateQuestions({
      bankId: 123,
      topic: "Cardiac ultrasound principles",
      sourceUrl: "https://example.org/reference",
    })).rejects.toThrow("not available in the active organization");
  });
});
