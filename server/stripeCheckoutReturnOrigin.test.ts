import { describe, expect, it } from "vitest";
import {
  matchesVerifiedMemberCustomDomain,
  parseApprovedPlatformCheckoutOrigin,
} from "./stripeRouter";

describe("Course360 product checkout return origins", () => {
  it("accepts approved Course360, legacy compatibility, preview, and localhost browser origins", () => {
    expect(parseApprovedPlatformCheckoutOrigin("https://course360.app")).toBe("https://course360.app");
    expect(parseApprovedPlatformCheckoutOrigin("https://academy.course360.app")).toBe("https://academy.course360.app");
    expect(parseApprovedPlatformCheckoutOrigin("https://teachific.app")).toBe("https://teachific.app");
    expect(parseApprovedPlatformCheckoutOrigin("https://3000-example.manus.computer", "https://3000-example.manus.computer")).toBe("https://3000-example.manus.computer");
    expect(parseApprovedPlatformCheckoutOrigin("http://localhost:5173")).toBe("http://localhost:5173");
  });

  it("rejects arbitrary, lookalike, and insecure non-local platform return origins", () => {
    expect(parseApprovedPlatformCheckoutOrigin("https://attacker.example")).toBeNull();
    expect(parseApprovedPlatformCheckoutOrigin("https://course360.app.attacker.example")).toBeNull();
    expect(parseApprovedPlatformCheckoutOrigin("http://academy.course360.app")).toBeNull();
    expect(parseApprovedPlatformCheckoutOrigin("https://other-project.manus.computer", "https://this-project.manus.computer")).toBeNull();
  });

  it("accepts a custom domain only when it is verified for the authenticated member organization", () => {
    const memberOrganizations = [
      { customDomain: "learn.example-academy.org", domainVerificationStatus: "verified" },
      { customDomain: "pending.example-academy.org", domainVerificationStatus: "pending" },
    ];

    expect(matchesVerifiedMemberCustomDomain("learn.example-academy.org", memberOrganizations)).toBe(true);
    expect(matchesVerifiedMemberCustomDomain("pending.example-academy.org", memberOrganizations)).toBe(false);
    expect(matchesVerifiedMemberCustomDomain("other-school.example", memberOrganizations)).toBe(false);
  });
});
