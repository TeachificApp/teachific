import { afterEach, describe, expect, it, vi } from "vitest";
import { sendCertificateEmail } from "./lib/certificateEmail";

const originalApiKey = process.env.SENDGRID_API_KEY;
const originalSenderEmail = process.env.SENDGRID_FROM_EMAIL;
const originalSenderName = process.env.SENDGRID_FROM_NAME;

afterEach(() => {
  process.env.SENDGRID_API_KEY = originalApiKey;
  process.env.SENDGRID_FROM_EMAIL = originalSenderEmail;
  process.env.SENDGRID_FROM_NAME = originalSenderName;
  vi.unstubAllGlobals();
});

describe("Course360 certificate email branding", () => {
  it("uses the owning organization identity and verified sender without source branding or unsupported validity claims", async () => {
    process.env.SENDGRID_API_KEY = "test-key";
    process.env.SENDGRID_FROM_EMAIL = "fallback@course360.app";
    process.env.SENDGRID_FROM_NAME = "Course360™";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendCertificateEmail({
      to: { name: "Taylor Learner", email: "taylor@example.test" },
      courseTitle: "Advanced Course",
      certificateUrl: "https://files.example.test/certificate.pdf",
      pdfBuffer: Buffer.from("certificate"),
      issuedAt: new Date("2026-09-03T00:00:00.000Z"),
      organizationName: "Northstar Learning",
      organizationLogoUrl: "https://assets.example.test/northstar-logo.png",
      senderName: "Northstar Learning",
      senderEmail: "learning@northstar.example",
    })).resolves.toBe(true);

    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    const html = payload.content[0].value as string;
    expect(payload.from).toEqual({ name: "Northstar Learning", email: "learning@northstar.example" });
    expect(html).toContain("Northstar Learning");
    expect(html).toContain("northstar-logo.png");
    expect(html).toContain("a SoundMedia, Inc. brand");
    expect(html).not.toContain("Teachific");
    expect(html).not.toContain("General &amp; Vascular Ultrasound");
    expect(html).not.toContain("valid for professional portfolio use");
  });
});
