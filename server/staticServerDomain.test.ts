import { describe, expect, it } from "vitest";
import { getOrgMetadataUrl, getOrgSlugFromHostname } from "./_core/staticServer";

describe("Course360 static organization metadata routing", () => {
  it("recognizes Course360 and legacy platform subdomains without treating reserved names as organizations", () => {
    expect(getOrgSlugFromHostname("school.course360.app")).toBe("school");
    expect(getOrgSlugFromHostname("school.teachific.app")).toBe("school");
    expect(getOrgSlugFromHostname("learn.course360.app")).toBeNull();
    expect(getOrgSlugFromHostname("course360.app")).toBeNull();
    expect(getOrgSlugFromHostname("www.course360.app")).toBeNull();
    expect(getOrgSlugFromHostname("school.other.example")).toBeNull();
  });

  it("uses a verified custom domain as the organization metadata canonical URL", () => {
    expect(getOrgMetadataUrl({
      slug: "school",
      customDomain: "learn.example.org",
      domainVerificationStatus: "verified",
    })).toBe("https://learn.example.org/");
  });

  it("uses the Course360 organization subdomain when a custom domain is unverified", () => {
    expect(getOrgMetadataUrl({
      slug: "school",
      customDomain: "learn.example.org",
      domainVerificationStatus: "pending",
    })).toBe("https://school.course360.app/");
  });
});
