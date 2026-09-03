import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { buildQuizWidgetEmbed, hashQuizWidgetToken } from "./lib/quizWidgetLaunch";

const token = "w".repeat(48);
const quiz = { id: 12, orgId: 42, userId: 9, title: "Secure widget quiz", isPublished: true };
const inserted: Array<Record<string, unknown>> = [];
const updateCalls: Array<Record<string, unknown>> = [];
let selectResults: Array<unknown[]> = [];
let resolvedActiveOrgId = 42;

vi.mock("./db", () => ({
  getDb: async () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => selectResults.shift() ?? [],
        }),
      }),
    }),
    transaction: async (callback: (tx: any) => Promise<void>) => callback({
      update: () => ({
        set: (values: Record<string, unknown>) => {
          updateCalls.push(values);
          return { where: async () => ({}) };
        },
      }),
      insert: () => ({
        values: async (values: Record<string, unknown>) => {
          inserted.push(values);
          return [{ insertId: 1 }];
        },
      }),
    }),
  }),
  getOrgIdForUserWithFallback: async () => resolvedActiveOrgId,
  requireOrgAdmin: async () => 42,
}));

const { appRouter } = await import("./routers");

function context(user = true): TrpcContext {
  return {
    user: user ? {
      id: 9, openId: "widget-owner", email: "owner@example.test", name: "Widget owner",
      loginMethod: "manus", role: "org_admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    } : null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

describe("Course360 secure Quiz Creator widget launches", () => {
  it("hashes the opaque credential and constructs an origin-bound embed without persisting the raw token", async () => {
    const embed = buildQuizWidgetEmbed({ baseUrl: "https://academy.example/", token, quizTitle: "<Secure quiz>" });
    expect(embed.widgetUrl).toBe(`https://academy.example/quiz/widget?token=${token}`);
    expect(embed.embedCode).toContain('title="Secure quiz"');
    expect(embed.embedCode).not.toContain("shareToken");
    expect(hashQuizWidgetToken(token)).not.toBe(token);
  });

  it("rotates an authorized published organization quiz launch and persists only its digest", async () => {
    inserted.length = 0;
    updateCalls.length = 0;
    selectResults = [[quiz], [{ slug: "academy", customDomain: "academy.example", domainVerificationStatus: "verified" }]];
    const caller = appRouter.createCaller(context());
    const launch = await caller.quizMaker.createWidgetLaunch({ quizId: quiz.id, expiresInDays: 7 });
    expect(launch.widgetUrl).toMatch(/^https:\/\/academy\.example\/quiz\/widget\?token=/);
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ orgId: 42, quizId: 12, createdByUserId: 9 });
    expect(inserted[0].tokenHash).toEqual(expect.any(String));
    expect(inserted[0].tokenHash).not.toBe(launch.widgetUrl.split("token=")[1]);
    expect(updateCalls).toContainEqual(expect.objectContaining({ isActive: false }));
  });

  it("fails closed before lookup when a widget learner has not signed in", async () => {
    const caller = appRouter.createCaller(context(false));
    await expect(caller.quizMaker.getWidgetQuiz({ widgetToken: token })).rejects.toThrow("Sign in to access this embedded quiz.");
  });

  it("fails closed for revoked or expired widget credentials that are no longer returned by the active credential query", async () => {
    selectResults = [[]];
    const caller = appRouter.createCaller(context());
    await expect(caller.quizMaker.getWidgetQuiz({ widgetToken: token })).rejects.toThrow("This quiz widget is unavailable.");
  });

  it("rejects a signed-in learner whose server-resolved active organization does not own the widget", async () => {
    resolvedActiveOrgId = 77;
    selectResults = [[{ orgId: 42, quizId: 12 }]];
    const caller = appRouter.createCaller(context());
    await expect(caller.quizMaker.getWidgetQuiz({ widgetToken: token })).rejects.toThrow("This quiz widget is not available in the active organization.");
    resolvedActiveOrgId = 42;
  });

  it("delivers only the published owning-organization quiz through a valid signed-in widget credential", async () => {
    selectResults = [
      [{ orgId: 42, quizId: 12 }],
      [{ ...quiz, instructions: "[]", visibility: "published", mockExamEnabled: false }],
      [],
    ];
    const caller = appRouter.createCaller(context());
    const delivered = await caller.quizMaker.getWidgetQuiz({ widgetToken: token });
    expect(delivered).toMatchObject({ id: 12, title: "Secure widget quiz", questions: [] });
    expect(delivered).not.toHaveProperty("shareToken");
  });
});
