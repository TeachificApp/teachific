import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assertPublicQuizDeliveryHost } from "./lib/publicQuizDeliveryScope";

const organization = {
  id: 7,
  slug: "northwind",
  customDomain: "learn.northwind.example",
  domainVerificationStatus: "verified",
};

describe("Course360 public QuizMaker delivery scope", () => {
  it("accepts only the owning Course360 organization subdomain or verified custom learner domain", () => {
    expect(() => assertPublicQuizDeliveryHost({ headers: { host: "northwind.course360.app" } }, organization)).not.toThrow();
    expect(() => assertPublicQuizDeliveryHost({ headers: { host: "learn.northwind.example" } }, organization)).not.toThrow();
  });

  it("rejects a valid public share credential when it is requested from a different organization domain", () => {
    expect(() => assertPublicQuizDeliveryHost({ headers: { host: "other-school.course360.app" } }, organization))
      .toThrow("Quiz not found or not published");
    expect(() => assertPublicQuizDeliveryHost({ headers: { host: "another-school.example" } }, organization))
      .toThrow("Quiz not found or not published");
  });

  it("keeps the canonical Course360 root and local previews compatible without using either in generated URLs", () => {
    expect(() => assertPublicQuizDeliveryHost({ headers: { host: "course360.app" } }, organization)).not.toThrow();
    expect(() => assertPublicQuizDeliveryHost({ headers: { host: "3000-preview.manus.computer" } }, organization)).not.toThrow();
  });

  it("uses the same ownership check before public quiz reads, branding, and attempt writes", () => {
    const routerSource = readFileSync(new URL("./quizMakerRouter.ts", import.meta.url), "utf8");
    const dialogSource = readFileSync(new URL("../client/src/quiz-creator/components/ShareDialog.tsx", import.meta.url), "utf8");
    const urlSource = readFileSync(new URL("./lib/orgUrl.ts", import.meta.url), "utf8");

    const publicQuizSource = routerSource.slice(
      routerSource.indexOf("getPublishedQuiz: publicProcedure"),
      routerSource.indexOf("getWidgetQuiz: publicProcedure"),
    );
    const attemptSource = routerSource.slice(
      routerSource.indexOf("submitAttempt: publicProcedure"),
      routerSource.indexOf("getAttempts: protectedProcedure"),
    );
    const brandingSource = routerSource.slice(
      routerSource.indexOf("getQuizBranding: publicProcedure"),
      routerSource.indexOf("// ── SCORM Export"),
    );

    expect(publicQuizSource).toContain("getPublicQuizOrganization(db, quiz.orgId)");
    expect(publicQuizSource).toContain("assertPublicQuizDeliveryHost(ctx.req, organization)");
    expect(attemptSource).toContain("getPublicQuizOrganization(db, quiz.orgId)");
    expect(attemptSource).toContain("assertPublicQuizDeliveryHost(ctx.req, organization)");
    expect(brandingSource).toContain("getPublicQuizOrganization(db, shareQuiz?.orgId)");
    expect(brandingSource).toContain("assertPublicQuizDeliveryHost(ctx.req, organization)");
    expect(routerSource).toContain("shareUrl: getOrgQuizUrl(");
    expect(urlSource).toContain("export function getOrgQuizUrl(");
    expect(dialogSource).toContain("const shareUrl = publishStatus?.shareUrl ?? \"\";");
    expect(dialogSource).not.toContain("window.location.origin}/quiz/");
  });
});
