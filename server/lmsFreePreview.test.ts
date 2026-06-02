/**
 * lmsFreePreview.test.ts
 * Tests for the lmsLearnerRouter.enrollFreePreview procedure.
 * Uses mocked DB to avoid real database calls.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock DB ─────────────────────────────────────────────────────────────────
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => mockSelect(),
        }),
      }),
    }),
    insert: () => ({
      values: () => ({
        $returningId: () => mockInsert(),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => mockUpdate(),
      }),
    }),
  }),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  getUserById: vi.fn().mockResolvedValue(null),
  getAllUsers: vi.fn().mockResolvedValue([]),
  updateUserRole: vi.fn().mockResolvedValue(undefined),
  createOrg: vi.fn().mockResolvedValue({ insertId: 1 }),
  getOrgById: vi.fn().mockResolvedValue(null),
  getOrgBySlug: vi.fn().mockResolvedValue(null),
  getAllOrgs: vi.fn().mockResolvedValue([]),
  updateOrg: vi.fn().mockResolvedValue(undefined),
  getOrgsByUserId: vi.fn().mockResolvedValue([]),
  addOrgMember: vi.fn().mockResolvedValue(undefined),
  getOrgMembers: vi.fn().mockResolvedValue([]),
  getOrgMember: vi.fn().mockResolvedValue(null),
  removeOrgMember: vi.fn().mockResolvedValue(undefined),
  updateOrgMemberRole: vi.fn().mockResolvedValue(undefined),
  createPackage: vi.fn().mockResolvedValue({ insertId: 1 }),
  getPackageById: vi.fn().mockResolvedValue(null),
  getPackagesByOrg: vi.fn().mockResolvedValue([]),
  getAllPackages: vi.fn().mockResolvedValue([]),
  updatePackage: vi.fn().mockResolvedValue(undefined),
  deletePackage: vi.fn().mockResolvedValue(undefined),
  incrementPlayCount: vi.fn().mockResolvedValue(undefined),
  incrementDownloadCount: vi.fn().mockResolvedValue(undefined),
  createVersion: vi.fn().mockResolvedValue({ insertId: 1 }),
  getVersionsByPackage: vi.fn().mockResolvedValue([]),
  getVersionById: vi.fn().mockResolvedValue(null),
  getLatestVersionNumber: vi.fn().mockResolvedValue(0),
  createFileAsset: vi.fn().mockResolvedValue({ insertId: 1 }),
  getFileAssetsByVersion: vi.fn().mockResolvedValue([]),
  getEntryPointAsset: vi.fn().mockResolvedValue(null),
  createPermissions: vi.fn().mockResolvedValue(undefined),
  getPermissions: vi.fn().mockResolvedValue(null),
  updatePermissions: vi.fn().mockResolvedValue(undefined),
  createPlaySession: vi.fn().mockResolvedValue({ insertId: 1 }),
  getPlaySession: vi.fn().mockResolvedValue(null),
  updatePlaySession: vi.fn().mockResolvedValue(undefined),
  getPlaySessionsByPackage: vi.fn().mockResolvedValue([]),
  getUserPlayCount: vi.fn().mockResolvedValue(0),
  upsertScormData: vi.fn().mockResolvedValue(undefined),
  getScormData: vi.fn().mockResolvedValue(null),
  logAnalyticsEvent: vi.fn().mockResolvedValue(undefined),
  getAnalyticsByPackage: vi.fn().mockResolvedValue({ playCount: 0, downloadCount: 0, completionCount: 0 }),
  getAnalyticsByOrg: vi.fn().mockResolvedValue([]),
  getAnalyticsSummary: vi.fn().mockResolvedValue({ totalPackages: 0, totalPlays: 0, totalDownloads: 0, completionRate: 0, avgDurationSeconds: 0 }),
  getOrCreateAccessToken: vi.fn().mockResolvedValue("test-token"),
}));

vi.mock("./quizDb", () => ({
  getQuizzesByOrg: vi.fn().mockResolvedValue([]),
  getQuizById: vi.fn().mockResolvedValue(null),
  createQuiz: vi.fn().mockResolvedValue({ insertId: 1 }),
  updateQuiz: vi.fn().mockResolvedValue(undefined),
  deleteQuiz: vi.fn().mockResolvedValue(undefined),
  upsertQuestions: vi.fn().mockResolvedValue(undefined),
  getQuestionsByQuiz: vi.fn().mockResolvedValue([]),
  startAttempt: vi.fn().mockResolvedValue({ insertId: 1 }),
  saveResponse: vi.fn().mockResolvedValue(undefined),
  submitAttempt: vi.fn().mockResolvedValue({ score: 80, passed: true, correctCount: 8, totalQuestions: 10 }),
  getAttemptsByQuiz: vi.fn().mockResolvedValue([]),
  getQuizAnalytics: vi.fn().mockResolvedValue({ totalAttempts: 0, avgScore: 0, passRate: 0 }),
}));

// ─── Context helpers ──────────────────────────────────────────────────────────
function makeCtx(role: "admin" | "user" | null = "user"): TrpcContext {
  const user = role ? {
    id: 42,
    openId: "test-user-42",
    email: "learner@example.com",
    name: "Test Learner",
    loginMethod: "email" as const,
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  } : null;
  return {
    user,
    req: { protocol: "https", headers: {}, socket: {} } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
      cookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("lmsLearner.enrollFreePreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should throw UNAUTHORIZED when user is not logged in", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(
      caller.lmsLearner.enrollFreePreview({ courseSlug: "test-course" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("should throw NOT_FOUND when course does not exist", async () => {
    // DB returns empty array for course lookup
    mockSelect.mockResolvedValueOnce([]); // course lookup returns nothing
    const caller = appRouter.createCaller(makeCtx("user"));
    await expect(
      caller.lmsLearner.enrollFreePreview({ courseSlug: "nonexistent-course" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("should return existing enrollment when user is already enrolled", async () => {
    // First select: course found
    mockSelect.mockResolvedValueOnce([{ id: 10, orgId: 1, title: "Test Course" }]);
    // Second select: existing enrollment found
    mockSelect.mockResolvedValueOnce([{ id: 99, enrollmentType: "paid" }]);

    const caller = appRouter.createCaller(makeCtx("user"));
    const result = await caller.lmsLearner.enrollFreePreview({ courseSlug: "test-course" });

    expect(result).toEqual({ enrollmentId: 99, enrollmentType: "paid", created: false });
    // Should not insert a new enrollment
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("should create a free_preview enrollment for a new user", async () => {
    // First select: course found
    mockSelect.mockResolvedValueOnce([{ id: 10, orgId: 1, title: "Test Course" }]);
    // Second select: no existing enrollment
    mockSelect.mockResolvedValueOnce([]);
    // Insert returns new enrollment ID
    mockInsert.mockResolvedValueOnce([{ id: 123 }]);

    const caller = appRouter.createCaller(makeCtx("user"));
    const result = await caller.lmsLearner.enrollFreePreview({ courseSlug: "test-course" });

    expect(result).toEqual({ enrollmentId: 123, enrollmentType: "free_preview", created: true });
  });
});
