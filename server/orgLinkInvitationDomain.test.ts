import { describe, expect, it } from "vitest";
import { getOrgLinkInvitationUrl } from "./lib/orgLinkInvitationUrl";

describe("Course360 organization-link invitation URLs", () => {
  it("uses the initiating organization’s verified custom domain for acceptance", () => {
    expect(getOrgLinkInvitationUrl({
      slug: "northstar",
      customDomain: "learn.northstar.example",
      domainVerificationStatus: "verified",
    }, "safe-token")).toBe("https://learn.northstar.example/org-link/accept?token=safe-token");
  });

  it("falls back to the Course360 organization subdomain and safely encodes the invitation token", () => {
    const url = getOrgLinkInvitationUrl({ slug: "northstar", customDomain: null, domainVerificationStatus: null }, "a token&value");
    expect(url).toContain("northstar.course360.app/org-link/accept?token=a%20token%26value");
    expect(url).not.toContain("teachific");
  });
});
