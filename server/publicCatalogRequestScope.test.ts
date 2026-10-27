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

  it("accepts a forwarded organization host only from the Course360 Cloudflare Worker", () => {
    expect(getPublicRequestHostname({
      hostname: "scormhost-fjxmsdmk.manus.space",
      headers: {
        host: "scormhost-fjxmsdmk.manus.space",
        "cf-worker": "course360.app",
        "x-course360-original-host": "northwind.course360.app",
      },
    })).toBe("northwind.course360.app");

    expect(getPublicRequestHostname({
      hostname: "scormhost-fjxmsdmk.manus.space",
      headers: {
        host: "scormhost-fjxmsdmk.manus.space",
        "x-course360-original-host": "attacker.course360.app",
      },
    })).toBe("scormhost-fjxmsdmk.manus.space");

    expect(getPublicRequestHostname({
      hostname: "other-origin.example",
      headers: {
        host: "other-origin.example",
        "cf-worker": "course360.app",
        "x-course360-original-host": "attacker.course360.app",
      },
    })).toBe("other-origin.example");
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

  it("requires every public resolution path to select an active organization", () => {
    const scopeSource = readFileSync(new URL("./lib/publicOrgRequestScope.ts", import.meta.url), "utf8");
    const resolverSource = scopeSource.slice(
      scopeSource.indexOf("export async function resolvePublicOrganizationScope"),
    );
    expect((resolverSource.match(/eq\(organizations\.isActive, true\)/g) ?? []).length).toBeGreaterThanOrEqual(5);
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
    expect(publicSource).toContain("eq(lmsInstructors.orgId, publicScope.id)");
    expect(publicSource).toContain("eq(lmsCourseInstructors.orgId, publicScope.id)");
    expect(publicSource).not.toContain("getPrimaryOrgId()");
    expect(publicSource).not.toContain("sqRows");
    expect(publicSource).not.toContain('_source: "sono_quiz"');
  });

  it("keeps public download cards scoped, visibility-safe, and compatible with separately stored decimal prices", () => {
    const routerSource = readFileSync(new URL("./routers/lmsRouter.ts", import.meta.url), "utf8");
    const helperStart = routerSource.indexOf("async function listPublicDigitalProductCards");
    const helperEnd = routerSource.indexOf("// ─── Admin Router", helperStart);
    const helperSource = routerSource.slice(helperStart, helperEnd);
    expect(helperSource).toContain("eq(digitalProducts.orgId, orgId)");
    expect(helperSource).toContain("eq(digitalProducts.isPublished, true)");
    expect(helperSource).toContain('eq(digitalProducts.visibility, "published")');
    expect(helperSource).toContain("notInArray(digitalProducts.visibility, [\"hidden\", \"private\", \"archived\"])");
    expect(helperSource).toContain("digitalProductPrices.amount");
    expect(helperSource).toContain("eq(digitalProductPrices.isActive, true)");
    expect(helperSource).toContain('price: priceAmount');
    expect(helperSource).not.toContain("digitalProducts.status");
    expect(helperSource).not.toContain("digitalProducts.showInLibrary");
    expect(helperSource).not.toContain("digitalProducts.fileUrl");
    expect(helperSource).not.toContain("digitalProducts.fileKey");
    const publicSource = routerSource.slice(
      routerSource.indexOf("export const lmsPublicRouter"),
      routerSource.indexOf("export const lmsLearnerRouter"),
    );
    expect(publicSource).toContain("Number(count) + dpMapped.length");
    expect(publicSource).not.toContain("dpRows.length");
  });
});
