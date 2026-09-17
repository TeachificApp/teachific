import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  activeOrgId: 9,
  inserted: [] as any[],
  authorizedOrgIds: [] as number[],
}));

vi.mock("../db", () => ({
  getDb: async () => ({
    insert: () => ({
      values: async (values: any) => {
        fixture.inserted.push(values);
        return [{ insertId: fixture.inserted.length }];
      },
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [],
          orderBy: async () => [],
        }),
      }),
    }),
  }),
  getOrgIdForUserWithFallback: vi.fn(async () => fixture.activeOrgId),
  requireOrgAdmin: vi.fn(async (_userId: number, _role: string, orgId: number) => {
    fixture.authorizedOrgIds.push(orgId);
    return orgId;
  }),
}));

import { quizRouter } from "./quizRouter";

const caller = () => quizRouter.createCaller({ user: { id: 11, role: "org_admin" } } as any);

describe("legacy Quiz Creator active organization enforcement", () => {
  beforeEach(() => {
    fixture.activeOrgId = 9;
    fixture.inserted.splice(0);
    fixture.authorizedOrgIds.splice(0);
  });

  it("ignores a caller-provided organization and persists a decimal-dollar price in the active organization", async () => {
    await caller().createQuiz({
      orgId: 77,
      title: "Scoped Quiz",
      priceAmount: 19.95,
    });

    expect(fixture.authorizedOrgIds).toEqual([9]);
    expect(fixture.inserted).toHaveLength(1);
    expect(fixture.inserted[0]).toMatchObject({
      orgId: 9,
      title: "Scoped Quiz",
      priceAmount: "19.95",
    });
  });
});
