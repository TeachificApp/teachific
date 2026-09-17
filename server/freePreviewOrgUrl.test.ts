import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getFreePreviewCourseUrl } from "./lib/freePreviewUrl";

describe("Course360 free preview confirmation URLs", () => {
  it("uses the owning organization's verified custom learner domain", () => {
    expect(getFreePreviewCourseUrl({
      slug: "northwind",
      customDomain: "https://learn.northwind.example/",
      domainVerificationStatus: "verified",
    }, "intro course", "preview-token")).toBe(
      "https://learn.northwind.example/courses/intro%20course?preview_token=preview-token",
    );
  });

  it("falls back to the Course360 organization subdomain when custom domain verification is absent", () => {
    expect(getFreePreviewCourseUrl({
      slug: "northwind",
      customDomain: "learn.northwind.example",
      domainVerificationStatus: "pending",
    }, "intro", "preview-token")).toBe(
      "https://northwind.course360.app/courses/intro?preview_token=preview-token",
    );
  });

  it("keeps the public enrollment route tied to the course owner's organization record", () => {
    const routerSource = readFileSync(new URL("./routers/lmsRouter.ts", import.meta.url), "utf8");
    const routeSource = routerSource.slice(
      routerSource.indexOf("registerFreePreview: publicProcedure"),
      routerSource.indexOf("checkFreePreviewToken: publicProcedure"),
    );

    expect(routeSource).toContain("orgId: lmsCourses.orgId");
    expect(routeSource).toContain("eq(organizations.id, course.orgId)");
    expect(routeSource).toContain("getFreePreviewCourseUrl(organization, course.slug, accessToken)");
    expect(routeSource).not.toMatch(/teachific\.app|allaboutultrasound\.com|input\.origin/i);
  });
});
