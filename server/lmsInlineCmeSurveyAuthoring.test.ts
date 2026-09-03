import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { lmsCourses, lmsLessons, organizations, users } from "../drizzle/schema";

const mockState = vi.hoisted(() => ({
  activeOrgId: 1,
  cmeEnabled: true,
  userRole: "member",
}));

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getDb: vi.fn(async () => ({
      select: () => ({
        from: (table: unknown) => ({
          where: () => ({
            limit: async () => {
              if (table === users) return [{ role: mockState.userRole }];
              if (table === lmsLessons) return [{ id: 21, courseId: 7, sectionId: null }];
              if (table === lmsCourses) return [{ orgId: 1 }];
              if (table === organizations) return [{ cmeEnabled: mockState.cmeEnabled }];
              return [];
            },
          }),
        }),
      }),
    })),
    getOrgIdForUserWithFallback: vi.fn(async () => mockState.activeOrgId),
    requireOrgAdmin: vi.fn(async () => 1),
  };
});

const { lmsCourseBuilderRouter } = await import("./routers/lmsCourseBuilderRouter");

function createContext(role: string): TrpcContext {
  return {
    user: {
      id: 44,
      openId: `author-${role}`,
      email: "author@example.test",
      name: "Author",
      loginMethod: "test",
      role: role as any,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const cmeSurveyBlocks = JSON.stringify([{
  id: "feedback-block",
  type: "lesson_quiz",
  data: {
    isSurvey: true,
    questions: [{ id: "recommend", type: "survey_choice", question: "Recommend this course?", options: ["Yes", "No"] }],
  },
}]);

describe("Course360 inline CME survey authoring authorization", () => {
  beforeEach(() => {
    mockState.activeOrgId = 1;
    mockState.cmeEnabled = true;
    mockState.userRole = "member";
  });

  it("rejects a member from saving CME survey settings", async () => {
    const caller = lmsCourseBuilderRouter.createCaller(createContext("member"));
    await expect(caller.updateLesson({ id: 21, contentBlocks: cmeSurveyBlocks }))
      .rejects.toMatchObject({ message: "Admin access required" });
  });

  it("rejects an organization administrator whose active organization does not own the lesson course", async () => {
    mockState.activeOrgId = 2;
    const caller = lmsCourseBuilderRouter.createCaller(createContext("org_admin"));
    await expect(caller.updateLesson({ id: 21, contentBlocks: cmeSurveyBlocks }))
      .rejects.toMatchObject({ message: "This course does not belong to the active organization" });
  });

  it("rejects CME survey settings when an authorized organization administrator's active organization has CME disabled", async () => {
    mockState.cmeEnabled = false;
    const caller = lmsCourseBuilderRouter.createCaller(createContext("org_admin"));
    await expect(caller.updateLesson({ id: 21, contentBlocks: cmeSurveyBlocks }))
      .rejects.toMatchObject({ message: "CME survey settings are available only for CME-enabled organizations" });
  });
});
