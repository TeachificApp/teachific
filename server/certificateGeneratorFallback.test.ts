import { describe, expect, it } from "vitest";
import { resolveCertificateIdentity } from "./lib/certificateGenerator";

describe("Course360 certificate fallback identity", () => {
  it("uses neutral Course360 defaults when a certificate is not associated with an organization template", () => {
    expect(resolveCertificateIdentity()).toEqual({
      organizationName: "Course360™",
      signatureName: "Course360 Team",
      signatureTitle: "Certificate Administrator, Course360™",
      footerText: "© Course360™",
    });
  });

  it("preserves organization-owned certificate identity overrides", () => {
    expect(resolveCertificateIdentity({
      organizationName: "Example Academy",
      signatureText: "Jordan Lee",
      signatureTitleText: "Program Director",
      footerText: "Example Academy · Issued to the learner",
    })).toEqual({
      organizationName: "Example Academy",
      signatureName: "Jordan Lee",
      signatureTitle: "Program Director",
      footerText: "Example Academy · Issued to the learner",
    });
  });
});
