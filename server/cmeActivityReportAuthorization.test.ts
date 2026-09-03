import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { organizations } from "../drizzle/schema";

const mockState = vi.hoisted(() => ({ activeOrgId: 1, cmeEnabled: true }));

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getOrgIdForUserWithFallback: vi.fn(async () => mockState.activeOrgId),
    requireOrgAdmin: vi.fn(async () => mockState.activeOrgId),
    getDb: vi.fn(async () => ({
      select: () => ({
        from: (table: unknown) => ({
          where: () => ({
            limit: async () => table === organizations ? [{ cmeEnabled: mockState.cmeEnabled }] : [],
          }),
        }),
      }),
    })),
  };
});

const { cmeActivityFormRouter } = await import("./routers/cmeActivityFormRouter");

function createContext(): TrpcContext {
  return {
    user: {
      id: 44, openId: "cme-report-admin", email: "admin@example.test", name: "Administrator", loginMethod: "test", role: "org_admin",
      createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    },
    req: {} as TrpcContext["req"], res: {} as TrpcContext["res"],
  };
}

describe("Course360 CME activity report authorization", () => {
  beforeEach(() => { mockState.activeOrgId = 1; mockState.cmeEnabled = true; });

  it("rejects an organization administrator attempting to select a different organization for a CME activity report", async () => {
    const caller = cmeActivityFormRouter.createCaller(createContext());
    await expect(caller.getCmeActivityReport({ courseId: 7, page: 1, pageSize: 50, orgId: 2 }))
      .rejects.toMatchObject({ message: "CME activity forms must be managed from the active organization." });
  });

  it("rejects activity report access when CME is disabled for the active organization", async () => {
    mockState.cmeEnabled = false;
    const caller = cmeActivityFormRouter.createCaller(createContext());
    await expect(caller.getCmeActivityReport({ courseId: 7, page: 1, pageSize: 50 }))
      .rejects.toMatchObject({ message: "CME processing is not enabled for this organisation. Contact your platform administrator." });
  });
});
