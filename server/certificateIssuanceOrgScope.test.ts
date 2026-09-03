import { beforeEach, describe, expect, it, vi } from "vitest";

const organizationId = 77;
const templateRows: unknown[][] = [];
const insertedCertificate = vi.fn();
const sendCertificateEmail = vi.fn().mockResolvedValue(true);
const mockDb = {
  select: () => ({
    from: () => ({
      where: () => ({
        limit: async () => templateRows.shift() ?? [],
      }),
    }),
  }),
  insert: () => ({ values: insertedCertificate }),
};

vi.mock("./db", () => ({
  getDb: async () => mockDb,
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://files.example.test/certificate.pdf" }),
}));

vi.mock("./lib/certificateGenerator", () => ({
  generateCertificatePdf: vi.fn().mockResolvedValue(Buffer.from("certificate")),
}));

vi.mock("./lib/certificateEmail", () => ({ sendCertificateEmail }));

const { issueCertificateIfEnabled } = await import("./routers/lmsHelpers");

describe("Course360 certificate issuance organization scope", () => {
  beforeEach(() => {
    templateRows.length = 0;
    insertedCertificate.mockReset();
    sendCertificateEmail.mockReset().mockResolvedValue(true);
  });

  it("falls back to the completed course organization template and records and emails the same organization identity", async () => {
    templateRows.push(
      [{ orgId: organizationId, hasCertificate: true, title: "Org-owned course", certificateTemplateId: 999, creditHours: "1.5", certificateTitleOverride: null }],
      [],
      [{ name: "Taylor Learner", email: "taylor@example.test", displayName: null, credentials: null }],
      [{ name: "Northstar Learning", logoUrl: "https://assets.example.test/northstar.png", customSenderEmail: "learning@northstar.example", customSenderName: "Northstar Learning", senderDomainVerified: true }],
      [],
      [{ id: 123, orgId: organizationId, isDefault: true, titleText: "Certificate of Completion" }],
    );

    await issueCertificateIfEnabled(mockDb as any, 31, 22, 14, "learner");

    expect(insertedCertificate).toHaveBeenCalledWith(expect.objectContaining({
      orgId: organizationId,
      userId: 22,
      courseId: 14,
      enrollmentId: 31,
      templateId: 123,
    }));
    expect(sendCertificateEmail).toHaveBeenCalledWith(expect.objectContaining({
      organizationName: "Northstar Learning",
      organizationLogoUrl: "https://assets.example.test/northstar.png",
      senderEmail: "learning@northstar.example",
      senderName: "Northstar Learning",
    }));
  });
});
