import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getOrgCustomPageUrl } from "./lib/orgUrl";

describe("Course360 Custom Page tenant scope", () => {
  it("builds Custom Page URLs on the owning organization domain", () => {
    expect(getOrgCustomPageUrl("northstar", "about-us")).toBe("https://northstar.course360.app/p/about-us");
    expect(getOrgCustomPageUrl("northstar", "about us", "learn.northstar.example", "verified"))
      .toBe("https://learn.northstar.example/p/about%20us");
    expect(getOrgCustomPageUrl("northstar", "about-us", "learn.northstar.example", "pending"))
      .toBe("https://northstar.course360.app/p/about-us");
  });

  it("selects a public page by its verified request organization as well as slug", () => {
    const dbSource = readFileSync(new URL("./lmsDb.ts", import.meta.url), "utf8");
    const routerSource = readFileSync(new URL("./lmsRouter.ts", import.meta.url), "utf8");
    const start = routerSource.indexOf("getBySlug: publicProcedure");
    const end = routerSource.indexOf("create: protectedProcedure", start);
    const publicPageSource = routerSource.slice(start, end);

    expect(dbSource).toContain("getPublishedPageBySlugForOrg(orgId: number, slug: string)");
    expect(dbSource).toContain("eq(pageBuilderPages.orgId, orgId)");
    expect(dbSource).toContain("eq(pageBuilderPages.slug, slug)");
    expect(dbSource).toContain("eq(pageBuilderPages.isPublished, true)");
    expect(publicPageSource).toContain("resolvePublicOrganizationScope(db as any, ctx.req, input.orgSlug)");
    expect(publicPageSource).toContain("getPublishedPageBySlugForOrg(publicScope.id, input.slug)");
    expect(publicPageSource).not.toContain("getPublishedPageBySlug(input.slug)");
  });

  it("returns only server-authorized organization URL metadata to Custom Page authors", () => {
    const routerSource = readFileSync(new URL("./lmsRouter.ts", import.meta.url), "utf8");
    const start = routerSource.indexOf("getPublicOrgInfo: protectedProcedure");
    const end = routerSource.indexOf("get: protectedProcedure", start);
    const orgInfoSource = routerSource.slice(start, end);

    expect(orgInfoSource).toContain("requireOrgAdmin(ctx.user.id, ctx.user.role, input.orgId)");
    expect(orgInfoSource).toContain("getOrgById(input.orgId)");
    expect(orgInfoSource).toContain("domainVerificationStatus: organization.domainVerificationStatus");
  });

  it("uses organization URLs in the management table, full-screen editor, and local preview route", () => {
    const customPagesSource = readFileSync(new URL("../client/src/pages/admin/CustomPagesPage.tsx", import.meta.url), "utf8");
    const pageBuilderSource = readFileSync(new URL("../client/src/pages/lms/PageBuilderPage.tsx", import.meta.url), "utf8");
    const publicPageSource = readFileSync(new URL("../client/src/pages/PublicPagePage.tsx", import.meta.url), "utf8");
    const appSource = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");

    expect(customPagesSource).toContain('import { getOrgCustomPageUrl } from "@/lib/orgUrl"');
    expect(customPagesSource).toContain("trpc.lms.pages.getPublicOrgInfo.useQuery");
    expect(customPagesSource).toContain("Open public page on this organization’s domain");
    expect(customPagesSource).toContain("copyPublicPageUrl");
    expect(customPagesSource).toContain("pageId: editingPage.id");
    expect(customPagesSource).toContain("pageId: pageToDelete");
    expect(customPagesSource).toContain("pageId: page.id");
    expect(pageBuilderSource).toContain('import { getOrgCustomPageUrl } from "@/lib/orgUrl"');
    expect(pageBuilderSource).toContain("trpc.lms.pages.getPublicOrgInfo.useQuery");
    expect(pageBuilderSource).toContain("getOrgCustomPageUrl(");
    expect(pageBuilderSource).toContain("{ pageId: context.id! }");
    expect(pageBuilderSource).toContain("pageId: context.id");
    expect(publicPageSource).toContain('useRoute("/school/:orgSlug/p/:slug")');
    expect(publicPageSource).toContain("getSubdomain() ?? pathFallbackParams?.orgSlug");
    expect(publicPageSource).toContain("orgSlug ? { orgSlug } : {}");
    expect(appSource).toContain('<Route path="/school/:orgSlug/p/:slug" component={PublicPagePage} />');
  });
});
