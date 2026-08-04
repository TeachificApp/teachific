/**
 * Checkout Terms Override — unit tests
 *
 * Validates the resolution hierarchy:
 *   content-level terms > org-level terms > platform default (termsUrl / privacyUrl)
 *
 * These tests exercise the pure resolution logic extracted from lmsCheckoutRouter
 * without hitting the database.
 */

import { describe, it, expect } from "vitest";

// ─── Resolution helper (mirrors lmsCheckoutRouter logic) ─────────────────────

interface TermsSource {
  purchaseTermsAgreement?: string | null;
  purchaseTermsLink1Label?: string | null;
  purchaseTermsLink1Url?: string | null;
  purchaseTermsLink2Label?: string | null;
  purchaseTermsLink2Url?: string | null;
}

/**
 * Resolves the effective checkout terms by applying the override hierarchy:
 * content-level → org-level → null (caller falls back to platform defaults).
 */
function resolveCheckoutTerms(
  contentTerms: TermsSource | null | undefined,
  orgTerms: TermsSource | null | undefined
): TermsSource | null {
  // Content-level wins if agreement sentence is set
  if (contentTerms?.purchaseTermsAgreement) {
    return {
      purchaseTermsAgreement: contentTerms.purchaseTermsAgreement,
      purchaseTermsLink1Label: contentTerms.purchaseTermsLink1Label ?? null,
      purchaseTermsLink1Url: contentTerms.purchaseTermsLink1Url ?? null,
      purchaseTermsLink2Label: contentTerms.purchaseTermsLink2Label ?? null,
      purchaseTermsLink2Url: contentTerms.purchaseTermsLink2Url ?? null,
    };
  }
  // Org-level is next
  if (orgTerms?.purchaseTermsAgreement) {
    return {
      purchaseTermsAgreement: orgTerms.purchaseTermsAgreement,
      purchaseTermsLink1Label: orgTerms.purchaseTermsLink1Label ?? null,
      purchaseTermsLink1Url: orgTerms.purchaseTermsLink1Url ?? null,
      purchaseTermsLink2Label: orgTerms.purchaseTermsLink2Label ?? null,
      purchaseTermsLink2Url: orgTerms.purchaseTermsLink2Url ?? null,
    };
  }
  // Fall through to platform default
  return null;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("resolveCheckoutTerms — hierarchy", () => {
  const orgTerms: TermsSource = {
    purchaseTermsAgreement: "I agree to the org",
    purchaseTermsLink1Label: "Org Terms",
    purchaseTermsLink1Url: "https://org.example.com/terms",
    purchaseTermsLink2Label: "Org Privacy",
    purchaseTermsLink2Url: "https://org.example.com/privacy",
  };

  const contentTerms: TermsSource = {
    purchaseTermsAgreement: "I agree to the course",
    purchaseTermsLink1Label: "Course Terms",
    purchaseTermsLink1Url: "https://course.example.com/terms",
    purchaseTermsLink2Label: null,
    purchaseTermsLink2Url: null,
  };

  it("returns content-level terms when content has an agreement sentence", () => {
    const result = resolveCheckoutTerms(contentTerms, orgTerms);
    expect(result?.purchaseTermsAgreement).toBe("I agree to the course");
    expect(result?.purchaseTermsLink1Label).toBe("Course Terms");
    expect(result?.purchaseTermsLink2Url).toBeNull();
  });

  it("falls back to org-level when content has no agreement sentence", () => {
    const result = resolveCheckoutTerms({ purchaseTermsAgreement: null }, orgTerms);
    expect(result?.purchaseTermsAgreement).toBe("I agree to the org");
    expect(result?.purchaseTermsLink1Url).toBe("https://org.example.com/terms");
  });

  it("falls back to org-level when content is null", () => {
    const result = resolveCheckoutTerms(null, orgTerms);
    expect(result?.purchaseTermsAgreement).toBe("I agree to the org");
  });

  it("returns null when both content and org have no agreement sentence", () => {
    const result = resolveCheckoutTerms(
      { purchaseTermsAgreement: null },
      { purchaseTermsAgreement: "" }
    );
    expect(result).toBeNull();
  });

  it("returns null when both content and org are null", () => {
    const result = resolveCheckoutTerms(null, null);
    expect(result).toBeNull();
  });

  it("returns null when both are undefined", () => {
    const result = resolveCheckoutTerms(undefined, undefined);
    expect(result).toBeNull();
  });
});

describe("resolveCheckoutTerms — field propagation", () => {
  it("carries all five fields from content-level override", () => {
    const content: TermsSource = {
      purchaseTermsAgreement: "Agree to",
      purchaseTermsLink1Label: "L1",
      purchaseTermsLink1Url: "https://l1.example.com",
      purchaseTermsLink2Label: "L2",
      purchaseTermsLink2Url: "https://l2.example.com",
    };
    const result = resolveCheckoutTerms(content, null);
    expect(result).toMatchObject({
      purchaseTermsAgreement: "Agree to",
      purchaseTermsLink1Label: "L1",
      purchaseTermsLink1Url: "https://l1.example.com",
      purchaseTermsLink2Label: "L2",
      purchaseTermsLink2Url: "https://l2.example.com",
    });
  });

  it("nullifies missing link fields from content-level override", () => {
    const content: TermsSource = {
      purchaseTermsAgreement: "Agree to",
    };
    const result = resolveCheckoutTerms(content, null);
    expect(result?.purchaseTermsLink1Label).toBeNull();
    expect(result?.purchaseTermsLink1Url).toBeNull();
    expect(result?.purchaseTermsLink2Label).toBeNull();
    expect(result?.purchaseTermsLink2Url).toBeNull();
  });
});

describe("resolveCheckoutTerms — org-scoped isolation", () => {
  it("org A terms do not bleed into org B (independent resolution)", () => {
    const orgA: TermsSource = {
      purchaseTermsAgreement: "Org A terms",
      purchaseTermsLink1Url: "https://orga.example.com/terms",
    };
    const orgB: TermsSource = {
      purchaseTermsAgreement: "Org B terms",
      purchaseTermsLink1Url: "https://orgb.example.com/terms",
    };

    const resultA = resolveCheckoutTerms(null, orgA);
    const resultB = resolveCheckoutTerms(null, orgB);

    expect(resultA?.purchaseTermsAgreement).toBe("Org A terms");
    expect(resultB?.purchaseTermsAgreement).toBe("Org B terms");
    expect(resultA?.purchaseTermsLink1Url).not.toBe(resultB?.purchaseTermsLink1Url);
  });
});
