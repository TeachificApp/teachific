/**
 * certificateTemplates.test.ts
 * Unit tests for certificate template CRUD procedures in lmsAdminRouter.
 * Uses mocked DB helpers to avoid real database calls.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { TrpcContext } from "./_core/context";

// ── Mock the DB helpers ──────────────────────────────────────────────────────

vi.mock("./lmsDb", () => ({
  getLmsCertificateTemplatesByOrg: vi.fn().mockResolvedValue([
    {
      id: 1,
      orgId: 10,
      name: "Classic Teal",
      description: "Default teal template",
      primaryColorHex: "#189aa1",
      accentColorHex: "#c9a84c",
      textColorHex: "#0e1e2e",
      fontFamily: "Helvetica",
      layout: "classic",
      isDefault: true,
      showBorder: true,
      borderColorHex: "#189aa1",
      borderWidth: 3,
    },
  ]),
  getLmsCertificateTemplateById: vi.fn().mockResolvedValue({
    id: 1,
    orgId: 10,
    name: "Classic Teal",
    primaryColorHex: "#189aa1",
    accentColorHex: "#c9a84c",
    textColorHex: "#0e1e2e",
    fontFamily: "Helvetica",
    layout: "classic",
    isDefault: true,
  }),
  createLmsCertificateTemplate: vi.fn().mockResolvedValue({
    id: 2,
    orgId: 10,
    name: "Modern Blue",
    primaryColorHex: "#1a73e8",
    accentColorHex: "#fbbc04",
    textColorHex: "#202124",
    fontFamily: "Helvetica",
    layout: "modern",
    isDefault: false,
  }),
  updateLmsCertificateTemplate: vi.fn().mockResolvedValue({
    id: 1,
    name: "Classic Teal Updated",
    primaryColorHex: "#189aa1",
  }),
  deleteLmsCertificateTemplate: vi.fn().mockResolvedValue(undefined),
  listIssuedCertificates: vi.fn().mockResolvedValue([
    {
      id: 1,
      userId: 42,
      courseId: 5,
      enrollmentId: 100,
      templateId: 1,
      certificateUrl: "https://s3.example.com/cert.pdf",
      certificateNumber: "CERT-2024-001",
      issuedAt: new Date("2024-01-15"),
    },
  ]),
}));

vi.mock("./db", () => ({
  getOrgIdForUser: vi.fn().mockResolvedValue(10),
  requireOrgAdmin: vi.fn().mockResolvedValue(undefined),
  getDb: vi.fn().mockResolvedValue(null),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://s3.example.com/preview.pdf", key: "preview.pdf" }),
  storagePresignedPut: vi.fn().mockResolvedValue({ url: "https://s3.example.com/upload?sig=abc", key: "asset.png" }),
}));

// ── Test helpers ─────────────────────────────────────────────────────────────

function makeAdminCtx(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-user",
      email: "admin@teachific.com",
      name: "Admin User",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("lmsAdmin certificate templates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listCertificateTemplates returns templates for org", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.lmsAdmin.listCertificateTemplates({});
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("name");
    expect(result[0]).toHaveProperty("primaryColorHex");
  });

  it("getCertificateTemplate returns a single template by id", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.lmsAdmin.getCertificateTemplate({ id: 1 });
    expect(result).not.toBeNull();
    expect(result?.id).toBe(1);
    expect(result?.name).toBe("Classic Teal");
  });

  it("createCertificateTemplate creates a new template", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.lmsAdmin.createCertificateTemplate({
      name: "Modern Blue",
      primaryColorHex: "#1a73e8",
      accentColorHex: "#fbbc04",
      textColorHex: "#202124",
      layout: "modern",
    });
    expect(result).toHaveProperty("id");
    expect(result?.name).toBe("Modern Blue");
  });

  it("updateCertificateTemplate updates template fields", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.lmsAdmin.updateCertificateTemplate({
      id: 1,
      name: "Classic Teal Updated",
    });
    expect(result).toHaveProperty("name", "Classic Teal Updated");
  });

  it("deleteCertificateTemplate deletes a template", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.lmsAdmin.deleteCertificateTemplate({ id: 1 });
    expect(result).toEqual({ ok: true });
  });

  it("listIssuedCertificates returns issued certificates for org", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.lmsAdmin.listIssuedCertificates({});
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("certificateNumber");
    expect(result[0]).toHaveProperty("certificateUrl");
  });
});
