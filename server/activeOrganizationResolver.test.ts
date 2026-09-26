import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
const canonicalSlice = source.slice(
  source.indexOf("export async function getOrgIdForUser"),
  source.indexOf("/**\n * Returns the ID of the primary"),
);
const fallbackSlice = source.slice(
  source.indexOf("export async function getOrgIdForUserWithFallback"),
  source.indexOf("/**\n * Shared helper: verify the current user has org admin access."),
);

describe("active organization resolution", () => {
  it("uses only active memberships for canonical member context", () => {
    expect(canonicalSlice).toContain("eq(organizations.isActive, true)");
    expect(canonicalSlice).not.toContain("from(userActiveOrg)");
  });

  it("permits an active selected context only for administrators", () => {
    expect(fallbackSlice).toContain("[\"org_super_admin\", \"org_admin\", \"sub_admin\"].includes");
    expect(fallbackSlice).toContain("innerJoin(organizations, eq(orgMembers.orgId, organizations.id))");
    expect(fallbackSlice).toContain("eq(organizations.isActive, true)");
    expect(fallbackSlice).toContain("const orgId = await getOrgIdForUser(userId)");
  });

  it("does not select a deactivated primary organization for platform fallback", () => {
    const primarySlice = source.slice(
      source.indexOf("export async function getPrimaryOrgId"),
      source.indexOf("/**\n * Returns the active organization"),
    );
    expect(primarySlice).toContain("eq(organizations.isActive, true)");
  });
});
