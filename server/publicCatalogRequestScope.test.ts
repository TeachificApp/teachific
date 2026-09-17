import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  getPublicRequestHostname,
  normalizePublicHostname,
  resolvePublicOrganizationScope,
} from "./lib/publicOrgRequestScope";

function dbWithRows(rows: unknown[][]) {
  return {
    select: () => {
      const chain = {
        from: () => chain,
        where: () => chain,
        limit: async () => rows.shift() ?? [],
      };
      return chain;
    },
  } as any;
}

describe("Course360 public catalog request scope", () => {
  it("normalizes only a hostname from the actual request host", () => {
    expect(normalizePublicHostname("https://WWW.learn.northwind.example/path")).toBe("learn.northwind.example");
    expect(getPublicRequestHostname({
      hostname: "northwind.course360.app",
      headers: { "x-forwarded-host": "attacker.course360.app", host: "ignored.example" },
    })).toBe("northwind.course360.app");
  });

  it("gives a verified custom learner domain precedence over a legacy orgSlug hint", async () => {
    const scope = await resolvePublicOrganizationScope(dbWithRows([[{ id: 7, slug: "northwind" }]]), {
      headers: { host: "learn.northwind.example:443" },
    }, "attacker");

    expect(scope).toEqual({ id: 7, slug: "northwind", source: "custom_domain" });
  });

  it("uses a Course360 organization subdomain and rejects unknown custom hosts", async () => {
    await expect(resolvePublicOrganizationScope(dbWithRows([[{ id: 8, slug: "northwind" }]]), {
      headers: { host: "northwind.course360.app" },
    })).resolves.toEqual({ id: 8, slug: "northwind", source: "course360_subdomain" });

    await expect(resolvePublicOrganizationScope(dbWithRows([[], []]), {
      headers: { host: "unknown.example" },
    }, "northwind")).resolves.toBeNull();
  });

  it("permits the legacy orgSlug only on a platform request", async () => {
    await expect(resolvePublicOrganizationScope(dbWithRows([[{ id: 9, slug: "northwind" }]]), {
      headers: { host: "www.course360.app" },
    }, "NorthWind")).resolves.toEqual({ id: 9, slug: "northwind", source: "legacy_hint" });
  });

  it("applies server request scope to catalog, featured, and direct course paths", () => {
    const routerSource = readFileSync(new URL("./routers/lmsRouter.ts", import.meta.url), "utf8");
    const publicSource = routerSource.slice(
      routerSource.indexOf("export const lmsPublicRouter"),
      routerSource.indexOf("export const lmsLearnerRouter"),
    );

    expect(publicSource).toContain("resolvePublicOrganizationScope(db as any, ctx.req, input.orgSlug)");
    expect(publicSource).toContain("eq(lmsCourses.orgId, publicScope.id)");
    expect(publicSource).toContain("listFeatured: publicProcedure");
    expect(publicSource).not.toContain("getPrimaryOrgId()");
    expect(publicSource).not.toContain("sqRows");
    expect(publicSource).not.toContain('_source: "sono_quiz"');
  });
});
