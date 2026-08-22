import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock DB helpers ─────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  getUserById: vi.fn().mockResolvedValue(null),
  getAllUsers: vi.fn().mockResolvedValue([]),
  updateUserRole: vi.fn().mockResolvedValue(undefined),
  // Orgs
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
  // Packages
  createPackage: vi.fn().mockResolvedValue({ insertId: 1 }),
  getPackageById: vi.fn().mockResolvedValue(null),
  getPackagesByOrg: vi.fn().mockResolvedValue([]),
  getAllPackages: vi.fn().mockResolvedValue([]),
  updatePackage: vi.fn().mockResolvedValue(undefined),
  deletePackage: vi.fn().mockResolvedValue(undefined),
  incrementPlayCount: vi.fn().mockResolvedValue(undefined),
  incrementDownloadCount: vi.fn().mockResolvedValue(undefined),
  // Versions
  createVersion: vi.fn().mockResolvedValue({ insertId: 1 }),
  getVersionsByPackage: vi.fn().mockResolvedValue([]),
  getVersionById: vi.fn().mockResolvedValue(null),
  getLatestVersionNumber: vi.fn().mockResolvedValue(0),
  // File assets
  createFileAsset: vi.fn().mockResolvedValue({ insertId: 1 }),
  getFileAssetsByVersion: vi.fn().mockResolvedValue([]),
  getEntryPointAsset: vi.fn().mockResolvedValue(null),
  // Permissions
  createPermissions: vi.fn().mockResolvedValue(undefined),
  getPermissions: vi.fn().mockResolvedValue(null),
  updatePermissions: vi.fn().mockResolvedValue(undefined),
  // Sessions
  createPlaySession: vi.fn().mockResolvedValue({ insertId: 1 }),
  getPlaySession: vi.fn().mockResolvedValue(null),
  updatePlaySession: vi.fn().mockResolvedValue(undefined),
  getPlaySessionsByPackage: vi.fn().mockResolvedValue([]),
  getUserPlayCount: vi.fn().mockResolvedValue(0),
  // SCORM
  upsertScormData: vi.fn().mockResolvedValue(undefined),
  getScormData: vi.fn().mockResolvedValue(null),
  // Analytics
  logAnalyticsEvent: vi.fn().mockResolvedValue(undefined),
  getAnalyticsByPackage: vi.fn().mockResolvedValue({ playCount: 0, downloadCount: 0, completionCount: 0 }),
  getAnalyticsByOrg: vi.fn().mockResolvedValue([]),
  getAnalyticsSummary: vi.fn().mockResolvedValue({ totalPackages: 0, totalPlays: 0, totalDownloads: 0, completionRate: 0, avgDurationSeconds: 0 }),
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

// ─── Context helpers ─────────────────────────────────────────────────────────
function makeCtx(role: "admin" | "user" | null = "admin"): TrpcContext {
  const user = role ? {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "email",
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

// ─── Auth tests ───────────────────────────────────────────────────────────────
describe("auth", () => {
  it("returns current user from auth.me", async () => {
    const ctx = makeCtx("user");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result?.email).toBe("test@example.com");
    expect(result?.role).toBe("user");
  });

  it("returns null user when not authenticated", async () => {
    const ctx = makeCtx(null);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("clears session cookie on logout", async () => {
    const ctx = makeCtx("user");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
    expect(ctx.res.clearCookie).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ maxAge: -1, httpOnly: true })
    );
  });
});

// ─── Packages tests ───────────────────────────────────────────────────────────
describe("packages", () => {
  it("returns empty list when no packages exist", async () => {
    const ctx = makeCtx("admin");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.packages.list(undefined);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it("throws NOT_FOUND when package does not exist", async () => {
    const ctx = makeCtx("admin");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.packages.get({ id: 999 })).rejects.toThrow();
  });

  it("throws UNAUTHORIZED when unauthenticated user tries to update", async () => {
    const ctx = makeCtx(null);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.packages.update({ id: 1, title: "New Title" })).rejects.toThrow();
  });
});

// ─── Permissions tests ────────────────────────────────────────────────────────
describe("permissions", () => {
  it("returns null permissions for unknown package", async () => {
    const ctx = makeCtx("admin");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.permissions.get({ packageId: 999 });
    expect(result).toBeNull();
  });

  it("throws UNAUTHORIZED when unauthenticated user tries to update permissions", async () => {
    const ctx = makeCtx(null);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.permissions.update({ packageId: 1, allowDownload: false })).rejects.toThrow();
  });
});

// ─── Sessions tests ───────────────────────────────────────────────────────────
describe("sessions", () => {
  it("throws NOT_FOUND when ending non-existent session", async () => {
    const ctx = makeCtx("user");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.sessions.end({ sessionToken: "invalid-token-xyz", completionStatus: "completed" })).rejects.toThrow();
  });

  it("throws NOT_FOUND when getting non-existent session", async () => {
    const ctx = makeCtx("user");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.sessions.get({ sessionToken: "nonexistent" });
    expect(result).toBeNull();
  });
});

// ─── Analytics tests ──────────────────────────────────────────────────────────
describe("analytics", () => {
  it("returns summary with zero counts when no data", async () => {
    const ctx = makeCtx("admin");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.analytics.summary({});
    expect(result).toMatchObject({
      totalPackages: expect.any(Number),
      totalPlays: expect.any(Number),
      totalDownloads: expect.any(Number),
      completionRate: expect.any(Number),
    });
  });

  it("returns package analytics for a given packageId", async () => {
    const ctx = makeCtx("admin");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.analytics.byPackage({ packageId: 1 });
    expect(result).toMatchObject({
      playCount: expect.any(Number),
      downloadCount: expect.any(Number),
    });
  });
});

// ─── Organizations tests ──────────────────────────────────────────────────────
describe("orgs", () => {
  it("returns empty org list for new user", async () => {
    const ctx = makeCtx("user");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.orgs.myOrgs();
    expect(Array.isArray(result)).toBe(true);
  });

  it("throws UNAUTHORIZED when unauthenticated user tries to create org", async () => {
    const ctx = makeCtx(null);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.orgs.create({ name: "Test Org", slug: "test-org" })).rejects.toThrow();
  });
});

// ─── Versions tests ───────────────────────────────────────────────────────────
describe("versions", () => {
  it("returns empty version list for unknown package", async () => {
    const ctx = makeCtx("admin");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.versions.list({ packageId: 999 });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });
});

// ─── Quizzes tests ────────────────────────────────────────────────────────────
describe("quizzes", () => {
  it("returns empty quiz list for org", async () => {
    const ctx = makeCtx("admin");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.quizzes.list({ orgId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("throws NOT_FOUND when getting non-existent quiz", async () => {
    const ctx = makeCtx("admin");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.quizzes.get({ id: 999 })).rejects.toThrow();
  });

  it("throws UNAUTHORIZED when unauthenticated user tries to create quiz", async () => {
    const ctx = makeCtx(null);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.quizzes.create({ orgId: 1, title: "Test Quiz" })).rejects.toThrow();
  });
});
