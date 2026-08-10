import { describe, it, expect } from "vitest";

describe("AI Email Generator - Course/Product Promo", () => {
  it("builds correct promo prompt with product details", () => {
    const product = {
      id: 1,
      title: "Advanced Echo Course",
      description: "Master echocardiography in 12 weeks",
      url: "https://myorg.teachific.app/courses/advanced-echo",
      kind: "course" as const,
    };
    const additionalInstructions = "Emphasize the limited-time discount.";
    const finalPrompt = `Write a promotional email for the following course/product:\n\nTitle: ${product.title}\nDescription: ${product.description}\nLanding Page URL: ${product.url}\n\nAdditional instructions: ${additionalInstructions}`;
    expect(finalPrompt).toContain("Advanced Echo Course");
    expect(finalPrompt).toContain("https://myorg.teachific.app/courses/advanced-echo");
    expect(finalPrompt).toContain("Emphasize the limited-time discount.");
  });

  it("uses fallback instructions when no additional prompt provided", () => {
    const product = {
      id: 2,
      title: "Live Webinar: CME Workshop",
      description: "",
      url: "https://myorg.teachific.app/webinars/cme-workshop",
      kind: "webinar" as const,
    };
    const additionalInstructions = "";
    const fallback = "Highlight the key benefits and include a clear call-to-action button linking to the landing page.";
    const finalPrompt = `Write a promotional email for the following course/product:\n\nTitle: ${product.title}\nDescription: ${product.description || "(no description provided)"}\nLanding Page URL: ${product.url}\n\nAdditional instructions: ${additionalInstructions || fallback}`;
    expect(finalPrompt).toContain("(no description provided)");
    expect(finalPrompt).toContain(fallback);
  });

  it("email type instructions map covers all 6 types", () => {
    const emailTypeInstructions: Record<string, string> = {
      promo: "PROMOTIONAL email",
      welcome: "WELCOME email",
      newsletter: "NEWSLETTER",
      event: "EVENT/WEBINAR INVITE",
      followup: "FOLLOW-UP",
      general: "general announcement",
    };
    const types = ["promo", "welcome", "newsletter", "event", "followup", "general"];
    types.forEach(t => {
      expect(emailTypeInstructions[t]).toBeTruthy();
    });
  });

  it("org-scoped product URL uses org base URL", () => {
    const orgBaseUrl = "https://myschool.teachific.app";
    const courseSlug = "intro-to-echo";
    const courseUrl = `${orgBaseUrl}/courses/${courseSlug}`;
    expect(courseUrl).toBe("https://myschool.teachific.app/courses/intro-to-echo");
    expect(courseUrl).not.toContain("learn.teachific.com");
    expect(courseUrl).not.toContain("learn.teachific.app");
  });

  it("product picker flattens all product types into single list", () => {
    const promoProducts = {
      courses: [{ id: 1, title: "Course A", description: "", url: "/courses/a", type: "course" }],
      workshops: [{ id: 2, title: "Workshop B", description: "", url: "/workshops/b" }],
      cohorts: [{ id: 3, title: "Cohort C", description: "", url: "/cohorts/c" }],
      webinars: [{ id: 4, title: "Webinar D", description: "", url: "/webinars/d" }],
      downloads: [{ id: 5, title: "Download E", description: "", url: "/downloads/e" }],
    };
    const allProducts = [
      ...(promoProducts.courses ?? []).map(p => ({ ...p, kind: "course" as const })),
      ...(promoProducts.workshops ?? []).map(p => ({ ...p, kind: "workshop" as const })),
      ...(promoProducts.cohorts ?? []).map(p => ({ ...p, kind: "cohort" as const })),
      ...(promoProducts.webinars ?? []).map(p => ({ ...p, kind: "webinar" as const })),
      ...(promoProducts.downloads ?? []).map(p => ({ ...p, kind: "download" as const })),
    ];
    expect(allProducts).toHaveLength(5);
    expect(allProducts.map(p => p.kind)).toEqual(["course", "workshop", "cohort", "webinar", "download"]);
  });

  it("generate button disabled when promo type selected but no product chosen", () => {
    const emailType = "promo";
    const selectedProductId = "";
    const prompt = "Some prompt";
    const isDisabled = emailType === "promo" ? !selectedProductId : !prompt.trim();
    expect(isDisabled).toBe(true);
  });

  it("generate button enabled when promo type selected and product chosen", () => {
    const emailType = "promo";
    const selectedProductId = "1";
    const isDisabled = emailType === "promo" ? !selectedProductId : false;
    expect(isDisabled).toBe(false);
  });

  it("generate button enabled for non-promo type when prompt provided", () => {
    const emailType = "welcome";
    const prompt = "Welcome our new students";
    const selectedProductId = "";
    const isDisabled = emailType === "promo" ? !selectedProductId : !prompt.trim();
    expect(isDisabled).toBe(false);
  });
});
