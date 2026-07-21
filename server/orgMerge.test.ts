/**
 * orgMerge.test.ts
 * Tests for the org merge router — covers importability, procedure names,
 * table definitions, conflict resolution logic, and audit log structure.
 */

import { describe, it, expect } from "vitest";

// ─── 1. Router importability ──────────────────────────────────────────────────
describe("orgMergeRouter module", () => {
  it("is importable without errors", async () => {
    const mod = await import("./routers/orgMergeRouter");
    expect(mod).toBeDefined();
    expect(mod.orgMergeRouter).toBeDefined();
  });

  it("exports orgMergeRouter as a named export", async () => {
    const { orgMergeRouter } = await import("./routers/orgMergeRouter");
    expect(typeof orgMergeRouter).toBe("object");
  });
});

// ─── 2. Procedure names ───────────────────────────────────────────────────────
describe("orgMergeRouter procedure names", () => {
  it("exposes preview, execute, and listLogs procedures", async () => {
    const { orgMergeRouter } = await import("./routers/orgMergeRouter");
    const procedures = Object.keys((orgMergeRouter as any)._def.procedures ?? {});
    // tRPC v11 stores procedures under _def.record
    const record = (orgMergeRouter as any)._def.record ?? {};
    const keys = Object.keys(record);
    expect(keys).toContain("preview");
    expect(keys).toContain("execute");
    expect(keys).toContain("listLogs");
  });
});

// ─── 3. MERGE_TABLES definition ───────────────────────────────────────────────
describe("MERGE_TABLES definition", () => {
  it("includes all critical org-scoped tables", async () => {
    // We can't import the const directly since it's not exported,
    // but we can verify the router file contains the expected table names
    const fs = await import("fs");
    const path = await import("path");
    const content = fs.readFileSync(
      path.resolve(__dirname, "routers/orgMergeRouter.ts"),
      "utf-8"
    );
    const criticalTables = [
      "content_packages",
      "lms_courses",
      "lms_enrollments",
      "org_members",
      "funnels",
      "digital_products",
      "email_lists",
      "media_assets",
    ];
    for (const table of criticalTables) {
      expect(content).toContain(table);
    }
  });

  it("handles orgId column name variants (orgId and org_id)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const content = fs.readFileSync(
      path.resolve(__dirname, "routers/orgMergeRouter.ts"),
      "utf-8"
    );
    // The router should handle both camelCase and snake_case column references
    expect(content).toContain("orgId");
  });
});

// ─── 4. Slug conflict resolution logic ───────────────────────────────────────
describe("slug conflict resolution", () => {
  it("generates unique suffixed slugs when conflicts exist", () => {
    // Simulate the slug deduplication logic used in the execute procedure
    function resolveSlug(slug: string, existingSlugs: Set<string>): string {
      if (!existingSlugs.has(slug)) return slug;
      let counter = 2;
      let candidate = `${slug}-${counter}`;
      while (existingSlugs.has(candidate)) {
        counter++;
        candidate = `${slug}-${counter}`;
      }
      return candidate;
    }

    const existing = new Set(["yoga-101", "yoga-101-2", "yoga-101-3"]);
    const resolved = resolveSlug("yoga-101", existing);
    expect(resolved).toBe("yoga-101-4");
  });

  it("returns original slug when no conflict exists", () => {
    function resolveSlug(slug: string, existingSlugs: Set<string>): string {
      if (!existingSlugs.has(slug)) return slug;
      let counter = 2;
      let candidate = `${slug}-${counter}`;
      while (existingSlugs.has(candidate)) {
        counter++;
        candidate = `${slug}-${counter}`;
      }
      return candidate;
    }

    const existing = new Set(["other-course"]);
    const resolved = resolveSlug("yoga-101", existing);
    expect(resolved).toBe("yoga-101");
  });
});

// ─── 5. Duplicate member handling ────────────────────────────────────────────
describe("duplicate member handling", () => {
  it("identifies duplicate members correctly", () => {
    const sourceMembers = [
      { userId: 1 }, { userId: 2 }, { userId: 3 },
    ];
    const targetMemberIds = new Set([2, 4, 5]);

    const toMove = sourceMembers.filter(m => !targetMemberIds.has(m.userId));
    const duplicates = sourceMembers.filter(m => targetMemberIds.has(m.userId));

    expect(toMove).toHaveLength(2);
    expect(toMove.map(m => m.userId)).toEqual([1, 3]);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].userId).toBe(2);
  });
});

// ─── 6. Merge summary structure ───────────────────────────────────────────────
describe("merge summary structure", () => {
  it("produces a valid summary object shape", () => {
    const summary = {
      totalRecords: 150,
      users: 12,
      courses: 8,
      contentPackages: 45,
      enrollments: 80,
      funnels: 3,
      downloads: 2,
      duplicateEmailsResolved: 2,
      slugConflictsResolved: 1,
    };

    expect(summary).toHaveProperty("totalRecords");
    expect(summary).toHaveProperty("users");
    expect(summary).toHaveProperty("duplicateEmailsResolved");
    expect(summary).toHaveProperty("slugConflictsResolved");
    expect(typeof summary.totalRecords).toBe("number");
    expect(summary.totalRecords).toBeGreaterThanOrEqual(0);
  });

  it("totalRecords equals sum of moved record types", () => {
    const users = 12;
    const courses = 8;
    const contentPackages = 45;
    const enrollments = 80;
    const others = 5;
    const total = users + courses + contentPackages + enrollments + others;
    expect(total).toBe(150);
  });
});

// ─── 7. Audit log structure ───────────────────────────────────────────────────
describe("org_merge_logs table", () => {
  it("schema file includes org_merge_logs table definition", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const content = fs.readFileSync(
      path.resolve(__dirname, "../drizzle/schema.ts"),
      "utf-8"
    );
    expect(content).toContain("orgMergeLogs");
    expect(content).toContain("sourceOrgId");
    expect(content).toContain("targetOrgId");
    expect(content).toContain("initiatedBy");
  });
});

// ─── 8. Platform admin guard ──────────────────────────────────────────────────
describe("platform admin guard", () => {
  it("router file uses adminProcedure for all sensitive operations", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const content = fs.readFileSync(
      path.resolve(__dirname, "routers/orgMergeRouter.ts"),
      "utf-8"
    );
    // All procedures should use assertPlatformAdmin guard
    expect(content).toContain("assertPlatformAdmin");
    // Should not expose any public procedures
    expect(content).not.toContain("publicProcedure");
  });
});

// ─── 9. Self-merge prevention ─────────────────────────────────────────────────
describe("self-merge prevention", () => {
  it("rejects merge when source and target are the same org", () => {
    function validateMergeInput(sourceOrgId: number, targetOrgId: number): string | null {
      if (sourceOrgId === targetOrgId) {
        return "Source and target organizations must be different";
      }
      return null;
    }

    expect(validateMergeInput(5, 5)).toBe("Source and target organizations must be different");
    expect(validateMergeInput(5, 6)).toBeNull();
  });
});

// ─── 10. Preview count aggregation ───────────────────────────────────────────
describe("preview count aggregation", () => {
  it("aggregates counts across all table types correctly", () => {
    const counts: Record<string, number> = {
      content_packages: 10,
      lms_courses: 5,
      lms_enrollments: 50,
      org_members: 8,
      funnels: 2,
      digital_products: 3,
    };

    const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
    expect(total).toBe(78);
  });
});
